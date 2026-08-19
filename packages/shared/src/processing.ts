/**
 * La transformation à la ferme.
 *
 * Tout se vendait brut. Quatorze marchandises, toutes des matières premières :
 * le lait se vendait en lait, le blé en blé, et la seule stratégie de prix
 * consistait à attendre le bon cours. C'est pourtant la couche de valeur
 * ajoutée du genre depuis FS22, et une réalité de terrain — la ferme qui
 * transforme est celle qui gagne sa vie.
 *
 * ## Ce qui empêche l'argent gratuit
 *
 * Trois freins, et ce sont eux qui font la décision :
 *
 * - **le débit**. Un atelier traite une quantité par jour, pas un stock d'un
 *   coup. Transformer immobilise la matière pendant ce temps-là ;
 * - **le cours**. Le produit fini a son propre marché, avec sa propre
 *   profondeur : écouler du fromage fait baisser le fromage. Une flambée du
 *   lait peut rendre la vente brute plus rentable que l'atelier ;
 * - **le bâtiment**. Il coûte, il occupe une case, et il ne sert qu'à ça.
 *
 * Le joueur arbitre donc entre vendre maintenant et vendre mieux plus tard —
 * exactement l'arbitrage du stockage, mais avec un atelier qui le rend
 * possible plutôt qu'un silo qui le subit.
 *
 * @see docs/research/02_FARMING_SIMULATOR_ANALYSIS.md §4 — productions
 */

import type { TradeGood } from "./goods.js";
import { GAME_DAY_MS } from "./time.js";

export type ProcessingKind = "DAIRY" | "MILL";

/** Ce qu'un atelier transforme, et à quel rythme. */
export type RecipeDef = {
  kind: ProcessingKind;
  input: TradeGood;
  output: TradeGood;
  /** Unités d'entrée pour une unité de sortie */
  ratio: number;
  /** Unités d'entrée consommées par jour de jeu, au niveau 1 */
  inputPerDay: number;
  name: string;
};

/**
 * Les deux ateliers `[GD]`.
 *
 * Deux, pas dix. L'audit du jeu le disait : une chaîne de production complète
 * transformerait la ferme en usine à clics, alors que deux ateliers suffisent
 * à poser la question — transformer ou vendre brut.
 *
 * Les rapports viennent du réel : il faut une dizaine de litres de lait pour
 * un kilo de fromage, et un quintal de blé donne environ soixante-quinze kilos
 * de farine. Le reste, c'est du son.
 */
export const RECIPES: Record<ProcessingKind, RecipeDef> = {
  DAIRY: {
    kind: "DAIRY",
    name: "Laiterie",
    input: "MILK",
    output: "CHEESE",
    // Une dizaine de litres de lait pour un kilo de fromage `[RÉEL]` : cent
    // hectolitres pour la tonne. Le rapport est ce qui fait du fromage une
    // marchandise rare et chère, pas une version un peu mieux payée du lait.
    ratio: 100,
    // Vingt-cinq hectolitres par jour, soit la traite d'un petit troupeau. La
    // laiterie prend une part de la production, jamais la totalité : vendre du
    // lait doit rester une option.
    inputPerDay: 25,
  },
  MILL: {
    kind: "MILL",
    name: "Moulin",
    input: "WHEAT",
    output: "FLOUR",
    // Un quintal de blé rend soixante-quinze kilos de farine `[RÉEL]`.
    ratio: 1 / 0.75,
    inputPerDay: 2,
  },
};

/**
 * Ce qu'un atelier transforme sur une durée donnée.
 *
 * Borné par trois choses : ce qu'il sait traiter dans le temps écoulé, ce
 * qu'il y a en stock, et ce qui fait au moins une unité entière de produit
 * fini. On ne rend jamais de fraction de fromage.
 */
export function processRun(opts: {
  kind: ProcessingKind;
  /** Débit du bâtiment, palier compris — voir `processingThroughput` */
  perDay: number;
  elapsedMs: number;
  stockIn: number;
}): { consumed: number; produced: number } {
  const def = RECIPES[opts.kind];
  const jours = Math.max(0, opts.elapsedMs) / GAME_DAY_MS;
  const capacite = Math.max(0, opts.perDay) * jours;
  const dispo = Math.min(capacite, Math.max(0, opts.stockIn));
  const produced = Math.floor((dispo / def.ratio) * 100) / 100;
  if (produced <= 0) return { consumed: 0, produced: 0 };
  return {
    consumed: Math.round(produced * def.ratio * 100) / 100,
    produced,
  };
}

/**
 * La marge brute d'une transformation, aux cours du moment.
 *
 * Sert à l'écran : sans ce chiffre, le joueur ne peut pas savoir si son
 * atelier travaille à perte quand le lait flambe.
 */
export function processingMargin(opts: {
  kind: ProcessingKind;
  inputPrice: number;
  outputPrice: number;
}): number {
  const def = RECIPES[opts.kind];
  const cout = def.ratio * opts.inputPrice;
  if (cout <= 0) return 0;
  return Math.round(((opts.outputPrice - cout) / cout) * 1000) / 1000;
}
