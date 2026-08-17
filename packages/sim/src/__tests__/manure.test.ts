import {
  GOOD_DEFS,
  MANURE_LOCAL_PRICE,
  MANURE_PER_ANIMAL,
  MANURE_PER_CELL,
  MANURE_PIT_CYCLES,
  MANURE_SMELL_START,
  SELLABLE_GOODS,
  addManureToPit,
  manureFill,
  manureNeededForCells,
  manurePitCapacity,
  manureProduced,
  manureSaleProceeds,
  manureSmellPenalty,
} from "@farmsim/shared";

const CYCLE = 15 * 60 * 1000;

describe("fumier — production et fosse", () => {
  it("fait plus de fumier aux vaches qu'aux poules", () => {
    expect(MANURE_PER_ANIMAL.COW).toBeGreaterThan(MANURE_PER_ANIMAL.SHEEP);
    expect(MANURE_PER_ANIMAL.SHEEP).toBeGreaterThan(MANURE_PER_ANIMAL.HEN);
    const vaches = manureProduced({
      kind: "COW",
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
    });
    const poules = manureProduced({
      kind: "HEN",
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
    });
    expect(vaches).toBeCloseTo(0.25, 5);
    expect(poules).toBeLessThan(vaches);
  });

  it("tient environ cinq cycles d'un bâtiment plein", () => {
    const cap = manurePitCapacity("COW", 12);
    const cycle = manureProduced({
      kind: "COW",
      herdSize: 12,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
    });
    expect(cap).toBeCloseTo(cycle * MANURE_PIT_CYCLES, 5);
  });

  it("refuse le trop-plein : la fosse bloque", () => {
    const cap = 1;
    const pit = addManureToPit({ current: 0.9, produced: 0.3, capacity: cap });
    expect(pit.tons).toBe(1);
    expect(pit.wasted).toBeCloseTo(0.2, 5);
  });

  it("sent à partir de 80 %, pas avant", () => {
    expect(manureSmellPenalty(0.5)).toBe(0);
    expect(manureSmellPenalty(MANURE_SMELL_START)).toBe(0);
    expect(manureSmellPenalty(1)).toBeGreaterThan(0);
    expect(manureFill(0.4, 1)).toBeCloseTo(0.4, 5);
  });
});

describe("fumier — épandage et vente", () => {
  it("compte 0,04 t par case", () => {
    expect(manureNeededForCells(10)).toBeCloseTo(10 * MANURE_PER_CELL, 5);
  });

  it("paie le voisin au prix local, pas un cours mondial", () => {
    expect(manureSaleProceeds(2)).toBe(2 * MANURE_LOCAL_PRICE);
    expect(GOOD_DEFS.MANURE.localOnly).toBe(true);
    // Il ne part pas à la bourse mondiale : un tas de fumier ne traverse pas
    // le monde, et son prix reste un prix de voisin.
    expect(SELLABLE_GOODS).not.toContain("MANURE");
  });

  it("est désormais achetable — c'est le retour du pont vers le céréalier", () => {
    // Ce fichier affirmait l'inverse, et c'était la moitié manquante du
    // triangle des métiers. `manure.ts` s'ouvre pourtant sur « le pont retour
    // de l'éleveur vers le céréalier » : avec `purchasable: false`, il n'y
    // avait aucun pont. Le fumier ne pouvait fertiliser que les champs de
    // celui qui l'avait produit, c'est-à-dire l'éleveur, qui n'en a pas
    // l'usage — et le céréalier, qui en a besoin, ne pouvait pas en acheter.
    expect(GOOD_DEFS.MANURE.purchasable).toBe(true);
  });
});
