/**
 * Cultures : ce qu'on sème, ce qu'on récolte, ce qui repousse.
 *
 * L'herbe n'est pas une céréale. On la fauche au tracteur, le foin va au
 * hangar, et le champ reprend tout seul quelques coupes avant qu'il faille
 * resemer. L'orge et le colza, eux, se moissonnent comme le blé.
 */

import type { TradeGood } from "./goods.js";

/**
 * Les cultures du jeu, des plus longues aux plus courtes.
 *
 * Les cinq dernières forment le **maraîchage** : des boucles de deux à dix
 * heures réelles, là où une céréale en demande vingt-huit. Demandé en jouant —
 * « pour ajouter des boucles de jeu plus courtes, il va falloir ajouter des
 * récoltes avec une durée plus courte » : on ne pouvait pas semer et récolter
 * dans une même soirée, la plus rapide du catalogue étant l'herbe à douze
 * heures.
 */
export const CROP_CODES = [
  "WHEAT",
  "MAIZE",
  "PEA",
  "BARLEY",
  "RAPE",
  "GRASS",
  // Le maraîchage.
  "MESCLUN",
  "RADISH",
  "SPINACH",
  "LETTUCE",
  "POTATO",
] as const;
export type CropCode = (typeof CROP_CODES)[number];

/** Coupes d'herbe avant de devoir resemer `[GD]` */
export const GRASS_MAX_CUTS = 3;

/**
 * Coupes de mesclun avant de devoir resemer `[GD]`.
 *
 * Les jeunes pousses se coupent et repartent — c'est le vrai geste du
 * maraîcher, et la seule culture de **vente** qu'on ne resème pas à chaque
 * récolte. Deux coupes de moins que l'herbe : un rang de mesclun s'épuise
 * plus vite qu'une prairie.
 */
export const MESCLUN_MAX_CUTS = 4;

/**
 * Le maraîchage : ce qui se sème et se récolte dans une soirée.
 *
 * La liste sert de garde-fou autant que d'étiquette — plusieurs règles
 * doivent traiter ces cultures à part (le calibre de stockage, la
 * périssabilité des feuilles, la rotation), et les énumérer à la main dans
 * chacune serait cinq occasions de se contredire.
 */
export const MARAICHAGE = ["MESCLUN", "RADISH", "SPINACH", "LETTUCE", "POTATO"] as const;

export function estMaraichage(crop: CropCode | null | undefined): boolean {
  return !!crop && (MARAICHAGE as readonly string[]).includes(crop);
}

/**
 * Cette culture repart-elle après la coupe, sans qu'on resème ?
 *
 * L'herbe et le mesclun, et rien d'autre. La règle vivait en dur sur
 * `GRASS` à travers tout le jeu ; une deuxième culture à repousse l'aurait
 * fait mentir partout.
 */
export function repousseApresCoupe(crop: CropCode | null | undefined): boolean {
  return crop === "GRASS" || crop === "MESCLUN";
}

/** Combien de coupes avant de resemer, selon la culture. */
export function coupesMax(crop: CropCode | null | undefined): number {
  if (crop === "GRASS") return GRASS_MAX_CUTS;
  if (crop === "MESCLUN") return MESCLUN_MAX_CUTS;
  return 0;
}

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
