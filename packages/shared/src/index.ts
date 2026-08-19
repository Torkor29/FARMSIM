/** Types & constantes partagés Farming Navigateur */

import { GAME_DAY_MS } from "./time.js";
import { MACHINE_END_OF_LIFE_HOURS } from "./machine-care.js";

export * from "./ledger.js";
export * from "./time.js";
export * from "./world.js";
export * from "./climate.js";
export * from "./land.js";
export * from "./livestock.js";
export * from "./ripeness.js";
export * from "./soil.js";
export * from "./trade.js";
export * from "./goods.js";
export * from "./storage.js";
export * from "./breeding.js";
export * from "./rotation.js";
export * from "./futures.js";
export * from "./machine-care.js";
export * from "./art-anchor.js";
export * from "./play-guide.js";
export * from "./appearance.js";
export * from "./crops.js";
export * from "./manure.js";
export * from "./bedding.js";
export * from "./dev-accounts.js";
export * from "./progression.js";
export * from "./quests.js";
export * from "./consignes.js";
export * from "./forage.js";
export * from "./species.js";
export * from "./husbandry.js";

/** Monnaie du jeu : le terron (TRN). Le champ interne reste `crd`. */
export const CURRENCY_CODE = "TRN";
export const CURRENCY_NAME = "terron";

import type { TradeGood } from "./goods.js";

export type Specialization = "CEREALIER" | "ELEVEUR";

/** Les deux métiers jouables. Les travaux à façon sont un appoint, pas un 3ᵉ métier. */
export const PLAYABLE_SPECIALIZATIONS: Specialization[] = ["CEREALIER", "ELEVEUR"];

import type { CropCode } from "./crops.js";

export type FieldStage =
  | "EMPTY"
  | "PREPARED"
  | "PLANTED"
  | "GROWING"
  | "READY"
  /** Récolte manquée : la culture est perdue, seul le labour libère la case */
  | "SPOILED"
  | "HARVESTED";

export type WeatherState = "CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "SNOW";

export const WEATHER_LABELS: Record<WeatherState, string> = {
  CLEAR: "Clair",
  CLOUDY: "Nuageux",
  RAIN: "Pluie",
  STORM: "Orage",
  SNOW: "Neige",
};

/** Intervalle tick serveur MVP `[TEST]` */
export const SIM_TICK_MS = 20_000;

/**
 * Le temps de route d'une commande au négociant `[GD]`.
 *
 * L'achat versait la marchandise au silo dans la même milliseconde : on
 * cliquait, un chiffre changeait quelque part, et rien ne se passait à
 * l'écran. Une ferme reçoit pourtant ses intrants, et ce temps-là fait partie
 * du métier — on commande avant d'en avoir besoin.
 *
 * Douze secondes : assez pour qu'on voie le camion arriver et qu'on ait le
 * sentiment d'avoir commandé, trop court pour qu'on aille faire autre chose.
 * En dessous de dix, la caisse se pose avant qu'on ait fermé le marché.
 */
export const DELIVERY_TRAVEL_MS = 12_000;

/**
 * Passé ce délai, la caisse rentre toute seule.
 *
 * Une marchandise payée ne doit jamais se perdre parce qu'on a fermé
 * l'onglet. Le geste reste le chemin normal — et le seul qui donne
 * l'animation —, celui-ci n'est qu'un filet.
 */
export const DELIVERY_AUTO_MS = 3 * 60_000;

export type ContractJobType =
  | "PLOW"
  | "SOW"
  | "FERTILIZE"
  | "HARVEST"
  | "TRANSPORT";

export type BuildingType =
  | "SILO"
  | "HAY_BARN"
  | "MACHINE_SHED"
  | "CATTLE_BARN"
  | "PIGSTY"
  | "HENHOUSE"
  | "SHEEPFOLD"
  | "WORKSHOP"
  | "FARMHOUSE"
  | "PADDOCK"
  | "PIG_YARD"
  | "HEN_YARD"
  | "COLD_ROOM"
  | "BUNKER_SILO"
  /* —— Petits ouvrages ——
     Ils ne stockent rien et n'abritent personne : ils branchent un système sur
     un autre, pour un coût modeste. Aucun n'est obligatoire — une ferme sans
     eux doit rester viable —, ce sont des paris de rentabilité. */
  | "SOLAR_PANELS"
  | "WIND_TURBINE"
  | "BEEHIVE";

export type CellKind = "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  CEREALIER: "Céréalier",
  ELEVEUR: "Éleveur",
};

/** Version courte, pour les barres d'état où la place manque. */
export const SPECIALIZATION_SHORT: Record<Specialization, string> = {
  CEREALIER: "Céréalier",
  ELEVEUR: "Éleveur",
};

/** Illustration du matériel, pour le catalogue et le garage. */
export const MACHINE_ART: Record<MachineType, string> = {
  TRACTOR: "/assets/vehicles/tractor.webp",
  HARVESTER: "/assets/vehicles/harvester.webp",
  SPREADER: "/assets/vehicles/spreader.webp",
  DISC_HARROW: "/assets/vehicles/harrow.webp",
  BALER: "/assets/vehicles/harrow.webp",
  FORAGE_HARVESTER: "/assets/vehicles/harvester.webp",
};

/** Bonus spé max ≤ +10 % — valeurs de départ faibles `[GD]` */
export const SPECIALIZATION_BONUSES: Record<
  Specialization,
  { domain: string; bonus: number }
> = {
  CEREALIER: { domain: "cropYield", bonus: 0.02 },
  ELEVEUR: { domain: "feedConversion", bonus: 0.02 },
};

/**
 * Le catalogue des cultures.
 *
 * Les durées de pousse étaient des valeurs de mise au point — « 3 min MVP
 * pour itérer », disait le commentaire, et elles y sont restées. Sur une
 * parcelle de 12 × 12, cela faisait environ 6 200 TRN nets toutes les trois
 * minutes, soit **124 000 TRN à l'heure**, quand une étable en coûte 2 800 :
 * l'argent n'avait plus de poids, et aucune décision agricole n'en était une.
 *
 * Elles sont désormais comptées en **jours de jeu** (`GAME_DAY_MS`), et la
 * saison en fait sept. Une céréale occupe donc la plus grande part de sa
 * saison : semer devient un engagement, et le calendrier agricole existe.
 *
 * Deux garde-fous délibérés :
 *
 * - le **pois** reste court, pour qu'il y ait toujours une raison de revenir
 *   dans le quart d'heure ;
 * - la pousse se calcule depuis `plantedAt`, donc elle **court hors ligne**.
 *   C'est ce qui rend des durées d'une heure confortables plutôt que
 *   punitives : un champ semé avant de fermer l'onglet est mûr au retour.
 */
export const CROP_DEFS: Record<
  CropCode,
  {
    code: CropCode;
    name: string;
    /** Rendement par case cultivée `[GD]` */
    yieldPerCell: number;
    growMs: number;
    seedCostPerCell: number;
    /** Herbe : temps entre deux fauches, plus court que le premier cycle */
    regrowMs?: number;
  }
> = {
  WHEAT: {
    code: "WHEAT",
    name: "Blé",
    yieldPerCell: 0.35,
    // Cinq jours de jeu : le blé occupe les cinq septièmes d'une saison. On
    // sème au printemps et on moissonne avant l'automne — la phrase devient
    // vraie au sens propre, alors qu'à trois minutes elle ne voulait rien dire.
    growMs: 5 * GAME_DAY_MS,
    seedCostPerCell: 15,
  },
  MAIZE: {
    code: "MAIZE",
    name: "Maïs",
    yieldPerCell: 0.45,
    // La plus longue du catalogue : six jours sur sept. Qui plante du maïs
    // engage sa saison, et c'est ce qui doit rendre le choix sérieux.
    growMs: 6 * GAME_DAY_MS,
    seedCostPerCell: 18,
  },
  // Tête de rotation : le pois rapporte moins à la tonne, mais il laisse
  // derrière lui un sol azoté dont profite la culture suivante. C'est ce qui
  // en fait une décision, et non un choix par défaut.
  PEA: {
    code: "PEA",
    name: "Pois",
    yieldPerCell: 0.26,
    // Volontairement gardé court. Avec des céréales à plus d'une heure, il
    // faut au moins une culture qui redonne une raison de revenir dans le
    // quart d'heure — sans quoi un céréalier débutant, sans bêtes et sans
    // grande surface, n'a strictement rien à faire de sa première heure.
    growMs: Math.round(1.5 * GAME_DAY_MS),
    seedCostPerCell: 12,
  },
  BARLEY: {
    code: "BARLEY",
    name: "Orge",
    yieldPerCell: 0.32,
    growMs: 3 * GAME_DAY_MS,
    seedCostPerCell: 13,
  },
  RAPE: {
    code: "RAPE",
    name: "Colza",
    yieldPerCell: 0.22,
    growMs: 4 * GAME_DAY_MS,
    seedCostPerCell: 16,
  },
  GRASS: {
    code: "GRASS",
    name: "Herbe",
    yieldPerCell: 0.4,
    growMs: 2 * GAME_DAY_MS,
    // L'herbe déjà fauchée repart vite : c'est ce qui fait tenir un élevage
    // sur ses propres fourrages sans immobiliser un champ toute la saison.
    regrowMs: GAME_DAY_MS,
    seedCostPerCell: 8,
  },
};

/** Durée de pousse : l'herbe déjà fauchée reprend plus vite. */
export function cropGrowMs(crop: CropCode, cutsDone = 0): number {
  const def = CROP_DEFS[crop];
  if (crop === "GRASS" && cutsDone > 0) return def.regrowMs ?? def.growMs;
  return def.growMs;
}

/**
 * Bornes de cours par marchandise. Toutes les marchandises échangées doivent
 * y figurer : le tick de marché les parcourt sans distinction, et une entrée
 * manquante produirait un prix `NaN`.
 */
export const MARKET_BOUNDS: Record<
  TradeGood,
  { initial: number; min: number; max: number; depth: number }
> = {
  WHEAT: { initial: 220, min: 120, max: 450, depth: 125 },
  MAIZE: { initial: 200, min: 100, max: 400, depth: 125 },
  // Le lait varie peu : c'est un revenu régulier, pas un pari.
  MILK: { initial: 42, min: 30, max: 62, depth: 50 },
  MEAT: { initial: 1450, min: 900, max: 2300, depth: 20 },
  HAY: { initial: 95, min: 60, max: 165, depth: 94 },
  STRAW: { initial: 72, min: 45, max: 130, depth: 56 },
  // Une botte pèse 0,35 t : à 32 TRN pièce, la tonne bottelée vaut ~91 TRN
  // contre 72 en vrac. L'écart, c'est le travail de la presse — c'est lui qui
  // rend la botteleuse rentable, sinon personne n'en achèterait.
  STRAW_BALE: { initial: 32, min: 20, max: 58, depth: 162 },
  // Carnet étroit à dessein : l'ensilage n'est pas un cours mondial liquide.
  SILAGE: { initial: 110, min: 80, max: 160, depth: 20 },
  // Marché plus étroit que le blé : un gros lot y pèse davantage.
  PEA: { initial: 285, min: 170, max: 520, depth: 56 },
  BARLEY: { initial: 195, min: 110, max: 380, depth: 100 },
  RAPE: { initial: 340, min: 210, max: 580, depth: 44 },
  EGGS: { initial: 22, min: 12, max: 40, depth: 25 },
  WOOL: { initial: 420, min: 260, max: 680, depth: 20 },
  // Coté pour l'affichage ; le fumier ne s'échange pas sur ce marché.
  MANURE: { initial: 55, min: 40, max: 80, depth: 20 },
};

/**
 * Garde-fou contre la dérive, par tick `[GD]`.
 *
 * Ce n'est **pas** « le prix doit revenir à 220 ». Un cours n'a aucune raison
 * de retrouver un chiffre décrété : ce qui le ramène, c'est que les vendeurs
 * se retirent quand il baisse et que les acheteurs se pressent — ce travail-là
 * est fait par l'élasticité de l'offre et de la demande PNJ, en aval.
 *
 * Il reste ce rappel très faible pour une seule raison, purement numérique :
 * les bornes `min`/`max` sont des murs, et un déséquilibre minuscule mais
 * constant finit par y coller le cours pour de bon. À 0,002, la demi-vie du
 * rappel est de deux heures — assez pour décoller d'un mur, bien trop lent
 * pour effacer une saison ou une année d'excédent.
 *
 * Historique : 0,12 à l'origine (demi-vie cent-huit secondes, le marché ne
 * pouvait rien exprimer), puis 0,015 (un quart d'heure — mais c'était encore
 * lui, et non l'offre, qui fixait le cours d'équilibre).
 */
export const MARKET_REVERSION = 0.002;

/**
 * Élasticité-prix de l'offre PNJ `[GD]`.
 *
 * Quand le cours cède, les fermes voisines gardent leur récolte au silo, se
 * tournent vers une autre culture, ou renoncent à semer la saison suivante :
 * l'offre se retire. C'est **le** mécanisme de rappel du marché, et il a le
 * bon goût d'avoir une limite — voir `MARKET_ELASTIC_FLOOR`.
 */
export const MARKET_SUPPLY_ELASTICITY = 0.7;

/**
 * Élasticité-prix de la demande PNJ `[GD]`, comptée négativement : un cours
 * bas fait venir les acheteurs. Plus faible que celle de l'offre — on
 * n'engraisse pas deux fois plus de bêtes parce que l'orge est bon marché.
 */
export const MARKET_DEMAND_ELASTICITY = 0.45;

/**
 * Bornes de la réponse élastique `[GD]`.
 *
 * L'offre ne tombe jamais à zéro et la demande n'est pas infinie : sans ces
 * butées, un cours effondré ferait remonter le prix aussi vite qu'il est
 * tombé, et un joueur qui inonde son marché n'en subirait aucune conséquence
 * durable. C'est précisément ce qu'on veut éviter : noyer le blé doit faire
 * mal longtemps.
 */
export const MARKET_ELASTIC_FLOOR = 0.45;
export const MARKET_ELASTIC_CEIL = 1.7;

/**
 * Profondeur minimale d'un marché, en fraction de sa profondeur nominale
 * `[GD]`. Un carnet vide appliquait la décote de volume maximale à la moindre
 * vente : il y a toujours des acheteurs quelque part.
 */
export const MARKET_DEPTH_FLOOR = 0.3;

/** Sensibilité du cours au déséquilibre, par tick `[GD]`. */
export const MARKET_KAPPA = 0.02;

/**
 * Poids du carnet face au flux du jour `[GD]`.
 *
 * Ce qui dort dans le carnet pèse un peu moins que ce qui s'y présente
 * aujourd'hui : un stock installé fait céder les cours durablement, une
 * moisson isolée les fait céder d'un jour.
 */
export const MARKET_BOOK_WEIGHT = 0.5;

/**
 * Part du carnet écoulée à chaque tick `[GD]`.
 *
 * Cherchée par simulation, pas à l'estime : c'est elle qui décide du poids
 * d'une ferme sur son marché. Trop lente, une seule parcelle faisait céder
 * les cours de 8 % — un producteur isolé n'est pas censé faire le prix. Trop
 * rapide, on retombait sur le défaut d'origine, où même vingt parcelles ne se
 * voyaient pas.
 *
 * À 0,045, un excédent se résorbe de moitié en cinq minutes : une moisson est
 * un événement de marché passager, un domaine qui produit sans cesse pèse
 * durablement. Le réglage n'est pas sur le fil — 0,06 tient les mêmes
 * intentions.
 */
export const MARKET_ABSORB = 0.045;

export type BuildingDef = {
  type: BuildingType;
  name: string;
  w: number;
  h: number;
  cost: number;
  description: string;
  storageGrain?: number;
  storageHay?: number;
  machineSlots?: number;
  cattleSlots?: number;
  pigSlots?: number;
  henSlots?: number;
  sheepSlots?: number;
  /** Multiplicateur yield cultures (ex. 0.02 = +2 %) */
  yieldBonus?: number;
  repairDiscount?: number;
  xpBonus?: number;
  /** Soft dryer — bonus réduction humidité au séchage `[GD]` */
  softDryer?: boolean;
  /**
   * Part des frais d'entretien des machines évitée `[GD]`.
   *
   * Distinct de `repairDiscount`, qui porte sur les réparations : celui-ci
   * couvre le courant — graissage, nettoyage, révision. C'est ce qui donne
   * une raison d'acheter des panneaux quand on a beaucoup d'engins.
   */
  careDiscount?: number;
  /**
   * Séchage gratuit et accéléré `[GD]`.
   *
   * L'humidité à la récolte ampute la vente ; l'éolienne fait tourner le
   * séchoir sans facture.
   */
  freeDrying?: boolean;
  /**
   * Portée de pollinisation, en cases `[GD]`.
   *
   * Le seul bonus du jeu qui dépende de **où** l'on pose le bâtiment. C'est
   * ce qui fait de la disposition de la ferme une question.
   */
  pollinationRange?: number;
  /** Rendement gagné sur les cultures pollinisées à portée `[GD]` */
  pollinationBonus?: number;
  /**
   * Part de la dégradation évitée sur les denrées périssables `[GD]`.
   *
   * Le lait perdait douze pour cent par cycle sans qu'aucun bâtiment n'y
   * puisse rien : produire beaucoup n'avait donc pas de sens si l'on ne
   * vendait pas dans la foulée. Le froid rend l'élevage tenable.
   */
  spoilageSlow?: number;
};

/**
 * Humidité de récolte & séchage MVP `[TEST]`
 * @see docs/research/27_MOISTURE_DRYING.md
 */
export const DRYING = {
  /** TRN par tonne et par passe de séchage */
  costPerTonPerPass: 12,
  /** Réduction d’humidité (fraction) par passe */
  moistureReductionPerPass: 0.06,
  /** Réduction extra si SILO / HAY_BARN sur la ferme */
  barnExtraReduction: 0.03,
  /** Plancher d’humidité après séchage */
  moistureFloor: 0.1,
  /** Au-delà : malus vente */
  sellThreshold: 0.14,
  /** Malus prix si humidité > seuil */
  sellPenaltyAbove: 0.15,
} as const;

/** Une ligne pour une offre : combien, et pourquoi ça vaut moins. */
export function lotQualityLine(opts: {
  tons: number;
  moisture: number;
  quality: number;
  unit?: string;
}): string {
  const rounded = Math.round(opts.tons * 100) / 100;
  const tonsLabel = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(rounded < 10 ? 2 : 1);
  const rawUnit = opts.unit && opts.unit !== "t" ? opts.unit : "tonnes";
  const parts = [`${tonsLabel} ${rawUnit}`];
  if (opts.moisture > DRYING.sellThreshold) {
    parts.push("trop d’eau, moins cher");
  }
  if (opts.quality <= 2) parts.push("récolté trop tard");
  return parts.join(" · ");
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  SILO: {
    type: "SILO",
    name: "Silo à grain",
    w: 2,
    h: 2,
    cost: 1200,
    description: "Sans lui, le grain se vend au champ. Avec lui : stockage, séchage.",
    storageGrain: 40,
    yieldBonus: 0.01,
    softDryer: true,
  },
  HAY_BARN: {
    type: "HAY_BARN",
    name: "Hangar paille / foin",
    w: 2,
    h: 2,
    cost: 900,
    description: "Stocke bottes et fourrages ; séchage soft.",
    storageHay: 30,
    softDryer: true,
  },
  MACHINE_SHED: {
    type: "MACHINE_SHED",
    name: "Hangar matériel",
    w: 3,
    h: 2,
    cost: 1500,
    description: "Range jusqu’à 6 engins sans occuper la cour.",
    machineSlots: 6,
  },
  CATTLE_BARN: {
    type: "CATTLE_BARN",
    name: "Étable bovins",
    w: 3,
    h: 3,
    cost: 2800,
    description: "Bâtiment élevage bovin (slots).",
    cattleSlots: 12,
    yieldBonus: 0.01,
  },
  PIGSTY: {
    type: "PIGSTY",
    name: "Porcherie",
    w: 2,
    h: 3,
    cost: 2200,
    description: "Bâtiment élevage porcin (slots).",
    pigSlots: 20,
  },
  HENHOUSE: {
    type: "HENHOUSE",
    name: "Poulailler",
    w: 2,
    h: 2,
    cost: 1400,
    description: "Petit, pas cher. Le revenu, c’est l’œuf.",
    henSlots: 24,
  },
  SHEEPFOLD: {
    type: "SHEEPFOLD",
    name: "Bergerie",
    w: 3,
    h: 2,
    cost: 2000,
    description: "Les moutons vivent surtout dehors. On tond la laine.",
    sheepSlots: 16,
  },
  COLD_ROOM: {
    type: "COLD_ROOM",
    name: "Chambre froide",
    w: 2,
    h: 2,
    cost: 2600,
    description: "Ralentit la dégradation du lait, de la viande et des œufs.",
    spoilageSlow: 0.4,
  },
  WORKSHOP: {
    type: "WORKSHOP",
    name: "Atelier",
    w: 2,
    h: 2,
    cost: 1100,
    description: "Répare moins cher.",
    repairDiscount: 0.1,
  },
  FARMHOUSE: {
    type: "FARMHOUSE",
    name: "Maison d’exploitation",
    w: 2,
    h: 2,
    cost: 2000,
    description: "HQ — léger bonus XP.",
    xpBonus: 0.02,
  },
  PADDOCK: {
    type: "PADDOCK",
    name: "Enclos de pâture",
    w: 3,
    h: 3,
    cost: 1210,
    description: "Collé à une étable ou une bergerie : les bêtes sortent, elles sont plus heureuses.",
  },
  PIG_YARD: {
    type: "PIG_YARD",
    name: "Courette à porcs",
    w: 2,
    h: 3,
    // Moins chère que l'enclos : une souille close, pas une prairie.
    cost: 780,
    description: "Collée à une porcherie, elle laisse les porcs fouir dehors : moins de stress, plus de viande.",
  },
  HEN_YARD: {
    type: "HEN_YARD",
    name: "Courette à poules",
    w: 2,
    h: 3,
    cost: 520,
    description: "Collée au poulailler : les poules picorent dehors, elles pondent mieux.",
  },
  BUNKER_SILO: {
    type: "BUNKER_SILO",
    name: "Silo couloir",
    w: 3,
    h: 2,
    cost: 1400,
    description: "Tasse l’ensilage et la paille. Sans lui, le fourrage d’hiver n’a pas de place.",
    storageHay: 50,
  },

  /* ------------------------------------------------------------------ */
  /* Petits ouvrages                                                     */
  /* ------------------------------------------------------------------ */
  /*
   * Au-delà de quatre ou cinq bâtiments, construire cessait d'être une
   * décision pour devenir une liste de courses : chacun débloquait une
   * capacité, on les posait tous dans le même ordre. Ces trois-là ne
   * débloquent rien. Ils branchent un système existant sur un autre, pour un
   * coût modeste, et il faut calculer s'ils se rentabilisent.
   *
   * Trois règles qu'ils respectent :
   *  - aucun n'est obligatoire, une ferme sans eux reste viable ;
   *  - leur effet se lit dans le Bureau, poste par poste, donc se vérifie ;
   *  - la ruche a une portée, donc un emplacement — le seul bâtiment du jeu
   *    où *où* l'on pose compte.
   */
  SOLAR_PANELS: {
    type: "SOLAR_PANELS",
    name: "Panneaux solaires",
    w: 2,
    h: 2,
    cost: 1500,
    description:
      "Le courant de la ferme. Graissage, nettoyage et révision coûtent 20 % de moins.",
    careDiscount: 0.2,
  },
  WIND_TURBINE: {
    type: "WIND_TURBINE",
    name: "Éolienne",
    w: 1,
    h: 1,
    cost: 2200,
    description: "Fait tourner le séchoir sans facture. Le grain sèche gratuitement, et plus vite.",
    freeDrying: true,
  },
  BEEHIVE: {
    type: "BEEHIVE",
    name: "Ruches",
    w: 1,
    h: 1,
    cost: 800,
    description:
      "Pollinise colza et pois dans un rayon de quatre cases : +8 % de rendement. Placez-les au bon endroit.",
    pollinationRange: 4,
    pollinationBonus: 0.08,
  },
};

/* ------------------------------------------------------------------ */
/* Niveaux de bâtiment                                                 */
/* ------------------------------------------------------------------ */

export const MAX_BUILDING_LEVEL = 5;

export type BuildingLevelDef = {
  level: number;
  name: string;
  /** Coût de passage depuis le niveau précédent, en fraction du coût de base */
  upgradeCostMult: number;
  /** Multiplicateur appliqué à toutes les capacités et bonus du bâtiment */
  capacityMult: number;
  /** Niveau de joueur requis */
  requiredLevel: number;
};

/**
 * Cinq paliers pour chaque bâtiment. Le coût grimpe plus vite que la
 * capacité : agrandir un bâtiment existant reste rentable, mais jamais
 * gratuit, et le dernier palier se mérite.
 * `[GD]`
 */
export const BUILDING_LEVELS: BuildingLevelDef[] = [
  { level: 1, name: "Rudimentaire", upgradeCostMult: 0, capacityMult: 1, requiredLevel: 1 },
  // Le premier agrandissement est ouvert dès l'arrivée : c'est le geste qui
  // apprend au joueur que ses bâtiments évoluent.
  { level: 2, name: "Consolidé", upgradeCostMult: 0.8, capacityMult: 1.6, requiredLevel: 1 },
  { level: 3, name: "Agrandi", upgradeCostMult: 1.5, capacityMult: 2.4, requiredLevel: 3 },
  { level: 4, name: "Mécanisé", upgradeCostMult: 2.6, capacityMult: 3.4, requiredLevel: 6 },
  { level: 5, name: "Industriel", upgradeCostMult: 4.2, capacityMult: 4.6, requiredLevel: 10 },
];

export function buildingLevelDef(level: number): BuildingLevelDef {
  const clamped = Math.max(1, Math.min(MAX_BUILDING_LEVEL, Math.round(level)));
  return BUILDING_LEVELS[clamped - 1];
}

/** Coût en TRN pour passer un bâtiment au niveau suivant. */
export function buildingUpgradeCost(type: BuildingType, currentLevel: number): number | null {
  if (currentLevel >= MAX_BUILDING_LEVEL) return null;
  const next = buildingLevelDef(currentLevel + 1);
  return Math.round(BUILDING_DEFS[type].cost * next.upgradeCostMult);
}

/** Capacités et bonus d'un bâtiment à un niveau donné. */
export function buildingStatsAtLevel(type: BuildingType, level: number) {
  const def = BUILDING_DEFS[type];
  const mult = buildingLevelDef(level).capacityMult;
  const scale = (v: number | undefined) => (v === undefined ? undefined : v * mult);
  return {
    storageGrain: scale(def.storageGrain),
    storageHay: scale(def.storageHay),
    machineSlots: def.machineSlots === undefined ? undefined : Math.round(def.machineSlots * mult),
    cattleSlots: def.cattleSlots === undefined ? undefined : Math.round(def.cattleSlots * mult),
    pigSlots: def.pigSlots === undefined ? undefined : Math.round(def.pigSlots * mult),
    henSlots: def.henSlots === undefined ? undefined : Math.round(def.henSlots * mult),
    sheepSlots: def.sheepSlots === undefined ? undefined : Math.round(def.sheepSlots * mult),
    yieldBonus: scale(def.yieldBonus),
    repairDiscount: scale(def.repairDiscount),
    xpBonus: scale(def.xpBonus),
    softDryer: def.softDryer,
    spoilageSlow: scale(def.spoilageSlow),
  };
}

/** Illustration isométrique du bâtiment, pour l'UI. */
export const BUILDING_ART: Record<BuildingType, string> = {
  SILO: "/assets/buildings/silo.webp",
  HAY_BARN: "/assets/buildings/hay-barn.webp",
  MACHINE_SHED: "/assets/buildings/machine-shed.webp",
  CATTLE_BARN: "/assets/buildings/cattle-barn.webp",
  PIGSTY: "/assets/buildings/pigsty.webp",
  HENHOUSE: "/assets/buildings/pigsty.webp",
  SHEEPFOLD: "/assets/buildings/cattle-barn.webp",
  WORKSHOP: "/assets/buildings/workshop.webp",
  FARMHOUSE: "/assets/buildings/farmhouse.webp",
  PADDOCK: "/assets/buildings/paddock.webp",
  PIG_YARD: "/assets/buildings/pig-yard.webp",
  HEN_YARD: "/assets/buildings/pig-yard.webp",
  COLD_ROOM: "/assets/buildings/workshop.webp",
  BUNKER_SILO: "/assets/buildings/hay-barn.webp",
  // Les trois petits ouvrages sont dessinés, pas photographiés : ils n'ont pas
  // d'illustration isométrique, et un rendu vectoriel se lit mieux à leur
  // taille — une ruche fait une case.
  SOLAR_PANELS: "/assets/buildings/solar-panels.svg",
  WIND_TURBINE: "/assets/buildings/wind-turbine.svg",
  BEEHIVE: "/assets/buildings/beehive.svg",
};

export const DEFAULT_GRID = { w: 12, h: 12 } as const;

/** Narratif : 12×12 ≈ 12–15 ha `[GD]` — voir `23_GRID_SIZING.md` */
export const PARCEL_HECTARES = 14;

/**
 * Le compteur horaire, et ce qu'il remplace `[GD]`.
 *
 * L'usure se comptait en cases travaillées. Deux choses clochaient, et la
 * seconde abîmait l'économie entière.
 *
 * La case n'est pas une unité que le joueur ressent : il travaille des champs,
 * et il pense en saisons. Surtout, le barème donnait une révision complète de
 * tracteur — 600 TRN — tous les cinq champs, pour un engin qui en coûte 2 800.
 * Sur sa vie, la machine se payait plusieurs fois en réparations. Aucun bien
 * d'équipement ne fonctionne comme ça, et un joueur l'a dit dans ces termes :
 * « un tracteur ça meurt pas en 2 jours ».
 *
 * L'usure se compte donc désormais en **heures de travail**, comme sur un
 * vrai compteur horaire. Deux quantités distinctes, toutes deux honnêtes :
 *
 *   `hours`      monotone, ne recule jamais, pas même après une révision.
 *                C'est l'âge de l'engin, et c'est lui qui fixe sa cote.
 *   `condition`  l'usure depuis la dernière remise en état, que l'atelier
 *                répare.
 *
 * C'est exactement la distinction du matériel réel : un tracteur de 2 000 h
 * révisé à neuf roule comme un neuf, mais ne se revend pas comme un neuf.
 */

/** Surface d'une case, en hectares — 12×12 cases pour 14 ha. */
export const HECTARES_PER_CELL = PARCEL_HECTARES / (DEFAULT_GRID.w * DEFAULT_GRID.h);

/**
 * Heures au compteur pour un chantier `[GD]`.
 *
 * Un champ entier de 14 ha demande deux à cinq heures selon l'engin : ce sont
 * des ordres de grandeur agricoles réels, et c'est ce qui rend le compteur
 * lisible — « 47 h » veut dire quelque chose.
 */
export function jobHours(hoursPerHectare: number, cells: number): number {
  return Math.round(hoursPerHectare * Math.max(0, cells) * HECTARES_PER_CELL * 100) / 100;
}

/** Points de condition perdus par heure de travail, au soin neutre. */
export function conditionPerHour(lifeHours: number): number {
  return lifeHours > 0 ? 100 / lifeHours : 0;
}


export type MachineType = "TRACTOR" | "HARVESTER" | "SPREADER" | "DISC_HARROW" | "BALER" | "FORAGE_HARVESTER";

export type MachineDef = {
  type: MachineType;
  name: string;
  cost: number;
  tier: number;
  /** Heures au compteur par hectare travaillé — ordre de grandeur réel */
  hoursPerHectare: number;
  /**
   * Heures de travail pour user 100 points de condition, au soin neutre.
   * C'est la durée entre deux remises à neuf, pas la durée de vie de l'engin :
   * un tracteur enchaîne plusieurs révisions avant de finir à la casse.
   */
  lifeHours: number;
  /** Coût TRN pour +1 point de condition */
  repairCostPerPoint: number;
  minCondition: number;
  description: string;
  works: Array<
    "PLANT" | "FERTILIZE" | "HARVEST" | "PLOW" | "STUBBLE" | "MOW" | "BALE" | "COLLECT" | "SILAGE"
  >;
  /** Teinte iso HUD (réf. IsoFarmView) */
  isoColor: "green" | "red-gold" | "amber";
};

export const MACHINE_DEFS: Record<MachineType, MachineDef> = {
  TRACTOR: {
    type: "TRACTOR",
    name: "Tracteur T1",
    cost: 2800,
    tier: 1,
    // 4,9 h pour un champ de 14 ha : un semis réel, à la louche. 700 h entre
    // deux révisions, soit environ 140 champs — un tracteur, ça dure.
    hoursPerHectare: 0.35,
    lifeHours: 700,
    // Révision complète ≈ 20 % de l'achat (560 TRN).
    repairCostPerPoint: 6,
    minCondition: 15,
    description: "Semis, travaux de base et fauche de l’herbe. Ramasse aussi les bottes.",
    works: ["PLANT", "PLOW", "FERTILIZE", "MOW", "COLLECT"],
    isoColor: "green",
  },
  HARVESTER: {
    type: "HARVESTER",
    name: "Moissonneuse T1",
    cost: 4000,
    tier: 1,
    // Une moissonneuse travaille moins d'heures par an qu'un tracteur, et les
    // use plus vite : 480 h entre deux révisions, ~115 champs moissonnés.
    hoursPerHectare: 0.3,
    lifeHours: 480,
    repairCostPerPoint: 8,
    minCondition: 15,
    description: "Récolte céréales.",
    works: ["HARVEST"],
    isoColor: "red-gold",
  },
  SPREADER: {
    type: "SPREADER",
    name: "Épandeur T1",
    cost: 1500,
    tier: 1,
    hoursPerHectare: 0.15,
    lifeHours: 800,
    repairCostPerPoint: 3,
    minCondition: 15,
    description: "Fertilisation plus efficace (−usure vs tracteur).",
    works: ["FERTILIZE"],
    isoColor: "amber",
  },
  DISC_HARROW: {
    type: "DISC_HARROW",
    name: "Déchaumeur à disques",
    cost: 1600,
    tier: 1,
    hoursPerHectare: 0.2,
    lifeHours: 900,
    repairCostPerPoint: 4,
    minCondition: 15,
    description:
      "Incorpore les résidus après moisson : bonus de rendement, sans remettre le sol à zéro.",
    works: ["STUBBLE"],
    isoColor: "amber",
  },
  BALER: {
    type: "BALER",
    name: "Presse à balles",
    cost: 1800,
    tier: 1,
    hoursPerHectare: 0.28,
    lifeHours: 750,
    repairCostPerPoint: 5,
    minCondition: 15,
    description: "Presse l’andain en bottes. Sans elle, la paille reste au champ.",
    works: ["BALE"],
    isoColor: "amber",
  },
  FORAGE_HARVESTER: {
    type: "FORAGE_HARVESTER",
    name: "Ensileuse T1",
    cost: 4200,
    tier: 1,
    hoursPerHectare: 0.35,
    lifeHours: 450,
    repairCostPerPoint: 9,
    minCondition: 15,
    description: "Récolte le maïs plante entière, plus tôt, plus de tonnage.",
    works: ["SILAGE"],
    isoColor: "red-gold",
  },
};

/** Moitié du chemin vers le neuf : 0 % → 50 %, 40 % → 70 %. */
export function repairHalfwayTarget(condition: number): number {
  const c = Math.max(0, Math.min(100, condition));
  return Math.round((c + (100 - c) / 2) * 100) / 100;
}

export function repairQuote(opts: {
  condition: number;
  repairCostPerPoint: number;
  targetCondition?: number;
  workshopDiscount?: number;
}): { points: number; cost: number; nextCondition: number } {
  const target = Math.min(100, opts.targetCondition ?? 100);
  const points = Math.max(0, Math.round((target - opts.condition) * 100) / 100);
  const discount = Math.min(0.4, Math.max(0, opts.workshopDiscount ?? 0));
  const cost = Math.round(points * opts.repairCostPerPoint * (1 - discount) * 100) / 100;
  return { points, cost, nextCondition: target };
}

/* ------------------------------------------------------------------ */
/* Revente de matériel et de bâtiments                                 */
/* ------------------------------------------------------------------ */

/** Décote de revente d'une machine, avant prise en compte de l'usure `[GD]` */
export const MACHINE_RESALE_RATE = 0.55;

/**
 * Un bâtiment se revend moins bien qu'une machine : on ne déplace pas un
 * silo, on le démolit. Le prix reflète les matériaux récupérés. `[GD]`
 */
export const BUILDING_RESALE_RATE = 0.4;

/**
 * Ce que le concessionnaire retient en plus, pour une reprise immédiate `[GD]`.
 *
 * Il paie moins que la valeur du marché, et c'est la contrepartie du service :
 * l'argent tombe tout de suite, sans attendre qu'un joueur passe. Vendre à la
 * cote demande de la patience ; brader au concessionnaire n'en demande pas.
 */
export const MACHINE_DEALER_RATE = 0.7;

/** Durée d'une annonce d'occasion. Passé ce délai, l'engin revient au vendeur. */
export const MACHINE_LISTING_TTL_MS = 48 * 60 * 60 * 1000;

/** Garde-fou de prix : on ne brade ni ne délire sur la cote. */
export const MACHINE_LISTING_MIN_RATE = 0.25;
export const MACHINE_LISTING_MAX_RATE = 2;

/**
 * Ce que l'âge retire à une machine, indépendamment de son état `[GD]`.
 *
 * Les heures ne se réparent pas. Un tracteur de 1 200 h remis à neuf roule
 * comme un neuf mais ne se revend pas comme un neuf, et c'est ce que cette
 * courbe traduit : elle descend jusqu'à un plancher, jamais jusqu'à zéro.
 * Sans plancher, le matériel d'occasion serait un piège plutôt qu'une bonne
 * affaire.
 */
export function machineAgeFactor(hours: number): number {
  const h = Math.max(0, Math.min(MACHINE_END_OF_LIFE_HOURS, hours));
  const part = h / MACHINE_END_OF_LIFE_HOURS;
  return Math.round((1 - 0.7 * part) * 1000) / 1000;
}

/**
 * Cote d'une machine d'occasion — le prix qu'elle vaut entre joueurs.
 *
 * Deux facteurs qui ne disent pas la même chose : les **heures** sont l'âge,
 * définitif ; la **condition** est l'entretien, réparable. C'est ce qui donne
 * son intérêt au marché de l'occasion — une vieille machine bien tenue vaut
 * mieux qu'une jeune machine ruinée, et le prix le dit.
 *
 * La signature accepte encore un simple nombre pour la condition afin de ne
 * pas casser les appels d'avant le compteur horaire ; sans heures, la machine
 * est traitée comme neuve.
 */
export function machineResaleValue(
  type: MachineType,
  state: number | { condition: number; hours?: number },
): number {
  const condition = typeof state === "number" ? state : state.condition;
  const hours = typeof state === "number" ? 0 : (state.hours ?? 0);
  const etat = Math.max(0, Math.min(100, condition)) / 100;
  /* La condition pèse peu, et c'est voulu — un test l'a imposé.
     À 0,55 de poids, réviser un tracteur coûtait 510 TRN et en ajoutait 720 à
     sa cote : acheter une épave, la réviser, la revendre était une machine à
     fabriquer de l'argent. Le défaut est antérieur au compteur horaire, mais
     il ne se voyait pas tant que la condition faisait seule le prix.
     Économiquement, c'est aussi le bon sens : un défaut réparable ne devrait
     pas décoter beaucoup, puisque l'acheteur peut le réparer. Ce qui ne se
     rattrape pas — les heures — doit dominer. */
  return Math.round(
    MACHINE_DEFS[type].cost *
      MACHINE_RESALE_RATE *
      machineAgeFactor(hours) *
      (0.7 + etat * 0.3),
  );
}

/** Ce que le concessionnaire propose, tout de suite et sans négocier. */
export function machineDealerValue(
  type: MachineType,
  state: number | { condition: number; hours?: number },
): number {
  return Math.round(machineResaleValue(type, state) * MACHINE_DEALER_RATE);
}

/**
 * Prix de démolition d'un bâtiment, niveau compris : les agrandissements
 * payés se récupèrent en partie.
 */
export function buildingResaleValue(type: BuildingType, level: number, ageMs?: number): number {
  const base = BUILDING_DEFS[type].cost;
  let invested = base;
  for (let l = 2; l <= Math.max(1, Math.min(MAX_BUILDING_LEVEL, level)); l++) {
    invested += base * BUILDING_LEVELS[l - 1].upgradeCostMult;
  }
  const rate = withinRegret(ageMs) ? 1 : BUILDING_RESALE_RATE;
  return Math.round(invested * rate);
}

/**
 * Fenêtre de regret : un bâtiment tout juste posé se démolit **intégralement
 * remboursé**.
 *
 * Un clic sur la parcelle en mode construction déclenchait la dépense sans
 * confirmation : cinq silos pouvaient partir en cinq clics involontaires, et
 * la seule sortie était la démolition à 55 %, soit près de trois mille TRN de
 * perte sèche pour une maladresse. La confirmation de pose supprime la cause ;
 * cette fenêtre rattrape ce qui passerait encore au travers.
 */
export const BUILDING_REGRET_MS = 3 * 60 * 1000;

export function withinRegret(ageMs?: number): boolean {
  return ageMs != null && ageMs >= 0 && ageMs < BUILDING_REGRET_MS;
}

/* ------------------------------------------------------------------ */
/* Deux prix : client (faire venir) vs prestataire (mission)           */
/* ------------------------------------------------------------------ */

export type FarmWork =
  | "PLANT"
  | "FERTILIZE"
  | "HARVEST"
  | "PLOW"
  | "STUBBLE"
  | "MOW"
  | "BALE"
  | "COLLECT"
  | "SILAGE";

/** Libellés en langage ordinaire : le joueur n'est pas censé connaître le jargon. */
export const WORK_LABELS: Record<FarmWork, string> = {
  PLANT: "Semer",
  FERTILIZE: "Mettre de l’engrais",
  HARVEST: "Récolter",
  PLOW: "Labourer",
  STUBBLE: "Nettoyer le sol",
  MOW: "Faucher",
  BALE: "Presser les bottes",
  COLLECT: "Ramasser les bottes",
  SILAGE: "Ensiler",
};

/**
 * Prix **client** : ce qu'on paie pour ne pas avoir la machine.
 * Ce n'est pas un salaire. `[GD]`
 */
export const CONTRACTOR_RATE_PER_CELL: Record<FarmWork, number> = {
  PLANT: 8,
  FERTILIZE: 6,
  HARVEST: 12,
  PLOW: 5,
  STUBBLE: 4,
  MOW: 5,
  BALE: 7,
  COLLECT: 3,
  SILAGE: 14,
};

/** Frais de déplacement, quel que soit le nombre de cases `[GD]` */
export const CONTRACTOR_CALLOUT_FEE = 80;

/** Filet urgent PNJ : moins bon que soi-même, instantané `[GD]` */
export const CONTRACTOR_YIELD_MALUS = 0.06;

/** Urgent PNJ (bouton « entreprise ») : le client paie le barème +15 % `[GD]` */
export const URGENT_NPC_SURCHARGE = 0.15;

/** Coût total d'une prestation, frais de déplacement compris. */
export function contractorQuote(work: FarmWork, cells: number): number {
  if (cells <= 0) return 0;
  return CONTRACTOR_CALLOUT_FEE + CONTRACTOR_RATE_PER_CELL[work] * cells;
}

/** Devis urgent PNJ : barème client majoré. L'argent sort de l'économie joueur. */
export function urgentContractorQuote(work: FarmWork, cells: number): number {
  return Math.round(contractorQuote(work, cells) * (1 + URGENT_NPC_SURCHARGE));
}

/**
 * À partir de combien de cases posséder sa propre machine devient rentable.
 * Sert à afficher un conseil honnête au joueur plutôt qu'à lui vendre du
 * service à perte.
 */
export function contractorBreakEvenCells(work: FarmWork, machineCost: number): number {
  return Math.ceil(machineCost / CONTRACTOR_RATE_PER_CELL[work]);
}

export type MissionKind = "NPC" | "P2P";

/** Salaire mission PNJ = 55 % du devis client `[GD]` */
export const MISSION_NPC_SHARE = 0.55;
/** Salaire P2P = 85 % du devis client `[GD]` */
export const MISSION_P2P_SHARE = 0.85;

export const MISSION_CELLS_MIN = 8;
export const MISSION_CELLS_MAX = 24;
export const MISSION_CELL_CHOICES = [8, 12, 16, 18, 24] as const;
/** Au plus 3 chantiers ouverts à la fois (anti-rente) `[GD]` */
export const MISSION_OPEN_MAX = 3;

export function clampMissionCells(cells: number): number {
  const n = Math.round(cells);
  return Math.max(MISSION_CELLS_MIN, Math.min(MISSION_CELLS_MAX, n));
}

/**
 * Salaire du prestataire. Jamais égal au prix client tant que le donneur
 * d'ordre est un PNJ : sinon le tableau devient le jeu.
 */
export function missionPayout(
  work: FarmWork,
  cells: number,
  kind: MissionKind = "NPC",
): number {
  const n = clampMissionCells(cells);
  const share = kind === "P2P" ? MISSION_P2P_SHARE : MISSION_NPC_SHARE;
  return Math.round(contractorQuote(work, n) * share);
}

export const P2P_YIELD_MALUS = 0.02;
export const LABOR_ORDER_TTL_MS = 45 * 60 * 1000;
export const LABOR_OPEN_MAX_PER_CLIENT = 3;
export const FERTILIZE_COST_PER_CELL = 10;

export function laborExtras(work: FarmWork, cells: number, crop?: CropCode | null): number {
  const n = Math.max(0, cells);
  if (work === "PLANT") return (crop ? CROP_DEFS[crop].seedCostPerCell : 15) * n;
  if (work === "FERTILIZE") return FERTILIZE_COST_PER_CELL * n;
  if (work === "PLOW") return 12 * n;
  if (work === "STUBBLE") return 5 * n;
  return 0;
}

export function laborEscrow(
  work: FarmWork,
  cells: number,
  crop?: CropCode | null,
  npcClient = false,
): { quote: number; extras: number; escrow: number; payout: number } {
  const n = clampMissionCells(cells);
  const quote = Math.round(contractorQuote(work, n) * (npcClient ? 0.88 : 1));
  const extras = laborExtras(work, n, crop);
  return {
    quote,
    extras,
    escrow: quote + extras,
    payout: Math.round(quote * MISSION_P2P_SHARE),
  };
}

/** @deprecated préférer missionPayout(work, cells, "NPC") */
export const NPC_MISSION_SHARE = MISSION_NPC_SHARE;
/** @deprecated les chantiers varient de 8 à 24 cases */
export const NPC_MISSION_CELLS = 16;

/** Salaire d'un contrat PNJ pour N cases (défaut 16). */
export function npcMissionReward(work: FarmWork, cells: number = NPC_MISSION_CELLS): number {
  return missionPayout(work, cells, "NPC");
}

/** Mapping contrats NPC → type de travail machine */
export const CONTRACT_WORK: Record<
  ContractJobType,
  "PLANT" | "FERTILIZE" | "HARVEST" | "PLOW"
> = {
  PLOW: "PLOW",
  SOW: "PLANT",
  FERTILIZE: "FERTILIZE",
  HARVEST: "HARVEST",
  TRANSPORT: "PLOW",
};

/** @deprecated préférer CONTRACT_WORK + pickMachine */
export const CONTRACT_MACHINE: Record<ContractJobType, MachineType> = {
  PLOW: "TRACTOR",
  SOW: "TRACTOR",
  FERTILIZE: "TRACTOR",
  HARVEST: "HARVESTER",
  TRANSPORT: "TRACTOR",
};

/** @deprecated l'usure suit les cases du chantier (`contract.cells`) */
export const CONTRACT_WEAR_CELLS = 16;

export function footprintCells(x: number, y: number, w: number, h: number) {
  const cells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

/**
 * Emprise d'un bâtiment posé, quart de tour compris.
 *
 * Six des treize types ne sont pas carrés : un hangar 3×2 tourné d'un quart
 * occupe 2×3. **Toute lecture d'emprise doit passer par ici** — la vérification
 * de place, le marquage des cases, la borne de grille et l'adjacence d'un pré
 * à son étable. Une seule de ces lectures laissée en `def.w × def.h` suffit à
 * laisser bâtir deux constructions l'une sur l'autre.
 */
export function orientedFootprint(
  type: BuildingType,
  rotation = 0,
): { w: number; h: number } {
  const def = BUILDING_DEFS[type];
  return quarterTurns(rotation) % 2 === 0
    ? { w: def.w, h: def.h }
    : { w: def.h, h: def.w };
}

/** Rotation ramenée à un quart de tour de 0 à 3, quelle que soit l'entrée. */
export function quarterTurns(rotation: number | null | undefined): 0 | 1 | 2 | 3 {
  const n = Math.round(rotation ?? 0);
  return ((((n % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

/**
 * Durée de l'animation d'un travail, en millisecondes.
 *
 * L'écran effaçait l'engin au bout de neuf cents millisecondes fixes, quand la
 * vue 3D le faisait avancer d'une case toutes les 280 ms : un travail sur
 * neuf cases voyait donc sa machine s'évaporer au tiers du parcours. Les deux
 * côtés lisent désormais la même formule.
 *
 * La cadence est passée de 280 à 360 ms par case : à 280, la moissonneuse
 * traversait la parcelle plus vite que l'œil ne suit l'andain, et le travail
 * se lisait comme un effet plutôt que comme un chantier. Rien côté serveur ne
 * dépend de cette durée — elle n'est que l'habillage d'une opération atomique.
 */
export function workAnimationMs(cells: number): number {
  return Math.max(900, cells * 360);
}
