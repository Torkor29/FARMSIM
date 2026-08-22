/**
 * La campagne, en volumes.
 *
 * La ferme flottait : une dalle de terre posée sur rien, quatre arbres, et le
 * ciel tout autour. Ce module lui met un pays sous les pieds.
 *
 * ## Un monde bombé, et pas une nappe
 *
 * Le sol s'incurve vers le bas à mesure qu'on s'éloigne. Ce n'est pas une
 * coquetterie : une nappe plate infinie remplit tout l'écran et fait
 * disparaître le ciel — c'était le reproche. Bombée, elle a une crête, donc un
 * horizon, donc du ciel au-dessus ; et au-delà de la dernière herbe il y a une
 * plage puis la mer, comme sur le globe du choix de région.
 *
 * ## Des voisins, pas des tapis
 *
 * Les parcelles alentour sont bâties dans le même langage que celle du
 * joueur — une dalle de terre, un damier de cases, une haie autour, parfois un
 * bâtiment au bord. Peintes en rectangles de couleur posés sur l'herbe, elles
 * se lisaient comme du papier découpé.
 *
 * ## Le budget
 *
 * Tout ce qui ne bouge pas est fondu dans **un** maillage par famille : le
 * monde, les parcelles, la route, les bosquets. Douze parcelles de trente
 * cases feraient trois cent soixante volumes ; elles en font un. Ce qui bouge —
 * voitures, engins — reste séparé et se compte sur les doigts d'une main.
 */

import * as THREE from "three";
import type { Season } from "@farmsim/shared";
import { createMachineRig, type MachineRig } from "./machines3d";
import {
  ajouterArbre,
  ajouterBoite,
  ajouterGrange,
  verserTransforme,
  CARROSSERIES,
  eclaircir,
  maillageFacette,
  makeVoiture,
} from "./decor3d";
import {
  couleurChamp,
  creux,
  DEMI_ROUTE,
  empriseParcelle,
  etatChamp,
  grainerDe,
  pente,
  planCampagne,
  suite,
  type OptionsPlan,
  type ParcelleVoisine,
  type PlanCampagne,
  type PointPlan,
} from "./countryside-plan";

export type OptionsCampagne = OptionsPlan & {
  /** Ombres portées : suit le réglage de la vue. */
  shadows?: boolean;
  /** Réglage sobre : moins de parcelles, moins de voitures, un seul engin. */
  sobre?: boolean;
  /** Altitude du sol au centre — sous le niveau de l'île du joueur. */
  y?: number;
};

export type Campagne = {
  object: THREE.Group;
  /** Le plan dont tout est sorti — la vue s'en sert pour se repérer. */
  plan: PlanCampagne;
  /** Anime voitures et engins. `t` en secondes de scène. */
  update(t: number): void;
  /** Le jour et la saison décident de l'aspect des parcelles voisines. */
  setJour(jourDeJeu: number, saison: Season): void;
  dispose(): void;
};

/* ------------------------------------------------------------------ */
/* Le relief                                                           */
/* ------------------------------------------------------------------ */

/** Le pas d'une case, comme sur la parcelle du joueur. */
const PAS_CASE = 1.06;

/** Épaisseur de la dalle de terre sous une parcelle voisine. */
const EPAISSEUR_DALLE = 0.3;

/**
 * Le bord du monde : un rayon qui ondule doucement avec l'azimut.
 *
 * Un disque parfait se voit pour ce qu'il est, même noyé de brume. Deux
 * harmoniques suffisent, et restent lisses — un bord dentelé accrocherait
 * l'œil plus que le sujet.
 */
function rayonBord(angle: number, rayon: number, phase: number): number {
  return rayon * (1 + 0.07 * Math.sin(3 * angle + phase) + 0.04 * Math.sin(5 * angle - phase));
}

/* ------------------------------------------------------------------ */
/* Le long de la route                                                 */
/* ------------------------------------------------------------------ */

/**
 * Redécoupe une polyligne en segments courts.
 *
 * Indispensable dès que le sol est bombé : un ruban tendu entre deux points
 * distants de vingt unités est une **corde**, et le terrain, concave, passe
 * au-dessus d'elle en son milieu. Mesuré à l'écran, la route disparaissait
 * par morceaux — enterrée d'un bon décimètre au centre de chaque long
 * segment, visible seulement près de ses extrémités.
 */
export function densifier(pts: PointPlan[], pas: number): PointPlan[] {
  const out: PointPlan[] = [pts[0]!];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[i + 1]!;
    const l = Math.hypot(q.x - p.x, q.z - p.z);
    const n = Math.max(1, Math.ceil(l / pas));
    for (let k = 1; k <= n; k++) {
      out.push({ x: p.x + ((q.x - p.x) * k) / n, z: p.z + ((q.z - p.z) * k) / n });
    }
  }
  return out;
}

/** Longueurs cumulées d'une polyligne. */
function cumul(points: PointPlan[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(
      out[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z),
    );
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

/**
 * Un quadrilatère horizontal, en deux triangles.
 *
 * L'ordre compte, et il m'a coûté une passe : écrit `a, b, c` puis `a, c, d`,
 * le produit vectoriel des arêtes pointe vers **le bas**. Le sol entier était
 * là, dans la bonne couleur, face cachée. On parcourt donc dans l'autre sens.
 */
function quad(
  pos: number[],
  col: number[],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  d: [number, number, number],
  teinte: THREE.Color,
): void {
  for (const s of [a, c, b, a, d, c]) {
    pos.push(s[0], s[1], s[2]);
    col.push(teinte.r, teinte.g, teinte.b);
  }
}

/* ------------------------------------------------------------------ */
/* La campagne                                                         */
/* ------------------------------------------------------------------ */

/** Objets de travail réutilisés à chaque image — n'allouer que si nécessaire. */
const _lacet = new THREE.Euler();
const _qLacet = new THREE.Quaternion();

export function createCountryside(o: OptionsCampagne): Campagne {
  const shadows = o.shadows ?? false;
  const sobre = o.sobre ?? false;
  const y0 = o.y ?? -0.5;
  const plan = planCampagne({
    ...o,
    parcellesVisees: o.parcellesVisees ?? (sobre ? 8 : 12),
  });
  const rnd = suite(grainerDe(o.graine + ":volumes"));
  const phaseCote = rnd() * Math.PI * 2;

  const object = new THREE.Group();
  object.name = "campagne";
  const aJeter: (THREE.BufferGeometry | THREE.Material)[] = [];
  const garder = <T extends THREE.Mesh>(m: T): T => {
    aJeter.push(m.geometry, m.material as THREE.Material);
    return m;
  };
  /** L'altitude du sol à une distance donnée du centre. */
  const sol = (r: number) => y0 + creux(r);

  /**
   * L'assiette d'un objet posé au sol : la rotation qui l'aligne sur la pente.
   *
   * Le monde est bombé ; posé à plat dessus, un objet décolle d'un bord et
   * s'enterre de l'autre. L'axe de bascule est la tangente au cercle qui passe
   * sous lui — c'est le seul autour duquel une pente radiale se rattrape.
   */
  const assiette = (x: number, z: number): THREE.Quaternion => {
    const r = Math.hypot(x, z);
    if (r < 1e-4) return new THREE.Quaternion();
    const phi = Math.atan2(z, x);
    const axe = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi));
    return new THREE.Quaternion().setFromAxisAngle(axe, Math.atan(pente(r)));
  };

  /* —— Le monde ——
     Une grille radiale plutôt qu'un damier : c'est elle qui permet de courber
     proprement et de garder des triangles réguliers jusqu'à l'horizon.

     Il n'y a ni plage ni mer. La première version en avait mis, en prenant
     « comme un globe où on voit la mer » pour une consigne alors que c'était
     une image : on est à la campagne. Ce qui restait juste dans l'image, c'est
     la rondeur — le sol s'incurve, sa crête fait l'horizon, et la brume la
     fond dans le ciel. */
  {
    const secteurs = sobre ? 48 : 72;
    const anneaux = sobre ? 18 : 26;
    const posT: number[] = [];
    const colT: number[] = [];
    const teinte = new THREE.Color();
    const HERBE = 0x6aa259;
    const HERBE_LOIN = 0x76a862;

    const pt = (angle: number, r: number): [number, number, number] => [
      Math.cos(angle) * r,
      sol(r),
      Math.sin(angle) * r,
    ];

    /**
     * Un anneau entre deux azimuts, dans le bon sens.
     *
     * Un seul point d'entrée, et c'est délibéré : écrits à la main, les
     * anneaux étaient enroulés à l'envers. Sur une grille radiale, parcourir
     * « intérieur puis extérieur » tourne dans l'autre sens que sur un
     * damier, et les six mille sommets du monde regardaient le sous-sol.
     */
    const anneau = (
      a0: number, a1: number,
      rIn0: number, rOut0: number, rIn1: number, rOut1: number,
      teint: THREE.Color,
    ) => {
      // Au pôle, le bord intérieur se réduit à un point : le quadrilatère y
      // dégénère en un triangle plus un autre d'aire nulle, dont la normale
      // vaut zéro. Un triangle franc plutôt qu'un quadrilatère plat.
      if (rIn0 < 1e-6 && rIn1 < 1e-6) {
        for (const v of [pt(a1, rOut1), pt(a0, rOut0), [0, sol(0), 0] as [number, number, number]]) {
          posT.push(v[0], v[1], v[2]);
          colT.push(teint.r, teint.g, teint.b);
        }
        return;
      }
      quad(posT, colT, pt(a0, rOut0), pt(a1, rOut1), pt(a1, rIn1), pt(a0, rIn0), teint);
    };

    for (let s = 0; s < secteurs; s++) {
      const a0 = (s / secteurs) * Math.PI * 2;
      const a1 = ((s + 1) / secteurs) * Math.PI * 2;
      // Le bord du monde ondule doucement : un disque parfait se voit pour ce
      // qu'il est, même noyé de brume.
      const bord0 = rayonBord(a0, plan.rayonTerre, phaseCote);
      const bord1 = rayonBord(a1, plan.rayonTerre, phaseCote);
      for (let k = 0; k < anneaux; k++) {
        const t0 = k / anneaux;
        const t1 = (k + 1) / anneaux;
        // Les anneaux se resserrent vers la crête : c'est là que la courbure
        // se voit, et des quadrilatères réguliers y feraient des marches.
        const e0 = t0 * t0 * 0.45 + t0 * 0.55;
        const e1 = t1 * t1 * 0.45 + t1 * 0.55;
        // Les prés du fond tirent vers le gris-vert : c'est la perspective
        // aérienne qui donne la distance, avant même la brume.
        teinte
          .setHex(t0 > 0.55 ? HERBE_LOIN : HERBE)
          .multiplyScalar(0.93 + rnd() * 0.14);
        anneau(a0, a1, e0 * bord0, e1 * bord0, e0 * bord1, e1 * bord1, teinte);
      }
    }
    object.add(garder(maillageFacette(posT, colT, { recoit: shadows, nom: "campagne-sol" })));
  }

  /* —— Les parcelles des voisins ——
     Le même langage que l'île du joueur : une dalle de terre, un damier de
     cases, une haie autour. Refaites quand le jour change, pas plus souvent. */
  const groupeParcelles = new THREE.Group();
  groupeParcelles.name = "campagne-parcelles";
  object.add(groupeParcelles);
  let nappeParcelles: THREE.Mesh | null = null;
  let jourPose = Number.NaN;
  let saisonPosee: Season | null = null;

  function poserParcelles(jour: number, saison: Season): void {
    if (jour === jourPose && saison === saisonPosee) return;
    jourPose = jour;
    saisonPosee = saison;
    if (nappeParcelles) {
      groupeParcelles.remove(nappeParcelles);
      nappeParcelles.geometry.dispose();
      (nappeParcelles.material as THREE.Material).dispose();
    }
    const pos: number[] = [];
    const col: number[] = [];
    const TERRE_DALLE = 0x8a6b4a;
    const HAIE = 0x5c9a52;
    const posL: number[] = [];
    const colL: number[] = [];
    const mat = new THREE.Matrix4();
    const ech = new THREE.Vector3(1, 1, 1);
    const centre = new THREE.Vector3();
    for (const p of plan.parcelles) {
      const grain = suite(grainerDe(p.id));
      const etat = etatChamp(p, jour, saison);
      const base = couleurChamp(p.culture, etat);
      const emprise = empriseParcelle(p);

      /*
       * Bâtie à plat dans son repère à elle, puis posée d'un bloc.
       *
       * Construite directement en coordonnées du monde, la parcelle restait un
       * plateau horizontal sur un sol bombé : son bord aval s'enfonçait, son
       * bord amont décollait, et il en sortait une grande dalle de terre en
       * biais, visible de loin. Ici elle épouse la pente.
       */
      posL.length = 0;
      colL.length = 0;

      // La dalle de terre, qui donne son talus à la parcelle.
      ajouterBoite(
        posL, colL, 0, -EPAISSEUR_DALLE / 2, 0,
        emprise.w, EPAISSEUR_DALLE, emprise.d, TERRE_DALLE,
      );

      // Le damier de cases.
      const droit = Math.abs(Math.cos(p.cap)) > 0.5;
      const nx = droit ? p.gw : p.gh;
      const nz = droit ? p.gh : p.gw;
      const ox = -((nx - 1) * PAS_CASE) / 2;
      const oz = -((nz - 1) * PAS_CASE) / 2;
      for (let i = 0; i < nx; i++) {
        for (let k = 0; k < nz; k++) {
          // Une teinte par case, très légèrement différente : un aplat parfait
          // se lit comme une nappe, pas comme un champ.
          const teinte = eclaircir(base, (grain() - 0.5) * 0.12);
          ajouterBoite(posL, colL, ox + i * PAS_CASE, 0.09, oz + k * PAS_CASE, 1, 0.18, 1, teinte);
        }
      }

      // La haie, sur les quatre bords.
      const hw = emprise.w;
      const hd = emprise.d;
      const ep = 0.22;
      for (const [dx, dz, w, dd] of [
        [0, -hd / 2, hw, ep],
        [0, hd / 2, hw, ep],
        [-hw / 2, 0, ep, hd],
        [hw / 2, 0, ep, hd],
      ] as const) {
        ajouterBoite(posL, colL, dx, 0.24, dz, w, 0.4, dd, HAIE);
      }

      // Parfois une grange au bord : c'est elle qui fait la ferme du voisin
      // plutôt qu'un simple champ.
      if (p.batiment) {
        const bx = (hw / 2 - 1.5) * (grain() < 0.5 ? -1 : 1);
        const bz = (hd / 2 - 1.2) * (grain() < 0.5 ? -1 : 1);
        ajouterGrange(posL, colL, bx, 0.18, bz, p.cap, grainerDe(p.id + ":grange"));
      }

      mat.compose(
        centre.set(p.x, sol(Math.hypot(p.x, p.z)), p.z),
        assiette(p.x, p.z),
        ech,
      );
      verserTransforme(pos, col, posL, colL, mat);
    }
    nappeParcelles = maillageFacette(pos, col, {
      shadows,
      recoit: shadows,
      nom: "campagne-parcelles-nappe",
    });
    groupeParcelles.add(nappeParcelles);
  }

  /* —— La route et sa desserte —— */
  const pointsRoute = plan.route;
  const longueurs = cumul(pointsRoute);
  {
    const pos: number[] = [];
    const col: number[] = [];
    const bitume = new THREE.Color(0x4f4f54);
    const accotement = new THREE.Color(0x9a9070);
    const ligne = new THREE.Color(0xdedac9);
    const gravier = new THREE.Color(0xb5a687);
    const hSol = (x: number, z: number) => sol(Math.hypot(x, z)) + 0.05;

    const ruban = (pts: PointPlan[], demi: number, teinte: THREE.Color, bord: THREE.Color | null) => {
      const normale = (i: number): PointPlan => {
        const p = pts[Math.max(0, i - 1)]!;
        const q = pts[Math.min(pts.length - 1, i + 1)]!;
        const dx = q.x - p.x;
        const dz = q.z - p.z;
        const l = Math.hypot(dx, dz) || 1;
        return { x: -dz / l, z: dx / l };
      };
      for (let i = 0; i + 1 < pts.length; i++) {
        const p = pts[i]!;
        const q = pts[i + 1]!;
        // Deux points confondus donneraient un ruban d'aire nulle, dont la
        // normale n'existe pas.
        if (Math.hypot(q.x - p.x, q.z - p.z) < 1e-6) continue;
        const np = normale(i);
        const nq = normale(i + 1);
        const c = (pt: PointPlan, nn: PointPlan, k: number): [number, number, number] => {
          const x = pt.x + nn.x * k;
          const z = pt.z + nn.z * k;
          return [x, hSol(x, z), z];
        };
        quad(pos, col, c(p, np, -demi), c(q, nq, -demi), c(q, nq, demi), c(p, np, demi), teinte);
        if (!bord) continue;
        for (const s of [-1, 1]) {
          // Toujours du décalage le plus petit vers le plus grand : écrit
          // « du bord vers l'extérieur », l'accotement de gauche parcourait le
          // quadrilatère à l'envers et se retrouvait face au sol.
          const lo = Math.min(s * demi, s * (demi + 0.42));
          const hi = Math.max(s * demi, s * (demi + 0.42));
          quad(pos, col, c(p, np, lo), c(q, nq, lo), c(q, nq, hi), c(p, np, hi), bord);
        }
      }
    };

    ruban(densifier(pointsRoute, 1.6), DEMI_ROUTE - 0.42, bitume, accotement);
    ruban(densifier(plan.desserte, 1.6), 0.9, gravier, null);

    // La médiane, en pointillés : deux mètres de trait, trois de vide.
    const total = longueurs[longueurs.length - 1]!;
    for (let s = 2; s < total - 2; s += 5) {
      const a = surLaRoute(pointsRoute, longueurs, s);
      const b = surLaRoute(pointsRoute, longueurs, s + 2);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const nn = { x: -dz / l, z: dx / l };
      const k = 0.07;
      const c = (p: { x: number; z: number }, signe: number): [number, number, number] => {
        const x = p.x + nn.x * k * signe;
        const z = p.z + nn.z * k * signe;
        return [x, hSol(x, z) + 0.012, z];
      };
      quad(pos, col, c(a, -1), c(b, -1), c(b, 1), c(a, 1), ligne);
    }
    object.add(garder(maillageFacette(pos, col, { nom: "campagne-route" })));
  }

  /* —— Les bosquets —— */
  {
    const pos: number[] = [];
    const col: number[] = [];
    for (const a of plan.arbres) {
      const r = Math.hypot(a.x, a.z);
      // Un arbre reste droit — un arbre penché a l'air ivre — mais on l'enfonce
      // de ce que la pente ferait décoller son pied côté aval.
      const enfoncement = Math.abs(pente(r)) * 0.5 + 0.05;
      ajouterArbre(pos, col, a.x, sol(r) - enfoncement, a.z, a.taille, a.graine);
    }
    if (pos.length) {
      object.add(garder(maillageFacette(pos, col, { shadows, nom: "campagne-arbres" })));
    }
  }

  /* —— Les voitures ——
     Elles bouclent sur la route, à des vitesses et des départs différents, et
     dans les deux sens. Une file qui roule au même pas se lit comme un
     convoi ; ce qu'on veut, c'est une départementale. */
  type Voiture = { group: THREE.Group; s0: number; vitesse: number; sens: 1 | -1; voie: number };
  const voitures: Voiture[] = [];
  const longueurTotale = longueurs[longueurs.length - 1]!;
  const combien = sobre ? 2 : 4;
  for (let i = 0; i < combien; i++) {
    const sens: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const g = makeVoiture(CARROSSERIES[Math.floor(rnd() * CARROSSERIES.length)]!, shadows);
    object.add(g);
    for (const enfant of g.children) if (enfant instanceof THREE.Mesh) garder(enfant);
    voitures.push({
      group: g,
      s0: (longueurTotale * i) / combien + rnd() * 6,
      vitesse: 4.2 + rnd() * 2.4,
      sens,
      voie: sens * ((DEMI_ROUTE - 0.42) / 2),
    });
  }

  /* —— Les engins des voisins ——
     Le vrai modèle du jeu, tracteur et outil attelés : un tracteur de décor
     dessiné à part finirait par ne plus ressembler à celui du garage. */
  type Engin = { rig: MachineRig; p: ParcelleVoisine; vitesse: number; phase: number };
  const engins: Engin[] = [];
  {
    /*
     * Un engin en réglage sobre, deux sinon — jamais zéro.
     *
     * La première version les supprimait entièrement en sobre. C'était traiter
     * le voisin au travail comme une garniture, alors que c'est précisément ce
     * qui distingue une campagne d'un fond d'écran ; et le réglage sobre
     * s'enclenche justement sur les appareils modestes, c'est-à-dire chez la
     * plupart des joueurs.
     */
    const outils = ["PLOUGH", "SEEDER", "DISC_HARROW"] as const;
    for (const p of plan.parcelles.filter((c) => c.travaille).slice(0, sobre ? 2 : 3)) {
      const rig = createMachineRig(outils[Math.floor(rnd() * outils.length)]!, {
        towed: true,
        shadows,
        seed: grainerDe(p.id) % 97,
      });
      rig.group.name = "campagne-engin";
      // Même échelle que les engins garés : un tracteur de voisin plus gros
      // que celui du garage trahirait aussitôt le décor.
      rig.group.scale.setScalar(0.72);
      object.add(rig.group);
      engins.push({ rig, p, vitesse: 1.5 + rnd() * 0.8, phase: rnd() * 10 });
    }
  }

  function update(t: number): void {
    for (const v of voitures) {
      const s = v.s0 + t * v.vitesse * v.sens;
      const p = surLaRoute(pointsRoute, longueurs, s);
      const nx = Math.cos(p.cap);
      const nz = -Math.sin(p.cap);
      const x = p.x + nx * v.voie;
      const z = p.z + nz * v.voie;
      v.group.position.set(x, sol(Math.hypot(x, z)) + 0.05, z);
      // L'assiette d'abord, le cap ensuite : à plat sur un monde bombé, la
      // voiture montrait le dessous de son châssis dans les descentes.
      _lacet.set(0, v.sens > 0 ? p.cap : p.cap + Math.PI, 0);
      v.group.quaternion.copy(assiette(x, z)).multiply(_qLacet.setFromEuler(_lacet));
    }
    for (const e of engins) {
      /*
       * Un aller-retour dans le sens des sillons.
       *
       * L'onde triangulaire donne une passe, un demi-tour, une passe en sens
       * inverse — et le cap suit le sens de marche, sans quoi l'engin
       * reculerait la moitié du temps.
       */
      const emprise = empriseParcelle(e.p);
      const course = Math.max(2, emprise.w - 1.6);
      const cycle = (course * 2) / e.vitesse;
      const u = (((t + e.phase) % cycle) + cycle) % cycle;
      const aller = u < cycle / 2;
      const avance = aller ? u / (cycle / 2) : 1 - (u - cycle / 2) / (cycle / 2);
      const long = -course / 2 + avance * course;
      // Le rang change à chaque passe : l'engin descend la parcelle.
      const passe = Math.floor((t + e.phase) / cycle);
      const rangs = Math.max(2, Math.round(emprise.d / 1.6));
      const trav = -emprise.d / 2 + 1 + ((passe % rangs) * (emprise.d - 2)) / rangs;
      const ex = e.p.x + long;
      const ez = e.p.z + trav;
      // Même assiette que la parcelle qu'il laboure : sinon l'engin flotte
      // au-dessus d'un côté du champ et s'enfonce dans l'autre.
      e.rig.group.position.set(ex, sol(Math.hypot(e.p.x, e.p.z)) + 0.16, ez);
      _lacet.set(0, aller ? Math.PI / 2 : -Math.PI / 2, 0);
      e.rig.group.quaternion
        .copy(assiette(e.p.x, e.p.z))
        .multiply(_qLacet.setFromEuler(_lacet));
      e.rig.update({ t, distance: t * e.vitesse, working: true });
    }
  }

  function setJour(jourDeJeu: number, saison: Season): void {
    poserParcelles(Math.floor(jourDeJeu), saison);
  }

  function dispose(): void {
    for (const e of engins) e.rig.dispose();
    engins.length = 0;
    if (nappeParcelles) {
      nappeParcelles.geometry.dispose();
      (nappeParcelles.material as THREE.Material).dispose();
      nappeParcelles = null;
    }
    for (const r of aJeter) r.dispose();
    aJeter.length = 0;
    object.clear();
  }

  poserParcelles(0, "SUMMER");
  return { object, plan, update, setJour, dispose };
}
