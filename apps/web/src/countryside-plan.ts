/**
 * Le plan de la campagne autour de la ferme.
 *
 * ## Pourquoi un plan séparé du dessin
 *
 * La parcelle du joueur flottait dans le ciel : une dalle de terre, quatre
 * arbres, et plus rien au-delà. Ce module décide **ce qu'il y a autour** — les
 * parcelles des voisins, la route qui descend vers le reste du monde, les
 * bosquets, le trait de côte — sans toucher à Trois. C'est de l'arithmétique :
 * on peut donc le mesurer, et une parcelle qui chevauche la cour ou une route
 * qui coupe le parking se voient dans un test plutôt qu'à l'écran.
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
 * L'état d'une parcelle voisine — labourée, semée, en pousse, mûre, en
 * chaume — n'est pas stocké : il se **déduit** du jour de jeu, exactement comme
 * la saison et la pousse du joueur. Pas de tic-tac, pas de dérive, et un
 * voisin qui moissonne le fait le même jour pour tout le monde. L'hiver, plus
 * rien ne mûrit chez le voisin non plus.
 */

import type { Season } from "@farmsim/shared";

/** Ce qu'on voit dans une parcelle voisine. */
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

/**
 * Une parcelle de voisin.
 *
 * Décrite en **cases**, comme celle du joueur, et non en mètres : c'est ce qui
 * permet de la dessiner dans le même langage — une dalle de terre, un damier
 * de cases, une haie autour — plutôt qu'en rectangle de couleur posé sur
 * l'herbe. Un voisin doit ressembler à une ferme, pas à un tapis.
 */
export type ParcelleVoisine = {
  id: string;
  /** Centre, en unités monde. */
  x: number;
  z: number;
  /** Taille en cases. */
  gw: number;
  gh: number;
  /** Orientation du damier : 0 ou un quart de tour. */
  cap: number;
  culture: CultureVoisine;
  /** Décalage dans le cycle cultural, en jours de jeu. */
  decalage: number;
  /** Un engin y travaille-t-il ? */
  travaille: boolean;
  /** Un bâtiment de ferme au bord — toutes les parcelles n'en ont pas. */
  batiment: boolean;
};

export type PointPlan = { x: number; z: number };

export type PlanCampagne = {
  parcelles: ParcelleVoisine[];
  /** La route, du bord de la cour jusqu'à la côte. */
  route: PointPlan[];
  /** L'amorce qui relie le portail de la cour à la route. */
  desserte: PointPlan[];
  arbres: { x: number; z: number; taille: number; graine: number }[];
  /** Jusqu'où va la campagne. */
  rayonTerre: number;
};

export type OptionsPlan = {
  /** Nom de la parcelle, ou tout ce qui l'identifie : la graine en sort. */
  graine: string;
  /** Demi-emprise de l'île du joueur, marges comprises. */
  ileDemiLargeur: number;
  ileDemiProfondeur: number;
  /** Portail de la cour : c'est de là que part la desserte. */
  portail: PointPlan;
  /** Emprise de la cour, à ne pas cultiver ni traverser. */
  cour: { x: number; z: number; w: number; d: number };
  /** Combien de parcelles viser. Le réglage sobre en demande moins. */
  parcellesVisees?: number;
  /** Rayon des terres. */
  rayonTerre?: number;
};

/* ------------------------------------------------------------------ */
/* Les dimensions du monde                                             */
/* ------------------------------------------------------------------ */

/**
 * Jusqu'où va la campagne, en unités monde.
 *
 * Plus loin que ce qu'on en voit, et c'est voulu : le sol s'incurve, sa crête
 * tombe vers trente-sept unités, et tout ce qui est au-delà passe derrière
 * cette crête. C'est elle, l'horizon — une courbe, parce qu'un cercle vu de
 * biais en est une. On garde de la terre derrière pour que la brume ait de
 * quoi la fondre dans le ciel plutôt que de la couper net.
 */
export const RAYON_TERRE = 55;

/**
 * Jusqu'où s'installent les voisins.
 *
 * Bien en deçà de l'horizon : une parcelle à quarante unités est un timbre
 * qu'on ne distingue plus, et le tracteur qui la travaille, un pixel qui
 * tremble.
 */
export const RAYON_VOISINS = 28;

/**
 * Courbure du monde : creusement, en unités, par unité de distance au carré.
 *
 * C'est elle qui arrondit l'horizon. Choisie pour que la crête du sol — le
 * point le plus haut à l'écran — tombe vers trente-sept unités : assez loin
 * pour que toute la campagne tienne devant, assez près pour laisser du ciel.
 */
export const COURBURE = 0.0085;

/** L'altitude du sol à une distance donnée du centre. */
export function creux(rayon: number): number {
  return -COURBURE * rayon * rayon;
}

/**
 * La pente du sol à une distance donnée — sa dérivée.
 *
 * C'est elle qui donne l'assiette d'une parcelle, d'une voiture ou d'un engin.
 * Posés à plat sur un monde bombé, ils décollaient d'un bord et s'enterraient
 * de l'autre.
 */
export function pente(rayon: number): number {
  return -2 * COURBURE * rayon;
}

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
 * qu'on le remarque en revenant, assez peu pour que le décor ne clignote pas
 * sous les yeux.
 */
export const CYCLE_VOISIN = 20;

/**
 * Jusqu'où un engin de voisin mérite d'être dessiné, en unités monde.
 *
 * Au-delà, il fait deux pixels et son mouvement ressemble à un scintillement.
 */
export const PORTEE_ENGIN = 30;

/** Combien de voisins travaillent en même temps, au plus. */
export const ENGINS_MAX = 3;

const ORDRE: EtatChamp[] = ["LABOUR", "SEMIS", "POUSSE", "MUR", "CHAUME"];

/**
 * L'état d'une parcelle voisine, déduit du jour.
 *
 * L'hiver ne mûrit rien : chez le voisin comme chez le joueur, la terre est en
 * chaume ou déjà retournée pour l'année suivante. Laisser un champ d'or à côté
 * d'une parcelle gelée dirait que les saisons ne s'appliquent qu'au joueur.
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
    // Semé, la terre domine encore : on voit les rangs, pas la culture.
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
/* Géométrie de placement                                              */
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
  return Math.hypot(x - (p.x + t * dx), z - (p.z + t * dz));
}

/** Distance d'un point à une polyligne. */
export function distanceALaRoute(x: number, z: number, route: PointPlan[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < route.length; i++) {
    d = Math.min(d, distanceAuSegment(x, z, route[i]!, route[i + 1]!));
  }
  return d;
}

/** Emprise au sol d'une parcelle, hors haie. */
export function empriseParcelle(p: ParcelleVoisine): Boite {
  const pas = 1.06;
  const l = p.gw * pas + 1.1;
  const h = p.gh * pas + 1.1;
  const droit = Math.abs(Math.cos(p.cap)) > 0.5;
  return { x: p.x, z: p.z, w: droit ? l : h, d: droit ? h : l };
}

/**
 * L'azimut de la cour vue du centre de la ferme.
 *
 * C'est le secteur qu'on laisse vide : « il en faut tout autour sauf côté
 * parking ». Une parcelle plantée derrière la cour se retrouverait à moitié
 * cachée par elle, et l'entrée de la ferme perdrait son dégagement.
 */
export function azimutCour(o: OptionsPlan): number {
  return Math.atan2(o.cour.z, o.cour.x);
}

/** Écart angulaire signé, ramené dans [-π, π]. */
export function ecartAngle(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Demi-ouverture du secteur laissé libre devant la cour. */
export const SECTEUR_COUR = Math.PI / 4;

/* ------------------------------------------------------------------ */
/* La route                                                            */
/* ------------------------------------------------------------------ */

/** Demi-largeur de la chaussée, accotements compris. */
export const DEMI_ROUTE = 1.12;

/**
 * La route, du haut de la carte jusqu'à la côte.
 *
 * Elle passe **à côté** de la cour, jamais dessus : la première version la
 * calait sur le bord de l'île, si bien qu'elle traversait le parking de part
 * en part — « la route coupe le parking, c'est pas beau ». Le couloir se règle
 * maintenant sur le bord extérieur de la cour, plus la demi-chaussée et une
 * marge.
 *
 * En vue isométrique, « descendre » veut dire croître en x **et** en z à la
 * fois : la caméra regarde l'origine depuis (+x, +y, +z), de sorte que ces
 * deux axes viennent tous deux vers le spectateur.
 */
export function tracerRoute(o: OptionsPlan): PointPlan[] {
  const rnd = suite(grainerDe(o.graine + ":route"));
  const bordCour = o.cour.x - o.cour.w / 2;
  const couloirX = Math.min(bordCour, -o.ileDemiLargeur) - DEMI_ROUTE - 1.6 - rnd() * 0.8;
  const z0 = o.cour.z;
  const rayon = o.rayonTerre ?? RAYON_TERRE;
  return [
    { x: couloirX - 5, z: z0 - o.ileDemiProfondeur - rayon * 0.7 },
    { x: couloirX - 0.6, z: z0 - o.ileDemiProfondeur * 0.8 },
    { x: couloirX, z: z0 + 1 },
    { x: couloirX + 1.6, z: z0 + o.ileDemiProfondeur * 0.9 },
    { x: couloirX + 7, z: z0 + o.ileDemiProfondeur + 8 },
    // Elle sort du cadre par-dessus la crête, elle ne s'arrête nulle part.
    { x: couloirX + rayon * 0.7, z: z0 + rayon * 0.7 },
  ];
}

/**
 * La desserte : le bout de chemin qui relie le portail de la cour à la route.
 *
 * Sans elle, la ferme donnait sur une départementale qu'elle ne touchait pas —
 * une route qui passe devant chez vous sans que rien n'y mène.
 */
export function tracerDesserte(o: OptionsPlan, route: PointPlan[]): PointPlan[] {
  const portail = { x: o.cour.x - o.cour.w / 2, z: o.portail.z };
  // Le point de la route le plus proche du portail, à la perpendiculaire.
  let meilleur = route[0]!;
  let d = Infinity;
  for (let i = 0; i + 1 < route.length; i++) {
    const p = route[i]!;
    const q = route[i + 1]!;
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.min(1, Math.max(0, ((portail.x - p.x) * dx + (portail.z - p.z) * dz) / l2));
    const c = { x: p.x + t * dx, z: p.z + t * dz };
    const dist = Math.hypot(portail.x - c.x, portail.z - c.z);
    if (dist < d) {
      d = dist;
      meilleur = c;
    }
  }
  return [portail, meilleur];
}

/* ------------------------------------------------------------------ */
/* Le plan complet                                                     */
/* ------------------------------------------------------------------ */

/**
 * Le plan complet.
 *
 * Les parcelles se posent en couronne autour de l'île, une par secteur
 * angulaire, sauf devant la cour. Chaque secteur a droit à plusieurs essais de
 * rayon et de taille : un seul tirage et le secteur était perdu dès que le
 * premier rectangle mordait sur l'île, ce qui laissait des trous béants.
 */
export function planCampagne(o: OptionsPlan): PlanCampagne {
  const rayonTerre = o.rayonTerre ?? RAYON_TERRE;
  const vises = o.parcellesVisees ?? 12;
  const rnd = suite(grainerDe(o.graine));
  const route = tracerRoute(o);
  const desserte = tracerDesserte(o, route);

  const ile: Boite = {
    x: 0,
    z: 0,
    w: o.ileDemiLargeur * 2,
    d: o.ileDemiProfondeur * 2,
  };
  const cour: Boite = { ...o.cour };
  const versCour = azimutCour(o);

  const cultures: CultureVoisine[] = ["BLE", "ORGE", "COLZA", "MAIS", "TOURNESOL", "HERBE"];
  const parcelles: ParcelleVoisine[] = [];

  /* Les secteurs, dans l'ordre du plus visible au moins.
     En vue isométrique, le bas de l'écran est la direction (+x, +z) : c'est
     là qu'il y a de la place à l'image, et donc là qu'on peuple d'abord. */
  const secteurs: number[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) secteurs.push((i / n) * Math.PI * 2 - Math.PI);
  secteurs.sort((a, b) => Math.cos(b - Math.PI / 4) - Math.cos(a - Math.PI / 4));

  for (const angle of secteurs) {
    if (parcelles.length >= vises) break;
    if (Math.abs(ecartAngle(angle, versCour)) < SECTEUR_COUR) continue;
    for (let essai = 0; essai < 5; essai++) {
      const gw = 4 + Math.floor(rnd() * 5);
      const gh = 4 + Math.floor(rnd() * 4);
      const cap = rnd() < 0.5 ? 0 : Math.PI / 2;
      const rayon = 12 + rnd() * (RAYON_VOISINS - 12);
      const gigue = (rnd() - 0.5) * 0.34;
      const p: ParcelleVoisine = {
        id: `voisin-${parcelles.length}`,
        x: Math.cos(angle + gigue) * rayon,
        z: Math.sin(angle + gigue) * rayon,
        gw,
        gh,
        cap,
        culture: cultures[Math.floor(rnd() * cultures.length)]!,
        decalage: Math.floor(rnd() * CYCLE_VOISIN),
        travaille: false,
        batiment: rnd() < 0.34,
      };
      const boite = empriseParcelle(p);
      if (seChevauchent(boite, ile, 2.2)) continue;
      if (seChevauchent(boite, cour, 2.2)) continue;
      if (distanceALaRoute(p.x, p.z, route) < Math.max(boite.w, boite.d) / 2 + DEMI_ROUTE + 1) {
        continue;
      }
      if (distanceALaRoute(p.x, p.z, desserte) < Math.max(boite.w, boite.d) / 2 + 1.4) continue;
      if (parcelles.some((autre) => seChevauchent(boite, empriseParcelle(autre), 1.4))) continue;
      parcelles.push(p);
      break;
    }
  }

  /*
   * Qui travaille aujourd'hui.
   *
   * Trois engins, et **là où on les verra**.
   *
   * Être proche ne suffit pas : en vue isométrique, la moitié de ce qui est
   * proche tombe derrière la ferme ou sous le rail de gauche. Le score écarte
   * aussi ce qui part sur les côtés — `|x − z|` — parce que la droite de
   * l'écran est mangée par le panneau de parcelle. Deux engins seulement, et
   * six clichés sur six n'en montraient aucun : ils tombaient tous hors cadre.
   *
   * Le choix est déterministe : les meilleurs, pas des tirés au sort.
   */
  const visible = (p: ParcelleVoisine) =>
    Math.hypot(p.x, p.z) - 0.5 * (p.x + p.z) + 0.25 * Math.abs(p.x - p.z);
  const candidats = parcelles
    .filter((p) => p.culture !== "HERBE" && Math.hypot(p.x, p.z) <= PORTEE_ENGIN)
    .sort((a, b) => visible(a) - visible(b));
  for (const p of candidats.slice(0, ENGINS_MAX)) p.travaille = true;

  /* Les bosquets : dans les interstices, jamais sur une parcelle ni sur la
     route, et jamais les pieds dans l'eau. */
  const arbres: { x: number; z: number; taille: number; graine: number }[] = [];
  for (let i = 0; i < 160 && arbres.length < 46; i++) {
    const a = rnd() * Math.PI * 2;
    // Les bosquets vont plus loin que les parcelles : c'est ce qui donne de la
    // profondeur entre le dernier voisin et l'horizon.
    const r = 11 + rnd() * (RAYON_VOISINS + 14);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const boite: Boite = { x, z, w: 1.8, d: 1.8 };
    if (seChevauchent(boite, ile, 1.2)) continue;
    if (seChevauchent(boite, cour, 1.2)) continue;
    if (distanceALaRoute(x, z, route) < DEMI_ROUTE + 1.4) continue;
    if (distanceALaRoute(x, z, desserte) < 1.6) continue;
    if (parcelles.some((p) => seChevauchent(boite, empriseParcelle(p), 0.5))) continue;
    if (arbres.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2)) continue;
    arbres.push({ x, z, taille: 1.6 + rnd() * 1.5, graine: Math.floor(rnd() * 1e9) });
  }

  return { parcelles, route, desserte, arbres, rayonTerre };
}
