/** Entretien des machines — graisse, saleté, pannes. Ouvert à tous. `[GD]` */

export type BreakdownKind = "BELT" | "HYDRAULIC" | "ENGINE";

export const BREAKDOWN_LABELS: Record<BreakdownKind, string> = {
  BELT: "courroie",
  HYDRAULIC: "hydraulique",
  ENGINE: "moteur",
};

export const DIRT_DIRTY_THRESHOLD = 25;
export const GREASE_COST_CRD = 12;
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
