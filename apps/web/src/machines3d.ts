import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { MachineType } from "@farmsim/shared";
import { markShared } from "./three-cleanup";

/**
 * Parc matériel 3D — tracteur, moissonneuse, épandeur, déchaumeur.
 *
 * Trois exigences ont dicté la forme de ce module :
 *
 * 1. **De vraies machines, pas des boîtes.** Chaque engin a sa silhouette
 *    reconnaissable à 40 px : capot et cabine vitrée pour le tracteur, bec de
 *    coupe et vis de déchargement pour la moissonneuse, trémie et disques
 *    d'épandage pour l'épandeur, trains de disques pour le déchaumeur. La
 *    palette reprend celle des illustrations du catalogue (`MACHINE_ART`) —
 *    tracteur vert à jantes jaunes, moissonneuse rouge à barre de coupe or.
 *
 * 2. **Animables.** Un engin n'est pas un maillage figé mais un *rig* : roues,
 *    rabatteur, vis de déchargement, disques d'épandage et trains de disques
 *    sont des nœuds distincts, pilotés par la distance parcourue et non par
 *    le temps — les roues tournent donc exactement à la vitesse de l'engin,
 *    et s'arrêtent avec lui.
 *
 * 3. **Bon marché à instancier.** La vue iso reconstruit sa scène plusieurs
 *    fois par seconde : les géométries sont donc fusionnées par matériau
 *    (`mergeGeometries`), calculées une seule fois puis mises en cache et
 *    marquées partagées. Monter un engin ne coûte plus qu'une poignée de
 *    maillages et de matériaux. Compter ~8 appels de rendu par machine, là
 *    où des pièces non fusionnées en demanderaient une quarantaine.
 *
 * Écart assumé avec `docs/research/33_ART_DIRECTION.md` §4.2 : le budget y est
 * de 180–260 triangles pour un tracteur. Ces engins sont deux à trois fois
 * plus lourds, parce qu'ils sont les seuls objets *mobiles* de la ferme et
 * que l'œil s'y accroche. La compensation est ailleurs — fusion des pièces
 * statiques, cache de géométrie, et jamais plus d'une poignée d'engins à
 * l'écran. Le reste des règles (facettes, révolutions à 6/8/10 segments,
 * couleurs plates, aucune texture) est respecté.
 *
 * Repère local : l'engin avance vers **+X**, le sol est à **y = 0**.
 */

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

/** Matériaux communs à tout le parc — l'acier, le caoutchouc, le verre. */
const STEEL = 0xb3bbc2;
const STEEL_DARK = 0x5f676e;
const TYRE = 0x2c2b30;
const GLASS = 0x8fc8dc;
const LAMP = 0xfff1c2;
const BEACON = 0xf0a020;
const SEAT = 0x393f45;

type MatKey =
  | "body"
  | "bodyDark"
  | "panel"
  | "trim"
  | "metal"
  | "darkMetal"
  | "rubber"
  | "rim"
  | "glass"
  | "lamp"
  | "beacon"
  | "grain"
  | "seat";

type Palette = {
  /** Teinte principale de la carrosserie */
  body: number;
  /** Ombre de carrosserie : châssis, longerons, dessous de capot */
  bodyDark: number;
  /** Filet de décoration (bande latérale, arceaux) */
  trim: number;
  /** Jantes et pièces d'accastillage colorées */
  rim: number;
  /** Produit transporté : grain, engrais */
  grain: number;
};

const PALETTES: Record<MachineType, Palette> = {
  TRACTOR: { body: 0x4aa32e, bodyDark: 0x33761f, trim: 0x2b6119, rim: 0xecc324, grain: 0xdcb03c },
  HARVESTER: { body: 0xcf3a2b, bodyDark: 0x9e2a1f, trim: 0x2f3033, rim: 0xecc324, grain: 0xdcb03c },
  SPREADER: { body: 0x8d9299, bodyDark: 0x676d74, trim: 0x4f555b, rim: 0xe8b62c, grain: 0xd8d2c2 },
  DISC_HARROW: { body: 0x9a6b3f, bodyDark: 0x7a5230, trim: 0x5d3e23, rim: 0x8a5f38, grain: 0xd8c9a8 },
};

/**
 * Variation d'instance : ±3 % de luminosité, pour que deux tracteurs garés
 * côte à côte ne soient pas la photocopie l'un de l'autre.
 */
function shade(hex: number, amount: number): THREE.Color {
  const c = new THREE.Color(hex);
  if (amount !== 0) c.offsetHSL(0, 0, amount);
  return c;
}

function createMaterials(pal: Palette, seed: number): Record<MatKey, THREE.Material> {
  // Suite déterministe : la même case donne toujours la même nuance.
  const jitter = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const lift = (jitter - 0.5) * 0.06;

  const lam = (color: number, extra?: THREE.MeshLambertMaterialParameters) =>
    new THREE.MeshLambertMaterial({ color: shade(color, lift), flatShading: true, ...extra });

  return {
    body: lam(pal.body),
    bodyDark: lam(pal.bodyDark),
    // Les tôles ouvertes (garde-boue, capots arrondis) n'ont pas d'envers :
    // sans DoubleSide elles disparaissent sous certains angles de caméra.
    panel: lam(pal.body, { side: THREE.DoubleSide }),
    trim: lam(pal.trim),
    metal: new THREE.MeshStandardMaterial({
      color: shade(STEEL, lift),
      metalness: 0.25,
      roughness: 0.5,
      flatShading: true,
    }),
    darkMetal: new THREE.MeshStandardMaterial({
      color: STEEL_DARK,
      metalness: 0.4,
      roughness: 0.6,
      flatShading: true,
    }),
    rubber: lam(TYRE),
    rim: lam(pal.rim),
    glass: new THREE.MeshStandardMaterial({
      color: GLASS,
      metalness: 0.1,
      roughness: 0.12,
      transparent: true,
      opacity: 0.55,
    }),
    lamp: new THREE.MeshStandardMaterial({
      color: LAMP,
      emissive: new THREE.Color(LAMP),
      emissiveIntensity: 0.55,
      roughness: 0.4,
    }),
    beacon: new THREE.MeshStandardMaterial({
      color: BEACON,
      emissive: new THREE.Color(BEACON),
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.9,
      roughness: 0.35,
    }),
    grain: lam(pal.grain),
    seat: lam(SEAT),
  };
}

/* ------------------------------------------------------------------ */
/* Petite fabrique de géométrie                                        */
/* ------------------------------------------------------------------ */

type Vec3 = [number, number, number];

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

function cone(r: number, h: number, seg: number, pos: Vec3, rot?: Vec3) {
  return place(new THREE.ConeGeometry(r, h, seg), pos, rot);
}

const HALF = Math.PI / 2;

/**
 * Tôle cintrée ouverte — garde-boue, carter de rabatteur. L'arc est couché
 * dans le plan XY (axe le long de Z) et `from` se mesure **depuis +X**, sens
 * trigonométrique : un garde-boue qui coiffe la roue part donc de ~0.05π et
 * couvre ~0.9π. Le quart de tour ajouté à `thetaStart` compense la mise à
 * plat du cylindre, dont l'origine d'angle est sur +Z.
 */
function arc(
  radius: number,
  width: number,
  from: number,
  span: number,
  pos: Vec3,
  rot?: Vec3,
) {
  const geo = new THREE.CylinderGeometry(radius, radius, width, 10, 1, true, from + HALF, span);
  return place(geo, pos, rot ?? [HALF, 0, 0]);
}

/* ------------------------------------------------------------------ */
/* Roues                                                               */
/* ------------------------------------------------------------------ */

const wheelCache = new Map<string, THREE.BufferGeometry>();

/**
 * Roue agricole : pneu cranté + jante à boulons, fusionnée en une géométrie à
 * deux groupes (caoutchouc, jante). Axe le long de **Z** : la roue avance en
 * tournant autour de son axe Z.
 */
function wheelGeometry(radius: number, width: number, lugs: number): THREE.BufferGeometry {
  const key = `${radius}:${width}:${lugs}`;
  const cached = wheelCache.get(key);
  if (cached) return cached;

  const rubber: THREE.BufferGeometry[] = [
    cyl(radius, radius, width, 10, [0, 0, 0], [HALF, 0, 0]),
  ];
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2;
    // Crampons en chevron : légèrement inclinés, comme sur un pneu de terre.
    rubber.push(
      place(new THREE.BoxGeometry(radius * 0.34, radius * 0.16, width * 1.06), [
        Math.cos(a) * radius * 0.97,
        Math.sin(a) * radius * 0.97,
        0,
      ], [0, 0, a + 0.35]),
    );
  }

  const metal: THREE.BufferGeometry[] = [
    cyl(radius * 0.54, radius * 0.54, width * 1.04, 8, [0, 0, 0], [HALF, 0, 0]),
    cyl(radius * 0.2, radius * 0.2, width * 1.18, 6, [0, 0, 0], [HALF, 0, 0]),
  ];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    metal.push(
      box(radius * 0.09, radius * 0.09, width * 1.2, [
        Math.cos(a) * radius * 0.36,
        Math.sin(a) * radius * 0.36,
        0,
      ]),
    );
  }

  const geo = mergeGeometries(
    [mergeGeometries(rubber, false)!, mergeGeometries(metal, false)!],
    true,
  )!;
  for (const g of [...rubber, ...metal]) g.dispose();
  markShared(geo);
  wheelCache.set(key, geo);
  return geo;
}

/* ------------------------------------------------------------------ */
/* Plan de montage (blueprint)                                         */
/* ------------------------------------------------------------------ */

/** Rôle d'un nœud : ce que l'animation sait piloter. */
type Role =
  | "wheel"
  | "steer"
  | "reel"
  | "auger"
  | "spinner"
  | "gang"
  | "tool"
  | "beacon"
  | "hitch"
  | "exhaust";

type BpPart = { mats: MatKey[]; geo: THREE.BufferGeometry; shadow: boolean };

type BpNode = {
  role?: Role;
  pos: Vec3;
  rot: Vec3;
  parts: BpPart[];
  children: BpNode[];
  /** Roues : rayon, pour convertir la distance parcourue en rotation */
  radius?: number;
  /** Trains de disques : sens de rotation */
  spinDir?: number;
};

/**
 * Accumulateur de pièces. Les géométries d'un même matériau sont fusionnées à
 * la cuisson : un capot, ses tôles et sa calandre ne font plus qu'un maillage.
 */
class Node {
  private buckets = new Map<MatKey, THREE.BufferGeometry[]>();
  private shadowless = new Map<MatKey, THREE.BufferGeometry[]>();
  private multi: BpPart[] = [];
  private kids: Node[] = [];

  constructor(
    private role?: Role,
    private pos: Vec3 = [0, 0, 0],
    private rot: Vec3 = [0, 0, 0],
    private radius?: number,
    private spinDir?: number,
  ) {}

  /** Ajoute des pièces qui projettent une ombre (silhouette de l'engin). */
  add(mat: MatKey, ...geos: THREE.BufferGeometry[]): this {
    const bucket = this.buckets.get(mat) ?? [];
    bucket.push(...geos);
    this.buckets.set(mat, bucket);
    return this;
  }

  /** Pièces de détail : trop petites pour mériter une passe d'ombre. */
  addFlat(mat: MatKey, ...geos: THREE.BufferGeometry[]): this {
    const bucket = this.shadowless.get(mat) ?? [];
    bucket.push(...geos);
    this.shadowless.set(mat, bucket);
    return this;
  }

  /** Géométrie déjà fusionnée à plusieurs groupes (roue = pneu + jante). */
  addMulti(mats: MatKey[], geo: THREE.BufferGeometry, shadow = true): this {
    this.multi.push({ mats, geo, shadow });
    return this;
  }

  child(role?: Role, pos: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0], radius?: number, spinDir?: number): Node {
    const n = new Node(role, pos, rot, radius, spinDir);
    this.kids.push(n);
    return n;
  }

  bake(): BpNode {
    const parts: BpPart[] = [...this.multi];
    for (const [shadow, buckets] of [
      [true, this.buckets],
      [false, this.shadowless],
    ] as const) {
      for (const [mat, geos] of buckets) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)!;
        if (geos.length > 1) for (const g of geos) g.dispose();
        parts.push({ mats: [mat], geo: markShared(merged), shadow });
      }
    }
    return {
      role: this.role,
      pos: this.pos,
      rot: this.rot,
      radius: this.radius,
      spinDir: this.spinDir,
      parts,
      children: this.kids.map((k) => k.bake()),
    };
  }
}

type Blueprint = {
  root: BpNode;
  length: number;
  /** Point d'attelage arrière : là où l'engin tracte un outil */
  hitch: Vec3;
  /** Anneau d'attelage d'un outil traîné, dans son propre repère */
  eye: Vec3;
};

/* ------------------------------------------------------------------ */
/* Tracteur                                                            */
/* ------------------------------------------------------------------ */

function buildTractor(): Blueprint {
  const root = new Node();
  const REAR_R = 0.215;
  const FRONT_R = 0.135;

  // — Châssis et transmission
  root.add(
    "bodyDark",
    box(0.86, 0.11, 0.3, [-0.02, 0.235, 0]),
    box(0.26, 0.12, 0.42, [0.34, 0.2, 0]),
    box(0.1, 0.14, 0.3, [0.57, 0.27, 0]),
  );

  // — Capot moteur : deux volumes étagés, plus une bande sombre à mi-hauteur.
  root
    .add(
      "body",
      box(0.5, 0.2, 0.3, [0.26, 0.41, 0]),
      box(0.44, 0.08, 0.24, [0.26, 0.54, 0]),
    )
    .add("trim", box(0.5, 0.045, 0.315, [0.26, 0.345, 0]))
    .addFlat(
      "darkMetal",
      box(0.035, 0.14, 0.24, [0.515, 0.4, 0]),
      box(0.03, 0.04, 0.24, [0.575, 0.3, 0]),
      box(0.03, 0.04, 0.24, [0.575, 0.23, 0]),
    )
    .addFlat(
      "lamp",
      box(0.035, 0.07, 0.07, [0.52, 0.5, 0.1]),
      box(0.035, 0.07, 0.07, [0.52, 0.5, -0.1]),
    );

  // — Échappement vertical le long du montant droit du capot
  root.add(
    "darkMetal",
    cyl(0.024, 0.03, 0.32, 6, [0.42, 0.68, 0.115]),
    cyl(0.036, 0.036, 0.035, 6, [0.42, 0.85, 0.115]),
  );

  // — Cabine : plancher, quatre montants, toit débordant, vitrage teinté
  const cabY = 0.56;
  root
    .add("bodyDark", box(0.4, 0.05, 0.36, [-0.06, cabY, 0]))
    .add("body", box(0.44, 0.06, 0.42, [-0.06, 0.82, 0]))
    .addFlat("trim", box(0.07, 0.03, 0.38, [0.18, 0.8, 0]));
  for (const [x, z] of [
    [-0.24, 0.17],
    [-0.24, -0.17],
    [0.12, 0.17],
    [0.12, -0.17],
  ] as const) {
    root.addFlat("bodyDark", box(0.04, 0.24, 0.04, [x, cabY + 0.13, z]));
  }
  root.addFlat("glass", box(0.36, 0.23, 0.34, [-0.06, cabY + 0.13, 0]));

  // — Poste de conduite : siège, volant, colonne
  root
    .addFlat("seat", box(0.14, 0.05, 0.17, [-0.12, 0.61, 0]), box(0.05, 0.15, 0.17, [-0.19, 0.68, 0]))
    .addFlat(
      "darkMetal",
      place(new THREE.TorusGeometry(0.052, 0.011, 4, 8), [0.06, 0.7, 0], [0, 0, 1.1]),
      cyl(0.014, 0.014, 0.11, 6, [0.09, 0.64, 0], [0, 0, 0.5]),
    );

  // — Rétroviseurs et gyrophare : la petite ferronnerie qui « fait vrai »
  for (const z of [0.26, -0.26] as const) {
    root.addFlat(
      "darkMetal",
      box(0.02, 0.02, 0.11, [0.14, 0.86, z * 0.78]),
      box(0.02, 0.08, 0.05, [0.14, 0.84, z]),
    );
  }
  root
    .child("beacon", [-0.22, 0.87, 0.13])
    .addFlat("beacon", cyl(0.032, 0.036, 0.05, 8, [0, 0, 0]));

  // — Garde-boue arrière et marchepieds
  root
    .add(
      "panel",
      arc(REAR_R + 0.05, 0.17, Math.PI * 0.06, Math.PI * 0.88, [-0.24, REAR_R, 0.2]),
      arc(REAR_R + 0.05, 0.17, Math.PI * 0.06, Math.PI * 0.88, [-0.24, REAR_R, -0.2]),
    )
    .addFlat(
      "darkMetal",
      box(0.14, 0.02, 0.06, [-0.02, 0.34, 0.24]),
      box(0.14, 0.02, 0.06, [-0.02, 0.34, -0.24]),
    );

  // — Attelage trois points et prise de force
  root.add(
    "darkMetal",
    box(0.24, 0.045, 0.055, [-0.54, 0.19, 0.1]),
    box(0.24, 0.045, 0.055, [-0.54, 0.19, -0.1]),
    box(0.2, 0.045, 0.045, [-0.52, 0.35, 0]),
    cyl(0.035, 0.035, 0.07, 6, [-0.65, 0.25, 0], [0, 0, HALF]),
  );

  // — Roues : arrière motrices, avant directrices (pivot séparé)
  for (const z of [0.2, -0.2] as const) {
    root
      .child("wheel", [-0.24, REAR_R, z], [0, 0, 0], REAR_R)
      .addMulti(["rubber", "rim"], wheelGeometry(REAR_R, 0.15, 10));
  }
  const steer = root.child("steer", [0.34, FRONT_R, 0]);
  for (const z of [0.185, -0.185] as const) {
    steer
      .child("wheel", [0, 0, z], [0, 0, 0], FRONT_R)
      .addMulti(["rubber", "rim"], wheelGeometry(FRONT_R, 0.11, 8));
  }
  steer.addFlat("darkMetal", box(0.05, 0.05, 0.34, [0, 0, 0]));

  root.child("exhaust", [0.42, 0.88, 0.115]);
  root.child("hitch", [-0.62, 0.28, 0]);

  return { root: root.bake(), length: 1.28, hitch: [-0.62, 0.28, 0], eye: [0, 0, 0] };
}

/* ------------------------------------------------------------------ */
/* Moissonneuse                                                        */
/* ------------------------------------------------------------------ */

function buildHarvester(): Blueprint {
  const root = new Node();
  const DRIVE_R = 0.235;
  const STEER_R = 0.125;

  // — Caisse, capot moteur arrière, échelle latérale
  root
    .add(
      "body",
      box(0.84, 0.3, 0.46, [-0.12, 0.46, 0]),
      box(0.3, 0.24, 0.44, [-0.6, 0.42, 0]),
    )
    .add("bodyDark", box(0.86, 0.09, 0.48, [-0.12, 0.3, 0]))
    .addFlat(
      "darkMetal",
      box(0.02, 0.34, 0.02, [-0.02, 0.44, 0.25]),
      box(0.02, 0.34, 0.02, [-0.16, 0.44, 0.25]),
      box(0.16, 0.02, 0.02, [-0.09, 0.34, 0.25]),
      box(0.16, 0.02, 0.02, [-0.09, 0.46, 0.25]),
      box(0.16, 0.02, 0.02, [-0.09, 0.58, 0.25]),
      // Grille de refroidissement
      box(0.02, 0.16, 0.36, [-0.755, 0.44, 0]),
    );

  // — Trémie à grain : quatre parois basses et le blé qui affleure
  root
    .add("body", box(0.58, 0.2, 0.5, [-0.16, 0.71, 0]))
    .addFlat(
      "trim",
      box(0.6, 0.06, 0.03, [-0.16, 0.82, 0.25]),
      box(0.6, 0.06, 0.03, [-0.16, 0.82, -0.25]),
      box(0.03, 0.06, 0.5, [-0.45, 0.82, 0]),
      box(0.03, 0.06, 0.5, [0.13, 0.82, 0]),
    )
    .addFlat("grain", box(0.54, 0.05, 0.44, [-0.16, 0.8, 0]));

  // — Cabine avancée, vitrage panoramique, toit noir
  root
    .add("bodyDark", box(0.34, 0.05, 0.4, [0.3, 0.6, 0]))
    .add("trim", box(0.4, 0.06, 0.44, [0.3, 0.87, 0]))
    .addFlat("glass", box(0.32, 0.26, 0.38, [0.3, 0.73, 0]));
  for (const [x, z] of [
    [0.15, 0.19],
    [0.15, -0.19],
    [0.45, 0.19],
    [0.45, -0.19],
  ] as const) {
    root.addFlat("bodyDark", box(0.035, 0.28, 0.035, [x, 0.73, z]));
  }
  root.addFlat(
    "lamp",
    box(0.05, 0.05, 0.06, [0.42, 0.9, 0.14]),
    box(0.05, 0.05, 0.06, [0.42, 0.9, -0.14]),
  );
  for (const z of [0.16, -0.16] as const) {
    root.child("beacon", [0.16, 0.92, z]).addFlat("beacon", cyl(0.03, 0.034, 0.05, 8, [0, 0, 0]));
  }

  // — Convoyeur : la gorge qui descend vers le bec de coupe
  root.add("bodyDark", box(0.36, 0.24, 0.36, [0.54, 0.38, 0], [0, 0, -0.16]));

  // — Vis de déchargement : repliée le long de la caisse, elle se déploie
  //   sur le côté pour vider la trémie.
  const auger = root.child("auger", [-0.26, 0.84, 0.17]);
  auger
    .add("body", cyl(0.055, 0.055, 0.7, 8, [-0.33, 0.02, 0], [0, 0, HALF]))
    .addFlat(
      "darkMetal",
      // Goulotte de sortie et pivot de tourelle
      box(0.11, 0.13, 0.11, [-0.68, -0.05, 0]),
      cyl(0.05, 0.05, 0.12, 6, [-0.02, -0.06, 0]),
      box(0.16, 0.03, 0.03, [-0.14, 0.07, 0]),
    );

  // — Bec de coupe : ensemble mobile (relevé en transport, posé au travail)
  const header = root.child("tool", [0.78, 0, 0]);
  header
    .add(
      "body",
      box(0.2, 0.2, 1.0, [0.04, 0.32, 0]),
      box(0.28, 0.06, 0.98, [0.14, 0.21, 0]),
    )
    .add(
      "rim",
      box(0.08, 0.035, 0.98, [0.29, 0.19, 0]),
      cone(0.06, 0.2, 6, [0.22, 0.24, 0.52], [0, 0, -HALF]),
      cone(0.06, 0.2, 6, [0.22, 0.24, -0.52], [0, 0, -HALF]),
    );
  // Sections de lame : la dentelure se lit même de loin.
  for (let i = 0; i < 13; i++) {
    const z = -0.45 + i * 0.075;
    header.addFlat("metal", cone(0.028, 0.06, 4, [0.34, 0.19, z], [0, 0, -HALF]));
  }
  // Bras de rabatteur
  header.addFlat(
    "trim",
    box(0.24, 0.04, 0.04, [0.06, 0.46, 0.4]),
    box(0.24, 0.04, 0.04, [0.06, 0.46, -0.4]),
  );

  // — Rabatteur : cinq battes garnies de dents, tourne avec l'avance
  const reel = header.child("reel", [0.16, 0.46, 0], [0, 0, 0], 0.14);
  const bats: THREE.BufferGeometry[] = [];
  const tines: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const bx = Math.cos(a) * 0.13;
    const by = Math.sin(a) * 0.13;
    bats.push(box(0.032, 0.032, 0.86, [bx, by, 0]));
    for (let j = 0; j < 4; j++) {
      const z = -0.33 + j * 0.22;
      tines.push(box(0.012, 0.075, 0.012, [bx * 1.16, by * 1.16 - 0.03, z], [0, 0, a]));
    }
  }
  // Battes en acier, dents jaunes : le rabatteur doit se détacher du bec
  // rouge, sinon la pièce la plus mobile de la machine disparaît.
  reel
    .add("metal", ...bats)
    .addFlat("rim", ...tines)
    .addFlat(
      "metal",
      cyl(0.13, 0.13, 0.025, 6, [0, 0, 0.42], [HALF, 0, 0]),
      cyl(0.13, 0.13, 0.025, 6, [0, 0, -0.42], [HALF, 0, 0]),
    );

  // — Roues : motrices larges à l'avant, directrices étroites à l'arrière
  for (const z of [0.25, -0.25] as const) {
    root
      .child("wheel", [0.12, DRIVE_R, z], [0, 0, 0], DRIVE_R)
      .addMulti(["rubber", "rim"], wheelGeometry(DRIVE_R, 0.18, 12));
  }
  const steer = root.child("steer", [-0.56, STEER_R, 0]);
  for (const z of [0.17, -0.17] as const) {
    steer
      .child("wheel", [0, 0, z], [0, 0, 0], STEER_R)
      .addMulti(["rubber", "rim"], wheelGeometry(STEER_R, 0.1, 8));
  }
  steer.addFlat("darkMetal", box(0.05, 0.05, 0.3, [0, 0, 0]));

  // — Éparpilleur de paille
  root.add("darkMetal", box(0.1, 0.16, 0.44, [-0.78, 0.34, 0]));
  root.child("exhaust", [-0.5, 0.62, 0.16]);

  return { root: root.bake(), length: 1.9, hitch: [-0.86, 0.3, 0], eye: [0, 0, 0] };
}

/* ------------------------------------------------------------------ */
/* Épandeur                                                            */
/* ------------------------------------------------------------------ */

/**
 * Outil traîné : son origine est **l'anneau d'attelage**, à l'avant. Le reste
 * de la machine se développe vers les X négatifs, ce qui permet de l'accrocher
 * derrière un tracteur en posant simplement son origine sur le point
 * d'attelage.
 */
function buildSpreader(): Blueprint {
  const root = new Node();
  const WHEEL_R = 0.165;

  const CX = -0.44;

  // — Flèche et anneau d'attelage
  root
    .add("rim", box(0.34, 0.06, 0.07, [-0.17, 0.3, 0]))
    .addFlat("darkMetal", place(new THREE.TorusGeometry(0.04, 0.012, 4, 8), [0.01, 0.3, 0], [HALF, 0, 0]));

  // — Châssis : deux longerons plutôt qu'une plaque pleine, sinon les
  //   disques d'épandage — la pièce qui dit ce que fait la machine —
  //   disparaissent sous le plancher.
  root.add(
    "rim",
    box(0.54, 0.07, 0.09, [CX, 0.3, 0.2]),
    box(0.54, 0.07, 0.09, [CX, 0.3, -0.2]),
    box(0.09, 0.07, 0.48, [CX + 0.22, 0.3, 0]),
    box(0.09, 0.07, 0.48, [CX - 0.22, 0.3, 0]),
    box(0.28, 0.06, 0.09, [CX - 0.32, 0.3, 0.16]),
    box(0.28, 0.06, 0.09, [CX - 0.32, 0.3, -0.16]),
  );

  // — Trémie tronconique : un cylindre à 4 pans, tourné de 45°, donne une
  //   caisse pyramidale nette sans géométrie sur mesure. Mi-hauteur de côté
  //   en haut : 0.32 × √2/2 ≈ 0.226, dont dépendent les rambardes.
  const hopper = cyl(0.32, 0.16, 0.34, 4, [CX, 0.52, 0], [0, Math.PI / 4, 0]);
  hopper.scale(1, 1, 0.8);
  root
    .add("body", hopper)
    // Rambarde ouverte plutôt qu'un couvercle plein : on doit voir l'engrais.
    .add(
      "rim",
      box(0.5, 0.05, 0.05, [CX, 0.7, 0.18]),
      box(0.5, 0.05, 0.05, [CX, 0.7, -0.18]),
      box(0.05, 0.05, 0.4, [CX + 0.225, 0.7, 0]),
      box(0.05, 0.05, 0.4, [CX - 0.225, 0.7, 0]),
    )
    .addFlat("grain", box(0.4, 0.03, 0.3, [CX, 0.65, 0]))
    .addFlat(
      "trim",
      // Nervures de caisse
      box(0.035, 0.32, 0.04, [CX + 0.19, 0.52, 0.15]),
      box(0.035, 0.32, 0.04, [CX - 0.19, 0.52, 0.15]),
      box(0.035, 0.32, 0.04, [CX + 0.19, 0.52, -0.15]),
      box(0.035, 0.32, 0.04, [CX - 0.19, 0.52, -0.15]),
    );

  // — Descentes et disques d'épandage
  root.addFlat(
    "trim",
    cone(0.07, 0.16, 6, [CX - 0.32, 0.3, 0.16], [Math.PI, 0, 0]),
    cone(0.07, 0.16, 6, [CX - 0.32, 0.3, -0.16], [Math.PI, 0, 0]),
  );
  for (const [z, dir] of [
    [0.16, 1],
    [-0.16, -1],
  ] as const) {
    const disc = root.child("spinner", [CX - 0.32, 0.19, z], [0, 0, 0], undefined, dir);
    disc.add("metal", cyl(0.145, 0.145, 0.018, 8, [0, 0, 0]));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      disc.addFlat(
        "rim",
        box(0.022, 0.045, 0.11, [Math.cos(a) * 0.07, 0.03, Math.sin(a) * 0.07], [0, -a, 0]),
      );
    }
    disc.addFlat("darkMetal", cyl(0.025, 0.025, 0.05, 6, [0, 0.03, 0]));
  }

  // — Essieu et roues
  root.addFlat("darkMetal", box(0.07, 0.07, 0.74, [CX + 0.02, WHEEL_R, 0]));
  for (const z of [0.37, -0.37] as const) {
    root
      .child("wheel", [CX + 0.02, WHEEL_R, z], [0, 0, 0], WHEEL_R)
      .addMulti(["rubber", "rim"], wheelGeometry(WHEEL_R, 0.12, 9));
    root.add(
      "panel",
      arc(WHEEL_R + 0.06, 0.15, Math.PI * 0.05, Math.PI * 0.9, [CX + 0.02, WHEEL_R, z]),
    );
  }

  return { root: root.bake(), length: 1.0, hitch: [-0.9, 0.3, 0], eye: [0.01, 0.3, 0] };
}

/* ------------------------------------------------------------------ */
/* Déchaumeur à disques                                                */
/* ------------------------------------------------------------------ */

function buildDiscHarrow(): Blueprint {
  const root = new Node();
  const WHEEL_R = 0.16;

  // — Flèche et anneau d'attelage
  root
    .add("body", box(0.34, 0.07, 0.08, [-0.17, 0.36, 0]))
    .addFlat("darkMetal", place(new THREE.TorusGeometry(0.04, 0.012, 4, 8), [0.01, 0.36, 0], [HALF, 0, 0]));

  // — Cadre : deux longerons, deux traverses et un contreventement en V.
  //   Il reste haut et étroit pour ne pas masquer les disques, qui sont la
  //   pièce à voir.
  root
    .add(
      "body",
      box(0.76, 0.07, 0.08, [-0.6, 0.46, 0.22]),
      box(0.76, 0.07, 0.08, [-0.6, 0.46, -0.22]),
      box(0.09, 0.07, 0.52, [-0.92, 0.46, 0]),
    )
    .addFlat(
      "bodyDark",
      box(0.42, 0.05, 0.05, [-0.26, 0.46, 0.14], [0, 0.7, 0]),
      box(0.42, 0.05, 0.05, [-0.26, 0.46, -0.14], [0, -0.7, 0]),
    );

  // — Deux trains de disques, inclinés en sens inverse : c'est cette croix
  //   qui signe un déchaumeur et retourne réellement les résidus.
  for (const [x, yaw, dir] of [
    [-0.4, 0.42, 1],
    [-0.8, -0.42, -1],
  ] as const) {
    // Le porte-disques descend au travail et remonte en transport : nœud
    // « tool », commun à tous les outils portés.
    const tool = root.child("tool", [x, 0, 0]);
    tool.addFlat(
      "bodyDark",
      box(0.06, 0.34, 0.06, [0, 0.3, 0.18]),
      box(0.06, 0.34, 0.06, [0, 0.3, -0.18]),
    );
    const gang = tool.child("gang", [0, 0.16, 0], [0, yaw, 0], 0.16, dir);
    gang.addFlat("darkMetal", cyl(0.024, 0.024, 0.68, 6, [0, 0, 0], [HALF, 0, 0]));
    for (let i = 0; i < 5; i++) {
      const z = -0.32 + i * 0.16;
      // Disques légèrement coniques : ils accrochent la lumière par la
      // tranche, comme de l'acier poli.
      gang.add("metal", cyl(0.16, 0.142, 0.016, 10, [0, 0, z], [HALF, 0, 0]));
      gang.addFlat("darkMetal", cyl(0.04, 0.04, 0.036, 6, [0, 0, z], [HALF, 0, 0]));
    }
  }

  // — Roues de transport, portées haut sur leurs chandelles
  for (const z of [0.4, -0.4] as const) {
    root
      .child("wheel", [-0.96, WHEEL_R, z], [0, 0, 0], WHEEL_R)
      .addMulti(["rubber", "rim"], wheelGeometry(WHEEL_R, 0.11, 9));
    root.add("body", box(0.09, 0.32, 0.08, [-0.96, WHEEL_R + 0.18, z * 0.8]));
  }
  root.addFlat("darkMetal", box(0.07, 0.07, 0.76, [-0.96, WHEEL_R, 0]));

  return { root: root.bake(), length: 1.15, hitch: [-1.05, 0.36, 0], eye: [0.01, 0.36, 0] };
}

/* ------------------------------------------------------------------ */
/* Cache des plans                                                     */
/* ------------------------------------------------------------------ */

const BUILDERS: Record<MachineType, () => Blueprint> = {
  TRACTOR: buildTractor,
  HARVESTER: buildHarvester,
  SPREADER: buildSpreader,
  DISC_HARROW: buildDiscHarrow,
};

const blueprints = new Map<MachineType, Blueprint>();

function blueprint(type: MachineType): Blueprint {
  let bp = blueprints.get(type);
  if (!bp) {
    bp = BUILDERS[type]();
    blueprints.set(type, bp);
  }
  return bp;
}

/** Outils traînés : ils n'ont pas de moteur, il leur faut un tracteur. */
const TOWED: MachineType[] = ["SPREADER", "DISC_HARROW"];

export function isTowedImplement(type: MachineType): boolean {
  return TOWED.includes(type);
}

/* ------------------------------------------------------------------ */
/* Montage et animation                                                */
/* ------------------------------------------------------------------ */

export type MachineState = {
  /** Temps de scène, secondes */
  t: number;
  /** Distance parcourue depuis le montage, en unités monde (1 = une case) */
  distance: number;
  /** Chantier en cours : outil abaissé, gyrophare, moteur qui vibre */
  working: boolean;
  /** Braquage normalisé, −1 (gauche) à 1 (droite) */
  steer?: number;
  /** Moissonneuse : vis de déchargement déployée */
  unloading?: boolean;
};

export type MachineRigOptions = {
  /** Attelé derrière un tracteur — obligatoire pour un outil au travail */
  towed?: boolean;
  /** Ombres portées : coûteuses, réservées à la vue ferme */
  shadows?: boolean;
  /** Graine de variation de teinte, pour ne pas cloner deux engins voisins */
  seed?: number;
};

export type MachineRig = {
  /** À ajouter à la scène ; l'appelant en pilote position et rotation */
  group: THREE.Group;
  /** Emprise au sol, unités monde */
  length: number;
  update(state: MachineState): void;
  dispose(): void;
};

type Unit = {
  group: THREE.Group;
  /** Corps suspendu : c'est lui qui vibre, pas le groupe piloté par l'appelant */
  body: THREE.Group;
  roles: Map<Role, THREE.Object3D[]>;
  materials: Record<MatKey, THREE.Material>;
};

function instantiate(node: BpNode, materials: Record<MatKey, THREE.Material>, roles: Map<Role, THREE.Object3D[]>, shadows: boolean): THREE.Group {
  const g = new THREE.Group();
  g.position.set(node.pos[0], node.pos[1], node.pos[2]);
  g.rotation.set(node.rot[0], node.rot[1], node.rot[2]);
  if (node.radius) g.userData.radius = node.radius;
  if (node.spinDir) g.userData.spinDir = node.spinDir;

  for (const part of node.parts) {
    const mat = part.mats.length === 1 ? materials[part.mats[0]] : part.mats.map((m) => materials[m]);
    const mesh = new THREE.Mesh(part.geo, mat);
    mesh.castShadow = shadows && part.shadow;
    g.add(mesh);
  }
  for (const child of node.children) {
    g.add(instantiate(child, materials, roles, shadows));
  }
  if (node.role) {
    const list = roles.get(node.role) ?? [];
    list.push(g);
    roles.set(node.role, list);
  }
  return g;
}

function createUnit(type: MachineType, opts: MachineRigOptions): Unit {
  const bp = blueprint(type);
  const materials = createMaterials(PALETTES[type], opts.seed ?? 0);
  const roles = new Map<Role, THREE.Object3D[]>();
  const body = instantiate(bp.root, materials, roles, opts.shadows ?? true);
  const group = new THREE.Group();
  group.add(body);
  return { group, body, roles, materials };
}

function animateUnit(unit: Unit, s: Required<MachineState>) {
  const { roles } = unit;

  // Roues : la rotation vient de la distance, pas du temps. Un engin à
  // l'arrêt a des roues immobiles — le détail que l'œil repère aussitôt.
  for (const w of roles.get("wheel") ?? []) {
    const r = (w.userData.radius as number) || 0.2;
    w.rotation.z = -s.distance / r;
  }
  for (const st of roles.get("steer") ?? []) {
    st.rotation.y = s.steer * 0.34;
  }

  // Rabatteur : il tourne un peu plus vite que l'avance, sinon il « patine »
  // visuellement au lieu de peigner les épis.
  for (const reel of roles.get("reel") ?? []) {
    const r = (reel.userData.radius as number) || 0.14;
    reel.rotation.z = -(s.distance * 1.25) / r - (s.working ? s.t * 1.6 : 0);
  }

  // Trains de disques : entraînés par le sol, donc par la distance.
  for (const gang of roles.get("gang") ?? []) {
    const r = (gang.userData.radius as number) || 0.115;
    const dir = (gang.userData.spinDir as number) || 1;
    gang.rotation.z = (-s.distance / r) * dir;
  }

  // Disques d'épandage : entraînés par la prise de force, donc par le régime
  // moteur et non par l'avance — ils tournent vite et régulièrement au
  // travail, et se figent en l'état dès que la machine s'arrête.
  if (s.working) {
    for (const sp of roles.get("spinner") ?? []) {
      sp.rotation.y = s.t * 13 * ((sp.userData.spinDir as number) || 1);
    }
  }

  // Outil : relevé en déplacement, posé au travail.
  for (const tool of roles.get("tool") ?? []) {
    const target = s.working ? 0 : 0.11;
    tool.position.y += (target - tool.position.y) * 0.12;
    tool.rotation.z = -tool.position.y * 0.35;
  }

  // Vis de déchargement : elle pivote sur le côté pour vider la trémie.
  for (const auger of roles.get("auger") ?? []) {
    const target = s.unloading ? -HALF : 0;
    auger.rotation.y += (target - auger.rotation.y) * 0.06;
  }

  // Gyrophare : éteint au repos, battement à ~2 Hz au travail.
  const beacon = unit.materials.beacon as THREE.MeshStandardMaterial;
  const flash = s.working ? 0.35 + Math.abs(Math.sin(s.t * 6.2)) * 1.5 : 0.15;
  beacon.emissiveIntensity = flash;
  for (const b of roles.get("beacon") ?? []) {
    b.scale.setScalar(s.working ? 1 + Math.abs(Math.sin(s.t * 6.2)) * 0.12 : 1);
  }

  // Moteur : vibration fine, uniquement au travail. Sur un engin à l'arrêt
  // elle passerait pour un défaut de rendu.
  unit.body.position.y = s.working ? Math.sin(s.t * 46) * 0.004 : 0;
  unit.body.rotation.z = s.working ? Math.sin(s.t * 31) * 0.004 : 0;
}

function disposeUnit(unit: Unit) {
  // Les géométries sont partagées et mises en cache : seuls les matériaux,
  // propres à l'instance, sont à libérer.
  for (const mat of Object.values(unit.materials)) mat.dispose();
}

/**
 * Monte un engin prêt à animer.
 *
 * Un outil traîné (épandeur, déchaumeur) demandé avec `towed` est livré
 * attelé derrière un tracteur : c'est le seul attelage crédible au champ.
 * Sans `towed`, il est livré dételé, béquille sortie, comme au parc matériel.
 */
export function createMachineRig(type: MachineType, opts: MachineRigOptions = {}): MachineRig {
  const group = new THREE.Group();
  const units: Unit[] = [];
  let length = blueprint(type).length;

  if (opts.towed && isTowedImplement(type)) {
    const tractor = createUnit("TRACTOR", opts);
    const implement = createUnit(type, { ...opts, seed: (opts.seed ?? 0) + 7 });
    // L'anneau de l'outil vient se poser exactement sur la chape du
    // tracteur : c'est ce qui donne un attelage jointif plutôt qu'un outil
    // qui flotte derrière son timon.
    const hitch = blueprint("TRACTOR").hitch;
    const eye = blueprint(type).eye;
    implement.group.position.set(hitch[0] - eye[0], hitch[1] - eye[1], 0);
    group.add(tractor.group, implement.group);
    units.push(tractor, implement);
    length = blueprint("TRACTOR").length + blueprint(type).length;
    // L'attelage recentre l'ensemble : sans cela le tracteur serait au milieu
    // de la case et l'outil hors du champ travaillé.
    group.children.forEach((c) => (c.position.x += length * 0.22));
  } else {
    const unit = createUnit(type, opts);
    group.add(unit.group);
    units.push(unit);
  }

  const state: Required<MachineState> = {
    t: 0,
    distance: 0,
    working: false,
    steer: 0,
    unloading: false,
  };

  return {
    group,
    length,
    update(next: MachineState) {
      state.t = next.t;
      state.distance = next.distance;
      state.working = next.working;
      state.steer = next.steer ?? 0;
      state.unloading = next.unloading ?? false;
      for (const unit of units) animateUnit(unit, state);
    },
    dispose() {
      for (const unit of units) disposeUnit(unit);
      group.clear();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Poussière de travail                                                */
/* ------------------------------------------------------------------ */

export type DustTrail = {
  object: THREE.Object3D;
  /** À appeler à chaque image : `dt` en secondes, position de l'engin */
  update(dt: number, x: number, y: number, z: number, emitting: boolean): void;
  dispose(): void;
};

/**
 * Panache derrière un engin au travail — huit bouffées recyclées, jamais plus.
 * C'est le détail qui fait qu'une machine « pèse » sur le sol au lieu de
 * glisser dessus.
 */
/** Une seule bouffée de géométrie pour toute l'application. */
let dustGeometry: THREE.IcosahedronGeometry | null = null;

export function createDustTrail(count = 8, color = 0xd8c9a8): DustTrail {
  const object = new THREE.Group();
  if (!dustGeometry) dustGeometry = markShared(new THREE.IcosahedronGeometry(0.07, 0));
  const geo = dustGeometry;
  const mat = new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const puffs = Array.from({ length: count }, () => {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    object.add(m);
    return { mesh: m, life: 0 };
  });
  let next = 0;
  let cooldown = 0;

  return {
    object,
    update(dt, x, y, z, emitting) {
      cooldown -= dt;
      if (emitting && cooldown <= 0) {
        cooldown = 0.09;
        const puff = puffs[next];
        next = (next + 1) % puffs.length;
        puff.life = 1;
        puff.mesh.position.set(x + (Math.random() - 0.5) * 0.12, y, z + (Math.random() - 0.5) * 0.12);
        puff.mesh.visible = true;
      }
      for (const puff of puffs) {
        if (puff.life <= 0) continue;
        puff.life -= dt * 2;
        if (puff.life <= 0) {
          puff.mesh.visible = false;
          continue;
        }
        puff.mesh.position.y += dt * 0.18;
        const grow = 1 + (1 - puff.life) * 0.9;
        puff.mesh.scale.setScalar(grow);
        (puff.mesh.material as THREE.MeshLambertMaterial).opacity = puff.life * 0.35;
      }
    },
    dispose() {
      for (const puff of puffs) (puff.mesh.material as THREE.Material).dispose();
      mat.dispose();
      object.clear();
    },
  };
}
