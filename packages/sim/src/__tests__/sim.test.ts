import { simulateCell, tickMarket, sellToMarket } from "../index";

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
