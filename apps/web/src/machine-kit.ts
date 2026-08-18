import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { markShared } from "./three-cleanup";

/**
 * Boîte à outils commune du parc matériel.
 *
 * Tout le vocabulaire de formes du parc est ici : rien n'y est une simple
 * boîte. Une tôle a des arêtes cassées, un capot est un profil galbé extrudé,
 * un pneu et une jante sont tournés au tour, un flexible est une courbe. C'est
 * ce vocabulaire — plus que le nombre de pièces — qui sort les machines du
 * registre « cube peint ».
 *
 * Les matières sont PBR : peinture vernie, chrome, fonte mate, verre teinté.
 * La scène doit fournir une `environment` (voir `createStudioEnvironment`),
 * faute de quoi les métaux paraissent éteints.
 *
 * Repère local du parc : l'engin avance vers **+X**, le sol est à **y = 0**.
 */

export type Vec3 = [number, number, number];

export const HALF = Math.PI / 2;

/* ------------------------------------------------------------------ */
/* Matières                                                            */
/* ------------------------------------------------------------------ */

export type MatKey =
  /* — Machines ————————————————————————————————————————— */
  | "paint"
  | "paintDark"
  | "trim"
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
  | "grain"
  | "seat"
  /* — Bâtiments ——————————————————————————————————————— */
  /** Couverture : tuile, bac acier, ardoise */
  | "roof"
  /** Faîtage, rives, gouttières */
  | "roofDark"
  /** Bardage courant : planche, crépi, pierre */
  | "wall"
  /** Soubassement, poteaux, angles */
  | "wallDark"
  /** Charpente apparente, clôtures, portails */
  | "timber"
  /** Tôle ondulée galvanisée : cellule à grain, hangar */
  | "corrugate"
  /** Dalle, muret, auge */
  | "concrete"
  /** Vantail, porte coulissante */
  | "door"
  /** Paille, foin, litière */
  | "hay"
  /** Buisson de cour, herbe rase */
  | "foliage"
  /** Terre battue de la cour */
  | "dirt";

export type Palette = {
  /** Teinte de carrosserie */
  body: number;
  /** Ombre de carrosserie : châssis, bas de caisse */
  bodyDark: number;
  /** Second ton peint : toit, arceaux, pièces de contraste */
  trim: number;
  /** Jantes et accastillage coloré */
  rim: number;
  /** Produit transporté : grain, engrais */
  grain: number;
};

export type Materials = Record<MatKey, THREE.Material>;

/**
 * Jeu de matières d'une machine.
 *
 * `seed` décale légèrement la teinte : deux engins voisins ne doivent pas être
 * la photocopie l'un de l'autre.
 *
 * `wear` (0 = sortie d'usine, 1 = bonne à réviser) salit la machine : la
 * peinture se ternit et perd son vernis, le chrome s'oxyde, l'acier rouille,
 * les pneus se couvrent de poussière. C'est le seul moyen de lire l'état du
 * parc sans ouvrir un menu — et l'entretien du jeu se joue précisément là.
 */
export function createMaterials(pal: Palette, seed = 0, wear = 0): Materials {
  const w = Math.max(0, Math.min(1, wear));
  /** Terre séchée : ce vers quoi tout tire en vieillissant. */
  const MUD = new THREE.Color(0x6b5a44);
  const RUST = new THREE.Color(0x8a5a3c);
  const soil = (c: THREE.Color, amount: number) => c.lerp(MUD, amount * w);
  const jitter = ((Math.sin(seed * 12.9898) * 43758.5453) % 1) - 0.5;
  const tint = (hex: number) => {
    const c = new THREE.Color(hex);
    if (seed) c.offsetHSL(0, 0, jitter * 0.05);
    return c;
  };

  // Peinture vernie : une couche spéculaire nette par-dessus la couleur. C'est
  // elle qui fait la différence entre une carrosserie et un aplat.
  const paint = (hex: number, roughness = 0.36) =>
    new THREE.MeshPhysicalMaterial({
      color: soil(tint(hex), 0.5),
      metalness: 0.15,
      roughness: Math.min(1, roughness + w * 0.34),
      // Le vernis part le premier : une machine fatiguée ne brille plus.
      clearcoat: 0.7 * (1 - w * 0.85),
      clearcoatRoughness: 0.18 + w * 0.4,
    });
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);

  const machine = {
    paint: paint(pal.body),
    paintDark: paint(pal.bodyDark, 0.45),
    trim: paint(pal.trim, 0.42),
    chrome: std({
      color: new THREE.Color(0xd9dee2).lerp(RUST, w * 0.5),
      metalness: 0.96 - w * 0.5,
      roughness: 0.14 + w * 0.5,
    }),
    steel: std({
      color: new THREE.Color(0x8f979e).lerp(RUST, w * 0.45),
      metalness: 0.72 - w * 0.35,
      roughness: 0.38 + w * 0.4,
    }),
    // Fonte de carter : mate, presque grenue.
    cast: std({ color: 0x53585d, metalness: 0.45, roughness: 0.72 }),
    plastic: std({ color: 0x26292d, metalness: 0.08, roughness: 0.62 }),
    // Le caoutchouc ne rouille pas : il se couvre de poussière et pâlit.
    rubber: std({
      color: new THREE.Color(0x1c1c1f).lerp(new THREE.Color(0x6a6053), w * 0.45),
      metalness: 0.02,
      roughness: 0.93,
    }),
    rim: paint(pal.rim, 0.34),
    glass: std({
      color: new THREE.Color(0x9fd2e2).lerp(new THREE.Color(0xb9b6a4), w * 0.6),
      metalness: 0.02,
      roughness: 0.06 + w * 0.3,
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
    grain: std({ color: pal.grain, metalness: 0.05, roughness: 0.85 }),
    seat: std({ color: 0x1f2226, metalness: 0.05, roughness: 0.85 }),
  };

  // Un engin ne bâtit rien : les clés de maçonnerie renvoient sur des matières
  // qu'il possède déjà. Le registre reste complet — `Part` indexe par clé — sans
  // fabriquer douze matériaux dont aucun tracteur ne se sert.
  return {
    ...machine,
    roof: machine.trim,
    roofDark: machine.paintDark,
    wall: machine.paint,
    wallDark: machine.paintDark,
    timber: machine.cast,
    corrugate: machine.steel,
    concrete: machine.cast,
    door: machine.trim,
    hay: machine.grain,
    foliage: machine.grain,
    dirt: machine.cast,
  };
}

/* ------------------------------------------------------------------ */
/* Matières de bâtiment                                                */
/* ------------------------------------------------------------------ */

export type BuildingPalette = {
  /** Couverture : tuile de terre cuite, bac acier laqué, ardoise */
  roof: number;
  /** Bardage courant : bardage bois, crépi, moellon */
  wall: number;
  /** Charpente et clôtures */
  timber: number;
  /** Tôle galvanisée, cuves, portes de hangar */
  metal: number;
};

/**
 * Jeu de matières d'un bâtiment.
 *
 * Un bâtiment ne brille pas comme une carrosserie : pas de vernis, des surfaces
 * rugueuses, et une part de la lecture qui vient du contraste entre la
 * couverture, le bardage et la charpente. `wear` marque l'âge — le bois grise,
 * la tôle se ternit, le crépi se salit — et `seed` évite que deux hangars
 * voisins soient la photocopie l'un de l'autre.
 */
export function createBuildingMaterials(
  pal: BuildingPalette,
  seed = 0,
  wear = 0,
): Materials {
  const w = Math.max(0, Math.min(1, wear));
  /** Gris de bois exposé : ce vers quoi toute matière extérieure tire. */
  const WEATHERED = new THREE.Color(0x8d8477);
  const jitter = ((Math.sin(seed * 12.9898) * 43758.5453) % 1) - 0.5;
  const tint = (hex: number, amount = 1) => {
    const c = new THREE.Color(hex);
    if (seed) c.offsetHSL(0, 0, jitter * 0.045);
    return c.lerp(WEATHERED, amount * w * 0.5);
  };
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const shade = (hex: number, amount: number) =>
    new THREE.Color(hex).multiplyScalar(amount).getHex();

  // La couverture est la seule surface qui accroche un peu la lumière : c'est
  // ce qui distingue une tuile émaillée ou un bac acier d'un mur crépi.
  const roof = std({
    color: tint(pal.roof, 0.7),
    metalness: 0.12,
    roughness: 0.52 + w * 0.3,
  });
  const timber = std({ color: tint(pal.timber), metalness: 0.02, roughness: 0.86 + w * 0.1 });
  const corrugate = std({
    color: tint(pal.metal, 0.6),
    metalness: 0.55 - w * 0.3,
    roughness: 0.42 + w * 0.4,
  });

  return {
    /* — Bâtiment ————————————————————————————————————————— */
    roof,
    roofDark: std({ color: tint(shade(pal.roof, 0.68), 0.7), metalness: 0.1, roughness: 0.6 }),
    wall: std({ color: tint(pal.wall), metalness: 0, roughness: 0.9 }),
    wallDark: std({ color: tint(shade(pal.wall, 0.74)), metalness: 0, roughness: 0.92 }),
    timber,
    corrugate,
    concrete: std({ color: tint(0xb9b3a6, 0.4), metalness: 0, roughness: 0.95 }),
    door: std({ color: tint(shade(pal.timber, 0.86)), metalness: 0.04, roughness: 0.8 }),
    hay: std({ color: 0xd6bb70, metalness: 0, roughness: 1 }),
    foliage: std({ color: 0x5f9b45, metalness: 0, roughness: 0.95 }),
    dirt: std({ color: 0x9a7d55, metalness: 0, roughness: 1 }),
    glass: std({
      color: 0x9fd2e2,
      metalness: 0.02,
      roughness: 0.08,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    }),
    lamp: std({
      color: 0xfff4d2,
      emissive: new THREE.Color(0xffe9a8),
      emissiveIntensity: 0.7,
      roughness: 0.22,
    }),

    /* — Clés de machine, sans emploi ici ——————————————————— */
    paint: roof,
    paintDark: roof,
    trim: timber,
    chrome: corrugate,
    steel: corrugate,
    cast: timber,
    plastic: timber,
    rubber: timber,
    rim: corrugate,
    tail: roof,
    beacon: roof,
    grain: timber,
    seat: timber,
  };
}

/* ------------------------------------------------------------------ */
/* Formes                                                              */
/* ------------------------------------------------------------------ */

export function place(geo: THREE.BufferGeometry, pos: Vec3, rot?: Vec3): THREE.BufferGeometry {
  if (rot) {
    if (rot[0]) geo.rotateX(rot[0]);
    if (rot[1]) geo.rotateY(rot[1]);
    if (rot[2]) geo.rotateZ(rot[2]);
  }
  geo.translate(pos[0], pos[1], pos[2]);
  return geo;
}

export function box(w: number, h: number, d: number, pos: Vec3, rot?: Vec3) {
  return place(new THREE.BoxGeometry(w, h, d), pos, rot);
}

export function cyl(rt: number, rb: number, h: number, seg: number, pos: Vec3, rot?: Vec3) {
  return place(new THREE.CylinderGeometry(rt, rb, h, seg), pos, rot);
}

export function cone(r: number, h: number, seg: number, pos: Vec3, rot?: Vec3) {
  return place(new THREE.ConeGeometry(r, h, seg), pos, rot);
}

export function ring(
  r: number,
  thickness: number,
  seg: number,
  arc: number,
  pos: Vec3,
  rot?: Vec3,
) {
  return place(new THREE.TorusGeometry(r, thickness, 8, seg, arc), pos, rot);
}

export function ball(r: number, pos: Vec3, seg = 12) {
  return place(new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2)), pos);
}

function roundedShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, Math.min(w, h) / 2 - 0.001);
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  return s;
}

/** Boîte aux arêtes cassées — une tôle n'a jamais d'arête vive. */
export function roundedBox(
  w: number,
  h: number,
  d: number,
  r: number,
  pos: Vec3,
  rot?: Vec3,
) {
  const bevel = Math.min(0.012, d * 0.2, w * 0.2, h * 0.2);
  // `bevelSize` pousse le contour vers l'extérieur : sans cette compensation,
  // la pièce mesure 2 × bevelSize de trop en largeur comme en hauteur.
  const geo = new THREE.ExtrudeGeometry(roundedShape(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.001, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 5,
  });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  return place(geo, pos, rot);
}

/** Profil de côté extrudé — capot, caisse, cadre de bec de coupe. */
export function extrude(
  points: [number, number][],
  depth: number,
  pos: Vec3,
  rot?: Vec3,
  bevel = 0.012,
) {
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
  return place(geo, pos, rot);
}

/** Pièce de révolution, axe ramené le long de **Z** : pneu, jante, disque. */
export function lathe(profile: [number, number][], segments: number, pos: Vec3, rot?: Vec3) {
  const geo = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
  return place(geo, pos, rot ?? [HALF, 0, 0]);
}

/** Tôle cintrée ouverte — garde-boue. `from` se mesure depuis +X. */
export function shell(
  radius: number,
  width: number,
  from: number,
  span: number,
  pos: Vec3,
  segments = 24,
) {
  const geo = new THREE.CylinderGeometry(radius, radius, width, segments, 1, true, from + HALF, span);
  return place(geo, pos, [HALF, 0, 0]);
}

/** Flexible, main courante, durite : une courbe, pas un bâton. */
export function tube(points: Vec3[], radius: number, radialSegments = 6) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 14, radius, radialSegments, false);
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fusionne un lot de géométries hétérogènes.
 *
 * `ExtrudeGeometry` et `TubeGeometry` sortent sans index, les primitives de
 * révolution avec : `mergeGeometries` refuse le mélange. On aplatit donc tout
 * en non-indexé — quelques sommets de plus, mais une seule pièce et un seul
 * appel de rendu par matière.
 */
export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
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

/** Rôles animés reconnus par les rigs. */
export type Role =
  | "wheel"
  | "steer"
  | "reel"
  | "auger"
  | "spinner"
  | "gang"
  | "tool"
  | "beacon"
  /** Sortie du pot : un nœud vide, d'où part la fumée */
  | "exhaust"
  /**
   * Vantail de bâtiment. Le nœud pivote sur son bord : `pos` est le **gond**,
   * pas le centre du panneau, sinon la porte tourne sur elle-même au lieu de
   * s'ouvrir.
   */
  | "door"
  /** Extracteur de toiture, girouette : tourne doucement, sans fin */
  | "vane"
  /**
   * Rotor d'éolienne : tourne autour de l'axe **z**, pas de l'axe vertical.
   *
   * `vane` ne convenait pas — un extracteur de toiture tourne à plat, une
   * hélice face au vent. Deux mouvements différents, deux rôles.
   */
  | "rotor"
  /**
   * Seuil de bâtiment : nœud vide d'où sortent les bêtes. La vue s'en sert
   * comme point de passage — sans lui, un troupeau traverse le mur.
   */
  | "threshold";

/**
 * Nœud d'un plan de montage : ses pièces, fusionnées par matière à la
 * construction, et ses enfants — dont les pièces mobiles.
 */
export class Part {
  private buckets = new Map<MatKey, THREE.BufferGeometry[]>();
  private kids: {
    node: Part;
    pos: Vec3;
    rot?: Vec3;
    role?: Role;
    radius?: number;
    spin?: number;
    slide?: number;
  }[] = [];

  add(mat: MatKey, ...geos: THREE.BufferGeometry[]): this {
    const bucket = this.buckets.get(mat) ?? [];
    bucket.push(...geos);
    this.buckets.set(mat, bucket);
    return this;
  }

  child(
    pos: Vec3,
    opts: {
      rot?: Vec3;
      role?: Role;
      radius?: number;
      spin?: number;
      /**
       * Course d'une pièce qui **coulisse** au lieu de pivoter : rideau
       * métallique, porte de grange sur rail. Un rideau qu'on fait tourner sur
       * son gond tourne sur lui-même, ce qui ne ressemble à rien.
       */
      slide?: number;
    } = {},
  ): Part {
    const node = new Part();
    this.kids.push({ node, pos, ...opts });
    return node;
  }

  /**
   * Greffe une pièce déjà décrite ailleurs — typiquement une roue, partagée
   * entre les quatre coins d'un engin et entre les engins eux-mêmes.
   */
  attach(piece: Part, pos: Vec3 = [0, 0, 0]): this {
    this.kids.push({ node: piece, pos });
    return this;
  }

  build(materials: Materials, roles: Map<Role, THREE.Object3D[]>, shadows: boolean): THREE.Group {
    const group = new THREE.Group();
    for (const [mat, geos] of this.buckets) {
      const merged = geos.length === 1 ? geos[0] : mergeAll(geos);
      const mesh = new THREE.Mesh(markShared(merged), materials[mat]);
      // Nommer par matière : utile au diagnostic d'assiette, et lisible une
      // fois le modèle ouvert dans un outil 3D.
      mesh.name = mat;
      mesh.castShadow = shadows;
      group.add(mesh);
    }
    for (const kid of this.kids) {
      const g = kid.node.build(materials, roles, shadows);
      g.position.set(...kid.pos);
      if (kid.rot) g.rotation.set(...kid.rot);
      if (kid.radius) g.userData.radius = kid.radius;
      if (kid.spin) g.userData.spin = kid.spin;
      if (kid.slide) g.userData.slide = kid.slide;
      if (kid.role) {
        const list = roles.get(kid.role) ?? [];
        // Nommer les nœuds animés : c'est ce qui rend le modèle exploitable
        // hors du jeu, une fois exporté en glTF.
        g.name = `${kid.role}_${list.length + 1}`;
        list.push(g);
        roles.set(kid.role, list);
      }
      group.add(g);
    }
    return group;
  }
}

/* ------------------------------------------------------------------ */
/* Roues                                                               */
/* ------------------------------------------------------------------ */

const wheelCache = new Map<string, Part>();

/**
 * Roue agricole : flancs bombés tournés au tour, crampons en chevron sur deux
 * rangées — le dessin qu'on reconnaît de loin —, jante emboutie et moyeu
 * boulonné. L'axe est le long de **Z** : la roue avance en tournant autour
 * de Z.
 */
export function wheelPart(radius: number, width: number, lugs: number): Part {
  const key = `${radius}:${width}:${lugs}`;
  const cached = wheelCache.get(key);
  if (cached) return cached;

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

  // Crampons en chevron, sur deux rangées décalées d'un demi-pas.
  //
  // L'ordre des rotations compte : `place` tourne autour de X, puis Y, puis Z.
  // Après le `rotateZ(a)` final, c'est l'axe **X** de la boîte qui pointe vers
  // l'extérieur de la roue — donc sa dimension X est l'épaisseur du crampon,
  // et l'inclinaison en chevron se prend autour de X. Poser la grande
  // dimension sur X faisait dépasser le crampon de 13 % du rayon, et l'engin
  // s'enfonçait d'autant dans le sol.
  const treads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < lugs; i++) {
    for (const side of [-1, 1] as const) {
      const a = ((i + (side > 0 ? 0.5 : 0)) / lugs) * Math.PI * 2;
      treads.push(
        place(
          new THREE.BoxGeometry(radius * 0.07, radius * 0.24, width * 0.46),
          [Math.cos(a) * radius * 0.955, Math.sin(a) * radius * 0.955, side * width * 0.22],
          [side * 0.46, 0, a],
        ),
      );
    }
  }
  p.add("rubber", ...treads);

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

  wheelCache.set(key, p);
  return p;
}

/* ------------------------------------------------------------------ */
/* Environnement                                                       */
/* ------------------------------------------------------------------ */

/**
 * Accroche un environnement de studio à la scène : sans lui, la peinture
 * vernie, le chrome et le verre des machines rendent comme de la peinture
 * mate. Chargé à la demande — cette pièce ne sert qu'aux engins.
 *
 * Rend une fonction de libération, à appeler au démontage.
 */
export function attachStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  intensity = 0.42,
): () => void {
  let pmrem: THREE.PMREMGenerator | null = null;
  let cancelled = false;

  void import("three/examples/jsm/environments/RoomEnvironment.js").then(({ RoomEnvironment }) => {
    if (cancelled) return;
    pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    scene.environmentIntensity = intensity;
    room.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
  });

  return () => {
    cancelled = true;
    scene.environment = null;
    pmrem?.dispose();
  };
}
