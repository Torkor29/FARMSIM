/**
 * Fenêtre de récolte : ce qui arrive à une culture qu'on laisse sur pied.
 *
 * Une parcelle mûre ne se conserve pas indéfiniment. Elle traverse quatre
 * paliers : un pic où le rendement est plein, une décote lente, une décote
 * brutale, puis la perte sèche — les grains versent, germent ou pourrissent,
 * et il ne reste qu'à passer le tracteur.
 *
 * Toutes les durées sont exprimées en multiples du temps de croissance de la
 * culture, jamais en minutes fixes : une culture lente doit tolérer une
 * négligence proportionnellement aussi longue qu'une culture rapide.
 *
 * @see docs/research/38_HARVEST_WINDOW.md
 */

export type RipenessStage = "PEAK" | "DECLINING" | "POOR" | "LOST";

export type RipenessInfo = {
  stage: RipenessStage;
  label: string;
  /** Multiplicateur de rendement appliqué à la récolte, 0 à 1 */
  yieldFactor: number;
  /** Temps restant avant le palier suivant, en ms. `null` au dernier palier. */
  msToNextStage: number | null;
  /** Temps restant avant la perte totale, en ms. `0` si déjà perdue. */
  msToLoss: number;
  /** Vrai quand seul le labour peut libérer la case */
  needsPlowing: boolean;
};

/**
 * Bornes des paliers, en multiples de `growMs` écoulés **depuis la maturité**.
 * `[GD]`
 *
 * Avec du blé (croissance 3 min) : plein rendement pendant 1 min 30,
 * dégradation jusqu'à 4 min 30, culture à l'agonie jusqu'à 7 min 30, perdue
 * au-delà. La fenêtre confortable est courte mais la perte totale demande une
 * vraie négligence.
 */
export const RIPENESS_WINDOW = {
  /** Fin du plein rendement */
  peakEnd: 0.5,
  /** Fin de la décote lente */
  decliningEnd: 1.5,
  /** Fin de la décote brutale — au-delà, la culture est perdue */
  poorEnd: 2.5,
} as const;

/** Rendement conservé à la fin de chaque palier `[GD]` */
export const RIPENESS_YIELD = {
  peak: 1,
  /** À la fin de la décote lente : on a déjà perdu un tiers */
  declining: 0.65,
  /** À la fin de la décote brutale : il ne reste presque rien */
  poor: 0.2,
  lost: 0,
} as const;

export const RIPENESS_LABELS: Record<RipenessStage, string> = {
  PEAK: "À point",
  DECLINING: "Se dégrade",
  POOR: "Presque perdue",
  LOST: "Perdue — à labourer",
};

/** Teintes de la culture sur la grille, du blé mûr à la tige morte. */
export const RIPENESS_COLORS: Record<RipenessStage, number> = {
  PEAK: 0xe8c65e,
  DECLINING: 0xc99a45,
  POOR: 0x9a7040,
  LOST: 0x6e6154,
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/**
 * État d'une culture arrivée à maturité.
 *
 * @param readyAt  instant où la culture est devenue mûre
 * @param growMs   temps de croissance de la culture, qui donne l'échelle
 * @param now      instant courant
 */
export function ripenessAt(readyAt: number, growMs: number, now: number): RipenessInfo {
  const overMs = now - readyAt;
  const scale = Math.max(1, growMs);
  const over = overMs / scale;
  const lossAt = readyAt + RIPENESS_WINDOW.poorEnd * scale;
  const msToLoss = Math.max(0, lossAt - now);

  if (over < RIPENESS_WINDOW.peakEnd) {
    return {
      stage: "PEAK",
      label: RIPENESS_LABELS.PEAK,
      yieldFactor: RIPENESS_YIELD.peak,
      msToNextStage: readyAt + RIPENESS_WINDOW.peakEnd * scale - now,
      msToLoss,
      needsPlowing: false,
    };
  }

  if (over < RIPENESS_WINDOW.decliningEnd) {
    const t =
      (over - RIPENESS_WINDOW.peakEnd) /
      (RIPENESS_WINDOW.decliningEnd - RIPENESS_WINDOW.peakEnd);
    return {
      stage: "DECLINING",
      label: RIPENESS_LABELS.DECLINING,
      yieldFactor: lerp(RIPENESS_YIELD.peak, RIPENESS_YIELD.declining, t),
      msToNextStage: readyAt + RIPENESS_WINDOW.decliningEnd * scale - now,
      msToLoss,
      needsPlowing: false,
    };
  }

  if (over < RIPENESS_WINDOW.poorEnd) {
    const t =
      (over - RIPENESS_WINDOW.decliningEnd) /
      (RIPENESS_WINDOW.poorEnd - RIPENESS_WINDOW.decliningEnd);
    return {
      stage: "POOR",
      label: RIPENESS_LABELS.POOR,
      yieldFactor: lerp(RIPENESS_YIELD.declining, RIPENESS_YIELD.poor, t),
      msToNextStage: lossAt - now,
      msToLoss,
      needsPlowing: false,
    };
  }

  return {
    stage: "LOST",
    label: RIPENESS_LABELS.LOST,
    yieldFactor: RIPENESS_YIELD.lost,
    msToNextStage: null,
    msToLoss: 0,
    needsPlowing: true,
  };
}

/** Coût du labour d'une case perdue `[GD]` — moins qu'un semis, mais pas gratuit. */
export const PLOW_COST_PER_CELL = 8;

/**
 * Une parcelle laissée à l'abandon s'appauvrit : les adventices montent en
 * graine et le sol se tasse. Perdre une culture coûte donc au-delà de la
 * récolte manquée. `[GD]`
 */
export const LOST_CROP_FERTILITY_MALUS = 0.01;
