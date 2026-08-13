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
  contractorQuote,
  CONTRACTOR_YIELD_MALUS,
  type FarmWork,
  ripenessAt,
  LOST_CROP_FERTILITY_MALUS,
  plowRequired,
  canStubble,
  applyStubble,
  residueBonus,
  PLOW_COST_PER_CELL_SOIL,
  PLOW_FERTILITY_GAIN,
  STUBBLE_COST_PER_CELL,
  SOIL_WORK_REFUSAL_LABELS,
  MAX_HARVESTS_BEFORE_PLOW,
  canDirectSeed,
  applyDirectSeed,
  DIRECT_SEED_COST_PER_CELL,
  DIRECT_SEED_FERTILITY_GAIN,
  nextRotation,
  type RotationState,
  quoteAllChannels,
  dealerPricePerTon,
  marketPricePerTon,
  listingFee,
  npcWouldBuy,
  listingProceeds,
  canList,
  LISTING_REFUSAL_LABELS,
  LISTING_TTL_MS,
  DEALER_MIN_TONS,
  volumeSlippage,
  machineResaleValue,
  buildingResaleValue,
  isPaddockAdjacent,
  paddockCapacity,
  tickHappiness,
  canGraze,
  planGrazing,
  milkYield,
  meatYield,
  happinessLabel,
  hungerPenalty,
  canBreed,
  gestationProgress,
  litterFor,
  BREEDING_REFUSAL_LABELS,
  HUNGER,
  feedBurn,
  feedUnits,
  rationQuality,
  dealerAskPrice,
  GOOD_DEFS,
  isPerishable,
  afterSpoilage,
  SPOILAGE_PER_CYCLE,
  SELLABLE_GOODS,
  settleSaleTons,
  GRAZING_REFUSAL_LABELS,
  LIVESTOCK_CYCLE_MS,
  MEAT_MATURITY_MS,
  type AnimalKind,
  type TradeGood,
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
  work: FarmWork,
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

/**
 * Retire les zones héritées d'une version antérieure du monde (Beauce, Iowa…).
 * Sans ça, une base déjà amorçée garde éternellement l'ancien monde : le test
 * `zone.count() === 0` n'est jamais vrai et le nouveau monde n'arrive jamais.
 * Les zones où un joueur possède déjà une terre sont conservées.
 */
async function retireLegacyZones() {
  const zones = await prisma.zone.findMany({
    include: { parcels: { select: { farmId: true } } },
  });
  for (const zone of zones) {
    if (REGION_BY_CODE[zone.code]) continue;
    if (zone.parcels.some((p) => p.farmId)) {
      console.warn(`Zone héritée ${zone.code} conservée : des joueurs y sont installés`);
      continue;
    }
    await prisma.parcel.deleteMany({ where: { zoneId: zone.id } });
    await prisma.weatherSnapshot.deleteMany({ where: { zoneCode: zone.code } });
    await prisma.zone.delete({ where: { id: zone.id } });
    console.log(`Zone héritée ${zone.code} retirée`);
  }
}

async function ensureSeed() {
  await retireLegacyZones();

  // Amorçage par région, et non « tout ou rien » : une région ajoutée dans une
  // version ultérieure apparaît sans avoir à réinitialiser la base.
  for (const continent of WORLD) {
    for (const region of continent.regions) {
      if (await prisma.zone.findUnique({ where: { code: region.code } })) continue;
      {
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

  for (const code of Object.keys(MARKET_BOUNDS) as TradeGood[]) {
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

/**
 * Cours passés d'une marchandise, du plus ancien au plus récent. Le joueur y
 * lit la tendance : vendre maintenant, ou laisser courir.
 */
app.get("/market/history", async (req, res) => {
  const parsed = z
    .object({
      commodity: z.enum(SELLABLE_GOODS as unknown as [TradeGood, ...TradeGood[]]).optional(),
      hours: z.coerce.number().min(0.25).max(12).optional(),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const since = new Date(Date.now() - (parsed.data.hours ?? 3) * 60 * 60 * 1000);
  const rows = await prisma.marketTick.findMany({
    where: {
      at: { gte: since },
      ...(parsed.data.commodity ? { commodity: parsed.data.commodity } : {}),
    },
    orderBy: { at: "asc" },
    select: { commodity: true, price: true, at: true },
  });
  const series: Record<string, { at: string; price: number }[]> = {};
  for (const r of rows) {
    (series[r.commodity] ??= []).push({ at: r.at.toISOString(), price: r.price });
  }
  res.json({ since: since.toISOString(), series });
});
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

/**
 * Dégradation des denrées périssables en silo.
 *
 * Le lait perd plus de dix pour cent par cycle : c'est ce qui donne enfin une
 * raison d'accepter le prix bas du négociant plutôt que d'attendre la criée.
 * La décroissance est exponentielle, donc indépendante du découpage des ticks.
 */
async function spoilPerishables() {
  const perishables = (Object.keys(GOOD_DEFS) as TradeGood[]).filter(isPerishable);
  if (!perishables.length) return;
  const items = await prisma.inventoryItem.findMany({
    where: { itemCode: { in: perishables } },
  });
  const now = Date.now();
  for (const item of items) {
    const elapsedMs = now - item.lastDecayAt.getTime();
    if (elapsedMs < 5000) continue;
    const left = afterSpoilage({
      good: item.itemCode as TradeGood,
      qty: item.qty,
      elapsedMs,
      cycleMs: LIVESTOCK_CYCLE_MS,
    });
    if (left <= 0) await prisma.inventoryItem.delete({ where: { id: item.id } });
    else {
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { qty: left, lastDecayAt: new Date(now) },
      });
    }
  }
}

async function runWorldTick() {
  await expireListings();
  await runNpcBuyers();
  await spoilPerishables();
  await settleAllHerds();
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
      commodity: row.commodity as TradeGood,
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

  await recordMarketHistory(marketOut);

  lastSimTick = {
    at: new Date().toISOString(),
    weather: weatherOut,
    market: marketOut,
  };
  return lastSimTick;
}

/**
 * Archive les cours du tick et élague les plus vieux.
 *
 * Sans mémoire des prix, le joueur ne peut ni juger si l'offre du jour est
 * bonne, ni décider d'attendre : il vend au hasard. Une fenêtre glissante
 * suffit — personne ne spécule sur le cours d'avant-hier — et elle borne la
 * table, qui grossirait sinon de cinq lignes toutes les vingt secondes.
 */
const MARKET_HISTORY_MS = 12 * 60 * 60 * 1000;

async function recordMarketHistory(rows: { commodity: string; price: number }[]) {
  if (!rows.length) return;
  const at = new Date();
  await prisma.marketTick.createMany({
    data: rows.map((r) => ({ commodity: r.commodity, price: r.price, at })),
  });
  await prisma.marketTick.deleteMany({
    where: { at: { lt: new Date(at.getTime() - MARKET_HISTORY_MS) } },
  });
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
  let cropsLost = 0;
  let cropsDeclining = 0;
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
        residuePasses: cell.residuePasses,
        directSeeded: cell.directSeeded,
        rotation: rotationOf(cell),
        specialization: user.specialization,
      });
      if (sim.lost) cropsLost += 1;
      else if (sim.ripeness && sim.ripeness.stage !== "PEAK") cropsDeclining += 1;
      else if (sim.ready) cropsReady += 1;
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
  const herdsHungry = (
    await prisma.herd.findMany({
      where: { farm: { userId } },
      select: { size: true, feedStock: true },
    })
  ).filter((h) => hungerPenalty({ feedStock: h.feedStock, herdSize: h.size }) > 0.3).length;

  return buildSessionResume({
    awayMs,
    cropsReady,
    cropsGrowing,
    cropsLost,
    cropsDeclining,
    herdsHungry,
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
        residuePasses: c.residuePasses,
        directSeeded: c.directSeeded,
        rotation: rotationOf(c),
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

/**
 * Prestation ETA : une entreprise extérieure vient travailler la parcelle
 * avec ses propres machines. Aucun matériel requis côté joueur — c'est
 * précisément l'intérêt — mais le service se paie à la case.
 */
app.post("/parcels/:id/contractor", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      work: z.enum(["PLANT", "FERTILIZE", "HARVEST", "PLOW"]),
      crop: z.enum(["WHEAT", "MAIZE"]).optional(),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const { work, cells, crop } = body.data;

  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: true, cells: true, zone: true },
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

  const service = contractorQuote(work, cells.length);
  const seeds = work === "PLANT" && crop ? CROP_DEFS[crop].seedCostPerCell * cells.length : 0;
  const total = service + seeds;
  if (user.crd < total) {
    res.status(402).json({ error: `CRD insuffisants — ${total} requis` });
    return;
  }

  const bonuses = await getFarmBonuses(parcel.farm.id);
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: parcel.zone.code },
  });
  const now = Date.now();

  if (work === "PLANT") {
    if (!crop) {
      res.status(400).json({ error: "Culture requise pour un semis" });
      return;
    }
    for (const { x, y } of cells) {
      const cell = parcel.cells.find((c) => c.x === x && c.y === y);
      if (!cell || cell.kind !== "EMPTY") {
        res.status(409).json({ error: `Case ${x},${y} non libre` });
        return;
      }
    }
    const growMs = CROP_DEFS[crop].growMs;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: total } } });
      for (const { x, y } of cells) {
        await tx.parcelCell.update({
          where: { parcelId_x_y: { parcelId: parcel.id, x, y } },
          data: {
            kind: "CROP",
            crop,
            fieldStage: "PLANTED",
            plantedAt: new Date(now),
            readyAt: new Date(now + growMs),
            fertilizedPasses: 0,
            weedsControlled: false,
          },
        });
      }
    });
    res.json({ work, cells: cells.length, cost: total, service, seeds });
    return;
  }

  if (work === "PLOW") {
    const lost = cells
      .map(({ x, y }) => parcel.cells.find((c) => c.x === x && c.y === y))
      .filter((c): c is NonNullable<typeof c> => {
        if (!c || c.kind !== "CROP" || !c.crop || !c.plantedAt) return false;
        const grow = CROP_DEFS[c.crop].growMs;
        return ripenessAt(c.plantedAt.getTime() + grow, grow, now).needsPlowing;
      });
    if (!lost.length) {
      res.status(409).json({ error: "Aucune culture perdue à labourer ici" });
      return;
    }
    const malus = LOST_CROP_FERTILITY_MALUS * lost.length;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: total } } });
      for (const cell of lost) {
        await tx.parcelCell.update({
          where: { id: cell.id },
          data: {
            kind: "EMPTY",
            crop: null,
            fieldStage: "PREPARED",
            plantedAt: null,
            readyAt: null,
            fertilizedPasses: 0,
            weedsControlled: false,
          },
        });
      }
      await tx.parcel.update({
        where: { id: parcel.id },
        data: { fertility: Math.max(0.2, parcel.fertility - malus) },
      });
    });
    res.json({ work, cells: lost.length, cost: total, service, seeds: 0 });
    return;
  }

  if (work === "FERTILIZE") {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: total } } });
      for (const { x, y } of cells) {
        const cell = parcel.cells.find((c) => c.x === x && c.y === y);
        if (!cell || cell.kind !== "CROP") continue;
        await tx.parcelCell.update({
          where: { parcelId_x_y: { parcelId: parcel.id, x, y } },
          data: {
            fertilizedPasses: Math.min(2, cell.fertilizedPasses + 1),
            weedsControlled: true,
          },
        });
      }
    });
    res.json({ work, cells: cells.length, cost: total, service, seeds: 0 });
    return;
  }

  // HARVEST — le cas qui débloque un joueur sans moissonneuse.
  const ready = cells
    .map(({ x, y }) => parcel.cells.find((c) => c.x === x && c.y === y))
    .filter((c): c is NonNullable<typeof c> => Boolean(c && c.kind === "CROP" && c.plantedAt));
  if (!ready.length) {
    res.status(409).json({ error: "Aucune culture à récolter sur la sélection" });
    return;
  }

  let totalTons = 0;
  const perCrop = new Map<CropCode, number>();
  for (const cell of ready) {
    const sim = simulateCell({
      crop: cell.crop!,
      plantedAt: cell.plantedAt!.getTime(),
      now,
      fertility: parcel.fertility,
      weedsControlled: cell.weedsControlled,
      fertilizedPasses: Math.min(2, cell.fertilizedPasses) as 0 | 1 | 2,
      buildingYieldBonus: bonuses.yieldBonus,
      weatherAtHarvest: weather?.state as WeatherState | undefined,
      specialization: user.specialization,
    });
    if (!sim.ready) continue;
    // Un prestataire connaît moins bien la parcelle que celui qui la cultive.
    const tons = sim.estimatedYieldTons * (1 - CONTRACTOR_YIELD_MALUS);
    totalTons += tons;
    perCrop.set(cell.crop!, (perCrop.get(cell.crop!) ?? 0) + tons);
  }

  if (totalTons <= 0) {
    res.status(409).json({ error: "Rien n'est mûr sur la sélection" });
    return;
  }

  const moisture = harvestMoisture(weather?.state as WeatherState | undefined);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: total } } });
    for (const cell of ready) {
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          kind: "EMPTY",
          crop: null,
          fieldStage: "EMPTY",
          plantedAt: null,
          readyAt: null,
          fertilizedPasses: 0,
        },
      });
    }
    for (const [code, tons] of perCrop) {
      const existing = await tx.inventoryItem.findFirst({
        where: { farmId: parcel.farm!.id, itemCode: code },
      });
      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: {
            qty: existing.qty + tons,
            moisture: mergeMoisture(existing.qty, existing.moisture, tons, moisture),
          },
        });
      } else {
        await tx.inventoryItem.create({
          data: { farmId: parcel.farm!.id, itemCode: code, qty: tons, quality: 1, moisture },
        });
      }
    }
  });

  res.json({
    work,
    cells: ready.length,
    cost: total,
    service,
    seeds: 0,
    totalTons,
    moisture,
  });
});

/**
 * Mémoire de rotation d'une case, telle que la simulation doit la lire.
 *
 * Les colonnes retiennent ce que la case a **déjà produit**, pas ce qu'elle
 * porte : elles ne sont écrites qu'à la libération de la case, moisson ou
 * culture perdue. Une culture en terre voit donc le précédent qui la concerne,
 * sans avoir à défalquer son propre cycle.
 */
function rotationOf(cell: { lastCrop: CropCode | null; cropStreak: number }): RotationState {
  return { lastCrop: cell.lastCrop, cropStreak: cell.cropStreak };
}

/** Le cycle qui s'achève entre dans la mémoire de la case. */
function rotationUpdate(cell: { lastCrop: CropCode | null; cropStreak: number }, crop: CropCode) {
  const next = nextRotation(rotationOf(cell), crop);
  return { lastCrop: next.lastCrop, cropStreak: next.cropStreak };
}

app.post("/parcels/:id/plant", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      crop: z.enum(["WHEAT", "MAIZE"]),
      cells: z.array(z.object({ x: z.number().int(), y: z.number().int() })).min(1),
      /** Semer dans les chaumes, sans travail du sol préalable */
      directSeed: z.boolean().optional(),
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
  const directSeed = body.data.directSeed ?? false;
  const seedCost = CROP_DEFS[body.data.crop].seedCostPerCell * body.data.cells.length;
  const cost = seedCost + (directSeed ? DIRECT_SEED_COST_PER_CELL * body.data.cells.length : 0);
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
    if (directSeed) {
      // Le semis direct exige des chaumes : sans eux, c'est un semis ordinaire
      // et le joueur paierait le surcoût du semoir lourd pour rien.
      const verdict = canDirectSeed(cell);
      if (!verdict.ok) {
        res.status(409).json({
          error:
            verdict.reason === "PLOW_REQUIRED"
              ? `Case ${x},${y} : sol trop tassé — le semis direct ne décompacte pas, il faut labourer`
              : `Case ${x},${y} : pas de chaumes — semez normalement`,
        });
        return;
      }
    } else if (cell.hasStubble) {
      res.status(409).json({
        error: plowRequired(cell)
          ? `Case ${x},${y} : sol épuisé, il faut labourer`
          : `Case ${x},${y} : chaumes en place — déchaumez, labourez ou semez direct`,
      });
      return;
    }
  }

  const now = Date.now();
  const growMs = CROP_DEFS[body.data.crop].growMs;
  const wear = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    for (const { x, y } of body.data.cells) {
      const cell = parcel.cells.find((c) => c.x === x && c.y === y);
      // Le semis direct perce les chaumes : la case est semée sans qu'aucun
      // outil ne soit passé, et le sol garde son tassement.
      const soil = directSeed && cell ? applyDirectSeed(cell) : null;
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
          directSeeded: directSeed,
          ...(soil
            ? {
                harvestsSincePlow: soil.harvestsSincePlow,
                residuePasses: soil.residuePasses,
                hasStubble: soil.hasStubble,
              }
            : {}),
        },
      });
    }
    if (directSeed) {
      // La couverture permanente protège de l'érosion : le sol s'en trouve un
      // peu mieux, ce qui compense en partie la perte de rendement.
      await tx.parcel.update({
        where: { id: parcel.id },
        data: { fertility: Math.min(1, parcel.fertility + DIRECT_SEED_FERTILITY_GAIN) },
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

/**
 * Labour : la seule façon de libérer une case dont la culture est perdue.
 * Le sol s'appauvrit un peu au passage — laisser pourrir une récolte se paie
 * au-delà de la récolte elle-même.
 */
app.post("/parcels/:id/plow", async (req, res) => {
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
    include: { farm: { include: { machines: true } }, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  const picked = pickMachineForWork(parcel.farm.machines, "PLOW");
  if (!picked) {
    res.status(409).json({
      error: "Tracteur requis pour labourer — ou faites venir une ETA.",
    });
    return;
  }

  const now = Date.now();
  // La charrue traite deux situations : les chaumes après moisson, et les
  // cultures perdues qu'on ne peut plus récolter.
  const candidates = (
    body.data.cells
      ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
      : parcel.cells
  ).filter((cell) => {
    if (cell.hasStubble) return true;
    if (cell.kind !== "CROP" || !cell.crop || !cell.plantedAt) return false;
    const readyAt = cell.plantedAt.getTime() + CROP_DEFS[cell.crop].growMs;
    return ripenessAt(readyAt, CROP_DEFS[cell.crop].growMs, now).needsPlowing;
  });

  if (!candidates.length) {
    res.status(409).json({ error: "Rien à labourer ici : ni chaumes, ni culture perdue" });
    return;
  }

  const lostCount = candidates.filter((c) => c.kind === "CROP").length;
  const cost = PLOW_COST_PER_CELL_SOIL * candidates.length;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || user.crd < cost) {
    res.status(402).json({ error: `CRD insuffisants — ${cost} requis` });
    return;
  }

  // Un labour d'entretien décompacte et enfouit les adventices ; seules les
  // cultures perdues coûtent de la fertilité.
  const malus =
    LOST_CROP_FERTILITY_MALUS * lostCount -
    PLOW_FERTILITY_GAIN * (candidates.length - lostCount);
  const wear = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    for (const cell of candidates) {
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          kind: "EMPTY",
          crop: null,
          fieldStage: "PREPARED",
          plantedAt: null,
          readyAt: null,
          fertilizedPasses: 0,
          weedsControlled: false,
          hasStubble: false,
          harvestsSincePlow: 0,
          residuePasses: 0,
        },
      });
    }
    await tx.parcel.update({
      where: { id: parcel.id },
      data: { fertility: Math.max(0.2, Math.min(0.99, parcel.fertility - malus)) },
    });
    return applyWearToMachine(tx, {
      machine: picked.machine,
      def: picked.def,
      cells: candidates.length,
      specialization: user.specialization,
    });
  });

  res.json({
    plowed: candidates.length,
    lostCleared: lostCount,
    cost,
    fertilityDelta: Math.round(-malus * 1000) / 1000,
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
  });
});

/**
 * Déchaumage : travail superficiel qui incorpore les résidus de la récolte
 * précédente. Moins cher que le labour, il bonifie la culture suivante, mais
 * il ne remet pas le compteur à zéro — au bout de trois récoltes, il refuse.
 */
app.post("/parcels/:id/stubble", async (req, res) => {
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
    include: { farm: { include: { machines: true } }, cells: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  const picked = pickMachineForWork(parcel.farm.machines, "STUBBLE");
  if (!picked) {
    res.status(409).json({
      error: "Déchaumeur à disques requis — achetez-en un au garage, ou labourez.",
    });
    return;
  }

  const selection = body.data.cells
    ? parcel.cells.filter((c) => body.data.cells!.some((t) => t.x === c.x && t.y === c.y))
    : parcel.cells;

  const targets: (typeof selection)[number][] = [];
  let blockedByPlow = 0;
  for (const cell of selection) {
    const verdict = canStubble({
      harvestsSincePlow: cell.harvestsSincePlow,
      residuePasses: cell.residuePasses,
      hasStubble: cell.hasStubble,
    });
    if (verdict.ok) targets.push(cell);
    else if (verdict.reason === "PLOW_REQUIRED") blockedByPlow += 1;
  }

  if (!targets.length) {
    res.status(409).json({
      error: blockedByPlow
        ? SOIL_WORK_REFUSAL_LABELS.PLOW_REQUIRED
        : SOIL_WORK_REFUSAL_LABELS.NO_STUBBLE,
      blockedByPlow,
    });
    return;
  }

  const cost = STUBBLE_COST_PER_CELL * targets.length;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || user.crd < cost) {
    res.status(402).json({ error: `CRD insuffisants — ${cost} requis` });
    return;
  }

  const wear = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    for (const cell of targets) {
      const next = applyStubble({
        harvestsSincePlow: cell.harvestsSincePlow,
        residuePasses: cell.residuePasses,
        hasStubble: cell.hasStubble,
      });
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          fieldStage: "PREPARED",
          hasStubble: false,
          residuePasses: next.residuePasses,
          // Faux-semis : le déchaumage fait lever puis détruit les adventices.
          weedsControlled: true,
        },
      });
    }
    return applyWearToMachine(tx, {
      machine: picked.machine,
      def: picked.def,
      cells: targets.length,
      specialization: user.specialization,
    });
  });

  res.json({
    stubbled: targets.length,
    blockedByPlow,
    cost,
    nextBonus: residueBonus(targets[0].residuePasses + 1),
    machine: { id: picked.machine.id, type: picked.machine.type, ...wear },
  });
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
  let lostCells = 0;
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
        residuePasses: cell.residuePasses,
        directSeeded: cell.directSeeded,
        rotation: rotationOf(cell),
        specialization: user?.specialization,
        buildingYieldBonus: bonuses.yieldBonus,
        weatherAtHarvest: weather?.state as WeatherState | undefined,
      });
      if (!sim.ready) continue;
      // Culture perdue : la moissonneuse n'a plus rien à ramasser, la case
      // reste occupée par des tiges mortes jusqu'au labour.
      if (sim.lost) {
        lostCells += 1;
        await tx.parcelCell.update({
          where: { id: cell.id },
          // Une culture perdue a tout de même occupé la terre une saison :
          // les champignons du sol s'y sont installés comme pour une réussie.
          data: { fieldStage: "SPOILED", ...rotationUpdate(cell, cell.crop) },
        });
        continue;
      }
      const moisture = harvestMoisture(weather?.state as WeatherState | undefined);
      harvested.push({
        crop: cell.crop,
        tons: sim.estimatedYieldTons,
        moisturePenalty: sim.moisturePenalty,
        moisture,
      });
      // La moisson ne rend pas une case nue : elle laisse des chaumes qu'il
      // faudra déchaumer ou labourer avant de resemer.
      await tx.parcelCell.update({
        where: { id: cell.id },
        data: {
          kind: "EMPTY",
          crop: null,
          fieldStage: "HARVESTED",
          plantedAt: null,
          readyAt: null,
          fertilizedPasses: 0,
          weedsControlled: false,
          hasStubble: true,
          harvestsSincePlow: Math.min(
            MAX_HARVESTS_BEFORE_PLOW,
            cell.harvestsSincePlow + 1,
          ),
          ...rotationUpdate(cell, cell.crop),
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
    res.status(409).json({
      error: lostCells
        ? `${lostCells} case(s) perdue(s) — trop tard pour récolter, il faut labourer`
        : "Rien à récolter (pas prêt)",
      lostCells,
    });
    return;
  }
  res.json({
    harvested,
    lostCells,
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
        "PADDOCK",
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

/* ------------------------------------------------------------------ */
/* Élevage                                                             */
/* ------------------------------------------------------------------ */

const COW_PRICE = 420;

/** Enclos collés à une étable, avec leur capacité de sortie cumulée. */
function paddocksFor(
  barn: { originX: number; originY: number; type: string },
  buildings: { type: string; originX: number; originY: number }[],
): { cells: number; capacity: number; yardType: SharedBuildingType } {
  const barnDef = BUILDING_DEFS[barn.type as SharedBuildingType];
  const footprint = {
    originX: barn.originX,
    originY: barn.originY,
    w: barnDef.w,
    h: barnDef.h,
  };
  // Une étable appelle un enclos de pâture, une porcherie une courette : on ne
  // met pas des porcs au pré ni des vaches dans une souille.
  const yardType: SharedBuildingType = barn.type === "PIGSTY" ? "PIG_YARD" : "PADDOCK";
  const def = BUILDING_DEFS[yardType];
  let cells = 0;
  for (const b of buildings) {
    if (b.type !== yardType) continue;
    const other = { originX: b.originX, originY: b.originY, w: def.w, h: def.h };
    if (isPaddockAdjacent(footprint, other)) cells += def.w * def.h;
  }
  return { cells, capacity: paddockCapacity(cells), yardType };
}

/**
 * Fait vivre tous les troupeaux, à chaque tick du monde.
 *
 * Cette avance ne tenait auparavant qu'au sondage de l'écran d'élevage : un
 * joueur qui ne l'ouvrait pas ne voyait jamais une gestation démarrer, et son
 * cheptel ne grandissait que par achat. Une bête vit qu'on la regarde ou non.
 */
async function settleAllHerds() {
  const herds = await prisma.herd.findMany({
    include: { building: { include: { parcel: { include: { buildings: true } } } } },
  });
  const now = Date.now();
  for (const herd of herds) {
    const barn = herd.building;
    const paddock = paddocksFor(barn, barn.parcel.buildings);
    const stats = buildingStatsAtLevel(barn.type as SharedBuildingType, barn.level);
    const capacity = (barn.type === "CATTLE_BARN" ? stats.cattleSlots : stats.pigSlots) ?? 0;
    await settleHerd(herd, paddock.capacity, now, barn.level, capacity);
  }
}

/** Fait vieillir le bonheur d'un troupeau jusqu'à maintenant. */
async function settleHerd(
  herd: {
    id: string;
    size: number;
    happiness: number;
    lastTickAt: Date;
    lastGrazedAt: Date | null;
    grazingUntil: Date | null;
    feedStock: number;
    kind: string;
    gestatingSince: Date | null;
    lastCalvedAt: Date | null;
  },
  paddockCapacityCells: number,
  now: number,
  barnLevel = 1,
  capacity = 0,
): Promise<{
  happiness: number;
  feedStock: number;
  size: number;
  gestatingSince: Date | null;
  born: number;
}> {
  const elapsedMs = Math.max(0, now - herd.lastTickAt.getTime());
  if (elapsedMs < 1000) {
    return {
      happiness: herd.happiness,
      feedStock: herd.feedStock,
      size: herd.size,
      gestatingSince: herd.gestatingSince,
      born: 0,
    };
  }

  // Le troupeau puise dans la ration distribuée ; au pré, il se sert seul.
  const grazing = Boolean(herd.grazingUntil && herd.grazingUntil.getTime() > now);
  const burnt = feedBurn({
    herdSize: herd.size,
    elapsedMs,
    cycleMs: LIVESTOCK_CYCLE_MS,
    grazing,
    barnLevel,
  });
  const feedStock = Math.max(0, herd.feedStock - burnt);
  const hunger = hungerPenalty({ feedStock, herdSize: herd.size });

  const happiness = tickHappiness({
    happiness: herd.happiness,
    hasPaddock: paddockCapacityCells > 0,
    grazedRecentlyMs: herd.lastGrazedAt ? now - herd.lastGrazedAt.getTime() : Number.MAX_SAFE_INTEGER,
    crowding: paddockCapacityCells > 0 ? herd.size / Math.max(1, paddockCapacityCells) : 1,
    elapsedMs,
    hunger,
  });

  // Reproduction : une gestation démarre quand tout est réuni, et aboutit
  // quand elle arrive à terme. Un troupeau bien mené grossit tout seul.
  const feedRatio = feedStock / Math.max(1, herd.size * HUNGER.unitsPerAnimalPerCycle);
  const freeSlots = capacity - herd.size;
  let size = herd.size;
  let gestatingSince: Date | null = herd.gestatingSince;
  let lastCalvedAt = herd.lastCalvedAt;
  let born = 0;

  if (gestatingSince) {
    const progress = gestationProgress({
      kind: herd.kind as AnimalKind,
      gestatingSince: gestatingSince.getTime(),
      now,
      cycleMs: LIVESTOCK_CYCLE_MS,
    });
    if (progress >= 1) {
      born = litterFor(herd.kind as AnimalKind, freeSlots);
      size += born;
      gestatingSince = null;
      lastCalvedAt = new Date(now);
    }
  } else {
    const verdict = canBreed({
      kind: herd.kind as AnimalKind,
      size: herd.size,
      happiness,
      feedRatio,
      freeSlots,
      gestatingSince: null,
    });
    if (verdict.ok) gestatingSince = new Date(now);
  }

  await prisma.herd.update({
    where: { id: herd.id },
    data: { happiness, feedStock, size, gestatingSince, lastCalvedAt, lastTickAt: new Date(now) },
  });
  return { happiness, feedStock, size, gestatingSince, born };
}

/** État complet de l'élevage d'une parcelle, prêt pour l'affichage. */
app.get("/parcels/:id/livestock", async (req, res) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { buildings: { include: { herd: true } }, zone: true, farm: true },
  });
  if (!parcel) {
    res.status(404).json({ error: "Parcelle introuvable" });
    return;
  }
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: parcel.zone.code },
  });
  const now = Date.now();

  const barns = [];
  for (const b of parcel.buildings) {
    if (b.type !== "CATTLE_BARN" && b.type !== "PIGSTY") continue;
    const paddock = paddocksFor(b, parcel.buildings);
    const stats = buildingStatsAtLevel(b.type as SharedBuildingType, b.level);
    const capacity = (b.type === "CATTLE_BARN" ? stats.cattleSlots : stats.pigSlots) ?? 0;
    let happiness = b.herd?.happiness ?? 0;
    let feedStock = b.herd?.feedStock ?? 0;
    let herdSize = b.herd?.size ?? 0;
    let gestatingSince: Date | null = b.herd?.gestatingSince ?? null;
    if (b.herd) {
      const settled = await settleHerd(b.herd, paddock.capacity, now, b.level, capacity);
      happiness = settled.happiness;
      feedStock = settled.feedStock;
      herdSize = settled.size;
      gestatingSince = settled.gestatingSince;
    }

    const graze = b.herd
      ? canGraze({
          paddock: {
            adjacent: paddock.capacity > 0,
            cells: paddock.cells,
            capacity: paddock.capacity,
          },
          animals: b.herd.size,
          weather: (weather?.state as WeatherState) ?? "CLEAR",
          kind: b.herd.kind as AnimalKind,
          paddockKind: paddock.yardType === "PIG_YARD" ? "PIG" : "COW",
        })
      : { ok: false as const, reason: "NO_PADDOCK" as const };

    barns.push({
      buildingId: b.id,
      type: b.type,
      level: b.level,
      capacity,
      paddockCells: paddock.cells,
      paddockCapacity: paddock.capacity,
      yardType: paddock.yardType,
      herd: b.herd
        ? {
            id: b.herd.id,
            kind: b.herd.kind,
            size: herdSize,
            happiness,
            label: happinessLabel(happiness),
            grazingUntil: b.herd.grazingUntil?.getTime() ?? null,
            feedStock: Math.round(feedStock * 10) / 10,
            gestation: gestationProgress({
              kind: b.herd.kind as AnimalKind,
              gestatingSince: gestatingSince?.getTime() ?? null,
              now,
              cycleMs: LIVESTOCK_CYCLE_MS,
            }),
            breedRefusal: (() => {
              if (gestatingSince) return null;
              const v = canBreed({
                kind: b.herd.kind as AnimalKind,
                size: herdSize,
                happiness,
                feedRatio: feedStock / Math.max(1, herdSize * HUNGER.unitsPerAnimalPerCycle),
                freeSlots: capacity - herdSize,
                gestatingSince: null,
              });
              return v.ok || !v.reason ? null : BREEDING_REFUSAL_LABELS[v.reason];
            })(),
            feedNeed: b.herd.size * HUNGER.unitsPerAnimalPerCycle,
            feedQuality: b.herd.feedQuality,
            hungry: hungerPenalty({ feedStock, herdSize: b.herd.size }) > 0.05,
            canMilk:
              b.herd.kind === "COW" &&
              now - (b.herd.lastMilkedAt?.getTime() ?? b.herd.bornAt.getTime()) >=
                LIVESTOCK_CYCLE_MS * 0.15,
            milkPerCycle: milkYield({
              herdSize: b.herd.size,
              happiness,
              barnLevel: b.level,
              feedQuality: b.herd.feedQuality,
            }),
            meatAtSlaughter: meatYield({
              herdSize: b.herd.size,
              happiness,
              averageAgeMs: now - b.herd.bornAt.getTime(),
              barnLevel: b.level,
            }),
          }
        : null,
      canGraze: graze.ok,
      grazeRefusal: graze.ok || !graze.reason ? null : GRAZING_REFUSAL_LABELS[graze.reason],
      cowPrice: COW_PRICE,
    });
  }
  res.json({ barns, weather: weather?.state ?? "CLEAR" });
});

/** Achat de bêtes pour une étable. */
app.post("/buildings/:id/animals", async (req, res) => {
  const body = z
    .object({ userId: z.string(), count: z.number().int().min(1).max(50) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true } }, herd: true },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  if (building.type !== "CATTLE_BARN" && building.type !== "PIGSTY") {
    res.status(409).json({ error: "Ce bâtiment n'héberge pas d'animaux" });
    return;
  }
  const stats = buildingStatsAtLevel(building.type as SharedBuildingType, building.level);
  const capacity =
    (building.type === "CATTLE_BARN" ? stats.cattleSlots : stats.pigSlots) ?? 0;
  const current = building.herd?.size ?? 0;
  if (current + body.data.count > capacity) {
    res.status(409).json({
      error: `Capacité dépassée — ${capacity} places, ${current} occupées`,
    });
    return;
  }
  const cost = COW_PRICE * body.data.count;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || user.crd < cost) {
    res.status(402).json({ error: `CRD insuffisants — ${cost} requis` });
    return;
  }

  const kind: AnimalKind = building.type === "CATTLE_BARN" ? "COW" : "PIG";
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    if (building.herd) {
      await tx.herd.update({
        where: { id: building.herd.id },
        data: { size: current + body.data.count },
      });
    } else {
      await tx.herd.create({
        data: {
          farmId: building.parcel.farm!.id,
          buildingId: building.id,
          kind,
          size: body.data.count,
        },
      });
    }
  });
  res.status(201).json({ added: body.data.count, cost });
});

/** Sortie au pâturage : c'est l'enclos adjacent qui la rend possible. */
app.post("/herds/:id/graze", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: {
      farm: true,
      building: { include: { parcel: { include: { buildings: true, zone: true } } } },
    },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  const paddock = paddocksFor(herd.building, herd.building.parcel.buildings);
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: herd.building.parcel.zone.code },
  });
  const verdict = canGraze({
    paddock: {
      adjacent: paddock.capacity > 0,
      cells: paddock.cells,
      capacity: paddock.capacity,
    },
    animals: herd.size,
    weather: (weather?.state as WeatherState) ?? "CLEAR",
    kind: herd.kind as AnimalKind,
  });
  if (!verdict.ok) {
    res.status(409).json({
      error: verdict.reason ? GRAZING_REFUSAL_LABELS[verdict.reason] : "Sortie impossible",
    });
    return;
  }

  const now = Date.now();
  const window = planGrazing(
    now,
    {
      id: herd.id,
      kind: herd.kind as AnimalKind,
      size: herd.size,
      happiness: herd.happiness,
      averageAgeMs: now - herd.bornAt.getTime(),
      lastGrazedAt: herd.lastGrazedAt?.getTime() ?? null,
      lastMilkedAt: herd.lastMilkedAt?.getTime() ?? null,
    },
    { adjacent: true, cells: paddock.cells, capacity: paddock.capacity },
  );
  if (!window) {
    res.status(409).json({ error: "Sortie impossible pour le moment" });
    return;
  }
  await prisma.herd.update({
    where: { id: herd.id },
    data: {
      lastGrazedAt: new Date(now),
      grazingUntil: new Date(window.endsAt),
      lastTickAt: new Date(now),
    },
  });
  res.json({ window, animals: window.animals });
});

/**
 * Marchandises que le joueur peut écouler. Restreindre les endpoints de vente
 * au blé et au maïs rendait le lait et la viande produisibles mais
 * invendables : ils s'accumulaient au silo sans débouché.
 */
const sellableGood = z.enum(
  SELLABLE_GOODS as [TradeGood, ...TradeGood[]],
);

/** Ajoute une marchandise au silo, en fusionnant l'humidité si besoin. */
async function addToStock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  farmId: string,
  itemCode: string,
  qty: number,
  moisture = 0,
  quality = 3,
) {
  const existing = await tx.inventoryItem.findFirst({ where: { farmId, itemCode } });
  if (existing) {
    await tx.inventoryItem.update({
      where: { id: existing.id },
      data: {
        qty: existing.qty + qty,
        moisture: mergeMoisture(existing.qty, existing.moisture, qty, moisture),
      },
    });
  } else {
    await tx.inventoryItem.create({ data: { farmId, itemCode, qty, quality, moisture } });
  }
}

/** Distribution de la ration : le fourrage et le maïs quittent le silo. */
app.post("/herds/:id/feed", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      hayTons: z.number().min(0).default(0),
      maizeTons: z.number().min(0).default(0),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const { hayTons, maizeTons } = body.data;
  if (hayTons + maizeTons <= 0) {
    res.status(400).json({ error: "Indiquez une quantité à distribuer" });
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { inventory: true } } },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  const hay = herd.farm.inventory.find((i) => i.itemCode === "HAY");
  const maize = herd.farm.inventory.find((i) => i.itemCode === "MAIZE");
  if (hayTons > (hay?.qty ?? 0)) {
    res.status(409).json({ error: "Fourrage insuffisant — achetez-en au négociant" });
    return;
  }
  if (maizeTons > (maize?.qty ?? 0)) {
    res.status(409).json({ error: "Maïs insuffisant" });
    return;
  }

  const units = feedUnits(hayTons, maizeTons);
  const quality = rationQuality(hayTons, maizeTons);
  await prisma.$transaction(async (tx) => {
    if (hayTons > 0 && hay) await drawFromStock(tx, hay, hayTons);
    if (maizeTons > 0 && maize) await drawFromStock(tx, maize, maizeTons);
    await tx.herd.update({
      where: { id: herd.id },
      data: {
        feedStock: herd.feedStock + units,
        feedQuality: quality,
        lastFedAt: new Date(),
      },
    });
  });
  res.json({ units: Math.round(units * 100) / 100, quality });
});

/** Traite : le lait s'accumule entre deux passages, et se perd s'il attend. */
app.post("/herds/:id/milk", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: true, building: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  if (herd.kind !== "COW") {
    res.status(409).json({ error: "Seules les vaches se traient" });
    return;
  }
  if (herd.size <= 0) {
    res.status(409).json({ error: "Étable vide" });
    return;
  }

  const now = Date.now();
  const since = herd.lastMilkedAt?.getTime() ?? herd.bornAt.getTime();
  const cycles = Math.min(2, (now - since) / LIVESTOCK_CYCLE_MS);
  if (cycles < 0.15) {
    const wait = Math.ceil(((0.15 - cycles) * LIVESTOCK_CYCLE_MS) / 1000);
    res.status(409).json({ error: `Les vaches viennent d'être traites — ${wait} s` });
    return;
  }

  const perCycle = milkYield({
    herdSize: herd.size,
    happiness: herd.happiness,
    barnLevel: herd.building.level,
    feedQuality: herd.feedQuality,
  });
  // Le lait se compte en hectolitres au silo : cent litres la tonne d'échange.
  const litres = perCycle * cycles;
  const hectolitres = Math.round((litres / 100) * 1000) / 1000;
  if (hectolitres <= 0) {
    res.status(409).json({ error: "Rien à traire : le troupeau ne produit pas" });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await addToStock(tx, herd.farmId, "MILK", hectolitres, 0, 3);
    await tx.herd.update({ where: { id: herd.id }, data: { lastMilkedAt: new Date(now) } });
  });
  res.json({ hectolitres, litres: Math.round(litres), cycles: Math.round(cycles * 100) / 100 });
});

/** Abattage : on convertit des bêtes en viande, définitivement. */
app.post("/herds/:id/slaughter", async (req, res) => {
  const body = z
    .object({ userId: z.string(), count: z.number().int().min(1) })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const herd = await prisma.herd.findUnique({
    where: { id: req.params.id },
    include: { farm: true, building: true },
  });
  if (!herd || herd.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Troupeau non possédé" });
    return;
  }
  if (body.data.count > herd.size) {
    res.status(409).json({ error: `Seulement ${herd.size} bête(s) au troupeau` });
    return;
  }

  const now = Date.now();
  const ageMs = now - herd.bornAt.getTime();
  const kgTotal = meatYield({
    herdSize: body.data.count,
    happiness: herd.happiness,
    averageAgeMs: ageMs,
    barnLevel: herd.building.level,
  });
  const tons = Math.round((kgTotal / 1000) * 1000) / 1000;
  const maturity = Math.min(1, ageMs / MEAT_MATURITY_MS);

  await prisma.$transaction(async (tx) => {
    await addToStock(tx, herd.farmId, "MEAT", tons, 0, herd.happiness > 0.7 ? 4 : 3);
    const left = herd.size - body.data.count;
    if (left <= 0) await tx.herd.delete({ where: { id: herd.id } });
    else await tx.herd.update({ where: { id: herd.id }, data: { size: left } });
  });
  res.json({
    slaughtered: body.data.count,
    tons,
    kg: Math.round(kgTotal),
    maturity: Math.round(maturity * 100),
    remaining: herd.size - body.data.count,
  });
});

/** Achat d'intrants au négociant — le fourrage, pour l'instant. */
app.post("/market/buy", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: z.enum(["HAY"]),
      tons: z.number().positive(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: true },
  });
  if (!user?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  const base = market?.price ?? GOOD_DEFS[body.data.commodity].basePrice;
  const cost = Math.round(dealerAskPrice(base) * body.data.tons);
  if (user.crd < cost) {
    res.status(402).json({ error: `CRD insuffisants — ${cost} requis` });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    await addToStock(tx, user.farm!.id, body.data.commodity, body.data.tons, 0, 3);
  });
  res.json({ bought: body.data.tons, cost, pricePerTon: dealerAskPrice(base) });
});

/** Reprise d'une machine — l'état conditionne le prix. */
app.post("/machines/:id/sell", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const machine = await prisma.machine.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!machine?.farm || machine.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Machine non possédée" });
    return;
  }
  const value = machineResaleValue(machine.type as MachineType, machine.condition);
  await prisma.$transaction(async (tx) => {
    // Libérer la case si l'engin était stationné sur la parcelle.
    await tx.parcelCell.updateMany({
      where: { machineId: machine.id },
      data: { kind: "EMPTY", machineId: null },
    });
    await tx.machine.delete({ where: { id: machine.id } });
    await tx.user.update({
      where: { id: body.data.userId },
      data: { crd: { increment: value } },
    });
  });
  res.json({ sold: machine.type, value });
});

/** Démolition d'un bâtiment — les niveaux payés se récupèrent en partie. */
app.post("/buildings/:id/sell", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const building = await prisma.building.findUnique({
    where: { id: req.params.id },
    include: { parcel: { include: { farm: true } }, storedMachines: true },
  });
  if (!building?.parcel.farm || building.parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Bâtiment non possédé" });
    return;
  }
  const value = buildingResaleValue(building.type as SharedBuildingType, building.level);
  await prisma.$transaction(async (tx) => {
    // Les engins rangés à l'intérieur ressortent, ils ne disparaissent pas
    // avec le hangar.
    await tx.machine.updateMany({
      where: { storedInBuildingId: building.id },
      data: { storedInBuildingId: null },
    });
    await tx.parcelCell.updateMany({
      where: { buildingId: building.id },
      data: { kind: "EMPTY", buildingId: null },
    });
    await tx.building.delete({ where: { id: building.id } });
    await tx.user.update({
      where: { id: body.data.userId },
      data: { crd: { increment: value } },
    });
  });
  const bonuses = await getFarmBonuses(building.parcel.farm.id);
  res.json({ sold: building.type, level: building.level, value, bonuses });
});

app.post("/machines/buy", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      type: z.enum(["TRACTOR", "HARVESTER", "SPREADER", "DISC_HARROW"]),
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

/* ------------------------------------------------------------------ */
/* Commerce : négociant, cours mondial, criée entre joueurs            */
/* ------------------------------------------------------------------ */

/** Retire des tonnes du stock d'une ferme, en supprimant le lot s'il est vidé. */
async function drawFromStock(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  item: { id: string; qty: number },
  tons: number,
) {
  const left = item.qty - tons;
  if (left <= 0.0001) await tx.inventoryItem.delete({ where: { id: item.id } });
  else await tx.inventoryItem.update({ where: { id: item.id }, data: { qty: left } });
}

/**
 * Passage des courtiers : ils raflent les lots raisonnablement prix.
 *
 * Sans eux, la criée resterait déserte tant que la population est faible, et
 * le canal le mieux payé des trois serait décoratif.
 */
async function runNpcBuyers() {
  const open = await prisma.marketListing.findMany({
    where: { status: "OPEN", expiresAt: { gt: new Date() } },
    include: { seller: true },
  });
  if (!open.length) return;
  const prices = await prisma.marketPrice.findMany();
  const now = Date.now();

  for (const listing of open) {
    const market = prices.find((p) => p.commodity === listing.commodity);
    if (!market) continue;
    const willBuy = npcWouldBuy({
      pricePerTon: listing.pricePerTon,
      marketPrice: market.price,
      ageMs: now - listing.createdAt.getTime(),
      roll: Math.random(),
    });
    if (!willBuy) continue;

    const proceeds = listingProceeds(listing.pricePerTon, listing.tons);
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.marketListing.findUnique({ where: { id: listing.id } });
      if (!fresh || fresh.status !== "OPEN") return;
      await tx.marketListing.update({
        where: { id: listing.id },
        data: { status: "SOLD", soldAt: new Date(now) },
      });
      await tx.user.update({
        where: { id: listing.sellerId },
        data: { crd: { increment: proceeds } },
      });
      // Le courtier remet la marchandise en circulation : le carnet s'épaissit.
      await tx.marketPrice.update({
        where: { commodity: listing.commodity },
        data: { stockTons: { increment: listing.tons } },
      });
    });
  }
}

/** Ferme les annonces expirées et rend la marchandise à leurs vendeurs. */
async function expireListings() {
  const stale = await prisma.marketListing.findMany({
    where: { status: "OPEN", expiresAt: { lt: new Date() } },
    include: { seller: { include: { farm: true } } },
  });
  for (const listing of stale) {
    await prisma.$transaction(async (tx) => {
      await tx.marketListing.update({
        where: { id: listing.id },
        data: { status: "EXPIRED" },
      });
      const farmId = listing.seller.farm?.id;
      if (!farmId) return;
      // Un lot périssable a vieilli en vitrine : déposer à la criée ne doit
      // pas être une façon d'échapper à la péremption.
      const back = afterSpoilage({
        good: listing.commodity as TradeGood,
        qty: listing.tons,
        elapsedMs: Date.now() - listing.createdAt.getTime(),
        cycleMs: LIVESTOCK_CYCLE_MS,
      });
      if (back <= 0) return;
      const existing = await tx.inventoryItem.findFirst({
        where: { farmId, itemCode: listing.commodity },
      });
      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: {
            qty: existing.qty + back,
            moisture: mergeMoisture(
              existing.qty,
              existing.moisture,
              back,
              listing.moisture,
            ),
          },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            farmId,
            itemCode: listing.commodity,
            qty: back,
            quality: listing.quality,
            moisture: listing.moisture,
          },
        });
      }
    });
  }
}

/** Devis comparé des trois canaux, pour un lot donné. */
app.get("/market/quote", async (req, res) => {
  const parsed = z
    .object({
      commodity: sellableGood,
      tons: z.coerce.number().positive(),
      moisture: z.coerce.number().min(0).max(1).optional(),
      ask: z.coerce.number().positive().optional(),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: parsed.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  res.json({
    marketPrice: market.price,
    stockTons: market.stockTons,
    channels: quoteAllChannels({
      commodity: parsed.data.commodity,
      tons: parsed.data.tons,
      marketPrice: market.price,
      stockTons: market.stockTons,
      moisturePenalty: moistureSellPenalty(parsed.data.moisture ?? 0.12),
      askPricePerTon: parsed.data.ask,
    }),
  });
});

/** Rachat par le négociant : immédiat, garanti, à prix bas. */
app.post("/market/dealer", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: sellableGood,
      tons: z.number().positive(),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  if (body.data.tons < DEALER_MIN_TONS) {
    res.status(409).json({ error: `Lot trop petit — ${DEALER_MIN_TONS} t minimum` });
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
  const tons = settleSaleTons(body.data.tons, inv?.qty ?? 0);
  if (!inv || tons === null) {
    res.status(409).json({ error: "Stock insuffisant" });
    return;
  }
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  const keep = 1 - moistureSellPenalty(inv.moisture);
  const pricePerTon = dealerPricePerTon(market.price) * keep;
  const revenue = Math.round(pricePerTon * tons);

  await prisma.$transaction(async (tx) => {
    await drawFromStock(tx, inv, tons);
    await tx.user.update({ where: { id: user.id }, data: { crd: { increment: revenue } } });
    // Le négociant revend au marché : le stock mondial monte, le cours cède.
    await tx.marketPrice.update({
      where: { commodity: body.data.commodity },
      data: { stockTons: { increment: tons } },
    });
  });
  res.json({
    revenue,
    tons,
    pricePerTon: Math.round(pricePerTon * 100) / 100,
    channel: "DEALER",
  });
});

/** Annonces ouvertes, les plus avantageuses d'abord. */
app.get("/market/listings", async (req, res) => {
  await expireListings();
  const mine = typeof req.query.userId === "string" ? req.query.userId : null;
  const listings = await prisma.marketListing.findMany({
    where: { status: "OPEN" },
    include: { seller: { select: { id: true, displayName: true } } },
    orderBy: [{ pricePerTon: "asc" }],
    take: 60,
  });
  res.json({
    listings: listings.map((l) => ({
      id: l.id,
      commodity: l.commodity,
      tons: l.tons,
      pricePerTon: l.pricePerTon,
      total: Math.round(l.pricePerTon * l.tons),
      moisture: l.moisture,
      quality: l.quality,
      sellerName: l.seller.displayName,
      mine: mine === l.sellerId,
      expiresInMs: Math.max(0, l.expiresAt.getTime() - Date.now()),
    })),
  });
});

/** Dépôt d'une annonce : la marchandise quitte le silo, les frais sont dus. */
app.post("/market/listings", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: sellableGood,
      tons: z.number().positive(),
      pricePerTon: z.number().positive(),
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
  // Mettre en criée la totalité d'un lot achoppait sur les mêmes centièmes que
  // la vente directe : on règle le tonnage sur ce qui est réellement en stock.
  const tons = settleSaleTons(body.data.tons, inv?.qty ?? 0) ?? body.data.tons;
  const market = await prisma.marketPrice.findUnique({
    where: { commodity: body.data.commodity },
  });
  if (!market) {
    res.status(500).json({ error: "Marché non initialisé" });
    return;
  }
  const openListings = await prisma.marketListing.count({
    where: { sellerId: user.id, status: "OPEN" },
  });
  const verdict = canList({
    pricePerTon: body.data.pricePerTon,
    tons,
    marketPrice: market.price,
    openListings,
    stockTons: inv?.qty ?? 0,
    crd: user.crd,
  });
  if (!verdict.ok) {
    res.status(409).json({ error: LISTING_REFUSAL_LABELS[verdict.reason!] });
    return;
  }

  const fee = listingFee(body.data.pricePerTon, tons);
  const listing = await prisma.$transaction(async (tx) => {
    await drawFromStock(tx, inv!, tons);
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: fee } } });
    return tx.marketListing.create({
      data: {
        sellerId: user.id,
        commodity: body.data.commodity,
        tons: tons,
        pricePerTon: body.data.pricePerTon,
        moisture: inv!.moisture,
        quality: inv!.quality,
        expiresAt: new Date(Date.now() + LISTING_TTL_MS),
      },
    });
  });
  res.status(201).json({ listing, fee, expiresInMs: LISTING_TTL_MS });
});

/** Retrait d'une annonce : la marchandise revient, les frais restent dus. */
app.post("/market/listings/:id/cancel", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const listing = await prisma.marketListing.findUnique({
    where: { id: req.params.id },
    include: { seller: { include: { farm: true } } },
  });
  if (!listing || listing.sellerId !== body.data.userId) {
    res.status(403).json({ error: "Annonce introuvable" });
    return;
  }
  if (listing.status !== "OPEN") {
    res.status(409).json({ error: "Cette annonce n'est plus ouverte" });
    return;
  }
  const farmId = listing.seller.farm?.id;
  await prisma.$transaction(async (tx) => {
    await tx.marketListing.update({
      where: { id: listing.id },
      data: { status: "CANCELLED" },
    });
    if (!farmId) return;
    const existing = await tx.inventoryItem.findFirst({
      where: { farmId, itemCode: listing.commodity },
    });
    if (existing) {
      await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          qty: existing.qty + listing.tons,
          moisture: mergeMoisture(
            existing.qty,
            existing.moisture,
            listing.tons,
            listing.moisture,
          ),
        },
      });
    } else {
      await tx.inventoryItem.create({
        data: {
          farmId,
          itemCode: listing.commodity,
          qty: listing.tons,
          quality: listing.quality,
          moisture: listing.moisture,
        },
      });
    }
  });
  res.json({ returned: listing.tons, commodity: listing.commodity });
});

/** Achat d'une annonce : les CRD passent au vendeur, la marchandise à l'acheteur. */
app.post("/market/listings/:id/buy", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  await expireListings();
  const listing = await prisma.marketListing.findUnique({ where: { id: req.params.id } });
  if (!listing || listing.status !== "OPEN") {
    res.status(409).json({ error: "Ce lot vient d'être vendu ou retiré" });
    return;
  }
  if (listing.sellerId === body.data.userId) {
    res.status(409).json({ error: "Vous ne pouvez pas acheter votre propre lot" });
    return;
  }
  const buyer = await prisma.user.findUnique({
    where: { id: body.data.userId },
    include: { farm: true },
  });
  if (!buyer?.farm) {
    res.status(404).json({ error: "Ferme introuvable" });
    return;
  }
  const total = Math.round(listing.pricePerTon * listing.tons);
  if (buyer.crd < total) {
    res.status(402).json({ error: `CRD insuffisants — ${total} requis` });
    return;
  }
  const proceeds = listingProceeds(listing.pricePerTon, listing.tons);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.marketListing.findUnique({ where: { id: listing.id } });
    if (!fresh || fresh.status !== "OPEN") throw new Error("LISTING_GONE");
    await tx.marketListing.update({
      where: { id: listing.id },
      data: { status: "SOLD", buyerId: buyer.id, soldAt: new Date() },
    });
    await tx.user.update({ where: { id: buyer.id }, data: { crd: { decrement: total } } });
    await tx.user.update({
      where: { id: listing.sellerId },
      data: { crd: { increment: proceeds } },
    });
    const existing = await tx.inventoryItem.findFirst({
      where: { farmId: buyer.farm!.id, itemCode: listing.commodity },
    });
    if (existing) {
      await tx.inventoryItem.update({
        where: { id: existing.id },
        data: {
          qty: existing.qty + listing.tons,
          moisture: mergeMoisture(
            existing.qty,
            existing.moisture,
            listing.tons,
            listing.moisture,
          ),
        },
      });
    } else {
      await tx.inventoryItem.create({
        data: {
          farmId: buyer.farm!.id,
          itemCode: listing.commodity,
          qty: listing.tons,
          quality: listing.quality,
          moisture: listing.moisture,
        },
      });
    }
  });
  res.json({ bought: listing.tons, commodity: listing.commodity, paid: total, proceeds });
});

app.post("/market/sell", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      commodity: sellableGood,
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
  const tons = settleSaleTons(body.data.tons, inv?.qty ?? 0);
  if (!inv || tons === null) {
    res.status(409).json({ error: "Stock insuffisant" });
    return;
  }
  const bonuses = await getFarmBonuses(user.farm.id);
  if (inv.qty > bonuses.storageGrain && tons > 0) {
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
  // Écouler un gros lot d'un coup fait plonger le cours obtenu : c'est ce qui
  // rend l'étalement des ventes — ou la criée — réellement plus rentable.
  const slippage = volumeSlippage(tons, market.stockTons);
  const sale = sellToMarket({
    tons: tons,
    price: marketPricePerTon(market.price, tons, market.stockTons),
    moisturePenalty,
  });
  const tick = tickMarket({
    commodity: body.data.commodity,
    price: market.price,
    supplyTons: tons,
    demandTons: tons * 0.9,
    stockTons: market.stockTons,
  });
  const xpGain = Math.round(10 * (1 + bonuses.xpBonus));
  const updated = await prisma.$transaction(async (tx) => {
    await drawFromStock(tx, inv, tons);
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
    tons,
    effectivePrice: sale.effectivePrice,
    slippage,
    moisturePenalty,
    moisture: inv.moisture,
    crd: updated.crd,
    market: tick,
    bonuses,
    channel: "MARKET",
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
