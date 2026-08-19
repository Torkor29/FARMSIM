import {
  BREAK_CROP_BONUS,
  CROP_DEFS,
  GOOD_DEFS,
  MARKET_BOUNDS,
  NITROGEN_BONUS,
  SELLABLE_GOODS,
  isLegume,
  rotationFactor,
} from "@farmsim/shared";
import { simulateCell } from "../index.js";

describe("le pois, tête de rotation", () => {
  it("est une culture à part entière", () => {
    expect(CROP_DEFS.PEA.name).toBe("Pois");
    expect(CROP_DEFS.PEA.growMs).toBeGreaterThan(0);
    expect(isLegume("PEA")).toBe(true);
    expect(isLegume("WHEAT")).toBe(false);
  });

  it("se vend, et son cours est borné comme les autres", () => {
    expect(SELLABLE_GOODS).toContain("PEA");
    expect(GOOD_DEFS.PEA.sellable).toBe(true);
    expect(MARKET_BOUNDS.PEA.min).toBeLessThan(MARKET_BOUNDS.PEA.initial);
    expect(MARKET_BOUNDS.PEA.max).toBeGreaterThan(MARKET_BOUNDS.PEA.initial);
  });

  it("rapporte moins à la case qu'une céréale : c'est le prix de l'azote", () => {
    expect(CROP_DEFS.PEA.yieldPerCell).toBeLessThan(CROP_DEFS.WHEAT.yieldPerCell);
    // Compensé au marché, sans quoi personne n'en sèmerait jamais.
    expect(GOOD_DEFS.PEA.basePrice).toBeGreaterThan(GOOD_DEFS.WHEAT.basePrice);
  });

  it("laisse plus d'azote qu'une simple rupture de cycle", () => {
    const apresPois = rotationFactor({ lastCrop: "PEA", cropStreak: 1 }, "WHEAT");
    const apresMais = rotationFactor({ lastCrop: "MAIZE", cropStreak: 1 }, "WHEAT");
    expect(apresPois).toBeCloseTo(1 + NITROGEN_BONUS);
    expect(apresMais).toBeCloseTo(1 + BREAK_CROP_BONUS);
    expect(apresPois).toBeGreaterThan(apresMais);
  });

  it("n'apporte rien à une autre légumineuse, qui fixe déjà son azote", () => {
    expect(rotationFactor({ lastCrop: "PEA", cropStreak: 1 }, "PEA")).toBeLessThan(1);
  });

  it("le pois sur pois se paie comme tout retour de culture", () => {
    const deuxieme = rotationFactor({ lastCrop: "PEA", cropStreak: 1 }, "PEA");
    const troisieme = rotationFactor({ lastCrop: "PEA", cropStreak: 2 }, "PEA");
    expect(troisieme).toBeLessThan(deuxieme);
  });

  it("le blé qui suit un pois rend vraiment davantage", () => {
    const base = {
      crop: "WHEAT" as const,
      plantedAt: 0,
      now: 3 * 60 * 1000,
      fertility: 0.7,
      fertilizedPasses: 1 as const,
    };
    const apresPois = simulateCell({ ...base, rotation: { lastCrop: "PEA", cropStreak: 1 } });
    const apresMais = simulateCell({ ...base, rotation: { lastCrop: "MAIZE", cropStreak: 1 } });
    expect(apresPois.estimatedYieldTons).toBeGreaterThan(apresMais.estimatedYieldTons);
  });
});
