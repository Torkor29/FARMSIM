/**
 * Paille (andain → bottes → stock ou enfouissement) et ensilage de maïs.
 *
 * La paille est le pont céréalier ↔ éleveur (litière). L’ensilage nourrit
 * le troupeau : plus de tonnage, plus tôt, pas un cours mondial liquide.
 *
 * @see docs/research/48_PLAN_MECANIQUES.md
 * @see docs/research/49_TRIANGLE_METIERS.md
 */

import type { CropCode } from "./index.js";


/**
 * Tonnes de paille laissées au sol par case, selon la culture moissonnée.
 *
 * Les pailleuses d'abord : blé et orge en donnent le plus, le colza une paille
 * grossière qu'on presse quand même. L'herbe n'en laisse aucune — elle part
 * entière en fourrage.
 */
export const STRAW_YIELD: Record<CropCode, number> = {
  WHEAT: 0.22,
  BARLEY: 0.2,
  RAPE: 0.15,
  PEA: 0.12,
  MAIZE: 0.08,
  GRASS: 0,
};

/** Une botte pèse environ 350 kg. */
export const BALE_TONS = 0.35;

/** Cette culture laisse-t-elle de quoi presser ? L'herbe, non. */
export function leavesSwath(crop: CropCode | null | undefined): boolean {
  if (!crop) return false;
  return (STRAW_YIELD[crop] ?? 0) > 0;
}

/**
 * Tonnage de paille laissé au sol par une case moissonnée.
 *
 * `keepSwath` est le choix du moissonneur, case par case : garder l'andain
 * pour le presser plus tard, ou le broyer derrière la machine. Broyer ne
 * rapporte rien tout de suite, mais rend la matière au sol et évite d'avoir à
 * repasser deux fois (presse, puis ramassage) sur une parcelle dont on ne fera
 * rien de la paille.
 *
 * Par défaut on garde : c'était le seul comportement possible jusqu'ici, et
 * une valeur par défaut qui change le rendement d'une ferme existante serait
 * une mauvaise surprise.
 */
export function strawYieldFor(
  crop: CropCode | null | undefined,
  asSilage: boolean,
  keepSwath = true,
): number {
  if (asSilage || !crop || !keepSwath) return 0;
  return STRAW_YIELD[crop] ?? 0;
}

export function balesFromStraw(strawTons: number): number {
  if (strawTons <= 0) return 0;
  return Math.max(1, Math.floor(strawTons / BALE_TONS + 1e-9));
}

export function strawFromBales(baleCount: number): number {
  return Math.max(0, baleCount) * BALE_TONS;
}

/** Ensilage possible dès 55 % de la croissance, avant la maturité grain. */
export const SILAGE_MIN_PROGRESS = 0.55;

/** Tonnage plante entière ≈ 3,2 × le grain, un peu moins si trop tôt. */
export const SILAGE_YIELD_MULT = 3.2;

export function canSilageHarvest(opts: {
  crop: CropCode | null | undefined;
  progress: number;
  lost?: boolean;
}): boolean {
  if (opts.crop !== "MAIZE") return false;
  if (opts.lost) return false;
  return opts.progress >= SILAGE_MIN_PROGRESS;
}

export function silageYieldTons(grainEquivalentTons: number, progress: number): number {
  const p = Math.max(SILAGE_MIN_PROGRESS, Math.min(1, progress));
  return Math.round(grainEquivalentTons * SILAGE_YIELD_MULT * (0.7 + 0.3 * p) * 1000) / 1000;
}
