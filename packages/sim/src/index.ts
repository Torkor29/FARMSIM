import {
  CROP_DEFS,
  MARKET_BOUNDS,
  type CropCode,
  type Specialization,
  type WeatherState,
} from "@farmsim/shared";

export type FieldSimInput = {
  crop: CropCode;
  plantedAt: number;
  now: number;
  fertility: number; // 0–1
  weedsControlled: boolean;
  fertilizedPasses: 0 | 1 | 2;
  specialization?: Specialization;
  weatherAtHarvest?: WeatherState;
};

export type FieldSimResult = {
  ready: boolean;
  progress: number; // 0–1
  readyAt: number;
  estimatedYieldTons: number;
  moisturePenalty: number;
};

/** Facteurs empilables bornés — inspiration FS checklist, valeurs `[GD]/`[TEST]` */
function managementFactor(input: FieldSimInput): number {
  let f = 0.55;
  f += Math.min(1, Math.max(0, input.fertility)) * 0.2;
  f += input.fertilizedPasses * 0.115; // ~+23% × 2 max
  f += input.weedsControlled ? 0.1 : 0;
  if (input.specialization === "CEREALIER") f *= 1.02;
  return Math.min(1.35, f);
}

function moisturePenalty(weather?: WeatherState): number {
  if (weather === "RAIN" || weather === "STORM") return 0.25;
  if (weather === "SNOW") return 0.35;
  return 0;
}

/**
 * Simulation lazy : `ready_at = planted_at + growMs`.
 * Pas de tick 1 Hz — dérivé à la demande.
 */
export function simulateField(input: FieldSimInput): FieldSimResult {
  const def = CROP_DEFS[input.crop];
  const readyAt = input.plantedAt + def.growMs;
  const progress = Math.min(1, Math.max(0, (input.now - input.plantedAt) / def.growMs));
  const ready = input.now >= readyAt;
  const mgmt = managementFactor(input);
  const wet = moisturePenalty(input.weatherAtHarvest);
  const estimatedYieldTons = def.baseYieldTons * mgmt * (1 - wet);

  return {
    ready,
    progress,
    readyAt,
    estimatedYieldTons: Math.round(estimatedYieldTons * 100) / 100,
    moisturePenalty: wet,
  };
}

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

/** Tick marché NPC simplifié — imbalance → prix, clamp min/max */
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
