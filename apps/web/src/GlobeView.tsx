import { useEffect, useRef } from "react";
import * as THREE from "three";
import { disposeRenderer, disposeThreeScene, markShared } from "./three-cleanup";
import { initialQuality, makeFrameGovernor, qualityForContext, type RenderQuality } from "./render-quality";

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
/**
 * Cadrage du globe selon la forme de l'écran.
 *
 * La caméra a une ouverture **verticale** fixe : sur un écran plus haut que
 * large — c'est-à-dire tout téléphone tenu droit — l'ouverture horizontale
 * devient bien plus étroite, et la sphère déborde sur les côtés. Le globe
 * paraît alors zoomé de force, et il faut dézoomer à la main pour le voir en
 * entier. On recule donc la caméra du même rapport : le globe tient dans
 * l'écran quelle que soit sa forme, sans rien changer au cadrage en paysage.
 */
function fitDistance(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return Math.max(1, 1 / aspect);
}

/** Ouverture verticale de la caméra, en radians. */
const FOV = (38 * Math.PI) / 180;
/**
 * Distance à laquelle la sphère remplit exactement la hauteur de l'image.
 *
 * C'est le plancher du zoom : plus près, la planète déborde du cadre et la
 * carte — deux mille texels pour un tour complet — se met à baver. Toutes les
 * distances de travail se lisent par rapport à ce repère.
 */
const DIST_FIT = R / Math.sin(FOV / 2);

const DIST_WORLD = DIST_FIT * 1.24;
/** Continent choisi : on s'approche, mais le limbe reste visible. */
const DIST_FOCUS = DIST_FIT * 0.92;
/** Continent survolé, sans engagement : à peine plus près que la vue monde. */
const DIST_NEAR = DIST_FIT * 1.08;
const DIST_MIN = DIST_FIT * 0.82;
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

/** Surfaces peintes du globe : couleur, relief, brillance, et carte d'index. */
type PlanetSkin = {
  color: HTMLCanvasElement;
  bump: HTMLCanvasElement;
  rough: HTMLCanvasElement;
  /** Continent sous chaque texel, 0 = océan. Sert au survol et au clic. */
  owner: Uint8Array;
  width: number;
  height: number;
};

type GeometryCache = {
  key: string;
  planet: THREE.BufferGeometry | null;
  skin: PlanetSkin | null;
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
    geometryCache?.planet?.dispose();
    geometryCache = { key, planet: null, skin: null };
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
/* Peinture de la planète                                              */
/* ------------------------------------------------------------------ */

/**
 * Résolution des textures équirectangulaires.
 *
 * C'est le cœur du rendu : la géométrie n'est plus qu'une sphère lisse, et
 * tout le détail — côtes, reliefs, bancs de sable, calottes — vient de ces
 * images. Un maillage facetté trahit toujours ses polygones en gros plan ;
 * une texture, jamais.
 */
const TEX_W = 2048;
const TEX_H = 1024;

/**
 * Résolution de l'aperçu. Peindre la pleine définition demande plusieurs
 * secondes ; une planète grossière mais complète coûte quelques dizaines de
 * millisecondes. On affiche donc l'aperçu tout de suite et on lui substitue
 * la version fine dès qu'elle est prête — le joueur ne voit jamais de bille
 * bleue vide.
 */
const PREVIEW_W = 256;
const PREVIEW_H = 128;

/** Budget de calcul par image, en ms : au-delà, on rend la main au navigateur. */
const PAINT_BUDGET_MS = 10;

/** Direction unitaire correspondant à un texel, dans le repère de SphereGeometry. */
function texelDir(u: number, v: number, out: THREE.Vector3): THREE.Vector3 {
  const az = u * Math.PI * 2;
  const pol = v * Math.PI;
  const s = Math.sin(pol);
  return out.set(-Math.cos(az) * s, Math.cos(pol), Math.sin(az) * s);
}

/** Mélange linéaire de deux couleurs, écrit directement dans un tampon RVBA. */
function writeRgb(
  data: Uint8ClampedArray,
  i: number,
  c: THREE.Color,
  shade = 1,
): void {
  data[i] = c.r * 255 * shade;
  data[i + 1] = c.g * 255 * shade;
  data[i + 2] = c.b * 255 * shade;
  data[i + 3] = 255;
}

const LOWLAND = new THREE.Color(0x6ea653);
const HIGHLAND = new THREE.Color(0x8a9a52);
const FOREST = new THREE.Color(0x40703c);
const TUNDRA = new THREE.Color(0x9fae9a);

/**
 * Peint les trois cartes de la planète, bande de lignes par bande de lignes.
 *
 * Le travail est découpé pour ne jamais bloquer le fil principal : deux
 * millions de texels avec du bruit fractal représentent près d'une seconde de
 * calcul, ce qui figerait l'interface si on le faisait d'un bloc.
 */
function makePlanetPainter(
  fields: Field[],
  continents: GlobeContinent[],
  texW = TEX_W,
  texH = TEX_H,
): { skin: PlanetSkin; paintBand: () => boolean; paintAll: () => PlanetSkin } {
  const color = document.createElement("canvas");
  const bump = document.createElement("canvas");
  const rough = document.createElement("canvas");
  for (const c of [color, bump, rough]) {
    c.width = texW;
    c.height = texH;
  }
  const ctxColor = color.getContext("2d")!;
  const ctxBump = bump.getContext("2d")!;
  const ctxRough = rough.getContext("2d")!;

  const owner = new Uint8Array(texW * texH);
  const palette = continents.map((c) => ({
    base: new THREE.Color(c.color),
    accent: new THREE.Color(c.accent),
  }));

  let row = 0;

  const dir = new THREE.Vector3();
  const tint = new THREE.Color();

  /** Peint `rows` lignes à partir de `row`. */
  const paintRows = (rows: number): void => {
    const imgColor = ctxColor.createImageData(texW, rows);
    const imgBump = ctxBump.createImageData(texW, rows);
    const imgRough = ctxRough.createImageData(texW, rows);

    for (let y = 0; y < rows; y++) {
      const gy = row + y;
      const v = (gy + 0.5) / texH;
      for (let x = 0; x < texW; x++) {
        const u = (x + 0.5) / texW;
        texelDir(u, v, dir);
        const i = (y * texW + x) * 4;

        // Champ continental dominant sous ce texel.
        let best = -1;
        let bestH = -1;
        for (let f = 0; f < fields.length; f++) {
          const h = fields[f].height(dir);
          if (h > bestH) {
            bestH = h;
            best = f;
          }
        }

        const lat = Math.abs(Math.asin(dir.y) * (180 / Math.PI));
        // Grain fin commun terre et mer : c'est lui qui empêche les aplats.
        const grain = valueNoise3(dir.x * 90, dir.y * 90, dir.z * 90);

        if (bestH <= 0) {
          owner[gy * texW + x] = 0;
          // Profondeur : le fond remonte à l'approche des côtes.
          const shelf = clamp01((bestH + 0.9) / 0.9);
          tint.copy(DEEP).lerp(MID, clamp01((bestH + 1.6) / 1.4));
          tint.lerp(SHALLOW, shelf * shelf * 0.85);
          if (lat > 62) tint.lerp(POLAR, clamp01((lat - 62) / 22) * 0.75);
          else if (lat < 26) tint.lerp(TROPIC, (1 - lat / 26) * 0.35);
          // Houle : de longues ondulations, pas un bruit uniforme.
          const swell = fbm(dir.x * 7 + 3.1, dir.y * 7 + 8.4, dir.z * 7 + 1.9, 2);
          writeRgb(imgColor.data, i, tint, 0.94 + swell * 0.12);

          const wave = 118 + (swell - 0.5) * 26 + (grain - 0.5) * 8;
          writeRgb(imgBump.data, i, tint, 0);
          imgBump.data[i] = imgBump.data[i + 1] = imgBump.data[i + 2] = wave;
          imgBump.data[i + 3] = 255;
          // L'eau est lisse : c'est ce qui lui donne son reflet de soleil.
          const r = 40 + shelf * 40;
          imgRough.data[i] = imgRough.data[i + 1] = imgRough.data[i + 2] = r;
          imgRough.data[i + 3] = 255;
          continue;
        }

        owner[gy * texW + x] = best + 1;
        const field = fields[best];
        const pal = palette[best];
        const m = field.mountain(dir);
        const arid = field.dry(dir);
        const elev = elevationOf(bestH, m);
        const ridge = m > 0.54 ? (m - 0.54) / 0.46 : 0;

        // Biome : la couleur du continent domine, l'altitude et la sécheresse
        // la nuancent, et le littoral s'ourle de sable.
        tint.copy(pal.base).lerp(LOWLAND, 0.25);
        tint.lerp(pal.accent, clamp01(bestH) * 0.34);
        if (arid < 0.42) tint.lerp(FOREST, (0.42 - arid) * 1.5);
        else if (arid > 0.58) tint.lerp(SAND, (arid - 0.58) * 1.3);
        if (ridge > 0) {
          tint.lerp(HIGHLAND, clamp01(ridge * 0.9));
          tint.lerp(ROCK, clamp01((ridge - 0.35) * 1.6));
        }
        if (lat > 58) tint.lerp(TUNDRA, clamp01((lat - 58) / 18) * 0.7);
        const snowLine = 0.62 - clamp01((lat - 30) / 60) * 0.34;
        if (ridge > snowLine || lat > 74) {
          const snow = Math.max(clamp01((ridge - snowLine) * 3), clamp01((lat - 74) / 12));
          tint.lerp(SNOW, snow * 0.92);
        }
        // Trait de côte : une frange de sable puis une falaise sous-jacente.
        const shore = clamp01(bestH / 0.22);
        if (shore < 1) {
          tint.lerp(SAND, (1 - shore) * 0.65);
          tint.lerp(CLIFF, (1 - shore) * 0.18);
        }

        const speckle = 0.93 + grain * 0.14;
        writeRgb(imgColor.data, i, tint, speckle);

        const relief = clamp01(elev / 0.9) * 190 + 40 + (grain - 0.5) * 22;
        imgBump.data[i] = imgBump.data[i + 1] = imgBump.data[i + 2] = relief;
        imgBump.data[i + 3] = 255;

        // La terre ne brille pas : rugosité forte, plus forte encore sur roche.
        const r = 200 + ridge * 40 - shore * 30;
        imgRough.data[i] = imgRough.data[i + 1] = imgRough.data[i + 2] = r;
        imgRough.data[i + 3] = 255;
      }
    }

    ctxColor.putImageData(imgColor, 0, row);
    ctxBump.putImageData(imgBump, 0, row);
    ctxRough.putImageData(imgRough, 0, row);
    row += rows;
  };

  const skin: PlanetSkin = { color, bump, rough, owner, width: texW, height: texH };

  /**
   * Peint autant de lignes que le budget d'image l'autorise. Un nombre de
   * lignes fixe ne convenait pas : une bande peut coûter dix fois plus qu'une
   * autre selon qu'elle traverse un océan vide ou trois continents.
   */
  const paintBand = (): boolean => {
    if (row >= texH) return true;
    const deadline = performance.now() + PAINT_BUDGET_MS;
    do {
      paintRows(Math.min(8, texH - row));
    } while (row < texH && performance.now() < deadline);
    return row >= texH;
  };

  const paintAll = (): PlanetSkin => {
    while (row < texH) paintRows(Math.min(32, texH - row));
    return skin;
  };

  return { skin, paintBand, paintAll };
}

/** Continent sous une direction donnée, d'après la carte d'index peinte. */
function ownerAt(skin: PlanetSkin, dir: THREE.Vector3): number {
  const pol = Math.acos(Math.max(-1, Math.min(1, dir.y)));
  let az = Math.atan2(dir.z, -dir.x);
  if (az < 0) az += Math.PI * 2;
  const x = Math.min(skin.width - 1, Math.floor((az / (Math.PI * 2)) * skin.width));
  const y = Math.min(skin.height - 1, Math.floor((pol / Math.PI) * skin.height));
  return skin.owner[y * skin.width + x];
}

/**
 * Sphère lisse au relief modéré. Le déplacement ne sert qu'à donner du
 * volume à la silhouette : le détail visible vient des textures, ce qui
 * autorise une géométrie sans arête apparente.
 */
function buildPlanetGeometry(fields: Field[]): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(R, 256, 128);
  const pos = geometry.getAttribute("position");
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    let bestH = -1;
    let bestField: Field | null = null;
    for (const f of fields) {
      const h = f.height(dir);
      if (h > bestH) {
        bestH = h;
        bestField = f;
      }
    }
    let radius = R;
    if (bestH > 0 && bestField) {
      radius = R + elevationOf(bestH, bestField.mountain(dir)) * 0.5;
    }
    dir.multiplyScalar(radius);
    pos.setXYZ(i, dir.x, dir.y, dir.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
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
    /** Facteur de recul imposé par la forme de l'écran, mis à jour au redimensionnement. */
    let fit = fitDistance(width / height);
    camera.position.set(0, 0, DIST_WORLD * fit);

    let quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true });
    quality = qualityForContext(renderer.getContext()) ?? quality;
    renderer.setPixelRatio(Math.min(1.75, quality.pixelRatio));
    let lastFrame = 0;
    const applyQuality = (next: RenderQuality) => {
      quality = next;
      renderer.setPixelRatio(Math.min(1.75, next.pixelRatio));
    };
    const governor = makeFrameGovernor(applyQuality);
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

    // Une seule sphère lisse porte toute la planète. Le détail vient des
    // textures, jamais de la géométrie : c'est la seule façon d'éviter que des
    // polygones apparaissent en gros plan.
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.04,
      bumpScale: 0.9,
    });
    const planet = new THREE.Mesh(
      (geometryCache.planet ??= markShared(buildPlanetGeometry(fields))),
      planetMat,
    );
    spinner.add(planet);

    /**
     * Cibles de raycast : **jamais la planète**.
     *
     * Sa sphère fait 65 536 triangles, et Three les teste un à un faute
     * d'arbre de partitionnement — à chaque clic comme à chaque mouvement de
     * souris. C'était l'essentiel des 444 ms mesurées sur la sélection d'un
     * continent. L'intersection analytique avec une sphère, suivie d'une
     * lecture dans la carte d'index, donne le même résultat en temps
     * constant.
     */
    const pickTargets: THREE.Object3D[] = [];

    /**
     * Peinture en deux temps. Deux millions de texels de bruit fractal
     * représentent plusieurs secondes de calcul : on affiche d'abord une
     * planète complète en basse définition, puis on peint la version fine par
     * tranches limitées en temps, sans jamais bloquer une image. Le résultat
     * est mis en cache pour la session.
     */
    let skin = geometryCache.skin;
    let paintRaf = 0;
    const ownedTextures: THREE.Texture[] = [];
    const applySkin = (s: PlanetSkin) => {
      // Les textures précédentes — l'aperçu — n'ont plus lieu d'être.
      ownedTextures.splice(0).forEach((t) => t.dispose());
      const colorTex = new THREE.CanvasTexture(s.color);
      colorTex.colorSpace = THREE.SRGBColorSpace;
      colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const bumpTex = new THREE.CanvasTexture(s.bump);
      const roughTex = new THREE.CanvasTexture(s.rough);
      for (const t of [colorTex, bumpTex, roughTex]) {
        t.wrapS = THREE.RepeatWrapping;
        t.minFilter = THREE.LinearMipmapLinearFilter;
      }
      planetMat.map = colorTex;
      planetMat.bumpMap = bumpTex;
      planetMat.roughnessMap = roughTex;
      planetMat.needsUpdate = true;
      ownedTextures.push(colorTex, bumpTex, roughTex);
    };

    if (skin) {
      applySkin(skin);
    } else {
      // Planète complète tout de suite, en basse définition : quelques dizaines
      // de millisecondes suffisent, et le joueur voit un monde plutôt qu'une
      // bille bleue pendant que la version fine se calcule.
      skin = makePlanetPainter(fields, continents, PREVIEW_W, PREVIEW_H).paintAll();
      applySkin(skin);

      const painter = makePlanetPainter(fields, continents);
      const paintNext = () => {
        if (painter.paintBand()) {
          geometryCache.skin = painter.skin;
          skin = painter.skin;
          applySkin(painter.skin);
          return;
        }
        paintRaf = requestAnimationFrame(paintNext);
      };
      paintRaf = requestAnimationFrame(paintNext);
    }

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

    /**
     * Lueur de survol posée sur la terre elle-même.
     *
     * Tant que chaque continent avait son maillage, il suffisait d'en éclairer
     * le matériau. Avec une surface unique, ce support a disparu et seul le
     * repère réagissait : on survolait un continent sans que rien ne le
     * désigne. Cette calotte lumineuse rend le retour visuel au relief.
     */
    const highlightMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0xffe9a8) },
        uOpacity: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float d = distance(vUv, vec2(0.5));
          float falloff = smoothstep(0.5, 0.06, d);
          gl_FragColor = vec4(uColor, falloff * uOpacity);
        }
      `,
    });
    const highlight = new THREE.Mesh(new THREE.CircleGeometry(0.78, 32), highlightMat);
    highlight.visible = false;
    spinner.add(highlight);

    function placeHighlight(code: string | null): void {
      if (!code) {
        highlight.visible = false;
        return;
      }
      const c = continents.find((x) => x.code === code);
      if (!c) {
        highlight.visible = false;
        return;
      }
      const p = latLonToVec3(c.lat, c.lon, R + 0.09);
      highlight.position.copy(p);
      highlight.lookAt(p.clone().multiplyScalar(2));
      highlight.visible = true;
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
      // Les repères l'emportent : ils sont petits et le joueur les vise.
      const hits = raycaster.intersectObjects(pickTargets, true);
      for (const hit of hits) {
        let o: THREE.Object3D | null = hit.object;
        while (o) {
          const code = o.userData?.continentCode as string | undefined;
          if (code) return code;
          o = o.parent;
        }
      }
      if (!raycaster.ray.intersectSphere(pickBounds, hitPoint)) return null;
      const local = spinner.worldToLocal(hitPoint.clone()).normalize();
      // La carte d'index dit exactement quelle terre est sous le doigt.
      if (skin) {
        const idx = ownerAt(skin, local);
        if (idx > 0) return continents[idx - 1].code;
      }
      // En pleine mer, on tolère le clic « à côté » : le continent dont le
      // champ est le plus proche du bord l'emporte.
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

    // Écouteur passif : `preventDefault` le rendrait bloquant pour le
    // défilement, ce que Chrome signale comme une violation. La page ne défile
    // pas derrière le globe, et le zoom du navigateur reste à Ctrl+molette.
    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) return;
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
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
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
      // Le globe tourne en permanence : sur une machine qui rasterise au
      // processeur, mieux vaut une rotation à trente images qu'un thread
      // principal saturé. Onglet caché, on ne peint pas du tout.
      // La première image passe toujours : sans précédente à comparer, la
      // brider reviendrait à ne jamais rien peindre.
      const tooSoon = Boolean(lastFrame) && now - lastFrame < 1000 / Math.max(1, quality.maxFps) - 1;
      if (document.hidden || (quality.maxFps && tooSoon)) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const frameDelta = lastFrame ? now - lastFrame : 16;
      lastFrame = now;
      governor(frameDelta);
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
      camera.position.set(0, 0, dist * fit);
      camera.lookAt(0, 0, 0);
      // Le halo doré s'ouvre quand on s'éloigne, discret en approche.
      const glowMat = glow.material as THREE.ShaderMaterial;
      glowMat.uniforms.uIntensity.value =
        0.14 + clamp01((dist - DIST_MIN) / (DIST_MAX - DIST_MIN)) * 0.22;

      const pulse = 0.5 + 0.5 * Math.sin(now * 0.0022);

      // La sélection prime sur le survol ; l'opacité glisse pour éviter le
      // clignotement quand la souris passe d'un continent à l'autre.
      const lit = sel ?? hovered;
      if (lit !== highlight.userData.code) {
        highlight.userData.code = lit;
        placeHighlight(lit);
      }
      const wantOpacity = lit ? (lit === sel ? 0.42 : 0.24) + pulse * 0.08 : 0;
      const uOpacity = highlightMat.uniforms.uOpacity;
      uOpacity.value += (wantOpacity - uOpacity.value) * 0.14;

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

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || 480;
      camera.aspect = w / height;
      fit = fitDistance(camera.aspect);
      camera.updateProjectionMatrix();
      renderer.setSize(w, height, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(paintRaf);
      ownedTextures.forEach((t) => t.dispose());
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
