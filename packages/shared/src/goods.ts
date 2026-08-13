/**
 * Ce qui se stocke, se vend et se donne à manger.
 *
 * Le jeu ne produisait que du grain. Avec l'élevage viennent le lait, la
 * viande et le fourrage — ce dernier étant la première marchandise que le
 * joueur **achète** au lieu de la vendre, ce qui referme la boucle
 * économique : cultiver pour nourrir, nourrir pour produire, produire pour
 * vendre.
 *
 * @see docs/research/43_LIVESTOCK_PRODUCE.md
 */

export type TradeGood = "WHEAT" | "MAIZE" | "PEA" | "MILK" | "MEAT" | "HAY" | "STRAW" | "SILAGE";

export type GoodDef = {
  code: TradeGood;
  name: string;
  /** Unité affichée : les tonnes pour le solide, les hectolitres pour le lait */
  unit: string;
  /** Prix de référence, autour duquel le marché oscille `[GD]` */
  basePrice: number;
  /** Le joueur peut-il en vendre ? */
  sellable: boolean;
  /** Le négociant en vend-il ? */
  purchasable: boolean;
  /** Se dégrade-t-il ? Le lait ne se garde pas comme du blé. */
  perishable: boolean;
  /**
   * Pas de carnet mondial profond : l’ensilage se vend au voisin ou se
   * donne au troupeau, sinon le pont céréalier–éleveur meurt.
   */
  localOnly?: boolean;
};

export const GOOD_DEFS: Record<TradeGood, GoodDef> = {
  WHEAT: {
    code: "WHEAT",
    name: "Blé",
    unit: "t",
    basePrice: 220,
    sellable: true,
    purchasable: false,
    perishable: false,
  },
  MAIZE: {
    code: "MAIZE",
    name: "Maïs",
    unit: "t",
    basePrice: 200,
    sellable: true,
    purchasable: false,
    perishable: false,
  },
  MILK: {
    code: "MILK",
    name: "Lait",
    unit: "hL",
    // Un hectolitre se vend bien moins qu'une tonne de grain, mais la traite
    // revient à chaque cycle : c'est un revenu régulier, pas un pic.
    basePrice: 42,
    sellable: true,
    purchasable: false,
    perishable: true,
  },
  MEAT: {
    code: "MEAT",
    name: "Viande",
    unit: "t",
    basePrice: 1450,
    sellable: true,
    purchasable: false,
    perishable: true,
  },
  PEA: {
    code: "PEA",
    name: "Pois",
    unit: "t",
    // Une protéine se paie mieux qu'une céréale, ce qui compense en partie un
    // rendement à l'hectare plus faible.
    basePrice: 285,
    sellable: true,
    purchasable: false,
    perishable: false,
  },
  HAY: {
    code: "HAY",
    name: "Fourrage",
    unit: "t",
    basePrice: 95,
    sellable: true,
    purchasable: true,
    perishable: false,
  },
  STRAW: {
    code: "STRAW",
    name: "Paille",
    unit: "t",
    basePrice: 72,
    sellable: true,
    purchasable: true,
    perishable: false,
  },
  SILAGE: {
    code: "SILAGE",
    name: "Ensilage",
    unit: "t",
    basePrice: 110,
    sellable: true,
    purchasable: false,
    perishable: false,
    localOnly: true,
  },
};

export const SELLABLE_GOODS = (Object.keys(GOOD_DEFS) as TradeGood[]).filter(
  (g) => GOOD_DEFS[g].sellable,
);

export const PURCHASABLE_GOODS = (Object.keys(GOOD_DEFS) as TradeGood[]).filter(
  (g) => GOOD_DEFS[g].purchasable,
);

/** Marchandises à terme / carnet mondial — pas l’ensilage. */
export const WORLD_MARKET_GOODS = SELLABLE_GOODS.filter((g) => !GOOD_DEFS[g].localOnly);

/** Marge du négociant à l'achat : il vend plus cher qu'il ne rachète `[GD]` */
export const DEALER_SELL_MARKUP = 1.25;

/** Prix auquel le négociant cède un intrant. */
export function dealerAskPrice(marketPrice: number): number {
  return Math.round(marketPrice * DEALER_SELL_MARKUP * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Rations                                                             */
/* ------------------------------------------------------------------ */

/**
 * Valeur nutritive relative d'un aliment `[GD]`.
 *
 * Le fourrage est l'aliment de base. Le maïs vaut mieux — c'est un
 * concentré — mais c'est du maïs qu'on ne vend pas : la ration premium se
 * paie en manque à gagner.
 */
export const FEED_VALUE: Partial<Record<TradeGood, number>> = {
  HAY: 1,
  MAIZE: 1.4,
  SILAGE: 1.6,
};

/** Qualité de ration obtenue, 0 = strictement du fourrage, 1 = concentré / ensilage. */
export function rationQuality(hayTons: number, maizeTons: number, silageTons = 0): number {
  const total = hayTons + maizeTons + silageTons;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (maizeTons + silageTons) / total));
}

/**
 * Valeur nutritive d'une distribution, **en kilogrammes équivalent fourrage**.
 *
 * Le stock se compte en tonnes, les besoins d'une bête en kilos par cycle :
 * confondre les deux échelles rendrait une tonne de foin dérisoire alors
 * qu'elle nourrit un troupeau plusieurs jours.
 */
export function feedUnits(hayTons: number, maizeTons: number, silageTons = 0): number {
  return (
    (hayTons * (FEED_VALUE.HAY ?? 1) +
      maizeTons * (FEED_VALUE.MAIZE ?? 1) +
      silageTons * (FEED_VALUE.SILAGE ?? 1.6)) *
    1000
  );
}
