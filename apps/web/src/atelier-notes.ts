/**
 * Les règles des mini-jeux d'atelier — des nombres, pas un composant.
 *
 * Séparées de `MachineCareOverlay` pour qu'un test puisse les lire sans monter
 * React ni le son. Elles décident de la note, qui reste un plaisir : elle ne
 * change rien à ce que l'entretien rapporte.
 */

/** La zone verte de la jauge : assez pour chasser l'eau, pas au point de déborder. */
export const ZONE_GRAISSE = { min: 0.62, max: 0.84 } as const;

/**
 * L'étoile se gagne au premier essai : un raté (sec ou débordé) en coûte une,
 * deux ratés deux — jamais moins d'une, le graissage est fait.
 */
export function etoilesGraissage(rates: number): number {
  return rates === 0 ? 3 : rates <= 2 ? 2 : 1;
}

/** On arrête de gratter à 90 % : le dernier dixième, c'est le jet qui l'emporte. */
export const SEUIL_PROPRE = 0.9;

/** Plus on va vite, mieux c'est — mais on n'est jamais noté en dessous d'une étoile. */
export function etoilesLavage(secondes: number): number {
  return secondes <= 8 ? 3 : secondes <= 14 ? 2 : 1;
}
