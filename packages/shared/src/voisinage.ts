/**
 * Ce qu'on sait d'une parcelle voisine, et comment on le résume.
 *
 * ## Deux mondes qui ne se parlaient pas
 *
 * Le jeu tient une **carte de zone** : chaque parcelle y a des coordonnées
 * `mapX`/`mapY`, une fertilité, un prix, et un propriétaire ou pas. Trente
 * pour cent d'entre elles appartiennent déjà à des fermes PNJ, avec leurs
 * cases semées, leurs étables et leurs troupeaux.
 *
 * La campagne qu'on voit à l'écran, elle, était un damier tiré d'une graine :
 * des cultures inventées, des états inventés, des bâtiments inventés. Ces
 * parcelles-là n'avaient pas d'identifiant, donc pas de propriétaire et pas de
 * prix — et l'on ne pouvait pas acheter ce qui n'existait pas.
 *
 * Ce module est la jointure. Il ne simule rien : il **résume** ce que la base
 * contient déjà, dans la forme dont la vue a besoin pour poser une parcelle
 * sur la trame.
 *
 * ## Pourquoi ici et pas dans la route
 *
 * Le résumé est de l'arithmétique sur des cases, et c'est exactement le genre
 * de calcul qui diverge quand il est écrit deux fois. La vue s'en sert pour
 * choisir une couleur, la route pour répondre : une seule définition.
 */

import type { CropCode } from "./crops.js";

/** L'état d'avancement d'une case, tel que la base le stocke. */
export type StadeChamp =
  | "EMPTY"
  | "PREPARED"
  | "PLANTED"
  | "GROWING"
  | "READY"
  | "SPOILED"
  | "HARVESTED";

/** Ce qu'une case porte, réduit à ce dont le décor a besoin. */
export type CaseResumable = {
  kind: string;
  crop?: CropCode | string | null;
  fieldStage?: StadeChamp | string | null;
};

/**
 * Le champ d'un voisin, vu de loin.
 *
 * Une parcelle voisine n'est jamais regardée case par case : à cette distance
 * on lit une couleur dominante et un stade. Le résumé dit donc ce que la
 * parcelle « fait » cette saison, pas ce que chacune de ses cent
 * quarante-quatre cases contient.
 */
export type ResumeChamp = {
  /** La culture qui occupe le plus de cases, s'il y en a une. */
  culture: CropCode | null;
  /** Le stade le plus répandu **parmi les cases de cette culture**. */
  stade: StadeChamp | null;
  /** Part de la parcelle effectivement emblavée, de 0 à 1. */
  partCultivee: number;
  /** Nombre de cases portant la culture dominante. */
  cases: number;
};

/**
 * Le stade dominant, la culture dominante, et la part emblavée.
 *
 * Les égalités se tranchent par ordre alphabétique du code, et non par ordre
 * de rencontre : sinon deux serveurs qui lisent les mêmes cases dans un ordre
 * différent — ce que Postgres ne garantit pas sans `ORDER BY` — décriraient la
 * même parcelle de deux façons.
 */
export function resumerChamp(cases: readonly CaseResumable[], total?: number): ResumeChamp {
  const surface = Math.max(total ?? cases.length, 1);
  const parCulture = new Map<string, CaseResumable[]>();
  for (const c of cases) {
    if (c.kind !== "CROP" || !c.crop) continue;
    const lot = parCulture.get(c.crop);
    if (lot) lot.push(c);
    else parCulture.set(c.crop, [c]);
  }
  if (!parCulture.size) {
    return { culture: null, stade: null, partCultivee: 0, cases: 0 };
  }

  const [code, lot] = [...parCulture.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]),
  )[0]!;

  const parStade = new Map<string, number>();
  for (const c of lot) {
    const s = (c.fieldStage as string | undefined) ?? "EMPTY";
    parStade.set(s, (parStade.get(s) ?? 0) + 1);
  }
  const stade = [...parStade.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]![0];

  return {
    culture: code as CropCode,
    stade: stade as StadeChamp,
    partCultivee: Math.min(1, lot.length / surface),
    cases: lot.length,
  };
}

/**
 * À qui est cette parcelle, du point de vue du joueur qui regarde.
 *
 * Quatre cas et pas trois : un voisin PNJ et un voisin joueur ne se traitent
 * pas pareil — on peut espérer racheter au premier, jamais au second.
 */
export type StatutParcelle = "MOI" | "PNJ" | "JOUEUR" | "LIBRE";

export function statutParcelle(
  parcelle: { farmId: string | null },
  proprietaire: { isNpc: boolean } | null,
  monFarmId: string | null,
): StatutParcelle {
  if (!parcelle.farmId) return "LIBRE";
  if (monFarmId && parcelle.farmId === monFarmId) return "MOI";
  return proprietaire?.isNpc ? "PNJ" : "JOUEUR";
}

/**
 * Deux parcelles se touchent-elles par un côté ?
 *
 * En diagonale ne compte pas, et c'est la règle du jeu et non une commodité :
 * le devis d'achat compte les **bordures** mitoyennes, et deux parcelles qui
 * ne se touchent que par un coin n'en partagent aucune.
 */
export function mitoyennes(
  a: { mapX: number; mapY: number },
  b: { mapX: number; mapY: number },
): boolean {
  return Math.abs(a.mapX - b.mapX) + Math.abs(a.mapY - b.mapY) === 1;
}

/**
 * La case de la trame où poser une parcelle, vue depuis celle du joueur.
 *
 * La campagne 3D est un damier centré sur la ferme : `col` court le long de
 * l'axe des `x` du monde, `rang` le long de celui des `z`. La carte de zone
 * emploie les mêmes directions sous d'autres noms, et c'est tout ce que fait
 * cette fonction — mais l'écrire une fois évite qu'un jour la vue et la route
 * ne s'accordent plus sur le sens de `mapY`.
 */
export function caseDeTrame(
  centre: { mapX: number; mapY: number },
  cible: { mapX: number; mapY: number },
): { col: number; rang: number } {
  return { col: cible.mapX - centre.mapX, rang: cible.mapY - centre.mapY };
}
