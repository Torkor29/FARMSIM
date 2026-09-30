import * as THREE from "three";
import type { Faune, Habitat } from "@farmsim/shared";

/**
 * La faune qu'on voit : papillons et abeilles sur les fleurs, oiseaux au-dessus
 * des haies et des bois, une buse qui tournoie, libellules et grenouilles aux
 * mares.
 *
 * Tout vient de la population de chaque groupe (`Faune`) et des habitats de
 * la ferme : une réserve naissante n'a que quelques papillons, une réserve
 * mûre bourdonne. Chaque espèce est **un** maillage instancié ; on ne
 * reconstruit rien à chaque image, on repose seulement les matrices.
 */

type Pos = { x: number; y: number };
type Monde = (x: number, y: number) => { px: number; pz: number };

export type Faune3d = {
  maj(opts: {
    parCase: ReadonlyMap<string, readonly Habitat[]>;
    faune: Partial<Faune>;
    posDe: Monde;
    pas: number;
    altitude: (x: number, y: number) => number;
    sol: number;
  }): void;
  animer(t: number): void;
  dispose(): void;
};

const FLEURIES: ReadonlySet<Habitat> = new Set(["PRAIRIE", "FLEURS", "LISIERE"]);
const PERCHOIRS: ReadonlySet<Habitat> = new Set(["HAIE", "ARBRE", "BOIS_JEUNE", "FUTAIE", "VIEUX_BOIS", "LISIERE", "BOSQUET"]);
const EAUX: ReadonlySet<Habitat> = new Set(["MARE", "RIVIERE"]);

function alea(i: number, k: number): number {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Une paire d'ailes en V : deux triangles qui se replient sur le corps. */
function geoAiles(envergure: number, profondeur: number): THREE.BufferGeometry {
  const e = envergure / 2;
  const p = profondeur / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, -p, -e, 0.02, 0, 0, 0, p, 0, 0, -p, 0, 0, p, e, 0.02, 0], 3),
  );
  g.computeVertexNormals();
  return g;
}

export function creerFaune3d(parent: THREE.Group): Faune3d {
  const groupe = new THREE.Group();
  groupe.name = "faune";
  parent.add(groupe);

  const matAiles = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const matCorps = new THREE.MeshLambertMaterial({ flatShading: true });
  const geoPapillon = geoAiles(0.2, 0.12);
  const geoAbeille = new THREE.BoxGeometry(0.04, 0.03, 0.06);
  const geoOiseau = geoAiles(0.44, 0.17);
  const geoCorpsOiseau = new THREE.BoxGeometry(0.075, 0.06, 0.2);
  const geoRapace = geoAiles(0.8, 0.26);
  const geoLibellule = geoAiles(0.14, 0.05);
  const geoGrenouille = new THREE.BoxGeometry(0.07, 0.04, 0.08);

  type Espece = { mesh: THREE.InstancedMesh; n: number };
  const especes: Espece[] = [];
  const dummy = new THREE.Object3D();
  const couleur = new THREE.Color();

  let papillons: { home: THREE.Vector3; phase: number }[] = [];
  let abeilles: { home: THREE.Vector3; phase: number }[] = [];
  let oiseaux: { centre: THREE.Vector3; rayon: number; h: number; phase: number; vitesse: number }[] = [];
  let rapace: { centre: THREE.Vector3; rayon: number; h: number } | null = null;
  let libellules: { home: THREE.Vector3; phase: number }[] = [];
  let grenouilles: { home: THREE.Vector3; phase: number }[] = [];
  let mPapillon: THREE.InstancedMesh | null = null;
  let mAbeille: THREE.InstancedMesh | null = null;
  let mOiseau: THREE.InstancedMesh | null = null;
  let mCorps: THREE.InstancedMesh | null = null;
  let mRapace: THREE.InstancedMesh | null = null;
  let mLibellule: THREE.InstancedMesh | null = null;
  let mGrenouille: THREE.InstancedMesh | null = null;
  let echelle = 1;

  function vider() {
    for (const e of especes) {
      groupe.remove(e.mesh);
      e.mesh.dispose();
    }
    especes.length = 0;
    mPapillon = mAbeille = mOiseau = mCorps = mRapace = mLibellule = mGrenouille = null;
  }

  function instancier(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, couleurs?: (i: number) => number): THREE.InstancedMesh | null {
    if (n <= 0) return null;
    const m = new THREE.InstancedMesh(geo, mat, n);
    m.frustumCulled = false;
    if (couleurs) for (let i = 0; i < n; i++) m.setColorAt(i, couleur.setHex(couleurs(i)));
    groupe.add(m);
    especes.push({ mesh: m, n });
    return m;
  }

  function maj(o: Parameters<Faune3d["maj"]>[0]) {
    vider();
    echelle = o.pas;
    const fleuries: Pos[] = [];
    const perchoirs: Pos[] = [];
    const eaux: Pos[] = [];
    const berges: Pos[] = [];
    for (const [k, hs] of o.parCase) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      if (hs.some((h) => FLEURIES.has(h))) fleuries.push({ x, y });
      if (hs.some((h) => PERCHOIRS.has(h))) perchoirs.push({ x, y });
      if (hs.some((h) => EAUX.has(h))) eaux.push({ x, y });
      if (hs.includes("ROSELIERE")) berges.push({ x, y });
    }
    const monde = (p: Pos, h: number) => {
      const { px, pz } = o.posDe(p.x, p.y);
      return new THREE.Vector3(px, o.sol + o.altitude(p.x, p.y) + h, pz);
    };
    const f = (g: keyof Faune) => Math.max(0, Math.min(100, o.faune[g] ?? 0)) / 100;
    const pris = <T,>(liste: T[], i: number) => liste[Math.floor(alea(i, 3) * liste.length)]!;

    const nP = fleuries.length ? Math.round(f("POLLINISATEURS") * Math.min(30, 4 + fleuries.length * 0.6)) : 0;
    papillons = Array.from({ length: nP }, (_, i) => ({ home: monde(pris(fleuries, i), 0.3), phase: alea(i, 7) * 6.28 }));
    const nA = fleuries.length ? Math.round(f("POLLINISATEURS") * 14) : 0;
    abeilles = Array.from({ length: nA }, (_, i) => ({ home: monde(pris(fleuries, i + 50), 0.18), phase: alea(i, 9) * 6.28 }));
    const nO = perchoirs.length ? Math.round(f("OISEAUX") * 14) : 0;
    oiseaux = Array.from({ length: nO }, (_, i) => {
      // Par petites bandes : trois ou quatre oiseaux autour du même perchoir.
      const bande = Math.floor(i / 3);
      return {
        centre: monde(pris(perchoirs, bande + 100), 1.3 + alea(bande, 4) * 0.8),
        rayon: (1.2 + alea(bande, 5) * 2.2) * o.pas,
        h: alea(i, 6) * 0.3,
        phase: alea(bande, 8) * 6.28 + (i % 3) * 0.25,
        vitesse: 0.5 + alea(bande, 11) * 0.4,
      };
    });
    rapace =
      f("RAPACES") >= 0.25 && fleuries.length
        ? { centre: monde(pris(fleuries, 200), 3.6), rayon: 3.5 * o.pas, h: 0 }
        : null;
    const nL = eaux.length ? Math.round(f("AMPHIBIENS") * Math.min(10, 2 + eaux.length)) : 0;
    libellules = Array.from({ length: nL }, (_, i) => ({ home: monde(pris(eaux, i + 300), 0.22), phase: alea(i, 13) * 6.28 }));
    const nG = berges.length ? Math.round(f("AMPHIBIENS") * Math.min(8, berges.length)) : 0;
    grenouilles = Array.from({ length: nG }, (_, i) => ({ home: monde(pris(berges, i + 400), 0.0), phase: alea(i, 17) * 6.28 }));

    const teintesPapillon = [0xe8872c, 0xf2d24a, 0x6f8fe0, 0xf4f1ea, 0xd85a8a];
    mPapillon = instancier(geoPapillon, matAiles, papillons.length, (i) => teintesPapillon[i % teintesPapillon.length]!);
    mAbeille = instancier(geoAbeille, matCorps, abeilles.length, (i) => (i % 2 ? 0xe0b030 : 0x3a2c14));
    mOiseau = instancier(geoOiseau, matAiles, oiseaux.length, (i) => (i % 4 === 0 ? 0x6a4a32 : 0x3d3a36));
    mCorps = instancier(geoCorpsOiseau, matCorps, oiseaux.length, (i) => (i % 4 === 0 ? 0xb8683a : 0x4a4640));
    mRapace = instancier(geoRapace, matAiles, rapace ? 1 : 0, () => 0x5a4030);
    mLibellule = instancier(geoLibellule, matAiles, libellules.length, (i) => (i % 2 ? 0x5ab0e0 : 0x3a78c8));
    mGrenouille = instancier(geoGrenouille, matCorps, grenouilles.length, (i) => (i % 3 ? 0x5f9a3a : 0x7a8a3a));
  }

  function poser(m: THREE.InstancedMesh | null, i: number, p: THREE.Vector3, cap: number, sx: number, s: number) {
    if (!m) return;
    dummy.position.copy(p);
    dummy.rotation.set(0, cap, 0);
    dummy.scale.set(sx * s, s, s);
    dummy.updateMatrix();
    m.setMatrixAt(i, dummy.matrix);
  }

  const v = new THREE.Vector3();
  function animer(t: number) {
    const s = echelle;
    papillons.forEach((b, i) => {
      const a = t * 0.5 + b.phase;
      v.set(b.home.x + Math.sin(a) * 0.35 * s + Math.sin(a * 2.3) * 0.1 * s, b.home.y + Math.sin(a * 1.7) * 0.08, b.home.z + Math.cos(a * 0.8) * 0.35 * s);
      poser(mPapillon, i, v, a, 0.25 + 0.75 * Math.abs(Math.sin(t * 16 + b.phase)), s);
    });
    abeilles.forEach((b, i) => {
      const a = t * 1.6 + b.phase;
      v.set(b.home.x + Math.sin(a) * 0.25 * s, b.home.y + Math.sin(a * 3.1) * 0.03, b.home.z + Math.sin(a * 1.3) * 0.25 * s);
      poser(mAbeille, i, v, a, 1, s);
    });
    oiseaux.forEach((o, i) => {
      const a = t * o.vitesse * 0.6 + o.phase;
      v.set(o.centre.x + Math.cos(a) * o.rayon, o.centre.y + o.h + Math.sin(a * 2) * 0.12, o.centre.z + Math.sin(a) * o.rayon);
      const cap = -a;
      const bat = 0.35 + 0.65 * Math.abs(Math.sin(t * 9 + o.phase * 3));
      poser(mOiseau, i, v, cap, bat, s);
      poser(mCorps, i, v, cap, 1, s);
    });
    if (rapace && mRapace) {
      // Il plane : de larges cercles, presque sans battre des ailes.
      const a = t * 0.18;
      v.set(rapace.centre.x + Math.cos(a) * rapace.rayon, rapace.centre.y + Math.sin(t * 0.3) * 0.2, rapace.centre.z + Math.sin(a) * rapace.rayon);
      poser(mRapace, 0, v, -a, 0.9 + 0.1 * Math.sin(t * 2), s);
    }
    libellules.forEach((d, i) => {
      // Des arrêts nets et des départs brusques.
      const seg = Math.floor(t * 0.8 + d.phase);
      const u = (t * 0.8 + d.phase) % 1;
      const k = u < 0.7 ? 0 : (u - 0.7) / 0.3;
      const ax = (alea(seg, i) - 0.5) * 0.7 * s;
      const az = (alea(i, seg) - 0.5) * 0.7 * s;
      const bx = (alea(seg + 1, i) - 0.5) * 0.7 * s;
      const bz = (alea(i, seg + 1) - 0.5) * 0.7 * s;
      v.set(d.home.x + ax + (bx - ax) * k, d.home.y + Math.sin(t * 3 + d.phase) * 0.03, d.home.z + az + (bz - az) * k);
      poser(mLibellule, i, v, Math.atan2(bx - ax, bz - az), 0.6 + 0.4 * Math.abs(Math.sin(t * 40 + d.phase)), s);
    });
    grenouilles.forEach((g, i) => {
      // Un saut de temps en temps.
      const c = (t * 0.35 + g.phase) % 1;
      const saut = c > 0.9 ? Math.sin(((c - 0.9) / 0.1) * Math.PI) * 0.08 : 0;
      v.set(g.home.x, g.home.y + 0.02 + saut, g.home.z);
      poser(mGrenouille, i, v, g.phase, 1, s);
    });
    for (const e of especes) e.mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    maj,
    animer,
    dispose() {
      vider();
      parent.remove(groupe);
      for (const g of [geoPapillon, geoAbeille, geoOiseau, geoCorpsOiseau, geoRapace, geoLibellule, geoGrenouille]) g.dispose();
      matAiles.dispose();
      matCorps.dispose();
    },
  };
}
