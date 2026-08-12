/** Types & constantes partagés Farming Navigateur */

export * from "./world.js";
export * from "./climate.js";
export * from "./land.js";

export type Specialization = "CEREALIER" | "ELEVEUR" | "ETA";

export type CropCode = "WHEAT" | "MAIZE";

export type FieldStage =
  | "EMPTY"
  | "PREPARED"
  | "PLANTED"
  | "GROWING"
  | "READY"
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
  | "FARMHOUSE";

export type CellKind = "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  CEREALIER: "Céréalier",
  ELEVEUR: "Éleveur",
  ETA: "ETA (Travaux agricoles)",
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
};

export const MARKET_BOUNDS = {
  WHEAT: { initial: 220, min: 120, max: 450 },
  MAIZE: { initial: 200, min: 100, max: 400 },
} as const;

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
};

export const DEFAULT_GRID = { w: 12, h: 12 } as const;

/** Narratif : 12×12 ≈ 12–15 ha `[GD]` — voir `23_GRID_SIZING.md` */
export const PARCEL_HECTARES = 14;

export type MachineType = "TRACTOR" | "HARVESTER" | "SPREADER";

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
  works: Array<"PLANT" | "FERTILIZE" | "HARVEST" | "PLOW">;
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
};

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
