/** Types & constantes partagés Farming Navigateur */

export * from "./world.js";
export * from "./climate.js";
export * from "./land.js";
export * from "./livestock.js";
export * from "./ripeness.js";
export * from "./soil.js";
export * from "./trade.js";
export * from "./goods.js";
export * from "./breeding.js";
export * from "./rotation.js";
export * from "./futures.js";
export * from "./machine-care.js";
export * from "./art-anchor.js";

import type { TradeGood } from "./goods.js";

export type Specialization = "CEREALIER" | "ELEVEUR" | "ETA";

export type CropCode = "WHEAT" | "MAIZE" | "PEA";

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
  | "WORKSHOP"
  | "FARMHOUSE"
  | "PADDOCK"
  | "PIG_YARD"
  | "COLD_ROOM";

export type CellKind = "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  CEREALIER: "Céréalier",
  ELEVEUR: "Éleveur",
  ETA: "ETA — Entreprise de Travaux Agricoles",
};

/** Version courte, pour les barres d'état où la place manque. */
export const SPECIALIZATION_SHORT: Record<Specialization, string> = {
  CEREALIER: "Céréalier",
  ELEVEUR: "Éleveur",
  ETA: "ETA",
};

/** Illustration du matériel, pour le catalogue et le garage. */
export const MACHINE_ART: Record<MachineType, string> = {
  TRACTOR: "/assets/vehicles/tractor.webp",
  HARVESTER: "/assets/vehicles/harvester.webp",
  SPREADER: "/assets/vehicles/spreader.webp",
  DISC_HARROW: "/assets/vehicles/harrow.webp",
};

/** Bonus spé max ≤ +10 % — valeurs de départ faibles `[GD]` */
export const SPECIALIZATION_BONUSES: Record<
  Specialization,
  { domain: string; bonus: number }
> = {
  CEREALIER: { domain: "cropYield", bonus: 0.02 },
  ELEVEUR: { domain: "feedConversion", bonus: 0.02 },
  ETA: { domain: "workSpeed", bonus: 0.02 },
};

export const CROP_DEFS: Record<
  CropCode,
  {
    code: CropCode;
    name: string;
    /** Rendement par case cultivée `[GD]` */
    yieldPerCell: number;
    growMs: number;
    seedCostPerCell: number;
  }
> = {
  WHEAT: {
    code: "WHEAT",
    name: "Blé",
    yieldPerCell: 0.35,
    growMs: 3 * 60 * 1000, // 3 min MVP pour itérer `[TEST]`
    seedCostPerCell: 15,
  },
  MAIZE: {
    code: "MAIZE",
    name: "Maïs",
    yieldPerCell: 0.45,
    growMs: 3.5 * 60 * 1000,
    seedCostPerCell: 18,
  },
  // Tête de rotation : le pois rapporte moins à la tonne, mais il laisse
  // derrière lui un sol azoté dont profite la culture suivante. C'est ce qui
  // en fait une décision, et non un choix par défaut.
  PEA: {
    code: "PEA",
    name: "Pois",
    yieldPerCell: 0.26,
    growMs: 2.5 * 60 * 1000,
    seedCostPerCell: 12,
  },
};

/**
 * Bornes de cours par marchandise. Toutes les marchandises échangées doivent
 * y figurer : le tick de marché les parcourt sans distinction, et une entrée
 * manquante produirait un prix `NaN`.
 */
export const MARKET_BOUNDS: Record<
  TradeGood,
  { initial: number; min: number; max: number; depth: number }
> = {
  WHEAT: { initial: 220, min: 120, max: 450, depth: 2000 },
  MAIZE: { initial: 200, min: 100, max: 400, depth: 2000 },
  // Le lait varie peu : c'est un revenu régulier, pas un pari.
  MILK: { initial: 42, min: 30, max: 62, depth: 800 },
  MEAT: { initial: 1450, min: 900, max: 2300, depth: 300 },
  HAY: { initial: 95, min: 60, max: 165, depth: 1500 },
  // Marché plus étroit que le blé : un gros lot y pèse davantage.
  PEA: { initial: 285, min: 170, max: 520, depth: 900 },
};

/**
 * Force de rappel du cours vers son prix de référence, par tick `[GD]`.
 *
 * Sans elle, le déséquilibre offre/demande poussait le prix dans la même
 * direction indéfiniment : blé, viande et fourrage finissaient collés à leur
 * plafond, et guetter le marché ne servait plus à rien. Le rappel fait
 * respirer les cours autour de leur valeur fondamentale.
 */
export const MARKET_REVERSION = 0.12;

/**
 * Profondeur minimale d'un marché, en fraction de sa profondeur nominale
 * `[GD]`. Un carnet vide appliquait la décote de volume maximale à la moindre
 * vente : il y a toujours des acheteurs quelque part.
 */
export const MARKET_DEPTH_FLOOR = 0.3;

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
  /** Multiplicateur yield cultures (ex. 0.02 = +2 %) */
  yieldBonus?: number;
  repairDiscount?: number;
  xpBonus?: number;
  /** Soft dryer — bonus réduction humidité au séchage `[GD]` */
  softDryer?: boolean;
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
  /** CRD par tonne et par passe de séchage */
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

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  SILO: {
    type: "SILO",
    name: "Silo à grain",
    w: 2,
    h: 2,
    cost: 1200,
    description: "Stocke céréales ; +capacité ; séchage soft.",
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
  COLD_ROOM: {
    type: "COLD_ROOM",
    name: "Chambre froide",
    w: 2,
    h: 2,
    cost: 2600,
    description: "Ralentit la dégradation du lait et de la viande.",
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
    description: "Collé à une étable, il laisse sortir les vaches : elles sont plus heureuses et produisent davantage.",
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

/** Coût en CRD pour passer un bâtiment au niveau suivant. */
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
  WORKSHOP: "/assets/buildings/workshop.webp",
  FARMHOUSE: "/assets/buildings/farmhouse.webp",
  PADDOCK: "/assets/buildings/paddock.webp",
  PIG_YARD: "/assets/buildings/pig-yard.webp",
  COLD_ROOM: "/assets/buildings/cold-room.webp",
};

export const DEFAULT_GRID = { w: 12, h: 12 } as const;

/** Narratif : 12×12 ≈ 12–15 ha `[GD]` — voir `23_GRID_SIZING.md` */
export const PARCEL_HECTARES = 14;

export type MachineType = "TRACTOR" | "HARVESTER" | "SPREADER" | "DISC_HARROW";

export type MachineDef = {
  type: MachineType;
  name: string;
  cost: number;
  tier: number;
  /** Points de condition perdus par case travaillée */
  wearPerCell: number;
  /** Coût CRD pour +1 point de condition */
  repairCostPerPoint: number;
  minCondition: number;
  description: string;
  works: Array<"PLANT" | "FERTILIZE" | "HARVEST" | "PLOW" | "STUBBLE">;
  /** Teinte iso HUD (réf. IsoFarmView) */
  isoColor: "green" | "red-gold" | "amber";
};

export const MACHINE_DEFS: Record<MachineType, MachineDef> = {
  TRACTOR: {
    type: "TRACTOR",
    name: "Tracteur T1",
    cost: 3200,
    tier: 1,
    wearPerCell: 0.7,
    repairCostPerPoint: 8,
    minCondition: 12,
    description: "Semis et travaux de base.",
    works: ["PLANT", "PLOW", "FERTILIZE"],
    isoColor: "green",
  },
  HARVESTER: {
    type: "HARVESTER",
    name: "Moissonneuse T1",
    cost: 4800,
    tier: 1,
    wearPerCell: 1.1,
    repairCostPerPoint: 12,
    minCondition: 12,
    description: "Récolte céréales.",
    works: ["HARVEST"],
    isoColor: "red-gold",
  },
  SPREADER: {
    type: "SPREADER",
    name: "Épandeur T1",
    cost: 1800,
    tier: 1,
    wearPerCell: 0.45,
    repairCostPerPoint: 6,
    minCondition: 10,
    description: "Fertilisation plus efficace (−usure vs tracteur).",
    works: ["FERTILIZE"],
    isoColor: "amber",
  },
  DISC_HARROW: {
    type: "DISC_HARROW",
    name: "Déchaumeur à disques",
    cost: 2100,
    tier: 1,
    // Travail superficiel à grand débit : il s'use bien moins qu'une charrue.
    wearPerCell: 0.3,
    repairCostPerPoint: 5,
    minCondition: 10,
    description:
      "Incorpore les résidus après moisson : bonus de rendement, sans remettre le sol à zéro.",
    works: ["STUBBLE"],
    isoColor: "amber",
  },
};

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
 * Prix de reprise d'une machine. L'état compte pour moitié : une machine
 * ruinée ne vaut presque plus rien, une machine neuve garde l'essentiel de
 * la décote de base.
 */
export function machineResaleValue(type: MachineType, condition: number): number {
  const wear = Math.max(0, Math.min(100, condition)) / 100;
  return Math.round(MACHINE_DEFS[type].cost * MACHINE_RESALE_RATE * (0.45 + wear * 0.55));
}

/**
 * Prix de démolition d'un bâtiment, niveau compris : les agrandissements
 * payés se récupèrent en partie.
 */
export function buildingResaleValue(type: BuildingType, level: number): number {
  const base = BUILDING_DEFS[type].cost;
  let invested = base;
  for (let l = 2; l <= Math.max(1, Math.min(MAX_BUILDING_LEVEL, level)); l++) {
    invested += base * BUILDING_LEVELS[l - 1].upgradeCostMult;
  }
  return Math.round(invested * BUILDING_RESALE_RATE);
}

/* ------------------------------------------------------------------ */
/* Prestation ETA — faire travailler ses terres par un tiers           */
/* ------------------------------------------------------------------ */

export type FarmWork = "PLANT" | "FERTILIZE" | "HARVEST" | "PLOW" | "STUBBLE";

export const WORK_LABELS: Record<FarmWork, string> = {
  PLANT: "Semis",
  FERTILIZE: "Épandage",
  HARVEST: "Moisson",
  PLOW: "Labour",
  STUBBLE: "Déchaumage",
};

/**
 * Une ETA — Entreprise de Travaux Agricoles — vient travailler vos terres
 * avec SES machines. C'est la porte de sortie quand on n'a ni moissonneuse
 * ni les moyens d'en acheter une : on paie le service à la case, plus cher
 * que de le faire soi-même, mais sans immobiliser 4 800 CRD.
 * `[GD]`
 */
export const CONTRACTOR_RATE_PER_CELL: Record<FarmWork, number> = {
  PLANT: 22,
  FERTILIZE: 16,
  HARVEST: 38,
  PLOW: 14,
  STUBBLE: 9,
};

/** Frais de déplacement, quel que soit le nombre de cases `[GD]` */
export const CONTRACTOR_CALLOUT_FEE = 120;

/** Un ETA travaille moins bien qu'un propriétaire sur ses propres terres `[GD]` */
export const CONTRACTOR_YIELD_MALUS = 0.06;

/** Coût total d'une prestation, frais de déplacement compris. */
export function contractorQuote(work: FarmWork, cells: number): number {
  if (cells <= 0) return 0;
  return CONTRACTOR_CALLOUT_FEE + CONTRACTOR_RATE_PER_CELL[work] * cells;
}

/**
 * À partir de combien de cases posséder sa propre machine devient rentable.
 * Sert à afficher un conseil honnête au joueur plutôt qu'à lui vendre du
 * service à perte.
 */
export function contractorBreakEvenCells(work: FarmWork, machineCost: number): number {
  return Math.ceil(machineCost / CONTRACTOR_RATE_PER_CELL[work]);
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

/** Usure forfaitaire contrats NPC (équivalent ~N cases) */
export const CONTRACT_WEAR_CELLS = 10;

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
 * Durée de l'animation d'un travail, en millisecondes.
 *
 * L'écran effaçait l'engin au bout de neuf cents millisecondes fixes, quand la
 * vue 3D le faisait avancer d'une case toutes les 280 ms : un travail sur
 * neuf cases voyait donc sa machine s'évaporer au tiers du parcours. Les deux
 * côtés lisent désormais la même formule.
 */
export function workAnimationMs(cells: number): number {
  return Math.max(700, cells * 280);
}
