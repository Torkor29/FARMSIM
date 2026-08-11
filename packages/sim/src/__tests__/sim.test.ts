import { simulateField, tickMarket, sellToMarket } from "../index";

describe("simulateField", () => {
  const base = {
    crop: "WHEAT" as const,
    plantedAt: 0,
    fertility: 0.8,
    weedsControlled: true,
    fertilizedPasses: 2 as const,
  };

  it("n’est pas prêt avant growMs", () => {
    const r = simulateField({ ...base, now: 60_000 });
    expect(r.ready).toBe(false);
    expect(r.progress).toBeLessThan(1);
  });

  it("est prêt après growMs et calcule un yield > 0", () => {
    const r = simulateField({ ...base, now: 14 * 60 * 1000 });
    expect(r.ready).toBe(true);
    expect(r.estimatedYieldTons).toBeGreaterThan(5);
  });

  it("applique un malus pluie à la récolte", () => {
    const dry = simulateField({ ...base, now: 14 * 60 * 1000, weatherAtHarvest: "CLEAR" });
    const wet = simulateField({ ...base, now: 14 * 60 * 1000, weatherAtHarvest: "RAIN" });
    expect(wet.estimatedYieldTons).toBeLessThan(dry.estimatedYieldTons);
    expect(wet.moisturePenalty).toBe(0.25);
  });

  it("donne un léger bonus céréalier", () => {
    const normal = simulateField({ ...base, now: 14 * 60 * 1000 });
    const spe = simulateField({
      ...base,
      now: 14 * 60 * 1000,
      specialization: "CEREALIER",
    });
    expect(spe.estimatedYieldTons).toBeGreaterThan(normal.estimatedYieldTons);
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
