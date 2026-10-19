/**
 * Les teintes des cases, une seule fois pour tout le jeu.
 *
 * La parcelle qu'on travaille et ses parcelles vues d'à côté se peignaient
 * avec deux palettes : la même terre labourée sortait brune ici, orange là,
 * et une récolte perdue passait pour du blé mûr dans le paysage. En changeant
 * de parcelle, toutes changeaient d'allure (« la carte change complètement »).
 * L'île et le paysage lisent désormais ces mêmes teintes.
 */
import * as THREE from "three";
import { RIPENESS_COLORS, type CropCode } from "@farmsim/shared";

/** La terre au repos, en damier clair et sombre. */
export const SOIL = 0x9ac06a;
export const SOIL_DARK = 0x8ab35e;
/* Ferme libre : le pré. */
export const PRE = 0x74ad48;
export const PRE_SOMBRE = 0x6ca342;
export const STUBBLE_SOIL = 0xe3cf98;
export const RESIDUE_SOIL = 0x8a7048;
/** Terre labourée : brune et grasse, celle qui attend la semence. */
export const PLOWED_SOIL = 0x7a4b2e;
/** Terre sèche et craquelée, laissée par une culture perdue. */
export const DRY_SOIL = 0xb5a179;
export const DIRT = 0xa4835c;
export const TERRE_SOUS_RANG = 0x8a6a44;
export const PAILLE_SOIL = 0xc9b15a;
export const BOTTES_SOIL = 0xb8943a;

export type CropLook = {
  grow: number;
  ready: number;
  fullH: number;
};

export const CROP_LOOK: Record<string, CropLook> = {
  // Six cultures, six couleurs qu'on doit pouvoir nommer de loin.
  //
  // Le blé et le maïs portaient **le même** `ready` (0xe8c65e), et l'orge n'en
  // était qu'à quatre degrés de teinte : trois beiges indiscernables sur une
  // parcelle. Ils s'écartent maintenant franchement — le blé va au doré chaud,
  // l'orge au blond pâle, et le maïs **reste vert**, ce qu'il est réellement à
  // la récolte : c'est la plante entière qu'on coupe, pas un épi mûr.
  //
  // Les jeunes pousses se séparent aussi : elles partaient toutes du même vert
  // à huit degrés près, et un champ semé ne disait pas ce qu'il portait.
  WHEAT: { grow: 0x8fc457, ready: 0xdcae3f, fullH: 0.7 },
  MAIZE: { grow: 0x3f8f2c, ready: 0x74a83a, fullH: 0.98 },
  PEA: { grow: 0x7cc86a, ready: 0xb9cf6a, fullH: 0.55 },
  BARLEY: { grow: 0xa8c96a, ready: 0xefdca4, fullH: 0.58 },
  RAPE: { grow: 0x5aaa38, ready: 0xf2d429, fullH: 0.72 },
  GRASS: { grow: 0x4a9a36, ready: 0x5aad42, fullH: 0.38 },
};

export function lookOf(crop?: CropCode | null): CropLook {
  return CROP_LOOK[crop ?? ""] ?? CROP_LOOK.WHEAT;
}


/**
 * La couleur d'une case du paysage, d'après la grille du serveur.
 *
 * Les codes de `VoisinReel.grille` : `CULTURE:STADE` (`LOST` pour une
 * récolte perdue), `L` labour, `C` chaume, `U` résidus, `S` paille, `K`
 * bottes, `P` pré, `E` eau, `B` bois, `T` bâti, `R` chemin, `.` terre nue.
 * Une culture prend la couleur de la plante — c'est elle qu'on voit de
 * loin sur l'île —, mûre ou en pousse ; perdue, elle vire à la terre sèche.
 */
export function couleurCaseGrille(code: string, x: number, y: number): number {
  switch (code) {
    case ".":
      return (x + y) % 2 === 0 ? SOIL : SOIL_DARK;
    case "L":
      return PLOWED_SOIL;
    case "C":
      return STUBBLE_SOIL;
    case "U":
      return RESIDUE_SOIL;
    case "S":
      return PAILLE_SOIL;
    case "K":
      return BOTTES_SOIL;
    case "P":
      return (x + y) % 2 === 0 ? PRE : PRE_SOMBRE;
    case "E":
      return 0x4b3d2c;
    case "B":
      return (x + y) % 2 === 0 ? 0x5a6b34 : 0x55652f;
    case "T":
      return DIRT;
    case "R":
      return 0xb59a72;
    default: {
      const [crop, stade] = code.split(":");
      const look = lookOf((crop ?? null) as CropCode | null);
      if (stade === "LOST" || stade === "SPOILED") return DRY_SOIL;
      if (stade === "READY") return look.ready;
      // En pousse : à mi-chemin du vert de levée et de la couleur mûre.
      return new THREE.Color(look.grow).lerp(new THREE.Color(look.ready), stade === "GROWING" ? 0.45 : 0.15).getHex();
    }
  }
}

/** La perte, telle que l'île la peint sur une culture gâtée. */
export const TEINTE_PERDUE = RIPENESS_COLORS.LOST;
