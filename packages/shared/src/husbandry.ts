/**
 * Environnement de l'animal — lieu de vie, pâture et confort thermique.
 *
 * C'est le chaînon qui manquait. La simulation du troupeau ne lisait ni la
 * météo, ni la saison, ni la température : elle ne connaissait que la ration,
 * la litière, la fosse et l'entassement. Trois conséquences, toutes visibles
 * en jouant :
 *
 * 1. **Sortir les bêtes ne les nourrissait pas.** Le pâturage appliquait un
 *    coefficient de 0,65 sur la ration stockée — une remise de 35 %, pas une
 *    source de nourriture. Une vache au pré mangeait le foin du hangar.
 * 2. **« Dehors » n'était pas un état** mais une séance de trois à six heures,
 *    par vagues de huit bêtes, avec vingt heures de délai. Le reste du temps,
 *    tout le monde était à l'étable, en juillet comme en janvier.
 * 3. **Un hiver dehors valait un été dehors.** La météo n'était consultée
 *    qu'à l'ouverture de la porte ; un orage qui éclatait ensuite ne faisait
 *    rien.
 *
 * Ce module fournit les trois entrées manquantes. Il ne crée **aucune**
 * nouvelle chaîne de conséquences : tout débouche sur la pénalité de
 * bien-être, qui pilote déjà production, reproduction et mortalité.
 *
 * Tout est pur — aucune horloge, aucune base — comme le reste du domaine.
 */

import type { AnimalKind, WeatherState } from "./livestock.js";
import { SPECIES } from "./species.js";
import type { Season } from "./world.js";

/* ------------------------------------------------------------------ */
/* 1. Lieu de vie                                                      */
/* ------------------------------------------------------------------ */

/**
 * Où vit le troupeau, durablement.
 *
 * C'est un état que le joueur choisit et qui persiste, pas une séance. La
 * sortie minutée d'avant demeure — elle est devenue l'animation de la
 * transition, pas le mécanisme.
 */
export type Housing = "INSIDE" | "OUTSIDE";

export const DEFAULT_HOUSING: Housing = "INSIDE";

export function parseHousing(value: string | null | undefined): Housing {
  return value === "OUTSIDE" ? "OUTSIDE" : "INSIDE";
}

/* ------------------------------------------------------------------ */
/* 2. Température                                                      */
/* ------------------------------------------------------------------ */

/**
 * Température de saison, en degrés `[GD]`.
 *
 * Le jeu n'avait aucune température. Plutôt que d'ajouter une donnée à
 * stocker et à faire migrer, on la **dérive** de ce qui existe déjà : la
 * saison et la météo, toutes deux calculées et persistées. Une valeur dérivée
 * ne peut pas se désynchroniser, et coûte zéro colonne.
 */
export const SEASON_TEMP_C: Record<Season, number> = {
  SPRING: 12,
  SUMMER: 24,
  AUTUMN: 11,
  // L'hiver était posé à +1 °C. Avec la neige (−9) on tombait à −8, soit
  // trois degrés sous le confort d'une vache : une pénalité de 0,10 sur 0,45
  // possible. Autant dire que laisser le troupeau dehors tout l'hiver ne
  // coûtait presque rien, et la décision que le froid devait créer n'existait
  // pas. Le test d'équilibrage l'a attrapé — pas une partie jouée.
  WINTER: -2,
};

/** Écart apporté par le temps qu'il fait `[GD]`. */
export const WEATHER_TEMP_SHIFT_C: Record<WeatherState, number> = {
  CLEAR: 3,
  CLOUDY: 0,
  RAIN: -3,
  STORM: -5,
  SNOW: -9,
};

/** Température ressentie dehors, saison et météo confondues. */
export function outdoorTempC(season: Season, weather: WeatherState): number {
  return SEASON_TEMP_C[season] + (WEATHER_TEMP_SHIFT_C[weather] ?? 0);
}

/**
 * Température ressentie par un lot, selon qu'il est dedans ou dehors.
 *
 * Un bâtiment ne chauffe pas : il **tempère**. Il rapproche du confort de
 * l'espèce d'une fraction de l'écart — d'autant plus qu'il est bon, et un
 * bâtiment amélioré tempère mieux. C'est ce qui donne une raison de monter
 * son étable en niveau autre que la capacité.
 */
export function feltTempC(input: {
  kind: AnimalKind;
  housing: Housing;
  season: Season;
  weather: WeatherState;
  /** Niveau du bâtiment, 1 à 5. */
  barnLevel?: number;
}): number {
  const dehors = outdoorTempC(input.season, input.weather);
  if (input.housing === "OUTSIDE") return dehors;

  const profil = SPECIES[input.kind];
  const niveau = Math.max(1, Math.min(5, Math.round(input.barnLevel ?? 1)));
  // Le confort visé : le milieu de la plage supportable de l'espèce.
  const vise = (profil.comfortMinC + profil.comfortMaxC) / 2;
  // Un bâtiment de niveau 5 tempère un quart de mieux qu'un niveau 1.
  const abri = Math.min(0.95, profil.shelterRelief * (1 + 0.06 * (niveau - 1)));
  return dehors + (vise - dehors) * abri;
}

/** Pénalité de bien-être maximale imposée par le froid ou la chaleur `[GD]`. */
export const THERMAL_MAX_PENALTY = 0.45;

/**
 * Écart, en degrés, au-delà duquel la pénalité est à son maximum `[GD]`.
 *
 * Ramené de 14 à 12 : avec 14, il fallait un écart irréaliste pour approcher
 * le maximum, et toute la plage utile se tassait dans le premier quart de
 * l'échelle.
 */
export const THERMAL_FULL_SPAN_C = 12;

/**
 * Pénalité de bien-être due à la température, entre 0 et `THERMAL_MAX_PENALTY`.
 *
 * Nulle tant que la bête est dans sa plage de confort, puis croissante avec
 * l'écart. Elle se branche sur `happinessTarget`, exactement comme la faim et
 * la litière — donc elle mord sur le lait, puis sur la reproduction, puis sur
 * la mortalité, sans qu'aucune de ces trois chaînes ait à être écrite.
 */
export function thermalPenalty(input: { kind: AnimalKind; tempC: number }): number {
  const profil = SPECIES[input.kind];
  const ecart =
    input.tempC < profil.comfortMinC
      ? profil.comfortMinC - input.tempC
      : input.tempC > profil.comfortMaxC
        ? input.tempC - profil.comfortMaxC
        : 0;
  if (ecart <= 0) return 0;
  return THERMAL_MAX_PENALTY * Math.min(1, ecart / THERMAL_FULL_SPAN_C);
}

/** Le lot souffre-t-il assez pour qu'on le signale au joueur ? */
export function thermalAlert(penalty: number): "none" | "warn" | "danger" {
  if (penalty >= THERMAL_MAX_PENALTY * 0.6) return "danger";
  if (penalty > 0.05) return "warn";
  return "none";
}

/* ------------------------------------------------------------------ */
/* 3. Pâture                                                           */
/* ------------------------------------------------------------------ */

/**
 * Charge d'un enclos, en bêtes par case `[GD]`.
 *
 * Recopié de `PADDOCK.capacityPerCell` (`livestock.ts`) : l'importer d'ici
 * créerait un cycle, `livestock.ts` important déjà `species.ts` qui importe le
 * type de celui-ci. Un test tient les deux valeurs égales — tout le calibrage
 * du pré se lit par rapport à cette charge, et les laisser diverger rendrait
 * les trois constantes qui suivent fausses sans qu'aucune ne bouge.
 */
export const PADDOCK_ANIMALS_PER_CELL = 2;

/**
 * Herbe qu'une bête au pré prélève par cycle, en tonnes `[GD]`.
 *
 * **L'unité de tout ce qui suit.** La pousse et la réserve se lisent en
 * multiples de cet ingéré, ce qui rend le calibrage lisible d'un coup d'œil :
 * une case qui pousse à `0,048` nourrit 2,4 bêtes, une réserve de `0,32`
 * tient seize cycles d'une bête.
 *
 * ## Pourquoi 0,035 était devenu faux
 *
 * Ce chiffre a été calé quand un cycle d'élevage durait **six heures
 * réelles**. Depuis le passage aux saisons de dix heures, le cycle suit
 * `GAME_DAY_MS` et vaut 1 h 25 min 43 s : le même prélèvement « par cycle »
 * se produit donc **4,2 fois plus souvent** à l'horloge murale. Ni la pousse,
 * ni la réserve, ni la charge n'avaient été retouchées, et le pré se vidait
 * d'autant plus vite. Mesuré : à pleine charge en hiver, une réserve pleine
 * durait 4 h 06 réelles — un joueur qui se déconnecte le soir retrouvait un
 * pré à nu.
 *
 * Ramené à 0,02, l'ingéré ne rend pas à lui seul les 4,2× : les deux autres
 * constantes portent le reste, parce que rattraper le facteur sur le seul
 * ingéré aurait rendu le pâturage gratuit (la pousse de printemps aurait
 * nourri 4,5 bêtes par case).
 */
export const GRASS_INTAKE_TONS = 0.02;

/**
 * Herbe d'un enclos, en tonnes par case et par cycle, selon la saison `[GD]`.
 *
 * Se lit en bêtes nourries par case : **2,8 au printemps, 2,4 l'été, 1,2 à
 * l'automne, aucune l'hiver**. L'hiver ne donne rien, et c'est ce qui rend la
 * décision « je les laisse dehors ? » réelle : on ne perd pas seulement du
 * confort, on perd le fourrage gratuit et il faut puiser dans le stock.
 *
 * La moyenne des quatre saisons vaut `1,6` bête par case — c'est
 * `SUSTAINABLE_STOCKING_RATE`, et c'est le vrai réglage de ce tableau. Les
 * valeurs d'avant (0,09 / 0,075 / 0,04 / 0) donnaient 1,46, mais avec un
 * ingéré de 0,035 : la même charge soutenable, sur un pré qui se vidait
 * quatre fois plus vite en temps réel.
 */
export const GRASS_GROWTH: Record<Season, number> = {
  SPRING: 0.056,
  SUMMER: 0.048,
  AUTUMN: 0.024,
  WINTER: 0,
};

/**
 * Charge que le pré nourrit sur une année entière, en bêtes par case `[GD]`.
 *
 * **Dérivée, jamais réglée** : c'est la pousse moyenne des quatre saisons
 * divisée par l'ingéré d'une bête. Elle vaut 1,6 pour une capacité de sortie
 * de 2 — autrement dit, un enclos rempli à **80 %** se nourrit tout seul sur
 * l'année, et un enclos plein ne s'en sort pas sans le hangar.
 *
 * C'est le chiffre qui répond à « le pâturage est-il gratuit ? ». Non : au
 * maximum de ce que l'enclos laisse sortir, le pré perd chaque année 70 % de
 * sa réserve et passe trois cycles à sec. Un test le tient.
 */
export const SUSTAINABLE_STOCKING_RATE =
  (GRASS_GROWTH.SPRING + GRASS_GROWTH.SUMMER + GRASS_GROWTH.AUTUMN + GRASS_GROWTH.WINTER) /
  4 /
  GRASS_INTAKE_TONS;

/**
 * Réserve d'herbe maximale d'un enclos, en tonnes par case `[GD]`.
 *
 * Seize fois l'ingéré d'une bête, soit **huit cycles à pleine charge** — 11 h
 * 26 min réelles sans une seule repousse. C'est la constante qui décide de
 * l'expérience réellement reprochée : elle est le tampon qui sépare deux
 * connexions.
 *
 * ## Le trajet de ce nombre
 *
 * Il valait 0,5, puis 0,35, puis 0,2, et les trois fois pour la même raison :
 * une réserve trop grasse fait traverser l'hiver sans jamais ouvrir le
 * hangar. Sauf que le raisonnement se tenait en **cycles**, et qu'entre-temps
 * un cycle a perdu les trois quarts de sa durée réelle. À 0,2 le tampon
 * valait 4 h 06 à pleine charge, moins qu'une nuit.
 *
 * ## Pourquoi 0,32 et pas davantage
 *
 * Un hiver dure sept cycles. À pleine charge, un tampon de huit cycles laisse
 * 13 % de réserve à la sortie de l'hiver : le joueur voit le fond arriver et
 * doit avoir tranché. Au-delà de douze cycles, l'hiver ne pourrait plus
 * entamer une réserve pleine et la décision disparaîtrait — c'est la borne
 * haute, et 0,32 s'en tient à bonne distance.
 *
 * Rien à migrer : les réserves enregistrées (au plus 0,2 par case) sont
 * simplement sous le nouveau plafond, et se remplissent à la première pousse.
 */
export const GRASS_MAX_PER_CELL = 16 * GRASS_INTAKE_TONS;

/** Capacité d'herbe d'un enclos, en tonnes. */
export function grassCapacity(paddockCells: number): number {
  return Math.max(0, paddockCells) * GRASS_MAX_PER_CELL;
}

/**
 * Fait pousser l'herbe et la fait brouter, sur `cycles` cycles.
 *
 * Renvoie la réserve restante et la part de ration que le pré a réellement
 * couverte. Un pré épuisé — surpâturé, ou l'hiver — ne couvre rien, et le
 * troupeau retombe sur le stock du hangar : c'est le surpâturage, sans avoir
 * à l'inventer comme mécanique séparée.
 */
export function grazePasture(input: {
  /** Réserve d'herbe actuelle, en tonnes. */
  grassTons: number;
  paddockCells: number;
  season: Season;
  /** Bêtes réellement au pré (0 si le lot est rentré, ou s'il ne broute pas). */
  animalsOutside: number;
  cycles: number;
}): { grassTons: number; eatenTons: number; coverage: number } {
  const cap = grassCapacity(input.paddockCells);
  const cycles = Math.max(0, input.cycles);
  const pousse = GRASS_GROWTH[input.season] * Math.max(0, input.paddockCells) * cycles;
  let stock = Math.min(cap, Math.max(0, input.grassTons) + pousse);

  const voulu = GRASS_INTAKE_TONS * Math.max(0, input.animalsOutside) * cycles;
  const mange = Math.min(stock, voulu);
  stock = Math.max(0, stock - mange);

  return {
    grassTons: stock,
    eatenTons: mange,
    // Part du besoin des bêtes sorties que le pré a couverte : c'est elle qui
    // dit combien de ration stockée est épargnée.
    coverage: voulu <= 0 ? 0 : mange / voulu,
  };
}

/**
 * Part de la ration stockée épargnée par le pâturage.
 *
 * Remplace l'ancien `FEED_GRAZING_RATIO` fixe à 0,65 — une remise forfaitaire
 * qui s'appliquait même en hiver sur un pré nu, et qui plafonnait à 35 %
 * même en pleine pousse. Ici, un pré vert couvre **tout** le besoin des bêtes
 * sorties ; un pré épuisé ne couvre rien.
 *
 * Le résultat est borné par la part du troupeau réellement dehors : rentrer
 * la moitié du lot ne peut pas épargner plus de la moitié de la ration.
 */
export function feedSavedByPasture(input: {
  herdSize: number;
  animalsOutside: number;
  coverage: number;
}): number {
  const size = Math.max(1, input.herdSize);
  const part = Math.min(1, Math.max(0, input.animalsOutside) / size);
  return part * Math.min(1, Math.max(0, input.coverage));
}

/** L'espèce tire-t-elle sa nourriture du pré ? Un cochon fouille, il ne pâture pas. */
export function grazesForFood(kind: AnimalKind): boolean {
  return SPECIES[kind].grazes;
}

/* ------------------------------------------------------------------ */
/* 4. Résumé lisible                                                   */
/* ------------------------------------------------------------------ */

/** Ce que l'interface a besoin de savoir sur l'environnement d'un lot. */
export type EnvironmentView = {
  housing: Housing;
  tempC: number;
  outdoorTempC: number;
  thermal: number;
  thermalAlert: "none" | "warn" | "danger";
  grassTons: number;
  grassCapacityTons: number;
  /** Jours de pâture restants au rythme actuel, `null` si le lot est rentré. */
  grassDaysLeft: number | null;
};
