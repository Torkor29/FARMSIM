/**
 * Le calendrier cultural : quand on sème, et à quelle vitesse ça pousse.
 *
 * Jusqu'ici la pousse était un minuteur. La route de semis écrivait
 * `readyAt = now + growMs`, et `cropGrowMs()` ne prenait en argument ni la
 * saison, ni la météo, ni la région : la date de récolte était **gravée au
 * moment où l'on semait**. Un blé semé le 2 janvier levait exactement à la
 * vitesse d'un blé d'avril, et les quatre saisons — pourtant présentes,
 * peintes dans le ciel et lisibles dans les cours — ne touchaient pas un seul
 * épi. Il n'existait aucun endroit où une gelée aurait pu s'appliquer.
 *
 * Ce module donne à la saison prise sur la culture, de deux façons qui se
 * complètent :
 *
 * - **une fenêtre de semis** par culture. On ne sème pas du maïs en novembre ;
 *   le jeu le refuse, comme le fait Farming Simulator, et comme le fait la
 *   terre ;
 * - **une vitesse de pousse** qui dépend de la saison et du temps qu'il fait.
 *   Semer au bon moment n'est plus une formalité mais le premier arbitrage de
 *   la campagne : un semis tardif se fait rattraper par l'hiver et attend le
 *   printemps.
 *
 * ## Pourquoi rien de tout cela n'a besoin d'être stocké
 *
 * La météo est déjà une fonction pure de la zone et du quantième de jour
 * (`weatherForDay`), et la saison une fonction pure de l'hémisphère et de
 * l'instant (`currentSeason`). La trajectoire complète d'une culture est donc
 * **calculable d'avance et exacte** : on intègre une fois au semis, on obtient
 * une date de maturité qui ne sera jamais démentie, et aucun tick n'a besoin
 * de parcourir les cases. C'est ce qui rend ce changement peu coûteux malgré
 * sa portée.
 *
 * @see docs/research/03_AGRICULTURE_REALISM.md §3 — calendriers par hémisphère
 */

import type { WeatherState } from "./climate.js";
import type { CropCode } from "./crops.js";
import type { Season } from "./world.js";

/**
 * Le comportement saisonnier d'une culture.
 *
 * Trois familles suffisent à couvrir les six cultures du jeu, et elles
 * correspondent à un vrai découpage agronomique — c'est ce qui rend le modèle
 * extensible sans table à rallonge.
 */
export type Seasonality = "WINTER_CEREAL" | "SPRING_CROP" | "FORAGE";

export const SEASONALITY_LABELS: Record<Seasonality, string> = {
  WINTER_CEREAL: "céréale d’hiver",
  SPRING_CROP: "culture de printemps",
  FORAGE: "fourrage",
};

/**
 * À quelle famille appartient chaque culture `[RÉEL]`.
 *
 * Blé, orge et colza se sèment à l'automne et passent l'hiver au champ : ils
 * tallent lentement sous le froid, puis repartent au printemps. Maïs et pois
 * se sèment au printemps, quand le sol atteint dix degrés, et gèlent l'hiver.
 * L'herbe pousse dès qu'il ne gèle pas.
 */
export const CROP_SEASONALITY: Record<CropCode, Seasonality> = {
  WHEAT: "WINTER_CEREAL",
  BARLEY: "WINTER_CEREAL",
  RAPE: "WINTER_CEREAL",
  MAIZE: "SPRING_CROP",
  PEA: "SPRING_CROP",
  GRASS: "FORAGE",
};

/**
 * Saisons où le semis est autorisé `[GD]`.
 *
 * Volontairement plus large que le calendrier réel, qui se compte en semaines :
 * une saison dure dix heures, et n'ouvrir qu'une seule saison enfermerait le
 * joueur dans une fenêtre de dix heures — soit, pour qui joue une soirée par
 * jour, une chance sur deux de la manquer entièrement. Deux saisons laissent
 * le choix — semer tôt et sûr, ou tard et rattraper le cours du marché — sans
 * que tout soit permis.
 */
export const PLANTING_WINDOW: Record<CropCode, readonly Season[]> = {
  WHEAT: ["AUTUMN", "WINTER"],
  BARLEY: ["AUTUMN", "WINTER"],
  RAPE: ["SUMMER", "AUTUMN"],
  MAIZE: ["SPRING", "SUMMER"],
  PEA: ["SPRING", "SUMMER"],
  GRASS: ["SPRING", "AUTUMN"],
};

/**
 * Vitesse de pousse selon la saison, par famille `[GD]`.
 *
 * Le facteur multiplie le temps écoulé : à 1,3 une journée de jeu en vaut 1,3
 * de croissance, à 0,3 elle n'en vaut qu'un tiers. Les céréales d'hiver sont
 * les seules à pousser encore quand il gèle, ce qui est exact — c'est même
 * leur raison d'être.
 *
 * Calibré avec les temps de pousse, et non contre eux : ces coefficients et les
 * `growMs` de `CROP_DEFS` ont été cherchés ensemble pour que chaque culture
 * arrive à maturité **dans la saison où on la moissonne pour de vrai**. Le blé
 * semé à l'automne traverse l'hiver au ralenti — 0,3, ce qui est exact, c'est
 * même la raison d'être d'une céréale d'hiver — repart au printemps et se
 * moissonne l'été, trente-trois heures plus tard.
 *
 * Le maïs fait l'inverse : 0,05 en hiver, autant dire rien. Semé trop tard au
 * printemps, il entre dans l'automne sans avance et l'hiver le fige jusqu'au
 * printemps suivant. C'est l'arbitrage que la fenêtre de semis laisse ouvert.
 *
 * Le tableau qu'en tire `cropCalendar()` n'est pas écrit à la main : il fait
 * réellement pousser chaque culture avec ces coefficients. Retoucher une
 * valeur ici déplace le calendrier affiché, et les tests le disent.
 */
export const SEASON_GROWTH: Record<Seasonality, Record<Season, number>> = {
  WINTER_CEREAL: { SPRING: 1.35, SUMMER: 1.05, AUTUMN: 0.85, WINTER: 0.3 },
  SPRING_CROP: { SPRING: 1.2, SUMMER: 1.3, AUTUMN: 0.5, WINTER: 0.05 },
  FORAGE: { SPRING: 1.3, SUMMER: 1, AUTUMN: 0.7, WINTER: 0.1 },
};

/**
 * Ce que le temps du jour fait à la pousse `[GD]`.
 *
 * Modeste devant la saison, et c'est voulu : la météo tient la journée, la
 * saison tient la semaine. Une pluie de printemps accélère un peu, un orage
 * couche la culture, la neige l'arrête presque.
 */
export const WEATHER_GROWTH: Record<WeatherState, number> = {
  CLEAR: 1,
  CLOUDY: 0.95,
  RAIN: 1.15,
  STORM: 0.7,
  SNOW: 0.25,
};

/** Vitesse de pousse d'une culture, un jour donné. */
export function growthRate(crop: CropCode, season: Season, weather?: WeatherState): number {
  const saison = SEASON_GROWTH[CROP_SEASONALITY[crop]][season];
  const ciel = weather ? WEATHER_GROWTH[weather] : 1;
  return Math.round(saison * ciel * 1000) / 1000;
}

export type SowingVerdict =
  | { ok: true }
  | { ok: false; reason: string; window: readonly Season[] };

const SEASON_FR: Record<Season, string> = {
  SPRING: "au printemps",
  SUMMER: "en été",
  AUTUMN: "à l’automne",
  WINTER: "en hiver",
};

/** Les saisons de semis, écrites pour être lues. */
export function windowLabel(crop: CropCode): string {
  const saisons = PLANTING_WINDOW[crop].map((s) => SEASON_FR[s]);
  if (saisons.length === 1) return saisons[0]!;
  return `${saisons.slice(0, -1).join(", ")} ou ${saisons[saisons.length - 1]}`;
}

/**
 * Peut-on semer cette culture à cette saison ?
 *
 * À ne pas confondre avec `canSow` du module sol, qui répond à l'autre moitié
 * de la question : celle-ci regarde la date, l'autre regarde la terre — les
 * chaumes en place et le tassement.
 *
 * Le refus porte sa raison : un message qui dit seulement « non » oblige le
 * joueur à deviner la règle, et une règle qu'on devine n'est pas une décision.
 */
export function canSowInSeason(crop: CropCode, season: Season): SowingVerdict {
  const window = PLANTING_WINDOW[crop];
  if (window.includes(season)) return { ok: true };
  return {
    ok: false,
    reason: `Hors saison — cette culture se sème ${windowLabel(crop)}.`,
    window,
  };
}
