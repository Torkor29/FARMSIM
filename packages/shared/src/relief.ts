/**
 * Le relief et l'eau qui coule : ce qu'ils changent au jeu.
 *
 * ## Les niveaux
 *
 * Une case a un niveau, de 0 (la plaine) à `NIVEAU_MAX`. Entre deux cases de
 * niveaux différents se dresse une falaise. On cultive sur une terrasse comme
 * en plaine ; un bâtiment, lui, se pose en plaine.
 *
 * ## L'accès des engins
 *
 * Les engins arrivent par le **bord de la ferme, au niveau de la plaine**, et
 * roulent de case en case sur la terre ferme et à niveau. L'eau les arrête —
 * sauf un **pont** ; une falaise les arrête — sauf une **rampe** ; un bois les
 * arrête aussi, sauf un chemin ouvert au travers. Un champ
 * qu'ils ne peuvent pas atteindre ne se travaille pas : c'est ce qui fait du
 * terraformage un aménagement, et plus seulement un décor.
 *
 * ## L'eau qui coule
 *
 * Deux cases d'eau voisines de niveaux différents font une **cascade**. Une
 * étendue d'eau d'un seul niveau qui se déverse par une cascade **coule**
 * vers elle : c'est une rivière. Celle d'en bas, qui ne se déverse nulle
 * part, reste un lac — sauf au pied de la chute, où l'eau bouillonne.
 *
 * L'eau courante irrigue mieux qu'un lac (`bonusAmenagementCase`), et fait
 * tourner un moulin plus vite (`forceHydraulique`) — par un bief, depuis la
 * campagne (`PORTEE_BIEF`).
 */

export const NIVEAU_MAX = 3;
/** Hauteur d'un niveau dans la scène, en unités monde (une case ≈ 1). */
export const HAUTEUR_NIVEAU = 0.45;

export type CaseRelief = {
  x: number;
  y: number;
  sol?: string | null;
  niveau?: number | null;
};

export type Passage = { type: string; originX: number; originY: number; rotation: number };

const k = (x: number, y: number) => `${x},${y}`;
const DIRS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Le sens de montée d'une rampe : 0 nord, 1 est, 2 sud, 3 ouest. */
export function sensRampe(rotation: number): [number, number] {
  return DIRS[((rotation % 4) + 4) % 4]!;
}

/** Un pont : rotation 0 franchit d'est en ouest, 1 du nord au sud. */
export function axePont(rotation: number): "EO" | "NS" {
  return rotation % 2 === 0 ? "EO" : "NS";
}

type Index = {
  cases: Map<string, CaseRelief>;
  niveau(x: number, y: number): number;
  eau(x: number, y: number): boolean;
  bois(x: number, y: number): boolean;
};

function indexer(cells: readonly CaseRelief[]): Index {
  const cases = new Map(cells.map((c) => [k(c.x, c.y), c]));
  return {
    cases,
    niveau: (x, y) => cases.get(k(x, y))?.niveau ?? 0,
    eau: (x, y) => cases.get(k(x, y))?.sol === "EAU",
    bois: (x, y) => cases.get(k(x, y))?.sol === "BOIS",
  };
}

/**
 * Une rampe tient-elle ici ? Elle monte d'**un** niveau, vers une case de
 * terre ferme de la ferme.
 */
export function rampeValide(cells: readonly CaseRelief[] | Index, x: number, y: number, rotation: number): boolean {
  const ix = "cases" in cells ? cells : indexer(cells);
  const [dx, dy] = sensRampe(rotation);
  const ici = ix.cases.get(k(x, y));
  const haut = ix.cases.get(k(x + dx, y + dy));
  if (!ici || !haut || ici.sol === "EAU" || haut.sol === "EAU") return false;
  return (haut.niveau ?? 0) === (ici.niveau ?? 0) + 1;
}

/**
 * Les cases que les engins atteignent.
 *
 * Parcours en largeur depuis le bord de la ferme, en plaine ; un pas se fait
 * vers une voisine de même niveau, ou d'un niveau d'écart par une rampe posée
 * en bas et tournée vers le haut. L'eau ne se traverse que sur un pont, dans
 * son axe.
 */
export function accesEngins(cells: readonly CaseRelief[], passages: readonly Passage[]): Set<string> {
  const ix = indexer(cells);
  const ponts = new Map<string, "EO" | "NS">();
  const rampes = new Map<string, number>();
  for (const p of passages) {
    if (p.type === "pont") ponts.set(k(p.originX, p.originY), axePont(p.rotation));
    else if (p.type === "rampe") rampes.set(k(p.originX, p.originY), ((p.rotation % 4) + 4) % 4);
  }
  // Un bois arrête les engins comme l'eau ; un chemin à travers en fait du pré.
  const praticable = (x: number, y: number) =>
    ix.cases.has(k(x, y)) && !ix.bois(x, y) && (!ix.eau(x, y) || ponts.has(k(x, y)));
  const dansAxe = (x: number, y: number, dx: number) => {
    const a = ponts.get(k(x, y));
    return !a || (a === "EO" ? dx !== 0 : dx === 0);
  };
  const monte = (bx: number, by: number, dir: number) => rampes.get(k(bx, by)) === dir;

  const vus = new Set<string>();
  const file: [number, number][] = [];
  for (const c of cells) {
    if (c.sol === "EAU" || c.sol === "BOIS" || (c.niveau ?? 0) !== 0) continue;
    const auBord = DIRS.some(([dx, dy]) => !ix.cases.has(k(c.x + dx, c.y + dy)));
    if (!auBord) continue;
    vus.add(k(c.x, c.y));
    file.push([c.x, c.y]);
  }
  while (file.length) {
    const [x, y] = file.shift()!;
    const la = ix.niveau(x, y);
    for (let d = 0; d < 4; d++) {
      const [dx, dy] = DIRS[d]!;
      const nx = x + dx;
      const ny = y + dy;
      const kn = k(nx, ny);
      if (vus.has(kn) || !praticable(nx, ny)) continue;
      if (!dansAxe(x, y, dx) || !dansAxe(nx, ny, dx)) continue;
      const lb = ix.niveau(nx, ny);
      if (lb !== la) {
        // Monter : une rampe ici, tournée vers la voisine. Descendre : une
        // rampe là-bas, tournée vers ici.
        const ok = (lb === la + 1 && monte(x, y, d)) || (lb === la - 1 && monte(nx, ny, (d + 2) % 4));
        if (!ok) continue;
      }
      vus.add(kn);
      file.push([nx, ny]);
    }
  }
  return vus;
}

/** Les cases de la liste que les engins n'atteignent pas. */
export function casesCoupees(
  cells: readonly CaseRelief[],
  passages: readonly Passage[],
  demandees: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  const acces = accesEngins(cells, passages);
  return demandees.filter((c) => !acces.has(k(c.x, c.y)));
}

export type Chute = { x: number; y: number; dx: number; dy: number; haut: number; bas: number };

export type Hydrologie = {
  /** Le sens du courant de chaque case d'eau qui coule. */
  courant: Map<string, [number, number]>;
  /** Les cascades : de la case (x, y) vers sa voisine (x+dx, y+dy), plus bas. */
  chutes: Chute[];
  /** L'eau courante : ce qui coule, et le pied des cascades. */
  courante: Set<string>;
};

/**
 * Où l'eau coule, et où elle tombe.
 *
 * Un **bief** est une étendue d'eau d'un seul niveau. S'il touche une case
 * d'eau plus basse, il s'y déverse : chaque case du bief coule vers la chute
 * la plus proche. Un bief sans issue dort.
 */
export function hydrologie(cells: readonly CaseRelief[]): Hydrologie {
  const ix = indexer(cells);
  const eaux = cells.filter((c) => c.sol === "EAU");
  const chutes: Chute[] = [];
  for (const c of eaux) {
    for (const [dx, dy] of DIRS) {
      if (!ix.eau(c.x + dx, c.y + dy)) continue;
      const bas = ix.niveau(c.x + dx, c.y + dy);
      const haut = c.niveau ?? 0;
      if (bas < haut) chutes.push({ x: c.x, y: c.y, dx, dy, haut, bas });
    }
  }
  const courant = new Map<string, [number, number]>();
  const courante = new Set<string>();
  // Distance à la chute la plus proche, dans le bief de chaque case.
  const dist = new Map<string, number>();
  const file: [number, number][] = [];
  for (const ch of chutes) {
    const kk = k(ch.x, ch.y);
    if (!dist.has(kk)) {
      dist.set(kk, 0);
      file.push([ch.x, ch.y]);
      courant.set(kk, [ch.dx, ch.dy]);
    }
    courante.add(kk);
    courante.add(k(ch.x + ch.dx, ch.y + ch.dy));
  }
  while (file.length) {
    const [x, y] = file.shift()!;
    const d = dist.get(k(x, y))!;
    const l = ix.niveau(x, y);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const kn = k(nx, ny);
      if (!ix.eau(nx, ny) || ix.niveau(nx, ny) !== l || dist.has(kn)) continue;
      dist.set(kn, d + 1);
      courant.set(kn, [-dx || 0, -dy || 0]);
      courante.add(kn);
      file.push([nx, ny]);
    }
  }
  return { courant, chutes, courante };
}

/**
 * Les coteaux : les champs en terrasse qui regardent le sud.
 *
 * Une case de champ en hauteur dont la voisine du sud est plus basse prend le
 * soleil de face — c'est là qu'on plantait la vigne. Le jeu en fait un petit
 * bonus de rendement.
 */
export function coteaux(cells: readonly CaseRelief[]): Set<string> {
  const ix = indexer(cells);
  const out = new Set<string>();
  for (const c of cells) {
    const l = c.niveau ?? 0;
    if (c.sol !== "CHAMP" || l < 1) continue;
    if (ix.niveau(c.x, c.y + 1) < l) out.add(k(c.x, c.y));
  }
  return out;
}

/**
 * La force de l'eau pour un moulin : ×1 à sec, ×2 au bord d'une eau qui
 * coule, ×3 au pied d'une cascade.
 */
/**
 * La portée d'un bief : le canal qui amène l'eau d'une rivière ou d'une
 * cascade de la campagne jusqu'à la roue du moulin, sur la ferme.
 */
export const PORTEE_BIEF = 8;

export function forceHydraulique(
  cells: readonly CaseRelief[],
  batiment: { originX: number; originY: number; w: number; h: number },
  hydro: Hydrologie = hydrologie(cells),
  /** Au plus près sans bief : 2 cases d'une chute, 1 d'une eau qui coule. */
  portee?: number,
): 1 | 2 | 3 {
  const { originX: x0, originY: y0, w, h } = batiment;
  const pres = (x: number, y: number, r: number) =>
    x >= x0 - r && x < x0 + w + r && y >= y0 - r && y < y0 + h + r;
  if (hydro.chutes.some((c) => pres(c.x + c.dx, c.y + c.dy, portee ?? 2))) return 3;
  for (const kk of hydro.courante) {
    const [x, y] = kk.split(",").map(Number) as [number, number];
    if (pres(x, y, portee ?? 1)) return 2;
  }
  return 1;
}
