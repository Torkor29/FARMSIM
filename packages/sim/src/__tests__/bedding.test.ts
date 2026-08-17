import {
  BEDDING_MANURE_BONUS,
  BEDDING_PENALTY_MAX,
  BEDDING_PER_ANIMAL,
  MANURE_PER_ANIMAL,
  beddingBurn,
  beddingCapacity,
  beddingCover,
  beddingManureMultiplier,
  beddingNeed,
  beddingPenalty,
  happinessTarget,
  manureProduced,
  type AnimalKind,
} from "@farmsim/shared";

const CYCLE = 6 * 60 * 60 * 1000;

/**
 * La litière : le pont aller du céréalier vers l'éleveur.
 *
 * `forage.ts` annonçait depuis toujours que « la paille est le pont céréalier
 * ↔ éleveur (litière) ». La paille était produite, pressable, vendable — et
 * **rien ne la consommait**. Ces tests tiennent la mécanique qui manquait, et
 * surtout son effet en retour : pailler ne se contente pas d'éviter une
 * pénalité, cela produit plus de fumier. C'est ce qui rend le geste rentable
 * plutôt que subi, et c'est ce qui referme la boucle sur le céréalier.
 */
describe("litière", () => {
  it("demande de la paille pour chaque espèce", () => {
    for (const espèce of ["COW", "PIG", "SHEEP", "HEN"] as AnimalKind[]) {
      expect(BEDDING_PER_ANIMAL[espèce]).toBeGreaterThan(0);
    }
  });

  it("en demande plus pour une vache que pour une poule", () => {
    expect(BEDDING_PER_ANIMAL.COW).toBeGreaterThan(BEDDING_PER_ANIMAL.SHEEP);
    expect(BEDDING_PER_ANIMAL.SHEEP).toBeGreaterThan(BEDDING_PER_ANIMAL.HEN);
  });

  it("consomme proportionnellement à l’effectif et au temps", () => {
    const un = beddingBurn({ kind: "COW", herdSize: 10, elapsedMs: CYCLE, cycleMs: CYCLE });
    const deux = beddingBurn({ kind: "COW", herdSize: 20, elapsedMs: CYCLE, cycleMs: CYCLE });
    const double = beddingBurn({ kind: "COW", herdSize: 10, elapsedMs: 2 * CYCLE, cycleMs: CYCLE });
    expect(deux).toBeCloseTo(un * 2, 5);
    expect(double).toBeCloseTo(un * 2, 5);
  });

  it("en économise quand les bêtes sont au pré", () => {
    const dedans = beddingBurn({ kind: "COW", herdSize: 12, elapsedMs: CYCLE, cycleMs: CYCLE });
    const dehors = beddingBurn({
      kind: "COW",
      herdSize: 12,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
      grazing: true,
    });
    expect(dehors).toBeLessThan(dedans);
    // La sortie au pré est déjà la mécanique centrale de l'élevage : elle doit
    // récompenser deux fois, sur le bonheur et sur la paille.
    expect(dehors).toBeCloseTo(dedans / 2, 5);
  });

  it("ne consomme rien pour un bâtiment vide", () => {
    expect(beddingBurn({ kind: "COW", herdSize: 0, elapsedMs: CYCLE, cycleMs: CYCLE })).toBe(0);
    expect(beddingNeed("COW", 0)).toBe(0);
  });

  it("stocke de quoi tenir plusieurs cycles sans repasser", () => {
    const besoin = beddingNeed("COW", 12);
    expect(beddingCapacity("COW", 12)).toBeGreaterThan(besoin);
  });
});

describe("couverture et pénalité", () => {
  it("est totale quand la réserve couvre le besoin d’un cycle", () => {
    const besoin = beddingNeed("COW", 12);
    expect(beddingCover({ kind: "COW", herdSize: 12, stockTons: besoin })).toBe(1);
    expect(beddingPenalty(1)).toBe(0);
  });

  it("est nulle sans paille, et pénalise au maximum", () => {
    expect(beddingCover({ kind: "COW", herdSize: 12, stockTons: 0 })).toBe(0);
    expect(beddingPenalty(0)).toBeCloseTo(BEDDING_PENALTY_MAX, 5);
  });

  it("se dégrade linéairement, sans marche d’escalier", () => {
    const moitié = beddingNeed("COW", 12) / 2;
    const c = beddingCover({ kind: "COW", herdSize: 12, stockTons: moitié });
    expect(c).toBeCloseTo(0.5, 5);
    expect(beddingPenalty(c)).toBeCloseTo(BEDDING_PENALTY_MAX / 2, 5);
  });

  it("considère un bâtiment vide comme couvert : rien à pailler", () => {
    expect(beddingCover({ kind: "COW", herdSize: 0, stockTons: 0 })).toBe(1);
  });

  it("pèse moins lourd que la faim — le béton n’est pas la famine", () => {
    // La faim peut pousser le bonheur sous le plancher ; la litière, non.
    const àJeun = happinessTarget({
      hasPaddock: true,
      grazedRecentlyMs: 0,
      crowding: 0.5,
      hunger: 0.45,
    });
    const surBéton = happinessTarget({
      hasPaddock: true,
      grazedRecentlyMs: 0,
      crowding: 0.5,
      bedding: beddingPenalty(0),
    });
    expect(surBéton).toBeGreaterThan(àJeun);
  });

  it("s’ajoute aux autres peines sans les remplacer", () => {
    const base = { hasPaddock: true, grazedRecentlyMs: 0, crowding: 0.5 };
    const propre = happinessTarget(base);
    const sale = happinessTarget({ ...base, bedding: beddingPenalty(0) });
    expect(propre - sale).toBeCloseTo(BEDDING_PENALTY_MAX, 5);
  });
});

describe("le retour vers le céréalier", () => {
  it("fait produire plus de fumier quand la litière est faite", () => {
    const brut = manureProduced({ kind: "COW", herdSize: 12, elapsedMs: CYCLE, cycleMs: CYCLE });
    const paillé = brut * beddingManureMultiplier(1);
    expect(paillé).toBeCloseTo(brut * (1 + BEDDING_MANURE_BONUS), 5);
  });

  it("ne change rien sans paille", () => {
    expect(beddingManureMultiplier(0)).toBe(1);
  });

  it("rend le paillage rentable, et non punitif", () => {
    // Le geste doit rapporter, pas seulement éviter une perte : sans quoi
    // l'éleveur pailler à contrecœur et le pont ne tient pas.
    expect(beddingManureMultiplier(1)).toBeGreaterThan(1);
  });

  it("garde le fumier produit du même ordre que la paille consommée", () => {
    // Une vache paillée ne doit pas fabriquer dix fois son poids de paille en
    // fumier : la boucle serait une machine à imprimer de la fertilité.
    const paille = beddingBurn({ kind: "COW", herdSize: 20, elapsedMs: CYCLE, cycleMs: CYCLE });
    const fumier =
      manureProduced({ kind: "COW", herdSize: 20, elapsedMs: CYCLE, cycleMs: CYCLE }) *
      beddingManureMultiplier(1);
    expect(fumier).toBeGreaterThan(paille);
    expect(fumier).toBeLessThan(paille * 3);
  });

  it("garde les deux barèmes cohérents entre espèces", () => {
    for (const espèce of ["COW", "PIG", "SHEEP", "HEN"] as AnimalKind[]) {
      expect(BEDDING_PER_ANIMAL[espèce]).toBeLessThan(MANURE_PER_ANIMAL[espèce] * 3);
    }
  });
});
