import * as THREE from "three";
import { casesEmprise, cleCase, defConstruction, empriseOrientee, masqueVoisins, type Bornes } from "@farmsim/shared";
import { ajouterArbre, ajouterBoite, ajouterGeometrie, maillageFacette, pose } from "./decor3d";
import { maillerEau, materiauEau } from "./eau3d";
import { creerEauVivante } from "./eau-vivante";

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
  /** Ce qui occupe la case, pour ne pas faire pousser d'herbe sous un toit. */
  kind?: string;
  /** Berges : la forme des coins d'une case d'eau. */
  forme?: number;
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
  /** L'outil Berges : le coin visé, et la forme qu'il prendrait. */
  berge?: { x: number; y: number; coin: 0 | 1 | 2 | 3; ok: boolean; forme: number } | null;
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
/** Une feuille de nénuphar : un disque échancré, à plat. */
const _nenuphar = new THREE.CircleGeometry(1, 12, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2);
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
  const poussieres = new THREE.Group();
  poussieres.name = "domaine-poussieres";
  group.add(terrain, construction, poussieres);
  /*
   * Ce qui vient de changer se voit : un anneau de poussière claire s'ouvre
   * sur chaque case repeinte, chaque objet posé ou déplacé. Sans lui, une
   * allée d'une case ou un buisson posé au loin passaient inaperçus — on
   * cliquait deux fois, pour rien.
   */
  const geoPoussiere = new THREE.RingGeometry(0.2, 0.34, 18).rotateX(-Math.PI / 2);
  const poufs: { m: THREE.Mesh; t0: number | null }[] = [];
  let signatures: Map<string, string> | null = null;
  /** La forme des coins de chaque case d'eau, au dernier rendu. */
  let formesPrec = new Map<string, number>();
  /** Quand chaque case d'eau a été creusée — l'eau y monte pendant la seconde qui suit. */
  const naissances = new Map<string, number>();
  let eauxCourantes = new Map<string, number>();
  let origineEau = { px: 0, pz: 0 };
  let pasEau = 1;
  let tCourant = 0;
  const matNappe = materiauEau();
  const vivante = creerEauVivante(group);
  /** Le trait de la limite de propriété, calculé avec le terrain, montré en construction. */
  const limite: Tableaux = { pos: [], col: [] };

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
        if (mat && ![matEau, matNappe, matGrille, matLot, matLotSurvole, matBordLot, matFantomeOk, matFantomeNon, matSelection].includes(mat as never)) {
          (mat as THREE.SpriteMaterial).map?.dispose();
          mat.dispose();
        }
      });
    }
  }

  function majTerrain(d: DonneesDomaine, posDe: (x: number, y: number) => { px: number; pz: number }, pas: number) {
    vider(terrain);
    const suivantes = new Map<string, string>();
    for (const c of d.cells) suivantes.set(cleCase(c.x, c.y), `${c.sol}|${c.revetement ?? ""}`);
    for (const a of d.amenagements) suivantes.set(`o:${a.id}`, `${a.originX},${a.originY},${a.rotation}`);
    // Une autre parcelle n'est pas un changement : c'est une autre scène.
    let disparues = 0;
    if (signatures) for (const k of signatures.keys()) if (!k.startsWith("o:") && !suivantes.has(k)) disparues++;
    const formesSuiv = new Map<string, number>();
    for (const c of d.cells) if (c.sol === "EAU") formesSuiv.set(cleCase(c.x, c.y), c.forme ?? 0);
    if (signatures && disparues < 12) {
      const changees: { x: number; y: number }[] = [];
      const creusees: { x: number; y: number }[] = [];
      for (const [k, v] of suivantes) {
        const avant = signatures.get(k);
        if (avant === v) continue;
        // Creuser et reboucher ont leur propre spectacle, plus parlant qu'une poussière.
        if (!k.startsWith("o:") && v.startsWith("EAU|") && avant && !avant.startsWith("EAU|")) {
          const [x, y] = k.split(",").map(Number) as [number, number];
          creusees.push({ x, y });
          continue;
        }
        if (!k.startsWith("o:") && avant?.startsWith("EAU|")) {
          const [x, y] = k.split(",").map(Number) as [number, number];
          vivante.reboucher(x, y, tCourant + Math.random() * 0.2);
        }
        if (k.startsWith("o:")) {
          const [x, y] = v.split(",").map(Number) as [number, number];
          changees.push({ x, y });
        } else {
          const [x, y] = k.split(",").map(Number) as [number, number];
          changees.push({ x, y });
        }
      }
      // Un lot acheté change trente-six cases d'un coup : on en garde assez
      // pour qu'on le voie, pas de quoi remplir l'écran de fumée.
      for (const c of changees.length > 80 ? [] : changees.slice(0, 48)) {
        const { px, pz } = posDe(c.x, c.y);
        const m = new THREE.Mesh(
          geoPoussiere,
          new THREE.MeshBasicMaterial({ color: 0xf3ead2, transparent: true, opacity: 0.8, depthWrite: false }),
        );
        m.position.set(px, TOP + 0.03, pz);
        m.renderOrder = 3;
        poussieres.add(m);
        poufs.push({ m, t0: null });
      }
      // L'eau se creuse de proche en proche, dans l'ordre du geste.
      if (creusees.length) {
        const [a] = creusees;
        creusees.sort((p, q) => Math.hypot(p.x - a!.x, p.y - a!.y) - Math.hypot(q.x - a!.x, q.y - a!.y));
        const pasT = Math.min(0.07, 1.6 / creusees.length);
        creusees.forEach((c, i) => {
          const t = tCourant + 0.05 + i * pasT;
          naissances.set(cleCase(c.x, c.y), t);
          vivante.creuser(c.x, c.y, t);
        });
      }
      // Un coin de berge retouché : un éclat là où il a changé.
      for (const [k, f] of formesSuiv) {
        const avant = formesPrec.get(k);
        if (avant === undefined || avant === f) continue;
        const [x, y] = k.split(",").map(Number) as [number, number];
        for (let c = 0; c < 4; c++) {
          if (((avant >> (c * 2)) & 3) !== ((f >> (c * 2)) & 3)) vivante.eclat(x, y, c as 0 | 1 | 2 | 3, tCourant);
        }
      }
    }
    formesPrec = formesSuiv;
    signatures = suivantes;
    const possedees = new Set(d.cells.map((c) => cleCase(c.x, c.y)));
    const friche: Tableaux = { pos: [], col: [] };
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

    /*
     * Le pré : de l'herbe courte et quelques fleurs des champs.
     *
     * Sa couleur seule le distinguait mal d'un champ au repos — deux verts
     * voisins. Les touffes disent « prairie » d'un coup d'œil, et laissent au
     * champ sa surface nette, prête à labourer.
     */
    const sousObjet = new Set<string>();
    for (const a of d.amenagements) {
      const def = defConstruction(a.type);
      if (!def) continue;
      const e = empriseOrientee(def, a.rotation);
      for (const p of casesEmprise(a.originX, a.originY, e.w, e.h)) sousObjet.add(cleCase(p.x, p.y));
    }
    for (const c of d.cells) {
      if (c.sol !== "PRE" || c.revetement || c.kind === "BUILDING" || sousObjet.has(cleCase(c.x, c.y))) continue;
      const { px, pz } = posDe(c.x, c.y);
      for (let k = 0; k < 4; k++) {
        const u = (hash(c.x, c.y, k + 20) - 0.5) * 0.78;
        const v = (hash(c.y, c.x, k + 27) - 0.5) * 0.78;
        const h = 0.07 + hash(c.x, c.y, k + 31) * 0.06;
        ajouterGeometrie(friche.pos, friche.col, _cone, pose(px + u, TOP + h / 2, pz + v, k, 0.1, h, 0.1), k % 2 ? 0x5f9a3a : 0x6ea945);
      }
      const f = hash(c.x, c.y, 41);
      if (f > 0.72) {
        const u = (hash(c.x, c.y, 43) - 0.5) * 0.6;
        const v = (hash(c.y, c.x, 47) - 0.5) * 0.6;
        ajouterBoite(friche.pos, friche.col, px + u, TOP + 0.05, pz + v, 0.05, 0.03, 0.05, f > 0.88 ? 0xf2e36a : 0xf7f4ea);
      }
    }

    /*
     * La limite de propriété : un liseré, pas une clôture.
     *
     * Une clôture d'office enfermait la ferme dans un enclos qu'on n'avait pas
     * choisi, et qu'il fallait abattre et remonter à chaque lot acheté. La
     * limite n'est plus qu'un trait clair au sol, montré en construction ; les
     * clôtures et les haies, c'est le joueur qui les trace, où il veut.
     */
    limite.pos.length = 0;
    limite.col.length = 0;
    const bord = (px: number, pz: number, dx: number, dz: number) => {
      const cx = px + (dx * pas) / 2;
      const cz = pz + (dz * pas) / 2;
      const long = dx !== 0;
      ajouterBoite(limite.pos, limite.col, cx, TOP + 0.035, cz, long ? 0.12 : pas + 0.12, 0.025, long ? pas + 0.12 : 0.12, 0xfff6cc);
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

    /*
     * Les lacs : une nappe d'un seul tenant, creusée sous le pré.
     *
     * Voir `eau3d.ts` pour la forme. Ici on pose : la nappe à `NIVEAU`, la
     * berge de pré au ras du sol dans les cases d'eau, le talus de terre qui
     * descend de l'une à l'autre, des roseaux et des nénuphars.
     */
    eauxCourantes = formesSuiv;
    origineEau = posDe(0, 0);
    pasEau = pas;
    const NIVEAU = TOP - 0.07;
    const FOND = TOP - 0.2;
    const me = maillerEau(eauxCourantes);
    if (me.nappe.pos.length) {
      const n = me.nappe.pos.length / 3;
      const pos = new Float32Array(n * 3);
      const prof = new Float32Array(n);
      const nais = new Float32Array(n);
      // Les triangles sortent dans le sens horaire vus d'en haut : on les
      // retourne pour qu'ils regardent le ciel.
      for (let t = 0; t < n; t += 3) {
        for (let v = 0; v < 3; v++) {
          const src = t + (v === 0 ? 0 : v === 1 ? 2 : 1);
          pos[(t + v) * 3] = origineEau.px + me.nappe.pos[src * 3]! * pas;
          pos[(t + v) * 3 + 1] = NIVEAU;
          pos[(t + v) * 3 + 2] = origineEau.pz + me.nappe.pos[src * 3 + 2]! * pas;
          prof[t + v] = me.nappe.prof[src]!;
          nais[t + v] = naissances.get(me.nappe.cle[src]!) ?? -100;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aProf", new THREE.BufferAttribute(prof, 1));
      geo.setAttribute("aNaissance", new THREE.BufferAttribute(nais, 1));
      geo.computeBoundingSphere();
      const nappe = new THREE.Mesh(geo, matNappe);
      nappe.name = "lacs";
      nappe.renderOrder = 2;
      terrain.add(nappe);
    }
    const monde = (X: number, Y: number): [number, number] => [origineEau.px + X * pas, origineEau.pz + Y * pas];
    const tri = (t: Tableaux, a: number[], b: number[], c: number[], couleur: number) => {
      const col = new THREE.Color(couleur);
      for (const v of [a, b, c]) {
        t.pos.push(v[0]!, v[1]!, v[2]!);
        t.col.push(col.r, col.g, col.b);
      }
    };
    // La berge : le pré qui borde l'eau, dans les cases d'eau.
    for (let k = 0; k < me.berge.length; k += 9) {
      const a = monde(me.berge[k]!, me.berge[k + 2]!);
      const b = monde(me.berge[k + 3]!, me.berge[k + 5]!);
      const c = monde(me.berge[k + 6]!, me.berge[k + 8]!);
      tri(berges, [a[0], TOP + 0.002, a[1]], [c[0], TOP + 0.002, c[1]], [b[0], TOP + 0.002, b[1]], 0x6fa645);
    }
    // Le talus : de la berge au fond, des deux faces (la forme n'a pas de sens).
    for (let k = 0; k < me.contour.length; k += 4) {
      const a = monde(me.contour[k]!, me.contour[k + 1]!);
      const b = monde(me.contour[k + 2]!, me.contour[k + 3]!);
      const haut = TOP + 0.004;
      tri(berges, [a[0], haut, a[1]], [b[0], haut, b[1]], [b[0], FOND, b[1]], 0x6e5536);
      tri(berges, [a[0], haut, a[1]], [b[0], FOND, b[1]], [a[0], FOND, a[1]], 0x5a4329);
      tri(berges, [a[0], haut, a[1]], [b[0], FOND, b[1]], [b[0], haut, b[1]], 0x6e5536);
      tri(berges, [a[0], haut, a[1]], [a[0], FOND, a[1]], [b[0], FOND, b[1]], 0x5a4329);
      // Des roseaux, çà et là, sur la berge.
      const mx = (me.contour[k]! + me.contour[k + 2]!) / 2;
      const my = (me.contour[k + 1]! + me.contour[k + 3]!) / 2;
      if (hash(Math.round(mx * 40), Math.round(my * 40), 5) > 0.86) {
        const [wx, wz] = monde(mx, my);
        for (let r = 0; r < 4; r++) {
          const h = 0.18 + hash(Math.round(mx * 40), r, 9) * 0.2;
          const ox = (hash(r, Math.round(my * 40), 3) - 0.5) * 0.12 * pas;
          const oz = (hash(Math.round(my * 40), r, 7) - 0.5) * 0.12 * pas;
          ajouterBoite(berges.pos, berges.col, wx + ox, TOP + h / 2, wz + oz, 0.018, h, 0.018, r % 2 ? 0x6f9a3a : 0x86a84a);
          if (r === 1) ajouterBoite(berges.pos, berges.col, wx + ox, TOP + h - 0.03, wz + oz, 0.03, 0.07, 0.03, 0x6b4a2a);
        }
      }
    }
    // Des nénuphars au large : une grappe sur une case d'eau profonde sur trois.
    const auLarge = new Map<string, { x: number; y: number; p: number }>();
    for (const f of me.large) {
      const k = cleCase(Math.round(f.x), Math.round(f.y));
      if (f.p < 0.3) continue;
      const deja = auLarge.get(k);
      if (!deja || f.p > deja.p) auLarge.set(k, f);
    }
    for (const [k, f] of auLarge) {
      const [cx, cy] = k.split(",").map(Number) as [number, number];
      if (hash(cx, cy, 21) < 0.66) continue;
      for (let n = 0; n < 3; n++) {
        const ox = (hash(cx, cy, 30 + n) - 0.5) * 0.35;
        const oy = (hash(cy, cx, 40 + n) - 0.5) * 0.35;
        const [wx, wz] = monde(f.x + ox, f.y + oy);
        const r = (0.07 + hash(cx + n, cy, 4) * 0.04) * pas;
        ajouterGeometrie(berges.pos, berges.col, _nenuphar, pose(wx, NIVEAU + 0.004, wz, hash(cx, n, 2) * 6, r, 1, r), n === 1 ? 0x6a9a44 : 0x557f35);
      }
      if (hash(cx, cy, 8) > 0.5) {
        const [wx, wz] = monde(f.x, f.y);
        ajouterBoite(berges.pos, berges.col, wx, NIVEAU + 0.025, wz, 0.04, 0.03, 0.04, hash(cx, cy, 2) > 0.5 ? 0xf1c3d3 : 0xf6f2e6);
      }
    }
    vivante.maj(eauxCourantes, me, origineEau, pas, NIVEAU);

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
    if (limite.pos.length) {
      construction.add(maillageFacette(limite.pos, limite.col, { nom: "domaine-limite" }));
    }
    /*
     * L'outil Berges : le coin visé s'allume, et le contour qu'il prendrait
     * se dessine sur l'eau avant même qu'on clique.
     */
    if (e.berge) {
      const b = e.berge;
      const dx = b.coin === 1 || b.coin === 2 ? 1 : -1;
      const dy = b.coin >= 2 ? 1 : -1;
      const o = posDe(0, 0);
      const cx = o.px + (b.x + dx * 0.3) * pas;
      const cz = o.pz + (b.y + dy * 0.3) * pas;
      const marque = new THREE.Mesh(new THREE.CircleGeometry(0.13 * pas, 20).rotateX(-Math.PI / 2), b.ok ? matFantomeOk : matFantomeNon);
      marque.position.set(cx, TOP + 0.03, cz);
      marque.renderOrder = 4;
      construction.add(marque);
      if (b.ok) {
        const apres = maillerEau(eauxCourantes, { restreindre: [[b.x, b.y]], formeForcee: { x: b.x, y: b.y, forme: b.forme } });
        const l: number[] = [];
        for (let k = 0; k < apres.contour.length; k += 4) {
          l.push(o.px + apres.contour[k]! * pas, TOP - 0.05, o.pz + apres.contour[k + 1]! * pas);
          l.push(o.px + apres.contour[k + 2]! * pas, TOP - 0.05, o.pz + apres.contour[k + 3]! * pas);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(l, 3));
        const trait = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
        trait.renderOrder = 5;
        construction.add(trait);
      }
    }
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
    tCourant = t;
    matNappe.uniforms.uTemps!.value = t;
    vivante.animer(t);
    // Le voile du lot survolé et le fantôme respirent doucement : on voit
    // qu'ils attendent un geste.
    matLotSurvole.opacity = 0.3 + Math.sin(t * 4) * 0.08;
    matFantomeOk.opacity = 0.45 + Math.sin(t * 5) * 0.08;
    if (fantomeObjet) fantomeObjet.position.y = 0.04 + Math.sin(t * 5) * 0.025;
    for (let i = poufs.length - 1; i >= 0; i--) {
      const p = poufs[i]!;
      if (p.t0 == null) p.t0 = t;
      const k = (t - p.t0) / 0.55;
      const mat = p.m.material as THREE.MeshBasicMaterial;
      if (k >= 1) {
        poussieres.remove(p.m);
        mat.dispose();
        poufs.splice(i, 1);
        continue;
      }
      p.m.scale.setScalar(0.8 + k * 1.4);
      mat.opacity = 0.8 * (1 - k) * (1 - k);
    }
  }

  return {
    group,
    majTerrain,
    majConstruction,
    animer,
    dispose() {
      vider(terrain);
      vider(construction);
      vivante.dispose();
      matNappe.dispose();
      for (const p of poufs) (p.m.material as THREE.Material).dispose();
      poufs.length = 0;
      geoPoussiere.dispose();
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
