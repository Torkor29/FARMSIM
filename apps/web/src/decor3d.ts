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
 * cohérente avec le reste. Ceux-ci sont taillés dans la même facette franche
 * que les bâtiments et les engins.
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
 * Verse une géométrie transformée dans les tableaux de sommets et de couleurs.
 *
 * La géométrie source est consommée en lecture seule ; l'appelant garde la
 * charge de la libérer. Les formes indexées sont déroulées, sans quoi les
 * sommets partagés lisseraient les arêtes — or c'est la facette franche qui
 * fait le style du jeu.
 */
export function ajouterGeometrie(
  pos: number[],
  col: number[],
  geo: THREE.BufferGeometry,
  m: THREE.Matrix4,
  couleur: number,
): void {
  const plate = geo.index ? geo.toNonIndexed() : geo;
  const p = plate.getAttribute("position");
  _c.setHex(couleur);
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i).applyMatrix4(m);
    pos.push(_v.x, _v.y, _v.z);
    col.push(_c.r, _c.g, _c.b);
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

let _boite: THREE.BoxGeometry | null = null;
/** Un pavé unité, partagé — on ne le libère jamais, il ne coûte rien. */
function boiteUnite(): THREE.BoxGeometry {
  _boite ??= new THREE.BoxGeometry(1, 1, 1);
  return _boite;
}

/** Verse un pavé posé sur son centre. */
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
  ajouterGeometrie(pos, col, boiteUnite(), pose(x, y, z, rotY, w, h, d), couleur);
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
  ajouterGeometrie(pos, col, boiteUnite(), pose(x, y, z, rotY, w, h, d, pente), couleur);
}

/** Murs de grange et tuiles, dans la palette du jeu. */
const MURS = [0xd8c5a4, 0xcbb392, 0xe0d2b6];
const TOITS = [0x7d4a37, 0x3f5c46, 0x8b5a3c, 0x4a5f52];

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
  // La porte, au pignon.
  ajouterBoite(
    pos, col,
    x + Math.cos(rotY) * (l / 2), y + h * 0.34, z - Math.sin(rotY) * (l / 2),
    0.07, h * 0.62, prof * 0.34, eclaircir(toit, -0.2), rotY,
  );
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
  for (let i = 0; i < posSrc.length; i += 3) {
    _v.set(posSrc[i]!, posSrc[i + 1]!, posSrc[i + 2]!).applyMatrix4(m);
    posDst.push(_v.x, _v.y, _v.z);
  }
  for (const c of colSrc) colDst.push(c);
}

/** Un maillage plat à couleurs de sommets — le rendu du jeu. */
export function maillageFacette(
  pos: number[],
  col: number[],
  opts: { shadows?: boolean; recoit?: boolean; nom?: string } = {},
): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  mesh.castShadow = opts.shadows ?? false;
  mesh.receiveShadow = opts.recoit ?? opts.shadows ?? false;
  if (opts.nom) mesh.name = opts.nom;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Les arbres                                                          */
/* ------------------------------------------------------------------ */

/** Les verts du feuillage, du plus clair au plus sombre. */
const FEUILLES = [0x8cc36b, 0x74b25c, 0x5f9c4d, 0x9ccd74, 0x69a852];
/** Les bruns d'écorce. */
const ECORCES = [0x7a5230, 0x6b4726, 0x84603a];

/**
 * Un arbre versé dans les tableaux.
 *
 * Un tronc légèrement conique, trois touffes d'icosaèdre décalées et
 * aplaties, une pointe. Les touffes sont écrasées en hauteur : un feuillage
 * sphérique fait un sucre d'orge, un feuillage large fait un arbre.
 */
export function ajouterArbre(
  pos: number[],
  col: number[],
  x: number,
  y: number,
  z: number,
  taille: number,
  graine: number,
): void {
  const rnd = suite(graine >>> 0);
  const ecorce = ECORCES[Math.floor(rnd() * ECORCES.length)]!;
  const hTronc = taille * (0.34 + rnd() * 0.1);
  const rTronc = taille * 0.052;
  const tronc = new THREE.CylinderGeometry(rTronc * 0.78, rTronc * 1.25, hTronc, 5);
  ajouterGeometrie(pos, col, tronc, pose(x, y + hTronc / 2, z, rnd() * Math.PI), ecorce);
  tronc.dispose();

  const base = FEUILLES[Math.floor(rnd() * FEUILLES.length)]!;
  const touffes = 3;
  for (let i = 0; i < touffes; i++) {
    const t = i / (touffes - 1);
    const r = taille * (0.3 - t * 0.14) * (0.85 + rnd() * 0.3);
    const hy = y + hTronc + taille * (0.1 + t * 0.34);
    const geo = new THREE.IcosahedronGeometry(r, 0);
    // Chaque touffe légèrement décalée : un empilement parfaitement centré
    // fait un cyprès de maquette.
    const dx = (rnd() - 0.5) * taille * 0.12;
    const dz = (rnd() - 0.5) * taille * 0.12;
    // Plus sombre en dessous, plus clair au sommet : le soleil vient d'en haut.
    const teinte = i === touffes - 1 ? eclaircir(base, 0.14) : i === 0 ? eclaircir(base, -0.1) : base;
    ajouterGeometrie(
      pos,
      col,
      geo,
      pose(x + dx, hy, z + dz, rnd() * Math.PI, 1.15, 0.82, 1.15),
      teinte,
    );
    geo.dispose();
  }
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
