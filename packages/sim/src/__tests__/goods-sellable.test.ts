import {
  GOOD_DEFS,
  MARKET_BOUNDS,
  SELLABLE_GOODS,
  PURCHASABLE_GOODS,
  DEALER_INPUT_USE,
  quoteAllChannels,
  type TradeGood,
} from "@farmsim/shared";

/**
 * Ces tests verrouillent une régression coûteuse : le lait et la viande
 * étaient produits normalement mais aucun endpoint marchand ne les acceptait,
 * si bien qu'ils s'empilaient au silo sans débouché.
 */
describe("tout ce qui se produit doit pouvoir se vendre", () => {
  const PRODUITS: TradeGood[] = [
    "WHEAT",
    "MAIZE",
    "PEA",
    "BARLEY",
    "RAPE",
    "MILK",
    "MEAT",
    "EGGS",
    "WOOL",
  ];

  it("déclare vendable chaque marchandise que la ferme produit", () => {
    for (const code of PRODUITS) {
      expect(GOOD_DEFS[code].sellable).toBe(true);
      expect(SELLABLE_GOODS).toContain(code);
    }
  });

  it("cote chaque marchandise vendable", () => {
    for (const code of SELLABLE_GOODS) {
      expect(MARKET_BOUNDS[code]).toBeDefined();
    }
  });

  it("propose les trois canaux pour chaque marchandise vendable", () => {
    for (const code of SELLABLE_GOODS) {
      const quotes = quoteAllChannels({
        commodity: code,
        tons: 2,
        marketPrice: MARKET_BOUNDS[code].initial,
        stockTons: 1000,
        moisturePenalty: 0,
      });
      expect(quotes).toHaveLength(3);
      for (const q of quotes) {
        expect(q.pricePerTon).toBeGreaterThan(0);
        expect(Number.isFinite(q.net)).toBe(true);
      }
    }
  });

  it("n'accepte à l'achat que ce qui est un intrant", () => {
    for (const code of PRODUITS) {
      expect(GOOD_DEFS[code].purchasable).toBe(false);
    }
    expect(GOOD_DEFS.HAY.purchasable).toBe(true);
    expect(GOOD_DEFS.STRAW.purchasable).toBe(true);
    expect(GOOD_DEFS.SILAGE.purchasable).toBe(false);
    expect(GOOD_DEFS.SILAGE.localOnly).toBe(true);
  });
});

/**
 * Le rayon du négociant.
 *
 * Un testeur a signalé « on ne peut pas acheter de paille, que du fourrage » :
 * quatre marchandises étaient achetables côté serveur, une seule était offerte
 * à l'écran. Et celle-là s'appelait « Fourrage » — un mot de catégorie, pas un
 * produit —, d'où la question qui suivait : « c'est quoi du fourrage ? ».
 */
describe("le rayon du négociant", () => {
  it("vend bien les quatre intrants, dont la paille", () => {
    expect([...PURCHASABLE_GOODS].sort()).toEqual(
      ["HAY", "MANURE", "STRAW", "STRAW_BALE"].sort(),
    );
  });

  it("dit à quoi sert chaque article qu'il propose", () => {
    for (const g of PURCHASABLE_GOODS) {
      // Sans cette phrase, le rayon n'affiche qu'un nom : c'est exactement ce
      // qui a rendu « Fourrage » incompréhensible.
      expect(`${g} ${(DEALER_INPUT_USE[g] ?? "").length > 20}`).toBe(`${g} true`);
    }
  });

  it("ne nomme aucun produit du nom de sa catégorie", () => {
    // « Fourrage » désigne le foin, l'ensilage, le maïs, l'orge et le blé à la
    // fois : personne ne peut deviner lequel se trouve dans le sac.
    for (const g of Object.keys(GOOD_DEFS) as TradeGood[]) {
      expect(`${g} ${GOOD_DEFS[g].name}`).not.toBe(`${g} Fourrage`);
    }
  });
});
