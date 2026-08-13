import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { markShared } from "./three-cleanup";
import type { MachineRig, MachineState } from "./machines3d";

/**
 * Tracteur « héros » — une marche au-dessus du low-poly.
 *
 * Le parc de `machines3d.ts` obéit au budget de la charte : facettes, pièces
 * fusionnées, silhouette avant détail. Ce module tente l'inverse sur **un
 * seul engin**, pour voir jusqu'où on peut pousser sans quitter le jeu :
 *
 * - **des volumes galbés, pas des boîtes** — le capot est un profil de côté
 *   extrudé et biseauté, les pneus et les jantes sont tournés au tour
 *   (`LatheGeometry`), les tôles sont des boîtes à coins arrondis ;
 * - **de l'ombrage lisse** là où la tôle est courbe, des facettes seulement
 *   là où la pièce est réellement anguleuse (crampons, contrepoids) ;
 * - **du PBR** : peinture métallisée, chrome, caoutchouc mat, verre teinté.
 *   La scène doit fournir une `environment` (voir `MachineView3D`), sans quoi
 *   les métaux paraissent éteints ;
 * - **le détail de près** : calandre à lames, phares à enjoliveur, échappement
 *   à écran thermique, relevage trois points complet avec rotules, prise de
 *   force cannelée, flexibles hydrauliques, marchepieds, rétroviseurs.
 *
 * Coût : ~14 000 triangles contre ~700 pour la version low-poly, et une
 * quinzaine d'appels de rendu. C'est un modèle de vitrine — garage, catalogue,
 * écran de choix — pas un modèle à poser vingt fois dans une parcelle.
 *
 * Repère local identique au reste du parc : l'engin avance vers **+X**, le sol
 * est à **y = 0**.
 */

type Vec3 = [number, number, number];

type MatKey =
  | "paint"
  | "paintDark"
  | "chrome"
  | "steel"
  | "cast"
  | "plastic"
  | "rubber"
  | "rim"
  | "glass"
  | "lamp"
  | "tail"
  | "beacon"
  | "seat";

const HALF = Math.PI / 2;

/* ------------------------------------------------------------------ */
/* Matières                                                            */
/* ------------------------------------------------------------------ */

function createMaterials(): Record<MatKey, THREE.Material> {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  // Peinture vernie : c'est le vernis — une seconde couche spéculaire nette
  // par-dessus la couleur — qui distingue une carrosserie d'un aplat coloré.
  const paint = (color: number, roughness = 0.36) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.15,
      roughness,
      clearcoat: 0.7,
      clearcoatRoughness: 0.18,
    });
  return {
    paint: paint(0x37901c),
    paintDark: paint(0x23601a, 0.45),
    chrome: std({ color: 0xd9dee2, metalness: 0.96, roughness: 0.14 }),
    steel: std({ color: 0x8f979e, metalness: 0.72, roughness: 0.38 }),
    // Fonte de carter : mate, légèrement grenue.
    cast: std({ color: 0x53585d, metalness: 0.45, roughness: 0.72 }),
    plastic: std({ color: 0x26292d, metalness: 0.08, roughness: 0.62 }),
    rubber: std({ color: 0x1c1c1f, metalness: 0.02, roughness: 0.93 }),
    rim: std({ color: 0xe4b41c, metalness: 0.42, roughness: 0.34 }),
    glass: std({
      color: 0x9fd2e2,
      metalness: 0.02,
      roughness: 0.06,
      transparent: true,
      opacity: 0.46,
      side: THREE.DoubleSide,
    }),
    lamp: std({
      color: 0xfff4d2,
      emissive: new THREE.Color(0xffe9a8),
      emissiveIntensity: 0.7,
      roughness: 0.22,
      metalness: 0.1,
    }),
    tail: std({
      color: 0xc0281c,
      emissive: new THREE.Color(0x8c1a10),
      emissiveIntensity: 0.35,
      roughness: 0.3,
    }),
    beacon: std({
      color: 0xef9c18,
      emissive: new THREE.Color(0xef9c18),
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.85,
      roughness: 0.25,
    }),
    seat: std({ color: 0x1f2226, metalness: 0.05, roughness: 0.85 }),
  };
}

/* ------------------------------------------------------------------ */
/* Fabrique de géométrie                                               */
/* ------------------------------------------------------------------ */

function place(geo: THREE.BufferGeometry, pos: Vec3, rot?: Vec3): THREE.BufferGeometry {
  if (rot) {
    if (rot[0]) geo.rotateX(rot[0]);
    if (rot[1]) geo.rotateY(rot[1]);
    if (rot[2]) geo.rotateZ(rot[2]);
  }
  geo.translate(pos[0], pos[1], pos[2]);
  return geo;
}

function box(w: number, h: number, d: number, pos: Vec3, rot?: Vec3) {
  return place(new THREE.BoxGeometry(w, h, d), pos, rot);
}

function cyl(rt: number, rb: number, h: number, seg: number, pos: Vec3, rot?: Vec3) {
  return place(new THREE.CylinderGeometry(rt, rb, h, seg), pos, rot);
}

function tubeRing(r: number, thickness: number, seg: number, arc: number, pos: Vec3, rot?: Vec3) {
  return place(new THREE.TorusGeometry(r, thickness, 8, seg, arc), pos, rot);
}

function ball(r: number, pos: Vec3) {
  return place(new THREE.SphereGeometry(r, 12, 8), pos);
}

/** Rectangle à coins arrondis, prêt à extruder. */
function roundedShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/**
 * Boîte aux arêtes cassées. Une tôle de tracteur n'a jamais d'arête vive :
 * c'est ce chanfrein, plus que le nombre de pièces, qui sort le modèle du
 * registre « cube peint ».
 */
function roundedBox(w: number, h: number, d: number, r: number, pos: Vec3, rot?: Vec3) {
  const bevel = Math.min(0.012, d * 0.2);
  const geo = new THREE.ExtrudeGeometry(roundedShape(w, h, r), {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 5,
  });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  return place(geo, pos, rot);
}

/** Profil extrudé le long de Z — capot, garde-boue, tôles galbées. */
function extrude(points: [number, number][], depth: number, pos: Vec3, bevel = 0.012) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(depth - bevel * 2) / 2);
  return place(geo, pos);
}

/** Pièce de révolution : pneu, jante, moyeu. Axe ramené le long de Z. */
function lathe(profile: [number, number][], segments: number, pos: Vec3) {
  const pts = profile.map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(pts, segments);
  return place(geo, pos, [HALF, 0, 0]);
}

/** Flexible hydraulique : une courbe, pas un bâton. */
function hose(points: Vec3[], radius: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 14, radius, 6, false);
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fusionne un lot de géométries hétérogènes.
 *
 * `ExtrudeGeometry` et `TubeGeometry` sortent sans index, les primitives de
 * révolution avec : `mergeGeometries` refuse le mélange. On aplatit donc tout
 * en non-indexé avant de fusionner — quelques sommets de plus, mais une seule
 * pièce et un seul appel de rendu par matière.
 */
function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = geos.map((g) => {
    if (!g.index) return g;
    const nonIndexed = g.toNonIndexed();
    g.dispose();
    return nonIndexed;
  });
  const merged = mergeGeometries(flat, false)!;
  for (const g of flat) g.dispose();
  return merged;
}

/** Un nœud du modèle : ses pièces fusionnées par matière, et ses enfants. */
class Part {
  private buckets = new Map<MatKey, THREE.BufferGeometry[]>();
  readonly children: { node: Part; pos: Vec3; role?: string; radius?: number }[] = [];

  add(mat: MatKey, ...geos: THREE.BufferGeometry[]): this {
    const bucket = this.buckets.get(mat) ?? [];
    bucket.push(...geos);
    this.buckets.set(mat, bucket);
    return this;
  }

  child(pos: Vec3, role?: string, radius?: number): Part {
    const node = new Part();
    this.children.push({ node, pos, role, radius });
    return node;
  }

  build(materials: Record<MatKey, THREE.Material>, roles: Map<string, THREE.Object3D[]>): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, geos] of this.buckets) {
      const merged = geos.length === 1 ? geos[0] : mergeAll(geos);
      const mesh = new THREE.Mesh(markShared(merged), materials[mat]);
      mesh.castShadow = true;
      group.add(mesh);
    }
    for (const c of this.children) {
      const g = c.node.build(materials, roles);
      g.position.set(...c.pos);
      if (c.radius) g.userData.radius = c.radius;
      if (c.role) {
        const list = roles.get(c.role) ?? [];
        list.push(g);
        roles.set(c.role, list);
      }
      group.add(g);
    }
    return group;
  }
}

const REAR_R = 0.235;
const REAR_W = 0.175;
const FRONT_R = 0.15;
const FRONT_W = 0.125;

/**
 * Roue agricole : flancs bombés tournés au tour, crampons en chevron sur deux
 * rangées — le dessin R1 qu'on reconnaît de loin — jante en tôle emboutie,
 * moyeu boulonné.
 */
function wheel(radius: number, width: number, lugs: number): Part {
  const p = new Part();
  const hw = width / 2;
  const inner = radius * 0.46;

  p.add(
    "rubber",
    lathe(
      [
        [inner, -hw],
        [radius * 0.7, -hw],
        [radius * 0.88, -hw * 0.85],
        [radius * 0.97, -hw * 0.55],
        [radius, -hw * 0.2],
        [radius, hw * 0.2],
        [radius * 0.97, hw * 0.55],
        [radius * 0.88, hw * 0.85],
        [radius * 0.7, hw],
        [inner, hw],
      ],
      26,
      [0, 0, 0],
    ),
  );

  // Crampons : deux rangées inclinées en sens inverse, décalées d'un demi-pas.
  const treads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < lugs; i++) {
    for (const side of [-1, 1] as const) {
      const a = ((i + (side > 0 ? 0.5 : 0)) / lugs) * Math.PI * 2;
      treads.push(
        place(
          new THREE.BoxGeometry(radius * 0.22, radius * 0.07, width * 0.46),
          [Math.cos(a) * radius * 0.955, Math.sin(a) * radius * 0.955, side * width * 0.22],
          [0, side * 0.46, a],
        ),
      );
    }
  }
  p.add("rubber", ...treads);

  // Jante emboutie + voile
  p.add(
    "rim",
    lathe(
      [
        [inner * 0.5, -hw * 0.9],
        [inner * 0.95, -hw * 0.95],
        [inner * 1.02, -hw * 0.6],
        [inner * 1.02, hw * 0.6],
        [inner * 0.95, hw * 0.95],
        [inner * 0.5, hw * 0.9],
      ],
      20,
      [0, 0, 0],
    ),
    cyl(inner * 0.55, inner * 0.55, width * 0.5, 18, [0, 0, 0], [HALF, 0, 0]),
  );

  const bolts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    bolts.push(
      cyl(radius * 0.022, radius * 0.022, width * 0.56, 6, [
        Math.cos(a) * inner * 0.36,
        Math.sin(a) * inner * 0.36,
        0,
      ], [HALF, 0, 0]),
    );
  }
  p.add("steel", ...bolts, cyl(inner * 0.22, inner * 0.22, width * 0.62, 10, [0, 0, 0], [HALF, 0, 0]));
  // Valve
  p.add("chrome", cyl(0.008, 0.008, 0.05, 6, [inner * 0.7, 0, -width * 0.3], [HALF, 0, 0]));

  return p;
}

function buildHeroTractor(): { root: Part; roles: string[] } {
  const root = new Part();

  /* — Transmission, pont, carters ————————————————————————— */
  root.add(
    "cast",
    roundedBox(0.52, 0.2, 0.32, 0.05, [-0.1, 0.32, 0]),
    roundedBox(0.24, 0.17, 0.27, 0.05, [0.2, 0.3, 0]),
    // Carter de pont avant et sa chape de pivot
    cyl(0.045, 0.045, 0.44, 12, [0.36, 0.26, 0], [HALF, 0, 0]),
    roundedBox(0.12, 0.12, 0.16, 0.03, [0.36, 0.3, 0]),
  );
  // Réservoir sous cabine, côté gauche
  root.add("paintDark", roundedBox(0.3, 0.16, 0.1, 0.04, [-0.12, 0.36, 0.2]));

  /* — Capot : profil de côté extrudé, galbe compris ——————————— */
  root.add(
    "paint",
    extrude(
      [
        [-0.04, 0.3],
        [0.48, 0.3],
        [0.56, 0.335],
        [0.575, 0.41],
        [0.545, 0.48],
        [0.44, 0.53],
        [0.12, 0.555],
        [-0.04, 0.555],
      ],
      0.31,
      [0, 0, 0],
    ),
  );
  // Bande de flanc et ouïes de refroidissement
  root.add("paintDark", box(0.34, 0.035, 0.325, [0.22, 0.38, 0]));
  const louvres: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    for (const z of [0.163, -0.163] as const) {
      louvres.push(box(0.14, 0.014, 0.008, [0.3 - i * 0.055, 0.44, z]));
    }
  }
  root.add("plastic", ...louvres);

  /* — Calandre, phares, contrepoids ————————————————————————— */
  root.add("plastic", roundedBox(0.03, 0.16, 0.26, 0.03, [0.568, 0.39, 0]));
  const slats: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    slats.push(box(0.012, 0.012, 0.24, [0.585, 0.33 + i * 0.024, 0]));
  }
  root.add("chrome", ...slats);

  for (const z of [0.105, -0.105] as const) {
    root.add("chrome", tubeRing(0.034, 0.008, 14, Math.PI * 2, [0.556, 0.47, z], [0, HALF, 0]));
    root.add("lamp", cyl(0.03, 0.03, 0.02, 14, [0.553, 0.47, z], [0, 0, HALF]));
  }

  // Contrepoids : un porteur et ses gueuses, chacune détachée.
  root.add("steel", roundedBox(0.05, 0.1, 0.26, 0.02, [0.6, 0.28, 0]));
  const weights: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    weights.push(roundedBox(0.045, 0.1, 0.042, 0.012, [0.632, 0.27, -0.096 + i * 0.048]));
  }
  root.add("cast", ...weights);

  /* — Échappement : corps, écran thermique, sortie biseautée ————— */
  root.add(
    "plastic",
    cyl(0.026, 0.03, 0.34, 16, [0.4, 0.72, 0.126]),
    cyl(0.034, 0.034, 0.12, 16, [0.4, 0.62, 0.126]),
  );
  root.add("chrome", cyl(0.03, 0.026, 0.06, 16, [0.4, 0.9, 0.126], [0, 0, 0.22]));

  /* — Cabine : montants, toit galbé, vitrage —————————————————— */
  const cabFloor = 0.46;
  const cabTop = 0.78;
  root.add("cast", roundedBox(0.44, 0.04, 0.42, 0.03, [-0.08, cabFloor, 0]));
  for (const [x, z] of [
    [-0.26, 0.2],
    [-0.26, -0.2],
    [0.12, 0.2],
    [0.12, -0.2],
  ] as const) {
    root.add(
      "paintDark",
      cyl(0.017, 0.017, cabTop - cabFloor, 10, [x, (cabFloor + cabTop) / 2, z]),
    );
  }
  // Longerons de pavillon
  root.add(
    "paintDark",
    box(0.4, 0.022, 0.022, [-0.07, cabTop, 0.2]),
    box(0.4, 0.022, 0.022, [-0.07, cabTop, -0.2]),
  );
  root.add(
    "paint",
    roundedBox(0.5, 0.055, 0.48, 0.06, [-0.07, cabTop + 0.04, 0]),
    // Visière avant
    box(0.07, 0.02, 0.42, [0.19, cabTop + 0.05, 0], [0, 0, -0.12]),
  );

  // Panneaux bas de porte : la cabine est fermée sous la ligne de vitrage.
  root.add(
    "paint",
    roundedBox(0.38, 0.11, 0.022, 0.02, [-0.07, 0.52, 0.2]),
    roundedBox(0.38, 0.11, 0.022, 0.02, [-0.07, 0.52, -0.2]),
    roundedBox(0.022, 0.11, 0.38, 0.02, [-0.262, 0.52, 0]),
  );

  // Vitrage : quatre panneaux distincts, le pare-brise incliné.
  root.add(
    "glass",
    box(0.02, 0.2, 0.37, [0.117, 0.67, 0], [0, 0, 0.12]),
    box(0.02, 0.2, 0.37, [-0.262, 0.67, 0]),
    box(0.35, 0.2, 0.018, [-0.07, 0.67, 0.198]),
    box(0.35, 0.2, 0.018, [-0.07, 0.67, -0.198]),
  );
  // Poignée de porte et essuie-glace
  root.add("chrome", tubeRing(0.03, 0.006, 8, Math.PI, [-0.05, 0.56, 0.213], [HALF, 0, 0]));
  root.add(
    "plastic",
    cyl(0.006, 0.006, 0.1, 6, [0.15, 0.52, 0.06], [0, 0, 0.9]),
    box(0.012, 0.006, 0.14, [0.13, 0.56, 0.06], [0, 0, 0.9]),
  );

  // Rétroviseurs sur bras repliables
  for (const z of [0.235, -0.235] as const) {
    root.add(
      "steel",
      cyl(0.008, 0.008, 0.12, 8, [0.13, cabTop + 0.03, z * 0.86], [HALF, 0, 0.4]),
    );
    root.add("plastic", roundedBox(0.02, 0.09, 0.06, 0.015, [0.13, cabTop - 0.02, z]));
  }

  // Feux de travail sur le pavillon, gyrophare
  for (const z of [0.15, -0.15] as const) {
    root.add("plastic", roundedBox(0.05, 0.04, 0.06, 0.012, [0.16, cabTop + 0.07, z]));
    root.add("lamp", box(0.012, 0.03, 0.05, [0.187, cabTop + 0.07, z]));
  }
  root.child([-0.22, cabTop + 0.08, 0.16], "beacon")
    .add("steel", cyl(0.022, 0.022, 0.02, 10, [0, 0, 0]))
    .add("beacon", cyl(0.026, 0.03, 0.05, 12, [0, 0.03, 0]));

  /* — Poste de conduite ————————————————————————————————— */
  root.add(
    "seat",
    roundedBox(0.17, 0.05, 0.2, 0.03, [-0.14, 0.55, 0]),
    roundedBox(0.05, 0.2, 0.19, 0.03, [-0.22, 0.63, 0]),
  );
  root.add("plastic", cyl(0.05, 0.06, 0.06, 10, [-0.14, 0.5, 0]));
  root.add("steel", cyl(0.014, 0.014, 0.14, 8, [0.04, 0.58, 0], [0, 0, 0.55]));
  root.add("plastic", tubeRing(0.055, 0.012, 16, Math.PI * 2, [0.09, 0.64, 0], [0, HALF, 1.02]));
  // Tableau de bord et manettes
  root.add("plastic", roundedBox(0.1, 0.07, 0.22, 0.02, [0.1, 0.53, 0], [0, 0, -0.3]));
  root.add(
    "steel",
    cyl(0.007, 0.007, 0.09, 6, [-0.04, 0.56, 0.13], [0, 0, 0.25]),
    cyl(0.007, 0.007, 0.07, 6, [-0.08, 0.55, 0.13], [0, 0, 0.25]),
  );

  /* — Garde-boue arrière : tôle roulée et bourrelet de bord ——————— */
  for (const z of [0.238, -0.238] as const) {
    const from = Math.PI * 0.1;
    const span = Math.PI * 0.72;
    const shell = new THREE.CylinderGeometry(
      REAR_R + 0.03,
      REAR_R + 0.03,
      REAR_W + 0.012,
      24,
      1,
      true,
      from + HALF,
      span,
    );
    root.add("paint", place(shell, [-0.26, REAR_R, z], [HALF, 0, 0]));
    // Bourrelet de bord : une tôle roulée n'a pas de tranche vive.
    root.add(
      "paintDark",
      tubeRing(REAR_R + 0.03, 0.007, 24, span, [-0.26, REAR_R, z + (z > 0 ? 0.007 : -0.007)], [0, 0, from]),
    );
    // Plateforme plate au sommet du garde-boue, comme sur un tracteur de série
    root.add("paint", roundedBox(0.2, 0.016, REAR_W + 0.01, 0.008, [-0.26, REAR_R + 0.032, z]));
    // Marchepied et sa console
    root.add(
      "steel",
      roundedBox(0.16, 0.014, 0.07, 0.01, [-0.09, 0.34, z * 1.05]),
      cyl(0.009, 0.009, 0.12, 6, [-0.09, 0.4, z * 1.05]),
    );
  }

  /* — Relevage trois points, prise de force, flexibles ——————————— */
  for (const z of [0.12, -0.12] as const) {
    root.add(
      "steel",
      roundedBox(0.26, 0.045, 0.05, 0.015, [-0.5, 0.2, z], [0, 0, 0.12]),
      // Chandelle de relevage
      cyl(0.011, 0.011, 0.16, 8, [-0.44, 0.31, z], [0, 0, 0.14]),
    );
    root.add("cast", ball(0.026, [-0.62, 0.185, z]));
  }
  root.add(
    "steel",
    cyl(0.016, 0.016, 0.2, 10, [-0.5, 0.36, 0], [0, 0, 1.25]),
    cyl(0.024, 0.024, 0.06, 10, [-0.5, 0.36, 0], [0, 0, 1.25]),
  );
  root.add("cast", ball(0.024, [-0.58, 0.31, 0]), ball(0.024, [-0.42, 0.42, 0]));

  // Prise de force cannelée
  root.add("steel", cyl(0.03, 0.03, 0.07, 12, [-0.6, 0.26, 0], [0, 0, HALF]));
  const splines: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    splines.push(
      box(0.07, 0.008, 0.008, [-0.6, 0.26 + Math.sin(a) * 0.03, Math.cos(a) * 0.03], [a, 0, 0]),
    );
  }
  root.add("steel", ...splines);
  root.add("cast", cyl(0.05, 0.05, 0.03, 12, [-0.565, 0.26, 0], [0, 0, HALF]));

  // Distributeurs et flexibles : la courbe fait tout le réalisme.
  for (const z of [0.06, -0.06] as const) {
    root.add("chrome", cyl(0.012, 0.012, 0.05, 8, [-0.42, 0.44, z], [0, 0, HALF]));
    root.add(
      "plastic",
      hose(
        [
          [-0.44, 0.44, z],
          [-0.52, 0.42, z * 1.4],
          [-0.58, 0.33, z * 1.6],
          [-0.6, 0.24, z * 1.5],
        ],
        0.009,
      ),
    );
  }

  // Feux arrière et plaque
  for (const z of [0.16, -0.16] as const) {
    root.add("plastic", roundedBox(0.03, 0.05, 0.06, 0.012, [-0.55, 0.42, z]));
    root.add("tail", box(0.01, 0.035, 0.045, [-0.567, 0.42, z]));
  }

  // Barre d'attelage
  root.add(
    "steel",
    roundedBox(0.16, 0.03, 0.05, 0.012, [-0.56, 0.16, 0]),
    tubeRing(0.028, 0.008, 10, Math.PI * 2, [-0.64, 0.16, 0], [HALF, 0, 0]),
  );

  /* — Trains roulants ————————————————————————————————— */
  for (const z of [0.238, -0.238] as const) {
    const w = wheel(REAR_R, REAR_W, 14);
    const holder = root.child([-0.26, REAR_R, z], "wheel", REAR_R);
    holder.children.push({ node: w, pos: [0, 0, 0] });
  }
  const steer = root.child([0.36, FRONT_R, 0], "steer");
  for (const z of [0.208, -0.208] as const) {
    const w = wheel(FRONT_R, FRONT_W, 12);
    const holder = steer.child([0, 0, z], "wheel", FRONT_R);
    holder.children.push({ node: w, pos: [0, 0, 0] });
    // Fusée de direction
    steer.add("cast", cyl(0.022, 0.022, 0.06, 10, [0, 0, z * 0.72], [HALF, 0, 0]));
    // Garde-boue avant, solidaire de la fusée
    steer.add(
      "paint",
      place(
        new THREE.CylinderGeometry(
          FRONT_R + 0.03,
          FRONT_R + 0.03,
          FRONT_W + 0.018,
          20,
          1,
          true,
          Math.PI * 0.12 + HALF,
          Math.PI * 0.66,
        ),
        [0, 0, z],
        [HALF, 0, 0],
      ),
    );
  }

  return { root, roles: ["wheel", "steer", "beacon"] };
}

let heroBlueprint: { root: Part; roles: string[] } | null = null;

/* ------------------------------------------------------------------ */
/* Rig                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Monte le tracteur détaillé. Même interface que le parc low-poly : il se
 * substitue à `createMachineRig("TRACTOR")` sans rien changer à l'appelant.
 */
export function createHeroTractorRig(): MachineRig {
  if (!heroBlueprint) heroBlueprint = buildHeroTractor();
  const materials = createMaterials();
  const roles = new Map<string, THREE.Object3D[]>();
  const body = heroBlueprint.root.build(materials, roles);
  const group = new THREE.Group();
  group.add(body);

  return {
    group,
    length: 1.35,
    update(s: MachineState) {
      const steerAngle = (s.steer ?? 0) * 0.34;
      for (const w of roles.get("wheel") ?? []) {
        const r = (w.userData.radius as number) || 0.2;
        w.rotation.z = -s.distance / r;
      }
      for (const st of roles.get("steer") ?? []) st.rotation.y = steerAngle;

      const beaconMat = materials.beacon as THREE.MeshStandardMaterial;
      beaconMat.emissiveIntensity = s.working
        ? 0.35 + Math.abs(Math.sin(s.t * 6.2)) * 1.6
        : 0.18;

      body.position.y = s.working ? Math.sin(s.t * 46) * 0.004 : 0;
      body.rotation.z = s.working ? Math.sin(s.t * 31) * 0.003 : 0;
    },
    dispose() {
      for (const m of Object.values(materials)) m.dispose();
      group.clear();
    },
  };
}
