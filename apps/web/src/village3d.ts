/**
 * Le village et ses enseignes : ce qu'il y a autour des champs.
 *
 * Trois lieux servent — la coopérative où l'on vend, la concession où l'on
 * achète ses engins, la mairie où l'on achète ses terres — et trois autres
 * habitent le paysage : un étang, un verger, un rucher.
 *
 * Les bâtiments sont dessinés pour leur rôle, et non repris de la ferme : une
 * première version posait deux silos et un hangar de ferme sous une pancarte
 * « COOPÉRATIVE », et l'on ne voyait qu'une ferme de plus. Une mairie a une
 * façade, des étages et un campanile ; une concession, une vitrine et son
 * bandeau ; une coopérative, son élévateur à grain. Même facture que le reste
 * du jeu : des volumes francs, à facettes, dans sa palette.
 *
 * La façade principale regarde vers les `z` positifs, la façade latérale vers
 * les `x` positifs : ce sont les deux faces que la vue isométrique montre.
 */

import * as THREE from "three";
import { createMachineRig, type MachineRig } from "./machines3d";
import { ajouterArbre, ajouterBoite, ajouterGeometrie, maillageFacette, pose } from "./decor3d";
import { COTE_LIEU, type GenreLieu, type Lieu } from "./countryside-plan";

/** Le bois des clôtures et des piquets, celui de la cour. */
export const BOIS = 0x7a5534;
const BOIS_CLAIR = 0x9c7650;

/** Ce qu'il faut jeter avec la campagne. */
export type Jetables = {
  geometries: THREE.BufferGeometry[];
  materiaux: THREE.Material[];
  textures: THREE.Texture[];
};

/* ------------------------------------------------------------------ */
/* Les formes de base                                                  */
/* ------------------------------------------------------------------ */

let _prisme: THREE.BufferGeometry | null = null;
/**
 * Un prisme triangulaire unité : le volume sous un toit à deux pans.
 *
 * `x` de −½ à ½ (le faîte court le long des `x`), base de −½ à ½ en `z` à
 * `y = 0`, arête à `y = 1`. Les faces sont écrites dans le sens qui les fait
 * regarder vers l'extérieur — un ordre inversé les montre de dos.
 */
function prismeUnite(): THREE.BufferGeometry {
  if (_prisme) return _prisme;
  const A = [-0.5, 0, 0.5];
  const B = [0.5, 0, 0.5];
  const C = [0.5, 1, 0];
  const D = [-0.5, 1, 0];
  const E = [-0.5, 0, -0.5];
  const F = [0.5, 0, -0.5];
  const tri = [
    // Pignons.
    [0.5, 0, -0.5], [0.5, 1, 0], [0.5, 0, 0.5],
    [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0],
    // Versant des z positifs.
    A, B, C, A, C, D,
    // Versant des z négatifs.
    E, D, C, E, C, F,
  ].flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(tri, 3));
  _prisme = g;
  return g;
}

const _formes = new Map<string, THREE.BufferGeometry>();
function forme(cle: string, fabrique: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = _formes.get(cle);
  if (!g) {
    g = fabrique();
    _formes.set(cle, g);
  }
  return g;
}
const cylindre = (cotes = 12) => forme(`cyl${cotes}`, () => new THREE.CylinderGeometry(0.5, 0.5, 1, cotes));
const cone = (cotes = 12) => forme(`cone${cotes}`, () => new THREE.ConeGeometry(0.5, 1, cotes));

type Tableaux = { pos: number[]; col: number[] };

/** Un toit à deux pans : les pignons pleins, et des pans qui débordent. */
function toit(
  t: Tableaux,
  x: number,
  y: number,
  z: number,
  longueur: number,
  profondeur: number,
  hauteur: number,
  couleurToit: number,
  couleurPignon: number,
  rotY = 0,
): void {
  ajouterGeometrie(t.pos, t.col, prismeUnite(), pose(x, y, z, rotY, longueur, hauteur, profondeur), couleurPignon);
  // Les pans, un peu plus larges que les murs : le débord fait le toit.
  ajouterGeometrie(
    t.pos, t.col, prismeUnite(),
    pose(x, y + 0.06, z, rotY, longueur + 0.3, hauteur + 0.08, profondeur + 0.34),
    couleurToit,
  );
}

/** Une fenêtre sur une façade : l'encadrement clair, la vitre, les volets. */
function fenetre(
  t: Tableaux,
  x: number,
  y: number,
  z: number,
  face: "z" | "x",
  o: { l?: number; h?: number; volets?: number | null } = {},
): void {
  const l = o.l ?? 0.4;
  const h = o.h ?? 0.58;
  const [w, d] = face === "z" ? [l, 0.04] : [0.04, l];
  ajouterBoite(t.pos, t.col, x, y, z, w + (face === "z" ? 0.1 : 0), h + 0.1, d + (face === "x" ? 0.1 : 0), 0xf6f1e4);
  const [ox, oz] = face === "z" ? [0, 0.025] : [0.025, 0];
  ajouterBoite(t.pos, t.col, x + ox, y, z + oz, w, h, d, 0x4d6f8c);
  if (o.volets != null) {
    for (const s of [-1, 1]) {
      const [vx, vz] = face === "z" ? [s * (l / 2 + 0.13), 0.02] : [0.02, s * (l / 2 + 0.13)];
      const [vw, vd] = face === "z" ? [0.2, 0.04] : [0.04, 0.2];
      ajouterBoite(t.pos, t.col, x + vx, y, z + vz, vw, h, vd, o.volets);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Les enseignes                                                       */
/* ------------------------------------------------------------------ */

type Plaque = { texte: string; fond: string; encre: string; bord: string; sous?: string };

/**
 * Une plaque peinte : coins arrondis, double filet, lettres dans la police du
 * jeu. Une texture de canevas, lisible de loin pour un seul quad. Sans
 * canevas (les tests), `null` : l'appelant pose un aplat.
 */
function texturePlaque(p: Plaque, largeur = 512, hauteur = 208): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext?.("2d");
  if (!ctx) return null;
  const r = 34;
  const arrondi = (x: number, y: number, w: number, h: number, rr: number) => {
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };
  ctx.clearRect(0, 0, largeur, hauteur);
  arrondi(4, 4, largeur - 8, hauteur - 8, r);
  ctx.fillStyle = p.bord;
  ctx.fill();
  arrondi(16, 16, largeur - 32, hauteur - 32, r - 10);
  const degrade = ctx.createLinearGradient(0, 16, 0, hauteur - 16);
  degrade.addColorStop(0, p.fond);
  degrade.addColorStop(1, "#e9d9b3");
  ctx.fillStyle = degrade;
  ctx.fill();
  // Le filet intérieur, comme sur une plaque émaillée.
  arrondi(28, 28, largeur - 56, hauteur - 56, r - 18);
  ctx.strokeStyle = p.bord;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.encre;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const haut = p.sous ? hauteur / 2 - 16 : hauteur / 2 + 4;
  let taille = 108;
  do {
    ctx.font = `800 ${taille}px "Baloo 2", Signika, system-ui, sans-serif`;
    taille -= 4;
  } while (ctx.measureText(p.texte).width > largeur - 96 && taille > 36);
  ctx.fillText(p.texte, largeur / 2, haut);
  if (p.sous) {
    ctx.font = `700 34px "Baloo 2", Signika, system-ui, sans-serif`;
    ctx.globalAlpha = 0.8;
    ctx.fillText(p.sous, largeur / 2, hauteur / 2 + 50);
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Une plaque posée à plat sur une façade (ou sur le panneau d'une pancarte). */
function plaque(
  j: Jetables,
  p: Plaque,
  largeur: number,
  hauteur: number,
  couleurRepli: number,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(largeur, hauteur);
  j.geometries.push(geo);
  const texture = texturePlaque(p);
  let mat: THREE.Material;
  if (texture) {
    j.textures.push(texture);
    mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  } else {
    mat = new THREE.MeshLambertMaterial({ color: couleurRepli, side: THREE.DoubleSide });
  }
  j.materiaux.push(mat);
  return new THREE.Mesh(geo, mat);
}

/**
 * La pancarte « À VENDRE » : une potence et sa plaque suspendue.
 *
 * La première était un grand panneau carré sur deux piquets : lisible, mais
 * lourde, « un peu grande ». Celle-ci est une pancarte d'agence : un poteau,
 * une potence, deux chaînettes, et une plaque émaillée qui se balance à peine.
 * Elle regarde la caméra (un huitième de tour).
 */
export function creerPancarteVente(j: Jetables, o: { shadows?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  g.name = "pancarte-vente";
  const t: Tableaux = { pos: [], col: [] };
  const H = 2.1;
  const L = 1.9;
  // Le poteau, sa potence et son jambage.
  ajouterBoite(t.pos, t.col, -L / 2 - 0.1, H / 2, 0, 0.14, H, 0.14, BOIS);
  ajouterBoite(t.pos, t.col, 0, H - 0.05, 0, L + 0.35, 0.11, 0.11, BOIS);
  ajouterBoite(t.pos, t.col, -L / 2 + 0.14, H - 0.3, 0, 0.42, 0.08, 0.08, BOIS_CLAIR, 0);
  // Le pied, dans l'herbe.
  ajouterBoite(t.pos, t.col, -L / 2 - 0.1, 0.05, 0, 0.36, 0.1, 0.36, 0x6f5a3a);
  // Deux chaînettes.
  for (const s of [-1, 1]) ajouterBoite(t.pos, t.col, s * (L / 2 - 0.25), H - 0.22, 0, 0.04, 0.26, 0.04, 0x5b5b5b);
  const socle = maillageFacette(t.pos, t.col, { shadows: o.shadows, nom: "pancarte-bois" });
  j.geometries.push(socle.geometry);
  j.materiaux.push(socle.material as THREE.Material);
  g.add(socle);
  const face = plaque(
    j,
    { texte: "À VENDRE", fond: "#fbf3de", encre: "#b3431f", bord: "#b3431f" },
    L,
    L * (208 / 512),
    0xf4e7c5,
  );
  face.position.set(0, H - 0.36 - (L * 208) / 512 / 2, 0);
  face.name = "pancarte-plaque";
  g.add(face);
  g.rotation.y = Math.PI / 4;
  return g;
}

/* ------------------------------------------------------------------ */
/* Les lieux                                                           */
/* ------------------------------------------------------------------ */

/** Un lieu monté : son groupe, et les engins à animer ou jeter. */
export type LieuMonte = {
  group: THREE.Group;
  engins: MachineRig[];
};

/** Les lieux où l'on peut aller : un clic les ouvre. */
export function lieuUtile(genre: GenreLieu): boolean {
  return genre === "COOPERATIVE" || genre === "CONCESSION" || genre === "MAIRIE";
}

/** Le pavé d'une place de village : dalles claires, bordure, bas-côtés. */
function place(t: Tableaux, cote: number): void {
  ajouterBoite(t.pos, t.col, 0, 0.01, 0, cote + 0.4, 0.04, cote + 0.4, 0x9cbf68);
  ajouterBoite(t.pos, t.col, 0, 0.025, 0, cote, 0.05, cote, 0xb7ab93);
  ajouterBoite(t.pos, t.col, 0, 0.04, 0, cote - 0.3, 0.05, cote - 0.3, 0xddd2bb);
}

/**
 * La mairie : deux niveaux, un avant-corps à fronton, un toit d'ardoise et
 * son campanile à horloge. C'est le bâtiment du bourg : elle est plus haute
 * et plus large que tout ce qu'il y a autour.
 */
function mairie(t: Tableaux, g: THREE.Group, j: Jetables): void {
  const L = 5.4;
  const P = 3.1;
  const zc = -0.9;
  const PIERRE = 0xefe4ca;
  const SOCLE = 0xb9ad96;
  const ARDOISE = 0x566579;
  const CORNICHE = 0xd8c7a1;
  // Le socle, puis les deux niveaux.
  ajouterBoite(t.pos, t.col, 0, 0.2, zc, L + 0.2, 0.36, P + 0.2, SOCLE);
  ajouterBoite(t.pos, t.col, 0, 0.38 + 1.25, zc, L, 2.5, P, PIERRE);
  // Le bandeau entre les étages, et la corniche.
  ajouterBoite(t.pos, t.col, 0, 1.6, zc, L + 0.06, 0.1, P + 0.06, CORNICHE);
  ajouterBoite(t.pos, t.col, 0, 2.92, zc, L + 0.2, 0.14, P + 0.2, CORNICHE);
  // Les chaînes d'angle : la pierre plus claire aux coins.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      ajouterBoite(t.pos, t.col, sx * (L / 2), 1.63, zc + sz * (P / 2), 0.22, 2.5, 0.22, 0xf7efdc);
    }
  }
  // Le toit d'ardoise, faîte le long de la façade.
  toit(t, 0, 2.99, zc, L, P, 1.1, ARDOISE, 0xe9dcbf);
  // L'avant-corps : il avance, il monte, et porte le fronton.
  const avX = 1.7;
  const zAv = zc + P / 2 + 0.2;
  ajouterBoite(t.pos, t.col, 0, 0.38 + 1.4, zAv - 0.2, avX, 2.8, 0.5, PIERRE);
  ajouterBoite(t.pos, t.col, 0, 3.24, zAv - 0.2, avX + 0.14, 0.12, 0.62, CORNICHE);
  toit(t, 0, 3.3, zAv - 0.2, 0.62, avX + 0.1, 0.62, ARDOISE, 0xf2e9d3, Math.PI / 2);
  // La porte à deux battants, et le perron.
  ajouterBoite(t.pos, t.col, 0, 0.95, zAv + 0.06, 0.8, 1.14, 0.06, 0x5f3f27);
  ajouterBoite(t.pos, t.col, 0, 1.56, zAv + 0.06, 0.9, 0.1, 0.07, 0xf6f1e4);
  for (let m = 0; m < 3; m++) {
    ajouterBoite(t.pos, t.col, 0, 0.07 + m * 0.11, zAv + 0.5 - m * 0.18, 1.5 - m * 0.2, 0.12, 0.5, 0xcfc4ad);
  }
  // Les fenêtres, à volets bleus : deux niveaux sur la façade, un sur le flanc.
  const VOLETS = 0x6f93a8;
  for (const x of [-2.1, -1.35, 1.35, 2.1]) {
    fenetre(t, x, 0.98, zc + P / 2 + 0.02, "z", { volets: VOLETS });
    fenetre(t, x, 2.2, zc + P / 2 + 0.02, "z", { volets: VOLETS });
  }
  fenetre(t, 0, 2.3, zAv + 0.06, "z", { l: 0.5, volets: null });
  for (const z of [zc - 0.7, zc + 0.7]) {
    fenetre(t, L / 2 + 0.02, 0.98, z, "x", { volets: VOLETS });
    fenetre(t, L / 2 + 0.02, 2.2, z, "x", { volets: VOLETS });
  }
  // Le campanile et son horloge, au faîte.
  ajouterBoite(t.pos, t.col, 0, 4.35, zc, 0.8, 0.9, 0.8, PIERRE);
  ajouterGeometrie(t.pos, t.col, cylindre(16), pose(0, 4.4, zc + 0.41, 0, 0.56, 0.56, 0.56, Math.PI / 2), 0xfbf8ee);
  ajouterBoite(t.pos, t.col, 0.08, 4.44, zc + 0.44, 0.2, 0.05, 0.02, 0x2b2b2b);
  ajouterBoite(t.pos, t.col, 0, 4.5, zc + 0.44, 0.04, 0.2, 0.02, 0x2b2b2b);
  ajouterGeometrie(t.pos, t.col, cone(4), pose(0, 5.1, zc, Math.PI / 4, 1.2, 0.7, 1.2), ARDOISE);
  ajouterBoite(t.pos, t.col, 0, 5.55, zc, 0.04, 0.3, 0.04, 0xc9a13b);
  // Les drapeaux au-dessus de la porte.
  for (const [s, couleurs] of [
    [-1, [0x23407a, 0xf5f5f5, 0xc8323c]],
    [1, [0x2f4fa3, 0x2f4fa3, 0x2f4fa3]],
  ] as const) {
    ajouterBoite(t.pos, t.col, s * 0.55, 2.0, zAv + 0.25, 0.04, 0.04, 0.6, 0xdedede);
    couleurs.forEach((c, i) => {
      ajouterBoite(t.pos, t.col, s * 0.55, 1.78, zAv + 0.2 + i * 0.13, 0.02, 0.36, 0.13, c);
    });
  }
  // Le parvis : deux massifs fleuris, deux tilleuls, un banc.
  for (const s of [-1, 1]) {
    ajouterBoite(t.pos, t.col, s * 2.1, 0.12, 1.55, 1.4, 0.18, 0.6, 0x7c5b3b);
    for (let f = 0; f < 6; f++) {
      ajouterBoite(t.pos, t.col, s * 2.1 - 0.55 + f * 0.22, 0.26, 1.55, 0.16, 0.12, 0.34, [0xd94c5a, 0xf2c542, 0xf4f0f5][f % 3]!);
    }
    ajouterArbre(t.pos, t.col, s * 3.0, 0, 2.9, 1.0, s > 0 ? 41 : 42);
  }
  ajouterBoite(t.pos, t.col, 1.2, 0.22, 2.7, 1.1, 0.08, 0.34, BOIS_CLAIR);
  ajouterBoite(t.pos, t.col, 1.2, 0.42, 2.55, 1.1, 0.3, 0.06, BOIS_CLAIR);
  // L'inscription, sous le fronton.
  const inscription = plaque(
    j,
    { texte: "MAIRIE", fond: "#fbf5e6", encre: "#23407a", bord: "#23407a" },
    1.66,
    1.66 * (208 / 512),
    0xf4e7c5,
  );
  inscription.position.set(0, 2.9, zAv + 0.07);
  g.add(inscription);
}

/**
 * La concession : un hall à vitrine, son bandeau aux couleurs de la marque,
 * l'atelier derrière, et les engins neufs sur leurs podiums.
 */
function concession(t: Tableaux, g: THREE.Group, j: Jetables, shadows: boolean, engins: MachineRig[]): void {
  const L = 4.6;
  const P = 3.0;
  const xc = -0.5;
  const zc = -1.1;
  const H = 2.0;
  const MUR = 0xe6e8ea;
  const MARQUE = 0x2f7d4a;
  const JAUNE = 0xf2c230;
  const VITRE = 0x9fd0e3;
  // L'atelier, plus haut, derrière le hall.
  ajouterBoite(t.pos, t.col, xc - 1.2, 1.25, zc - 0.9, 2.4, 2.5, 1.6, 0xc9ccd0);
  ajouterBoite(t.pos, t.col, xc - 1.2 + 1.21, 0.85, zc - 0.9, 0.04, 1.5, 1.1, 0x8d949b);
  for (let r = 0; r < 6; r++) {
    ajouterBoite(t.pos, t.col, xc + 0.03, 0.2 + r * 0.25, zc - 0.9, 0.02, 0.03, 1.1, 0x737a80);
  }
  // Le hall : un socle, des montants, la vitrine d'angle.
  ajouterBoite(t.pos, t.col, xc, 0.08, zc, L, 0.16, P, 0x9aa1a7);
  ajouterBoite(t.pos, t.col, xc, 0.16 + H / 2, zc, L - 0.1, H, P - 0.1, VITRE);
  for (let k = 0; k <= 5; k++) {
    ajouterBoite(t.pos, t.col, xc - L / 2 + k * (L / 5), 0.16 + H / 2, zc + P / 2, 0.08, H, 0.08, MUR);
  }
  for (let k = 0; k <= 3; k++) {
    ajouterBoite(t.pos, t.col, xc + L / 2, 0.16 + H / 2, zc - P / 2 + k * (P / 3), 0.08, H, 0.08, MUR);
  }
  // Le toit plat, et le bandeau de la marque, avec son liseré jaune.
  ajouterBoite(t.pos, t.col, xc, 0.16 + H + 0.06, zc, L + 0.2, 0.12, P + 0.2, MUR);
  ajouterBoite(t.pos, t.col, xc, 0.16 + H + 0.38, zc, L + 0.24, 0.52, P + 0.24, MARQUE);
  ajouterBoite(t.pos, t.col, xc, 0.16 + H + 0.1, zc, L + 0.26, 0.08, P + 0.26, JAUNE);
  // Les podiums devant la vitrine.
  const podiums: [number, number][] = [
    [2.3, 0.9],
    [0.3, 2.3],
  ];
  for (const [x, z] of podiums) {
    ajouterGeometrie(t.pos, t.col, cylindre(20), pose(x, 0.08, z, 0, 1.9, 0.12, 1.9), 0x5e656b);
    ajouterGeometrie(t.pos, t.col, cylindre(20), pose(x, 0.15, z, 0, 1.7, 0.04, 1.7), 0xd9dcde);
  }
  podiums.forEach(([x, z], k) => {
    const rig = createMachineRig("TRACTOR", { shadows, tier: k === 0 ? 4 : 3, seed: 7 + k });
    rig.group.scale.setScalar(1.05);
    rig.group.position.set(x, 0.18, z);
    rig.group.rotation.y = k === 0 ? -Math.PI / 5 : Math.PI / 3;
    g.add(rig.group);
    engins.push(rig);
  });
  // Les fanions, au bord de la place.
  for (let i = 0; i < 4; i++) {
    const x = 3.1;
    const z = -2.6 + i * 1.2;
    ajouterBoite(t.pos, t.col, x, 1.2, z, 0.06, 2.4, 0.06, 0xdedede);
    ajouterBoite(t.pos, t.col, x, 2.05, z + 0.2, 0.03, 0.62, 0.36, [MARQUE, JAUNE, MARQUE, JAUNE][i]!);
  }
  const enseigne = plaque(
    j,
    { texte: "CONCESSION", fond: "#fbf5e6", encre: "#2f7d4a", bord: "#2f7d4a", sous: "Engins neufs & occasions" },
    2.6,
    2.6 * (208 / 512),
    0xf4e7c5,
  );
  // L'enseigne sur le toit, sur deux montants : le bandeau est trop étroit.
  const yEns = 0.16 + H + 0.64 + (2.6 * (208 / 512)) / 2;
  enseigne.position.set(xc, yEns, zc + P / 2 - 0.3);
  // Tournée vers la caméra : posée d'équerre sur le toit, la vue isométrique
  // la montrait de biais et l'on ne la lisait plus.
  enseigne.rotation.y = Math.PI / 4;
  g.add(enseigne);
  for (const s of [-1, 1]) {
    ajouterBoite(t.pos, t.col, xc + s * 1.0, yEns - 0.3, zc + P / 2 - 0.36, 0.08, 1.0, 0.08, 0x5e656b);
  }
}

/**
 * La coopérative : l'élévateur à grain qui domine le bourg, trois cellules,
 * le hangar de réception et le pont-bascule devant.
 */
function cooperative(t: Tableaux, g: THREE.Group, j: Jetables): void {
  const TOLE = 0xc9ced2;
  const TOLE_SOMBRE = 0x9aa3a8;
  const ROUGE = 0xa8432f;
  // Les trois cellules, en arc derrière l'élévateur.
  const cellules: [number, number][] = [
    [-2.4, -1.4],
    [-1.3, -2.5],
    [0.1, -2.7],
  ];
  for (const [x, z] of cellules) {
    ajouterGeometrie(t.pos, t.col, cylindre(14), pose(x, 1.55, z, 0, 1.2, 3.1, 1.2), TOLE);
    for (const y of [0.8, 1.6, 2.4]) {
      ajouterGeometrie(t.pos, t.col, cylindre(14), pose(x, y, z, 0, 1.24, 0.05, 1.24), TOLE_SOMBRE);
    }
    ajouterGeometrie(t.pos, t.col, cone(14), pose(x, 3.35, z, 0, 1.3, 0.5, 1.3), TOLE_SOMBRE);
  }
  // L'élévateur : une tour, sa tête, et les goulottes vers chaque cellule.
  const ex = -0.9;
  const ez = -0.9;
  ajouterBoite(t.pos, t.col, ex, 2.3, ez, 0.9, 4.6, 0.9, 0xd9d2c3);
  ajouterBoite(t.pos, t.col, ex, 4.85, ez, 1.3, 0.7, 1.3, ROUGE);
  toit(t, ex, 5.2, ez, 1.3, 1.3, 0.45, 0x6d6d6d, ROUGE);
  for (const [x, z] of cellules) {
    const dx = x - ex;
    const dz = z - ez;
    const l = Math.hypot(dx, dz);
    ajouterBoite(t.pos, t.col, (x + ex) / 2, 4.05, (z + ez) / 2, 0.12, 0.12, l, 0x8d949b, Math.atan2(dx, dz));
  }
  // Le hangar de réception, toit vert, grand ouvert sur la place.
  const hx = 1.6;
  const hz = -0.5;
  ajouterBoite(t.pos, t.col, hx, 0.9, hz, 2.4, 1.8, 2.8, 0xe3d4b3);
  ajouterBoite(t.pos, t.col, hx, 0.5, hz + 1.41, 1.6, 1.0, 0.04, 0x4a3a2a);
  toit(t, hx, 1.8, hz, 2.8, 2.4, 0.9, 0x3f6e4a, 0xe3d4b3, Math.PI / 2);
  // Le pont-bascule, et un tas de grain qui attend.
  ajouterBoite(t.pos, t.col, 0.9, 0.06, 2.1, 2.6, 0.06, 1.1, 0x5e656b);
  ajouterBoite(t.pos, t.col, 0.9, 0.1, 2.1, 2.4, 0.03, 0.9, 0x7e868c);
  ajouterGeometrie(t.pos, t.col, cone(10), pose(-2.5, 0.35, 0.7, 0, 1.3, 0.7, 1.3), 0xe0c26a);
  // Des sacs devant le hangar.
  for (let i = 0; i < 6; i++) {
    ajouterBoite(t.pos, t.col, 0.9 + (i % 3) * 0.5, 0.2 + Math.floor(i / 3) * 0.3, 1.0, 0.46, 0.28, 0.36, 0xe8d6a6);
  }
  // Le totem à l'entrée de la place, tourné vers la caméra.
  const enseigne = plaque(
    j,
    { texte: "COOPÉRATIVE", fond: "#fbf5e6", encre: "#2f5d3a", bord: "#2f5d3a", sous: "Collecte · Vente des récoltes" },
    2.4,
    2.4 * (208 / 512),
    0xf4e7c5,
  );
  const tx = -2.3;
  const tz = 2.6;
  ajouterBoite(t.pos, t.col, tx, 0.2, tz, 0.9, 0.4, 0.9, 0xb7ab93);
  ajouterBoite(t.pos, t.col, tx, 0.95, tz, 0.16, 1.2, 0.16, 0x5e656b);
  enseigne.position.set(tx, 1.95, tz);
  enseigne.rotation.y = Math.PI / 4;
  g.add(enseigne);
}

/**
 * Un lieu du village, posé sur son emprise. `y` est le sol de la campagne.
 */
export function creerLieu(
  lieu: Lieu,
  o: { pasCase: number; y: number; shadows: boolean; jetables: Jetables },
): LieuMonte {
  const { y, shadows, jetables: j } = o;
  const group = new THREE.Group();
  group.name = "campagne-lieu";
  group.userData.genre = lieu.genre;
  group.position.set(lieu.x, y, lieu.z);
  const engins: MachineRig[] = [];
  const t: Tableaux = { pos: [], col: [] };

  if (lieuUtile(lieu.genre)) place(t, COTE_LIEU);

  switch (lieu.genre) {
    case "MAIRIE":
      mairie(t, group, j);
      break;
    case "CONCESSION":
      concession(t, group, j, shadows, engins);
      break;
    case "COOPERATIVE":
      cooperative(t, group, j);
      break;
    case "ETANG": {
      // Un disque d'eau à bord de roseaux, et un ponton.
      const n = 20;
      // Il tient dans l'emprise du décor, plus petite que celle du village.
      const rayon = (k: number) => 2.35 + Math.sin(k * 2.1) * 0.28 + Math.cos(k * 1.3) * 0.2;
      const eau: number[] = [];
      const eauCol: number[] = [];
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = ((k + 1) / n) * Math.PI * 2;
        for (const [r, h, c] of [
          [1.18, 0.012, new THREE.Color(0x8aa65a)],
          [1, 0.03, new THREE.Color(0x6fb4d6)],
        ] as const) {
          eau.push(
            0, h, 0,
            Math.cos(a1) * rayon(k + 1) * r, h, Math.sin(a1) * rayon(k + 1) * r,
            Math.cos(a0) * rayon(k) * r, h, Math.sin(a0) * rayon(k) * r,
          );
          for (let v = 0; v < 3; v++) eauCol.push(c.r, c.g, c.b);
        }
      }
      const m = maillageFacette(eau, eauCol, { nom: "etang" });
      j.geometries.push(m.geometry);
      j.materiaux.push(m.material as THREE.Material);
      group.add(m);
      for (let k = 0; k < 14; k++) {
        const a = k * 0.9 + 0.4;
        const r = rayon(k) * 1.05;
        ajouterBoite(t.pos, t.col, Math.cos(a) * r, 0.35, Math.sin(a) * r, 0.07, 0.7 + (k % 3) * 0.15, 0.07, 0x6f9a3a);
      }
      ajouterBoite(t.pos, t.col, 2.1, 0.12, 0.5, 1.5, 0.08, 0.6, BOIS_CLAIR);
      break;
    }
    case "VERGER": {
      // De vrais pommiers, à hauteur d'homme, et leurs pommes sur le
      // feuillage : à la taille d'un buisson, les pommes flottaient au-dessus.
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 3; k++) {
          const x = -2.1 + i * 2.1;
          const z = -2.1 + k * 2.1;
          ajouterArbre(t.pos, t.col, x, 0, z, 2.3, 100 + i * 3 + k);
          for (let f = 0; f < 5; f++) {
            const a = f * 1.26 + i + k;
            ajouterBoite(t.pos, t.col, x + Math.cos(a) * 0.62, 1.02 + (f % 3) * 0.14, z + Math.sin(a) * 0.62, 0.17, 0.17, 0.17, 0xd9463c);
          }
        }
      }
      break;
    }
    case "RUCHER": {
      /*
       * Un rucher qu'on reconnaît : trois ruches blanches à toit rouge sur
       * leurs tréteaux, un champ de lavande derrière, une pancarte devant.
       * La première version — des cubes plats et des fleurs en dés semés
       * autour — appelait une seule question : « c'est quoi ça ? ».
       */
      const LAVANDE = [0x8e6cc4, 0x9b7bd0, 0x7f5fb8];
      for (let r = 0; r < 3; r++) {
        const z = -2.4 + r * 0.85;
        ajouterBoite(t.pos, t.col, 0, 0.1, z, 5.4, 0.2, 0.42, 0x5c7f43);
        for (let k = 0; k < 7; k++) {
          const x = -2.4 + k * 0.8 + (r % 2) * 0.2;
          ajouterGeometrie(t.pos, t.col, cylindre(6), pose(x, 0.36, z, k * 0.7, 0.62, 0.34, 0.5), LAVANDE[(k + r) % 3]!);
        }
      }
      for (let i = 0; i < 3; i++) {
        const x = -1.7 + i * 1.7;
        const z = 1.1;
        // Le tréteau : deux pieds, une planche.
        for (const s of [-1, 1]) ajouterBoite(t.pos, t.col, x + s * 0.32, 0.14, z, 0.1, 0.28, 0.7, BOIS);
        ajouterBoite(t.pos, t.col, x, 0.31, z, 0.9, 0.06, 0.8, BOIS_CLAIR);
        // Le corps, la hausse, le toit à deux pans.
        ajouterBoite(t.pos, t.col, x, 0.66, z, 0.82, 0.64, 0.72, 0xf4efe0);
        ajouterBoite(t.pos, t.col, x, 1.1, z, 0.82, 0.24, 0.72, 0xeccb62);
        ajouterGeometrie(t.pos, t.col, prismeUnite(), pose(x, 1.22, z, 0, 1.0, 0.34, 0.92), 0xa8432f);
        // Le trou de vol et sa planche d'envol, face à la caméra.
        ajouterBoite(t.pos, t.col, x, 0.44, z + 0.365, 0.36, 0.07, 0.02, 0x2e2418);
        ajouterBoite(t.pos, t.col, x, 0.38, z + 0.43, 0.46, 0.03, 0.14, BOIS_CLAIR);
      }
      // La pancarte, tournée vers la caméra.
      const px = -2.2;
      const pz = 2.35;
      for (const s of [-1, 1]) {
        ajouterBoite(t.pos, t.col, px + s * 0.5, 0.5, pz - s * 0.5, 0.1, 1.0, 0.1, BOIS, Math.PI / 4);
      }
      const enseigne = plaque(
        j,
        { texte: "RUCHER", fond: "#fbf5e6", encre: "#8a5a12", bord: "#c99a2e", sous: "Miel de la ferme" },
        1.7,
        1.7 * (208 / 512),
        0xf4e7c5,
      );
      enseigne.position.set(px, 1.0, pz);
      enseigne.rotation.y = Math.PI / 4;
      group.add(enseigne);
      break;
    }
  }
  if (t.pos.length) {
    const m = maillageFacette(t.pos, t.col, { shadows, recoit: shadows, nom: "lieu-decor" });
    j.geometries.push(m.geometry);
    j.materiaux.push(m.material as THREE.Material);
    group.add(m);
  }
  return { group, engins };
}
