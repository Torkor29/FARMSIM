/**
 * La cour de ferme — l'aire d'arrivée, **hors** du champ.
 *
 * Les livraisons se posent physiquement sur la ferme : un camion arrive, une
 * caisse apparaît, on va la chercher. C'est un bon geste, et le testeur l'a dit
 * — « c'est bien que ça se voie et qu'il faille aller cliquer dessus ».
 *
 * Mais l'aire de dépôt a d'abord été **n'importe quelle case libre**. Une ferme
 * bien bâtie n'en a plus une seule, et l'achat devenait impossible :
 *
 *     409 — Aucune place libre dans la cour pour livrer
 *
 * On ne pouvait plus rien acheter parce qu'on avait bien joué. La correction
 * suivante a réservé dix cases **dans** la grille : l'achat repassait, mais au
 * prix de dix cases de blé, et le camion déchargeait au milieu du champ.
 *
 * La cour sort donc de la grille. « Il faudrait presque que de base, la map ait
 * genre 10 cases en rectangle hors du champ, c'est là que tu reçois. » C'est
 * exactement cela : un rectangle de dix places posé à côté de la parcelle, avec
 * une ouverture dans la haie pour aller chercher ses caisses.
 *
 * Conséquence directe : les cent quarante-quatre cases de la parcelle
 * redeviennent cultivables, et plus aucune règle ne s'applique « sauf par là ».
 *
 * Ce module ne décrit que la géométrie de l'aire, en unités de case, pour que
 * la vue 3D, le serveur et les tests parlent de la même chose.
 */

/** Places de livraison en largeur `[GD]` */
export const YARD_W = 5;

/** Places de livraison en profondeur `[GD]` */
export const YARD_H = 2;

/** Dix places, comme demandé. */
export const YARD_PLACES = YARD_W * YARD_H;

/** Côté d'une place de dépôt, en cases. */
export const YARD_SLOT = 1.05;

/** Une place de la cour : ce sont les coordonnées portées par une livraison. */
export type YardSlot = { x: number; y: number };

/**
 * Les dix places, dans l'ordre où on les remplit.
 *
 * On charge d'abord la rangée qui borde le champ : c'est celle qu'on atteint
 * en sortant par l'ouverture, et une cour qui se garnit par le fond donnerait
 * l'impression que le camion s'est trompé d'adresse.
 */
export function yardSlots(): YardSlot[] {
  const places: YardSlot[] = [];
  for (let y = 0; y < YARD_H; y++) {
    for (let x = 0; x < YARD_W; x++) places.push({ x, y });
  }
  return places;
}

/** Cette place appartient-elle bien à la cour ? */
export function isYardSlot(slot: YardSlot): boolean {
  return (
    Number.isInteger(slot.x) &&
    Number.isInteger(slot.y) &&
    slot.x >= 0 &&
    slot.x < YARD_W &&
    slot.y >= 0 &&
    slot.y < YARD_H
  );
}

/**
 * Première place libre, ou `null` si la cour est pleine.
 *
 * Deux commandes passées coup sur coup ne doivent pas se superposer : il n'y
 * aurait qu'un objet à cliquer pour deux caisses, et la seconde serait perdue.
 */
export function freeYardSlot(occupees: YardSlot[]): YardSlot | null {
  const prises = new Set(occupees.map((s) => `${s.x},${s.y}`));
  return yardSlots().find((s) => !prises.has(`${s.x},${s.y}`)) ?? null;
}

/**
 * Centre d'une place, en cases, relatif au centre de l'aire de livraison.
 *
 * `dx` croît vers le champ, comme pour le parc : les deux aires se lisent dans
 * le même sens.
 */
export function yardSlotOffset(slot: YardSlot): { dx: number; dz: number } {
  return {
    dx: ((YARD_H - 1) / 2 - slot.y) * YARD_SLOT,
    dz: (slot.x - (YARD_W - 1) / 2) * YARD_SLOT,
  };
}

/** Emprise de l'aire de livraison, en cases. */
export const YARD_SIZE = {
  /** Dans l'axe d'entrée, vers le champ */
  w: YARD_H * YARD_SLOT + 0.5,
  /** En travers */
  d: YARD_W * YARD_SLOT + 0.5,
};

/** Ce qu'on répond quand la cour déborde. */
export const YARD_FULL =
  "La cour est encombrée — rentrez les caisses déjà livrées avant d'en commander d'autres.";
