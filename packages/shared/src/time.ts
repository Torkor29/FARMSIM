/**
 * Le temps du jeu — jour, semaine, saison, année.
 *
 * Il n'existait aucune horloge commune. Chaque module posait sa propre durée
 * dans son coin, et deux d'entre elles se sont retrouvées égales sans que
 * personne l'ait décidé : `LIVESTOCK_CYCLE_MS` valait quinze minutes, et
 * `SEASON_DURATION_MS` aussi. **Une saison durait donc exactement un jour de
 * jeu**, et l'année entière une heure. On passait de l'été à l'hiver le temps
 * de traire une fois, ce qui ne laissait aucune place à une activité de
 * saison — ni à la sensation d'en vivre une.
 *
 * Ce module pose l'unité manquante et fait dériver tout le reste :
 *
 *     1 jour  = GAME_DAY_MS
 *     1 saison = SEASON_DAYS jours   (une semaine)
 *     1 année  = 4 saisons
 *
 * Les autres modules importent d'ici plutôt que de reposer une constante.
 * Une durée dérivée ne peut pas se désynchroniser d'une autre.
 */

/**
 * Durée d'un jour de jeu, en temps réel `[GD]`.
 *
 * Quinze minutes : c'est la valeur qui servait déjà de cycle d'élevage, et
 * elle est bonne — une traite par quart d'heure donne au joueur de quoi faire
 * sans l'enchaîner. Ce qui manquait n'était pas un autre jour, c'était de ne
 * pas confondre le jour avec la saison.
 */
export const GAME_DAY_MS = 15 * 60 * 1000;

/**
 * Jours dans une saison `[GD]` — une semaine.
 *
 * Sept jours, parce que c'est la durée que le joueur sait se représenter :
 * « cette semaine, c'est l'hiver » se planifie, « les quinze prochaines
 * minutes, c'est l'hiver » se subit. Chaque saison laisse ainsi la place à
 * sept cycles d'élevage, sept jours de pousse, sept météos — assez pour que
 * semer, engranger puis passer l'hiver soient trois moments distincts.
 */
export const SEASON_DAYS = 7;

/** Durée d'une saison en temps réel `[GD]` — une semaine de jeu. */
export const SEASON_DURATION_MS = SEASON_DAYS * GAME_DAY_MS;

/** Durée d'une année de jeu : quatre saisons. */
export const YEAR_MS = 4 * SEASON_DURATION_MS;

/** Numéro du jour de jeu depuis l'origine — sert de graine à la météo. */
export function gameDayIndex(now: number = Date.now()): number {
  return Math.floor(now / GAME_DAY_MS);
}

/** Quantième du jour dans la saison, de 1 à `SEASON_DAYS`. */
export function dayOfSeason(now: number = Date.now()): number {
  return (gameDayIndex(now) % SEASON_DAYS) + 1;
}

/** Part de la saison déjà écoulée, 0 → 1. */
export function seasonProgress(now: number = Date.now()): number {
  return (now % SEASON_DURATION_MS) / SEASON_DURATION_MS;
}

/** Part du jour déjà écoulée, 0 → 1. */
export function dayProgress(now: number = Date.now()): number {
  return (now % GAME_DAY_MS) / GAME_DAY_MS;
}

/** Temps restant avant le changement de saison, en millisecondes réelles. */
export function msUntilNextSeason(now: number = Date.now()): number {
  return SEASON_DURATION_MS - (now % SEASON_DURATION_MS);
}
