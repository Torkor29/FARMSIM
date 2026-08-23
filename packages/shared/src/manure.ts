/**
 * Fumier — le pont retour de l'éleveur vers le céréalier.
 *
 * Le tas reste **sur la ferme**, à côté du bâtiment : on ne le met pas au
 * silo. Trois issues : l'épandre, le vendre au voisin, ou le laisser
 * pourrir (odeur, bonheur qui baisse).
 *
 * @see docs/research/52_BOUCLES_LIEES.md
 */

import { SPECIES } from "./species.js";
import type { AnimalKind } from "./livestock.js";

/** Tonnes de fumier par bête et par cycle `[GD]` */
export const MANURE_PER_ANIMAL: Record<AnimalKind, number> = Object.fromEntries(
  Object.values(SPECIES).map((e) => [e.kind, e.manureTons]),
) as Record<AnimalKind, number>;

/**
 * La fosse tient environ cinq cycles d'un bâtiment plein.
 * Au-delà, plus rien n'entre : il faut épandre ou vendre.
 */
export const MANURE_PIT_CYCLES = 5;

/** Tonnes consommées pour fertiliser une case `[GD]` */
export const MANURE_PER_CELL = 0.04;

/**
 * Gain de fertilité de la parcelle par case épandue `[GD]`.
 * Plus durable que l'engrais du magasin, un peu plus lent à se voir.
 */
export const MANURE_FERTILITY_GAIN = 0.006;

/** Prix local au voisin, en € / t — pas un cours mondial `[GD]` */
export const MANURE_LOCAL_PRICE = 55;

/** À partir de ce remplissage, l'odeur commence `[GD]` */
export const MANURE_SMELL_START = 0.8;

/** Pénalité max sur la cible de bonheur, fosse pleine `[GD]` */
export const MANURE_SMELL_PENALTY_MAX = 0.25;

/** Teinte sombre des cases après épandage, en ms `[TEST]` */
export const MANURE_STAIN_MS = 60_000;

export function manurePitCapacity(kind: AnimalKind, slots: number): number {
  const n = Math.max(0, Math.floor(slots));
  const per = MANURE_PER_ANIMAL[kind] ?? MANURE_PER_ANIMAL.COW;
  return Math.round(per * n * MANURE_PIT_CYCLES * 1000) / 1000;
}

/** Fumier produit sur une durée, en tonnes. */
export function manureProduced(input: {
  kind: AnimalKind;
  herdSize: number;
  elapsedMs: number;
  cycleMs: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size <= 0) return 0;
  const cycles = Math.max(0, input.elapsedMs) / Math.max(1, input.cycleMs);
  const per = MANURE_PER_ANIMAL[input.kind] ?? MANURE_PER_ANIMAL.COW;
  return Math.round(per * size * cycles * 1000) / 1000;
}

export function manureFill(tons: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.max(0, Math.min(1, tons / capacity));
}

/**
 * Ajoute le fumier produit, sans dépasser la fosse.
 * Le trop-plein est perdu : c'est ça, « ça bloque ».
 */
export function addManureToPit(input: {
  current: number;
  produced: number;
  capacity: number;
}): { tons: number; wasted: number } {
  const cap = Math.max(0, input.capacity);
  const have = Math.max(0, input.current);
  const incoming = Math.max(0, input.produced);
  const room = Math.max(0, cap - have);
  const kept = Math.min(incoming, room);
  return {
    tons: Math.round((have + kept) * 1000) / 1000,
    wasted: Math.round((incoming - kept) * 1000) / 1000,
  };
}

/** Pénalité d'odeur `∈ [0 ; penaltyMax]`, nulle sous 80 %. */
export function manureSmellPenalty(fill: number): number {
  const excess = Math.max(0, fill) - MANURE_SMELL_START;
  if (excess <= 0) return 0;
  const span = 1 - MANURE_SMELL_START;
  return MANURE_SMELL_PENALTY_MAX * Math.min(1, excess / span);
}

export function manureNeededForCells(cells: number): number {
  return Math.round(Math.max(0, cells) * MANURE_PER_CELL * 1000) / 1000;
}

export function manureSaleProceeds(tons: number): number {
  return Math.round(Math.max(0, tons) * MANURE_LOCAL_PRICE);
}
