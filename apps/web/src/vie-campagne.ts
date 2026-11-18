import * as THREE from "three";
import { COTE_LIEU, LIEUX_UTILES, type PlanCampagne } from "./countryside-plan";

/**
 * Ce qui vit autour de la ferme, sans rien demander au joueur.
 *
 * La campagne était juste : des champs à leur place, un village, deux voitures
 * et de longs silences. Mais rien n'y bougeait de soi-même, et un testeur l'a
 * dit d'un mot — « le jeu manque de vie ». Ce module ajoute ce qu'on voit
 * dehors sans y penser :
 *
 *  - des **vols d'oiseaux** qui traversent le ciel en formation, et des
 *    envolées quand on touche un arbre ou un verger ;
 *  - des **passants** qui font le tour des commerces du village ;
 *  - des **ombres de nuages** qui glissent sur les champs.
 *
 * Tout est instancié : trois appels de dessin, quelques centaines de
 * triangles. La vie ne doit pas coûter la fluidité qu'on vient de regagner.
 */
export type VieCampagne = {
  object: THREE.Group;
  /** `t` en secondes de scène ; `nuit` de 0 (plein jour) à 1. */
  update(t: number, nuit: number): void;
  /** Une envolée d'oiseaux depuis un point du sol (arbre touché, verger…). */
  envol(x: number, z: number, t: number): void;
  dispose(): void;
};

function alea(i: number, k: number): number {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Un oiseau : deux ailes en V. L'échelle en `y` de l'instance les fait battre. */
function geometrieOiseau(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  // prettier-ignore
  g.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0.09,   -0.26, 0.1, -0.02,   0, 0, -0.07,
    0, 0, 0.09,    0, 0, -0.07,         0.26, 0.1, -0.02,
  ], 3));
  g.computeVertexNormals();
  return g;
}

/** La tache d'ombre d'un nuage : un dégradé rond, doux sur les bords. */
function textureOmbre(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.55, "rgba(0,0,0,0.75)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const VOLS = 3;
const PAR_VOL = 5;
const ENVOL = 7;
const N_OISEAUX = VOLS * PAR_VOL + ENVOL;

export function creerVieCampagne(o: {
  plan: PlanCampagne;
  /** Altitude du sol de la campagne. */
  y: number;
  /** Altitude à laquelle poser les ombres : juste au-dessus des cultures. */
  yOmbres: number;
  sobre?: boolean;
}): VieCampagne {
  const object = new THREE.Group();
  object.name = "vie-campagne";
  const { sol } = o.plan;
  const uC = sol.uCentre ?? 0;
  // L'étendue visible autour de la ferme, dans le repère du monde : les vols
  // et les ombres la traversent de part en part.
  const DEMI = 46;
  const cx = uC;
  const cz = sol.vCentre ?? 0;

  /* —— Les oiseaux —— */
  const geoOiseau = geometrieOiseau();
  const matOiseau = new THREE.MeshBasicMaterial({ color: 0x4a5058, side: THREE.DoubleSide });
  const oiseaux = new THREE.InstancedMesh(geoOiseau, matOiseau, N_OISEAUX);
  oiseaux.name = "vie-oiseaux";
  oiseaux.frustumCulled = false;
  oiseaux.castShadow = false;
  object.add(oiseaux);
  /** Les envolées en cours : un point de départ et une heure. */
  let envolee: { x: number; z: number; t0: number } | null = null;

  /* —— Les passants —— */
  const utiles = o.plan.lieux.filter((l) => LIEUX_UTILES.includes(l.genre));
  const parLieu = o.sobre ? 1 : 2;
  const nPassants = utiles.length * parLieu;
  const geoCorps = new THREE.BoxGeometry(0.15, 0.3, 0.11).translate(0, 0.27, 0);
  const geoTete = new THREE.SphereGeometry(0.075, 6, 5).translate(0, 0.5, 0);
  const geoJambes = new THREE.BoxGeometry(0.13, 0.13, 0.09).translate(0, 0.065, 0);
  const matVetement = new THREE.MeshLambertMaterial({ flatShading: true });
  const matPeau = new THREE.MeshLambertMaterial({ color: 0xe8b98f, flatShading: true });
  const matJambes = new THREE.MeshLambertMaterial({ color: 0x3d4654, flatShading: true });
  const corps = new THREE.InstancedMesh(geoCorps, matVetement, Math.max(1, nPassants));
  const tetes = new THREE.InstancedMesh(geoTete, matPeau, Math.max(1, nPassants));
  const jambes = new THREE.InstancedMesh(geoJambes, matJambes, Math.max(1, nPassants));
  const VETEMENTS = [0x3f6fb0, 0xb0483f, 0x4c8a52, 0xc79a2e, 0x7a5ea8, 0xd9d4c8];
  const couleur = new THREE.Color();
  for (const m of [corps, tetes, jambes]) {
    m.count = nPassants;
    m.frustumCulled = false;
    m.name = "vie-passants";
    object.add(m);
  }
  for (let i = 0; i < nPassants; i++) corps.setColorAt(i, couleur.set(VETEMENTS[Math.floor(alea(i, 5) * VETEMENTS.length)]!));
  if (corps.instanceColor) corps.instanceColor.needsUpdate = true;

  /* —— Les ombres de nuages —— */
  const nOmbres = o.sobre ? 2 : 3;
  const texOmbre = textureOmbre();
  const matOmbre = new THREE.MeshBasicMaterial({
    map: texOmbre,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    color: 0x1b2a38,
  });
  const geoOmbre = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const ombres: THREE.Mesh[] = [];
  for (let i = 0; i < nOmbres; i++) {
    const m = new THREE.Mesh(geoOmbre, matOmbre);
    m.name = "vie-ombre-nuage";
    m.scale.set(20 + alea(i, 1) * 12, 1, 12 + alea(i, 2) * 8);
    m.renderOrder = 2;
    object.add(m);
    ombres.push(m);
  }

  const dummy = new THREE.Object3D();
  const cache = new THREE.Matrix4().makeScale(0, 0, 0);

  function poserOiseau(i: number, x: number, y: number, z: number, cap: number, t: number, cadence: number): void {
    dummy.position.set(x, y, z);
    dummy.rotation.set(0, cap, 0);
    // Le battement : l'échelle verticale passe par zéro, les ailes montent
    // et descendent autour du corps.
    // Vus de la caméra du jeu, des oiseaux à leur taille réelle sont des
    // points : on les grossit, comme tout ce qui doit se lire de loin.
    dummy.scale.set(1.4, Math.sin(t * cadence + i * 1.7) * 2.2, 1.4);
    dummy.updateMatrix();
    oiseaux.setMatrixAt(i, dummy.matrix);
  }

  function update(t: number, nuit: number): void {
    const jour = nuit < 0.5;

    /* Les vols : une traversée en ligne droite, puis une attente hors champ.
       Chaque vol a son cap, sa hauteur et son cycle — ils ne passent jamais
       deux fois au même endroit du ciel. */
    for (let v = 0; v < VOLS; v++) {
      const duree = 26 + alea(v, 3) * 10;
      const cycle = duree + 14 + alea(v, 4) * 30;
      const u = (((t + alea(v, 6) * 60) % cycle) + cycle) % cycle;
      const tour = Math.floor((t + alea(v, 6) * 60) / cycle);
      const cap = alea(v + tour * 7, 8) * Math.PI * 2;
      const visible = jour && u < duree;
      const q = u / duree;
      const dx = Math.cos(cap);
      const dz = Math.sin(cap);
      // Décalage latéral du couloir, pour ne pas toujours survoler la ferme.
      const lat = (alea(v + tour * 3, 9) - 0.5) * DEMI;
      const bx = cx + dx * (q * 2 - 1) * DEMI * 1.4 - dz * lat;
      const bz = cz + dz * (q * 2 - 1) * DEMI * 1.4 + dx * lat;
      const haut = o.y + 9 + alea(v, 10) * 4;
      for (let k = 0; k < PAR_VOL; k++) {
        const i = v * PAR_VOL + k;
        if (!visible) {
          oiseaux.setMatrixAt(i, cache);
          continue;
        }
        // En V : chacun un peu derrière et à côté du précédent.
        const rang = Math.ceil(k / 2);
        const cote = k % 2 === 0 ? 1 : -1;
        const ox = -dx * rang * 0.7 - dz * cote * rang * 0.55;
        const oz = -dz * rang * 0.7 + dx * cote * rang * 0.55;
        poserOiseau(i, bx + ox, haut + Math.sin(t * 0.8 + k) * 0.15, bz + oz, -cap + Math.PI / 2, t, 9);
      }
    }

    /* L'envolée : les oiseaux jaillissent du point touché, montent en
       s'écartant, et disparaissent au bout de quatre secondes. */
    for (let k = 0; k < ENVOL; k++) {
      const i = VOLS * PAR_VOL + k;
      const age = envolee ? t - envolee.t0 : -1;
      if (!envolee || age < 0 || age > 4.5) {
        oiseaux.setMatrixAt(i, cache);
        continue;
      }
      const a = (k / ENVOL) * Math.PI * 2 + alea(k, 12);
      const r = 0.3 + age * (1.6 + alea(k, 13));
      poserOiseau(
        i,
        envolee.x + Math.cos(a) * r,
        o.y + 1.2 + age * (1.5 + alea(k, 14) * 0.8),
        envolee.z + Math.sin(a) * r,
        -a + Math.PI / 2,
        t,
        16,
      );
    }
    if (envolee && t - envolee.t0 > 4.5) envolee = null;
    oiseaux.instanceMatrix.needsUpdate = true;

    /* Les passants : le tour du parvis de chaque commerce, à pas tranquille.
       La nuit ils sont rentrés. */
    let p = 0;
    for (const lieu of utiles) {
      const demi = COTE_LIEU / 2 + 0.35;
      const perimetre = demi * 8;
      for (let k = 0; k < parLieu; k++, p++) {
        if (!jour) {
          for (const m of [corps, tetes, jambes]) m.setMatrixAt(p, cache);
          continue;
        }
        const sens = k % 2 === 0 ? 1 : -1;
        const vitesse = 0.42 + alea(p, 20) * 0.2;
        const s = ((((t * vitesse * sens + alea(p, 21) * perimetre) % perimetre) + perimetre) % perimetre) / (demi * 2);
        const cote = Math.floor(s);
        const f = s - cote;
        // Quatre côtés d'un carré, parcourus dans l'ordre.
        const coins: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        const a = coins[cote % 4]!;
        const b = coins[(cote + 1) % 4]!;
        const x = lieu.x + (a[0] + (b[0] - a[0]) * f) * demi;
        const z = lieu.z + (a[1] + (b[1] - a[1]) * f) * demi;
        const cap = Math.atan2((b[0] - a[0]) * sens, (b[1] - a[1]) * sens);
        dummy.position.set(x, o.y + 0.02 + Math.abs(Math.sin(t * 7 + p)) * 0.03, z);
        dummy.rotation.set(0, cap, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        for (const m of [corps, tetes, jambes]) m.setMatrixAt(p, dummy.matrix);
      }
    }
    for (const m of [corps, tetes, jambes]) m.instanceMatrix.needsUpdate = true;

    /* Les ombres de nuages : elles dérivent toutes dans le même sens — c'est
       le vent — à des vitesses voisines, et s'effacent la nuit. */
    matOmbre.opacity = 0.16 * (1 - Math.min(1, nuit * 1.6));
    ombres.forEach((m, i) => {
      const etendue = DEMI * 2 + 40;
      const s = (((t * (0.55 + alea(i, 30) * 0.3) + alea(i, 31) * etendue) % etendue) + etendue) % etendue;
      m.position.set(cx - etendue / 2 + s, o.yOmbres, cz + (alea(i, 32) - 0.5) * DEMI * 1.6 + s * 0.18);
      m.visible = matOmbre.opacity > 0.01;
    });
  }

  return {
    object,
    update,
    envol(x, z, t) {
      envolee = { x, z, t0: t };
    },
    dispose() {
      object.removeFromParent();
      for (const g of [geoOiseau, geoCorps, geoTete, geoJambes, geoOmbre]) g.dispose();
      for (const m of [matOiseau, matVetement, matPeau, matJambes, matOmbre]) m.dispose();
      texOmbre.dispose();
      for (const m of [oiseaux, corps, tetes, jambes]) m.dispose();
    },
  };
}
