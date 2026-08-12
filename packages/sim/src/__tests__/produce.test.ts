import {
  DEALER_SELL_MARKUP,
  FEED_GRAZING_RATIO,
  GOOD_DEFS,
  HUNGER,
  MARKET_BOUNDS,
  SELLABLE_GOODS,
  dealerAskPrice,
  feedBurn,
  feedUnits,
  happinessTarget,
  hungerPenalty,
  meatYield,
  milkYield,
  rationQuality,
  type TradeGood,
} from "@farmsim/shared";

const CYCLE = 15 * 60 * 1000;

describe("marchandises", () => {
  it("donne des bornes de cours à chaque marchandise échangée", () => {
    for (const code of Object.keys(GOOD_DEFS) as TradeGood[]) {
      expect(MARKET_BOUNDS[code]).toBeDefined();
      expect(MARKET_BOUNDS[code].min).toBeLessThan(MARKET_BOUNDS[code].max);
    }
  });

  it("compte le lait en hectolitres et le reste en tonnes", () => {
    expect(GOOD_DEFS.MILK.unit).toBe("hL");
    expect(GOOD_DEFS.WHEAT.unit).toBe("t");
  });

  it("ne rend vendable que ce qui se produit", () => {
    expect(SELLABLE_GOODS).toContain("MILK");
    expect(SELLABLE_GOODS).toContain("MEAT");
  });

  it("ne laisse acheter que le fourrage au négociant", () => {
    const achetables = (Object.keys(GOOD_DEFS) as TradeGood[]).filter(
      (g) => GOOD_DEFS[g].purchasable,
    );
    expect(achetables).toEqual(["HAY"]);
  });

  it("fait vendre le négociant plus cher qu'il ne rachète", () => {
    expect(DEALER_SELL_MARKUP).toBeGreaterThan(1);
    expect(dealerAskPrice(100)).toBeGreaterThan(100);
  });
});

describe("rations", () => {
  it("compte le maïs comme un concentré", () => {
    expect(feedUnits(0, 1)).toBeGreaterThan(feedUnits(1, 0));
  });

  it("convertit les tonnes du silo en kilos de ration", () => {
    // Une tonne de foin doit nourrir un troupeau plusieurs cycles, pas une
    // fraction de bête : les deux échelles ne doivent jamais se confondre.
    expect(feedUnits(1, 0)).toBe(1000);
    const cyclesPourUneBete = feedUnits(1, 0) / HUNGER.unitsPerAnimalPerCycle;
    expect(cyclesPourUneBete).toBeGreaterThan(50);
  });

  it("mesure la qualité de la ration par la part de maïs", () => {
    expect(rationQuality(10, 0)).toBe(0);
    expect(rationQuality(0, 10)).toBe(1);
    expect(rationQuality(5, 5)).toBeCloseTo(0.5, 2);
  });

  it("renvoie une qualité nulle sur une ration vide", () => {
    expect(rationQuality(0, 0)).toBe(0);
  });
});

describe("faim", () => {
  const troupeau = { herdSize: 10 };

  it("n'inflige rien à un troupeau rassasié", () => {
    const plein = HUNGER.unitsPerAnimalPerCycle * 10;
    expect(hungerPenalty({ ...troupeau, feedStock: plein })).toBeCloseTo(0, 3);
  });

  it("inflige la pénalité maximale à réserve vide", () => {
    expect(hungerPenalty({ ...troupeau, feedStock: 0 })).toBeCloseTo(HUNGER.penaltyMax, 3);
  });

  it("s'aggrave à mesure que la réserve baisse", () => {
    const plein = HUNGER.unitsPerAnimalPerCycle * 10;
    const moitie = hungerPenalty({ ...troupeau, feedStock: plein / 2 });
    const vide = hungerPenalty({ ...troupeau, feedStock: 0 });
    expect(moitie).toBeGreaterThan(0);
    expect(moitie).toBeLessThan(vide);
  });

  it("peut pousser le bien-être sous le plancher de l'enfermement", () => {
    // C'est le seul levier, avec le surpeuplement, qui rende un élevage
    // réellement maltraitant : oublier de nourrir doit coûter cher.
    const nourri = happinessTarget({ hasPaddock: false, grazedRecentlyMs: 1e12, crowding: 0 });
    const affame = happinessTarget({
      hasPaddock: false,
      grazedRecentlyMs: 1e12,
      crowding: 0,
      hunger: HUNGER.penaltyMax,
    });
    expect(affame).toBeLessThan(nourri);
  });

  it("consomme moins quand les bêtes sont au pré", () => {
    const enferme = feedBurn({ herdSize: 10, elapsedMs: CYCLE, cycleMs: CYCLE, grazing: false });
    const auPre = feedBurn({ herdSize: 10, elapsedMs: CYCLE, cycleMs: CYCLE, grazing: true });
    expect(auPre).toBeCloseTo(enferme * FEED_GRAZING_RATIO, 3);
  });

  it("consomme proportionnellement au temps écoulé", () => {
    const un = feedBurn({ herdSize: 5, elapsedMs: CYCLE, cycleMs: CYCLE, grazing: false });
    const deux = feedBurn({ herdSize: 5, elapsedMs: CYCLE * 2, cycleMs: CYCLE, grazing: false });
    expect(deux).toBeCloseTo(un * 2, 3);
  });

  it("ne consomme rien sur une durée nulle", () => {
    expect(feedBurn({ herdSize: 10, elapsedMs: 0, cycleMs: CYCLE, grazing: false })).toBe(0);
  });
});

describe("production récoltable", () => {
  it("fait produire davantage une ration riche", () => {
    const base = { herdSize: 10, happiness: 0.6, barnLevel: 1 };
    expect(milkYield({ ...base, feedQuality: 1 })).toBeGreaterThan(
      milkYield({ ...base, feedQuality: 0 }),
    );
  });

  it("ne produit rien sans bête", () => {
    expect(milkYield({ herdSize: 0, happiness: 1, barnLevel: 5, feedQuality: 1 })).toBe(0);
    expect(meatYield({ herdSize: 0, happiness: 1, averageAgeMs: 1e12, barnLevel: 5 })).toBe(0);
  });

  it("fait grossir la viande avec l'âge, jusqu'à un plateau", () => {
    const base = { herdSize: 4, happiness: 0.6, barnLevel: 1 };
    const jeune = meatYield({ ...base, averageAgeMs: CYCLE * 2 });
    const adulte = meatYield({ ...base, averageAgeMs: CYCLE * 30 });
    const vieux = meatYield({ ...base, averageAgeMs: CYCLE * 300 });
    expect(adulte).toBeGreaterThan(jeune);
    expect(vieux).toBeCloseTo(adulte, 0);
  });
});
