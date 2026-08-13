import {
  CROP_DEFS,
  cropGrowMs,
  DRYING,
  MARKET_BOUNDS,
  MARKET_REVERSION,
  MARKET_DEPTH_FLOOR,
  residueBonus,
  ripenessAt,
  rotationFactor,
  DIRECT_SEED_YIELD_MALUS,
  NO_ROTATION,
  DIRT_DIRTY_THRESHOLD,
  DIRT_PER_CELL,
  REPAIR_RESTORE,
  type BreakdownKind,
  type RotationState,
  type CropCode,
  type TradeGood,
  type RipenessInfo,
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
  /** Déchaumages consécutifs avant ce semis — les résidus nourrissent le sol */
  residuePasses?: number;
  /** Semé dans les chaumes, sans travail du sol préalable */
  directSeeded?: boolean;
  /** Ce que la case portait avant ce semis, pour l'effet de rotation */
  rotation?: RotationState;
  /** Coupes déjà faites (herbe) : la suivante pousse plus vite */
  cutsDone?: number;
};

export type CellSimResult = {
  ready: boolean;
  progress: number;
  readyAt: number;
  /** Rendement attendu, décote de sur-maturité déjà appliquée */
  estimatedYieldTons: number;
  moisturePenalty: number;
  /** État de la culture depuis sa maturité — `null` tant qu'elle pousse */
  ripeness: RipenessInfo | null;
  /** Vrai quand la culture est perdue : plus rien à récolter, il faut labourer */
  lost: boolean;
};

function managementFactor(input: CellSimInput): number {
  let f = 0.55;
  f += Math.min(1, Math.max(0, input.fertility)) * 0.2;
  f += input.fertilizedPasses * 0.115;
  f += input.weedsControlled ? 0.1 : 0;
  if (input.specialization === "CEREALIER") f *= 1.02;
  const b = Math.min(0.1, Math.max(0, input.buildingYieldBonus ?? 0));
  f *= 1 + b;
  // Les résidus de la récolte précédente, incorporés au déchaumeur, se
  // décomposent et nourrissent la culture en place.
  f *= 1 + residueBonus(input.residuePasses ?? 0);
  return Math.min(1.5, f);
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
 * Une ou plusieurs passes de séchage : coût TRN + baisse d’humidité.
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
  const growMs = cropGrowMs(input.crop, input.cutsDone ?? 0);
  const readyAt = input.plantedAt + growMs;
  const progress = Math.min(1, Math.max(0, (input.now - input.plantedAt) / growMs));
  const ready = input.now >= readyAt;
  const mgmt = managementFactor(input);
  const wet = moisturePenalty(input.weatherAtHarvest);
  const climate = weatherYieldFactor(input.weatherAtHarvest);
  // La sur-maturité s'applique en dernier : elle ronge un rendement déjà
  // calculé, elle ne se compense pas par une bonne conduite de culture.
  const ripeness = ready ? ripenessAt(readyAt, growMs, input.now) : null;
  const overripe = ripeness?.yieldFactor ?? 1;
  // Rotation et semis direct se décident avant la mise en terre : ce sont des
  // coefficients sur le potentiel de la case, indépendants de la conduite de
  // culture, d'où leur place à côté du climat plutôt que dans `managementFactor`.
  const rotation = rotationFactor(input.rotation ?? NO_ROTATION, input.crop);
  const tillage = input.directSeeded ? 1 - DIRECT_SEED_YIELD_MALUS : 1;
  const estimatedYieldTons =
    def.yieldPerCell * mgmt * climate * (1 - wet) * overripe * rotation * tillage;
  return {
    ready,
    progress,
    readyAt,
    estimatedYieldTons: Math.round(estimatedYieldTons * 1000) / 1000,
    moisturePenalty: wet,
    ripeness,
    lost: ripeness?.needsPlowing ?? false,
  };
}

/** @deprecated alias — tests / anciens appels */
export const simulateField = simulateCell;

export type MarketTickInput = {
  commodity: TradeGood;
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
  // Rappel vers le prix de référence : sans lui, un déséquilibre durable
  // poussait le cours jusqu'à sa borne et l'y laissait pour toujours.
  price += (bounds.initial - price) * MARKET_REVERSION;
  price = Math.min(bounds.max, Math.max(bounds.min, price));

  // Le carnet ne se vide jamais complètement : il reste toujours des
  // acheteurs, sans quoi la moindre vente subissait la décote maximale.
  const floor = bounds.depth * MARKET_DEPTH_FLOOR;
  const stockTons = Math.max(
    floor,
    input.stockTons + input.supplyTons - input.demandTons,
  );
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
  /** Multiplicateur entretien (pas graissé, sale) */
  careMult?: number;
}): { condition: number; wearApplied: number } {
  let mult = 1;
  if (opts.inShed) mult *= 0.85;
  if (opts.etaBonus) mult *= 0.9;
  const care = Math.max(0.5, opts.careMult ?? 1);
  mult *= care;
  const wearApplied =
    Math.round(opts.wearPerCell * Math.max(0, opts.cells) * mult * 100) / 100;
  const condition = Math.max(0, Math.round((opts.condition - wearApplied) * 100) / 100);
  return { condition, wearApplied };
}

export { repairQuote as repairMachineCost, repairHalfwayTarget } from "@farmsim/shared";

export function machineCanWork(condition: number, minCondition: number): boolean {
  return condition >= minCondition;
}

export type MachineCareState = {
  condition: number;
  greased: boolean;
  dirt: number;
  greaseSkipStreak: number;
  breakdown: BreakdownKind | null;
};

export function careWearMultiplier(opts: { greased: boolean; dirt: number }): number {
  const clean = opts.dirt < DIRT_DIRTY_THRESHOLD;
  if (opts.greased && clean) return 0.75;
  let m = 1;
  if (!opts.greased) m *= 1.5;
  if (!clean) m *= 2;
  return m;
}

/** Propre et graissé : un peu plus de récolte. Sale et à sec : un peu moins. */
export function careYieldBonus(opts: { greased: boolean; dirt: number }): number {
  const clean = opts.dirt < DIRT_DIRTY_THRESHOLD;
  if (opts.greased && clean) return 0.08;
  if (!opts.greased && !clean) return -0.06;
  return 0;
}

export function dirtFromWork(work: string, cells: number): number {
  const per = DIRT_PER_CELL[work] ?? 0.8;
  return Math.round(per * Math.max(0, cells) * 100) / 100;
}

export function pickBreakdownKind(condition: number): BreakdownKind {
  if (condition < 20) return "ENGINE";
  if (condition < 45) return "HYDRAULIC";
  return "BELT";
}

export function breakdownChance(opts: {
  condition: number;
  greased: boolean;
  dirt: number;
}): number {
  if (opts.condition >= 50) return 0;
  if (opts.greased && opts.dirt < DIRT_DIRTY_THRESHOLD) return 0;
  let p = ((50 - opts.condition) / 50) * 0.35;
  if (!opts.greased) p += 0.15;
  if (opts.dirt >= 50) p += 0.15;
  return Math.round(Math.min(0.55, Math.max(0, p)) * 1000) / 1000;
}

export function machineWorkBlock(
  state: MachineCareState,
  minCondition: number,
): { code: "BROKEN" | "NEED_GREASE" | "NEED_REPAIR"; message: string } | null {
  if (state.breakdown) {
    return { code: "BROKEN", message: "En panne — réparez à l'atelier." };
  }
  if (!machineCanWork(state.condition, minCondition)) {
    return { code: "NEED_REPAIR", message: "Condition trop basse — réparez." };
  }
  if (!state.greased && state.greaseSkipStreak >= 1) {
    return { code: "NEED_GREASE", message: "Graissez avant de repartir." };
  }
  return null;
}

export function applyJobCare(
  state: MachineCareState,
  opts: { work: string; cells: number; rng?: () => number },
): { next: MachineCareState; broke: boolean } {
  const rng = opts.rng ?? Math.random;
  const dirt = Math.min(100, Math.round((state.dirt + dirtFromWork(opts.work, opts.cells)) * 100) / 100);
  const streak = state.greased ? 0 : state.greaseSkipStreak + 1;
  const chance = breakdownChance({
    condition: state.condition,
    greased: state.greased,
    dirt: state.dirt,
  });
  const broke = rng() < chance;
  const breakdown = broke ? pickBreakdownKind(state.condition) : state.breakdown;
  return {
    broke,
    next: {
      condition: state.condition,
      greased: false,
      dirt,
      greaseSkipStreak: streak,
      breakdown,
    },
  };
}

export function repairTargetCondition(
  kind: BreakdownKind,
  condition: number,
): number {
  const spec = REPAIR_RESTORE[kind];
  if (spec.conditionDelta === "full") return 100;
  return Math.min(100, Math.round((condition + spec.conditionDelta) * 100) / 100);
}

/** Construit le résumé de retour après absence */
export function buildSessionResume(opts: {
  awayMs: number;
  cropsReady: number;
  cropsGrowing: number;
  /** Cases dont la culture s'est perdue faute d'avoir été récoltée à temps */
  cropsLost?: number;
  /** Cases dont la récolte se dégrade déjà */
  cropsDeclining?: number;
  /** Troupeaux dont la réserve d'aliment est vide */
  herdsHungry?: number;
  marketBefore: Record<string, number>;
  marketNow: Record<string, number>;
  weatherStates: string[];
}): {
  awayMs: number;
  awayLabel: string;
  cropsReady: number;
  cropsGrowing: number;
  cropsLost: number;
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
  // Les mauvaises nouvelles d'abord : une perte découverte par hasard, une
  // heure plus tard, est bien plus frustrante qu'une perte annoncée.
  const lost = opts.cropsLost ?? 0;
  if (lost > 0) parts.push(`${lost} culture(s) perdue(s) — à labourer`);
  const declining = opts.cropsDeclining ?? 0;
  if (declining > 0) parts.push(`${declining} récolte(s) qui se dégradent`);
  const hungry = opts.herdsHungry ?? 0;
  if (hungry > 0) parts.push(`${hungry} troupeau(x) sans ration`);
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
    cropsLost: lost,
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
