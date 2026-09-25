/**
 * La ferme libre : ce qui se pose sur un domaine, et où.
 *
 * Tout est ici, en données et en fonctions pures, parce que **deux** lecteurs
 * en ont besoin : le serveur, qui refuse une pose impossible, et le jeu, qui
 * peint le fantôme en vert ou en rouge et dit pourquoi. L'outil de
 * construction recopiait jusqu'ici la validation du serveur ; deux copies
 * finissent toujours par diverger. Celle-ci est la seule.
 *
 * Voir `docs/ferme-libre.md` pour les choix d'ensemble.
 */
import { BUILDING_DEFS, quarterTurns, type BuildingType } from "./index.js";
import { CASES_STANDARD, HECTARES_STANDARD } from "./parcelles.js";
import { LAND_BASE_PER_HA, fertilityFactor } from "./land.js";

/* ------------------------------------------------------------------ */
/* Terrain                                                              */
/* ------------------------------------------------------------------ */

/** Le sol d'une case possédée. La friche n'a pas de ligne : elle n'est pas à vous. */
export type SolCase = "CHAMP" | "PRE" | "EAU";
export const SOLS: readonly SolCase[] = ["CHAMP", "PRE", "EAU"];

/** Le revêtement d'un chemin. */
export type Revetement = "TERRE" | "GRAVIER" | "PAVE";
export const REVETEMENTS: readonly Revetement[] = ["TERRE", "GRAVIER", "PAVE"];

/** Marge du domaine autour de la grille d'origine, en cases. */
export const MARGE_DOMAINE = 6;
/** Côté d'un lot de terrain, en cases. */
export const TAILLE_LOT = 6;

export type Bornes = { minX: number; minY: number; maxX: number; maxY: number };

/** Les bornes du domaine : la grille d'origine plus sa marge (max exclus). */
export function bornesDomaine(gridW: number, gridH: number, marge: number): Bornes {
  const m = Math.max(0, Math.round(marge));
  return { minX: -m, minY: -m, maxX: gridW + m, maxY: gridH + m };
}

export function dansBornes(b: Bornes, x: number, y: number): boolean {
  return x >= b.minX && y >= b.minY && x < b.maxX && y < b.maxY;
}

export const cleCase = (x: number, y: number): string => `${x},${y}`;

/* ------------------------------------------------------------------ */
/* Catalogue                                                            */
/* ------------------------------------------------------------------ */

export type CategorieConstruction =
  | "TERRAIN"
  | "AGRICULTURE"
  | "BATIMENTS"
  | "ELEVAGE"
  | "NATURE"
  | "CHEMINS"
  | "DECORATION";

export const CATEGORIES: readonly { id: CategorieConstruction; nom: string; icone: string }[] = [
  { id: "TERRAIN", nom: "Terrain", icone: "🗺️" },
  { id: "AGRICULTURE", nom: "Agriculture", icone: "🌾" },
  { id: "BATIMENTS", nom: "Bâtiments", icone: "🏠" },
  { id: "ELEVAGE", nom: "Élevage", icone: "🐄" },
  { id: "NATURE", nom: "Nature", icone: "🌳" },
  { id: "CHEMINS", nom: "Chemins", icone: "🛤️" },
  { id: "DECORATION", nom: "Décoration", icone: "🪑" },
];

/**
 * Comment on pose :
 * - `TERRAIN` : on peint des cases en glissant (champ, pré, étang, chemins) ;
 * - `OBJET` : un objet du décor, dans la table `Amenagement` ;
 * - `BATIMENT` : un bâtiment du jeu, par les routes qui existaient déjà.
 */
export type ModePose = "TERRAIN" | "OBJET" | "BATIMENT";

/**
 * La règle d'occupation d'une entrée. Chacune dit quels sols elle admet et
 * quelles couches elle prend — c'est tout ce que `validerPose` regarde.
 */
export type RegleId = "CHAMP" | "PRE" | "EAU" | "CHEMIN" | "DECOR" | "BATIMENT";

type Regle = {
  /** Sols sur lesquels on peut poser. */
  sols: readonly SolCase[];
  /** Un champ **nu** (rien de semé) redevient pré sous la pose. */
  champNuAdmis: boolean;
  /** Tolère un chemin sous soi (sinon : refus). */
  surChemin: boolean;
  /** Tolère un objet ou un bâtiment sur la case (sinon : refus). */
  surVolume: boolean;
};

const REGLES: Record<RegleId, Regle> = {
  /* On ne cultive que du pré : un champ ne se peint ni sous une grange ni
     dans un étang, et un chemin se retire d'abord. */
  CHAMP: { sols: ["PRE", "CHAMP"], champNuAdmis: true, surChemin: false, surVolume: false },
  /* La gomme : elle rend l'herbe à ce qui n'est ni bâti ni semé. */
  PRE: { sols: ["PRE", "CHAMP", "EAU"], champNuAdmis: true, surChemin: true, surVolume: false },
  EAU: { sols: ["PRE", "EAU"], champNuAdmis: true, surChemin: false, surVolume: false },
  CHEMIN: { sols: ["PRE"], champNuAdmis: true, surChemin: true, surVolume: false },
  DECOR: { sols: ["PRE"], champNuAdmis: true, surChemin: false, surVolume: false },
  BATIMENT: { sols: ["PRE"], champNuAdmis: true, surChemin: false, surVolume: false },
};

export type EffetAmenagement = {
  /** Bonus de rendement des cases de champ à portée, 0,02 = +2 %. */
  bonusRendement: number;
  /** Portée, en cases, de centre à centre. */
  portee: number;
  /** Ce que le joueur lit. */
  libelle: string;
};

export type DefConstruction = {
  id: string;
  categorie: CategorieConstruction;
  nom: string;
  description: string;
  icone: string;
  pose: ModePose;
  /** Emprise au repos (quart de tour 0). Un terrain se peint case à case. */
  emprise: { w: number; h: number };
  /** Quarts de tour autorisés. */
  rotations: readonly number[];
  /** Prix : **par case** pour un terrain, à l'unité sinon. */
  prix: number;
  /** Part du prix rendue à la vente (hors fenêtre de regret). */
  revente: number;
  niveauMin: number;
  regle: RegleId;
  /** Se raccorde visuellement aux voisins du même type (haie, clôture). */
  connecte?: boolean;
  /** Pour un terrain : le sol ou le revêtement qu'il pose. */
  sol?: SolCase;
  revetement?: Revetement | null;
  /** Pour un bâtiment : son type dans `BUILDING_DEFS`. */
  batiment?: BuildingType;
  effet?: EffetAmenagement;
  /** Ce qu'il apporte au charme de la ferme. */
  charme: number;
};

/** Coût du remblai d'un étang, par case, quand on le rend au pré. */
export const COUT_REMBLAI = 8;

const terrains: DefConstruction[] = [
  {
    id: "champ",
    categorie: "AGRICULTURE",
    nom: "Champ",
    description: "Mettre du pré en culture. Glissez pour tracer le champ ; il s'agrandit de la même façon.",
    icone: "🌾",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 12,
    revente: 0,
    niveauMin: 1,
    regle: "CHAMP",
    sol: "CHAMP",
    charme: 0,
  },
  {
    id: "pre",
    categorie: "TERRAIN",
    nom: "Remettre en herbe",
    description: "Rend l'herbe : retire un chemin, remblaie un étang, rend au pré un champ nu.",
    icone: "🧹",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 0,
    revente: 0,
    niveauMin: 1,
    regle: "PRE",
    sol: "PRE",
    revetement: null,
    charme: 0,
  },
  {
    id: "etang",
    categorie: "NATURE",
    nom: "Étang",
    description: "Creuser un étang. Il irrigue les champs à trois cases ou moins.",
    icone: "💧",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 30,
    revente: 0,
    niveauMin: 2,
    regle: "EAU",
    sol: "EAU",
    effet: { bonusRendement: 0.03, portee: 3, libelle: "Irrigation : +3 % de rendement à 3 cases" },
    charme: 1,
  },
  {
    id: "chemin-terre",
    categorie: "CHEMINS",
    nom: "Chemin de terre",
    description: "Le chemin qu'on trace soi-même. Il se raccorde tout seul.",
    icone: "🟫",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 4,
    revente: 0,
    niveauMin: 1,
    regle: "CHEMIN",
    revetement: "TERRE",
    charme: 0.2,
  },
  {
    id: "chemin-gravier",
    categorie: "CHEMINS",
    nom: "Allée de gravier",
    description: "Une allée claire, qui tient par tous les temps.",
    icone: "⬜",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 9,
    revente: 0,
    niveauMin: 2,
    regle: "CHEMIN",
    revetement: "GRAVIER",
    charme: 0.4,
  },
  {
    id: "chemin-pave",
    categorie: "CHEMINS",
    nom: "Allée pavée",
    description: "Des pavés, pour la cour et l'entrée de la maison.",
    icone: "🧱",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 18,
    revente: 0,
    niveauMin: 4,
    regle: "CHEMIN",
    revetement: "PAVE",
    charme: 0.7,
  },
];

const objets: DefConstruction[] = [
  {
    id: "chene",
    categorie: "NATURE",
    nom: "Chêne",
    description: "Un grand arbre, de l'ombre et du caractère.",
    icone: "🌳",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 60,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 3,
  },
  {
    id: "pommier",
    categorie: "NATURE",
    nom: "Pommier",
    description: "Un fruitier : planté en rang, il fait un verger.",
    icone: "🍎",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 80,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 3,
  },
  {
    id: "sapin",
    categorie: "NATURE",
    nom: "Sapin",
    description: "Toujours vert, même l'hiver.",
    icone: "🌲",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 50,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 2,
  },
  {
    id: "buisson",
    categorie: "NATURE",
    nom: "Buisson",
    description: "Un massif bas, pour habiller un coin.",
    icone: "🌿",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 25,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 1,
  },
  {
    id: "fleurs",
    categorie: "NATURE",
    nom: "Massif de fleurs",
    description: "Des fleurs des champs au bord d'une allée.",
    icone: "🌼",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 30,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 2,
  },
  {
    id: "rocher",
    categorie: "NATURE",
    nom: "Rocher",
    description: "Un bloc de pierre moussu.",
    icone: "🪨",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0, 1, 2, 3],
    prix: 40,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 1,
  },
  {
    id: "haie",
    categorie: "NATURE",
    nom: "Haie",
    description: "Une haie champêtre : brise-vent, elle protège les cultures voisines.",
    icone: "🌱",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 60,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    connecte: true,
    effet: { bonusRendement: 0.02, portee: 2, libelle: "Brise-vent : +2 % de rendement à 2 cases" },
    charme: 1,
  },
  {
    id: "cloture",
    categorie: "DECORATION",
    nom: "Clôture en bois",
    description: "Pour délimiter une cour, un pré, une allée. Elle se raccorde toute seule.",
    icone: "🪵",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 35,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    connecte: true,
    charme: 0.5,
  },
  {
    id: "banc",
    categorie: "DECORATION",
    nom: "Banc",
    description: "Pour s'asseoir un moment au bord du champ.",
    icone: "🪑",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0, 1, 2, 3],
    prix: 120,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 2,
  },
  {
    id: "lampadaire",
    categorie: "DECORATION",
    nom: "Lampadaire",
    description: "Une lanterne de cour, allumée le soir.",
    icone: "🏮",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 150,
    revente: 0.5,
    niveauMin: 3,
    regle: "DECOR",
    charme: 2,
  },
  {
    id: "botte-foin",
    categorie: "DECORATION",
    nom: "Bottes de foin",
    description: "Trois bottes empilées, pour le décor.",
    icone: "🟨",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0, 1, 2, 3],
    prix: 40,
    revente: 0.5,
    niveauMin: 1,
    regle: "DECOR",
    charme: 1,
  },
  {
    id: "puits",
    categorie: "DECORATION",
    nom: "Puits",
    description: "Un vieux puits de pierre, au cœur de la cour.",
    icone: "⛲",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0, 1, 2, 3],
    prix: 400,
    revente: 0.5,
    niveauMin: 4,
    regle: "DECOR",
    charme: 4,
  },
];

/**
 * Le rangement des bâtiments du jeu dans les catégories du mode.
 *
 * Tous les bâtiments y passent : un type oublié ici tombe en « Bâtiments »,
 * il ne disparaît jamais du catalogue.
 */
const CATEGORIE_BATIMENT: Partial<Record<BuildingType, CategorieConstruction>> = {
  CATTLE_BARN: "ELEVAGE",
  PIGSTY: "ELEVAGE",
  HENHOUSE: "ELEVAGE",
  SHEEPFOLD: "ELEVAGE",
  PADDOCK: "ELEVAGE",
  PIG_YARD: "ELEVAGE",
  HEN_YARD: "ELEVAGE",
  WATER_TROUGH: "ELEVAGE",
  HAY_RACK: "ELEVAGE",
  MANURE_STORE: "ELEVAGE",
  BEEHIVE: "AGRICULTURE",
  SILO: "AGRICULTURE",
  BUNKER_SILO: "AGRICULTURE",
  HAY_BARN: "AGRICULTURE",
};

const ICONE_BATIMENT: Partial<Record<BuildingType, string>> = {
  FARMHOUSE: "🏡",
  SILO: "🛢️",
  HAY_BARN: "🏚️",
  MACHINE_SHED: "🚜",
  CATTLE_BARN: "🐄",
  PIGSTY: "🐖",
  HENHOUSE: "🐔",
  SHEEPFOLD: "🐑",
  COLD_ROOM: "❄️",
  WORKSHOP: "🔧",
  PADDOCK: "🟩",
  PIG_YARD: "🟫",
  HEN_YARD: "🟫",
  EMPLOYEE_HOUSING: "🏘️",
  MANURE_STORE: "💩",
  WATER_TROUGH: "🚰",
  HAY_RACK: "🌾",
  BUNKER_SILO: "🧱",
  SOLAR_PANELS: "☀️",
  WIND_TURBINE: "🌬️",
  BEEHIVE: "🐝",
  DAIRY: "🥛",
  MILL: "🏭",
};

function batiments(): DefConstruction[] {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).map((type) => {
    const d = BUILDING_DEFS[type];
    return {
      id: `batiment:${type}`,
      categorie: CATEGORIE_BATIMENT[type] ?? "BATIMENTS",
      nom: d.name,
      description: d.description ?? "",
      icone: ICONE_BATIMENT[type] ?? "🏠",
      pose: "BATIMENT",
      emprise: { w: d.w, h: d.h },
      rotations: [0, 1, 2, 3],
      prix: d.cost,
      /* La revente d'un bâtiment suit `buildingResaleValue` ; ce taux-ci
         n'est qu'indicatif pour l'affichage. */
      revente: 0.4,
      niveauMin: 1,
      regle: "BATIMENT",
      batiment: type,
      charme: 0,
    } satisfies DefConstruction;
  });
}

let _catalogue: DefConstruction[] | null = null;
/** Tout ce qui se pose, dans l'ordre d'affichage. */
export function catalogueConstruction(): DefConstruction[] {
  _catalogue ??= [...terrains, ...objets, ...batiments()];
  return _catalogue;
}

export function defConstruction(id: string): DefConstruction | undefined {
  return catalogueConstruction().find((d) => d.id === id);
}

/** Les objets du décor seuls : ce que la table `Amenagement` peut contenir. */
export function estObjetDecor(id: string): boolean {
  return defConstruction(id)?.pose === "OBJET";
}

/** Emprise d'une entrée après quarts de tour. */
export function empriseOrientee(def: Pick<DefConstruction, "emprise">, rotation = 0): { w: number; h: number } {
  return quarterTurns(rotation) % 2 === 0
    ? { w: def.emprise.w, h: def.emprise.h }
    : { w: def.emprise.h, h: def.emprise.w };
}

export function casesEmprise(x: number, y: number, w: number, h: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push({ x: x + dx, y: y + dy });
  return out;
}

/* ------------------------------------------------------------------ */
/* Occupation                                                           */
/* ------------------------------------------------------------------ */

export type Volume =
  | { type: "BATIMENT"; id: string }
  | { type: "OBJET"; id: string; defId: string }
  | { type: "CULTURE" }
  | { type: "ENGIN" };

export type CaseDomaine = {
  x: number;
  y: number;
  sol: SolCase;
  revetement: Revetement | null;
  volume: Volume | null;
};

/** Une case telle que le serveur la stocke — le strict nécessaire. */
export type CaseSource = {
  x: number;
  y: number;
  sol?: SolCase | null;
  revetement?: string | null;
  kind?: string | null;
  buildingId?: string | null;
  crop?: string | null;
};

export type AmenagementSource = {
  id: string;
  type: string;
  originX: number;
  originY: number;
  rotation: number;
};

/** La grille d'occupation d'un domaine, construite une fois par lecture. */
export type GrilleDomaine = {
  bornes: Bornes;
  cases: Map<string, CaseDomaine>;
};

function lireRevetement(v: string | null | undefined): Revetement | null {
  return v === "TERRE" || v === "GRAVIER" || v === "PAVE" ? v : null;
}

export function construireGrille(opts: {
  bornes: Bornes;
  cells: readonly CaseSource[];
  amenagements?: readonly AmenagementSource[];
}): GrilleDomaine {
  const cases = new Map<string, CaseDomaine>();
  for (const c of opts.cells) {
    let volume: Volume | null = null;
    if (c.kind === "BUILDING" && c.buildingId) volume = { type: "BATIMENT", id: c.buildingId };
    else if (c.kind === "CROP" || c.crop) volume = { type: "CULTURE" };
    else if (c.kind === "VEHICLE") volume = { type: "ENGIN" };
    cases.set(cleCase(c.x, c.y), {
      x: c.x,
      y: c.y,
      sol: c.sol === "PRE" || c.sol === "EAU" ? c.sol : "CHAMP",
      revetement: lireRevetement(c.revetement),
      volume,
    });
  }
  for (const a of opts.amenagements ?? []) {
    const def = defConstruction(a.type);
    if (!def) continue;
    const e = empriseOrientee(def, a.rotation);
    for (const p of casesEmprise(a.originX, a.originY, e.w, e.h)) {
      const c = cases.get(cleCase(p.x, p.y));
      if (c) c.volume = { type: "OBJET", id: a.id, defId: a.type };
    }
  }
  return { bornes: opts.bornes, cases };
}

/** Pourquoi une case refuse — dit tel quel au joueur. */
export type RaisonRefus =
  | "FRICHE"
  | "HORS_DOMAINE"
  | "BATIMENT"
  | "OBJET"
  | "CULTURE"
  | "ENGIN"
  | "CHEMIN"
  | "EAU"
  | "CHAMP"
  | "DEJA";

export const LIBELLE_REFUS: Record<RaisonRefus, string> = {
  FRICHE: "Terrain en friche — achetez ce lot d'abord",
  HORS_DOMAINE: "Hors de votre domaine",
  BATIMENT: "Occupé par un bâtiment",
  OBJET: "Occupé par un élément de décor",
  CULTURE: "Une culture est en place — récoltez d'abord",
  ENGIN: "Un engin est garé ici",
  CHEMIN: "Un chemin passe ici",
  EAU: "C'est de l'eau",
  CHAMP: "C'est un champ",
  DEJA: "Déjà fait",
};

export type VerdictCase = {
  x: number;
  y: number;
  ok: boolean;
  raison?: RaisonRefus;
  /** La case changerait-elle vraiment ? Faux pour « déjà fait ». */
  change: boolean;
};

/**
 * Une case peut-elle recevoir cette entrée ?
 *
 * `ignorer` : l'identifiant d'un objet ou d'un bâtiment qu'on déplace — ses
 * propres cases ne le gênent pas.
 */
export function verdictCase(
  grille: GrilleDomaine,
  def: DefConstruction,
  x: number,
  y: number,
  ignorer?: string,
): VerdictCase {
  const non = (raison: RaisonRefus): VerdictCase => ({ x, y, ok: false, raison, change: false });
  if (!dansBornes(grille.bornes, x, y)) return non("HORS_DOMAINE");
  const c = grille.cases.get(cleCase(x, y));
  if (!c) return non("FRICHE");
  const regle = REGLES[def.regle];
  const vol = c.volume;
  const volumeGenant =
    vol && !(ignorer && (vol.type === "BATIMENT" || vol.type === "OBJET") && vol.id === ignorer);
  if (volumeGenant && !regle.surVolume) {
    if (vol.type === "BATIMENT") return non("BATIMENT");
    if (vol.type === "OBJET") return non("OBJET");
    if (vol.type === "CULTURE") return non("CULTURE");
    return non("ENGIN");
  }
  if (c.revetement && !regle.surChemin) return non("CHEMIN");
  const solAdmis =
    regle.sols.includes(c.sol) || (c.sol === "CHAMP" && regle.champNuAdmis && !volumeGenant);
  if (!solAdmis) return non(c.sol === "EAU" ? "EAU" : c.sol === "CHAMP" ? "CHAMP" : "DEJA");

  // Un terrain déjà dans l'état voulu ne coûte rien et ne change rien.
  if (def.pose === "TERRAIN") {
    if (def.regle === "PRE") {
      const change = c.sol !== "PRE" || c.revetement !== null;
      return change ? { x, y, ok: true, change } : { x, y, ok: false, raison: "DEJA", change: false };
    }
    if (def.regle === "CHEMIN") {
      return c.revetement === (def.revetement ?? null)
        ? { x, y, ok: false, raison: "DEJA", change: false }
        : { x, y, ok: true, change: true };
    }
    if (def.sol && c.sol === def.sol) return { x, y, ok: false, raison: "DEJA", change: false };
  }
  return { x, y, ok: true, change: true };
}

export type VerdictPose = {
  ok: boolean;
  /** Première raison de refus, pour la bulle du fantôme. */
  raison?: RaisonRefus;
  cases: VerdictCase[];
  /** Coût de la pose (terrain : cases qui changent × prix ; remblai compris). */
  cout: number;
};

/** Un objet ou un bâtiment à un endroit, tourné de `rotation` quarts. */
export function validerPose(
  grille: GrilleDomaine,
  def: DefConstruction,
  pose: { x: number; y: number; rotation?: number },
  ignorer?: string,
): VerdictPose {
  const rot = def.rotations.includes(quarterTurns(pose.rotation ?? 0)) ? quarterTurns(pose.rotation ?? 0) : 0;
  const e = empriseOrientee(def, rot);
  const cases = casesEmprise(pose.x, pose.y, e.w, e.h).map((p) =>
    verdictCase(grille, def, p.x, p.y, ignorer),
  );
  const refus = cases.find((c) => !c.ok);
  return { ok: !refus, raison: refus?.raison, cases, cout: refus ? 0 : def.prix };
}

/**
 * Un terrain peint sur un rectangle : on garde ce qui peut l'être.
 *
 * Refuser tout le rectangle parce qu'un coin frôle un bâtiment rendrait le
 * tracé d'un chemin insupportable ; on peint les cases valides, on saute les
 * autres, et le fantôme montre lesquelles. Le refus n'arrive que si **rien**
 * ne peut être peint.
 */
export function validerPeinture(
  grille: GrilleDomaine,
  def: DefConstruction,
  cells: readonly { x: number; y: number }[],
): VerdictPose {
  const vus = new Set<string>();
  const cases: VerdictCase[] = [];
  for (const p of cells) {
    const k = cleCase(p.x, p.y);
    if (vus.has(k)) continue;
    vus.add(k);
    cases.push(verdictCase(grille, def, p.x, p.y));
  }
  const peintes = cases.filter((c) => c.ok && c.change);
  let cout = 0;
  for (const c of peintes) {
    cout += def.prix;
    // Rendre un étang au pré, c'est remblayer : ça se paie.
    if (def.regle === "PRE" && grille.cases.get(cleCase(c.x, c.y))?.sol === "EAU") cout += COUT_REMBLAI;
  }
  const refus = cases.find((c) => !c.ok && c.raison !== "DEJA") ?? cases.find((c) => !c.ok);
  return {
    ok: peintes.length > 0,
    raison: peintes.length ? undefined : (refus?.raison ?? "DEJA"),
    cases,
    cout,
  };
}

/** Les cases d'un rectangle entre deux coins, dans les bornes. */
export function rectangleCases(
  a: { x: number; y: number },
  b: { x: number; y: number },
  bornes?: Bornes,
): { x: number; y: number }[] {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const y1 = Math.max(a.y, b.y);
  const out: { x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (!bornes || dansBornes(bornes, x, y)) out.push({ x, y });
    }
  }
  return out;
}

/** Niveau et argent : ce qui interdit une entrée au joueur, s'il y a lieu. */
export function verrouConstruction(
  def: DefConstruction,
  joueur: { level: number },
): string | null {
  if (joueur.level < def.niveauMin) return `Niveau ${def.niveauMin} requis`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Raccords : chemins, haies, clôtures, eau                             */
/* ------------------------------------------------------------------ */

/** Bits de voisinage : 1 = nord (y−1), 2 = est (x+1), 4 = sud (y+1), 8 = ouest (x−1). */
export function masqueVoisins(
  presents: { has(k: string): boolean },
  x: number,
  y: number,
): number {
  let m = 0;
  if (presents.has(cleCase(x, y - 1))) m |= 1;
  if (presents.has(cleCase(x + 1, y))) m |= 2;
  if (presents.has(cleCase(x, y + 1))) m |= 4;
  if (presents.has(cleCase(x - 1, y))) m |= 8;
  return m;
}

/* ------------------------------------------------------------------ */
/* Les champs, déduits                                                  */
/* ------------------------------------------------------------------ */

/**
 * Un champ : des cases `CHAMP` qui se touchent par un côté.
 *
 * Pas de table pour eux : un champ **est** sa forme. Le peindre plus grand ou
 * le gommer à moitié le redessine sans qu'aucun identifiant ne se désaccorde.
 */
export type ChampEntite = {
  /** La case la plus au nord-ouest : stable tant que le champ ne perd pas ce coin. */
  id: string;
  nom: string;
  cases: { x: number; y: number }[];
  surface: number;
  /** Cases semées, par culture. */
  cultures: Record<string, number>;
  /** Cases nues. */
  nues: number;
};

export function champsDe(
  cells: readonly (CaseSource & { crop?: string | null })[],
): ChampEntite[] {
  const parCle = new Map<string, CaseSource>();
  for (const c of cells) if ((c.sol ?? "CHAMP") === "CHAMP") parCle.set(cleCase(c.x, c.y), c);
  const vus = new Set<string>();
  const champs: ChampEntite[] = [];
  const ordre = [...parCle.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const depart of ordre) {
    const k0 = cleCase(depart.x, depart.y);
    if (vus.has(k0)) continue;
    const pile = [depart];
    vus.add(k0);
    const cases: { x: number; y: number }[] = [];
    const cultures: Record<string, number> = {};
    let nues = 0;
    while (pile.length) {
      const c = pile.pop()!;
      cases.push({ x: c.x, y: c.y });
      if (c.crop) cultures[c.crop] = (cultures[c.crop] ?? 0) + 1;
      else nues++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = cleCase(c.x + dx, c.y + dy);
        const v = parCle.get(k);
        if (v && !vus.has(k)) {
          vus.add(k);
          pile.push(v);
        }
      }
    }
    champs.push({
      id: `champ:${k0}`,
      nom: `Champ ${champs.length + 1}`,
      cases,
      surface: cases.length,
      cultures,
      nues,
    });
  }
  return champs;
}

/* ------------------------------------------------------------------ */
/* Lots de terrain                                                      */
/* ------------------------------------------------------------------ */

export type Lot = {
  /** Identifiant stable : colonne et rang du lot dans le domaine. */
  id: string;
  i: number;
  j: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Le domaine découpé en lots de `TAILLE_LOT`, depuis son coin nord-ouest. */
export function lotsDuDomaine(b: Bornes): Lot[] {
  const lots: Lot[] = [];
  for (let j = 0, y = b.minY; y < b.maxY; j++, y += TAILLE_LOT) {
    for (let i = 0, x = b.minX; x < b.maxX; i++, x += TAILLE_LOT) {
      lots.push({
        id: `${i}:${j}`,
        i,
        j,
        x,
        y,
        w: Math.min(TAILLE_LOT, b.maxX - x),
        h: Math.min(TAILLE_LOT, b.maxY - y),
      });
    }
  }
  return lots;
}

export type EtatLot = "POSSEDE" | "ACHETABLE" | "ENCLAVE";

/** Un lot s'achète s'il touche par un côté une case déjà possédée. */
export function etatLot(lot: Lot, possedees: { has(k: string): boolean }): { etat: EtatLot; aAcheter: number } {
  let aAcheter = 0;
  let touche = false;
  for (let y = lot.y; y < lot.y + lot.h; y++) {
    for (let x = lot.x; x < lot.x + lot.w; x++) {
      if (possedees.has(cleCase(x, y))) continue;
      aAcheter++;
      if (
        !touche &&
        (possedees.has(cleCase(x + 1, y)) ||
          possedees.has(cleCase(x - 1, y)) ||
          possedees.has(cleCase(x, y + 1)) ||
          possedees.has(cleCase(x, y - 1)))
      ) {
        touche = true;
      }
    }
  }
  if (aAcheter === 0) return { etat: "POSSEDE", aAcheter };
  return { etat: touche ? "ACHETABLE" : "ENCLAVE", aAcheter };
}

/** Prix de la terre du jeu, par case (5 200 €/ha, 12×12 = 14 ha). */
export const PRIX_TERRE_PAR_CASE = (LAND_BASE_PER_HA * HECTARES_STANDARD) / CASES_STANDARD;
/**
 * Le premier lot à la moitié du prix de la terre : s'agrandir d'un bloc
 * contigu doit rester à portée tôt dans la partie — c'est le cœur de la
 * progression. Chaque lot suivant coûte `CROISSANCE_LOT` fois plus.
 */
export const REMISE_LOT = 0.5;
export const CROISSANCE_LOT = 1.18;
/** Niveau requis pour le n-ième lot (n à partir de 1) — un palier doux. */
export const NIVEAU_LOTS: readonly number[] = [1, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14];

export function niveauPourLot(n: number): number {
  const i = Math.max(1, Math.round(n)) - 1;
  return NIVEAU_LOTS[Math.min(i, NIVEAU_LOTS.length - 1)]! + Math.max(0, i - (NIVEAU_LOTS.length - 1)) * 2;
}

/** Prix d'un lot : cases à acheter × prix de la terre × fertilité × région × escalade. */
export function prixLot(opts: {
  cases: number;
  lotsAchetes: number;
  fertilite?: number;
  prixRegional?: number;
}): number {
  const brut =
    opts.cases *
    PRIX_TERRE_PAR_CASE *
    REMISE_LOT *
    fertilityFactor(opts.fertilite ?? 0.7) *
    (opts.prixRegional ?? 1) *
    Math.pow(CROISSANCE_LOT, Math.max(0, opts.lotsAchetes));
  return Math.ceil(brut / 50) * 50;
}

/* ------------------------------------------------------------------ */
/* Effets et charme                                                     */
/* ------------------------------------------------------------------ */

/** Plafond de tous les bonus du décor sur une case. */
export const BONUS_AMENAGEMENT_MAX = 0.05;

export type SourcesBonus = {
  /** Objets posés (haies…), avec leur type. */
  objets: readonly { type: string; originX: number; originY: number }[];
  /** Cases d'eau du domaine. */
  eaux: readonly { x: number; y: number }[];
};

/**
 * Le bonus de rendement qu'apporte le décor à une case de champ.
 *
 * Un par nature d'effet — deux haies ne font pas +4 % — et le tout plafonné :
 * une ferme jolie ne paie aucune pénalité, une ferme optimisée n'a pas de
 * disposition obligée.
 */
export function bonusAmenagementCase(sources: SourcesBonus, x: number, y: number): number {
  const meilleur = new Map<string, number>();
  const tenir = (cle: string, v: number) => meilleur.set(cle, Math.max(meilleur.get(cle) ?? 0, v));
  for (const o of sources.objets) {
    const def = defConstruction(o.type);
    const effet = def?.effet;
    if (!effet) continue;
    const d = Math.hypot(x - o.originX, y - o.originY);
    if (d <= effet.portee) tenir(def.id, effet.bonusRendement);
  }
  const etang = defConstruction("etang")?.effet;
  if (etang) {
    for (const e of sources.eaux) {
      if (Math.hypot(x - e.x, y - e.y) <= etang.portee) {
        tenir("etang", etang.bonusRendement);
        break;
      }
    }
  }
  let total = 0;
  for (const v of meilleur.values()) total += v;
  return Math.min(BONUS_AMENAGEMENT_MAX, total);
}

/**
 * Le charme d'une ferme : ce que le décor dit d'elle.
 *
 * Aucun effet économique — c'est un miroir, et la graine d'un futur
 * classement. Les objets comptent par leur charme, l'eau et les allées un peu.
 */
export function charmeDe(opts: {
  cells: readonly CaseSource[];
  amenagements: readonly { type: string }[];
}): number {
  let total = 0;
  for (const a of opts.amenagements) total += defConstruction(a.type)?.charme ?? 0;
  for (const c of opts.cells) {
    if (c.sol === "EAU") total += 1;
    const r = lireRevetement(c.revetement);
    if (r) total += defConstruction(r === "TERRE" ? "chemin-terre" : r === "GRAVIER" ? "chemin-gravier" : "chemin-pave")?.charme ?? 0;
  }
  return Math.round(total);
}

export function libelleCharme(charme: number): string {
  if (charme >= 200) return "Domaine remarquable";
  if (charme >= 100) return "Ferme de caractère";
  if (charme >= 40) return "Ferme accueillante";
  if (charme >= 10) return "Ferme soignée";
  return "Ferme de travail";
}
