/**
 * Le temps du jeu — jour, saison, année.
 *
 * ## Les deux réglages
 *
 * `SEASON_REAL_HOURS`, la longueur d'une saison de végétation, et
 * `WINTER_DAYS`, celle de l'hiver. Tout le reste s'en déduit. Le calendrier
 * tournait sur la semaine réelle — lundi le printemps, dimanche l'hiver — et
 * c'était une porte fermée : qui ne joue que le week-end ne voyait qu'automne
 * et hiver, à vie, et ne pouvait donc jamais semer la moitié du catalogue. Les
 * saisons glissent maintenant dans la journée et personne n'est enfermé nulle
 * part.
 *
 * ## Les deux échelles, et laquelle commande l'autre
 *
 * Le jeu se compte en **jours de jeu** : la pousse, la gestation, les
 * intérêts, la péremption, la dérive des cours, tout est libellé en jours.
 * Toutes ces valeurs ont été calibrées sur une règle unique, jamais écrite
 * mais partout supposée — **une saison de végétation fait sept jours de
 * jeu**. Les intérêts d'une saison valent sept jours d'intérêts
 * (`credit.ts`), un pré nourrit sept cycles d'élevage, un jeune met sept
 * cycles à grandir.
 *
 * L'hiver en fait quatre, et cela ne décale rien : un jour de jeu y dure
 * exactement ce qu'il dure ailleurs. Ce qui change, c'est leur **nombre**.
 *
 * C'est donc le jour de jeu qui se déduit de la saison, et non l'inverse :
 *
 *     1 saison pleine = SEASON_DAYS jours de jeu = SEASON_REAL_HOURS heures
 *     1 hiver         = WINTER_DAYS jours de jeu
 *     1 année         = 3 saisons pleines + 1 hiver = 25 jours de jeu
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
 * ## La règle, et elle porte sur l'année, pas sur la saison
 *
 * Ce qui enferme un joueur, c'est que sa position dans l'**année** revienne
 * toujours à la même place : il retrouve alors la même saison à son créneau,
 * indéfiniment. La quantité à surveiller est donc `REAL_DAY_MS / YEAR_MS`,
 * l'avance d'une journée réelle exprimée en années de jeu. Réduite en
 * fraction `p/q`, elle fait parcourir `q / pgcd(p, q)` positions distinctes —
 * il en faut assez, et bien réparties, pour que les quatre saisons y passent.
 *
 * Second piège, plus discret : la même vérification sur la **semaine**, pour
 * le joueur d'un seul soir. C'est elle qui disqualifiait 7 h et 14 h du temps
 * où les saisons étaient égales, alors que la vérification quotidienne les
 * laissait passer.
 *
 * Avec une saison de 10 h et un hiver de quatre jours, l'année fait 25 jours
 * de jeu, soit 35 h 43. Un jour réel avance de 84/125 d'année, une semaine de
 * 88/125 ; 84 et 88 sont premiers avec 125, donc les deux habitudes
 * parcourent 125 positions avant de se répéter. C'est très au-delà du
 * nécessaire.
 *
 * Un test tient ces deux propriétés, et il ne les vérifie pas sur une
 * formule : il rejoue l'habitude d'un joueur réel et regarde ce qu'il a le
 * droit de semer. Changer ce nombre — ou `WINTER_DAYS` — sans le regarder
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

/** L'ordre des saisons. Le cycle, et rien d'autre. */
export const SEASON_CYCLE: readonly Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

/**
 * Jours de jeu dans un hiver. **Le seul endroit où les saisons diffèrent.**
 *
 * ## Pourquoi il redevient court
 *
 * Il l'était à l'origine — « il ne s'y passe rien » —, puis il a été ramené à
 * sept jours en même temps qu'on décrochait le calendrier de la semaine
 * réelle. La raison invoquée alors n'était pas que l'hiver méritait sept
 * jours : c'est que la seule implémentation de saisons inégales à portée de
 * main était une **table indexée par jour de semaine**, qui imposait un pas
 * d'un jour entier et ramenait donc le calage sur la semaine — la porte
 * fermée qu'on venait de rouvrir.
 *
 * Cette raison-là n'existe plus. Ce qui suit ne consulte aucun jour de
 * semaine : l'année est une suite d'intervalles de longueurs quelconques, et
 * la saison se trouve par un modulo sur la position dans l'année. Les deux
 * propriétés qui protègent le joueur régulier se vérifient sur la longueur de
 * l'**année** (voir plus bas), pas sur celle des saisons.
 *
 * ## Pourquoi quatre
 *
 * Un hiver de quatre jours dure 5 h 43 réelles au lieu de 10 h. C'est assez
 * pour qu'un blé d'hiver traverse encore une morte-saison — sa pousse y tombe
 * à 0,3 —, et assez court pour qu'un joueur du soir ne tombe pas deux
 * sessions de suite sur la seule saison où son champ n'avance pas.
 *
 * L'année passe ainsi de 28 à 25 jours de jeu, soit 35 h 43 réelles. Ce nombre
 * n'est pas anodin : c'est lui, et non plus la saison, qui décide si le
 * calendrier glisse. Un test le tient.
 */
export const WINTER_DAYS = 4;

/**
 * Longueur de chaque saison, en jours de jeu.
 *
 * Trois saisons pleines et un hiver court. Le **jour de jeu**, lui, ne change
 * pas de longueur : c'est le nombre de jours qui diffère, pas leur durée. Rien
 * de ce qui est libellé en jours — intérêts, gestation, péremption, pousse —
 * ne se décale donc les uns par rapport aux autres ; il y a simplement moins
 * de jours dans un hiver.
 */
export const SEASON_LENGTH_DAYS: Readonly<Record<Season, number>> = {
  SPRING: SEASON_DAYS,
  SUMMER: SEASON_DAYS,
  AUTUMN: SEASON_DAYS,
  WINTER: WINTER_DAYS,
};

/**
 * Durée d'un jour de jeu, en temps réel `[GD]`. **Déduite**, plus réglée.
 *
 * Elle valait six heures, choisies pour faire tomber l'année sur exactement
 * sept jours réels — c'est-à-dire pour caler le jeu sur la semaine, ce qu'on
 * vient précisément de défaire. Un septième de saison pleine, soit environ
 * une heure vingt-six. C'est **la seule durée qui ne change pas d'une saison
 * à l'autre** : un hiver court, c'est moins de jours, pas des jours plus
 * courts.
 *
 * La division ne tombe pas rond en millisecondes, et il n'y a aucune raison
 * qu'elle tombe rond : rien ici ne compte en millisecondes entières, et
 * arrondir ferait dériver les frontières de jour hors de leur saison.
 */
export const GAME_DAY_MS = SEASON_REAL_MS / SEASON_DAYS;

/** Jours de jeu dans un jour réel. */
export const GAME_DAYS_PER_REAL_DAY = REAL_DAY_MS / GAME_DAY_MS;

/** Jours de jeu dans une année. Vingt-cinq : trois saisons pleines et un hiver. */
export const YEAR_DAYS = SEASON_CYCLE.reduce((n, s) => n + SEASON_LENGTH_DAYS[s], 0);

/**
 * Durée d'une année de jeu, en temps réel.
 *
 * **C'est ce nombre-là qui décide si le calendrier glisse**, et non plus la
 * longueur d'une saison. Voir le commentaire de `SEASON_REAL_HOURS` : les deux
 * pièges — le joueur d'un créneau quotidien, le joueur d'un soir par semaine —
 * portent sur le rapport entre l'année et le jour réel.
 *
 * Ici : 25 × (10 h ÷ 7) = 35 h 43. Un jour réel avance de 84/125 d'année,
 * une semaine de 88/125 — et 84 comme 88 sont premiers avec 125, donc les
 * deux habitudes parcourent 125 positions distinctes avant de se répéter. Les
 * quatre saisons y passent, hiver compris (il occupe 16 % de l'année, soit
 * une vingtaine de ces positions).
 */
export const YEAR_MS = YEAR_DAYS * GAME_DAY_MS;

/** Jours réels dans une année de jeu. Se déduit, ne se règle plus. */
export const YEAR_REAL_DAYS = YEAR_MS / REAL_DAY_MS;

/**
 * Durée d'une saison **pleine**, en temps réel.
 *
 * Le nom vient d'une époque où les quatre étaient égales ; il désigne
 * désormais la longueur des trois saisons de végétation, et sert surtout de
 * repère d'ordre de grandeur (« ce blé tient deux saisons »). Pour la durée
 * réelle de la saison en cours, c'est `seasonSpan` qu'il faut appeler —
 * l'hiver ne dure pas ça.
 */
export const SEASON_DURATION_MS = SEASON_REAL_MS;

/** Longueur d'une saison donnée, en jours de jeu. */
export function seasonLengthDays(season: Season = "SPRING"): number {
  return SEASON_LENGTH_DAYS[season] ?? SEASON_DAYS;
}

/** Durée réelle d'une saison donnée, en millisecondes. */
export function seasonDurationMs(season: Season): number {
  return seasonLengthDays(season) * GAME_DAY_MS;
}

/**
 * Début de chaque saison dans l'année, en millisecondes depuis son ouverture.
 *
 * Quatre bornes cumulées, calculées une fois. C'est tout ce qui remplace
 * l'ancienne table indexée par jour de semaine — et la différence tient en
 * ceci : ces bornes ne connaissent que des millisecondes, jamais un jour du
 * calendrier réel.
 */
const DEBUTS_DE_SAISON: readonly number[] = SEASON_CYCLE.reduce<number[]>(
  (acc, s, i) => [...acc, (acc[i] ?? 0) + seasonDurationMs(s)],
  [0],
);

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
 * Décalage de l'hémisphère sud, en millisecondes.
 *
 * ## Ce qui a changé, et ce qu'il faut savoir avant de le lire
 *
 * Tant que les quatre saisons duraient le même temps, le sud se déduisait du
 * nord en **renommant** : on décalait de deux rangs, ce qui donnait
 * l'opposition exacte — hiver au nord, été au sud, à la milliseconde près.
 *
 * Un hiver plus court rend cette opposition-là impossible, et c'est
 * arithmétique, pas un défaut d'implémentation : renommer l'intervalle où le
 * nord hiverne donnerait au sud un **été de quatre jours**, et à son hiver les
 * sept jours de l'été du nord. L'hémisphère sud paierait le confort du nord.
 * Aucun choix de longueurs n'évite cela, sauf à rendre l'été aussi court que
 * l'hiver.
 *
 * ## Ce qu'on fait à la place
 *
 * Les deux hémisphères lisent la **même** suite d'intervalles — trois saisons
 * pleines et un hiver court — mais le sud la lit avec une avance de deux
 * saisons de temps, c'est-à-dire quatorze jours de jeu. Chacun a donc son
 * propre hiver court et ses propres étés pleins.
 *
 * L'opposition tient alors sur trois quarts de l'année : printemps nord contre
 * automne sud, automne nord contre printemps sud, hiver nord contre été sud.
 * Elle se déchire sur le quart restant — l'été du nord, sept jours, couvre les
 * quatre jours de l'hiver du sud puis trois jours de son printemps. C'est la
 * couture, et elle est le prix de l'hiver court. Un test la nomme plutôt que
 * de faire semblant qu'elle n'existe pas.
 */
const DECALAGE_SUD_MS = DEBUTS_DE_SAISON[2]!;

/** Position dans l'année, de 0 à `YEAR_MS`, pour l'hémisphère demandé. */
function positionDansAnnee(now: number, hemisphere: "N" | "S"): number {
  const t = now + (hemisphere === "S" ? DECALAGE_SUD_MS : 0);
  return ((t % YEAR_MS) + YEAR_MS) % YEAR_MS;
}

/** Le rang de la saison qui occupe une position donnée dans l'année. */
function rangDansAnnee(position: number): number {
  for (let i = SEASON_CYCLE.length - 1; i > 0; i--) {
    if (position >= DEBUTS_DE_SAISON[i]!) return i;
  }
  return 0;
}

/**
 * Le rang de la saison en cours dans le cycle, depuis l'origine des temps.
 *
 * Quatre rangs par année, et l'année se compte par un quotient : c'est ce qui
 * fait glisser les saisons dans la journée au lieu de les y clouer. Le rang
 * est celui de l'hémisphère nord, qui sert de référence au calendrier des
 * cultures ; le sud lit la même suite avec un décalage de temps.
 */
export function seasonIndex(now: number = Date.now()): number {
  const annee = Math.floor(now / YEAR_MS);
  return annee * SEASON_CYCLE.length + rangDansAnnee(positionDansAnnee(now, "N"));
}

/** La saison occupant un rang donné du cycle. */
export function seasonOfIndex(rang: number): Season {
  const n = SEASON_CYCLE.length;
  return SEASON_CYCLE[((rang % n) + n) % n]!;
}

/**
 * Instant où commence la saison de rang donné, en temps réel.
 *
 * Sert au calendrier des cultures, qui raisonne sur une année abstraite plutôt
 * que sur l'horloge : il lui faut pouvoir dire « le début de la troisième
 * saison » sans savoir laquelle on vit.
 */
export function seasonStartOfIndex(rang: number): number {
  const n = SEASON_CYCLE.length;
  const annee = Math.floor(rang / n);
  return annee * YEAR_MS + DEBUTS_DE_SAISON[((rang % n) + n) % n]!;
}

/** La saison à un instant donné, par hémisphère. */
export function seasonAt(now: number = Date.now(), hemisphere: "N" | "S" = "N"): Season {
  return seasonOfIndex(rangDansAnnee(positionDansAnnee(now, hemisphere)));
}

/**
 * Bornes réelles de la saison en cours.
 *
 * L'hémisphère compte désormais : les saisons n'ayant plus toutes la même
 * longueur, le sud ne se contente plus de renommer l'intervalle du nord — il
 * lit sa propre suite, décalée. Deux additions tout de même, sans recherche :
 * on retranche la position dans l'année pour retomber sur son ouverture, puis
 * on ajoute les bornes de la saison. Le décalage sud s'annule dans l'opération.
 */
export function seasonSpan(
  hemisphere: "N" | "S" = "N",
  now: number = Date.now(),
): { start: number; end: number } {
  const position = positionDansAnnee(now, hemisphere);
  const rang = rangDansAnnee(position);
  const ouverture = now - position;
  return {
    start: ouverture + DEBUTS_DE_SAISON[rang]!,
    end: ouverture + DEBUTS_DE_SAISON[rang + 1]!,
  };
}

/** Part de la saison en cours déjà écoulée, 0 → 1. */
export function seasonProgress(now: number = Date.now(), hemisphere: "N" | "S" = "N"): number {
  const { start, end } = seasonSpan(hemisphere, now);
  return (now - start) / (end - start);
}

/**
 * Quantième du jour de jeu dans la saison, de 1 à sa longueur.
 *
 * Borné, et pas par excès de prudence : la saison ne fait pas un nombre entier
 * de millisecondes de jour de jeu, et sans borne la toute dernière fraction de
 * saison afficherait « jour 8 sur 7 ».
 */
export function dayOfSeason(now: number = Date.now(), hemisphere: "N" | "S" = "N"): number {
  const { start } = seasonSpan(hemisphere, now);
  return Math.min(
    seasonLengthDays(seasonAt(now, hemisphere)),
    Math.floor((now - start) / GAME_DAY_MS) + 1,
  );
}

/** Temps restant avant le changement de saison, en millisecondes réelles. */
export function msUntilNextSeason(now: number = Date.now(), hemisphere: "N" | "S" = "N"): number {
  return seasonSpan(hemisphere, now).end - now;
}

/**
 * La prochaine frontière de saison strictement après `now`.
 *
 * Existe pour la simulation de pousse, qui découpe son intégration aux
 * frontières de saison : elle calculait cette borne elle-même, par un quotient
 * qui supposait les quatre saisons égales. Deux copies d'une même règle, dont
 * une seule savait que l'hiver est court, auraient fait pousser les cultures
 * à la vitesse de l'hiver en plein printemps — sans que rien ne le signale.
 */
export function nextSeasonBoundary(now: number, hemisphere: "N" | "S" = "N"): number {
  return seasonSpan(hemisphere, now).end;
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
