import * as THREE from "three";
import { cleCase, etenduesEau, type Coin } from "@farmsim/shared";
import { jouerSon } from "./audio";
import type { MaillageEau } from "./eau3d";

/**
 * Ce qui fait qu'on a envie de creuser encore : l'eau qui vit, et chaque geste
 * qui se voit et s'entend.
 *
 * - **Creuser** : des mottes de terre giclent, puis l'eau monte dans le trou
 *   (la nappe le fait d'elle-même, voir `aNaissance`), et une éclaboussure
 *   l'accueille avec son rond dans l'eau.
 * - **Façonner une berge** : quelques éclats de lumière sur le coin retouché.
 * - **Un lac qui vit** : des canards qui y glissent dès qu'il est assez grand,
 *   un poisson qui saute de temps en temps.
 *
 * Tout est en coordonnées de **case** (x vers l'est, y vers le sud) jusqu'au
 * dernier moment, où `versMonde` les pose dans la scène.
 */

type Particule = { m: THREE.Mesh; v: THREE.Vector3; t0: number; vie: number; g: number; rond?: boolean };
type Canard = { g: THREE.Group; x: number; y: number; cx: number; cy: number; vitesse: number; phase: number; zone: string };
type Poisson = { m: THREE.Mesh; t0: number; ax: number; ay: number; bx: number; by: number };

const GRAVITE = 2.6;

export type EauVivante = {
  /** Le lac a changé : les canards se recomptent, les poissons ont d'autres fonds. */
  maj(
    eaux: ReadonlyMap<string, number>,
    m: MaillageEau,
    origine: { px: number; pz: number },
    pas: number,
    niveau: number,
    /** Le relief : de combien chaque case d'eau est au-dessus de la plaine. */
    altitude?: (x: number, y: number) => number,
  ): void;
  /** Une case vient d'être creusée : mottes, puis l'eau, puis l'éclaboussure. */
  creuser(x: number, y: number, t: number): void;
  /** Une case vient de monter (ou de descendre) d'un niveau : la terre gicle. */
  soulever(x: number, y: number, t: number, monte: boolean): void;
  /** Un arbre qu'on abat : la tronçonneuse, des copeaux qui volent. */
  copeaux(x: number, y: number, t: number, son: boolean): void;
  /** L'arbre touche le sol : feuilles et poussière. */
  impact(x: number, y: number, t: number): void;
  /** Une case vient d'être rebouchée. */
  reboucher(x: number, y: number, t: number): void;
  /** Un coin de berge vient d'être retouché. */
  eclat(x: number, y: number, coin: Coin, t: number): void;
  animer(t: number): void;
  dispose(): void;
};

export function creerEauVivante(parent: THREE.Group): EauVivante {
  const groupe = new THREE.Group();
  groupe.name = "eau-vivante";
  parent.add(groupe);

  const geoMotte = new THREE.DodecahedronGeometry(1, 0);
  const geoGoutte = new THREE.SphereGeometry(1, 6, 4);
  const geoRond = new THREE.RingGeometry(0.72, 1, 28).rotateX(-Math.PI / 2);
  const geoEclat = new THREE.OctahedronGeometry(1, 0);
  const matMotte = [0x6b4a2c, 0x7e5a36, 0x55391f].map((c) => new THREE.MeshLambertMaterial({ color: c }));
  const matGoutte = new THREE.MeshBasicMaterial({ color: 0xd8f0f4, transparent: true, opacity: 0.9 });
  const matEclat = new THREE.MeshBasicMaterial({ color: 0xfff7d6, transparent: true, opacity: 1 });
  const matPierre = new THREE.MeshLambertMaterial({ color: 0x8e8b84 });
  const matCopeau = new THREE.MeshLambertMaterial({ color: 0xd9b77a });
  const matFeuille = new THREE.MeshLambertMaterial({ color: 0x5f9a3a });

  let origine = { px: 0, pz: 0 };
  let pas = 1;
  let niveau = 0;
  let eaux: ReadonlyMap<string, number> = new Map();
  let fonds: { x: number; y: number; p: number }[] = [];
  const particules: Particule[] = [];
  const effets: { t: number; faire: () => void }[] = [];
  const canards: Canard[] = [];
  const poissons: Poisson[] = [];
  let prochainPoisson = 6;
  let tCourant = 0;

  let altitude: (x: number, y: number) => number = () => 0;
  const versMonde = (x: number, y: number, h = 0) =>
    new THREE.Vector3(origine.px + x * pas, niveau + altitude(Math.round(x), Math.round(y)) + h, origine.pz + y * pas);

  function particule(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, h: number, taille: number, v: THREE.Vector3, vie: number, g = GRAVITE, t0 = tCourant) {
    if (particules.length > 320) return;
    const m = new THREE.Mesh(geo, mat instanceof THREE.MeshBasicMaterial ? mat.clone() : mat);
    m.position.copy(versMonde(x, y, h));
    m.scale.setScalar(taille * pas);
    m.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    groupe.add(m);
    particules.push({ m, v, t0, vie, g });
  }

  function rond(x: number, y: number, couleur: number, t0: number, taille = 0.35) {
    const mat = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: 0.8, depthWrite: false });
    const m = new THREE.Mesh(geoRond, mat);
    m.position.copy(versMonde(x, y, 0.012));
    m.scale.setScalar(taille * pas * 0.3);
    m.visible = false;
    groupe.add(m);
    particules.push({ m, v: new THREE.Vector3(), t0, vie: 1.1, g: 0, rond: true });
  }

  function plus(t: number, faire: () => void) {
    effets.push({ t, faire });
  }

  /* —— Les canards —— */
  const matPlume = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const matPlumeBlanc = new THREE.MeshLambertMaterial({ color: 0xf1ede4 });
  const matTete = new THREE.MeshLambertMaterial({ color: 0x2f6b3d });
  const matBec = new THREE.MeshLambertMaterial({ color: 0xe0a03a });
  const geoCorps = new THREE.SphereGeometry(1, 10, 8);
  function unCanard(blanc: boolean): THREE.Group {
    const g = new THREE.Group();
    const corps = new THREE.Mesh(geoCorps, blanc ? matPlumeBlanc : matPlume);
    corps.scale.set(0.075, 0.045, 0.05);
    corps.position.y = 0.02;
    const queue = new THREE.Mesh(geoCorps, blanc ? matPlumeBlanc : matPlume);
    queue.scale.set(0.03, 0.02, 0.025);
    queue.position.set(-0.07, 0.045, 0);
    const tete = new THREE.Mesh(geoCorps, blanc ? matPlumeBlanc : matTete);
    tete.scale.setScalar(0.028);
    tete.position.set(0.055, 0.075, 0);
    const bec = new THREE.Mesh(geoCorps, matBec);
    bec.scale.set(0.022, 0.008, 0.012);
    bec.position.set(0.085, 0.07, 0);
    for (const m of [corps, queue, tete, bec]) {
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }

  function mouille(x: number, y: number): boolean {
    return eaux.has(cleCase(Math.round(x), Math.round(y)));
  }

  function nouvelleCible(c: Canard) {
    const zone = fonds.filter((f) => f.p > 0.26 && zoneDe(f.x, f.y) === c.zone);
    if (!zone.length) return;
    const f = zone[Math.floor(Math.random() * zone.length)]!;
    c.cx = f.x;
    c.cy = f.y;
  }

  let zones = new Map<string, string>();
  function zoneDe(x: number, y: number): string {
    return zones.get(cleCase(Math.round(x), Math.round(y))) ?? "";
  }

  function maj(
    e: ReadonlyMap<string, number>,
    m: MaillageEau,
    o: { px: number; pz: number },
    p: number,
    n: number,
    alt?: (x: number, y: number) => number,
  ) {
    eaux = e;
    fonds = m.large;
    origine = o;
    pas = p;
    niveau = n;
    altitude = alt ?? (() => 0);
    // Les étendues d'eau, et combien de canards chacune mérite. Une cascade
    // sépare deux étendues : un canard ne remonte pas la chute.
    zones = new Map();
    const etendues = etenduesEau([...e.keys()].map((k) => {
      const [x, y] = k.split(",").map(Number) as [number, number];
      return { x, y, sol: "EAU" };
    })).flatMap((z) => {
      const parNiveau = new Map<number, string[]>();
      for (const k of z) {
        const [x, y] = k.split(",").map(Number) as [number, number];
        const a = altitude(x, y);
        parNiveau.set(a, [...(parNiveau.get(a) ?? []), k]);
      }
      return [...parNiveau.values()];
    });
    for (const z of etendues) {
      const id = z.slice().sort()[0]!;
      for (const k of z) zones.set(k, id);
    }
    // Un canard dont l'eau a disparu s'en va ; les autres suivent leur zone.
    for (let i = canards.length - 1; i >= 0; i--) {
      const c = canards[i]!;
      if (!mouille(c.x, c.y)) {
        groupe.remove(c.g);
        canards.splice(i, 1);
      } else c.zone = zoneDe(c.x, c.y);
    }
    for (const z of etendues) {
      const id = z.slice().sort()[0]!;
      const voulus = z.length >= 6 ? Math.min(4, 1 + Math.floor(z.length / 14)) : 0;
      let presents = canards.filter((c) => c.zone === id).length;
      const places = fonds.filter((f) => f.p > 0.3 && zoneDe(f.x, f.y) === id);
      while (presents < voulus && places.length) {
        const f = places[Math.floor(Math.random() * places.length)]!;
        const g = unCanard(presents % 3 === 2);
        groupe.add(g);
        const c: Canard = { g, x: f.x, y: f.y, cx: f.x, cy: f.y, vitesse: 0.12 + Math.random() * 0.08, phase: Math.random() * 6, zone: id };
        nouvelleCible(c);
        canards.push(c);
        presents++;
      }
    }
    for (const c of canards) c.g.scale.setScalar(pas);
  }

  function creuser(x: number, y: number, t: number) {
    plus(t, () => {
      jouerSon("creuse");
      for (let k = 0; k < 9; k++) {
        const a = Math.random() * Math.PI * 2;
        const f = 0.6 + Math.random() * 0.8;
        particule(
          geoMotte,
          matMotte[k % 3]!,
          x + (Math.random() - 0.5) * 0.4,
          y + (Math.random() - 0.5) * 0.4,
          0.06,
          0.035 + Math.random() * 0.03,
          new THREE.Vector3(Math.cos(a) * f, 1.2 + Math.random() * 0.9, Math.sin(a) * f),
          0.85,
        );
      }
    });
    // L'eau arrive : elle affleure, gicle, et laisse un rond qui s'élargit.
    plus(t + 0.55, () => {
      jouerSon("eau");
      for (let k = 0; k < 7; k++) {
        const a = Math.random() * Math.PI * 2;
        const f = 0.3 + Math.random() * 0.4;
        particule(geoGoutte, matGoutte, x, y, 0.02, 0.02 + Math.random() * 0.012, new THREE.Vector3(Math.cos(a) * f, 1.1 + Math.random() * 0.6, Math.sin(a) * f), 0.7);
      }
      rond(x, y, 0xe6f6f8, tCourant, 0.5);
      rond(x, y, 0xe6f6f8, tCourant + 0.25, 0.35);
    });
  }

  function soulever(x: number, y: number, t: number, monte: boolean) {
    plus(t, () => {
      jouerSon("relief");
      // Des mottes et des cailloux : plus haut, plus loin quand la terre monte.
      for (let k = 0; k < 12; k++) {
        const a = Math.random() * Math.PI * 2;
        const f = 0.5 + Math.random() * 0.9;
        particule(
          k % 4 === 3 ? geoEclat : geoMotte,
          k % 4 === 3 ? matPierre : matMotte[k % 3]!,
          x + (Math.random() - 0.5) * 0.7,
          y + (Math.random() - 0.5) * 0.7,
          0.1,
          0.03 + Math.random() * 0.035,
          new THREE.Vector3(Math.cos(a) * f, (monte ? 1.5 : 0.8) + Math.random() * 0.8, Math.sin(a) * f),
          0.9,
        );
      }
      rond(x, y, 0xf3ead2, tCourant, 0.7);
    });
  }

  function copeaux(x: number, y: number, t: number, son: boolean) {
    plus(t, () => {
      if (son) jouerSon("coupe");
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2;
        const f = 0.4 + Math.random() * 0.6;
        particule(geoEclat, matCopeau, x, y, 0.14, 0.018 + Math.random() * 0.015, new THREE.Vector3(Math.cos(a) * f, 0.9 + Math.random() * 0.6, Math.sin(a) * f), 0.7);
      }
    });
  }

  function impact(x: number, y: number, t: number) {
    plus(t, () => {
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        const f = 0.3 + Math.random() * 0.7;
        particule(geoMotte, k % 3 ? matFeuille : matCopeau, x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.8, 0.1, 0.025 + Math.random() * 0.02, new THREE.Vector3(Math.cos(a) * f, 0.5 + Math.random() * 0.6, Math.sin(a) * f), 0.8);
      }
      rond(x, y, 0xe9dcc0, tCourant, 0.8);
    });
  }

  function reboucher(x: number, y: number, t: number) {
    plus(t, () => {
      jouerSon("pose");
      for (let k = 0; k < 6; k++) {
        const a = Math.random() * Math.PI * 2;
        particule(geoMotte, matMotte[k % 3]!, x + Math.cos(a) * 0.2, y + Math.sin(a) * 0.2, 0.5, 0.04, new THREE.Vector3(0, -0.5, 0), 0.45);
      }
    });
  }

  function eclat(x: number, y: number, coin: Coin, t: number) {
    const dx = coin === 1 || coin === 2 ? 1 : -1;
    const dy = coin >= 2 ? 1 : -1;
    const cx = x + dx * 0.28;
    const cy = y + dy * 0.28;
    plus(t, () => {
      jouerSon("berge");
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        particule(geoEclat, matEclat, cx, cy, 0.05, 0.022, new THREE.Vector3(Math.cos(a) * 0.5, 0.9 + Math.random() * 0.4, Math.sin(a) * 0.5), 0.6, 1.2);
      }
      rond(cx, cy, 0xfff7d6, tCourant, 0.3);
    });
  }

  const matPoisson = new THREE.MeshLambertMaterial({ color: 0xc98c4a });
  function sauterPoisson(t: number) {
    const f = fonds.filter((q) => q.p > 0.3);
    if (!f.length) return;
    const a = f[Math.floor(Math.random() * f.length)]!;
    const ang = Math.random() * Math.PI * 2;
    const bx = a.x + Math.cos(ang) * 0.35;
    const by = a.y + Math.sin(ang) * 0.35;
    if (!mouille(bx, by)) return;
    const m = new THREE.Mesh(geoCorps, matPoisson);
    m.scale.set(0.05 * pas, 0.018 * pas, 0.018 * pas);
    groupe.add(m);
    poissons.push({ m, t0: t, ax: a.x, ay: a.y, bx, by });
    rond(a.x, a.y, 0xe6f6f8, t, 0.3);
    rond(bx, by, 0xe6f6f8, t + 0.75, 0.3);
  }

  function animer(t: number) {
    const dt = Math.min(0.05, Math.max(0, t - tCourant));
    tCourant = t;
    for (let i = effets.length - 1; i >= 0; i--) {
      if (effets[i]!.t <= t) {
        const e = effets.splice(i, 1)[0]!;
        e.faire();
      }
    }
    for (let i = particules.length - 1; i >= 0; i--) {
      const p = particules[i]!;
      const age = t - p.t0;
      if (age < 0) continue;
      if (age > p.vie) {
        groupe.remove(p.m);
        if (p.m.material !== matMotte[0] && p.m.material !== matMotte[1] && p.m.material !== matMotte[2] && p.m.material !== matPierre && p.m.material !== matCopeau && p.m.material !== matFeuille) (p.m.material as THREE.Material).dispose();
        particules.splice(i, 1);
        continue;
      }
      const k = age / p.vie;
      if (p.rond) {
        p.m.visible = true;
        p.m.scale.setScalar(pas * (0.12 + k * 0.5));
        (p.m.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
        continue;
      }
      p.v.y -= p.g * dt;
      p.m.position.x += p.v.x * dt * pas;
      p.m.position.y += p.v.y * dt * pas * 0.5;
      p.m.position.z += p.v.z * dt * pas;
      p.m.rotation.x += dt * 6;
      const mat = p.m.material;
      if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = 1 - k * k;
      if (p.m.position.y < niveau - 0.25) p.m.visible = false;
    }
    for (const c of canards) {
      const dx = c.cx - c.x;
      const dy = c.cy - c.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) nouvelleCible(c);
      else {
        const nx = c.x + (dx / d) * c.vitesse * dt;
        const ny = c.y + (dy / d) * c.vitesse * dt;
        if (mouille(nx, ny)) {
          c.x = nx;
          c.y = ny;
        } else nouvelleCible(c);
        c.g.rotation.y = Math.atan2(-dy, dx);
      }
      c.g.position.copy(versMonde(c.x, c.y, Math.sin(t * 2.2 + c.phase) * 0.006));
    }
    if (fonds.length && t > prochainPoisson) {
      sauterPoisson(t);
      prochainPoisson = t + 7 + Math.random() * 9;
    }
    for (let i = poissons.length - 1; i >= 0; i--) {
      const p = poissons[i]!;
      const k = (t - p.t0) / 0.75;
      if (k >= 1) {
        groupe.remove(p.m);
        poissons.splice(i, 1);
        continue;
      }
      const x = p.ax + (p.bx - p.ax) * k;
      const y = p.ay + (p.by - p.ay) * k;
      p.m.position.copy(versMonde(x, y, Math.sin(k * Math.PI) * 0.22));
      p.m.rotation.set(0, Math.atan2(-(p.by - p.ay), p.bx - p.ax), (0.5 - k) * 2.2);
    }
  }

  return {
    maj,
    creuser,
    soulever,
    copeaux,
    impact,
    reboucher,
    eclat,
    animer,
    dispose() {
      parent.remove(groupe);
      for (const g of [geoMotte, geoGoutte, geoRond, geoEclat, geoCorps]) g.dispose();
      for (const m of [...matMotte, matPierre, matCopeau, matFeuille, matGoutte, matEclat, matPlume, matPlumeBlanc, matTete, matBec, matPoisson]) m.dispose();
      for (const p of particules) if (p.m.material instanceof THREE.MeshBasicMaterial) p.m.material.dispose();
    },
  };
}
