/**
 * La campagne, en volumes.
 *
 * La ferme flottait : une dalle de terre posée sur rien, quatre arbres, et le
 * ciel tout autour. Ce module lui met un pays sous les pieds — un sol qui va
 * jusqu'à la brume, une route qui descend vers le reste du monde avec des
 * voitures dessus, et les champs des voisins qui vivent leur propre saison.
 *
 * Il ne décide de rien : le plan vient de `countryside-plan`, qui est de
 * l'arithmétique testable. Ici on ne fait que poser des volumes et les
 * animer.
 *
 * ## Le budget
 *
 * Tout ce qui ne bouge pas est fondu dans **une seule géométrie** par famille
 * — un maillage pour le sol, un pour l'ensemble des champs, un pour la route.
 * Une vingtaine de champs qui seraient vingt maillages coûteraient vingt
 * appels de dessin par image, sur un téléphone qui peine déjà. Ce qui bouge —
 * voitures, engins — reste séparé, forcément, mais se compte sur les doigts
 * d'une main.
 */

import * as THREE from "three";
import type { Season } from "@farmsim/shared";
import { createMachineRig, type MachineRig } from "./machines3d";
import {
  couleurChamp,
  etatChamp,
  grainerDe,
  planCampagne,
  suite,
  type ChampVoisin,
  type OptionsPlan,
  type PlanCampagne,
  type PointPlan,
} from "./countryside-plan";

export type OptionsCampagne = OptionsPlan & {
  /** Ombres portées : suit le réglage de la vue. */
  shadows?: boolean;
  /**
   * Réglage sobre : moins de champs, moins de voitures, pas d'engin voisin.
   * Sur un rasteriseur logiciel, chaque volume se paie en millisecondes.
   */
  sobre?: boolean;
  /** Altitude du sol de la campagne — sous le niveau de l'île. */
  y?: number;
  /**
   * Comment dessiner un arbre. Fourni par la vue plutôt que codé ici : les
   * arbres du jeu sont des illustrations tournées vers la caméra, et la
   * caméra n'a rien à faire dans ce module.
   */
  faireArbre?: (x: number, z: number, taille: number) => THREE.Object3D | null;
};

export type Campagne = {
  object: THREE.Group;
  /** Le plan dont tout est sorti — la vue s'en sert pour se repérer. */
  plan: PlanCampagne;
  /** Anime voitures et engins. `t` en secondes de scène. */
  update(t: number): void;
  /** Le jour et la saison décident de l'aspect des champs voisins. */
  setJour(jourDeJeu: number, saison: Season): void;
  dispose(): void;
};

/* ------------------------------------------------------------------ */
/* Petits outils de géométrie                                          */
/* ------------------------------------------------------------------ */

/** Un quadrilatère horizontal, en deux triangles, poussé dans les tableaux. */
function quad(
  pos: number[],
  col: number[],
  a: PointPlan,
  b: PointPlan,
  c: PointPlan,
  d: PointPlan,
  y: number,
  teinte: THREE.Color,
): void {
  /*
   * L'ordre compte, et il m'a coûté une passe : écrit `a, b, c` puis
   * `a, c, d`, le produit vectoriel des arêtes pointe vers **le bas**. Le sol
   * et les dix-neuf champs étaient bien là, dans la bonne couleur, face
   * cachée — éliminés au rendu et éclairés par en dessous. On parcourt donc le
   * quadrilatère dans l'autre sens.
   */
  const p = [a, c, b, a, d, c];
  for (const s of p) {
    pos.push(s.x, y, s.z);
    col.push(teinte.r, teinte.g, teinte.b);
  }
}

/** Un rectangle orienté, décrit par son centre, sa taille et son cap. */
function rectangle(
  cx: number,
  cz: number,
  w: number,
  d: number,
  cap: number,
): [PointPlan, PointPlan, PointPlan, PointPlan] {
  const co = Math.cos(cap);
  const si = Math.sin(cap);
  const coin = (sx: number, sz: number): PointPlan => ({
    x: cx + ((sx * w) / 2) * co - ((sz * d) / 2) * si,
    z: cz + ((sx * w) / 2) * si + ((sz * d) / 2) * co,
  });
  return [coin(-1, -1), coin(1, -1), coin(1, 1), coin(-1, 1)];
}

/** Longueurs cumulées d'une polyligne. */
function cumul(points: PointPlan[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z));
  }
  return out;
}

/** Position et cap le long d'une polyligne, à l'abscisse `s`. */
export function surLaRoute(
  points: PointPlan[],
  longueurs: number[],
  s: number,
): { x: number; z: number; cap: number } {
  const total = longueurs[longueurs.length - 1]!;
  const d = ((s % total) + total) % total;
  let i = 1;
  while (i < longueurs.length - 1 && longueurs[i]! < d) i++;
  const p = points[i - 1]!;
  const q = points[i]!;
  const seg = Math.max(1e-6, longueurs[i]! - longueurs[i - 1]!);
  const t = (d - longueurs[i - 1]!) / seg;
  return {
    x: p.x + (q.x - p.x) * t,
    z: p.z + (q.z - p.z) * t,
    cap: Math.atan2(q.x - p.x, q.z - p.z),
  };
}

/** Un maillage à couleurs de sommets, plat et sans reflet. */
function maillage(pos: number[], col: number[], shadows: boolean): THREE.Mesh {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = shadows;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Une voiture                                                         */
/* ------------------------------------------------------------------ */

const CARROSSERIES = [0xd0563f, 0x3f6fd0, 0xe4e0d4, 0x4b8a5c, 0xe0aa3c, 0x6d6f75];

/**
 * Une voiture de campagne, low-poly.
 *
 * Cinq boîtes : caisse, pavillon, quatre roues fondues en deux essieux, et
 * deux feux. À cette distance, personne ne compte les portes — ce qu'on doit
 * lire, c'est qu'une chose colorée avance sur le ruban gris.
 */
export function faireVoiture(couleur: number, shadows: boolean): THREE.Group {
  const g = new THREE.Group();
  const peinture = new THREE.MeshLambertMaterial({ color: couleur, flatShading: true });
  const vitre = new THREE.MeshLambertMaterial({ color: 0x2b3742, flatShading: true });
  const gomme = new THREE.MeshLambertMaterial({ color: 0x24262a, flatShading: true });

  const caisse = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 1.3), peinture);
  caisse.position.y = 0.26;
  caisse.castShadow = shadows;
  g.add(caisse);

  const pavillon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.64), vitre);
  pavillon.position.set(0, 0.4, -0.05);
  pavillon.castShadow = shadows;
  g.add(pavillon);

  for (const z of [-0.42, 0.42]) {
    const essieu = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.2), gomme);
    essieu.position.set(0, 0.1, z);
    g.add(essieu);
  }
  const feux = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.08, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
  );
  feux.position.set(0, 0.22, 0.66);
  g.add(feux);
  return g;
}

/* ------------------------------------------------------------------ */
/* La campagne                                                         */
/* ------------------------------------------------------------------ */

/**
 * Largeur de la chaussée, en unités monde.
 *
 * Une case de champ fait une unité. À 2,6 — la première valeur — la
 * départementale avait la largeur de deux tracteurs et demi et se lisait comme
 * une autoroute passant devant la ferme. Une voie et demie, c'est une route de
 * campagne.
 */
const LARGEUR_ROUTE = 1.55;

export function createCountryside(o: OptionsCampagne): Campagne {
  const shadows = o.shadows ?? false;
  const sobre = o.sobre ?? false;
  const y = o.y ?? -0.5;
  const plan = planCampagne({ ...o, champsVises: o.champsVises ?? (sobre ? 11 : 19) });
  const rnd = suite(grainerDe(o.graine + ":volumes"));

  const object = new THREE.Group();
  const aJeter: (THREE.BufferGeometry | THREE.Material)[] = [];
  const jetable = <T extends THREE.Mesh>(m: T): T => {
    aJeter.push(m.geometry);
    aJeter.push(m.material as THREE.Material);
    return m;
  };

  /* —— Le sol ——
     Un damier de quads aux verts légèrement différents. Une seule nappe unie
     se lit comme un fond d'écran ; ce sont les écarts de teinte qui donnent
     l'impression de prés et de talus. */
  {
    const e = plan.etendue;
    const pas = 7.5;
    const pos: number[] = [];
    const col: number[] = [];
    const teinte = new THREE.Color();
    for (let x = -e; x < e; x += pas) {
      for (let z = -e; z < e; z += pas) {
        // ±7 % et non ±14 : à la première valeur, les losanges du damier se
        // lisaient un par un, comme un carrelage mal posé plutôt qu'un pré.
        const v = 0.93 + rnd() * 0.14;
        // Le pré du fond est plus sourd que les cultures : c'est ce qui fait
        // ressortir les champs. À la même teinte, la campagne se lisait comme
        // une nappe unie où rien ne se détachait.
        teinte.setHex(0x669d55).multiplyScalar(v);
        quad(
          pos, col,
          { x, z }, { x: x + pas, z }, { x: x + pas, z: z + pas }, { x, z: z + pas },
          y, teinte,
        );
      }
    }
    const sol = jetable(maillage(pos, col, shadows));
    sol.name = "campagne-sol";
    object.add(sol);
  }

  /* —— Les champs des voisins ——
     Tous dans un seul maillage, reconstruit quand le jour change. Chaque champ
     est une nappe unie plus une poignée de bandes plus sombres : les sillons.
     Ce sont eux qui font qu'un champ ressemble à un champ et pas à un
     rectangle de couleur. */
  const groupeChamps = new THREE.Group();
  groupeChamps.name = "campagne-champs";
  object.add(groupeChamps);
  let maillageChamps: THREE.Mesh | null = null;
  let jourPose = Number.NaN;
  let saisonPosee: Season | null = null;

  function poserChamps(jour: number, saison: Season): void {
    if (jour === jourPose && saison === saisonPosee) return;
    jourPose = jour;
    saisonPosee = saison;
    if (maillageChamps) {
      groupeChamps.remove(maillageChamps);
      maillageChamps.geometry.dispose();
      (maillageChamps.material as THREE.Material).dispose();
    }
    const pos: number[] = [];
    const col: number[] = [];
    const teinte = new THREE.Color();
    for (const champ of plan.champs) {
      const etat = etatChamp(champ, jour, saison);
      const base = couleurChamp(champ.culture, etat);
      const [a, b, c, d] = rectangle(champ.x, champ.z, champ.w, champ.d, champ.sillons);
      teinte.setHex(base);
      quad(pos, col, a, b, c, d, y + 0.03, teinte);

      /*
       * La bordure : une bande d'herbe rase autour du champ.
       *
       * Sans elle, deux champs voisins se touchaient bord à bord et le
       * paysage ressemblait à un aplat de papiers découpés. Une campagne, ce
       * sont d'abord des limites — talus, haies, chemins de terre.
       */
      const [ba, bb, bc, bd] = rectangle(champ.x, champ.z, champ.w + 0.7, champ.d + 0.7, champ.sillons);
      teinte.setHex(0x4e8043);
      quad(pos, col, ba, bb, bc, bd, y + 0.02, teinte);

      // Les sillons : des bandes plus sombres, dans le sens du travail.
      const nSillons = Math.max(3, Math.round(champ.d / 0.9));
      const contraste = etat === "LABOUR" || etat === "SEMIS" ? 0.7 : 0.85;
      for (let i = 0; i < nSillons; i += 2) {
        const t0 = -champ.d / 2 + (i * champ.d) / nSillons;
        const t1 = t0 + champ.d / nSillons;
        const bande = rectangle(
          champ.x, champ.z, champ.w,
          t1 - t0, champ.sillons,
        );
        // On replace la bande à sa hauteur dans le champ.
        const dx = -Math.sin(champ.sillons) * ((t0 + t1) / 2);
        const dz = Math.cos(champ.sillons) * ((t0 + t1) / 2);
        const decale = bande.map((p) => ({ x: p.x + dx, z: p.z + dz })) as [
          PointPlan, PointPlan, PointPlan, PointPlan,
        ];
        teinte.setHex(base).multiplyScalar(contraste);
        quad(pos, col, decale[0], decale[1], decale[2], decale[3], y + 0.05, teinte);
      }
    }
    maillageChamps = maillage(pos, col, shadows);
    maillageChamps.name = "campagne-champs-nappe";
    groupeChamps.add(maillageChamps);
  }

  /* —— La route ——
     Un ruban de quads le long de la polyligne, bordé de deux accotements plus
     clairs, avec une ligne médiane pointillée. */
  const pointsRoute = plan.route;
  const longueurs = cumul(pointsRoute);
  {
    const pos: number[] = [];
    const col: number[] = [];
    const bitume = new THREE.Color(0x59595c);
    const accotement = new THREE.Color(0x8f8b6e);
    const ligne = new THREE.Color(0xd9d5c4);
    const normale = (i: number): PointPlan => {
      const p = pointsRoute[Math.max(0, i - 1)]!;
      const q = pointsRoute[Math.min(pointsRoute.length - 1, i + 1)]!;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const l = Math.hypot(dx, dz) || 1;
      return { x: -dz / l, z: dx / l };
    };
    for (let i = 0; i + 1 < pointsRoute.length; i++) {
      const p = pointsRoute[i]!;
      const q = pointsRoute[i + 1]!;
      const np = normale(i);
      const nq = normale(i + 1);
      const bord = (
        pt: PointPlan, n: PointPlan, k: number,
      ): PointPlan => ({ x: pt.x + n.x * k, z: pt.z + n.z * k });
      const h = LARGEUR_ROUTE / 2;
      quad(pos, col, bord(p, np, -h), bord(q, nq, -h), bord(q, nq, h), bord(p, np, h), y + 0.06, bitume);
      for (const s of [-1, 1]) {
        /*
         * Toujours du décalage le plus petit vers le plus grand.
         *
         * Écrit « du bord de chaussée vers l'extérieur », l'accotement de
         * gauche parcourait le quadrilatère dans l'autre sens — décalage
         * négatif — et se retrouvait face au sol. Trente sommets sur deux cent
         * soixante-dix, invisibles à l'œil sur une bande d'un tiers d'unité,
         * mais éclairés par en dessous.
         */
        const lo = Math.min(s * h, s * (h + 0.34));
        const hi = Math.max(s * h, s * (h + 0.34));
        quad(
          pos, col,
          bord(p, np, lo), bord(q, nq, lo),
          bord(q, nq, hi), bord(p, np, hi),
          y + 0.045, accotement,
        );
      }
    }
    // La médiane, en pointillés : deux mètres de trait, trois de vide.
    const total = longueurs[longueurs.length - 1]!;
    for (let s = 2; s < total - 2; s += 4) {
      const a = surLaRoute(pointsRoute, longueurs, s);
      const b = surLaRoute(pointsRoute, longueurs, s + 2);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const n = { x: -dz / l, z: dx / l };
      const k = 0.07;
      quad(
        pos, col,
        { x: a.x - n.x * k, z: a.z - n.z * k },
        { x: b.x - n.x * k, z: b.z - n.z * k },
        { x: b.x + n.x * k, z: b.z + n.z * k },
        { x: a.x + n.x * k, z: a.z + n.z * k },
        y + 0.07, ligne,
      );
    }
    const ruban = jetable(maillage(pos, col, shadows));
    ruban.name = "campagne-route";
    object.add(ruban);
  }

  /* —— Les arbres —— */
  if (o.faireArbre) {
    for (const a of plan.arbres) {
      const noeud = o.faireArbre(a.x, a.z, a.taille);
      if (noeud) object.add(noeud);
    }
  }

  /* —— Les voitures ——
     Elles bouclent sur la route, à des vitesses et des départs différents, et
     dans les deux sens. Une file qui roule au même pas se lit comme un
     convoi ; ce qu'on veut, c'est une départementale. */
  type Voiture = { group: THREE.Group; s0: number; vitesse: number; sens: 1 | -1 };
  const voitures: Voiture[] = [];
  const longueurTotale = longueurs[longueurs.length - 1]!;
  const combien = sobre ? 2 : 4;
  for (let i = 0; i < combien; i++) {
    const sens: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const g = faireVoiture(CARROSSERIES[Math.floor(rnd() * CARROSSERIES.length)]!, shadows);
    // Chacune sur sa voie, décalée d'un demi-quart de chaussée.
    g.name = "campagne-voiture";
    g.userData.voie = sens * (LARGEUR_ROUTE / 4);
    object.add(g);
    voitures.push({
      group: g,
      s0: (longueurTotale * i) / combien + rnd() * 6,
      vitesse: 4.2 + rnd() * 2.4,
      sens,
    });
    for (const enfant of g.children) {
      if (enfant instanceof THREE.Mesh) jetable(enfant);
    }
  }

  /* —— Les engins des voisins ——
     Le vrai modèle du jeu, tracteur et outil attelés : un tracteur de décor
     dessiné à part finirait par ne plus ressembler à celui du garage. Ils font
     des allers-retours dans le sens des sillons de leur champ. */
  type Engin = { rig: MachineRig; champ: ChampVoisin; vitesse: number; phase: number };
  const engins: Engin[] = [];
  {
    /*
     * Un engin en réglage sobre, deux sinon — jamais zéro.
     *
     * La première version les supprimait entièrement dès que la vue passait
     * en sobre. C'était traiter le voisin au travail comme une garniture,
     * alors que c'est précisément ce qui distingue une campagne d'un fond
     * d'écran ; et le réglage sobre s'enclenche justement sur les appareils
     * modestes, c'est-à-dire chez la plupart des joueurs. On paie un modèle
     * complet plutôt que deux, et on garde le mouvement.
     */
    const outils = ["PLOUGH", "SEEDER", "DISC_HARROW"] as const;
    for (const champ of plan.champs.filter((c) => c.travaille).slice(0, sobre ? 1 : 2)) {
      const rig = createMachineRig(outils[Math.floor(rnd() * outils.length)]!, {
        towed: true,
        shadows,
        seed: grainerDe(champ.id) % 97,
      });
      // Même échelle que les engins garés : un tracteur de voisin plus gros
      // que celui du garage trahirait aussitôt le décor.
      rig.group.name = "campagne-engin";
      rig.group.scale.setScalar(0.72);
      object.add(rig.group);
      engins.push({ rig, champ, vitesse: 1.5 + rnd() * 0.8, phase: rnd() * 10 });
    }
  }

  function update(t: number): void {
    for (const v of voitures) {
      const s = v.s0 + t * v.vitesse * v.sens;
      const p = surLaRoute(pointsRoute, longueurs, s);
      const voie = v.group.userData.voie as number;
      const nx = Math.cos(p.cap);
      const nz = -Math.sin(p.cap);
      v.group.position.set(p.x + nx * voie, y + 0.06, p.z + nz * voie);
      v.group.rotation.y = v.sens > 0 ? p.cap : p.cap + Math.PI;
    }
    for (const e of engins) {
      /*
       * Un aller-retour dans le sens des sillons.
       *
       * L'onde triangulaire donne une passe, un demi-tour, une passe en
       * sens inverse — et le cap suit le sens de marche, sans quoi l'engin
       * reculerait la moitié du temps.
       */
      const course = Math.max(2, e.champ.w - 1.2);
      const cycle = (course * 2) / e.vitesse;
      const u = (((t + e.phase) % cycle) + cycle) % cycle;
      const aller = u < cycle / 2;
      const avance = aller ? (u / (cycle / 2)) : 1 - (u - cycle / 2) / (cycle / 2);
      const long = -course / 2 + avance * course;
      // Le rang change à chaque passe : l'engin descend le champ.
      const passe = Math.floor((t + e.phase) / cycle);
      const rangs = Math.max(2, Math.round(e.champ.d / 1.6));
      const trav = -e.champ.d / 2 + 0.8 + ((passe % rangs) * (e.champ.d - 1.6)) / rangs;
      const co = Math.cos(e.champ.sillons);
      const si = Math.sin(e.champ.sillons);
      e.rig.group.position.set(
        e.champ.x + long * co - trav * si,
        y + 0.05,
        e.champ.z + long * si + trav * co,
      );
      e.rig.group.rotation.y = -e.champ.sillons + (aller ? Math.PI / 2 : -Math.PI / 2);
      e.rig.update({ t, distance: t * e.vitesse, working: true });
    }
  }

  function setJour(jourDeJeu: number, saison: Season): void {
    poserChamps(Math.floor(jourDeJeu), saison);
  }

  function dispose(): void {
    for (const e of engins) e.rig.dispose();
    engins.length = 0;
    if (maillageChamps) {
      maillageChamps.geometry.dispose();
      (maillageChamps.material as THREE.Material).dispose();
      maillageChamps = null;
    }
    for (const r of aJeter) r.dispose();
    aJeter.length = 0;
    object.clear();
  }

  poserChamps(0, "SUMMER");
  return { object, plan, update, setJour, dispose };
}
