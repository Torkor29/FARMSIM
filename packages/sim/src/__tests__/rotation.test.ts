import {
  BREAK_CROP_BONUS,
  NO_ROTATION,
  ROTATION_MALUS,
  nextRotation,
  rotationFactor,
  rotationWarning,
  rotationSummary,
  type RotationState,
} from "@farmsim/shared";
import { simulateCell } from "../index.js";

describe("rotation des cultures", () => {
  it("ne pénalise pas une terre sans précédent", () => {
    expect(rotationFactor(NO_ROTATION, "WHEAT")).toBe(1);
    expect(rotationWarning(NO_ROTATION, "WHEAT")).toBeNull();
  });

  it("pénalise le blé sur blé, davantage au troisième cycle", () => {
    const first: RotationState = { lastCrop: "WHEAT", cropStreak: 1 };
    const second: RotationState = { lastCrop: "WHEAT", cropStreak: 2 };
    expect(rotationFactor(first, "WHEAT")).toBeCloseTo(1 - ROTATION_MALUS[1]);
    expect(rotationFactor(second, "WHEAT")).toBeCloseTo(1 - ROTATION_MALUS[2]);
    expect(rotationFactor(second, "WHEAT")).toBeLessThan(rotationFactor(first, "WHEAT"));
  });

  it("récompense la culture de rupture", () => {
    const afterWheat: RotationState = { lastCrop: "WHEAT", cropStreak: 2 };
    expect(rotationFactor(afterWheat, "MAIZE")).toBeCloseTo(1 + BREAK_CROP_BONUS);
  });

  it("plafonne le malus au lieu de le laisser filer", () => {
    const long: RotationState = { lastCrop: "WHEAT", cropStreak: 12 };
    expect(rotationFactor(long, "WHEAT")).toBeCloseTo(
      1 - ROTATION_MALUS[ROTATION_MALUS.length - 1],
    );
    expect(rotationFactor(long, "WHEAT")).toBeGreaterThan(0);
  });

  it("compte les cycles consécutifs et repart à un au changement", () => {
    let state = nextRotation(NO_ROTATION, "WHEAT");
    expect(state).toEqual({ lastCrop: "WHEAT", cropStreak: 1 });
    state = nextRotation(state, "WHEAT");
    expect(state.cropStreak).toBe(2);
    state = nextRotation(state, "MAIZE");
    expect(state).toEqual({ lastCrop: "MAIZE", cropStreak: 1 });
  });

  it("avertit le joueur avant qu'il ne sème, en annonçant le coût", () => {
    const warn = rotationWarning({ lastCrop: "WHEAT", cropStreak: 1 }, "WHEAT");
    expect(warn).toContain("15 %");
    expect(rotationWarning({ lastCrop: "WHEAT", cropStreak: 1 }, "MAIZE")).toBeNull();
  });

  it("résume l'état pour l'affichage", () => {
    expect(rotationSummary(NO_ROTATION)).toBe("Aucun précédent");
    expect(rotationSummary({ lastCrop: "WHEAT", cropStreak: 3 })).toContain("× 3");
  });

  it("fait vraiment baisser le rendement simulé", () => {
    const base = {
      crop: "WHEAT" as const,
      plantedAt: 0,
      // Pile à maturité : au-delà, la sur-maturité écrase tout et masquerait
      // l'effet mesuré ici.
      now: 3 * 60 * 1000,
      fertility: 0.7,
      weedsControlled: true,
      fertilizedPasses: 1 as const,
    };
    const fresh = simulateCell(base);
    const repeated = simulateCell({ ...base, rotation: { lastCrop: "WHEAT", cropStreak: 1 } });
    const broken = simulateCell({ ...base, rotation: { lastCrop: "MAIZE", cropStreak: 1 } });

    expect(repeated.estimatedYieldTons).toBeLessThan(fresh.estimatedYieldTons);
    expect(broken.estimatedYieldTons).toBeGreaterThan(fresh.estimatedYieldTons);
    // Le malus doit se sentir, sans rendre la case stérile.
    expect(repeated.estimatedYieldTons).toBeGreaterThan(fresh.estimatedYieldTons * 0.7);
  });
});
