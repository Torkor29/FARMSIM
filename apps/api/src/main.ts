import express from "express";
import cors from "cors";
import { PrismaClient, CropCode, Specialization, ContractJobType } from "@prisma/client";
import { z } from "zod";
import { CROP_DEFS, MARKET_BOUNDS, SPECIALIZATION_LABELS } from "@farmsim/shared";
import { simulateField, sellToMarket, tickMarket } from "@farmsim/sim";

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3001);

async function ensureSeed() {
  const zones = await prisma.zone.count();
  if (zones === 0) {
    const z1 = await prisma.zone.create({
      data: {
        code: "FR-BEAUCE",
        name: "Beauce",
        country: "FR",
        koppen: "Cfb",
        riskNote: "Gel tardif occasionnel ; bonnes céréales",
      },
    });
    const z2 = await prisma.zone.create({
      data: {
        code: "US-IOWA",
        name: "Iowa",
        country: "US",
        koppen: "Dfa",
        riskNote: "Sécheresse estivale possible ; maïs/soja",
      },
    });
    for (let i = 1; i <= 6; i++) {
      await prisma.parcel.create({
        data: {
          zoneId: z1.id,
          label: `Beauce-${i}`,
          landPrice: 3500 + i * 250,
        },
      });
      await prisma.parcel.create({
        data: {
          zoneId: z2.id,
          label: `Iowa-${i}`,
          landPrice: 4000 + i * 200,
        },
      });
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

  const openContracts = await prisma.npcContract.count({ where: { status: "OPEN" } });
  if (openContracts < 5) {
    const jobs: { jobType: ContractJobType; title: string; rewardCrd: number; regionNote: string }[] = [
      { jobType: "HARVEST", title: "Moisson blé — 12 ha", rewardCrd: 850, regionNote: "Beauce" },
      { jobType: "PLOW", title: "Labour de printemps", rewardCrd: 420, regionNote: "Iowa" },
      { jobType: "SOW", title: "Semis maïs", rewardCrd: 560, regionNote: "Beauce" },
      { jobType: "FERTILIZE", title: "Épandage NPK", rewardCrd: 380, regionNote: "Iowa" },
      { jobType: "TRANSPORT", title: "Transport grain → silo", rewardCrd: 300, regionNote: "Beauce" },
    ];
    for (const j of jobs) {
      await prisma.npcContract.create({ data: j });
    }
  }

  const weather = await prisma.weatherSnapshot.count();
  if (weather === 0) {
    await prisma.weatherSnapshot.createMany({
      data: [
        { zoneCode: "FR-BEAUCE", state: "CLEAR" },
        { zoneCode: "US-IOWA", state: "CLOUDY" },
      ],
    });
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "farmsim-api" });
});

app.get("/meta/specializations", (_req, res) => {
  res.json(SPECIALIZATION_LABELS);
});

app.get("/zones", async (_req, res) => {
  const zones = await prisma.zone.findMany({
    include: { parcels: { where: { farmId: null } } },
  });
  res.json(zones);
});

app.get("/market", async (_req, res) => {
  const prices = await prisma.marketPrice.findMany();
  res.json(prices);
});

app.get("/weather", async (_req, res) => {
  res.json(await prisma.weatherSnapshot.findMany());
});

app.get("/contracts", async (_req, res) => {
  const contracts = await prisma.npcContract.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
  res.json(contracts);
});

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(32),
  specialization: z.enum(["CEREALIER", "ELEVEUR", "ETA"]),
  parcelId: z.string().optional(),
});

app.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(parsed.error.flatten());
    return;
  }
  const { email, displayName, specialization, parcelId } = parsed.data;

  if (specialization !== "ETA" && !parcelId) {
    res.status(400).json({ error: "parcelId requis pour céréalier/éleveur" });
    return;
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email, displayName, specialization },
      });
      const farm = await tx.farm.create({
        data: {
          userId: u.id,
          name: `Ferme ${displayName}`,
          machines: {
            create: [
              { type: specialization === "ETA" ? "HARVESTER" : "TRACTOR", tier: 1 },
            ],
          },
        },
      });
      if (parcelId) {
        const parcel = await tx.parcel.findFirst({ where: { id: parcelId, farmId: null } });
        if (!parcel) throw new Error("PARCEL_UNAVAILABLE");
        if (u.crd < parcel.landPrice) throw new Error("INSUFFICIENT_FUNDS");
        await tx.user.update({
          where: { id: u.id },
          data: { crd: { decrement: parcel.landPrice } },
        });
        await tx.parcel.update({
          where: { id: parcel.id },
          data: { farmId: farm.id },
        });
      }
      return tx.user.findUnique({
        where: { id: u.id },
        include: { farm: { include: { parcels: true, machines: true, inventory: true } } },
      });
    });
    res.status(201).json(user);
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

app.get("/players/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { farm: { include: { parcels: { include: { zone: true } }, machines: true, inventory: true } } },
  });
  if (!user) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  res.json(user);
});

app.post("/parcels/:id/plant", async (req, res) => {
  const body = z
    .object({
      userId: z.string(),
      crop: z.enum(["WHEAT", "MAIZE"]),
    })
    .safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }

  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: true, zone: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  if (parcel.fieldStage !== "EMPTY" && parcel.fieldStage !== "HARVESTED" && parcel.fieldStage !== "PREPARED") {
    res.status(409).json({ error: "Parcelle occupée" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const seedCost = CROP_DEFS[body.data.crop].seedCost;
  if (user.crd < seedCost) {
    res.status(402).json({ error: "CRD insuffisants pour semences" });
    return;
  }

  const now = Date.now();
  const growMs = CROP_DEFS[body.data.crop].growMs;
  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { crd: { decrement: seedCost } },
    });
    return tx.parcel.update({
      where: { id: parcel.id },
      data: {
        crop: body.data.crop,
        fieldStage: "PLANTED",
        plantedAt: new Date(now),
        readyAt: new Date(now + growMs),
        fertilizedPasses: 0,
        weedsControlled: false,
      },
    });
  });
  res.json(updated);
});

app.post("/parcels/:id/fertilize", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId) {
    res.status(403).json({ error: "Parcelle non possédée" });
    return;
  }
  if (!parcel.crop || parcel.fertilizedPasses >= 2) {
    res.status(409).json({ error: "Fertilisation impossible" });
    return;
  }
  const cost = 80;
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user || user.crd < cost) {
    res.status(402).json({ error: "CRD insuffisants" });
    return;
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { crd: { decrement: cost } } });
    return tx.parcel.update({
      where: { id: parcel.id },
      data: { fertilizedPasses: { increment: 1 }, weedsControlled: true },
    });
  });
  res.json(updated);
});

app.get("/parcels/:id/status", async (req, res) => {
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { zone: true, farm: true },
  });
  if (!parcel) {
    res.status(404).json({ error: "Introuvable" });
    return;
  }
  if (!parcel.crop || !parcel.plantedAt) {
    res.json({ parcel, sim: null });
    return;
  }
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: parcel.zone.code },
  });
  const user = parcel.farm
    ? await prisma.user.findUnique({ where: { id: parcel.farm.userId } })
    : null;
  const sim = simulateField({
    crop: parcel.crop,
    plantedAt: parcel.plantedAt.getTime(),
    now: Date.now(),
    fertility: parcel.fertility,
    weedsControlled: parcel.weedsControlled,
    fertilizedPasses: Math.min(2, parcel.fertilizedPasses) as 0 | 1 | 2,
    specialization: user?.specialization,
    weatherAtHarvest: weather?.state as "CLEAR" | "RAIN" | undefined,
  });
  if (sim.ready && parcel.fieldStage !== "READY" && parcel.fieldStage !== "HARVESTED") {
    await prisma.parcel.update({
      where: { id: parcel.id },
      data: { fieldStage: "READY" },
    });
  }
  res.json({ parcel, sim, weather });
});

app.post("/parcels/:id/harvest", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const parcel = await prisma.parcel.findUnique({
    where: { id: req.params.id },
    include: { farm: true, zone: true },
  });
  if (!parcel?.farm || parcel.farm.userId !== body.data.userId || !parcel.crop || !parcel.plantedAt) {
    res.status(403).json({ error: "Récolte impossible" });
    return;
  }
  const weather = await prisma.weatherSnapshot.findFirst({
    where: { zoneCode: parcel.zone.code },
  });
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  const sim = simulateField({
    crop: parcel.crop,
    plantedAt: parcel.plantedAt.getTime(),
    now: Date.now(),
    fertility: parcel.fertility,
    weedsControlled: parcel.weedsControlled,
    fertilizedPasses: Math.min(2, parcel.fertilizedPasses) as 0 | 1 | 2,
    specialization: user?.specialization,
    weatherAtHarvest: weather?.state as "CLEAR" | "RAIN" | undefined,
  });
  if (!sim.ready) {
    res.status(409).json({ error: "Culture pas prête", sim });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const crop = parcel.crop!;
    await tx.parcel.update({
      where: { id: parcel.id },
      data: {
        fieldStage: "EMPTY",
        crop: null,
        plantedAt: null,
        readyAt: null,
        fertilizedPasses: 0,
        weedsControlled: false,
      },
    });
    const existing = await tx.inventoryItem.findFirst({
      where: { farmId: parcel.farmId!, itemCode: crop },
    });
    const item = existing
      ? await tx.inventoryItem.update({
          where: { id: existing.id },
          data: { qty: { increment: sim.estimatedYieldTons } },
        })
      : await tx.inventoryItem.create({
          data: {
            farmId: parcel.farmId!,
            itemCode: crop,
            qty: sim.estimatedYieldTons,
            quality: sim.moisturePenalty > 0 ? 2 : 3,
          },
        });
    return { item, sim };
  });

  res.json(result);
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

  const updated = await prisma.$transaction(async (tx) => {
    await tx.inventoryItem.update({
      where: { id: inv.id },
      data: { qty: { decrement: body.data.tons } },
    });
    const u = await tx.user.update({
      where: { id: user.id },
      data: { crd: { increment: sale.revenue }, xp: { increment: 10 } },
    });
    await tx.marketPrice.update({
      where: { commodity: body.data.commodity },
      data: { price: tick.price, stockTons: tick.stockTons },
    });
    return u;
  });

  res.json({ revenue: sale.revenue, effectivePrice: sale.effectivePrice, crd: updated.crd, market: tick });
});

app.post("/contracts/:id/accept", async (req, res) => {
  const body = z.object({ userId: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json(body.error.flatten());
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
  if (!user) {
    res.status(404).json({ error: "Joueur introuvable" });
    return;
  }
  const contract = await prisma.npcContract.findUnique({ where: { id: req.params.id } });
  if (!contract || contract.status !== "OPEN") {
    res.status(409).json({ error: "Contrat indisponible" });
    return;
  }

  const etaBonus = user.specialization === "ETA" ? 1.05 : 1;
  const reward = Math.round(contract.rewardCrd * etaBonus * 100) / 100;

  const result = await prisma.$transaction(async (tx) => {
    await tx.npcContract.update({
      where: { id: contract.id },
      data: {
        status: "COMPLETED",
        providerId: user.id,
        completedAt: new Date(),
      },
    });
    const u = await tx.user.update({
      where: { id: user.id },
      data: {
        crd: { increment: reward },
        xp: { increment: user.specialization === "ETA" ? 25 : 15 },
      },
    });
    // Respawn a similar open contract for the board
    await tx.npcContract.create({
      data: {
        jobType: contract.jobType,
        title: contract.title,
        rewardCrd: contract.rewardCrd,
        regionNote: contract.regionNote,
      },
    });
    return { user: u, reward };
  });

  res.json(result);
});

async function main() {
  await ensureSeed();
  app.listen(PORT, () => {
    console.log(`API Farming Navigateur sur http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
