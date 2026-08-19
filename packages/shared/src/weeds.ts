/**
 * Les adventices.
 *
 * Le désherbage n'existait pas comme geste. Un champ `weedsControlled` valait
 * **dix pour cent de rendement** dans la formule, et rien ne permettait de le
 * mettre à vrai : il ne passait à `true` qu'en même temps que la fertilisation,
 * en silence. Deux opérations réelles distinctes — l'épandeur et le
 * pulvérisateur — étaient confondues, et le joueur n'apprenait jamais que ces
 * dix pour cent existaient.
 *
 * Pire : le module `soil.ts` affirmait déjà, en toutes lettres, que le
 * déchaumeur « fait un faux-semis, donc il détruit les adventices » et que le
 * labour « enfouit la pression d'adventices ». Aucune de ces deux phrases
 * n'était vraie dans le code. Ce module les rend vraies.
 *
 * ## Une pression, pas un interrupteur
 *
 * Un booléen ne repousse pas. Les adventices, si. La case porte donc une
 * **pression** de 0 à 1 qui monte tant que la culture est en terre, et que
 * trois gestes font redescendre :
 *
 * - le **labour** enfouit tout : la pression repart de zéro ;
 * - le **déchaumage** fait lever les graines pour les détruire aussitôt —
 *   c'est le faux-semis — et en retire une bonne part ;
 * - le **pulvérisateur** nettoie la culture en place, vite et cher.
 *
 * C'est ce qui donne au semis direct son vrai défaut : il ne travaille pas le
 * sol, donc il n'enlève rien, et la pression de la campagne précédente se
 * reporte entière sur la suivante. Jusqu'ici il ne perdait que du rendement de
 * levée ; il perd désormais ce qu'il perd vraiment au champ.
 *
 * @see docs/research/03_AGRICULTURE_REALISM.md §2.4 — adventices ~−20 %
 */

import { GAME_DAY_MS } from "./time.js";
import type { Season } from "./world.js";

/**
 * Perte de rendement à pression maximale `[GD]`.
 *
 * Les guides de Farming Simulator donnent −20 % pour un champ envahi, et c'est
 * l'ordre de grandeur agronomique. On garde ce plafond : au-delà, une saison
 * d'inattention deviendrait irrattrapable.
 */
export const WEED_YIELD_MALUS = 0.2;

/**
 * Pression gagnée par jour de jeu, culture en terre `[GD]`.
 *
 * Une culture menée sans rien faire atteint sa pleine pression en une douzaine
 * de jours — l'ordre de grandeur d'un cycle de blé, qui en dure cinq à sept
 * selon la saison. On ne perd donc jamais tout sur une campagne conduite
 * normalement, mais on le sent.
 */
export const WEED_GROWTH_PER_DAY = 0.08;

/** Les adventices lèvent avec la chaleur, comme le reste `[RÉEL]`. */
export const WEED_SEASON_SPEED: Record<Season, number> = {
  SPRING: 1.25,
  SUMMER: 1.1,
  AUTUMN: 0.7,
  WINTER: 0.15,
};

/** Ce qu'il reste de pression après chaque geste `[GD]`. */
export const WEED_AFTER_PLOW = 0;
export const WEED_AFTER_STUBBLE = 0.35;
export const WEED_AFTER_SPRAY = 0.1;

/**
 * Part de la pression qu'une culture lègue à la suivante quand on ne travaille
 * pas le sol `[GD]`.
 *
 * Le semis direct ouvre un sillon et referme derrière lui : les graines
 * d'adventices restent en place. C'est le vrai coût agronomique de la
 * technique, et il manquait.
 */
export const WEED_CARRYOVER_NO_TILL = 0.8;

/**
 * Surcroît de pression quand on resème la même culture `[RÉEL]`.
 *
 * Les adventices se spécialisent : un même cycle de travail au même moment de
 * l'année sélectionne les espèces qui y résistent. `rotation.ts` le dit déjà
 * pour les maladies ; c'est le même mécanisme.
 */
export const WEED_MONOCULTURE_BONUS = 0.15;

/**
 * Coût de l'herbicide, par case `[GD]`.
 *
 * C'est la chimie qu'on paie, pas le passage — le gazole et l'usure sont
 * comptés ailleurs. Assez cher pour que labourer reste une vraie alternative,
 * assez abordable pour sauver une culture en place.
 */
export const HERBICIDE_COST_PER_CELL = 6;

/** Borne la pression dans [0, 1] — une valeur de base ne doit rien casser. */
export function clampWeeds(v: number | null | undefined): number {
  return Math.max(0, Math.min(1, v ?? 0));
}

/**
 * Pression atteinte après un temps de culture donné.
 *
 * L'intégration se fait par saison, comme la croissance : un hiver ne fait
 * presque rien lever. On part de la pression laissée par le précédent.
 */
export function weedPressureAfter(opts: {
  start: number;
  elapsedMs: number;
  season?: Season;
}): number {
  const jours = Math.max(0, opts.elapsedMs) / GAME_DAY_MS;
  const vitesse = opts.season ? WEED_SEASON_SPEED[opts.season] : 1;
  return clampWeeds(opts.start + jours * WEED_GROWTH_PER_DAY * vitesse);
}

/**
 * Ce que les adventices retirent au rendement.
 *
 * Continu, comme tout le reste : un palier se contourne en se calant juste
 * en dessous, une pente ne se contourne pas.
 */
export function weedYieldFactor(pressure: number | null | undefined): number {
  return Math.round((1 - WEED_YIELD_MALUS * clampWeeds(pressure)) * 1000) / 1000;
}

/** Pression que la case garde après un travail du sol. */
export function weedsAfterSoilWork(
  work: "PLOW" | "STUBBLE" | "DIRECT_SEED",
  current: number,
): number {
  if (work === "PLOW") return WEED_AFTER_PLOW;
  if (work === "STUBBLE") return Math.min(clampWeeds(current), WEED_AFTER_STUBBLE);
  return clampWeeds(current) * WEED_CARRYOVER_NO_TILL;
}

/** Pression de départ d'un semis, monoculture comprise. */
export function weedsAtSowing(opts: { carried: number; sameCropAgain: boolean }): number {
  return clampWeeds(opts.carried + (opts.sameCropAgain ? WEED_MONOCULTURE_BONUS : 0));
}

/** Étiquette lisible d'une pression, pour l'inspection de case. */
export function weedLabel(pressure: number | null | undefined): string {
  const p = clampWeeds(pressure);
  if (p < 0.15) return "propre";
  if (p < 0.4) return "quelques adventices";
  if (p < 0.7) return "salie";
  return "envahie";
}
