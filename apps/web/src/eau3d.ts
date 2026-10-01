import * as THREE from "three";
import { cleCase, styleCoin, type Coin } from "@farmsim/shared";

/**
 * L'eau du domaine : des lacs qu'on creuse et qu'on façonne.
 *
 * ## La forme
 *
 * Chaque case d'eau sait exactement quelle part d'elle-même est de l'eau :
 *
 * - une rive (un côté sans eau voisine) recule de `RIVE`, laissant une
 *   berge de pré entre l'eau et la case d'à côté ;
 * - un coin **saillant** prend le style que le joueur lui a donné — rond,
 *   d'équerre ou en biseau (`ParcelCell.forme`) ;
 * - un coin **rentrant** (deux côtés d'eau, la diagonale à sec) s'adoucit
 *   d'un congé, comme une rive creusée à la pelle.
 *
 * Deux cases d'eau voisines s'étendent jusqu'à leur bord commun : l'union est
 * donc sans couture, sans avoir à la calculer.
 *
 * ## La surface
 *
 * On échantillonne cette appartenance sur une grille fine (`FINESSE` points
 * par case), et on en tire le contour par « marching squares » — mais chaque
 * point de contour est **affiné par dichotomie** sur la vraie forme : les arcs
 * sont ronds, pas en escalier. De la même grille sortent la nappe, la berge
 * (la terre entre l'eau et la case voisine) et le talus qui descend jusqu'au
 * fond du bassin, ainsi qu'une profondeur par sommet qui fonce l'eau au
 * large et blanchit l'écume au bord.
 *
 * Repère : x vers l'est, y vers le sud, en **cases** (la case (x, y) couvre
 * `[x−½, x+½] × [y−½, y+½]`).
 */

/** Largeur de la berge le long d'une rive, en case. */
export const RIVE = 0.18;
/** Rayon d'un coin arrondi (plafonné par la place disponible). */
export const RAYON_COIN = 0.42;
/** Longueur du pan d'un coin en biseau. */
export const BISEAU = 0.4;
/** Points d'échantillonnage par case. */
export const FINESSE = 8;

export type Eaux = ReadonlyMap<string, number>;

type FormeCase = {
  /** Bords de l'eau dans la case, en coordonnées locales (−½ à ½). */
  w: number;
  e: number;
  n: number;
  s: number;
  /** Par coin : 0 rond, 1 d'équerre, 2 biseau, ou −1 si le coin n'est pas saillant. */
  saillant: [number, number, number, number];
  rayon: [number, number, number, number];
  /** Coins rentrants (deux côtés d'eau, diagonale à sec). */
  rentrant: [boolean, boolean, boolean, boolean];
};

const DIRS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** La forme d'une case d'eau, d'après ses voisines. */
export function formeCase(eaux: Eaux, x: number, y: number, formeForcee?: number): FormeCase {
  const a = (dx: number, dy: number) => eaux.has(cleCase(x + dx, y + dy));
  const nN = a(0, -1);
  const nS = a(0, 1);
  const nW = a(-1, 0);
  const nE = a(1, 0);
  const forme = formeForcee ?? eaux.get(cleCase(x, y)) ?? 0;
  const f: FormeCase = {
    w: nW ? -0.5 : -0.5 + RIVE,
    e: nE ? 0.5 : 0.5 - RIVE,
    n: nN ? -0.5 : -0.5 + RIVE,
    s: nS ? 0.5 : 0.5 - RIVE,
    saillant: [-1, -1, -1, -1],
    rayon: [0, 0, 0, 0],
    rentrant: [false, false, false, false],
  };
  const lateral = [
    [nN, nW],
    [nN, nE],
    [nS, nE],
    [nS, nW],
  ] as const;
  for (let c = 0; c < 4; c++) {
    const [v, h] = lateral[c]!;
    const [dx, dy] = DIRS[c]!;
    if (!v && !h) f.saillant[c] = styleCoin(forme, c as Coin);
    else if (v && h && !a(dx, dy)) f.rentrant[c] = true;
  }
  // Le rayon d'un coin rond ne dépasse pas la place : deux coins ronds sur
  // un même côté se partagent sa longueur (une case seule devient un disque).
  const larg = f.e - f.w;
  const haut = f.s - f.n;
  const rond = (c: number) => f.saillant[c] === 0;
  for (let c = 0; c < 4; c++) {
    if (!rond(c)) continue;
    const voisinH = c === 0 ? 1 : c === 1 ? 0 : c === 2 ? 3 : 2;
    const voisinV = c === 0 ? 3 : c === 1 ? 2 : c === 2 ? 1 : 0;
    const rx = rond(voisinH) ? larg / 2 : larg;
    const ry = rond(voisinV) ? haut / 2 : haut;
    f.rayon[c] = Math.min(RAYON_COIN, rx, ry);
  }
  return f;
}

/** Ce point local (u, v) de la case est-il de l'eau ? */
export function dansForme(f: FormeCase, u: number, v: number): boolean {
  const eps = 1e-9;
  if (u < f.w - eps || u > f.e + eps || v < f.n - eps || v > f.s + eps) return false;
  for (let c = 0; c < 4; c++) {
    const [dx, dy] = DIRS[c]!;
    const cu = dx < 0 ? f.w : f.e;
    const cv = dy < 0 ? f.n : f.s;
    const du = (u - cu) * -dx; // ≥ 0 à l'intérieur
    const dv = (v - cv) * -dy;
    const st = f.saillant[c]!;
    if (st === 0) {
      const r = f.rayon[c]!;
      if (du < r && dv < r) {
        const qu = r - du;
        const qv = r - dv;
        if (qu * qu + qv * qv > r * r) return false;
      }
    } else if (st === 2) {
      if (du + dv < BISEAU) return false;
    }
    if (f.rentrant[c]) {
      // L'encoche : la berge de la case en diagonale, qui entre d'un coin.
      const pu = dx * (0.5 - RIVE); // coin de l'encoche, côté intérieur
      const pv = dy * (0.5 - RIVE);
      const eu = (u - pu) * dx; // > 0 dans l'encoche
      const ev = (v - pv) * dy;
      if (eu > 0 && ev > 0) {
        // Un congé rend à l'eau le bout de l'encoche.
        const r = RIVE;
        if (eu < r && ev < r) {
          const qu = r - eu;
          const qv = r - ev;
          if (qu * qu + qv * qv > r * r) return true;
        }
        return false;
      }
    }
  }
  return true;
}

/** Appartenance en coordonnées de case globales. */
function mouille(eaux: Eaux, formes: Map<string, FormeCase>, X: number, Y: number): boolean {
  const x = Math.round(X);
  const y = Math.round(Y);
  const k = cleCase(x, y);
  if (!eaux.has(k)) return false;
  let f = formes.get(k);
  if (!f) {
    f = formeCase(eaux, x, y);
    formes.set(k, f);
  }
  return dansForme(f, X - x, Y - y);
}

export type MaillageEau = {
  /** La nappe : positions (x, 0, z en cases), profondeur, case d'origine. */
  nappe: { pos: number[]; prof: number[]; cle: string[] };
  /** La berge : la terre au niveau du pré, dans les cases d'eau. */
  berge: number[];
  /** Le contour : des segments, pour le talus et les roseaux. */
  contour: number[];
  /** Des points d'eau profonde (x, y, profondeur), pour les nénuphars et les canards. */
  large: { x: number; y: number; p: number }[];
};

/**
 * La géométrie de toute l'eau du domaine.
 *
 * `restreindre` limite le calcul à quelques cases — l'aperçu d'un coin.
 */
export function maillerEau(
  eaux: Eaux,
  opts: {
    restreindre?: readonly [number, number][];
    formeForcee?: { x: number; y: number; forme: number };
    /**
     * Le relief : ne mailler que ces cases, les autres eaux ne servant qu'à
     * dire où la nappe continue — de l'autre côté d'une cascade, l'eau d'un
     * autre niveau prolonge la forme sans être dessinée ici.
     */
    sortie?: ReadonlySet<string>;
  } = {},
): MaillageEau {
  const out: MaillageEau = { nappe: { pos: [], prof: [], cle: [] }, berge: [], contour: [], large: [] };
  if (!eaux.size) return out;
  const formes = new Map<string, FormeCase>();
  if (opts.formeForcee) {
    const { x, y, forme } = opts.formeForcee;
    formes.set(cleCase(x, y), formeCase(eaux, x, y, forme));
  }
  const cases =
    opts.restreindre ?? [...(opts.sortie ?? eaux.keys())].map((k) => k.split(",").map(Number) as [number, number]);
  if (!cases.length) return out;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of cases) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const F = FINESSE;
  const nx = (x1 - x0 + 1) * F + 1;
  const ny = (y1 - y0 + 1) * F + 1;
  const gx = (i: number) => x0 - 0.5 + i / F;
  const gy = (j: number) => y0 - 0.5 + j / F;
  // Un point sur le bord de deux cases appartient à celle de droite / du bas
  // (arrondi) : les deux formes y concordent de toute façon.
  const dedans = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) dedans[j * nx + i] = mouille(eaux, formes, gx(i), gy(j)) ? 1 : 0;

  // La profondeur : distance au sec, en case (chanfrein 3-4 à deux passes).
  const INF = 1e9;
  const dist = new Float32Array(nx * ny);
  for (let k = 0; k < dist.length; k++) dist[k] = dedans[k] ? INF : 0;
  const pas = (a: number, b: number, c: number) => {
    if (b >= 0 && b < dist.length && dist[b]! + c < dist[a]!) dist[a] = dist[b]! + c;
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!dist[k]) continue;
      if (i > 0) pas(k, k - 1, 3);
      if (j > 0) {
        pas(k, k - nx, 3);
        if (i > 0) pas(k, k - nx - 1, 4);
        if (i < nx - 1) pas(k, k - nx + 1, 4);
      }
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) dist[k] = Math.min(dist[k]!, 3);
    }
  for (let j = ny - 1; j >= 0; j--)
    for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i;
      if (!dist[k]) continue;
      if (i < nx - 1) pas(k, k + 1, 3);
      if (j < ny - 1) {
        pas(k, k + nx, 3);
        if (i < nx - 1) pas(k, k + nx + 1, 4);
        if (i > 0) pas(k, k + nx - 1, 4);
      }
    }
  const prof = (i: number, j: number) => Math.min(2, dist[j * nx + i]! / 3 / F);

  /** Le point du bord entre deux échantillons, affiné sur la vraie forme. */
  const bord = (ax: number, ay: number, bx: number, by: number, aIn: boolean): [number, number] => {
    let lo = 0;
    let hi = 1;
    for (let it = 0; it < 7; it++) {
      const m = (lo + hi) / 2;
      const inM = mouille(eaux, formes, ax + (bx - ax) * m, ay + (by - ay) * m);
      if (inM === aIn) lo = m;
      else hi = m;
    }
    const m = (lo + hi) / 2;
    return [ax + (bx - ax) * m, ay + (by - ay) * m];
  };

  const restreint = opts.restreindre ? new Set(opts.restreindre.map(([x, y]) => cleCase(x, y))) : null;
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const cx = gx(i + 0.5);
      const cy = gy(j + 0.5);
      const cle = cleCase(Math.round(cx), Math.round(cy));
      if (!eaux.has(cle)) continue;
      if (restreint && !restreint.has(cle)) continue;
      if (opts.sortie && !opts.sortie.has(cle)) continue;
      const coins: [number, number, number, number][] = [
        [gx(i), gy(j), i, j],
        [gx(i + 1), gy(j), i + 1, j],
        [gx(i + 1), gy(j + 1), i + 1, j + 1],
        [gx(i), gy(j + 1), i, j + 1],
      ];
      const ins = coins.map(([, , a, b]) => dedans[b * nx + a] === 1);
      const nIn = ins.filter(Boolean).length;
      // Un point d'eau profonde par carré entièrement mouillé, au centre.
      if (nIn === 4 && !restreint) {
        const p = (prof(i, j) + prof(i + 1, j + 1)) / 2;
        if (p > 0.22) out.large.push({ x: cx, y: cy, p });
      }
      // Les polygones : dedans et dehors, en suivant le carré.
      type Pt = [number, number, number];
      const polys: { dedans: Pt[][]; dehors: Pt[][] } = { dedans: [], dehors: [] };
      const traversees: Pt[] = [];
      const suivre = (garde: boolean): Pt[] => {
        const p: Pt[] = [];
        for (let c = 0; c < 4; c++) {
          const a = coins[c]!;
          const b = coins[(c + 1) % 4]!;
          if (ins[c] === garde) p.push([a[0], a[1], garde ? prof(a[2], a[3]) : 0]);
          if (ins[c] !== ins[(c + 1) % 4]) {
            const q = bord(a[0], a[1], b[0], b[1], ins[c]!);
            p.push([q[0], q[1], 0]);
          }
        }
        return p;
      };
      const selle = nIn === 2 && ins[0] === ins[2];
      if (selle) {
        const centreIn = mouille(eaux, formes, cx, cy);
        // Selle : le côté qui tient le centre forme un hexagone, l'autre deux
        // triangles.
        const hexa = suivre(centreIn);
        const tri = (c: number): Pt[] => {
          const a = coins[c]!;
          const av = coins[(c + 3) % 4]!;
          const ap = coins[(c + 1) % 4]!;
          const q1 = bord(av[0], av[1], a[0], a[1], ins[(c + 3) % 4]!);
          const q2 = bord(a[0], a[1], ap[0], ap[1], ins[c]!);
          return [[q1[0], q1[1], 0], [a[0], a[1], ins[c] ? prof(a[2], a[3]) : 0], [q2[0], q2[1], 0]];
        };
        const autres = [0, 1, 2, 3].filter((c) => ins[c] !== centreIn).map(tri);
        if (centreIn) {
          polys.dedans.push(hexa);
          polys.dehors.push(...autres);
        } else {
          polys.dehors.push(hexa);
          polys.dedans.push(...autres);
        }
        for (const t of autres) traversees.push(t[0]!, t[2]!);
      } else {
        if (nIn > 0) polys.dedans.push(suivre(true));
        if (nIn < 4) polys.dehors.push(suivre(false));
        if (nIn > 0 && nIn < 4) {
          for (let c = 0; c < 4; c++) {
            if (ins[c] === ins[(c + 1) % 4]) continue;
            const a = coins[c]!;
            const b = coins[(c + 1) % 4]!;
            const q = bord(a[0], a[1], b[0], b[1], ins[c]!);
            traversees.push([q[0], q[1], 0]);
          }
        }
      }
      for (const p of polys.dedans) {
        for (let t = 1; t + 1 < p.length; t++) {
          for (const v of [p[0]!, p[t]!, p[t + 1]!]) {
            out.nappe.pos.push(v[0], 0, v[1]);
            out.nappe.prof.push(v[2]);
            out.nappe.cle.push(cle);
          }
        }
      }
      for (const p of polys.dehors) {
        for (let t = 1; t + 1 < p.length; t++) {
          for (const v of [p[0]!, p[t]!, p[t + 1]!]) out.berge.push(v[0], 0, v[1]);
        }
      }
      for (let t = 0; t + 1 < traversees.length; t += 2) {
        const a = traversees[t]!;
        const b = traversees[t + 1]!;
        out.contour.push(a[0], a[1], b[0], b[1]);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Le matériau de l'eau                                                 */
/* ------------------------------------------------------------------ */

/**
 * Une eau qui vit : claire au bord, sombre au large, une écume qui respire
 * contre la berge, des reflets qui glissent. Et elle **monte** : chaque case
 * fraîchement creusée se remplit sous les yeux (`aNaissance`).
 */
export function materiauEau(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTemps: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aProf;
      attribute float aNaissance;
      attribute vec2 aFlux;
      uniform float uTemps;
      varying float vProf;
      varying float vAge;
      varying vec3 vMonde;
      varying vec2 vFlux;
      void main() {
        vFlux = aFlux;
        vec3 p = position;
        float age = uTemps - aNaissance;
        p.y -= (1.0 - smoothstep(0.15, 0.95, age)) * 0.14;
        p.y += sin(uTemps * 1.7 + position.x * 3.1 + position.z * 2.3) * 0.004;
        vAge = age;
        vProf = aProf;
        vec4 m = modelMatrix * vec4(p, 1.0);
        vMonde = m.xyz;
        gl_Position = projectionMatrix * viewMatrix * m;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTemps;
      varying float vProf;
      varying float vAge;
      varying vec3 vMonde;
      varying vec2 vFlux;
      void main() {
        vec3 clair = vec3(0.45, 0.71, 0.66);
        vec3 fonce = vec3(0.09, 0.30, 0.42);
        float d = smoothstep(0.0, 0.7, vProf);
        vec3 c = mix(clair, fonce, d);
        // Le ciel qui s'y mire, en bandes lentes.
        float ciel = 0.5 + 0.5 * sin(vMonde.x * 0.9 - vMonde.z * 0.6 + uTemps * 0.25);
        c = mix(c, vec3(0.62, 0.78, 0.86), 0.12 * ciel);
        // Les reflets du soleil : deux houles croisées.
        float h = sin(vMonde.x * 7.3 + uTemps * 1.4) * sin(vMonde.z * 6.1 - uTemps * 1.1)
                + 0.6 * sin((vMonde.x + vMonde.z) * 12.0 + uTemps * 2.3);
        c += smoothstep(1.2, 1.55, h) * 0.32 * (0.4 + d);
        // L'eau qui coule : des stries qui filent vers la cascade.
        float fl = length(vFlux);
        if (fl > 0.01) {
          vec2 dir = vFlux / fl;
          float le = dot(vMonde.xz, dir);
          float tr = dot(vMonde.xz, vec2(-dir.y, dir.x));
          float stries = smoothstep(0.55, 1.0, sin(le * 7.0 - uTemps * 4.2 + sin(tr * 9.0) * 1.6));
          stries *= 0.55 + 0.45 * sin(tr * 21.0 + le * 1.3);
          c = mix(c, vec3(0.86, 0.94, 0.95), stries * 0.28 * min(fl, 1.0));
        }
        // L'écume contre la berge.
        float bord = 1.0 - smoothstep(0.0, 0.07, vProf);
        float respire = 0.65 + 0.35 * sin(uTemps * 2.1 + vMonde.x * 17.0 + vMonde.z * 13.0);
        c = mix(c, vec3(0.9, 0.95, 0.93), bord * respire * 0.75);
        float a = mix(0.86, 0.97, d) * smoothstep(0.0, 0.35, vAge);
        gl_FragColor = vec4(c, a);
      }
    `,
  });
}

/**
 * Une cascade : un rideau d'eau qui file vers le bas, blanc d'écume.
 *
 * `aChute` va de 0 en haut à 1 en bas ; le rideau s'éclaircit en tombant.
 */
export function materiauCascade(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTemps: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aChute;
      attribute float aTravers;
      varying float vChute;
      varying float vTravers;
      void main() {
        vChute = aChute;
        vTravers = aTravers;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTemps;
      varying float vChute;
      varying float vTravers;
      void main() {
        // Des filets verticaux, et des paquets d'eau qui les descendent.
        float fil = 0.5 + 0.5 * sin(vTravers * 37.0 + sin(vTravers * 5.0) * 2.0);
        float coule = sin(vChute * 9.0 - uTemps * 8.0 + vTravers * 3.0);
        vec3 bleu = vec3(0.42, 0.68, 0.72);
        vec3 blanc = vec3(0.93, 0.97, 0.97);
        float mousse = smoothstep(0.35, 1.0, fil) * 0.35 + smoothstep(0.4, 1.0, coule) * 0.35 + smoothstep(0.55, 1.0, vChute) * 0.7;
        vec3 c = mix(bleu, blanc, clamp(mousse, 0.0, 1.0));
        float bords = smoothstep(0.0, 0.12, vTravers) * smoothstep(1.0, 0.88, vTravers);
        // La lèvre, sur l'eau d'en haut, naît de rien et blanchit en approchant du bord.
        float levre = smoothstep(-0.3, -0.05, vChute);
        c = mix(c, blanc, (1.0 - step(0.0, vChute)) * levre * 0.5);
        gl_FragColor = vec4(c, (0.78 + 0.18 * coule) * bords * levre);
      }
    `,
  });
}
