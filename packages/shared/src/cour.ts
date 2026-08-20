/**
 * La cour de ferme — l'aire où les camions déposent.
 *
 * Les livraisons se posent physiquement sur la parcelle : un camion arrive, une
 * caisse apparaît, on va la chercher. C'est un bon geste, et le testeur l'a dit
 * — « c'est bien que ça se voie et qu'il faille aller cliquer dessus ».
 *
 * Mais l'aire de dépôt était **n'importe quelle case libre**. Une ferme bien
 * bâtie n'en a plus une seule, et l'achat devient alors impossible :
 *
 *     409 — Aucune place libre dans la cour pour livrer
 *
 * On ne peut plus rien acheter parce qu'on a bien joué. « C'est débile », et
 * c'est exact : le jeu punissait le développement de la ferme.
 *
 * D'où une **cour réservée** : un rectangle de cases, au bord d'entrée, où l'on
 * ne bâtit ni ne sème, et où les camions déposent toujours. C'est la
 * proposition telle qu'elle a été formulée — « que la map ait genre 10 cases en
 * rectangle hors du champ, c'est là que tu reçois ».
 *
 * Elle est prise dans la grille plutôt qu'ajoutée autour : dix cases sur cent
 * quarante-quatre, moins de sept pour cent de la surface, contre un changement
 * de forme du monde qui toucherait la carte, la caméra et tous les calculs de
 * surface.
 */

/** Largeur de la cour, en cases `[GD]` */
export const YARD_W = 5;

/** Profondeur de la cour, en cases `[GD]` */
export const YARD_H = 2;

/**
 * La cour occupe le **coin bas-gauche**, contre le bord d'entrée.
 *
 * C'est de là que vient la route dans la vue isométrique, et c'est là que le
 * regard cherche une livraison. Le choix n'est pas arbitraire : l'ancien code
 * de dépôt triait déjà les cases libres dans cette direction.
 */
export function yardCells(gridH: number): { x: number; y: number }[] {
  const cellules: { x: number; y: number }[] = [];
  for (let dy = 0; dy < YARD_H; dy++) {
    for (let x = 0; x < YARD_W; x++) {
      cellules.push({ x, y: gridH - 1 - dy });
    }
  }
  return cellules;
}

/** Cette case appartient-elle à la cour ? */
export function isYardCell(x: number, y: number, gridH: number): boolean {
  return x >= 0 && x < YARD_W && y <= gridH - 1 && y >= gridH - YARD_H;
}

/**
 * Une emprise mord-elle sur la cour ?
 *
 * Le refus doit tomber **avant** le débit, pas après : un bâtiment payé qu'on
 * ne peut pas poser est exactement le genre d'accident qu'on cherche à éviter.
 */
export function overlapsYard(
  origin: { x: number; y: number; w: number; h: number },
  gridH: number,
): boolean {
  for (let dy = 0; dy < origin.h; dy++) {
    for (let dx = 0; dx < origin.w; dx++) {
      if (isYardCell(origin.x + dx, origin.y + dy, gridH)) return true;
    }
  }
  return false;
}

/** Ce qu'on répond quand on refuse. */
export const YARD_REFUSAL =
  "C'est la cour de ferme : les livraisons s'y posent, on n'y bâtit pas.";
