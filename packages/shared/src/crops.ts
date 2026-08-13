/**
 * Cultures : ce qu'on sème, ce qu'on récolte, ce qui repousse.
 *
 * L'herbe n'est pas une céréale. On la fauche au tracteur, le foin va au
 * hangar, et le champ reprend tout seul quelques coupes avant qu'il faille
 * resemer. L'orge et le colza, eux, se moissonnent comme le blé.
 */

import type { TradeGood } from "./goods.js";

export const CROP_CODES = ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE", "GRASS"] as const;
export type CropCode = (typeof CROP_CODES)[number];

/** Coupes d'herbe avant de devoir resemer `[GD]` */
export const GRASS_MAX_CUTS = 3;

export function isMowCrop(crop: CropCode | null | undefined): boolean {
  return crop === "GRASS";
}

/** Ce qui entre en stock après la récolte. L'herbe devient du foin. */
export function harvestItemCode(crop: CropCode): TradeGood {
  return crop === "GRASS" ? "HAY" : (crop as TradeGood);
}

export function grassWillRegrow(cutsAlreadyIncludingThis: number): boolean {
  return cutsAlreadyIncludingThis < GRASS_MAX_CUTS;
}

export function isCropCode(v: string | null | undefined): v is CropCode {
  return !!v && (CROP_CODES as readonly string[]).includes(v);
}

/**
 * Coupes de *cette* herbe, pas les moissons d'avant.
 * Tant que le précédent n'est pas de l'herbe, le premier cycle prend
 * le temps long ; après une fauche, le champ reprend plus vite.
 */
export function grassCutsDone(cell: {
  crop?: CropCode | null;
  lastCrop?: CropCode | null;
  harvestsSincePlow?: number;
}): number {
  if (cell.crop !== "GRASS") return 0;
  if (cell.lastCrop === "GRASS") return cell.harvestsSincePlow ?? 0;
  return 0;
}
