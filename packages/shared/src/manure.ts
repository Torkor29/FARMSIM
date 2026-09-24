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

/* ------------------------------------------------------------------ */
/* La fumière                                                          */
/* ------------------------------------------------------------------ */

/**
 * Ce qu'une fumière tient à son premier niveau, en tonnes.
 *
 * ## Pourquoi un ouvrage séparé
 *
 * Demandé en jouant : « il faudrait ajouter un bâtiment fosse à lisier ».
 * Jusqu'ici la capacité de stockage se déduisait des places de l'étable —
 * `manurePitCapacity(kind, slots)` — si bien qu'il fallait **agrandir son
 * étable** pour stocker plus de fumier. Deux besoins différents payés par le
 * même bâtiment : on achetait des places de bêtes dont on n'avait pas l'usage
 * pour gagner quelques tonnes de fosse.
 *
 * ## Le mot
 *
 * Fumière et non fosse à lisier : le jeu a de la litière de paille
 * (`beddingCover`), et paille plus déjections font du **fumier**, solide. Le
 * lisier est ce qu'on obtient sans litière, et il se stocke en fosse. Le code
 * dit « fumier » partout ; le bâtiment suit.
 *
 * ## Le chiffre
 *
 * Six tonnes, soit quatre fois la fosse d'une étable bovine de premier niveau
 * (1,5 t). En dessous, l'ouvrage ne changerait pas assez la vie pour valoir sa
 * pose ; beaucoup au-dessus, épandre et vendre cesseraient d'être des gestes
 * qu'on planifie. Six tonnes, c'est cent cinquante cases à fertiliser, ou
 * trois cent trente euros chez le voisin.
 * `[GD]`
 */
export const MANURE_STORE_BASE_TONS = 6;

/**
 * Ce qu'une fumière tient à ce niveau-là.
 *
 * Elle reprend l'échelle de capacité des bâtiments plutôt que d'en inventer
 * une seconde : 6 t au premier niveau, près de 28 au dernier.
 */
export function manureStoreCapacity(niveau: number, capacityMult: number): number {
  if (niveau <= 0) return 0;
  return Math.round(MANURE_STORE_BASE_TONS * Math.max(1, capacityMult) * 1000) / 1000;
}

/**
 * La capacité de stockage d'un troupeau, fumières comprises.
 *
 * Les fumières de la parcelle sont **partagées** : leur contenance se divise
 * entre les troupeaux qui s'y trouvent. Sans ce partage, une seule fumière
 * offrirait sa pleine capacité à six étables à la fois, et il n'y aurait plus
 * jamais de raison d'en bâtir une seconde.
 */
export function pitCapacityWithStores(opts: {
  kind: AnimalKind;
  /** Places de l'étable qui abrite ce lot. */
  slots: number;
  /** Contenance cumulée des fumières de la parcelle, en tonnes. */
  storeTons: number;
  /**
   * Abris d'élevage qui se partagent ces fumières.
   *
   * On compte les **bâtiments**, pas les lots : une étable qu'on vient de
   * vider ne doit pas doubler la capacité de sa voisine du jour au lendemain.
   * Zéro ou un donnent tout à un seul.
   */
  barns: number;
}): number {
  const base = manurePitCapacity(opts.kind, opts.slots);
  const parts = Math.max(1, Math.floor(opts.barns));
  const part = Math.max(0, opts.storeTons) / parts;
  return Math.round((base + part) * 1000) / 1000;
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
