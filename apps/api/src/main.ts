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
  MARKET_BOUNDS,
  SPECIALIZATION_LABELS,
  footprintCells,
  DEFAULT_GRID,
  MACHINE_DEFS,
  CONTRACT_WORK,
  CONTRACT_WEAR_CELLS,
  SIM_TICK_MS,
  WEATHER_LABELS,
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
  tickWeather,
  marketNpcPressure,
  buildSessionResume,
} from "@farmsim/sim";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

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
  for (const b of buildings) {
    const def = BUILDING_DEFS[b.type as SharedBuildingType];
    yieldBonus += def.yieldBonus ?? 0;
    storageGrain += def.storageGrain ?? 0;
    storageHay += def.storageHay ?? 0;
    machineSlots += def.machineSlots ?? 0;
    cattleSlots += def.cattleSlots ?? 0;
    pigSlots += def.pigSlots ?? 0;
    repairDiscount += def.repairDiscount ?? 0;
    xpBonus += def.xpBonus ?? 0;
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
  };
}

async function ensureSeed() {
  if ((await prisma.zone.count()) === 0) {
    const zones = [
      {
        code: "FR-BEAUCE",
        name: "Beauce",
        country: "FR",
        koppen: "Cfb",
        riskNote: "Gel tardif ; bonnes céréales",
        mapW: 4,
        mapH: 3,
      },
      {
        code: "US-IOWA",
        name: "Iowa",
        country: "US",
        koppen: "Dfa",
        riskNote: "Sécheresse estivale ; maïs",
        mapW: 4,
        mapH: 3,
      },
    ];
    for (const z of zones) {
      const zone = await prisma.zone.create({ data: z });
      let n = 1;
      for (let my = 0; my < z.mapH; my++) {
        for (let mx = 0; mx < z.mapW; mx++) {
          const parcel = await prisma.parcel.create({
            data: {
              zoneId: zone.id,
              label: `${z.name}-${n++}`,
              mapX: mx,
              mapY: my,
              gridW: DEFAULT_GRID.w,
              gridH: DEFAULT_GRID.h,
              landPrice: 3200 + (mx + my) * 150,
            },
          });
          await createParcelGrid(parcel.id, DEFAULT_GRID.w, DEFAULT_GRID.h);
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

  if ((await prisma.weatherSnapshot.count()) === 0) {
    await prisma.weatherSnapshot.createMany({
      data: [
        { zoneCode: "FR-BEAUCE", state: "CLEAR" },
        { zoneCode: "US-IOWA", state: "CLOUDY" },
      ],
    });
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

  for (const snap of snapshots) {
    const zone = zones.find((z) => z.code === snap.zoneCode);
    const next = tickWeather({
      current: snap.state as WeatherState,
      koppen: zone?.koppen ?? "Cfb",
    });
    if (next.changed) {
      await prisma.weatherSnapshot.update({
        where: { id: snap.id },
        data: { state: next.state },
      });
    }
    weatherOut.push({ zoneCode: snap.zoneCode, state: next.state, changed: next.changed });
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
  specialization: z.enum(["CEREALIER", "ELEVEUR", "ETA"]),
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
  if (specialization !== "ETA" && !parcelId) {
    res.status(400).json({ error: "parcelId requis pour céréalier/éleveur" });
    return;
  }
  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          displayName,
          specialization,
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
                : [{ type: "TRACTOR", tier: 1 }],
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
  res.json({ parcel, weather, bonuses, cellSims });
});

/** Achat parcelle adjacente (ou 1ʳᵉ parcelle si ferme sans terre) */
app.post("/parcels/:id/buy", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const target = await prisma.parcel.findUnique({ where: { id: req.params.id } });
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
  if (user.crd < target.landPrice) {
    res.status(402).json({ error: "CRD insuffisants" });
    return;
  }

  const owned = user.farm.parcels;
  if (owned.length > 0) {
    const adjacent = owned.some(
      (p) =>
        p.zoneId === target.zoneId &&
        ((Math.abs(p.mapX - target.mapX) === 1 && p.mapY === target.mapY) ||
          (Math.abs(p.mapY - target.mapY) === 1 && p.mapX === target.mapX)),
    );
    if (!adjacent) {
      res.status(403).json({ error: "Parcelle non adjacente à votre exploitation" });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { crd: { decrement: target.landPrice } },
    });
    await tx.parcel.update({
      where: { id: target.id },
      data: { farmId: user.farm!.id },
    });
    return tx.user.findUnique({
      where: { id: user.id },
      include: { farm: { include: farmInclude() } },
    });
  });
  res.json(updated);
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

  const harvested: { crop: CropCode; tons: number; moisturePenalty: number }[] = [];
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
      harvested.push({
        crop: cell.crop,
        tons: sim.estimatedYieldTons,
        moisturePenalty: sim.moisturePenalty,
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

    const byCrop = new Map<CropCode, { tons: number; wet: boolean }>();
    for (const h of harvested) {
      const cur = byCrop.get(h.crop) ?? { tons: 0, wet: false };
      cur.tons += h.tons;
      if (h.moisturePenalty > 0) cur.wet = true;
      byCrop.set(h.crop, cur);
    }
    for (const [crop, { tons, wet }] of byCrop) {
      const existing = await tx.inventoryItem.findFirst({
        where: { farmId: parcel.farmId!, itemCode: crop },
      });
      if (existing) {
        await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { qty: { increment: tons }, quality: wet ? Math.min(existing.quality, 2) : existing.quality },
        });
      } else {
        await tx.inventoryItem.create({
          data: {
            farmId: parcel.farmId!,
            itemCode: crop,
            qty: tons,
            quality: wet ? 2 : 3,
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
    include: { farm: true },
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
  const moisturePenalty = inv.quality <= 2 ? 0.15 : 0;
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
    crd: updated.crd,
    market: tick,
    bonuses,
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
