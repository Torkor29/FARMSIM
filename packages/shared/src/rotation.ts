/**
 * Rotation des cultures.
 *
 * Enchaîner deux blés sur la même terre est la faute d'agronomie la plus
 * classique, et elle se paie. Les champignons du sol — piétin-échaudage en
 * tête — survivent l'hiver sur les résidus de la culture précédente et
 * attendent la suivante. Les adventices, elles, se spécialisent : un même
 * cycle de travail au même moment de l'année sélectionne les espèces qui y
 * résistent. Le blé sur blé perd couramment le sixième de son rendement, le
 * troisième blé d'affilée bien davantage.
 *
 * L'inverse est vrai : une culture de rupture casse ces cycles. C'est l'effet
 * précédent, et il se voit sur la récolte suivante.
 *
 * Le jeu ne connaît que deux cultures, donc la rotation s'y résume à alterner.
 * C'est suffisant pour que la décision existe : semer du blé deux ans de suite
 * parce que son cours est haut devient un pari, pas une évidence.
 *
 * @see docs/research/45_ROTATION.md
 */

import type { CropCode } from "./index.js";

/**
 * Perte de rendement selon le nombre de fois où la culture a déjà occupé la
 * case sans interruption `[GD]`.
 *
 * L'indice est le nombre de cycles consécutifs déjà réalisés : semer du blé
 * sur une case qui en a déjà porté une fois coûte 15 %, une deuxième fois
 * 26 %. La progression s'aplatit — l'inoculum du sol sature — sans quoi la
 * monoculture deviendrait absurde plutôt que coûteuse.
 */
export const ROTATION_MALUS: readonly number[] = [0, 0.15, 0.26, 0.33];

/** Gain apporté par une culture de rupture, après au moins un cycle `[GD]` */
export const BREAK_CROP_BONUS = 0.04;

/** Ce que la case garde en mémoire de ses cultures passées. */
export type RotationState = {
  /** Dernière culture semée, `null` sur une terre encore vierge */
  lastCrop: CropCode | null;
  /** Cycles consécutifs de cette même culture, `lastCrop` compris */
  cropStreak: number;
};

export const NO_ROTATION: RotationState = { lastCrop: null, cropStreak: 0 };

/**
 * Coefficient de rendement appliqué si l'on sème `crop` sur cette case.
 * Supérieur à 1 pour une culture de rupture, inférieur pour un retour.
 */
export function rotationFactor(state: RotationState, crop: CropCode): number {
  if (!state.lastCrop || state.cropStreak <= 0) return 1;
  if (state.lastCrop !== crop) {
    // Une légumineuse ne se contente pas de couper le cycle des maladies :
    // elle laisse de l'azote. Le gain est donc plus franc qu'une rupture
    // ordinaire — sauf pour une autre légumineuse, qui n'en a que faire.
    return isLegume(state.lastCrop) && !isLegume(crop) ? 1 + NITROGEN_BONUS : 1 + BREAK_CROP_BONUS;
  }
  const i = Math.min(ROTATION_MALUS.length - 1, Math.max(0, Math.floor(state.cropStreak)));
  return 1 - ROTATION_MALUS[i];
}

/** L'état de rotation de la case une fois `crop` semée. */
export function nextRotation(state: RotationState, crop: CropCode): RotationState {
  const repeat = state.lastCrop === crop;
  return { lastCrop: crop, cropStreak: repeat ? state.cropStreak + 1 : 1 };
}

/**
 * Avertissement à montrer avant de semer, ou `null` si le choix est sain.
 * Le joueur doit pouvoir mesurer le coût de sa facilité avant de la commettre.
 */
export function rotationWarning(state: RotationState, crop: CropCode): string | null {
  const factor = rotationFactor(state, crop);
  if (factor >= 1) return null;
  const pct = Math.round((1 - factor) * 100);
  const nth = state.cropStreak + 1;
  return `${nth}ᵉ cycle de la même culture — ${pct} % de rendement`;
}

/** Résumé de l'état de rotation d'une case, pour l'affichage. */
export function rotationSummary(state: RotationState): string {
  if (!state.lastCrop || state.cropStreak <= 0) return "Aucun précédent";
  if (state.cropStreak === 1) return `Précédent : ${state.lastCrop}`;
  return `Précédent : ${state.lastCrop} × ${state.cropStreak}`;
}

/**
 * Les légumineuses fixent l'azote de l'air par leurs nodosités et en laissent
 * une part dans le sol. La culture qui suit démarre donc sur une réserve que
 * le blé ou le maïs, eux, ne font que consommer.
 *
 * C'est ce qui distingue une vraie tête de rotation d'une simple alternance,
 * et ce qui justifie de semer un pois dont la tonne rapporte moins.
 */
export const LEGUMES: readonly CropCode[] = ["PEA"];

export function isLegume(crop: CropCode): boolean {
  return LEGUMES.includes(crop);
}

/** Gain apporté à la culture suivant une légumineuse `[GD]` */
export const NITROGEN_BONUS = 0.13;
