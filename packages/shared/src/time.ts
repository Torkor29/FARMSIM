/**
 * Le temps du jeu — jour, saison, année.
 *
 * ## Le seul réglage : la longueur d'une saison
 *
 * Tout ce fichier se déduit de `SEASON_REAL_HOURS`. Le calendrier tournait sur
 * la semaine réelle — lundi le printemps, dimanche l'hiver — et c'était une
 * porte fermée : qui ne joue que le week-end ne voyait qu'automne et hiver, à
 * vie, et ne pouvait donc jamais semer la moitié du catalogue. Les saisons
 * glissent maintenant dans la journée et personne n'est enfermé nulle part.
 *
 * ## Les deux échelles, et laquelle commande l'autre
 *
 * Le jeu se compte en **jours de jeu** : la pousse, la gestation, les
 * intérêts, la péremption, la dérive des cours, tout est libellé en jours.
 * Toutes ces valeurs ont été calibrées sur une règle unique, jamais écrite
 * mais partout supposée — **une saison fait sept jours de jeu**. Les intérêts
 * d'une saison valent sept jours d'intérêts (`credit.ts`), un pré nourrit sept
 * cycles d'élevage, un jeune met sept cycles à grandir.
 *
 * C'est donc le jour de jeu qui se déduit de la saison, et non l'inverse :
 *
 *     1 saison = SEASON_DAYS jours de jeu = SEASON_REAL_HOURS heures réelles
 *     1 année  = 4 saisons = 28 jours de jeu
 *
 * Prendre le problème dans l'autre sens — garder le jour de jeu à six heures
 * et laisser la saison rétrécir — aurait désynchronisé le jeu de lui-même :
 * les cultures auraient poussé au rythme des saisons pendant que la gestation,
 * les intérêts et la péremption seraient restés au rythme des jours. Une
 * gestation aurait couvert quatre saisons, un blé une demi-année. Ici rien ne
 * se décale : seule l'échelle réelle bouge, et elle bouge pour tout à la fois.
 *
 * ## Ce qui ne suit pas cette horloge
 *
 * La **durée des chantiers**, et elle seule. Un labour de onze heures de
 * tracteur doit coûter sept minutes de patience, pas trois heures : on ne fait
 * pas attendre un joueur devant son écran à l'échelle où poussent les
 * cultures. Voir `JOB_MS_PER_GAME_HOUR`.
 */

import type { Season } from "./world.js";

/** Durée d'un jour réel, en millisecondes. */
export const REAL_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Longueur d'une saison, en **heures réelles**. Le seul réglage du calendrier.
 *
 * ## Le défaut que ce nombre corrige
 *
 * Les saisons se lisaient dans une table indexée par le jour de la semaine :
 * lundi et mardi le printemps, mercredi et jeudi l'été, dimanche l'hiver. Une
 * année faisait donc exactement sept jours réels — elle était **calée sur la
 * semaine**.
 *
 * Conséquence, mesurée : un joueur qui ne joue que le week-end ne voyait
 * qu'automne et hiver. À vie. Un joueur du mardi soir vivait dans un printemps
 * éternel — une saison sur quatre, pour toujours. Et comme les fenêtres de
 * semis sont verrouillées par saison, ces joueurs-là ne pouvaient **jamais**
 * semer la moitié du catalogue. Ce n'était pas un déséquilibre, c'était une
 * porte fermée.
 *
 * ## La règle, et elle n'est pas celle qu'on croit
 *
 * On avance de `24 / SEASON_REAL_HOURS` saisons par jour réel. Si ce quotient
 * est entier, il faut encore qu'il soit **premier avec 4**, sinon on retombe
 * éternellement sur les mêmes saisons à la même heure :
 *
 *  - 6 h → 4 saisons/jour → toujours la même saison ;
 *  - 12 h → 2 saisons/jour → deux saisons sur quatre, jamais les autres ;
 *  - 8 h → 3 saisons/jour → les quatre, car 3 et 4 sont premiers entre eux ;
 *  - **10 h → 2,4 saisons/jour** → non entier, donc ça glisse toujours.
 *
 * Second piège, sur la semaine : `168 / (4 × SEASON_REAL_HOURS)` ne doit pas
 * être entier non plus, faute de quoi c'est le joueur hebdomadaire qui se
 * retrouve figé. C'est ce qui disqualifie 7 h (168 ÷ 28 = 6) et 14 h
 * (168 ÷ 56 = 3), pourtant tentantes. Ici 168 ÷ 40 = 4,2 : rien ne tombe juste.
 *
 * Un test tient ces deux propriétés. Changer ce nombre sans les vérifier
 * rouvrirait la porte fermée.
 */
export const SEASON_REAL_HOURS = 10;

/** Durée d'une saison, en millisecondes réelles. */
export const SEASON_REAL_MS = SEASON_REAL_HOURS * 60 * 60 * 1000;

/**
 * Jours de jeu dans une saison. **L'invariant de calibrage du jeu entier.**
 *
 * Ce sept-là n'est pas un choix esthétique, c'est l'hypothèse sur laquelle
 * repose tout ce qui est libellé en jours : les intérêts d'une saison valent
 * `LOAN_DAILY_RATE × SEASON_DAYS`, un pré tient sept cycles d'élevage, un
 * jeune grandit en sept cycles, l'atelier s'amortit en tant de jours qu'on
 * compare à des saisons. Le faire varier ne raccourcirait pas la saison : ça
 * décalerait toutes ces valeurs les unes par rapport aux autres, sans qu'aucun
 * chiffre du jeu ne bouge visiblement.
 *
 * Il ne bouge donc pas. C'est le jour de jeu qui s'ajuste à la saison.
 */
export const SEASON_DAYS = 7;

/** L'ordre des saisons. Le cycle, et rien d'autre.
 *
 * Les quatre durent le même temps. L'hiver était plus court — « il ne s'y
 * passe rien » — mais des saisons inégales imposaient une table indexée par
 * jour, donc un pas d'un jour entier, donc le calage sur la semaine. Un hiver
 * qui compte moins se retrouve par ce qui s'y passe, pas par sa longueur : la
 * pousse y tombe à 0,3 pour une céréale d'hiver et à 0,05 pour un maïs.
 */
export const SEASON_CYCLE: readonly Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

/**
 * Durée d'un jour de jeu, en temps réel `[GD]`. **Déduite**, plus réglée.
 *
 * Elle valait six heures, choisies pour faire tomber l'année de vingt-huit
 * jours sur exactement sept jours réels — c'est-à-dire pour caler le jeu sur
 * la semaine, ce qu'on vient précisément de défaire. Un septième de saison,
 * soit environ une heure vingt-six.
 *
 * La division ne tombe pas rond en millisecondes, et il n'y a aucune raison
 * qu'elle tombe rond : rien ici ne compte en millisecondes entières, et
 * arrondir ferait dériver les frontières de jour hors de leur saison.
 */
export const GAME_DAY_MS = SEASON_REAL_MS / SEASON_DAYS;

/** Jours de jeu dans un jour réel. */
export const GAME_DAYS_PER_REAL_DAY = REAL_DAY_MS / GAME_DAY_MS;

/** Jours de jeu dans une année. Vingt-huit, comme depuis toujours. */
export const YEAR_DAYS = SEASON_DAYS * SEASON_CYCLE.length;

/** Durée d'une année de jeu, en temps réel. */
export const YEAR_MS = SEASON_REAL_MS * SEASON_CYCLE.length;

/** Jours réels dans une année de jeu. Se déduit, ne se règle plus. */
export const YEAR_REAL_DAYS = YEAR_MS / REAL_DAY_MS;

/**
 * Durée d'une saison, en temps réel.
 *
 * Doublon exact de `SEASON_REAL_MS`, gardé parce qu'une bonne moitié du code
 * parle en « durée de saison » et l'autre en « heures réelles » ; les deux
 * noms disent la même chose depuis que les quatre saisons sont égales.
 */
export const SEASON_DURATION_MS = SEASON_REAL_MS;

/** Longueur d'une saison, en jours de jeu. Les quatre sont égales. */
export function seasonLengthDays(_season?: Season): number {
  return SEASON_DAYS;
}

/* ------------------------------------------------------------------ */
/* Le jour de jeu                                                      */
/* ------------------------------------------------------------------ */

/*
 * Tout ce qui suit compte en **UTC**, et c'est délibéré : le monde est
 * partagé. Si l'heure locale décidait de la saison, deux voisins de parcelle
 * en fuseaux différents n'auraient ni la même météo ni les mêmes cultures
 * semables, et le jeu n'aurait plus de vérité commune.
 *
 * `weekdayIndex` et `startOfRealDay` vivaient ici : le premier lisait la
 * saison dans une table indexée par jour de semaine, le second cherchait les
 * bornes de saison en remontant la semaine pas à pas. Les saisons ne
 * connaissent plus la semaine, les deux n'avaient plus d'appelant.
 */

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

/**
 * Le rang de la saison en cours dans le cycle, depuis l'origine des temps.
 *
 * C'est la seule chose que le calendrier calcule vraiment ; tout le reste en
 * découle. Un simple quotient, sans table ni jour de semaine — c'est
 * précisément ce qui fait glisser les saisons dans la journée au lieu de les
 * y clouer.
 */
export function seasonIndex(now: number = Date.now()): number {
  return Math.floor(now / SEASON_REAL_MS);
}

/**
 * Décalage de l'hémisphère sud : deux saisons, soit l'opposé exact.
 *
 * Quand il est l'hiver au nord, il est l'été au sud. Un décalage impair
 * mettrait les deux hémisphères en demi-saison l'un de l'autre — ça ne
 * s'oppose plus, ça se croise.
 */
const DECALAGE_SUD = 2;

/** La saison à un instant donné, par hémisphère. */
export function seasonAt(now: number = Date.now(), hemisphere: "N" | "S" = "N"): Season {
  const i = seasonIndex(now) + (hemisphere === "S" ? DECALAGE_SUD : 0);
  const n = SEASON_CYCLE.length;
  return SEASON_CYCLE[((i % n) + n) % n]!;
}

/**
 * Bornes réelles de la saison en cours.
 *
 * Deux multiplications, là où il fallait remonter et descendre la semaine pas
 * à pas : les saisons étant toutes de la même longueur, la frontière se
 * calcule au lieu de se chercher. L'hémisphère ne change pas les bornes — il
 * ne change que le **nom** de la saison qui les occupe.
 */
export function seasonSpan(
  _hemisphere: "N" | "S" = "N",
  now: number = Date.now(),
): { start: number; end: number } {
  const debut = seasonIndex(now) * SEASON_REAL_MS;
  return { start: debut, end: debut + SEASON_REAL_MS };
}

/** Part de la saison en cours déjà écoulée, 0 → 1. */
export function seasonProgress(now: number = Date.now()): number {
  const { start, end } = seasonSpan("N", now);
  return (now - start) / (end - start);
}

/**
 * Quantième du jour de jeu dans la saison, de 1 à `SEASON_DAYS`.
 *
 * Borné, et pas par excès de prudence : la saison ne fait pas un nombre entier
 * de millisecondes de jour de jeu, et sans borne la toute dernière fraction de
 * saison afficherait « jour 8 sur 7 ».
 */
export function dayOfSeason(now: number = Date.now()): number {
  const { start } = seasonSpan("N", now);
  return Math.min(SEASON_DAYS, Math.floor((now - start) / GAME_DAY_MS) + 1);
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
