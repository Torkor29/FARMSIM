/**
 * Fenêtre de récolte : ce qui arrive à une culture qu'on laisse sur pied.
 *
 * Une parcelle mûre ne se conserve pas indéfiniment. Le rendement descend
 * par paliers d'horloge réelle — pas en multiples de la croissance, trop
 * courts pour qu'on ait le temps de revenir. On peut encore récolter à
 * 10 %, même après un jour : il n'y a plus de perte sèche à labourer.
 */

export type RipenessStage = "PEAK" | "DECLINING" | "POOR" | "LOST";

export type RipenessInfo = {
  stage: RipenessStage;
  label: string;
  /** Multiplicateur de rendement appliqué à la récolte, 0 à 1 */
  yieldFactor: number;
  /** Temps restant avant le palier suivant, en ms. `null` au dernier palier. */
  msToNextStage: number | null;
  /** Temps restant avant le plancher de 10 %, en ms. `0` si déjà atteint. */
  msToLoss: number;
  /** Toujours faux : une culture trop mûre se récolte encore, plus mal. */
  needsPlowing: boolean;
};

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * Bornes des paliers, en millisecondes **depuis la maturité**.
 *
 * 100 % → 90 % (30 min) → 80 % (1 h) → 70 % (2 h) → 60 % (3 h) →
 * 50 % (4 h, bloqué) → 10 % (24 h, définitif).
 */
export const RIPENESS_MS = {
  to90: 30 * MIN,
  to80: 1 * HOUR,
  to70: 2 * HOUR,
  to60: 3 * HOUR,
  to50: 4 * HOUR,
  to10: 24 * HOUR,
} as const;

/** Rendement conservé à chaque palier. */
export const RIPENESS_YIELD = {
  peak: 1,
  y90: 0.9,
  y80: 0.8,
  y70: 0.7,
  y60: 0.6,
  y50: 0.5,
  floor: 0.1,
} as const;

/**
 * En dessous de 70 %, récolter soi-même ne rapporte plus d'XP.
 * À 70 % pile, l'XP tombe encore.
 */
export const HARVEST_XP_MIN_YIELD = RIPENESS_YIELD.y70;

export function harvestGivesXp(yieldFactor: number): boolean {
  return yieldFactor + 1e-9 >= HARVEST_XP_MIN_YIELD;
}

type RipenessStep = {
  afterMs: number;
  yieldFactor: number;
  stage: RipenessStage;
};

const STEPS: readonly RipenessStep[] = [
  { afterMs: 0, yieldFactor: RIPENESS_YIELD.peak, stage: "PEAK" },
  { afterMs: RIPENESS_MS.to90, yieldFactor: RIPENESS_YIELD.y90, stage: "DECLINING" },
  { afterMs: RIPENESS_MS.to80, yieldFactor: RIPENESS_YIELD.y80, stage: "DECLINING" },
  { afterMs: RIPENESS_MS.to70, yieldFactor: RIPENESS_YIELD.y70, stage: "DECLINING" },
  { afterMs: RIPENESS_MS.to60, yieldFactor: RIPENESS_YIELD.y60, stage: "POOR" },
  { afterMs: RIPENESS_MS.to50, yieldFactor: RIPENESS_YIELD.y50, stage: "POOR" },
  { afterMs: RIPENESS_MS.to10, yieldFactor: RIPENESS_YIELD.floor, stage: "LOST" },
];

export const RIPENESS_LABELS: Record<RipenessStage, string> = {
  PEAK: "À point",
  DECLINING: "Se dégrade",
  POOR: "Rendement faible",
  LOST: "Laissée trop longtemps",
};

/** Teintes de la culture sur la grille, du blé mûr à la tige fatiguée. */
export const RIPENESS_COLORS: Record<RipenessStage, number> = {
  PEAK: 0xe8c65e,
  DECLINING: 0xc99a45,
  POOR: 0x9a7040,
  LOST: 0x6e6154,
};

/**
 * État d'une culture arrivée à maturité.
 *
 * @param readyAt  instant où la culture est devenue mûre
 * @param growMs   ignoré : la fenêtre est une horloge réelle, pas un multiple
 * @param now      instant courant
 */
export function ripenessAt(readyAt: number, growMs: number, now: number): RipenessInfo {
  void growMs;
  const overMs = Math.max(0, now - readyAt);
  let current = STEPS[0]!;
  let next: RipenessStep | null = STEPS[1] ?? null;
  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i]!;
    if (overMs >= step.afterMs) {
      current = step;
      next = STEPS[i + 1] ?? null;
    }
  }
  const floorAt = readyAt + RIPENESS_MS.to10;
  return {
    stage: current.stage,
    label: RIPENESS_LABELS[current.stage],
    yieldFactor: current.yieldFactor,
    msToNextStage: next ? Math.max(0, readyAt + next.afterMs - now) : null,
    msToLoss: Math.max(0, floorAt - now),
    needsPlowing: false,
  };
}

/** Coût du labour d'une case `[GD]` — moins qu'un semis, mais pas gratuit. */
export const PLOW_COST_PER_CELL = 8;

/**
 * Une parcelle laissée à l'abandon s'appauvrit : les adventices montent en
 * graine et le sol se tasse. `[GD]`
 */
export const LOST_CROP_FERTILITY_MALUS = 0.01;
