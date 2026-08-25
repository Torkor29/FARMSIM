import {
  CROP_DEFS,
  cropGrowMs,
  GOOD_DEFS,
  DRYING,
  MARKET_BOUNDS,
  MARKET_REVERSION,
  MARKET_DEPTH_FLOOR,
  MARKET_KAPPA,
  MARKET_BOOK_WEIGHT,
  MARKET_ABSORB,
  MARKET_SUPPLY_ELASTICITY,
  MARKET_DEMAND_ELASTICITY,
  MARKET_ELASTIC_FLOOR,
  MARKET_ELASTIC_CEIL,
  type Season,
  residueBonus,
  ripenessAt,
  rotationFactor,
  DIRECT_SEED_YIELD_MALUS,
  NO_ROTATION,
  DIRT_DIRTY_THRESHOLD,
  weedYieldFactor,
  GAME_DAY_MS,
  SEASON_REAL_MS,
  SIM_TICK_MS,
  currentSeason,
  growthRate,
  weatherForDay,
  type Hemisphere,
  conditionPerHour,
  DIRT_PER_CELL_DEFAULT,
  DIRT_PER_CELL,
  GREASE_FULL,
  applyGreaseUse,
  greaseIsEmpty,
  greaseIsOk,
  REPAIR_RESTORE,
  type BreakdownKind,
  type RotationState,
  type CropCode,
  type TradeGood,
  type RipenessInfo,
  type Specialization,
  type WeatherState,
} from "@farmsim/shared";

/** Part d'un jour de jeu que couvre un tick de simulation. */
const PART_DE_JOUR = SIM_TICK_MS / GAME_DAY_MS;

/**
 * Plafond de l'intégration, en jours de jeu.
 *
 * Une culture oubliée est perdue bien avant — la fenêtre de récolte y veille.
 * Ce garde-fou n'existe que pour qu'une date aberrante en base ne fasse pas
 * boucler une requête indéfiniment.
 */
const MAX_GROWTH_DAYS = 400;

export type CellSimInput = {
  crop: CropCode;
  plantedAt: number;
  now: number;
  fertility: number;
  /** Pression d'adventices de la case, 0 à 1. */
  weedPressure?: number;
  fertilizedPasses: 0 | 1 | 2;
  specialization?: Specialization;
  weatherAtHarvest?: WeatherState;
  /** Bonus bâtiments ferme (ex. 0.03) */
  buildingYieldBonus?: number;
  /**
   * Bonus de compétences, **enveloppe séparée**.
   *
   * Il ne se mélange pas à celui des bâtiments : chacun a son plafond. Une
   * enveloppe unique qu'on relèverait pour loger les compétences dévaluerait
   * d'un coup tous les bâtiments déjà construits.
   */
  skillYieldBonus?: number;
  /** Déchaumages consécutifs avant ce semis — les résidus nourrissent le sol */
  residuePasses?: number;
  /** Semé dans les chaumes, sans travail du sol préalable */
  directSeeded?: boolean;
  /** Ce que la case portait avant ce semis, pour l'effet de rotation */
  rotation?: RotationState;
  /** Coupes déjà faites (herbe) : la suivante pousse plus vite */
  cutsDone?: number;
  /* -- Calendrier cultural. Absents : la pousse redevient un simple délai. -- */
  /** Hémisphère de la parcelle */
  hemisphere?: Hemisphere;
  /** Köppen de la zone, pour la météo du jour */
  koppen?: string;
  zoneCode?: string;
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
  /* Les adventices ne sont plus un interrupteur.
     `weedsControlled` valait dix pour cent de rendement et ne se déclenchait
     qu'en même temps que la fertilisation, en silence : le joueur n'apprenait
     jamais que ces dix pour cent existaient, et n'avait aucun geste pour les
     obtenir. La pression, elle, monte toute seule et se combat. */
  f *= weedYieldFactor(input.weedPressure);
  /*
   * Le métier ne donne plus de rendement.
   *
   * Un céréalier touchait +2 % sur toutes ses cultures, en silence : rien ne
   * l'affichait, et un éleveur ne pouvait pas l'obtenir puisque le choix se
   * faisait à l'inscription et ne se reprenait jamais. C'était le seul endroit
   * du jeu où la spécialisation donnait un vrai avantage chiffré — et donc le
   * seul endroit où elle enfermait vraiment.
   *
   * Ce que ces 2 % récompensaient — savoir mener une culture — se gagne
   * maintenant en semant : c'est `SOWING_BASICS`, puis la branche entière.
   */
  const b = Math.min(0.1, Math.max(0, input.buildingYieldBonus ?? 0));
  f *= 1 + b;
  // Les compétences, avec leur propre plafond.
  f *= 1 + Math.min(0.15, Math.max(0, input.skillYieldBonus ?? 0));
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
 * Une ou plusieurs passes de séchage : coût € + baisse d’humidité.
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

/**
 * Combien de jours de croissance une culture a réellement gagnés.
 *
 * On ne compte plus le temps qui passe, on compte le temps qui **pousse**.
 * Chaque jour de jeu vaut ce que la saison et le ciel de ce jour-là
 * autorisent : une journée de gel ne fait pas avancer un maïs, une pluie de
 * printemps fait plus qu'une journée.
 *
 * Météo et saison étant toutes deux des fonctions pures du calendrier, cette
 * intégration est déterministe et reproductible. On peut donc la projeter en
 * avant pour annoncer une date de maturité exacte, qui ne sera jamais
 * démentie — c'est ce qui évite d'ajouter la moindre colonne ou le moindre
 * tick.
 *
 * Sans zone climatique on retombe sur la seule saison ; sans saison du tout —
 * les rares appels de test qui ne fournissent pas d'horloge — on retombe sur
 * l'ancien comportement, jour pour jour.
 */
export function integrateGrowth(opts: {
  crop: CropCode;
  plantedAt: number;
  until: number;
  /** Hémisphère de la parcelle : le sud est décalé de deux saisons. */
  hemisphere?: Hemisphere;
  /** Classification Köppen de la zone, pour la météo du jour. */
  koppen?: string;
  zoneCode?: string;
}): number {
  if (!opts.hemisphere) return Math.max(0, opts.until - opts.plantedAt);
  const debut = Math.max(0, opts.plantedAt);
  const fin = Math.max(debut, opts.until);
  let acquis = 0;
  let curseur = debut;
  // Bornée : une culture oubliée une année entière est perdue bien avant, et
  // une boucle non bornée sur une date aberrante gèlerait la requête.
  let gardeFou = 0;
  while (curseur < fin && gardeFou < MAX_GROWTH_DAYS) {
    const jour = Math.floor(curseur / GAME_DAY_MS);
    const finDuJour = (jour + 1) * GAME_DAY_MS;
    /*
     * Même découpage que `projectReadyAt`, et c'est le point : ces deux
     * fonctions doivent lire la **même** grille. L'une avance la barre de
     * progression, l'autre annonce la date de maturité ; si elles n'intégraient
     * pas la même chose, la barre atteindrait 100 % un moment et la récolte
     * s'ouvrirait un autre — le genre d'écart qu'un joueur voit tout de suite
     * et qu'aucun test ne regarde.
     */
    const finDeSaison = (Math.floor(curseur / SEASON_REAL_MS) + 1) * SEASON_REAL_MS;
    const finDeTranche = Math.min(fin, finDuJour, finDeSaison);
    const tranche = finDeTranche - curseur;
    const saison = currentSeason(opts.hemisphere, curseur);
    const ciel =
      opts.koppen && opts.zoneCode
        ? weatherForDay(opts.koppen, saison, opts.zoneCode, jour)
        : undefined;
    acquis += tranche * growthRate(opts.crop, saison, ciel);
    curseur = Math.max(finDeTranche, curseur + 1);
    gardeFou += 1;
  }
  return acquis;
}

/**
 * Quand cette culture sera-t-elle mûre ?
 *
 * On avance jour par jour jusqu'à ce que le cumul atteigne le temps de pousse
 * de la culture, puis on interpole dans la journée pour ne pas arrondir la
 * date à la journée entière.
 */
export function projectReadyAt(opts: {
  crop: CropCode;
  plantedAt: number;
  growMs: number;
  hemisphere?: Hemisphere;
  koppen?: string;
  zoneCode?: string;
}): number {
  if (!opts.hemisphere) return opts.plantedAt + opts.growMs;
  let acquis = 0;
  let curseur = opts.plantedAt;
  for (let i = 0; i < MAX_GROWTH_DAYS; i++) {
    const jour = Math.floor(curseur / GAME_DAY_MS);
    const finDuJour = (jour + 1) * GAME_DAY_MS;
    /*
     * On découpe aussi aux frontières de **saison**, pas seulement de jour.
     *
     * Une saison fait sept jours de jeu pleins, donc les deux grilles
     * coïncident : ce `min` ne devrait jamais trancher. Il est là parce que
     * rien dans le code n'oblige la saison à contenir un nombre entier de
     * jours — c'est un réglage, pas une loi — et que le jour où ce ne serait
     * plus le cas, un pas d'un jour entier lirait la saison du **début** du
     * pas et l'appliquerait à toute la tranche : la vitesse de l'hiver
     * s'appliquerait à des heures de printemps, sans que rien ne le signale.
     *
     * Le plancher d'une milliseconde évite qu'une frontière tombant à
     * l'ulp près sur le curseur fasse tourner la boucle sans avancer.
     */
    const finDeSaison = (Math.floor(curseur / SEASON_REAL_MS) + 1) * SEASON_REAL_MS;
    const finDeTranche = Math.max(Math.min(finDuJour, finDeSaison), curseur + 1);
    const tranche = finDeTranche - curseur;
    const saison = currentSeason(opts.hemisphere, curseur);
    const ciel =
      opts.koppen && opts.zoneCode
        ? weatherForDay(opts.koppen, saison, opts.zoneCode, jour)
        : undefined;
    const vitesse = growthRate(opts.crop, saison, ciel);
    const gain = tranche * vitesse;
    if (acquis + gain >= opts.growMs) {
      // Vitesse nulle : la culture n'avance pas sur cette tranche, on passe à
      // la suivante plutôt que de diviser par zéro.
      if (vitesse <= 0) {
        curseur = finDeTranche;
        continue;
      }
      return Math.round(curseur + (opts.growMs - acquis) / vitesse);
    }
    acquis += gain;
    curseur = finDeTranche;
  }
  return curseur;
}

export function simulateCell(input: CellSimInput): CellSimResult {
  const def = CROP_DEFS[input.crop];
  const growMs = cropGrowMs(input.crop, input.cutsDone ?? 0);
  // La maturité n'est plus une échéance posée au semis mais le point où le
  // cumul de croissance atteint le temps de pousse. Sans horloge de zone,
  // `integrateGrowth` rend le temps brut : l'ancien comportement, à
  // l'identique, pour les appels qui ne connaissent pas la parcelle.
  const readyAt = projectReadyAt({
    crop: input.crop,
    plantedAt: input.plantedAt,
    growMs,
    hemisphere: input.hemisphere,
    koppen: input.koppen,
    zoneCode: input.zoneCode,
  });
  const acquis = integrateGrowth({
    crop: input.crop,
    plantedAt: input.plantedAt,
    until: input.now,
    hemisphere: input.hemisphere,
    koppen: input.koppen,
    zoneCode: input.zoneCode,
  });
  const progress = Math.min(1, Math.max(0, acquis / growMs));
  const ready = acquis >= growMs;
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
  const kappa = input.kappa ?? MARKET_KAPPA;
  /**
   * Deux déséquilibres, chacun rapporté à sa propre échelle.
   *
   * L'ancienne formule divisait le **stock** par le **flux** — des tonnes par
   * des tonnes-par-tick — et le terme de carnet, valant plusieurs dizaines,
   * écrasait complètement le terme de flux, qui valait quelques centièmes.
   * Le prix ne répondait donc jamais à l'offre et à la demande du jour.
   *
   * Ici le flux se compare au flux, et le carnet à la profondeur de référence :
   * les deux termes sont sans dimension et du même ordre de grandeur.
   */
  /*
   * Le plancher du dénominateur suit l'échelle des flux.
   *
   * Une demi-tonne en dur : elle ne mordait jamais tant qu'un tick portait
   * deux tonnes de flux PNJ. Les flux étant désormais exprimés par jour de
   * jeu, un tick n'en porte plus qu'un millième — le plancher devenait le
   * dénominateur pour de bon, et la moisson d'une seule parcelle produisait
   * un déséquilibre quarante fois trop grand. Le garde-fou doit protéger de
   * la division par zéro, pas redéfinir l'échelle.
   */
  const flux =
    (input.demandTons - input.supplyTons) /
    Math.max(0.5 * PART_DE_JOUR, (input.demandTons + input.supplyTons) / 2);
  const carnet = (input.stockTons - bounds.depth * MARKET_DEPTH_FLOOR) / bounds.depth;
  const imbalance = flux - carnet * MARKET_BOOK_WEIGHT;
  let price = input.price * (1 + kappa * imbalance);
  // Rappel vers le prix de référence : sans lui, un déséquilibre durable
  // poussait le cours jusqu'à sa borne et l'y laissait pour toujours.
  price += (bounds.initial - price) * MARKET_REVERSION;
  price = Math.min(bounds.max, Math.max(bounds.min, price));

  /**
   * Le carnet s'écoule en proportion de ce qu'il contient.
   *
   * Il ne se vidait que par la différence entre demande et offre — un flux
   * **fixe** d'environ quinze tonnes par tick. La moisson du joueur, elle,
   * valait un sixième de tonne par tick : elle était donc effacée en trois
   * ticks, quel que soit son domaine. C'est la raison de fond pour laquelle
   * vingt parcelles ne déplaçaient pas le cours d'un centime.
   *
   * Un écoulement proportionnel change la nature de la chose : ce qui s'ajoute
   * au carnet met d'autant plus de temps à partir qu'il y en a, et pèse sur le
   * cours pendant tout ce temps. La demi-vie d'un excédent est d'environ vingt
   * minutes — le temps qu'une moisson soit un événement de marché.
   *
   * Le carnet ne se vide jamais complètement pour autant : il reste toujours
   * des acheteurs, sans quoi la moindre vente subirait la décote maximale.
   */
  const floor = bounds.depth * MARKET_DEPTH_FLOOR;
  const apres = input.stockTons + input.supplyTons - input.demandTons;
  const stockTons = Math.max(floor, apres - Math.max(0, apres - floor) * MARKET_ABSORB);
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

/**
 * Usure d'une machine après N heures de travail. Hangar = −15 % `[GD]`.
 *
 * Prend des **heures**, plus des cases : l'usure d'un moteur suit le temps
 * qu'il tourne, pas la surface qu'il survole. C'est aussi la seule échelle où
 * le joueur peut juger — « 4,9 h pour ce champ, il m'en reste 620 avant la
 * révision » se comprend, « 0,11 point par case » non.
 */
export function applyMachineWear(opts: {
  condition: number;
  /** Heures de ce chantier — voir `jobHours`. */
  hours: number;
  /** Heures de travail pour user 100 points, au soin neutre. */
  lifeHours: number;
  inShed?: boolean;
  etaBonus?: boolean;
  /** Multiplicateur entretien (graisse, saleté) */
  careMult?: number;
}): { condition: number; wearApplied: number } {
  let mult = 1;
  if (opts.inShed) mult *= 0.85;
  if (opts.etaBonus) mult *= 0.9;
  mult *= Math.max(0.5, opts.careMult ?? 1);
  const wearApplied =
    Math.round(conditionPerHour(opts.lifeHours) * Math.max(0, opts.hours) * mult * 100) / 100;
  const condition = Math.max(0, Math.round((opts.condition - wearApplied) * 100) / 100);
  return { condition, wearApplied };
}

export { repairQuote as repairMachineCost, repairHalfwayTarget } from "@farmsim/shared";
// Formules d'entretien : elles vivaient ici, `conditionYieldFactor` vivait
// dans shared. Même sujet, deux paquets — et le web, qui ne dépend que de
// shared, ne pouvait pas afficher ce que la simulation calculait. Elles sont
// regroupées côté shared ; ce ré-export garde les appelants intacts.
export { careWearMultiplier, careYieldBonus } from "@farmsim/shared";

// Déplacés côté shared : l'écran doit pouvoir dire, avant le clic, ce que le
// serveur répondrait après. Ce ré-export garde les appelants intacts, et
// l'import ramène les noms dans la portée de ce module.
import { machineCanWork, machineWorkBlock, type MachineCareState } from "@farmsim/shared";
export { machineCanWork, machineWorkBlock, type MachineCareState };

export function dirtFromWork(work: string, cells: number): number {
  const per = DIRT_PER_CELL[work] ?? DIRT_PER_CELL_DEFAULT;
  return Math.round(per * Math.max(0, cells) * 100) / 100;
}

export function pickBreakdownKind(condition: number): BreakdownKind {
  if (condition < 20) return "ENGINE";
  if (condition < 45) return "HYDRAULIC";
  return "BELT";
}

export function breakdownChance(opts: {
  condition: number;
  greased?: boolean;
  grease?: number;
  dirt: number;
}): number {
  if (opts.condition >= 50) return 0;
  const ok = opts.grease != null ? greaseIsOk(opts.grease) : Boolean(opts.greased);
  const empty = opts.grease != null ? greaseIsEmpty(opts.grease) : opts.greased === false;
  if (ok && opts.dirt < DIRT_DIRTY_THRESHOLD) return 0;
  let p = ((50 - opts.condition) / 50) * 0.35;
  if (empty) p += 0.15;
  if (opts.dirt >= 50) p += 0.15;
  return Math.round(Math.min(0.55, Math.max(0, p)) * 1000) / 1000;
}


export function applyJobCare(
  state: MachineCareState,
  opts: { work: string; cells: number; rng?: () => number },
): { next: MachineCareState; broke: boolean } {
  const rng = opts.rng ?? Math.random;
  const current = state.grease ?? (state.greased ? GREASE_FULL : 0);
  const grease = applyGreaseUse(current, opts.cells, state.dirt);
  const dirt = Math.min(100, Math.round((state.dirt + dirtFromWork(opts.work, opts.cells)) * 100) / 100);
  const wasEmpty = greaseIsEmpty(current);
  const empty = greaseIsEmpty(grease);
  const streak = empty ? (wasEmpty ? state.greaseSkipStreak + 1 : 0) : 0;
  const chance = breakdownChance({
    condition: state.condition,
    grease,
    dirt: state.dirt,
  });
  const broke = rng() < chance;
  const breakdown = broke ? pickBreakdownKind(state.condition) : state.breakdown;
  return {
    broke,
    next: {
      condition: state.condition,
      grease,
      greased: !empty,
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
  // Le bilan s'adresse au joueur, pas au serveur : il lisait « WHEAT -6.5 ·
  // MEAT -62.6 · RAPE +1.5 », neuf codes machine d'affilée. Et neuf lignes de
  // cours, c'est un mur : seuls les trois plus gros mouvements se disent.
  const movers = Object.entries(marketDelta)
    .filter(([, d]) => Math.abs(d) >= 1)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);
  if (movers.length) {
    parts.push(
      movers
        .map(([c, d]) => {
          const name = GOOD_DEFS[c as TradeGood]?.name ?? c;
          return `${name} ${d > 0 ? "+" : ""}${d.toFixed(1)}`;
        })
        .join(" · "),
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
/**
 * Offre et demande des fermes voisines, par tick `[GD]`.
 *
 * Elles valaient 80 à 140 tonnes **par tick**, soit près de vingt mille
 * tonnes à l'heure — quand une parcelle de blé du joueur en produit quarante.
 * Le marché PNJ pesait donc **491 fois** une parcelle : mesuré, un domaine de
 * vingt parcelles ne déplaçait pas le cours d'un centime. La production du
 * joueur était branchée sur le prix, et noyée.
 *
 * Aucune formule ne corrigeait cela : c'était une affaire d'échelle. Les flux
 * sont désormais de l'ordre de ce que produit une ferme, et le joueur devient
 * un acteur de son marché — d'abord négligeable, puis pesant.
 */
export const NPC_SUPPLY_PER_SEASON = 160;

/**
 * Ce que les voisins mettent au marché à chaque tick.
 *
 * Dérivé d'un volume **par saison**, et non posé par tick : écrit par tick, le
 * flux dépendrait du pas de simulation, ce qui n'a aucun sens agricole.
 *
 * Il a d'abord été écrit par jour de jeu, et c'était encore une unité de trop :
 * le voisinage cultive les mêmes plantes que le joueur, sur le même calendrier.
 * Quand le blé est devenu la céréale d'hiver qu'il aurait toujours dû être —
 * semé à l'automne, moissonné l'été, près de trois saisons — la récolte du
 * joueur s'est espacée d'autant, mais pas celle des voisins : à volume par
 * jour constant, ils produisaient quatre fois plus par cycle cultural, et la
 * moisson du joueur repassait sous le bruit. C'est le défaut d'origine, par
 * une troisième porte.
 *
 * Cent soixante tonnes par saison, c'est l'ordre de grandeur de neuf parcelles
 * de blé — un voisinage, pas un marché mondial. C'était l'intention depuis le
 * début ; seule l'unité qui la portait était fausse.
 */
export const NPC_BASE_SUPPLY = (NPC_SUPPLY_PER_SEASON * SIM_TICK_MS) / SEASON_REAL_MS;

/**
 * La demande égale l'offre en moyenne : c'est la **saison** qui creuse
 * l'excédent d'automne et la pénurie de printemps, pas un déséquilibre
 * permanent qui ferait dériver le cours dans un seul sens.
 */
export const NPC_DEMAND_PER_SEASON = 160;

/** Idem côté demande, dérivée du volume par saison. */
export const NPC_BASE_DEMAND = (NPC_DEMAND_PER_SEASON * SIM_TICK_MS) / SEASON_REAL_MS;

/**
 * Le cycle annuel de l'offre voisine `[GD]`.
 *
 * Il n'existait pas : la pression PNJ ne lisait que la météo, jamais la
 * saison. Le marché n'avait donc aucune raison d'être meilleur un mois que
 * l'autre, et la seule décision qu'un marché puisse offrir — engranger ou
 * vendre tout de suite — n'existait pas.
 *
 * L'automne apporte les moissons du voisinage et fait céder les cours ; le
 * printemps est la soudure, où les greniers sont vides et les prix hauts.
 * Les coefficients ont été élargis quand l'offre PNJ est devenue élastique :
 * une offre qui se retire quand le cours cède amortit aussi la saison, et
 * l'écart annuel était retombé à 19 %. À 0,82 / 1,18, l'équilibre mesuré
 * saison par saison donne +17 % au printemps et −13 % à l'automne, soit un
 * tiers d'écart du creux au sommet : vendre au bon moment est une décision.
 */
export const NPC_SEASON_SUPPLY: Record<Season, number> = {
  SPRING: 0.82,
  SUMMER: 1,
  AUTUMN: 1.18,
  WINTER: 0.925,
};

export function marketNpcPressure(opts: {
  weatherStates: WeatherState[];
  /** Saison locale — c'est elle qui fait le cycle annuel des cours. */
  season?: Season;
  /**
   * Cours du jour et prix de référence de la denrée. Fournis ensemble, ils
   * rendent les flux PNJ élastiques : c'est ce qui remplace le rappel décrété
   * vers un prix fixe. Omis, on retombe sur des flux inélastiques — le cas
   * des vieux tests et des denrées sans borne connue.
   */
  price?: number;
  reference?: number;
  rng?: () => number;
}): { supplyTons: number; demandTons: number } {
  const rnd = opts.rng ?? Math.random;
  const wetShare =
    opts.weatherStates.filter((w) => w === "RAIN" || w === "STORM" || w === "SNOW").length /
    Math.max(1, opts.weatherStates.length);
  const stormShare =
    opts.weatherStates.filter((w) => w === "STORM").length / Math.max(1, opts.weatherStates.length);

  // Pluie → récoltes plus difficiles → offre ↓ ; orage → choc d'offre ↓↓.
  const meteo = 1 - wetShare * 0.25 - stormShare * 0.3;
  const saison = NPC_SEASON_SUPPLY[opts.season ?? "SUMMER"];

  /**
   * Réponse au cours.
   *
   * Le marché ne revient pas à son prix de départ parce qu'on le lui ordonne,
   * mais parce qu'à bas prix les vendeurs se retirent et les acheteurs
   * reviennent. Ce sont deux courbes qui se croisent, et le point de
   * croisement se déplace : une saison d'abondance, ou un domaine qui déverse
   * sa moisson, le fait glisser vers le bas et l'y laisse.
   *
   * Les butées font le reste du travail : personne n'arrête complètement de
   * produire, personne n'achète sans fin. Passé la butée, l'excédent reste sur
   * le marché et le cours reste bas.
   */
  const ratio =
    opts.price && opts.reference && opts.reference > 0 ? opts.price / opts.reference : 1;
  const borne = (x: number): number =>
    Math.min(MARKET_ELASTIC_CEIL, Math.max(MARKET_ELASTIC_FLOOR, x));
  const offreElastique = borne(Math.pow(ratio, MARKET_SUPPLY_ELASTICITY));
  const demandeElastique = borne(Math.pow(ratio, -MARKET_DEMAND_ELASTICITY));

  const supplyTons = NPC_BASE_SUPPLY * saison * meteo * offreElastique * (0.8 + rnd() * 0.4);
  const demandTons =
    NPC_BASE_DEMAND * demandeElastique * (0.9 + rnd() * 0.2) +
    stormShare * 0.3 * PART_DE_JOUR;
  /*
   * Le plancher suit la même échelle que le flux.
   *
   * Il valait deux dixièmes de tonne par tick, ce qui tenait tant qu'un tick
   * pesait un quarante-cinquième de journée. À l'échelle actuelle il aurait
   * dépassé le flux lui-même et serait devenu le régime normal du marché :
   * plus personne n'aurait été élastique.
   */
  const plancher = 0.2 * PART_DE_JOUR;
  return {
    supplyTons: Math.max(plancher, Math.round(supplyTons * 1e6) / 1e6),
    demandTons: Math.max(plancher, Math.round(demandTons * 1e6) / 1e6),
  };
}
