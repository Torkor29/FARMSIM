import {
  simulateCell,
  tickMarket,
  sellToMarket,
  applyMachineWear,
  repairMachineCost,
  machineCanWork,
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
});
