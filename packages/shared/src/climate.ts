/**
 * Climat détaillé du monde : météo par code Köppen, régions complémentaires
 * et facteur de rendement climat × saison.
 *
 * `world.ts` ne distingue que quatre familles Köppen (`weatherOdds`), ce qui
 * rend indiscernables un été méditerranéen et un été océanique. Ce module
 * porte la table fine des 19 codes réellement utilisés par le monde, telle
 * qu'elle est calibrée dans la doc 34 §5.2, et les 12 régions décrites par la
 * doc mais pas encore livrées dans `WORLD`.
 *
 * @see docs/research/34_WORLD_GEOGRAPHY.md §3, §5.2, §8
 */

import type { RegionDef, Season } from "./world.js";

/**
 * Recopié de `index.js` : l'importer d'ici créerait un cycle, puisque
 * `index.ts` réexporte le monde. Toute évolution doit rester synchronisée
 * avec `WeatherState`.
 */
type WeatherState = "CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "SNOW";

type WeatherOdds = Record<WeatherState, number>;

/* ------------------------------------------------------------------ */
/* 1 — Météo par climat Köppen                                         */
/* ------------------------------------------------------------------ */

/**
 * Probabilité qu'un jour-jeu prenne chaque état, par code Köppen et par
 * saison **locale** — l'inversion hémisphérique étant déjà appliquée en
 * amont, la même table sert aux deux hémisphères. `[RÉEL]` : valeurs de la
 * doc 34 §5.2, dérivées des normales climatiques des climats réels.
 *
 * Invariant vérifié : chaque distribution somme exactement à 1.
 */
export const CLIMATE_WEATHER: Record<string, Record<Season, WeatherOdds>> = {
  /* --- Famille A — tropical --------------------------------------- */
  Af: {
    SPRING: { CLEAR: 0.2, CLOUDY: 0.34, RAIN: 0.36, STORM: 0.1, SNOW: 0 },
    SUMMER: { CLEAR: 0.18, CLOUDY: 0.34, RAIN: 0.38, STORM: 0.1, SNOW: 0 },
    AUTUMN: { CLEAR: 0.19, CLOUDY: 0.34, RAIN: 0.37, STORM: 0.1, SNOW: 0 },
    WINTER: { CLEAR: 0.22, CLOUDY: 0.35, RAIN: 0.34, STORM: 0.09, SNOW: 0 },
  },
  Am: {
    SPRING: { CLEAR: 0.3, CLOUDY: 0.3, RAIN: 0.3, STORM: 0.1, SNOW: 0 },
    SUMMER: { CLEAR: 0.1, CLOUDY: 0.28, RAIN: 0.47, STORM: 0.15, SNOW: 0 },
    AUTUMN: { CLEAR: 0.18, CLOUDY: 0.3, RAIN: 0.42, STORM: 0.1, SNOW: 0 },
    WINTER: { CLEAR: 0.5, CLOUDY: 0.28, RAIN: 0.18, STORM: 0.04, SNOW: 0 },
  },
  Aw: {
    SPRING: { CLEAR: 0.4, CLOUDY: 0.28, RAIN: 0.25, STORM: 0.07, SNOW: 0 },
    SUMMER: { CLEAR: 0.18, CLOUDY: 0.3, RAIN: 0.4, STORM: 0.12, SNOW: 0 },
    AUTUMN: { CLEAR: 0.35, CLOUDY: 0.3, RAIN: 0.28, STORM: 0.07, SNOW: 0 },
    WINTER: { CLEAR: 0.65, CLOUDY: 0.23, RAIN: 0.1, STORM: 0.02, SNOW: 0 },
  },

  /* --- Famille B — aride ------------------------------------------ */
  BWh: {
    SPRING: { CLEAR: 0.78, CLOUDY: 0.15, RAIN: 0.05, STORM: 0.02, SNOW: 0 },
    SUMMER: { CLEAR: 0.72, CLOUDY: 0.17, RAIN: 0.07, STORM: 0.04, SNOW: 0 },
    AUTUMN: { CLEAR: 0.8, CLOUDY: 0.14, RAIN: 0.05, STORM: 0.01, SNOW: 0 },
    WINTER: { CLEAR: 0.76, CLOUDY: 0.17, RAIN: 0.06, STORM: 0.01, SNOW: 0 },
  },
  BWk: {
    SPRING: { CLEAR: 0.7, CLOUDY: 0.2, RAIN: 0.07, STORM: 0.03, SNOW: 0 },
    SUMMER: { CLEAR: 0.74, CLOUDY: 0.18, RAIN: 0.06, STORM: 0.02, SNOW: 0 },
    AUTUMN: { CLEAR: 0.72, CLOUDY: 0.2, RAIN: 0.07, STORM: 0.01, SNOW: 0 },
    WINTER: { CLEAR: 0.62, CLOUDY: 0.24, RAIN: 0.06, STORM: 0.01, SNOW: 0.07 },
  },
  BSh: {
    SPRING: { CLEAR: 0.62, CLOUDY: 0.22, RAIN: 0.12, STORM: 0.04, SNOW: 0 },
    SUMMER: { CLEAR: 0.5, CLOUDY: 0.24, RAIN: 0.2, STORM: 0.06, SNOW: 0 },
    AUTUMN: { CLEAR: 0.64, CLOUDY: 0.22, RAIN: 0.12, STORM: 0.02, SNOW: 0 },
    WINTER: { CLEAR: 0.68, CLOUDY: 0.22, RAIN: 0.09, STORM: 0.01, SNOW: 0 },
  },
  BSk: {
    SPRING: { CLEAR: 0.55, CLOUDY: 0.25, RAIN: 0.15, STORM: 0.05, SNOW: 0 },
    SUMMER: { CLEAR: 0.58, CLOUDY: 0.22, RAIN: 0.14, STORM: 0.06, SNOW: 0 },
    AUTUMN: { CLEAR: 0.6, CLOUDY: 0.24, RAIN: 0.14, STORM: 0.02, SNOW: 0 },
    WINTER: { CLEAR: 0.5, CLOUDY: 0.28, RAIN: 0.1, STORM: 0.02, SNOW: 0.1 },
  },

  /* --- Famille C — tempéré ---------------------------------------- */
  Csa: {
    SPRING: { CLEAR: 0.5, CLOUDY: 0.25, RAIN: 0.2, STORM: 0.05, SNOW: 0 },
    SUMMER: { CLEAR: 0.8, CLOUDY: 0.13, RAIN: 0.05, STORM: 0.02, SNOW: 0 },
    AUTUMN: { CLEAR: 0.42, CLOUDY: 0.26, RAIN: 0.26, STORM: 0.06, SNOW: 0 },
    WINTER: { CLEAR: 0.35, CLOUDY: 0.3, RAIN: 0.32, STORM: 0.03, SNOW: 0 },
  },
  Csb: {
    SPRING: { CLEAR: 0.45, CLOUDY: 0.27, RAIN: 0.23, STORM: 0.05, SNOW: 0 },
    SUMMER: { CLEAR: 0.7, CLOUDY: 0.18, RAIN: 0.1, STORM: 0.02, SNOW: 0 },
    AUTUMN: { CLEAR: 0.35, CLOUDY: 0.28, RAIN: 0.32, STORM: 0.05, SNOW: 0 },
    WINTER: { CLEAR: 0.25, CLOUDY: 0.3, RAIN: 0.4, STORM: 0.03, SNOW: 0.02 },
  },
  Cfa: {
    SPRING: { CLEAR: 0.38, CLOUDY: 0.27, RAIN: 0.27, STORM: 0.08, SNOW: 0 },
    SUMMER: { CLEAR: 0.4, CLOUDY: 0.24, RAIN: 0.25, STORM: 0.11, SNOW: 0 },
    AUTUMN: { CLEAR: 0.45, CLOUDY: 0.25, RAIN: 0.25, STORM: 0.05, SNOW: 0 },
    WINTER: { CLEAR: 0.35, CLOUDY: 0.3, RAIN: 0.3, STORM: 0.03, SNOW: 0.02 },
  },
  Cfb: {
    SPRING: { CLEAR: 0.35, CLOUDY: 0.3, RAIN: 0.29, STORM: 0.06, SNOW: 0 },
    SUMMER: { CLEAR: 0.4, CLOUDY: 0.28, RAIN: 0.26, STORM: 0.06, SNOW: 0 },
    AUTUMN: { CLEAR: 0.3, CLOUDY: 0.32, RAIN: 0.33, STORM: 0.05, SNOW: 0 },
    WINTER: { CLEAR: 0.25, CLOUDY: 0.34, RAIN: 0.34, STORM: 0.02, SNOW: 0.05 },
  },
  Cfc: {
    SPRING: { CLEAR: 0.22, CLOUDY: 0.34, RAIN: 0.38, STORM: 0.06, SNOW: 0 },
    SUMMER: { CLEAR: 0.28, CLOUDY: 0.34, RAIN: 0.34, STORM: 0.04, SNOW: 0 },
    AUTUMN: { CLEAR: 0.2, CLOUDY: 0.34, RAIN: 0.4, STORM: 0.04, SNOW: 0.02 },
    WINTER: { CLEAR: 0.16, CLOUDY: 0.34, RAIN: 0.36, STORM: 0.02, SNOW: 0.12 },
  },
  Cwa: {
    SPRING: { CLEAR: 0.42, CLOUDY: 0.26, RAIN: 0.26, STORM: 0.06, SNOW: 0 },
    SUMMER: { CLEAR: 0.22, CLOUDY: 0.28, RAIN: 0.38, STORM: 0.12, SNOW: 0 },
    AUTUMN: { CLEAR: 0.5, CLOUDY: 0.25, RAIN: 0.22, STORM: 0.03, SNOW: 0 },
    WINTER: { CLEAR: 0.66, CLOUDY: 0.22, RAIN: 0.11, STORM: 0.01, SNOW: 0 },
  },
  Cwb: {
    SPRING: { CLEAR: 0.45, CLOUDY: 0.26, RAIN: 0.24, STORM: 0.05, SNOW: 0 },
    SUMMER: { CLEAR: 0.25, CLOUDY: 0.3, RAIN: 0.36, STORM: 0.09, SNOW: 0 },
    AUTUMN: { CLEAR: 0.5, CLOUDY: 0.26, RAIN: 0.21, STORM: 0.03, SNOW: 0 },
    WINTER: { CLEAR: 0.68, CLOUDY: 0.22, RAIN: 0.1, STORM: 0, SNOW: 0 },
  },

  /* --- Famille D — continental ------------------------------------ */
  Dfa: {
    SPRING: { CLEAR: 0.36, CLOUDY: 0.27, RAIN: 0.28, STORM: 0.07, SNOW: 0.02 },
    SUMMER: { CLEAR: 0.45, CLOUDY: 0.23, RAIN: 0.22, STORM: 0.1, SNOW: 0 },
    AUTUMN: { CLEAR: 0.42, CLOUDY: 0.28, RAIN: 0.25, STORM: 0.03, SNOW: 0.02 },
    WINTER: { CLEAR: 0.3, CLOUDY: 0.3, RAIN: 0.1, STORM: 0, SNOW: 0.3 },
  },
  Dfb: {
    SPRING: { CLEAR: 0.34, CLOUDY: 0.28, RAIN: 0.28, STORM: 0.06, SNOW: 0.04 },
    SUMMER: { CLEAR: 0.42, CLOUDY: 0.26, RAIN: 0.24, STORM: 0.08, SNOW: 0 },
    AUTUMN: { CLEAR: 0.36, CLOUDY: 0.3, RAIN: 0.26, STORM: 0.03, SNOW: 0.05 },
    WINTER: { CLEAR: 0.24, CLOUDY: 0.3, RAIN: 0.07, STORM: 0, SNOW: 0.39 },
  },
  Dfc: {
    SPRING: { CLEAR: 0.28, CLOUDY: 0.3, RAIN: 0.24, STORM: 0.04, SNOW: 0.14 },
    SUMMER: { CLEAR: 0.38, CLOUDY: 0.28, RAIN: 0.28, STORM: 0.06, SNOW: 0 },
    AUTUMN: { CLEAR: 0.28, CLOUDY: 0.3, RAIN: 0.22, STORM: 0.02, SNOW: 0.18 },
    WINTER: { CLEAR: 0.18, CLOUDY: 0.28, RAIN: 0.04, STORM: 0, SNOW: 0.5 },
  },
  Dwa: {
    SPRING: { CLEAR: 0.48, CLOUDY: 0.26, RAIN: 0.2, STORM: 0.06, SNOW: 0 },
    SUMMER: { CLEAR: 0.26, CLOUDY: 0.28, RAIN: 0.36, STORM: 0.1, SNOW: 0 },
    AUTUMN: { CLEAR: 0.55, CLOUDY: 0.25, RAIN: 0.17, STORM: 0.02, SNOW: 0.01 },
    WINTER: { CLEAR: 0.5, CLOUDY: 0.26, RAIN: 0.04, STORM: 0, SNOW: 0.2 },
  },

  /* --- Famille E — polaire ---------------------------------------- */
  ET: {
    SPRING: { CLEAR: 0.22, CLOUDY: 0.32, RAIN: 0.16, STORM: 0.02, SNOW: 0.28 },
    SUMMER: { CLEAR: 0.3, CLOUDY: 0.34, RAIN: 0.28, STORM: 0.04, SNOW: 0.04 },
    AUTUMN: { CLEAR: 0.22, CLOUDY: 0.32, RAIN: 0.16, STORM: 0.02, SNOW: 0.28 },
    WINTER: { CLEAR: 0.14, CLOUDY: 0.28, RAIN: 0.02, STORM: 0, SNOW: 0.56 },
  },
};

/** Repli par famille Köppen, pour un code inconnu ou futur. `[GD]` */
const FAMILY_FALLBACK: Record<string, string> = {
  A: "Aw",
  B: "BSk",
  C: "Cfb",
  D: "Dfb",
  E: "ET",
};

/**
 * Probabilités météo d'un climat pour une saison locale.
 * Un code inconnu retombe sur le représentant de sa famille plutôt que de
 * lever : le monde peut ainsi introduire de nouveaux climats sans casser le
 * tick météo côté serveur.
 */
export function climateWeatherOdds(koppen: string, season: Season): WeatherOdds {
  const exact = CLIMATE_WEATHER[koppen];
  if (exact) return { ...exact[season] };
  const family = FAMILY_FALLBACK[koppen[0] ?? ""] ?? "Cfb";
  return { ...CLIMATE_WEATHER[family][season] };
}

const WEATHER_ORDER: WeatherState[] = ["CLEAR", "CLOUDY", "RAIN", "STORM", "SNOW"];

/**
 * Tirage pondéré d'un état météo. Le générateur est passé en paramètre pour
 * que le serveur puisse rejouer une journée à l'identique depuis une graine.
 */
export function pickWeather(koppen: string, season: Season, rng: () => number): WeatherState {
  const odds = climateWeatherOdds(koppen, season);
  const roll = rng();
  let cumulative = 0;
  for (const state of WEATHER_ORDER) {
    cumulative += odds[state];
    if (roll < cumulative) return state;
  }
  // Sécurité si le rng renvoie exactement 1 ou déborde légèrement.
  return "CLEAR";
}

/* ------------------------------------------------------------------ */
/* 2 — Régions complémentaires                                         */
/* ------------------------------------------------------------------ */

/**
 * Les 12 régions de la doc 34 §3 absentes de `WORLD` — deux par continent,
 * qui portent chacune un climat non encore représenté (`Af`, `Dfc`, `Csb`,
 * `ET`…) afin que la table météo ci-dessus soit entièrement exercée.
 *
 * `crops` ne liste que les cultures réellement implémentées (`CropCode`
 * n'expose que `WHEAT` et `MAIZE`) : une région dont la doc ne propose que
 * de l'orge ou du manioc reste volontairement vide, comme `AUS-ROCHEROUGE`
 * dans le monde livré. `lon`, `mapW` et `mapH` sont absents de la doc et
 * dérivés du centre du continent et du poids économique de la région.
 * `[RÉEL]` climat et latitude · `[GD]` foncier, grille et longitudes.
 */
export const EXTRA_REGIONS: Record<string, RegionDef[]> = {
  AUR: [
    {
      code: "AUR-MARAIS",
      name: "Marais de Sluvenne",
      city: "Sluvenne",
      koppen: "Cfb",
      climateLabel: "Océanique de polder",
      lat: 51.3,
      lon: 1.6,
      fertility: 0.9,
      priceMult: 1.3,
      crops: ["WHEAT"],
      riskNote: "Submersion derrière les digues ; les meilleurs sols d'Auralie",
      mapW: 5,
      mapH: 4,
    },
    {
      code: "AUR-SOLANE",
      name: "Vallée de Solane",
      city: "Vaubrise",
      koppen: "Cfa",
      climateLabel: "Subtropical humide de marge",
      lat: 44.1,
      lon: 5.2,
      fertility: 0.78,
      priceMult: 1.1,
      crops: ["MAIZE", "WHEAT"],
      riskNote: "Sécheresse et canicule d'été ; premier maïs du continent",
      mapW: 5,
      mapH: 4,
    },
  ],
  KOR: [
    {
      code: "KOR-TAIGA",
      name: "Marches de Taïga",
      city: "Karvenn",
      koppen: "Dfc",
      climateLabel: "Subarctique",
      lat: 55.4,
      lon: -97.5,
      fertility: 0.48,
      priceMult: 0.4,
      crops: [],
      riskNote: "Hiver à −17 °C : ni blé ni maïs, seulement des cultures courtes",
      mapW: 6,
      mapH: 4,
    },
    {
      code: "KOR-BASSOLEIL",
      name: "Terres du Bas-Soleil",
      city: "Corneval",
      koppen: "Cfa",
      climateLabel: "Subtropical humide continental",
      lat: 37.5,
      lon: -88.7,
      fertility: 0.8,
      priceMult: 1.0,
      crops: ["MAIZE", "WHEAT"],
      riskNote: "Chaleur moite : culture dérobée possible, maladies fréquentes",
      mapW: 5,
      mapH: 4,
    },
  ],
  SAV: [
    {
      code: "SAV-CANOPEE",
      name: "Canopée de Mbaraka",
      city: "Mbaraka",
      koppen: "Af",
      climateLabel: "Équatorial humide",
      lat: -2.1,
      lon: 22.4,
      fertility: 0.45,
      priceMult: 0.55,
      crops: ["MAIZE"],
      riskNote: "Aucune saison sèche ; sols lessivés, ravageurs permanents",
      mapW: 4,
      mapH: 4,
    },
    {
      code: "SAV-EPINES",
      name: "Brousse d'Épines",
      city: "Zawadhun",
      koppen: "BSh",
      climateLabel: "Semi-aride chaud austral",
      lat: -21.3,
      lon: 31.9,
      fertility: 0.4,
      priceMult: 0.35,
      crops: [],
      riskNote: "270 mm par an : hectares dérisoires, irrigation obligatoire",
      mapW: 6,
      mapH: 4,
    },
  ],
  MER: [
    {
      code: "MER-CEDRES",
      name: "Monts des Cèdres",
      city: "Cedravel",
      koppen: "Csb",
      climateLabel: "Méditerranéen d'altitude",
      lat: 35.8,
      lon: 36.1,
      fertility: 0.58,
      priceMult: 0.8,
      crops: [],
      riskNote: "Pentes et gel tardif ; terroir qualitatif, matériel usé vite",
      mapW: 4,
      mapH: 3,
    },
    {
      code: "MER-LIMON",
      name: "Limon de Serapha",
      city: "Serapha",
      koppen: "BWh",
      climateLabel: "Désertique chaud fluvial",
      lat: 27.8,
      lon: 45.6,
      fertility: 0.88,
      priceMult: 1.3,
      crops: ["WHEAT", "MAIZE"],
      riskNote: "90 mm de pluie mais un fleuve : tout dépend de la crue",
      mapW: 4,
      mapH: 4,
    },
  ],
  YAN: [
    {
      code: "YAN-HAUTSNEIGES",
      name: "Hauts de Neige-Bleue",
      city: "Yukimine",
      koppen: "Dfb",
      climateLabel: "Continental de montagne",
      lat: 39.4,
      lon: 124.2,
      fertility: 0.7,
      priceMult: 0.75,
      crops: ["WHEAT"],
      riskNote: "Blizzard cinq mois ; la fonte irrigue les semis de printemps",
      mapW: 4,
      mapH: 4,
    },
    {
      code: "YAN-BAIECORAIL",
      name: "Baie de Corail",
      city: "Tsumaru",
      koppen: "Af",
      climateLabel: "Équatorial insulaire",
      lat: 8.6,
      lon: 119.3,
      fertility: 0.52,
      priceMult: 0.6,
      crops: [],
      riskNote: "Trois cycles courts par an, mais la fertilité s'épuise vite",
      mapW: 3,
      mapH: 3,
    },
  ],
  AUS: [
    {
      code: "AUS-SOLIVERA",
      name: "Coteaux de Solivera",
      city: "Solivera",
      koppen: "Csb",
      climateLabel: "Méditerranéen austral",
      lat: -34.8,
      lon: 142.7,
      fertility: 0.64,
      priceMult: 1.0,
      crops: ["WHEAT"],
      riskNote: "Miroir austral de l'Oliveraie ; irrigation par fonte des neiges",
      mapW: 4,
      mapH: 4,
    },
    {
      code: "AUS-NYVARDEN",
      name: "Rives de Nyvarden",
      city: "Nyvarden",
      koppen: "ET",
      climateLabel: "Toundra océanique",
      lat: -54.6,
      lon: 150.3,
      fertility: 0.22,
      priceMult: 0.18,
      crops: [],
      riskNote: "Toundra : culture sous serre, mais marché local captif",
      mapW: 3,
      mapH: 3,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* 3 — Saison et rendement                                             */
/* ------------------------------------------------------------------ */

/**
 * Effet de la saison locale sur la croissance. `[GD]` — le facteur d'hiver
 * n'est pas nul parce qu'il sert aussi aux climats sans dormance (voir
 * `climateYieldFactor`) ; c'est le climat qui décide de la sévérité.
 */
export const SEASON_CROP_EFFECT: Record<Season, { label: string; growth: number; note: string }> = {
  SPRING: {
    label: "Printemps",
    growth: 1.0,
    note: "Implantation et reprise de végétation ; gel tardif sur les jeunes levées",
  },
  SUMMER: {
    label: "Été",
    growth: 1.15,
    note: "Floraison et remplissage du grain : la saison qui fait le rendement",
  },
  AUTUMN: {
    label: "Automne",
    growth: 0.9,
    note: "Semis d'hiver et maturation ; récolte sous pluie, malus d'humidité",
  },
  WINTER: {
    label: "Hiver",
    growth: 0.55,
    note: "Dormance des cultures d'hiver, aucune croissance pour les cultures d'été",
  },
};

/** Potentiel agronomique propre au climat, hors sol et hors conduite. `[GD]` */
const CLIMATE_POTENTIAL: Record<string, number> = {
  Af: 0.75,
  Am: 0.9,
  Aw: 0.85,
  BWh: 0.45,
  BWk: 0.42,
  BSh: 0.6,
  BSk: 0.65,
  Csa: 0.9,
  Csb: 0.85,
  Cfa: 1.0,
  Cfb: 1.0,
  Cfc: 0.7,
  Cwa: 0.95,
  Cwb: 0.9,
  Dfa: 0.95,
  Dfb: 0.85,
  Dfc: 0.55,
  Dwa: 0.8,
  ET: 0.3,
};

/**
 * Sévérité de l'hiver, en multiplicateur du `growth` hivernal. Les climats
 * tropicaux et à hiver sec continuent de produire quand les continentaux
 * sont sous la neige : c'est ce qui rend l'arbitrage entre hémisphères et
 * entre climats intéressant.
 */
const WINTER_SEVERITY: Record<string, number> = {
  Af: 1.7,
  Am: 1.5,
  Aw: 1.2,
  Cwa: 1.3,
  Cwb: 1.3,
  BWh: 1.2,
  BSh: 1.2,
  Csa: 1.1,
  Csb: 1.05,
  Dfa: 0.7,
  Dfb: 0.6,
  Dwa: 0.6,
  Dfc: 0.45,
  ET: 0.4,
};

/**
 * Facteur de rendement climat × saison, borné pour que même la toundra reste
 * jouable et qu'aucun terroir ne dépasse le meilleur d'un quart. Il ne
 * remplace pas la formule complète de la doc 34 §8 (eau, aptitude, fenêtre
 * de semis) : il en fournit le socle climatique.
 */
export function climateYieldFactor(koppen: string, season: Season): number {
  const family = FAMILY_FALLBACK[koppen[0] ?? ""] ?? "Cfb";
  const potential = CLIMATE_POTENTIAL[koppen] ?? CLIMATE_POTENTIAL[family];
  const seasonal = SEASON_CROP_EFFECT[season].growth;
  const severity = season === "WINTER" ? (WINTER_SEVERITY[koppen] ?? 1) : 1;
  const raw = potential * seasonal * severity;
  return Math.min(1.25, Math.max(0.3, Math.round(raw * 1000) / 1000));
}
