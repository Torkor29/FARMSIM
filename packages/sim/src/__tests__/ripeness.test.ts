import {
  CROP_DEFS,
  HARVEST_XP_MIN_YIELD,
  PLOW_COST_PER_CELL,
  RIPENESS_LABELS,
  RIPENESS_MS,
  RIPENESS_YIELD,
  harvestGivesXp,
  ripenessAt,
} from "@farmsim/shared";
import { simulateCell } from "../index";

const READY_AT = 1_000_000;

/** Instant situé `ms` après la maturité. */
function atMs(ms: number): number {
  return READY_AT + ms;
}

describe("fenêtre de récolte — paliers d'horloge", () => {
  it("rend le plein rendement juste après la maturité", () => {
    const r = ripenessAt(READY_AT, 1, READY_AT);
    expect(r.stage).toBe("PEAK");
    expect(r.yieldFactor).toBe(1);
    expect(r.needsPlowing).toBe(false);
  });

  it("tient 100 % pendant les trente premières minutes", () => {
    const r = ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to90 - 1));
    expect(r.stage).toBe("PEAK");
    expect(r.yieldFactor).toBe(1);
  });

  it("passe à 90 %, 80 %, 70 %, 60 %, 50 % puis 10 %", () => {
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to90)).yieldFactor).toBe(RIPENESS_YIELD.y90);
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to80)).yieldFactor).toBe(RIPENESS_YIELD.y80);
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to70)).yieldFactor).toBe(RIPENESS_YIELD.y70);
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to60)).yieldFactor).toBe(RIPENESS_YIELD.y60);
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to50)).yieldFactor).toBe(RIPENESS_YIELD.y50);
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to50 + 3 * 60 * 60_000)).yieldFactor).toBe(
      RIPENESS_YIELD.y50,
    );
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to10)).yieldFactor).toBe(RIPENESS_YIELD.floor);
    expect(ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to10 * 3)).yieldFactor).toBe(RIPENESS_YIELD.floor);
  });

  it("bloque à 50 % jusqu'aux 24 h, puis à 10 % pour de bon", () => {
    const mid = ripenessAt(READY_AT, 1, atMs(12 * 60 * 60_000));
    expect(mid.yieldFactor).toBe(RIPENESS_YIELD.y50);
    const late = ripenessAt(READY_AT, 1, atMs(48 * 60 * 60_000));
    expect(late.yieldFactor).toBe(RIPENESS_YIELD.floor);
    expect(late.needsPlowing).toBe(false);
    expect(late.msToNextStage).toBeNull();
  });

  it("décroît de façon monotone", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const ms of [
      0,
      RIPENESS_MS.to90,
      RIPENESS_MS.to80,
      RIPENESS_MS.to70,
      RIPENESS_MS.to60,
      RIPENESS_MS.to50,
      RIPENESS_MS.to10,
    ]) {
      const y = ripenessAt(READY_AT, 1, atMs(ms)).yieldFactor;
      expect(y).toBeLessThanOrEqual(previous + 1e-9);
      previous = y;
    }
  });

  it("n'exige plus le labour : on peut encore récolter à 10 %", () => {
    const r = ripenessAt(READY_AT, 1, atMs(RIPENESS_MS.to10 + 1));
    expect(r.needsPlowing).toBe(false);
    expect(r.yieldFactor).toBe(RIPENESS_YIELD.floor);
  });

  it("donne un libellé lisible à chaque palier", () => {
    for (const ms of [0, RIPENESS_MS.to80, RIPENESS_MS.to60, RIPENESS_MS.to10]) {
      const r = ripenessAt(READY_AT, 1, atMs(ms));
      expect(r.label).toBe(RIPENESS_LABELS[r.stage]);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });

  it("ignore la vitesse de croissance : c'est une horloge réelle", () => {
    const lente = ripenessAt(READY_AT, 10 * 60_000, atMs(RIPENESS_MS.to90));
    const rapide = ripenessAt(READY_AT, 1_000, atMs(RIPENESS_MS.to90));
    expect(lente.yieldFactor).toBe(rapide.yieldFactor);
    expect(lente.yieldFactor).toBe(RIPENESS_YIELD.y90);
  });
});

describe("XP de moisson selon le rendement", () => {
  it("paie encore à 70 %, plus en dessous", () => {
    expect(HARVEST_XP_MIN_YIELD).toBe(0.7);
    expect(harvestGivesXp(1)).toBe(true);
    expect(harvestGivesXp(0.7)).toBe(true);
    expect(harvestGivesXp(0.69)).toBe(false);
    expect(harvestGivesXp(0.1)).toBe(false);
  });
});

describe("fenêtre de récolte — effet sur la simulation", () => {
  const base = {
    crop: "WHEAT" as const,
    plantedAt: 0,
    fertility: 0.8,
    weedsControlled: true,
    fertilizedPasses: 2 as const,
  };
  const growMs = CROP_DEFS.WHEAT.growMs;

  it("ne signale aucune maturité tant que la culture pousse", () => {
    const sim = simulateCell({ ...base, now: growMs / 2 });
    expect(sim.ready).toBe(false);
    expect(sim.ripeness).toBeNull();
    expect(sim.lost).toBe(false);
  });

  it("conserve le rendement plein dans la fenêtre de pic", () => {
    const pic = simulateCell({ ...base, now: growMs });
    const finPic = simulateCell({ ...base, now: growMs + RIPENESS_MS.to90 / 2 });
    expect(pic.estimatedYieldTons).toBeGreaterThan(0);
    expect(finPic.estimatedYieldTons).toBeCloseTo(pic.estimatedYieldTons, 3);
  });

  it("ampute le rendement d'une récolte tardive", () => {
    const aTemps = simulateCell({ ...base, now: growMs });
    const tardif = simulateCell({ ...base, now: growMs + RIPENESS_MS.to60 });
    expect(tardif.estimatedYieldTons).toBeCloseTo(aTemps.estimatedYieldTons * 0.6, 3);
    expect(tardif.ripeness?.stage).toBe("POOR");
  });

  it("laisse 10 % après 24 h, sans forcer le labour", () => {
    const aTemps = simulateCell({ ...base, now: growMs });
    const oubliee = simulateCell({ ...base, now: growMs + RIPENESS_MS.to10 });
    expect(oubliee.ready).toBe(true);
    expect(oubliee.estimatedYieldTons).toBeCloseTo(aTemps.estimatedYieldTons * 0.1, 3);
    expect(oubliee.lost).toBe(false);
    expect(oubliee.ripeness?.needsPlowing).toBe(false);
  });

  it("n'efface pas le mérite d'une bonne conduite de culture", () => {
    const soignee = simulateCell({ ...base, now: growMs + RIPENESS_MS.to80 });
    const negligee = simulateCell({
      ...base,
      fertility: 0.3,
      fertilizedPasses: 0,
      weedsControlled: false,
      now: growMs + RIPENESS_MS.to80,
    });
    expect(soignee.estimatedYieldTons).toBeGreaterThan(negligee.estimatedYieldTons);
  });
});

describe("labour", () => {
  it("coûte moins cher qu'un semis", () => {
    expect(PLOW_COST_PER_CELL).toBeLessThan(CROP_DEFS.WHEAT.seedCostPerCell);
    expect(PLOW_COST_PER_CELL).toBeGreaterThan(0);
  });
});
