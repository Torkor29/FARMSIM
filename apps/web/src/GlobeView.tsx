import { useEffect, useRef } from "react";
import * as THREE from "three";
import { disposeRenderer, disposeThreeScene, markShared } from "./three-cleanup";

export type GlobeContinent = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
  accent: string;
  parcelFree: number;
  parcelTotal: number;
};

type Props = {
  continents: GlobeContinent[];
  selected?: string | null;
  onSelect?: (code: string) => void;
  /** Vue focalisée : le globe cesse de tourner et zoome sur la sélection */
  focus?: boolean;
  height?: number;
};

const R = 2;
/** Inclinaison de l'axe (23,4°) : la Terre penchée est plus jolie qu'une bille droite. */
const AXIS_TILT = 0.41;
const DIST_WORLD = 7.6;
const DIST_FOCUS = 4.2;
const DIST_NEAR = 5.4;
const DIST_MIN = 4;
const DIST_MAX = 12;

/* ------------------------------------------------------------------ */
/* Bruit déterministe (value noise 3D + fbm) : même planète à chaque    */
/* visite, sans dépendance externe.                                     */
/* ------------------------------------------------------------------ */

function hashInt(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Courbe de Perlin (6t⁵-15t⁴+10t³) : interpolation sans cassure visible. */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function valueNoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const w = fade(z - zi);

  const c000 = hashInt(xi, yi, zi);
  const c100 = hashInt(xi + 1, yi, zi);
  const c010 = hashInt(xi, yi + 1, zi);
  const c110 = hashInt(xi + 1, yi + 1, zi);
  const c001 = hashInt(xi, yi, zi + 1);
  const c101 = hashInt(xi + 1, yi, zi + 1);
  const c011 = hashInt(xi, yi + 1, zi + 1);
  const c111 = hashInt(xi + 1, yi + 1, zi + 1);

  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** Somme d'octaves : les grandes formes portent les détails de côte. */
function fbm(x: number, y: number, z: number, octaves = 4): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise3(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hashCode(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function latLonToVec3(lat: number, lon: number, radius = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* ------------------------------------------------------------------ */
/* Champ continental                                                    */
/* ------------------------------------------------------------------ */

/**
 * Chaque continent est décrit par un champ scalaire sur la sphère :
 * un masque elliptique (la silhouette d'ensemble) perturbé par du bruit
 * (les côtes découpées). Positif = terre, négatif = mer.
 */
type Field = {
  code: string;
  center: THREE.Vector3;
  east: THREE.Vector3;
  north: THREE.Vector3;
  spanU: number;
  spanV: number;
  ox: number;
  oy: number;
  oz: number;
  height(dir: THREE.Vector3): number;
  mountain(dir: THREE.Vector3): number;
  dry(dir: THREE.Vector3): number;
};

type GeometryCache = {
  key: string;
  ocean: THREE.BufferGeometry | null;
  land: Map<string, THREE.BufferGeometry>;
};

/**
 * Le relief du globe est déterministe : mêmes continents, même géométrie.
 * La construire coûte pourtant plusieurs centaines de millisecondes de bruit
 * fractal, et le composant se monte plusieurs fois — deux fois en StrictMode,
 * puis à chaque retour sur l'écran des continents et pour le vol d'approche.
 * On garde donc le résultat en mémoire pour la durée de la session.
 */
let geometryCache: GeometryCache | null = null;

function takeGeometryCache(continents: GlobeContinent[]): GeometryCache {
  const key = continents.map((c) => c.code).join("|");
  if (!geometryCache || geometryCache.key !== key) {
    geometryCache?.ocean?.dispose();
    geometryCache?.land.forEach((g) => g.dispose());
    geometryCache = { key, ocean: null, land: new Map() };
  }
  return geometryCache;
}

function makeField(c: GlobeContinent): Field {
  const center = latLonToVec3(c.lat, c.lon, 1);
  const polar = Math.abs(center.y) > 0.97 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(polar, center).normalize();
  const north = new THREE.Vector3().crossVectors(center, east).normalize();

  const seed = hashCode(c.code);
  const rnd = (n: number) => ((seed >>> n) % 1000) / 1000;
  // Les continents s'étirent un peu en longitude, comme les vrais.
  const spanU = 0.5 + rnd(3) * 0.16;
  const spanV = 0.34 + rnd(9) * 0.12;
  const ox = 11.3 + (seed % 37);
  const oy = 5.7 + ((seed >>> 5) % 41);
  const oz = 23.1 + ((seed >>> 11) % 29);

  const height = (dir: THREE.Vector3): number => {
    const d = dir.dot(center);
    if (d <= 0.12) return -1;
    const u = Math.atan2(dir.dot(east), d) / spanU;
    const v = Math.atan2(dir.dot(north), d) / spanV;
    const r2 = u * u + v * v;
    if (r2 > 2.2) return -1;
    const mask = 1 - r2;
    // Deux échelles de bruit : golfes et péninsules larges, puis dentelle de
    // côte. Les gains sont calibrés pour découper franchement le masque sans
    // faire éclater la masse principale en archipel.
    const big = fbm(dir.x * 3 + ox, dir.y * 3 + oy, dir.z * 3 + oz, 3);
    const fine = fbm(dir.x * 9 + oz, dir.y * 9 + ox, dir.z * 9 + oy, 2);
    return mask * 1.12 + (big - 0.5) * 2.8 + (fine - 0.5) * 0.9 - 0.3;
  };

  const mountain = (dir: THREE.Vector3): number =>
    fbm(dir.x * 4.3 + oy * 1.7, dir.y * 4.3 + oz * 1.3, dir.z * 4.3 + ox * 1.9, 3);

  const dry = (dir: THREE.Vector3): number =>
    fbm(dir.x * 2.9 + oz * 2.3, dir.y * 2.9 + oy * 0.7, dir.z * 2.9 + ox * 1.1, 2);

  return { code: c.code, center, east, north, spanU, spanV, ox, oy, oz, height, mountain, dry };
}

/** Altitude du sol au-dessus du niveau de la mer, plaines et pics compris. */
function elevationOf(h: number, m: number): number {
  const plain = 0.045 + Math.min(h, 1) * 0.07;
  const ridge = m > 0.52 ? (m - 0.52) * 0.78 * Math.min(1, h * 3.2) : 0;
  return plain + ridge;
}

const ROCK = new THREE.Color(0xb8a894);
const SNOW = new THREE.Color(0xeef6fa);
const SAND = new THREE.Color(0xe4c98a);
const CLIFF = new THREE.Color(0xa9784f);

const DEEP = new THREE.Color(0x2e78ad);
const MID = new THREE.Color(0x4a9fd0);
const TROPIC = new THREE.Color(0x63c1de);
const POLAR = new THREE.Color(0xc4e4f2);
const SHALLOW = new THREE.Color(0x92dcef);

/* ------------------------------------------------------------------ */
/* Construction des masses continentales                                */
/* ------------------------------------------------------------------ */

/**
 * Grille gnomonique centrée sur le continent : on échantillonne le champ,
 * on garde les cellules « terre », puis on coud une jupe verticale sur
 * chaque bord de côte. Résultat : une plaque de terre épaisse, façon carte
 * en relief, avec un littoral irrégulier — jamais des hexagones épars.
 */
function buildLand(
  c: GlobeContinent,
  f: Field,
  others: Field[],
  cells: number,
): { geometry: THREE.BufferGeometry; triangles: number } {
  const N = cells;
  const base = new THREE.Color(c.color);
  const accent = new THREE.Color(c.accent);
  const cliff = base.clone().lerp(CLIFF, 0.72).multiplyScalar(0.92);

  // Les nœuds entiers sont décalés dans le plan tangent : les côtes perdent
  // leur allure de damier et les facettes deviennent irrégulières.
  const dirAt = (i: number, j: number, jitter = false): THREE.Vector3 => {
    let gi = i;
    let gj = j;
    if (jitter) {
      gi += (hashInt(i, j, 17) - 0.5) * 0.62;
      gj += (hashInt(i, j, 91) - 0.5) * 0.62;
    }
    const a = Math.tan(((gi / N) * 2 - 1) * f.spanU * 1.12);
    const b = Math.tan(((gj / N) * 2 - 1) * f.spanV * 1.12);
    return new THREE.Vector3()
      .copy(f.center)
      .addScaledVector(f.east, a)
      .addScaledVector(f.north, b)
      .normalize();
  };

  // Champ échantillonné au centre des cellules : la côte tombe sur une arête.
  const cellDir: THREE.Vector3[] = new Array(N * N);
  const cellH = new Float32Array(N * N);
  const land = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const d = dirAt(i + 0.5, j + 0.5);
      const h = f.height(d);
      const k = j * N + i;
      cellDir[k] = d;
      cellH[k] = h;
      // Deux continents voisins se partagent la frontière au lieu de se
      // superposer : le plus « fort » gagne, et un détroit reste entre eux.
      let rival = -1;
      for (const o of others) rival = Math.max(rival, o.height(d));
      land[k] = h > 0 && h > rival + 0.05 ? 1 : 0;
    }
  }

  // Nettoyage cellulaire : on gomme les pixels isolés et on bouche les trous
  // d'un carreau, sinon la côte grésille au lieu d'onduler.
  const neighbours = (arr: Uint8Array, i: number, j: number): number => {
    let n = 0;
    if (i > 0 && arr[j * N + i - 1]) n++;
    if (i < N - 1 && arr[j * N + i + 1]) n++;
    if (j > 0 && arr[(j - 1) * N + i]) n++;
    if (j < N - 1 && arr[(j + 1) * N + i]) n++;
    return n;
  };
  for (let pass = 0; pass < 2; pass++) {
    const next = land.slice();
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const n = neighbours(land, i, j);
        if (land[k] && n <= 1) next[k] = 0;
        if (!land[k] && n >= 4) next[k] = 1;
      }
    }
    land.set(next);
  }

  // Altitude aux nœuds : moyenne des cellules terrestres adjacentes, ce qui
  // donne une surface continue (et des sommets partagés, donc peu de tris).
  const nodeDir: THREE.Vector3[] = new Array((N + 1) * (N + 1));
  const nodeR = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const idx = j * (N + 1) + i;
      nodeDir[idx] = dirAt(i, j, true);
      let sum = 0;
      let count = 0;
      for (let dj = -1; dj <= 0; dj++) {
        for (let di = -1; di <= 0; di++) {
          const ci = i + di;
          const cj = j + dj;
          if (ci < 0 || cj < 0 || ci >= N || cj >= N) continue;
          const ck = cj * N + ci;
          if (!land[ck]) continue;
          sum += elevationOf(Math.max(0, cellH[ck]), f.mountain(cellDir[ck]));
          count++;
        }
      }
      // Froissement haute fréquence : sans lui, une plaine reste une crêpe
      // lisse. Avec le flat shading, chaque facette accroche la lumière.
      const wrinkle = count
        ? (valueNoise3(nodeDir[idx].x * 26, nodeDir[idx].y * 26, nodeDir[idx].z * 26) - 0.5) * 0.026
        : 0;
      nodeR[idx] = R + (count ? sum / count + wrinkle : 0.02);
    }
  }

  const pos: number[] = [];
  const col: number[] = [];
  const tmp = new THREE.Color();
  const p = new THREE.Vector3();

  const push = (dir: THREE.Vector3, radius: number, color: THREE.Color) => {
    p.copy(dir).multiplyScalar(radius);
    pos.push(p.x, p.y, p.z);
    col.push(color.r, color.g, color.b);
  };

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (!land[k]) continue;

      const d = cellDir[k];
      const h = Math.max(0, cellH[k]);
      const m = f.mountain(d);
      const lat = Math.abs(Math.asin(d.y) * (180 / Math.PI));
      const ridge = m > 0.54 ? (m - 0.54) / 0.46 : 0;

      // Palette : accent clair sur les côtes basses, couleur pleine dans les
      // terres, taches sombres de couvert végétal, roche en altitude, sable au
      // tropique sec et neige sur les hauts sommets ou près des pôles.
      const biome = valueNoise3(d.x * 7 + 11, d.y * 7 + 5, d.z * 7 + 3);
      tmp.copy(base).lerp(accent, clamp01(1 - h * 2.6) * 0.75);
      if (biome > 0.56) tmp.multiplyScalar(1 - clamp01((biome - 0.56) * 2.4) * 0.24);
      else if (biome < 0.4) tmp.lerp(accent, clamp01((0.4 - biome) * 2) * 0.35);
      if (ridge > 0) tmp.lerp(ROCK, clamp01(ridge * 1.6));
      const arid = f.dry(d);
      if (lat > 14 && lat < 38 && arid > 0.52) {
        tmp.lerp(SAND, clamp01((arid - 0.52) * 2.4) * 0.8);
      }
      const cold = clamp01((lat - 52) / 20) + clamp01((ridge - 0.35) * 2.2);
      if (cold > 0) tmp.lerp(SNOW, clamp01(cold) * 0.92);
      // Micro-variation par facette : la lumière accroche mieux.
      const jitter = 0.94 + valueNoise3(d.x * 34 + 3, d.y * 34, d.z * 34) * 0.13;
      tmp.multiplyScalar(jitter);

      const n00 = j * (N + 1) + i;
      const n10 = n00 + 1;
      const n01 = n00 + (N + 1);
      const n11 = n01 + 1;

      push(nodeDir[n00], nodeR[n00], tmp);
      push(nodeDir[n10], nodeR[n10], tmp);
      push(nodeDir[n11], nodeR[n11], tmp);
      push(nodeDir[n00], nodeR[n00], tmp);
      push(nodeDir[n11], nodeR[n11], tmp);
      push(nodeDir[n01], nodeR[n01], tmp);

      // Jupe de falaise sur chaque arête donnant sur la mer.
      const edges: Array<[number, number, boolean]> = [
        [n00, n10, j === 0 || !land[(j - 1) * N + i]],
        [n10, n11, i === N - 1 || !land[j * N + i + 1]],
        [n11, n01, j === N - 1 || !land[(j + 1) * N + i]],
        [n01, n00, i === 0 || !land[j * N + i - 1]],
      ];
      for (const [a, b, open] of edges) {
        if (!open) continue;
        push(nodeDir[a], nodeR[a], cliff);
        push(nodeDir[b], nodeR[b], cliff);
        push(nodeDir[b], R - 0.02, cliff);
        push(nodeDir[a], nodeR[a], cliff);
        push(nodeDir[b], R - 0.02, cliff);
        push(nodeDir[a], R - 0.02, cliff);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return { geometry, triangles: pos.length / 9 };
}

/** Océan lisse : teintes par latitude, variation de profondeur, hauts-fonds. */
function buildOcean(fields: Field[]): THREE.BufferGeometry {
  // Niveau 4 (5 120 triangles) : la silhouette est déjà parfaitement ronde et
  // le budget reste tenable — au-delà, on paie des sommets qu'on ne voit pas.
  const geometry = new THREE.IcosahedronGeometry(R, 4);
  const pos = geometry.getAttribute("position");

  // La couleur se calcule par SOMMET, à partir de sa propre direction, et non
  // par triangle. Une teinte unique par face dessinait des bandes diagonales
  // parfaitement visibles au zoom, quel que soit le niveau de subdivision :
  // c'était la coloration, pas la géométrie, qui trahissait le maillage.
  // La sphère reste parfaitement ronde pour la même raison.
  const colors = new Float32Array(pos.count * 3);
  const dir = new THREE.Vector3();
  const tint = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();

    const lat = Math.abs(Math.asin(dir.y) * (180 / Math.PI));
    const n = fbm(dir.x * 2.4 + 19.1, dir.y * 2.4 + 3.3, dir.z * 2.4 + 8.8, 3);
    tint.copy(DEEP).lerp(MID, clamp01((n - 0.28) / 0.44));
    if (lat > 60) tint.lerp(POLAR, clamp01((lat - 60) / 24) * 0.8);
    else if (lat < 24) tint.lerp(TROPIC, (1 - lat / 24) * 0.4);

    // Haut-fond : on éclaircit là où le champ continental frôle le zéro.
    let near = -1;
    for (const f of fields) near = Math.max(near, f.height(dir));
    if (near > -0.42) tint.lerp(SHALLOW, clamp01((near + 0.42) / 0.42) * 0.85);

    colors[i * 3] = tint.r;
    colors[i * 3 + 1] = tint.g;
    colors[i * 3 + 2] = tint.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Halo fresnel : lumineux sur les bords, invisible au centre du disque. */
function atmosphereMaterial(color: number, power: number, intensity: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uPower: { value: power },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vP;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vP = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uPower; uniform float uIntensity;
      varying vec3 vN; varying vec3 vP;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), uPower);
        gl_FragColor = vec4(uColor, f * uIntensity);
      }`,
  });
}

/* ------------------------------------------------------------------ */
/* Composant                                                            */
/* ------------------------------------------------------------------ */

type MarkerHandle = {
  code: string;
  pin: THREE.Group;
  ring: THREE.Mesh;
  ringMat: THREE.MeshBasicMaterial;
  free: boolean;
};

type GlobeApi = { zoom: (factor: number) => void; world: () => void };

/** Globe interactif : sélection de continent avant l'installation. */
export function GlobeView({
  continents,
  selected = null,
  onSelect,
  focus = false,
  height = 380,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<GlobeApi | null>(null);
  const stateRef = useRef({ selected, focus, onSelect });
  stateRef.current = { selected, focus, onSelect };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const scene = new THREE.Scene();
    const width = host.clientWidth || 480;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0, DIST_WORLD);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    // Soleil chaud rasant + ciel froid : le terminateur jour/nuit reste lisible.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7fa8c4, 1.25));
    const sun = new THREE.DirectionalLight(0xfff6e6, 2.1);
    sun.position.set(4.2, 2.4, 5.2);
    scene.add(sun);
    // Contre-jour mesuré : il empêche la moitié nuit de tomber au noir, sans
    // effacer le terminateur qui donne son volume au globe.
    const rim = new THREE.DirectionalLight(0xbfe4ff, 0.55);
    rim.position.set(-4, -1.2, -3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    // root (tangage) > axis (inclinaison) > spinner (rotation propre)
    const root = new THREE.Group();
    scene.add(root);
    const axis = new THREE.Group();
    axis.rotation.z = AXIS_TILT;
    root.add(axis);
    const spinner = new THREE.Group();
    axis.add(spinner);

    const fields = continents.map(makeField);
    const geometryCache = takeGeometryCache(continents);

    // Ombrage lissé sur l'océan : les facettes anguleuses lisibles à l'œil nu
    // faisaient « bille en plastique ». La terre, elle, reste facettée.
    const oceanMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: false,
      roughness: 0.62,
      metalness: 0.02,
    });
    const ocean = new THREE.Mesh(
      (geometryCache.ocean ??= markShared(buildOcean(fields))),
      oceanMat,
    );
    spinner.add(ocean);

    // Résolution de la grille de terre : c'est elle qui décide si une côte
    // ressemble à un littoral ou à un escalier. Le coût reste modeste car seules
    // les cellules émergées produisent des triangles.
    const cellCount = continents.length > 6 ? 34 : 40;
    const landByCode = new Map<string, THREE.Mesh>();
    const landMat = new Map<string, THREE.MeshLambertMaterial>();
    // Cibles de raycast : terres et marqueurs seulement, jamais l'océan
    // (5 000 triangles inutiles à tester à chaque mouvement de souris).
    const pickTargets: THREE.Object3D[] = [];

    /**
     * Un continent coûte quelques dizaines de millisecondes de bruit fractal.
     * Les construire d'affilée bloquait le fil principal près de 400 ms —
     * Chrome le signalait comme une violation, et le clic paraissait figé. On
     * en pose donc un par image : l'océan s'affiche tout de suite, les terres
     * apparaissent en un peu plus d'un dixième de seconde, et rien ne bloque.
     */
    function buildContinent(i: number) {
      const c = continents[i];
      const rivals = fields.filter((_, k) => k !== i);
      const geometry =
        geometryCache.land.get(c.code) ??
        markShared(buildLand(c, fields[i], rivals, cellCount).geometry);
      geometryCache.land.set(c.code, geometry);
      const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        flatShading: true,
        emissive: new THREE.Color(0x000000),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.continentCode = c.code;
      spinner.add(mesh);
      pickTargets.push(mesh);
      landByCode.set(c.code, mesh);
      landMat.set(c.code, material);
    }

    let buildRaf = 0;
    let nextContinent = 0;
    const buildNext = () => {
      if (nextContinent >= continents.length) return;
      buildContinent(nextContinent++);
      buildRaf = requestAnimationFrame(buildNext);
    };
    buildNext();

    // Nuages : patchs aplatis répartis en spirale de Fibonacci.
    const clouds = new THREE.Group();
    axis.add(clouds);
    // Emissive marqué : un nuage doit rester blanc même du côté nuit, sinon il
    // vire au caillou gris.
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0x6f7f8f),
      flatShading: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const cloudGeos = [0.06, 0.08, 0.1].map((r) => new THREE.IcosahedronGeometry(r, 0));
    const CLOUDS = 40;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < CLOUDS; i++) {
      const puff = new THREE.Group();
      const n = 3 + (i % 3);
      for (let j = 0; j < n; j++) {
        const g = cloudGeos[(i + j) % cloudGeos.length];
        const m = new THREE.Mesh(g, cloudMat);
        // Boules chevauchantes : un banc continu plutôt que des galets alignés.
        m.position.set(
          (j - (n - 1) / 2) * 0.075,
          (valueNoise3(i, j, 0) - 0.5) * 0.09,
          (valueNoise3(j, i, 5) - 0.5) * 0.04,
        );
        // Après lookAt, Z local est l'axe radial : c'est lui qu'on aplatit.
        m.scale.set(1, 0.9, 0.42);
        puff.add(m);
      }
      const y = 1 - (i / (CLOUDS - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * golden;
      puff.position.set(Math.cos(th) * rad, y, Math.sin(th) * rad).multiplyScalar(R * 1.06);
      puff.lookAt(0, 0, 0);
      puff.rotateZ(valueNoise3(i, 7, 2) * Math.PI);
      puff.scale.setScalar(0.8 + valueNoise3(i * 0.7, 3, 9) * 0.8);
      clouds.add(puff);
    }

    // Atmosphère : un liseré bleu fin collé au limbe, doublé d'une lueur dorée
    // très diffuse. Les deux restent invisibles au centre du disque.
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.05, 28, 20),
      atmosphereMaterial(0x9fd8f5, 3.4, 0.85),
    );
    scene.add(atmo);
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.11, 24, 16),
      atmosphereMaterial(0xc9a227, 3.2, 0.3),
    );
    scene.add(glow);

    // Marqueurs : anneau au sol qui pulse, tige fine, pastille à facettes.
    const ringGeo = new THREE.RingGeometry(0.12, 0.155, 26);
    const stemGeo = new THREE.CylinderGeometry(0.014, 0.02, 0.2, 6);
    const headGeo = new THREE.OctahedronGeometry(0.075, 0);
    const baseGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.03, 8);
    const markers: MarkerHandle[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < continents.length; i++) {
      const c = continents[i];
      const f = fields[i];
      const dir = f.center;
      const free = c.parcelFree > 0;
      const tone = free ? 0xd9b23c : 0x9aa39c;

      const anchor = new THREE.Group();
      anchor.quaternion.setFromUnitVectors(up, dir);

      // On prend le point le plus haut du voisinage : sur un relief accidenté,
      // un marqueur posé à l'altitude du centre disparaît dans la montagne.
      const probe = new THREE.Vector3();
      let surface = R;
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        probe
          .copy(dir)
          .addScaledVector(f.east, Math.cos(a) * (k ? 0.06 : 0))
          .addScaledVector(f.north, Math.sin(a) * (k ? 0.06 : 0))
          .normalize();
        surface = Math.max(
          surface,
          R + elevationOf(Math.max(0, f.height(probe)), f.mountain(probe)),
        );
      }

      const ringMat = new THREE.MeshBasicMaterial({
        color: tone,
        transparent: true,
        opacity: free ? 0.7 : 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      // Dégagement franc : l'anneau est plat, le sol ne l'est pas.
      ring.position.y = surface + 0.05;
      ring.rotation.x = -Math.PI / 2;
      anchor.add(ring);

      const pinMat = new THREE.MeshLambertMaterial({ color: tone, flatShading: true });
      const pin = new THREE.Group();
      pin.position.y = surface + 0.03;
      const plate = new THREE.Mesh(baseGeo, pinMat);
      plate.position.y = 0.015;
      pin.add(plate);
      const stem = new THREE.Mesh(stemGeo, pinMat);
      stem.position.y = 0.12;
      pin.add(stem);
      const head = new THREE.Mesh(
        headGeo,
        new THREE.MeshLambertMaterial({
          color: tone,
          flatShading: true,
          emissive: new THREE.Color(free ? 0x5a4408 : 0x1a1d1a),
        }),
      );
      head.position.y = 0.27;
      pin.add(head);
      anchor.add(pin);

      anchor.userData.continentCode = c.code;
      spinner.add(anchor);
      pickTargets.push(anchor);
      markers.push({ code: c.code, pin, ring, ringMat, free });
    }

    /* ---------------- interaction ---------------- */

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickBounds = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R + 0.05);
    const hitPoint = new THREE.Vector3();
    const pointers = new Map<number, { x: number; y: number }>();
    let hovered: string | null = null;
    let dragging = false;
    let dragMoved = false;
    let lastX = 0;
    let lastY = 0;
    let velX = 0;
    let velY = 0;
    let pinchStart = 0;
    let pinchDist = 0;

    let spin = 0;
    let pitch = 0;
    let dist = DIST_WORLD;
    let distTarget = DIST_WORLD;
    let idle = 0;

    // Vol de caméra : interpolation douce de la rotation vers la cible.
    let flying = false;
    let flyStart = 0;
    let flyFrom = { spin: 0, pitch: 0 };
    let flyTo = { spin: 0, pitch: 0 };
    const FLY_MS = 1000;

    let lastSelected: string | null = stateRef.current.selected;
    let lastFocus = stateRef.current.focus;
    let worldView = false;

    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    /** Rotation exacte amenant une direction face à la caméra, tilt compris. */
    function aimAt(dir: THREE.Vector3, fromSpin: number) {
      const cosT = Math.cos(AXIS_TILT);
      const p = Math.asin(THREE.MathUtils.clamp(dir.y / cosT, -1, 1));
      const ux = Math.sin(p) * Math.sin(AXIS_TILT);
      const uz = Math.cos(p);
      const s = Math.atan2(ux, uz) - Math.atan2(dir.x, dir.z);
      const delta = Math.atan2(Math.sin(s - fromSpin), Math.cos(s - fromSpin));
      return { spin: fromSpin + delta, pitch: THREE.MathUtils.clamp(p, -1.05, 1.05) };
    }

    function flyTowards(code: string | null, foc: boolean) {
      flying = true;
      flyStart = performance.now();
      flyFrom = { spin, pitch };
      const idx = continents.findIndex((x) => x.code === code);
      if (idx >= 0) {
        flyTo = aimAt(fields[idx].center, spin);
        distTarget = foc ? DIST_FOCUS : DIST_NEAR;
      } else {
        flyTo = { spin, pitch: 0 };
        distTarget = DIST_WORLD;
      }
      velX = 0;
      velY = 0;
      idle = 0;
    }

    function pick(ev: PointerEvent): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickTargets, true);
      for (const hit of hits) {
        let o: THREE.Object3D | null = hit.object;
        while (o) {
          const code = o.userData?.continentCode as string | undefined;
          if (code) return code;
          o = o.parent;
        }
      }
      // Rien touché : on tolère le clic « à côté » en projetant sur la sphère
      // et en cherchant le continent dont le champ est le plus proche du bord.
      if (!raycaster.ray.intersectSphere(pickBounds, hitPoint)) return null;
      const local = spinner.worldToLocal(hitPoint.clone()).normalize();
      let best: string | null = null;
      let bestVal = -0.5;
      for (let i = 0; i < fields.length; i++) {
        const v = fields[i].height(local);
        if (v > bestVal) {
          bestVal = v;
          best = continents[i].code;
        }
      }
      return best;
    }

    const onPointerDown = (ev: PointerEvent) => {
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        pinchDist = distTarget;
        return;
      }
      dragging = true;
      dragMoved = false;
      lastX = ev.clientX;
      lastY = ev.clientY;
      velX = 0;
      velY = 0;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchStart > 4 && d > 4) {
          distTarget = THREE.MathUtils.clamp(pinchDist * (pinchStart / d), DIST_MIN, DIST_MAX);
        }
        dragMoved = true;
        return;
      }

      if (dragging) {
        const dx = ev.clientX - lastX;
        const dy = ev.clientY - lastY;
        lastX = ev.clientX;
        lastY = ev.clientY;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragMoved = true;
        flying = false;
        velX = dx * 0.005;
        velY = dy * 0.003;
        spin += velX;
        pitch = THREE.MathUtils.clamp(pitch + velY, -1.05, 1.05);
        idle = 0;
        return;
      }

      const code = pick(ev);
      if (code !== hovered) {
        hovered = code;
        renderer.domElement.style.cursor = code ? "pointer" : "grab";
      }
    };

    const onPointerUp = (ev: PointerEvent) => {
      pointers.delete(ev.pointerId);
      const wasDrag = dragMoved;
      dragging = false;
      dragMoved = false;
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        /* pointeur déjà relâché */
      }
      if (wasDrag) return;
      const code = pick(ev);
      if (code) {
        worldView = false;
        stateRef.current.onSelect?.(code);
        // Réponse immédiate, sans attendre l'aller-retour de l'état React.
        flyTowards(code, stateRef.current.focus);
        lastSelected = code;
      }
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const factor = Math.exp(ev.deltaY * 0.0016);
      distTarget = THREE.MathUtils.clamp(distTarget * factor, DIST_MIN, DIST_MAX);
      idle = 0;
    };

    const onPointerLeave = () => {
      dragging = false;
      pointers.clear();
      hovered = null;
      renderer.domElement.style.cursor = "grab";
    };

    const onDouble = () => {
      worldView = true;
      flyTowards(null, false);
    };

    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("dblclick", onDouble);

    apiRef.current = {
      zoom: (factor: number) => {
        distTarget = THREE.MathUtils.clamp(distTarget * factor, DIST_MIN, DIST_MAX);
      },
      world: onDouble,
    };

    // Vue d'ouverture : cadrée sur l'hémisphère le plus habité plutôt que sur
    // le vide du Pacifique. Si un continent est déjà choisi, on y est déjà.
    spin = aimAt(latLonToVec3(6, 24, 1), 0).spin;
    if (lastSelected) flyTowards(lastSelected, lastFocus);

    /* ---------------- boucle ---------------- */

    const scaleTmp = new THREE.Vector3();
    let raf = 0;
    let prev = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const { selected: sel, focus: foc } = stateRef.current;

      if (sel !== lastSelected || foc !== lastFocus) {
        lastSelected = sel;
        lastFocus = foc;
        worldView = false;
        flyTowards(sel, foc);
      }

      if (flying) {
        const t = clamp01((now - flyStart) / FLY_MS);
        const e = easeInOut(t);
        spin = flyFrom.spin + (flyTo.spin - flyFrom.spin) * e;
        pitch = flyFrom.pitch + (flyTo.pitch - flyFrom.pitch) * e;
        if (t >= 1) flying = false;
      } else if (!dragging) {
        // Inertie puis reprise de la rotation lente quand rien n'est choisi.
        if (Math.abs(velX) > 0.00005 || Math.abs(velY) > 0.00005) {
          spin += velX;
          pitch = THREE.MathUtils.clamp(pitch + velY, -1.05, 1.05);
          velX *= 0.93;
          velY *= 0.93;
          idle = 0;
        } else {
          idle += dt;
          if (!reduced && (!sel || worldView) && idle > 1.2) {
            spin += 0.012 * dt * Math.min(1, (idle - 1.2) / 1.2);
          }
        }
      }

      root.rotation.x = pitch;
      spinner.rotation.y = spin;
      clouds.rotation.y = spin * 1.9 + (reduced ? 0 : now * 0.000012);

      dist += (distTarget - dist) * Math.min(1, dt * 3.6);
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      // Le halo doré s'ouvre quand on s'éloigne, discret en approche.
      const glowMat = glow.material as THREE.ShaderMaterial;
      glowMat.uniforms.uIntensity.value = 0.14 + clamp01((dist - DIST_FOCUS) / 6) * 0.22;

      const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);
      for (const m of markers) {
        const isSel = m.code === sel;
        const isHover = m.code === hovered;
        const s = isSel ? 1.55 : isHover ? 1.3 : 1;
        scaleTmp.set(s, s, s);
        m.pin.scale.lerp(scaleTmp, 0.15);
        const ringScale = 1 + (isSel ? 0.35 : 0.14) * pulse;
        m.ring.scale.setScalar(ringScale);
        m.ringMat.opacity = m.free
          ? (isSel ? 0.55 : 0.34) + pulse * (isSel ? 0.4 : 0.22)
          : 0.22 + pulse * 0.06;
      }

      for (const [code, mesh] of landByCode) {
        const lift = code === sel ? 1.012 : 1;
        scaleTmp.set(lift, lift, lift);
        mesh.scale.lerp(scaleTmp, 0.12);
        const mat = landMat.get(code);
        if (mat) {
          const want = code === sel ? 0.075 : code === hovered ? 0.04 : 0;
          mat.emissive.setScalar(mat.emissive.r + (want - mat.emissive.r) * 0.15);
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || 480;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(buildRaf);
      ro.disconnect();
      apiRef.current = null;
      const el = renderer.domElement;
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("pointerleave", onPointerLeave);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDouble);

      cloudGeos.forEach((g) => g.dispose());
      disposeThreeScene(scene);
      disposeRenderer(renderer, host);
    };
  }, [continents, height]);

  return (
    <div className="globe-host globe-v2" style={{ height }}>
      <div className="globe-canvas" ref={hostRef} />
      {onSelect && (
        <div className="globe-hud">
          <button
            type="button"
            className="globe-btn"
            title="Zoomer"
            aria-label="Zoomer"
            onClick={() => apiRef.current?.zoom(0.8)}
          >
            +
          </button>
          <button
            type="button"
            className="globe-btn"
            title="Dézoomer"
            aria-label="Dézoomer"
            onClick={() => apiRef.current?.zoom(1.25)}
          >
            −
          </button>
          <button
            type="button"
            className="globe-btn wide"
            title="Revenir à la vue monde"
            onClick={() => apiRef.current?.world()}
          >
            Vue monde
          </button>
        </div>
      )}
    </div>
  );
}
