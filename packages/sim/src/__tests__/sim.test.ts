import { DRYING, MACHINE_DEFS, contractorQuote, repairHalfwayTarget } from "@farmsim/shared";
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
    weedsControlled: true,
    fertilizedPasses: 2 as const,
  };

  it("n’est pas prêt avant growMs", () => {
    const r = simulateCell({ ...base, now: 60_000 });
    expect(r.ready).toBe(false);
    expect(r.progress).toBeLessThan(1);
  });

  it("est prêt après growMs", () => {
    const r = simulateCell({ ...base, now: 3 * 60 * 1000 });
    expect(r.ready).toBe(true);
    expect(r.estimatedYieldTons).toBeGreaterThan(0.2);
  });

  it("applique un malus pluie", () => {
    const dry = simulateCell({ ...base, now: 3 * 60 * 1000, weatherAtHarvest: "CLEAR" });
    const wet = simulateCell({ ...base, now: 3 * 60 * 1000, weatherAtHarvest: "RAIN" });
    expect(wet.estimatedYieldTons).toBeLessThan(dry.estimatedYieldTons);
  });

  it("applique bonus bâtiments plafonné", () => {
    const baseY = simulateCell({ ...base, now: 3 * 60 * 1000 });
    const buff = simulateCell({
      ...base,
      now: 3 * 60 * 1000,
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
  it("applique l’usure par cases", () => {
    const r = applyMachineWear({ condition: 100, wearPerCell: 1, cells: 10 });
    expect(r.condition).toBe(90);
    expect(r.wearApplied).toBe(10);
  });

  it("réduit l’usure en hangar et bonus ETA", () => {
    const base = applyMachineWear({ condition: 100, wearPerCell: 1, cells: 10 });
    const shed = applyMachineWear({ condition: 100, wearPerCell: 1, cells: 10, inShed: true });
    const eta = applyMachineWear({ condition: 100, wearPerCell: 1, cells: 10, etaBonus: true });
    expect(shed.wearApplied).toBeLessThan(base.wearApplied);
    expect(eta.wearApplied).toBeLessThan(base.wearApplied);
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
      wearPerCell: def.wearPerCell,
      cells: 12 * 12,
    });
    expect(r.condition).toBeGreaterThan(def.minCondition);
    expect(def.repairCostPerPoint * 100).toBeLessThanOrEqual(def.cost * 0.25);
  });

  it("sous-traiter une parcelle entière coûte moins que l’engin", () => {
    expect(contractorQuote("HARVEST", 144)).toBeLessThan(MACHINE_DEFS.HARVESTER.cost);
    expect(contractorQuote("PLANT", 144)).toBeLessThan(MACHINE_DEFS.TRACTOR.cost);
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
