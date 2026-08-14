import * as THREE from "three";
import {
  ACCENT_COLORS,
  BEARDS,
  CLOTH_COLORS,
  CLOTHES,
  EARS,
  EYE_COLORS,
  EYE_SHAPES,
  HAIR_COLORS,
  HAIRS,
  HAT_COLORS,
  HATS,
  MOUTHS,
  NOSES,
  SKIN_TONES,
  type CharacterAppearance,
  type Specialization,
} from "@farmsim/shared";
import { HALF, box, cyl, lathe, mergeAll, place, roundedBox, tube, type Vec3 } from "./machine-kit";

/**
 * Le personnage.
 *
 * Même méthode que le parc matériel : de la géométrie procédurale, fusionnée
 * par matière, montée sur une hiérarchie d'articulations nommées. La différence
 * tient au vocabulaire de formes — un corps n'a pas d'arêtes vives, donc
 * ellipsoïdes et capsules plutôt que boîtes — et aux matières, où le tissu
 * doit se lire comme du tissu et la peau comme de la peau.
 *
 * Le squelette existe pour une raison : sans lui, un bonhomme ne peut que
 * tourner sur son socle. Avec lui, il respire, cligne des yeux, marche, salue.
 *
 * Repères : les pieds posent en y = 0, le sommet du crâne arrive vers 1,80, et
 * le personnage regarde vers **+Z**.
 */

/* ------------------------------------------------------------------ */
/* Matières                                                            */
/* ------------------------------------------------------------------ */

export type CharMat =
  | "skin"
  | "skinShade"
  | "hair"
  /** Poil du visage : même teinte que les cheveux, mais mat et un ton plus bas */
  | "beard"
  | "cloth"
  | "clothDark"
  | "accent"
  | "linen"
  | "hat"
  | "hatDark"
  | "leather"
  | "metal"
  | "eyeWhite"
  | "iris"
  | "pupil"
  | "lip"
  | "mouth"
  | "teeth";

export type CharMaterials = Record<CharMat, THREE.Material>;

function shade(hex: string, amount: number): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = c.getHSL({ h: 0, s: 0, l: 0 });
  return c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
}

/**
 * Matières d'un personnage.
 *
 * Deux choix portent tout le rendu. La peau reçoit un voile de `sheen` chaud :
 * c'est l'approximation la moins chère de la lumière qui traverse l'épiderme,
 * et sans elle un visage a l'air taillé dans du plâtre. Le tissu, lui, reçoit
 * un `sheen` large et rugueux — le halo qu'on voit sur un vêtement à
 * contre-jour — ce qui suffit à le distinguer d'une carrosserie peinte.
 */
export function createCharacterMaterials(look: CharacterAppearance): CharMaterials {
  const skinHex = SKIN_TONES[look.skin]?.hex ?? "#e8b58a";
  const clothHex = CLOTH_COLORS[look.clothColor]?.hex ?? "#3f8f52";
  const accentHex = ACCENT_COLORS[look.accentColor]?.hex ?? "#d9b23c";
  const hairHex = HAIR_COLORS[look.hairColor]?.hex ?? "#4b3120";
  const hatHex = HAT_COLORS[look.hatColor]?.hex ?? "#c9a227";

  const fabric = (color: THREE.Color | string, roughness = 0.86) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness,
      metalness: 0,
      sheen: 0.55,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55),
    });

  return {
    skin: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(skinHex),
      roughness: 0.68,
      metalness: 0,
      // Un voile de sheen chaud approxime la lumière qui traverse l'épiderme.
      // Poussé plus loin, il délave la carnation jusqu'au plâtre.
      sheen: 0.22,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0xd98a6a),
    }),
    // Creux du visage, intérieur des oreilles, pli du cou.
    skinShade: new THREE.MeshStandardMaterial({
      color: shade(skinHex, -0.09),
      roughness: 0.72,
      metalness: 0,
    }),
    hair: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(hairHex),
      roughness: 0.52,
      metalness: 0,
      sheen: 0.8,
      sheenRoughness: 0.35,
      sheenColor: shade(hairHex, 0.3),
    }),
    // Un poil de barbe est plus court et plus mat qu'un cheveu : le même
    // brillant que la chevelure donnait un menton verni. Sa matière propre
    // sert aussi à mesurer ce que la barbe couvre, indépendamment des
    // sourcils et de la coiffe qui partagent la teinte.
    beard: new THREE.MeshPhysicalMaterial({
      color: shade(hairHex, -0.05),
      roughness: 0.82,
      metalness: 0,
      sheen: 0.3,
      sheenRoughness: 0.7,
      sheenColor: shade(hairHex, 0.18),
    }),
    cloth: fabric(clothHex),
    clothDark: fabric(shade(clothHex, -0.11), 0.9),
    accent: fabric(accentHex, 0.8),
    // Chemise, col, doublure : le blanc cassé de la toile de travail.
    linen: fabric("#efe6d4", 0.9),
    // Le couvre-chef a sa propre teinte : on ne choisit pas la couleur de son
    // chapeau en changeant de pantalon.
    hat: fabric(hatHex, 0.82),
    hatDark: fabric(shade(hatHex, -0.12), 0.88),
    leather: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x4a3526),
      roughness: 0.48,
      metalness: 0.05,
      clearcoat: 0.3,
      clearcoatRoughness: 0.5,
    }),
    metal: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.28, metalness: 0.9 }),
    eyeWhite: new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.22, metalness: 0 }),
    iris: new THREE.MeshStandardMaterial({
      color: new THREE.Color(EYE_COLORS[look.eyeColor]?.hex ?? "#3b2418"),
      roughness: 0.14,
      metalness: 0,
    }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 0.1, metalness: 0 }),
    lip: new THREE.MeshStandardMaterial({
      color: shade(skinHex, -0.16).lerp(new THREE.Color(0xa8564e), 0.55),
      roughness: 0.48,
      metalness: 0,
    }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x3d1a17, roughness: 0.6, metalness: 0 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.3, metalness: 0 }),
  };
}

/* ------------------------------------------------------------------ */
/* Formes du corps                                                     */
/* ------------------------------------------------------------------ */

/** Ellipsoïde : la brique de base d'un corps, là où la machine prend un cube. */
function ell(rx: number, ry: number, rz: number, pos: Vec3, rot?: Vec3, seg = 16) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.6)));
  g.scale(rx, ry, rz);
  return place(g, pos, rot);
}

/** Capsule : membre ou doigt, avec ses extrémités arrondies. Axe sur Y. */
function cap(r: number, length: number, pos: Vec3, rot?: Vec3, seg = 12) {
  return place(new THREE.CapsuleGeometry(r, Math.max(0.001, length), 4, seg), pos, rot);
}

/**
 * Membre fuselé : plus large à la racine qu'à l'extrémité, comme une cuisse ou
 * un bras. Deux cylindres coniques et deux calottes, fusionnés.
 */
function limb(rTop: number, rBottom: number, length: number, pos: Vec3, rot?: Vec3) {
  const merged = mergeAll([
    place(new THREE.CylinderGeometry(rTop, rBottom, length, 14), [0, -length / 2, 0]),
    ell(rTop, rTop * 0.9, rTop, [0, 0, 0], undefined, 12),
    ell(rBottom, rBottom * 0.9, rBottom, [0, -length, 0], undefined, 12),
  ]);
  // `place` d'abord la rotation, puis la translation : l'inverse ferait
  // décrire un arc de cercle à la pièce au lieu de l'incliner sur place.
  return place(merged, pos, rot);
}

/**
 * Plaque épousant une enveloppe : bavette, revers, pan de gilet, dos de veste.
 *
 * Un vêtement à plat sur un torse rond fait un panneau publicitaire ; empilé en
 * tranches, il fait des marches d'escalier. Un secteur de la sphère du corps,
 * écarté de `out`, suit la courbe exactement et se raccorde sans couture.
 *
 * `from` et `to` sont des angles autour de l'axe du regard : 0 au milieu de la
 * poitrine, positif vers la gauche du personnage, ±π dans le dos.
 */
function plate(
  r: Vec3,
  c: Vec3,
  yTop: number,
  yBottom: number,
  from: number,
  to: number,
  out: number,
  seg = 24,
): THREE.BufferGeometry {
  const R: Vec3 = [r[0] + out, r[1] + out, r[2] + out];
  const angle = (y: number) => Math.acos(THREE.MathUtils.clamp((y - c[1]) / R[1], -1, 1));
  const t0 = angle(yTop);
  const t1 = angle(yBottom);
  // Les deux bornes arrivent dans n'importe quel ordre — un pan gauche se
  // décrit naturellement de −0,2 à −0,66. Un `phiLength` négatif ne dessine
  // rien : on remet donc les angles dans l'ordre croissant.
  const a0 = Math.min(from, to);
  const a1 = Math.max(from, to);
  // Dans SphereGeometry, l'axe +Z tombe à phi = π/2.
  const g = new THREE.SphereGeometry(
    1,
    Math.max(4, Math.round((seg * (a1 - a0)) / Math.PI)),
    seg,
    HALF + a0,
    a1 - a0,
    t0,
    Math.max(0.01, t1 - t0),
  );
  g.scale(R[0], R[1], R[2]);
  return place(g, c);
}

/**
 * Pan de devant d'un vêtement ouvert — veste, gilet.
 *
 * Le bord intérieur dessine un revers : serré au col, écarté au plus large de
 * la poitrine, refermé à la taille. C'est ce tracé, et non la couleur, qui fait
 * lire « veste ouverte ». Un premier essai laissait le bord intérieur s'ouvrir
 * du haut vers le bas : le V se retrouvait à l'envers et le personnage avait
 * l'air d'avoir la chemise qui sort du ventre.
 *
 * Le pan est découpé en bandes horizontales, toutes posées sur la même sphère :
 * elles se recouvrent donc sans laisser de marche.
 */
function frontPanel(
  r: Vec3,
  c: Vec3,
  yTop: number,
  yBottom: number,
  collar: number,
  wide: number,
  hem: number,
  outer: number,
  out: number,
): THREE.BufferGeometry[] {
  /** Hauteur relative du plus large du revers. */
  const BREAK = 0.34;
  const inner = (a: number) =>
    a < BREAK
      ? collar + (wide - collar) * (a / BREAK)
      : wide + (hem - wide) * Math.pow((a - BREAK) / (1 - BREAK), 0.85);

  const bands = 9;
  const pieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < bands; i++) {
    const a = i / bands;
    const b = (i + 1.05) / bands;
    const yA = yTop + (yBottom - yTop) * a;
    const yB = yTop + (yBottom - yTop) * b;
    // `inner` et `outer` sont signés par le côté : on compare donc les
    // distances au milieu, pas les angles eux-mêmes.
    const sign = Math.sign(outer) || 1;
    const from = sign * Math.min(Math.abs(inner(a)), Math.abs(outer) - 0.02);
    pieces.push(plate(r, c, yA, yB, from, outer, out));
  }
  return pieces;
}

/** Calotte sphérique : coiffe, paupière, coquille d'oreille. *//** Calotte sphérique : coiffe, paupière, coquille d'oreille. *//** Calotte sphérique : coiffe, paupière, coquille d'oreille. */
function domeCap(r: number, coverage: number, pos: Vec3, rot?: Vec3, seg = 18) {
  return place(
    new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.55)), 0, Math.PI * 2, 0, coverage),
    pos,
    rot,
  );
}

/* ------------------------------------------------------------------ */
/* Squelette                                                           */
/* ------------------------------------------------------------------ */

export type Joint =
  | "root"
  | "hips"
  | "chest"
  | "neck"
  | "head"
  | "jaw"
  | "lidL"
  | "lidR"
  | "browL"
  | "browR"
  | "armL"
  | "armR"
  | "foreL"
  | "foreR"
  | "handL"
  | "handR"
  | "thighL"
  | "thighR"
  | "shinL"
  | "shinR"
  | "footL"
  | "footR"
  | "prop";

/** Nœud du plan de montage : ses pièces par matière, et ses articulations. */
class Node {
  private buckets = new Map<CharMat, THREE.BufferGeometry[]>();
  private kids: { name: Joint; node: Node; pos: Vec3; rot?: Vec3 }[] = [];

  add(mat: CharMat, ...geos: THREE.BufferGeometry[]): this {
    const bucket = this.buckets.get(mat) ?? [];
    bucket.push(...geos);
    this.buckets.set(mat, bucket);
    return this;
  }

  joint(name: Joint, pos: Vec3, rot?: Vec3): Node {
    const node = new Node();
    this.kids.push({ name, node, pos, rot });
    return node;
  }

  build(
    materials: CharMaterials,
    joints: Partial<Record<Joint, THREE.Group>>,
    shadows: boolean,
  ): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, geos] of this.buckets) {
      const merged = geos.length === 1 ? geos[0] : mergeAll(geos);
      const mesh = new THREE.Mesh(merged, materials[mat]);
      // Nommer par matière : le modèle reste lisible une fois exporté, et les
      // tests peuvent viser une pièce précise.
      mesh.name = mat;
      mesh.castShadow = shadows;
      group.add(mesh);
    }
    for (const kid of this.kids) {
      const g = kid.node.build(materials, joints, shadows);
      g.name = kid.name;
      g.position.set(...kid.pos);
      if (kid.rot) g.rotation.set(...kid.rot);
      // Chaque articulation garde sa pose de repos : les animations s'y
      // ajoutent au lieu de l'écraser.
      g.userData.rest = { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z, py: g.position.y };
      joints[kid.name] = g;
      group.add(g);
    }
    return group;
  }
}

/* ------------------------------------------------------------------ */
/* Visage                                                              */
/* ------------------------------------------------------------------ */

/**
 * La tête, d'un seul tenant.
 *
 * Premier essai : un crâne et une mâchoire, deux ellipsoïdes qui se
 * recouvrent. Le résultat portait une cicatrice — la courbe d'intersection des
 * deux surfaces, parfaitement visible de l'oreille au menton. Deux volumes qui
 * se croisent laissent toujours cette trace.
 *
 * D'où une seule forme, rétreinte vers le bas : le crâne garde son galbe, la
 * mâchoire se resserre et le menton avance. La transition est continue, donc
 * il n'y a rien à raccorder.
 */
const HEAD_R: Vec3 = [0.135, 0.17, 0.15];
const HEAD_C: Vec3 = [0, 0.152, -0.008];
/** Au-dessus de cette hauteur la tête est pleine ; en dessous elle se resserre. */
const JAW_LINE = 0.158;
const JAW_BOTTOM = HEAD_C[1] - HEAD_R[1];
const JAW_NARROW = 0.3;
const JAW_FLATTEN = 0.22;
const CHIN_PUSH = 0.02;

/** Avancement du rétreint à une hauteur donnée : 0 au front, 1 au menton. */
function jawT(y: number): number {
  const t = (JAW_LINE - y) / (JAW_LINE - JAW_BOTTOM);
  return Math.pow(THREE.MathUtils.clamp(t, 0, 1), 1.6);
}

const jawKx = (y: number) => 1 - JAW_NARROW * jawT(y);
const jawKz = (y: number) => 1 - JAW_FLATTEN * jawT(y);
const chinPush = (y: number) => CHIN_PUSH * jawT(y);

/** Crâne rétreint : une sphère mise à l'échelle, puis resserrée vers le bas. */
function headShape(grow = 0, seg = 28): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(HEAD_R[0] + grow, HEAD_R[1] + grow, HEAD_R[2] + grow);
  g.translate(HEAD_C[0], HEAD_C[1], HEAD_C[2]);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * jawKx(y));
    pos.setZ(i, (pos.getZ(i) - HEAD_C[2]) * jawKz(y) + HEAD_C[2] + chinPush(y));
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Avant du visage à une hauteur et un écart donnés.
 *
 * Toutes les pièces du visage se posent **sur** cette surface, jamais à une
 * profondeur devinée : un œil placé à un `z` fixe se retrouve enfoui dès qu'on
 * retouche la forme de la tête, et le personnage perd son regard sans que rien
 * ne le signale.
 */
function faceZ(x: number, y: number): number {
  const v = (y - HEAD_C[1]) / HEAD_R[1];
  const s2 = 1 - v * v;
  if (s2 <= 0) return HEAD_C[2] + chinPush(y);
  // On remonte au rayon d'avant rétreint pour rester sur la surface réelle.
  const u = x / jawKx(y) / HEAD_R[0];
  const k = s2 - u * u;
  if (k <= 0) return HEAD_C[2] + chinPush(y);
  return HEAD_C[2] + HEAD_R[2] * jawKz(y) * Math.sqrt(k) + chinPush(y);
}

/** Demi-largeur de la tête à une hauteur donnée : où poser oreilles et coiffe. */
export function headHalfWidth(y: number): number {
  const v = (y - HEAD_C[1]) / HEAD_R[1];
  const s2 = 1 - v * v;
  return s2 <= 0 ? 0 : HEAD_R[0] * jawKx(y) * Math.sqrt(s2);
}

/**
 * Écart d'un point à la surface du crâne, en mètres : positif dehors, négatif
 * dedans, nul sur la peau.
 *
 * `faceZ` répond à « où est la surface **devant** », ce qui suffit à poser un
 * œil ou une lèvre. Mais une barbe enveloppe la mâchoire, un chapeau ceint le
 * crâne, une mèche passe derrière l'oreille : aucun de ces trois-là ne se juge
 * sur un seul axe. C'est cette fonction qui permet de **mesurer** qu'une pièce
 * colle au crâne au lieu de flotter dessus ou de s'y enfoncer — et donc de
 * l'exiger par un test plutôt que de l'espérer.
 */
export function headGap(x: number, y: number, z: number): number {
  const u = x / (HEAD_R[0] * jawKx(y));
  const v = (y - HEAD_C[1]) / HEAD_R[1];
  const w = (z - HEAD_C[2] - chinPush(y)) / (HEAD_R[2] * jawKz(y));
  // Le rayon normalisé vaut 1 sur la peau ; ramené à l'échelle du crâne, son
  // écart à 1 approche la distance réelle d'assez près pour trancher.
  return (Math.hypot(u, v, w) - 1) * HEAD_R[1];
}

/** Hauteur de la ligne de coiffe, et rayon du crâne à cette hauteur. */
export const HAT_LINE = 0.232;

const LID_CLOSED = 1.72;
/**
 * Paupière basse, fixe : elle borne l'ouverture par le dessous.
 *
 * Sans elle le globe entier est visible et le personnage écarquille les yeux
 * en permanence — le regard de terreur qu'on voit sur tous les avatars ratés.
 * Un œil réel ne laisse voir qu'une fente entre les deux paupières.
 */
const LOWER_LID = Math.PI + 0.46;

function eyeSpec(look: CharacterAppearance) {
  switch (EYE_SHAPES[look.eyeShape]?.id) {
    case "almond":
      return { gap: 0.052, r: 0.027, open: -0.3, squash: 0.84 };
    case "wide":
      return { gap: 0.062, r: 0.027, open: -0.46, squash: 0.94 };
    case "narrow":
      return { gap: 0.045, r: 0.025, open: -0.26, squash: 0.9 };
    case "sleepy":
      return { gap: 0.054, r: 0.026, open: 0.02, squash: 0.76 };
    default:
      return { gap: 0.054, r: 0.027, open: -0.38, squash: 0.95 };
  }
}

function addEyes(head: Node, look: CharacterAppearance) {
  const { gap, r, open, squash } = eyeSpec(look);
  const y = 0.176;

  for (const side of [-1, 1] as const) {
    const x = side * gap;
    // Le globe est enfoncé dans l'orbite : c'est ce qui le distingue d'une
    // bille collée sur une joue.
    const z = faceZ(x, y) - r * 0.8;
    head.add("skinShade", ell(r * 1.2, r * 1.05, r * 0.3, [x, y, z + r * 0.4]));
    head.add("eyeWhite", ell(r, r * squash, r * 0.9, [x, y, z]));
    head.add("iris", ell(r * 0.5, r * 0.5 * squash, r * 0.34, [x, y, z + r * 0.68]));
    head.add("pupil", ell(r * 0.22, r * 0.22, r * 0.2, [x, y, z + r * 0.84]));

    // Paupière haute : une calotte qui bascule. Au repos elle coiffe le haut du
    // globe ; au clignement elle passe devant et rejoint la basse.
    const lid = head.joint(side < 0 ? "lidL" : "lidR", [x, y, z], [open, 0, 0]);
    lid.add("skin", domeCap(r * 1.07, Math.PI * 0.5, [0, 0, 0], undefined, 14));
    head.add("skin", domeCap(r * 1.06, Math.PI * 0.5, [x, y, z], [LOWER_LID, 0, 0], 14));

    // Sourcil, posé sur l'arcade.
    const by = y + 0.042;
    const brow = head.joint(side < 0 ? "browL" : "browR", [x, by, faceZ(x, by) - 0.012]);
    brow.add("hair", roundedBox(0.046, 0.011, 0.014, 0.005, [0, 0, 0], [0.15, 0, side * 0.2]));
  }
}

function addNose(head: Node, look: CharacterAppearance) {
  const kind = NOSES[look.nose]?.id ?? "small";
  // Hauteur du bout du nez, à mi-distance entre les yeux et la bouche.
  const y = 0.132;
  const z = faceZ(0, y);

  /** Arête : de la racine, entre les yeux, jusqu'au bout du nez. */
  const bridge = (h: number, w: number) =>
    head.add("skin", ell(w, h, 0.038, [0, y + h * 0.55, z - 0.036]));

  if (kind === "round") {
    bridge(0.044, 0.016);
    head.add("skin", ell(0.024, 0.022, 0.026, [0, y, z - 0.014]));
  } else if (kind === "long") {
    bridge(0.062, 0.014);
    head.add("skin", ell(0.019, 0.024, 0.03, [0, y - 0.01, z - 0.01]));
  } else if (kind === "button") {
    bridge(0.032, 0.013);
    head.add("skin", ell(0.019, 0.018, 0.021, [0, y + 0.005, z - 0.016]));
  } else if (kind === "broad") {
    bridge(0.044, 0.022);
    head.add("skin", ell(0.034, 0.02, 0.024, [0, y - 0.002, z - 0.016]));
  } else {
    bridge(0.04, 0.013);
    head.add("skin", ell(0.021, 0.019, 0.023, [0, y, z - 0.016]));
  }
  // Narines : deux ombres, pas des trous.
  for (const side of [-1, 1]) {
    head.add("skinShade", ell(0.008, 0.006, 0.008, [side * 0.016, y - 0.012, z - 0.014]));
  }
}

function addMouth(head: Node, look: CharacterAppearance) {
  const kind = MOUTHS[look.mouth]?.id ?? "smile";
  const y = 0.084;

  /**
   * Lèvre : un boudin unique suivant une parabole plaquée sur le visage.
   *
   * Le premier essai posait sept petites billes le long de la courbe — elles
   * ne se rejoignaient pas et la bouche ressemblait à un collier. Un tube
   * passant par cinq points donne une lèvre d'un seul tenant.
   *
   * `bow` est la flèche de l'arc, comptée **aux coins** : positive, les
   * commissures remontent et la bouche sourit ; négative, elles tombent. C'est
   * l'inverse de ce que dit l'intuition — relever le milieu d'une bouche fait
   * une moue, pas un sourire.
   */
  const lipLine = (
    mat: CharMat,
    half: number,
    bow: number,
    thickness: number,
    base: number,
    skew = 0,
  ) => {
    const pts: Vec3[] = [];
    for (let i = 0; i < 5; i++) {
      const u = (i / 4) * 2 - 1;
      const x = u * half;
      const py = base - bow * (1 - u * u) + skew * u;
      // Le boudin est **enfoncé de son propre rayon** : sans quoi sa moitié
      // avant sort de la joue, et une bouche large ressortait de sept
      // millimètres. Les coins rentrent un peu plus — une bouche ne s'arrête
      // pas net, elle se perd dans la commissure.
      const sink = thickness + 0.001 + (1 - Math.abs(u)) * -0.0015;
      pts.push([x, py, faceZ(x, py) - sink]);
    }
    head.add(mat, tube(pts, thickness, 7));
  };

  if (kind === "neutral") {
    lipLine("lip", 0.032, 0.002, 0.0068, y + 0.007);
    lipLine("lip", 0.03, 0.001, 0.0078, y - 0.008);
    lipLine("mouth", 0.029, 0.0015, 0.0026, y);
  } else if (kind === "grin") {
    lipLine("lip", 0.04, 0.015, 0.0072, y + 0.014);
    lipLine("lip", 0.038, 0.005, 0.0085, y - 0.017);
    lipLine("mouth", 0.036, 0.012, 0.0105, y - 0.002);
    lipLine("teeth", 0.034, 0.011, 0.0065, y + 0.004);
  } else if (kind === "smirk") {
    lipLine("lip", 0.033, 0.008, 0.0068, y + 0.007, 0.009);
    lipLine("lip", 0.031, 0.003, 0.0078, y - 0.009, 0.009);
    lipLine("mouth", 0.03, 0.006, 0.0026, y - 0.001, 0.009);
    head.add("skinShade", ell(0.009, 0.012, 0.007, [0.046, y + 0.017, faceZ(0.046, y + 0.017) - 0.014]));
  } else if (kind === "open") {
    /*
     * Bouche entrouverte : un **creux**, pas un volume rapporté.
     *
     * Le premier dessin plaquait un ellipsoïde sombre de 46 × 56 mm devant le
     * visage — sur une figure de 270 mm de haut, un trou noir au milieu de la
     * face, et le premier reproche du joueur. Le fond est maintenant en
     * retrait de la surface, et l'ourlet des lèvres suit `faceZ` point par
     * point : rien ne dépasse de la joue.
     */
    const half = 0.026;
    const lift = 0.011;
    for (const s of [1, -1]) {
      const pts: Vec3[] = [];
      for (let i = 0; i < 5; i++) {
        const u = (i / 4) * 2 - 1;
        const x = u * half;
        // Lèvre haute au-dessus, lèvre basse en dessous : elles se rejoignent
        // aux commissures, ce qui ferme l'ovale sans le dessiner en entier.
        const py = y + s * lift * (1 - u * u) + 0.002 * s;
        pts.push([x, py, faceZ(x, py) - 0.007]);
      }
      head.add("lip", tube(pts, s > 0 ? 0.0062 : 0.0072, 7));
    }
    // Le fond de la bouche, enfoncé : il ne se voit que par l'ouverture.
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * half * 0.5;
      head.add("mouth", ell(half * 0.42, 0.011, 0.006, [x, y, faceZ(x, y) - 0.018]));
    }
    head.add("teeth", ell(0.017, 0.0045, 0.005, [0, y + 0.0075, faceZ(0, y + 0.0075) - 0.014]));
  } else {
    lipLine("lip", 0.034, 0.013, 0.0068, y + 0.007);
    lipLine("lip", 0.032, 0.005, 0.0078, y - 0.008);
    lipLine("mouth", 0.031, 0.011, 0.0026, y);
    // Fossettes : le sourire ne tient pas dans la seule bouche.
    for (const side of [-1, 1]) {
      const dx = side * 0.052;
      head.add("skinShade", ell(0.008, 0.013, 0.006, [dx, y + 0.013, faceZ(dx, y + 0.013) - 0.014]));
    }
  }
}

function addEars(head: Node, look: CharacterAppearance) {
  const kind = EARS[look.ears]?.id ?? "small";
  let rx = 0.02;
  let ry = 0.042;
  let rz = 0.03;
  let tip = 0;
  if (kind === "round") {
    ry = 0.038;
    rz = 0.036;
  } else if (kind === "pointed") {
    ry = 0.052;
    tip = 1;
  } else if (kind === "wide") {
    rx = 0.026;
    ry = 0.046;
    rz = 0.038;
  }
  const y = 0.155;
  for (const side of [-1, 1]) {
    const x = side * (headHalfWidth(y) - 0.008);
    head.add("skin", ell(rx, ry, rz, [x, y, HEAD_C[2] + 0.008], [0, 0, side * -0.12]));
    // Conque : l'ombre intérieure, sans quoi l'oreille est une olive collée.
    head.add("skinShade", ell(rx * 0.5, ry * 0.6, rz * 0.6, [x + side * 0.008, y - 0.002, HEAD_C[2] + 0.014]));
    if (tip) {
      head.add("skin", place(
        new THREE.ConeGeometry(rx * 0.9, 0.03, 8),
        [x, y + ry * 0.86, HEAD_C[2] + 0.008],
        [0, 0, side * -0.18],
      ));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Cheveux et barbe                                                    */
/* ------------------------------------------------------------------ */

/**
 * Coiffe épousant le crâne.
 *
 * Une calotte droite ne peut pas convenir : elle descend à la même hauteur
 * partout, donc soit elle laisse la nuque nue, soit elle mange les sourcils.
 * On l'incline vers l'arrière — la ligne de front remonte, la nuque descend,
 * ce qui est exactement le dessin d'une implantation de cheveux.
 */
function scalp(growth: number, coverage = Math.PI * 0.46, tilt = -0.42): THREE.BufferGeometry {
  const g = domeCap(1, coverage, [0, 0, 0], undefined, 22);
  g.scale(HEAD_R[0] + growth, HEAD_R[1] + growth, HEAD_R[2] + growth);
  return place(g, HEAD_C, [tilt, 0, 0]);
}

/**
 * Chevelure.
 *
 * Sous un chapeau, tout ce qui coiffait le crâne disparaît : les mèches
 * traversaient la paille et sortaient sur le dessus. Ne restent que ce qui
 * dépasse pour de vrai — la nuque, les tempes, une natte, une queue de cheval.
 */
function addHair(head: Node, look: CharacterAppearance, underHat: boolean) {
  const kind = HAIRS[look.hair]?.id ?? "crop";
  if (kind === "bald") return;

  const hair = (g: THREE.BufferGeometry) => head.add("hair", g);
  const top = HEAD_C[1] + HEAD_R[1];

  // Nuque et tempes : visibles chapeau ou pas.
  hair(ell(0.118, 0.08, 0.086, [0, HEAD_C[1] - 0.035, HEAD_C[2] - 0.07]));
  if (underHat) {
    for (const side of [-1, 1]) {
      hair(ell(0.02, 0.036, 0.034, [side * (headHalfWidth(0.2) - 0.004), 0.2, -0.03]));
    }
  }

  if (kind === "afro") {
    // Volume franc, facetté : la masse compte plus que la mèche.
    if (!underHat) {
      const g = new THREE.IcosahedronGeometry(0.19, 1);
      g.scale(1.06, 0.98, 1);
      hair(place(g, [0, HEAD_C[1] + 0.06, HEAD_C[2] - 0.01]));
      hair(scalp(0.014, Math.PI * 0.56, -0.3));
    }
    return;
  }

  if (!underHat) hair(scalp(0.014, kind === "crop" ? Math.PI * 0.44 : Math.PI * 0.48));

  if (kind === "crop") {
    if (!underHat) {
      for (const side of [-1, 1]) {
        hair(ell(0.022, 0.038, 0.032, [side * (headHalfWidth(0.2) - 0.002), 0.2, -0.03]));
      }
    }
    return;
  }

  if (kind === "wavy") {
    if (underHat) return;
    // Trois mèches qui se chevauchent : le désordre se fabrique.
    hair(ell(0.078, 0.048, 0.072, [-0.05, top - 0.02, 0.03], [0.2, 0, 0.3]));
    hair(ell(0.072, 0.044, 0.066, [0.055, top - 0.012, 0.0], [0.1, 0, -0.35]));
    hair(ell(0.06, 0.042, 0.056, [0.005, top - 0.045, 0.08], [0.5, 0, 0.05]));
    return;
  }

  /**
   * Hauteur d'attache d'une coiffure nouée.
   *
   * Sous un chapeau, elle descend **sous la ligne de coiffe** : le chignon
   * partait à 292 mm et la queue de cheval à 272 quand le bord du canotier est
   * à 213, tous deux dans son rayon. Ils le traversaient de part en part —
   * c'est le tube brun vertical qu'on voyait passer au milieu du visage.
   */
  const knot = underHat ? HAT_LINE - 0.03 : top - 0.03;

  if (kind === "bun") {
    // Le chignon est volumineux : sous un chapeau il se noue plus bas encore,
    // sur la nuque, sinon sa masse ressort par-dessus le bord.
    const y0 = underHat ? HAT_LINE - 0.058 : knot;
    const z = underHat ? -0.155 : -0.14;
    hair(ell(0.058, 0.056, 0.054, [0, y0, z]));
    hair(place(new THREE.TorusGeometry(0.053, 0.012, 6, 14), [0, y0, z], [0.4, 0, 0]));
    return;
  }

  if (kind === "ponytail") {
    const y0 = underHat ? HAT_LINE - 0.045 : top - 0.05;
    hair(
      tube(
        [
          [0, y0, -0.14],
          [0, y0 - 0.075, -0.19],
          [0, 0.09, -0.205],
          [0, -0.005, -0.175],
        ],
        0.03,
        8,
      ),
    );
    hair(place(new THREE.TorusGeometry(0.034, 0.011, 6, 12), [0, y0, -0.135], [HALF, 0, 0]));
    return;
  }

  if (kind === "braids") {
    const y0 = underHat ? HAT_LINE - 0.04 : 0.205;
    for (const side of [-1, 1]) {
      hair(
        tube(
          [
            [side * 0.112, y0, -0.055],
            [side * 0.136, 0.115, -0.088],
            [side * 0.14, 0.025, -0.09],
            [side * 0.132, -0.04, -0.07],
          ],
          0.026,
          7,
        ),
      );
      // Les nœuds de la natte : trois anneaux suffisent à la lire.
      for (let i = 0; i < 3; i++) {
        hair(place(
          new THREE.TorusGeometry(0.028, 0.008, 5, 10),
          [side * (0.12 + i * 0.008), Math.min(y0 - 0.02, 0.17) - i * 0.06, -0.08],
          [HALF, 0, 0],
        ));
      }
    }
    return;
  }

  // curtain : deux rideaux encadrant le visage, qui sortent même d'un chapeau
  for (const side of [-1, 1]) {
    hair(ell(0.044, 0.09, 0.05, [side * 0.108, 0.128, 0.012], [0, 0, side * 0.1]));
    hair(ell(0.034, 0.054, 0.04, [side * 0.094, 0.042, -0.014], [0, 0, side * 0.14]));
  }
  if (!underHat) hair(ell(0.088, 0.036, 0.05, [0, top - 0.035, 0.07], [0.35, 0, 0]));
}

function addBeard(head: Node, look: CharacterAppearance) {
  const kind = BEARDS[look.beard]?.id ?? "none";
  if (kind === "none") return;

  const hair = (g: THREE.BufferGeometry) => head.add("beard", g);

  /**
   * Moustache : deux boudins suivant la lèvre supérieure.
   *
   * Chaque lobe lit sa profondeur **à sa propre abscisse**. La version d'avant
   * lisait `faceZ(0, y)` — la surface au milieu du visage — pour deux pièces
   * posées à vingt-trois millimètres de l'axe : le visage y est deux
   * millimètres et demi plus en arrière, et les lobes ressortaient de six
   * millimètres, comme deux billes collées sous le nez.
   */
  const moustache = () => {
    const base = 0.104;
    for (const side of [-1, 1]) {
      // Un boudin continu du philtrum à la commissure, plaqué point par point
      // sur la surface. Deux ellipsoïdes posés côte à côte se lisaient comme
      // deux haricots collés sous le nez.
      const pts: Vec3[] = [];
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const x = side * (0.004 + t * 0.042);
        const py = base - t * t * 0.016;
        pts.push([x, py, faceZ(x, py) - 0.008]);
      }
      hair(tube(pts, 0.009, 7));
    }
  };

  const soft = (v: number, w: number) => THREE.MathUtils.clamp(v / w, 0, 1);

  /**
   * Masque d'une barbe qui couvre la mâchoire.
   *
   * `cheek` règle la hauteur atteinte sur le flanc. Au milieu du visage le
   * poil s'arrête sous la lèvre, sur les flancs il monte jusqu'au favori : à
   * hauteur constante — ce que faisait la première version, calée sur
   * l'équateur du crâne — on n'obtient pas une barbe mais une cagoule, et le
   * poil passe par-dessus le nez.
   */
  const jawMask = (cheek: number) => (x: number, y: number, z: number) => {
    const LIP_LINE = 0.074;
    const flank = THREE.MathUtils.clamp(Math.abs(x) / (HEAD_R[0] * 0.86), 0, 1);
    const ceiling = LIP_LINE + (JAW_LINE + cheek - LIP_LINE) * Math.pow(flank, 0.7);
    let c = soft(ceiling - y, 0.05);
    c = Math.min(c, soft(z - (HEAD_C[2] - 0.02), 0.045));
    c = Math.min(c, soft(y - (JAW_BOTTOM - 0.02), 0.025));
    // La bouche reste libre : sans cette réserve le poil monte sur les
    // commissures et avale les lèvres.
    c = Math.min(c, soft(Math.hypot(x / 0.05, (y - 0.088) / 0.028) - 1, 0.7));
    return c;
  };

  /**
   * Masque des favoris : une bande étroite le long du flanc, de la tempe au
   * bas de la joue. Empilés en ellipsoïdes, ils se lisaient comme un chapelet
   * de perles posé à côté du visage.
   */
  const chopMask = (x: number, y: number, z: number) => {
    const hw = headHalfWidth(y) || 1e-6;
    // Le favori se tient sur les derniers dix pour cent de la largeur : à
    // deux tiers, la bande couvrait la joue et n'était plus un favori mais une
    // plaque.
    let c = soft(Math.abs(x) / hw - 0.88, 0.09);
    c = Math.min(c, soft(0.17 - y, 0.02));
    c = Math.min(c, soft(y - 0.088, 0.028));
    // Devant l'oreille, et pas plus avant que la pommette.
    c = Math.min(c, soft(z - (HEAD_C[2] - 0.03), 0.03));
    c = Math.min(c, soft(HEAD_C[2] + 0.085 - z, 0.03));
    return c;
  };

  /**
   * Masque du bouc : une touffe sur le menton, sous la lèvre. Empilé en
   * ellipsoïdes, il se lisait — comme les favoris — en chapelet de perles.
   */
  const goateeMask = (x: number, y: number, z: number) => {
    const r = Math.hypot(x / 0.04, (y - 0.032) / 0.05);
    let c = soft(1 - r, 0.28);
    c = Math.min(c, soft(z - (HEAD_C[2] + 0.01), 0.04));
    return c;
  };

  /**
   * Coquille de barbe, prise dans la surface du crâne.
   *
   * On repart de la forme de la tête : la barbe épouse ainsi le menton
   * exactement, quelle que soit la tête. Deux choses se jouent ici.
   *
   * **Le dessin.** Le premier masque gardait tout ce qui a `y < 0.152`, or
   * 0,152 est l'équateur du crâne, sa hauteur la plus large : la coquille
   * prenait les joues entières jusqu'aux pommettes et courait presque jusqu'à
   * la nuque — le pâté brun de la capture. Le contour suit maintenant le vrai
   * galbe : bas sous la lèvre, haut sur les flancs jusqu'au favori, et une
   * ouverture découpée autour de la bouche.
   *
   * **Le bord.** Découper des triangles dans une maille donne toujours un
   * escalier, et il se voyait sur la joue. On ne découpe donc plus : c'est
   * **l'épaisseur du poil** qui s'éteint sur le contour. Au bord, la coquille
   * rejoint la peau et disparaît dedans — un dégradé, comme une vraie barbe,
   * plutôt qu'une arête.
   */
  const jawShell = (thickness: number, mask: (x: number, y: number, z: number) => number) => {
    // La finesse de la maille commande celle du contour : le bord de la barbe
    // est une courbe découpée dedans, et à quarante-quatre secteurs il
    // retombait en escalier sur la joue. La coquille n'est conservée qu'au
    // quart de la sphère, le surcoût reste tenable.
    const g = headShape(0, 72).toNonIndexed();
    const pos = g.attributes.position;
    const kept: number[] = [];

    const coverage = mask;

    /**
     * Découpe du contour sur l'isoligne, et non sur la maille.
     *
     * Garder ou jeter des triangles entiers fait suivre au bord de la barbe
     * les rangs de la sphère : un escalier de huit millimètres bien visible
     * sur la joue. Chaque triangle à cheval est donc **recoupé** exactement là
     * où la densité de poil tombe au seuil, par interpolation le long de ses
     * arêtes. Le bord devient une courbe lisse sans qu'il faille densifier la
     * maille. On a d'abord tenté de fondre la teinte du poil vers la peau sur
     * le contour ; en vain, car un dégradé ne peut pas être plus fin qu'un
     * rang de maille — soit il tient dans un rang et retombe en escalier, soit
     * il s'étale et délave la barbe entière. Le contour exact suffit.
     */
    const TAU = 0.06;
    /** Un sommet du découpage : sa position sur la peau, et sa densité. */
    type Cut = { x: number; y: number; z: number; c: number };
    const between = (a: Cut, b: Cut): Cut => {
      const t = (TAU - a.c) / (b.c - a.c);
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
        c: TAU,
      };
    };
    const emit = (v: Cut) => {
      // Déplacement radial depuis le centre du crâne : sur une forme quasi
      // sphérique, c'est la normale à un cheveu près. Un demi-millimètre de
      // garde même à densité nulle, sinon la coquille est coplanaire à la peau
      // et les deux surfaces se disputent la profondeur.
      const dx = v.x - HEAD_C[0];
      const dy = v.y - HEAD_C[1];
      const dz = v.z - HEAD_C[2];
      const len = Math.hypot(dx, dy, dz) || 1;
      const t = (thickness * v.c + 0.0006) / len;
      kept.push(v.x + dx * t, v.y + dy * t, v.z + dz * t);
    };

    for (let i = 0; i < pos.count; i += 3) {
      const tri: Cut[] = [];
      for (let k = 0; k < 3; k++) {
        const x = pos.getX(i + k);
        const y = pos.getY(i + k);
        const z = pos.getZ(i + k);
        tri.push({ x, y, z, c: coverage(x, y, z) });
      }
      const inside = tri.filter((v) => v.c >= TAU).length;
      if (inside === 0) continue;
      if (inside === 3) {
        for (const v of tri) emit(v);
        continue;
      }
      // Triangle à cheval : on garde le polygone au-dessus du seuil, puis on
      // le retriangule en éventail.
      const poly: Cut[] = [];
      for (let k = 0; k < 3; k++) {
        const a = tri[k];
        const b = tri[(k + 1) % 3];
        if (a.c >= TAU) poly.push(a);
        if (a.c >= TAU !== b.c >= TAU) poly.push(between(a, b));
      }
      for (let k = 1; k + 1 < poly.length; k++) {
        emit(poly[0]);
        emit(poly[k]);
        emit(poly[k + 1]);
      }
    }
    g.dispose();
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(kept, 3));
    out.computeVertexNormals();
    // `mergeAll` exige les mêmes attributs partout : la barbe voisine des
    // sphères, qui portent aussi des UV.
    out.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(new Float32Array((kept.length / 3) * 2), 2),
    );
    return out;
  };

  if (kind === "stubble") {
    head.add("beard", jawShell(0.0035, jawMask(-0.014)));
    moustache();
    return;
  }
  if (kind === "moustache") {
    moustache();
    return;
  }
  if (kind === "goatee") {
    moustache();
    head.add("beard", jawShell(0.008, goateeMask));
    return;
  }
  if (kind === "chops") {
    head.add("beard", jawShell(0.006, chopMask));
    return;
  }
  // full : la coquille couvre la mâchoire, et le menton reçoit une seconde
  // couche prise dans la même surface — plus épaisse, donc plus fournie là où
  // une barbe l'est vraiment.
  head.add("beard", jawShell(0.008, jawMask(0.0)));
  head.add("beard", jawShell(0.013, goateeMask));
  moustache();
}

/* ------------------------------------------------------------------ */
/* Chapeaux                                                            */
/* ------------------------------------------------------------------ */

/**
 * Hauteur de la ligne de coiffe : juste au-dessus des oreilles, comme se porte
 * un chapeau. Les calots montent de là jusque vers 0,36 — le crâne culmine à
 * 0,318, il faut donc les loger au-dessus sans les faire flotter.
 */
const HAT_Y = HAT_LINE;

function addHat(head: Node, look: CharacterAppearance) {
  const kind = HATS[look.hat]?.id ?? "none";
  if (kind === "none") return;
  const y = HAT_Y;
  /**
   * Rayon de coiffe : celui du crâne à cette hauteur, plus l'épaisseur du
   * tissu. Il était codé en dur à 138 mm pour un crâne qui en mesure 119 —
   * dix-neuf millimètres de jour tout autour, et un chapeau plus large que le
   * point le plus large de la tête. Il ne se posait pas, il flottait.
   */
  const fit = headHalfWidth(HAT_Y) + 0.004;

  if (kind === "straw") {
    // Bord tourné au tour, légèrement retombant : c'est la courbe qui fait le
    // canotier, pas la couleur.
    head.add(
      "hat",
      lathe(
        [
          [0.0, 0.135],
          [0.085, 0.132],
          [0.12, 0.112],
          [fit, 0.024],
          [0.18, 0.012],
          [0.214, -0.006],
          [0.217, -0.019],
          [0.172, -0.001],
          [fit - 0.008, 0.008],
          [0.112, 0.11],
          [0.078, 0.13],
          [0.0, 0.125],
        ].map(([r, h]) => [r, h + y]) as [number, number][],
        22,
        [0, 0, 0],
        [0, 0, 0],
      ),
    );
    head.add("leather", place(new THREE.TorusGeometry(fit - 0.014, 0.012, 6, 22), [0, y + 0.05, 0], [HALF, 0, 0]));
    return;
  }

  if (kind === "cap") {
    const crown = domeCap(fit, Math.PI * 0.5, [0, 0, 0], undefined, 22);
    crown.scale(1, 0.95, 1.02);
    head.add("hat", place(crown, [0, y - 0.005, -0.004]));
    // Visière : un anneau aplati, découpé en demi-cercle et incliné.
    const visor = new THREE.CylinderGeometry(fit + 0.012, fit + 0.012, 0.013, 22, 1, false, HALF * 0.55, Math.PI * 0.9);
    visor.scale(1, 1, 1.36);
    head.add("hat", place(visor, [0, y - 0.006, 0.026], [-0.18, 0, 0]));
    head.add("hatDark", place(new THREE.TorusGeometry(fit, 0.011, 6, 22), [0, y - 0.004, 0], [HALF, 0, 0]));
    head.add("metal", ell(0.011, 0.011, 0.011, [0, y + 0.145, -0.004]));
    return;
  }

  if (kind === "beanie") {
    const crown = domeCap(fit + 0.008, Math.PI * 0.54, [0, 0, 0], undefined, 22);
    crown.scale(1, 1.08, 1);
    head.add("hat", place(crown, [0, y - 0.012, -0.004]));
    // Le revers : un bourrelet roulé, ce qui distingue un bonnet d'une calotte.
    head.add("hatDark", place(new THREE.TorusGeometry(fit + 0.006, 0.023, 8, 24), [0, y - 0.008, -0.004], [HALF, 0, 0]));
    head.add("accent", ell(0.036, 0.034, 0.036, [0, y + 0.175, -0.004]));
    return;
  }

  if (kind === "cowboy") {
    head.add(
      "hat",
      lathe(
        [
          [0.0, 0.185],
          [0.075, 0.18],
          [0.115, 0.14],
          [fit, 0.03],
          [0.19, 0.008],
          [0.275, 0.03],
          [0.278, 0.016],
          [0.188, -0.006],
          [fit - 0.008, 0.014],
          [0.107, 0.135],
          [0.07, 0.172],
          [0.0, 0.175],
        ].map(([r, h]) => [r, h + y]) as [number, number][],
        22,
        [0, 0, 0],
        [0, 0, 0],
      ),
    );
    // Le pli du calot : deux creux latéraux, la signature du chapeau.
    for (const side of [-1, 1]) {
      head.add("hat", ell(0.028, 0.055, 0.07, [side * 0.088, y + 0.115, -0.004]));
    }
    head.add("accent", place(new THREE.TorusGeometry(fit - 0.008, 0.014, 6, 22), [0, y + 0.045, 0], [HALF, 0, 0]));
    return;
  }

  if (kind === "beret") {
    // Galette posée de travers, avec sa queue au sommet.
    const g = domeCap(fit + 0.035, Math.PI * 0.52, [0, 0, 0], undefined, 22);
    g.scale(1, 0.46, 1);
    head.add("hat", place(g, [0.014, y + 0.03, -0.012], [0.06, 0, 0.22]));
    head.add("hatDark", place(new THREE.TorusGeometry(fit - 0.004, 0.014, 6, 22), [0.014, y + 0.014, -0.012], [HALF + 0.06, 0, 0.22]));
    head.add("hat", cyl(0.008, 0.008, 0.028, 6, [0.03, y + 0.115, -0.012], [0, 0, 0.22]));
    return;
  }

  // bandana : un serre-tête noué sur la nuque
  const capG = domeCap(fit, Math.PI * 0.44, [0, 0, 0], undefined, 20);
  capG.scale(1, 0.92, 1);
  head.add("hat", place(capG, [0, y - 0.004, -0.004]));
  head.add("hat", place(new THREE.TorusGeometry(fit - 0.002, 0.022, 8, 24), [0, y - 0.004, -0.004], [HALF, 0, 0]));
  head.add("hat", ell(0.03, 0.026, 0.03, [0, y - 0.01, -0.155]));
  for (const side of [-1, 1]) {
    head.add("hat", ell(0.012, 0.05, 0.02, [side * 0.022, y - 0.062, -0.155], [0, 0, side * 0.3]));
  }
}

/* ------------------------------------------------------------------ */
/* Corps et vêtements                                                  */
/* ------------------------------------------------------------------ */

/**
 * Cotes du buste, dans le repère de l'articulation « chest ».
 *
 * Même règle que pour le visage : les pièces d'un vêtement — bavette, revers,
 * boutonnière — se posent **sur** cette enveloppe. Un détail placé à une
 * profondeur devinée finit noyé dans le torse, et le vêtement se réduit à sa
 * couleur.
 */
const BUST: Vec3 = [0.172, 0.155, 0.112];
const BUST_Y = 0.27;
const WAIST: Vec3 = [0.134, 0.122, 0.09];
const WAIST_Y = 0.1;
const SHOULDER = BUST[0] + 0.05;

type Build = {
  /** Manches : longues, courtes, ou bras nus */
  sleeves: "long" | "short" | "none";
  /** Épaisseur ajoutée par le vêtement */
  bulk: number;
  /** Matière de l'enveloppe du buste */
  torso: CharMat;
  /** Matière des manches, quand il y en a */
  sleeve: CharMat;
  legs: CharMat;
};

function outfitOf(look: CharacterAppearance): Build {
  switch (CLOTHES[look.clothes]?.id) {
    case "shirt":
      return { sleeves: "long", bulk: 0.005, torso: "cloth", sleeve: "cloth", legs: "clothDark" };
    case "jacket":
      return { sleeves: "long", bulk: 0.016, torso: "cloth", sleeve: "cloth", legs: "clothDark" };
    case "coverall":
      return { sleeves: "long", bulk: 0.012, torso: "cloth", sleeve: "cloth", legs: "cloth" };
    case "sweater":
      return { sleeves: "long", bulk: 0.024, torso: "cloth", sleeve: "cloth", legs: "clothDark" };
    case "vest":
      return { sleeves: "none", bulk: 0.016, torso: "cloth", sleeve: "skin", legs: "clothDark" };
    default:
      // Salopette : chemise de toile dessous, bavette et pantalon en tissu.
      return { sleeves: "short", bulk: 0.006, torso: "linen", sleeve: "linen", legs: "cloth" };
  }
}

/** Profondeur de la surface d'un ellipsoïde, à une hauteur et un écart donnés. */
function surfaceZ(r: Vec3, c: Vec3, x: number, y: number): number {
  const dx = (x - c[0]) / r[0];
  const dy = (y - c[1]) / r[1];
  const k = 1 - dx * dx - dy * dy;
  return k <= 0 ? c[2] : c[2] + r[2] * Math.sqrt(k);
}

/** Surface de l'enveloppe du buste, à une hauteur donnée, dans l'axe. */
function bustZ(y: number, b: number): number {
  return Math.max(
    surfaceZ([BUST[0] + b, BUST[1] + b, BUST[2] + b], [0, BUST_Y, 0], 0, y),
    surfaceZ([WAIST[0] + b, WAIST[1] + b, WAIST[2] + b], [0, WAIST_Y, 0], 0, y),
  );
}

function addTorso(chest: Node, look: CharacterAppearance, fit: Build) {
  const kind = CLOTHES[look.clothes]?.id ?? "overalls";
  const b = fit.bulk;
  /** Pièce plaquée sur le devant du buste, épaisseur comprise. */
  const front = (y: number, out = 0.004) => bustZ(y, b) + out;
  /** Plaque suivant le galbe de la poitrine. */
  /** Plaque centrée sur la poitrine, de demi-largeur angulaire `span`. */
  const bustPlate = (yTop: number, yBottom: number, span: number, out: number) =>
    plate(BUST, [0, BUST_Y, 0], yTop, yBottom, -span, span, b + out);
  /**
   * Incrustation en V au milieu de la poitrine : la chemise vue dans
   * l'ouverture d'une veste, ou le revers posé le long de cette ouverture.
   *
   * `side` restreint la pièce à une moitié, et `thickness` la réduit à une
   * bande le long du bord — c'est ainsi qu'on obtient un revers sans avoir à
   * découper quoi que ce soit.
   */
  const vInset = (
    yTop: number,
    yBottom: number,
    topHalf: number,
    bottomHalf: number,
    out: number,
    side = 0,
    thickness = 0,
  ) => {
    const bands = 9;
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < bands; i++) {
      const a = i / bands;
      const c2 = (i + 1.05) / bands;
      const yA = yTop + (yBottom - yTop) * a;
      const yB = yTop + (yBottom - yTop) * c2;
      const half = topHalf + (bottomHalf - topHalf) * Math.pow(a, 0.85);
      const from = side === 0 ? -half : side > 0 ? Math.max(0, half - thickness) : -half;
      const to = side === 0 ? half : side > 0 ? half : Math.min(0, -half + thickness);
      pieces.push(plate(BUST, [0, BUST_Y, 0], yA, yB, from, to, b + out));
    }
    return pieces;
  };

  /** Pan de devant gauche ou droit d'un vêtement ouvert. */
  const front2 = (
    side: number,
    yTop: number,
    yBottom: number,
    collar: number,
    wide: number,
    hem: number,
    outer: number,
    out: number,
  ) =>
    frontPanel(
      BUST,
      [0, BUST_Y, 0],
      yTop,
      yBottom,
      side * collar,
      side * wide,
      side * hem,
      side * outer,
      b + out,
    );

  // Buste : cage thoracique large en haut, taille resserrée. Deux ellipsoïdes
  // qui se recouvrent valent mieux qu'une boîte.
  chest.add(fit.torso, ell(BUST[0] + b, BUST[1] + b, BUST[2] + b, [0, BUST_Y, 0]));
  chest.add(fit.torso, ell(WAIST[0] + b, WAIST[1] + b, WAIST[2] + b, [0, WAIST_Y, 0]));
  // Épaules : la ligne qui donne la carrure, et le raccord avec le bras.
  for (const side of [-1, 1]) {
    chest.add(fit.torso, ell(0.082 + b, 0.072 + b, 0.092 + b, [side * (BUST[0] - 0.016), 0.335, 0]));
  }
  // Cou, pris dans le buste.
  chest.add("skin", cap(0.05, 0.08, [0, 0.44, 0.004]));

  if (kind === "overalls") {
    // Bavette : une plaque rectangulaire épousant la poitrine, ses bretelles
    // par-dessus l'épaule et son gousset au milieu.
    chest.add("cloth", bustPlate(0.375, 0.16, 0.62, 0.014));
    // Sous la bavette, la toile devient le haut du pantalon : sans ça, le
    // ventre de la chemise reste nu entre les deux.
    chest.add("cloth", ell(WAIST[0] + b + 0.008, 0.1, WAIST[2] + b + 0.008, [0, 0.055, 0]));
    for (const side of [-1, 1]) {
      chest.add("cloth", box(0.042, 0.2, 0.024, [side * 0.082, 0.335, 0.076], [0.36, 0, side * 0.04]));
      chest.add("cloth", box(0.042, 0.19, 0.024, [side * 0.094, 0.325, -0.082], [-0.32, 0, side * 0.05]));
      // Boucle de bretelle, à la jonction avec la bavette.
      const y = 0.352;
      chest.add("metal", box(0.024, 0.024, 0.012, [side * 0.074, y, front(y) + 0.008]));
    }
    chest.add("accent", roundedBox(0.062, 0.046, 0.016, 0.012, [0, 0.238, front(0.238) + 0.008]));
  } else if (kind === "jacket") {
    // Le vêtement habille tout le buste — épaules et taille comprises — et la
    // chemise s'incruste **dans** l'ouverture.
    //
    // L'inverse avait été tenté : un torse en toile, des pans de veste plaqués
    // dessus. Les épaules et la taille sont des volumes distincts du buste, si
    // bien qu'elles ressortaient en blanc de part et d'autre des pans, et le
    // personnage semblait porter une veste trouée.
    for (const g of vInset(0.425, 0.15, 0.58, 0.04, 0.006)) chest.add("linen", g);
    for (const side of [-1, 1] as const) {
      // Revers : une bande rabattue le long de l'ouverture, un peu plus large
      // en haut qu'en bas.
      for (const g of vInset(0.425, 0.17, 0.62, 0.1, 0.016, side, 0.16)) {
        chest.add("clothDark", g);
      }
      chest.add("clothDark", roundedBox(0.062, 0.05, 0.02, 0.014, [side * 0.1, 0.115, front(0.115) + 0.004]));
    }
    // Boutonnage sous la pointe du V, là où la veste se ferme vraiment.
    for (let i = 0; i < 3; i++) {
      const y = 0.135 - i * 0.052;
      chest.add("metal", ell(0.009, 0.009, 0.006, [0.026, y, front(y) + 0.012]));
    }
    chest.add("clothDark", place(new THREE.TorusGeometry(0.072, 0.024, 8, 20), [0, 0.425, 0.004], [HALF, 0, 0]));
  } else if (kind === "sweater") {
    // Côtes : le col roulé et le bas de maille, marqués par des anneaux —
    // c'est ce qui fait lire de la laine plutôt que du plastique.
    chest.add("cloth", place(new THREE.TorusGeometry(0.064, 0.03, 8, 20), [0, 0.435, 0.004], [HALF, 0, 0]));
    // Côte de taille : trois anneaux fins et rentrants. Un bourrelet unique
    // faisait ceinture, ce qui est exactement ce qu'un pull n'a pas.
    for (let i = 0; i < 3; i++) {
      chest.add("clothDark", place(
        new THREE.TorusGeometry(WAIST[0] + b - 0.012 - i * 0.004, 0.007, 6, 22),
        [0, -0.012 + i * 0.017, 0],
        [HALF, 0, 0],
      ));
    }
  } else if (kind === "vest") {
    // Gilet de travail : fermé, sans manches. Le premier essai l'ouvrait sur
    // une chemise — mais des bras nus sous une chemise ouverte n'ont aucun
    // sens. Fermé, il se lit d'un coup d'œil et le bras reste libre.
    chest.add("clothDark", place(new THREE.TorusGeometry(0.07, 0.022, 8, 20), [0, 0.42, 0.004], [HALF, 0, 0]));
    // Emmanchures bordées : c'est le liseré qui dit « sans manches ».
    for (const side of [-1, 1] as const) {
      chest.add("clothDark", place(
        new THREE.TorusGeometry(0.078, 0.014, 6, 18),
        [side * (BUST[0] - 0.006), 0.325, 0],
        [0, 0, HALF + side * 0.24],
      ));
      // Grande poche plaquée à rabat : la pièce qui dit « gilet de travail ».
      chest.add("clothDark", roundedBox(0.066, 0.058, 0.018, 0.014, [side * 0.088, 0.15, front(0.15) + 0.004]));
      chest.add("accent", roundedBox(0.07, 0.016, 0.014, 0.006, [side * 0.088, 0.183, front(0.183) + 0.004]));
    }
    // Fermeture éclair au milieu, tirette comprise.
    chest.add("metal", box(0.011, 0.32, 0.01, [0, 0.24, front(0.24) + 0.01]));
    chest.add("metal", roundedBox(0.016, 0.028, 0.008, 0.006, [0, 0.078, front(0.078) + 0.014]));
  } else if (kind === "shirt") {
    // Col ouvert, patte de boutonnage, quatre boutons.
    for (const side of [-1, 1]) {
      chest.add("linen", box(0.062, 0.058, 0.02, [side * 0.042, 0.4, front(0.4) - 0.014], [0.3, 0, side * 0.35]));
      chest.add("clothDark", roundedBox(0.058, 0.046, 0.016, 0.012, [side * 0.09, 0.19, front(0.19) + 0.006]));
    }
    chest.add("linen", bustPlate(0.38, 0.12, 0.13, 0.01));
    for (let i = 0; i < 4; i++) {
      const y = 0.36 - i * 0.072;
      chest.add("metal", ell(0.008, 0.008, 0.006, [0, y, front(y) + 0.012]));
    }
  } else {
    // coverall : fermeture pleine longueur, col rabattu, ceinture de taille
    chest.add("metal", box(0.014, 0.34, 0.012, [0, 0.24, front(0.24) + 0.008]));
    chest.add("clothDark", place(new THREE.TorusGeometry(0.066, 0.02, 8, 18), [0, 0.43, 0.004], [HALF, 0, 0]));
    chest.add("clothDark", place(new THREE.TorusGeometry(WAIST[0] + b - 0.004, 0.014, 6, 22), [0, 0.07, 0], [HALF, 0, 0]));
    for (const side of [-1, 1]) {
      chest.add("accent", roundedBox(0.056, 0.046, 0.016, 0.012, [side * 0.082, 0.17, front(0.17) + 0.008]));
    }
  }
}

/**
 * Bras : le haut porte la manche, l'avant-bras est toujours nu — c'est ainsi
 * qu'on travaille, et ça évite un tube de tissu uniforme du col au poignet.
 */
function addArm(shoulder: Node, fit: Build) {
  // Le bras nu d'abord : la manche vient par-dessus, jamais à la place.
  shoulder.add("skin", limb(0.05, 0.042, 0.24, [0, 0, 0]));
  if (fit.sleeves === "short") {
    shoulder.add(fit.sleeve, limb(0.057 + fit.bulk, 0.05, 0.115, [0, 0.012, 0]));
  } else if (fit.sleeves === "long") {
    shoulder.add(fit.sleeve, limb(0.057 + fit.bulk, 0.047 + fit.bulk, 0.225, [0, 0.012, 0]));
    // Manche retroussée : le bourrelet au coude, tel qu'on porte une chemise
    // de travail.
    shoulder.add("clothDark", place(new THREE.TorusGeometry(0.048, 0.013, 6, 16), [0, -0.213, 0], [HALF, 0, 0]));
  }
}

function addForearm(fore: Node) {
  fore.add("skin", limb(0.043, 0.033, 0.23, [0, 0, 0]));
}

/** Main au repos : paume, quatre doigts groupés, pouce en dehors. */
function addHand(hand: Node, side: number) {
  hand.add("skin", ell(0.036, 0.046, 0.026, [0, -0.036, 0]));
  hand.add("skin", cap(0.017, 0.042, [0, -0.086, 0.004], [0.22, 0, 0]));
  // Le pouce écarte la main du corps : sans lui, c'est une moufle.
  hand.add("skin", cap(0.013, 0.03, [side * -0.03, -0.05, 0.008], [0, 0, side * 0.75]));
}

function addLegs(hips: Node, look: CharacterAppearance, fit: Build) {
  const kind = CLOTHES[look.clothes]?.id ?? "overalls";
  // Bassin : la culotte du pantalon, qui relie les deux cuisses.
  hips.add(fit.legs, ell(0.142, 0.105, 0.1, [0, -0.028, 0]));
  if (kind !== "overalls" && kind !== "coverall") {
    hips.add("leather", place(new THREE.TorusGeometry(0.142, 0.018, 6, 20), [0, 0.035, 0], [HALF, 0, 0]));
    hips.add("metal", box(0.045, 0.04, 0.016, [0, 0.035, 0.128]));
  }

  // Chaîne de jambe, cotée depuis le sol : hanche 0,78 — genou 0,42 —
  // cheville 0,085 — semelle 0. Les articulations pivotent au sommet du
  // segment qu'elles portent, sinon la jambe se plie au milieu de l'os.
  for (const side of [-1, 1] as const) {
    const thigh = hips.joint(side < 0 ? "thighL" : "thighR", [side * 0.082, -0.06, 0]);
    thigh.add(fit.legs, limb(0.072, 0.058, 0.36, [0, 0, 0]));

    const shin = thigh.joint(side < 0 ? "shinL" : "shinR", [0, -0.36, 0]);
    shin.add(fit.legs, limb(0.058, 0.042, 0.3, [0, 0, 0]));
    // Bas de jambe rentré dans la botte.
    shin.add("leather", limb(0.058, 0.055, 0.16, [0, -0.18, 0]));

    const foot = shin.joint(side < 0 ? "footL" : "footR", [0, -0.335, 0]);
    foot.add("leather", roundedBox(0.098, 0.09, 0.2, 0.028, [0, -0.04, 0.032]));
    // Semelle : plus large que la tige, c'est elle qui pose au sol.
    foot.add("leather", roundedBox(0.108, 0.026, 0.215, 0.012, [0, -0.072, 0.034]));
    foot.add("skinShade", box(0.092, 0.01, 0.2, [0, -0.081, 0.034]));
  }
}

/* ------------------------------------------------------------------ */
/* Accessoire de métier                                                */
/* ------------------------------------------------------------------ */

function addProp(prop: Node, spec?: Specialization) {
  if (spec === "CEREALIER") {
    // Tige montant du sol, jamais dessous : l'accessoire est planté, pas posé.
    prop.add("accent", cyl(0.007, 0.011, 0.46, 6, [0, 0.23, 0], [0, 0, 0.05]));
    for (const y of [0.16, 0.3]) {
      prop.add("accent", box(0.012, 0.11, 0.004, [0.03, y, 0], [0, 0, -0.7]));
    }
    // Épi : des grains en quinconce, pas un cône.
    for (let i = 0; i < 7; i++) {
      const y = 0.47 + i * 0.026;
      const s = 1 - i * 0.09;
      for (const side of [-1, 1]) {
        prop.add("accent", ell(0.016 * s, 0.012 * s, 0.012 * s, [side * 0.014 * s, y, 0], [0, 0, side * 0.5]));
      }
      prop.add("accent", cyl(0.001, 0.003, 0.05, 4, [0.006, y + 0.03, 0], [0, 0, 0.25]));
    }
    return;
  }
  if (spec === "ELEVEUR") {
    // Un veau, coté depuis ses sabots : garrot 0,28 — sabots 0.
    const hide = "linen" as const;
    prop.add(hide, ell(0.13, 0.085, 0.085, [0, 0.22, 0]));
    prop.add("leather", ell(0.05, 0.04, 0.05, [0.045, 0.25, 0.03]));
    prop.add(hide, ell(0.065, 0.06, 0.06, [-0.14, 0.25, 0]));
    prop.add("lip", ell(0.038, 0.032, 0.035, [-0.185, 0.225, 0.005]));
    for (const side of [-1, 1]) {
      prop.add(hide, ell(0.018, 0.028, 0.012, [-0.13, 0.295, side * 0.045], [side * 0.4, 0, 0.3]));
    }
    for (const [lx, lz] of [
      [-0.06, 0.05],
      [-0.06, -0.05],
      [0.07, 0.05],
      [0.07, -0.05],
    ]) {
      prop.add(hide, limb(0.022, 0.018, 0.12, [lx, 0.19, lz]));
      prop.add("leather", ell(0.026, 0.018, 0.028, [lx, 0.018, lz + 0.004]));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Montage                                                             */
/* ------------------------------------------------------------------ */

export type CharacterPose = {
  /** Secondes écoulées : respiration, clignement, balancement */
  t: number;
  /** Distance parcourue : c'est elle qui règle le pas, jamais le temps */
  distance?: number;
  walking?: boolean;
  /** Salut de la main — 0 à 1, monté et descendu par l'appelant */
  wave?: number;
  /** Penché sur l'ouvrage */
  working?: boolean;
  /** Cible du regard, en radians autour de Y */
  look?: number;
};

export type CharacterRig = {
  group: THREE.Group;
  joints: Partial<Record<Joint, THREE.Group>>;
  /** Hauteur totale, sommet du chapeau compris */
  height: number;
  update(pose: CharacterPose): void;
  dispose(): void;
};

/** Longueur d'une foulée : deux pas par cycle complet de jambes. */
const STRIDE = 0.72;

function plan(look: CharacterAppearance, opts: { spec?: Specialization; prop?: boolean }): Node {
  const fit = outfitOf(look);
  const root = new Node();

  const hips = root.joint("hips", [0, 0.84, 0]);
  addLegs(hips, look, fit);

  const chest = hips.joint("chest", [0, 0.06, 0]);
  addTorso(chest, look, fit);

  for (const side of [-1, 1] as const) {
    // Bras au repos : écarté du buste, coude à peine fléchi, avant-bras
    // légèrement rentré. Deux bras rigoureusement verticaux font un pantin.
    const arm = chest.joint(side < 0 ? "armL" : "armR", [side * SHOULDER, 0.33, 0], [0.04, 0, side * 0.12]);
    addArm(arm, fit);
    const fore = arm.joint(side < 0 ? "foreL" : "foreR", [0, -0.24, 0], [0.1, 0, side * -0.06]);
    addForearm(fore);
    const hand = fore.joint(side < 0 ? "handL" : "handR", [0, -0.23, 0]);
    addHand(hand, side);
  }

  const head = chest.joint("head", [0, 0.47, 0.004]);
  head.add("skin", headShape());
  // Pas de pommettes rapportées : deux essais ont donné deux excroissances sur
  // les joues. Le galbe du crâne et de la mâchoire suffit — un relief de plus
  // se voit comme une verrue, jamais comme un os.

  addEars(head, look);
  addEyes(head, look);
  addNose(head, look);
  addMouth(head, look);
  addBeard(head, look);
  addHair(head, look, (HATS[look.hat]?.id ?? "none") !== "none");
  addHat(head, look);

  if (opts.prop) {
    // L'accessoire est planté au sol à côté du personnage : il ne suit ni le
    // bras ni la respiration, il attend.
    const prop = root.joint("prop", [0.5, 0, 0.08], [0, -0.5, 0]);
    addProp(prop, opts.spec);
  }

  return root;
}

/**
 * Personnage complet, articulé.
 *
 * `seed` décale les cycles d'inactivité : deux voisins qui respirent et
 * clignent des yeux à l'unisson trahissent tout de suite la mécanique.
 */
export function createCharacterRig(
  look: CharacterAppearance,
  opts: { spec?: Specialization; prop?: boolean; shadows?: boolean; seed?: number } = {},
): CharacterRig {
  const materials = createCharacterMaterials(look);
  const joints: Partial<Record<Joint, THREE.Group>> = {};
  const group = plan(look, opts).build(materials, joints, opts.shadows ?? false);
  group.name = "character";

  const seed = opts.seed ?? 0;
  const box3 = new THREE.Box3().setFromObject(group);
  const height = box3.max.y;

  const rest = (j: THREE.Group | undefined) =>
    (j?.userData.rest as { x: number; y: number; z: number; py: number }) ?? {
      x: 0,
      y: 0,
      z: 0,
      py: 0,
    };

  /** Amorti d'une valeur vers sa cible : rien ne doit sauter d'une image à l'autre. */
  let leanNow = 0;
  let waveNow = 0;

  function update(pose: CharacterPose): void {
    const t = pose.t + seed * 1.7;
    const { hips, chest, head, armL, armR, foreL, foreR, thighL, thighR, shinL, shinR, footL, footR } =
      joints;

    const target = pose.working ? 1 : 0;
    leanNow += (target - leanNow) * 0.08;
    waveNow += ((pose.wave ?? 0) - waveNow) * 0.12;

    // Respiration : la cage se soulève, le corps monte d'un millimètre.
    const breath = Math.sin(t * 1.5);
    if (chest) {
      const r = rest(chest);
      chest.scale.set(1 + breath * 0.014, 1 + breath * 0.008, 1 + breath * 0.018);
      chest.rotation.x = r.x + breath * 0.012 + leanNow * 0.42;
    }

    // Report du poids d'un pied sur l'autre : c'est ce qui empêche la pose de
    // paraître figée.
    const sway = Math.sin(t * 0.42);
    if (hips) {
      const r = rest(hips);
      hips.rotation.z = r.z + sway * 0.028;
      hips.rotation.y = Math.sin(t * 0.31) * 0.035;
      hips.position.y = r.py - Math.abs(sway) * 0.008 - leanNow * 0.05;
    }

    if (head) {
      const r = rest(head);
      head.rotation.y = r.y + (pose.look ?? 0) + Math.sin(t * 0.37) * 0.16;
      head.rotation.x = r.x + Math.sin(t * 0.29) * 0.05 - leanNow * 0.2;
      head.rotation.z = r.z + Math.sin(t * 0.23) * 0.03;
    }

    // Clignement : trois secondes environ, jamais tout à fait régulier.
    const cycle = (t * 0.31) % 1;
    const blink = cycle < 0.05 ? Math.sin((cycle / 0.05) * Math.PI) : 0;
    for (const key of ["lidL", "lidR"] as const) {
      const lid = joints[key];
      if (!lid) continue;
      const r = rest(lid);
      // Fermé, la paupière dépasse un peu la verticale : elle doit recouvrir
      // le globe, pas l'affleurer.
      lid.rotation.x = r.x + blink * (LID_CLOSED - r.x);
    }
    for (const key of ["browL", "browR"] as const) {
      const brow = joints[key];
      if (!brow) continue;
      const r = rest(brow);
      brow.position.y = r.py + Math.sin(t * 0.6) * 0.004 - blink * 0.006;
    }

    // Marche : la phase vient de la distance, comme les roues des engins. Deux
    // personnages côte à côte à la même vitesse posent le pied ensemble.
    const phase = ((pose.distance ?? 0) / STRIDE) * Math.PI * 2;
    const gait = pose.walking ? 1 : 0;
    const swing = Math.sin(phase);
    const lift = Math.cos(phase);

    for (const [thigh, shin, foot, dir] of [
      [thighL, shinL, footL, 1],
      [thighR, shinR, footR, -1],
    ] as const) {
      if (!thigh || !shin || !foot) continue;
      const s = swing * dir;
      thigh.rotation.x = rest(thigh).x + s * 0.62 * gait;
      // Le genou ne plie que vers l'arrière, et surtout au retour de jambe.
      shin.rotation.x = rest(shin).x - Math.max(0, -s) * 0.9 * gait;
      foot.rotation.x = rest(foot).x + (0.25 - s * 0.3) * gait;
    }
    if (hips && gait) hips.position.y += Math.abs(lift) * 0.022;

    for (const [arm, fore, dir] of [
      [armL, foreL, -1],
      [armR, foreR, 1],
    ] as const) {
      if (!arm || !fore) continue;
      const r = rest(arm);
      const idle = Math.sin(t * 1.5 + (dir > 0 ? 0 : Math.PI)) * 0.04;
      arm.rotation.x = r.x + swing * dir * 0.5 * gait + idle * (1 - gait) + leanNow * 0.5;
      arm.rotation.z = r.z + leanNow * dir * -0.12;
      fore.rotation.x = rest(fore).x - 0.12 - Math.max(0, swing * dir) * 0.5 * gait - leanNow * 0.7;
    }

    // Salut : le bras droit monte, l'avant-bras balaie.
    if (waveNow > 0.002 && armR && foreR) {
      const r = rest(armR);
      armR.rotation.z = r.z - waveNow * 2.15;
      armR.rotation.x = r.x - waveNow * 0.25;
      foreR.rotation.z = rest(foreR).z + waveNow * (0.35 + Math.sin(t * 9) * 0.45);
      foreR.rotation.x = rest(foreR).x;
    }
  }

  function dispose(): void {
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
    for (const m of Object.values(materials)) m.dispose();
  }

  update({ t: 0 });
  return { group, joints, height, update, dispose };
}

/**
 * Personnage figé, sans articulation exposée.
 *
 * C'est la forme dont la parcelle a besoin : des dizaines d'ouvriers dont on ne
 * fait rien d'autre que les poser au champ.
 */
export function buildCharacter(
  appearance: CharacterAppearance,
  opts: { spec?: Specialization; prop?: boolean; shadows?: boolean } = {},
): THREE.Group {
  return createCharacterRig(appearance, opts).group;
}
