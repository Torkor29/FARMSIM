/**
 * Le temps du jeu — jour, saison, année, calées sur la semaine réelle.
 *
 * ## Pourquoi la semaine réelle
 *
 * L'année tournait sur une horloge à elle : quatre saisons de sept jours de
 * quinze minutes, sept heures en tout. Elle ne coïncidait avec rien. Un joueur
 * qui revenait le lendemain ne savait pas où il en était, et deux joueurs qui
 * s'appelaient ne partageaient aucun repère : « on est en quoi, là ? ».
 *
 * L'année fait désormais **une semaine réelle**, et les saisons tombent sur
 * les jours de la semaine :
 *
 *     lundi · mardi      printemps
 *     mercredi · jeudi   été
 *     vendredi · samedi  automne
 *     dimanche           hiver
 *
 * L'hiver est le jour creux du jeu — rien ne pousse, on répare et on vend. Le
 * poser sur le dimanche n'est pas un détail : c'est le seul jour dont chacun
 * sait d'avance qu'il tombe, et le seul où ne rien avoir à faire est un repos
 * plutôt qu'une punition.
 *
 * ## Ce qui n'a pas changé
 *
 * L'année contient toujours **28 jours de jeu**, exactement comme avant. Toutes
 * les durées écrites en jours de jeu — pousse, gestation, péremption, intérêts —
 * gardent donc leur sens à la virgule près. Seule l'échelle réelle a bougé : le
 * jour de jeu passe de quinze minutes à six heures.
 *
 *     1 jour de jeu     = 6 h réelles
 *     1 jour réel       = 4 jours de jeu
 *     1 année           = 28 jours de jeu = 7 jours réels
 *
 * ## Ce qui ne suit pas cette horloge
 *
 * La **durée des chantiers**, et elle seule. Un labour de onze heures de
 * tracteur doit coûter sept minutes de patience, pas trois heures : on ne fait
 * pas attendre un joueur devant son écran à l'échelle où poussent les cultures.
 * Voir `JOB_MS_PER_GAME_HOUR`.
 */

import type { Season } from "./world.js";

/** Durée d'un jour réel, en millisecondes. */
export const REAL_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Durée d'un jour de jeu, en temps réel `[GD]`.
 *
 * Six heures : c'est ce qui fait tomber l'année de vingt-huit jours de jeu sur
 * exactement sept jours réels. Quatre jours de jeu par jour réel, donc quatre
 * traites et quatre pas de pousse — assez pour qu'une journée bouge, assez peu
 * pour qu'on n'ait pas à la surveiller.
 */
export const GAME_DAY_MS = 6 * 60 * 60 * 1000;

/** Jours de jeu dans un jour réel. */
export const GAME_DAYS_PER_REAL_DAY = REAL_DAY_MS / GAME_DAY_MS;

/**
 * Longueur de chaque saison, en **jours réels**.
 *
 * Trois saisons pleines de deux jours et un hiver d'un seul. L'hiver est court
 * parce qu'il ne s'y passe rien : l'allonger n'ajouterait pas du jeu, il en
 * retirerait.
 */
export const SEASON_REAL_DAYS: Record<Season, number> = {
  SPRING: 2,
  SUMMER: 2,
  AUTUMN: 2,
  WINTER: 1,
};

/** Jours réels dans une année de jeu — une semaine. */
export const YEAR_REAL_DAYS = 7;

/** Jours de jeu dans une année. */
export const YEAR_DAYS = YEAR_REAL_DAYS * GAME_DAYS_PER_REAL_DAY;

/** Durée d'une année de jeu, en temps réel. */
export const YEAR_MS = YEAR_REAL_DAYS * REAL_DAY_MS;

/**
 * Longueur moyenne d'une saison, en jours de jeu.
 *
 * Sept, comme avant — les saisons sont maintenant inégales, mais leur moyenne
 * ne bouge pas. C'est cette moyenne qu'emploient les calculs qui parlent « à la
 * saison » sans en viser une en particulier, les intérêts bancaires en tête.
 */
export const SEASON_DAYS = YEAR_DAYS / 4;

/** Durée moyenne d'une saison, en temps réel. */
export const SEASON_DURATION_MS = YEAR_MS / 4;

/** Longueur d'une saison donnée, en jours de jeu. */
export function seasonLengthDays(season: Season): number {
  return SEASON_REAL_DAYS[season] * GAME_DAYS_PER_REAL_DAY;
}

/* ------------------------------------------------------------------ */
/* La semaine                                                          */
/* ------------------------------------------------------------------ */

/**
 * Le calendrier de l'hémisphère nord, du lundi au dimanche.
 *
 * C'est la seule table écrite à la main de ce module : tout le reste s'en
 * déduit, y compris l'hémisphère sud.
 */
const SEMAINE_NORD: Season[] = [
  "SPRING",
  "SPRING",
  "SUMMER",
  "SUMMER",
  "AUTUMN",
  "AUTUMN",
  "WINTER",
];

/**
 * Décalage de l'hémisphère sud, en jours.
 *
 * Quatre, et pas trois ou cinq : c'est le seul décalage qui oppose exactement
 * les deux extrêmes. Le dimanche, il est l'hiver au nord et l'été au sud ; le
 * mercredi, l'inverse. Un décalage impair mettrait les deux hémisphères en
 * demi-saison l'un de l'autre, ce qui ne s'oppose plus, ça se croise.
 */
const DECALAGE_SUD = 4;

/**
 * Quantième du jour dans la semaine — lundi = 0, dimanche = 6.
 *
 * En **UTC**, et c'est délibéré : le monde est partagé. Si l'heure locale
 * décidait de la saison, deux voisins de parcelle en fuseaux différents
 * n'auraient ni la même météo ni les mêmes cultures semables, et le jeu
 * n'aurait plus de vérité commune.
 */
export function weekdayIndex(now: number = Date.now()): number {
  return (new Date(now).getUTCDay() + 6) % 7;
}

/** Minuit UTC du jour réel qui contient `now`. */
export function startOfRealDay(now: number = Date.now()): number {
  return Math.floor(now / REAL_DAY_MS) * REAL_DAY_MS;
}

/** Numéro du jour de jeu depuis l'origine — sert de graine à la météo. */
export function gameDayIndex(now: number = Date.now()): number {
  return Math.floor(now / GAME_DAY_MS);
}

/** Part du jour de jeu déjà écoulée, 0 → 1. */
export function dayProgress(now: number = Date.now()): number {
  return (now % GAME_DAY_MS) / GAME_DAY_MS;
}

/* ------------------------------------------------------------------ */
/* La saison en cours                                                  */
/* ------------------------------------------------------------------ */

/** La saison d'un jour de la semaine donné, par hémisphère. */
export function seasonOfWeekday(weekday: number, hemisphere: "N" | "S" = "N"): Season {
  const i = ((weekday % 7) + 7) % 7;
  return SEMAINE_NORD[hemisphere === "S" ? (i + DECALAGE_SUD) % 7 : i]!;
}

/**
 * Bornes réelles de la saison en cours : son premier et son dernier instant.
 *
 * On remonte et on descend la semaine tant que la saison ne change pas. Les
 * saisons ne durant pas toutes le même nombre de jours, il n'y a pas de formule
 * plus courte — et un parcours de sept pas ne coûte rien.
 */
export function seasonSpan(
  hemisphere: "N" | "S" = "N",
  now: number = Date.now(),
): { start: number; end: number } {
  const jour = startOfRealDay(now);
  const saison = seasonOfWeekday(weekdayIndex(now), hemisphere);
  let debut = jour;
  while (seasonOfWeekday(weekdayIndex(debut - REAL_DAY_MS), hemisphere) === saison) {
    debut -= REAL_DAY_MS;
  }
  let fin = jour + REAL_DAY_MS;
  while (seasonOfWeekday(weekdayIndex(fin), hemisphere) === saison) {
    fin += REAL_DAY_MS;
  }
  return { start: debut, end: fin };
}

/** Part de la saison en cours déjà écoulée, 0 → 1. */
export function seasonProgress(now: number = Date.now()): number {
  const { start, end } = seasonSpan("N", now);
  return (now - start) / (end - start);
}

/** Quantième du jour de jeu dans la saison, à partir de 1. */
export function dayOfSeason(now: number = Date.now()): number {
  const { start } = seasonSpan("N", now);
  return Math.floor((now - start) / GAME_DAY_MS) + 1;
}

/** Temps restant avant le changement de saison, en millisecondes réelles. */
export function msUntilNextSeason(now: number = Date.now()): number {
  return seasonSpan("N", now).end - now;
}

/* ------------------------------------------------------------------ */
/* L'horloge des chantiers                                             */
/* ------------------------------------------------------------------ */

/**
 * Ce que coûte, en attente réelle, une heure de travail d'un engin `[GD]`.
 *
 * La seule durée du jeu qui ne suive pas l'horloge du monde, et il le faut :
 * un labour de onze heures de tracteur à l'échelle des cultures ferait attendre
 * près de trois heures devant l'écran. Trente-sept secondes et demie par heure
 * de travail — la valeur qui était déjà en vigueur, et qui donne sept minutes
 * pour ce même labour.
 */
export const JOB_MS_PER_GAME_HOUR = 37_500;
