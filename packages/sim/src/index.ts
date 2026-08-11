import {
  CROP_DEFS,
  MARKET_BOUNDS,
  type CropCode,
  type Specialization,
  type WeatherState,
} from "@farmsim/shared";

export type CellSimInput = {
  crop: CropCode;
  plantedAt: number;
  now: number;
  fertility: number;
  weedsControlled: boolean;
  fertilizedPasses: 0 | 1 | 2;
  specialization?: Specialization;
  weatherAtHarvest?: WeatherState;
  /** Bonus bâtiments ferme (ex. 0.03) */
  buildingYieldBonus?: number;
};

export type CellSimResult = {
  ready: boolean;
  progress: number;
  readyAt: number;
  estimatedYieldTons: number;
  moisturePenalty: number;
};

function managementFactor(input: CellSimInput): number {
  let f = 0.55;
  f += Math.min(1, Math.max(0, input.fertility)) * 0.2;
  f += input.fertilizedPasses * 0.115;
  f += input.weedsControlled ? 0.1 : 0;
  if (input.specialization === "CEREALIER") f *= 1.02;
  const b = Math.min(0.1, Math.max(0, input.buildingYieldBonus ?? 0));
  f *= 1 + b;
  return Math.min(1.4, f);
}

function moisturePenalty(weather?: WeatherState): number {
  if (weather === "RAIN" || weather === "STORM") return 0.25;
  if (weather === "SNOW") return 0.35;
  return 0;
}

export function simulateCell(input: CellSimInput): CellSimResult {
  const def = CROP_DEFS[input.crop];
  const readyAt = input.plantedAt + def.growMs;
  const progress = Math.min(1, Math.max(0, (input.now - input.plantedAt) / def.growMs));
  const ready = input.now >= readyAt;
  const mgmt = managementFactor(input);
  const wet = moisturePenalty(input.weatherAtHarvest);
  const estimatedYieldTons = def.yieldPerCell * mgmt * (1 - wet);
  return {
    ready,
    progress,
    readyAt,
    estimatedYieldTons: Math.round(estimatedYieldTons * 1000) / 1000,
    moisturePenalty: wet,
  };
}

/** @deprecated alias — tests / anciens appels */
export const simulateField = simulateCell;

export type MarketTickInput = {
  commodity: CropCode;
  price: number;
  supplyTons: number;
  demandTons: number;
  stockTons: number;
  kappa?: number;
};

export type MarketTickResult = {
  price: number;
  stockTons: number;
};

export function tickMarket(input: MarketTickInput): MarketTickResult {
  const bounds = MARKET_BOUNDS[input.commodity];
  const kappa = input.kappa ?? 0.08;
  const normalize = Math.max(1, (input.demandTons + input.supplyTons) / 2);
  const stockPressure = input.stockTons / normalize;
  const imbalance =
    (input.demandTons - input.supplyTons - stockPressure * 0.5) / normalize;
  let price = input.price * (1 + kappa * imbalance);
  price = Math.min(bounds.max, Math.max(bounds.min, price));
  const stockTons = Math.max(0, input.stockTons + input.supplyTons - input.demandTons);
  return {
    price: Math.round(price * 100) / 100,
    stockTons: Math.round(stockTons * 100) / 100,
  };
}

export function sellToMarket(opts: {
  tons: number;
  price: number;
  moisturePenalty?: number;
  storageFeeRate?: number;
}): { revenue: number; effectivePrice: number } {
  const wet = opts.moisturePenalty ?? 0;
  const fee = opts.storageFeeRate ?? 0;
  const effectivePrice = opts.price * (1 - wet) * (1 - fee);
  return {
    effectivePrice: Math.round(effectivePrice * 100) / 100,
    revenue: Math.round(opts.tons * effectivePrice * 100) / 100,
  };
}

export function aggregateBuildingBonuses(
  types: Array<keyof typeof import("@farmsim/shared").BUILDING_DEFS>,
) {
  // lazy import avoided — caller passes summed numbers
  return types;
}
