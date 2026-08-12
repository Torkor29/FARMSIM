/**
 * Reproduction du cheptel et péremption des denrées.
 *
 * Deux mécaniques qui se répondent : le troupeau grossit tout seul si on
 * l'entretient bien, mais ce qu'il produit ne se garde pas. L'élevage cesse
 * d'être une file d'achats pour devenir un capital qu'on soigne — et une
 * production qu'on écoule sans traîner.
 *
 * @see docs/research/44_BREEDING_SPOILAGE.md
 */

import type { AnimalKind } from "./livestock.js";
import type { TradeGood } from "./goods.js";

/* ------------------------------------------------------------------ */
/* Reproduction                                                        */
/* ------------------------------------------------------------------ */

/**
 * Conditions et rythme du vêlage `[GD]`.
 *
 * Une naissance récompense une conduite d'élevage suivie : il faut un couple,
 * des bêtes sereines, de la place et de quoi manger. Un troupeau négligé
 * stagne — ce qui est une sanction bien plus juste que de le voir mourir.
 */
export const BREEDING = {
  /** En dessous, les bêtes ne se reproduisent pas `[GD]` */
  minHappiness: 0.55,
  /** Il faut au moins deux bêtes `[RÉEL]` */
  minHerdSize: 2,
  /** La réserve doit couvrir au moins ce ratio du besoin `[GD]` */
  minFeedRatio: 0.5,
  /** Cycles de gestation par espèce `[GD]` */
  gestationCycles: { COW: 8, PIG: 4 } as Record<AnimalKind, number>,
  /** Petits par mise bas `[RÉEL]` — une vache fait un veau, une truie une portée */
  litterSize: { COW: 1, PIG: 4 } as Record<AnimalKind, number>,
  /**
   * Le bâtiment doit garder de la place : on ne fait pas naître une bête pour
   * la mettre à l'étroit, ce qui ferait chuter le bien-être de tout le lot.
   */
  freeSlotsRequired: 1,
} as const;

export type BreedingRefusal =
  | "TOO_SMALL"
  | "UNHAPPY"
  | "UNDERFED"
  | "NO_ROOM"
  | "GESTATING";

export const BREEDING_REFUSAL_LABELS: Record<BreedingRefusal, string> = {
  TOO_SMALL: "Il faut au moins deux bêtes pour espérer une naissance",
  UNHAPPY: "Le troupeau est trop stressé pour se reproduire",
  UNDERFED: "Un troupeau sous-alimenté ne se reproduit pas",
  NO_ROOM: "Plus de place : agrandissez le bâtiment",
  GESTATING: "Gestation en cours",
};

export type BreedingState = {
  kind: AnimalKind;
  size: number;
  happiness: number;
  /** Réserve d'aliment rapportée au besoin d'un cycle, 0 à 1+ */
  feedRatio: number;
  /** Places libres dans le bâtiment */
  freeSlots: number;
  /** Début de la gestation en cours, `null` si aucune */
  gestatingSince: number | null;
};

/** Le troupeau réunit-il les conditions pour démarrer une gestation ? */
export function canBreed(state: BreedingState): { ok: boolean; reason?: BreedingRefusal } {
  if (state.gestatingSince !== null) return { ok: false, reason: "GESTATING" };
  if (state.size < BREEDING.minHerdSize) return { ok: false, reason: "TOO_SMALL" };
  if (state.happiness < BREEDING.minHappiness) return { ok: false, reason: "UNHAPPY" };
  if (state.feedRatio < BREEDING.minFeedRatio) return { ok: false, reason: "UNDERFED" };
  if (state.freeSlots < BREEDING.freeSlotsRequired) return { ok: false, reason: "NO_ROOM" };
  return { ok: true };
}

/** Avancement de la gestation, 0 à 1. `1` signifie que la mise bas est due. */
export function gestationProgress(input: {
  kind: AnimalKind;
  gestatingSince: number | null;
  now: number;
  cycleMs: number;
}): number {
  if (input.gestatingSince === null) return 0;
  const total = BREEDING.gestationCycles[input.kind] * input.cycleMs;
  if (total <= 0) return 1;
  return Math.max(0, Math.min(1, (input.now - input.gestatingSince) / total));
}

/**
 * Nombre de petits à la mise bas, plafonné par la place restante.
 * Une portée de porcelets ne rentre pas toujours dans la porcherie.
 */
export function litterFor(kind: AnimalKind, freeSlots: number): number {
  return Math.max(0, Math.min(BREEDING.litterSize[kind], Math.floor(freeSlots)));
}

/* ------------------------------------------------------------------ */
/* Péremption                                                          */
/* ------------------------------------------------------------------ */

/**
 * Part perdue par cycle pour une denrée périssable `[GD]`.
 *
 * Le lait est le plus fragile : il impose d'écouler vite, ce qui donne enfin
 * une raison d'accepter le prix bas du négociant plutôt que d'attendre la
 * criée. La viande tient mieux, le grain ne bouge pas.
 */
export const SPOILAGE_PER_CYCLE: Partial<Record<TradeGood, number>> = {
  MILK: 0.12,
  MEAT: 0.05,
};

/** Une denrée se dégrade-t-elle ? */
export function isPerishable(good: TradeGood): boolean {
  return (SPOILAGE_PER_CYCLE[good] ?? 0) > 0;
}

/**
 * Quantité restante après `elapsedMs` de stockage.
 *
 * Décroissance exponentielle plutôt que linéaire : la perte est
 * proportionnelle à ce qu'il reste, donc un stock ne peut jamais devenir
 * négatif, et le résultat ne dépend pas du découpage des ticks.
 */
export function afterSpoilage(input: {
  good: TradeGood;
  qty: number;
  elapsedMs: number;
  cycleMs: number;
}): number {
  const rate = SPOILAGE_PER_CYCLE[input.good] ?? 0;
  if (rate <= 0 || input.qty <= 0 || input.elapsedMs <= 0) return Math.max(0, input.qty);
  const cycles = input.elapsedMs / Math.max(1, input.cycleMs);
  const kept = Math.pow(1 - rate, cycles);
  const left = input.qty * kept;
  // En dessous du gramme, on considère le lot perdu plutôt que de traîner des
  // poussières de stock indéfiniment.
  return left < 0.001 ? 0 : Math.round(left * 1000) / 1000;
}

/** Cycles restants avant qu'il ne reste plus que la moitié du lot. */
export function halfLifeCycles(good: TradeGood): number | null {
  const rate = SPOILAGE_PER_CYCLE[good] ?? 0;
  if (rate <= 0) return null;
  return Math.log(0.5) / Math.log(1 - rate);
}

/** Message d'alerte pour un lot périssable en stock. */
export function spoilageWarning(good: TradeGood, qty: number): string | null {
  const rate = SPOILAGE_PER_CYCLE[good];
  if (!rate || qty <= 0) return null;
  return `Se dégrade de ${Math.round(rate * 100)} % par cycle — vendez sans tarder`;
}
