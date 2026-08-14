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

function ell(rx: number, ry: number, rz: number, pos: Vec3, rot?: Vec3, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.max(8, Math.round(seg * 0.6)));
  g.scale(rx, ry, rz);
  return place(g, pos, rot);
}

function cap(r: number, length: number, pos: Vec3, rot?: Vec3, seg = 10) {
  return place(new THREE.CapsuleGeometry(r, Math.max(0.001, length), 3, seg), pos, rot);
}

/** Membre fuselé, planté au sommet : la patte pivote à l'épaule. */
function leg(rTop: number, rBottom: number, length: number) {
  return mergeAll([
    place(new THREE.CylinderGeometry(rTop, rBottom, length, 8), [0, -length / 2, 0]),
    ell(rTop, rTop * 0.8, rTop, [0, 0, 0], undefined, 8),
  ]);
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
  // Une bête mal tenue est creuse : le flanc rentre et l'échine ressort.
  const flank = 0.19 - (1 - w) * 0.035;

  const body = root.joint("body", [0, 0.44, 0]);
  body.add("hide", ell(flank, 0.185, 0.32, [0, 0, 0], undefined, 16));
  body.add("hide", ell(flank * 0.92, 0.17, 0.16, [0, 0.01, 0.22], undefined, 14));
  // Taches : ce qui fait lire « vache laitière » avant même la forme.
  body.add("hideDark", ell(0.11, 0.11, 0.13, [0.09, 0.08, 0.06], undefined, 10));
  body.add("hideDark", ell(0.09, 0.09, 0.1, [-0.1, 0.02, -0.14], undefined, 10));
  body.add("hideDark", ell(0.07, 0.08, 0.09, [0.06, -0.05, -0.2], undefined, 10));
  // Échine saillante quand la bête est maigre.
  if (w < 0.6) body.add("hideDark", ell(0.03, 0.03, 0.26, [0, 0.17, -0.02], undefined, 8));

  const neck = body.joint("neck", [0, 0.06, 0.3], [0.25, 0, 0]);
  neck.add("hide", cap(0.085, 0.12, [0, 0, 0.06], [HALF, 0, 0]));

  const head = neck.joint("head", [0, 0.02, 0.16], [-0.25, 0, 0]);
  head.add("hide", ell(0.085, 0.09, 0.11, [0, 0, 0.05], undefined, 12));
  head.add("hide", ell(0.062, 0.055, 0.07, [0, -0.025, 0.15], undefined, 10));
  head.add("muzzle", ell(0.05, 0.042, 0.03, [0, -0.032, 0.2], undefined, 10));
  addEyes(head, 0.07, 0.03, 0.09, 0.017);
  for (const side of [-1, 1]) {
    head.add("horn", place(new THREE.ConeGeometry(0.018, 0.06, 6), [side * 0.055, 0.1, 0.02], [0, 0, side * -0.6]));
  }
  const jaw = head.joint("jaw", [0, -0.04, 0.1]);
  jaw.add("hide", ell(0.05, 0.026, 0.06, [0, 0, 0.04], undefined, 8));
  for (const side of [-1, 1]) {
    const ear = head.joint(side < 0 ? "earL" : "earR", [side * 0.085, 0.055, 0.02]);
    ear.add("hide", ell(0.018, 0.03, 0.05, [side * 0.02, 0, 0], [0, 0, side * -0.5], 8));
  }

  // Le pis se remplit entre deux traites : c'est la production en attente.
  const full = THREE.MathUtils.clamp(look.yield ?? 0, 0, 1);
  // Le pis pend **sous** le ventre : logé à l'intérieur de l'ellipsoïde du
  // corps, il ne se voyait pas du tout, et une vache pleine ressemblait à une
  // vache qu'on vient de traire.
  const udder = body.joint("udder", [0, -0.175, -0.02]);
  const size = 0.045 + full * 0.05;
  udder.add("udder", ell(size * 1.1, size, size * 1.2, [0, -size * 0.5, 0], undefined, 10));
  for (const side of [-1, 1]) {
    udder.add("udder", cap(0.011, 0.022, [side * 0.03, -size * 1.35, 0.012]));
  }

  const tail = body.joint("tail", [0, 0.12, -0.3], [0.5, 0, 0]);
  tail.add("hide", cap(0.016, 0.2, [0, -0.11, 0]));
  tail.add("hideDark", ell(0.03, 0.05, 0.03, [0, -0.23, 0], undefined, 8));

  for (const [name, x, z] of [
    ["legFL", -0.11, 0.19],
    ["legFR", 0.11, 0.19],
    ["legBL", -0.12, -0.2],
    ["legBR", 0.12, -0.2],
  ] as const) {
    const l = body.joint(name, [x, -0.11, z]);
    l.add("hide", leg(0.045, 0.03, 0.28));
    l.add("hoof", ell(0.036, 0.028, 0.042, [0, -0.3, 0.006], undefined, 8));
  }

  return { root, base: 0xf0e6d2 };
}

function planSheep(look: AnimalLook): { root: Node; base: number } {
  const root = new Node();
  const sheared = Boolean(look.sheared);
  const wool = THREE.MathUtils.clamp(look.yield ?? 0, 0, 1);
  // La toison est le stock de laine : elle gonfle jusqu'à la tonte, puis
  // repart de rien. Le corps dessous ne change pas.
  const fleece = sheared ? 0 : 0.028 + wool * 0.05;

  const body = root.joint("body", [0, 0.26, 0]);
  body.add("hide", ell(0.13, 0.125, 0.21, [0, 0, 0], undefined, 14));
  if (fleece > 0) {
    // Une toison n'est pas une sphère lisse : cinq bosses la font mèches.
    body.add("wool", ell(0.13 + fleece, 0.125 + fleece, 0.21 + fleece, [0, 0.01, 0], undefined, 14));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      body.add(
        "wool",
        ell(
          0.06 + fleece * 0.5,
          0.055 + fleece * 0.5,
          0.06 + fleece * 0.5,
          [Math.cos(a) * 0.09, 0.06 + (i % 2) * 0.05, Math.sin(a) * 0.15],
          undefined,
          8,
        ),
      );
    }
  }

  const neck = body.joint("neck", [0, 0.05, 0.19], [0.3, 0, 0]);
  neck.add("hide", cap(0.05, 0.06, [0, 0, 0.04], [HALF, 0, 0]));
  if (fleece > 0) neck.add("wool", ell(0.062, 0.06, 0.06, [0, 0, 0.02], undefined, 8));

  const head = neck.joint("head", [0, 0, 0.1], [-0.3, 0, 0]);
  head.add("hideDark", ell(0.05, 0.055, 0.07, [0, 0, 0.03], undefined, 10));
  head.add("hideDark", ell(0.034, 0.03, 0.04, [0, -0.02, 0.09], undefined, 8));
  addEyes(head, 0.042, 0.02, 0.055, 0.012);
  const jaw = head.joint("jaw", [0, -0.03, 0.06]);
  jaw.add("hideDark", ell(0.03, 0.018, 0.035, [0, 0, 0.02], undefined, 8));
  for (const side of [-1, 1]) {
    const ear = head.joint(side < 0 ? "earL" : "earR", [side * 0.05, 0.03, 0.01]);
    ear.add("hideDark", ell(0.012, 0.018, 0.035, [side * 0.018, 0, 0], [0, 0, side * -0.8], 8));
  }

  const tail = body.joint("tail", [0, 0.08, -0.2], [0.4, 0, 0]);
  tail.add(fleece > 0 ? "wool" : "hide", ell(0.03, 0.05, 0.03, [0, -0.04, 0], undefined, 8));

  for (const [name, x, z] of [
    ["legFL", -0.07, 0.12],
    ["legFR", 0.07, 0.12],
    ["legBL", -0.075, -0.13],
    ["legBR", 0.075, -0.13],
  ] as const) {
    const l = body.joint(name, [x, -0.08, z]);
    // Une brebis a les pattes courtes, et la toison en cache la moitié. Trop
    // longues, elle marchait sur des échasses.
    l.add("hideDark", leg(0.026, 0.018, 0.14));
    l.add("hoof", ell(0.022, 0.018, 0.026, [0, -0.155, 0.004], undefined, 8));
  }

  return { root, base: 0xe8e0d0 };
}

function planPig(look: AnimalLook): { root: Node; base: number } {
  const root = new Node();
  const w = THREE.MathUtils.clamp(look.welfare ?? 1, 0, 1);
  // Un cochon bien nourri est rond ; un cochon mal tenu est étroit et ses
  // côtes se marquent. C'est là que se lit son état, la couleur rose ne
  // s'assombrissant presque pas.
  const girth = 0.11 + w * 0.048;

  const body = root.joint("body", [0, 0.28, 0]);
  body.add("hide", ell(girth, 0.1 + w * 0.03, 0.22, [0, 0, 0], undefined, 14));
  if (w < 0.55) {
    for (let i = 0; i < 3; i++) {
      body.add("hideDark", ell(0.008, 0.055, 0.012, [girth * 0.92, 0.01, 0.02 - i * 0.055], undefined, 6));
      body.add("hideDark", ell(0.008, 0.055, 0.012, [-girth * 0.92, 0.01, 0.02 - i * 0.055], undefined, 6));
    }
  }
  body.add("hide", ell(girth * 0.85, 0.1, 0.1, [0, 0.005, 0.19], undefined, 12));
  body.add("hideDark", ell(0.07, 0.07, 0.08, [0.06, 0.05, -0.06], undefined, 8));

  const neck = body.joint("neck", [0, 0.02, 0.2], [0.2, 0, 0]);
  const head = neck.joint("head", [0, 0, 0.05], [-0.2, 0, 0]);
  head.add("hide", ell(0.075, 0.07, 0.085, [0, 0, 0.03], undefined, 12));
  // Le groin : un disque franc, c'est la signature du cochon.
  head.add("muzzle", place(new THREE.CylinderGeometry(0.036, 0.04, 0.035, 10), [0, -0.015, 0.1], [HALF, 0, 0]));
  addEyes(head, 0.05, 0.025, 0.06, 0.012);
  const jaw = head.joint("jaw", [0, -0.03, 0.06]);
  jaw.add("hide", ell(0.04, 0.02, 0.04, [0, 0, 0.02], undefined, 8));
  for (const side of [-1, 1]) {
    const ear = head.joint(side < 0 ? "earL" : "earR", [side * 0.055, 0.05, 0.01], [0.5, 0, 0]);
    ear.add("hide", place(new THREE.ConeGeometry(0.03, 0.055, 6), [0, 0.01, 0], [0.4, 0, side * -0.35]));
  }

  // La queue en tire-bouchon : trois anneaux suffisent à la lire.
  const tail = body.joint("tail", [0, 0.08, -0.21]);
  for (let i = 0; i < 3; i++) {
    tail.add(
      "hide",
      place(new THREE.TorusGeometry(0.018, 0.006, 5, 10), [0, 0.012 * i, -0.008 * i], [0.4, HALF, 0]),
    );
  }

  for (const [name, x, z] of [
    ["legFL", -0.075, 0.12],
    ["legFR", 0.075, 0.12],
    ["legBL", -0.08, -0.13],
    ["legBR", 0.08, -0.13],
  ] as const) {
    const l = body.joint(name, [x, -0.08, z]);
    l.add("hide", leg(0.03, 0.022, 0.15));
    l.add("hoof", ell(0.024, 0.02, 0.028, [0, -0.165, 0.004], undefined, 8));
  }

  return { root, base: 0xe0a99a };
}

function planHen(look: AnimalLook): { root: Node; base: number } {
  const root = new Node();
  const eggs = THREE.MathUtils.clamp(look.yield ?? 0, 0, 1);

  const body = root.joint("body", [0, 0.15, 0]);
  // Une poule pleine est plus ronde : le ventre descend.
  body.add("hide", ell(0.075, 0.08 + eggs * 0.014, 0.095, [0, 0, 0], undefined, 12));
  body.add("hide", ell(0.055, 0.05, 0.05, [0, 0.03, -0.08], undefined, 8));

  const neck = body.joint("neck", [0, 0.05, 0.06], [-0.35, 0, 0]);
  neck.add("hide", cap(0.03, 0.05, [0, 0.03, 0]));

  const head = neck.joint("head", [0, 0.07, 0.01], [0.35, 0, 0]);
  head.add("hide", ell(0.038, 0.04, 0.042, [0, 0, 0], undefined, 10));
  head.add("comb", ell(0.012, 0.025, 0.03, [0, 0.04, 0.004], undefined, 6));
  head.add("comb", ell(0.012, 0.018, 0.012, [0, -0.03, 0.022], undefined, 6));
  addEyes(head, 0.03, 0.008, 0.02, 0.009);
  const jaw = head.joint("jaw", [0, -0.008, 0.03]);
  jaw.add("horn", place(new THREE.ConeGeometry(0.014, 0.035, 6), [0, 0, 0.012], [HALF, 0, 0]));

  for (const side of [-1, 1]) {
    const wing = body.joint(side < 0 ? "wingL" : "wingR", [side * 0.07, 0.02, 0]);
    wing.add("hide", ell(0.016, 0.055, 0.08, [side * 0.006, 0, 0], [0, 0, side * -0.15], 8));
  }

  const tail = body.joint("tail", [0, 0.06, -0.09], [-0.7, 0, 0]);
  for (let i = 0; i < 3; i++) {
    tail.add(
      "hide",
      ell(0.01, 0.045, 0.02, [(i - 1) * 0.016, 0.04, 0], [0, 0, (i - 1) * 0.25], 6),
    );
  }

  for (const [name, x] of [
    ["legFL", -0.03],
    ["legFR", 0.03],
  ] as const) {
    const l = body.joint(name, [x, -0.06, 0.01]);
    l.add("horn", leg(0.009, 0.008, 0.07));
    l.add("horn", ell(0.022, 0.006, 0.03, [0, -0.076, 0.012], undefined, 6));
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
      body.position.y = r.py - lie * (r.py * 0.42);
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
