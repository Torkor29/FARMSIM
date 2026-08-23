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
import { BUILDING_DEFS, type BuildingType, type Season } from "@farmsim/shared";
import { createMachineRig, type MachineRig } from "./machines3d";
import {
  ajouterArbre,
  ajouterBete,
  ajouterBoite,
  ajouterGrange,
  CARROSSERIES,
  eclaircir,
  maillageFacette,
  makeVoiture,
} from "./decor3d";
import { creerVoisinDetaille, type VoisinDetaille } from "./voisin3d";
import {
  couleurChamp,
  type EtatChamp,
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
  /**
   * Où le joueur regarde, en unités monde.
   *
   * C'est ce qui décide des parcelles à détailler. Appelé à chaque
   * déplacement de caméra ; le travail n'a lieu que si le choix change.
   */
  setCentreVue(x: number, z: number): void;
  dispose(): void;
};

/**
 * Combien de parcelles passent en détail plein à la fois.
 *
 * Trois, et une seule en réglage sobre. Ce n'est pas une estimation prudente :
 * un champ détaillé, ce sont plusieurs milliers de brins instanciés, les vrais
 * modèles de bâtiment et cinq bêtes articulées. Trente parcelles à ce régime
 * feraient de la campagne le poste le plus cher de la vue, loin devant la
 * ferme du joueur — qui est pourtant ce qu'on regarde.
 */
export const DETAILS_MAX = 3;

/**
 * Au-delà de cette distance du regard, une parcelle reste en nappe.
 *
 * Sans elle, les trois plus proches passeraient en détail même quand le joueur
 * regarde à l'autre bout de la commune : on paierait des brins qu'on ne
 * distingue plus.
 */
export const PORTEE_DETAIL = 1.6;

/**
 * Les états où la terre se voit — donc où un labour laisse une trace.
 *
 * Sur un champ debout, la bande de terre fraîche passerait sous les brins et
 * ne se remarquerait pas ; et l'on ne laboure pas une culture sur pied.
 */
const TERRE_VISIBLE = new Set<EtatChamp>(["LABOUR", "CHAUME", "JACHERE", "SEMIS"]);

/**
 * La géométrie d'une parcelle voisine, copiée sur celle du joueur.
 *
 * Ces trois nombres sont ceux de la vue ferme — `TILE_THICK`, l'épaisseur de
 * la plateforme, l'écart entre deux cases. Ils ne sont pas approchés à l'œil :
 * « ça doit ressembler à la nôtre » veut dire les mêmes volumes, et une case
 * de voisin plus mince ou plus jointive que la sienne se remarque d'un coup
 * d'œil.
 *
 * Le défaut d'avant tenait à un seul de ces chiffres. La dalle culminait à
 * `y0 + 0,04` et les cases étaient posées à `y0 + 0,02` : **le damier entier
 * était enterré dans le talus**, et l'on ne voyait qu'un aplat de terre. Les
 * cultures et les sillons, posés à la même hauteur, l'étaient aussi. D'où
 * cette règle, désormais explicite : la surface du champ est `y0`, tout le
 * reste s'y rapporte, et la dalle passe dessous.
 */
export const CASE_EP = 0.18;
export const DALLE_EP = 0.45;
export const DALLE_HAUT = -0.055;

/** Écart entre deux cases, comme sur la grille du joueur. */
const JOINT = 0.06;

/**
 * Le dessus d'une case : c'est là que se posent les cultures et les sillons.
 *
 * Une case est un pavé centré sur la surface du champ — la moitié dépasse.
 * Écrit en dur ailleurs, ce demi-centimètre de trop enterrait les brins dans
 * la terre.
 */
const HAUT_CASE = CASE_EP / 2 + 0.004;

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

/**
 * La marche d'une voiture le long de la fenêtre de trafic.
 *
 * Rend une fonction qui va du temps normalisé — zéro à l'entrée, un à la
 * sortie — à la position normalisée. Ce n'est délibérément pas l'identité :
 * la voiture **ralentit en passant devant la ferme** et reprend après.
 *
 * C'est le correctif du reproche « les animations sont mauvaises ». Une
 * voiture qui traverse le cadre à vitesse rigoureusement constante se lit
 * comme un objet tiré par une ficelle, quel que soit le soin mis au modèle.
 * Une rampe linéaire, l'œil ne la pardonne pas.
 *
 * On intègre le profil de vitesse une fois, à la construction, plutôt que de
 * l'appliquer par image : appliquer un facteur à la vitesse image par image
 * ferait dépendre la position du pas de temps, et deux machines n'auraient pas
 * la même route.
 */
export function marcheVoiture(pFerme: number, creux = 0.45, largeur = 0.12): (q: number) => number {
  const N = 48;
  const bornes = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    const p = (i + 0.5) / N;
    const d = (p - pFerme) / largeur;
    // Le temps de franchir la tranche, c'est l'inverse de la vitesse.
    bornes[i + 1] = bornes[i]! + 1 / (1 - creux * Math.exp(-0.5 * d * d));
  }
  const total = bornes[N]!;
  for (let i = 0; i <= N; i++) bornes[i] = bornes[i]! / total;
  return (q) => {
    const k = Math.min(1, Math.max(0, q));
    let i = 0;
    while (i < N - 1 && bornes[i + 1]! < k) i++;
    const a = bornes[i]!;
    const b = bornes[i + 1]!;
    return (i + (b > a ? (k - a) / (b - a) : 0)) / N;
  };
}

/**
 * Le pas d'un engin au travail dans son champ.
 *
 * Coordonnées locales à la parcelle, centre en (0, 0).
 */
export type PasDeTravail = {
  x: number;
  z: number;
  /** Cap, radians, dans la convention du jeu : `atan2(dx, dz)`. */
  cap: number;
  /** Outil posé. Faux pendant le demi-tour : on relève en fourrière. */
  travaille: boolean;
  /** Braquage, de −1 (gauche) à 1 (droite). */
  braquage: number;
  /** Part du champ déjà travaillée, de 0 à 1. */
  avancement: number;
};

/** Durée d'un demi-tour en bout de champ, secondes. */
export const DEMI_TOUR = 3.2;

/**
 * Durée du retour à la première ligne, une fois le champ fini.
 *
 * Plus long qu'un demi-tour parce que le trajet l'est : à durée égale, l'engin
 * traversait la parcelle deux fois plus vite qu'il ne la travaille, et le
 * saut de vitesse se voyait plus que la manœuvre.
 */
export const RETOUR = DEMI_TOUR * 2.4;

/**
 * Ce qu'on laisse tout autour du champ, en unités monde.
 *
 * On ne laboure pas jusqu'à la haie : il faut de quoi tourner. Cette marge
 * n'est donc pas une précaution de dessin, c'est la fourrière — et elle est
 * aussi ce qui garde les manœuvres à l'intérieur de la parcelle. Mesuré sans
 * elle : la courbe de retour dépassait le bord d'un centimètre et demi, et
 * l'engin roulait sur le chemin.
 */
export const MARGE_FOURRIERE = 3;

/** La longueur travaillée d'un champ, fourrière déduite. */
export function coteTravail(emprise: number): number {
  return Math.max(2, emprise - MARGE_FOURRIERE);
}

/**
 * Le lacet à donner au modèle d'un engin qui va dans la direction `cap`.
 *
 * Deux conventions se croisent ici, et leur rencontre silencieuse est ce qui
 * faisait rouler les tracteurs de voisin **en crabe** : capot vers le rang
 * d'à côté pendant qu'ils descendaient leur ligne. Rien dans la trajectoire
 * n'était faux — c'est bien ce qui rendait le défaut si difficile à situer.
 *
 * La campagne raisonne en relèvement, `atan2(dx, dz)` : c'est ce que rend la
 * route, et c'est ce qu'attendent les carrosseries de `decor3d`, bâties vers
 * les Z. Les machines de `machines3d`, elles, sont bâties vers les X — nez en
 * `+X`, outil traîné vers les `−X`. Un quart de tour d'écart, exactement.
 *
 * On ne corrige donc pas le cap dans `cycleTravail` : il y est juste, et la
 * route s'en sert. On traduit ici, une fois, à l'endroit où le modèle est
 * posé — et le nom dit de quoi il s'agit.
 */
export function lacetEngin(cap: number): number {
  return cap - Math.PI / 2;
}

/**
 * Le cycle de travail d'un engin : des passes, et des demi-tours.
 *
 * La version d'avant faisait un aller-retour sur une onde triangulaire : le
 * tracteur atteignait le bout du champ, s'arrêtait net et repartait en marche
 * arrière visuelle, outil posé, sur exactement la même ligne. C'était le fond
 * du reproche « les animations sont mauvaises » — pas le modèle, le mouvement.
 *
 * Ici il fait ce que fait un tracteur : il tire une passe à vitesse de
 * travail, **relève l'outil**, tourne en fourrière par un demi-cercle qui
 * déborde du champ, redescend l'outil et repart sur la ligne d'à côté. Le
 * demi-tour est lissé aux deux bouts — un braquage qui claque se voit plus
 * qu'il ne raconte.
 */
export function cycleTravail(
  t: number,
  o: { cote: number; rangs: number; largeur: number; vitesse: number },
): PasDeTravail {
  const rangs = Math.max(1, Math.round(o.rangs));
  const tPasse = Math.max(0.1, o.cote / Math.max(0.1, o.vitesse));
  const parPasse = tPasse + DEMI_TOUR;
  // La dernière passe se termine par un retour, plus long qu'un demi-tour.
  const avantDerniere = (rangs - 1) * parPasse;
  const cycle = avantDerniere + tPasse + RETOUR;
  const u = ((t % cycle) + cycle) % cycle;
  const dansLaTrame = u < avantDerniere;
  const passe = dansLaTrame ? Math.floor(u / parPasse) : rangs - 1;
  const dans = u - passe * parPasse;
  // Une passe sur deux dans l'autre sens : c'est ce qui fait des allers-retours
  // et non un retour à vide au bout de chaque ligne.
  const sens = passe % 2 === 0 ? 1 : -1;
  const z = -((rangs - 1) * o.largeur) / 2 + passe * o.largeur;

  if (dans < tPasse) {
    const p = dans / tPasse;
    return {
      x: sens * (-o.cote / 2 + p * o.cote),
      z,
      cap: sens > 0 ? Math.PI / 2 : -Math.PI / 2,
      travaille: true,
      braquage: 0,
      avancement: (passe + p) / rangs,
    };
  }

  const q = (dans - tPasse) / (passe < rangs - 1 ? DEMI_TOUR : RETOUR);
  const lisse = Math.min(1, q * q * (3 - 2 * q));
  const bout = (sens * o.cote) / 2;

  if (passe < rangs - 1) {
    /*
     * Le demi-tour : un demi-cercle qui déborde du bout du champ, de rayon la
     * moitié de l'écartement — c'est la manœuvre réelle, et c'est elle qui
     * donne la fourrière, cette bande de terre tassée au bout des parcelles.
     */
    const angle = -Math.PI / 2 + lisse * Math.PI;
    const r = o.largeur / 2;
    return {
      x: bout + sens * r * Math.cos(angle),
      z: z + r + r * Math.sin(angle),
      cap: Math.atan2(-sens * Math.sin(angle), Math.cos(angle)),
      travaille: false,
      braquage: sens * Math.sin(lisse * Math.PI),
      avancement: (passe + 1) / rangs,
    };
  }

  /*
   * La dernière passe finie, il rentre.
   *
   * Sans ce retour, le cycle repartait de la première ligne et l'engin s'y
   * **téléportait** : mesuré, un bond de dix unités d'un bout du champ à
   * l'autre, une fois par cycle. Et son demi-tour visait un rang qui n'existe
   * pas, donc il sortait de la parcelle par le bas.
   *
   * Le trajet est une courbe d'Hermite : elle part dans l'axe de la dernière
   * passe et arrive dans l'axe de la première, si bien que ni la position ni
   * le cap ne sautent aux raccords. Un segment droit aurait fait pivoter
   * l'engin sur place à chaque bout.
   */
  const z0 = -((rangs - 1) * o.largeur) / 2;
  const p0x = bout;
  const p0z = z;
  const p1x = -o.cote / 2;
  const p1z = z0;
  /*
   * La raideur des tangentes règle le ventre de la courbe. À neuf dixièmes de
   * la distance, mesuré, l'engin débordait du bout du champ d'une unité — plus
   * que la fourrière elle-même. À moins de la moitié, le ventre tient dedans.
   */
  const portee = Math.hypot(p1x - p0x, p1z - p0z) * 0.45;
  // Tangentes : le sens de la dernière passe au départ, celui de la première
  // à l'arrivée. Les passes courent le long des `x`.
  const t0x = sens * portee;
  const t1x = portee;
  const h00 = 2 * lisse ** 3 - 3 * lisse ** 2 + 1;
  const h10 = lisse ** 3 - 2 * lisse ** 2 + lisse;
  const h01 = -2 * lisse ** 3 + 3 * lisse ** 2;
  const h11 = lisse ** 3 - lisse ** 2;
  const d00 = 6 * lisse ** 2 - 6 * lisse;
  const d10 = 3 * lisse ** 2 - 4 * lisse + 1;
  const d01 = -6 * lisse ** 2 + 6 * lisse;
  const d11 = 3 * lisse ** 2 - 2 * lisse;
  const vx = d00 * p0x + d10 * t0x + d01 * p1x + d11 * t1x;
  const vz = d00 * p0z + d01 * p1z;
  /*
   * Les roues avant suivent la courbe qu'elles décrivent.
   *
   * Ce retour annonçait un braquage nul, et l'engin traversait tout le champ
   * en S avec les roues rigoureusement droites : la seule manœuvre qu'on voie
   * en entier, et la seule où rien ne braquait. On tire donc l'angle de la
   * courbure signée de la trajectoire, ramenée à l'échelle du demi-tour — où
   * un rayon de `largeur / 2` vaut braquage à fond.
   */
  const a00 = 12 * lisse - 6;
  const a10 = 6 * lisse - 4;
  const a01 = -12 * lisse + 6;
  const a11 = 6 * lisse - 2;
  const ax = a00 * p0x + a10 * t0x + a01 * p1x + a11 * t1x;
  const az = a00 * p0z + a01 * p1z;
  const v2 = vx * vx + vz * vz;
  const courbure = v2 > 1e-9 ? (vx * az - vz * ax) / v2 ** 1.5 : 0;
  return {
    x: h00 * p0x + h10 * t0x + h01 * p1x + h11 * t1x,
    z: h00 * p0z + h01 * p1z,
    cap: Math.atan2(vx, vz),
    travaille: false,
    braquage: Math.max(-1, Math.min(1, courbure * (o.largeur / 2))),
    avancement: 1,
  };
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

  /*
   * Les parcelles montrées en détail plein, par identifiant.
   *
   * La nappe fusionnée continue de porter leur dalle, leur damier et leur
   * haie — c'est le sol du champ, et il ne coûte rien. Ce qu'elle ne dessine
   * plus pour elles, c'est la grange générique : le détail pose les vrais
   * bâtiments, aux vraies places, et deux granges superposées se verraient.
   */
  const detailles = new Map<string, VoisinDetaille>();
  let clefDetail = "";

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
      /*
       * L'état lu sur la carte l'emporte sur le cycle déduit du jour : quand
       * on sait ce que le voisin a semé, il n'y a plus rien à deviner. Le
       * cycle ne sert qu'aux parcelles de décor, au-delà de la commune.
       */
      const base = couleurChamp(p.culture, p.etat ?? etatChamp(p, jour, saison));

      // Le talus de terre qui porte le champ — la plateforme de l'île, à
      // l'identique, et posée sous la surface plutôt qu'au travers.
      ajouterBoite(
        pos, col, p.x, y0 + DALLE_HAUT - DALLE_EP / 2, p.z,
        emprise, DALLE_EP, emprise, TERRE_DALLE,
      );

      /*
       * Le damier, en **pavés** et non en aplats.
       *
       * Une case du joueur est un volume de dix-huit centimètres d'épaisseur :
       * c'est sa tranche, prise de biais par la lumière, qui dessine la
       * grille. Peintes à plat, les cases du voisin ne montraient qu'un
       * dégradé de teintes — et l'on voyait bien que ce n'était pas le même
       * champ. Quarante parcelles de cent quarante-quatre pavés font cent
       * cinquante mille sommets dans **un** maillage : un seul appel de rendu,
       * ce que la carte encaisse sans broncher. En réglage sobre on retombe
       * sur des aplats, où c'est la cadence qui prime.
       */
      const o0 = -((cases - 1) * pasCase) / 2;
      const taille = pasCase - JOINT;
      const demi = taille / 2;
      for (let i = 0; i < cases; i++) {
        for (let k = 0; k < cases; k++) {
          const cx = p.x + o0 + i * pasCase;
          const cz = p.z + o0 + k * pasCase;
          // Une teinte par case, très légèrement différente : un aplat parfait
          // se lit comme une nappe, pas comme un champ.
          teinte.setHex(eclaircir(base, (grain() - 0.5) * 0.12));
          if (sobre) {
            quad(
              pos, col,
              [cx - demi, y0 + CASE_EP / 2, cz - demi],
              [cx + demi, y0 + CASE_EP / 2, cz - demi],
              [cx + demi, y0 + CASE_EP / 2, cz + demi],
              [cx - demi, y0 + CASE_EP / 2, cz + demi],
              teinte,
            );
          } else {
            ajouterBoite(pos, col, cx, y0, cz, taille, CASE_EP, taille, teinte.getHex());
          }
        }
      }

      // La haie, sur les quatre bords, à la hauteur de celle de l'île.
      const bordHaie = (emprise - 0.5) / 2;
      const ep = 0.28;
      for (const [dx, dz, w, dd] of [
        [0, -bordHaie, bordHaie * 2, ep],
        [0, bordHaie, bordHaie * 2, ep],
        [-bordHaie, 0, ep, bordHaie * 2],
        [bordHaie, 0, ep, bordHaie * 2],
      ] as const) {
        ajouterBoite(pos, col, p.x + dx, y0 + 0.15, p.z + dz, w, 0.55, dd, HAIE);
      }

      /*
       * Les bâtiments du cadastre, à leur emprise et à leur place.
       *
       * Une grange générique tirée au sort dans un coin racontait la même
       * chose de toutes les fermes. Ici un silo n'a pas la carrure d'un
       * poulailler, et l'étable est là où l'exploitant l'a bâtie.
       *
       * Les parcelles détaillées reçoivent les vrais modèles — voir
       * `voisin3d` — et sont donc sautées ici, sinon deux bâtiments se
       * superposeraient.
       */
      if (!detailles.has(p.id)) {
        for (const b of p.reel?.batiments ?? []) {
          const def = BUILDING_DEFS[b.type as BuildingType];
          if (!def) continue;
          const quarts = (((b.rotation ?? 0) % 4) + 4) % 4;
          const fw = quarts % 2 === 0 ? def.w : def.h;
          const fh = quarts % 2 === 0 ? def.h : def.w;
          ajouterGrange(
            pos, col,
            p.x + o0 + (b.x + (fw - 1) / 2) * pasCase,
            y0 + CASE_EP / 2,
            p.z + o0 + (b.y + (fh - 1) / 2) * pasCase,
            quarts * (Math.PI / 2),
            grainerDe(`${p.id}:${b.x},${b.y}`),
            /*
             * La hauteur suit le **petit** côté, pas la surface. Réglée sur la
             * largeur, une étable de quatre cases sur trois sortait longue et
             * plate comme un quai de gare : c'est la profondeur qui donne sa
             * carrure à un bâtiment agricole, parce que c'est elle qui porte
             * la charpente.
             */
            {
              l: fw * pasCase,
              prof: fh * pasCase,
              h: 0.5 + Math.min(fw, fh) * pasCase * 0.42,
            },
          );
        }
        // Faute de cadastre — au-delà de la commune — on garde la grange de
        // décor : une ferme sans un seul bâtiment n'a l'air de rien.
        if (!p.reel && p.batiment) {
          ajouterGrange(
            pos, col,
            p.x + (emprise / 2 - 1.5) * (grain() < 0.5 ? -1 : 1),
            y0 + CASE_EP / 2,
            p.z + (emprise / 2 - 1.4) * (grain() < 0.5 ? -1 : 1),
            grain() < 0.5 ? 0 : Math.PI / 2,
            grainerDe(p.id + ":grange"),
          );
        }

        /*
         * Et le cheptel, sur toutes les parcelles d'élevage.
         *
         * Il n'apparaissait que sur les trois parcelles détaillées : une ferme
         * laitière du fond n'avait pas une bête. Des silhouettes fondues dans
         * le maillage coûtent sept pavés chacune, et disent la même chose à
         * cette distance.
         */
        for (const troupeau of p.reel?.cheptel ?? []) {
          const combien = Math.min(4, troupeau.size);
          for (let i = 0; i < combien; i++) {
            const a = grain() * Math.PI * 2;
            const r = emprise * (0.1 + grain() * 0.22);
            ajouterBete(
              pos, col,
              p.x + Math.cos(a) * r,
              y0 + CASE_EP / 2,
              p.z + Math.sin(a) * r,
              grain() * Math.PI * 2,
              troupeau.kind,
            );
          }
        }
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
  type Voiture = {
    group: THREE.Group;
    /** Durée d'un passage devant la ferme, en secondes. */
    passage: number;
    /** Le cycle entier : le passage, puis l'attente hors champ. */
    cycle: number;
    /** Décalage du départ dans le cycle. */
    depart: number;
    /** Du temps normalisé à la position normalisée. Voir `marcheVoiture`. */
    marche: (q: number) => number;
    sens: 1 | -1;
    voie: number;
  };
  const voitures: Voiture[] = [];
  const longueurTotale = longueurs[longueurs.length - 1]!;
  /*
   * Le circuit du trafic, et non la route entière.
   *
   * La route traverse tout le sol — cent soixante unités — pour ne jamais
   * s'arrêter en plein champ. Des voitures réparties sur cette longueur
   * passeraient l'essentiel de leur temps hors cadre : mesuré en jeu, aucune
   * n'était visible sur six captures d'affilée. Elles bouclent sur la portion
   * qui peut être à l'écran, et la route garde sa longueur.
   */
  const FENETRE = 96;
  // L'abscisse curviligne à l'aplomb de la ferme : la route est droite et
  // parallèle à l'axe des `x`, l'arc s'y confond avec l'abscisse.
  const sCentre = -pointsRoute[0]!.x;
  const sDebut = Math.max(0, Math.min(longueurTotale - FENETRE, sCentre - FENETRE / 2));
  const pFerme = Math.min(0.9, Math.max(0.1, (sCentre - sDebut) / FENETRE));
  const marches = { 1: marcheVoiture(pFerme), [-1]: marcheVoiture(1 - pFerme) } as const;
  /*
   * Deux voitures, et de longs silences.
   *
   * Il y en avait cinq, en file continue : sur une départementale de campagne,
   * cela fait un périphérique. Une route de commune est vide la plupart du
   * temps — et c'est le vide qui rend le passage remarquable. Chaque voiture
   * traverse, puis disparaît une demi-minute avant de revenir ; comme les deux
   * cycles n'ont pas la même durée, elles ne se croisent jamais au même
   * endroit.
   */
  for (let i = 0; i < 2; i++) {
    const sens: 1 | -1 = i === 0 ? 1 : -1;
    const g = makeVoiture(CARROSSERIES[Math.floor(rnd() * CARROSSERIES.length)]!, shadows);
    g.visible = false;
    object.add(g);
    for (const enfant of g.children) if (enfant instanceof THREE.Mesh) garder(enfant);
    const passage = FENETRE / (4.6 + rnd() * 2.2);
    voitures.push({
      group: g,
      passage,
      cycle: passage + 26 + rnd() * 22,
      depart: rnd() * 40,
      marche: marches[sens],
      sens,
      voie: sens * ((DEMI_ROUTE - 0.42) / 2),
    });
  }

  /* —— Les engins des voisins ——
     Le vrai modèle du jeu, tracteur et outil attelés : un tracteur de décor
     dessiné à part finirait par ne plus ressembler à celui du garage. */
  type Engin = {
    rig: MachineRig;
    p: ParcelleVoisine;
    vitesse: number;
    phase: number;
    /** Le nombre de passes que le champ demande, largeur d'outil comprise. */
    rangs: number;
    /** La terre retournée derrière lui, dévoilée au fur et à mesure. */
    sillons: THREE.Mesh;
    /** Sommets par passe, pour régler la plage de dessin. */
    parPasse: number;
    /** Odomètre : ce que le sol a défilé sous lui, en unités monde. */
    parcouru: number;
    dernierX: number;
    dernierZ: number;
  };
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

      /*
       * La terre qu'il laisse derrière lui.
       *
       * Un tracteur qui laboure sans que rien ne change ne travaille pas, il
       * fait les cent pas — c'était le défaut. Les bandes sont toutes bâties
       * d'avance, dans l'ordre où l'engin les prend, et l'on ne dévoile que
       * celles qu'il a faites : régler une plage de dessin ne coûte rien, là
       * où reconstruire un maillage par image coûterait la fluidité.
       */
      const cote = coteTravail(plan.emprise);
      const largeur = 1.8;
      const rangs = Math.max(2, Math.round(cote / largeur));
      const segments = 8;
      const posS: number[] = [];
      const colS: number[] = [];
      /*
       * La couleur de la terre fraîche se tire de celle du champ, assombrie.
       *
       * Une teinte fixe ne marchait pas : posée sur un champ déjà labouré —
       * brun sur brun — la bande était invisible, et le tracteur avait l'air
       * de ne rien faire. Vérifié à l'écran. Assombrir ce qui est là garantit
       * le contraste quel que soit l'état du champ, et dit la bonne chose :
       * une terre qu'on vient de retourner est plus sombre et plus humide que
       * sa voisine.
       */
      const terre = new THREE.Color(
        eclaircir(couleurChamp(p.culture, p.etat ?? "POUSSE"), -0.42),
      );
      for (let k = 0; k < rangs; k++) {
        const sens = k % 2 === 0 ? 1 : -1;
        const zc = p.z - ((rangs - 1) * largeur) / 2 + k * largeur;
        for (let i = 0; i < segments; i++) {
          // Dans le sens de marche : la bande se dévoile derrière la roue et
          // non d'un bout figé de la parcelle.
          const a = sens * (-cote / 2 + (i / segments) * cote);
          const b = sens * (-cote / 2 + ((i + 1) / segments) * cote);
          const x0 = p.x + Math.min(a, b);
          const x1 = p.x + Math.max(a, b);
          quad(
            posS, colS,
            [x0, y0 + HAUT_CASE + 0.006, zc - largeur / 2],
            [x1, y0 + HAUT_CASE + 0.006, zc - largeur / 2],
            [x1, y0 + HAUT_CASE + 0.006, zc + largeur / 2],
            [x0, y0 + HAUT_CASE + 0.006, zc + largeur / 2],
            terre,
          );
        }
      }
      /*
       * Les sillons ne se dessinent que là où la terre se voit.
       *
       * Sous un blé sur pied, la bande passe **sous** les brins et ne se
       * remarque pas — vérifié à l'écran : le tracteur traversait un champ de
       * maïs mûr sans que rien ne change derrière lui. Et c'est logique : on
       * ne laboure pas une culture debout. Sur un champ debout l'engin fait
       * autre chose — un passage de traitement — et ne retourne rien.
       */
      const nu = p.etat === undefined || TERRE_VISIBLE.has(p.etat);
      const sillons = maillageFacette(nu ? posS : [], nu ? colS : [], {
        recoit: shadows,
        nom: "campagne-sillons",
      });
      sillons.geometry.setDrawRange(0, 0);
      object.add(garder(sillons));

      engins.push({
        rig,
        p,
        vitesse: 1.5 + rnd() * 0.8,
        phase: rnd() * 10,
        rangs,
        sillons,
        parPasse: segments * 6,
        parcouru: 0,
        dernierX: p.x,
        dernierZ: p.z,
      });
    }
  }

  function update(t: number): void {
    for (const d of detailles.values()) d.update(t, 0.4);
    for (const v of voitures) {
      const u = (((t - v.depart) % v.cycle) + v.cycle) % v.cycle;
      if (u > v.passage) {
        // Entre deux passages elle n'attend pas au bout de la fenêtre : elle
        // n'est plus là. Une voiture à l'arrêt sur la chaussée se voit au
        // dézoom, et rien ne l'expliquerait.
        v.group.visible = false;
        continue;
      }
      v.group.visible = true;
      const avance = v.marche(u / v.passage);
      const s = sDebut + FENETRE * (v.sens > 0 ? avance : 1 - avance);
      const p = surLaRoute(pointsRoute, longueurs, s);
      const nx = Math.cos(p.cap);
      const nz = -Math.sin(p.cap);
      v.group.position.set(p.x + nx * v.voie, y0 + 0.05, p.z + nz * v.voie);
      _lacet.set(0, v.sens > 0 ? p.cap : p.cap + Math.PI, 0);
      v.group.quaternion.setFromEuler(_lacet);
    }
    for (const e of engins) {
      /*
       * Des passes et des demi-tours, dans son champ, et la terre change
       * derrière lui. Voir `cycleTravail` — c'est là qu'est la manœuvre.
       */
      const pas = cycleTravail(t + e.phase, {
        cote: coteTravail(plan.emprise),
        rangs: e.rangs,
        largeur: 1.8,
        vitesse: e.vitesse,
      });
      const px = e.p.x + pas.x;
      const pz = e.p.z + pas.z;
      /*
       * L'odomètre, et non l'horloge.
       *
       * `t × vitesse` faisait tourner les roues au régime de travail quoi que
       * l'engin fasse. Or il ralentit dans les manœuvres — un demi-tour, c'est
       * deux mètres quatre-vingts en trois secondes — et les pneus patinaient
       * de deux fois et demie pendant tout le virage. La distance réellement
       * parcourue entraîne roues, disques et rabatteur, exactement comme sur
       * l'engin du joueur.
       *
       * Les pas d'une unité et plus ne comptent pas : à la première image on
       * part du centre de la parcelle, et une fenêtre remise au premier plan
       * après un temps d'arrêt rattrape tout son retard d'un coup. Ni l'un ni
       * l'autre n'est un tour de roue.
       */
      const bond = Math.hypot(px - e.dernierX, pz - e.dernierZ);
      if (bond < 1) e.parcouru += bond;
      e.dernierX = px;
      e.dernierZ = pz;
      // Les pneus mordent d'un cheveu dans la terre : posés pile au sommet des
      // cases, ils laissent un interstice et l'engin a l'air de flotter. Même
      // règle et même valeur que sur la parcelle du joueur.
      e.rig.group.position.set(px, y0 + HAUT_CASE - 0.012, pz);
      _lacet.set(0, lacetEngin(pas.cap), 0);
      e.rig.group.quaternion.setFromEuler(_lacet);
      e.rig.update({
        t,
        distance: e.parcouru,
        working: pas.travaille,
        steer: pas.braquage,
      });
      /*
       * La bande faite reste faite — vraiment, et pas seulement le temps d'un
       * tour.
       *
       * L'avancement redescend à zéro quand l'engin repart de la première
       * ligne, et la plage de dessin le suivait : tout le champ labouré
       * disparaissait **en une image**, une fois par cycle. Une terre qui se
       * délaboure toute seule, c'est le genre de saut qu'on prend pour un
       * défaut d'affichage — et c'en était un.
       *
       * Le labour est un état du champ, pas une étape de l'animation : il ne
       * s'efface qu'au changement de jour, quand la parcelle est redessinée
       * avec sa nouvelle saison.
       */
      const faites = Math.round(pas.avancement * e.rangs * (e.parPasse / 6)) * 6;
      if (faites > e.sillons.geometry.drawRange.count) {
        e.sillons.geometry.setDrawRange(0, faites);
      }
    }
  }

  /**
   * Choisit les parcelles à détailler d'après le point regardé.
   *
   * Ne fait rien tant que le choix ne change pas : ce point bouge à chaque
   * image pendant un glissement, et reconstruire trois champs soixante fois
   * par seconde ferait de la fluidité le prix du déplacement.
   */
  function setCentreVue(x: number, z: number): void {
    const portee = plan.pas * PORTEE_DETAIL;
    const combien = sobre ? 1 : DETAILS_MAX;
    const choisies = plan.parcelles
      .filter((p) => p.reel && Math.hypot(p.x - x, p.z - z) <= portee)
      .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
      .slice(0, combien);
    const clef = choisies.map((p) => p.id).join("|");
    if (clef === clefDetail) return;
    clefDetail = clef;

    const garder = new Set(choisies.map((p) => p.id));
    for (const [id, d] of detailles) {
      if (garder.has(id)) continue;
      object.remove(d.object);
      d.dispose();
      detailles.delete(id);
    }
    for (const p of choisies) {
      if (detailles.has(p.id)) continue;
      const d = creerVoisinDetaille({
        parcelle: p,
        emprise: plan.emprise,
        cases,
        y: y0 + HAUT_CASE,
        shadows,
        sobre,
      });
      object.add(d.object);
      detailles.set(p.id, d);
    }
    // La nappe portait peut-être une grange générique là où le détail vient
    // d'en poser une vraie : on la refait.
    const jour = jourPose;
    const saison = saisonPosee;
    if (Number.isFinite(jour) && saison) {
      jourPose = Number.NaN;
      poserParcelles(jour, saison);
    }
  }

  function setJour(jourDeJeu: number, saison: Season): void {
    const jour = Math.floor(jourDeJeu);
    // Jour neuf, terre neuve : c'est le seul moment où le labour d'hier
    // s'efface, et il s'efface avec le reste de la parcelle qu'on redessine.
    if (jour !== jourPose || saison !== saisonPosee) {
      for (const e of engins) e.sillons.geometry.setDrawRange(0, 0);
    }
    poserParcelles(jour, saison);
  }

  function dispose(): void {
    for (const d of detailles.values()) d.dispose();
    detailles.clear();
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
  setCentreVue(0, 0);
  return { object, plan, update, setJour, setCentreVue, dispose };
}
