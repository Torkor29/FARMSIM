/**
 * La banque.
 *
 * Une exploitation réelle se finance à la dette : on achète la moissonneuse
 * avant d'avoir moissonné. Ici, tout était comptant. Le joueur qui voulait un
 * tracteur plus large n'avait qu'une chose à faire — attendre — et le temps
 * d'attente remplaçait l'arbitrage financier.
 *
 * ## Ce qui rend le crédit intéressant
 *
 * Une seule chose : **pouvoir se surendetter**. Un plafond qu'on ne peut pas
 * approcher n'est pas un plafond, c'est une commodité. La ligne se calcule
 * donc sur les capitaux propres — terres, bâtiments, matériel, stocks — et
 * elle en couvre une part suffisante pour qu'un mauvais pari fasse mal.
 *
 * Les intérêts courent chaque jour sur le solde dû. Ils ne saisissent rien,
 * ne provoquent aucune fin de partie : ils rongent la marge, et c'est
 * largement assez. La documentation du projet le dit sans détour — ne pas
 * reproduire les 0,8 % par jour du jeu de référence, qui punissent au lieu de
 * faire décider.
 *
 * @see docs/research/04_ECONOMY_DESIGN.md — crédit et trésorerie
 */

import { GAME_DAY_MS, SEASON_DAYS } from "./time.js";

/**
 * Part des capitaux propres qu'une banque accepte de prêter `[GD]`.
 *
 * Soixante pour cent : assez pour financer un vrai saut de matériel — une
 * moissonneuse T2 sur une ferme de six parcelles — sans permettre de doubler
 * l'exploitation d'un coup.
 */
export const LOAN_EQUITY_RATIO = 0.6;

/**
 * Plancher de la ligne, en euros : une ferme neuve doit pouvoir démarrer.
 *
 * Dix mille n'achetaient plus le premier pulvé une fois les T1 passés au neuf.
 * Trente mille couvrent un pulvérisateur T1, ou une faucheuse et de quoi semer.
 */
export const LOAN_FLOOR_CRD = 30000;

/**
 * Intérêt par jour de jeu `[GD]`.
 *
 * Une demi-part de pour cent. Le taux paraît énorme rapporté à l'année réelle,
 * et il l'est — mais une année de jeu dure sept heures. Ce qui compte est ce
 * que le joueur ressent à l'échelle où il décide : **3,5 % par saison**. Sur
 * dix mille € empruntés, la saison coûte 350 € quand elle en rapporte
 * environ 2 300. Assez pour peser sur le calcul, jamais pour l'écraser.
 */
export const LOAN_DAILY_RATE = 0.005;

/** Ce qu'une saison d'emprunt coûte, pour l'afficher au joueur. */
export function seasonInterest(debt: number): number {
  return Math.round(Math.max(0, debt) * LOAN_DAILY_RATE * SEASON_DAYS * 100) / 100;
}

/** Emprunt minimum : en dessous, ce n'est pas une décision, c'est un clic. */
export const LOAN_MIN_CRD = 500;

/**
 * Capitaux propres d'une exploitation.
 *
 * Ce que la ferme vaut si l'on arrête tout : la terre, ce qui est bâti, le
 * matériel à sa cote, les stocks au cours du jour — moins ce qu'on doit.
 */
export function farmEquity(opts: {
  landCrd: number;
  buildingsCrd: number;
  machinesCrd: number;
  stockCrd: number;
  cashCrd: number;
  debtCrd: number;
}): number {
  const actif =
    Math.max(0, opts.landCrd) +
    Math.max(0, opts.buildingsCrd) +
    Math.max(0, opts.machinesCrd) +
    Math.max(0, opts.stockCrd) +
    Math.max(0, opts.cashCrd);
  return Math.round((actif - Math.max(0, opts.debtCrd)) * 100) / 100;
}

/**
 * Ce que la banque accepte encore de prêter.
 *
 * La ligne se ferme d'elle-même quand la dette atteint le plafond : les
 * intérêts continuent de courir, et c'est précisément la situation qu'on veut
 * pouvoir atteindre — sans elle, emprunter serait sans conséquence.
 */
export function borrowingRoom(opts: { equity: number; debtCrd: number }): number {
  const plafond = Math.max(LOAN_FLOOR_CRD, Math.max(0, opts.equity) * LOAN_EQUITY_RATIO);
  return Math.max(0, Math.round((plafond - Math.max(0, opts.debtCrd)) * 100) / 100);
}

/** Plafond de la ligne, indépendamment de ce qui est déjà tiré. */
export function creditCeiling(equity: number): number {
  return Math.round(Math.max(LOAN_FLOOR_CRD, Math.max(0, equity) * LOAN_EQUITY_RATIO) * 100) / 100;
}

/**
 * Intérêts courus depuis la dernière écriture.
 *
 * Composés à la journée, comme une vraie ligne de trésorerie. On borne la
 * période : une ferme laissée un an ne doit pas se réveiller avec une dette
 * multipliée par cinquante — le joueur reviendrait sur une partie perdue sans
 * avoir rien décidé.
 */
export const LOAN_MAX_ACCRUAL_DAYS = 4 * SEASON_DAYS;

export function accrueInterest(opts: {
  debtCrd: number;
  elapsedMs: number;
}): { interest: number; debtCrd: number } {
  const dette = Math.max(0, opts.debtCrd);
  if (dette <= 0) return { interest: 0, debtCrd: 0 };
  const jours = Math.min(LOAN_MAX_ACCRUAL_DAYS, Math.max(0, opts.elapsedMs) / GAME_DAY_MS);
  const apres = dette * Math.pow(1 + LOAN_DAILY_RATE, jours);
  const interet = Math.round((apres - dette) * 100) / 100;
  return { interest: interet, debtCrd: Math.round(apres * 100) / 100 };
}

/** État de la ligne, tel qu'on le montre au Bureau. */
export type CreditHealth = "SAINE" | "TENDUE" | "SATUREE";

export function creditHealth(opts: { equity: number; debtCrd: number }): CreditHealth {
  const plafond = creditCeiling(opts.equity);
  if (plafond <= 0) return "SATUREE";
  const part = Math.max(0, opts.debtCrd) / plafond;
  if (part >= 0.99) return "SATUREE";
  if (part >= 0.7) return "TENDUE";
  return "SAINE";
}

export const CREDIT_HEALTH_LABELS: Record<CreditHealth, string> = {
  SAINE: "marge confortable",
  TENDUE: "ligne tendue",
  SATUREE: "ligne saturée",
};
