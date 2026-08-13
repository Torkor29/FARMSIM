#!/usr/bin/env node
/**
 * Fabrique le trait de côte de la Terre embarqué dans le globe.
 *
 * Source : Natural Earth 110 m « land » (domaine public). Le fichier brut fait
 * 138 ko de JSON, bien trop pour être chargé au démarrage d'un jeu ; on le
 * simplifie, on le quantifie au dixième de degré et on l'écrit en un module
 * TypeScript compact.
 *
 *   node scripts/build-earth-land.mjs
 *
 * Le résultat est versionné : le jeu ne va jamais chercher ces données en
 * ligne, et la planète est identique pour tout le monde, hors ligne compris.
 */

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson";

/** Sous ce nombre de degrés carrés, une île ne pèse plus un pixel à l'écran. */
const MIN_AREA = 0.7;
/** Tolérance de simplification, en degrés. */
const TOLERANCE = 0.28;

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../apps/web/src/earth-land.ts");

/** Aire signée d'un anneau, en degrés carrés. */
function ringArea(ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return a / 2;
}

/** Distance d'un point au segment ab, dans le plan des degrés. */
function segDistance(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx || dy) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Douglas-Peucker : garde les sommets qui portent la forme. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDistance(points[i], points[first], points[last]);
      if (d > worst) {
        worst = d;
        index = i;
      }
    }
    if (worst > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Natural Earth : HTTP ${res.status}`);
const data = await res.json();

/** Tous les anneaux extérieurs, îles comprises. */
const rings = [];
for (const feature of data.features) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === "Polygon" ? [coordinates] : coordinates;
  for (const polygon of polygons) {
    // On ne garde que l'anneau extérieur : les lacs intérieurs ne se voient pas
    // à l'échelle d'une bille de deux centimètres.
    rings.push(polygon[0]);
  }
}

const kept = [];
for (const ring of rings) {
  if (Math.abs(ringArea(ring)) < MIN_AREA) continue;
  const simple = simplify(ring, TOLERANCE);
  if (simple.length < 4) continue;
  // Quantification au dixième de degré : la planète fait deux centimètres à
  // l'écran, personne ne verra jamais mieux.
  const quantized = simple.map(([lon, lat]) => [
    Math.round(lon * 10),
    Math.round(lat * 10),
  ]);
  // Doublons consécutifs nés de l'arrondi.
  const clean = quantized.filter(
    (p, i) => i === 0 || p[0] !== quantized[i - 1][0] || p[1] !== quantized[i - 1][1],
  );
  if (clean.length >= 4) kept.push(clean);
}

kept.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));

/**
 * Encodage : un anneau par ligne, deltas en base 36 signée.
 *
 * Les coordonnées absolues coûtent quatre à cinq caractères chacune ; leurs
 * écarts successifs tiennent presque toujours sur un ou deux. Le fichier passe
 * de 190 ko à une trentaine.
 */
function encodeRing(ring) {
  let out = `${ring[0][0]},${ring[0][1]}`;
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i - 1][0];
    const dy = ring[i][1] - ring[i - 1][1];
    out += `;${dx.toString(36)},${dy.toString(36)}`;
  }
  return out;
}

const encoded = kept.map(encodeRing);
const points = kept.reduce((n, r) => n + r.length, 0);

const body = `/**
 * Le trait de côte de la Terre.
 *
 * Fichier **engendré** par \`node scripts/build-earth-land.mjs\` à partir de
 * Natural Earth 110 m (domaine public) — ne pas modifier à la main.
 *
 * ${kept.length} anneaux, ${points} sommets, simplifiés à ${TOLERANCE}° et quantifiés au
 * dixième de degré. Chaque ligne est un contour : le premier point en
 * coordonnées absolues (dixièmes de degré, longitude puis latitude), les
 * suivants en écarts codés en base 36.
 */

const RINGS = [
${encoded.map((r) => `  "${r}",`).join("\n")}
];

export type Ring = Float32Array;

let cache: Ring[] | null = null;

/**
 * Contours des terres émergées, en degrés (longitude, latitude) entrelacés.
 *
 * Le décodage est différé et mis en cache : le globe n'apparaît pas sur toutes
 * les pages, et ces quelques milliers de sommets n'ont rien à faire dans le
 * chemin de démarrage du jeu.
 */
export function earthLandRings(): Ring[] {
  if (cache) return cache;
  cache = RINGS.map((line) => {
    const parts = line.split(";");
    const out = new Float32Array(parts.length * 2);
    let lon = 0;
    let lat = 0;
    for (let i = 0; i < parts.length; i++) {
      const [a, b] = parts[i].split(",");
      if (i === 0) {
        lon = Number(a);
        lat = Number(b);
      } else {
        lon += parseInt(a, 36);
        lat += parseInt(b, 36);
      }
      out[i * 2] = lon / 10;
      out[i * 2 + 1] = lat / 10;
    }
    return out;
  });
  return cache;
}
`;

writeFileSync(OUT, body);
console.log(
  `${kept.length} anneaux, ${points} sommets → ${OUT} (${(body.length / 1024).toFixed(1)} ko)`,
);
