/**
 * Le plan de la campagne autour de la ferme.
 *
 * ## Un damier, pas un semis
 *
 * Les voisins étaient des rectangles de tailles quelconques posés un peu
 * partout. Vu en jeu, ça ne racontait rien : « les champs sont complètement
 * dispersés ici ou là ». Une campagne céréalière, ce sont des parcelles **du
 * même calibre, jointives**, séparées par des chemins — et c'est aussi ce
 * qu'il faut pour qu'un joueur puisse un jour racheter celle d'à côté et
 * l'ajouter à la sienne sans que rien ne soit à redessiner.
 *
 * Les parcelles voisines ont donc exactement la taille de celle du joueur et
 * se posent sur la même trame, dont la sienne est la case (0, 0).
 *
 * ## Plat, et cadré pour l'écran
 *
 * Le sol s'incurvait pour dégager un horizon. Ce globe ne va pas à une vue
 * isométrique. Le monde est plat — mais alors il faut bien qu'il s'arrête
 * quelque part, et l'endroit où il s'arrête doit faire une **ligne
 * horizontale à l'écran**, pas une diagonale.
 *
 * D'où le repère de ce module. En vue isométrique, l'écran ne s'aligne pas
 * sur les axes du monde : la caméra regarde depuis `(+x, +y, +z)`, si bien que
 *
 * - `u = x + z` descend à l'écran,
 * - `v = x − z` va vers la droite.
 *
 * Le sol est donc un **losange** dans le monde — un rectangle à l'écran. Son
 * bord amont, à `u = uMin`, est une horizontale franche : on y plante la
 * lisière, et au-dessus il n'y a plus que le ciel. Une emprise rectangulaire
 * en `x`/`z` donnait au contraire un coin de terre en haut à gauche et du ciel
 * en haut à droite.
 *
 * C'est aussi ce repère qui décide des parcelles retenues : une case de la
 * trame n'est posée que si elle tient **en deçà de la lisière**. Sans cela le
 * rang du fond dépassait l'horizon et il n'y avait plus de ciel du tout.
 *
 * ## Ce qui est tiré au sort, et ce qui ne l'est pas
 *
 * Ni la trame ni les emplacements : seulement les cultures, leur avance dans
 * le cycle et les bosquets. Tout descend d'une graine tirée du nom de la
 * parcelle — deux joueurs qui regardent la même ferme voient la même campagne,
 * et elle est la même à chaque rechargement.
 */

import { TAILLE_REFERENCE, type Season } from "@farmsim/shared";

/** Ce qu'on voit dans une parcelle voisine. */
export type EtatChamp =
  | "LABOUR"
  | "SEMIS"
  | "POUSSE"
  | "MUR"
  | "CHAUME"
  | "JACHERE";

/** Les cultures du voisinage — celles du jeu, plus le tournesol pour l'œil. */
export type CultureVoisine =
  | "BLE"
  | "ORGE"
  | "COLZA"
  | "MAIS"
  | "POIS"
  | "HERBE"
  | "TOURNESOL";

/**
 * Du code de culture de la base à celle qu'on sait peindre.
 *
 * Le tournesol n'a pas de code : il n'existe que dans le décor, pour que la
 * campagne ne soit pas six nuances de la même chose. Tout le reste vient de la
 * carte, et une culture inconnue tombe sur la jachère plutôt que de faire
 * disparaître le champ.
 */
export function cultureDe(code: string | null | undefined): CultureVoisine {
  switch (code) {
    case "WHEAT":
      return "BLE";
    case "BARLEY":
      return "ORGE";
    case "RAPE":
      return "COLZA";
    case "MAIZE":
      return "MAIS";
    case "PEA":
      return "POIS";
    default:
      return "HERBE";
  }
}

/**
 * De l'avancement d'un champ à ce qu'on en voit.
 *
 * Une parcelle qui n'a rien de semé n'est pas « en jachère » pour autant : si
 * elle a été travaillée elle est en terre nue, sinon elle est en herbe. La
 * part emblavée tranche — c'est elle qui dit si le voisin exploite ou laisse.
 */
export function etatDepuisStade(
  stade: string | null | undefined,
  partCultivee: number,
): EtatChamp {
  if (partCultivee <= 0) return "JACHERE";
  switch (stade) {
    case "PREPARED":
      return "LABOUR";
    case "PLANTED":
      return "SEMIS";
    case "GROWING":
      return "POUSSE";
    case "READY":
      return "MUR";
    case "HARVESTED":
    // Une récolte gâtée sur pied laisse le même chaume qu'une moisson : ce
    // qui la distingue est une affaire de comptabilité, pas de couleur.
    case "SPOILED":
      return "CHAUME";
    default:
      return "JACHERE";
  }
}

/**
 * Une parcelle de voisin.
 *
 * Posée sur la même trame que celle du joueur, et avec des cases de la même
 * taille : c'est ce qui permet de la lui vendre sans rien redessiner. Son
 * **côté**, lui, est le sien — de 8 à 16 cases — et elle se centre dans sa
 * case de trame, qui est taillée pour la plus grande.
 */
export type ParcelleVoisine = {
  id: string;
  /** Case de la trame — le joueur est en (0, 0). */
  col: number;
  rang: number;
  /** Centre, en unités monde. */
  x: number;
  z: number;
  /** Cases par côté : sa vraie taille, celle du cadastre. */
  cases: number;
  /** Côté au sol, talus compris — `cases` cases et la bordure de l'île. */
  emprise: number;
  culture: CultureVoisine;
  /** Décalage dans le cycle cultural, en jours de jeu. */
  decalage: number;
  /** Un engin y travaille-t-il ? */
  travaille: boolean;
  /** Une grange au bord — toutes les parcelles n'en ont pas. */
  batiment: boolean;
  /**
   * Ce que la carte en dit, quand la carte a répondu.
   *
   * Absent, la parcelle est du décor : sa culture et son état descendent de la
   * graine et du calendrier, comme avant. C'est ce qui s'affiche le temps que
   * la route réponde, et au-delà de la commune — là où il n'y a pas de
   * parcelle du tout, seulement des terres d'ailleurs.
   */
  reel?: VoisinReel;
  /** L'état lu sur la carte. Il l'emporte sur le cycle déduit du jour. */
  etat?: EtatChamp;
};

/**
 * Une parcelle du cadastre, telle que `/parcels/:id/voisinage` la rend.
 *
 * C'est la fin des voisins inventés : ces parcelles-là ont un identifiant, un
 * propriétaire et un prix, et ce sont celles que le joueur pourra racheter.
 */
export type VoisinReel = {
  id: string;
  label: string;
  col: number;
  rang: number;
  /** Sa taille en cases. Absente d'une vieille réponse : on la suppose de 12. */
  gridW?: number;
  gridH?: number;
  statut: "MOI" | "PNJ" | "JOUEUR" | "LIBRE";
  proprietaire: string | null;
  exploitation: string | null;
  culture: string | null;
  stade: string | null;
  partCultivee: number;
  fertility: number;
  batiments: { type: string; level: number; x: number; y: number; rotation: number }[];
  cheptel: { kind: string; size: number }[];
  prix: number | null;
  achetable: boolean;
  refus: string | null;
};

export type PointPlan = { x: number; z: number };

/**
 * L'emprise du sol, dans le repère de l'écran.
 *
 * `uMin` est la lisière, et c'est la seule des quatre bornes qu'on voie : les
 * trois autres sont posées assez loin pour rester hors cadre au zoom le plus
 * large.
 */
export type EmpriseSol = { uMin: number; uMax: number; vMax: number };

export type PlanCampagne = {
  parcelles: ParcelleVoisine[];
  /** Le chemin d'exploitation, d'un bout à l'autre du sol. */
  route: PointPlan[];
  /** L'amorce qui relie la cour au chemin. */
  desserte: PointPlan[];
  arbres: { x: number; z: number; taille: number; graine: number }[];
  sol: EmpriseSol;
  /** Pas de la trame, entre deux centres de parcelle. */
  pas: number;
  /**
   * Côté d'une case de la trame, hors chemin — la place de la plus grande
   * parcelle. Chaque parcelle a le sien (`ParcelleVoisine.emprise`), au plus
   * celui-ci.
   */
  emprise: number;
  /** Le pas d'une case de champ, le même partout. */
  pasCase: number;
  /** L'ordonnée du chemin : il court parallèlement à l'axe des `x`. */
  routeZ: number;
  /**
   * Le quart de tour appliqué à la carte.
   *
   * Exposé pour qu'on puisse le **reprendre** : quand le joueur passe d'une de
   * ses parcelles à une autre, la carte doit garder son orientation, sans quoi
   * le paysage pivoterait sous ses yeux au lieu de simplement glisser.
   */
  quart: 0 | 1 | 2 | 3;
};

export type OptionsPlan = {
  /** Nom de la parcelle, ou tout ce qui l'identifie : la graine en sort. */
  graine: string;
  /**
   * Côté d'une case de la trame, talus compris : la place que prend la plus
   * grande parcelle possible. Le pas de la trame en découle, et il ne doit
   * **pas** dépendre de la parcelle active — sans quoi passer d'une 12×12 à
   * une 16×16 ferait glisser toute la campagne.
   */
  emprise: number;
  /**
   * Combien de cases tient ce côté. Défaut : 12, la parcelle de référence —
   * la trame est alors exactement celle d'avant les tailles variées.
   */
  cases?: number;
  /** Côté de l'île du joueur, s'il diffère de la case de trame. */
  ile?: number;
  /** Emprise de la cour, à ne pas cultiver ni traverser. */
  cour: { x: number; z: number; w: number; d: number };
  /** Distance de la lisière, comptée en `u`. Voir `horizonPour`. */
  horizon?: number;
  /** Colonnes de part et d'autre du joueur. */
  colonnes?: number;
  /** Rangs devant et derrière. */
  rangs?: number;
  /**
   * La commune, si on l'a reçue.
   *
   * Fournie, elle remplace intégralement le damier tiré au sort : on pose
   * exactement ces parcelles-là, à leur case, avec leur culture et leur état.
   * Absente, on retombe sur le décor — le temps que la route réponde, et pour
   * que la vue se monte sans réseau.
   */
  voisins?: readonly VoisinReel[];
  /**
   * Imposer le quart de tour plutôt que le choisir.
   *
   * Passer d'une de ses parcelles à la voisine ne doit être qu'une
   * **translation** du paysage : la même terre sous le même pixel. Si la carte
   * choisissait à nouveau son orientation autour de la nouvelle parcelle, elle
   * pourrait tourner d'un quart, et plus rien ne serait à sa place.
   */
  quart?: 0 | 1 | 2 | 3;
  /**
   * L'ordonnée du chemin, quand l'appelant la connaît mieux que le plan.
   *
   * Le chemin se cale sous la cour, et la cour est celle du **siège** de la
   * ferme — pas forcément de la parcelle active. Calculé autour de la parcelle
   * active, il sautait d'un rang dès qu'on en changeait.
   */
  routeZ?: number;
  /**
   * L'identifiant du siège de la ferme, là où est la cour.
   *
   * La cour mord volontairement le bord de sa parcelle — c'est son chemin
   * d'accès. Sans cette exception, le siège ne se dessinerait plus dès qu'on
   * travaille sur une autre de ses parcelles : sa propre cour le recouvre.
   */
  maison?: string;
};

/* ------------------------------------------------------------------ */
/* Le repère de l'écran                                                */
/* ------------------------------------------------------------------ */

/** L'axe qui descend à l'écran. */
export const versEcranBas = (x: number, z: number): number => x + z;
/** L'axe qui va vers la droite de l'écran. */
export const versEcranDroite = (x: number, z: number): number => x - z;

/* ------------------------------------------------------------------ */
/* La trame                                                            */
/* ------------------------------------------------------------------ */

/**
 * Largeur du chemin entre deux parcelles.
 *
 * Assez pour qu'un engin y passe et qu'on lise la séparation, pas assez pour
 * que le damier se délite en îlots.
 */
export const LARGEUR_CHEMIN = 2.4;

/**
 * Ce qu'une parcelle a de plus que ses cases : la bordure de talus, comme
 * autour de l'île (`cases × pas + 1,4`).
 */
export const BORDURE_PARCELLE = 1.4;

/** Marge entre la dernière parcelle et le bord du sol, sur les autres côtés. */
export const MARGE_LISIERE = 2.5;

/**
 * Où s'arrête la terre, en amont : un pré de la profondeur d'un champ, puis le
 * bois.
 *
 * Le chiffre est mesuré, et le compromis est le sujet. Le cadrage par défaut
 * laisse voir dix-huit unités monde au-dessus du centre de l'écran, et un
 * point au sol posé en `u` y monte de `0,378 u` : la lisière peut donc aller
 * jusqu'à `u ≈ −48` avant de sortir du cadre — mais les arbres, eux, montent
 * encore de leur hauteur entière.
 *
 * Un rang de voisins en amont demanderait `u ≈ −31` pour le champ et
 * `u ≈ −37` pour le bois derrière lui : essayé, mesuré, et la cime des arbres
 * sortait du cadre. Il n'y avait plus de ciel, ce qui était le reproche même.
 * En amont il y a donc un pré, pas un champ — la trame reprend sur les côtés
 * et en aval, où l'écran a de la place.
 *
 * Déduit de l'emprise et non écrit en dur : un chiffre fixe se serait décalé
 * du damier au premier changement de taille de parcelle.
 */
export function horizonPour(emprise: number): number {
  return emprise * 2;
}

/** Jusqu'où le sol descend et s'élargit à l'écran — au-delà du cadre, toujours. */
export const SOL_AVAL = 150;
export const SOL_LARGEUR = 120;

/* ------------------------------------------------------------------ */
/* Le hasard qui n'en est pas un                                       */
/* ------------------------------------------------------------------ */

/** Hachage de chaîne — FNV-1a, court et sans dépendance. */
export function grainerDe(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Suite pseudo-aléatoire reproductible — mulberry32. */
export function suite(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Le cycle cultural du voisin                                         */
/* ------------------------------------------------------------------ */

/**
 * Le cycle d'une parcelle voisine, en jours de jeu.
 *
 * Vingt jours pour cinq états : quatre jours chacun, soit un jour réel par
 * état. Un voisin change donc d'aspect une fois par jour réel — assez pour
 * qu'on le remarque en revenant, assez peu pour que le décor ne clignote pas.
 */
export const CYCLE_VOISIN = 20;

/** Combien de voisins travaillent en même temps, au plus. */
export const ENGINS_MAX = 2;

const ORDRE: EtatChamp[] = ["LABOUR", "SEMIS", "POUSSE", "MUR", "CHAUME"];

/**
 * L'état d'une parcelle voisine, déduit du jour.
 *
 * L'hiver ne mûrit rien : chez le voisin comme chez le joueur, la terre est en
 * chaume ou déjà retournée pour l'année suivante.
 */
export function etatChamp(
  champ: Pick<ParcelleVoisine, "culture" | "decalage">,
  jourDeJeu: number,
  saison: Season,
): EtatChamp {
  if (champ.culture === "HERBE") return "JACHERE";
  const phase = (((jourDeJeu + champ.decalage) % CYCLE_VOISIN) + CYCLE_VOISIN) % CYCLE_VOISIN;
  const etat = ORDRE[Math.floor(phase / (CYCLE_VOISIN / ORDRE.length))]!;
  if (saison !== "WINTER") return etat;
  return etat === "MUR" || etat === "POUSSE" || etat === "SEMIS" ? "CHAUME" : etat;
}

/** Vert de pousse et couleur de maturité, par culture. */
const TEINTES: Record<CultureVoisine, { pousse: number; mur: number }> = {
  BLE: { pousse: 0x8fbf5c, mur: 0xdfb14a },
  ORGE: { pousse: 0x9dc763, mur: 0xd6ba63 },
  COLZA: { pousse: 0x74b357, mur: 0xf0cf3c },
  MAIS: { pousse: 0x6fb04a, mur: 0xc7a03f },
  POIS: { pousse: 0x86c46f, mur: 0xb9c473 },
  TOURNESOL: { pousse: 0x6faa4b, mur: 0xeebe2e },
  HERBE: { pousse: 0x7cc36a, mur: 0x7cc36a },
};

/** Terre retournée — celle des cases labourées du joueur. */
const TERRE = 0x593a20;
/** Chaume après la moisson — celui du joueur. */
const CHAUME = 0xe3cf98;
/** Herbe rase d'une jachère. */
const JACHERE = 0x9ac06a;

/** Mélange deux couleurs empaquetées, `t` de 0 à 1. */
export function melanger(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const m = (d: number) => {
    const ca = (a >> d) & 0xff;
    const cb = (b >> d) & 0xff;
    return Math.round(ca + (cb - ca) * k) << d;
  };
  return m(16) | m(8) | m(0);
}

/** La couleur d'une case, par culture et par état. */
export function couleurChamp(culture: CultureVoisine, etat: EtatChamp): number {
  const t = TEINTES[culture];
  switch (etat) {
    case "LABOUR":
      return TERRE;
    case "SEMIS":
      return melanger(TERRE, t.pousse, 0.35);
    case "POUSSE":
      return t.pousse;
    case "MUR":
      return t.mur;
    case "CHAUME":
      return CHAUME;
    case "JACHERE":
      return JACHERE;
  }
}

/* ------------------------------------------------------------------ */
/* Géométrie                                                           */
/* ------------------------------------------------------------------ */

export type Boite = { x: number; z: number; w: number; d: number };

/** Deux emprises se chevauchent-elles, marge comprise ? */
export function seChevauchent(a: Boite, b: Boite, marge = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + marge &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + marge
  );
}

/** Emprise au sol d'une parcelle voisine — la sienne quand on la connaît. */
export function empriseParcelle(
  p: Pick<ParcelleVoisine, "x" | "z"> & { emprise?: number },
  emprise: number,
): Boite {
  const e = p.emprise ?? emprise;
  return { x: p.x, z: p.z, w: e, d: e };
}

/**
 * La parcelle voisine sous un point du sol, s'il y en a une.
 *
 * Les trente champs alentour tiennent dans un seul maillage : il n'y a rien à
 * interroger objet par objet, et la trame étant régulière, la case se déduit
 * d'une division. Le `round` et non le `floor` : les centres sont sur les
 * multiples du pas, pas les coins.
 *
 * Rendre la case ne suffit pas — il faut vérifier qu'on est bien **dans** la
 * parcelle et non dans le chemin qui la borde, sinon un clic sur l'herbe entre
 * deux champs ouvrirait la fiche de l'un d'eux.
 */
export function parcelleSous(
  plan: Pick<PlanCampagne, "parcelles" | "pas" | "emprise">,
  x: number,
  z: number,
): ParcelleVoisine | null {
  const col = Math.round(x / plan.pas);
  const rang = Math.round(z / plan.pas);
  const p = plan.parcelles.find((c) => c.col === col && c.rang === rang);
  if (!p) return null;
  // Son côté à elle : une 8×8 laisse du pré tout autour dans sa case de trame,
  // et ce pré n'est à personne.
  const demi = (p.emprise ?? plan.emprise) / 2;
  return Math.abs(x - p.x) <= demi && Math.abs(z - p.z) <= demi ? p : null;
}

/** Un point est-il sur la terre ferme ? */
export function surLeSol(sol: EmpriseSol, x: number, z: number): boolean {
  const u = versEcranBas(x, z);
  return u >= sol.uMin && u <= sol.uMax && Math.abs(versEcranDroite(x, z)) <= sol.vMax;
}

/* ------------------------------------------------------------------ */
/* Le chemin                                                           */
/* ------------------------------------------------------------------ */

/** Demi-largeur de la chaussée, accotements compris. */
export const DEMI_ROUTE = 0.95;

/**
 * L'ordonnée du chemin : le couloir de trame libre au sud de la cour.
 *
 * La route « coupait le parking » parce qu'elle se calait sur l'île sans
 * regarder la cour. Elle suit maintenant un **couloir de la trame** — la bande
 * d'herbe qui sépare deux rangs de parcelles — et un couloir de trame est vide
 * par construction. On prend le premier qui laisse la cour entière : la cour
 * déborde de l'île à l'ouest, mais elle ne descend pas jusqu'au rang suivant,
 * et le chemin passe donc au ras de sa sortie.
 */
export function couloirRoute(o: OptionsPlan): number {
  const pas = o.emprise + LARGEUR_CHEMIN;
  const bordCour = Math.max(o.cour.z + o.cour.d / 2, o.emprise / 2);
  /*
   * Le premier couloir dont la chaussée entière tombe au sud de la cour.
   *
   * Sans marge, et c'est voulu : la cour affleure le bord sud de l'île, donc
   * le couloir qui suit lui laisse exactement la place. Deux dixièmes de
   * sécurité suffisaient à faire sauter le chemin d'un rang entier — il
   * partait alors se perdre dans le coin bas de l'écran, à seize unités de
   * la sortie qu'il est censé desservir.
   */
  const k = Math.ceil((bordCour + DEMI_ROUTE) / pas - 0.5);
  return k * pas + pas / 2;
}

/* ------------------------------------------------------------------ */
/* L'orientation de la commune                                         */
/* ------------------------------------------------------------------ */

/**
 * De quel quart de tour poser la carte sur la trame.
 *
 * En vue isométrique, tout ce qui est en amont de la ferme sort par le haut du
 * cadre : la campagne ne peut montrer que le quartier **aval**, celui où
 * `col + rang` croît. Or la ferme du joueur n'est pas au milieu de sa commune
 * — elle peut être dans n'importe quel coin. Posée telle quelle, une ferme du
 * bord sud n'aurait aucun voisin visible : mesuré en jeu, seize parcelles
 * existaient autour et deux se dessinaient.
 *
 * On tourne donc la carte d'un quart de tour ou trois pour amener le gros de
 * la commune dans le quartier visible. C'est une **rotation** et jamais une
 * symétrie : le plan du Bureau et le paysage doivent rester superposables à
 * une rotation près, sinon la parcelle qu'on croit acheter à droite arriverait
 * à gauche.
 *
 * Le choix ne dépend que de la place du joueur dans sa commune : il ne change
 * donc pas d'un rafraîchissement à l'autre, et le pays ne pivote pas sous les
 * pieds.
 */
export function orientationTrame(
  cases: readonly { col: number; rang: number; statut?: string }[],
): 0 | 1 | 2 | 3 {
  let meilleur: 0 | 1 | 2 | 3 = 0;
  let record = -1;
  for (const quart of [0, 1, 2, 3] as const) {
    let vus = 0;
    for (const c of cases) {
      const t = tourner(c, quart);
      if (t.col === 0 && t.rang === 0) continue;
      /*
       * La case sous la cour est interdite à ses parcelles.
       *
       * La cour déborde de l'île vers l'ouest — c'est par là qu'on entre — et
       * mord la case `(-1, 0)` de la trame. Une parcelle du joueur tournée là
       * serait recouverte par son propre parking, donc pas dessinée : c'est
       * la pire des orientations pour elle, pire encore que l'amont.
       */
      if (c.statut === "MOI" && t.col === -1 && t.rang === 0) {
        vus -= 1000;
        continue;
      }
      if (t.col + t.rang < 0) continue;
      /*
       * Ses propres parcelles d'abord, et de loin.
       *
       * Un joueur qui achète la parcelle d'à côté doit la **voir** : c'est
       * elle qu'il vient chercher à l'écran. Compter chacune pour cent voisins
       * fait qu'aucun gain sur le nombre de parcelles étrangères visibles ne
       * peut justifier de reléguer l'une des siennes en amont, hors du cadre.
       */
      vus += c.statut === "MOI" ? 100 : 1;
    }
    if (vus > record) {
      record = vus;
      meilleur = quart;
    }
  }
  return meilleur;
}

/**
 * Un quart de tour dans le plan de la trame.
 *
 * Le `+ 0` n'est pas décoratif : `-0` traverse les comparaisons de valeur du
 * langage sans se faire remarquer, puis ressort dans une clé de reconstruction
 * ou une comparaison stricte, où il ne vaut plus tout à fait zéro.
 */
export function tourner(
  c: { col: number; rang: number },
  quart: 0 | 1 | 2 | 3,
): { col: number; rang: number } {
  switch (quart) {
    case 1:
      return { col: -c.rang + 0, rang: c.col + 0 };
    case 2:
      return { col: -c.col + 0, rang: -c.rang + 0 };
    case 3:
      return { col: c.rang + 0, rang: -c.col + 0 };
    default:
      return { col: c.col + 0, rang: c.rang + 0 };
  }
}

/* ------------------------------------------------------------------ */
/* Le plan complet                                                     */
/* ------------------------------------------------------------------ */

/**
 * Le plan complet.
 *
 * Toutes les cases de la trame reçoivent une parcelle, sauf celle du joueur,
 * celles que mord la cour, celles que traverse le chemin et celles qui
 * dépasseraient la lisière. Aucun tirage sur les emplacements : c'est un
 * damier, et il doit se lire comme tel.
 */
export function planCampagne(o: OptionsPlan): PlanCampagne {
  const emprise = o.emprise;
  const pas = emprise + LARGEUR_CHEMIN;
  const colonnes = o.colonnes ?? 3;
  const rangs = o.rangs ?? 3;
  /*
   * Des cases de champ toutes de la même taille, et des parcelles qui en
   * comptent plus ou moins.
   *
   * La case de trame est taillée pour la plus grande (`o.cases` cases) ; une
   * parcelle plus petite s'y centre, avec du pré autour. Le côté se compte
   * comme celui de l'île : les cases, plus la bordure de talus.
   */
  const casesTrame = o.cases ?? TAILLE_REFERENCE;
  const pasCase = (emprise - BORDURE_PARCELLE) / casesTrame;
  const cotePour = (cases: number): number =>
    Math.min(casesTrame, cases) * pasCase + BORDURE_PARCELLE;
  /*
   * La lisière se compte depuis une parcelle **de référence**, pas depuis la
   * case de trame : élargir la trame pour les 16×16 ne doit pas repousser le
   * bois hors du cadre. Sans `o.cases`, c'est exactement `horizonPour(emprise)`.
   */
  const horizon = o.horizon ?? horizonPour(cotePour(TAILLE_REFERENCE));
  const rnd = suite(grainerDe(o.graine));

  const quart: 0 | 1 | 2 | 3 = o.quart ?? (o.voisins ? orientationTrame(o.voisins) : 0);

  /*
   * La lisière recule au-dessus de la plus haute des parcelles du joueur.
   *
   * La trame ne montrait que l'aval : en amont de la parcelle active, un pré
   * puis le bois, et rien d'autre. Une parcelle achetée qui tombait de ce
   * côté-là n'était **tout simplement pas dessinée** — le joueur payait une
   * terre et ne la trouvait nulle part dans le paysage.
   *
   * On garde la même bande de pré et de bois, mais comptée depuis la plus
   * haute de ses parcelles au lieu de la seule parcelle active. Une ferme qui
   * ne s'étend pas vers l'amont garde exactement le paysage d'avant.
   */
  let uMaison = 0;
  for (const v of o.voisins ?? []) {
    if (v.statut !== "MOI" || (v.col === 0 && v.rang === 0)) continue;
    const t = tourner(v, quart);
    uMaison = Math.min(uMaison, versEcranBas(t.col * pas, t.rang * pas));
  }
  const sol: EmpriseSol = { uMin: uMaison - horizon, uMax: SOL_AVAL, vMax: SOL_LARGEUR };
  /** Où s'arrêtaient les terres des autres — la lisière d'avant. */
  const lisiereEtrangers = -horizon;
  const routeZ = o.routeZ ?? couloirRoute(o);
  const cour: Boite = { ...o.cour };
  const ile = o.ile ?? emprise;
  const joueur: Boite = { x: 0, z: 0, w: ile, d: ile };

  const cultures: CultureVoisine[] = ["BLE", "ORGE", "COLZA", "MAIS", "TOURNESOL", "HERBE"];
  const parcelles: ParcelleVoisine[] = [];

  /**
   * Une case de la trame peut-elle porter une parcelle ?
   *
   * Le coin amont décide, et c'est lui qui vide l'amont : une case dont le
   * coin dépasse la lisière se terminerait dans le vide, et l'on verrait la
   * tranche du monde par-dessus.
   */
  const posable = (
    x: number,
    z: number,
    aMoi = false,
    estMaison = false,
    cote = emprise,
  ): boolean => {
    const boite: Boite = { x, z, w: cote, d: cote };
    // En amont, seules les parcelles du joueur passent la lisière d'avant :
    // les siennes doivent se voir, celles des autres n'ont pas à envahir le
    // pré ni à manger le ciel.
    if (versEcranBas(x, z) - cote < (aMoi ? sol.uMin : lisiereEtrangers)) return false;
    if (versEcranBas(x, z) + cote > sol.uMax - MARGE_LISIERE) return false;
    if (Math.abs(versEcranDroite(x, z)) + cote > sol.vMax - MARGE_LISIERE) return false;
    if (!estMaison && seChevauchent(boite, cour, 0.4)) return false;
    if (seChevauchent(boite, joueur, 0.4)) return false;
    // Le chemin passe dans un couloir de trame : une parcelle ne peut pas y
    // être, mais on le vérifie plutôt que de le supposer.
    return Math.abs(z - routeZ) >= cote / 2 + DEMI_ROUTE;
  };

  if (o.voisins) {
    /*
     * La commune a répondu : on pose exactement ses parcelles, à leur case.
     *
     * Rien n'est tiré au sort ici, et c'est tout l'objet du changement — les
     * champs alentour sont ceux du cadastre, avec leur propriétaire et leur
     * prix. Là où la commune s'arrête, il n'y a pas de parcelle : c'est ce qui
     * donne au pays un bord crédible plutôt qu'un damier sans fin.
     */
    for (const brut of o.voisins) {
      if (brut.col === 0 && brut.rang === 0) continue;
      const v = brut;
      const { col, rang } = tourner(brut, quart);
      const x = col * pas;
      const z = rang * pas;
      const cases = Math.min(casesTrame, Math.max(v.gridW ?? TAILLE_REFERENCE, v.gridH ?? TAILLE_REFERENCE));
      const cote = cotePour(cases);
      if (!posable(x, z, v.statut === "MOI", v.id === o.maison, cote)) continue;
      const grain = suite(grainerDe(v.id));
      parcelles.push({
        id: v.id,
        col,
        rang,
        x,
        z,
        cases,
        emprise: cote,
        culture: cultureDe(v.culture),
        // Le cycle ne sert plus qu'aux parcelles de décor ; on garde un
        // décalage stable pour que rien ne clignote si la carte se tait.
        decalage: Math.floor(grain() * CYCLE_VOISIN),
        travaille: false,
        batiment: v.batiments.length > 0,
        reel: v,
        etat: etatDepuisStade(v.stade, v.partCultivee),
      });
    }
  } else {
    for (let rang = -rangs; rang <= rangs; rang++) {
      for (let col = -colonnes; col <= colonnes; col++) {
        if (col === 0 && rang === 0) continue;
        const x = col * pas;
        const z = rang * pas;
        // Le décor n'a pas de cadastre : il prend la taille de référence.
        const cases = Math.min(casesTrame, TAILLE_REFERENCE);
        const cote = cotePour(cases);
        if (!posable(x, z, false, false, cote)) continue;
        parcelles.push({
          id: `voisin-${col}-${rang}`,
          col,
          rang,
          x,
          z,
          cases,
          emprise: cote,
          culture: cultures[Math.floor(rnd() * cultures.length)]!,
          decalage: Math.floor(rnd() * CYCLE_VOISIN),
          travaille: false,
          batiment: rnd() < 0.3,
        });
      }
    }
  }

  /*
   * Qui travaille aujourd'hui.
   *
   * Les plus proches, et devant plutôt que derrière : en vue isométrique, ce
   * qui est derrière la ferme est petit et à moitié caché. Le choix est
   * déterministe — les meilleurs, pas des tirés au sort.
   */
  const visible = (p: ParcelleVoisine) =>
    Math.hypot(p.x, p.z) - 0.4 * versEcranBas(p.x, p.z);
  const candidats = parcelles
    // On ne laboure ni la prairie, ni la terre d'un autre joueur — ni la
    // sienne : c'est le joueur qui travaille ses parcelles à lui.
    .filter((p) => p.culture !== "HERBE" && p.reel?.statut !== "MOI" && p.reel?.statut !== "JOUEUR")
    /*
     * Et jamais au-delà des parcelles mitoyennes.
     *
     * Le tri seul ne suffisait pas : il rangeait les candidats du meilleur au
     * pire, mais prenait le meilleur même quand il était mauvais. Mesuré en
     * jeu sur une ferme dont aucun voisin proche n'est cultivé, l'engin
     * partait travailler à deux cases de là, à demi sorti du cadre — toute
     * l'animation, la manœuvre en fourrière et la terre qui change,
     * s'exécutait là où personne ne la voit. Mieux vaut pas de tracteur qu'un
     * tracteur hors champ.
     */
    .filter((p) => Math.hypot(p.x, p.z) <= 1.7 * pas)
    .sort((a, b) => visible(a) - visible(b));
  for (const p of candidats.slice(0, ENGINS_MAX)) p.travaille = true;

  /*
   * Le chemin, d'un bord à l'autre du sol.
   *
   * À `z` constant, le losange se traverse entre deux abscisses qu'on tire des
   * deux contraintes : rester entre `uMin` et `uMax`, et rester dans la largeur.
   */
  const route: PointPlan[] = [
    { x: Math.max(sol.uMin - routeZ, routeZ - sol.vMax), z: routeZ },
    { x: Math.min(sol.uMax - routeZ, routeZ + sol.vMax), z: routeZ },
  ];

  /*
   * La desserte : de la sortie de la cour au chemin, tout droit.
   *
   * Elle descend, elle ne longe pas — c'est la façon la plus courte de relier
   * les deux, et la seule qui ne retraverse ni l'île ni une parcelle.
   */
  const desserte: PointPlan[] = [
    { x: o.cour.x, z: o.cour.z + o.cour.d / 2 - 0.3 },
    { x: o.cour.x, z: routeZ },
  ];

  /*
   * Les bosquets.
   *
   * La lisière n'est pas décorative : c'est elle qui termine le monde. Sans
   * elle, le sol s'arrêterait sur une arête franche en plein cadre. Elle suit
   * la ligne `u = uMin`, donc une diagonale dans le monde et une horizontale à
   * l'écran.
   */
  const arbres: { x: number; z: number; taille: number; graine: number }[] = [];
  const libre = (x: number, z: number, r: number) => {
    if (Math.abs(z - routeZ) < DEMI_ROUTE + r) return false;
    if (seChevauchent({ x, z, w: r * 2, d: r * 2 }, cour, 0.8)) return false;
    if (seChevauchent({ x, z, w: r * 2, d: r * 2 }, joueur, 0.8)) return false;
    return !parcelles.some((p) =>
      seChevauchent({ x, z, w: r * 2, d: r * 2 }, empriseParcelle(p, p.emprise), 0.2),
    );
  };
  const poser = (x: number, z: number, taille: number) => {
    if (!surLeSol(sol, x, z)) return;
    if (!libre(x, z, 0.9)) return;
    arbres.push({ x, z, taille, graine: Math.floor(rnd() * 1e9) });
  };

  /*
   * La lisière, dense, sur deux profondeurs.
   *
   * Les arbres du fond restent bas : posés à l'horizon, ils montent à l'écran
   * de près de leur hauteur entière, et une futaie s'y ferait couper net par le
   * haut du cadre — ce qui rendait la bande de ciel invisible.
   */
  const vBord = Math.min(sol.vMax, 70);
  for (let v = -vBord; v <= vBord; v += 1.7 + rnd() * 1.1) {
    for (const [prof, ampleur] of [
      [1.1, 1.0],
      [3.4, 1.2],
    ] as const) {
      const u = sol.uMin + prof + rnd() * 1.2;
      poser((u + v) / 2, (u - v) / 2, (1.35 + rnd() * 0.5) * ampleur);
    }
  }

  /*
   * Le pré d'amont : des bosquets, et non un aplat.
   *
   * Entre la dernière haie et le bois s'étend une bande d'herbe large comme un
   * champ. Vide, elle se lit comme un trou dans le décor — un grand vert uni
   * en travers du cadre, juste au-dessus de la ferme. Quelques bouquets
   * d'arbres suffisent à en faire une pâture.
   */
  const bosquet = (x: number, z: number, n: number) => {
    for (let k = 0; k < n; k++) {
      poser(x + (rnd() - 0.5) * 3.4, z + (rnd() - 0.5) * 3.4, 1.9 + rnd() * 1.2);
    }
  };
  for (let i = 0; i < 14; i++) {
    const u = sol.uMin + 5.5 + rnd() * (horizon - cotePour(TAILLE_REFERENCE) - 7);
    const v = (rnd() * 2 - 1) * Math.min(sol.vMax, 62);
    bosquet((u + v) / 2, (u - v) / 2, 2 + Math.floor(rnd() * 3));
  }

  /*
   * Les côtés : quelques bosquets dans les chemins de la trame, pour que le
   * damier ne se lise pas comme du papier millimétré.
   */
  for (let i = 0; i < 40; i++) {
    const col = Math.round((rnd() * 2 - 1) * colonnes);
    const rang = Math.round((rnd() * 2 - 1) * rangs);
    poser(
      col * pas + (rnd() < 0.5 ? -1 : 1) * (emprise / 2 + LARGEUR_CHEMIN / 2),
      rang * pas + (rnd() - 0.5) * emprise,
      2.2 + rnd() * 1.3,
    );
  }

  return { parcelles, route, desserte, arbres, sol, pas, emprise, pasCase, routeZ, quart };
}
