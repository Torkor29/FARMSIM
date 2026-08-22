/**
 * Monde imaginaire de Farming Navigator.
 *
 * Les noms sont fictifs mais les climats suivent la classification de Köppen
 * réelle : chaque région a une latitude cohérente avec son climat, et
 * l'hémisphère détermine l'inversion des saisons — c'est le levier
 * stratégique central pour posséder des terres sur plusieurs continents.
 *
 * @see docs/research/34_WORLD_GEOGRAPHY.md
 * @see docs/research/32_LAND_ECONOMY.md
 */

import { EXTRA_REGIONS } from "./climate.js";
import { seasonOfWeekday, weekdayIndex } from "./time.js";

export type Hemisphere = "N" | "S";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type Season = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";

export const SEASON_LABELS: Record<Season, string> = {
  SPRING: "Printemps",
  SUMMER: "Été",
  AUTUMN: "Automne",
  WINTER: "Hiver",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Accessible",
  MEDIUM: "Intermédiaire",
  HARD: "Exigeant",
};

export type RegionDef = {
  /** Code unique, sert de `Zone.code` côté base */
  code: string;
  name: string;
  /** Ville-marché de la région */
  city: string;
  koppen: string;
  climateLabel: string;
  /** Latitude en degrés (négatif = hémisphère sud) */
  lat: number;
  lon: number;
  /** Fertilité de base 0–1 */
  fertility: number;
  /** Multiplicateur de prix foncier de la région */
  priceMult: number;
  /** Cultures qui poussent bien ici */
  crops: string[];
  riskNote: string;
  mapW: number;
  mapH: number;
};

export type ContinentDef = {
  code: string;
  name: string;
  tagline: string;
  description: string;
  hemisphere: Hemisphere;
  difficulty: Difficulty;
  /** Centre approximatif pour le placement sur le globe */
  lat: number;
  lon: number;
  /** Couleur des terres sur le globe */
  color: string;
  accent: string;
  /** Multiplicateur de prix foncier du continent */
  priceMult: number;
  regions: RegionDef[];
};

export const WORLD: ContinentDef[] = [
  {
    code: "AUR",
    name: "Auralie",
    tagline: "Plaines douces et pluies régulières",
    description:
      "Un continent tempéré océanique, sans extrême. Rendements réguliers, météo clémente : le meilleur point de départ pour apprendre le métier.",
    hemisphere: "N",
    difficulty: "EASY",
    lat: 48,
    lon: 4,
    color: "#6fae5a",
    accent: "#a8d98b",
    priceMult: 1,
    regions: [
      {
        code: "AUR-VALBLE",
        name: "Val-de-Blé",
        city: "Meunelle",
        koppen: "Cfb",
        climateLabel: "Océanique tempéré",
        lat: 48.6,
        lon: 2.1,
        fertility: 0.82,
        priceMult: 1.0,
        crops: ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Gel tardif au printemps ; blé d'excellence",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "AUR-BRUMES",
        name: "Côte des Brumes",
        city: "Portvarne",
        koppen: "Cfb",
        climateLabel: "Océanique humide",
        lat: 50.4,
        lon: -2.8,
        fertility: 0.74,
        priceMult: 0.9,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Pluies fréquentes ; récolte humide, séchage requis",
        mapW: 4,
        mapH: 4,
      },
      {
        code: "AUR-COLLINES",
        name: "Hautes-Collines",
        city: "Cranmont",
        koppen: "Cfb",
        climateLabel: "Océanique d'altitude",
        lat: 46.2,
        lon: 6.4,
        fertility: 0.68,
        priceMult: 0.85,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Saison courte ; excellent pour l'élevage",
        mapW: 4,
        mapH: 3,
      },
      {
        code: "AUR-ORVAL",
        name: "Bassin d'Orval",
        city: "Sainte-Grange",
        koppen: "Cfb",
        climateLabel: "Océanique continental",
        lat: 47.4,
        lon: 8.9,
        fertility: 0.86,
        priceMult: 1.2,
        crops: ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Terres les plus riches du continent ; foncier disputé",
        mapW: 5,
        mapH: 4,
      },
    ],
  },
  {
    code: "KOR",
    name: "Kortavie",
    tagline: "Grandes plaines continentales",
    description:
      "Étés chauds, hivers rudes. Les parcelles sont vastes et le maïs y règne, mais la sécheresse d'août peut ruiner une campagne entière.",
    hemisphere: "N",
    difficulty: "MEDIUM",
    lat: 41,
    lon: -96,
    color: "#c9a94e",
    accent: "#e6cd7f",
    priceMult: 0.95,
    regions: [
      {
        code: "KOR-GRANDPLAINE",
        name: "Grande Plaine",
        city: "Silobourg",
        koppen: "Dfa",
        climateLabel: "Continental humide, été chaud",
        lat: 41.8,
        lon: -93.6,
        fertility: 0.88,
        priceMult: 1.15,
        crops: ["MAIZE", "WHEAT", "BARLEY", "GRASS"],
        riskNote: "Sécheresse estivale ; rendements maïs très élevés",
        mapW: 6,
        mapH: 4,
      },
      {
        code: "KOR-VENTNOIR",
        name: "Terres de Vent-Noir",
        city: "Rochelame",
        koppen: "BSk",
        climateLabel: "Semi-aride froid",
        lat: 43.5,
        lon: -101.2,
        fertility: 0.58,
        priceMult: 0.6,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Peu d'eau ; foncier bon marché, rendements faibles",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "KOR-LACSGELES",
        name: "Lacs Gelés",
        city: "Fort-Givre",
        koppen: "Dfb",
        climateLabel: "Continental, été frais",
        lat: 46.9,
        lon: -89.4,
        fertility: 0.72,
        priceMult: 0.8,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Hiver long et neigeux ; une seule campagne par an",
        mapW: 4,
        mapH: 4,
      },
      {
        code: "KOR-RIVEDOR",
        name: "Rive-d'Or",
        city: "Ambremoulin",
        koppen: "Dfa",
        climateLabel: "Continental fluvial",
        lat: 39.2,
        lon: -90.1,
        fertility: 0.84,
        priceMult: 1.1,
        crops: ["MAIZE", "WHEAT", "BARLEY", "GRASS"],
        riskNote: "Crues de printemps ; alluvions très fertiles",
        mapW: 5,
        mapH: 4,
      },
    ],
  },
  {
    code: "SAV",
    name: "Savannis",
    tagline: "Saison sèche, saison des pluies",
    description:
      "Deux saisons franches et un soleil constant. Qui maîtrise le calendrier des pluies récolte deux fois par an ; les autres regardent la terre craquer.",
    hemisphere: "S",
    difficulty: "MEDIUM",
    lat: -12,
    lon: 26,
    color: "#d9944a",
    accent: "#f0bd7e",
    priceMult: 0.75,
    regions: [
      {
        code: "SAV-HERBESHAUTES",
        name: "Hautes Herbes",
        city: "Kaledoumé",
        koppen: "Aw",
        climateLabel: "Savane tropicale",
        lat: -11.4,
        lon: 27.2,
        fertility: 0.7,
        priceMult: 0.7,
        crops: ["MAIZE", "GRASS"],
        riskNote: "Saison sèche de 5 mois ; irrigation décisive",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "SAV-TERREROUGE",
        name: "Terre Rouge",
        city: "Nzalé",
        koppen: "Aw",
        climateLabel: "Tropical à saison sèche",
        lat: -14.8,
        lon: 24.1,
        fertility: 0.64,
        priceMult: 0.6,
        crops: ["MAIZE", "GRASS"],
        riskNote: "Sols latéritiques ; fertilisation indispensable",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "SAV-GRANDFLEUVE",
        name: "Grand Fleuve",
        city: "Bahari-Sud",
        koppen: "Am",
        climateLabel: "Tropical de mousson",
        lat: -8.2,
        lon: 29.6,
        fertility: 0.87,
        priceMult: 1.05,
        crops: ["MAIZE", "WHEAT", "BARLEY", "GRASS"],
        riskNote: "Orages violents ; delta extrêmement fertile",
        mapW: 4,
        mapH: 4,
      },
      {
        code: "SAV-PLATEAUX",
        name: "Plateaux d'Ombre",
        city: "Tessaran",
        koppen: "Cwb",
        climateLabel: "Subtropical d'altitude",
        lat: -17.5,
        lon: 30.8,
        fertility: 0.76,
        priceMult: 0.85,
        crops: ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Nuits fraîches en altitude ; climat très stable",
        mapW: 4,
        mapH: 3,
      },
    ],
  },
  {
    code: "MER",
    name: "Méridie",
    tagline: "Soleil dur, eau rare, primes élevées",
    description:
      "Un continent méditerranéen qui glisse vers l'aride. Peu d'eau, mais des cultures qui se vendent cher et une saison qui démarre avant tout le monde.",
    hemisphere: "N",
    difficulty: "HARD",
    lat: 34,
    lon: 42,
    color: "#cf7f4f",
    accent: "#eba97a",
    priceMult: 1.1,
    regions: [
      {
        code: "MER-OLIVERAIE",
        name: "Grande Oliveraie",
        city: "Calathée",
        koppen: "Csa",
        climateLabel: "Méditerranéen",
        lat: 37.4,
        lon: 38.2,
        fertility: 0.72,
        priceMult: 1.25,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Été torride ; semis d'automne obligatoire",
        mapW: 4,
        mapH: 4,
      },
      {
        code: "MER-SELBLANC",
        name: "Plaine de Sel Blanc",
        city: "Ourmiane",
        koppen: "BWh",
        climateLabel: "Désertique chaud",
        lat: 31.1,
        lon: 44.8,
        fertility: 0.42,
        priceMult: 0.45,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Sans irrigation, presque rien ne pousse",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "MER-DEUXVENTS",
        name: "Cap des Deux-Vents",
        city: "Port-Alcaze",
        koppen: "Csa",
        climateLabel: "Méditerranéen côtier",
        lat: 39.6,
        lon: 33.4,
        fertility: 0.79,
        priceMult: 1.35,
        crops: ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Accès portuaire : meilleures primes de vente du monde",
        mapW: 4,
        mapH: 3,
      },
      {
        code: "MER-OASIS",
        name: "Oasis de Zerán",
        city: "Zerán",
        koppen: "BSh",
        climateLabel: "Semi-aride chaud",
        lat: 29.4,
        lon: 40.1,
        fertility: 0.61,
        priceMult: 0.7,
        crops: ["MAIZE", "GRASS"],
        riskNote: "Nappe phréatique limitée ; parcelles petites mais sûres",
        mapW: 4,
        mapH: 3,
      },
    ],
  },
  {
    code: "YAN",
    name: "Yanashi",
    tagline: "Moussons, rizières et double récolte",
    description:
      "L'eau ne manque jamais, le soleil non plus. Deux campagnes par an sont possibles, à condition de survivre aux typhons de fin d'été.",
    hemisphere: "N",
    difficulty: "MEDIUM",
    lat: 31,
    lon: 116,
    color: "#5fae86",
    accent: "#95d9b4",
    priceMult: 1.05,
    regions: [
      {
        code: "YAN-DELTAJADE",
        name: "Delta de Jade",
        city: "Shirogawa",
        koppen: "Cfa",
        climateLabel: "Subtropical humide",
        lat: 30.8,
        lon: 118.4,
        fertility: 0.9,
        priceMult: 1.4,
        crops: ["MAIZE", "WHEAT", "BARLEY", "GRASS"],
        riskNote: "Typhons en fin d'été ; les meilleures terres du monde",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "YAN-COLLINESTHE",
        name: "Collines du Thé",
        city: "Rin-No-Sato",
        koppen: "Cwa",
        climateLabel: "Subtropical de mousson",
        lat: 27.2,
        lon: 113.1,
        fertility: 0.78,
        priceMult: 1.0,
        crops: ["MAIZE", "GRASS"],
        riskNote: "Terrasses en pente ; travail plus lent",
        mapW: 4,
        mapH: 4,
      },
      {
        code: "YAN-STEPPENORD",
        name: "Steppe du Nord",
        city: "Baltunn",
        koppen: "Dwa",
        climateLabel: "Continental de mousson",
        lat: 43.7,
        lon: 121.6,
        fertility: 0.66,
        priceMult: 0.65,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Hiver très sec et glacial ; foncier abordable",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "YAN-ILESPERLE",
        name: "Îles de Perle",
        city: "Amitsu",
        koppen: "Am",
        climateLabel: "Tropical de mousson insulaire",
        lat: 21.4,
        lon: 122.9,
        fertility: 0.83,
        priceMult: 1.15,
        crops: ["MAIZE", "GRASS"],
        riskNote: "Insularité : logistique coûteuse, climat généreux",
        mapW: 3,
        mapH: 3,
      },
    ],
  },
  {
    code: "AUS",
    name: "Australis",
    tagline: "L'hémisphère inversé",
    description:
      "Quand le nord dort sous la neige, Australis moissonne. Posséder ici, c'est lisser ses revenus sur toute l'année — mais la terre y est âpre.",
    hemisphere: "S",
    difficulty: "HARD",
    lat: -33,
    lon: 146,
    color: "#b98c5e",
    accent: "#dcb98c",
    priceMult: 0.9,
    regions: [
      {
        code: "AUS-BLEDESUD",
        name: "Ceinture du Blé-Sud",
        city: "Warrindal",
        koppen: "BSk",
        climateLabel: "Semi-aride tempéré",
        lat: -33.6,
        lon: 147.2,
        fertility: 0.62,
        priceMult: 0.7,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Pluviométrie erratique ; grandes surfaces bon marché",
        mapW: 6,
        mapH: 4,
      },
      {
        code: "AUS-VALLEEVERTE",
        name: "Vallée Verte",
        city: "Tamerook",
        koppen: "Cfb",
        climateLabel: "Océanique tempéré austral",
        lat: -38.1,
        lon: 145.4,
        fertility: 0.85,
        priceMult: 1.2,
        crops: ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Le meilleur climat de l'hémisphère sud ; très demandé",
        mapW: 4,
        mapH: 4,
      },
      {
        code: "AUS-ROCHEROUGE",
        name: "Roche Rouge",
        city: "Kalgarra",
        koppen: "BWh",
        climateLabel: "Désertique chaud austral",
        lat: -25.9,
        lon: 133.8,
        fertility: 0.38,
        priceMult: 0.35,
        crops: [],
        riskNote: "Quasi-désert : réservé aux joueurs qui irriguent",
        mapW: 5,
        mapH: 4,
      },
      {
        code: "AUS-CAPAUSTRAL",
        name: "Cap Austral",
        city: "Fjordhaven",
        koppen: "Cfc",
        climateLabel: "Subpolaire océanique",
        lat: -44.2,
        lon: 148.6,
        fertility: 0.55,
        priceMult: 0.5,
        crops: ["WHEAT", "PEA", "BARLEY", "RAPE", "GRASS"],
        riskNote: "Saison très courte ; élevage plutôt que cultures",
        mapW: 4,
        mapH: 3,
      },
    ],
  },
];

// Les régions supplémentaires vivent dans climate.ts, avec la table météo
// détaillée qui les accompagne ; on les recolle ici pour que `WORLD` reste
// l'unique source de vérité du monde.
for (const continent of WORLD) {
  const extra = EXTRA_REGIONS[continent.code];
  if (extra) continent.regions.push(...extra);
}

export const CONTINENT_BY_CODE: Record<string, ContinentDef> = Object.fromEntries(
  WORLD.map((c) => [c.code, c]),
);

export const ALL_REGIONS: (RegionDef & { continent: ContinentDef })[] = WORLD.flatMap((c) =>
  c.regions.map((r) => ({ ...r, continent: c })),
);

export const REGION_BY_CODE: Record<string, RegionDef & { continent: ContinentDef }> =
  Object.fromEntries(ALL_REGIONS.map((r) => [r.code, r]));

/* ------------------------------------------------------------------ */
/* Saisons                                                             */
/* ------------------------------------------------------------------ */

/**
 * La durée d'une saison vient maintenant de l'horloge commune.
 *
 * Elle était posée ici à quinze minutes — exactement la durée d'un cycle
 * d'élevage, si bien qu'une saison durait un seul jour de jeu et l'année
 * entière une heure. Elle vaut désormais une semaine de sept jours, définie
 * une seule fois dans `time.ts` et dérivée partout ailleurs.
 */
export { SEASON_DURATION_MS, seasonProgress } from "./time.js";

const SEASON_ORDER: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

/** Saison courante d'un hémisphère : le sud est décalé de deux saisons. */
export function currentSeason(hemisphere: Hemisphere, now: number = Date.now()): Season {
  /*
   * La saison se lit sur le calendrier réel, plus sur un compteur.
   *
   * Elle tournait sur une horloge à elle, sans coïncider avec quoi que ce soit :
   * un joueur qui revenait le lendemain ne savait pas où il en était. Elle suit
   * désormais les jours de la semaine — l'hiver le dimanche — si bien que
   * chacun sait la saison sans ouvrir le jeu.
   */
  return seasonOfWeekday(weekdayIndex(now), hemisphere);
}

/** Facteur de rendement saisonnier `[TEST]` */
export const SEASON_YIELD: Record<Season, number> = {
  SPRING: 1.05,
  SUMMER: 1.15,
  AUTUMN: 0.95,
  WINTER: 0.7,
};

/**
 * Probabilités météo par famille de climat et par saison.
 * La clé climat est la première lettre Köppen, affinée pour B (aride) et D.
 */
export function weatherOdds(
  koppen: string,
  season: Season,
): Record<"CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "SNOW", number> {
  const family = koppen[0];
  const cold = season === "WINTER";
  if (family === "B") {
    return { CLEAR: cold ? 0.7 : 0.8, CLOUDY: 0.14, RAIN: 0.04, STORM: 0.02, SNOW: cold ? 0.1 : 0 };
  }
  if (family === "A") {
    const wet = season === "SUMMER" || season === "SPRING";
    return {
      CLEAR: wet ? 0.28 : 0.5,
      CLOUDY: 0.24,
      RAIN: wet ? 0.32 : 0.2,
      STORM: wet ? 0.16 : 0.06,
      SNOW: 0,
    };
  }
  if (family === "D") {
    return {
      CLEAR: cold ? 0.28 : 0.44,
      CLOUDY: 0.26,
      RAIN: cold ? 0.06 : 0.22,
      STORM: cold ? 0.02 : 0.08,
      SNOW: cold ? 0.38 : 0,
    };
  }
  // C — tempéré
  return {
    CLEAR: cold ? 0.3 : 0.42,
    CLOUDY: 0.28,
    RAIN: cold ? 0.28 : 0.22,
    STORM: season === "SUMMER" ? 0.08 : 0.04,
    SNOW: cold ? 0.06 : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Classes de joueur                                                   */
/* ------------------------------------------------------------------ */

export type ClassProfile = {
  code: "CEREALIER" | "ELEVEUR";
  name: string;
  tagline: string;
  /** Ce que la classe change concrètement pour le joueur */
  perks: string[];
  drawbacks: string[];
  startingMachines: string[];
  /** Continents conseillés au démarrage */
  suggestedContinents: string[];
  /** Palette du personnage low-poly */
  palette: { skin: string; cloth: string; accent: string; prop: string };
  /** Illustration du métier, pour les écrans où la 3D serait superflue */
  art: string;
};

export const CLASS_PROFILES: Record<ClassProfile["code"], ClassProfile> = {
  CEREALIER: {
    code: "CEREALIER",
    name: "Céréalier",
    tagline: "Le rendement avant tout",
    perks: [
      "+2 % de rendement sur toutes les cultures",
      "Parcelle de départ dans la région fertile de votre choix",
      "Pendant que ça pousse : allez aider un voisin, on vous paie",
    ],
    drawbacks: [
      "Revenus dépendants du cours du blé et du maïs",
      "La moissonneuse s'achète — ou vous demandez de l'aide",
    ],
    startingMachines: ["Tracteur T1"],
    suggestedContinents: ["AUR", "KOR"],
    palette: { skin: "#e8b58a", cloth: "#3f8f52", accent: "#d9b23c", prop: "#c9a227" },
    art: "/assets/characters/cerealier.webp",
  },
  ELEVEUR: {
    code: "ELEVEUR",
    name: "Éleveur",
    tagline: "Des revenus réguliers, toute l'année",
    perks: [
      "+2 % d'efficacité alimentaire du troupeau",
      "Lait et viande toute l’année — mais les bêtes mangent du grain",
      "Pendant que le troupeau mange : allez aider un voisin",
    ],
    drawbacks: [
      "Bâtiments d'élevage coûteux à construire",
      "Doit produire ou acheter du fourrage en continu",
    ],
    startingMachines: ["Tracteur T1"],
    suggestedContinents: ["AUR", "AUS"],
    palette: { skin: "#d9a276", cloth: "#8a5a3a", accent: "#c0663f", prop: "#f0e6d2" },
    art: "/assets/characters/eleveur.webp",
  },
};

/* ------------------------------------------------------------------ */
/* Générateur de noms de parcelles                                     */
/* ------------------------------------------------------------------ */

const NAME_PARTS: Record<string, { pre: string[]; post: string[] }> = {
  AUR: {
    pre: ["Clos", "Champ", "Pré", "Val", "Bois", "Mas", "Terre", "Ferme"],
    post: ["d'Orme", "du Moulin", "Fleuri", "aux Alouettes", "Blanc", "du Guet", "des Saules"],
  },
  KOR: {
    pre: ["Section", "Homestead", "Quarter", "Range", "Prairie", "Creek"],
    post: ["North", "Ridge", "Hollow", "Bend", "Flats", "Crossing", "Mill"],
  },
  SAV: {
    pre: ["Shamba", "Konde", "Terre", "Plaine", "Boma"],
    post: ["Kaledou", "Nzalé", "Rouge", "du Baobab", "Tessa", "Bahari"],
  },
  MER: {
    pre: ["Huerta", "Campo", "Finca", "Vega", "Sekhia"],
    post: ["del Sol", "Alcaze", "Zerán", "Blanca", "de Levante", "Ourmi"],
  },
  YAN: {
    pre: ["Ta", "Hatake", "Ruisseau", "Terrasse", "Delta"],
    post: ["Shiro", "no-Sato", "de Jade", "Amitsu", "Baltunn", "d'Argent"],
  },
  AUS: {
    pre: ["Paddock", "Station", "Block", "Run", "Creek"],
    post: ["Warrindal", "Tamerook", "Kalgarra", "South", "Gully", "Reach"],
  },
};

/** Nom de parcelle déterministe, cohérent avec la culture du continent. */
export function parcelName(continentCode: string, index: number): string {
  const parts = NAME_PARTS[continentCode] ?? NAME_PARTS.AUR;
  const pre = parts.pre[index % parts.pre.length];
  const post = parts.post[Math.floor(index / parts.pre.length) % parts.post.length];
  return `${pre} ${post}`;
}
