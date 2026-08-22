/**
 * Le plan de la campagne autour de la ferme.
 *
 * ## Pourquoi un plan séparé du dessin
 *
 * La parcelle du joueur flottait dans le ciel : une dalle de terre, quatre
 * arbres, et plus rien au-delà. Ce module décide **ce qu'il y a autour** — les
 * champs des voisins, la route qui descend vers le reste du monde, les
 * bosquets — sans toucher à Trois. C'est de l'arithmétique : on peut donc le
 * mesurer, et un champ qui chevauche la cour ou une route qui traverse le blé
 * se voient dans un test plutôt qu'à l'écran.
 *
 * ## Ce qui est tiré au sort, et ce qui ne l'est pas
 *
 * Rien n'est vraiment aléatoire. Tout descend d'une graine tirée du nom de la
 * parcelle : deux joueurs qui regardent la même ferme voient la même campagne,
 * et elle est la même à chaque rechargement. Un décor qui change à chaque
 * visite ne serait pas un lieu.
 *
 * ## Ce qui bouge avec le temps
 *
 * L'état d'un champ voisin — labouré, semé, en pousse, mûr, en chaume — n'est
 * pas stocké : il se **déduit** du jour de jeu, exactement comme la saison et
 * la pousse du joueur. Pas de tic-tac, pas de dérive, et un voisin qui
 * moissonne le fait le même jour pour tout le monde. L'hiver, plus rien ne
 * mûrit chez le voisin non plus : sa terre est en chaume ou déjà retournée,
 * comme la nôtre.
 */

import type { Season } from "@farmsim/shared";

/** Ce qu'on voit dans un champ voisin. */
export type EtatChamp =
  /** Terre retournée, sillons francs. */
  | "LABOUR"
  /** Semé : la terre domine, le vert perce à peine. */
  | "SEMIS"
  /** En pousse : vert franc. */
  | "POUSSE"
  /** Mûr : la couleur de la récolte. */
  | "MUR"
  /** Moissonné : chaume clair. */
  | "CHAUME"
  /** Laissé en herbe. */
  | "JACHERE";

/** Les cultures du voisinage — celles du jeu, plus le tournesol pour l'œil. */
export type CultureVoisine = "BLE" | "ORGE" | "COLZA" | "MAIS" | "HERBE" | "TOURNESOL";

export type ChampVoisin = {
  id: string;
  /** Centre du champ, en unités monde. */
  x: number;
  z: number;
  /** Emprise. */
  w: number;
  d: number;
  /** Orientation des sillons : 0 le long de X, π/2 le long de Z. */
  sillons: number;
  culture: CultureVoisine;
  /** Décalage du champ dans le cycle cultural, en jours de jeu. */
  decalage: number;
  /** Un engin y travaille-t-il ? */
  travaille: boolean;
};

export type PointPlan = { x: number; z: number };

export type PlanCampagne = {
  champs: ChampVoisin[];
  /** La route, du portail de la cour jusqu'à l'horizon. */
  route: PointPlan[];
  arbres: { x: number; z: number; taille: number }[];
  /** Demi-étendue du sol, en unités monde. */
  etendue: number;
};

export type OptionsPlan = {
  /** Nom de la parcelle, ou tout ce qui l'identifie : la graine en sort. */
  graine: string;
  /** Demi-emprise de l'île du joueur, marges comprises. */
  ileDemiLargeur: number;
  ileDemiProfondeur: number;
  /** Portail de la cour : c'est de là que part la route. */
  portail: PointPlan;
  /** Emprise de la cour, à ne pas cultiver. */
  cour: { x: number; z: number; w: number; d: number };
  /** Combien de champs viser. Le réglage sobre en demande moins. */
  champsVises?: number;
  /** Demi-étendue du sol. */
  etendue?: number;
};

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
 * Le cycle d'un champ voisin, en jours de jeu.
 *
 * Vingt jours pour cinq états : quatre jours chacun, soit un jour réel par
 * état. Un voisin change donc d'aspect une fois par jour réel — assez pour
 * qu'on le remarque en revenant, assez peu pour que le décor ne clignote pas
 * sous les yeux.
 */
export const CYCLE_VOISIN = 20;

/**
 * Jusqu'où un engin de voisin mérite d'être dessiné, en unités monde.
 *
 * Au-delà, il fait deux pixels et son mouvement ressemble à un scintillement.
 * Mieux vaut un champ tranquille qu'un tracteur qu'on devine.
 */
export const PORTEE_ENGIN = 30;

/**
 * Demi-étendue du sol par défaut, en unités monde.
 *
 * Assez loin pour que la brume avale le bord avant qu'on le voie : le
 * brouillard de la scène s'épaissit de 34 à 66 unités de la caméra, et un sol
 * qui s'arrêterait à quarante montrerait sa lisière en plein cadre.
 */
export const ETENDUE_PAR_DEFAUT = 72;

const ORDRE: EtatChamp[] = ["LABOUR", "SEMIS", "POUSSE", "MUR", "CHAUME"];

/**
 * L'état d'un champ voisin, déduit du jour.
 *
 * L'hiver ne mûrit rien : chez le voisin comme chez le joueur, la terre est en
 * chaume ou déjà retournée pour l'année suivante. Laisser un champ d'or à côté
 * d'une parcelle gelée dirait que les saisons ne s'appliquent qu'au joueur.
 */
export function etatChamp(champ: ChampVoisin, jourDeJeu: number, saison: Season): EtatChamp {
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
  TOURNESOL: { pousse: 0x6faa4b, mur: 0xeebe2e },
  HERBE: { pousse: 0x7cc36a, mur: 0x7cc36a },
};

/** Terre retournée. */
const TERRE = 0x7a5a3e;
/** Chaume après la moisson. */
const CHAUME = 0xd3bc85;
/** Herbe rase d'une jachère. */
const JACHERE = 0x87bb6f;

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

/** La couleur d'un champ, par culture et par état. */
export function couleurChamp(culture: CultureVoisine, etat: EtatChamp): number {
  const t = TEINTES[culture];
  switch (etat) {
    case "LABOUR":
      return TERRE;
    // Semé, la terre domine encore : on voit les rangs, pas la culture.
    case "SEMIS":
      return melanger(TERRE, t.pousse, 0.3);
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
/* Le placement                                                        */
/* ------------------------------------------------------------------ */

type Boite = { x: number; z: number; w: number; d: number };

/** Deux emprises se chevauchent-elles, marge comprise ? */
export function seChevauchent(a: Boite, b: Boite, marge = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + marge &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + marge
  );
}

/** Distance d'un point au segment [p, q]. */
export function distanceAuSegment(x: number, z: number, p: PointPlan, q: PointPlan): number {
  const dx = q.x - p.x;
  const dz = q.z - p.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.min(1, Math.max(0, ((x - p.x) * dx + (z - p.z) * dz) / l2));
  const cx = p.x + t * dx;
  const cz = p.z + t * dz;
  return Math.hypot(x - cx, z - cz);
}

/** Distance d'un point à la polyligne de la route. */
export function distanceALaRoute(x: number, z: number, route: PointPlan[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < route.length; i++) {
    d = Math.min(d, distanceAuSegment(x, z, route[i]!, route[i + 1]!));
  }
  return d;
}

/**
 * La route, du portail de la cour à l'horizon.
 *
 * Elle part du portail, longe l'île par l'ouest, puis descend vers le coin bas
 * de l'écran. En vue isométrique, « descendre » veut dire croître en x **et**
 * en z à la fois : la caméra regarde l'origine depuis (+x, +y, +z), de sorte
 * que ces deux axes viennent tous deux vers le spectateur. Une route qui
 * suivrait un seul axe monterait de biais et sortirait par le côté.
 */
export function tracerRoute(o: OptionsPlan): PointPlan[] {
  const etendue = o.etendue ?? ETENDUE_PAR_DEFAUT;
  const rnd = suite(grainerDe(o.graine + ":route"));
  const largeurIle = o.ileDemiLargeur;
  // Un couloir à l'ouest de l'île, assez loin pour ne pas raser la haie.
  const couloirX = Math.min(o.portail.x, -largeurIle) - 3.4 - rnd() * 1.2;
  const depart: PointPlan = { x: o.portail.x, z: o.portail.z };
  const pts: PointPlan[] = [
    // Un bout de chemin qui remonte derrière la cour : la route continue
    // au-delà du portail, elle ne naît pas de lui.
    { x: couloirX - 6, z: depart.z - o.ileDemiProfondeur - 14 },
    { x: couloirX, z: depart.z - o.ileDemiProfondeur * 0.6 },
    { x: couloirX, z: depart.z },
    { x: couloirX + 1.2, z: depart.z + o.ileDemiProfondeur * 0.7 },
  ];
  // Puis la descente vers le monde : x et z croissent ensemble.
  const bas = { x: couloirX + 10, z: depart.z + o.ileDemiProfondeur + 10 };
  pts.push(bas);
  pts.push({ x: bas.x + etendue * 0.8, z: bas.z + etendue * 0.8 });
  return pts;
}

/**
 * Le plan complet.
 *
 * Les champs se posent sur un damier lâche autour de l'île, chaque case
 * recevant un rectangle de taille et de position tirées au sort dans des
 * bornes. Une case est abandonnée si son champ touche l'île, la cour ou la
 * route : mieux vaut un trou d'herbe qu'un champ qui traverse le bitume.
 *
 * La densité penche vers le bas de l'écran — la direction (+x, +z) — parce que
 * c'est là qu'il y a de la place à l'image : derrière la ferme, tout est
 * écrasé par la perspective et se perd dans la brume.
 */
export function planCampagne(o: OptionsPlan): PlanCampagne {
  const etendue = o.etendue ?? ETENDUE_PAR_DEFAUT;
  const vises = o.champsVises ?? 18;
  const rnd = suite(grainerDe(o.graine));
  const route = tracerRoute(o);

  const ile: Boite = {
    x: 0,
    z: 0,
    w: o.ileDemiLargeur * 2 + 2.5,
    d: o.ileDemiProfondeur * 2 + 2.5,
  };
  const cour: Boite = { ...o.cour };

  const cultures: CultureVoisine[] = ["BLE", "ORGE", "COLZA", "MAIS", "TOURNESOL", "HERBE"];
  const champs: ChampVoisin[] = [];
  /*
   * Le pas du damier des champs.
   *
   * Treize à la première passe : la ferme se retrouvait au centre d'une
   * clairière, le premier voisin à treize unités d'une île qui en fait sept de
   * demi-largeur. Dix rapproche la campagne sans coller les champs à la haie —
   * la marge de 1,5 unité du test de chevauchement s'en charge.
   */
  const pas = 10;
  const portee = Math.ceil((etendue - 6) / pas);

  const cases: { cx: number; cz: number; poids: number }[] = [];
  for (let i = -portee; i <= portee; i++) {
    for (let k = -portee; k <= portee; k++) {
      const cx = i * pas;
      const cz = k * pas;
      if (Math.hypot(cx, cz) > etendue - 8) continue;
      if (Math.abs(cx) < ile.w / 2 && Math.abs(cz) < ile.d / 2) continue;
      /*
       * L'ordre de remplissage : le plus près d'abord, le bas de l'écran
       * ensuite.
       *
       * Première version : un « poids » qui ne tenait qu'au bas de l'écran,
       * et un tri décroissant dessus. Ce n'était pas un penchant, c'était un
       * ordre strict — mesuré, les dix-neuf champs partaient tous dans le coin
       * le plus éloigné et il n'en restait **aucun** à moins de vingt-deux
       * unités de la ferme. Le voisinage était bien là, entièrement hors du
       * cadre.
       *
       * La distance mène donc le tri, et le penchant vers le bas ne fait plus
       * que départager : à distance comparable, on peuple d'abord ce qui se
       * voit.
       */
      cases.push({ cx, cz, poids: Math.hypot(cx, cz) - 0.18 * (cx + cz) });
    }
  }
  cases.sort((a, b) => a.poids - b.poids);

  for (const c of cases) {
    if (champs.length >= vises) break;
    /*
     * Quatre essais par case du damier, pas un seul.
     *
     * Avec un seul tirage et une secousse de quelques dixièmes, une case dont
     * le premier rectangle mordait sur l'île était perdue : le voisinage
     * commençait à vingt unités de la ferme et laissait une clairière autour
     * d'elle. Quatre essais, avec une vraie secousse, permettent au champ de
     * se glisser dans le coin libre au lieu d'abandonner la case.
     */
    for (let essai = 0; essai < 4; essai++) {
      const w = 5 + rnd() * 5;
      const d = 4.5 + rnd() * 5;
      const x = c.cx + (rnd() - 0.5) * pas * 0.7;
      const z = c.cz + (rnd() - 0.5) * pas * 0.7;
      const boite: Boite = { x, z, w, d };
      if (seChevauchent(boite, ile, 1.2)) continue;
      if (seChevauchent(boite, cour, 1.2)) continue;
      if (distanceALaRoute(x, z, route) < Math.max(w, d) / 2 + 2.2) continue;
      if (champs.some((autre) => seChevauchent(boite, autre, 0.9))) continue;
      champs.push({
        id: `voisin-${champs.length}`,
        x,
        z,
        w,
        d,
        sillons: rnd() < 0.5 ? 0 : Math.PI / 2,
        culture: cultures[Math.floor(rnd() * cultures.length)]!,
        decalage: Math.floor(rnd() * CYCLE_VOISIN),
        travaille: false,
      });
      break;
    }
  }

  /*
   * Qui travaille aujourd'hui.
   *
   * Deux engins au plus, et **là où on les verra**.
   *
   * Première version : « les cinq champs les plus proches », puis un tirage
   * parmi eux. Elle a placé un tracteur à quarante unités de l'origine — le
   * plus proche des cinq n'est proche que des quatre autres. Une borne
   * relative ne dit rien tant qu'on n'a pas dit de quoi ; celle-ci est
   * absolue.
   *
   * Deuxième version, corrigée mais toujours fausse à l'écran : les deux
   * engins tombaient derrière la ferme, cachés par le rail de gauche. Être
   * proche ne suffit pas — en vue isométrique, la moitié de ce qui est proche
   * est hors cadre. Le même penchant vers le bas de l'écran que pour les
   * champs, et le choix devient déterministe plutôt que tiré au sort : les
   * deux meilleurs, pas deux au hasard parmi cinq.
   */
  const visible = (c: ChampVoisin) => Math.hypot(c.x, c.z) - 0.35 * (c.x + c.z);
  const proches = [...champs]
    .filter((c) => c.culture !== "HERBE" && Math.hypot(c.x, c.z) <= PORTEE_ENGIN)
    .sort((a, b) => visible(a) - visible(b));
  for (const c of proches.slice(0, 2)) c.travaille = true;

  /* Les bosquets : dans les coins de champ et le long de la route. */
  const arbres: { x: number; z: number; taille: number }[] = [];
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 12 + rnd() * (etendue - 16);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const boite: Boite = { x, z, w: 1.6, d: 1.6 };
    if (seChevauchent(boite, ile, 1)) continue;
    if (seChevauchent(boite, cour, 1)) continue;
    if (distanceALaRoute(x, z, route) < 3) continue;
    if (champs.some((c) => seChevauchent(boite, c, 0.2))) continue;
    arbres.push({ x, z, taille: 1.5 + rnd() * 1.4 });
  }

  return { champs, route, arbres, etendue };
}
