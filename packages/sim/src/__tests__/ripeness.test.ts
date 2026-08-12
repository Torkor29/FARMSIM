import {
  CROP_DEFS,
  PLOW_COST_PER_CELL,
  RIPENESS_LABELS,
  RIPENESS_WINDOW,
  RIPENESS_YIELD,
  ripenessAt,
} from "@farmsim/shared";
import { simulateCell } from "../index";

const GROW = 60_000;
const READY_AT = 1_000_000;

/** Instant situé à `over` fois le temps de croissance après la maturité. */
function at(over: number): number {
  return READY_AT + over * GROW;
}

describe("fenêtre de récolte — paliers", () => {
  it("rend le plein rendement juste après la maturité", () => {
    const r = ripenessAt(READY_AT, GROW, READY_AT);
    expect(r.stage).toBe("PEAK");
    expect(r.yieldFactor).toBe(1);
    expect(r.needsPlowing).toBe(false);
  });

  it("tient le plein rendement jusqu’à la fin du pic", () => {
    const r = ripenessAt(READY_AT, GROW, at(RIPENESS_WINDOW.peakEnd - 0.01));
    expect(r.stage).toBe("PEAK");
    expect(r.yieldFactor).toBe(1);
  });

  it("enchaîne les quatre paliers dans l’ordre", () => {
    expect(ripenessAt(READY_AT, GROW, at(0.2)).stage).toBe("PEAK");
    expect(ripenessAt(READY_AT, GROW, at(1)).stage).toBe("DECLINING");
    expect(ripenessAt(READY_AT, GROW, at(2)).stage).toBe("POOR");
    expect(ripenessAt(READY_AT, GROW, at(3)).stage).toBe("LOST");
  });

  it("décroît de façon strictement monotone", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let over = 0; over <= 3; over += 0.1) {
      const y = ripenessAt(READY_AT, GROW, at(over)).yieldFactor;
      expect(y).toBeLessThanOrEqual(previous + 1e-9);
      previous = y;
    }
  });

  it("atteint les rendements annoncés aux bornes de palier", () => {
    expect(ripenessAt(READY_AT, GROW, at(RIPENESS_WINDOW.decliningEnd)).yieldFactor).toBeCloseTo(
      RIPENESS_YIELD.declining,
      2,
    );
    expect(ripenessAt(READY_AT, GROW, at(RIPENESS_WINDOW.poorEnd - 0.001)).yieldFactor).toBeCloseTo(
      RIPENESS_YIELD.poor,
      2,
    );
  });

  it("ne rend plus rien une fois la culture perdue", () => {
    const r = ripenessAt(READY_AT, GROW, at(5));
    expect(r.yieldFactor).toBe(0);
    expect(r.needsPlowing).toBe(true);
    expect(r.msToNextStage).toBeNull();
    expect(r.msToLoss).toBe(0);
  });

  it("annonce un compte à rebours décroissant jusqu’à la perte", () => {
    const tot = ripenessAt(READY_AT, GROW, at(0)).msToLoss;
    const mid = ripenessAt(READY_AT, GROW, at(1.5)).msToLoss;
    expect(tot).toBeCloseTo(RIPENESS_WINDOW.poorEnd * GROW, 0);
    expect(mid).toBeLessThan(tot);
    expect(mid).toBeGreaterThan(0);
  });

  it("donne un libellé lisible à chaque palier", () => {
    for (const over of [0, 1, 2, 3]) {
      const r = ripenessAt(READY_AT, GROW, at(over));
      expect(r.label).toBe(RIPENESS_LABELS[r.stage]);
      expect(r.label.length).toBeGreaterThan(0);
    }
  });

  it("met à l’échelle la fenêtre selon la vitesse de la culture", () => {
    // Une culture deux fois plus lente tolère une négligence deux fois plus
    // longue : la fenêtre est relative, jamais un nombre de minutes fixe.
    const retard = 0.8 * GROW;
    const lente = ripenessAt(READY_AT, GROW * 2, READY_AT + retard);
    const rapide = ripenessAt(READY_AT, GROW, READY_AT + retard);
    expect(lente.stage).toBe("PEAK");
    expect(rapide.stage).toBe("DECLINING");
  });

  it("traite une durée de croissance nulle sans exploser", () => {
    const r = ripenessAt(READY_AT, 0, READY_AT + 10_000);
    expect(Number.isFinite(r.yieldFactor)).toBe(true);
    expect(r.stage).toBe("LOST");
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
    const finPic = simulateCell({ ...base, now: growMs * 1.4 });
    expect(pic.estimatedYieldTons).toBeGreaterThan(0);
    expect(finPic.estimatedYieldTons).toBeCloseTo(pic.estimatedYieldTons, 3);
  });

  it("ampute le rendement d’une récolte tardive", () => {
    const aTemps = simulateCell({ ...base, now: growMs });
    const tardif = simulateCell({ ...base, now: growMs * 3 });
    expect(tardif.estimatedYieldTons).toBeLessThan(aTemps.estimatedYieldTons * 0.7);
    expect(tardif.ripeness?.stage).toBe("POOR");
  });

  it("ramène le rendement à zéro et exige le labour", () => {
    const perdu = simulateCell({ ...base, now: growMs * 4 });
    expect(perdu.ready).toBe(true);
    expect(perdu.estimatedYieldTons).toBe(0);
    expect(perdu.lost).toBe(true);
    expect(perdu.ripeness?.needsPlowing).toBe(true);
  });

  it("n’efface pas le mérite d’une bonne conduite de culture", () => {
    // La sur-maturité est un multiplicateur, pas un plafond : à retard égal,
    // une parcelle bien menée reste meilleure qu'une parcelle négligée.
    const soignee = simulateCell({ ...base, now: growMs * 2 });
    const negligee = simulateCell({
      ...base,
      fertility: 0.3,
      fertilizedPasses: 0,
      weedsControlled: false,
      now: growMs * 2,
    });
    expect(soignee.estimatedYieldTons).toBeGreaterThan(negligee.estimatedYieldTons);
  });
});

describe("labour", () => {
  it("coûte moins cher qu’un semis", () => {
    expect(PLOW_COST_PER_CELL).toBeLessThan(CROP_DEFS.WHEAT.seedCostPerCell);
    expect(PLOW_COST_PER_CELL).toBeGreaterThan(0);
  });
});
