import {
  CROP_DEFS,
  DRYING,
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

/**
 * Humidité grain à la récolte (fraction 0–1) selon météo `[GD]`.
 * Distinct du malus rendement `moisturePenalty`.
 */
export function harvestMoisture(weather?: WeatherState): number {
  switch (weather) {
    case "RAIN":
      return 0.22;
    case "STORM":
      return 0.25;
    case "SNOW":
      return 0.28;
    case "CLOUDY":
      return 0.14;
    case "CLEAR":
    default:
      return 0.12;
  }
}

/**
 * Une ou plusieurs passes de séchage : coût CRD + baisse d’humidité.
 * `barnBonus` si SILO / HAY_BARN (soft dryer) sur la ferme.
 */
export function dryInventory(opts: {
  moisture: number;
  tons: number;
  passes: number;
  barnBonus?: boolean;
}): { moisture: number; cost: number; reduction: number } {
  const passes = Math.max(0, Math.floor(opts.passes));
  const tons = Math.max(0, opts.tons);
  const perPass =
    DRYING.moistureReductionPerPass +
    (opts.barnBonus ? DRYING.barnExtraReduction : 0);
  const maxDrop = Math.max(0, opts.moisture - DRYING.moistureFloor);
  const reduction = Math.min(maxDrop, perPass * passes);
  const moisture =
    Math.round(Math.max(DRYING.moistureFloor, opts.moisture - reduction) * 1000) /
    1000;
  const cost =
    Math.round(tons * DRYING.costPerTonPerPass * passes * 100) / 100;
  return {
    moisture,
    cost,
    reduction: Math.round((opts.moisture - moisture) * 1000) / 1000,
  };
}

/** Malus prix marché si humidité au-dessus du seuil de vente. */
export function moistureSellPenalty(moisture: number): number {
  return moisture > DRYING.sellThreshold ? DRYING.sellPenaltyAbove : 0;
}

/** Moyenne pondérée d’humidité lors d’un ajout au stock. */
export function mergeMoisture(
  existingQty: number,
  existingMoisture: number,
  addTons: number,
  addMoisture: number,
): number {
  const total = existingQty + addTons;
  if (total <= 0) return addMoisture;
  return (
    Math.round(
      ((existingQty * existingMoisture + addTons * addMoisture) / total) * 1000,
    ) / 1000
  );
}

export function simulateCell(input: CellSimInput): CellSimResult {
  const def = CROP_DEFS[input.crop];
  const readyAt = input.plantedAt + def.growMs;
  const progress = Math.min(1, Math.max(0, (input.now - input.plantedAt) / def.growMs));
  const ready = input.now >= readyAt;
  const mgmt = managementFactor(input);
  const wet = moisturePenalty(input.weatherAtHarvest);
  const climate = weatherYieldFactor(input.weatherAtHarvest);
  const estimatedYieldTons = def.yieldPerCell * mgmt * climate * (1 - wet);
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

/** Usure machine après N cases. Hangar = −15 % usure `[GD]`. ETA presta = −10 % usure. */
export function applyMachineWear(opts: {
  condition: number;
  wearPerCell: number;
  cells: number;
  inShed?: boolean;
  etaBonus?: boolean;
}): { condition: number; wearApplied: number } {
  let mult = 1;
  if (opts.inShed) mult *= 0.85;
  if (opts.etaBonus) mult *= 0.9;
  const wearApplied =
    Math.round(opts.wearPerCell * Math.max(0, opts.cells) * mult * 100) / 100;
  const condition = Math.max(0, Math.round((opts.condition - wearApplied) * 100) / 100);
  return { condition, wearApplied };
}

export function repairMachineCost(opts: {
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

export function machineCanWork(condition: number, minCondition: number): boolean {
  return condition >= minCondition;
}

/** Construit le résumé de retour après absence */
export function buildSessionResume(opts: {
  awayMs: number;
  cropsReady: number;
  cropsGrowing: number;
  marketBefore: Record<string, number>;
  marketNow: Record<string, number>;
  weatherStates: string[];
}): {
  awayMs: number;
  awayLabel: string;
  cropsReady: number;
  cropsGrowing: number;
  marketDelta: Record<string, number>;
  weatherStates: string[];
  hint: string;
} {
  const marketDelta: Record<string, number> = {};
  for (const [k, now] of Object.entries(opts.marketNow)) {
    const before = opts.marketBefore[k];
    if (before !== undefined) {
      marketDelta[k] = Math.round((now - before) * 100) / 100;
    }
  }
  const awayLabel = formatAway(opts.awayMs);
  const parts: string[] = [];
  if (opts.awayMs >= 30_000) parts.push(`Absent ${awayLabel}`);
  if (opts.cropsReady > 0) parts.push(`${opts.cropsReady} case(s) prête(s) à récolter`);
  if (opts.cropsGrowing > 0 && opts.cropsReady === 0) {
    parts.push(`${opts.cropsGrowing} culture(s) en croissance`);
  }
  const movers = Object.entries(marketDelta).filter(([, d]) => Math.abs(d) >= 1);
  if (movers.length) {
    parts.push(
      movers.map(([c, d]) => `${c} ${d > 0 ? "+" : ""}${d.toFixed(1)}`).join(" · "),
    );
  }
  if (opts.weatherStates.some((w) => w === "STORM" || w === "RAIN")) {
    parts.push("Météo humide — attention à la récolte");
  }
  const hint =
    parts.length > 0 ? parts.join(" · ") : "Rien de critique pendant votre absence.";
  return {
    awayMs: opts.awayMs,
    awayLabel,
    cropsReady: opts.cropsReady,
    cropsGrowing: opts.cropsGrowing,
    marketDelta,
    weatherStates: opts.weatherStates,
    hint,
  };
}

function formatAway(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} j`;
}

/** Facteur rendement lié à la météo pendant la croissance `[GD]` */
export function weatherYieldFactor(weather?: WeatherState): number {
  switch (weather) {
    case "CLEAR":
      return 1.02;
    case "CLOUDY":
      return 1.0;
    case "RAIN":
      return 1.0; // humidité gérée à part à la récolte
    case "STORM":
      return 0.88;
    case "SNOW":
      return 0.75;
    default:
      return 1;
  }
}

/**
 * Chaîne de Markov météo par climat Köppen simplifié.
 * `rng` ∈ [0,1) pour tests déterministes.
 */
export function tickWeather(opts: {
  current: WeatherState;
  koppen: string;
  rng?: number;
}): { state: WeatherState; changed: boolean } {
  const r = opts.rng ?? Math.random();
  const table = weatherTransitions(opts.koppen);
  const row = table[opts.current] ?? table.CLEAR;
  let acc = 0;
  let next: WeatherState = opts.current;
  for (const [state, p] of row) {
    acc += p;
    if (r < acc) {
      next = state;
      break;
    }
  }
  return { state: next, changed: next !== opts.current };
}

function weatherTransitions(
  koppen: string,
): Record<WeatherState, Array<[WeatherState, number]>> {
  const k = koppen.toUpperCase();
  // Océanique (Cfb) : plus de pluie
  if (k.startsWith("C")) {
    return {
      CLEAR: [
        ["CLEAR", 0.45],
        ["CLOUDY", 0.35],
        ["RAIN", 0.15],
        ["STORM", 0.05],
        ["SNOW", 0],
      ],
      CLOUDY: [
        ["CLEAR", 0.25],
        ["CLOUDY", 0.35],
        ["RAIN", 0.3],
        ["STORM", 0.1],
        ["SNOW", 0],
      ],
      RAIN: [
        ["CLEAR", 0.15],
        ["CLOUDY", 0.35],
        ["RAIN", 0.35],
        ["STORM", 0.15],
        ["SNOW", 0],
      ],
      STORM: [
        ["CLEAR", 0.1],
        ["CLOUDY", 0.3],
        ["RAIN", 0.4],
        ["STORM", 0.2],
        ["SNOW", 0],
      ],
      SNOW: [
        ["CLOUDY", 0.4],
        ["RAIN", 0.3],
        ["SNOW", 0.3],
        ["CLEAR", 0],
        ["STORM", 0],
      ],
    };
  }
  // Continental (Dfa) : orages / neige possibles
  if (k.startsWith("D")) {
    return {
      CLEAR: [
        ["CLEAR", 0.5],
        ["CLOUDY", 0.25],
        ["RAIN", 0.1],
        ["STORM", 0.1],
        ["SNOW", 0.05],
      ],
      CLOUDY: [
        ["CLEAR", 0.3],
        ["CLOUDY", 0.3],
        ["RAIN", 0.2],
        ["STORM", 0.1],
        ["SNOW", 0.1],
      ],
      RAIN: [
        ["CLEAR", 0.2],
        ["CLOUDY", 0.3],
        ["RAIN", 0.25],
        ["STORM", 0.15],
        ["SNOW", 0.1],
      ],
      STORM: [
        ["CLEAR", 0.15],
        ["CLOUDY", 0.25],
        ["RAIN", 0.3],
        ["STORM", 0.2],
        ["SNOW", 0.1],
      ],
      SNOW: [
        ["CLEAR", 0.15],
        ["CLOUDY", 0.3],
        ["SNOW", 0.4],
        ["RAIN", 0.1],
        ["STORM", 0.05],
      ],
    };
  }
  // Défaut
  return {
    CLEAR: [
      ["CLEAR", 0.55],
      ["CLOUDY", 0.3],
      ["RAIN", 0.1],
      ["STORM", 0.05],
      ["SNOW", 0],
    ],
    CLOUDY: [
      ["CLEAR", 0.3],
      ["CLOUDY", 0.4],
      ["RAIN", 0.2],
      ["STORM", 0.1],
      ["SNOW", 0],
    ],
    RAIN: [
      ["CLEAR", 0.2],
      ["CLOUDY", 0.35],
      ["RAIN", 0.35],
      ["STORM", 0.1],
      ["SNOW", 0],
    ],
    STORM: [
      ["CLEAR", 0.15],
      ["CLOUDY", 0.35],
      ["RAIN", 0.35],
      ["STORM", 0.15],
      ["SNOW", 0],
    ],
    SNOW: [
      ["CLOUDY", 0.5],
      ["SNOW", 0.3],
      ["CLEAR", 0.2],
      ["RAIN", 0],
      ["STORM", 0],
    ],
  };
}

/** Pression NPC marché : offre/demande bruitée + boost offre si pluie large */
export function marketNpcPressure(opts: {
  weatherStates: WeatherState[];
  rng?: () => number;
}): { supplyTons: number; demandTons: number } {
  const rnd = opts.rng ?? Math.random;
  const wetShare =
    opts.weatherStates.filter((w) => w === "RAIN" || w === "STORM" || w === "SNOW").length /
    Math.max(1, opts.weatherStates.length);
  const stormShare =
    opts.weatherStates.filter((w) => w === "STORM").length / Math.max(1, opts.weatherStates.length);
  // Pluie → récoltes plus difficiles → offre ↓ ; orage → choc offre ↓↓ ; demande stable bruitée
  const supplyTons = 80 + rnd() * 60 - wetShare * 40 - stormShare * 50;
  const demandTons = 90 + rnd() * 70 + stormShare * 20;
  return {
    supplyTons: Math.max(10, Math.round(supplyTons)),
    demandTons: Math.max(10, Math.round(demandTons)),
  };
}
