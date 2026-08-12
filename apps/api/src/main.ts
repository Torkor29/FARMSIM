import express from "express";
import cors from "cors";
import {
  PrismaClient,
  CropCode,
  BuildingType,
  ContractJobType,
  CellKind,
} from "@prisma/client";
import { z } from "zod";
import {
  BUILDING_DEFS,
  CROP_DEFS,
  DRYING,
  MARKET_BOUNDS,
  SPECIALIZATION_LABELS,
  footprintCells,
  DEFAULT_GRID,
  MACHINE_DEFS,
  CONTRACT_WORK,
  CONTRACT_WEAR_CELLS,
  SIM_TICK_MS,
  WEATHER_LABELS,
  WORLD,
  CONTINENT_BY_CODE,
  REGION_BY_CODE,
  CLASS_PROFILES,
  parcelName,
  marketValue,
  askPrice,
  accessIndex,
  canAcquire,
  landTax,
  landStatusFor,
  estateBonuses,
  LAND_CAPS,
  LAND_STATUS_LABELS,
  type AcquisitionRule,
  buildingStatsAtLevel,
  buildingUpgradeCost,
  buildingLevelDef,
  MAX_BUILDING_LEVEL,
  currentSeason,
  seasonProgress,
  pickWeather,
  climateYieldFactor,
  type Hemisphere,
  type BuildingType as SharedBuildingType,
  type MachineType,
  type WeatherState,
} from "@farmsim/shared";
import {
  simulateCell,
  sellToMarket,
  tickMarket,
  applyMachineWear,
  repairMachineCost,
  machineCanWork,
  marketNpcPressure,
  buildSessionResume,
  harvestMoisture,
  dryInventory,
  moistureSellPenalty,
  mergeMoisture,
} from "@farmsim/sim";
import { randomBytes } from "crypto";
import path from "node:path";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

// Le front (apps/web) appelle toujours `${API}${chemin}` avec API = "/api" —
// en développement, le serveur Vite réécrit `/api/xxx` en `/xxx` avant de
// relayer vers cette API (voir apps/web/vite.config.ts). En production, les
// deux sont servis par le même processus : on reproduit la même réécriture
// ici, pour que les routes ci-dessous (déclarées sans préfixe) n'aient pas à
// changer.
app.use((req, _res, next) => {
  if (req.url.startsWith("/api/") || req.url === "/api") {
    req.url = req.url.slice(4) || "/";
  }
  next();
});

const PORT = Number(process.env.PORT ?? 3001);

async function createParcelGrid(parcelId: string, gridW: number, gridH: number) {
  const data = [];
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      data.push({ parcelId, x, y, kind: "EMPTY" as CellKind });
    }
  }
  await prisma.parcelCell.createMany({ data });
}

function farmInclude() {
  return {
    parcels: {
      include: {
        zone: true,
        cells: true,
        buildings: true,
        machines: true,
      },
    },
    machines: true,
    inventory: true,
  } as const;
}

type FarmMachine = {
  id: string;
  type: string;
  condition: number;
  storedInBuildingId: string | null;
};

/** Choisit une machine capable du travail, condition OK. */
function pickMachineForWork(
  machines: FarmMachine[],
  work: "PLANT" | "FERTILIZE" | "HARVEST" | "PLOW",
): { machine: FarmMachine; def: (typeof MACHINE_DEFS)[MachineType] } | null {
  const candidates = machines
    .map((m) => {
      const def = MACHINE_DEFS[m.type as MachineType];
      if (!def || !def.works.includes(work)) return null;
      if (!machineCanWork(m.condition, def.minCondition)) return null;
      return { machine: m, def };
    })
    .filter(Boolean) as { machine: FarmMachine; def: (typeof MACHINE_DEFS)[MachineType] }[];

  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (work === "FERTILIZE") {
      const ap = a.def.type === "SPREADER" ? 1 : 0;
      const bp = b.def.type === "SPREADER" ? 1 : 0;
      if (ap !== bp) return bp - ap;
    }
    return b.machine.condition - a.machine.condition;
  });
  return candidates[0];
}

async function applyWearToMachine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  opts: {
    machine: FarmMachine;
    def: (typeof MACHINE_DEFS)[MachineType];
    cells: number;
    specialization?: string;
  },
) {
  const wear = applyMachineWear({
    condition: opts.machine.condition,
    wearPerCell: opts.def.wearPerCell,
    cells: opts.cells,
    inShed: Boolean(opts.machine.storedInBuildingId),
    etaBonus: opts.specialization === "ETA",
  });
  await tx.machine.update({
    where: { id: opts.machine.id },
    data: { condition: wear.condition },
  });
  return wear;
}

const ACQUISITION_ERRORS: Record<AcquisitionRule, string> = {
  LEVEL_TOO_LOW: "Votre niveau est trop bas pour une parcelle de plus",
  MAX_PARCELS_PER_PLAYER: `Plafond atteint : ${LAND_CAPS.global} parcelles maximum`,
  MAX_PARCELS_PER_REGION: `Plafond régional atteint : ${LAND_CAPS.perRegion} parcelles par région`,
  MAX_REGION_SHARE_PLAYER: `Vous détiendriez plus de ${Math.round(LAND_CAPS.regionSharePct * 100)} % de la région`,
};

type OwnedParcel = { zoneId: string; mapX: number; mapY: number };

/**
 * Valorisation d'une parcelle : la valeur publique sert à la taxe et à
 * l'affichage, le prix demandé ajoute l'adjacence et l'escalade patrimoniale
 * propres à l'acheteur.
 */
async function quoteParcel(
  target: { id: string; zoneId: string; mapX: number; mapY: number; fertility: number; accessIndex: number; zone: { koppen: string; continentCode: string } },
  owned: OwnedParcel[],
  _playerLevel: number,
) {
  const [regionTotal, regionTaken, continentTotal, continentTaken] = await Promise.all([
    prisma.parcel.count({ where: { zoneId: target.zoneId } }),
    prisma.parcel.count({ where: { zoneId: target.zoneId, farmId: { not: null } } }),
    prisma.parcel.count({ where: { zone: { continentCode: target.zone.continentCode } } }),
    prisma.parcel.count({
      where: { zone: { continentCode: target.zone.continentCode }, farmId: { not: null } },
    }),
  ]);

  const neighborDensity = regionTotal > 0 ? regionTaken / regionTotal : 0;
  const occupancy = continentTotal > 0 ? continentTaken / continentTotal : 0;
  const adjacentOwnedBorders = owned.filter(
    (p) =>
      p.zoneId === target.zoneId &&
      ((Math.abs(p.mapX - target.mapX) === 1 && p.mapY === target.mapY) ||
        (Math.abs(p.mapY - target.mapY) === 1 && p.mapX === target.mapX)),
  ).length;

  const publicInput = {
    fertility: target.fertility,
    koppen: target.zone.koppen,
    accessIndex: target.accessIndex,
    neighborDensity,
    occupancy,
  };
  const priced = askPrice({
    ...publicInput,
    adjacentOwnedBorders,
    ownershipRank: owned.length + 1,
  });

  return {
    parcelId: target.id,
    marketValue: marketValue(publicInput),
    total: priced.total,
    breakdown: priced.breakdown,
    adjacentOwnedBorders,
    ownershipRank: owned.length + 1,
    neighborDensity,
    occupancy,
  };
}

async function getFarmBonuses(farmId: string) {
  const buildings = await prisma.building.findMany({
    where: { parcel: { farmId } },
  });
  let yieldBonus = 0;
  let storageGrain = 10; // base
  let storageHay = 5;
  let machineSlots = 2;
  let cattleSlots = 0;
  let pigSlots = 0;
  let repairDiscount = 0;
  let xpBonus = 0;
  let softDryer = false;
  for (const b of buildings) {
    const stats = buildingStatsAtLevel(b.type as SharedBuildingType, b.level);
    yieldBonus += stats.yieldBonus ?? 0;
    storageGrain += stats.storageGrain ?? 0;
    storageHay += stats.storageHay ?? 0;
    machineSlots += stats.machineSlots ?? 0;
    cattleSlots += stats.cattleSlots ?? 0;
    pigSlots += stats.pigSlots ?? 0;
    repairDiscount += stats.repairDiscount ?? 0;
    xpBonus += stats.xpBonus ?? 0;
    if (stats.softDryer) softDryer = true;
  }
  return {
    yieldBonus: Math.min(0.1, yieldBonus),
    storageGrain,
    storageHay,
    machineSlots,
    cattleSlots,
    pigSlots,
    repairDiscount: Math.min(0.3, repairDiscount),
    xpBonus: Math.min(0.1, xpBonus),
    softDryer,
  };
}

async function ensureSeed() {
  if ((await prisma.zone.count()) === 0) {
    for (const continent of WORLD) {
      for (const region of continent.regions) {
        const zone = await prisma.zone.create({
          data: {
            code: region.code,
            name: region.name,
            country: continent.code,
            koppen: region.koppen,
            riskNote: region.riskNote,
            mapW: region.mapW,
            mapH: region.mapH,
            continentCode: continent.code,
            continentName: continent.name,
            city: region.city,
            climateLabel: region.climateLabel,
            hemisphere: continent.hemisphere,
            lat: region.lat,
            lon: region.lon,
            priceMult: region.priceMult,
            baseFertility: region.fertility,
          },
        });
        let n = 0;
        for (let my = 0; my < region.mapH; my++) {
          for (let mx = 0; mx < region.mapW; mx++) {
            // Variation locale de fertilité : le centre de la région est
            // toujours un peu meilleur que ses marges.
            const dx = (mx - (region.mapW - 1) / 2) / Math.max(1, region.mapW);
            const dy = (my - (region.mapH - 1) / 2) / Math.max(1, region.mapH);
            const edge = Math.sqrt(dx * dx + dy * dy);
            const fertility = Math.max(
              0.25,
              Math.min(0.97, region.fertility * (1.08 - edge * 0.35)),
            );
            // La distance au hub de marché fait le gros de l'indice d'accès :
            // le centre de la région vaut plus cher que ses confins.
            const hubDistance = Math.max(
              Math.abs(mx - Math.floor((region.mapW - 1) / 2)),
              Math.abs(my - Math.floor((region.mapH - 1) / 2)),
            );
            const access = accessIndex({ hubDistance, road: 0.6, silo: 0.3, rail: 0.1 });
            const parcel = await prisma.parcel.create({
              data: {
                zoneId: zone.id,
                label: parcelName(continent.code, n++),
                mapX: mx,
                mapY: my,
                gridW: DEFAULT_GRID.w,
                gridH: DEFAULT_GRID.h,
                fertility,
                accessIndex: access,
                landPrice: marketValue({
                  fertility,
                  koppen: region.koppen,
                  cropFitA: region.crops.length >= 2,
                  accessIndex: access,
                  neighborDensity: 0,
                  occupancy: 0,
                }),
              },
            });
            await createParcelGrid(parcel.id, DEFAULT_GRID.w, DEFAULT_GRID.h);
          }
        }
      }
    }
  }

  for (const code of ["WHEAT", "MAIZE"] as CropCode[]) {
    const existing = await prisma.marketPrice.findUnique({ where: { commodity: code } });
    if (!existing) {
      await prisma.marketPrice.create({
        data: {
          commodity: code,
          price: MARKET_BOUNDS[code].initial,
          stockTons: 2000,
        },
      });
    }
  }

  if ((await prisma.npcContract.count({ where: { status: "OPEN" } })) < 5) {
    const jobs: {
      jobType: ContractJobType;
      title: string;
      rewardCrd: number;
      regionNote: string;
    }[] = [
      { jobType: "HARVEST", title: "Moisson blé — 12 ha", rewardCrd: 850, regionNote: "Beauce" },
      { jobType: "PLOW", title: "Labour de printemps", rewardCrd: 420, regionNote: "Iowa" },
      { jobType: "SOW", title: "Semis maïs", rewardCrd: 560, regionNote: "Beauce" },
      { jobType: "FERTILIZE", title: "Épandage NPK", rewardCrd: 380, regionNote: "Iowa" },
      { jobType: "TRANSPORT", title: "Transport grain → silo", rewardCrd: 300, regionNote: "Beauce" },
    ];
    for (const j of jobs) await prisma.npcContract.create({ data: j });
  }

  const zonesForWeather = await prisma.zone.findMany({ select: { code: true } });
  for (const z of zonesForWeather) {
    const existing = await prisma.weatherSnapshot.findFirst({ where: { zoneCode: z.code } });
    if (!existing) {
      await prisma.weatherSnapshot.create({ data: { zoneCode: z.code, state: "CLEAR" } });
    }
  }
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "farmsim-api" }));
app.get("/meta/specializations", (_req, res) => res.json(SPECIALIZATION_LABELS));
app.get("/meta/buildings", (_req, res) => res.json(BUILDING_DEFS));
app.get("/meta/machines", (_req, res) => res.json(MACHINE_DEFS));

app.get("/zones", async (_req, res) => {
  const zones = await prisma.zone.findMany({
    include: {
      parcels: {
        select: {
          id: true,
          label: true,
          mapX: true,
          mapY: true,
          landPrice: true,
          farmId: true,
          gridW: true,
          gridH: true,
        },
      },
    },
  });
  res.json(zones);
});

app.get("/meta/classes", (_req, res) => res.json(CLASS_PROFILES));

/**
 * Vue globe : un continent par entrée, avec l'occupation réelle des terres.
 * Sert à peindre la carte du monde avant même que le joueur ait un compte.
 */
app.get("/world", async (_req, res) => {
  const zones = await prisma.zone.findMany({
    include: { parcels: { select: { farmId: true } } },
  });
  const byContinent = new Map<string, { total: number; taken: number; regions: number }>();
  for (const z of zones) {
    const entry = byContinent.get(z.continentCode) ?? { total: 0, taken: 0, regions: 0 };
    entry.total += z.parcels.length;
    entry.taken += z.parcels.filter((p) => p.farmId).length;
    entry.regions += 1;
    byContinent.set(z.continentCode, entry);
  }
  const now = Date.now();
  res.json({
    seasonProgress: seasonProgress(now),
    continents: WORLD.map((c) => {
      const stats = byContinent.get(c.code) ?? { total: 0, taken: 0, regions: 0 };
      return {
        code: c.code,
        name: c.name,
        tagline: c.tagline,
        description: c.description,
        hemisphere: c.hemisphere,
        difficulty: c.difficulty,
        lat: c.lat,
        lon: c.lon,
        color: c.color,
        accent: c.accent,
        priceMult: c.priceMult,
        season: currentSeason(c.hemisphere as Hemisphere, now),
        regionCount: stats.regions,
        parcelTotal: stats.total,
        parcelTaken: stats.taken,
        parcelFree: stats.total - stats.taken,
      };
    }),
  });
});

/** Détail d'un continent : régions, parcelles, propriétaires. */
app.get("/world/:continent", async (req, res) => {
  const continent = CONTINENT_BY_CODE[req.params.continent.toUpperCase()];
  if (!continent) {
    res.status(404).json({ error: "Continent inconnu" });
    return;
  }
  const zones = await prisma.zone.findMany({
    where: { continentCode: continent.code },
    include: {
      parcels: {
        select: {
          id: true,
          label: true,
          mapX: true,
          mapY: true,
          gridW: true,
          gridH: true,
          fertility: true,
          landPrice: true,
          farmId: true,
          farm: { select: { name: true, user: { select: { displayName: true } } } },
        },
        orderBy: [{ mapY: "asc" }, { mapX: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
  const weather = await prisma.weatherSnapshot.findMany();
  const now = Date.now();
  res.json({
    continent: {
      code: continent.code,
      name: continent.name,
      tagline: continent.tagline,
      description: continent.description,
      hemisphere: continent.hemisphere,
      difficulty: continent.difficulty,
      color: continent.color,
      accent: continent.accent,
      season: currentSeason(continent.hemisphere as Hemisphere, now),
    },
    regions: zones.map((z) => {
      const region = REGION_BY_CODE[z.code];
      const crops = region?.crops ?? [];
      return {
      code: z.code,
      name: z.name,
      city: z.city,
      koppen: z.koppen,
      climateLabel: z.climateLabel,
      riskNote: z.riskNote,
      crops,
      // Une région où ni blé ni maïs ne pousse est un piège pour un débutant :
      // elle reste achetable plus tard, mais jamais comme ferme de départ.
      starterEligible: crops.length > 0,
      lat: z.lat,
      lon: z.lon,
      mapW: z.mapW,
      mapH: z.mapH,
      fertility: z.baseFertility,
      weather: weather.find((w) => w.zoneCode === z.code)?.state ?? "CLEAR",
      parcels: z.parcels.map((p) => ({
        id: p.id,
        label: p.label,
        mapX: p.mapX,
        mapY: p.mapY,
        gridW: p.gridW,
        gridH: p.gridH,
        fertility: p.fertility,
        landPrice: p.landPrice,
        taken: Boolean(p.farmId),
        ownerName: p.farm?.user?.displayName ?? null,
      })),
      };
    }),
  });
});

/**
 * Attribution de la parcelle de départ : gratuite, une seule fois, et
 * seulement si le joueur n'a pas encore de terre.
 */
app.post("/world/claim", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const body = z
    .object({
      parcelId: z.string(),
      specialization: z.enum(["CEREALIER", "ELEVEUR", "ETA"]),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: auth.user.id },
        include: { farm: { include: { parcels: true, machines: true } } },
      });
      if (!user) throw new Error("NOT_FOUND");
      if (user.farm && user.farm.parcels.length > 0) throw new Error("ALREADY_SETTLED");

      const parcel = await tx.parcel.findFirst({
        where: { id: body.data.parcelId, farmId: null },
        include: { zone: true },
      });
      if (!parcel) throw new Error("PARCEL_UNAVAILABLE");
      // La parcelle de départ ne doit jamais être un piège : on refuse les
      // régions où aucune culture du catalogue ne pousse.
      if ((REGION_BY_CODE[parcel.zone.code]?.crops.length ?? 0) === 0) {
        throw new Error("REGION_NOT_STARTER");
      }

      await tx.user.update({
        where: { id: user.id },
        data: { specialization: body.data.specialization },
      });

      let farm = user.farm;
      if (!farm) {
        farm = await tx.farm.create({
          data: { userId: user.id, name: `Ferme ${user.displayName}` },
          include: { parcels: true, machines: true },
        });
      }

      if (farm.machines.length === 0) {
        const types =
          body.data.specialization === "ETA"
            ? [{ type: "TRACTOR" as const, tier: 1 }, { type: "HARVESTER" as const, tier: 1 }]
            : [{ type: "TRACTOR" as const, tier: 1 }];
        for (const m of types) {
          await tx.machine.create({ data: { ...m, farmId: farm.id } });
        }
      }

      await tx.parcel.update({ where: { id: parcel.id }, data: { farmId: farm.id } });

      const machine = await tx.machine.findFirst({ where: { farmId: farm.id } });
      if (machine) {
        await tx.machine.update({
          where: { id: machine.id },
          data: { parkedParcelId: parcel.id },
        });
        await tx.parcelCell.update({
          where: {
            parcelId_x_y: { parcelId: parcel.id, x: 0, y: Math.max(0, parcel.gridH - 1) },
          },
          data: { kind: "VEHICLE", machineId: machine.id },
        });
      }
    });
    const player = await playerPayload(auth.user.id);
    res.status(201).json({ player });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "PARCEL_UNAVAILABLE") {
      res.status(409).json({ error: "Cette parcelle vient d'être prise" });
      return;
    }
    if (msg === "ALREADY_SETTLED") {
      res.status(409).json({ error: "Vous possédez déjà une exploitation" });
      return;
    }
    if (msg === "REGION_NOT_STARTER") {
      res.status(409).json({
        error: "Aucune culture ne pousse ici — choisissez une autre région pour débuter",
      });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/market", async (_req, res) => res.json(await prisma.marketPrice.findMany()));
app.get("/weather", async (_req, res) => res.json(await prisma.weatherSnapshot.findMany()));
app.get("/sim/status", (_req, res) => {
  res.json({
    lastTickAt: lastSimTick?.at ?? null,
    lastTick: lastSimTick,
    tickMs: SIM_TICK_MS,
    weatherLabels: WEATHER_LABELS,
  });
});
app.post("/sim/tick", async (_req, res) => {
  const result = await runWorldTick();
  res.json(result);
});
app.get("/contracts", async (_req, res) => {
  res.json(
    await prisma.npcContract.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
    }),
  );
});

let lastSimTick: {
  at: string;
  weather: { zoneCode: string; state: string; changed: boolean }[];
  market: { commodity: string; price: number; stockTons: number; supply: number; demand: number }[];
} | null = null;

async function runWorldTick() {
  const zones = await prisma.zone.findMany();
  const snapshots = await prisma.weatherSnapshot.findMany();
  const weatherOut: { zoneCode: string; state: string; changed: boolean }[] = [];

  const now = Date.now();
  for (const snap of snapshots) {
    const zone = zones.find((z) => z.code === snap.zoneCode);
    const koppen = zone?.koppen ?? "Cfb";
    const season = currentSeason((zone?.hemisphere as Hemisphere) ?? "N", now);
    // La météo suit le climat Köppen réel de la région et sa saison locale :
    // il ne peut pas neiger en Méridie l'été, ni faire sec en mousson.
    const state = pickWeather(koppen, season, Math.random);
    const changed = state !== snap.state;
    if (changed) {
      await prisma.weatherSnapshot.update({ where: { id: snap.id }, data: { state } });
    }
    weatherOut.push({ zoneCode: snap.zoneCode, state, changed });
  }

  const states = weatherOut.map((w) => w.state as WeatherState);
  const prices = await prisma.marketPrice.findMany();
  const marketOut: {
    commodity: string;
    price: number;
    stockTons: number;
    supply: number;
    demand: number;
  }[] = [];

  for (const row of prices) {
    const pressure = marketNpcPressure({ weatherStates: states });
    // Légère asymétrie blé / maïs
    const supply =
      row.commodity === "MAIZE" ? Math.round(pressure.supplyTons * 1.05) : pressure.supplyTons;
    const demand =
      row.commodity === "WHEAT" ? Math.round(pressure.demandTons * 1.05) : pressure.demandTons;
    const tick = tickMarket({
      commodity: row.commodity,
      price: row.price,
      supplyTons: supply,
      demandTons: demand,
      stockTons: row.stockTons,
    });
    await prisma.marketPrice.update({
      where: { id: row.id },
      data: { price: tick.price, stockTons: tick.stockTons },
    });
    marketOut.push({
      commodity: row.commodity,
      price: tick.price,
      stockTons: tick.stockTons,
      supply,
      demand,
    });
  }

  lastSimTick = {
    at: new Date().toISOString(),
    weather: weatherOut,
    market: marketOut,
  };
  return lastSimTick;
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function newSessionToken() {
  return randomBytes(24).toString("hex");
}

async function createSession(userId: string) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

async function userFromAuthHeader(req: express.Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { farm: { include: farmInclude() } } } },
  });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return { session, user: session.user };
}

async function marketPriceMap() {
  const rows = await prisma.marketPrice.findMany();
  return Object.fromEntries(rows.map((r) => [r.commodity, r.price])) as Record<string, number>;
}

async function buildResumeForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      farm: {
        include: {
          parcels: { include: { cells: true } },
        },
      },
    },
  });
  if (!user) return null;
  const now = Date.now();
  const last = user.lastSeenAt?.getTime() ?? user.createdAt.getTime();
  const awayMs = Math.max(0, now - last);
  let cropsReady = 0;
  let cropsGrowing = 0;
  for (const parcel of user.farm?.parcels ?? []) {
    for (const cell of parcel.cells) {
      if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) continue;
      const sim = simulateCell({
        crop: cell.crop,
        plantedAt: cell.plantedAt.getTime(),
        now,
        fertility: parcel.fertility,
        weedsControlled: cell.weedsControlled,
        fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
        specialization: user.specialization,
      });
      if (sim.ready) cropsReady += 1;
      else cropsGrowing += 1;
    }
  }
  let marketBefore: Record<string, number> = {};
  try {
    marketBefore = user.lastMarketJson ? JSON.parse(user.lastMarketJson) : {};
  } catch {
    marketBefore = {};
  }
  const marketNow = await marketPriceMap();
  const weather = await prisma.weatherSnapshot.findMany();
  return buildSessionResume({
    awayMs,
    cropsReady,
    cropsGrowing,
    marketBefore,
    marketNow,
    weatherStates: weather.map((w) => w.state),
  });
}

async function touchUserPresence(userId: string) {
  const market = await marketPriceMap();
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastSeenAt: new Date(),
      lastMarketJson: JSON.stringify(market),
    },
  });
}

async function playerPayload(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { farm: { include: farmInclude() } },
  });
  if (!user) return null;
  const bonuses = user.farm ? await getFarmBonuses(user.farm.id) : null;
  const { accessCode: _omit, ...safe } = user;
  void _omit;
  return { ...safe, bonuses };
}

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(32),
  /** Choisie plus tard, pendant l'installation guidée */
  specialization: z.enum(["CEREALIER", "ELEVEUR", "ETA"]).optional(),
  parcelId: z.string().optional(),
  accessCode: z.string().min(3).max(32).optional(),
});

app.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const { email, displayName, specialization, parcelId, accessCode } = parsed.data;
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          displayName,
          specialization: specialization ?? "CEREALIER",
          accessCode: accessCode ?? "ferme",
          lastSeenAt: new Date(),
        },
      });
      const farm = await tx.farm.create({
        data: {
          userId: u.id,
          name: `Ferme ${displayName}`,
          machines: {
            create:
              specialization === "ETA"
                ? [
                    { type: "TRACTOR", tier: 1 },
                    { type: "HARVESTER", tier: 1 },
                  ]
                : specialization
                  ? [{ type: "TRACTOR", tier: 1 }]
                  : [],
          },
        },
      });
      if (parcelId) {
        const parcel = await tx.parcel.findFirst({ where: { id: parcelId, farmId: null } });
        if (!parcel) throw new Error("PARCEL_UNAVAILABLE");
        const fresh = await tx.user.findUnique({ where: { id: u.id } });
        if (!fresh || fresh.crd < parcel.landPrice) throw new Error("INSUFFICIENT_FUNDS");
        await tx.user.update({ where: { id: u.id }, data: { crd: { decrement: parcel.landPrice } } });
        await tx.parcel.update({ where: { id: parcel.id }, data: { farmId: farm.id } });
        const machine = await tx.machine.findFirst({ where: { farmId: farm.id } });
        if (machine) {
          await tx.machine.update({
            where: { id: machine.id },
            data: { parkedParcelId: parcel.id },
          });
          await tx.parcelCell.update({
            where: {
              parcelId_x_y: {
                parcelId: parcel.id,
                x: 0,
                y: Math.max(0, parcel.gridH - 1),
              },
            },
            data: { kind: "VEHICLE", machineId: machine.id },
          });
        }
      }
      return tx.user.findUnique({
        where: { id: u.id },
        include: { farm: { include: farmInclude() } },
      });
    });
    if (!user) {
      res.status(500).json({ error: "Erreur création" });
      return;
    }
    const token = await createSession(user.id);
    await touchUserPresence(user.id);
    const player = await playerPayload(user.id);
    res.status(201).json({
      token,
      player,
      accessCodeHint: accessCode ?? "ferme",
      resume: await buildResumeForUser(user.id),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    if (msg === "PARCEL_UNAVAILABLE") {
      res.status(409).json({ error: "Parcelle indisponible" });
      return;
    }
    if (msg === "INSUFFICIENT_FUNDS") {
      res.status(402).json({ error: "CRD insuffisants" });
      return;
    }
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
      res.status(409).json({ error: "Email déjà utilisé" });
      return;
    }
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/auth/login", async (req, res) => {
  const body = z
    .object({
      email: z.string().email(),
      accessCode: z.string().min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (!user || user.accessCode !== body.data.accessCode) {
    res.status(401).json({ error: "Email ou code incorrect" });
    return;
  }
  const resume = await buildResumeForUser(user.id);
  const token = await createSession(user.id);
  await touchUserPresence(user.id);
  const player = await playerPayload(user.id);
  res.json({ token, player, resume });
});

app.get("/auth/me", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const player = await playerPayload(auth.user.id);
  res.json({ token: auth.session.token, player });
});

app.get("/session/resume", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const resume = await buildResumeForUser(auth.user.id);
  res.json(resume);
});

app.post("/session/heartbeat", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  await touchUserPresence(auth.user.id);
  res.json({ ok: true, at: new Date().toISOString() });
});

app.get("/players/:id", async (req, res) => {
  const player = await playerPayload(req.params.id);
  if (!player) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.json(player);
});
app.get("/parcels/:id", async (req, res) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { zone: true, cells: true, buildings: true, machines: true, farm: true },
  });
  if (!parcel) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  const weather = await prisma.weatherSnapshot.findFirst({ where: { zoneCode: parcel.zone.code } });
  const bonuses = parcel.farmId ? await getFarmBonuses(parcel.farmId) : null;
  const now = Date.now();
  const season = currentSeason((parcel.zone.hemisphere as Hemisphere) ?? "N", now);
  const climate = {
    season,
    koppen: parcel.zone.koppen,
    label: parcel.zone.climateLabel,
    yieldFactor: climateYieldFactor(parcel.zone.koppen, season),
  };
  const cellSims = [];
  for (const c of parcel.cells) {
    if (c.kind === "CROP" && c.crop && c.plantedAt) {
      const sim = simulateCell({
        crop: c.crop,
        plantedAt: c.plantedAt.getTime(),
        now,
        fertility: parcel.fertility,
        weedsControlled: c.weedsControlled,
        fertilizedPasses: Math.min(2, c.fertilizedPasses) as 0 | 1 | 2,
        buildingYieldBonus: bonuses?.yieldBonus,
        weatherAtHarvest: weather?.state as WeatherState | undefined,
      });
      if (sim.ready && c.fieldStage !== "READY") {
        await prisma.parcelCell.update({
          where: { id: c.id },
          data: { fieldStage: "READY" },
        });
      }
      cellSims.push({ x: c.x, y: c.y, sim });
    }
  }
  res.json({ parcel, weather, bonuses, cellSims, climate });
});

/** Achat parcelle adjacente (ou 1ʳᵉ parcelle si ferme sans terre) */
app.post("/parcels/:id/buy", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const target = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { zone: true },
  });
  if (!target || target.farmId) {
    res.status(409).json({ error: "Parcelle indisponible" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { parcels: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }

  const owned = user.farm.parcels;
  const quote = await quoteParcel(target, owned, user.level);

  const gate = canAcquire({
    playerLevel: user.level,
    ownedTotal: owned.length,
    ownedInRegion: owned.filter((p) => p.zoneId === target.zoneId).length,
    regionParcelCount: await prisma.parcel.count({ where: { zoneId: target.zoneId } }),
  });
  if (!gate.ok) {
    res.status(403).json({ error: ACQUISITION_ERRORS[gate.reason!] ?? "Acquisition refusée" });
    return;
  }
  if (user.crd < quote.total) {
    res.status(402).json({ error: `CRD insuffisants — ${quote.total} requis` });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { crd: { decrement: quote.total } },
    });
    await tx.parcel.update({
      where: { id: target.id },
      data: { farmId: user.farm!.id, landPrice: quote.marketValue },
    });
    return tx.user.findUnique({
      where: { id: user.id },
      include: { farm: { include: farmInclude() } },
    });
  });
  res.json({
    ...updated,
    paid: quote.total,
    marketValue: quote.marketValue,
    breakdown: quote.breakdown,
    adjacentOwned: quote.adjacentOwnedBorders,
  });
});

/** Devis détaillé avant achat : le joueur voit chaque facteur du prix. */
app.get("/parcels/:id/quote", async (req, res) => {
  const auth = await userFromAuthHeader(req);
  if (!auth) {
    res.status(401).json({ error: "Session invalide" });
    return;
  }
  const target = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { zone: true },
  });
  if (!target) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }
  const farm = await prisma.farm.findUnique({
    where: { userId: auth.user.id },
    include: { parcels: true },
  });
  const owned = farm?.parcels ?? [];
  const quote = await quoteParcel(target, owned, auth.user.level);
  const gate = canAcquire({
    playerLevel: auth.user.level,
    ownedTotal: owned.length,
    ownedInRegion: owned.filter((p) => p.zoneId === target.zoneId).length,
    regionParcelCount: await prisma.parcel.count({ where: { zoneId: target.zoneId } }),
  });
  res.json({
    ...quote,
    taken: Boolean(target.farmId),
    canAcquire: gate.ok,
    reason: gate.ok ? null : (ACQUISITION_ERRORS[gate.reason!] ?? "Acquisition refusée"),
    caps: LAND_CAPS,
  });
});

app.post("/parcels/:id/plant", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      crop: z.enum(["WHEAT", "MAIZE"]),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { machines: true } }, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const picked = pickMachineForWork(parcel.farm.machines, "PLANT");
  if (!picked) {
    res.status(409).json({
      error: "Tracteur requis (condition trop basse ou absent) — achetez / réparez.",
    });
    return;
  }
  const cost = CROP_DEFS[body.data.crop].seedCostPerCell * body.data.cells.length;
  if (user.crd < cost) {
    res.status(402).json({ error: "CRD insuffisants pour semences" });
    return;
  }

  for (const { x, y } of body.data.cells) {
    const cell = parcel.cells.find((c) => c.x === x && c.y === y);
    if (!cell || cell.kind !== "EMPTY") {
      res.status(409).json({ error: `Case ${x},${y} non libre` });
      return;
    }
  }

  const now = Date.now();
  const growMs = CROP_DEFS[body.data.crop].growMs;
  const wear = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    for (const { x, y } of body.data.cells) {
      await tx.parcelCell.update({
        where: { parcelId_x_y: { parcelId: parcel.id, x, y } },
        data: {
          kind: "CROP",
          crop: body.data.crop,
          fieldStage: "PLANTED",
          plantedAt: new Date(now),
          readyAt: new Date(now + growMs),
          fertilizedPasses: 0,
          weedsControlled: false,
        },
      });
    }
    return applyWearToMachine(tx, {
      machine: picked.machine,
      def: picked.def,
      cells: body.data.cells.length,
      specialization: user.specialization,
    });
  });
  res.json({
    parcel: await prisma.parcel.findUnique({
      where: { id: parcel.id },
      include: { cells: true, buildings: true },
    }),
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
  });
});

app.post("/parcels/:id/fertilize", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { machines: true } }, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  const picked = pickMachineForWork(parcel.farm.machines, "FERTILIZE");
  if (!picked) {
    res.status(409).json({
      error: "Tracteur ou épandeur requis (condition OK) pour fertiliser.",
    });
    return;
  }
  const cost = 10 * body.data.cells.length;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || user.crd < cost) {
    res.status(402).json({ error: "CRD insuffisants" });
    return;
  }
  let fertilized = 0;
  const wear = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    for (const { x, y } of body.data.cells) {
      const cell = parcel.cells.find((c) => c.x === x && c.y === y);
      if (!cell || cell.kind !== "CROP" || cell.fertilizedPasses >= 2) continue;
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: { fertilizedPasses: { increment: 1 }, weedsControlled: true },
      });
      fertilized += 1;
    }
    return applyWearToMachine(tx, {
      machine: picked.machine,
      def: picked.def,
      cells: Math.max(1, fertilized),
      specialization: user.specialization,
    });
  });
  res.json({ ok: true, fertilized, machine: { id: picked.machine.id, type: picked.machine.type, ...wear } });
});

app.post("/parcels/:id/harvest", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { machines: true } }, cells: true, zone: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  const picked = pickMachineForWork(parcel.farm.machines, "HARVEST");
  if (!picked) {
    res.status(409).json({
      error: "Moissonneuse requise — achetez-en une au garage ou jouez ETA.",
    });
    return;
  }
  const bonuses = await getFarmBonuses(parcel.farmId!);
  const weather = await prisma.weatherSnapshot.findFirst({ where: { zoneCode: parcel.zone.code } });
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  const targets = body.data.cells
    ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
    : parcel.cells.filter((c) => c.kind === "CROP");

  const harvested: { crop: CropCode; tons: number; moisturePenalty: number; moisture: number }[] =
    [];
  const now = Date.now();

  const wear = await prisma.$transaction(async (tx) => {
    for (const cell of targets) {
      if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) continue;
      const sim = simulateCell({
        crop: cell.crop,
        plantedAt: cell.plantedAt.getTime(),
        now,
        fertility: parcel.fertility,
        weedsControlled: cell.weedsControlled,
        fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
        specialization: user?.specialization,
        buildingYieldBonus: bonuses.yieldBonus,
        weatherAtHarvest: weather?.state as WeatherState | undefined,
      });
      if (!sim.ready) continue;
      const moisture = harvestMoisture(weather?.state as WeatherState | undefined);
      harvested.push({
        crop: cell.crop,
        tons: sim.estimatedYieldTons,
        moisturePenalty: sim.moisturePenalty,
        moisture,
      });
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          kind: "EMPTY",
          crop: null,
          fieldStage: "EMPTY",
          plantedAt: null,
          readyAt: null,
          fertilizedPasses: 0,
          weedsControlled: false,
        },
      });
    }

    const byCrop = new Map<CropCode, { tons: number; wet: boolean; moistureSum: number }>();
    for (const h of harvested) {
      const cur = byCrop.get(h.crop) ?? { tons: 0, wet: false, moistureSum: 0 };
      cur.tons += h.tons;
      cur.moistureSum += h.tons * h.moisture;
      if (h.moisturePenalty > 0 || h.moisture > DRYING.sellThreshold) cur.wet = true;
      byCrop.set(h.crop, cur);
    }
    for (const [crop, { tons, wet, moistureSum }] of byCrop) {
      const batchMoisture = tons > 0 ? moistureSum / tons : harvestMoisture();
      const existing = await tx.inventoryItem.findFirst({
        where: { farmId: parcel.farmId!, itemCode: crop },
      });
      if (existing) {
        const nextMoisture = mergeMoisture(existing.qty, existing.moisture, tons, batchMoisture);
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: {
            qty: { increment: tons },
            quality: wet ? Math.min(existing.quality, 2) : existing.quality,
            moisture: nextMoisture,
          },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            farmId: parcel.farmId!,
            itemCode: crop,
            qty: tons,
            quality: wet ? 2 : 3,
            moisture: Math.round(batchMoisture * 1000) / 1000,
          },
        });
      }
    }

    if (harvested.length === 0) {
      return null;
    }
    return applyWearToMachine(tx, {
      machine: picked.machine,
      def: picked.def,
      cells: harvested.length,
      specialization: user?.specialization,
    });
  });

  if (harvested.length === 0) {
    res.status(409).json({ error: "Rien à récolter (pas prêt)" });
    return;
  }
  res.json({
    harvested,
    totalTons: harvested.reduce((s, h) => s + h.tons, 0),
    bonuses,
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
  });
});

app.post("/parcels/:id/build", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      type: z.enum([
        "SILO",
        "HAY_BARN",
        "MACHINE_SHED",
        "CATTLE_BARN",
        "PIGSTY",
        "WORKSHOP",
        "FARMHOUSE",
      ]),
      x: z.number().int().min(0),
      y: z.number().int().min(0),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const def = BUILDING_DEFS[body.data.type];
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: true, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  if (body.data.x + def.w > parcel.gridW || body.data.y + def.h > parcel.gridH) {
    res.status(400).json({ error: "Emprise hors grille" });
    return;
  }
  const cells = footprintCells(body.data.x, body.data.y, def.w, def.h);
  for (const c of cells) {
    const cell = parcel.cells.find((p) => p.x === c.x && p.y === c.y);
    if (!cell || cell.kind !== "EMPTY") {
      res.status(409).json({ error: `Collision en ${c.x},${c.y}` });
      return;
    }
  }
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || user.crd < def.cost) {
    res.status(402).json({ error: "CRD insuffisants" });
    return;
  }

  const building = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: def.cost } } });
    const b = await tx.building.create({
      data: {
        parcelId: parcel.id,
        type: body.data.type as BuildingType,
        originX: body.data.x,
        originY: body.data.y,
      },
    });
    for (const c of cells) {
      await tx.parcelCell.update({
        where: { parcelId_x_y: { parcelId: parcel.id, x: c.x, y: c.y } },
        data: { kind: "BUILDING", buildingId: b.id },
      });
    }
    return b;
  });

  const bonuses = await getFarmBonuses(parcel.farmId!);
  res.status(201).json({ building, bonuses, def });
});

/** Passage d'un bâtiment au palier suivant (5 niveaux au total). */
app.post("/buildings/:id/upgrade", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true } } },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  if (building.level >= MAX_BUILDING_LEVEL) {
    res.status(409).json({ error: "Niveau maximum atteint" });
    return;
  }
  const cost = buildingUpgradeCost(building.type as SharedBuildingType, building.level);
  if (cost === null) {
    res.status(409).json({ error: "Niveau maximum atteint" });
    return;
  }
  const nextDef = buildingLevelDef(building.level + 1);
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  if (user.level < nextDef.requiredLevel) {
    res.status(403).json({ error: `Niveau joueur ${nextDef.requiredLevel} requis` });
    return;
  }
  if (user.crd < cost) {
    res.status(402).json({ error: `CRD insuffisants — ${cost} requis` });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    return tx.building.update({
      where: { id: building.id },
      data: { level: building.level + 1 },
    });
  });
  const bonuses = await getFarmBonuses(building.parcel.farm.id);
  res.json({
    building: updated,
    cost,
    levelName: nextDef.name,
    stats: buildingStatsAtLevel(building.type as SharedBuildingType, updated.level),
    bonuses,
  });
});

app.post("/machines/buy", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      type: z.enum(["TRACTOR", "HARVESTER", "SPREADER"]),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const def = MACHINE_DEFS[body.data.type];
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { machines: true, parcels: { include: { buildings: true } } } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  if (user.crd < def.cost) {
    res.status(402).json({ error: "CRD insuffisants" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  const owned = user.farm.machines.length;
  if (owned >= bonuses.machineSlots) {
    res.status(409).json({
      error: `Slots machines pleins (${bonuses.machineSlots}). Construisez un hangar matériel.`,
    });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: def.cost } } });
    const machine = await tx.machine.create({
      data: {
        farmId: user.farm!.id,
        type: def.type,
        tier: def.tier,
        condition: 100,
      },
    });
    const firstParcel = user.farm!.parcels[0];
    if (firstParcel) {
      const free = await tx.parcelCell.findFirst({
        where: { parcelId: firstParcel.id, kind: "EMPTY" },
        orderBy: [{ y: "desc" }, { x: "asc" }],
      });
      if (free) {
        await tx.machine.update({
          where: { id: machine.id },
          data: { parkedParcelId: firstParcel.id },
        });
        await tx.parcelCell.update({
          where: { id: free.id },
          data: { kind: "VEHICLE", machineId: machine.id },
        });
      }
    }
    return machine;
  });
  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    include: { farm: { include: farmInclude() } },
  });
  res.status(201).json({ machine: result, player: refreshed });
});

app.post("/machines/:id/repair", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { user: true } } },
  });
  if (!machine || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const def = MACHINE_DEFS[machine.type as MachineType];
  if (!def) {
    res.status(400).json({ error: "Type machine inconnu" });
    return;
  }
  if (machine.condition >= 99.5) {
    res.status(409).json({ error: "Déjà en parfait état" });
    return;
  }
  const bonuses = await getFarmBonuses(machine.farmId);
  const quote = repairMachineCost({
    condition: machine.condition,
    repairCostPerPoint: def.repairCostPerPoint,
    workshopDiscount: bonuses.repairDiscount,
  });
  if (machine.farm.user.crd < quote.cost) {
    res.status(402).json({ error: `Réparation ${quote.cost} CRD — fonds insuffisants` });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: body.data.userId },
      data: { crd: { decrement: quote.cost } },
    });
    await tx.machine.update({
      where: { id: machine.id },
      data: { condition: quote.nextCondition },
    });
  });
  res.json({
    machineId: machine.id,
    condition: quote.nextCondition,
    cost: quote.cost,
    discount: bonuses.repairDiscount,
  });
});

app.post("/machines/:id/park", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      parcelId: z.string(),
      x: z.number().int(),
      y: z.number().int(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: true, cell: true },
  });
  if (!machine || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: body.data.parcelId },
    include: { farm: true, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  const cell = parcel.cells.find((c) => c.x === body.data.x && c.y === body.data.y);
  if (!cell || cell.kind !== "EMPTY") {
    res.status(409).json({ error: "Case non libre" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    // clear old cell
    if (machine.cell) {
      await tx.parcelCell.updateMany({
        where: { machineId: machine.id },
        data: { kind: "EMPTY", machineId: null },
      });
    }
    await tx.machine.update({
      where: { id: machine.id },
      data: {
        parkedParcelId: parcel.id,
        storedInBuildingId: null,
      },
    });
    await tx.parcelCell.update({
      where: { id: cell.id },
      data: { kind: "VEHICLE", machineId: machine.id },
    });
  });

  res.json({ ok: true });
});

app.post("/machines/:id/store", async (req, res) => {
  const body = z
    .object({ userId: z.string(), buildingId: z.string() })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!machine || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: body.data.buildingId },
    include: { parcel: true, storedMachines: true },
  });
  if (!building || building.parcel.farmId !== machine.farmId) {
    res.status(403).json({ error: "Hangar invalide" });
    return;
  }
  if (building.type !== "MACHINE_SHED") {
    res.status(400).json({ error: "Ce bâtiment ne range pas le matériel" });
    return;
  }
  const slots = BUILDING_DEFS.MACHINE_SHED.machineSlots ?? 0;
  if (building.storedMachines.length >= slots) {
    res.status(409).json({ error: "Hangar plein" });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.parcelCell.updateMany({
      where: { machineId: machine.id },
      data: { kind: "EMPTY", machineId: null },
    });
    await tx.machine.update({
      where: { id: machine.id },
      data: {
        parkedParcelId: null,
        storedInBuildingId: building.id,
      },
    });
  });
  res.json({ ok: true });
});

app.post("/market/sell", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: z.enum(["WHEAT", "MAIZE"]),
      tons: z.number().positive(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { inventory: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const inv = user.farm.inventory.find((i) => i.itemCode === body.data.commodity);
  if (!inv || inv.qty < body.data.tons) {
    res.status(409).json({ error: "Stock insuffisant" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  if (inv.qty > bonuses.storageGrain && body.data.tons > 0) {
    // soft warning only — allow sell
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  const moisturePenalty = moistureSellPenalty(inv.moisture);
  const sale = sellToMarket({
    tons: body.data.tons,
    price: market.price,
    moisturePenalty,
  });
  const tick = tickMarket({
    commodity: body.data.commodity,
    price: market.price,
    supplyTons: body.data.tons,
    demandTons: body.data.tons * 0.9,
    stockTons: market.stockTons,
  });
  const xpGain = Math.round(10 * (1 + bonuses.xpBonus));
  const updated = await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id: inv.id },
      data: { qty: { decrement: body.data.tons } },
    });
    const u = await tx.user.update({
      where: { id: user.id },
      data: { crd: { increment: sale.revenue }, xp: { increment: xpGain } },
    });
    await tx.marketPrice.update({
      where: { commodity: body.data.commodity },
      data: { price: tick.price, stockTons: tick.stockTons },
    });
    return u;
  });
  res.json({
    revenue: sale.revenue,
    effectivePrice: sale.effectivePrice,
    moisturePenalty,
    moisture: inv.moisture,
    crd: updated.crd,
    market: tick,
    bonuses,
  });
});

app.post("/inventory/dry", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      itemId: z.string(),
      tons: z.number().positive().optional(),
      passes: z.number().int().min(1).max(5).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { inventory: true } } },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const inv = user.farm.inventory.find((i) => i.id === body.data.itemId);
  if (!inv) {
    res.status(404).json({ error: "Stock introuvable" });
    return;
  }
  if (inv.qty <= 0) {
    res.status(409).json({ error: "Stock vide" });
    return;
  }
  const tons = Math.min(inv.qty, body.data.tons ?? inv.qty);
  if (tons <= 0) {
    res.status(409).json({ error: "Quantité invalide" });
    return;
  }
  if (inv.moisture <= DRYING.moistureFloor + 0.0005) {
    res.status(409).json({ error: "Déjà sec" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  const passes = body.data.passes ?? 1;
  const dried = dryInventory({
    moisture: inv.moisture,
    tons,
    passes,
    barnBonus: bonuses.softDryer,
  });
  if (dried.cost > user.crd) {
    res.status(409).json({ error: "CRD insuffisants pour sécher" });
    return;
  }
  if (dried.reduction <= 0) {
    res.status(409).json({ error: "Aucune réduction possible" });
    return;
  }

  // Partial dry: blend dried tons back into remaining stock moisture
  const remaining = inv.qty - tons;
  const nextMoisture =
    remaining > 0
      ? mergeMoisture(remaining, inv.moisture, tons, dried.moisture)
      : dried.moisture;

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.update({
      where: { id: inv.id },
      data: {
        moisture: nextMoisture,
        quality: nextMoisture <= DRYING.sellThreshold ? Math.max(inv.quality, 3) : inv.quality,
      },
    });
    const u = await tx.user.update({
      where: { id: user.id },
      data: { crd: { decrement: dried.cost } },
    });
    return { item, crd: u.crd };
  });

  res.json({
    cost: dried.cost,
    reduction: dried.reduction,
    moisture: updated.item.moisture,
    driedTons: tons,
    passes,
    barnBonus: bonuses.softDryer,
    crd: updated.crd,
    item: updated.item,
  });
});

app.post("/contracts/:id/accept", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: { include: { machines: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  if (!user.farm) {
    res.status(409).json({ error: "Ferme requise (machines) pour les contrats" });
    return;
  }
  const contract = await prisma.npcContract.findUnique({ where: { id: req.params.id } });
  if (!contract || contract.status !== "OPEN") {
    res.status(409).json({ error: "Contrat indisponible" });
    return;
  }
  const work = CONTRACT_WORK[contract.jobType as ContractJobType];
  const picked = pickMachineForWork(user.farm.machines, work);
  if (!picked) {
    res.status(409).json({
      error: `Machine requise pour ${contract.jobType} (condition OK) — achetez / réparez au garage.`,
    });
    return;
  }
  const etaBonus = user.specialization === "ETA" ? 1.05 : 1;
  const reward = Math.round(contract.rewardCrd * etaBonus * 100) / 100;
  const result = await prisma.$transaction(async (tx) => {
    const wear = await applyWearToMachine(tx, {
      machine: picked.machine,
      def: picked.def,
      cells: CONTRACT_WEAR_CELLS,
      specialization: user.specialization,
    });
    await tx.npcContract.update({
      where: { id: contract.id },
      data: { status: "COMPLETED", providerId: user.id, completedAt: new Date() },
    });
    const u = await tx.user.update({
      where: { id: user.id },
      data: {
        crd: { increment: reward },
        xp: { increment: user.specialization === "ETA" ? 25 : 15 },
      },
    });
    await tx.npcContract.create({
      data: {
        jobType: contract.jobType,
        title: contract.title,
        rewardCrd: contract.rewardCrd,
        regionNote: contract.regionNote,
      },
    });
    return { user: u, reward, machine: { id: picked.machine.id, type: picked.machine.type, ...wear } };
  });
  res.json(result);
});

// Sert le front construit (apps/web/dist, recopié à côté de ce fichier compilé
// — voir le Dockerfile) et retombe sur son index.html pour toute route qui
// n'est ni un fichier statique existant ni une des routes API ci-dessus.
// L'appli n'a pas de routeur côté client aujourd'hui, mais ça garde un lien
// direct utilisable pour n'importe quelle URL du jeu.
const webDist = process.env.WEB_DIST_DIR ?? path.join(__dirname, "web");
app.use(express.static(webDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

async function main() {
  await ensureSeed();
  await runWorldTick();
  setInterval(() => {
    runWorldTick().catch((e) => console.error("sim tick failed", e));
  }, SIM_TICK_MS);
  app.listen(PORT, () => {
    console.log(`API Farming Navigateur sur http://localhost:${PORT}`);
    console.log(`Sim tick toutes les ${SIM_TICK_MS / 1000}s`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
