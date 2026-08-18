/** Entretien des machines — graisse, saleté, pannes. Ouvert à tous. `[GD]` */

export type BreakdownKind = "BELT" | "HYDRAULIC" | "ENGINE";

export const BREAKDOWN_LABELS: Record<BreakdownKind, string> = {
  BELT: "courroie",
  HYDRAULIC: "hydraulique",
  ENGINE: "moteur",
};

export const DIRT_DIRTY_THRESHOLD = 25;
export const GREASE_COST_CRD = 12;
/** Plein réservoir. Un champ 12×12 (~144 cases) en consomme ~36. */
export const GREASE_FULL = 100;
/** Points vidés par case — assez bas pour deux ou trois champs d’affilée. */
export const GREASE_PER_CELL = 0.25;
/** Surcoût si la machine est déjà sale. */
export const GREASE_DIRT_EXTRA = 0.1;
/** En dessous, plus de bonus « nickel », mais on peut encore partir. */
export const GREASE_OK = 20;

export function greaseCost(cells: number, dirt: number): number {
  const extra = dirt >= DIRT_DIRTY_THRESHOLD ? GREASE_DIRT_EXTRA : 0;
  return Math.round((GREASE_PER_CELL + extra) * Math.max(0, cells) * 100) / 100;
}

export function applyGreaseUse(grease: number, cells: number, dirt: number): number {
  return Math.max(0, Math.round((grease - greaseCost(cells, dirt)) * 100) / 100);
}

/** Assez de graisse pour le bonus d’usure / récolte. */
export function greaseIsOk(grease: number): boolean {
  return grease >= GREASE_OK;
}

export function greaseIsEmpty(grease: number): boolean {
  return grease <= 0;
}
export const CLEAN_COST_CRD = 18;
/** Remise réparation atelier uniquement — plus de caste ETA `[GD]` */
export const ETA_REPAIR_EXTRA_DISCOUNT = 0;

export const DIRT_PER_CELL: Record<string, number> = {
  PLANT: 0.6,
  FERTILIZE: 2.4,
  HARVEST: 0.8,
  PLOW: 1.2,
  STUBBLE: 1.1,
  MOW: 0.7,
};

export const REPAIR_RESTORE: Record<
  BreakdownKind,
  { conditionDelta: number | "full"; partCount: number; ordered: boolean }
> = {
  BELT: { conditionDelta: 30, partCount: 3, ordered: false },
  HYDRAULIC: { conditionDelta: 50, partCount: 4, ordered: false },
  ENGINE: { conditionDelta: "full", partCount: 6, ordered: true },
};

export const REPAIR_PARTS: Record<BreakdownKind, string[]> = {
  BELT: ["Courroie", "Galet", "Carter"],
  HYDRAULIC: ["Flexible", "Collier", "Joint", "Pompe"],
  ENGINE: ["Filtre", "Bougie", "Durite", "Pompe", "Joint", "Vidange"],
};

/** Points de graissage, en % de l'illustration. */
export const GREASE_POINTS: Array<{ x: number; y: number }> = [
  { x: 28, y: 38 },
  { x: 72, y: 36 },
  { x: 48, y: 52 },
  { x: 32, y: 74 },
  { x: 68, y: 76 },
];

export const DUST_POINTS: Array<{ x: number; y: number }> = [
  { x: 18, y: 22 },
  { x: 42, y: 16 },
  { x: 70, y: 24 },
  { x: 22, y: 48 },
  { x: 55, y: 44 },
  { x: 78, y: 52 },
  { x: 30, y: 70 },
  { x: 62, y: 68 },
];

export const MUD_POINTS: Array<{ x: number; y: number }> = [
  { x: 24, y: 58 },
  { x: 48, y: 72 },
  { x: 70, y: 62 },
  { x: 38, y: 36 },
  { x: 64, y: 40 },
];

/**
 * Plein régime au-dessus de ce niveau d'usure `[GD]`.
 *
 * Au-delà, entretenir davantage ne rapporte rien : il faut une plage où la
 * machine est simplement bonne, sinon le joueur passe sa partie à l'atelier.
 */
export const CONDITION_FULL_POWER = 80;

/** Ce qu'il reste de rendement sur une machine à bout de souffle `[GD]`. */
export const CONDITION_WORST_FACTOR = 0.7;

/**
 * Ce que l'état de la machine fait perdre au chantier.
 *
 * La graisse et la saleté agissaient déjà sur le rendement — trois paliers,
 * de +8 % à −6 %. **La condition, elle, n'entrait nulle part.** Une
 * moissonneuse à 13 % ramassait autant, aussi vite, qu'une machine neuve :
 * l'usure se calculait, se réparait, se payait, et ne coûtait jamais rien.
 * Elle n'agissait que de deux façons, toutes deux tout-ou-rien — bloquer sous
 * `minCondition`, et tirer au sort une panne sous 50 %.
 *
 * D'où : aucune raison d'entretenir au-dessus du seuil de blocage. On
 * repoussait jusqu'à la panne, et la révision n'était pas un calcul mais une
 * corvée.
 *
 * La perte est **continue et douce** : plein régime au-dessus de 80 %, puis
 * une pente régulière jusqu'à −30 % à zéro. Aux valeurs qui comptent :
 *
 *     100 %  →  rendement plein
 *      80 %  →  rendement plein
 *      40 %  →  −15 %
 *      20 %  →  −22 %
 *      12 %  →  −25 %   (seuil de blocage d'une moissonneuse)
 *
 * C'est ce qui transforme la révision en arbitrage — « est-ce qu'elle se
 * paie ? » — au lieu d'une case à cocher avant la panne.
 */
export function conditionYieldFactor(condition: number): number {
  const c = Math.max(0, Math.min(100, condition));
  if (c >= CONDITION_FULL_POWER) return 1;
  const perte = (1 - CONDITION_WORST_FACTOR) * (c / CONDITION_FULL_POWER);
  return Math.round((CONDITION_WORST_FACTOR + perte) * 1000) / 1000;
}

export function isBreakdownKind(v: string | null | undefined): v is BreakdownKind {
  return v === "BELT" || v === "HYDRAULIC" || v === "ENGINE";
}

export function suggestedRepairKind(
  breakdown: string | null | undefined,
  condition: number,
): BreakdownKind {
  if (isBreakdownKind(breakdown)) return breakdown;
  if (condition < 20) return "ENGINE";
  if (condition < 45) return "HYDRAULIC";
  return "BELT";
}
