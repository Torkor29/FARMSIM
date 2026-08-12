import {
  BREEDING,
  SPOILAGE_PER_CYCLE,
  afterSpoilage,
  canBreed,
  gestationProgress,
  halfLifeCycles,
  isPerishable,
  litterFor,
  spoilageWarning,
  type TradeGood,
} from "@farmsim/shared";

const CYCLE = 15 * 60 * 1000;

const SAIN = {
  kind: "COW" as const,
  size: 6,
  happiness: 0.8,
  feedRatio: 1,
  freeSlots: 6,
  gestatingSince: null,
};

describe("reproduction", () => {
  it("accepte un troupeau bien mené", () => {
    expect(canBreed(SAIN).ok).toBe(true);
  });

  it("refuse une bête seule", () => {
    const v = canBreed({ ...SAIN, size: 1 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("TOO_SMALL");
  });

  it("refuse un troupeau stressé", () => {
    const v = canBreed({ ...SAIN, happiness: BREEDING.minHappiness - 0.05 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("UNHAPPY");
  });

  it("refuse un troupeau sous-alimenté", () => {
    const v = canBreed({ ...SAIN, feedRatio: 0.1 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("UNDERFED");
  });

  it("refuse un bâtiment plein : on ne fait pas naître à l'étroit", () => {
    const v = canBreed({ ...SAIN, freeSlots: 0 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("NO_ROOM");
  });

  it("ne démarre pas deux gestations à la fois", () => {
    const v = canBreed({ ...SAIN, gestatingSince: 1000 });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("GESTATING");
  });

  it("fait progresser la gestation jusqu'à terme", () => {
    const base = { kind: "COW" as const, gestatingSince: 0, cycleMs: CYCLE };
    expect(gestationProgress({ ...base, now: 0 })).toBe(0);
    const total = BREEDING.gestationCycles.COW * CYCLE;
    expect(gestationProgress({ ...base, now: total / 2 })).toBeCloseTo(0.5, 2);
    expect(gestationProgress({ ...base, now: total })).toBe(1);
    expect(gestationProgress({ ...base, now: total * 3 })).toBe(1);
  });

  it("rend zéro quand aucune gestation n'est en cours", () => {
    expect(
      gestationProgress({ kind: "COW", gestatingSince: null, now: 1e9, cycleMs: CYCLE }),
    ).toBe(0);
  });

  it("fait porter la truie plus vite que la vache", () => {
    expect(BREEDING.gestationCycles.PIG).toBeLessThan(BREEDING.gestationCycles.COW);
  });

  it("donne une portée au porc et un veau à la vache", () => {
    expect(litterFor("PIG", 10)).toBeGreaterThan(litterFor("COW", 10));
    expect(litterFor("COW", 10)).toBe(1);
  });

  it("plafonne la portée par la place restante", () => {
    expect(litterFor("PIG", 2)).toBe(2);
    expect(litterFor("PIG", 0)).toBe(0);
  });
});

describe("péremption", () => {
  it("ne dégrade que ce qui est périssable", () => {
    expect(isPerishable("MILK")).toBe(true);
    expect(isPerishable("MEAT")).toBe(true);
    expect(isPerishable("WHEAT")).toBe(false);
    expect(isPerishable("HAY")).toBe(false);
  });

  it("laisse le grain intact quel que soit le temps", () => {
    expect(
      afterSpoilage({ good: "WHEAT", qty: 10, elapsedMs: CYCLE * 100, cycleMs: CYCLE }),
    ).toBe(10);
  });

  it("retire la part annoncée sur un cycle", () => {
    const reste = afterSpoilage({ good: "MILK", qty: 100, elapsedMs: CYCLE, cycleMs: CYCLE });
    expect(reste).toBeCloseTo(100 * (1 - SPOILAGE_PER_CYCLE.MILK!), 1);
  });

  it("donne le même résultat quel que soit le découpage des ticks", () => {
    // La décroissance est exponentielle : deux demi-cycles valent un cycle.
    const enUneFois = afterSpoilage({
      good: "MILK",
      qty: 100,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
    });
    let pasAPas = 100;
    for (let i = 0; i < 4; i++) {
      pasAPas = afterSpoilage({
        good: "MILK",
        qty: pasAPas,
        elapsedMs: CYCLE / 4,
        cycleMs: CYCLE,
      });
    }
    expect(pasAPas).toBeCloseTo(enUneFois, 1);
  });

  it("ne descend jamais sous zéro", () => {
    expect(
      afterSpoilage({ good: "MILK", qty: 5, elapsedMs: CYCLE * 1000, cycleMs: CYCLE }),
    ).toBe(0);
  });

  it("dégrade le lait plus vite que la viande", () => {
    const lait = afterSpoilage({ good: "MILK", qty: 100, elapsedMs: CYCLE, cycleMs: CYCLE });
    const viande = afterSpoilage({ good: "MEAT", qty: 100, elapsedMs: CYCLE, cycleMs: CYCLE });
    expect(lait).toBeLessThan(viande);
  });

  it("calcule une demi-vie cohérente", () => {
    const h = halfLifeCycles("MILK")!;
    expect(h).toBeGreaterThan(1);
    const reste = afterSpoilage({
      good: "MILK",
      qty: 100,
      elapsedMs: CYCLE * h,
      cycleMs: CYCLE,
    });
    expect(reste).toBeCloseTo(50, 0);
  });

  it("n'alerte que sur les denrées fragiles", () => {
    expect(spoilageWarning("MILK", 3)).toContain("%");
    expect(spoilageWarning("WHEAT", 3)).toBeNull();
    expect(spoilageWarning("MILK", 0)).toBeNull();
  });

  it("rend la vente rapide payante face à la criée", () => {
    // Un lot de lait laissé une saison entière perd assez pour que le prix
    // bas du négociant, encaissé tout de suite, redevienne défendable.
    const apresUneSaison = afterSpoilage({
      good: "MILK",
      qty: 100,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
    });
    expect(apresUneSaison / 100).toBeLessThan(0.92);
  });
});

describe("cohérence des denrées périssables", () => {
  it("dégrade exactement ce que le catalogue déclare périssable", () => {
    const declares: TradeGood[] = ["MILK", "MEAT"];
    for (const g of declares) expect(SPOILAGE_PER_CYCLE[g]).toBeGreaterThan(0);
  });
});
