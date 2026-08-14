import * as THREE from "three";
import { HALF, mergeAll, place, type Vec3 } from "./machine-kit";

/**
 * Les bêtes.
 *
 * Même méthode que les engins et les personnages : géométrie procédurale,
 * fusionnée par matière, montée sur des articulations nommées. La version
 * précédente était un assemblage de boîtes et de cylindres en Lambert plat —
 * lisible, mais d'une autre époque que le reste de la ferme, et incapable de
 * dire autre chose que « dedans » ou « dehors ».
 *
 * Ce qu'une bête doit raconter sans qu'on ouvre un menu :
 *
 * - **son espèce**, à la silhouette ;
 * - **son bien-être** : une bête mal tenue a le poil terne, l'échine creuse et
 *   la tête basse ;
 * - **sa production en attente** : pis plein, toison épaisse ;
 * - **ce qu'elle fait** : elle broute, elle rumine, elle marche, elle se
 *   repose.
 *
 * Avant local = +Z, comme les machines et les personnages.
 */

export type AnimalKind = "COW" | "SHEEP" | "HEN" | "PIG";

export type AnimalJoint =
  | "body"
  | "neck"
  | "head"
  | "jaw"
  | "earL"
  | "earR"
  | "tail"
  | "wingL"
  | "wingR"
  | "udder"
  | "legFL"
  | "legFR"
  | "legBL"
  | "legBR";

/** Ce que la bête donne à voir de son état. */
export type AnimalLook = {
  /** Bien-être, 0 (mal tenue) à 1 (au mieux) */
  welfare?: number;
  /** Production en attente : lait, œufs, laine — 0 à 1 */
  yield?: number;
  /** Mouton tondu : la toison a été prise */
  sheared?: boolean;
};

export type AnimalPose = {
  t: number;
  /** Distance parcourue : c'est elle qui règle le pas, jamais le temps */
  distance?: number;
  walking?: boolean;
  /** Tête au sol, 0 à 1 */
  graze?: number;
  /** Couchée au repos */
  resting?: boolean;
  /** Décalage propre à la bête, pour qu'un troupeau ne soit pas un ballet */
  seed?: number;
};

export type AnimalRig = {
  group: THREE.Group;
  joints: Partial<Record<AnimalJoint, THREE.Group>>;
  /** Hauteur au garrot, pour poser la bête et cadrer la vue */
  height: number;
  update(pose: AnimalPose): void;
  dispose(): void;
};

/* ------------------------------------------------------------------ */
/* Matières                                                            */
/* ------------------------------------------------------------------ */

type Mat = "hide" | "hideDark" | "wool" | "horn" | "hoof" | "muzzle" | "eye" | "comb" | "udder";

type Materials = Record<Mat, THREE.Material>;

function shade(hex: number, amount: number): THREE.Color {
  const c = new THREE.Color(hex);
  const hsl = c.getHSL({ h: 0, s: 0, l: 0 });
  return c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1));
}

/**
 * Matières d'une bête.
 *
 * Le poil reçoit un `sheen` large : c'est le halo qu'on voit sur un animal à
 * contre-jour, et c'est ce qui le distingue d'une carrosserie peinte. Une bête
 * mal tenue perd ce halo et se ternit — le poil piqué, l'œil éteint. C'est le
 * même principe que l'usure des machines : l'état se lit sur la matière, pas
 * dans un menu.
 */
function createMaterials(base: number, look: AnimalLook): Materials {
  const w = THREE.MathUtils.clamp(look.welfare ?? 1, 0, 1);
  const dull = 1 - w;
  const coat = (hex: number, roughness = 0.82) =>
    new THREE.MeshPhysicalMaterial({
      color: shade(hex, -0.1 * dull).lerp(new THREE.Color(0x7d7466), dull * 0.5),
      roughness: roughness + dull * 0.14,
      metalness: 0,
      sheen: 0.6 * (1 - dull * 0.85),
      sheenRoughness: 0.7,
      sheenColor: shade(hex, 0.28),
    });

  return {
    hide: coat(base),
    hideDark: coat(0x3a2b22, 0.86),
    wool: new THREE.MeshPhysicalMaterial({
      color: shade(0xefe9dc, -0.08 * dull).lerp(new THREE.Color(0x9a9184), dull * 0.4),
      roughness: 0.96,
      metalness: 0,
      sheen: 0.9 * (1 - dull * 0.6),
      sheenRoughness: 0.95,
      sheenColor: new THREE.Color(0xfffaf0),
    }),
    horn: new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.5, metalness: 0.05 }),
    hoof: new THREE.MeshStandardMaterial({ color: 0x3b3129, roughness: 0.55, metalness: 0.05 }),
    muzzle: new THREE.MeshStandardMaterial({ color: 0xd8a79e, roughness: 0.6, metalness: 0 }),
    // L'œil vit : un point noir mat ne rend rien, il lui faut un reflet.
    eye: new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 0.08, metalness: 0.1 }),
    comb: new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.45, metalness: 0 }),
    udder: new THREE.MeshStandardMaterial({ color: 0xe7b3ab, roughness: 0.62, metalness: 0 }),
  };
}

/* ------------------------------------------------------------------ */
/* Formes                                                              */
/* ------------------------------------------------------------------ */

function ell(rx: number, ry: number, rz: number, pos: Vec3, rot?: Vec3, seg = 12) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.6)));
  g.scale(rx, ry, rz);
  return place(g, pos, rot);
}

function cap(r: number, length: number, pos: Vec3, rot?: Vec3, seg = 10) {
  return place(new THREE.CapsuleGeometry(r, Math.max(0.001, length), 3, seg), pos, rot);
}

/**
 * Une station d'un fuselage : où l'on est le long de l'axe, et quel gabarit.
 */
type Station = {
  /** Position le long de l'axe, l'avant vers +Z */
  z: number;
  /** Demi-largeur à cette station */
  rx: number;
  /** Demi-hauteur à cette station */
  ry: number;
  /** Décalage vertical de l'axe : c'est lui qui donne le dos et le ventre */
  y?: number;
};

/** Catmull-Rom scalaire : une courbe qui passe par tous ses points. */
function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function splineAt(vals: number[], u: number): number {
  const n = vals.length - 1;
  const x = THREE.MathUtils.clamp(u, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const t = x - i;
  return catmull(vals[Math.max(0, i - 1)], vals[i], vals[i + 1], vals[Math.min(n, i + 2)], t);
}

/**
 * Fuselage : une surface unique passant par une suite de gabarits.
 *
 * C'est la pièce maîtresse du rendu des bêtes. Un corps fait d'ellipsoïdes qui
 * se recouvrent porte une arête à chaque intersection — la même cicatrice que
 * le crâne et la mâchoire des personnages, et c'est elle qui donnait aux bêtes
 * leur air « géométrique ». Une seule peau tendue sur des sections
 * elliptiques, interpolées en Catmull-Rom, n'a rien à raccorder : le poitrail
 * enfle, le flanc s'arrondit, la croupe redescend, sans une seule couture.
 *
 * Les deux extrémités se ferment en éventail sur un point : à condition que la
 * première et la dernière station soient étroites, la fermeture ne se voit pas.
 */
function loft(
  stations: Station[],
  opts: { radial?: number; slices?: number; pos?: Vec3; rot?: Vec3 } = {},
): THREE.BufferGeometry {
  // La rondeur de la silhouette tient au nombre de secteurs ; le nombre de
  // tranches ne fait qu'affiner un profil déjà lissé par la spline. Dix-huit
  // sur vingt tiennent le rendu et divisent la facture par deux : au champ,
  // une bête fait quarante pixels de haut.
  const radial = opts.radial ?? 18;
  const slices = opts.slices ?? 20;
  const zs = stations.map((s) => s.z);
  const rxs = stations.map((s) => s.rx);
  const rys = stations.map((s) => s.ry);
  const ys = stations.map((s) => s.y ?? 0);

  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  for (let i = 0; i <= slices; i++) {
    const u = i / slices;
    const z = splineAt(zs, u);
    const rx = Math.max(0.0004, splineAt(rxs, u));
    const ry = Math.max(0.0004, splineAt(rys, u));
    const cy = splineAt(ys, u);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      position.push(Math.cos(a) * rx, cy + Math.sin(a) * ry, z);
      uv.push(j / radial, u);
    }
  }
  for (let i = 0; i < slices; i++) {
    for (let j = 0; j < radial; j++) {
      const j2 = (j + 1) % radial;
      const a = i * radial + j;
      const b = i * radial + j2;
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + j2;
      index.push(a, b, c, b, d, c);
    }
  }

  // Bouchons : un point au centre de chaque extrémité, et un éventail.
  const capStart = position.length / 3;
  position.push(0, splineAt(ys, 0), splineAt(zs, 0));
  uv.push(0.5, 0);
  const capEnd = position.length / 3;
  position.push(0, splineAt(ys, 1), splineAt(zs, 1));
  uv.push(0.5, 1);
  for (let j = 0; j < radial; j++) {
    const j2 = (j + 1) % radial;
    index.push(capStart, j, j2);
    const last = slices * radial;
    index.push(capEnd, last + j2, last + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return place(geo, opts.pos ?? [0, 0, 0], opts.rot);
}

/** Membre fuselé, planté au sommet : la patte pivote à l'épaule. */
function leg(rTop: number, rBottom: number, length: number) {
  // Un membre est aussi un fuselage : le canon se resserre sous le genou puis
  // s'évase au boulet. Deux cylindres empilés laissaient une arête au milieu.
  return loft(
    [
      { z: 0, rx: rTop * 0.92, ry: rTop * 0.92 },
      { z: -length * 0.12, rx: rTop, ry: rTop },
      { z: -length * 0.52, rx: (rTop + rBottom) * 0.46, ry: (rTop + rBottom) * 0.46 },
      { z: -length * 0.86, rx: rBottom, ry: rBottom },
      { z: -length, rx: rBottom * 1.12, ry: rBottom * 1.12 },
    ],
    { radial: 10, slices: 10, rot: [-HALF, 0, 0] },
  );
}

/** Nœud du plan de montage : ses pièces par matière, et ses articulations. */
class Node {
  private buckets = new Map<Mat, THREE.BufferGeometry[]>();
  private kids: { name: AnimalJoint; node: Node; pos: Vec3; rot?: Vec3 }[] = [];

  add(mat: Mat, ...geos: THREE.BufferGeometry[]): this {
    const bucket = this.buckets.get(mat) ?? [];
    bucket.push(...geos);
    this.buckets.set(mat, bucket);
    return this;
  }

  joint(name: AnimalJoint, pos: Vec3, rot?: Vec3): Node {
    const node = new Node();
    this.kids.push({ name, node, pos, rot });
    return node;
  }

  build(
    materials: Materials,
    joints: Partial<Record<AnimalJoint, THREE.Group>>,
    shadows: boolean,
  ): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, geos] of this.buckets) {
      const merged = geos.length === 1 ? geos[0] : mergeAll(geos);
      const mesh = new THREE.Mesh(merged, materials[mat]);
      mesh.name = mat;
      mesh.castShadow = shadows;
      group.add(mesh);
    }
    for (const kid of this.kids) {
      const g = kid.node.build(materials, joints, shadows);
      g.name = kid.name;
      g.position.set(...kid.pos);
      if (kid.rot) g.rotation.set(...kid.rot);
      g.userData.rest = { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z, py: g.position.y };
      joints[kid.name] = g;
      group.add(g);
    }
    return group;
  }
}

/* ------------------------------------------------------------------ */
/* Les quatre espèces                                                  */
/* ------------------------------------------------------------------ */

/** Yeux posés sur les côtés du crâne, comme chez tout herbivore. */
function addEyes(head: Node, gap: number, y: number, z: number, r: number) {
  for (const side of [-1, 1]) {
    head.add("eye", ell(r, r, r * 0.8, [side * gap, y, z], undefined, 8));
  }
}

function planCow(look: AnimalLook): { root: Node; base: number } {
  const root = new Node();
  const w = THREE.MathUtils.clamp(look.welfare ?? 1, 0, 1);
  // Une bête mal tenue est creuse : le flanc rentre et le dos se voûte.
  const flank = 0.185 - (1 - w) * 0.03;

  const body = root.joint("body", [0, 0.44, 0]);
  // Un seul fuselage, de la croupe au poitrail : garrot marqué, flanc rond,
  // ventre qui redescend. C'est la ligne du dos qui fait la vache.
  body.add(
    "hide",
    loft([
      { z: -0.33, rx: 0.05, ry: 0.05, y: 0.06 },
      { z: -0.26, rx: 0.13, ry: 0.15, y: 0.03 },
      { z: -0.12, rx: flank, ry: 0.185, y: -0.005 },
      { z: 0.06, rx: flank * 0.99, ry: 0.185, y: -0.01 },
      { z: 0.2, rx: flank * 0.93, ry: 0.175, y: 0.01 },
      { z: 0.3, rx: 0.115, ry: 0.14, y: 0.035 },
      { z: 0.36, rx: 0.045, ry: 0.055, y: 0.05 },
    ]),
  );
  // Taches : ce qui fait lire « vache laitière » avant même la forme. Posées
  // sur la peau, à peine plus grandes qu'elle, elles ne créent pas d'arête.
  body.add("hideDark", ell(0.1, 0.1, 0.12, [0.085, 0.075, 0.05], undefined, 12));
  body.add("hideDark", ell(0.085, 0.085, 0.095, [-0.095, 0.02, -0.14], undefined, 14));
  body.add("hideDark", ell(0.065, 0.075, 0.085, [0.055, -0.045, -0.2], undefined, 14));

  const neck = body.joint("neck", [0, 0.055, 0.28], [0.25, 0, 0]);
  // Le cou s'évase franchement vers le poitrail : c'est ce raccord qui fait
  // disparaître la jonction avec le corps.
  neck.add(
    "hide",
    loft([
      { z: -0.1, rx: 0.02, ry: 0.02 },
      { z: -0.05, rx: 0.115, ry: 0.13 },
      { z: 0.02, rx: 0.1, ry: 0.108 },
      { z: 0.1, rx: 0.082, ry: 0.082 },
      { z: 0.17, rx: 0.062, ry: 0.06 },
      { z: 0.21, rx: 0.028, ry: 0.028 },
    ]),
  );

  const head = neck.joint("head", [0, 0.01, 0.17], [-0.25, 0, 0]);
  // Crâne, chanfrein et mufle d'une seule pièce : le museau se détache par sa
  // matière, pas par une couture.
  head.add(
    "hide",
    loft([
      { z: -0.06, rx: 0.04, ry: 0.05, y: 0.01 },
      { z: 0.0, rx: 0.082, ry: 0.088, y: 0.005 },
      { z: 0.07, rx: 0.075, ry: 0.075, y: -0.008 },
      { z: 0.14, rx: 0.06, ry: 0.055, y: -0.024 },
      { z: 0.19, rx: 0.052, ry: 0.045, y: -0.032 },
      { z: 0.215, rx: 0.02, ry: 0.018, y: -0.034 },
    ]),
  );
  head.add("muzzle", ell(0.05, 0.04, 0.028, [0, -0.032, 0.197], undefined, 12));
  addEyes(head, 0.068, 0.028, 0.085, 0.017);
  for (const side of [-1, 1]) {
    head.add(
      "horn",
      loft(
        [
          { z: 0, rx: 0.017, ry: 0.017 },
          { z: 0.035, rx: 0.012, ry: 0.012 },
          { z: 0.06, rx: 0.004, ry: 0.004 },
        ],
        { radial: 9, slices: 8, pos: [side * 0.05, 0.09, 0.01], rot: [-HALF, 0, side * -0.6] },
      ),
    );
  }
  const jaw = head.joint("jaw", [0, -0.035, 0.09]);
  jaw.add("hide", ell(0.048, 0.024, 0.058, [0, 0, 0.045], undefined, 14));
  for (const side of [-1, 1]) {
    const ear = head.joint(side < 0 ? "earL" : "earR", [side * 0.078, 0.045, 0.01]);
    ear.add("hide", ell(0.017, 0.028, 0.048, [side * 0.022, 0, 0], [0, 0, side * -0.5], 12));
  }

  // Le pis se remplit entre deux traites : c'est la production en attente. Il
  // pend **sous** le ventre — logé dans le corps, il ne se voyait pas.
  const full = THREE.MathUtils.clamp(look.yield ?? 0, 0, 1);
  const udder = body.joint("udder", [0, -0.17, -0.02]);
  const size = 0.045 + full * 0.05;
  udder.add("udder", ell(size * 1.1, size, size * 1.2, [0, -size * 0.5, 0], undefined, 14));
  for (const side of [-1, 1]) {
    udder.add("udder", cap(0.011, 0.022, [side * 0.03, -size * 1.35, 0.012], undefined, 10));
  }

  const tail = body.joint("tail", [0, 0.1, -0.31], [0.5, 0, 0]);
  tail.add(
    "hide",
    loft(
      [
        { z: 0, rx: 0.022, ry: 0.022 },
        { z: 0.12, rx: 0.013, ry: 0.013 },
        { z: 0.2, rx: 0.009, ry: 0.009 },
      ],
      { radial: 9, slices: 10, rot: [HALF, 0, 0] },
    ),
  );
  tail.add("hideDark", ell(0.028, 0.05, 0.028, [0, -0.23, 0], undefined, 12));

  for (const [name, x, z] of [
    ["legFL", -0.105, 0.18],
    ["legFR", 0.105, 0.18],
    ["legBL", -0.115, -0.2],
    ["legBR", 0.115, -0.2],
  ] as const) {
    const l = body.joint(name, [x, -0.1, z]);
    l.add("hide", leg(0.05, 0.028, 0.28));
    l.add("hoof", ell(0.034, 0.03, 0.04, [0, -0.298, 0.006], undefined, 12));
  }

  return { root, base: 0xf0e6d2 };
}

function planSheep(look: AnimalLook): { root: Node; base: number } {
  const root = new Node();
  const sheared = Boolean(look.sheared);
  const wool = THREE.MathUtils.clamp(look.yield ?? 0, 0, 1);
  // La toison est le stock de laine : elle gonfle jusqu'à la tonte, puis
  // repart de rien. Le corps dessous ne change pas.
  const fleece = sheared ? 0 : 0.03 + wool * 0.048;

  const body = root.joint("body", [0, 0.26, 0]);
  /**
   * La toison **multiplie** le gabarit au lieu de s'y ajouter.
   *
   * Ajouté, l'épaisseur gonflait aussi les deux bouts du fuselage : la brebis
   * devenait un tonneau à fonds plats. Multipliée, la laine épaissit le flanc
   * et laisse les extrémités s'effiler.
   */
  const shape = (grow: number): Station[] => {
    const k = 1 + grow;
    return [
      { z: -0.235, rx: 0.012, ry: 0.014, y: 0.035 },
      { z: -0.21, rx: 0.06 * k, ry: 0.066 * k, y: 0.022 },
      { z: -0.15, rx: 0.106 * k, ry: 0.108 * k, y: 0.006 },
      { z: -0.05, rx: 0.128 * k, ry: 0.125 * k, y: 0 },
      { z: 0.06, rx: 0.127 * k, ry: 0.126 * k, y: 0.004 },
      { z: 0.15, rx: 0.104 * k, ry: 0.108 * k, y: 0.016 },
      { z: 0.21, rx: 0.056 * k, ry: 0.062 * k, y: 0.03 },
      { z: 0.235, rx: 0.012, ry: 0.014, y: 0.038 },
    ];
  };
  body.add("hide", loft(shape(0)));
  if (fleece > 0) {
    body.add("wool", loft(shape(fleece / 0.128)));
    // Une toison n'est pas une bille lisse : quelques bosses la font mèches.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      body.add(
        "wool",
        ell(
          0.055 + fleece * 0.5,
          0.05 + fleece * 0.5,
          0.055 + fleece * 0.5,
          [Math.cos(a) * 0.085, 0.055 + (i % 2) * 0.045, Math.sin(a) * 0.14],
          undefined,
          12,
        ),
      );
    }
  }

  const neck = body.joint("neck", [0, 0.055, 0.19], [0.32, 0, 0]);
  neck.add(
    "hide",
    loft([
      { z: -0.04, rx: 0.022, ry: 0.022 },
      { z: 0.01, rx: 0.056, ry: 0.058 },
      { z: 0.08, rx: 0.048, ry: 0.05 },
      { z: 0.12, rx: 0.022, ry: 0.022 },
    ]),
  );
  if (fleece > 0) neck.add("wool", ell(0.062 + fleece * 0.4, 0.06 + fleece * 0.4, 0.06, [0, 0, 0.015], undefined, 14));

  const head = neck.joint("head", [0, 0, 0.1], [-0.3, 0, 0]);
  head.add(
    "hideDark",
    loft([
      { z: -0.04, rx: 0.024, ry: 0.03, y: 0.008 },
      { z: 0.0, rx: 0.05, ry: 0.055, y: 0.004 },
      { z: 0.05, rx: 0.044, ry: 0.044, y: -0.008 },
      { z: 0.1, rx: 0.032, ry: 0.03, y: -0.02 },
      { z: 0.12, rx: 0.013, ry: 0.012, y: -0.022 },
    ]),
  );
  addEyes(head, 0.04, 0.018, 0.05, 0.012);
  const jaw = head.joint("jaw", [0, -0.026, 0.055]);
  jaw.add("hideDark", ell(0.028, 0.017, 0.034, [0, 0, 0.022], undefined, 12));
  for (const side of [-1, 1]) {
    const ear = head.joint(side < 0 ? "earL" : "earR", [side * 0.045, 0.025, 0.005]);
    ear.add("hideDark", ell(0.011, 0.017, 0.034, [side * 0.018, 0, 0], [0, 0, side * -0.8], 10));
  }

  const tail = body.joint("tail", [0, 0.07, -0.21], [0.4, 0, 0]);
  tail.add(fleece > 0 ? "wool" : "hide", ell(0.028, 0.045, 0.028, [0, -0.035, 0], undefined, 12));

  for (const [name, x, z] of [
    ["legFL", -0.07, 0.11],
    ["legFR", 0.07, 0.11],
    ["legBL", -0.075, -0.12],
    ["legBR", 0.075, -0.12],
  ] as const) {
    const l = body.joint(name, [x, -0.075, z]);
    // Une brebis a les pattes courtes, et la toison en cache la moitié.
    l.add("hideDark", leg(0.028, 0.017, 0.14));
    l.add("hoof", ell(0.021, 0.018, 0.025, [0, -0.153, 0.004], undefined, 10));
  }

  return { root, base: 0xe8e0d0 };
}

function planPig(look: AnimalLook): { root: Node; base: number } {
  const root = new Node();
  const w = THREE.MathUtils.clamp(look.welfare ?? 1, 0, 1);
  // Un cochon bien nourri est rond ; un cochon mal tenu est étroit et ses
  // côtes se marquent. C'est là que se lit son état — le rose ne s'assombrit
  // presque pas.
  const girth = 0.108 + w * 0.045;
  const depth = 0.098 + w * 0.03;

  const body = root.joint("body", [0, 0.27, 0]);
  // Le cochon n'a pas de cou : le fuselage va de la croupe au groin d'un
  // seul tenant, en s'épaississant vers l'avant.
  body.add(
    "hide",
    loft([
      { z: -0.25, rx: 0.045, ry: 0.05, y: 0.03 },
      { z: -0.19, rx: girth * 0.78, ry: depth * 0.84, y: 0.012 },
      { z: -0.05, rx: girth, ry: depth, y: 0 },
      { z: 0.09, rx: girth * 0.97, ry: depth * 1.02, y: -0.004 },
      { z: 0.2, rx: girth * 0.78, ry: depth * 0.85, y: 0.004 },
      { z: 0.26, rx: 0.055, ry: 0.055, y: 0.006 },
    ]),
  );
  body.add("hideDark", ell(0.065, 0.065, 0.075, [0.055, 0.045, -0.06], undefined, 14));
  if (w < 0.55) {
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) {
        body.add(
          "hideDark",
          ell(0.007, 0.05, 0.011, [side * girth * 0.9, 0.005, 0.02 - i * 0.055], undefined, 8),
        );
      }
    }
  }

  const neck = body.joint("neck", [0, 0.01, 0.2], [0.2, 0, 0]);
  const head = neck.joint("head", [0, 0, 0.04], [-0.2, 0, 0]);
  head.add(
    "hide",
    loft([
      { z: -0.05, rx: 0.045, ry: 0.05, y: 0.005 },
      { z: 0.0, rx: 0.075, ry: 0.07, y: 0 },
      { z: 0.05, rx: 0.07, ry: 0.062, y: -0.008 },
      { z: 0.095, rx: 0.045, ry: 0.042, y: -0.016 },
      { z: 0.108, rx: 0.038, ry: 0.036, y: -0.017 },
    ]),
  );
  // Le groin : un disque franc, c'est la signature du cochon.
  head.add("muzzle", place(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 16), [0, -0.017, 0.112], [HALF, 0, 0]));
  addEyes(head, 0.048, 0.022, 0.055, 0.012);
  const jaw = head.joint("jaw", [0, -0.028, 0.055]);
  jaw.add("hide", ell(0.038, 0.018, 0.038, [0, 0, 0.02], undefined, 12));
  for (const side of [-1, 1]) {
    const ear = head.joint(side < 0 ? "earL" : "earR", [side * 0.052, 0.048, 0.005], [0.5, 0, 0]);
    ear.add("hide", place(new THREE.ConeGeometry(0.03, 0.055, 12), [0, 0.01, 0], [0.4, 0, side * -0.35]));
  }

  // La queue en tire-bouchon : trois anneaux suffisent à la lire.
  const tail = body.joint("tail", [0, 0.07, -0.22]);
  for (let i = 0; i < 3; i++) {
    tail.add(
      "hide",
      place(new THREE.TorusGeometry(0.017, 0.0055, 8, 14), [0, 0.012 * i, -0.008 * i], [0.4, HALF, 0]),
    );
  }

  for (const [name, x, z] of [
    ["legFL", -0.07, 0.11],
    ["legFR", 0.07, 0.11],
    ["legBL", -0.075, -0.12],
    ["legBR", 0.075, -0.12],
  ] as const) {
    const l = body.joint(name, [x, -0.075, z]);
    l.add("hide", leg(0.032, 0.021, 0.145));
    l.add("hoof", ell(0.023, 0.019, 0.027, [0, -0.158, 0.004], undefined, 10));
  }

  return { root, base: 0xe0a99a };
}

function planHen(look: AnimalLook): { root: Node; base: number } {
  const root = new Node();
  const eggs = THREE.MathUtils.clamp(look.yield ?? 0, 0, 1);
  const belly = 0.078 + eggs * 0.014;

  const body = root.joint("body", [0, 0.15, 0]);
  // Corps en goutte : large au poitrail, effilé vers la queue.
  body.add(
    "hide",
    loft([
      { z: -0.11, rx: 0.028, ry: 0.03, y: 0.035 },
      { z: -0.06, rx: 0.058, ry: 0.058, y: 0.018 },
      { z: 0.0, rx: 0.075, ry: belly, y: 0 },
      { z: 0.055, rx: 0.066, ry: 0.072, y: 0.004 },
      { z: 0.095, rx: 0.03, ry: 0.032, y: 0.02 },
    ]),
  );

  const neck = body.joint("neck", [0, 0.05, 0.055], [-0.35, 0, 0]);
  neck.add(
    "hide",
    loft([
      { z: -0.02, rx: 0.02, ry: 0.02 },
      { z: 0.02, rx: 0.034, ry: 0.034 },
      { z: 0.06, rx: 0.03, ry: 0.03 },
      { z: 0.08, rx: 0.018, ry: 0.018 },
    ], { rot: [-HALF, 0, 0] }),
  );

  const head = neck.joint("head", [0, 0.07, 0.01], [0.35, 0, 0]);
  head.add("hide", ell(0.036, 0.038, 0.04, [0, 0, 0], undefined, 12));
  head.add("comb", ell(0.011, 0.024, 0.028, [0, 0.038, 0.004], undefined, 10));
  head.add("comb", ell(0.011, 0.017, 0.011, [0, -0.03, 0.02], undefined, 10));
  addEyes(head, 0.029, 0.008, 0.019, 0.009);
  const jaw = head.joint("jaw", [0, -0.008, 0.028]);
  jaw.add("horn", place(new THREE.ConeGeometry(0.013, 0.034, 12), [0, 0, 0.012], [HALF, 0, 0]));

  for (const side of [-1, 1]) {
    const wing = body.joint(side < 0 ? "wingL" : "wingR", [side * 0.066, 0.015, 0]);
    wing.add("hide", ell(0.015, 0.05, 0.075, [side * 0.006, 0, 0], [0, 0, side * -0.15], 12));
  }

  const tail = body.joint("tail", [0, 0.055, -0.095], [-0.7, 0, 0]);
  for (let i = 0; i < 3; i++) {
    tail.add("hide", ell(0.009, 0.042, 0.018, [(i - 1) * 0.015, 0.038, 0], [0, 0, (i - 1) * 0.25], 10));
  }

  for (const [name, x] of [
    ["legFL", -0.028],
    ["legFR", 0.028],
  ] as const) {
    const l = body.joint(name, [x, -0.058, 0.008]);
    l.add("horn", leg(0.009, 0.0075, 0.068));
    l.add("horn", ell(0.02, 0.006, 0.028, [0, -0.074, 0.012], undefined, 10));
  }

  return { root, base: 0xc9743d };
}

/* ------------------------------------------------------------------ */
/* Montage et animation                                                */
/* ------------------------------------------------------------------ */

/** Longueur d'une foulée par espèce : une poule trottine, une vache marche. */
const STRIDE: Record<AnimalKind, number> = { COW: 0.62, SHEEP: 0.42, PIG: 0.4, HEN: 0.16 };

export function createAnimalRig(
  kind: AnimalKind,
  look: AnimalLook = {},
  opts: { shadows?: boolean } = {},
): AnimalRig {
  const plan =
    kind === "SHEEP"
      ? planSheep(look)
      : kind === "PIG"
        ? planPig(look)
        : kind === "HEN"
          ? planHen(look)
          : planCow(look);

  const materials = createMaterials(plan.base, look);
  const joints: Partial<Record<AnimalJoint, THREE.Group>> = {};
  const group = plan.root.build(materials, joints, opts.shadows ?? false);
  group.name = `animal-${kind}`;

  const box = new THREE.Box3().setFromObject(group);
  const height = box.max.y;
  const welfare = THREE.MathUtils.clamp(look.welfare ?? 1, 0, 1);

  /**
   * Jusqu'où le corps peut descendre avant que le ventre touche le sol.
   *
   * Une descente exprimée en pourcentage de la hauteur au garrot ne pouvait
   * pas convenir : une brebis en toison est bien plus épaisse qu'une vache
   * pour un garrot plus bas, et elle passait sous terre en se couchant. On
   * mesure donc le dessous réel de la bête, toison comprise.
   */
  const bellyDrop = (() => {
    const bodyJoint = joints.body;
    if (!bodyJoint) return 0;
    const local = new THREE.Box3();
    for (const child of bodyJoint.children) {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) continue;
      mesh.geometry.computeBoundingBox();
      local.union(mesh.geometry.boundingBox!);
    }
    if (!Number.isFinite(local.min.y)) return 0;
    return Math.max(0, bodyJoint.position.y + local.min.y);
  })();

  const rest = (j?: THREE.Group) =>
    (j?.userData.rest as { x: number; y: number; z: number; py: number }) ?? {
      x: 0,
      y: 0,
      z: 0,
      py: 0,
    };

  let lie = 0;

  function update(pose: AnimalPose): void {
    const seed = pose.seed ?? 0;
    const t = pose.t + seed * 2.3;
    const { body, neck, head, jaw, tail, udder } = joints;

    lie += ((pose.resting ? 1 : 0) - lie) * 0.05;
    // Une bête couchée ne broute pas : cumuler les deux lui enfonçait le
    // museau sous la terre, le corps étant déjà au ras du sol.
    const g = THREE.MathUtils.clamp(pose.graze ?? 0, 0, 1) * (1 - lie);

    // Respiration : le flanc se soulève. Presque rien, mais une bête qui ne
    // respire pas est un objet posé sur l'herbe.
    const breath = Math.sin(t * 1.1);
    if (body) {
      const r = rest(body);
      body.scale.set(1 + breath * 0.012, 1 + breath * 0.008, 1);
      // Couchée, la bête descend jusqu'à poser le ventre — pas plus loin.
      //
      // Une version antérieure baissait aussi le corps quand la bête allait
      // mal : le garrot ne tenait qu'à deux millimètres du sol au repos, et
      // le moindre affaissement lui enfonçait les sabots dans la terre. Le
      // mal-être se dit par la posture — dos voûté, tête basse — jamais par
      // l'altitude.
      body.position.y = r.py - lie * bellyDrop * 0.94;
      body.rotation.x = r.x + g * 0.12 + lie * 0.06 + (1 - welfare) * 0.05;
      body.rotation.z = r.z + Math.sin(t * 0.5) * 0.015;
    }

    // Le port de tête dit le bien-être autant que le poil : une bête qui va
    // bien lève le nez, une bête qui souffre l'a bas.
    if (neck) {
      const r = rest(neck);
      // Une poule pique du bec au sol par à-coups ; un ruminant descend la
      // tête et l'y laisse.
      const peck = kind === "HEN" ? g * (1.15 + Math.sin(t * 7) * 0.35) : g * 0.95;
      neck.rotation.x = r.x + peck + (1 - welfare) * 0.22 + lie * 0.1;
    }
    if (head) {
      const r = rest(head);
      head.rotation.x = r.x + g * 0.55 - (1 - welfare) * 0.1;
      head.rotation.y = r.y + Math.sin(t * 0.33 + seed) * 0.22 * (1 - g);
    }

    // Rumination : la mâchoire travaille en continu, plus vite en broutant.
    if (jaw) {
      const chew = Math.sin(t * (4.2 + g * 3)) * 0.5 + 0.5;
      jaw.rotation.x = rest(jaw).x + chew * (0.06 + g * 0.05);
    }

    // Oreilles : un coup sec de temps en temps, jamais en rythme.
    for (const key of ["earL", "earR"] as const) {
      const ear = joints[key];
      if (!ear) continue;
      const r = rest(ear);
      const flick = Math.max(0, Math.sin(t * 0.7 + (key === "earL" ? 0 : 1.7) + seed) - 0.93) * 14;
      ear.rotation.x = r.x - flick * 0.5;
      ear.rotation.z = r.z + Math.sin(t * 1.3 + seed) * 0.05;
    }

    // La queue chasse les mouches : le geste qui rend une bête vivante.
    if (tail) {
      const r = rest(tail);
      tail.rotation.z = r.z + Math.sin(t * 1.9 + seed) * 0.3 + Math.sin(t * 0.6) * 0.12;
      tail.rotation.x = r.x + Math.sin(t * 0.9 + seed) * 0.1;
    }

    // Le pis se balance quand la bête avance, et se rentre quand elle se
    // couche — il pend sous le ventre, donc il traversait le sol.
    if (udder) {
      const r = rest(udder);
      udder.rotation.z = r.z + Math.sin(t * 2.4 + seed) * 0.08 * (pose.walking ? 1 : 0.3);
      udder.position.y = r.py + lie * 0.1;
      udder.scale.setScalar(1 - lie * 0.35);
    }

    // Ailes : la poule bat un coup sec de loin en loin.
    for (const key of ["wingL", "wingR"] as const) {
      const wing = joints[key];
      if (!wing) continue;
      const r = rest(wing);
      const beat = Math.max(0, Math.sin(t * 0.9 + seed * 1.3) - 0.9) * 10;
      const side = key === "wingL" ? -1 : 1;
      wing.rotation.z = r.z + side * beat * 0.6;
    }

    // Le pas suit la distance parcourue, comme les roues des engins : deux
    // bêtes à la même vitesse posent le pied ensemble.
    const phase = ((pose.distance ?? 0) / STRIDE[kind]) * Math.PI * 2 + seed;
    const gait = pose.walking && lie < 0.5 ? 1 : 0;
    const swing = Math.sin(phase);
    // Diagonale : avant gauche avec arrière droit. C'est l'allure d'un
    // quadrupède ; battre les quatre pattes en phase donne un jouet à ressort.
    const order: [AnimalJoint, number][] = [
      ["legFL", 1],
      ["legFR", -1],
      ["legBL", -1],
      ["legBR", 1],
    ];
    for (const [name, dir] of order) {
      const l = joints[name];
      if (!l) continue;
      const r = rest(l);
      l.rotation.x = r.x + swing * dir * 0.5 * gait;
      // Couchée, la bête replie ses pattes **sous** elle : les avant vers
      // l'arrière, les arrière vers l'avant. Les quatre du même côté donnaient
      // un grand écart, pas une bête au repos.
      const fold = name === "legFL" || name === "legFR" ? -1.35 : 1.5;
      l.rotation.x += lie * fold;
      l.position.y = r.py + lie * 0.09;
      l.scale.setScalar(1 - lie * 0.18);
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

/* ------------------------------------------------------------------ */
/* Compatibilité avec la vue ferme                                     */
/* ------------------------------------------------------------------ */

/** Bête prête à poser dans la parcelle. Le rig voyage dans `userData`. */
export function meshForHerd(kind?: string, sheared = false, look: AnimalLook = {}): THREE.Group {
  const species: AnimalKind =
    kind === "HEN" || kind === "SHEEP" || kind === "PIG" ? kind : "COW";
  const rig = createAnimalRig(species, { ...look, sheared });
  rig.group.userData.rig = rig;
  return rig.group;
}

/** graze 0 = debout, 1 = tête au sol. walk = pattes qui se croisent. */
export function applyHerdPose(
  mesh: THREE.Group,
  _kind: string,
  graze: number,
  walking: boolean,
  t: number,
  wander: number,
  distance = 0,
  resting = false,
): void {
  const rig = mesh.userData.rig as AnimalRig | undefined;
  rig?.update({ t, graze, walking, distance, resting, seed: wander });
}
