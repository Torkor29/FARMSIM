import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { markShared } from "./three-cleanup";

/**
 * Le brin, une forme par culture.
 *
 * Six cultures partageaient la même lame et le même épi : on ne les
 * distinguait qu'à la teinte, ce qui revient à ne pas les distinguer du tout
 * dès que le soleil baisse ou qu'on regarde de loin. Or c'est **la silhouette**
 * qui nomme une culture — la barbe de l'orge, la grappe jaune du colza, le
 * panache du maïs.
 *
 * Deux contraintes tiennent le dessin :
 *
 * 1. **Hauteur unitaire.** Chaque brin monte à 1,0 ; l'instance l'étire à la
 *    hauteur voulue par la case. Les cultures restent donc comparables entre
 *    elles, et le nuancier peut courber en fonction de `y` sans rien savoir de
 *    l'espèce.
 * 2. **Deux teintes par brin.** L'attribut `aAccent` marque les sommets qui
 *    prennent la couleur d'accent de l'espèce — l'épi doré sur une paille
 *    claire, la fleur jaune sur une tige verte. Sans lui, un colza en fleur
 *    serait un buisson uniformément jaune, tige comprise.
 */

export type CropShape = "WHEAT" | "BARLEY" | "MAIZE" | "PEA" | "RAPE" | "GRASS";

/** Couleur des épis, gousses, fleurs et panicules — le reste prend la teinte de la case. */
/**
 * Couleur des épis, gousses, fleurs et panicules — le reste prend la teinte
 * de la case.
 *
 * Le blé, l'orge et le maïs tenaient dans **huit degrés de teinte** (43°, 47°,
 * 51°) : sur une parcelle, trois beiges qu'on ne pouvait pas nommer. Ils
 * s'écartent maintenant assez pour se reconnaître d'un coup d'œil, sans
 * quitter le nuancier chaud de la moisson :
 *
 *   blé    doré franc      · l'épi mûr classique
 *   orge   blond très pâle · presque blanc, et sa longue barbe le signe
 *   maïs   panicule fauve  · sur une plante restée verte
 */
export const CROP_ACCENT: Record<CropShape, number> = {
  WHEAT: 0xdba62c,
  BARLEY: 0xf2e4b4,
  MAIZE: 0xb8823a,
  PEA: 0x9fc65a,
  RAPE: 0xf5d417,
  GRASS: 0x8fbf5c,
};

/** Brins par case : le maïs se sème clair et large, l'herbe très dru. */
export const CROP_DENSITY: Record<CropShape, number> = {
  WHEAT: 1,
  BARLEY: 1,
  MAIZE: 0.42,
  PEA: 0.85,
  RAPE: 0.72,
  GRASS: 1.15,
};

/**
 * Rôle d'un sommet, transmis au nuancier.
 *
 * `accent` reçoit la couleur de l'espèce et ne sort qu'à maturité ; `leaf`
 * reçoit un frisson propre, plus court et plus vif que la houle de la tige —
 * c'est lui qui empêche un champ de bouger d'un seul bloc.
 */
type Role = { accent?: number; leaf?: number };

function tag(geo: THREE.BufferGeometry, role: Role = {}): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  if (flat !== geo) geo.dispose();
  const n = flat.getAttribute("position").count;
  flat.setAttribute(
    "aAccent",
    new THREE.Float32BufferAttribute(new Float32Array(n).fill(role.accent ?? 0), 1),
  );
  flat.setAttribute(
    "aLeaf",
    new THREE.Float32BufferAttribute(new Float32Array(n).fill(role.leaf ?? 0), 1),
  );
  return flat;
}

type RibbonOpts = {
  /** Recul du sommet vers l'arrière : c'est lui qui fait retomber la feuille */
  curve?: number;
  /** Perte de hauteur du sommet, quand la feuille s'arque */
  droop?: number;
  segments?: number;
  yaw?: number;
  /** Pied du ruban */
  y?: number;
  /** Écart latéral du pied */
  x?: number;
};

/**
 * Ruban : une lame effilée et courbée, d'un seul tenant.
 *
 * C'est la brique de toute la végétation. Un rectangle plat — ce qu'on avait —
 * ne ressemble à rien de vivant : une feuille est large au tiers de sa
 * longueur, pointue au bout, et elle retombe. La largeur est donnée par une
 * fonction de l'avancement, ce qui permet aussi bien une feuille qu'un épi
 * fuselé, pour le même prix de deux triangles par segment.
 */
function ribbon(
  length: number,
  widthAt: (t: number) => number,
  opts: RibbonOpts = {},
): THREE.BufferGeometry {
  const seg = opts.segments ?? 5;
  const curve = opts.curve ?? 0;
  const droop = opts.droop ?? 0;
  const position: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];

  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = Math.max(0.0005, widthAt(t)) / 2;
    const y = length * t - droop * t * t;
    const z = curve * t * t;
    position.push(-w, y, z, w, y, z);
    uv.push(0, t, 1, t);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  if (opts.yaw) geo.rotateY(opts.yaw);
  geo.translate(opts.x ?? 0, opts.y ?? 0, 0);
  return geo;
}

/**
 * Deux rubans croisés à angle droit.
 *
 * Le tour de main classique de la végétation : de n'importe quel angle, la
 * paire donne du volume pour le prix de deux lames. Un épi tourné en volume
 * coûterait dix fois plus pour un gain nul à la taille où on le regarde.
 */
function crossed(
  length: number,
  widthAt: (t: number) => number,
  opts: RibbonOpts = {},
): THREE.BufferGeometry[] {
  const yaw = opts.yaw ?? 0;
  return [
    ribbon(length, widthAt, { ...opts, yaw }),
    ribbon(length, widthAt, { ...opts, yaw: yaw + Math.PI / 2 }),
  ];
}

/** Profil d'une feuille : large au tiers, pointue au bout. */
const leafProfile = (w: number) => (t: number) => w * Math.sin(Math.PI * Math.pow(t, 0.62));

/**
 * Profil d'un épi : fuselé, et dentelé par les grains.
 *
 * La dentelure ne coûte rien — elle vit dans la fonction de largeur — et c'est
 * pourtant elle qui fait lire « grains » plutôt que « cône ».
 */
const earProfile = (w: number, grains: number) => (t: number) =>
  w * Math.sin(Math.PI * Math.pow(t, 0.75)) * (0.82 + 0.18 * Math.abs(Math.sin(t * Math.PI * grains)));

/**
 * Tige : à peine plus large au pied.
 *
 * Attention à la largeur : une parcelle ne fait masse que si les brins se
 * recouvrent. Un premier jet avait des tiges de seize millimètres — trois fois
 * plus fines que la lame qu'elles remplaçaient — et le champ s'était vidé,
 * laissant voir la terre entre chaque pied.
 */
const stemProfile = (w: number) => (t: number) => w * (1.1 - 0.22 * t);

function buildShape(kind: CropShape): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stem = (h: number, w: number) => parts.push(tag(ribbon(h, stemProfile(w), { segments: 4 })));
  const leaf = (h: number, w: number, o: RibbonOpts) =>
    parts.push(tag(ribbon(h, leafProfile(w), { segments: 4, ...o }), { leaf: 1 }));
  const head = (h: number, prof: (t: number) => number, o: RibbonOpts) => {
    for (const g of crossed(h, prof, { segments: 6, ...o })) parts.push(tag(g, { accent: 1 }));
  };

  if (kind === "WHEAT") {
    // Paille droite, épi court et dense, barbes brèves. La dentelure du profil
    // dessine les grains sans coûter un sommet de plus.
    stem(0.74, 0.046);
    leaf(0.34, 0.082, { yaw: 1.1, curve: 0.06, droop: 0.04, y: 0.14 });
    leaf(0.28, 0.072, { yaw: -1.5, curve: 0.05, droop: 0.03, y: 0.32 });
    head(0.28, earProfile(0.062, 5), { y: 0.7 });
    for (const yaw of [0.5, 2.1]) {
      parts.push(tag(ribbon(0.15, () => 0.005, { yaw, curve: 0.05, y: 0.94, segments: 2 }), { accent: 1 }));
    }
  } else if (kind === "BARLEY") {
    // La barbe : des arêtes deux fois plus longues que l'épi, en éventail.
    // C'est à ça, et à rien d'autre, qu'on reconnaît de l'orge de loin.
    stem(0.62, 0.044);
    leaf(0.32, 0.078, { yaw: 0.9, curve: 0.06, droop: 0.04, y: 0.11 });
    leaf(0.26, 0.066, { yaw: -1.4, curve: 0.05, droop: 0.03, y: 0.28 });
    head(0.24, earProfile(0.05, 6), { y: 0.58 });
    // Les arêtes s'écartent en éventail : une lame par direction, courbée.
    for (const [yaw, curve] of [
      [0.3, 0.1],
      [1.7, 0.13],
      [3.0, 0.09],
      [4.4, 0.12],
    ] as const) {
      parts.push(
        tag(ribbon(0.34, (t) => 0.0075 * (1 - t * 0.8), { yaw, curve, y: 0.74, segments: 3 }), {
          accent: 1,
        }),
      );
    }
  } else if (kind === "MAIZE") {
    // Canne épaisse, longues feuilles retombantes, panicule au sommet.
    for (const g of crossed(0.94, stemProfile(0.03), { segments: 5 })) parts.push(tag(g));
    for (let i = 0; i < 4; i++) {
      leaf(0.54, 0.115, {
        yaw: (i / 4) * Math.PI * 2 + 0.5,
        curve: 0.19,
        droop: 0.16,
        y: 0.2 + i * 0.13,
        segments: 5,
      });
    }
    // Épi enveloppé à mi-hauteur, plumet au-dessus de la canne.
    head(0.26, earProfile(0.085, 3), { y: 0.36 });
    for (const yaw of [0.2, 1.4, 2.6]) {
      parts.push(tag(ribbon(0.2, (t) => 0.008 * (1 - t), { yaw, curve: 0.07, y: 0.92, segments: 3 }), {
        accent: 1,
      }));
    }
  } else if (kind === "PEA") {
    // Touffe basse : des folioles par paires, deux gousses, une vrille.
    stem(0.5, 0.032);
    for (let i = 0; i < 6; i++) {
      leaf(0.17, 0.125, {
        yaw: (i / 6) * Math.PI * 2 + 0.3,
        curve: 0.05,
        droop: 0.02,
        y: 0.12 + (i % 3) * 0.12,
        segments: 3,
      });
    }
    head(0.19, earProfile(0.036, 3), { y: 0.28, yaw: 0.4 });
    head(0.16, earProfile(0.032, 3), { y: 0.18, yaw: 2.2, curve: 0.05 });
    // La vrille, qui dit « grimpant » d'un trait.
    parts.push(tag(ribbon(0.14, () => 0.005, { yaw: 0.7, curve: 0.09, y: 0.46, segments: 3 })));
  } else if (kind === "RAPE") {
    // Tige haute qui se ramifie, grappe de fleurs jaunes au sommet.
    stem(0.68, 0.04);
    for (let i = 0; i < 3; i++) {
      leaf(0.27, 0.125, {
        yaw: (i / 3) * Math.PI * 2,
        curve: 0.07,
        droop: 0.04,
        y: 0.14 + i * 0.14,
        segments: 4,
      });
    }
    // La grappe : trois bouquets étagés, plus serrés vers le haut. Sept billes
    // en icosaèdre coûtaient quatre fois plus pour une masse moins lisible.
    head(0.24, leafProfile(0.115), { y: 0.62, segments: 5 });
    head(0.14, leafProfile(0.075), { y: 0.8, yaw: 0.9, segments: 4 });
  } else {
    // Herbe : une touffe de lames fines, sans épi. Un pré doit se lire comme
    // un tapis, pas comme une céréale rasée.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6;
      leaf(0.72 + (i % 3) * 0.16, 0.062, {
        yaw: a,
        curve: 0.11 + (i % 2) * 0.05,
        droop: 0.06,
        segments: 4,
      });
    }
    // Une inflorescence discrète : l'herbe monte en graine avant la fauche.
    parts.push(tag(ribbon(0.18, earProfile(0.022, 4), { y: 0.72, segments: 4 }), { accent: 1 }));
  }

  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return markShared(merged);
}

const cache = new Map<CropShape, THREE.BufferGeometry>();

/** Géométrie d'un brin, construite une fois puis partagée. */
export function cropShape(kind: CropShape): THREE.BufferGeometry {
  const found = cache.get(kind);
  if (found) return found;
  const geo = buildShape(kind);
  cache.set(kind, geo);
  return geo;
}

/** Hauteur réelle du brin unitaire — sert aux tests d'échelle. */
export function cropShapeHeight(kind: CropShape): number {
  const geo = cropShape(kind);
  geo.computeBoundingBox();
  return geo.boundingBox!.max.y;
}
