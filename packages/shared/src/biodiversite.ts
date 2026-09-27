/**
 * La biodiversité : ce que le paysage attire, et qui s'installe.
 *
 * ## Des habitats, lus sur les cases
 *
 * Rien à saisir : une prairie de réserve, une haie, un bois, sa lisière, une
 * mare et sa roselière, une rivière, une falaise — tout se lit sur les cases
 * et le décor (`lireHabitats`). Le gros terraformage fait en terre de culture
 * compte **deux fois moins** qu'en réserve : les champs restent aux cultures,
 * la nature a sa place à côté.
 *
 * ## Cinq groupes de faune
 *
 * Pollinisateurs, auxiliaires (coccinelles, carabes), oiseaux, rapaces,
 * amphibiens. Chacun a ses habitats (`AFFINITES`), et sa population cible
 * sature : la centième case de prairie apporte moins que la dixième. Surtout,
 * la **mosaïque** paie : sept habitats qui se touchent valent plus que cent
 * cases d'un seul.
 *
 * ## Le temps
 *
 * Une population ne suit pas sa cible d'un coup : elle s'en approche avec une
 * demi-vie propre à chaque groupe (`deriveFaune`) — les pollinisateurs en un
 * jour de jeu, les rapaces en six. On revient voir qui s'est installé.
 *
 * Les décorations libres comptent aussi (`refugesDecor`) : un nichoir, un bain
 * d'oiseaux, une ruche en paille, des fleurs, une mare.
 */
import { BOIS_MATURITE_MS, croissanceBois, stadeBois } from "./bois.js";
import { GAME_DAY_MS } from "./time.js";

export type Habitat =
  | "PRAIRIE"
  | "PRE"
  | "FLEURS"
  | "HAIE"
  | "BOSQUET"
  | "ARBRE"
  | "BOIS_JEUNE"
  | "FUTAIE"
  | "VIEUX_BOIS"
  | "LISIERE"
  | "MARE"
  | "RIVIERE"
  | "ROSELIERE"
  | "ROCAILLE";

export const HABITATS: Record<Habitat, { nom: string; couleur: string }> = {
  PRAIRIE: { nom: "Prairie fleurie", couleur: "#e6c84a" },
  PRE: { nom: "Pré fauché", couleur: "#bcd48c" },
  FLEURS: { nom: "Massif fleuri", couleur: "#e27fb2" },
  HAIE: { nom: "Haie", couleur: "#3f7a35" },
  BOSQUET: { nom: "Buissons", couleur: "#6f9f4a" },
  ARBRE: { nom: "Arbre isolé", couleur: "#5c8c3b" },
  BOIS_JEUNE: { nom: "Jeune bois", couleur: "#4f8a45" },
  FUTAIE: { nom: "Futaie", couleur: "#2f5f33" },
  VIEUX_BOIS: { nom: "Vieux bois", couleur: "#23452a" },
  LISIERE: { nom: "Lisière", couleur: "#9bbd4d" },
  MARE: { nom: "Mare, lac", couleur: "#4f9cc4" },
  RIVIERE: { nom: "Rivière", couleur: "#2f8fd0" },
  ROSELIERE: { nom: "Roselière", couleur: "#86a79a" },
  ROCAILLE: { nom: "Rocaille, falaise", couleur: "#a3988a" },
};

export type Guilde = "POLLINISATEURS" | "AUXILIAIRES" | "OISEAUX" | "RAPACES" | "AMPHIBIENS";
export const GUILDES: readonly Guilde[] = ["POLLINISATEURS", "AUXILIAIRES", "OISEAUX", "RAPACES", "AMPHIBIENS"];

export const INFOS_GUILDE: Record<Guilde, { nom: string; icone: string; qui: string; aime: string }> = {
  POLLINISATEURS: {
    nom: "Pollinisateurs",
    icone: "🐝",
    qui: "abeilles sauvages, bourdons, papillons",
    aime: "prairies fleuries, massifs, lisières",
  },
  AUXILIAIRES: {
    nom: "Auxiliaires",
    icone: "🐞",
    qui: "coccinelles, carabes, syrphes",
    aime: "haies, buissons, prairies",
  },
  OISEAUX: { nom: "Oiseaux", icone: "🐦", qui: "mésanges, hirondelles, merles", aime: "haies, arbres, bois, nichoirs" },
  RAPACES: { nom: "Rapaces", icone: "🦉", qui: "chouettes, buses, faucons", aime: "vieux bois, falaises, et de la prairie où chasser" },
  AMPHIBIENS: { nom: "Faune des mares", icone: "🐸", qui: "grenouilles, tritons, libellules", aime: "mares, roselières, rivières" },
};

/** Ce que chaque habitat apporte à chaque groupe, par case. */
export const AFFINITES: Record<Guilde, Partial<Record<Habitat, number>>> = {
  POLLINISATEURS: { PRAIRIE: 3, FLEURS: 4, LISIERE: 2, HAIE: 1.5, BOSQUET: 1, PRE: 0.3, ARBRE: 0.5 },
  AUXILIAIRES: { HAIE: 3, BOSQUET: 2, LISIERE: 2, PRAIRIE: 1.5, BOIS_JEUNE: 1, ROSELIERE: 1, ROCAILLE: 1, PRE: 0.2 },
  OISEAUX: { HAIE: 2, ARBRE: 3, BOIS_JEUNE: 1.5, FUTAIE: 2, VIEUX_BOIS: 1, LISIERE: 2, BOSQUET: 1.5, MARE: 0.5, PRAIRIE: 0.5 },
  RAPACES: { VIEUX_BOIS: 5, FUTAIE: 1, ROCAILLE: 2, ARBRE: 1 },
  AMPHIBIENS: { MARE: 3, ROSELIERE: 4, RIVIERE: 1.5, BOIS_JEUNE: 0.3, FUTAIE: 0.5 },
};

/** La population qui fait la moitié d'une ferme pleine, en points bruts. */
const SATURATION: Record<Guilde, number> = { POLLINISATEURS: 180, AUXILIAIRES: 160, OISEAUX: 180, RAPACES: 60, AMPHIBIENS: 90 };
/** Le temps qu'il faut à une population pour faire la moitié du chemin, en jours de jeu. */
export const DEMI_VIE_INSTALLATION: Record<Guilde, number> = {
  POLLINISATEURS: 1,
  AUXILIAIRES: 2,
  OISEAUX: 3,
  RAPACES: 6,
  AMPHIBIENS: 2,
};
/** Un habitat détruit se vide plus vite qu'il ne se remplit. */
const DEMI_VIE_DEPART = 1;

/** Le gros terraformage en terre de culture compte deux fois moins qu'en réserve. */
export const POIDS_HORS_RESERVE = 0.5;
const GROS_HABITATS: ReadonlySet<Habitat> = new Set([
  "PRAIRIE",
  "BOIS_JEUNE",
  "FUTAIE",
  "VIEUX_BOIS",
  "LISIERE",
  "MARE",
  "RIVIERE",
  "ROSELIERE",
  "ROCAILLE",
]);

export type CaseNature = {
  x: number;
  y: number;
  sol?: string | null;
  revetement?: string | null;
  kind?: string | null;
  niveau?: number | null;
  boiseDepuis?: Date | string | null;
  vocation?: string | null;
};

export type LectureHabitats = {
  /** Les habitats de chaque case, le premier étant le principal. */
  parCase: Map<string, Habitat[]>;
  /** La surface pondérée de chaque habitat. */
  surfaces: Record<Habitat, number>;
  /** Le nombre d'habitats vraiment présents (deux cases ou plus). */
  diversite: number;
};

const k = (x: number, y: number) => `${x},${y}`;
const DIRS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** Les objets du décor posé qui font un habitat. */
const HABITAT_OBJET: Record<string, Habitat> = {
  haie: "HAIE",
  chene: "ARBRE",
  pommier: "ARBRE",
  sapin: "ARBRE",
  buisson: "BOSQUET",
  fleurs: "FLEURS",
  rocher: "ROCAILLE",
};

export function lireHabitats(opts: {
  cells: readonly CaseNature[];
  amenagements?: readonly { type: string; originX: number; originY: number }[];
  /** L'eau qui coule, si on la connaît (`hydrologie(cells).courante`). */
  courante?: ReadonlySet<string>;
  maintenant?: number;
}): LectureHabitats {
  const maintenant = opts.maintenant ?? Date.now();
  const cases = new Map(opts.cells.map((c) => [k(c.x, c.y), c]));
  const parCase = new Map<string, Habitat[]>();
  const surfaces = Object.fromEntries(Object.keys(HABITATS).map((h) => [h, 0])) as Record<Habitat, number>;
  const ajouter = (x: number, y: number, h: Habitat, reserve: boolean) => {
    const kk = k(x, y);
    const l = parCase.get(kk) ?? [];
    if (l.includes(h)) return;
    l.push(h);
    parCase.set(kk, l);
    surfaces[h] += reserve || !GROS_HABITATS.has(h) ? 1 : POIDS_HORS_RESERVE;
  };
  const estPre = (c: CaseNature | undefined) => !!c && c.sol === "PRE" && !c.revetement && c.kind !== "BUILDING";

  for (const c of opts.cells) {
    const reserve = c.vocation === "NATURE";
    const n = c.niveau ?? 0;
    if (c.sol === "BOIS") {
      const age = c.boiseDepuis == null ? BOIS_MATURITE_MS : maintenant - new Date(c.boiseDepuis).getTime();
      const st = stadeBois(croissanceBois(c.boiseDepuis ?? null, maintenant));
      if (st === "FUTAIE") ajouter(c.x, c.y, age >= 2 * BOIS_MATURITE_MS ? "VIEUX_BOIS" : "FUTAIE", reserve);
      else ajouter(c.x, c.y, "BOIS_JEUNE", reserve);
      if (st !== "PLANTS" && DIRS.some(([dx, dy]) => estPre(cases.get(k(c.x + dx, c.y + dy))))) ajouter(c.x, c.y, "LISIERE", reserve);
    } else if (c.sol === "EAU") {
      ajouter(c.x, c.y, opts.courante?.has(k(c.x, c.y)) ? "RIVIERE" : "MARE", reserve);
      if (DIRS.some(([dx, dy]) => {
        const v = cases.get(k(c.x + dx, c.y + dy));
        return !!v && v.sol !== "EAU";
      })) ajouter(c.x, c.y, "ROSELIERE", reserve);
    } else if (estPre(c)) {
      ajouter(c.x, c.y, reserve ? "PRAIRIE" : "PRE", reserve);
    }
    // Une case au bord d'une falaise, en haut ou en bas : un abri de pierre.
    if (c.sol !== "CHAMP" && c.sol !== "EAU" && DIRS.some(([dx, dy]) => {
      const v = cases.get(k(c.x + dx, c.y + dy));
      return !!v && (v.niveau ?? 0) !== n;
    })) ajouter(c.x, c.y, "ROCAILLE", reserve);
  }
  for (const a of opts.amenagements ?? []) {
    const h = HABITAT_OBJET[a.type];
    if (!h) continue;
    const c = cases.get(k(a.originX, a.originY));
    ajouter(a.originX, a.originY, h, c?.vocation === "NATURE");
  }
  const diversite = (Object.keys(surfaces) as Habitat[]).filter((h) => h !== "PRE" && surfaces[h] >= 2).length;
  return { parCase, surfaces, diversite };
}

/**
 * Plusieurs parcelles, une seule ferme : leurs surfaces s'additionnent, et un
 * habitat compte dans la diversité dès qu'il fait deux cases en tout.
 */
export function additionnerLectures(lectures: readonly LectureHabitats[]): LectureHabitats {
  const surfaces = Object.fromEntries(Object.keys(HABITATS).map((h) => [h, 0])) as Record<Habitat, number>;
  for (const l of lectures) for (const h of Object.keys(surfaces) as Habitat[]) surfaces[h] += l.surfaces[h];
  const diversite = (Object.keys(surfaces) as Habitat[]).filter((h) => h !== "PRE" && surfaces[h] >= 2).length;
  return { parCase: new Map(), surfaces, diversite };
}

/** Ce que les décorations libres apportent, par groupe — plafonné par article. */
const REFUGES_DECOR: Record<string, { guilde: Guilde; points: number; max: number }[]> = {
  NICHOIR: [{ guilde: "OISEAUX", points: 6, max: 5 }],
  BAIN_OISEAUX: [{ guilde: "OISEAUX", points: 4, max: 3 }],
  RUCHE: [{ guilde: "POLLINISATEURS", points: 3, max: 4 }],
  FLEURS: [{ guilde: "POLLINISATEURS", points: 1.5, max: 12 }],
  LAVANDE: [{ guilde: "POLLINISATEURS", points: 2, max: 10 }],
  BUISSON_COQUELICOTS: [{ guilde: "POLLINISATEURS", points: 2, max: 8 }],
  BUISSON_ROSES: [{ guilde: "POLLINISATEURS", points: 1.5, max: 8 }],
  TERRASSES: [{ guilde: "POLLINISATEURS", points: 6, max: 2 }],
  BUISSON: [
    { guilde: "AUXILIAIRES", points: 1.5, max: 10 },
    { guilde: "OISEAUX", points: 1, max: 10 },
  ],
  ROSEAUX: [{ guilde: "AMPHIBIENS", points: 1.5, max: 10 }],
  MARE: [{ guilde: "AMPHIBIENS", points: 8, max: 3 }],
  ROCHER: [{ guilde: "AUXILIAIRES", points: 1, max: 8 }],
  GROS_ROCHER: [{ guilde: "AUXILIAIRES", points: 1.5, max: 6 }],
  ARBRE_ROND: [{ guilde: "OISEAUX", points: 2.5, max: 10 }],
  ARBRE_LEGER: [{ guilde: "OISEAUX", points: 2.5, max: 10 }],
  ARBRE_AUTOMNE: [{ guilde: "OISEAUX", points: 2.5, max: 10 }],
  SAPIN: [{ guilde: "OISEAUX", points: 2, max: 10 }],
};

export function refugesDecor(decorations: readonly { code: string }[]): Record<Guilde, number> {
  const out = Object.fromEntries(GUILDES.map((g) => [g, 0])) as Record<Guilde, number>;
  const compte = new Map<string, number>();
  for (const d of decorations) compte.set(d.code, (compte.get(d.code) ?? 0) + 1);
  for (const [code, n] of compte) {
    for (const r of REFUGES_DECOR[code] ?? []) out[r.guilde] += Math.min(n, r.max) * r.points;
  }
  return out;
}

/** Le facteur de mosaïque : 0,55 pour un habitat seul, 1 à partir de sept. */
export function mosaique(diversite: number): number {
  return 0.55 + 0.45 * Math.min(1, diversite / 7);
}

export type Faune = Record<Guilde, number>;

/** La population que le paysage peut porter, de 0 à 100 par groupe. */
export function cibleFaune(lecture: LectureHabitats, refuges?: Record<Guilde, number>): Faune {
  const m = mosaique(lecture.diversite);
  const out = {} as Faune;
  for (const g of GUILDES) {
    let brut = refuges?.[g] ?? 0;
    for (const [h, a] of Object.entries(AFFINITES[g]) as [Habitat, number][]) brut += lecture.surfaces[h] * a;
    // Un rapace veut un perchoir, mais aussi de quoi chasser : de la prairie.
    if (g === "RAPACES") {
      const chasse = Math.min(1, (lecture.surfaces.PRAIRIE + lecture.surfaces.PRE * 0.3) / 20);
      brut *= 0.3 + 0.7 * chasse;
    }
    out[g] = Math.round(100 * (1 - Math.exp(-brut / SATURATION[g])) * m * 10) / 10;
  }
  return out;
}

/** Les populations s'approchent de leur cible, chacune à son rythme. */
export function deriveFaune(actuelle: Partial<Faune> | null | undefined, cible: Faune, ecouleMs: number): Faune {
  const out = {} as Faune;
  const jours = Math.max(0, ecouleMs) / GAME_DAY_MS;
  for (const g of GUILDES) {
    const v = actuelle?.[g] ?? 0;
    const c = cible[g];
    const dv = c >= v ? DEMI_VIE_INSTALLATION[g] : DEMI_VIE_DEPART;
    const suivi = v + (c - v) * (1 - Math.pow(0.5, jours / dv));
    out[g] = Math.round(suivi * 10) / 10;
  }
  return out;
}

/** Le score de biodiversité : la moyenne des groupes, de 0 à 100. */
export function scoreBiodiversite(f: Faune): number {
  return Math.round(GUILDES.reduce((s, g) => s + f[g], 0) / GUILDES.length);
}

export function libelleBiodiversite(score: number): string {
  if (score >= 85) return "Réserve remarquable";
  if (score >= 65) return "Havre de biodiversité";
  if (score >= 45) return "Ferme vivante";
  if (score >= 25) return "La nature s'installe";
  if (score >= 10) return "Quelques visiteurs";
  return "Terre nue";
}

/** Lire une faune stockée en JSON, sans jamais planter sur une donnée abîmée. */
export function lireFaune(json: string | null | undefined): Partial<Faune> {
  if (!json) return {};
  try {
    const brut = JSON.parse(json) as Record<string, unknown>;
    const out: Partial<Faune> = {};
    for (const g of GUILDES) {
      const v = brut[g];
      if (typeof v === "number" && Number.isFinite(v)) out[g] = Math.max(0, Math.min(100, v));
    }
    return out;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Ce que la faune rend                                                 */
/* ------------------------------------------------------------------ */

/** Les habitats qui font un paysage vivant autour d'un abri d'élevage. */
export const ABRIS_PAYSAGE: ReadonlySet<Habitat> = new Set([
  "HAIE",
  "BOSQUET",
  "ARBRE",
  "BOIS_JEUNE",
  "FUTAIE",
  "VIEUX_BOIS",
  "LISIERE",
  "MARE",
  "RIVIERE",
  "ROSELIERE",
  "PRAIRIE",
]);
/** Portée du paysage autour d'un abri, en cases depuis son emprise. */
export const PORTEE_PAYSAGE = 3;

/** Les cases d'un paysage vivant, pour `paysageAutour`. */
export function casesPaysage(lecture: LectureHabitats): Set<string> {
  const out = new Set<string>();
  for (const [kk, hs] of lecture.parCase) if (hs.some((h) => ABRIS_PAYSAGE.has(h))) out.add(kk);
  return out;
}

/** Un abri d'élevage a-t-il un paysage vivant à portée ? */
export function paysageAutour(
  paysage: ReadonlySet<string>,
  emprise: { originX: number; originY: number; w: number; h: number },
  portee = PORTEE_PAYSAGE,
): boolean {
  for (let y = emprise.originY - portee; y < emprise.originY + emprise.h + portee; y++) {
    for (let x = emprise.originX - portee; x < emprise.originX + emprise.w + portee; x++) {
      if (paysage.has(k(x, y))) return true;
    }
  }
  return false;
}

/** La pollinisation sauvage, au plus, sur une culture à fleurs. */
export const POLLINISATION_SAUVAGE_MAX = 0.06;
/** La régulation naturelle des ravageurs, au plus, sur toute culture. */
export const REGULATION_MAX = 0.04;
/** Les cultures que les pollinisateurs visitent. */
export const CULTURES_POLLINISEES: ReadonlySet<string> = new Set(["RAPE", "PEA"]);
/** Les habitats où butinent les pollinisateurs. */
const FLEURIES: ReadonlySet<Habitat> = new Set(["PRAIRIE", "FLEURS", "LISIERE", "HAIE"]);
/** Les habitats d'où partent les auxiliaires et les oiseaux. */
const ABRIS_AUXILIAIRES: ReadonlySet<Habitat> = new Set(["HAIE", "BOSQUET", "LISIERE", "PRAIRIE", "ARBRE", "BOIS_JEUNE"]);

export type SourcesBiodiversite = {
  faune: Partial<Faune>;
  fleuries: readonly { x: number; y: number }[];
  abris: readonly { x: number; y: number }[];
};

/** Les points d'où la faune rayonne, pour `bonusBiodiversiteCase`. */
export function sourcesBiodiversite(lecture: LectureHabitats, faune: Partial<Faune>): SourcesBiodiversite {
  const fleuries: { x: number; y: number }[] = [];
  const abris: { x: number; y: number }[] = [];
  for (const [kk, hs] of lecture.parCase) {
    const [x, y] = kk.split(",").map(Number) as [number, number];
    if (hs.some((h) => FLEURIES.has(h))) fleuries.push({ x, y });
    if (hs.some((h) => ABRIS_AUXILIAIRES.has(h))) abris.push({ x, y });
  }
  return { faune, fleuries, abris };
}

/**
 * Plein effet à portée, puis il décroît, sans tomber sous un quart : un
 * bourdon va loin, mais il préfère le champ d'à côté.
 */
function proximite(points: readonly { x: number; y: number }[], x: number, y: number, portee: number): number {
  if (!points.length) return 0;
  let d = Infinity;
  for (const p of points) d = Math.min(d, Math.hypot(p.x - x, p.y - y));
  return d <= portee ? 1 : Math.max(0.25, 1 - (d - portee) / (2 * portee));
}

/**
 * Ce que la faune rend à une case de champ.
 *
 * - **Pollinisation sauvage** : colza et pois, jusqu'à +6 %, selon la
 *   population de pollinisateurs et la distance aux fleurs (4 cases).
 * - **Régulation naturelle** : toute culture, jusqu'à +4 % — coccinelles,
 *   carabes et oiseaux mangent pucerons et limaces à 5 cases de leurs abris.
 */
export function bonusBiodiversiteCase(
  s: SourcesBiodiversite | null | undefined,
  x: number,
  y: number,
  crop: string | null | undefined,
): { pollinisation: number; regulation: number; total: number } {
  if (!s) return { pollinisation: 0, regulation: 0, total: 0 };
  const f = (g: Guilde) => (s.faune[g] ?? 0) / 100;
  const pollinisation =
    crop && CULTURES_POLLINISEES.has(crop) ? POLLINISATION_SAUVAGE_MAX * f("POLLINISATEURS") * proximite(s.fleuries, x, y, 4) : 0;
  const regulation = REGULATION_MAX * (0.6 * f("AUXILIAIRES") + 0.4 * f("OISEAUX")) * proximite(s.abris, x, y, 5);
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return { pollinisation: r(pollinisation), regulation: r(regulation), total: r(pollinisation + regulation) };
}

/* ------------------------------------------------------------------ */
/* Les aides agro-environnementales                                     */
/* ------------------------------------------------------------------ */

/** Ce qu'une case de réserve en bon état rapporte en aides, par saison. */
export const AIDE_PAR_CASE_SAISON = 20;
/** Au-delà, les aides plafonnent : c'est une aide, pas une rente. */
export const AIDE_CASES_MAX = 400;

/**
 * L'aide d'une journée de jeu : chaque case de réserve aménagée (un habitat
 * autre que du pré fauché) touche sa part, pondérée par la santé de la faune
 * — pleine à partir d'un score de 50.
 */
export function aideDuJour(opts: { casesReserve: number; score: number; joursParSaison: number }): number {
  const n = Math.min(AIDE_CASES_MAX, Math.max(0, opts.casesReserve));
  const qualite = Math.min(1, Math.max(0, opts.score) / 50);
  return Math.round(((n * AIDE_PAR_CASE_SAISON) / Math.max(1, opts.joursParSaison)) * qualite * 100) / 100;
}
