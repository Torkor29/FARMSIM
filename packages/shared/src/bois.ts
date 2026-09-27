/**
 * Le bois : on le plante, il pousse seul, on le coupe, il repart.
 *
 * ## La pousse
 *
 * Un bois se compte depuis sa plantation (`ParcelCell.boiseDepuis`). Des
 * plants d'abord, un jeune bois passé `SEUIL_JEUNE`, une futaie au bout d'une
 * année de jeu (`BOIS_MATURITE_MS`). Rien à faire entre-temps : c'est le
 * contraire d'un champ, un revenu lent qui ne demande pas de bras.
 *
 * ## La coupe
 *
 * Une futaie se coupe et se vend à la scierie, `PRIX_COUPE` la case. Les
 * souches rejettent : la case repart en plants, sans rien racheter. Il faut
 * que les engins l'atteignent — une case de bois est à la lisière d'une case
 * où ils roulent, ou on lui ouvre un chemin.
 *
 * ## Ce qu'il fait d'autre
 *
 * Un bois levé coupe le vent mieux qu'une haie (`BONUS_BOIS`, voir
 * `bonusAmenagementCase`), et il compte dans le charme. Mais il arrête les
 * engins comme l'eau : un champ enclavé derrière un bois ne se travaille plus.
 */
import { YEAR_MS } from "./time.js";

/** Une année de jeu, de la plantation à la futaie. */
export const BOIS_MATURITE_MS = YEAR_MS;
/** La part de la pousse où les plants deviennent un jeune bois. */
export const SEUIL_JEUNE = 0.3;
/** Ce que la scierie paie une case de futaie. */
export const PRIX_COUPE = 70;
/** Le brise-vent d'un bois levé, et sa portée (de centre à centre). */
export const BONUS_BOIS = 0.03;
export const PORTEE_BOIS = 2;

export type StadeBois = "PLANTS" | "JEUNE" | "FUTAIE";

/** Où en est la pousse, de 0 (juste planté) à 1 (futaie). */
export function croissanceBois(
  boiseDepuis: Date | string | number | null | undefined,
  maintenant: number = Date.now(),
): number {
  if (boiseDepuis == null) return 1;
  const t0 = boiseDepuis instanceof Date ? boiseDepuis.getTime() : new Date(boiseDepuis).getTime();
  if (!Number.isFinite(t0)) return 1;
  return Math.max(0, Math.min(1, (maintenant - t0) / BOIS_MATURITE_MS));
}

export function stadeBois(progres: number): StadeBois {
  return progres >= 1 ? "FUTAIE" : progres >= SEUIL_JEUNE ? "JEUNE" : "PLANTS";
}

export const LIBELLE_STADE: Record<StadeBois, string> = {
  PLANTS: "Jeunes plants",
  JEUNE: "Jeune bois",
  FUTAIE: "Futaie, bonne à couper",
};

/** Le temps qu'il reste avant la futaie, en millisecondes. */
export function resteAvantCoupe(boiseDepuis: Date | string | number | null | undefined, maintenant = Date.now()): number {
  return Math.max(0, (1 - croissanceBois(boiseDepuis, maintenant)) * BOIS_MATURITE_MS);
}
