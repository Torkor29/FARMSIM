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

export type TradeGood =
  | "WHEAT"
  | "MAIZE"
  | "PEA"
  | "BARLEY"
  | "RAPE"
  | "MILK"
  | "MEAT"
  | "HAY"
  | "EGGS"
  | "WOOL"
  | "MANURE"
  | "STRAW"
  | "STRAW_BALE"
  | "SILAGE";

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
   * Reste sur la ferme, se vend au voisin : pas un cours mondial.
   * Le négociant n'en fait pas commerce. L'ensilage et la paille suivent la
   * même règle — sinon le pont céréalier–éleveur meurt.
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
  BARLEY: {
    code: "BARLEY",
    name: "Orge",
    unit: "t",
    basePrice: 195,
    sellable: true,
    purchasable: false,
    perishable: false,
  },
  RAPE: {
    code: "RAPE",
    name: "Colza",
    unit: "t",
    basePrice: 340,
    sellable: true,
    purchasable: false,
    perishable: false,
  },
  EGGS: {
    code: "EGGS",
    name: "Œufs",
    unit: "caisse",
    basePrice: 22,
    sellable: true,
    purchasable: false,
    perishable: true,
  },
  WOOL: {
    code: "WOOL",
    name: "Laine",
    unit: "t",
    basePrice: 420,
    sellable: true,
    purchasable: false,
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
  /**
   * Bottes de paille.
   *
   * Distinctes de la paille en vrac, et pas seulement pour le décor : le vrac
   * est ce que laisse la moissonneuse, la botte est ce qu'on peut charger,
   * empiler et revendre. C'est la presse qui fait passer de l'un à l'autre,
   * et ce travail-là se paie — d'où un prix à la tonne plus élevé.
   *
   * L'unité est la **botte**, pas la tonne : c'est ainsi qu'on en parle au
   * champ comme au marché. `BALE_TONS` fait la conversion partout où le
   * tonnage compte (litière, fourrage).
   */
  STRAW_BALE: {
    code: "STRAW_BALE",
    name: "Bottes de paille",
    unit: "bottes",
    basePrice: 32,
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
  MANURE: {
    code: "MANURE",
    name: "Fumier",
    unit: "t",
    basePrice: 55,
    sellable: true,
    // Le céréalier doit pouvoir en acheter : c'est la moitié retour du pont
    // entre les deux métiers. `purchasable: false` fermait la boucle — le
    // fumier d'un éleveur ne pouvait fertiliser que ses propres champs, et un
    // céréalier n'avait aucun moyen de s'en procurer, alors que l'engrais est
    // une de ses grosses dépenses.
    purchasable: true,
    perishable: false,
    // Reste local : on ne fait pas traverser le monde à un tas de fumier, et
    // le prix est un prix de voisin, pas un cours mondial.
    localOnly: true,
  },
};

/** Icône pour l’hôtel des ventes — un dessin, pas un code machine. */
/**
 * Le dessin de chaque marchandise.
 *
 * C'étaient des emoji, et trois d'entre eux n'étaient même pas des objets :
 * 🟢 pour le pois, 🟤 pour le fumier, 🟨 pour la paille — des **carrés de
 * couleur**, dans un jeu qui dessine ses tracteurs, ses bâtiments et ses
 * bêtes.
 *
 * Pire pour qui joue : le blé et l'orge portaient tous deux 🌾. Ils étaient
 * donc indiscernables dans la liste de stock, c'est-à-dire précisément là où
 * l'on compare ce que l'on possède avant de vendre.
 *
 * Ce sont maintenant des chemins vers des dessins de la même famille que les
 * outils et la navigation. L'orge se reconnaît à ses barbes, la paille à ses
 * ficelles, l'ensilage à son enrubannage vert face à la balle de foin dorée.
 */
export const GOOD_ICONS: Record<TradeGood, string> = {
  WHEAT: "/assets/icons/goods/wheat.svg",
  BARLEY: "/assets/icons/goods/barley.svg",
  MAIZE: "/assets/icons/goods/maize.svg",
  RAPE: "/assets/icons/goods/rape.svg",
  PEA: "/assets/icons/goods/pea.svg",
  HAY: "/assets/icons/goods/hay.svg",
  MILK: "/assets/icons/goods/milk.svg",
  MEAT: "/assets/icons/goods/meat.svg",
  EGGS: "/assets/icons/goods/eggs.svg",
  WOOL: "/assets/icons/goods/wool.svg",
  MANURE: "/assets/icons/goods/manure.svg",
  STRAW: "/assets/icons/goods/straw.svg",
  STRAW_BALE: "/assets/icons/goods/straw-bale.svg",
  SILAGE: "/assets/icons/goods/silage.svg",
};

/** Marchandises à cours mondial — le fumier s'écoule au voisin, pas ici. */
export const SELLABLE_GOODS = (Object.keys(GOOD_DEFS) as TradeGood[]).filter(
  (g) => GOOD_DEFS[g].sellable && !GOOD_DEFS[g].localOnly,
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
  BARLEY: 1.2,
  WHEAT: 1.1,
  SILAGE: 1.6,
};

/**
 * Qualité de ration : 0 = que du foin, 1 = que du concentré.
 *
 * L'ensilage arrive **en cinquième position** et non en troisième : l'orge et
 * le blé occupaient déjà les places 3 et 4, et les intervertir aurait fait
 * passer silencieusement de l'orge pour de l'ensilage chez tous les appelants.
 */
export function rationQuality(
  hayTons: number,
  maizeTons: number,
  barleyTons = 0,
  wheatTons = 0,
  silageTons = 0,
): number {
  const concentrate = maizeTons + barleyTons + wheatTons + silageTons;
  const total = hayTons + concentrate;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, concentrate / total));
}

/**
 * Valeur nutritive d'une distribution, **en kilogrammes équivalent fourrage**.
 *
 * Le stock se compte en tonnes, les besoins d'une bête en kilos par cycle :
 * confondre les deux échelles rendrait une tonne de foin dérisoire alors
 * qu'elle nourrit un troupeau plusieurs jours.
 */
export function feedUnits(
  hayTons: number,
  maizeTons: number,
  barleyTons = 0,
  wheatTons = 0,
  silageTons = 0,
): number {
  return (
    (hayTons * (FEED_VALUE.HAY ?? 1) +
      maizeTons * (FEED_VALUE.MAIZE ?? 1) +
      barleyTons * (FEED_VALUE.BARLEY ?? 1.2) +
      wheatTons * (FEED_VALUE.WHEAT ?? 1.1) +
      silageTons * (FEED_VALUE.SILAGE ?? 1.6)) *
    1000
  );
}
