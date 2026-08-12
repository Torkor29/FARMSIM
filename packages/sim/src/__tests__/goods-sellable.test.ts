import {
  GOOD_DEFS,
  MARKET_BOUNDS,
  SELLABLE_GOODS,
  quoteAllChannels,
  type TradeGood,
} from "@farmsim/shared";

/**
 * Ces tests verrouillent une régression coûteuse : le lait et la viande
 * étaient produits normalement mais aucun endpoint marchand ne les acceptait,
 * si bien qu'ils s'empilaient au silo sans débouché.
 */
describe("tout ce qui se produit doit pouvoir se vendre", () => {
  const PRODUITS: TradeGood[] = ["WHEAT", "MAIZE", "MILK", "MEAT"];

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
  });
});
