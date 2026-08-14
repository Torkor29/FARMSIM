import * as THREE from "three";
import { BUILDING_DEFS, type BuildingType } from "@farmsim/shared";
import {
  HALF,
  Part,
  box,
  cone,
  createBuildingMaterials,
  cyl,
  extrude,
  lathe,
  place,
  ring,
  tube,
  type BuildingPalette,
  type Role,
  type Vec3,
} from "./machine-kit";

/**
 * Les bâtiments de la ferme, en volume.
 *
 * Jusqu'ici une construction était une image collée face à la caméra, dont la
 * hauteur au sol se devinait en scannant le canal alpha du fichier. Deux
 * conséquences : le hangar flottait dès que l'heuristique se trompait, et
 * l'orientation était impossible — un panneau face caméra ne tourne pas.
 *
 * Trois règles commandent ce module.
 *
 * **Ça pose.** Tout modèle est coté depuis le sol : `y = 0` est la terre, et
 * rien ne descend en dessous. La vue n'a plus rien à deviner, elle place le
 * groupe à la hauteur du terrain et c'est tout.
 *
 * **Ça tourne.** Le repère local est celui de l'empreinte : la construction
 * occupe exactement `w × h` unités, façade vers **+Z**. Un quart de tour
 * permute `w` et `h` — d'où `orientedFootprint` côté partagé, qui doit être
 * consulté partout où l'on lit une emprise.
 *
 * **Ça vit.** Les vantaux ne sont pas des panneaux posés devant la grange :
 * ce sont des nœuds du modèle, articulés sur leur gond (rôle `door`), avec un
 * seuil (rôle `threshold`) d'où sortent les bêtes. Un extracteur de toiture
 * tourne au ralenti (rôle `vane`).
 *
 * Repère local : `x` = largeur, `z` = profondeur, `y` = hauteur, façade en
 * `+z`, sol en `y = 0`, une unité = une case.
 */

/* ------------------------------------------------------------------ */
/* Teintes                                                             */
/* ------------------------------------------------------------------ */

const PALETTES: Record<BuildingType, BuildingPalette> = {
  SILO: { roof: 0x2f7d6b, wall: 0xc8ccd0, timber: 0x8a704e, metal: 0xb6bcc2 },
  HAY_BARN: { roof: 0x2f7d6b, wall: 0xb0824c, timber: 0x8a5f38, metal: 0xa9b0b6 },
  MACHINE_SHED: { roof: 0x2f7d6b, wall: 0xc08a52, timber: 0x8a5f38, metal: 0xa9b0b6 },
  CATTLE_BARN: { roof: 0x2f7d6b, wall: 0xb5793f, timber: 0x7d5330, metal: 0xa9b0b6 },
  PIGSTY: { roof: 0x9a5f3a, wall: 0xd6c6a8, timber: 0x8a6a45, metal: 0xa9b0b6 },
  HENHOUSE: { roof: 0xc0503a, wall: 0xdcc38c, timber: 0x8a6a45, metal: 0xa9b0b6 },
  SHEEPFOLD: { roof: 0x4f7f8c, wall: 0xc2a377, timber: 0x7d5330, metal: 0xa9b0b6 },
  WORKSHOP: { roof: 0x5a6470, wall: 0xa8a49c, timber: 0x6f5a3e, metal: 0x9aa2a9 },
  FARMHOUSE: { roof: 0xa8503a, wall: 0xe6d9bd, timber: 0x7d5330, metal: 0xa9b0b6 },
  PADDOCK: { roof: 0x2f7d6b, wall: 0xc2a377, timber: 0x8a6a45, metal: 0xa9b0b6 },
  PIG_YARD: { roof: 0x9a5f3a, wall: 0xc2a377, timber: 0x8a6a45, metal: 0xa9b0b6 },
  HEN_YARD: { roof: 0xc0503a, wall: 0xc2a377, timber: 0x8a6a45, metal: 0xa9b0b6 },
  COLD_ROOM: { roof: 0x8f9aa4, wall: 0xe8ecef, timber: 0x6f5a3e, metal: 0x9aa2a9 },
};

/* ------------------------------------------------------------------ */
/* Vocabulaire de construction                                         */
/* ------------------------------------------------------------------ */

/** Marge entre le bâti et le bord de sa case : un mur ne mord pas le champ. */
const EDGE = 0.09;

/**
 * Dalle de propreté.
 *
 * Elle assied la construction : sans ce liseré de béton, un mur qui sort de
 * l'herbe donne exactement l'impression de flotter qu'on cherche à corriger.
 */
function slab(part: Part, w: number, d: number, thick = 0.035): void {
  part.add("concrete", box(w, thick, d, [0, thick / 2, 0]));
  part.add("dirt", box(w - 0.04, 0.012, d - 0.04, [0, thick + 0.006, 0]));
}

/**
 * Toiture à deux pentes.
 *
 * `rise` est la flèche au faîtage au-dessus de la sablière. Les deux versants
 * sont des dalles inclinées, décalées le long de leur propre normale : posées
 * à plat puis tournées, elles laisseraient une fente au faîtage.
 */
function gableRoof(
  part: Part,
  w: number,
  d: number,
  eaveY: number,
  rise: number,
  opts: { overhang?: number; thick?: number; mat?: "roof" | "corrugate" } = {},
): number {
  const over = opts.overhang ?? 0.07;
  const thick = opts.thick ?? 0.045;
  const mat = opts.mat ?? "roof";
  const half = w / 2 + over;
  const len = Math.hypot(half, rise);
  const angle = Math.atan2(rise, half);
  for (const side of [-1, 1]) {
    // Normale sortante du versant : c'est elle qui porte la demi-épaisseur.
    const nx = (side * rise) / len;
    const ny = half / len;
    part.add(
      mat,
      box(
        len,
        thick,
        d + over * 2,
        [(side * half) / 2 + (nx * thick) / 2, eaveY + rise / 2 + (ny * thick) / 2, 0],
        [0, 0, -side * angle],
      ),
    );
  }
  // Faîtière : la ligne sombre qui coiffe la rencontre des deux pentes.
  part.add(
    "roofDark",
    box(0.07, 0.05, d + over * 2 + 0.02, [0, eaveY + rise + thick * 0.55, 0]),
  );
  return eaveY + rise;
}

/** Pignon : le triangle de bardage qui ferme la grange sous ses pentes. */
function gableEnd(part: Part, w: number, eaveY: number, rise: number, z: number, mat: "wall" | "timber" = "wall"): void {
  part.add(
    mat,
    extrude(
      [
        [-w / 2, 0],
        [w / 2, 0],
        [0, rise],
      ],
      0.06,
      [0, eaveY, z],
      undefined,
      0.006,
    ),
  );
}

/** Toiture à une pente — appentis, poulailler, chambre froide. */
function monoRoof(
  part: Part,
  w: number,
  d: number,
  lowY: number,
  rise: number,
  opts: { overhang?: number; thick?: number; mat?: "roof" | "corrugate" } = {},
): void {
  const over = opts.overhang ?? 0.06;
  const thick = opts.thick ?? 0.04;
  const len = Math.hypot(d + over * 2, rise);
  const angle = Math.atan2(rise, d + over * 2);
  part.add(
    opts.mat ?? "roof",
    box(w + over * 2, thick, len, [0, lowY + rise / 2 + thick * 0.5, 0], [angle, 0, 0]),
  );
}

/**
 * Bardage d'un mur plein, avec ses lisses.
 *
 * Un mur nu est un aplat ; deux traverses et quelques montants suffisent à
 * lui donner une matière lisible à quarante pixels de haut.
 */
function claddedWall(
  part: Part,
  w: number,
  hgt: number,
  thick: number,
  pos: Vec3,
  rot?: Vec3,
  studs = 4,
): void {
  part.add("wall", box(w, hgt, thick, pos, rot));
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < studs; i++) {
    const x = (-w / 2 + (w * (i + 0.5)) / studs);
    geos.push(box(0.045, hgt * 0.96, thick * 0.34, [x, 0, thick * 0.66]));
  }
  geos.push(box(w, 0.05, thick * 0.4, [0, -hgt / 2 + 0.09, thick * 0.66]));
  geos.push(box(w, 0.05, thick * 0.4, [0, hgt / 2 - 0.09, thick * 0.66]));
  // Les lisses sont décrites dans le repère du mur puis rapportées avec lui :
  // une pièce plaquée sur un mur tourné doit tourner avec le mur.
  const node = part.child(pos, { rot });
  node.add("timber", ...geos);
}

/** Poteau de charpente, avec son sabot de béton. */
function post(part: Part, x: number, z: number, hgt: number, r = 0.045): void {
  part.add("timber", box(r * 2, hgt, r * 2, [x, hgt / 2, z]));
  part.add("concrete", box(r * 2.6, 0.05, r * 2.6, [x, 0.025, z]));
}

/**
 * Barrière : piquets et lisses le long d'une suite de tronçons.
 *
 * Le tracé est donné en tronçons plutôt qu'en boucle fermée, précisément pour
 * pouvoir réserver la place du portail. Une barrière continue passerait devant
 * la porte, et le troupeau sortirait au travers.
 */
function fence(
  part: Part,
  segments: [[number, number], [number, number]][],
  opts: { hgt?: number; rails?: number; spacing?: number } = {},
): void {
  const hgt = opts.hgt ?? 0.3;
  const rails = opts.rails ?? 2;
  const spacing = opts.spacing ?? 0.42;
  for (const [a, b] of segments) {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const yaw = Math.atan2(dx, dz);
    const node = part.child([(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2], { rot: [0, yaw, 0] });
    const count = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k <= count; k++) {
      node.add("timber", box(0.05, hgt, 0.05, [0, hgt / 2, -len / 2 + (len * k) / count]));
    }
    for (let r = 0; r < rails; r++) {
      const y = hgt * (0.38 + (r * 0.5) / Math.max(1, rails - 1)) || hgt * 0.6;
      node.add("timber", box(0.03, 0.05, len, [0, Math.min(hgt - 0.05, y), 0]));
    }
  }
}

/**
 * Monticule : bauge, tas de terre.
 *
 * Une sphère enfoncée dans le sol pour n'en montrer que le dessus passe sous
 * la dalle — et un modèle qui descend sous `y = 0` est exactement ce qu'on
 * cherche à interdire. On ne garde donc que la calotte.
 */
function mound(r: number, hgt: number, pos: Vec3): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, HALF);
  geo.scale(1, hgt / r, 1);
  return place(geo, pos);
}

/** Fenêtre : une embrasure sombre, un verre, et son cadre clair. */
function window_(part: Part, w: number, h: number, pos: Vec3, rot?: Vec3): void {
  const node = part.child(pos, { rot });
  node.add("wallDark", box(w, h, 0.03, [0, 0, 0]));
  node.add("glass", box(w - 0.03, h - 0.03, 0.012, [0, 0, 0.018]));
  node.add("timber", box(w + 0.03, 0.028, 0.035, [0, h / 2, 0.02]));
  node.add("timber", box(w + 0.03, 0.028, 0.035, [0, -h / 2, 0.02]));
  node.add("timber", box(0.028, h, 0.035, [0, 0, 0.024]));
}

/**
 * Paire de vantaux articulés sur leurs gonds, plus le seuil.
 *
 * Le nœud d'un vantail est posé **sur le gond**, pas au milieu du panneau :
 * un panneau centré tournerait sur lui-même au lieu de s'ouvrir. Le seuil est
 * un nœud vide, un peu en avant de la façade : c'est de là que les bêtes
 * sortent, et c'est ce que la vue interroge pour tracer leur trajet.
 */
function doorway(
  part: Part,
  w: number,
  h: number,
  z: number,
  opts: { thick?: number; dark?: boolean } = {},
): void {
  const thick = opts.thick ?? 0.05;
  const leaf = w / 2;
  // Le noir de l'ouverture : sans lui on voit le champ au travers de la grange.
  part.add("wallDark", box(w, h, 0.04, [0, h / 2, z - 0.03]));
  for (const side of [-1, 1]) {
    const hinge = part.child([side * leaf, 0, z], { role: "door" });
    hinge.add("door", box(leaf, h, thick, [(-side * leaf) / 2, h / 2, 0]));
    hinge.add("timber", box(leaf * 0.94, 0.05, thick * 0.5, [(-side * leaf) / 2, h - 0.09, thick * 0.6]));
    hinge.add("timber", box(leaf * 0.94, 0.05, thick * 0.5, [(-side * leaf) / 2, 0.11, thick * 0.6]));
    // Le croisillon : la marque d'une porte de grange, reconnaissable de loin.
    hinge.add(
      "timber",
      box(Math.hypot(leaf * 0.9, h - 0.2), 0.04, thick * 0.5, [
        (-side * leaf) / 2,
        h / 2,
        thick * 0.6,
      ], [0, 0, side * Math.atan2(h - 0.2, leaf * 0.9)]),
    );
  }
  part.add("timber", box(w + 0.1, 0.07, thick * 1.2, [0, h + 0.03, z]));
  part.child([0, 0, z + 0.16], { role: "threshold" });
}

/** Cheminée de maison : conduit, larmier et mitron. */
function chimney(part: Part, x: number, z: number, top: number): void {
  part.add("wallDark", box(0.15, top, 0.15, [x, top / 2, z]));
  part.add("roofDark", box(0.2, 0.05, 0.2, [x, top + 0.02, z]));
  part.add("wallDark", box(0.07, 0.06, 0.07, [x, top + 0.07, z]));
}

/**
 * Buissons et pierres de cour : ce qui distingue une ferme d'une maquette.
 *
 * Deux servitudes commandent le placement. Rien ne dépasse de l'empreinte — un
 * buisson à cheval sur la case voisine ment sur la place occupée. Et rien ne
 * s'enfonce : un buisson est une calotte posée, jamais une bille à demi
 * enterrée, sans quoi le modèle descend sous le terrain.
 */
function yardDressing(part: Part, w: number, d: number, seed: number): void {
  const rnd = (n: number) => {
    const s = Math.sin((seed + n) * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const MAX_R = 0.1;
  const spanX = w - EDGE * 2 - MAX_R * 3;
  const spanZ = d - EDGE * 2 - MAX_R * 3;
  for (let i = 0; i < 5; i++) {
    const x = (rnd(i) - 0.5) * spanX;
    const z = (rnd(i + 20) - 0.5) * spanZ;
    // On ne plante rien au milieu : c'est là que se trouve le bâti.
    if (Math.abs(x) < w * 0.32 && Math.abs(z) < d * 0.32) continue;
    const r = 0.05 + rnd(i + 40) * (MAX_R - 0.05);
    part.add("foliage", mound(r, r * 1.15, [x, 0, z]));
    part.add("foliage", mound(r * 0.62, r * 0.8, [x + r * 0.6, 0, z + r * 0.35]));
  }
  for (let i = 0; i < 2; i++) {
    const x = (rnd(i + 60) - 0.5) * spanX;
    const z = (rnd(i + 80) - 0.5) * spanZ;
    if (Math.abs(x) < w * 0.34 && Math.abs(z) < d * 0.34) continue;
    const rock = new THREE.DodecahedronGeometry(0.05, 0);
    rock.scale(1, 0.55, 1);
    part.add("concrete", place(rock, [x, 0.028, z]));
  }
}

/** Panneaux solaires : la marque visible d'un bâtiment de haut niveau. */
function solar(part: Part, w: number, d: number, eaveY: number, rise: number, z: number): void {
  const half = w / 2;
  const angle = Math.atan2(rise, half);
  const len = Math.hypot(half, rise);
  part.add(
    "glass",
    box(len * 0.62, 0.014, d * 0.5, [half / 2, eaveY + rise / 2 + 0.045, z], [0, 0, -angle]),
  );
}

/* ------------------------------------------------------------------ */
/* Les bâtiments                                                       */
/* ------------------------------------------------------------------ */

type Built = { root: Part; height: number };

/** Cellule à grain : tôle ondulée cerclée, toit conique, échelle, descente. */
function bin(part: Part, x: number, z: number, r: number, hgt: number): void {
  const coneH = r * 0.55;
  part.add("concrete", cyl(r + 0.05, r + 0.06, 0.06, 16, [x, 0.03, z], [0, 0, 0]));
  part.add(
    "corrugate",
    lathe(
      [
        [0.02, 0.05],
        [r, 0.07],
        [r, hgt],
        [r * 0.96, hgt + 0.02],
        [r * 0.5, hgt + coneH * 0.68],
        [0.05, hgt + coneH],
        [0, hgt + coneH],
      ],
      14,
      [x, 0, z],
      [0, 0, 0],
    ),
  );
  // Cerclages : ce sont eux qui font lire la tôle plutôt qu'un tube peint.
  // Deux suffisent — un tore se paie cher pour un trait de six pixels.
  for (const f of [0.34, 0.72]) {
    part.add("roofDark", ring(r + 0.006, 0.011, 10, Math.PI * 2, [x, hgt * f, z], [HALF, 0, 0]));
  }
  part.add("roof", cone(r * 0.16, 0.09, 7, [x, hgt + coneH + 0.03, z]));
  // Échelle de visite, côté façade.
  const lad = part.child([x, 0, z + r]);
  for (const side of [-1, 1]) lad.add("corrugate", box(0.018, hgt, 0.018, [side * 0.05, hgt / 2, 0.02]));
  for (let i = 0; i < Math.floor(hgt / 0.17); i++) {
    lad.add("corrugate", box(0.11, 0.014, 0.014, [0, 0.12 + i * 0.17, 0.02]));
  }
  // Descente de vidange vers le pied.
  part.add(
    "corrugate",
    tube(
      [
        [x + r * 0.2, hgt * 0.28, z + r * 0.7],
        [x + r * 0.55, hgt * 0.16, z + r * 0.95],
        [x + r * 0.6, 0.06, z + r * 1.05],
      ],
      0.032,
      4,
    ),
  );
}

function buildSilo(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2);
  const r = 0.3;
  const hgt = 0.78 + lvl * 0.06;
  // Le niveau se voit au nombre de cellules, pas à un facteur d'échelle : une
  // ferme qui grandit aligne des cellules, elle ne les gonfle pas.
  const spots: [number, number][] =
    lvl >= 3
      ? [
          [-0.38, 0.1],
          [0.38, 0.1],
          [0, -0.38],
        ]
      : [
          [-0.3, 0.06],
          [0.32, 0.06],
        ];
  const br = r * (lvl >= 3 ? 0.92 : 1);
  for (const [x, z] of spots) bin(root, x, z, br, hgt);
  // Vis d'alimentation : elle part d'une trémie posée au sol et monte au
  // sommet d'une cellule. Un tube en l'air, sans point d'attache, se lisait
  // comme une pièce oubliée.
  const [tx, tz] = spots[0];
  root.add("concrete", box(0.22, 0.12, 0.2, [d / 2 - 0.28, 0.06, d / 2 - 0.3]));
  root.add(
    "corrugate",
    tube(
      [
        [w / 2 - 0.28, 0.14, d / 2 - 0.3],
        [(w / 2 - 0.28 + tx) / 2, hgt * 0.55, (d / 2 - 0.3 + tz) / 2],
        [tx + br * 0.3, hgt + br * 0.4, tz],
      ],
      0.045,
      5,
    ),
  );
  yardDressing(root, w, d, 3);
  return { root, height: hgt + r * 0.6 + 0.12 };
}

function buildHayBarn(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2);
  const bw = w - EDGE * 2 - 0.1;
  const bd = d - EDGE * 2 - 0.1;
  const eave = 0.62;
  const rise = 0.3;
  // Grange ouverte : charpente sur poteaux, pignons bardés, fond plein.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(root, (sx * bw) / 2, (sz * bd) / 2, eave);
  post(root, 0, -bd / 2, eave);
  claddedWall(root, bw, eave, 0.06, [0, eave / 2, -bd / 2], undefined, 5);
  gableRoof(root, bw, bd, eave, rise, { mat: lvl >= 3 ? "corrugate" : "roof" });
  gableEnd(root, bw, eave, rise, -bd / 2 + 0.03, "wall");
  gableEnd(root, bw, eave, rise, bd / 2 - 0.03, "timber");
  // Bottes de paille : un hangar à foin vide n'a aucun sens.
  const rows = Math.min(3, 1 + Math.floor(lvl / 2));
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < 3; i++) {
      const x = -bw / 2 + 0.18 + i * ((bw - 0.36) / 2);
      root.add("hay", box(0.26, 0.17, 0.34, [x, 0.12 + r * 0.18, -bd / 4 + (r % 2) * 0.12]));
    }
  }
  yardDressing(root, w, d, 11);
  return { root, height: eave + rise + 0.1 };
}

function buildMachineShed(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2, 0.045);
  const bw = w - EDGE * 2 - 0.12;
  const bd = d - EDGE * 2 - 0.12;
  const eave = 0.72;
  const rise = 0.34;
  // Trois travées ouvertes en façade, murs pleins sur les trois autres côtés.
  const bays = lvl >= 4 ? 4 : 3;
  for (let i = 0; i <= bays; i++) {
    post(root, -bw / 2 + (bw * i) / bays, bd / 2, eave, 0.05);
  }
  root.add("timber", box(bw + 0.12, 0.075, 0.09, [0, eave - 0.03, bd / 2]));
  claddedWall(root, bw, eave, 0.07, [0, eave / 2, -bd / 2], undefined, 6);
  claddedWall(root, bd, eave, 0.07, [-bw / 2, eave / 2, 0], [0, HALF, 0], 4);
  claddedWall(root, bd, eave, 0.07, [bw / 2, eave / 2, 0], [0, HALF, 0], 4);
  gableRoof(root, bw, bd, eave, rise, { mat: lvl >= 3 ? "corrugate" : "roof" });
  gableEnd(root, bw, eave, rise, -bd / 2 + 0.035, "wall");
  window_(root, 0.24, 0.2, [bw * 0.26, eave * 0.62, -bd / 2 - 0.035], [0, Math.PI, 0]);
  window_(root, 0.24, 0.2, [-bw * 0.26, eave * 0.62, -bd / 2 - 0.035], [0, Math.PI, 0]);
  // Sol d'atelier : une bande de béton propre sous les travées.
  root.add("concrete", box(bw, 0.02, bd * 0.7, [0, 0.055, bd * 0.1]));
  if (lvl >= 5) solar(root, bw, bd, eave, rise, 0);
  yardDressing(root, w, d, 5);
  return { root, height: eave + rise + 0.1 };
}

/**
 * Grange d'élevage : c'est elle qui porte le troupeau.
 *
 * Deux vantaux articulés en façade, un seuil d'où sortent les bêtes, une
 * lucarne de fenil et un extracteur de toiture. Rien de tout cela n'est posé
 * devant le bâtiment : tout appartient au modèle et tourne avec lui.
 */
function buildLivestockBarn(
  w: number,
  d: number,
  lvl: number,
  opts: { eave: number; rise: number; doorW: number; doorH: number; loft: boolean },
): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2);
  const bw = w - EDGE * 2 - 0.12;
  const bd = d - EDGE * 2 - 0.12;
  const { eave, rise, doorW, doorH } = opts;

  claddedWall(root, bw, eave, 0.08, [0, eave / 2, -bd / 2], undefined, 6);
  claddedWall(root, bd, eave, 0.08, [-bw / 2, eave / 2, 0], [0, HALF, 0], 5);
  claddedWall(root, bd, eave, 0.08, [bw / 2, eave / 2, 0], [0, HALF, 0], 5);
  // Façade : deux trumeaux encadrant l'ouverture.
  const pier = (bw - doorW) / 2;
  for (const side of [-1, 1]) {
    claddedWall(root, pier, eave, 0.08, [(side * (doorW + pier)) / 2, eave / 2, bd / 2], undefined, 2);
  }
  root.add("timber", box(bw + 0.1, 0.08, 0.1, [0, eave - 0.02, bd / 2]));

  const ridge = gableRoof(root, bw, bd, eave, rise, { mat: lvl >= 4 ? "corrugate" : "roof" });
  gableEnd(root, bw, eave, rise, -bd / 2 + 0.04, "wall");
  gableEnd(root, bw, eave, rise, bd / 2 - 0.04, "wall");
  doorway(root, doorW, doorH, bd / 2 + 0.045);

  if (opts.loft) {
    // Lucarne de fenil : la porte haute par où rentre le foin.
    root.add("door", box(0.3, 0.28, 0.05, [0, eave + rise * 0.36, bd / 2 + 0.06]));
    root.add("timber", box(0.36, 0.05, 0.07, [0, eave + rise * 0.36 + 0.16, bd / 2 + 0.06]));
    // Poutre de treuil : elle doit saillir hors du mur, sans mordre la case
    // voisine — l'avancée de toit occupe déjà l'essentiel de la marge.
    root.add("timber", box(0.06, 0.06, 0.2, [0, eave + rise * 0.72, bd / 2 + 0.03]));
    root.add("chrome", cyl(0.012, 0.012, 0.14, 5, [0, eave + rise * 0.72 - 0.08, bd / 2 + 0.11]));
  }
  // Extracteur de faîtage : il tourne, donc la grange respire.
  const vane = root.child([0, ridge + 0.06, -bd * 0.16], { role: "vane" });
  vane.add("corrugate", cyl(0.07, 0.09, 0.09, 8, [0, 0.045, 0]));
  for (let i = 0; i < 4; i++) {
    vane.add("corrugate", box(0.13, 0.012, 0.04, [0, 0.11, 0], [0, (i * Math.PI) / 4, 0.3]));
  }
  root.add("roofDark", cyl(0.05, 0.07, 0.06, 8, [0, ridge + 0.02, -bd * 0.16]));

  if (lvl >= 5) solar(root, bw, bd, eave, rise, -bd * 0.18);
  yardDressing(root, w, d, 7);
  return { root, height: ridge + 0.2 };
}

function buildWorkshop(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2, 0.05);
  const bw = w - EDGE * 2 - 0.12;
  const bd = d - EDGE * 2 - 0.12;
  const eave = 0.66;
  const rise = 0.22;
  // Soubassement maçonné, bardage métallique au-dessus : un atelier.
  root.add("wallDark", box(bw + 0.03, 0.16, bd + 0.03, [0, 0.13, 0]));
  claddedWall(root, bw, eave - 0.16, 0.08, [0, 0.16 + (eave - 0.16) / 2, -bd / 2], undefined, 5);
  claddedWall(root, bd, eave - 0.16, 0.08, [-bw / 2, 0.16 + (eave - 0.16) / 2, 0], [0, HALF, 0], 4);
  claddedWall(root, bd, eave - 0.16, 0.08, [bw / 2, 0.16 + (eave - 0.16) / 2, 0], [0, HALF, 0], 4);
  const doorW = bw * 0.52;
  const pier = (bw - doorW) / 2;
  for (const side of [-1, 1]) {
    claddedWall(root, pier, eave - 0.16, 0.08, [(side * (doorW + pier)) / 2, 0.16 + (eave - 0.16) / 2, bd / 2], undefined, 2);
  }
  // Rideau métallique : il monte au lieu de battre, d'où les nervures.
  root.add("wallDark", box(doorW, eave - 0.16, 0.04, [0, 0.16 + (eave - 0.16) / 2, bd / 2 - 0.02]));
  // Rideau métallique : il s'enroule dans son coffre. Le nœud est au linteau
  // et les lames pendent en dessous — c'est ce qui permet de les escamoter en
  // les écrasant vers le haut, au lieu de faire monter un panneau entier
  // au-dessus de la toiture.
  const drop = eave - 0.24;
  const shutter = root.child([0, 0.16 + drop, bd / 2 + 0.015], { role: "door", slide: 0.88 });
  for (let i = 0; i < 6; i++) {
    shutter.add("corrugate", box(doorW, drop / 6.4, 0.035, [0, -drop + (i * drop) / 5.6, 0]));
  }
  root.add("roofDark", box(doorW + 0.1, 0.09, 0.09, [0, 0.16 + drop + 0.05, bd / 2 + 0.03]));
  root.child([0, 0, bd / 2 + 0.2], { role: "threshold" });
  gableRoof(root, bw, bd, eave, rise, { mat: "corrugate", thick: 0.04 });
  gableEnd(root, bw, eave, rise, -bd / 2 + 0.035, "wall");
  gableEnd(root, bw, eave, rise, bd / 2 - 0.035, "wall");
  window_(root, 0.22, 0.18, [bw / 2 + 0.045, eave * 0.66, bd * 0.18], [0, HALF, 0]);
  // Établi de cour et bidons : l'atelier déborde toujours dehors. Le long de
  // la façade, pas sur le côté : il ne reste que sept centimètres de cour.
  root.add("timber", box(0.34, 0.05, 0.14, [-bw * 0.26, 0.24, bd / 2 + 0.09]));
  for (const dx of [-0.1, 0.1]) {
    root.add("timber", box(0.04, 0.24, 0.04, [-bw * 0.26 + dx, 0.12, bd / 2 + 0.09]));
  }
  for (const dx of [0, 0.14]) {
    root.add("corrugate", cyl(0.06, 0.06, 0.16, 8, [bw * 0.3 + dx, 0.08, bd / 2 + 0.08]));
  }
  if (lvl >= 4) chimney(root, -bw * 0.3, -bd * 0.28, eave + rise * 0.9);
  yardDressing(root, w, d, 13);
  return { root, height: eave + rise + 0.12 };
}

function buildFarmhouse(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2, 0.04);
  const bw = w - EDGE * 2 - 0.22;
  const bd = d - EDGE * 2 - 0.28;
  const eave = 0.6;
  const rise = 0.34;
  root.add("wallDark", box(bw + 0.04, 0.1, bd + 0.04, [0, 0.08, 0]));
  claddedWall(root, bw, eave, 0.09, [0, 0.1 + eave / 2, -bd / 2], undefined, 3);
  claddedWall(root, bd, eave, 0.09, [-bw / 2, 0.1 + eave / 2, 0], [0, HALF, 0], 3);
  claddedWall(root, bd, eave, 0.09, [bw / 2, 0.1 + eave / 2, 0], [0, HALF, 0], 3);
  claddedWall(root, bw, eave, 0.09, [0, 0.1 + eave / 2, bd / 2], undefined, 3);
  gableRoof(root, bw, bd, 0.1 + eave, rise, { overhang: 0.09 });
  gableEnd(root, bw, 0.1 + eave, rise, -bd / 2 + 0.04);
  gableEnd(root, bw, 0.1 + eave, rise, bd / 2 - 0.04);

  // Porte d'entrée, marches et auvent : la façade se lit d'un coup d'œil.
  const dh = 0.34;
  root.add("door", box(0.2, dh, 0.05, [0, 0.1 + dh / 2, bd / 2 + 0.03]));
  root.add("timber", box(0.26, 0.04, 0.06, [0, 0.1 + dh + 0.03, bd / 2 + 0.03]));
  root.add("roofDark", box(0.34, 0.03, 0.16, [0, 0.1 + dh + 0.13, bd / 2 + 0.08], [0.22, 0, 0]));
  root.add("concrete", box(0.3, 0.05, 0.14, [0, 0.05, bd / 2 + 0.12]));
  window_(root, 0.16, 0.18, [-bw * 0.3, 0.1 + eave * 0.6, bd / 2 + 0.05]);
  window_(root, 0.16, 0.18, [bw * 0.3, 0.1 + eave * 0.6, bd / 2 + 0.05]);
  window_(root, 0.16, 0.18, [bw / 2 + 0.05, 0.1 + eave * 0.6, 0], [0, HALF, 0]);
  window_(root, 0.14, 0.14, [0, 0.1 + eave + rise * 0.4, bd / 2 - 0.02]);
  chimney(root, -bw * 0.28, -bd * 0.2, 0.1 + eave + rise + 0.14);

  // Le potager, puis la haie : un corps de ferme n'est pas posé sur du vide.
  const gz = bd / 2 + 0.16;
  root.add("dirt", box(bw * 0.8, 0.014, 0.2, [0, 0.05, gz]));
  for (let i = 0; i < 4; i++) {
    root.add("foliage", mound(0.045, 0.06, [-bw * 0.3 + i * (bw * 0.2), 0.05, gz]));
  }
  if (lvl >= 4) solar(root, bw, bd, 0.1 + eave, rise, 0);
  yardDressing(root, w, d, 2);
  return { root, height: 0.1 + eave + rise + 0.2 };
}

function buildColdRoom(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2, 0.05);
  const bw = w - EDGE * 2 - 0.16;
  const bd = d - EDGE * 2 - 0.16;
  const hgt = 0.6;
  // Panneaux sandwich : surfaces lisses et claires, pas de bardage bois.
  root.add("wall", box(bw, hgt, bd, [0, 0.05 + hgt / 2, 0]));
  for (let i = 1; i < 4; i++) {
    root.add("wallDark", box(0.02, hgt, bd + 0.008, [-bw / 2 + (bw * i) / 4, 0.05 + hgt / 2, 0]));
  }
  root.add("corrugate", box(bw + 0.05, 0.05, bd + 0.05, [0, 0.05 + hgt + 0.02, 0]));
  monoRoof(root, bw, bd, 0.05 + hgt + 0.04, 0.1, { mat: "corrugate" });
  // Porte isotherme : un panneau clair comme le reste de la cellule. En bois
  // sombre, grande ouverte, elle se lisait comme une plaque posée à côté.
  const dw = bw * 0.42;
  root.add("wallDark", box(dw + 0.04, 0.46, 0.03, [0, 0.28, bd / 2 + 0.005]));
  const leaf = root.child([-dw / 2, 0, bd / 2 + 0.03], { role: "door" });
  leaf.add("corrugate", box(dw, 0.44, 0.05, [dw / 2, 0.27, 0]));
  leaf.add("wallDark", box(dw * 0.8, 0.03, 0.02, [dw / 2, 0.42, 0.03]));
  leaf.add("chrome", box(0.05, 0.11, 0.035, [dw * 0.9, 0.27, 0.03]));
  root.child([0, 0, bd / 2 + 0.18], { role: "threshold" });
  // Groupe froid en toiture : c'est lui qui dit à quoi sert la boîte.
  const unit = root.child([bw * 0.22, 0.05 + hgt + 0.06, -bd * 0.1]);
  unit.add("corrugate", box(0.28, 0.16, 0.24, [0, 0.08, 0]));
  const fan = root.child([bw * 0.22, 0.05 + hgt + 0.22, -bd * 0.1], { role: "vane" });
  for (let i = 0; i < 4; i++) {
    fan.add("chrome", box(0.16, 0.01, 0.045, [0, 0, 0], [0, (i * Math.PI) / 4, 0.25]));
  }
  if (lvl >= 3) {
    root.add("corrugate", box(0.2, 0.3, 0.16, [-bw / 2 - 0.11, 0.2, -bd * 0.2]));
  }
  yardDressing(root, w, d, 17);
  return { root, height: 0.05 + hgt + 0.3 };
}

function buildHenhouse(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2, 0.03);
  const bw = w - EDGE * 2 - 0.3;
  const bd = d - EDGE * 2 - 0.34;
  const floor = 0.16;
  const hgt = 0.34;
  // Cabane sur pilotis : une poule ne pond pas au ras de la boue.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    root.add("timber", box(0.05, floor, 0.05, [(sx * (bw - 0.08)) / 2, floor / 2, (sz * (bd - 0.08)) / 2]));
  }
  root.add("timber", box(bw + 0.06, 0.06, bd + 0.06, [0, floor, 0]));
  root.add("wall", box(bw, hgt, bd, [0, floor + hgt / 2, 0]));
  // Planches verticales sur les quatre faces, et les cornières d'angle : sans
  // ce relief la cabane n'est qu'une boîte peinte.
  for (let i = 1; i < 4; i++) {
    root.add("timber", box(0.03, hgt, bd + 0.008, [-bw / 2 + (bw * i) / 4, floor + hgt / 2, 0]));
    root.add("timber", box(bw + 0.008, hgt, 0.03, [0, floor + hgt / 2, -bd / 2 + (bd * i) / 4]));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    root.add("timber", box(0.05, hgt, 0.05, [(sx * bw) / 2, floor + hgt / 2, (sz * bd) / 2]));
  }
  root.add("timber", box(bw + 0.05, 0.04, bd + 0.05, [0, floor + hgt, 0]));
  monoRoof(root, bw, bd, floor + hgt + 0.02, 0.14, { overhang: 0.09 });
  // Trappe et planche d'envol : le chemin des poules, à leur échelle. Le gond
  // est sur le côté du panneau, sinon la trappe tourne sur elle-même.
  root.add("wallDark", box(0.12, 0.13, 0.03, [-bw * 0.2, floor + 0.07, bd / 2]));
  const hatch = root.child([-bw * 0.2 - 0.065, floor + 0.07, bd / 2 + 0.02], { role: "door" });
  hatch.add("door", box(0.13, 0.14, 0.03, [0.065, 0, 0]));
  root.add("timber", box(0.14, 0.03, 0.34, [-bw * 0.2, floor * 0.62, bd / 2 + 0.16], [-0.5, 0, 0]));
  root.child([-bw * 0.2, 0, bd / 2 + 0.3], { role: "threshold" });
  // Pondoirs en saillie, et le perchoir : deux détails qui font le poulailler.
  root.add("wall", box(0.3, 0.16, 0.14, [bw * 0.1, floor + 0.12, -bd / 2 - 0.06]));
  root.add("roofDark", box(0.33, 0.03, 0.17, [bw * 0.1, floor + 0.21, -bd / 2 - 0.07], [-0.32, 0, 0]));
  window_(root, 0.11, 0.09, [bw * 0.26, floor + hgt * 0.62, bd / 2 + 0.02]);
  if (lvl >= 3) {
    root.add("corrugate", cyl(0.07, 0.09, 0.2, 10, [bw / 2 + 0.16, 0.1, bd * 0.1]));
    root.add("roofDark", cone(0.1, 0.07, 10, [bw / 2 + 0.16, 0.24, bd * 0.1]));
  }
  yardDressing(root, w, d, 23);
  return { root, height: floor + hgt + 0.2 };
}

function buildPigsty(w: number, d: number, lvl: number): Built {
  const root = new Part();
  slab(root, w - EDGE * 2, d - EDGE * 2, 0.04);
  const bw = w - EDGE * 2 - 0.12;
  const bd = (d - EDGE * 2) * 0.52;
  const zc = -(d - EDGE * 2) / 2 + bd / 2 + 0.05;
  const eave = 0.44;
  const rise = 0.16;
  // Loge basse au fond, courette murée devant : c'est la porcherie type.
  claddedWall(root, bw, eave, 0.08, [0, eave / 2, zc - bd / 2], undefined, 4);
  claddedWall(root, bd, eave, 0.08, [-bw / 2, eave / 2, zc], [0, HALF, 0], 3);
  claddedWall(root, bd, eave, 0.08, [bw / 2, eave / 2, zc], [0, HALF, 0], 3);
  const dw = bw * 0.3;
  const pier = (bw - dw) / 2;
  for (const side of [-1, 1]) {
    claddedWall(root, pier, eave, 0.08, [(side * (dw + pier)) / 2, eave / 2, zc + bd / 2], undefined, 2);
  }
  gableRoof(root, bw, bd, eave, rise, { mat: lvl >= 3 ? "corrugate" : "roof", overhang: 0.05 });
  gableEnd(root, bw, eave, rise, zc - bd / 2 + 0.035);
  doorway(root, dw, 0.34, zc + bd / 2 + 0.045, { thick: 0.04 });

  // Muret de courette, auge et bauge : le sol d'un porc, c'est la moitié du sujet.
  const yz = (d - EDGE * 2) / 2 - 0.06;
  const mur = 0.2;
  root.add("wallDark", box(bw, mur, 0.07, [0, mur / 2, yz]));
  for (const side of [-1, 1]) {
    root.add("wallDark", box(0.07, mur, yz - (zc + bd / 2), [(side * bw) / 2, mur / 2, (yz + zc + bd / 2) / 2]));
  }
  root.add("dirt", box(bw - 0.14, 0.015, yz - (zc + bd / 2) - 0.1, [0, 0.048, (yz + zc + bd / 2) / 2]));
  root.add("concrete", box(0.44, 0.09, 0.14, [-bw * 0.2, 0.085, yz - 0.2]));
  root.add("wallDark", mound(0.19, 0.04, [bw * 0.22, 0.046, yz - 0.24]));
  yardDressing(root, w, d, 29);
  return { root, height: eave + rise + 0.1 };
}

/**
 * Cour clôturée : pré, parc à cochons, parcours des poules.
 *
 * Une cour n'a pas de toit : tout se joue sur la clôture, le sol et deux
 * objets qui disent l'usage. Le portail est un vantail articulé comme celui
 * d'une grange — les bêtes doivent pouvoir le franchir.
 */
function buildYard(
  w: number,
  d: number,
  lvl: number,
  kind: "PADDOCK" | "PIG_YARD" | "HEN_YARD",
): Built {
  const root = new Part();
  const hw = (w - EDGE * 2) / 2;
  const hd = (d - EDGE * 2) / 2;
  const ground = kind === "PADDOCK" ? "foliage" : "dirt";
  root.add(ground, box(hw * 2, 0.03, hd * 2, [0, 0.015, 0]));

  const hgt = kind === "HEN_YARD" ? 0.26 : kind === "PIG_YARD" ? 0.24 : 0.32;
  const gateW = 0.46;
  // Trois côtés pleins, et la façade en deux tronçons qui réservent le portail.
  fence(
    root,
    [
      [[-hw, -hd], [hw, -hd]],
      [[hw, -hd], [hw, hd]],
      [[-hw, -hd], [-hw, hd]],
      [[-hw, hd], [-gateW / 2, hd]],
      [[gateW / 2, hd], [hw, hd]],
    ],
    { hgt, rails: kind === "PADDOCK" ? 2 : 3 },
  );
  root.add(ground, box(gateW, 0.035, 0.14, [0, 0.02, hd]));
  const gate = root.child([-gateW / 2, 0, hd], { role: "door" });
  gate.add("timber", box(gateW, 0.05, 0.05, [gateW / 2, hgt * 0.75, 0]));
  gate.add("timber", box(gateW, 0.05, 0.05, [gateW / 2, hgt * 0.34, 0]));
  gate.add("timber", box(0.05, hgt, 0.05, [gateW - 0.02, hgt / 2, 0]));
  gate.add(
    "timber",
    box(Math.hypot(gateW, hgt * 0.5), 0.035, 0.04, [gateW / 2, hgt * 0.55, 0], [0, 0, Math.atan2(hgt * 0.5, gateW)]),
  );
  root.child([0, 0, hd + 0.12], { role: "threshold" });

  if (kind === "PADDOCK") {
    // Abreuvoir, râtelier et un arbre d'ombrage : un pré se lit à ses objets.
    root.add("concrete", box(0.42, 0.11, 0.2, [-hw * 0.5, 0.075, -hd * 0.45]));
    root.add("glass", box(0.37, 0.03, 0.16, [-hw * 0.5, 0.125, -hd * 0.45]));
    root.add("timber", box(0.36, 0.24, 0.16, [hw * 0.45, 0.14, -hd * 0.4], [0.2, 0, 0]));
    root.add("hay", box(0.3, 0.1, 0.12, [hw * 0.45, 0.27, -hd * 0.36]));
    root.add("timber", cyl(0.045, 0.06, 0.34, 7, [hw * 0.6, 0.17, hd * 0.35]));
    for (const [dx, dy, r] of [
      [0, 0.42, 0.19],
      [-0.1, 0.34, 0.14],
      [0.11, 0.36, 0.13],
    ]) {
      root.add("foliage", place(new THREE.SphereGeometry(r, 7, 5), [hw * 0.6 + dx, dy, hd * 0.35]));
    }
  } else if (kind === "PIG_YARD") {
    // Bauge et auge : sans boue, un parc à cochons est un enclos vide.
    root.add("wallDark", mound(0.3, 0.05, [-hw * 0.3, 0.028, hd * 0.1]));
    root.add("concrete", box(0.4, 0.09, 0.15, [hw * 0.42, 0.06, -hd * 0.4]));
    root.add("timber", box(0.5, 0.16, 0.05, [hw * 0.3, 0.09, hd * 0.5], [0, 0.4, 0]));
  } else {
    // Grillage et perchoirs : un parcours de poules se voit à sa maille.
    for (const sx of [-1, 1]) {
      root.add("corrugate", box(0.02, hgt * 0.9, hd * 2 - 0.1, [sx * hw, hgt * 0.5, 0]));
    }
    root.add("corrugate", box(hw * 2 - 0.1, hgt * 0.9, 0.02, [0, hgt * 0.5, -hd]));
    root.add("timber", box(0.5, 0.04, 0.04, [-hw * 0.3, 0.16, -hd * 0.3]));
    for (const sx of [-1, 1]) root.add("timber", box(0.04, 0.16, 0.04, [-hw * 0.3 + sx * 0.22, 0.08, -hd * 0.3]));
    root.add("concrete", cyl(0.09, 0.11, 0.1, 10, [hw * 0.4, 0.05, hd * 0.1]));
    root.add("hay", box(hw * 0.9, 0.02, 0.3, [0, 0.035, -hd * 0.62]));
  }
  if (lvl >= 3) {
    // Abri de pâture : ce que le niveau apporte à une cour.
    const shelter = root.child([-hw * 0.45, 0, -hd * 0.6]);
    for (const dx of [-0.22, 0.22]) for (const dz of [-0.14, 0.14]) {
      shelter.add("timber", box(0.04, 0.34, 0.04, [dx, 0.17, dz]));
    }
    monoRoof(shelter, 0.52, 0.34, 0.34, 0.08, { overhang: 0.04 });
  }
  return { root, height: kind === "PADDOCK" ? 0.62 : 0.4 };
}

/* ------------------------------------------------------------------ */
/* Plans de montage                                                    */
/* ------------------------------------------------------------------ */

const BUILDERS: Record<BuildingType, (w: number, d: number, lvl: number) => Built> = {
  SILO: buildSilo,
  HAY_BARN: buildHayBarn,
  MACHINE_SHED: buildMachineShed,
  CATTLE_BARN: (w, d, l) =>
    buildLivestockBarn(w, d, l, { eave: 0.72, rise: 0.42, doorW: 0.72, doorH: 0.56, loft: true }),
  SHEEPFOLD: (w, d, l) =>
    buildLivestockBarn(w, d, l, { eave: 0.5, rise: 0.26, doorW: 0.64, doorH: 0.4, loft: false }),
  HENHOUSE: buildHenhouse,
  PIGSTY: buildPigsty,
  WORKSHOP: buildWorkshop,
  FARMHOUSE: buildFarmhouse,
  COLD_ROOM: buildColdRoom,
  PADDOCK: (w, d, l) => buildYard(w, d, l, "PADDOCK"),
  PIG_YARD: (w, d, l) => buildYard(w, d, l, "PIG_YARD"),
  HEN_YARD: (w, d, l) => buildYard(w, d, l, "HEN_YARD"),
};

type Blueprint = Built & { w: number; d: number };

const blueprints = new Map<string, Blueprint>();

/**
 * Plan de montage d'un type à un niveau donné.
 *
 * Les géométries sont calculées une fois et partagées : monter le vingtième
 * bâtiment d'une ferme ne coûte que des maillages et des matériaux.
 */
function blueprint(type: BuildingType, level: number): Blueprint {
  const lvl = Math.max(1, Math.min(5, Math.round(level)));
  const key = `${type}:${lvl}`;
  const cached = blueprints.get(key);
  if (cached) return cached;
  const def = BUILDING_DEFS[type];
  const built = BUILDERS[type](def.w, def.h, lvl);
  const bp: Blueprint = { ...built, w: def.w, d: def.h };
  blueprints.set(key, bp);
  return bp;
}

/* ------------------------------------------------------------------ */
/* Rig                                                                 */
/* ------------------------------------------------------------------ */

export type BuildingState = {
  /** Temps de scène, secondes */
  t: number;
  /** Ouverture des vantaux, 0 (fermé) à 1 (grand ouvert) */
  doorOpen?: number;
};

export type BuildingRigOptions = {
  /** Niveau du bâtiment, 1 à 5 : il se voit sur le modèle */
  level?: number;
  /** Graine de variation, pour ne pas cloner deux hangars voisins */
  seed?: number;
  /** Ombres portées */
  shadows?: boolean;
};

export type BuildingRig = {
  /** À ajouter à la scène ; l'appelant en pilote position et rotation */
  group: THREE.Group;
  /** Emprise au sol dans le repère local, en cases */
  footprint: { w: number; d: number };
  /** Hauteur hors tout, unités monde */
  height: number;
  /**
   * Nœuds d'un rôle donné. `threshold` est le point de passage des bêtes :
   * la vue le lit dans le repère **monde**, ce qui tient compte de la rotation
   * du bâtiment sans qu'elle ait à la refaire.
   */
  anchors(role: Role): THREE.Object3D[];
  update(state: BuildingState): void;
  dispose(): void;
};

/**
 * Monte un bâtiment prêt à poser.
 *
 * Le modèle est coté depuis le sol : `group.position.y` est la hauteur du
 * terrain, rien de plus. C'est toute la différence avec le panneau qu'il
 * remplace, dont l'altitude se devinait à partir de l'image.
 */
export function createBuildingRig(
  type: BuildingType,
  opts: BuildingRigOptions = {},
): BuildingRig {
  const bp = blueprint(type, opts.level ?? 1);
  const materials = createBuildingMaterials(
    PALETTES[type],
    opts.seed ?? 0,
    // Un bâtiment neuf n'est pas flambant : un peu de patine dès le niveau 1,
    // qui s'efface à mesure qu'on l'améliore.
    Math.max(0, 0.45 - (opts.level ?? 1) * 0.08),
  );
  const roles = new Map<Role, THREE.Object3D[]>();
  const group = new THREE.Group();
  group.add(bp.root.build(materials, roles, opts.shadows ?? true));

  // Le gond est à gauche pour le premier vantail, à droite pour le second :
  // les deux battants doivent s'écarter, pas partir du même côté. On retient
  // la position de repos, faute de quoi un rideau qui coulisse repart du sol.
  const doors = (roles.get("door") ?? []).map((node, i) => ({
    node,
    swing: i % 2 === 0 ? -1 : 1,
    slide: (node.userData.slide as number) ?? 0,
    restY: node.position.y,
  }));
  let open = 0;

  return {
    group,
    footprint: { w: bp.w, d: bp.d },
    height: bp.height,
    anchors: (role) => roles.get(role) ?? [],
    update(state) {
      const want = Math.max(0, Math.min(1, state.doorOpen ?? 0));
      open += (want - open) * 0.12;
      for (const d of doors) {
        // Un rideau s'enroule — ses lames s'escamotent vers le haut. Un
        // vantail pivote sur son gond, sans aller jusqu'à se plaquer contre le
        // mur : au-delà d'un quart de tour il se lit comme une planche
        // détachée du bâtiment.
        if (d.slide) d.node.scale.y = Math.max(0.02, 1 - open * d.slide);
        else d.node.rotation.y = d.swing * open * 1.25;
      }
      for (const v of roles.get("vane") ?? []) v.rotation.y = state.t * 1.1;
    },
    dispose() {
      // Les géométries sont mises en cache et partagées entre bâtiments : seuls
      // les matériaux, propres à l'instance, sont à libérer.
      for (const m of new Set(Object.values(materials))) m.dispose();
      group.clear();
    },
  };
}

/** Hauteur hors tout d'un type, sans monter le modèle — pour cadrer une vue. */
export function buildingHeight(type: BuildingType, level = 1): number {
  return blueprint(type, level).height;
}
