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

export type ContractJobType =
  | "PLOW"
  | "SOW"
  | "FERTILIZE"
  | "HARVEST"
  | "TRANSPORT";

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
    baseYieldTons: number;
    growMs: number;
    seedCost: number;
  }
> = {
  WHEAT: {
    code: "WHEAT",
    name: "Blé",
    baseYieldTons: 8,
    growMs: 14 * 60 * 1000, // 14 min réel MVP `[TEST]`
    seedCost: 120,
  },
  MAIZE: {
    code: "MAIZE",
    name: "Maïs",
    baseYieldTons: 10,
    growMs: 16 * 60 * 1000,
    seedCost: 150,
  },
};

export const MARKET_BOUNDS = {
  WHEAT: { initial: 220, min: 120, max: 450 },
  MAIZE: { initial: 200, min: 100, max: 400 },
} as const;
