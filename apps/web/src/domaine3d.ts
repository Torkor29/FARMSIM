import * as THREE from "three";
import { cleCase, masqueVoisins, type Bornes } from "@farmsim/shared";
import { ajouterArbre, ajouterBoite, ajouterGeometrie, maillageFacette, pose } from "./decor3d";

/**
 * Ce que la ferme libre ajoute au sol : la friche à acheter, la limite de la
 * propriété, les étangs, les chemins, le décor posé, et — en mode
 * construction — la grille, les lots et le fantôme.
 *
 * Tout est versé dans des maillages fusionnés (une couleur par sommet) et
 * reconstruit **quand les données changent**, jamais à chaque image : un
 * domaine couvert d'arbres et d'allées reste une poignée d'appels de rendu.
 * Chemins, haies, clôtures et étangs lisent leurs voisins pour se raccorder.
 */

export type CaseTerrain = {
  x: number;
  y: number;
  sol: string;
  revetement: string | null;
};

export type ObjetPose = { id: string; type: string; originX: number; originY: number; rotation: number };

export type DonneesDomaine = {
  bornes: Bornes;
  cells: readonly CaseTerrain[];
  amenagements: readonly ObjetPose[];
};

export type LotAffiche = { id: string; x: number; y: number; w: number; h: number; etat: string; prix: number };

export type EtatConstruction = {
  actif: boolean;
  lots: readonly LotAffiche[];
  lotSurvole: string | null;
  /** Les cases que la pose en cours toucherait, valides ou non. */
  fantome: readonly { x: number; y: number; ok: boolean }[];
  /** L'objet de décor en cours de pose, pour en montrer la silhouette. */
  objetFantome: { type: string; x: number; y: number; rotation: number; ok: boolean } | null;
  /** Le cadre de l'élément choisi. */
  selection: { x: number; y: number; w: number; h: number } | null;
};

type Tableaux = { pos: number[]; col: number[] };

const TOP = 0.09;

/** Un nombre pseudo-aléatoire stable par case : la friche ne bouge pas d'un rechargement à l'autre. */
function hash(x: number, y: number, k = 0): number {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const _cyl = new Map<number, THREE.CylinderGeometry>();
function cylindre(cotes: number): THREE.CylinderGeometry {
  let g = _cyl.get(cotes);
  if (!g) {
    g = new THREE.CylinderGeometry(0.5, 0.5, 1, cotes);
    _cyl.set(cotes, g);
  }
  return g;
}
const _cone = new THREE.ConeGeometry(0.5, 1, 7);
const _ico = new THREE.IcosahedronGeometry(0.5, 0);
const _ico1 = new THREE.IcosahedronGeometry(0.5, 1);

/* ------------------------------------------------------------------ */
/* Les objets du décor                                                  */
/* ------------------------------------------------------------------ */

/**
 * Verse un objet du décor dans des tableaux, centré sur (cx, cz).
 *
 * `voisins` est le masque des voisins du même type (haies, clôtures) : bits
 * 1 nord, 2 est, 4 sud, 8 ouest — voir `masqueVoisins`.
 */
export function verserObjet(
  t: Tableaux,
  type: string,
  cx: number,
  cz: number,
  rotation: number,
  pas: number,
  voisins = 0,
  graine = 0,
): void {
  const rot = (rotation * Math.PI) / 2;
  const y = TOP;
  const b = (x: number, yy: number, z: number, w: number, h: number, d: number, c: number, r = rot) =>
    ajouterBoite(t.pos, t.col, cx + x, y + yy, cz + z, w, h, d, c, r);
  // Un décalage local tourné avec l'objet.
  const loc = (dx: number, dz: number) => ({
    x: dx * Math.cos(rot) + dz * Math.sin(rot),
    z: -dx * Math.sin(rot) + dz * Math.cos(rot),
  });
  switch (type) {
    case "chene":
      ajouterArbre(t.pos, t.col, cx, y, cz, 1.9, 900 + graine);
      break;
    case "pommier": {
      ajouterArbre(t.pos, t.col, cx, y, cz, 1.35, 400 + graine);
      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + graine;
        b(Math.cos(a) * 0.3, 0.62 + (k % 3) * 0.1, Math.sin(a) * 0.3, 0.07, 0.07, 0.07, 0xd33a2c, 0);
      }
      break;
    }
    case "sapin": {
      b(0, 0.12, 0, 0.09, 0.24, 0.09, 0x6b4726, 0);
      for (let k = 0; k < 3; k++) {
        const s = 0.72 - k * 0.2;
        ajouterGeometrie(t.pos, t.col, _cone, pose(cx, y + 0.42 + k * 0.3, cz, graine, s, 0.55, s), k === 2 ? 0x3f7d3c : 0x2f6b34);
      }
      break;
    }
    case "buisson": {
      for (let k = 0; k < 4; k++) {
        const a = k * 1.7 + graine;
        const r = k === 0 ? 0 : 0.18;
        ajouterGeometrie(t.pos, t.col, _ico1, pose(cx + Math.cos(a) * r, y + 0.18, cz + Math.sin(a) * r, a, 0.42, 0.34, 0.42), k % 2 ? 0x4f8a3a : 0x5f9c44);
      }
      break;
    }
    case "fleurs": {
      b(0, 0.02, 0, 0.8, 0.04, 0.8, 0x6b4f33, 0);
      const couleurs = [0xe8483c, 0xf2c230, 0xf4f0ea, 0x8a5bc4, 0xf08cb4];
      for (let k = 0; k < 14; k++) {
        const u = hash(k, graine, 3) - 0.5;
        const v = hash(graine, k, 5) - 0.5;
        b(u * 0.66, 0.1, v * 0.66, 0.02, 0.16, 0.02, 0x5d8f3a, 0);
        b(u * 0.66, 0.2, v * 0.66, 0.09, 0.06, 0.09, couleurs[k % couleurs.length]!, k);
      }
      break;
    }
    case "rocher": {
      ajouterGeometrie(t.pos, t.col, _ico, pose(cx, y + 0.12, cz, rot + 0.4, 0.62, 0.36, 0.5), 0x8e8b84);
      ajouterGeometrie(t.pos, t.col, _ico, pose(cx + 0.22, y + 0.06, cz + 0.12, rot, 0.3, 0.2, 0.28), 0x7b7872);
      ajouterGeometrie(t.pos, t.col, _ico, pose(cx - 0.05, y + 0.24, cz - 0.04, rot, 0.34, 0.08, 0.3), 0x6f8f4a);
      break;
    }
    case "haie": {
      const vert = 0x3f7a35;
      b(0, 0.26, 0, 0.44, 0.52, 0.44, vert, 0);
      const bras: [number, number, number][] = [
        [1, 0, -1],
        [2, 1, 0],
        [4, 0, 1],
        [8, -1, 0],
      ];
      for (const [bit, dx, dz] of bras) {
        if (!(voisins & bit)) continue;
        const L = pas / 2;
        b((dx * L) / 2, 0.25, (dz * L) / 2, dx ? L : 0.4, 0.5, dz ? L : 0.4, vert, 0);
      }
      for (let k = 0; k < 3; k++) {
        ajouterGeometrie(t.pos, t.col, _ico1, pose(cx + (hash(k, graine) - 0.5) * 0.3, y + 0.5, cz + (hash(graine, k) - 0.5) * 0.3, k, 0.34, 0.24, 0.34), 0x4c8a3f);
      }
      break;
    }
    case "cloture": {
      const bois = 0x9c7650;
      b(0, 0.24, 0, 0.08, 0.48, 0.08, 0x7a5a3a, 0);
      const bras: [number, number, number][] = [
        [1, 0, -1],
        [2, 1, 0],
        [4, 0, 1],
        [8, -1, 0],
      ];
      let n = 0;
      for (const [bit, dx, dz] of bras) {
        if (!(voisins & bit)) continue;
        n++;
        const L = pas / 2;
        for (const h of [0.18, 0.36]) b((dx * L) / 2, h, (dz * L) / 2, dx ? L : 0.05, 0.05, dz ? L : 0.05, bois, 0);
      }
      if (!n) {
        // Seule, elle se lit comme un bout de barrière, tournée comme on l'a posée.
        const r = rotation % 2 ? Math.PI / 2 : 0;
        for (const h of [0.18, 0.36]) b(0, h, 0, pas * 0.9, 0.05, 0.05, bois, r);
        for (const s of [-1, 1]) {
          const p = loc(s * pas * 0.42, 0);
          b(p.x, 0.22, p.z, 0.07, 0.44, 0.07, 0x7a5a3a, 0);
        }
      }
      break;
    }
    case "banc": {
      const bois = 0xa9804f;
      const assise = loc(0, 0.02);
      b(assise.x, 0.24, assise.z, 0.74, 0.05, 0.26, bois);
      const dossier = loc(0, -0.12);
      b(dossier.x, 0.4, dossier.z, 0.74, 0.18, 0.04, bois);
      for (const s of [-1, 1]) {
        const p = loc(s * 0.3, 0);
        b(p.x, 0.12, p.z, 0.05, 0.24, 0.24, 0x4f4a45);
      }
      break;
    }
    case "lampadaire": {
      b(0, 0.04, 0, 0.2, 0.08, 0.2, 0x4f575d, 0);
      b(0, 0.6, 0, 0.05, 1.1, 0.05, 0x3d4449, 0);
      b(0, 1.16, 0, 0.18, 0.2, 0.18, 0xffe7a3, 0);
      ajouterGeometrie(t.pos, t.col, _cone, pose(cx, y + 1.32, cz, 0, 0.26, 0.14, 0.26), 0x3d4449);
      break;
    }
    case "botte-foin": {
      const paille = 0xd9b75a;
      for (const [dx, dy, dz] of [
        [-0.2, 0.17, 0],
        [0.2, 0.17, 0],
        [0, 0.47, 0],
      ] as const) {
        const p = loc(dx, dz);
        ajouterGeometrie(
          t.pos,
          t.col,
          cylindre(12),
          new THREE.Matrix4()
            .makeTranslation(cx + p.x, y + dy, cz + p.z)
            .multiply(new THREE.Matrix4().makeRotationY(rot))
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
            .multiply(new THREE.Matrix4().makeScale(0.34, 0.42, 0.34)),
          paille,
        );
      }
      break;
    }
    case "puits": {
      ajouterGeometrie(t.pos, t.col, cylindre(14), pose(cx, y + 0.18, cz, 0, 0.66, 0.36, 0.66), 0x9d968a);
      ajouterGeometrie(t.pos, t.col, cylindre(14), pose(cx, y + 0.37, cz, 0, 0.5, 0.02, 0.5), 0x2f4e63);
      for (const s of [-1, 1]) {
        const p = loc(s * 0.28, 0);
        b(p.x, 0.62, p.z, 0.06, 0.62, 0.06, 0x7a5a3a);
      }
      const toit = loc(0, 0);
      ajouterGeometrie(t.pos, t.col, _cone, pose(cx + toit.x, y + 1.04, cz + toit.z, rot + Math.PI / 4, 0.86, 0.3, 0.86), 0x8a3b2a);
      b(0, 0.82, 0, 0.5, 0.05, 0.05, 0x6b4726);
      break;
    }
    default:
      b(0, 0.2, 0, 0.5, 0.4, 0.5, 0xb0a590, 0);
  }
}

/* ------------------------------------------------------------------ */
/* Le domaine                                                           */
/* ------------------------------------------------------------------ */

const COULEUR_CHEMIN: Record<string, number> = {
  TERRE: 0xa3845a,
  GRAVIER: 0xd2cbbb,
  PAVE: 0x9e9a92,
};

export type Domaine3d = {
  group: THREE.Group;
  /** Terrain et décor : à chaque changement de données. */
  majTerrain(d: DonneesDomaine, pos: (x: number, y: number) => { px: number; pz: number }, pas: number): void;
  /** Grille, lots, fantôme : à chaque changement de l'état de construction. */
  majConstruction(e: EtatConstruction, bornes: Bornes, pos: (x: number, y: number) => { px: number; pz: number }, pas: number): void;
  animer(t: number): void;
  dispose(): void;
};

export function creerDomaine3d(opts: { shadows: boolean }): Domaine3d {
  const group = new THREE.Group();
  group.name = "domaine";
  const terrain = new THREE.Group();
  terrain.name = "domaine-terrain";
  const construction = new THREE.Group();
  construction.name = "domaine-construction";
  group.add(terrain, construction);

  const matEau = new THREE.MeshStandardMaterial({
    color: 0x4f9cc4,
    roughness: 0.18,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88,
  });
  const matGrille = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 });
  const matLot = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.16, depthWrite: false });
  const matLotSurvole = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.36, depthWrite: false });
  const matBordLot = new THREE.LineBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.85 });
  const matFantomeOk = new THREE.MeshBasicMaterial({ color: 0x52c46b, transparent: true, opacity: 0.5, depthWrite: false });
  const matFantomeNon = new THREE.MeshBasicMaterial({ color: 0xe0524a, transparent: true, opacity: 0.5, depthWrite: false });
  const matSelection = new THREE.LineBasicMaterial({ color: 0xffe066 });
  const jetables: { dispose(): void }[] = [];
  let fantomeObjet: THREE.Mesh | null = null;

  function vider(g: THREE.Group) {
    for (const o of [...g.children]) {
      g.remove(o);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | undefined;
        // Les matériaux partagés restent ; ceux des textes et des maillages fusionnés partent.
        if (mat && ![matEau, matGrille, matLot, matLotSurvole, matBordLot, matFantomeOk, matFantomeNon, matSelection].includes(mat as never)) {
          (mat as THREE.SpriteMaterial).map?.dispose();
          mat.dispose();
        }
      });
    }
  }

  function majTerrain(d: DonneesDomaine, posDe: (x: number, y: number) => { px: number; pz: number }, pas: number) {
    vider(terrain);
    const possedees = new Set(d.cells.map((c) => cleCase(c.x, c.y)));
    const friche: Tableaux = { pos: [], col: [] };
    const limite: Tableaux = { pos: [], col: [] };
    const chemins: Tableaux = { pos: [], col: [] };
    const berges: Tableaux = { pos: [], col: [] };
    const objets: Tableaux = { pos: [], col: [] };

    /* La friche : herbes hautes, quelques buissons et pierres. */
    for (let y = d.bornes.minY; y < d.bornes.maxY; y++) {
      for (let x = d.bornes.minX; x < d.bornes.maxX; x++) {
        if (possedees.has(cleCase(x, y))) continue;
        const { px, pz } = posDe(x, y);
        for (let k = 0; k < 3; k++) {
          const u = (hash(x, y, k) - 0.5) * 0.8;
          const v = (hash(y, x, k + 7) - 0.5) * 0.8;
          const h = 0.18 + hash(x, y, k + 3) * 0.2;
          ajouterGeometrie(friche.pos, friche.col, _cone, pose(px + u, TOP + h / 2, pz + v, k, 0.16, h, 0.16), k % 2 ? 0xa4a95a : 0x8f9d4d);
        }
        const r = hash(x, y, 11);
        if (r > 0.86) {
          ajouterGeometrie(friche.pos, friche.col, _ico1, pose(px, TOP + 0.16, pz, r * 6, 0.46, 0.34, 0.46), 0x5c8a40);
        } else if (r < 0.05) {
          ajouterGeometrie(friche.pos, friche.col, _ico, pose(px, TOP + 0.08, pz, r * 60, 0.34, 0.2, 0.3), 0x8e8b84);
        }
      }
    }

    /* La limite de propriété : une clôture basse entre sa terre et la friche. */
    const bord = (px: number, pz: number, dx: number, dz: number) => {
      const cx = px + (dx * pas) / 2;
      const cz = pz + (dz * pas) / 2;
      const long = dx !== 0;
      for (const h of [0.14, 0.28]) {
        ajouterBoite(limite.pos, limite.col, cx, TOP + h, cz, long ? 0.04 : pas, 0.035, long ? pas : 0.04, 0xc8a878);
      }
      ajouterBoite(limite.pos, limite.col, cx + (long ? 0 : pas / 2), TOP + 0.17, cz + (long ? pas / 2 : 0), 0.06, 0.34, 0.06, 0x8a6a45);
    };
    for (const c of d.cells) {
      const { px, pz } = posDe(c.x, c.y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = c.x + dx;
        const ny = c.y + dy;
        const dedans = nx >= d.bornes.minX && ny >= d.bornes.minY && nx < d.bornes.maxX && ny < d.bornes.maxY;
        if (dedans && !possedees.has(cleCase(nx, ny))) bord(px, pz, dx, dy);
      }
    }

    /* Les chemins : un pavé central et un bras vers chaque voisin chemin. */
    const parType = new Map<string, Set<string>>();
    for (const c of d.cells) {
      if (!c.revetement) continue;
      let s = parType.get("tous");
      if (!s) parType.set("tous", (s = new Set()));
      s.add(cleCase(c.x, c.y));
    }
    const tousChemins = parType.get("tous") ?? new Set<string>();
    const largeur = pas * 0.56;
    for (const c of d.cells) {
      if (!c.revetement) continue;
      const { px, pz } = posDe(c.x, c.y);
      const couleur = COULEUR_CHEMIN[c.revetement] ?? COULEUR_CHEMIN.TERRE!;
      const m = masqueVoisins(tousChemins, c.x, c.y);
      const e = 0.018;
      ajouterBoite(chemins.pos, chemins.col, px, TOP + e / 2, pz, largeur, e, largeur, couleur);
      const bras: [number, number, number][] = [
        [1, 0, -1],
        [2, 1, 0],
        [4, 0, 1],
        [8, -1, 0],
      ];
      for (const [bit, dx, dz] of bras) {
        if (!(m & bit)) continue;
        const L = (pas - largeur) / 2 + 0.01;
        const off = largeur / 2 + L / 2;
        ajouterBoite(chemins.pos, chemins.col, px + dx * off, TOP + e / 2, pz + dz * off, dx ? L : largeur, e, dz ? L : largeur, couleur);
      }
      // Du grain : gravillons clairs, joints de pavés, ornières de terre.
      if (c.revetement === "PAVE") {
        for (let k = 0; k < 4; k++) {
          const u = ((k % 2) - 0.5) * largeur * 0.5;
          const v = (Math.floor(k / 2) - 0.5) * largeur * 0.5;
          ajouterBoite(chemins.pos, chemins.col, px + u, TOP + e + 0.004, pz + v, largeur * 0.44, 0.008, largeur * 0.44, k % 3 ? 0xa9a59c : 0x928e86);
        }
      } else if (c.revetement === "GRAVIER") {
        for (let k = 0; k < 5; k++) {
          const u = (hash(c.x, c.y, k) - 0.5) * largeur * 0.8;
          const v = (hash(c.y, c.x, k) - 0.5) * largeur * 0.8;
          ajouterBoite(chemins.pos, chemins.col, px + u, TOP + e + 0.004, pz + v, 0.05, 0.01, 0.05, 0xb8b09e);
        }
      } else {
        for (const s of [-1, 1]) {
          ajouterBoite(chemins.pos, chemins.col, px + s * largeur * 0.22, TOP + e + 0.003, pz, 0.06, 0.006, 0.06, 0x8c6f48);
        }
      }
    }

    /* Les étangs : une nappe par case, arrondie là où l'eau s'arrête. */
    const eaux = new Set(d.cells.filter((c) => c.sol === "EAU").map((c) => cleCase(c.x, c.y)));
    const formes: THREE.BufferGeometry[] = [];
    for (const k of eaux) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      const { px, pz } = posDe(x, y);
      const m = masqueVoisins(eaux, x, y);
      const marge = 0.16;
      const demi = pas / 2;
      const nord = m & 1 ? demi : demi - marge;
      const est = m & 2 ? demi : demi - marge;
      const sud = m & 4 ? demi : demi - marge;
      const ouest = m & 8 ? demi : demi - marge;
      const r = 0.22;
      const arrondi = (a: number, b: number) => (!(m & a) && !(m & b) ? r : 0);
      const forme = new THREE.Shape();
      // Repère de la forme : x vers l'est, y vers le nord (z négatif).
      const rNE = arrondi(1, 2);
      const rSE = arrondi(4, 2);
      const rSO = arrondi(4, 8);
      const rNO = arrondi(1, 8);
      forme.moveTo(-ouest + rSO, -sud);
      forme.lineTo(est - rSE, -sud);
      if (rSE) forme.quadraticCurveTo(est, -sud, est, -sud + rSE);
      forme.lineTo(est, nord - rNE);
      if (rNE) forme.quadraticCurveTo(est, nord, est - rNE, nord);
      forme.lineTo(-ouest + rNO, nord);
      if (rNO) forme.quadraticCurveTo(-ouest, nord, -ouest, nord - rNO);
      forme.lineTo(-ouest, -sud + rSO);
      if (rSO) forme.quadraticCurveTo(-ouest, -sud, -ouest + rSO, -sud);
      const g = new THREE.ShapeGeometry(forme, 4);
      g.rotateX(-Math.PI / 2);
      g.translate(px, TOP + 0.012, pz);
      formes.push(g);
      // La berge : un liseré de terre et quelques roseaux là où l'eau finit.
      for (const [bit, dx, dz] of [
        [1, 0, -1],
        [2, 1, 0],
        [4, 0, 1],
        [8, -1, 0],
      ] as const) {
        if (m & bit) continue;
        const cxB = px + dx * (demi - marge / 2);
        const czB = pz + dz * (demi - marge / 2);
        ajouterBoite(berges.pos, berges.col, cxB, TOP + 0.01, czB, dx ? marge : pas, 0.02, dz ? marge : pas, 0x7d6a45);
        if (hash(x, y, bit) > 0.45) {
          for (let j = 0; j < 3; j++) {
            const t = (hash(x + j, y, bit) - 0.5) * pas * 0.7;
            ajouterBoite(berges.pos, berges.col, cxB + (dz ? t : 0), TOP + 0.2, czB + (dx ? t : 0), 0.03, 0.4, 0.03, 0x6f9a3a);
          }
        }
      }
    }
    if (formes.length) {
      const fusion = fusionner(formes);
      const eau = new THREE.Mesh(fusion, matEau);
      eau.name = "etangs";
      eau.receiveShadow = true;
      terrain.add(eau);
    }

    /* Le décor posé, raccordé à ses voisins du même type. */
    const parTypeObjet = new Map<string, Set<string>>();
    for (const a of d.amenagements) {
      let s = parTypeObjet.get(a.type);
      if (!s) parTypeObjet.set(a.type, (s = new Set()));
      s.add(cleCase(a.originX, a.originY));
    }
    for (const a of d.amenagements) {
      const { px, pz } = posDe(a.originX, a.originY);
      const voisins = masqueVoisins(parTypeObjet.get(a.type) ?? new Set(), a.originX, a.originY);
      verserObjet(objets, a.type, px, pz, a.rotation, pas, voisins, Math.abs(a.originX * 31 + a.originY * 17));
    }

    for (const [nom, t, ombre] of [
      ["domaine-friche", friche, false],
      ["domaine-limite", limite, opts.shadows],
      ["domaine-chemins", chemins, false],
      ["domaine-berges", berges, false],
      ["domaine-objets", objets, opts.shadows],
    ] as const) {
      if (!t.pos.length) continue;
      const m = maillageFacette(t.pos, t.col, { shadows: ombre, recoit: true, nom });
      terrain.add(m);
    }
  }

  function majConstruction(
    e: EtatConstruction,
    bornes: Bornes,
    posDe: (x: number, y: number) => { px: number; pz: number },
    pas: number,
  ) {
    vider(construction);
    fantomeObjet = null;
    if (!e.actif) return;
    const coin = (x: number, y: number) => {
      const { px, pz } = posDe(x, y);
      return { x: px - pas / 2, z: pz - pas / 2 };
    };
    const y0 = TOP + 0.02;

    /* La grille, discrète, sur tout le domaine. */
    const lignes: number[] = [];
    for (let x = bornes.minX; x <= bornes.maxX; x++) {
      const a = coin(x, bornes.minY);
      const b = coin(x, bornes.maxY);
      lignes.push(a.x, y0, a.z, b.x, y0, b.z);
    }
    for (let y = bornes.minY; y <= bornes.maxY; y++) {
      const a = coin(bornes.minX, y);
      const b = coin(bornes.maxX, y);
      lignes.push(a.x, y0, a.z, b.x, y0, b.z);
    }
    const gGrille = new THREE.BufferGeometry();
    gGrille.setAttribute("position", new THREE.Float32BufferAttribute(lignes, 3));
    construction.add(new THREE.LineSegments(gGrille, matGrille));

    /* Les lots à vendre : un voile doré, un liseré, et leur prix. */
    for (const lot of e.lots) {
      if (lot.etat !== "ACHETABLE") continue;
      const a = coin(lot.x, lot.y);
      const b = coin(lot.x + lot.w, lot.y + lot.h);
      const w = b.x - a.x;
      const d = b.z - a.z;
      const voile = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lot.id === e.lotSurvole ? matLotSurvole : matLot);
      voile.rotation.x = -Math.PI / 2;
      voile.position.set(a.x + w / 2, y0 + 0.01, a.z + d / 2);
      voile.renderOrder = 2;
      construction.add(voile);
      const cadre = new THREE.BufferGeometry();
      const yy = y0 + 0.02;
      cadre.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [a.x, yy, a.z, b.x, yy, a.z, b.x, yy, a.z, b.x, yy, b.z, b.x, yy, b.z, a.x, yy, b.z, a.x, yy, b.z, a.x, yy, a.z],
          3,
        ),
      );
      construction.add(new THREE.LineSegments(cadre, matBordLot));
      const etiquette = etiquettePrix(`${lot.prix.toLocaleString("fr-FR")} €`);
      etiquette.position.set(a.x + w / 2, 1.2, a.z + d / 2);
      construction.add(etiquette);
    }

    /* Le fantôme : chaque case touchée, verte ou rouge. */
    if (e.fantome.length) {
      const geo = new THREE.PlaneGeometry(pas * 0.94, pas * 0.94);
      geo.rotateX(-Math.PI / 2);
      const oks = e.fantome.filter((c) => c.ok);
      const nons = e.fantome.filter((c) => !c.ok);
      for (const [liste, mat] of [
        [oks, matFantomeOk],
        [nons, matFantomeNon],
      ] as const) {
        if (!liste.length) continue;
        const inst = new THREE.InstancedMesh(geo.clone(), mat, liste.length);
        const m = new THREE.Matrix4();
        liste.forEach((c, i) => {
          const { px, pz } = posDe(c.x, c.y);
          m.makeTranslation(px, y0 + 0.03, pz);
          inst.setMatrixAt(i, m);
        });
        inst.renderOrder = 3;
        inst.frustumCulled = false;
        construction.add(inst);
      }
      geo.dispose();
    }

    /* La silhouette de l'objet en cours de pose. */
    if (e.objetFantome) {
      const t: Tableaux = { pos: [], col: [] };
      const { px, pz } = posDe(e.objetFantome.x, e.objetFantome.y);
      verserObjet(t, e.objetFantome.type, px, pz, e.objetFantome.rotation, pas);
      if (t.pos.length) {
        const m = maillageFacette(t.pos, t.col, { nom: "objet-fantome" });
        const mat = m.material as THREE.MeshLambertMaterial;
        mat.transparent = true;
        mat.opacity = e.objetFantome.ok ? 0.72 : 0.4;
        m.renderOrder = 4;
        construction.add(m);
        fantomeObjet = m;
      }
    }

    /* Le cadre de l'élément choisi. */
    if (e.selection) {
      const a = coin(e.selection.x, e.selection.y);
      const b = coin(e.selection.x + e.selection.w, e.selection.y + e.selection.h);
      const yy = y0 + 0.05;
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [a.x, yy, a.z, b.x, yy, a.z, b.x, yy, a.z, b.x, yy, b.z, b.x, yy, b.z, a.x, yy, b.z, a.x, yy, b.z, a.x, yy, a.z],
          3,
        ),
      );
      construction.add(new THREE.LineSegments(g, matSelection));
    }
  }

  function animer(t: number) {
    // Le voile du lot survolé et le fantôme respirent doucement : on voit
    // qu'ils attendent un geste.
    matLotSurvole.opacity = 0.3 + Math.sin(t * 4) * 0.08;
    matFantomeOk.opacity = 0.45 + Math.sin(t * 5) * 0.08;
    if (fantomeObjet) fantomeObjet.position.y = 0.04 + Math.sin(t * 5) * 0.025;
  }

  return {
    group,
    majTerrain,
    majConstruction,
    animer,
    dispose() {
      vider(terrain);
      vider(construction);
      for (const m of [matEau, matGrille, matLot, matLotSurvole, matBordLot, matFantomeOk, matFantomeNon, matSelection]) m.dispose();
      for (const j of jetables) j.dispose();
    },
  };
}

/** Fusionne des géométries non indexées de même format. */
function fusionner(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const plates = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0;
  for (const g of plates) n += g.getAttribute("position").count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of plates) {
    const p = g.getAttribute("position");
    const q = g.getAttribute("normal");
    pos.set(p.array as Float32Array, o * 3);
    if (q) nor.set(q.array as Float32Array, o * 3);
    o += p.count;
  }
  for (const g of geos) g.dispose();
  for (const g of plates) g.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}

/** Une étiquette de prix toujours tournée vers la caméra. */
function etiquettePrix(texte: string): THREE.Sprite {
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = canvas?.getContext?.("2d") ?? null;
  const mat = new THREE.SpriteMaterial({ depthTest: false, transparent: true });
  if (canvas && ctx) {
    canvas.width = 256;
    canvas.height = 96;
    ctx.fillStyle = "rgba(255, 250, 235, 0.96)";
    ctx.strokeStyle = "#c99a2e";
    ctx.lineWidth = 6;
    const r = 26;
    ctx.beginPath();
    ctx.moveTo(r, 4);
    ctx.arcTo(252, 4, 252, 92, r);
    ctx.arcTo(252, 92, 4, 92, r);
    ctx.arcTo(4, 92, 4, 4, r);
    ctx.arcTo(4, 4, 252, 4, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6b4a12";
    ctx.font = '800 40px "Baloo 2", Signika, system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(texte, 128, 50);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    mat.map = tex;
  }
  const s = new THREE.Sprite(mat);
  s.scale.set(2.4, 0.9, 1);
  s.renderOrder = 10;
  return s;
}
