/**
 * La cour de stationnement — **hors** du champ.
 *
 * Un engin garé occupait une case de la parcelle : la case passait en
 * `VEHICLE`, on ne pouvait plus rien y semer, et le tracteur se retrouvait
 * planté au milieu du blé. Le reproche est direct — « le parking devait être
 * hors de la map, pas sur la map ».
 *
 * Le parc est donc une aire posée **à côté** de l'île, à l'ouest, dans le
 * prolongement de la cour de ferme. Elle n'appartient pas à la grille : elle
 * n'a ni case, ni coordonnée de jeu, et rien ne s'y sème. Une machine y est
 * rangée par défaut dès qu'elle n'est ni au hangar ni au travail.
 *
 * Ce module ne décrit que la **géométrie** du parc, en unités de case, pour
 * que la vue 3D et les tests parlent de la même chose. Il ne connaît ni Three,
 * ni la base.
 */

/** Largeur d'une place, en travers de l'engin `[GD]` */
export const BAY_ACROSS = 1.15;

/** Longueur d'une place, dans l'axe de l'engin `[GD]` */
export const BAY_ALONG = 1.9;

/**
 * Places par rangée.
 *
 * Au-delà, l'aire s'étire plus loin que la parcelle n'est haute et sort du
 * cadrage : on empile une seconde rangée derrière plutôt que d'allonger.
 */
export const BAYS_PER_ROW = 5;

/**
 * Places minimales.
 *
 * Une cour d'une seule place, pour la ferme de départ et son unique tracteur,
 * se lit comme une dalle oubliée. Quatre places disent « ici, on gare ».
 */
export const MIN_BAYS = 4;

/**
 * La cour s'agrandit par paires.
 *
 * Elle pourrait suivre le parc à la place près, mais une place qui apparaît
 * seule au moment de l'achat ne se remarque pas : elle est aussitôt occupée.
 * En ajoutant deux places d'un coup, il en reste toujours une de libre, et
 * l'agrandissement **se voit** — c'est ce qui dit au joueur que sa cour a
 * grandi avec sa ferme, sans qu'il ait rien eu à acheter.
 *
 * Car rien ne s'achète ici, et c'est délibéré : refuser une machine faute de
 * place répéterait le défaut qu'on vient de corriger sur les livraisons, où
 * bien jouer finissait par bloquer les achats. La décision payante existe
 * déjà, et elle est ailleurs — le hangar matériel, qui abrite les engins et
 * les use moins vite.
 */
export const BAY_STEP = 2;

export type ParkingLayout = {
  /** Places dessinées, toujours au moins `MIN_BAYS` */
  bays: number;
  /** Places par rangée */
  perRow: number;
  /** Rangées empilées vers l'ouest */
  rows: number;
  /** Emprise dans l'axe des engins, en cases */
  w: number;
  /** Emprise en travers, en cases */
  d: number;
};

/** Marge de béton autour des places, en cases. */
const MARGIN = 0.3;

/**
 * Dimensionne la cour pour un parc donné.
 *
 * Les places se créent toutes seules, par paires, et gratuitement : la cour
 * suit la ferme au lieu de la freiner.
 */
export function parkingLayout(machines: number): ParkingLayout {
  const parc = Math.max(0, Math.floor(machines));
  const bays = Math.max(MIN_BAYS, Math.ceil(parc / BAY_STEP) * BAY_STEP);
  const perRow = Math.min(bays, BAYS_PER_ROW);
  const rows = Math.ceil(bays / perRow);
  return {
    bays,
    perRow,
    rows,
    w: rows * BAY_ALONG + MARGIN * 2,
    d: perRow * BAY_ACROSS + MARGIN * 2,
  };
}

/**
 * Centre de la n-ième place, en cases, relatif au centre de l'aire.
 *
 * `dx` croît vers le champ : la première rangée est celle qui le borde, et
 * c'est elle qu'on remplit d'abord — un parc qui se garnit par le fond aurait
 * l'air abandonné tant qu'on n'a pas six engins.
 */
export function parkingSlot(index: number, layout: ParkingLayout): { dx: number; dz: number } {
  const i = Math.max(0, Math.floor(index));
  const row = Math.floor(i / layout.perRow);
  const col = i % layout.perRow;
  return {
    dx: ((layout.rows - 1) / 2 - row) * BAY_ALONG,
    dz: (col - (layout.perRow - 1) / 2) * BAY_ACROSS,
  };
}
