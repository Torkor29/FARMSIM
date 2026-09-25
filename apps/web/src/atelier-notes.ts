/**
 * Les règles des jeux d'atelier — des nombres, pas un composant.
 *
 * Séparées des scènes pour qu'un test puisse les lire sans monter React, ni
 * la toile, ni le son. Elles décident de la note, qui reste un plaisir : elle
 * ne change rien à ce que l'entretien rapporte.
 */

/** Les graisseurs de la roue. */
export const GRAISSEURS = 5;

/**
 * La marge du tir, de part et d'autre de la buse, en radians.
 *
 * Quatorze degrés : à la vitesse de départ, un graisseur reste un peu plus
 * d'un quart de seconde sous la buse — de quoi réussir sans chance, pas sans
 * regarder.
 */
export const TOLERANCE_GRAISSE = (14 * Math.PI) / 180;

/** La vitesse de départ de la roue, en radians par seconde. */
export const VITESSE_ROUE = 1.6;

/**
 * L'étoile se gagne au premier essai : un tir raté en coûte une, deux ratés
 * deux — jamais moins d'une, le graissage est fait.
 */
export function etoilesGraissage(rates: number): number {
  return rates === 0 ? 3 : rates <= 2 ? 2 : 1;
}

/** Plus on va vite, mieux c'est — mais on n'est jamais noté en dessous d'une étoile. */
export function etoilesLavage(secondes: number): number {
  return secondes <= 7 ? 3 : secondes <= 12 ? 2 : 1;
}
