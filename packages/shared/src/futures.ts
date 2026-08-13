/**
 * Contrats à terme.
 *
 * Vendre au comptant, c'est subir le cours du jour. Un joueur qui voyait le
 * blé haut n'avait aucun moyen de le retenir : il vendait tout de suite, ou il
 * pariait à l'aveugle. Le terme lui permet d'engager une récolte à venir à un
 * prix fixé aujourd'hui.
 *
 * C'est un vrai choix, pas une facilité. On échange le potentiel de hausse
 * contre la certitude, et l'engagement se paie s'il n'est pas tenu : livrer
 * hors délai coûte une pénalité, calculée sur ce que l'acheteur devra racheter
 * au marché à votre place.
 *
 * @see docs/research/47_FUTURES.md
 */

import type { TradeGood } from "./goods.js";

/** Échéances proposées, en heures réelles `[GD]` */
export const FUTURES_HORIZONS_H = [1, 3, 6] as const;
export type FuturesHorizonH = (typeof FUTURES_HORIZONS_H)[number];

/**
 * Décote appliquée au cours du jour selon l'échéance `[GD]`.
 *
 * L'acheteur prend le risque à votre place : il le facture. Plus l'échéance
 * est lointaine, plus l'incertitude est grande, plus la décote mord — sans
 * quoi le terme serait toujours préférable au comptant et personne ne vendrait
 * plus jamais sur le marché.
 */
export const FUTURES_DISCOUNT: Record<FuturesHorizonH, number> = {
  1: 0.02,
  3: 0.045,
  6: 0.075,
};

/** Volume minimum d'un engagement, en tonnes `[GD]` */
export const FUTURES_MIN_TONS = 1;

/** Engagements ouverts simultanément `[GD]` */
export const MAX_OPEN_FUTURES = 4;

/**
 * Pénalité pour un contrat non honoré, en part de sa valeur `[GD]`.
 *
 * Elle doit dépasser la décote la plus large : sinon, s'engager puis laisser
 * filer deviendrait une façon rentable d'emprunter, et le contrat perdrait
 * toute portée.
 */
export const FUTURES_PENALTY_RATE = 0.2;

/** Prix garanti à l'échéance, à partir du cours du jour. */
export function futuresPrice(marketPrice: number, horizonH: FuturesHorizonH): number {
  return Math.round(marketPrice * (1 - FUTURES_DISCOUNT[horizonH]) * 100) / 100;
}

/** Montant encaissé si le contrat est honoré. */
export function futuresProceeds(pricePerTon: number, tons: number): number {
  return Math.round(pricePerTon * tons);
}

/** Montant retenu si l'échéance passe sans livraison. */
export function futuresPenalty(pricePerTon: number, tons: number): number {
  return Math.round(pricePerTon * tons * FUTURES_PENALTY_RATE);
}

export type FuturesRefusal =
  | "TOO_SMALL"
  | "TOO_MANY_OPEN"
  | "NOT_TRADED"
  | "EXPIRED_HORIZON";

export const FUTURES_REFUSAL_LABELS: Record<FuturesRefusal, string> = {
  TOO_SMALL: `Engagement trop petit — ${FUTURES_MIN_TONS} t minimum`,
  TOO_MANY_OPEN: `Déjà ${MAX_OPEN_FUTURES} engagements en cours`,
  NOT_TRADED: "Cette marchandise ne se négocie pas à terme",
  EXPIRED_HORIZON: "Échéance inconnue",
};

/**
 * Peut-on s'engager ?
 *
 * On ne vérifie pas le stock : c'est tout l'intérêt du terme, on vend une
 * récolte qu'on n'a pas encore. Le stock ne sera exigé qu'à la livraison.
 */
export function canOpenFuture(input: {
  commodity: TradeGood;
  tons: number;
  horizonH: number;
  openContracts: number;
  tradable: readonly TradeGood[];
}): { ok: boolean; reason?: FuturesRefusal } {
  if (!input.tradable.includes(input.commodity)) return { ok: false, reason: "NOT_TRADED" };
  if (input.tons < FUTURES_MIN_TONS) return { ok: false, reason: "TOO_SMALL" };
  if (input.openContracts >= MAX_OPEN_FUTURES) return { ok: false, reason: "TOO_MANY_OPEN" };
  if (!FUTURES_HORIZONS_H.includes(input.horizonH as FuturesHorizonH)) {
    return { ok: false, reason: "EXPIRED_HORIZON" };
  }
  return { ok: true };
}

/**
 * Ce que le joueur gagne ou perd à honorer un contrat, comparé à une vente au
 * comptant au moment de l'échéance. Sert à lui montrer, après coup, si son
 * pari était bon — sans quoi il ne saura jamais s'il a bien fait.
 */
export function futuresOutcome(input: {
  pricePerTon: number;
  tons: number;
  marketPriceAtDue: number;
}): { delta: number; better: boolean } {
  const delta = Math.round((input.pricePerTon - input.marketPriceAtDue) * input.tons);
  return { delta, better: delta > 0 };
}
