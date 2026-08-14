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
export const CROP_ACCENT: Record<CropShape, number> = {
  WHEAT: 0xe3bf62,
  BARLEY: 0xdfcb86,
  MAIZE: 0xe7d98a,
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

/** Marque une pièce comme « accent » ou non, pour que la fusion garde l'info. */
function tint(geo: THREE.BufferGeometry, accent: number): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  if (flat !== geo) geo.dispose();
  const n = flat.getAttribute("position").count;
  flat.setAttribute("aAccent", new THREE.Float32BufferAttribute(new Float32Array(n).fill(accent), 1));
  return flat;
}

/** Lame de feuille : un plan à trois segments, planté en bas, incliné. */
function blade(
  width: number,
  height: number,
  opts: { yaw?: number; lean?: number; y?: number; segments?: number } = {},
): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, height, 1, opts.segments ?? 3);
  g.translate(0, height / 2, 0);
  if (opts.lean) {
    // Courbure de la feuille : le sommet retombe. On déplace les sommets au
    // lieu d'incliner la pièce, sinon le pied décolle du sol.
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const t = pos.getY(i) / height;
      pos.setZ(i, pos.getZ(i) + opts.lean * t * t);
      pos.setY(i, pos.getY(i) - opts.lean * 0.35 * t * t);
    }
    g.computeVertexNormals();
  }
  if (opts.yaw) g.rotateY(opts.yaw);
  if (opts.y) g.translate(0, opts.y, 0);
  return g;
}

/** Barbe d'épi : une aiguille fine, plantée en haut et fuyante. */
function awn(length: number, yaw: number, tilt: number, y: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.007, length, 1, 1);
  g.translate(0, length / 2, 0);
  g.rotateX(tilt);
  g.rotateY(yaw);
  g.translate(0, y, 0);
  return g;
}

function spindle(radius: number, height: number, y: number, segments = 5): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius * 0.15, radius, height, segments, 1);
  g.translate(0, y + height / 2, 0);
  return g;
}

function stem(radius: number, height: number, segments = 4): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(radius * 0.6, radius, height, segments, 1);
  g.translate(0, height / 2, 0);
  return g;
}

function bead(radius: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, 0);
  g.translate(x, y, z);
  return g;
}

function buildShape(kind: CropShape): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];

  if (kind === "WHEAT") {
    // Paille droite, épi court et dense, barbes brèves.
    parts.push(tint(blade(0.04, 0.72), 0));
    parts.push(tint(blade(0.03, 0.3, { yaw: 1.1, lean: 0.05, y: 0.18 }), 0));
    parts.push(tint(spindle(0.032, 0.24, 0.7, 5), 1));
    for (let i = 0; i < 4; i++) {
      parts.push(tint(awn(0.13, (i / 4) * Math.PI * 2, 0.3, 0.9), 1));
    }
  } else if (kind === "BARLEY") {
    // La barbe : des arêtes deux fois plus longues que l'épi, en éventail.
    // C'est à ça, et à rien d'autre, qu'on reconnaît de l'orge de loin.
    parts.push(tint(blade(0.036, 0.6), 0));
    parts.push(tint(blade(0.028, 0.26, { yaw: 0.9, lean: 0.06, y: 0.14 }), 0));
    parts.push(tint(spindle(0.026, 0.2, 0.58, 5), 1));
    for (let i = 0; i < 6; i++) {
      parts.push(tint(awn(0.36, (i / 6) * Math.PI * 2 + 0.4, 0.22 + (i % 2) * 0.12, 0.74), 1));
    }
  } else if (kind === "MAIZE") {
    // Canne épaisse, longues feuilles retombantes, panicule au sommet.
    parts.push(tint(stem(0.026, 0.92, 5), 0));
    for (let i = 0; i < 4; i++) {
      parts.push(
        tint(
          blade(0.075, 0.46, {
            yaw: (i / 4) * Math.PI * 2 + 0.5,
            lean: 0.17,
            y: 0.2 + i * 0.13,
            segments: 3,
          }),
          0,
        ),
      );
    }
    // Épi enveloppé, à mi-hauteur, et le plumet au-dessus de la canne.
    parts.push(tint(spindle(0.05, 0.2, 0.4, 5), 1));
    for (let i = 0; i < 3; i++) {
      parts.push(tint(awn(0.16, (i / 3) * Math.PI * 2, 0.26, 0.9), 1));
    }
  } else if (kind === "PEA") {
    // Touffe basse : des folioles par paires, deux gousses, une vrille.
    parts.push(tint(stem(0.012, 0.46, 4), 0));
    for (let i = 0; i < 6; i++) {
      parts.push(
        tint(
          blade(0.06, 0.13, {
            yaw: (i / 6) * Math.PI * 2 + 0.3,
            lean: 0.05,
            y: 0.14 + (i % 3) * 0.12,
          }),
          0,
        ),
      );
    }
    parts.push(tint(spindle(0.022, 0.16, 0.3, 4), 1));
    const pod = spindle(0.02, 0.14, 0.22, 4);
    pod.rotateZ(0.7);
    pod.translate(0.05, 0.02, 0.03);
    parts.push(tint(pod, 1));
    parts.push(tint(awn(0.12, 0.7, 0.5, 0.44), 0));
  } else if (kind === "RAPE") {
    // Tige haute qui se ramifie, grappe de fleurs jaunes au sommet.
    parts.push(tint(stem(0.014, 0.66, 4), 0));
    for (let i = 0; i < 3; i++) {
      parts.push(
        tint(blade(0.05, 0.2, { yaw: (i / 3) * Math.PI * 2, lean: 0.06, y: 0.16 + i * 0.14 }), 0),
      );
    }
    // La grappe : des boutons en couronne, plus serrés vers le haut.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 0.055 * (1 - i / 12);
      parts.push(tint(bead(0.026, Math.cos(a) * r, 0.72 + (i % 3) * 0.055, Math.sin(a) * r), 1));
    }
    parts.push(tint(bead(0.03, 0, 0.9, 0), 1));
  } else {
    // Herbe : une touffe de lames fines, sans épi. Un pré fauché doit se lire
    // comme un tapis, pas comme un champ de céréale rasé.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6;
      parts.push(
        tint(
          blade(0.028, 0.68 + (i % 3) * 0.14, {
            yaw: a,
            lean: 0.1 + (i % 2) * 0.06,
            segments: 3,
          }),
          i === 2 ? 1 : 0,
        ),
      );
    }
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
