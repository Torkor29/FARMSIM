/**
 * La campagne, en volumes.
 *
 * La ferme flottait : une dalle de terre posée sur rien, quatre arbres, et le
 * ciel tout autour. Ce module lui met un pays sous les pieds.
 *
 * ## Plat, et cadré pour l'écran
 *
 * La version précédente bombait le sol pour se ménager un horizon. C'était
 * beaucoup de mal — un quaternion d'assiette par objet, une route redécoupée
 * pour ne pas s'enterrer dans les creux — au service d'un effet de globe qui
 * ne va pas à une vue isométrique.
 *
 * Le sol est donc plat, et l'horizon vient d'ailleurs : le monde **s'arrête**,
 * sur une ligne qui est droite à l'écran parce que le losange du sol est un
 * rectangle en projection isométrique. Au-delà, une lisière d'arbres, puis le
 * ciel. Voir `countryside-plan` pour le repère `u`/`v`.
 *
 * ## Des voisins, pas des tapis
 *
 * Les parcelles alentour sont bâties dans le même langage que celle du
 * joueur — une dalle de terre, un damier de cases, une haie autour, parfois un
 * bâtiment au bord — et sur la même trame, à la même taille, jointives.
 * Peintes en rectangles de couleur posés sur l'herbe, elles se lisaient comme
 * du papier découpé ; dispersées, elles ne racontaient pas une campagne.
 *
 * ## Le budget
 *
 * Tout ce qui ne bouge pas est fondu dans **un** maillage par famille : le
 * sol, les parcelles, la route, les bosquets. Trente parcelles de cent
 * quarante-quatre cases feraient quatre mille volumes ; elles en font un. Ce
 * qui bouge — voitures, engins — reste séparé et se compte sur les doigts
 * d'une main.
 */

import * as THREE from "three";
import type { Season } from "@farmsim/shared";
import { createMachineRig, type MachineRig } from "./machines3d";
import {
  ajouterArbre,
  ajouterBoite,
  ajouterGrange,
  CARROSSERIES,
  eclaircir,
  maillageFacette,
  makeVoiture,
} from "./decor3d";
import {
  couleurChamp,
  DEMI_ROUTE,
  etatChamp,
  grainerDe,
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
  /** Réglage sobre : moins de rangs, moins de voitures, un seul engin. */
  sobre?: boolean;
  /** Altitude du sol — sous le niveau de l'île du joueur. */
  y?: number;
  /** Cases par côté d'une parcelle voisine, comme sur celle du joueur. */
  cases?: number;
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

/** Épaisseur de la dalle de terre sous une parcelle voisine. */
const EPAISSEUR_DALLE = 0.3;

/** Hauteur à laquelle flotte une case cultivée au-dessus de sa dalle. */
const HAUT_CASE = 0.02;

/* ------------------------------------------------------------------ */
/* Le long de la route                                                 */
/* ------------------------------------------------------------------ */

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

/**
 * Une suite de coordonnées serrée près de zéro et lâche au loin.
 *
 * Le sol s'étend à cent cinquante unités en aval pour ne jamais montrer son
 * bord au zoom le plus large ; le pavé régulier qui donnerait des mailles
 * lisibles autour de la ferme en ferait alors des dizaines de milliers. La
 * maille grandit donc avec la distance — au loin, un carré de vingt unités ne
 * se distingue pas d'un carré de quatre.
 */
export function graduation(min: number, max: number, fin: number, facteur = 1.14): number[] {
  const out: number[] = [];
  // On part de zéro dans les deux sens : c'est là qu'est la ferme, donc là que
  // la maille doit être fine.
  for (const sens of [-1, 1] as const) {
    let x = 0;
    let pas = fin;
    const borne = sens < 0 ? min : max;
    while (sens < 0 ? x > borne : x < borne) {
      x += sens * pas;
      pas *= facteur;
      out.push(sens < 0 ? Math.max(x, borne) : Math.min(x, borne));
    }
  }
  out.push(0);
  return [...new Set(out)].sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ */
/* La campagne                                                         */
/* ------------------------------------------------------------------ */

/** Objets de travail réutilisés à chaque image — n'allouer que si nécessaire. */
const _lacet = new THREE.Euler();

export function createCountryside(o: OptionsCampagne): Campagne {
  const shadows = o.shadows ?? false;
  const sobre = o.sobre ?? false;
  const y0 = o.y ?? -0.5;
  const cases = o.cases ?? 12;
  const plan = planCampagne({
    ...o,
    colonnes: o.colonnes ?? (sobre ? 2 : 3),
    rangs: o.rangs ?? (sobre ? 2 : 3),
  });
  const rnd = suite(grainerDe(o.graine + ":volumes"));

  const object = new THREE.Group();
  object.name = "campagne";
  const aJeter: (THREE.BufferGeometry | THREE.Material)[] = [];
  const garder = <T extends THREE.Mesh>(m: T): T => {
    aJeter.push(m.geometry, m.material as THREE.Material);
    return m;
  };

  /* —— Le sol ——
     Un losange dans le monde, donc un rectangle à l'écran : son bord amont est
     la ligne d'horizon, et il est droit. Une emprise rectangulaire en x/z
     donnait à la place un coin de terre en haut d'un côté du cadre et du ciel
     de l'autre. */
  {
    const pos: number[] = [];
    const col: number[] = [];
    const teinte = new THREE.Color();
    const HERBE = 0x6aa259;
    const HERBE_LOIN = 0x7ba766;
    const { uMin, uMax, vMax } = plan.sol;
    const us = graduation(uMin, uMax, 4.2);
    const vs = graduation(-vMax, vMax, 4.2);
    /*
     * Du repère de l'écran vers celui du monde : x = (u + v)/2, z = (u − v)/2.
     *
     * Cette application **renverse l'orientation** — son déterminant vaut
     * −1/4. Un quadrilatère parcouru dans le bon sens en `u`/`v` sort donc
     * enroulé à l'envers dans le monde, et c'est ce qui s'est passé : le sol
     * entier était là, dans la bonne couleur, face cachée, et l'on voyait le
     * ciel entre les parcelles. On parcourt `v` avant `u`.
     */
    const pt = (u: number, v: number): [number, number, number] => [(u + v) / 2, y0, (u - v) / 2];

    for (let i = 0; i + 1 < us.length; i++) {
      for (let k = 0; k + 1 < vs.length; k++) {
        const u0 = us[i]!;
        const u1 = us[i + 1]!;
        const v0 = vs[k]!;
        const v1 = vs[k + 1]!;
        // La perspective aérienne avant la brume : les prés du fond tirent vers
        // le gris-vert, ce qui donne la distance même par temps clair.
        const loin = Math.min(1, Math.max(0, (-((u0 + u1) / 2) - 6) / 26));
        /*
         * Un souffle de variation, pas un patchwork. À ±6 % les mailles du
         * lointain — qui font vingt unités de côté — se lisaient comme des
         * limites de champs peintes sur le pré : on croyait à des parcelles
         * fantômes derrière la lisière.
         */
        teinte
          .setHex(HERBE)
          .lerp(new THREE.Color(HERBE_LOIN), loin)
          .multiplyScalar(0.985 + rnd() * 0.03);
        quad(pos, col, pt(u0, v0), pt(u0, v1), pt(u1, v1), pt(u1, v0), teinte);
      }
    }
    object.add(garder(maillageFacette(pos, col, { recoit: shadows, nom: "campagne-sol" })));
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

  /** Le pas d'une case, déduit de l'emprise : le damier remplit la parcelle. */
  const pasCase = (plan.emprise - 1.4) / cases;

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
    const teinte = new THREE.Color();
    const emprise = plan.emprise;

    for (const p of plan.parcelles) {
      const grain = suite(grainerDe(p.id));
      const base = couleurChamp(p.culture, etatChamp(p, jour, saison));

      // La dalle de terre, qui donne son talus à la parcelle — la même que
      // celle de l'île, pour que la campagne ne soit pas un étage plus bas.
      ajouterBoite(
        pos, col, p.x, y0 - EPAISSEUR_DALLE / 2 + 0.02, p.z,
        emprise, EPAISSEUR_DALLE + 0.04, emprise, TERRE_DALLE,
      );

      /*
       * Le damier, en quadrilatères plats et non en pavés.
       *
       * Trente parcelles de cent quarante-quatre cases : en volumes, c'est un
       * million de sommets pour un décor qu'on regarde de loin. À plat, c'est
       * trente mille, et à cette distance la tranche d'une case ne se voit pas.
       */
      const y = y0 + HAUT_CASE;
      const o0 = -((cases - 1) * pasCase) / 2;
      const demi = pasCase * 0.46;
      for (let i = 0; i < cases; i++) {
        for (let k = 0; k < cases; k++) {
          const cx = p.x + o0 + i * pasCase;
          const cz = p.z + o0 + k * pasCase;
          // Une teinte par case, très légèrement différente : un aplat parfait
          // se lit comme une nappe, pas comme un champ.
          teinte.setHex(eclaircir(base, (grain() - 0.5) * 0.12));
          quad(
            pos, col,
            [cx - demi, y, cz - demi],
            [cx + demi, y, cz - demi],
            [cx + demi, y, cz + demi],
            [cx - demi, y, cz + demi],
            teinte,
          );
        }
      }

      // La haie, sur les quatre bords.
      const ep = 0.24;
      for (const [dx, dz, w, dd] of [
        [0, -emprise / 2, emprise, ep],
        [0, emprise / 2, emprise, ep],
        [-emprise / 2, 0, ep, emprise],
        [emprise / 2, 0, ep, emprise],
      ] as const) {
        ajouterBoite(pos, col, p.x + dx, y0 + 0.2, p.z + dz, w, 0.4, dd, HAIE);
      }

      // Parfois une grange au bord : c'est elle qui fait la ferme du voisin
      // plutôt qu'un simple champ.
      if (p.batiment) {
        const bx = p.x + (emprise / 2 - 1.5) * (grain() < 0.5 ? -1 : 1);
        const bz = p.z + (emprise / 2 - 1.4) * (grain() < 0.5 ? -1 : 1);
        ajouterGrange(pos, col, bx, y0 + 0.02, bz, grain() < 0.5 ? 0 : Math.PI / 2, grainerDe(p.id + ":grange"));
      }
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
    const bitume = new THREE.Color(0x53535a);
    const accotement = new THREE.Color(0x8e9a6a);
    const ligne = new THREE.Color(0xdedac9);
    const gravier = new THREE.Color(0xb5a687);

    /**
     * Un ruban posé au sol le long d'une polyligne.
     *
     * Plus besoin de redécouper : le sol est plat, un long segment ne passe
     * plus sous le terrain en son milieu.
     */
    const ruban = (pts: PointPlan[], demi: number, y: number, teinte: THREE.Color, bord: THREE.Color | null) => {
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
        const c = (pt: PointPlan, nn: PointPlan, k: number): [number, number, number] => [
          pt.x + nn.x * k,
          y,
          pt.z + nn.z * k,
        ];
        quad(pos, col, c(p, np, -demi), c(q, nq, -demi), c(q, nq, demi), c(p, np, demi), teinte);
        if (!bord) continue;
        for (const s of [-1, 1]) {
          // Toujours du décalage le plus petit vers le plus grand : écrit
          // « du bord vers l'extérieur », l'accotement de gauche parcourait le
          // quadrilatère à l'envers et se retrouvait face au sol.
          const lo = Math.min(s * demi, s * (demi + 0.5));
          const hi = Math.max(s * demi, s * (demi + 0.5));
          quad(pos, col, c(p, np, lo), c(q, nq, lo), c(q, nq, hi), c(p, np, hi), bord);
        }
      }
    };

    // L'accotement d'abord, la chaussée par-dessus : deux nappes au même
    // millimètre se battent en profondeur et clignotent.
    ruban(pointsRoute, DEMI_ROUTE - 0.5, y0 + 0.03, bitume, accotement);
    ruban(plan.desserte, 1.0, y0 + 0.025, gravier, null);

    // La médiane, en pointillés : deux mètres de trait, trois de vide.
    const total = longueurs[longueurs.length - 1]!;
    for (let s = 2; s < total - 2; s += 5) {
      const a = surLaRoute(pointsRoute, longueurs, s);
      const b = surLaRoute(pointsRoute, longueurs, s + 2);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1;
      const nn = { x: -dz / l, z: dx / l };
      const k = 0.08;
      const c = (p: { x: number; z: number }, signe: number): [number, number, number] => [
        p.x + nn.x * k * signe,
        y0 + 0.04,
        p.z + nn.z * k * signe,
      ];
      quad(pos, col, c(a, -1), c(b, -1), c(b, 1), c(a, 1), ligne);
    }
    object.add(garder(maillageFacette(pos, col, { nom: "campagne-route" })));
  }

  /* —— Les bosquets —— */
  {
    const pos: number[] = [];
    const col: number[] = [];
    for (const a of plan.arbres) {
      ajouterArbre(pos, col, a.x, y0 - 0.05, a.z, a.taille, a.graine);
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
  /*
   * Le circuit du trafic, et non la route entière.
   *
   * La route traverse tout le sol — cent soixante unités — pour ne jamais
   * s'arrêter en plein champ. Quatre voitures réparties sur cette longueur
   * passent donc l'essentiel de leur temps hors cadre : mesuré en jeu, aucune
   * n'était visible sur six captures d'affilée. Elles bouclent sur la portion
   * qui peut être à l'écran, et la route garde sa longueur.
   */
  const FENETRE = 96;
  // L'abscisse curviligne à l'aplomb de la ferme : la route est droite et
  // parallèle à l'axe des `x`, l'arc s'y confond avec l'abscisse.
  const sCentre = -pointsRoute[0]!.x;
  const sDebut = Math.max(0, Math.min(longueurTotale - FENETRE, sCentre - FENETRE / 2));
  const combien = sobre ? 3 : 5;
  for (let i = 0; i < combien; i++) {
    const sens: 1 | -1 = i % 2 === 0 ? 1 : -1;
    const g = makeVoiture(CARROSSERIES[Math.floor(rnd() * CARROSSERIES.length)]!, shadows);
    object.add(g);
    for (const enfant of g.children) if (enfant instanceof THREE.Mesh) garder(enfant);
    voitures.push({
      group: g,
      s0: (FENETRE * i) / combien + rnd() * 8,
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
    for (const p of plan.parcelles.filter((c) => c.travaille).slice(0, sobre ? 1 : 2)) {
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
      const parcouru = v.s0 + t * v.vitesse * v.sens;
      const s = sDebut + (((parcouru % FENETRE) + FENETRE) % FENETRE);
      const p = surLaRoute(pointsRoute, longueurs, s);
      const nx = Math.cos(p.cap);
      const nz = -Math.sin(p.cap);
      v.group.position.set(p.x + nx * v.voie, y0 + 0.05, p.z + nz * v.voie);
      _lacet.set(0, v.sens > 0 ? p.cap : p.cap + Math.PI, 0);
      v.group.quaternion.setFromEuler(_lacet);
    }
    for (const e of engins) {
      /*
       * Un aller-retour dans le sens des sillons, à l'intérieur de la parcelle.
       *
       * L'onde triangulaire donne une passe, un demi-tour, une passe en sens
       * inverse — et le cap suit le sens de marche, sans quoi l'engin
       * reculerait la moitié du temps. Il ne sort jamais de son champ : c'est
       * ce qui manquait à la version d'avant, où les tracteurs faisaient des
       * allers-retours d'un bout à l'autre de la campagne.
       */
      const cote = plan.emprise - 2.2;
      const cycle = (cote * 2) / e.vitesse;
      const u = (((t + e.phase) % cycle) + cycle) % cycle;
      const aller = u < cycle / 2;
      const avance = aller ? u / (cycle / 2) : 1 - (u - cycle / 2) / (cycle / 2);
      const long = -cote / 2 + avance * cote;
      // Le rang change à chaque passe : l'engin descend la parcelle.
      const passe = Math.floor((t + e.phase) / cycle);
      const rangs = Math.max(2, Math.round(cote / 1.8));
      const trav = -cote / 2 + ((((passe % rangs) + rangs) % rangs) * cote) / (rangs - 1 || 1);
      e.rig.group.position.set(e.p.x + long, y0 + 0.06, e.p.z + trav);
      _lacet.set(0, aller ? Math.PI / 2 : -Math.PI / 2, 0);
      e.rig.group.quaternion.setFromEuler(_lacet);
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
