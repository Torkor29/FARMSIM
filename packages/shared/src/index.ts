/** Types & constantes partagés Farming Navigateur */

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
};

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  SILO: {
    type: "SILO",
    name: "Silo à grain",
    w: 2,
    h: 2,
    cost: 1200,
    description: "Stocke céréales ; +capacité.",
    storageGrain: 40,
    yieldBonus: 0.01,
  },
  HAY_BARN: {
    type: "HAY_BARN",
    name: "Hangar paille / foin",
    w: 2,
    h: 2,
    cost: 900,
    description: "Stocke bottes et fourrages.",
    storageHay: 30,
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
