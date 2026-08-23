/**
 * Écouler sa récolte : trois canaux, trois compromis.
 *
 * Un jeu d'économie n'a d'intérêt que si vendre est une décision. Un seul
 * bouton « vendre » au cours du jour n'en est pas une. Le joueur arbitre donc
 * entre trois débouchés, du plus sûr au plus rémunérateur :
 *
 * 1. **Le négociant** rachète tout, tout de suite, à un prix volontairement
 *    bas. C'est le plancher : on ne se retrouve jamais avec un silo plein et
 *    zéro €.
 * 2. **Le cours mondial** paie le prix du jour, mais écouler un gros volume
 *    fait plonger ce prix — vendre en une fois coûte cher.
 * 3. **La criée** laisse fixer son prix et attendre un acheteur. Meilleur
 *    rendement possible, mais frais de dépôt non remboursés et aucune
 *    garantie de vente.
 *
 * @see docs/research/42_TRADE.md
 */

import type { TradeGood } from "./goods.js";

export type SaleChannel = "DEALER" | "MARKET" | "LISTING";

/**
 * Les trois débouchés, nommés par **qui achète**.
 *
 * « Vendre à tout prix » ne disait pas à qui ni pourquoi c'était moins cher :
 * on cliquait, on encaissait 40 % de moins, et on cherchait la panne. Deux des
 * trois canaux sont des PNJ — le négociant qui passe à la ferme, et le cours
 * mondial —, le troisième est la vitrine entre joueurs. Le dire est le
 * minimum : c'est de là que vient tout l'écart de prix.
 */
export const SALE_CHANNEL_LABELS: Record<SaleChannel, string> = {
  DEALER: "Vendre au négociant",
  MARKET: "Vendre au cours",
  LISTING: "Proposer aux joueurs",
};

/* ------------------------------------------------------------------ */
/* 1. Le négociant — le plancher                                       */
/* ------------------------------------------------------------------ */

/**
 * Part du cours que le négociant consent `[GD]`.
 *
 * 60 % doit rester franchement décevant : c'est un filet de sécurité, pas une
 * stratégie. Plus haut, personne ne prendrait la peine de suivre le marché.
 */
export const DEALER_RATIO = 0.6;

/** Le négociant refuse les lots ridicules : il se déplace `[GD]` */
export const DEALER_MIN_TONS = 0.05;

export const SALE_CHANNEL_HINTS: Record<SaleChannel, string> = {
  DEALER: `Un marchand PNJ passe prendre le lot tout de suite, à ${Math.round(
    DEALER_RATIO * 100,
  )} % du cours. Filet de sécurité, jamais le bon prix.`,
  MARKET: "Le cours mondial du jour, encaissé aussitôt. Un gros lot le fait baisser.",
  LISTING: "Vous fixez le prix, mais il faut qu'un autre joueur l'achète.",
};

export function dealerPricePerTon(marketPrice: number): number {
  return Math.round(marketPrice * DEALER_RATIO * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* 2. Le cours mondial — l'impact du volume                            */
/* ------------------------------------------------------------------ */

/** Impact maximal d'une vente unique sur le cours `[GD]` */
export const MAX_SLIPPAGE = 0.35;

/**
 * Décote de volume : écouler `tons` sur un marché qui en stocke `stockTons`
 * fait baisser le prix obtenu. La racine carrée adoucit la courbe — une
 * petite vente ne coûte presque rien, une vente massive fait mal.
 */
export function volumeSlippage(tons: number, stockTons: number): number {
  const depth = Math.max(1, stockTons);
  const raw = Math.sqrt(Math.max(0, tons) / depth) * 0.9;
  return Math.min(MAX_SLIPPAGE, raw);
}

/** Prix moyen réellement obtenu au cours mondial, décote de volume comprise. */
export function marketPricePerTon(
  marketPrice: number,
  tons: number,
  stockTons: number,
): number {
  return Math.round(marketPrice * (1 - volumeSlippage(tons, stockTons)) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* 3. La criée — vendre à d'autres joueurs                             */
/* ------------------------------------------------------------------ */

/** Frais de dépôt, en fraction du montant demandé `[GD]` — jamais remboursés */
export const LISTING_FEE_RATE = 0.02;

/** Commission prélevée à la vente `[GD]` */
export const LISTING_COMMISSION_RATE = 0.05;

/** Durée de vie d'une annonce `[GD]` — une saison */
export const LISTING_TTL_MS = 15 * 60 * 1000;

/** Après l’achat à la criée : quelqu’un doit encore livrer. */
export const DELIVERY_TTL_MS = 8 * 60 * 1000;

/** Frais « faire livrer » : le voisin auto, plus cher que de le faire soi-même. */
export function deliveryAutoFee(tons: number): number {
  return Math.max(8, Math.round(Math.max(0, tons) * 4));
}

/**
 * Trajet du tracteur + remorque sur la parcelle d’arrivée.
 * On entre par le bord opposé au silo / hangar, on roule jusqu’à lui.
 */
export function deliveryHaulPath(
  gridW: number,
  gridH: number,
  dest?: { x: number; y: number } | null,
): { x: number; y: number }[] {
  const w = Math.max(1, Math.floor(gridW));
  const h = Math.max(1, Math.floor(gridH));
  const destX = dest
    ? Math.min(w - 1, Math.max(0, dest.x))
    : Math.floor(w / 2);
  const destY = dest
    ? Math.min(h - 1, Math.max(0, dest.y))
    : Math.floor(h / 2);
  const fromLeft = destX >= w / 2;
  const startX = fromLeft ? 0 : w - 1;
  const step = fromLeft ? 1 : -1;
  const cells: { x: number; y: number }[] = [];
  for (let x = startX; step > 0 ? x <= destX : x >= destX; x += step) {
    cells.push({ x, y: destY });
  }
  if (cells.length < 2) {
    const y = Math.floor(h / 2);
    return Array.from({ length: w }, (_, x) => ({ x, y }));
  }
  return cells;
}

/** Bornes du prix demandé, en multiples du cours `[GD]` */
export const LISTING_PRICE_MIN_RATIO = 0.3;
export const LISTING_PRICE_MAX_RATIO = 2.5;

/** Annonces ouvertes simultanément par joueur `[GD]` */
export const MAX_OPEN_LISTINGS = 6;

/** Frais à régler au dépôt d'une annonce. */
export function listingFee(pricePerTon: number, tons: number): number {
  return Math.max(1, Math.round(pricePerTon * tons * LISTING_FEE_RATE));
}

/** Ce que le vendeur touche réellement quand l'annonce trouve preneur. */
export function listingProceeds(pricePerTon: number, tons: number): number {
  const gross = pricePerTon * tons;
  return Math.round(gross * (1 - LISTING_COMMISSION_RATE));
}

export type ListingRefusal =
  | "PRICE_TOO_LOW"
  | "PRICE_TOO_HIGH"
  | "TOO_MANY_LISTINGS"
  | "NOT_ENOUGH_STOCK"
  | "CANNOT_AFFORD_FEE";

export const LISTING_REFUSAL_LABELS: Record<ListingRefusal, string> = {
  PRICE_TOO_LOW: "Prix trop bas — le négociant paie mieux",
  PRICE_TOO_HIGH: "Prix irréaliste : personne n’achètera",
  TOO_MANY_LISTINGS: `Vous avez déjà ${MAX_OPEN_LISTINGS} annonces en cours`,
  NOT_ENOUGH_STOCK: "Stock insuffisant",
  CANNOT_AFFORD_FEE: "€ insuffisants pour les frais de dépôt",
};

export function canList(input: {
  pricePerTon: number;
  tons: number;
  marketPrice: number;
  openListings: number;
  stockTons: number;
  crd: number;
}): { ok: boolean; reason?: ListingRefusal } {
  if (input.tons <= 0 || input.stockTons < input.tons) {
    return { ok: false, reason: "NOT_ENOUGH_STOCK" };
  }
  if (input.openListings >= MAX_OPEN_LISTINGS) {
    return { ok: false, reason: "TOO_MANY_LISTINGS" };
  }
  if (input.pricePerTon < input.marketPrice * LISTING_PRICE_MIN_RATIO) {
    return { ok: false, reason: "PRICE_TOO_LOW" };
  }
  if (input.pricePerTon > input.marketPrice * LISTING_PRICE_MAX_RATIO) {
    return { ok: false, reason: "PRICE_TOO_HIGH" };
  }
  if (input.crd < listingFee(input.pricePerTon, input.tons)) {
    return { ok: false, reason: "CANNOT_AFFORD_FEE" };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Acheteurs PNJ — pour que la criée fonctionne dès le premier joueur  */
/* ------------------------------------------------------------------ */

/**
 * Une criée déserte est une criée inutile.
 *
 * Tant que la population est faible, un lot déposé n'a aucune chance de
 * trouver preneur : le canal le plus rémunérateur des trois serait mort-né.
 * Des courtiers passent donc régulièrement et raflent ce qui est raisonnable,
 * sans jamais dépasser ce qu'un marchand accepterait de payer.
 */
export const NPC_BUYER = {
  /** Un lot doit avoir vécu ce délai avant qu'un courtier s'y intéresse `[GD]` */
  minAgeMs: 90 * 1000,
  /** Au-delà de ce multiple du cours, aucun courtier ne mord `[GD]` */
  maxPriceRatio: 1.18,
  /** Probabilité qu'un courtier passe, par tick et par lot éligible `[TEST]` */
  chancePerTick: 0.35,
} as const;

/**
 * Un courtier achèterait-il ce lot ?
 *
 * Le prix décide seul de l'appétit : plus le vendeur est gourmand, plus il
 * attendra. Un lot au prix du marché part vite, un lot à +40 % n'intéresse
 * personne et finira par expirer.
 */
export function npcWouldBuy(input: {
  pricePerTon: number;
  marketPrice: number;
  ageMs: number;
  roll: number;
}): boolean {
  if (input.ageMs < NPC_BUYER.minAgeMs) return false;
  const ratio = input.pricePerTon / Math.max(1, input.marketPrice);
  if (ratio > NPC_BUYER.maxPriceRatio) return false;
  // Un lot bradé part presque à coup sûr, un lot au plafond se fait désirer.
  const eagerness = clamp01((NPC_BUYER.maxPriceRatio - ratio) / 0.4);
  return input.roll < NPC_BUYER.chancePerTick * (0.35 + eagerness * 0.65);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/* ------------------------------------------------------------------ */
/* Comparaison des trois canaux                                        */
/* ------------------------------------------------------------------ */

export type ChannelQuote = {
  channel: SaleChannel;
  pricePerTon: number;
  /** Montant net encaissé, frais et décotes compris */
  net: number;
  /** Vrai si l'encaissement est garanti et immédiat */
  guaranteed: boolean;
  note: string;
};

/**
 * Les trois offres côte à côte, pour que l'arbitrage se lise d'un coup d'œil
 * plutôt que de se deviner.
 */
export function quoteAllChannels(input: {
  commodity: TradeGood;
  tons: number;
  marketPrice: number;
  stockTons: number;
  /** Malus d'humidité déjà calculé, 0 à 1 */
  moisturePenalty: number;
  /** Prix demandé si le joueur passait par la criée */
  askPricePerTon?: number;
}): ChannelQuote[] {
  const keep = 1 - Math.max(0, Math.min(1, input.moisturePenalty));
  const dealer = dealerPricePerTon(input.marketPrice) * keep;
  const market = marketPricePerTon(input.marketPrice, input.tons, input.stockTons) * keep;
  const ask = (input.askPricePerTon ?? input.marketPrice * 1.15) * keep;

  return [
    {
      channel: "DEALER",
      pricePerTon: Math.round(dealer * 100) / 100,
      net: Math.round(dealer * input.tons),
      guaranteed: true,
      note: SALE_CHANNEL_HINTS.DEALER,
    },
    {
      channel: "MARKET",
      pricePerTon: Math.round(market * 100) / 100,
      net: Math.round(market * input.tons),
      guaranteed: true,
      note:
        volumeSlippage(input.tons, input.stockTons) > 0.05
          ? `Décote de volume : −${Math.round(volumeSlippage(input.tons, input.stockTons) * 100)} %`
          : SALE_CHANNEL_HINTS.MARKET,
    },
    {
      channel: "LISTING",
      pricePerTon: Math.round(ask * 100) / 100,
      net: listingProceeds(ask, input.tons) - listingFee(ask, input.tons),
      guaranteed: false,
      note: `Frais ${listingFee(ask, input.tons)} € · commission ${Math.round(LISTING_COMMISSION_RATE * 100)} %`,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Vendre « tout »                                                     */
/* ------------------------------------------------------------------ */

/**
 * Écart toléré entre la quantité demandée et le stock réellement présent.
 *
 * Un joueur qui demande à vendre la totalité de son silo se voyait refuser la
 * vente pour quelques grammes, et devait redescendre le curseur à tâtons
 * jusqu'à ce que ça passe. Deux causes s'additionnaient.
 *
 * L'affichage travaille au centième de tonne quand le stock en compte trois :
 * arrondir au plus proche pour proposer « tout » dépassait le stock une fois
 * sur deux. Et le lait comme la viande se dégradent à chaque tick du serveur,
 * si bien que le stock connu du client est déjà périmé au moment du clic —
 * pour une denrée périssable, demander la totalité était voué à l'échec.
 *
 * On vend donc ce qui est là. Un négociant ne refuse pas le chargement parce
 * qu'il pèse trois kilos de moins que l'annonce. Au-delà de la tolérance, en
 * revanche, la demande n'est plus un écart d'arrondi mais une erreur, et elle
 * reste refusée.
 */
export const SALE_TOLERANCE_RATIO = 0.02;
export const SALE_TOLERANCE_TONS = 0.02;

/**
 * Tonnage à réellement débiter, ou `null` si la demande dépasse franchement le
 * stock. Le résultat ne dépasse jamais `available`.
 */
export function settleSaleTons(requested: number, available: number): number | null {
  if (requested <= 0 || available <= 0) return null;
  if (requested <= available) return requested;
  const slack = Math.max(SALE_TOLERANCE_TONS, available * SALE_TOLERANCE_RATIO);
  return requested <= available + slack ? available : null;
}

/**
 * Plus grande quantité que le joueur puisse choisir sur un curseur au pas
 * donné. Tronque au lieu d'arrondir : proposer une valeur inatteignable, puis
 * la refuser à la vente, est le plus sûr moyen de passer pour cassé.
 */
export function maxSelectableTons(available: number, step = 0.01): number {
  const steps = Math.floor(available / step + 1e-9);
  return Math.max(0, Math.round(steps * step * 1000) / 1000);
}
