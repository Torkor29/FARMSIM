/**
 * Capacité du silo à grain.
 *
 * Sans silo, on ne conserve rien : la récolte part au négociant. C'est ce qui
 * donne une raison de bâtir le premier bâtiment, et ce qui empêche d'accumuler
 * du maïs « dans les poches ».
 */

import type { TradeGood } from "./goods.js";

/** Céréales et protéagineux du silo — pas le foin, pas le lait. */
export const GRAIN_GOODS = ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE"] as const satisfies readonly TradeGood[];
export type GrainGood = (typeof GRAIN_GOODS)[number];

export function isGrainGood(code: string): code is GrainGood {
  return (GRAIN_GOODS as readonly string[]).includes(code);
}

export type GrainForcedSaleReason = "NO_SILO" | "SILO_FULL";

export function grainForcedSaleReason(
  capacity: number,
  soldTons: number,
): GrainForcedSaleReason | null {
  if (soldTons <= 1e-9) return null;
  return capacity <= 1e-9 ? "NO_SILO" : "SILO_FULL";
}

export function emptyGrainStock(): Record<GrainGood, number> {
  return { WHEAT: 0, MAIZE: 0, PEA: 0, BARLEY: 0, RAPE: 0 };
}

export function grainStockFromItems(
  items: Iterable<{ itemCode: string; qty: number }>,
): Record<GrainGood, number> {
  const stock = emptyGrainStock();
  for (const item of items) {
    if (isGrainGood(item.itemCode)) stock[item.itemCode] += Math.max(0, item.qty);
  }
  return stock;
}

export function totalGrainTons(stock: Readonly<Partial<Record<GrainGood, number>>>): number {
  let t = 0;
  for (const g of GRAIN_GOODS) t += Math.max(0, stock[g] ?? 0);
  return t;
}

export type GrainIntakePlan = {
  /** Quantité finale par céréale, après délestage et apport. */
  stored: Record<GrainGood, number>;
  /** Excédent déjà en stock (silo démoli, ancien bug). */
  dumpedExisting: Partial<Record<GrainGood, number>>;
  /** Part de la récolte qui rentre. */
  keptIncoming: Partial<Record<GrainGood, number>>;
  /** Part de la récolte vendue de force. */
  soldIncoming: Partial<Record<GrainGood, number>>;
};

/**
 * Remplit le silo, vend le trop-plein.
 *
 * L'excédent déjà stocké part en premier (on ne dépasse pas la capacité),
 * puis la récolte occupe la place restante.
 */
export function allocateGrainIntake(input: {
  capacity: number;
  current: Readonly<Partial<Record<GrainGood, number>>>;
  incoming: readonly { code: GrainGood; tons: number }[];
}): GrainIntakePlan {
  const cap = Math.max(0, input.capacity);
  const stored = emptyGrainStock();
  for (const g of GRAIN_GOODS) stored[g] = Math.max(0, input.current[g] ?? 0);
  const dumpedExisting: Partial<Record<GrainGood, number>> = {};
  const keptIncoming: Partial<Record<GrainGood, number>> = {};
  const soldIncoming: Partial<Record<GrainGood, number>> = {};

  let used = totalGrainTons(stored);
  if (used > cap) {
    let overflow = used - cap;
    for (const g of GRAIN_GOODS) {
      if (overflow <= 1e-9) break;
      const dump = Math.min(stored[g], overflow);
      if (dump <= 0) continue;
      stored[g] -= dump;
      dumpedExisting[g] = dump;
      overflow -= dump;
      used -= dump;
    }
  }

  for (const { code, tons } of input.incoming) {
    if (tons <= 0) continue;
    const room = Math.max(0, cap - used);
    const keep = Math.min(tons, room);
    const dump = tons - keep;
    if (keep > 0) {
      stored[code] += keep;
      keptIncoming[code] = (keptIncoming[code] ?? 0) + keep;
      used += keep;
    }
    if (dump > 0) soldIncoming[code] = (soldIncoming[code] ?? 0) + dump;
  }

  return { stored, dumpedExisting, keptIncoming, soldIncoming };
}

export function grainSoldTons(plan: GrainIntakePlan): number {
  let t = 0;
  for (const g of GRAIN_GOODS) {
    t += plan.dumpedExisting[g] ?? 0;
    t += plan.soldIncoming[g] ?? 0;
  }
  return t;
}
