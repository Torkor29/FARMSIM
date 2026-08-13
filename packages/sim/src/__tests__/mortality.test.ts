import {
  LIVESTOCK_CYCLE_MS,
  MEAT_MATURITY_MS,
  MORTALITY,
  PURCHASED_AGE_MS,
  blendedAgeMs,
  meatYield,
  mortalityToll,
} from "@farmsim/shared";

const CYCLE = LIVESTOCK_CYCLE_MS;

describe("mortalité d'un troupeau négligé", () => {
  it("épargne un troupeau au-dessus du seuil, si mal en point soit-il", () => {
    const r = mortalityToll({
      happiness: MORTALITY.floor + 0.01,
      herdSize: 20,
      elapsedMs: CYCLE * 50,
      cycleMs: CYCLE,
      debt: 0,
    });
    expect(r.deaths).toBe(0);
  });

  it("fait payer la famine, mais lentement", () => {
    const un = mortalityToll({
      happiness: 0,
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
      debt: 0,
    });
    // Six pour cent d'un lot de dix, soit moins d'une bête : la dette porte le
    // reste jusqu'au cycle suivant.
    expect(un.deaths).toBe(0);
    expect(un.debt).toBeCloseTo(0.6, 5);

    const deux = mortalityToll({
      happiness: 0,
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
      debt: un.debt,
    });
    expect(deux.deaths).toBe(1);
  });

  it("finit par emporter un petit lot, que la dette rendait immortel", () => {
    let size = 3;
    let debt = 0;
    let cycles = 0;
    while (size > 0 && cycles < 500) {
      const r = mortalityToll({ happiness: 0, herdSize: size, elapsedMs: CYCLE, cycleMs: CYCLE, debt });
      size -= r.deaths;
      debt = r.debt;
      cycles += 1;
    }
    expect(size).toBe(0);
    // Assez lent pour qu'on puisse rentrer et réagir.
    expect(cycles).toBeGreaterThan(10);
  });

  it("ne tue jamais plus de bêtes qu'il n'y en a", () => {
    const r = mortalityToll({
      happiness: 0,
      herdSize: 2,
      elapsedMs: CYCLE * 1000,
      cycleMs: CYCLE,
      debt: 0,
    });
    expect(r.deaths).toBeLessThanOrEqual(2);
  });

  it("efface la dette quand le troupeau va mieux", () => {
    const r = mortalityToll({
      happiness: 0.8,
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
      debt: 0.9,
    });
    expect(r.debt).toBeLessThan(0.9);
    expect(r.deaths).toBe(0);
  });
});

describe("âge moyen du lot", () => {
  it("se dilue à la naissance : un veau ne vaut pas un adulte", () => {
    const adulte = MEAT_MATURITY_MS;
    const apres = blendedAgeMs({ herdSize: 3, averageAgeMs: adulte, added: 1, addedAgeMs: 0 });
    expect(apres).toBeCloseTo((adulte * 3) / 4, 5);
    expect(apres).toBeLessThan(adulte);
  });

  it("se déplace vers l'âge des bêtes achetées", () => {
    const apres = blendedAgeMs({
      herdSize: 0,
      averageAgeMs: 0,
      added: 4,
      addedAgeMs: PURCHASED_AGE_MS,
    });
    expect(apres).toBeCloseTo(PURCHASED_AGE_MS, 5);
  });

  it("ne bouge pas sans arrivée", () => {
    expect(blendedAgeMs({ herdSize: 5, averageAgeMs: 1234, added: 0, addedAgeMs: 0 })).toBe(1234);
  });

  it("fait vraiment baisser le rendement en viande", () => {
    const base = { herdSize: 4, happiness: 0.7, barnLevel: 1 };
    const adultes = meatYield({ ...base, averageAgeMs: MEAT_MATURITY_MS });
    const dilue = meatYield({
      ...base,
      averageAgeMs: blendedAgeMs({
        herdSize: 3,
        averageAgeMs: MEAT_MATURITY_MS,
        added: 1,
        addedAgeMs: 0,
      }),
    });
    expect(dilue).toBeLessThan(adultes);
  });

  it("on achète du bétail élevé, pas des nouveau-nés", () => {
    expect(PURCHASED_AGE_MS).toBeGreaterThan(0);
    expect(PURCHASED_AGE_MS).toBeLessThan(MEAT_MATURITY_MS);
  });
});
