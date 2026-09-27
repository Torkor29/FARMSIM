/**
 * Les volumes du décor : arbres, voitures, et de quoi les fondre.
 *
 * ## Pourquoi tout fondre
 *
 * Un arbre, c'est un tronc et trois touffes ; une voiture, une caisse, un
 * pavillon, deux essieux et deux feux. Rendus séparément, trente arbres et
 * quatre voitures coûteraient cent quarante appels de dessin par image, sur un
 * téléphone qui peine déjà. `ajouterGeometrie` verse n'importe quelle forme de
 * Trois dans deux tableaux — sommets et couleurs — de sorte qu'un bosquet
 * entier tienne dans un maillage et un appel.
 *
 * ## Pourquoi des arbres en volume
 *
 * Les arbres du jeu étaient des illustrations plates tournées vers la caméra.
 * Ça marchait tant qu'ils décoraient les quatre coins d'une île ; posés par
 * dizaines dans une campagne, ils se voyaient pour ce qu'ils sont — des
 * autocollants qui pivotent quand on tourne la vue, sans épaisseur ni ombre
 * cohérente avec le reste.
 *
 * ## La direction artistique : « jouet de bois poli »
 *
 * La facette franche (chaque triangle d'une seule teinte) a laissé la place
 * au style des décors de la forge (`blender/`, `docs/FORGE_ASSETS.md`) :
 * des volumes doux, des arêtes **chanfreinées** qui accrochent la lumière,
 * des feuillages en nuage de gros lobes éclairés par le dessus. Les normales
 * de chaque forme voyagent avec ses sommets (`NORMALES`) : une sphère reste
 * ronde, un pavé garde ses faces planes et ses biseaux arrondis.
 */

import * as THREE from "three";

/** Suite pseudo-aléatoire reproductible — mulberry32. */
function suite(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _v = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Les normales de chaque tableau de sommets, tenues à côté de lui.
 *
 * Les appelants ne manipulent que `pos` et `col` ; les normales suivent sans
 * qu'ils aient à les porter. Un tableau rempli à la main (un sol, une nappe)
 * n'en a pas, ou pas autant que de sommets : `maillageFacette` retombe alors
 * sur des normales calculées, à facettes.
 */
const NORMALES = new WeakMap<number[], number[]>();

function normalesDe(pos: number[]): number[] {
  let n = NORMALES.get(pos);
  if (!n) {
    n = [];
    NORMALES.set(pos, n);
  }
  return n;
}

const _n = new THREE.Vector3();
const _mn = new THREE.Matrix3();

export interface Degrade {
  /** Couleur au pied (y ≤ y0) et au sommet (y ≥ y1). */
  bas: number;
  haut: number;
  y0: number;
  y1: number;
}

const _cb = new THREE.Color();
const _ch = new THREE.Color();

/**
 * Verse une géométrie transformée dans les tableaux de sommets et de couleurs
 * (et ses normales, dans `NORMALES`).
 *
 * La géométrie source est consommée en lecture seule ; l'appelant garde la
 * charge de la libérer. Les formes indexées sont déroulées. `degrade` teinte
 * chaque sommet selon sa hauteur (un feuillage plus sombre dessous).
 */
export function ajouterGeometrie(
  pos: number[],
  col: number[],
  geo: THREE.BufferGeometry,
  m: THREE.Matrix4,
  couleur: number,
  degrade?: Degrade,
): void {
  const plate = geo.index ? geo.toNonIndexed() : geo;
  const p = plate.getAttribute("position");
  let nAttr = plate.getAttribute("normal");
  if (!nAttr) {
    plate.computeVertexNormals();
    nAttr = plate.getAttribute("normal");
  }
  const nor = normalesDe(pos);
  // Un tableau déjà désaccordé (rempli à la main) ne reçoit plus de normales.
  const suivre = nor.length === pos.length;
  _mn.getNormalMatrix(m);
  _c.setHex(couleur);
  if (degrade) {
    _cb.setHex(degrade.bas);
    _ch.setHex(degrade.haut);
  }
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i).applyMatrix4(m);
    pos.push(_v.x, _v.y, _v.z);
    if (degrade) {
      const t = Math.min(1, Math.max(0, (_v.y - degrade.y0) / (degrade.y1 - degrade.y0)));
      col.push(_cb.r + (_ch.r - _cb.r) * t, _cb.g + (_ch.g - _cb.g) * t, _cb.b + (_ch.b - _cb.b) * t);
    } else {
      col.push(_c.r, _c.g, _c.b);
    }
    if (suivre) {
      _n.fromBufferAttribute(nAttr, i).applyMatrix3(_mn).normalize();
      nor.push(_n.x, _n.y, _n.z);
    }
  }
  if (plate !== geo) plate.dispose();
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _t = new THREE.Vector3();

/** Matrice de pose : translation, rotations, échelle. */
export function pose(
  x: number,
  y: number,
  z: number,
  rotY = 0,
  sx = 1,
  sy = sx,
  sz = sx,
  /**
   * Pente, autour de l'axe **X local** — celui du faîte.
   *
   * Première version : autour de Z. Un pan de toit dont le faîte court le long
   * de X ne se penche pas dans le plan XY ; incliné là, il sortait du bâtiment
   * en biais et ressemblait à une planche posée en équilibre. C'est ce qu'on
   * voyait au coin de chaque parcelle voisine.
   */
  pente = 0,
): THREE.Matrix4 {
  // « YXZ » : la rotation d'assiette s'applique **après** l'orientation du
  // bâtiment, donc dans son repère à lui.
  _e.set(pente, rotY, 0, "YXZ");
  return _m.compose(_t.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}

/* ------------------------------------------------------------------ */
/* Le pavé chanfreiné                                                  */
/* ------------------------------------------------------------------ */

/**
 * Un pavé aux arêtes chanfreinées : six faces, douze biseaux, huit coins —
 * quarante-quatre triangles, contre douze pour un pavé vif. Les biseaux
 * portent les normales des faces qu'ils joignent : à l'écran, l'arête est
 * arrondie et accroche la lumière. C'est ce qui sépare un objet modelé d'un
 * pavé de code.
 *
 * Le chanfrein est en unités du monde (pas un pourcentage) : un poteau et une
 * grange ont la même arête, comme deux pièces de bois taillées par le même
 * rabot. Mis en cache par dimensions : une clôture réutilise son poteau.
 */
const PAVES = new Map<string, THREE.BufferGeometry>();
const CHANFREIN = 0.045;

export function paveChanfreine(w: number, h: number, d: number, rayon = CHANFREIN): THREE.BufferGeometry {
  const r = Math.min(rayon, Math.min(w, h, d) * 0.28);
  const cle = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
  const deja = PAVES.get(cle);
  if (deja) return deja;
  const demi = [w / 2, h / 2, d / 2];
  const pos: number[] = [];
  const nor: number[] = [];
  /** Le sommet d'une face (axe `a`, signe `sa`) près du coin (signes `sg`). */
  const sommet = (a: number, sg: number[]): [number[], number[]] => {
    const p = [0, 0, 0];
    const n = [0, 0, 0];
    for (let k = 0; k < 3; k++) p[k] = k === a ? sg[k]! * demi[k]! : sg[k]! * (demi[k]! - r);
    n[a] = sg[a]!;
    return [p, n];
  };
  const tri = (a: [number[], number[]], b: [number[], number[]], c: [number[], number[]]) => {
    // Orienté vers l'extérieur : le centre du pavé est à l'origine.
    const e1 = [b[0][0]! - a[0][0]!, b[0][1]! - a[0][1]!, b[0][2]! - a[0][2]!];
    const e2 = [c[0][0]! - a[0][0]!, c[0][1]! - a[0][1]!, c[0][2]! - a[0][2]!];
    const nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
    const ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
    const nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
    const cx = a[0][0]! + b[0][0]! + c[0][0]!;
    const cy = a[0][1]! + b[0][1]! + c[0][1]!;
    const cz = a[0][2]! + b[0][2]! + c[0][2]!;
    const ordre = nx * cx + ny * cy + nz * cz >= 0 ? [a, b, c] : [a, c, b];
    for (const [p, n] of ordre) {
      pos.push(p[0]!, p[1]!, p[2]!);
      nor.push(n[0]!, n[1]!, n[2]!);
    }
  };
  const quad = (a: [number[], number[]], b: [number[], number[]], c: [number[], number[]], dd: [number[], number[]]) => {
    tri(a, b, c);
    tri(a, c, dd);
  };
  const S = [-1, 1];
  // Les six faces.
  for (let a = 0; a < 3; a++) {
    const [j, k] = [(a + 1) % 3, (a + 2) % 3];
    for (const sa of S) {
      const coin = (sj: number, sk: number) => {
        const sg = [0, 0, 0];
        sg[a] = sa;
        sg[j] = sj;
        sg[k] = sk;
        return sommet(a, sg);
      };
      quad(coin(-1, -1), coin(1, -1), coin(1, 1), coin(-1, 1));
    }
  }
  // Les douze biseaux : entre la face (a, sa) et la face (b, sb), le long de c.
  for (let a = 0; a < 3; a++) {
    const b = (a + 1) % 3;
    const c = (a + 2) % 3;
    for (const sa of S) {
      for (const sb of S) {
        const v = (axe: number, sc: number) => {
          const sg = [0, 0, 0];
          sg[a] = sa;
          sg[b] = sb;
          sg[c] = sc;
          return sommet(axe, sg);
        };
        quad(v(a, -1), v(a, 1), v(b, 1), v(b, -1));
      }
    }
  }
  // Les huit coins.
  for (const sx of S) {
    for (const sy of S) {
      for (const sz of S) {
        const sg = [sx, sy, sz];
        tri(sommet(0, sg), sommet(1, sg), sommet(2, sg));
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  // Des coordonnées de texture planes : `mergeGeometries` exige les mêmes
  // attributs que les primitives de Trois, qui en ont toutes.
  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i]! + pos[i + 2]!, pos[i + 1]!);
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if (PAVES.size > 2000) PAVES.clear();
  PAVES.set(cle, geo);
  return geo;
}

/** Verse un pavé posé sur son centre, arêtes chanfreinées. */
export function ajouterBoite(
  pos: number[],
  col: number[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  couleur: number,
  rotY = 0,
): void {
  ajouterGeometrie(pos, col, paveChanfreine(w, h, d), pose(x, y, z, rotY), couleur);
}

let _boiteVive: THREE.BoxGeometry | null = null;

/**
 * Un pavé à arêtes vives : pour ce qui se compte par milliers et ne se voit
 * que du dessus — les cases des champs voisins. Douze triangles au lieu de
 * quarante-quatre ; un damier de quarante parcelles tient ainsi son budget.
 */
export function ajouterBoiteVive(
  pos: number[],
  col: number[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  couleur: number,
): void {
  _boiteVive ??= new THREE.BoxGeometry(1, 1, 1);
  ajouterGeometrie(pos, col, _boiteVive, pose(x, y, z, 0, w, h, d), couleur);
}

/** Verse un pavé incliné autour de son axe long — un pan de toit. */
export function ajouterPan(
  pos: number[],
  col: number[],
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  couleur: number,
  rotY: number,
  pente: number,
): void {
  ajouterGeometrie(pos, col, paveChanfreine(w, h, d), pose(x, y, z, rotY, 1, 1, 1, pente), couleur);
}

/** Murs de grange et tuiles, dans la palette du jeu. */
const MURS = [0xf1eadb, 0xe8d9bc, 0xefe2c8];
/** Les toits de la palette de la forge : tuile, ardoise, bardeau, vert sauge. */
const TOITS = [0xc4583f, 0x5d6a78, 0xa8764a, 0x5e9a63];

/**
 * Une petite grange de voisin.
 *
 * Première version : deux pavés empilés, le second plus large que le premier.
 * Ça ne faisait pas un bâtiment, ça faisait une dalle posée en équilibre — et
 * c'est ce qu'on voyait dans le coin de chaque parcelle. Un toit se lit à sa
 * pente : deux pans inclinés en font plus qu'un aplat, pour deux volumes de
 * plus.
 */
export function ajouterGrange(
  pos: number[],
  col: number[],
  x: number,
  y: number,
  z: number,
  rotY: number,
  graine: number,
  /**
   * Emprise réelle, quand on la connaît.
   *
   * Sans elle, chaque ferme voisine avait la même grange tirée au sort, à la
   * même place inventée. Les ouvrages du cadastre ont une taille et une
   * position : un silo n'a pas la carrure d'un poulailler, et le donner à voir
   * est la moitié de ce qui distingue une exploitation d'une autre.
   */
  taille?: { l: number; prof: number; h: number },
): void {
  const rnd = suite(graine >>> 0);
  const mur = MURS[Math.floor(rnd() * MURS.length)]!;
  const toit = TOITS[Math.floor(rnd() * TOITS.length)]!;
  const l = taille ? taille.l : 1.9 + rnd() * 0.5;
  const prof = taille ? taille.prof : 1.3 + rnd() * 0.3;
  const h = taille ? taille.h : 0.74 + rnd() * 0.16;

  ajouterBoite(pos, col, x, y + h / 2, z, l, h, prof, mur, rotY);
  // Un soubassement plus sombre : la ligne d'ombre au pied du mur.
  ajouterBoite(pos, col, x, y + 0.06, z, l * 1.02, 0.12, prof * 1.02, eclaircir(mur, -0.28), rotY);

  /*
   * Deux pans qui se rejoignent sur le faîte.
   *
   * Le pan est posé depuis l'arête : son centre descend d'une demi-largeur le
   * long de la pente et s'écarte d'autant en profondeur. Calculé autrement —
   * décalage fixe, hauteur fixe — les deux pans ne se rejoignaient ni au
   * sommet ni aux murs.
   */
  const pente = 0.56;
  const pan = ((prof / 2) / Math.cos(pente)) * 1.16;
  const faite = y + h + 0.2;
  // L'axe de profondeur du bâtiment, une fois celui-ci tourné.
  const zx = Math.sin(rotY);
  const zz = Math.cos(rotY);
  for (const s of [-1, 1]) {
    const dz = ((s * pan) / 2) * Math.cos(pente);
    ajouterPan(
      pos, col,
      x + zx * dz,
      faite - (pan / 2) * Math.sin(pente),
      z + zz * dz,
      l * 1.14, 0.12, pan,
      toit, rotY, s * pente,
    );
  }
  // La porte, au pignon, dans son encadrement clair.
  const px = x + Math.cos(rotY) * (l / 2);
  const pz = z - Math.sin(rotY) * (l / 2);
  ajouterBoite(pos, col, px, y + h * 0.34, pz, 0.07, h * 0.62, prof * 0.34, eclaircir(toit, -0.2), rotY);
  ajouterBoite(pos, col, px, y + h * 0.67, pz, 0.09, 0.06, prof * 0.42, 0xcf9f68, rotY);

  // Le faîtage : une poutre sombre qui ferme les deux pans.
  ajouterBoite(pos, col, x, faite + 0.02, z, l * 1.16, 0.08, 0.14, eclaircir(toit, -0.3), rotY);

  /*
   * Deux fenêtres sur le long pan, chacune avec son cadre et sa jardinière :
   * une grange sans fenêtre se lisait comme un bloc. Posées un peu hors du
   * mur (jamais dans son plan : pas de scintillement).
   */
  for (const s of [-0.25, 0.25]) {
    for (const cote of [-1, 1]) {
      const lx = s * l;
      const lz = cote * (prof / 2 + 0.02);
      const wx = x + Math.cos(rotY) * lx + Math.sin(rotY) * lz;
      const wz = z - Math.sin(rotY) * lx + Math.cos(rotY) * lz;
      ajouterBoite(pos, col, wx, y + h * 0.58, wz, 0.3, 0.26, 0.04, 0xcf9f68, rotY);
      const wx2 = x + Math.cos(rotY) * lx + Math.sin(rotY) * (lz + cote * 0.015);
      const wz2 = z - Math.sin(rotY) * lx + Math.cos(rotY) * (lz + cote * 0.015);
      ajouterBoite(pos, col, wx2, y + h * 0.58, wz2, 0.2, 0.17, 0.03, 0x3d4a58, rotY);
      const jx = x + Math.cos(rotY) * lx + Math.sin(rotY) * (lz + cote * 0.05);
      const jz = z - Math.sin(rotY) * lx + Math.cos(rotY) * (lz + cote * 0.05);
      ajouterBoite(pos, col, jx, y + h * 0.4, jz, 0.34, 0.07, 0.09, 0x6fa343, rotY);
    }
  }
}

/** Robes : brun-noir de la vache, laine sale du mouton, rose du cochon. */
const ROBES: Record<string, { corps: number; tete: number }> = {
  COW: { corps: 0x6b4a35, tete: 0xf0ece2 },
  SHEEP: { corps: 0xe8e3d5, tete: 0x3b3733 },
  PIG: { corps: 0xd9a29a, tete: 0xc98d86 },
  HEN: { corps: 0xd8d2c6, tete: 0xc2452f },
};

/**
 * Une bête au pré, en volumes fusionnés.
 *
 * Rien à voir avec les modèles articulés du troupeau du joueur : ceux-là ont
 * des pattes qui se croisent et une tête qui broute, et chacun coûte un appel
 * de rendu. Il en faut ici sur toutes les parcelles d'élevage à la fois, y
 * compris celles du fond — une silhouette juste, fondue dans le maillage de la
 * campagne, dit « il y a des bêtes » pour le prix de sept pavés.
 *
 * Les parcelles proches, elles, reçoivent les vrais modèles : voir `voisin3d`.
 */
export function ajouterBete(
  pos: number[],
  col: number[],
  x: number,
  y: number,
  z: number,
  rotY: number,
  espece: string,
  taille = 1,
): void {
  const robe = ROBES[espece] ?? ROBES.COW!;
  const petite = espece === "HEN";
  const l = (petite ? 0.28 : 0.86) * taille;
  const larg = (petite ? 0.2 : 0.4) * taille;
  const h = (petite ? 0.22 : 0.42) * taille;
  const patte = (petite ? 0.12 : 0.34) * taille;
  const sol = y + patte;

  ajouterBoite(pos, col, x, sol + h / 2, z, l, h, larg, robe.corps, rotY);
  // La tête, avancée et un peu plus basse : c'est l'inclinaison qui fait
  // qu'une bête broute plutôt qu'elle ne pose.
  const av = Math.cos(rotY) * (l / 2);
  const avz = -Math.sin(rotY) * (l / 2);
  ajouterBoite(
    pos, col,
    x + av, sol + h * 0.42, z + avz,
    l * 0.34, h * 0.62, larg * 0.72, robe.tete, rotY,
  );
  if (petite) return;
  // Quatre pattes, en croix sous le corps.
  for (const dl of [-0.32, 0.32]) {
    for (const dt of [-0.28, 0.28]) {
      const px = x + Math.cos(rotY) * (l * dl) - Math.sin(rotY) * (larg * dt);
      const pz = z - Math.sin(rotY) * (l * dl) - Math.cos(rotY) * (larg * dt);
      ajouterBoite(pos, col, px, y + patte / 2, pz, 0.09 * taille, patte, 0.09 * taille, eclaircir(robe.corps, -0.3));
    }
  }
}

/**
 * Verse un lot de sommets déjà construits, en les transformant au passage.
 *
 * Sert à bâtir un objet composite — une parcelle entière, avec sa dalle, ses
 * cases, sa haie et sa grange — dans un repère local bien commode, puis à le
 * poser d'un bloc sur un sol qui, lui, n'est pas plat. Sans cela, chaque
 * parcelle restait un plateau horizontal sur un monde bombé : son bord aval
 * s'enfonçait, son bord amont décollait, et il en sortait une grande dalle de
 * terre en biais — visible de loin, et laide.
 */
export function verserTransforme(
  posDst: number[],
  colDst: number[],
  posSrc: number[],
  colSrc: number[],
  m: THREE.Matrix4,
): void {
  const norSrc = NORMALES.get(posSrc);
  const norDst = normalesDe(posDst);
  const suivre = !!norSrc && norSrc.length === posSrc.length && norDst.length === posDst.length;
  _mn.getNormalMatrix(m);
  for (let i = 0; i < posSrc.length; i += 3) {
    _v.set(posSrc[i]!, posSrc[i + 1]!, posSrc[i + 2]!).applyMatrix4(m);
    posDst.push(_v.x, _v.y, _v.z);
    if (suivre) {
      _n.set(norSrc[i]!, norSrc[i + 1]!, norSrc[i + 2]!).applyMatrix3(_mn).normalize();
      norDst.push(_n.x, _n.y, _n.z);
    }
  }
  for (const c of colSrc) colDst.push(c);
}

/**
 * Un maillage à couleurs de sommets — le rendu du décor.
 *
 * Lisse quand les normales ont suivi les sommets (voir `NORMALES`) : les
 * boules restent rondes, les biseaux arrondis. Un tableau rempli à la main
 * retombe sur des normales calculées, à facettes. Matière mate (Lambert) :
 * le style est celui du bois peint, pas du plastique.
 */
export function maillageFacette(
  pos: number[],
  col: number[],
  opts: { shadows?: boolean; recoit?: boolean; nom?: string } = {},
): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const nor = NORMALES.get(pos);
  const lisse = !!nor && nor.length === pos.length && pos.length > 0;
  if (lisse) geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  else geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: !lisse }),
  );
  mesh.castShadow = opts.shadows ?? false;
  mesh.receiveShadow = opts.recoit ?? opts.shadows ?? false;
  if (opts.nom) mesh.name = opts.nom;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Les arbres                                                          */
/* ------------------------------------------------------------------ */

/**
 * Les feuillages de chaque saison, repris des couleurs de la forge
 * (`palette.py`, `SAISONS`) : un arbre de la campagne roussit en même temps
 * que les buissons et les arbres modélisés dans Blender.
 */
export type SaisonArbre = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
const FEUILLAGES: Record<SaisonArbre, number[]> = {
  SPRING: [0x8ccc57, 0x9ad262, 0xa6d86c, 0x86c454, 0x94cf5c],
  SUMMER: [0x86bf4e, 0x7cb446, 0x94c957, 0x72ab42, 0x8fc454],
  // Pas tous roux à la fois : un chêne tient son vert plus longtemps.
  AUTUMN: [0xe0923a, 0xf0b34a, 0xd06a30, 0xe8a23f, 0x9aa845],
  // En dormance, pas enneigés : sur un pré qui reste vert, des houppiers
  // blancs passaient pour du coton.
  WINTER: [0x9aa68a, 0x8f9c80, 0xaab39a, 0x7f8c72, 0x94a086],
};
/** Les bruns d'écorce. */
const ECORCES = [0x6e4631, 0x7a5236, 0x64402c];

/**
 * Un arbre versé dans les tableaux — le feuillu « nuage » des références.
 *
 * Un tronc trapu évasé au pied, et un houppier de gros lobes ronds : un cœur
 * aplati, une couronne de lobes plus bas, deux ou trois au-dessus. Le
 * feuillage est plus sombre dessous, plus clair au sommet (le soleil vient
 * d'en haut) : c'est ce dégradé, plus que la forme, qui donne le volume.
 * Environ cinq cent cinquante triangles, lisses.
 */
export function ajouterArbre(
  pos: number[],
  col: number[],
  x: number,
  y: number,
  z: number,
  taille: number,
  graine: number,
  saison: SaisonArbre = "SUMMER",
): void {
  const rnd = suite(graine >>> 0);
  const ecorce = ECORCES[Math.floor(rnd() * ECORCES.length)]!;
  const hTronc = taille * (0.36 + rnd() * 0.08);
  const rTronc = taille * 0.07;
  const tronc = new THREE.CylinderGeometry(rTronc * 0.7, rTronc * 1.15, hTronc * 1.15, 7);
  ajouterGeometrie(pos, col, tronc, pose(x, y + (hTronc * 1.15) / 2, z, rnd() * Math.PI), ecorce);
  tronc.dispose();
  // Les racines qui plongent dans l'herbe.
  const racine = new THREE.ConeGeometry(rTronc * 0.55, rTronc * 2.2, 5);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + rnd();
    const m = new THREE.Matrix4().compose(
      _t.set(x + Math.cos(a) * rTronc * 0.9, y + rTronc * 0.35, z + Math.sin(a) * rTronc * 0.9),
      _q.setFromEuler(_e.set(Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9, "XYZ")),
      _s.set(1, 1, 1),
    );
    ajouterGeometrie(pos, col, racine, m, eclaircir(ecorce, -0.1));
  }
  racine.dispose();

  const feuilles = FEUILLAGES[saison] ?? FEUILLAGES.SUMMER;
  const base = feuilles[Math.floor(rnd() * feuilles.length)]!;
  const R = taille * (0.34 + rnd() * 0.06);
  const cy = y + hTronc + R * 0.55;
  const degrade: Degrade = {
    bas: eclaircir(base, -0.34),
    haut: eclaircir(base, 0.16),
    y0: cy - R * 0.7,
    y1: cy + R * 0.95,
  };
  const lobe = (dx: number, dy: number, dz: number, r: number) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    ajouterGeometrie(pos, col, g, pose(x + dx, cy + dy, z + dz, rnd() * Math.PI, 1, 0.86, 1), base, degrade);
    g.dispose();
  };
  lobe(0, 0, 0, R * 0.78);
  // Six lobes de quatre-vingts triangles : un bois de cent soixante-dix
  // arbres reste sous les cent mille triangles.
  const couronne = 4;
  for (let k = 0; k < couronne; k++) {
    const a = (k / couronne) * Math.PI * 2 + rnd() * 0.5;
    const d = R * (0.5 + rnd() * 0.12);
    lobe(Math.cos(a) * d, -R * 0.12 + rnd() * R * 0.12, Math.sin(a) * d, R * (0.42 + rnd() * 0.1));
  }
  const a = rnd() * Math.PI * 2;
  lobe(Math.cos(a) * R * 0.2, R * (0.36 + rnd() * 0.08), Math.sin(a) * R * 0.2, R * (0.5 + rnd() * 0.06));
}

/** Éclaircit (`k > 0`) ou assombrit (`k < 0`) une couleur empaquetée. */
export function eclaircir(couleur: number, k: number): number {
  const f = (d: number) => {
    const c = (couleur >> d) & 0xff;
    const v = k >= 0 ? c + (255 - c) * k : c * (1 + k);
    return Math.max(0, Math.min(255, Math.round(v))) << d;
  };
  return f(16) | f(8) | f(0);
}

/** Un arbre seul, prêt à poser dans la scène. */
export function makeArbre(taille: number, graine: number, shadows = false): THREE.Mesh {
  const pos: number[] = [];
  const col: number[] = [];
  ajouterArbre(pos, col, 0, 0, 0, taille, graine);
  const m = maillageFacette(pos, col, { shadows, nom: "arbre" });
  return m;
}

/* ------------------------------------------------------------------ */
/* Les voitures                                                        */
/* ------------------------------------------------------------------ */

/** Teintes de carrosserie de campagne : rien de criard. */
export const CARROSSERIES = [
  0xc9503a, 0x3f6fb5, 0xe6e2d6, 0x4f8a5e, 0xd9a53c, 0x6f7278, 0x8c5aa0,
];

/**
 * Une voiture, en un seul maillage.
 *
 * Le capot est plus bas que le pavillon, l'arrière plus court que l'avant, et
 * les roues dépassent des flancs. La première version — trois pavés empilés et
 * deux essieux traversants — se lisait comme une brique orange dès qu'on la
 * regardait de près : c'est le décrochement du capot qui fait la voiture.
 *
 * Elle roule vers **+Z**, comme les engins du jeu.
 */
export function makeVoiture(couleur: number, shadows = false): THREE.Group {
  const g = new THREE.Group();
  const pos: number[] = [];
  const col: number[] = [];
  const bas = eclaircir(couleur, -0.22);
  const vitre = 0x2f3d4a;
  const gomme = 0x1f2124;
  const chrome = 0xc9ccd2;

  // Le plancher, d'un pare-chocs à l'autre.
  ajouterBoite(pos, col, 0, 0.19, 0, 0.62, 0.16, 1.42, bas);
  // Le capot, bas et court.
  ajouterBoite(pos, col, 0, 0.31, 0.44, 0.58, 0.12, 0.52, couleur);
  // L'habitacle, plus haut, en retrait.
  ajouterBoite(pos, col, 0, 0.36, -0.16, 0.6, 0.22, 0.78, couleur);
  // Les vitres, en bandeau.
  ajouterBoite(pos, col, 0, 0.5, -0.12, 0.54, 0.17, 0.62, vitre);
  // Le coffre.
  ajouterBoite(pos, col, 0, 0.32, -0.6, 0.58, 0.14, 0.24, couleur);
  // Quatre roues qui dépassent, et non deux essieux traversants.
  for (const dz of [0.46, -0.42]) {
    for (const dx of [-0.32, 0.32]) {
      ajouterBoite(pos, col, dx, 0.13, dz, 0.09, 0.24, 0.26, gomme);
    }
  }
  // Deux feux à l'avant, deux à l'arrière.
  ajouterBoite(pos, col, -0.18, 0.31, 0.71, 0.14, 0.08, 0.04, 0xffe9a8);
  ajouterBoite(pos, col, 0.18, 0.31, 0.71, 0.14, 0.08, 0.04, 0xffe9a8);
  ajouterBoite(pos, col, -0.18, 0.33, -0.73, 0.13, 0.07, 0.04, 0xd2452f);
  ajouterBoite(pos, col, 0.18, 0.33, -0.73, 0.13, 0.07, 0.04, 0xd2452f);
  // Un filet de chrome, qui attrape la lumière et casse l'aplat.
  ajouterBoite(pos, col, 0, 0.27, 0, 0.64, 0.03, 1.3, chrome);

  const corps = maillageFacette(pos, col, { shadows, nom: "voiture-corps" });
  g.add(corps);
  g.name = "campagne-voiture";
  return g;
}

/* ------------------------------------------------------------------ */
/* La haie buissonnante                                                */
/* ------------------------------------------------------------------ */

/**
 * Une haie taillée en boules, le long de X, centrée, posée à `y = 0`.
 *
 * Un pavé vert, c'est un mur peint en vert. Une haie des références est une
 * suite de touffes rondes qui se chevauchent, plus sombre au pied, plus
 * claire au sommet. Un noyau chanfreiné bouche les jours entre les boules.
 * Géométrie à couleurs de sommets : la matière doit avoir `vertexColors`.
 */
export function geometrieHaie(
  longueur: number,
  hauteur: number,
  epaisseur: number,
  graine = 1,
  couleur = 0x6fa343,
): THREE.BufferGeometry {
  const rnd = suite(graine >>> 0);
  const pos: number[] = [];
  const col: number[] = [];
  const degrade: Degrade = {
    bas: eclaircir(couleur, -0.32),
    haut: eclaircir(couleur, 0.14),
    y0: 0,
    y1: hauteur * 1.05,
  };
  // Le noyau, un peu en retrait des boules.
  ajouterGeometrie(
    pos,
    col,
    paveChanfreine(Math.max(0.05, longueur - epaisseur * 0.4), hauteur * 0.72, epaisseur * 0.8, 0.06),
    pose(0, hauteur * 0.36, 0),
    couleur,
    degrade,
  );
  const r = Math.min(hauteur * 0.5, epaisseur * 0.75);
  const n = Math.max(1, Math.round(longueur / (r * 1.25)));
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = -longueur / 2 + r * 0.8 + t * Math.max(0, longueur - r * 1.6);
    const rr = r * (0.9 + rnd() * 0.22);
    ajouterGeometrie(
      pos,
      col,
      geo,
      pose(x, hauteur - rr * 0.95 + rnd() * 0.04, (rnd() - 0.5) * epaisseur * 0.15, rnd() * 3, rr, rr * 0.92, rr),
      couleur,
      degrade,
    );
  }
  geo.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(NORMALES.get(pos)!, 3));
  return out;
}
