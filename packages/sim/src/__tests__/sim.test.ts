import { DRYING, MACHINE_DEFS, contractorQuote, missionPayout, urgentContractorQuote, CROP_DEFS, MISSION_OPEN_MAX, clampMissionCells, repairHalfwayTarget, laborEscrow, parseAppearance, defaultAppearance, SKIN_TONES, HATS, jobHours, machineHoursPerHectare, machineLifeHours } from "@farmsim/shared";
import {
  simulateCell,
  tickMarket,
  sellToMarket,
  applyMachineWear,
  repairMachineCost,
  machineCanWork,
  tickWeather,
  marketNpcPressure,
  weatherYieldFactor,
  buildSessionResume,
  harvestMoisture,
  dryInventory,
  moistureSellPenalty,
  mergeMoisture,
} from "../index";

describe("simulateCell", () => {
  const base = {
    crop: "WHEAT" as const,
    plantedAt: 0,
    fertility: 0.8,
    fertilizedPasses: 2 as const,
  };

  /**
   * Les instants d'observation étaient écrits en dur à trois minutes — la
   * durée de pousse du blé du temps où c'était une valeur de mise au point.
   * Ils sont dérivés de la constante : c'est bien « après `growMs` » qu'on
   * veut regarder, quelle que soit la valeur qu'elle prendra ensuite.
   */
  const MUR = CROP_DEFS.WHEAT.growMs;

  it("n’est pas prêt avant growMs", () => {
    const r = simulateCell({ ...base, now: MUR / 3 });
    expect(r.ready).toBe(false);
    expect(r.progress).toBeLessThan(1);
  });

  it("est prêt après growMs", () => {
    const r = simulateCell({ ...base, now: MUR });
    expect(r.ready).toBe(true);
    expect(r.estimatedYieldTons).toBeGreaterThan(0.2);
  });

  it("applique un malus pluie", () => {
    const dry = simulateCell({ ...base, now: MUR, weatherAtHarvest: "CLEAR" });
    const wet = simulateCell({ ...base, now: MUR, weatherAtHarvest: "RAIN" });
    expect(wet.estimatedYieldTons).toBeLessThan(dry.estimatedYieldTons);
  });

  it("applique bonus bâtiments plafonné", () => {
    const baseY = simulateCell({ ...base, now: MUR });
    const buff = simulateCell({
      ...base,
      now: MUR,
      buildingYieldBonus: 0.05,
    });
    expect(buff.estimatedYieldTons).toBeGreaterThan(baseY.estimatedYieldTons);
  });
});

describe("tickMarket", () => {
  it("hausse le prix si demande > offre", () => {
    const r = tickMarket({
      commodity: "WHEAT",
      price: 220,
      supplyTons: 100,
      demandTons: 500,
      stockTons: 50,
    });
    expect(r.price).toBeGreaterThan(220);
  });

  it("reste dans les bornes", () => {
    const r = tickMarket({
      commodity: "WHEAT",
      price: 220,
      supplyTons: 0,
      demandTons: 10_000,
      stockTons: 0,
      kappa: 1,
    });
    expect(r.price).toBeLessThanOrEqual(450);
  });
});

describe("sellToMarket", () => {
  it("calcule le revenu avec malus humidité", () => {
    const r = sellToMarket({ tons: 8, price: 220, moisturePenalty: 0.25 });
    expect(r.revenue).toBe(8 * 165);
  });
});

describe("machines", () => {
  it("applique l’usure par heures de travail", () => {
    // 100 h de vie pour 100 points : une heure vaut un point.
    const r = applyMachineWear({ condition: 100, hours: 10, lifeHours: 100 });
    expect(r.condition).toBe(90);
    expect(r.wearApplied).toBe(10);
  });

  it("réduit l’usure en hangar", () => {
    const base = applyMachineWear({ condition: 100, hours: 10, lifeHours: 100 });
    const shed = applyMachineWear({ condition: 100, hours: 10, lifeHours: 100, inShed: true });
    expect(shed.wearApplied).toBeLessThan(base.wearApplied);
  });

  it("calcule le coût de réparation avec atelier", () => {
    const full = repairMachineCost({ condition: 50, repairCostPerPoint: 10 });
    const disc = repairMachineCost({
      condition: 50,
      repairCostPerPoint: 10,
      workshopDiscount: 0.1,
    });
    expect(full.cost).toBe(500);
    expect(disc.cost).toBe(450);
  });

  it("refuse le travail sous le seuil", () => {
    expect(machineCanWork(11, 12)).toBe(false);
    expect(machineCanWork(12, 12)).toBe(true);
  });

  it("rafistole à mi-chemin du neuf", () => {
    expect(repairHalfwayTarget(0)).toBe(50);
    expect(repairHalfwayTarget(40)).toBe(70);
    const half = repairMachineCost({
      condition: 0,
      repairCostPerPoint: 8,
      targetCondition: repairHalfwayTarget(0),
    });
    const full = repairMachineCost({ condition: 0, repairCostPerPoint: 8 });
    expect(half.nextCondition).toBe(50);
    expect(half.cost).toBe(full.cost / 2);
  });

  it("une moissonneuse T1 survit à une parcelle 12×12", () => {
    const def = MACHINE_DEFS.HARVESTER;
    const r = applyMachineWear({
      condition: 100,
      hours: jobHours(machineHoursPerHectare("HARVESTER"), 12 * 12),
      lifeHours: machineLifeHours("HARVESTER"),
    });
    expect(r.condition).toBeGreaterThan(def.minCondition);
    expect(def.repairCostPerPoint * 100).toBeLessThanOrEqual(def.cost * 0.25);
  });

  it("sous-traiter une parcelle entière coûte moins que l’engin", () => {
    expect(contractorQuote("HARVEST", 144)).toBeLessThan(MACHINE_DEFS.HARVESTER.cost);
    expect(contractorQuote("PLANT", 144)).toBeLessThan(MACHINE_DEFS.TRACTOR.cost);
  });
});

describe("missions d’appoint", () => {
  it("paie 55 % du devis client, jamais 100 %", () => {
    const client = contractorQuote("HARVEST", 16);
    const npc = missionPayout("HARVEST", 16, "NPC");
    const p2p = missionPayout("HARVEST", 16, "P2P");
    expect(npc).toBe(Math.round(client * 0.55));
    expect(p2p).toBe(Math.round(client * 0.85));
    expect(npc).toBeLessThan(p2p);
    expect(p2p).toBeLessThan(client);
  });

  it("plafonne un chantier à 24 cases", () => {
    expect(clampMissionCells(144)).toBe(24);
    expect(clampMissionCells(3)).toBe(8);
  });

  it("facture l’urgent PNJ 15 % de plus que le barème", () => {
    expect(urgentContractorQuote("HARVEST", 24)).toBe(
      Math.round(contractorQuote("HARVEST", 24) * 1.15),
    );
  });

  it("10 min de tableau (3 moissons) rapportent moins que 24 cases de blé", () => {
    const wheat = CROP_DEFS.WHEAT;
    const grain = 24 * wheat.yieldPerCell * 220;
    const seeds = 24 * wheat.seedCostPerCell;
    const cultureNet = grain - seeds;
    const board = MISSION_OPEN_MAX * missionPayout("HARVEST", 24, "NPC");
    expect(board).toBeLessThan(cultureNet);
  });

  /*
   * Le devis d'entraide retenait 15 % au passage : le client mettait de côté
   * `quote`, l'aidant en touchait 85 %, et le reliquat retournait au client.
   *
   * Le prix se fixe désormais à la main — c'est une annonce passée aux autres
   * joueurs, et son prix appartient à celui qui la passe. Une commission
   * invisible ferait mentir le chiffre à l'instant même où on le tape : ce
   * qu'on offre est ce que l'aidant touche.
   */
  it("escrowe le prix offert plus les intrants, et le verse en entier", () => {
    const money = laborEscrow("HARVEST", 16);
    expect(money.escrow).toBe(money.quote + money.extras);
    expect(money.payout).toBe(money.quote);
  });

  it("escrowe pressage et ensilage sans intrants", () => {
    for (const work of ["BALE", "COLLECT", "SILAGE"] as const) {
      const money = laborEscrow(work, 16);
      expect(money.extras).toBe(0);
      expect(money.escrow).toBe(money.quote);
      expect(money.payout).toBe(money.quote);
    }
  });

  it("verse au prestataire exactement ce que le client a écrit", () => {
    for (const offre of [120, 500, 2000]) {
      const money = laborEscrow("HARVEST", 16, null, false, offre);
      expect(money.payout).toBe(money.quote);
      expect(money.escrow - money.extras).toBe(money.payout);
    }
  });

  it("fait payer un peu moins les fermes PNJ", () => {
    const human = laborEscrow("HARVEST", 16);
    const npc = laborEscrow("HARVEST", 16, null, true);
    expect(npc.quote).toBeLessThan(human.quote);
    expect(npc.payout).toBeLessThan(human.payout);
  });
});

describe("apparence", () => {
  it("borne les indices hors catalogue", () => {
    const a = parseAppearance({ skin: 99, hat: -1, clothes: 2 });
    expect(a.skin).toBeGreaterThanOrEqual(0);
    expect(a.skin).toBeLessThan(SKIN_TONES.length);
    expect(a.hat).toBeGreaterThanOrEqual(0);
    expect(a.hat).toBeLessThan(HATS.length);
    expect(a.clothes).toBe(2);
  });

  it("donne un céréalier chapeau de paille par défaut", () => {
    expect(HATS[defaultAppearance("CEREALIER").hat].id).toBe("straw");
    expect(HATS[defaultAppearance("ELEVEUR").hat].id).toBe("cowboy");
  });
});

describe("weather & market pressure", () => {
  it("tickWeather est déterministe avec rng", () => {
    const a = tickWeather({ current: "CLEAR", koppen: "Cfb", rng: 0.1 });
    const b = tickWeather({ current: "CLEAR", koppen: "Cfb", rng: 0.1 });
    expect(a.state).toBe(b.state);
  });

  it("peut changer d’état", () => {
    const r = tickWeather({ current: "CLEAR", koppen: "Cfb", rng: 0.95 });
    expect(["CLEAR", "CLOUDY", "RAIN", "STORM", "SNOW"]).toContain(r.state);
  });

  it("marketNpcPressure réagit aux orages", () => {
    const calm = marketNpcPressure({
      weatherStates: ["CLEAR", "CLEAR"],
      rng: () => 0.5,
    });
    const storm = marketNpcPressure({
      weatherStates: ["STORM", "STORM"],
      rng: () => 0.5,
    });
    expect(storm.supplyTons).toBeLessThan(calm.supplyTons);
    expect(storm.demandTons).toBeGreaterThanOrEqual(calm.demandTons);
  });

  it("weatherYieldFactor pénalise orage/neige", () => {
    expect(weatherYieldFactor("STORM")).toBeLessThan(weatherYieldFactor("CLEAR"));
    expect(weatherYieldFactor("SNOW")).toBeLessThan(weatherYieldFactor("CLOUDY"));
  });
});

describe("session resume", () => {
  it("résume absence, cultures et marché", () => {
    const r = buildSessionResume({
      awayMs: 120_000,
      cropsReady: 3,
      cropsGrowing: 5,
      marketBefore: { WHEAT: 220, MAIZE: 200 },
      marketNow: { WHEAT: 230, MAIZE: 195 },
      weatherStates: ["RAIN"],
    });
    expect(r.awayLabel).toBe("2 min");
    expect(r.marketDelta.WHEAT).toBe(10);
    expect(r.marketDelta.MAIZE).toBe(-5);
    expect(r.hint).toContain("prête");
    expect(r.hint).toContain("Météo");
  });
});

describe("harvestMoisture & dryInventory", () => {
  it("donne une humidité plus haute sous pluie/orage/neige", () => {
    expect(harvestMoisture("CLEAR")).toBeLessThan(harvestMoisture("RAIN"));
    expect(harvestMoisture("RAIN")).toBeLessThan(harvestMoisture("STORM"));
    expect(harvestMoisture("STORM")).toBeLessThan(harvestMoisture("SNOW"));
  });

  it("sèche et facture par passe", () => {
    const r = dryInventory({ moisture: 0.25, tons: 10, passes: 1 });
    expect(r.moisture).toBeCloseTo(0.25 - DRYING.moistureReductionPerPass, 3);
    expect(r.cost).toBe(10 * DRYING.costPerTonPerPass);
    expect(r.reduction).toBeCloseTo(DRYING.moistureReductionPerPass, 3);
  });

  it("applique le bonus silo/hangar", () => {
    const base = dryInventory({ moisture: 0.25, tons: 5, passes: 1 });
    const barn = dryInventory({ moisture: 0.25, tons: 5, passes: 1, barnBonus: true });
    expect(barn.moisture).toBeLessThan(base.moisture);
    expect(barn.cost).toBe(base.cost);
  });

  it("respecte le plancher d’humidité", () => {
    const r = dryInventory({ moisture: 0.11, tons: 2, passes: 5, barnBonus: true });
    expect(r.moisture).toBe(DRYING.moistureFloor);
  });

  it("pénalise la vente au-dessus du seuil", () => {
    expect(moistureSellPenalty(0.12)).toBe(0);
    expect(moistureSellPenalty(0.2)).toBe(DRYING.sellPenaltyAbove);
  });

  it("fusionne l’humidité en moyenne pondérée", () => {
    expect(mergeMoisture(10, 0.12, 10, 0.22)).toBe(0.17);
  });
});
