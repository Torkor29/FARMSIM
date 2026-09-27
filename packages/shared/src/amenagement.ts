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
import { NIVEAU_MAX, accesEngins, hydrologie, rampeValide, type Passage } from "./relief.js";
import { BONUS_BOIS, PORTEE_BOIS, PRIX_COUPE, croissanceBois, stadeBois } from "./bois.js";
import { LAND_BASE_PER_HA, fertilityFactor } from "./land.js";

/* ------------------------------------------------------------------ */
/* Terrain                                                              */
/* ------------------------------------------------------------------ */

/** Le sol d'une case possédée. La friche n'a pas de ligne : elle n'est pas à vous. */
export type SolCase = "CHAMP" | "PRE" | "EAU" | "BOIS";

export const SOLS: readonly SolCase[] = ["CHAMP", "PRE", "EAU", "BOIS"];

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

/**
 * Les bornes d'un domaine qui grandit : ce qu'on possède, calé sur la trame
 * des lots, plus un anneau de friche à vendre tout autour.
 *
 * Il n'y a plus de marge fixe. Acheter un lot au bord repousse la friche d'un
 * lot plus loin, dans cette direction-là seulement : le terrain grandit
 * autant qu'on veut, et ses bords suivent tout seuls.
 */
export function bornesDuDomaine(cells: readonly { x: number; y: number }[], anneau = 1): Bornes {
  if (!cells.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  const t = TAILLE_LOT;
  const r = Math.max(0, Math.round(anneau)) * t;
  return {
    minX: Math.floor(minX / t) * t - r,
    minY: Math.floor(minY / t) * t - r,
    maxX: Math.ceil((maxX + 1) / t) * t + r,
    maxY: Math.ceil((maxY + 1) / t) * t + r,
  };
}

export function dansBornes(b: Bornes, x: number, y: number): boolean {
  return x >= b.minX && y >= b.minY && x < b.maxX && y < b.maxY;
}

export const cleCase = (x: number, y: number): string => `${x},${y}`;

/* ------------------------------------------------------------------ */
/* Catalogue                                                            */
/* ------------------------------------------------------------------ */

export type CategorieConstruction =
  | "TERRAFORMAGE"
  | "TERRAIN"
  | "AGRICULTURE"
  | "BATIMENTS"
  | "ELEVAGE"
  | "NATURE"
  | "CHEMINS"
  | "DECORATION";

export const CATEGORIES: readonly { id: CategorieConstruction; nom: string; icone: string }[] = [
  { id: "TERRAFORMAGE", nom: "Terraformage", icone: "⛰️" },
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
 * - `BATIMENT` : un bâtiment du jeu, par les routes qui existaient déjà ;
 * - `OUTIL` : un geste qui façonne sans rien poser (les berges d'un lac).
 */
export type ModePose = "TERRAIN" | "OBJET" | "BATIMENT" | "OUTIL";

/**
 * La règle d'occupation d'une entrée. Chacune dit quels sols elle admet et
 * quelles couches elle prend — c'est tout ce que `validerPose` regarde.
 */
export type RegleId =
  | "CHAMP"
  | "PRE"
  | "EAU"
  | "CHEMIN"
  | "DECOR"
  | "BATIMENT"
  | "RELIEF"
  | "PONT"
  | "RAMPE"
  | "BOIS"
  | "COUPE"
  | "PRAIRIE";

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
  PRE: { sols: ["PRE", "CHAMP", "EAU", "BOIS"], champNuAdmis: true, surChemin: true, surVolume: false },
  EAU: { sols: ["PRE", "EAU"], champNuAdmis: true, surChemin: false, surVolume: false },
  /* Un chemin s'ouvre aussi à travers un bois : c'est un layon, et les
     engins y passent. */
  CHEMIN: { sols: ["PRE", "BOIS"], champNuAdmis: true, surChemin: true, surVolume: false },
  DECOR: { sols: ["PRE"], champNuAdmis: true, surChemin: false, surVolume: false },
  BATIMENT: { sols: ["PRE"], champNuAdmis: true, surChemin: false, surVolume: false },
  /* Surélever ou abaisser : la terre ferme nue, chemins compris (ils suivent). */
  RELIEF: { sols: ["PRE", "CHAMP", "BOIS"], champNuAdmis: true, surChemin: true, surVolume: false },
  /* Un pont ne se pose que sur l'eau. */
  PONT: { sols: ["EAU"], champNuAdmis: false, surChemin: false, surVolume: false },
  /* Une rampe, au pied d'une falaise ; un chemin peut y monter. */
  RAMPE: { sols: ["PRE"], champNuAdmis: true, surChemin: true, surVolume: false },
  /* Boiser : du pré ou un champ nu. */
  BOIS: { sols: ["PRE", "BOIS"], champNuAdmis: true, surChemin: false, surVolume: false },
  /* Couper : seulement du bois, et seulement une futaie (voir `verdictCase`). */
  COUPE: { sols: ["BOIS"], champNuAdmis: false, surChemin: false, surVolume: false },
  /* Semer une prairie fleurie : sur l'herbe de la campagne. */
  PRAIRIE: { sols: ["PRE"], champNuAdmis: false, surChemin: false, surVolume: false },
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

/** Le terraformage du relief et des passages : voir `relief.ts`. */
const relief: DefConstruction[] = [
  {
    id: "surelever",
    categorie: "TERRAFORMAGE",
    nom: "Surélever",
    description:
      "Monter la terre d'un niveau : buttes, terrasses, falaises. Un champ en hauteur qui regarde le sud devient un coteau.",
    icone: "⛰️",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 40,
    revente: 0,
    niveauMin: 1,
    regle: "RELIEF",
    effet: { bonusRendement: 0.02, portee: 0, libelle: "Coteau : +2 % sur un champ en hauteur exposé au sud" },
    charme: 0,
  },
  {
    id: "abaisser",
    categorie: "TERRAFORMAGE",
    nom: "Abaisser",
    description: "Descendre la terre d'un niveau, jusqu'à la plaine.",
    icone: "⛏️",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 20,
    revente: 0,
    niveauMin: 1,
    regle: "RELIEF",
    charme: 0,
  },
  {
    id: "pont",
    categorie: "TERRAFORMAGE",
    nom: "Pont",
    description: "Un pont de bois sur l'eau : les engins passent d'une rive à l'autre. Tournez-le dans l'axe du passage.",
    icone: "🌉",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0, 1],
    prix: 180,
    revente: 0.5,
    niveauMin: 1,
    regle: "PONT",
    charme: 3,
  },
  {
    id: "rampe",
    categorie: "TERRAFORMAGE",
    nom: "Rampe",
    description: "Une rampe au pied d'une falaise : les engins montent d'un niveau. Tournez-la vers le haut.",
    icone: "📐",
    pose: "OBJET",
    emprise: { w: 1, h: 1 },
    rotations: [0, 1, 2, 3],
    prix: 120,
    revente: 0.5,
    niveauMin: 1,
    regle: "RAMPE",
    charme: 1,
  },
];

/** Le bois : voir `bois.ts`. */
const bois: DefConstruction[] = [
  {
    id: "boiser",
    categorie: "NATURE",
    nom: "Boiser",
    description:
      "Planter un bois : il pousse seul, en une année de jeu, et se coupe ensuite tous les ans. Les engins n'y entrent pas — ouvrez-y un chemin.",
    icone: "🌲",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 25,
    revente: 0,
    niveauMin: 1,
    regle: "BOIS",
    sol: "BOIS",
    effet: { bonusRendement: BONUS_BOIS, portee: PORTEE_BOIS, libelle: "Brise-vent : +3 % à 2 cases, une fois le bois levé" },
    charme: 0,
  },
  {
    id: "couper",
    categorie: "NATURE",
    nom: "Couper",
    description: `Couper une futaie et la vendre à la scierie, ${PRIX_COUPE} € la case. Les souches rejettent : le bois repousse seul.`,
    icone: "🪓",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 0,
    revente: 0,
    niveauMin: 1,
    regle: "COUPE",
    charme: 0,
  },
  {
    id: "prairie",
    categorie: "NATURE",
    nom: "Prairie fleurie",
    description:
      "Semer des fleurs sauvages dans la campagne : coquelicots, bleuets, marguerites. Les pollinisateurs arrivent, et avec eux les oiseaux.",
    icone: "🌼",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 10,
    revente: 0,
    niveauMin: 1,
    regle: "PRAIRIE",
    charme: 0,
  },
];

/** Ce qui se fait dans la campagne, autour de la ferme — et seulement là pour le gros terraformage. */
export const OUTILS_CAMPAGNE: ReadonlySet<string> = new Set([
  "etang",
  "berge",
  "surelever",
  "abaisser",
  "boiser",
  "couper",
  "prairie",
  "pre",
]);
/** Ce qui ne se fait plus sur la ferme : le relief, l'eau, le bois, la prairie. */
export const GROS_TERRAFORMAGE: ReadonlySet<string> = new Set(["etang", "surelever", "abaisser", "boiser", "prairie"]);
/** Jusqu'où la campagne se façonne, en cases au-delà des lots à vendre. */
export const PORTEE_CAMPAGNE = 30;

/** Une case de la campagne : hors de la ferme et de ses lots à vendre, à portée. */
export function dansCampagne(bornes: Bornes, x: number, y: number): boolean {
  if (dansBornes(bornes, x, y)) return false;
  return (
    x >= bornes.minX - PORTEE_CAMPAGNE &&
    x < bornes.maxX + PORTEE_CAMPAGNE &&
    y >= bornes.minY - PORTEE_CAMPAGNE &&
    y < bornes.maxY + PORTEE_CAMPAGNE
  );
}

/** Coût du remblai d'un étang, par case, quand on le rend au pré. */
export const COUT_REMBLAI = 8;

/**
 * Les outils de terraformage : ils façonnent ce qui existe sans rien poser.
 */
const outils: DefConstruction[] = [
  {
    id: "berge",
    categorie: "TERRAFORMAGE",
    nom: "Berges",
    description: "Visez un coin de l'eau : chaque clic l'arrondit, le taille en biseau ou le remet d'équerre.",
    icone: "🪨",
    pose: "OUTIL",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 0,
    revente: 0,
    niveauMin: 1,
    regle: "EAU",
    charme: 0,
  },
];

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
    categorie: "TERRAFORMAGE",
    nom: "Creuser l'eau",
    description:
      "Creuser un lac, une mare, une rivière : glissez sur le pré. Il irrigue les champs à trois cases ou moins.",
    icone: "💧",
    pose: "TERRAIN",
    emprise: { w: 1, h: 1 },
    rotations: [0],
    prix: 30,
    revente: 0,
    niveauMin: 1,
    regle: "EAU",
    sol: "EAU",
    effet: { bonusRendement: 0.03, portee: 3, libelle: "Irrigation : +3 % à 3 cases, +4 % à 2 cases si l'eau coule" },
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
  _catalogue ??= [...outils, ...relief, ...terrains, ...bois, ...objets, ...batiments()];
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
  /** Le relief : 0 en plaine. */
  niveau: number;
  /** Un bois : quand il a été planté (ou coupé pour la dernière fois). */
  boiseDepuis: Date | string | null;
  /** Une prairie semée de fleurs sauvages (campagne). */
  fleurie: boolean;
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
  niveau?: number | null;
  boiseDepuis?: Date | string | null;
  fleurie?: boolean | null;
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
  /** Ponts et rampes : ce qui ouvre le passage aux engins (`relief.ts`). */
  passages?: Passage[];
  /** L'heure de lecture : c'est elle qui dit l'âge d'un bois. */
  maintenant?: number;
  /**
   * La ferme, ou la campagne autour. Dans la campagne pas d'engins : un bois
   * s'y coupe partout, sans chemin jusqu'à la lisière.
   */
  zone?: "FERME" | "CAMPAGNE";
};

function lireRevetement(v: string | null | undefined): Revetement | null {
  return v === "TERRE" || v === "GRAVIER" || v === "PAVE" ? v : null;
}

export function construireGrille(opts: {
  bornes: Bornes;
  cells: readonly CaseSource[];
  amenagements?: readonly AmenagementSource[];
  maintenant?: number;
  zone?: "FERME" | "CAMPAGNE";
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
      sol: c.sol === "PRE" || c.sol === "EAU" || c.sol === "BOIS" ? c.sol : "CHAMP",
      revetement: lireRevetement(c.revetement),
      volume,
      niveau: c.niveau ?? 0,
      boiseDepuis: c.boiseDepuis ?? null,
      fleurie: !!c.fleurie,
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
  const passages = (opts.amenagements ?? [])
    .filter((a) => a.type === "pont" || a.type === "rampe")
    .map((a) => ({ type: a.type, originX: a.originX, originY: a.originY, rotation: a.rotation }));
  return { bornes: opts.bornes, cases, passages, maintenant: opts.maintenant ?? Date.now(), zone: opts.zone ?? "FERME" };
}

const _acces = new WeakMap<GrilleDomaine, Set<string>>();
/**
 * Une case de bois que les engins peuvent couper : à la lisière d'une case
 * où ils roulent. Le fond d'un grand bois demande un chemin.
 */
export function aLaLisiere(grille: GrilleDomaine, x: number, y: number): boolean {
  let acces = _acces.get(grille);
  if (!acces) {
    acces = accesEngins([...grille.cases.values()], grille.passages ?? []);
    _acces.set(grille, acces);
  }
  return [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ].some(([dx, dy]) => acces.has(cleCase(x + dx!, y + dy!)));
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
  | "DEJA"
  | "SOMMET"
  | "PLAINE"
  | "RELIEF"
  | "RAMPE"
  | "BOIS"
  | "PAS_BOIS"
  | "JEUNE"
  | "ISOLE"
  | "CAMPAGNE"
  | "SUR_LA_FERME"
  | "OCCUPE";

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
  SOMMET: "Déjà au plus haut",
  PLAINE: "Déjà en plaine",
  RELIEF: "Un bâtiment se pose en plaine",
  RAMPE: "Une rampe monte d'un niveau : tournez-la vers la falaise",
  BOIS: "C'est un bois — défrichez d'abord (Remettre en herbe)",
  PAS_BOIS: "Il n'y a pas d'arbres ici",
  JEUNE: "Ces arbres sont trop jeunes pour la coupe",
  ISOLE: "Les engins n'y arrivent pas — ouvrez un chemin jusqu'à la lisière",
  CAMPAGNE: "Relief, eau, bois et prairies se font dans la campagne, autour de la ferme",
  SUR_LA_FERME: "C'est la ferme : ce geste se fait dessus, pas dans la campagne",
  OCCUPE: "Une route, la cour, le village ou le champ d'un voisin est là",
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
  if (!solAdmis) {
    if (def.regle === "COUPE") return non("PAS_BOIS");
    return non(c.sol === "EAU" ? "EAU" : c.sol === "CHAMP" ? "CHAMP" : c.sol === "BOIS" ? "BOIS" : "DEJA");
  }
  if (def.regle === "COUPE") {
    if (stadeBois(croissanceBois(c.boiseDepuis, grille.maintenant ?? Date.now())) !== "FUTAIE") return non("JEUNE");
    if (grille.zone !== "CAMPAGNE" && !aLaLisiere(grille, x, y)) return non("ISOLE");
    return { x, y, ok: true, change: true };
  }

  if (def.regle === "BATIMENT" && c.niveau !== 0) return non("RELIEF");
  /* La ferme et la campagne se partagent les gestes : le gros terraformage
     se fait dehors, les cultures, bâtiments et chemins sur la ferme. */
  if (grille.zone === "CAMPAGNE" ? !OUTILS_CAMPAGNE.has(def.id) : GROS_TERRAFORMAGE.has(def.id)) {
    return non(grille.zone === "CAMPAGNE" ? "SUR_LA_FERME" : "CAMPAGNE");
  }
  if (def.regle === "PRAIRIE") {
    return c.sol === "PRE" && c.fleurie ? non("DEJA") : { x, y, ok: true, change: true };
  }
  if (def.regle === "RELIEF") {
    if (def.id === "surelever") return c.niveau >= NIVEAU_MAX ? non("SOMMET") : { x, y, ok: true, change: true };
    return c.niveau <= 0 ? non("PLAINE") : { x, y, ok: true, change: true };
  }
  // Un terrain déjà dans l'état voulu ne coûte rien et ne change rien.
  if (def.pose === "TERRAIN") {
    if (def.regle === "PRE") {
      const change = c.sol !== "PRE" || c.revetement !== null || c.fleurie;
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
  let refus = cases.find((c) => !c.ok);
  if (!refus && def.regle === "RAMPE") {
    const niveaux = [...grille.cases.values()].map((c) => ({ x: c.x, y: c.y, sol: c.sol, niveau: c.niveau }));
    if (!rampeValide(niveaux, pose.x, pose.y, rot)) {
      refus = { x: pose.x, y: pose.y, ok: false, raison: "RAMPE", change: false };
      cases[0] = refus;
    }
  }
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
  /**
   * Identifiant stable : colonne et rang du lot sur la trame **globale** du
   * terrain (le lot `0:0` couvre les cases 0 à 5). Il ne change donc pas
   * quand le domaine grandit, et peut être négatif.
   */
  id: string;
  i: number;
  j: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

/** Le lot de la trame qui contient une case. */
export function lotDeCase(x: number, y: number): Lot {
  const i = Math.floor(x / TAILLE_LOT);
  const j = Math.floor(y / TAILLE_LOT);
  return { id: `${i}:${j}`, i, j, x: i * TAILLE_LOT, y: j * TAILLE_LOT, w: TAILLE_LOT, h: TAILLE_LOT };
}

/** Un lot par son identifiant de trame (`i:j`), ou `null` s'il est mal formé. */
export function lotParId(id: string): Lot | null {
  const m = /^(-?\d+):(-?\d+)$/.exec(id);
  if (!m) return null;
  return lotDeCase(Number(m[1]) * TAILLE_LOT, Number(m[2]) * TAILLE_LOT);
}

/** Les lots de la trame qui recouvrent des bornes (calées ou non). */
export function lotsDuDomaine(b: Bornes): Lot[] {
  const lots: Lot[] = [];
  const j0 = Math.floor(b.minY / TAILLE_LOT);
  const i0 = Math.floor(b.minX / TAILLE_LOT);
  for (let j = j0, y = j0 * TAILLE_LOT; y < b.maxY; j++, y += TAILLE_LOT) {
    for (let i = i0, x = i0 * TAILLE_LOT; x < b.maxX; i++, x += TAILLE_LOT) {
      lots.push({
        id: `${i}:${j}`,
        i,
        j,
        x,
        y,
        w: TAILLE_LOT,
        h: TAILLE_LOT,
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
 * progression.
 */
export const REMISE_LOT = 0.5;
/** Niveau requis pour le n-ième lot (n à partir de 1) — un palier doux. */
export const NIVEAU_LOTS: readonly number[] = [1, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14];
/** Au-delà du tableau, un niveau de plus tous les deux lots, jusqu'à ce plafond. */
export const NIVEAU_LOT_MAX = 60;

export function niveauPourLot(n: number): number {
  const i = Math.max(1, Math.round(n)) - 1;
  const dernier = NIVEAU_LOTS.length - 1;
  if (i <= dernier) return NIVEAU_LOTS[i]!;
  return Math.min(NIVEAU_LOT_MAX, NIVEAU_LOTS[dernier]! + Math.ceil((i - dernier) / 2));
}

/**
 * Ce que la surface déjà possédée ajoute au prix : la racine du nombre de
 * fermes de départ qu'on possède.
 *
 * Une escalade par lot (×1,18 à chaque achat) rendait le trentième lot cent
 * fois plus cher que le premier — un mur, pas une pente. Avec la racine, une
 * ferme quatre fois plus grande paie sa terre deux fois plus cher, une ferme
 * seize fois plus grande quatre fois : on peut grandir sans fin, chaque lot
 * restant un vrai choix face à une machine ou un bâtiment.
 */
export function facteurSurface(possedees: number): number {
  return Math.sqrt(Math.max(1, possedees / CASES_STANDARD));
}

/** Prix d'un lot : cases à acheter × prix de la terre × fertilité × région × surface. */
export function prixLot(opts: {
  cases: number;
  /** Cases déjà possédées sur ce terrain. */
  possedees: number;
  fertilite?: number;
  prixRegional?: number;
}): number {
  const brut =
    opts.cases *
    PRIX_TERRE_PAR_CASE *
    REMISE_LOT *
    fertilityFactor(opts.fertilite ?? 0.7) *
    (opts.prixRegional ?? 1) *
    facteurSurface(opts.possedees);
  return Math.ceil(brut / 50) * 50;
}


/* ------------------------------------------------------------------ */
/* Effets et charme                                                     */
/* ------------------------------------------------------------------ */

/** Plafond de tous les bonus du décor sur une case. */
export const BONUS_AMENAGEMENT_MAX = 0.08;

/** L'eau qui coule irrigue mieux et plus près qu'un lac. */
export const BONUS_RIVIERE = 0.04;
export const PORTEE_RIVIERE = 2;

export type SourcesBonus = {
  /** Objets posés (haies…), avec leur type. */
  objets: readonly { type: string; originX: number; originY: number }[];
  /** Cases d'eau du domaine ; `courante` pour une rivière. */
  eaux: readonly { x: number; y: number; courante?: boolean }[];
  /** Les champs en coteau (terrasse exposée au sud). */
  coteaux?: readonly { x: number; y: number }[];
  /** Les cases de bois levé (jeune bois ou futaie) : un brise-vent. */
  bois?: readonly { x: number; y: number }[];
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
      const d = Math.hypot(x - e.x, y - e.y);
      if (d <= etang.portee) tenir("etang", etang.bonusRendement);
      if (e.courante && d <= PORTEE_RIVIERE) tenir("riviere", BONUS_RIVIERE);
    }
  }
  // Un bois levé coupe le vent mieux qu'une haie ; les deux ne s'ajoutent pas.
  for (const b of sources.bois ?? []) {
    if (Math.hypot(x - b.x, y - b.y) <= PORTEE_BOIS) tenir("haie", BONUS_BOIS);
  }
  const coteau = defConstruction("surelever")?.effet;
  if (coteau && sources.coteaux?.some((c) => c.x === x && c.y === y)) tenir("coteau", coteau.bonusRendement);
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
  maintenant?: number;
}): number {
  let total = 0;
  for (const a of opts.amenagements) total += defConstruction(a.type)?.charme ?? 0;
  // Une cascade, c'est le clou d'un jardin.
  total += hydrologie(opts.cells).chutes.length * 3;
  const maintenant = opts.maintenant ?? Date.now();
  for (const c of opts.cells) {
    if (c.sol === "EAU") total += 1;
    // Un bois compte à mesure qu'il se lève : un demi-point par case de futaie.
    if (c.sol === "BOIS") {
      const st = stadeBois(croissanceBois(c.boiseDepuis, maintenant));
      total += st === "FUTAIE" ? 0.5 : st === "JEUNE" ? 0.25 : 0;
    }
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

/* ------------------------------------------------------------------ */
/* Berges : la forme de chaque coin d'eau                               */
/* ------------------------------------------------------------------ */

/**
 * La forme d'un coin d'eau : rond (par défaut — un lac se dessine en
 * courbes), d'équerre, ou taillé en biseau.
 *
 * Une case d'eau porte ses quatre coins dans un entier (`ParcelCell.forme`),
 * deux bits chacun : nord-ouest, nord-est, sud-est, sud-ouest.
 */
export type StyleCoin = 0 | 1 | 2;
export const STYLE_ROND: StyleCoin = 0;
export const STYLE_CARRE: StyleCoin = 1;
export const STYLE_BISEAU: StyleCoin = 2;
export const NOMS_STYLE_COIN: Record<StyleCoin, string> = { 0: "arrondi", 1: "d'équerre", 2: "en biseau" };

/** 0 nord-ouest, 1 nord-est, 2 sud-est, 3 sud-ouest (y croît vers le sud). */
export type Coin = 0 | 1 | 2 | 3;

/** Les deux côtés qui encadrent un coin, en décalages de case. */
export const COTES_DU_COIN: Record<Coin, readonly [readonly [number, number], readonly [number, number]]> = {
  0: [[0, -1], [-1, 0]],
  1: [[0, -1], [1, 0]],
  2: [[0, 1], [1, 0]],
  3: [[0, 1], [-1, 0]],
};

export function styleCoin(forme: number | null | undefined, coin: Coin): StyleCoin {
  const v = ((forme ?? 0) >> (coin * 2)) & 3;
  return (v > 2 ? 0 : v) as StyleCoin;
}

export function avecStyleCoin(forme: number | null | undefined, coin: Coin, style: StyleCoin): number {
  return ((forme ?? 0) & ~(3 << (coin * 2))) | (style << (coin * 2));
}

/** Le style qui suit, à chaque clic : rond → d'équerre → biseau → rond. */
export function styleSuivant(style: StyleCoin): StyleCoin {
  return ((style + 1) % 3) as StyleCoin;
}

/** Le coin visé dans une case, d'après la position dans la case (−0,5 à 0,5). */
export function coinVise(fx: number, fy: number): Coin {
  if (fy < 0) return fx < 0 ? 0 : 1;
  return fx < 0 ? 3 : 2;
}

/**
 * Le coin se façonne-t-il ?
 *
 * Seul un coin **saillant** — aucun de ses deux côtés ne touche l'eau — a une
 * forme à choisir ; un coin qui continue vers une autre case d'eau n'est pas
 * un coin, c'est le milieu d'une rive.
 */
export function coinFaconnable(eaux: { has(k: string): boolean }, x: number, y: number, coin: Coin): boolean {
  if (!eaux.has(cleCase(x, y))) return false;
  return COTES_DU_COIN[coin].every(([dx, dy]) => !eaux.has(cleCase(x + dx, y + dy)));
}

/** Les paliers d'un lac qui grandit : chacun se fête. */
export const PALIERS_LAC: readonly number[] = [1, 4, 9, 16, 25, 36, 49, 64, 81, 100];

/** Les étendues d'eau d'un domaine, en ensembles de cases qui se touchent par un côté. */
export function etenduesEau(cells: readonly { x: number; y: number; sol?: string | null }[]): string[][] {
  const eaux = new Set(cells.filter((c) => c.sol === "EAU").map((c) => cleCase(c.x, c.y)));
  const vues = new Set<string>();
  const out: string[][] = [];
  for (const k of eaux) {
    if (vues.has(k)) continue;
    const pile = [k];
    const zone: string[] = [];
    vues.add(k);
    while (pile.length) {
      const c = pile.pop()!;
      zone.push(c);
      const [x, y] = c.split(",").map(Number) as [number, number];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = cleCase(x + dx, y + dy);
        if (eaux.has(n) && !vues.has(n)) {
          vues.add(n);
          pile.push(n);
        }
      }
    }
    out.push(zone);
  }
  return out;
}

/**
 * Le palier franchi par un geste, s'il y en a un : la plus grande étendue
 * d'eau après le geste comparée à la plus grande avant.
 */
export function palierFranchi(avant: number, apres: number): number | null {
  let franchi: number | null = null;
  for (const p of PALIERS_LAC) if (avant < p && apres >= p) franchi = p;
  return franchi;
}
