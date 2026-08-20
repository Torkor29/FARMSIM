import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  isYardCell,
  parkingLayout,
  BUILDING_DEFS,
  RIPENESS_COLORS,
  artGroundFraction,
  billboardLift,
  opaqueRowSpans,
  workAnimationMs,
  type AnimalKind,
  type BuildingType,
  type CropCode,
  type MachineType,
  type RipenessStage,
} from "@farmsim/shared";
import { disposeRenderer, disposeThreeScene, markShared } from "./three-cleanup";
import { applyHerdPose, meshForHerd } from "./animal-meshes";
import { createBuildingRig, nearestThreshold, type BuildingRig } from "./buildings3d";
import { createParkingRig, type ParkingRig } from "./parking3d";
import { createCropField } from "./crop-field";
import type { CropShape } from "./crop-shapes";
import { attachStudioEnvironment } from "./machine-kit";
import {
  createDustTrail,
  createExhaustSmoke,
  createMachineRig,
  hitchTrailer,
  isTowedImplement,
  type MachineRig,
} from "./machines3d";
import { createSpray } from "./particles";
import { buildCharacter } from "./character-mesh";
import { initialQuality, makeFrameGovernor, qualityForContext, type RenderQuality } from "./render-quality";
import { DEFAULT_MODS, readMods, type PointerMods } from "./ui/selection";
import type { CharacterAppearance } from "@farmsim/shared";

export type IsoCell = {
  x: number;
  y: number;
  kind: "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";
  crop?: CropCode | null;
  fieldStage?: string;
  fertilizedPasses?: number;
  /** Chaumes après moisson : la case n'est pas semable en l'état */
  hasStubble?: boolean;
  /** Désherbage fait ; sans lui, les adventices concurrencent la culture */
  /** Pression d'adventices, 0 à 1 : le peuplement s'en ressent. */
  weedPressure?: number;
  /** Déchaumages consécutifs — le sol s'assombrit à mesure qu'il s'enrichit */
  residuePasses?: number;
  strawTons?: number;
  baleCount?: number;
  /** Type machine si kind === VEHICLE (sinon TRACTOR par défaut) */
  machineType?: MachineType | null;
  /** État de la machine garée, 0 à 100 — il se lit sur sa carrosserie */
  machineCondition?: number | null;
  /** Coupes / moissons depuis le labour — l'herbe déjà fauchée est plus courte */
  harvestsSincePlow?: number;
  lastCrop?: CropCode | null;
  /** Épandage de fumier récent : la case s'assombrit une minute */
  manuredUntil?: number;
};

export type ManurePile = {
  buildingId: string;
  originX: number;
  originY: number;
  w: number;
  h: number;
  fill: number;
};

export type IsoBuilding = {
  id: string;
  type: BuildingType;
  originX: number;
  originY: number;
  /** 1 à 5 — le bâtiment grandit et se garnit à chaque palier */
  level?: number;
  /**
   * Quarts de tour, 0 à 3. La façade regarde `+z` au repos ; un quart impair
   * permute largeur et profondeur de l'empreinte.
   */
  rotation?: number;
  /** Bêtes dehors : les vantaux s'ouvrent et le troupeau franchit le seuil */
  doorOpen?: boolean;
};

export type IsoSim = {
  x: number;
  y: number;
  sim: {
    progress: number;
    ready: boolean;
    ripeness?: { stage: RipenessStage } | null;
    lost?: boolean;
    /**
     * Instant de maturité, en millisecondes epoch.
     *
     * C'est lui qui permet à la jauge de pousse d'avancer **entre** deux
     * sondages du serveur : la scène ne se reconstruit qu'à chaque dixième de
     * progression, une jauge qui n'aurait que `progress` avancerait par
     * à-coups de dix pour cent.
     */
    readyAt?: number;
  };
};

/**
 * Une caisse commandée au négociant, posée dans la cour.
 *
 * `arrivesAt` est dans le futur tant que le camion roule : on ne dessine rien
 * avant. Le joueur voit donc apparaître sa commande, il ne la trouve pas déjà
 * là — c'est toute la différence entre « recevoir » et « avoir ».
 */
export type SupplyCrate = {
  id: string;
  commodity: string;
  tons: number;
  arrivesAt: number;
  x: number;
  y: number;
};

export type ActiveWork = {
  type: MachineType;
  cells: { x: number; y: number }[];
  /** État de l'engin de chantier, 0 à 100 */
  condition?: number | null;
  /** La machine coupe : moisson (cache le plant) ou fauche (andain) */
  cut?: "harvest" | "mow";
  /** Livraison : tracteur + remorque, sans toucher aux cultures */
  haul?: boolean;
  cargo?: string;
  /**
   * Durée du chantier côté serveur. L'engin doit mettre exactement ce
   * temps-là à traverser le champ : sinon une moissonneuse T3, deux fois plus
   * rapide au compteur, le traverserait comme une T1.
   */
  durationMs?: number;
};

/** Un troupeau au pré : de quelle étable il sort, et vers quel enclos. */
export type GrazingHerd = {
  buildingId: string;
  animals: number;
  kind?: AnimalKind | string;
  /** Moutons tondus : la toison est partie, le corps dessous ne change pas. */
  sheared?: boolean;
  /**
   * Bien-être du lot, 0 à 1. Une bête mal tenue a le poil terne, l'échine
   * creuse et la tête basse — c'est le seul endroit où l'élevage se lit sans
   * ouvrir un menu.
   */
  welfare?: number;
  /** Production en attente (lait, œufs, laine), 0 à 1 : le pis se remplit. */
  yield?: number;
  /** Dehors dans l’enclos ; sinon collées à l’étable. */
  out?: boolean;
  barn: { originX: number; originY: number; w: number; h: number };
  paddock: { originX: number; originY: number; w: number; h: number };
};

/** Caisse d'œufs ou ballot de laine au pied du bâtiment, quand c'est prêt. */
export type YardSignal = {
  kind: "eggs" | "wool";
  originX: number;
  originY: number;
  w: number;
  h: number;
};

/** Un joueur présent sur la parcelle — soi-même ou un prestataire en mission. */
export type FieldWorker = {
  id: string;
  name: string;
  x: number;
  y: number;
  appearance: CharacterAppearance;
  specialization?: "CEREALIER" | "ELEVEUR";
  working?: boolean;
};

export type PreviewBuilding = {
  type: BuildingType;
  originX: number;
  originY: number;
  /** Quarts de tour, 0 à 3 */
  rotation?: number;
  valid: boolean;
  /** Place retenue et figée : le joueur doit encore confirmer la dépense */
  pending?: boolean;
};

/** Un engin au parc : ce qu'il faut pour le dessiner, rien de plus. */
export type ParkedMachine = {
  id: string;
  type: MachineType;
  /** État 0 à 100 : il se lit sur la carrosserie */
  condition?: number | null;
};

type Props = {
  gridW: number;
  gridH: number;
  cells: IsoCell[];
  buildings: IsoBuilding[];
  cellSims: IsoSim[];
  selected: { x: number; y: number }[];
  /** Case sous le curseur (survol) */
  hoverCell?: { x: number; y: number } | null;
  /** Emprise fantôme quand outil BUILD + survol */
  previewBuilding?: PreviewBuilding | null;
  /** Flash court sur cases après / pendant une action */
  pulseCells?: { x: number; y: number }[];
  /** Engin temporaire qui se déplace vers les cases travaillées */
  activeWork?: ActiveWork | null;
  /** Troupeaux dehors : une entrée par étable dont les bêtes pâturent */
  grazing?: GrazingHerd[];
  /** Commandes livrées, posées dans la cour en attendant qu'on les rentre */
  supplies?: SupplyCrate[];
  /**
   * Un transport en cours, du stockage vers un bâtiment.
   *
   * C'est le pendant du rangement : distribuer une ration, c'est sortir du
   * fourrage du hangar et l'amener à l'étable. Le geste était instantané et
   * invisible — un chiffre changeait dans un panneau. Une caisse qui traverse
   * la cour dit la même chose, et la dit sur la ferme.
   */
  hauls?: { id: string; x: number; y: number; commodity: string }[];
  /** Caisse d'œufs / ballot de laine au pied du bâtiment */
  yardSignals?: YardSignal[];
  /** Tas de fumier à côté des bâtiments d'élevage */
  manurePiles?: ManurePile[];
  /** Personnages présents (propriétaire, prestataire en mission) */
  workers?: FieldWorker[];
  /**
   * Engins garés à la ferme.
   *
   * Ils ne sont plus posés sur une case : la cour de stationnement est hors de
   * la grille, à l'ouest de l'île. Une machine au hangar ou en plein travail
   * n'est pas dans cette liste.
   */
  parked?: ParkedMachine[];
  weather?: string;
  /** Saison courante — elle règle la lumière de toute la scène. */
  season?: string;
  onCellClick: (x: number, y: number, mods: PointerMods) => void;
  onCellHover?: (cell: { x: number; y: number } | null) => void;
  /**
   * Clic droit sur une case — menu contextuel du jeu.
   *
   * Sans lui, le bouton droit tombait dans le même chemin que le gauche : il
   * déplaçait la caméra **et** laissait le menu contextuel du navigateur
   * s'ouvrir par-dessus la ferme.
   */
  onCellContext?: (cell: { x: number; y: number }, screen: { x: number; y: number }) => void;
  /**
   * ETA au champ : un doigt glisse et travaille, deux doigts cadrent.
   * Le clic sans glisser reste une sélection.
   */
  strokeWork?: boolean;
  /**
   * Chez soi : un doigt glisse et **sélectionne**, sans rien déclencher.
   *
   * Il fallait jusqu'ici toucher chaque case l'une après l'autre pour semer ou
   * moissonner un carré — vingt-quatre gestes pour une bande de blé. Le tracé
   * existait déjà, mais uniquement chez un voisin, où il travaille aussitôt.
   */
  strokeSelect?: boolean;
  /** Début d'un tracé : le parent retient la sélection à laquelle l'ajouter. */
  onStrokeStart?: (mods: PointerMods) => void;
  onStrokePreview?: (cells: { x: number; y: number }[], mods: PointerMods) => void;
  onWorkStroke?: (cells: { x: number; y: number }[]) => void;
  onStrokeSelect?: (cells: { x: number; y: number }[], mods: PointerMods) => void;
};

const SOIL = 0x9ac06a;
const SOIL_DARK = 0x8ab35e;
/** Hauteur des dalles, centrées à y=0 : le dessus est à TILE_TOP. */
const TILE_THICK = 0.18;
const TILE_TOP = TILE_THICK / 2;
/** Pneus légèrement dans la dalle : un contact pile au sommet laisse un
 *  interstice d'un pixel iso, et l'engin a l'air de flotter. */
const MACHINE_GROUND = TILE_TOP - 0.012;

/**
 * Échelle commune du parc matériel : une seule valeur pour toutes les
 * machines, c'est ce qui préserve leurs tailles relatives. Une moissonneuse
 * déborde légitimement sur la case voisine, un tracteur non.
 */
const MACHINE_SCALE = 0.72;

/** Écart d'angle ramené dans ]−π, π] — sinon un passage par ±π braque à fond. */
function shortestAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Force de la houle sur les épis, par météo. */
function windFor(weather: string): number {
  if (weather === "STORM") return 1.7;
  if (weather === "RAIN") return 1.0;
  if (weather === "CLOUDY") return 0.75;
  if (weather === "SNOW") return 0.45;
  return 0.55;
}

type CropLook = {
  grow: number;
  ready: number;
  fullH: number;
};

const CROP_LOOK: Record<string, CropLook> = {
  // Six cultures, six couleurs qu'on doit pouvoir nommer de loin.
  //
  // Le blé et le maïs portaient **le même** `ready` (0xe8c65e), et l'orge n'en
  // était qu'à quatre degrés de teinte : trois beiges indiscernables sur une
  // parcelle. Ils s'écartent maintenant franchement — le blé va au doré chaud,
  // l'orge au blond pâle, et le maïs **reste vert**, ce qu'il est réellement à
  // la récolte : c'est la plante entière qu'on coupe, pas un épi mûr.
  //
  // Les jeunes pousses se séparent aussi : elles partaient toutes du même vert
  // à huit degrés près, et un champ semé ne disait pas ce qu'il portait.
  WHEAT: { grow: 0x8fc457, ready: 0xdcae3f, fullH: 0.7 },
  MAIZE: { grow: 0x3f8f2c, ready: 0x74a83a, fullH: 0.98 },
  PEA: { grow: 0x7cc86a, ready: 0xb9cf6a, fullH: 0.55 },
  BARLEY: { grow: 0xa8c96a, ready: 0xefdca4, fullH: 0.58 },
  RAPE: { grow: 0x5aaa38, ready: 0xf2d429, fullH: 0.72 },
  GRASS: { grow: 0x4a9a36, ready: 0x5aad42, fullH: 0.38 },
};

function lookOf(crop?: CropCode | null): CropLook {
  return CROP_LOOK[crop ?? ""] ?? CROP_LOOK.WHEAT;
}
/**
 * Teinte de sélection.
 *
 * C'était un vert (`0x5ee08a`) appliqué à 35 % sur une dalle… verte. Sur une
 * capture à huit cases sélectionnées, on distinguait à peine quatre losanges :
 * à la souris, sur un champ de cent quarante-quatre cases, le joueur ne savait
 * pas ce qu'il venait de sélectionner. L'or du logo tranche sur toutes les
 * teintes de sol du jeu — terre nue, culture jeune, culture mûre.
 */
/**
 * Le grain de lumière de chaque saison.
 *
 * Le ciel changeait de couleur derrière la ferme, mais la ferme, elle, était
 * éclairée exactement pareil toute l'année : même soleil, même ambiante, même
 * rebond. Un hiver et un été se ressemblaient donc « des masses », et le seul
 * indice restait le mot écrit dans le rail.
 *
 * On ne retouche ni les géométries ni les matériaux — trop coûteux pour ce
 * qu'on veut dire. On **règle la lumière**, ce qui repeint toute la scène d'un
 * coup : un été franc et haut, un automne cuivré et rasant, un hiver bleu et
 * bas, un printemps clair et vert.
 */
const SEASON_LIGHT: Record<
  string,
  {
    /** Ciel et sol de la lumière hémisphérique. */
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    ambient: number;
    ambientIntensity: number;
    sun: number;
    sunIntensity: number;
    /** Hauteur du soleil : un soleil d'hiver rase, un soleil d'été surplombe. */
    sunHeight: number;
    bounce: number;
    bounceIntensity: number;
  }
> = {
  SPRING: {
    hemiSky: 0xffffff,
    hemiGround: 0x9ec98a,
    hemiIntensity: 1.25,
    ambient: 0xfff6e4,
    ambientIntensity: 0.65,
    sun: 0xfff4dc,
    sunIntensity: 1.5,
    sunHeight: 24,
    bounce: 0xc6e8ce,
    bounceIntensity: 0.42,
  },
  SUMMER: {
    hemiSky: 0xfff8e0,
    hemiGround: 0x9ab87e,
    hemiIntensity: 1.35,
    ambient: 0xfff2d0,
    ambientIntensity: 0.7,
    // Le soleil d'été est blanc-doré et tape fort : les ombres sont courtes
    // et dures, et les couleurs saturent.
    sun: 0xfff0c4,
    sunIntensity: 1.85,
    sunHeight: 30,
    bounce: 0xd8e8b8,
    bounceIntensity: 0.38,
  },
  AUTUMN: {
    hemiSky: 0xf6e2c0,
    hemiGround: 0xa8894e,
    hemiIntensity: 1.1,
    ambient: 0xf7e2c0,
    ambientIntensity: 0.6,
    // Cuivré et rasant : c'est ce qui donne les longues ombres d'octobre.
    sun: 0xffce7e,
    sunIntensity: 1.35,
    sunHeight: 15,
    bounce: 0xd9b98a,
    bounceIntensity: 0.4,
  },
  WINTER: {
    hemiSky: 0xdce9f6,
    hemiGround: 0xb8c4cc,
    hemiIntensity: 1.05,
    // L'hiver ne se joue pas seulement en intensité : c'est la **teinte** qui
    // le dit. Tout passe au bleu, y compris le soleil, qui éclaire sans
    // réchauffer et reste bas sur l'horizon.
    ambient: 0xe4eef8,
    ambientIntensity: 0.62,
    sun: 0xe8f0fb,
    sunIntensity: 1.15,
    sunHeight: 12,
    bounce: 0xc4d4e4,
    bounceIntensity: 0.34,
  },
};

const SELECT_GLOW = 0xffd24a;
/**
 * Les cases retenues se **soulèvent**.
 *
 * Une différence de couleur seule ne suffit ni à un daltonien, ni à un écran
 * mal réglé, ni à un joueur qui regarde ailleurs. Un relief se lit d'un coup
 * d'œil en vue isométrique, et il survit à n'importe quelle teinte de sol.
 */
const SELECT_LIFT = 0.08;
const HOVER = 0x53c5f5;
const PREVIEW_OK = 0x2fc46a;
const PREVIEW_BAD = 0xef4444;
const DIRT = 0xa4835c;

/**
 * La cour de ferme — terre battue, plus grise que la terre travaillée.
 *
 * Elle doit se distinguer de `DIRT`, qui entoure les bâtiments, sans quoi on
 * ne saurait pas où finit la cour et où commence le pourtour d'un hangar.
 */
const COUR = 0x8d8271;
const PULSE = 0xfff2b0;


const STUBBLE_SOIL = 0xe3cf98;
const RESIDUE_SOIL = 0x8a7048;
/** Terre labourée : brune et grasse, celle qui attend la semence. */
const PLOWED_SOIL = 0x593a20;
/** Terre sèche et craquelée, laissée par une culture perdue. */
const DRY_SOIL = 0xb5a179;

/**
 * État visuel d'une case, tel qu'il doit se lire d'un coup d'œil.
 *
 * La couleur seule ne suffisait pas : rien ne distinguait une terre labourée
 * d'un champ en chaumes, si bien qu'un joueur à qui l'on refusait un semis
 * « il faut labourer » ne pouvait pas voir quelles cases traiter. Chaque état
 * porte donc aussi un relief.
 */
type SoilLook = "PLOWED" | "STUBBLE" | "RESIDUE" | "DRY" | "WEEDS" | "PLAIN" | "STRAW" | "BALES";

function soilLook(c: IsoCell): SoilLook {
  if (c.fieldStage === "SPOILED") return "DRY";
  if ((c.baleCount ?? 0) > 0) return "BALES";
  if ((c.strawTons ?? 0) > 0) return "STRAW";
  if (c.hasStubble) return "STUBBLE";
  // Les résidus se lisent avant l'état « préparé », que le déchaumage et le
  // labour partagent : c'est le compteur de résidus qui les distingue, le
  // labour le remettant à zéro. Sans cet ordre, une terre déchaumée aurait
  // l'aspect d'un labour et le joueur croirait son sol remis à neuf.
  if ((c.residuePasses ?? 0) > 0) return "RESIDUE";
  if (c.fieldStage === "PREPARED") return "PLOWED";
  return "PLAIN";
}

const SOIL_COLORS: Record<SoilLook, number> = {
  // Les adventices ne repeignent pas la case : elles s'y ajoutent. La teinte
  // ne sert que si la table est consultée pour elles.
  WEEDS: SOIL,
  PLOWED: PLOWED_SOIL,
  STUBBLE: STUBBLE_SOIL,
  STRAW: 0xc9b15a,
  BALES: 0xb8943a,
  RESIDUE: RESIDUE_SOIL,
  DRY: DRY_SOIL,
  PLAIN: SOIL,
};

/**
 * Labour en texture, pas en planches 3D.
 *
 * Quatre billons hauts comme la dalle se lisaient comme un ponton : trop
 * gros, trop peu, et ils enterraient les pneus des engins. Ici le sillon
 * est un grain répété, teinté par la couleur de la case.
 */
function makeFurrowMap(): THREE.CanvasTexture {
  const n = 128;
  const stripes = 16;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#737373";
    ctx.fillRect(0, 0, n, n);
    const step = n / stripes;
    for (let i = 0; i < stripes; i++) {
      const y = i * step;
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(0, y, n, step * 0.4);
      ctx.fillStyle = "#c4c4c4";
      ctx.fillRect(0, y + step * 0.36, n, step * 0.2);
      ctx.fillStyle = "#8d8d8d";
      ctx.fillRect(0, y + step * 0.58, n, step * 0.16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function cropColor(c: IsoCell, sim?: IsoSim): number {
  if (c.kind !== "CROP") return SOIL_COLORS[soilLook(c)];
  const look = lookOf(c.crop);
  if (c.fieldStage === "SPOILED") return RIPENESS_COLORS.LOST;

  // La maturité **teinte** l'espèce, elle ne la remplace plus.
  //
  // Un champ mûr prenait `RIPENESS_COLORS[stage]` tel quel : la même couleur
  // pour les six cultures, quelle que soit la plante. Blé, orge et maïs
  // devenaient rigoureusement identiques au moment précis où le joueur a le
  // plus besoin de les distinguer — celui de récolter.
  //
  // Le stade dit maintenant l'**état** — à point, qui passe, gâté — en tirant
  // la couleur d'espèce vers la sienne, d'autant plus fort qu'on s'éloigne du
  // point idéal. À `PEAK`, la plante garde sa couleur ; perdue, elle vire au
  // gris-brun quelle qu'elle soit.
  const etat = sim?.sim.ripeness?.stage;
  const base = new THREE.Color(
    c.fieldStage === "READY" || sim?.sim.ready
      ? look.ready
      : new THREE.Color(look.grow)
          .lerp(new THREE.Color(look.ready), Math.min(1, sim?.sim.progress ?? 0.3))
          .getHex(),
  );
  if (!etat || etat === "PEAK") return base.getHex();
  const vers = { DECLINING: 0.4, POOR: 0.68, LOST: 0.9 }[etat] ?? 0;
  return base.lerp(new THREE.Color(RIPENESS_COLORS[etat]), vers).getHex();
}

/**
 * Le sol d'une case cultivée — assombri, jamais de la couleur de la plante.
 *
 * Un champ mûr était un aplat de la teinte de la culture : sur du colza, un
 * rectangle de jaune pur, et par-dessus des tiges du même jaune. Rien ne se
 * détachait de rien, et le champ ne ressemblait plus à un champ mais à une
 * case peinte.
 *
 * En vrai on voit le sol **entre** les rangs : une terre chaude et sombre.
 * Le sol tire donc vers cette terre, et la plante garde sa couleur franche.
 * L'écart entre les deux est ce qui donne du relief à un champ, et ce qui
 * fait qu'on le reconnaît comme tel.
 */
const TERRE_SOUS_RANG = 0x8a6a44;

function cropGroundColor(c: IsoCell, sim?: IsoSim): number {
  const plante = new THREE.Color(cropColor(c, sim));
  // Plus la culture est haute, plus le sol se devine, moins il compte : la
  // part de terre monte avec la pousse.
  const pousse = Math.min(1, sim?.sim.progress ?? 0);
  const part = 0.34 + pousse * 0.22;
  return plante.lerp(new THREE.Color(TERRE_SOUS_RANG), part).getHex();
}


/**
 * La caisse d'une commande livrée.
 *
 * Une palette de bois, sanglée, avec un dessus de la couleur de la denrée :
 * on reconnaît de loin qu'il s'agit de paille plutôt que de grain, sans
 * étiquette accrochée sur la ferme.
 */
function makeSupplyCrate(couleur: number): THREE.Group {
  const g = new THREE.Group();
  const bois = new THREE.MeshLambertMaterial({ color: 0x8a6234, flatShading: true });
  const sangle = new THREE.MeshLambertMaterial({ color: 0x4a3320, flatShading: true });
  const dessus = new THREE.MeshLambertMaterial({ color: couleur, flatShading: true });
  const palette = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.34), bois);
  palette.position.y = 0.025;
  palette.castShadow = true;
  g.add(palette);
  const charge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.28), dessus);
  charge.position.y = 0.15;
  charge.castShadow = true;
  g.add(charge);
  for (const dx of [-0.1, 0.1]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.21, 0.29), sangle);
    s.position.set(dx, 0.15, 0);
    g.add(s);
  }
  return g;
}

/** La couleur du dessus d'une caisse, par denrée. */
const SUPPLY_COLORS: Record<string, number> = {
  STRAW: 0xe0c268,
  STRAW_BALE: 0xe0c268,
  HAY: 0xc9a94e,
  SILAGE: 0x6f8f3f,
  WHEAT: 0xdcae3f,
  BARLEY: 0xe6d49a,
  MAIZE: 0xe8c245,
  PEA: 0x8fbf5c,
  RAPE: 0xf2d429,
  MANURE: 0x6b4a2c,
};

/** Caisse d'œufs au pied du poulailler. */
function makeEggCrate(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0xc4a06a, flatShading: true });
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.16), wood);
  crate.position.y = 0.04;
  crate.castShadow = true;
  g.add(crate);
  const egg = new THREE.MeshLambertMaterial({ color: 0xf4efe4, flatShading: true });
  for (const [x, z] of [
    [-0.05, -0.03],
    [0.05, -0.03],
    [0, 0.03],
  ]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.04), egg);
    e.position.set(x, 0.1, z);
    g.add(e);
  }
  return g;
}

/** Ballot de laine près de la bergerie. */
/**
 * Jauge de pousse : où en est ce carré de blé.
 *
 * Rien ne disait si une culture était à deux minutes ou à deux heures de la
 * moisson. La couleur de la tige et la sortie de l'épi le racontent, mais de
 * loin et sans échelle : on voit qu'elle mûrit, jamais qu'elle est « bientôt
 * prête ».
 *
 * Une jauge par **parcelle semée**, pas par case : cent quarante-quatre
 * jauges sur un champ seraient un grillage, et toutes diraient la même chose
 * — les cases semées ensemble mûrissent ensemble.
 *
 * **Dessinée sur une toile, pas assemblée en sprites.** Le premier jet
 * empilait trois rectangles — cadre, fond, remplissage — et donnait à
 * l'écran une dalle sombre surmontée d'une barre : trois blocs aux
 * proportions fausses, impossibles à accorder. Une toile donne des bouts
 * arrondis, une bordure d'un pixel et un rapport de forme qu'on maîtrise.
 * Elle se redessine quand le pourcentage bouge d'un point — une cinquantaine
 * de fois sur toute la pousse, pour une image de 128 × 18.
 */
type GrowthBar = {
  sprite: THREE.Sprite;
  /** Maturité, en millisecondes epoch. */
  readyAt: number;
  /** Durée totale de la pousse, déduite de la progression observée. */
  totalMs: number;
  /** Dernier pourcentage dessiné, pour ne pas repeindre à chaque image. */
  dernier: number;
  hauteurMonde: number;
};

const BAR_W = 128;
const BAR_H = 18;

function peindreJauge(canvas: HTMLCanvasElement, p: number): void {
  const c = canvas.getContext("2d")!;
  const r = BAR_H / 2;
  c.clearRect(0, 0, BAR_W, BAR_H);
  // Le rail : sombre et translucide, il tient la barre lisible sur un champ
  // doré comme sur une herbe verte.
  c.fillStyle = "rgba(18, 32, 26, 0.62)";
  c.beginPath();
  c.roundRect(0, 0, BAR_W, BAR_H, r);
  c.fill();
  c.strokeStyle = "rgba(255, 255, 255, 0.22)";
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(0.5, 0.5, BAR_W - 1, BAR_H - 1, r);
  c.stroke();
  const marge = 3;
  const plein = Math.max(BAR_H - marge * 2, (BAR_W - marge * 2) * p);
  const mur = p >= 0.999;
  c.fillStyle = mur ? "#f4c94e" : p > 0.75 ? "#cfd25c" : "#7cc36b";
  c.beginPath();
  c.roundRect(marge, marge, plein, BAR_H - marge * 2, (BAR_H - marge * 2) / 2);
  c.fill();
}

function makeGrowthBar(hauteurMonde: number): GrowthBar {
  const canvas = document.createElement("canvas");
  canvas.width = BAR_W;
  canvas.height = BAR_H;
  peindreJauge(canvas, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }),
  );
  sprite.renderOrder = 18;
  sprite.scale.set((BAR_W / BAR_H) * hauteurMonde, hauteurMonde, 1);
  sprite.userData.canvas = canvas;
  return { sprite, readyAt: 0, totalMs: 0, dernier: -1, hauteurMonde };
}

/**
 * Fait avancer une jauge, à l'instant présent.
 *
 * La progression se recalcule à partir de `readyAt` plutôt que de se recopier
 * du serveur : la scène ne se reconstruit qu'à chaque dixième de progression,
 * une jauge qui n'aurait que `progress` avancerait par à-coups de dix pour
 * cent.
 *
 * Le battement une fois mûre est le seul moment où la jauge réclame quelque
 * chose ; tant qu'elle pousse, elle se tait.
 */
function updateGrowthBar(bar: GrowthBar, now: number, t: number): void {
  const p =
    bar.totalMs > 0 ? Math.max(0, Math.min(1, 1 - (bar.readyAt - now) / bar.totalMs)) : 1;
  const pct = Math.round(p * 100);
  if (pct !== bar.dernier) {
    bar.dernier = pct;
    peindreJauge(bar.sprite.userData.canvas as HTMLCanvasElement, p);
    (bar.sprite.material.map as THREE.CanvasTexture).needsUpdate = true;
  }
  bar.sprite.material.opacity = p >= 0.999 ? 0.82 + 0.18 * Math.sin(t * 3.2) : 0.92;
}

/**
 * Une étiquette flottante, dessinée sur une toile.
 *
 * « Je comprends pas ce que c'est devant l'étable » : le tas de fumier, la
 * caisse d'œufs et le ballot de laine apparaissent sur la ferme sans un mot.
 * Ils ne sont pas cliquables — la vue ne sélectionne que des cases — donc
 * rien, nulle part, ne dit ce qu'ils sont. Un panneau, et la question ne se
 * pose plus.
 *
 * `sizeAttenuation: false` : l'étiquette garde la même taille à l'écran quel
 * que soit le zoom, comme un panneau d'interface et non comme un objet du
 * décor.
 */
function makeTag(texte: string): THREE.Sprite {
  const dpi = 2;
  const police = 30 * dpi;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `700 ${police}px Signika, system-ui, sans-serif`;
  const largeur = Math.ceil(ctx.measureText(texte).width) + 26 * dpi;
  const hauteur = 46 * dpi;
  canvas.width = largeur;
  canvas.height = hauteur;
  const c = canvas.getContext("2d")!;
  c.font = `700 ${police}px Signika, system-ui, sans-serif`;
  c.textBaseline = "middle";
  const r = 12 * dpi;
  c.fillStyle = "rgba(28, 46, 38, 0.86)";
  c.beginPath();
  c.roundRect(0, 0, largeur, hauteur, r);
  c.fill();
  c.fillStyle = "#f4efe3";
  c.fillText(texte, 13 * dpi, hauteur / 2 + dpi);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  sprite.renderOrder = 20;
  sprite.scale.set((largeur / hauteur) * 0.34, 0.34, 1);
  return sprite;
}

/** Tas brun à côté de l'étable : il grossit avec la fosse. */
function makeManurePile(fill: number): THREE.Group {
  const g = new THREE.Group();
  const t = Math.max(0.15, Math.min(1, fill));
  const dung = new THREE.MeshLambertMaterial({ color: 0x5a3d24, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x3d2918, flatShading: true });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42 * t + 0.18, 0.1 + 0.16 * t, 0.36 * t + 0.16), dung);
  base.position.y = 0.05 + 0.08 * t;
  base.castShadow = true;
  g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.22 * t + 0.1, 0.08 + 0.1 * t, 0.2 * t + 0.08), dark);
  top.position.set(0.04, 0.14 + 0.14 * t, 0.02);
  g.add(top);
  return g;
}

function makeWoolBale(): THREE.Group {
  const g = new THREE.Group();
  const wool = new THREE.MeshLambertMaterial({ color: 0xf0ebe3, flatShading: true });
  const wrap = new THREE.MeshLambertMaterial({ color: 0x8a6b3a, flatShading: true });
  const bale = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.2), wool);
  bale.position.y = 0.09;
  bale.castShadow = true;
  g.add(bale);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.22), wrap);
  band.position.y = 0.09;
  g.add(band);
  return g;
}

/**
 * Rapport hauteur/largeur des illustrations : elles sont carrées, mais le
 * bâtiment n'occupe pas tout le cadre et déborde vers le haut.
 */
const BUILDING_ART_RATIO = 1;

/**
 * Textures et matériaux des illustrations, mutualisés pour la session.
 *
 * La carte affiche désormais les images dessinées plutôt que des volumes
 * reconstitués en boîtes : c'est la seule façon d'obtenir le rendu soigné que
 * l'illustration promet. Un même bâtiment revenant souvent sur une parcelle,
 * on ne recharge ni ne recompile rien.
 */
const artCache = new Map<string, THREE.MeshBasicMaterial>();
const artAnchorCache = new Map<string, number>();
const artAnchorWaiters = new Map<string, Array<(t: number) => void>>();
let artLoader: THREE.TextureLoader | null = null;

/**
 * Tant que l'image n'est pas lue, on suppose une dalle isométrique typique
 * (équateur vers 66 % du cadre) pour les bâtiments et engins. Un arbre, lui,
 * touche déjà le bas du fichier.
 */
function guessArtGround(url: string): number {
  if (url.includes("/buildings/") || url.includes("/vehicles/") || url.includes("/animals/")) {
    return 0.66;
  }
  return 1;
}

function artAnchor(url: string): number {
  return artAnchorCache.get(url) ?? guessArtGround(url);
}

function onArtAnchor(url: string, cb: (t: number) => void): void {
  const hit = artAnchorCache.get(url);
  if (hit != null) {
    cb(hit);
    return;
  }
  let list = artAnchorWaiters.get(url);
  if (!list) {
    list = [];
    artAnchorWaiters.set(url, list);
  }
  list.push(cb);
}

function setArtAnchor(url: string, t: number): void {
  artAnchorCache.set(url, t);
  const list = artAnchorWaiters.get(url);
  artAnchorWaiters.delete(url);
  list?.forEach((cb) => cb(t));
}

function measureTextureGround(image: TexImageSource, url = ""): number {
  const w = (image as { width?: number }).width;
  const h = (image as { height?: number }).height;
  if (!w || !h) return guessArtGround(url);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return guessArtGround(url);
  try {
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    return artGroundFraction(opaqueRowSpans(data, w, h), w);
  } catch {
    return guessArtGround(url);
  }
}

function isTexImageSource(image: unknown): image is TexImageSource {
  if (!image || typeof image !== "object") return false;
  return "width" in image && "height" in image;
}

function rememberArtGround(url: string, image: unknown): void {
  if (!isTexImageSource(image) || artAnchorCache.has(url)) return;
  setArtAnchor(url, measureTextureGround(image, url));
}

function artMaterial(url: string): THREE.MeshBasicMaterial {
  const hit = artCache.get(url);
  if (hit) {
    rememberArtGround(url, hit.map?.image);
    return hit;
  }
  artLoader ??= new THREE.TextureLoader();
  const tex = artLoader.load(url, (loaded) => {
    rememberArtGround(url, loaded.image);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    // Le seuil alpha découpe le cadre : le vide autour du dessin ne masque
    // pas les tuiles. On ignore le z-buffer — les cases d'emprise, plus
    // proches de la caméra, mangeaient sinon tout le panneau.
    alphaTest: 0.35,
    // Les tuiles d'emprise sont plus proches de la caméra que le panneau
    // une fois celui-ci abaissé : sans ça, le hangar disparaît et il ne
    // reste que la terre brune.
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  mat.userData.shared = true;
  artCache.set(url, mat);
  return mat;
}

/**
 * Panneau d'illustration planté au sol.
 *
 * Recadrer l'image sous la dalle dessinée faisait disparaître le bâtiment :
 * les tuiles d'emprise, plus proches de la caméra, mangeaient le reste. On
 * garde le dessin entier, on abaisse le rang d'ancrage, et on avance un peu
 * le panneau vers la caméra pour qu'il passe devant la terre.
 */
function makeArtBillboard(
  url: string,
  camera: THREE.Camera,
  x: number,
  y: number,
  z: number,
  spanX: number,
  spanY: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(spanX, spanY), artMaterial(url));
  mesh.name = "art";
  mesh.renderOrder = 3;
  const token = { live: true };
  mesh.userData.anchorToken = token;

  const plant = (t: number) => {
    if (!token.live) return;
    const ground = Math.min(1, Math.max(0.2, t));
    mesh.quaternion.copy(camera.quaternion);
    mesh.position.set(x, y, z);
    mesh.translateY(billboardLift(spanY, ground));
    mesh.translateZ(-0.2);
  };

  plant(artAnchor(url));
  if (!artAnchorCache.has(url)) onArtAnchor(url, plant);
  return mesh;
}

/**
 * Géométrie des hexagones du décor, taillée une fois pour toutes.
 *
 * Le tapis de fond en compte quatre-vingt-onze, tous identiques et de taille
 * fixe. En créer un par tuile à chaque montage — deux fois de suite sous
 * StrictMode — allongeait la construction de la scène pour rien.
 */
let groundHexGeo: THREE.CylinderGeometry | null = null;
function groundHexGeometry(): THREE.CylinderGeometry {
  groundHexGeo ??= markShared(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 6));
  return groundHexGeo;
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const token = o.userData.anchorToken as { live?: boolean } | undefined;
    if (token) token.live = false;
    if (o instanceof THREE.Mesh) {
      if (!o.geometry.userData.shared) o.geometry.dispose();
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else (o.material as THREE.Material).dispose();
    }
    /**
     * Les étiquettes sont des sprites, pas des maillages.
     *
     * Chacune porte une `CanvasTexture` qui lui est propre, et le tas de
     * fumier se redessine à chaque changement de remplissage — c'est-à-dire
     * souvent. Sans ces deux lignes, une texture s'accumulerait sur la carte
     * graphique à chaque tick de la fosse.
     */
    if (o instanceof THREE.Sprite) {
      o.material.map?.dispose();
      o.material.dispose();
    }
  });
}

export function IsoFarmView({
  gridW,
  gridH,
  cells,
  buildings,
  cellSims,
  selected,
  hoverCell = null,
  previewBuilding = null,
  pulseCells = [],
  activeWork = null,
  grazing = [],
  yardSignals = [],
  supplies = [],
  hauls = [],
  manurePiles = [],
  workers = [],
  parked = [],
  weather = "CLEAR",
  season = "SUMMER",
  onCellClick,
  onCellHover,
  onCellContext,
  strokeWork = false,
  strokeSelect = false,
  onStrokeStart,
  onStrokePreview,
  onWorkStroke,
  onStrokeSelect,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onCellClick);
  onClickRef.current = onCellClick;
  const onHoverRef = useRef(onCellHover);
  onHoverRef.current = onCellHover;
  const onContextRef = useRef(onCellContext);
  onContextRef.current = onCellContext;
  const strokeWorkRef = useRef(strokeWork);
  strokeWorkRef.current = strokeWork;
  const strokeSelectRef = useRef(strokeSelect);
  strokeSelectRef.current = strokeSelect;
  const onStrokeStartRef = useRef(onStrokeStart);
  onStrokeStartRef.current = onStrokeStart;
  const onStrokePreviewRef = useRef(onStrokePreview);
  onStrokePreviewRef.current = onStrokePreview;
  const onWorkStrokeRef = useRef(onWorkStroke);
  onWorkStrokeRef.current = onWorkStroke;
  const onStrokeSelectRef = useRef(onStrokeSelect);
  onStrokeSelectRef.current = onStrokeSelect;
  const layoutRef = useRef<(() => void) | null>(null);
  /** Repeint la scène quand la saison tourne, sans la reconstruire. */
  const relightRef = useRef<((saison: string) => void) | null>(null);
  const seasonAppliedRef = useRef<string | null>(null);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const seasonRef = useRef(season);
  seasonRef.current = season;

  /**
   * Rejoue le barème quand la saison tourne.
   *
   * La scène 3D est construite une seule fois ; sans cet effet, le grain de
   * lumière resterait celui du jour où l'on est arrivé, et le passage de
   * l'automne à l'hiver ne se verrait que dans le ciel CSS derrière.
   */
  useEffect(() => {
    if (seasonAppliedRef.current === season) return;
    relightRef.current?.(season);
    seasonAppliedRef.current = season;
  }, [season]);

  const dataRef = useRef({
    cells,
    buildings,
    cellSims,
    supplies,
    hauls,
    selected,
    hoverCell,
    previewBuilding,
    pulseCells,
    activeWork,
    grazing,
    yardSignals,
    manurePiles,
    workers,
    parked,
    gridW,
    gridH,
  });
  dataRef.current = {
    cells,
    buildings,
    cellSims,
    selected,
    hoverCell,
    previewBuilding,
    pulseCells,
    activeWork,
    grazing,
    yardSignals,
    supplies,
    hauls,
    manurePiles,
    workers,
    parked,
    gridW,
    gridH,
  };

  const pulseStartRef = useRef(0);
  const workStartRef = useRef(0);
  const prevPulseKey = useRef("");
  const prevWorkKey = useRef("");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const el = mount;

    const scene = new THREE.Scene();
    // Ciel de plein jour : la ferme doit rester lisible par tous les temps.
    const skyFor = (w: string) => {
      if (w === "STORM") return 0x8a9bb0;
      if (w === "RAIN") return 0xa4b8c8;
      if (w === "CLOUDY") return 0xc2d4e0;
      if (w === "SNOW") return 0xdce8f2;
      return 0xbfe4f5;
    };
    /**
     * Le ciel n'appartient plus à la scène 3D.
     *
     * Elle peignait son propre fond opaque — une couleur par temps qu'il
     * fait — ce qui masquait tout ce qu'on pouvait mettre derrière. Le décor
     * saisonnier (`ui/SeasonSky`) vit maintenant sous le canevas, en CSS : il
     * change avec la saison, il fait passer les nuages, et il ne coûte rien à
     * la carte graphique, déjà occupée par la ferme.
     *
     * Le brouillard, lui, reste : c'est lui qui fond le bord de la parcelle
     * dans le lointain, et il prend la teinte du ciel du moment pour que la
     * jointure ne se voie pas.
     */
    scene.background = null;
    scene.fog = new THREE.Fog(skyFor(weatherRef.current), 34, 66);

    let quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true });
    // Le contexte n'existe qu'une fois le rendu construit : c'est le premier
    // moment où l'on peut savoir qui rasterise, et le seul sans allouer de
    // contexte supplémentaire.
    quality = qualityForContext(renderer.getContext()) ?? quality;
    // Transparent : ce qui n'est pas la ferme laisse voir le ciel saisonnier.
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.shadowMap.enabled = quality.shadows;
    // PCFSoftShadowMap est déprécié depuis r185 : le renderer le remplace de
    // toute façon par PCFShadowMap en émettant un avertissement.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);

    const plowedMap = makeFurrowMap();
    plowedMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(18, 16, 18);
    camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x9ab87e, 1.25);
    scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xfff6e4, 0.65);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff2d4, 1.55);
    sun.position.set(14, 24, 10);
    sun.castShadow = quality.shadows;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0006;
    scene.add(sun);
    const bounce = new THREE.DirectionalLight(0xbfe0c8, 0.4);
    bounce.position.set(-10, 6, -8);
    scene.add(bounce);

    /** Applique le barème de la saison à toutes les lumières d'un coup. */
    const eclairerPour = (saison: string) => {
      const g = SEASON_LIGHT[saison] ?? SEASON_LIGHT.SUMMER;
      hemi.color.setHex(g.hemiSky);
      hemi.groundColor.setHex(g.hemiGround);
      hemi.intensity = g.hemiIntensity;
      ambient.color.setHex(g.ambient);
      ambient.intensity = g.ambientIntensity;
      sun.color.setHex(g.sun);
      sun.intensity = g.sunIntensity;
      sun.position.set(14, g.sunHeight, 10);
      bounce.color.setHex(g.bounce);
      bounce.intensity = g.bounceIntensity;
    };
    eclairerPour(seasonRef.current);
    seasonAppliedRef.current = seasonRef.current;
    relightRef.current = eclairerPour;

    const hexGroup = new THREE.Group();
    hexGroup.position.y = -0.35;
    const hexMat = new THREE.MeshLambertMaterial({ color: 0x74ad63, flatShading: true });
    const hexEdge = new THREE.MeshLambertMaterial({ color: 0x86bd71, flatShading: true });
    for (let q = -5; q <= 5; q++) {
      for (let r = -4; r <= 4; r++) {
        if (Math.abs(q) + Math.abs(r) + Math.abs(-q - r) > 10) continue;
        const mesh = new THREE.Mesh(groundHexGeometry(), (q + r) % 2 === 0 ? hexMat : hexEdge);
        const x = 1.8 * (q + r / 2);
        const z = 1.55 * r;
        mesh.position.set(x, 0, z);
        mesh.receiveShadow = true;
        hexGroup.add(mesh);
      }
    }
    scene.add(hexGroup);

    const world = new THREE.Group();
    scene.add(world);

    const cellMeshes = new Map<string, THREE.Mesh>();
    // Le champ entier tient dans un seul maillage instancié : les brins y
    // ondulent au vent et s'y couchent au passage de la moissonneuse.
    // Sur une machine qui peine, on éclaircit le semis plutôt que d'appauvrir
    // la forme du brin : un champ moins dru reste un champ, un champ en
    // bâtonnets n'en est plus un.
    const cropField = createCropField(400, quality.shadows ? 1 : 0.62);
    world.add(cropField.object);
    /**
     * Matériaux de culture indexés par couleur. Les cases ne prennent qu'une
     * poignée de teintes — les stades de maturité — alors qu'on en créait un
     * par case, avec le coût d'allocation et de compilation associé.
     */
    const cropMats = new Map<number, THREE.MeshLambertMaterial>();
    function cropMaterial(color: number): THREE.MeshLambertMaterial {
      let mat = cropMats.get(color);
      if (!mat) {
        mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
        cropMats.set(color, mat);
      }
      return mat;
    }
    /** Engins garés au parc — moteur coupé, roues immobiles */
    const vehicleRigs = new Map<string, MachineRig>();
    const buildingGroup = new THREE.Group();
    world.add(buildingGroup);
    /** Bâtiments montés : leurs vantaux et extracteurs sont animés à chaque image */
    const buildingRigs: { rig: BuildingRig; id: string; type: BuildingType }[] = [];

    const workGroup = new THREE.Group();
    world.add(workGroup);
    let workRig: MachineRig | null = null;
    /** Distance cumulée du chantier — elle entraîne roues, disques, rabatteur */
    let workTravelled = 0;
    let workHeading: number | null = null;
    let lastWorkPos: { x: number; z: number } | null = null;
    /** Cases à parcourir, ordonnées en va-et-vient rang par rang. */
    let workPath: { x: number; y: number }[] = [];

    // Ce que l'engin soulève et projette. Un bassin par effet, un appel de
    // rendu chacun ; sur une machine modeste (pas d'ombres) on s'en tient à la
    // poussière et à la fumée.
    const rich = quality.shadows;
    const workDust = createDustTrail(rich ? 10 : 6);
    const workSmoke = createExhaustSmoke(rich ? 14 : 8);
    workGroup.add(workDust.object, workSmoke.object);
    const exhaustPoint = new THREE.Vector3();
    const anchorPoint = new THREE.Vector3();
    let emitClock = 0;

    const grainSpray = createSpray({ count: rich ? 70 : 34, color: 0xe8c65c, size: 0.028, life: 0.75 });
    const soilSpray = createSpray({ count: rich ? 60 : 30, color: 0x8a6141, size: 0.038, life: 0.85 });
    const fertSpray = createSpray({
      count: rich ? 90 : 40,
      color: 0xe6e0cd,
      size: 0.022,
      life: 0.7,
      gravity: 5,
    });
    workGroup.add(grainSpray.object, soilSpray.object, fertSpray.object);

    // La cheminée de la ferme fume : le seul signe de vie d'un bâtiment.
    const chimneySmoke = createExhaustSmoke(8);
    world.add(chimneySmoke.object);
    let chimneyPos: THREE.Vector3 | null = null;

    // Les engins sont en matières PBR : sans environnement, leur peinture
    // vernie et leur chrome rendraient comme de la peinture mate.
    const releaseEnvironment = rich ? attachStudioEnvironment(renderer, scene, 0.3) : () => {};

    const previewGroup = new THREE.Group();
    world.add(previewGroup);
    let prevPreviewKey = "";

    // Bêtes au pré : chaque vache garde sa propre trajectoire, sinon le
    // troupeau se déplace comme un bloc et l'illusion tombe.
    const grazeGroup = new THREE.Group();
    world.add(grazeGroup);
    let grazeIdKey = "";
    let grazeOutKey = "";
    const cowWalkers: {
      mesh: THREE.Group;
      /** Place à l'intérieur du bâtiment : la bête y est masquée */
      stall: THREE.Vector3;
      /** Le seuil, franchi à l'aller comme au retour */
      gate: THREE.Vector3;
      /** Place dehors : le pré s'il existe, sinon la cour du bâtiment */
      paddock: THREE.Vector3;
      walkFrom: THREE.Vector3;
      walkTo: THREE.Vector3;
      walkT0: number;
      walkDur: number;
      wander: number;
      kind: string;
      buildingId: string;
      wantOut: boolean;
      /** Distance parcourue, dans le repère du modèle : elle règle la foulée */
      dist: number;
      last: THREE.Vector3;
      scale: number;
      /** Cette bête-là se couche quand le troupeau rentre */
      rests: boolean;
    }[] = [];
    const pickupGroup = new THREE.Group();
    world.add(pickupGroup);
    let pickupKey = "";

    /** Les jauges de pousse, une par parcelle semée. */
    const growthGroup = new THREE.Group();
    world.add(growthGroup);
    let growthBars: GrowthBar[] = [];

    /**
     * Les caisses livrées, et celles qu'on est en train de rentrer.
     *
     * Le rangement n'est pas piloté par une propriété : c'est la **disparition**
     * de la caisse de la liste qui le déclenche. L'application retire la
     * commande dès le toucher, sans attendre le serveur ; la vue voit qu'une
     * caisse qu'elle affichait n'est plus là et joue son vol vers le bâtiment
     * qui la stocke. Un geste, une conséquence, aucun état à synchroniser.
     */
    const supplyGroup = new THREE.Group();
    world.add(supplyGroup);
    /**
     * Vers quoi une caisse s'envole quand on la range.
     *
     * Le bâtiment de stockage le plus proche — un silo, un hangar, une grange.
     * À défaut, la caisse monte et disparaît sur place : mieux vaut un
     * escamotage franc qu'un vol vers un point arbitraire du terrain.
     */
    const storagePoint = (depuis: THREE.Vector3): THREE.Vector3 => {
      const rangeurs = new Set(["GRAIN_SILO", "HAY_BARN", "MACHINE_SHED", "FARMHOUSE", "BARN"]);
      let best: THREE.Vector3 | null = null;
      let d2 = Infinity;
      for (const b of dataRef.current.buildings ?? []) {
        if (!rangeurs.has(b.type)) continue;
        const def = BUILDING_DEFS[b.type];
        const p = new THREE.Vector3(
          ox + (b.originX + def.w / 2) * step,
          0.3,
          oz + (b.originY + def.h / 2) * step,
        );
        const dd = p.distanceToSquared(depuis);
        if (dd < d2) { d2 = dd; best = p; }
      }
      return best ?? depuis.clone().setY(depuis.y + 1.2);
    };
    const crates = new Map<string, THREE.Group>();
    /** Transports déjà lancés : un signal ne doit partir qu'une fois. */
    const partis = new Set<string>();
    type Vol = { mesh: THREE.Group; from: THREE.Vector3; to: THREE.Vector3; t0: number };
    let vols: Vol[] = [];

    const farmerGroup = new THREE.Group();
    world.add(farmerGroup);
    const farmerMeshes = new Map<string, THREE.Group>();

    const platformMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a, flatShading: true });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 1), platformMat);
    platform.receiveShadow = true;
    platform.castShadow = true;
    world.add(platform);

    const hedgeMat = new THREE.MeshLambertMaterial({ color: 0x5c9a52, flatShading: true });
    const fenceGroup = new THREE.Group();
    world.add(fenceGroup);

    /**
     * La cour de stationnement, hors grille.
     *
     * Elle vit à côté de l'île et non dedans : les engins garés ne prennent
     * plus une case de champ, et le tracteur ne se retrouve plus planté au
     * milieu du blé.
     */
    const parkingGroup = new THREE.Group();
    world.add(parkingGroup);
    let parkingRig: ParkingRig | null = null;
    /**
     * Débord de la cour à l'ouest de l'île, en unités monde.
     *
     * Le cadrage se réglait sur la seule grille : la cour, posée en dehors,
     * serait tombée hors champ. On vise donc le milieu de l'ensemble, et on
     * recule d'autant — pas davantage, sinon le champ rapetisse pour rien.
     */
    let parkingOverhang = 0;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    /** Uniquement les dalles de sol — les engins ne bloquent pas le clic */
    const pickables: THREE.Object3D[] = [];

    /**
     * Cadrage choisi par le joueur, conservé d'une reconstruction de scène à
     * l'autre. Le zoom vaut 1 quand la parcelle tient juste dans l'écran.
     */
    const view = { zoom: 1, panX: 0, panZ: 0 };
    let viewSpan = 12;

    let cellSize = 1;
    let step = 1.06;
    let ox = 0;
    let oz = 0;

    function key(x: number, y: number) {
      return `${x},${y}`;
    }

    // Les 144 dalles sont identiques : une seule géométrie suffit. En créer
    // une par case coûtait l'essentiel du temps de construction de la scène.
    let sharedTile: { size: number; geo: THREE.BoxGeometry } | null = null;
    function tileGeo(size: number): THREE.BoxGeometry {
      if (!sharedTile || sharedTile.size !== size) {
        sharedTile?.geo.dispose();
        sharedTile = { size, geo: markShared(new THREE.BoxGeometry(size, TILE_THICK, size)) };
      }
      return sharedTile.geo;
    }

    /** Le relief du sol, reconstruit à chaque `layout()`. */
    const reliefGroup = new THREE.Group();
    world.add(reliefGroup);

    /**
     * Donne du grain aux états du sol.
     *
     * La couleur seule ne suffit pas à lire un champ : « j'ai labouré et
     * pourtant je ne peux pas replanter » vient de là. On grave donc des
     * sillons sur la terre labourée, on laisse des tiges coupées sur les
     * chaumes, on craquelle la terre sèche.
     *
     * Tout passe par des maillages instanciés : un seul appel de dessin par
     * type de relief, quelle que soit la surface concernée.
     */
    function buildSoilRelief(
      details: { look: SoilLook; px: number; pz: number }[],
      size: number,
    ) {
      while (reliefGroup.children.length) {
        const c = reliefGroup.children[0];
        reliefGroup.remove(c);
        disposeObject3D(c);
      }
      if (!details.length) return;

      // Tiges et craquelures seulement : le labour est une texture de dalle,
      // pas des planches 3D qui masquaient les machines.
      const kinds: {
        look: SoilLook;
        geo: THREE.BoxGeometry;
        color: number;
        /** Décalages, en fraction de case, des exemplaires posés par case */
        spots: [number, number][];
        /** Hauteur du relief ; sa base est posée sur le dessus de la dalle */
        h: number;
      }[] = [
        {
          look: "STUBBLE",
          geo: new THREE.BoxGeometry(size * 0.1, 0.28, size * 0.1),
          color: 0xb59a55,
          spots: [
            [-0.26, -0.22],
            [0.04, -0.28],
            [0.24, -0.04],
            [-0.1, 0.18],
            [0.22, 0.28],
          ],
          h: 0.28,
        },
        {
          look: "STRAW",
          geo: new THREE.BoxGeometry(size * 0.55, 0.08, size * 0.16),
          color: 0xd4c06a,
          spots: [
            [0, -0.12],
            [0.08, 0.14],
          ],
          h: 0.08,
        },
        {
          look: "BALES",
          geo: new THREE.BoxGeometry(size * 0.22, 0.2, size * 0.16),
          color: 0xc9a24a,
          spots: [
            [-0.16, 0.04],
            [0.18, -0.1],
          ],
          h: 0.2,
        },
        {
          look: "RESIDUE",
          geo: new THREE.BoxGeometry(size * 0.3, 0.1, size * 0.12),
          color: 0x4f3d22,
          spots: [
            [-0.2, -0.18],
            [0.18, 0.02],
            [-0.02, 0.26],
            [0.26, -0.26],
          ],
          h: 0.1,
        },
        {
          // Touffes d'adventices : basses, désordonnées, d'un vert cru qui
          // tranche avec la culture en place.
          look: "WEEDS",
          geo: new THREE.BoxGeometry(size * 0.12, 0.2, size * 0.12),
          color: 0x5f9c3a,
          spots: [
            [-0.3, 0.3],
            [0.31, -0.29],
            [0.34, 0.33],
          ],
          h: 0.2,
        },
        {
          look: "DRY",
          geo: new THREE.BoxGeometry(size * 0.66, 0.09, size * 0.07),
          color: 0x5f4c33,
          spots: [
            [0, -0.18],
            [0, 0.06],
            [0, 0.28],
          ],
          h: 0.09,
        },
      ];

      const m = new THREE.Matrix4();
      for (const kind of kinds) {
        const cells = details.filter((d) => d.look === kind.look);
        if (!cells.length) {
          kind.geo.dispose();
          continue;
        }
        const count = cells.length * kind.spots.length;
        const mesh = new THREE.InstancedMesh(
          kind.geo,
          new THREE.MeshLambertMaterial({ color: kind.color, flatShading: true }),
          count,
        );
        mesh.receiveShadow = true;
        let i = 0;
        for (const cellPos of cells) {
          for (const [dx, dz] of kind.spots) {
            // Une craquelure alternée d'une case à l'autre évite le damier
            // trop régulier qui trahit la génération.
            const jitter = kind.look === "DRY" ? ((cellPos.px + cellPos.pz) % 2 === 0 ? 0.08 : -0.08) : 0;
            // La dalle culmine à 0,09 : le relief se pose dessus, il ne s'y
            // enfonce pas.
            m.makeTranslation(
              cellPos.px + (dx + jitter) * size,
              0.09 + kind.h / 2,
              cellPos.pz + dz * size,
            );
            mesh.setMatrixAt(i++, m);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        reliefGroup.add(mesh);
      }
    }

    /**
     * Coiffe les cultures mûres d'épis. Le blé en porte plusieurs, fins et
     * dorés ; le maïs un seul, trapu. C'est le signal « récoltable » le plus
     * direct qu'on puisse donner sur la grille elle-même.
     */
    function cellWorldPos(x: number, y: number) {
      return { px: ox + x * step, pz: oz + y * step };
    }

    /**
     * Monte la cour de stationnement et y range le parc.
     *
     * Elle se pose **contre** l'île, au sud-ouest, dans le prolongement de la
     * cour de ferme où arrivent les camions : c'est le coin d'où l'on entre.
     * Le chemin d'accès du modèle vient mordre le bord de l'île, sinon la cour
     * se lit comme un radeau à la dérive.
     */
    function buildParking() {
      const { parked, gridW: gw, gridH: gh } = dataRef.current;
      const plan = parkingLayout(parked.length);
      const rig = createParkingRig(plan, { shadows: quality.shadows });
      rig.group.scale.setScalar(cellSize);

      const ileOuest = -(gw * step + 1.4) / 2;
      const ileSud = (gh * step + 1.4) / 2;
      // Le chemin du modèle saille de 0,72 case au-delà de la dalle : on cale
      // la cour pour qu'il rejoigne exactement le bord de l'île.
      parkingOverhang = (0.72 + plan.w) * cellSize;
      const cx = ileOuest - (0.72 + plan.w / 2) * cellSize;
      const cz = ileSud - (plan.d / 2) * cellSize;
      rig.group.position.set(cx, 0, cz);
      parkingGroup.add(rig.group);
      parkingRig = rig;

      parked.forEach((machine, i) => {
        const slot = rig.slots[i];
        if (!slot) return;
        const mRig = createMachineRig(machine.type, {
          seed: i * 7 + 13,
          shadows: quality.shadows,
          condition: machine.condition ?? undefined,
        });
        mRig.group.scale.setScalar(cellSize * MACHINE_SCALE);
        // Un parc rangé au cordeau sonne faux : chaque engin est de travers de
        // quelques degrés, toujours les mêmes.
        mRig.group.rotation.y = rig.heading + Math.sin(i * 3.7) * 0.06;
        mRig.group.position.set(
          cx + slot.x * cellSize,
          rig.deck * cellSize,
          cz + slot.z * cellSize,
        );
        world.add(mRig.group);
        vehicleRigs.set(machine.id, mRig);
      });
    }

    function clearWorkVehicle() {
      if (workRig) {
        workGroup.remove(workRig.group);
        workRig.dispose();
        workRig = null;
      }
    }

    function layout() {
      grazeIdKey = "";
      grazeOutKey = "";
      const cropStalks: {
        x: number;
        y: number;
        px: number;
        pz: number;
        height: number;
        shape: CropShape;
        color: number;
        density: number;
        droop: number;
        ripe: number;
      }[] = [];
      /**
       * Les cases semées ensemble, regroupées par culture et par échéance.
       *
       * La clé arrondit la maturité à la dizaine de secondes : deux cases
       * semées du même geste partagent leur `readyAt` à la milliseconde près,
       * mais deux semis séparés d'une minute doivent garder leur propre jauge.
       */
      const parcellesSemees = new Map<
        string,
        { sx: number; sz: number; n: number; readyAt: number; progress: number }
      >();
      const {
        gridW: gw,
        gridH: gh,
        cells: cs,
        buildings: bs,
        cellSims: sims,
        selected: sel,
      } = dataRef.current;

      for (const m of cellMeshes.values()) {
        world.remove(m);
        // La géométrie est partagée : seul le matériau est propre à la dalle.
        (m.material as THREE.Material).dispose();
      }
      cellMeshes.clear();
      for (const rig of vehicleRigs.values()) {
        world.remove(rig.group);
        rig.dispose();
      }
      vehicleRigs.clear();
      if (parkingRig) {
        parkingGroup.remove(parkingRig.group);
        parkingRig.dispose();
        parkingRig = null;
      }
      chimneyPos = null;
      for (const b of buildingRigs) {
        buildingGroup.remove(b.rig.group);
        b.rig.dispose();
      }
      buildingRigs.length = 0;
      while (buildingGroup.children.length) {
        const c = buildingGroup.children[0];
        buildingGroup.remove(c);
        disposeObject3D(c);
      }
      while (fenceGroup.children.length) {
        const c = fenceGroup.children[0];
        fenceGroup.remove(c);
        disposeObject3D(c);
      }
      for (const g of farmerMeshes.values()) {
        farmerGroup.remove(g);
        disposeObject3D(g);
      }
      farmerMeshes.clear();
      pickables.length = 0;

      cellSize = 1;
      const gap = 0.06;
      step = cellSize + gap;
      ox = -((gw - 1) * step) / 2;
      oz = -((gh - 1) * step) / 2;

      platform.scale.set(gw * step + 1.4, 1, gh * step + 1.4);
      platform.position.set(0, -0.28, 0);

      const hedgeH = 0.55;
      const hedgeT = 0.28;
      const hw = gw * step + 0.9;
      const hh = gh * step + 0.9;
      const hedges = [
        new THREE.BoxGeometry(hw, hedgeH, hedgeT),
        new THREE.BoxGeometry(hw, hedgeH, hedgeT),
        new THREE.BoxGeometry(hedgeT, hedgeH, hh),
        new THREE.BoxGeometry(hedgeT, hedgeH, hh),
      ];
      const hedgesPos = [
        [0, 0.15, -hh / 2],
        [0, 0.15, hh / 2],
        [-hw / 2, 0.15, 0],
        [hw / 2, 0.15, 0],
      ] as const;
      hedges.forEach((geo, i) => {
        const m = new THREE.Mesh(geo, hedgeMat);
        const [px, py, pz] = hedgesPos[i];
        m.position.set(px, py, pz);
        m.castShadow = true;
        fenceGroup.add(m);
      });
      // Les arbres étaient deux cubes empilés, ce qui jurait franchement avec
      // des bâtiments dessinés. Ils reçoivent leur illustration, comme le
      // reste de la carte.
      for (const [tx, tz] of [
        [-hw / 2, -hh / 2],
        [hw / 2, -hh / 2],
        [-hw / 2, hh / 2],
        [hw / 2, hh / 2],
      ] as const) {
        const shade = new THREE.Mesh(
          new THREE.PlaneGeometry(0.8, 0.6),
          new THREE.MeshBasicMaterial({
            color: 0x2c3b2a,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
          }),
        );
        shade.rotation.x = -Math.PI / 2;
        shade.position.set(tx, 0.02, tz);
        fenceGroup.add(shade);

        fenceGroup.add(makeArtBillboard("/assets/decor/tree.webp", camera, tx, 0, tz, 1.5, 2));
      }

      /** Relief à semer sur les cases une fois la grille posée. */
      const soilDetails: { look: SoilLook; px: number; pz: number }[] = [];
      /** Épis des cultures arrivées à maturité. */

      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const cell = cs.find((c) => c.x === x && c.y === y);
          const sim = sims.find((s) => s.x === x && s.y === y);
          const isSel = sel.some((s) => s.x === x && s.y === y);
          const { px, pz } = cellWorldPos(x, y);

          // Le damier ne vaut que pour une terre au repos. Dès qu'une case a
          // été travaillée ou moissonnée, sa couleur dit son état — sans quoi
          // rien ne distingue un labour de chaumes, et le joueur ne sait pas
          // quelles cases traiter.
          const look = cell ? soilLook(cell) : "PLAIN";
          let col = look === "PLAIN" ? ((x + y) % 2 === 0 ? SOIL : SOIL_DARK) : SOIL_COLORS[look];
          if (cell?.kind === "CROP") col = cropGroundColor(cell, sim);
          if (cell?.kind === "BUILDING") col = DIRT;
          /* La cour, en terre battue.
             C'est là que les camions déposent, et on n'y bâtit ni n'y sème.
             Une règle qu'on ne voit pas au sol se découvre par un refus : le
             joueur vise la case, se fait dire non, et ne comprend pas
             pourquoi. Elle se lit donc, comme une cour se lit dans une vraie
             ferme — à sa terre nue. */
          if (isYardCell(x, y, gh)) col = COUR;
          if (cell?.manuredUntil && cell.manuredUntil > Date.now()) {
            const stain = new THREE.Color(col).lerp(new THREE.Color(0x3d2918), 0.45);
            col = stain.getHex();
          }
          if (cell && cell.kind === "EMPTY" && look !== "PLAIN" && look !== "PLOWED") {
            soilDetails.push({ look, px, pz });
          }
          // Les adventices restent sur la terre nue. Sur une culture elles
          // se lisaient comme un second plant — on ne les superpose plus.

          const mat = new THREE.MeshLambertMaterial({
            color: isSel ? SELECT_GLOW : col,
            flatShading: true,
            map: look === "PLOWED" && cell?.kind === "EMPTY" ? plowedMap : null,
          });
          const mesh = new THREE.Mesh(tileGeo(cellSize), mat);
          // Toutes les cases sont à la même hauteur, bâtiments compris. Elles
          // étaient auparavant enfoncées de quatorze centimètres sous le champ
          // pour ne pas former un muret derrière l'illustration : le creux se
          // lisait comme un trou, et le bâtiment paraissait flotter au-dessus.
          // Un volume posé sur la dalle n'a plus besoin de ce sacrifice.
          mesh.position.set(px, 0, pz);
          mesh.receiveShadow = true;
          mesh.userData = { x, y, baseColor: col, isSelected: isSel };
          world.add(mesh);
          cellMeshes.set(key(x, y), mesh);
          pickables.push(mesh);

          if (cell?.kind === "CROP") {
            const progress = sim?.sim.progress ?? 0.25;
            const lost = cell.fieldStage === "SPOILED" || sim?.sim.ripeness?.stage === "LOST";
            // Le maïs monte plus haut et plus dru que le blé : c'est à la
            // silhouette qu'on reconnaît une culture de loin, pas à sa teinte.
            const tall = cell.crop === "MAIZE";
            const cuts = cell.crop === "GRASS" ? (cell.harvestsSincePlow ?? 0) : 0;
            const full = (tall ? 0.62 : 0.46) * (cuts > 0 ? 0.78 : 1);
            // Une culture desséchée s'affaisse. Elle doit se voir comme une
            // perte, pas comme une récolte qui attend. Et jamais plus haut
            // qu'un capot de tracteur : l'engin au travail doit rester
            // visible depuis le rang voisin.
            const h = lost ? 0.16 : 0.12 + progress * (full - 0.12);
            // Ce que la parcelle sait, la parcelle le montre. La fumure et le
            // désherbage font le peuplement ; la sur-maturité fait ployer les
            // tiges avant que la perte soit actée.
            const fed = Math.min(2, cell.fertilizedPasses ?? 0) / 2;
            // L'étouffement suivait un booléen : le champ était sain ou
            // envahi, sans milieu. Il suit maintenant la pression, donc il se
            // dégrade sous les yeux du joueur au lieu de basculer.
            const choked = Math.min(1, Math.max(0, cell.weedPressure ?? 0)) * 0.55;
            // Les quatre paliers de maturité du jeu : à son heure la tige
            // est droite, passé l'heure elle ploie, perdue elle verse.
            const stage = sim?.sim.ripeness?.stage;
            const droop =
              lost || stage === "LOST"
                ? 1
                : stage === "POOR"
                  ? 0.6
                  : stage === "DECLINING"
                    ? 0.28
                    : 0;
            cropStalks.push({
              x,
              y,
              px,
              pz,
              height: h,
              // La silhouette nomme la culture : barbe pour l'orge, grappe
              // jaune pour le colza, panache pour le maïs.
              shape: (cell.crop as CropShape | undefined) ?? "WHEAT",
              color: cropColor(cell, sim),
              /* Un champ mûr est dense — c'est ce qui le distingue d'un semis
                 clairsemé. La densité suivait la seule fertilisation ; elle
                 suit aussi la pousse, sans quoi une moisson prête gardait
                 l'allure d'un champ à peine levé. */
              density: Math.max(0.15, 0.4 + progress * 0.35 + fed * 0.35 - choked),
              droop,
              // L'épi sort avec la maturité. Un cube doré était posé au-dessus
              // de la case pour dire « prêt » ; un vrai épi qui grossit le dit
              // aussi bien, et il fait partie de la plante.
              ripe: lost ? 0.25 : Math.max(0, Math.min(1, (progress - 0.45) / 0.5)),
            });

            // Une culture perdue n'a plus d'échéance à annoncer.
            const echeance = sim?.sim.readyAt;
            if (!lost && stage !== "LOST" && echeance) {
              const cle = `${cell.crop ?? "?"}:${Math.round(echeance / 10_000)}`;
              const acc = parcellesSemees.get(cle);
              if (acc) {
                acc.sx += px;
                acc.sz += pz;
                acc.n += 1;
              } else {
                parcellesSemees.set(cle, {
                  sx: px,
                  sz: pz,
                  n: 1,
                  readyAt: echeance,
                  progress: sim?.sim.progress ?? 0,
                });
              }
            }
          }

        }
      }

      buildParking();

      for (const worker of dataRef.current.workers) {
        const mesh = buildCharacter(worker.appearance, { spec: worker.specialization, prop: false });
        mesh.scale.setScalar(0.42);
        mesh.userData.workerId = worker.id;
        farmerGroup.add(mesh);
        farmerMeshes.set(worker.id, mesh);
      }

      buildSoilRelief(soilDetails, cellSize);
      cropField.setCells(cropStalks, cellSize);

      /**
       * Poser les jauges, une par parcelle semée.
       *
       * La durée totale se déduit de ce qu'on observe : à cet instant il reste
       * `readyAt − maintenant` pour couvrir `1 − progress` du chemin. C'est ce
       * qui permet ensuite à la barre d'avancer seule, sans redemander au
       * serveur — et donc de bouger vraiment, plutôt que de sauter d'un
       * dixième toutes les vingt secondes.
       */
      for (const bar of growthBars) {
        growthGroup.remove(bar.sprite);
        disposeObject3D(bar.sprite);
      }
      growthBars = [];
      const maintenant = Date.now();
      for (const parc of parcellesSemees.values()) {
        const reste = parc.readyAt - maintenant;
        const part = Math.max(0.001, 1 - parc.progress);
        const bar = makeGrowthBar(cellSize * 0.3);
        bar.readyAt = parc.readyAt;
        bar.totalMs = reste > 0 ? reste / part : 0;
        bar.sprite.position.set(parc.sx / parc.n, 0.1 + cellSize * 0.95, parc.sz / parc.n);
        growthGroup.add(bar.sprite);
        growthBars.push(bar);
      }

      // Les bâtiments : des volumes posés sur le terrain, plus des images
      // collées face caméra. C'est ce qui règle d'un coup le hangar qui
      // flottait — l'altitude n'est plus devinée en scannant un fichier, c'est
      // la hauteur du sol — et ce qui rend l'orientation possible.
      for (const b of bs) {
        const def = BUILDING_DEFS[b.type];
        const quarters = ((b.rotation ?? 0) % 4 + 4) % 4;
        // L'empreinte tourne avec le bâtiment : une case de plus en largeur
        // devient une case de plus en profondeur.
        const fw = quarters % 2 === 0 ? def.w : def.h;
        const fh = quarters % 2 === 0 ? def.h : def.w;
        const cx = ox + (b.originX + (fw - 1) / 2) * step;
        const cz = oz + (b.originY + (fh - 1) / 2) * step;

        const rig = createBuildingRig(b.type, {
          level: b.level ?? 1,
          // Deux silos voisins ne doivent pas être la photocopie l'un de
          // l'autre : la graine vient de la position, donc elle est stable.
          seed: b.originX * 7.3 + b.originY * 3.1,
          shadows: quality.shadows,
        });
        rig.group.scale.setScalar(cellSize);
        rig.group.position.set(cx, MACHINE_GROUND, cz);
        rig.group.rotation.y = quarters * (Math.PI / 2);
        rig.group.userData.buildingId = b.id;
        buildingGroup.add(rig.group);
        buildingRigs.push({ rig, id: b.id, type: b.type });

        // La maison d'exploitation fume : le conduit fait partie du modèle,
        // la fumée part donc de son aplomb exact, rotation comprise.
        if (b.type === "FARMHOUSE") {
          chimneyPos = new THREE.Vector3(cx, MACHINE_GROUND + rig.height * cellSize, cz);
        }
      }

      viewSpan = Math.max(gw * step + parkingOverhang, gh * step);
      applyCamera();
    }

    /**
     * Cadre la caméra en tenant compte du zoom et du déplacement du joueur.
     *
     * Séparé de `layout()` : la scène se reconstruit à chaque changement de
     * données, et recadrer d'office renverrait le joueur au centre à chaque
     * fois — insupportable dès qu'on travaille sur un coin de la parcelle.
     */
    /**
     * Largeur des rails, lue sur la coquille.
     *
     * Le canevas couvre toute la fenêtre — sans quoi une couture de ciel
     * apparaît sur les bords de la colonne centrale. Mais la parcelle, elle,
     * doit tenir dans ce qui **reste visible** entre les rails : cadrée sur la
     * fenêtre entière, elle passait derrière eux des deux côtés.
     */
    /**
     * Largeur mangée par les panneaux, à gauche et à droite.
     *
     * On mesurait cela en découpant `grid-template-columns` et en prenant la
     * première et la **troisième** valeur. C'était juste tant que la coquille
     * avait exactement trois colonnes ; l'ajout du rail d'outils en a mis
     * quatre, et la troisième valeur est alors devenue la scène elle-même —
     * la caméra reculait comme si un panneau de mille pixels occupait la
     * droite, et la ferme disparaissait.
     *
     * On lit désormais les panneaux **réellement affichés** : leur position
     * décide de quel côté ils comptent. Aucune disposition future ne peut
     * reproduire la panne, et un panneau vide ne réserve rien parce qu'il ne
     * mesure rien.
     */
    function railInsets(): { left: number; right: number } {
      const shell = el.closest(".game-stage");
      if (!shell) return { left: 0, right: 0 };
      const box = shell.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      let left = 0;
      let right = 0;
      for (const panel of shell.querySelectorAll(".tool-rail, .rail-left, .rail-right")) {
        const r = panel.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.left + r.width / 2 < mid) left = Math.max(left, r.right - box.left);
        else right = Math.max(right, box.right - r.left);
      }
      return { left, right };
    }

    function applyCamera() {
      const span = viewSpan;
      const w = Math.max(1, el.clientWidth);
      const h = Math.max(1, el.clientHeight);
      const aspect = w / h;
      const rails = railInsets();
      const stage = Math.max(120, w - rails.left - rails.right);
      // Le cadrage se réglait sur la hauteur seule. Sur un écran en portrait,
      // l'étendue horizontale — la hauteur multipliée par le rapport, donc
      // plus petite — ne suffisait pas à contenir la parcelle : on atterrissait
      // dans un coin, la grille coupée des deux côtés. On recule jusqu'à ce
      // qu'elle tienne dans la dimension la plus étroite, puis on recule encore
      // de ce que les rails mangent.
      // La demi-largeur visible en unités monde vaut `frustum × aspect ×
      // stage / w`, la demi-hauteur `frustum`. La parcelle doit tenir dans les
      // deux, d'où ce seul rapport — le premier essai divisait par le rapport
      // de la scène **et** remultipliait par celui de la fenêtre, ce qui
      // reculait deux fois et réduisait la ferme de moitié.
      // Six pour cent de marge quand c'est la largeur qui contraint : sinon la
      // parcelle vient toucher le rail, et sa dernière colonne de cases passe
      // sous le verre.
      const frustum = (span * 0.72) / Math.min(1, (stage * 0.94) / h) / view.zoom;
      camera.left = -frustum * aspect;
      camera.right = frustum * aspect;
      camera.top = frustum;
      camera.bottom = -frustum;
      // Recentrage sur la partie libre : avec un seul rail, le milieu de la
      // fenêtre n'est pas le milieu de ce qu'on voit.
      const shift = (rails.left - rails.right) / 2;
      if (shift) camera.setViewOffset(w, h, -shift, 0, w, h);
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
      const cibleX = view.panX - parkingOverhang / 2;
      camera.position.set(span * 0.95 + cibleX, span * 0.85, span * 0.95 + view.panZ);
      camera.lookAt(cibleX, 0, view.panZ);
    }

    function resize() {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      layout();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    function raycastCell(): { x: number; y: number } | null {
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits[0]?.object.userData) {
        const { x, y } = hits[0].object.userData as { x: number; y: number };
        return { x, y };
      }
      return null;
    }

    function setPointerFromEvent(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    }

    /**
     * Déplacement et zoom au doigt.
     *
     * Une grille de douze sur douze tient à peine sur un téléphone : sans
     * pouvoir approcher ni faire glisser, viser une case relève de la chance.
     *
     * Le clic ne part qu'au relâchement, et seulement si le doigt n'a
     * pratiquement pas bougé : autrement, chaque déplacement de la vue
     * sèmerait une case au passage.
     */
    const DRAG_SLOP_PX = 8;
    const pointers = new Map<number, { x: number; y: number }>();
    let dragged = false;
    let pinchStart = 0;
    let zoomStart = 1;
    let lastX = 0;
    let lastY = 0;
    const strokeKeys = new Set<string>();
    const strokeCells: { x: number; y: number }[] = [];

    /**
     * Modificateurs du geste en cours, figés au moment où il commence.
     *
     * Relâcher Ctrl en cours de tracé ne doit pas transformer un ajout en
     * remplacement à mi-parcours : le geste garde le sens qu'il avait quand
     * le joueur l'a entamé.
     */
    let gestureMods: PointerMods = DEFAULT_MODS;

    /**
     * Ce geste-ci déplace la vue, quel que soit l'outil armé.
     *
     * Au doigt, deux doigts cadrent pendant qu'un seul peint. À la souris il
     * n'existait aucun équivalent : dès qu'un outil de travail était armé, le
     * clic gauche traçait et plus rien ne recadrait la ferme — il fallait
     * repasser par « Voir ». Le bouton du milieu et la barre d'espace, deux
     * idiomes que tout joueur de jeu de gestion connaît déjà, comblent ce
     * trou sans coûter un bouton à l'écran.
     */
    let panGesture = false;
    let spaceHeld = false;

    function refreshCursor() {
      renderer.domElement.style.cursor = spaceHeld ? "grab" : "crosshair";
    }

    function onSpaceDown(e: KeyboardEvent) {
      if (e.code !== "Space" || spaceHeld) return;
      const el2 = e.target as HTMLElement | null;
      if (el2 && /^(INPUT|TEXTAREA|SELECT)$/.test(el2.tagName)) return;
      spaceHeld = true;
      refreshCursor();
    }
    function onSpaceUp(e: KeyboardEvent) {
      if (e.code !== "Space") return;
      spaceHeld = false;
      refreshCursor();
    }
    // Une fenêtre qui perd le focus garde sinon la barre d'espace « enfoncée »
    // pour toujours, et le clic gauche ne peint plus jamais.
    function onBlur() {
      spaceHeld = false;
      refreshCursor();
    }

    function addStrokeCell(cell: { x: number; y: number } | null) {
      if (!cell) return;
      const k = `${cell.x},${cell.y}`;
      if (strokeKeys.has(k)) return;
      strokeKeys.add(k);
      strokeCells.push(cell);
      onStrokePreviewRef.current?.(strokeCells.slice(), gestureMods);
    }

    function clearStroke() {
      strokeKeys.clear();
      strokeCells.length = 0;
    }

    /** Unités du monde parcourues par un pixel d'écran, au zoom courant. */
    function worldPerPixel(): number {
      return (camera.right - camera.left) / Math.max(1, el.clientWidth);
    }

    /** Axes de l'écran ramenés au plan du sol, pour glisser dans le bon sens. */
    const dragRight = new THREE.Vector3();
    const dragUp = new THREE.Vector3();
    function panBy(dxPx: number, dyPx: number) {
      dragRight.setFromMatrixColumn(camera.matrix, 0).setY(0).normalize();
      dragUp.setFromMatrixColumn(camera.matrix, 1).setY(0).normalize();
      const k = worldPerPixel();
      view.panX -= dragRight.x * dxPx * k + dragUp.x * -dyPx * k;
      view.panZ -= dragRight.z * dxPx * k + dragUp.z * -dyPx * k;
      // Sans borne, on perd la ferme de vue et plus rien ne la ramène.
      const limit = viewSpan * 0.9;
      view.panX = Math.max(-limit, Math.min(limit, view.panX));
      view.panZ = Math.max(-limit, Math.min(limit, view.panZ));
      applyCamera();
    }

    function setZoom(next: number) {
      view.zoom = Math.max(0.6, Math.min(3.2, next));
      applyCamera();
    }

    function pinchDistance(): number {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    /** Un tracé est-il armé, quelle qu'en soit la suite ? */
    function tracable(): boolean {
      if (panGesture) return false;
      return strokeWorkRef.current || strokeSelectRef.current;
    }

    /** Milieu des deux doigts : c'est lui qui déplace la vue pendant un pincement. */
    function pinchMid(): { x: number; y: number } {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    function onPointerDown(ev: PointerEvent) {
      const touch = ev.pointerType !== "mouse";
      // Le bouton droit ne cadre pas et ne trace pas : il n'ouvre qu'un menu,
      // depuis `contextmenu`. Le prendre ici le ferait aussi déplacer la vue.
      if (!touch && ev.button === 2) return;
      // Le bouton du milieu et la barre d'espace cadrent, toujours.
      panGesture = !touch && (ev.button === 1 || spaceHeld);
      gestureMods = readMods(ev, touch);
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      renderer.domElement.setPointerCapture?.(ev.pointerId);
      lastX = ev.clientX;
      lastY = ev.clientY;
      dragged = false;
      clearStroke();
      if (tracable()) onStrokeStartRef.current?.(gestureMods);
      if (pointers.size === 2) {
        pinchStart = pinchDistance();
        zoomStart = view.zoom;
        const mid = pinchMid();
        lastX = mid.x;
        lastY = mid.y;
        // Un pincement n'est jamais un clic, même si les doigts bougent peu.
        dragged = true;
        clearStroke();
      }
    }

    function onPointerMove(ev: PointerEvent) {
      if (!pointers.has(ev.pointerId)) {
        // Survol à la souris, sans bouton enfoncé.
        setPointerFromEvent(ev);
        onHoverRef.current?.(raycastCell());
        return;
      }
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

      if (pointers.size >= 2) {
        ev.preventDefault();
        if (pinchStart > 0) setZoom((zoomStart * pinchDistance()) / pinchStart);
        // Deux doigts déplacent aussi la vue, en suivant leur milieu. Sans
        // cela, dès qu'un tracé est armé, plus rien ne cadrait la ferme : le
        // doigt unique peignait, et le pincement ne savait que zoomer.
        const mid = pinchMid();
        panBy(mid.x - lastX, mid.y - lastY);
        lastX = mid.x;
        lastY = mid.y;
        onHoverRef.current?.(null);
        return;
      }

      const depuisX = lastX;
      const depuisY = lastY;
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      if (!dragged && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
      dragged = true;
      lastX = ev.clientX;
      lastY = ev.clientY;

      if (tracable()) {
        // On retient les cases **traversées**, pas seulement celles où le doigt
        // se trouve à chaque image : un glissement rapide franchit une case
        // entière entre deux images et en sauterait la moitié. On échantillonne
        // donc le segment tous les six pixels.
        const rect = renderer.domElement.getBoundingClientRect();
        const pas = Math.min(48, Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6)));
        for (let i = 1; i <= pas; i++) {
          const px = depuisX + (dx * i) / pas;
          const py = depuisY + (dy * i) / pas;
          pointer.x = ((px - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((py - rect.top) / rect.height) * 2 + 1;
          addStrokeCell(raycastCell());
        }
        onHoverRef.current?.(null);
        return;
      }

      panBy(dx, dy);
      onHoverRef.current?.(null);
    }

    function onPointerUp(ev: PointerEvent) {
      const had = pointers.delete(ev.pointerId);
      renderer.domElement.releasePointerCapture?.(ev.pointerId);
      if (pointers.size < 2) pinchStart = 0;
      if (!had || pointers.size > 0) return;
      const wasPan = panGesture;
      panGesture = false;
      if (!wasPan && tracable() && dragged && strokeCells.length) {
        const done = strokeCells.slice();
        clearStroke();
        // Chez un voisin, un tracé **travaille** aussitôt — c'est le contrat de
        // la mission. Chez soi, il ne fait que **sélectionner** : la dépense
        // reste au bouton d'action, comme pour un clic.
        if (strokeWorkRef.current) onWorkStrokeRef.current?.(done);
        else onStrokeSelectRef.current?.(done, gestureMods);
        return;
      }
      if (dragged || wasPan) return;
      setPointerFromEvent(ev);
      const cell = raycastCell();
      if (cell) onClickRef.current(cell.x, cell.y, gestureMods);
    }

    function onPointerLeave() {
      onHoverRef.current?.(null);
    }

    /**
     * Zoom molette et pincement trackpad.
     *
     * Ctrl+molette est le zoom du navigateur : si on le laisse passer, le HUD
     * entier gonfle et on ne voit plus les menus. On le prend pour soi, la
     * carte seule change d'échelle.
     */
    function onWheel(ev: WheelEvent) {
      ev.preventDefault();
      setZoom(view.zoom * (ev.deltaY < 0 ? 1.12 : 1 / 1.12));
    }

    /**
     * Menu contextuel du jeu, à la place de celui du navigateur.
     *
     * Le bouton droit ouvrait jusqu'ici le menu « Enregistrer l'image sous… »
     * de Chrome par-dessus la ferme, tout en déplaçant la caméra dans le même
     * geste. Il désigne maintenant une case, et rien d'autre.
     */
    function onContextMenu(ev: MouseEvent) {
      ev.preventDefault();
      if (!onContextRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      const cell = raycastCell();
      if (cell) onContextRef.current(cell, { x: ev.clientX, y: ev.clientY });
    }

    refreshCursor();
    // Sans cela, le navigateur intercepte le glissement pour faire défiler la
    // page et le zoom à deux doigts ne parvient jamais jusqu'ici.
    renderer.domElement.style.touchAction = "none";
    function onTouchMove(ev: TouchEvent) {
      if (ev.touches.length >= 2) ev.preventDefault();
    }
    renderer.domElement.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onSpaceDown);
    window.addEventListener("keyup", onSpaceUp);
    window.addEventListener("blur", onBlur);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });

    let raf = 0;
    // THREE.Clock est déprécié depuis r183 au profit de Timer, qui doit être
    // avancé explicitement à chaque image.
    const timer = new THREE.Timer();
    const tmpColor = new THREE.Color();
    const pulseColor = new THREE.Color(PULSE);
    const hoverColor = new THREE.Color(HOVER);
    const selectColor = new THREE.Color(SELECT_GLOW);

    function syncPreviewFootprint() {
      const pb = dataRef.current.previewBuilding;
      const pk = pb ? `${pb.type}:${pb.originX}:${pb.originY}:${pb.rotation ?? 0}:${pb.valid}:${pb.pending ? 1 : 0}` : "";
      if (pk === prevPreviewKey) return;
      prevPreviewKey = pk;
      while (previewGroup.children.length) {
        const c = previewGroup.children[0];
        previewGroup.remove(c);
        disposeObject3D(c);
      }
      if (!pb) return;

      // L'emprise du fantôme suit le quart de tour : sans cela le joueur
      // valide une forme et en pose une autre.
      const quarters = ((pb.rotation ?? 0) % 4 + 4) % 4;
      const def = BUILDING_DEFS[pb.type];
      const fw = quarters % 2 === 0 ? def.w : def.h;
      const fh = quarters % 2 === 0 ? def.h : def.w;
      const gap = 0.06;
      const col = pb.valid ? PREVIEW_OK : PREVIEW_BAD;
      const ghostMat = new THREE.MeshLambertMaterial({
        color: col,
        flatShading: true,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      });
      const edgeMat = new THREE.MeshLambertMaterial({
        color: col,
        flatShading: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
      });

      /**
       * Le côté de l'empreinte où donne la façade.
       *
       * Tous les modèles sont bâtis façade vers les z croissants — portes,
       * seuils et auvents y sont posés. Après `quarters` quarts de tour, ce
       * côté se retrouve ici, en pas de case.
       *
       * Sans ce repère, on lit mal l'orientation d'un modèle translucide vu de
       * trois quarts, et on pose la grange dos à la cour sans s'en apercevoir.
       * Un mot d'orientation dans la barre ne suffit pas : il faut le voir sur
       * la parcelle, là où on regarde.
       */
      const devant = [
        { dx: 0, dz: 1 },
        { dx: 1, dz: 0 },
        { dx: 0, dz: -1 },
        { dx: -1, dz: 0 },
      ][quarters];
      const seuilMat = new THREE.MeshBasicMaterial({
        color: pb.valid ? 0xffffff : col,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });

      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          const cx = pb.originX + dx;
          const cy = pb.originY + dy;
          const { px, pz } = cellWorldPos(cx, cy);
          const tile = new THREE.Mesh(new THREE.BoxGeometry(cellSize * 0.92, 0.22, cellSize * 0.92), ghostMat);
          tile.position.set(px, 0.14, pz);
          previewGroup.add(tile);
          const rim = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 0.04, cellSize), edgeMat);
          rim.position.set(px, 0.26, pz);
          previewGroup.add(rim);
          // Une case du bord avant reçoit son liseré : le seuil du bâtiment.
          const bordAvant =
            (devant.dx === 1 && dx === fw - 1) ||
            (devant.dx === -1 && dx === 0) ||
            (devant.dz === 1 && dy === fh - 1) ||
            (devant.dz === -1 && dy === 0);
          if (!bordAvant) continue;
          const long = devant.dx ? 0.12 : cellSize * 0.8;
          const large = devant.dx ? cellSize * 0.8 : 0.12;
          const seuil = new THREE.Mesh(new THREE.BoxGeometry(long, 0.05, large), seuilMat);
          seuil.position.set(
            px + devant.dx * cellSize * 0.42,
            0.3,
            pz + devant.dz * cellSize * 0.42,
          );
          previewGroup.add(seuil);
        }
      }

      // Le fantôme est le vrai modèle, translucide.
      //
      // Il l'a longtemps été *repeint* : chaque matière remplacée par un seul
      // vert plat. Le modèle était donc là, mais aplati en silhouette — on ne
      // voyait ni la pente du toit, ni où était la façade, donc rien à quoi
      // rattacher le bouton « Tourner ». On garde désormais les vraies
      // matières, simplement rendues translucides et lavées vers la couleur de
      // validité : le toit reste rouge, le bardage crème, et le vert (ou le
      // rouge) ne fait que dire si la place convient.
      const centerX = ox + (pb.originX + (fw - 1) / 2) * step;
      const centerZ = oz + (pb.originY + (fh - 1) / 2) * step;
      const ghost = createBuildingRig(pb.type, { level: 1, shadows: false });
      // Une place refusée doit se voir sans lire le texte : on lave fort vers
      // le rouge. Une place valable garde ses couleurs, à peine verdies.
      const lavage = pb.valid ? 0.22 : 0.6;
      const teinte = new THREE.Color(col);
      // Les matières sont mutualisées par le rig (une par matière, pas une par
      // maillage) : on les remplace une seule fois chacune, sinon vingt
      // maillages fabriquent vingt copies identiques.
      const remplacees = new Map<THREE.Material, THREE.Material>();
      ghost.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !(mesh.material instanceof THREE.Material)) return;
        const src = mesh.material;
        let copie = remplacees.get(src);
        if (!copie) {
          const base = (src as THREE.MeshLambertMaterial).color?.clone() ?? new THREE.Color(col);
          copie = new THREE.MeshLambertMaterial({
            color: base.lerp(teinte, lavage),
            flatShading: true,
            transparent: true,
            opacity: pb.pending ? 0.72 : 0.55,
            // Sans écriture de profondeur, on voit à travers le bâtiment : les
            // pièces du fond restent lisibles et la case visée dessous aussi.
            depthWrite: false,
          });
          remplacees.set(src, copie);
        }
        mesh.material = copie;
      });
      for (const m of remplacees.keys()) m.dispose();
      ghost.group.scale.setScalar(cellSize);
      ghost.group.position.set(centerX, MACHINE_GROUND, centerZ);
      ghost.group.rotation.y = quarters * (Math.PI / 2);
      previewGroup.add(ghost.group);
    }

    /**
     * Repasse la scène en réglage sobre sans la reconstruire. Couper la carte
     * d'ombres change le code des shaders : il faut demander leur
     * recompilation, ce qui provoque un à-coup unique, largement remboursé dès
     * l'image suivante.
     */
    const applyQuality = (next: RenderQuality) => {
      quality = next;
      renderer.setPixelRatio(next.pixelRatio);
      renderer.shadowMap.enabled = next.shadows;
      sun.castShadow = next.shadows;
      scene.traverse((o) => {
        const mats = (o as Partial<THREE.Mesh>).material;
        if (Array.isArray(mats)) for (const m of mats) m.needsUpdate = true;
        else if (mats) mats.needsUpdate = true;
      });
    };
    const governor = makeFrameGovernor(applyQuality);
    let lastFrame = 0;

    function tick() {
      raf = requestAnimationFrame(tick);
      // Un onglet caché continue de recevoir des images sur certains
      // navigateurs : rien ne sert de peindre une scène que personne ne voit.
      if (document.hidden) return;
      const now = performance.now();
      // La toute première image n'a pas de précédente à comparer : la laisser
      // passer sans condition. La version d'avant lui appliquait un délai de
      // repli inférieur au seuil, sortait avant d'avoir horodaté l'image, et
      // se retrouvait à refuser indéfiniment de peindre — grille noire sur
      // tout appareil passé en réglage sobre.
      if (lastFrame && quality.maxFps && now - lastFrame < 1000 / quality.maxFps - 1) return;
      const delta = lastFrame ? now - lastFrame : 16;
      lastFrame = now;
      governor(delta);

      timer.update();
      const t = timer.getElapsed();
      const sky = skyFor(weatherRef.current);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(sky);
      hexGroup.rotation.y = Math.sin(t * 0.05) * 0.02;

      // Engins garés : moteur coupé. Ni roue, ni gyrophare, ni flottement —
      // c'est le contraste avec l'engin au travail qui dit lequel est occupé.
      for (const rig of vehicleRigs.values()) {
        rig.update({ t, distance: 0, working: false });
      }

      // Le champ respire : la houle suit la météo.
      cropField.update(t, windFor(weatherRef.current));

      // Les jauges avancent d'elles-mêmes : c'est leur raison d'être.
      if (growthBars.length > 0) {
        const now = Date.now();
        for (const bar of growthBars) updateGrowthBar(bar, now, t);
      }

      // Troupeaux : deux poses, et une vraie marche entre la porte et le pré.
      const herds = dataRef.current.grazing ?? [];
      const nextIdKey = herds
        .map((h) => `${h.buildingId}:${h.animals}:${h.kind ?? "COW"}:${h.sheared ? 1 : 0}`)
        .join("|");
      const nextOutKey = herds.map((h) => `${h.buildingId}:${h.out ? 1 : 0}`).join("|");

      if (nextIdKey !== grazeIdKey) {
        grazeIdKey = nextIdKey;
        grazeOutKey = nextOutKey;
        for (const w of cowWalkers) {
          grazeGroup.remove(w.mesh);
          disposeObject3D(w.mesh);
        }
        cowWalkers.length = 0;

        for (const herd of herds) {
          const shown = Math.min(8, herd.animals);
          const kind = herd.kind ?? "COW";
          const barn = buildingRigs.find((b) => b.id === herd.buildingId)?.rig ?? null;
          barn?.group.updateMatrixWorld(true);
          const centre = new THREE.Vector3(
            ox + (herd.barn.originX + (herd.barn.w - 1) / 2) * step,
            0.1,
            oz + (herd.barn.originY + (herd.barn.h - 1) / 2) * step,
          );
          const hasPaddock = herd.paddock.w > 0 && herd.paddock.h > 0;
          const pre = hasPaddock
            ? new THREE.Vector3(
                ox + (herd.paddock.originX + (herd.paddock.w - 1) / 2) * step,
                0.1,
                oz + (herd.paddock.originY + (herd.paddock.h - 1) / 2) * step,
              )
            : null;
          // Les seuils appartiennent au bâtiment : ils tournent avec lui, et
          // ils tiennent compte des ouvertures réelles. Une étable en porte
          // trois — la façade et les deux flancs —, et l'enclos peut être de
          // n'importe quel côté : on retient donc celui qui lui fait face.
          // Prendre systématiquement le premier envoyait le troupeau dans le
          // bardage dès que le pré n'était pas devant.
          const seuils = barn
            ? barn.anchors("threshold").map((a) => a.getWorldPosition(new THREE.Vector3()))
            : [];
          const gate = nearestThreshold(seuils, pre);
          const gx = gate?.x ?? centre.x;
          const gz = gate?.z ?? centre.z + herd.barn.h * 0.4 * step;
          // Direction de sortie : du centre du bâtiment vers son seuil. Elle
          // suit donc la rotation, sans que la vue ait à la recalculer.
          const outward = new THREE.Vector3(gx - centre.x, 0, gz - centre.z);
          if (outward.lengthSq() < 1e-6) outward.set(0, 0, 1);
          outward.normalize();
          const side = new THREE.Vector3(outward.z, 0, -outward.x);

          for (let i = 0; i < shown; i++) {
            const rank = Math.floor(i / 4);
            const along = ((i % 4) - 1.5) * 0.26 * step;
            // Dedans : rangée de stalles derrière la façade. La bête y est
            // masquée une fois la porte refermée.
            const stall = new THREE.Vector3(gx, 0.1, gz)
              .addScaledVector(outward, -0.35 * step - rank * 0.3 * step)
              .addScaledVector(side, along);
            const spreadX = (((i % 3) - 1) * 0.55 + ((i * 0.13) % 0.4)) * step;
            const spreadZ = ((Math.floor(i / 3) - 1) * 0.55 + ((i * 0.21) % 0.4)) * step;
            // Dehors : le pré s'il en existe un, sinon la cour du bâtiment —
            // dans tous les cas, sur une case qui appartient à l'élevage.
            const paddock = pre
              ? new THREE.Vector3(pre.x + spreadX, 0.1, pre.z + spreadZ)
              : new THREE.Vector3(gx, 0.1, gz)
                  .addScaledVector(outward, 0.12 * step + rank * 0.24 * step)
                  .addScaledVector(side, along * 1.3);
            const mesh = meshForHerd(kind, Boolean(herd.sheared), {
              welfare: herd.welfare,
              // Chaque bête n'est pas au même point du cycle : sans ce décalage
              // huit pis identiques trahissent la copie.
              yield: Math.max(0, Math.min(1, (herd.yield ?? 0) * (0.7 + ((i * 0.37) % 0.6)))),
            });
            const base = kind === "HEN" ? 0.55 : kind === "SHEEP" ? 0.75 : 0.85;
            mesh.scale.setScalar(cellSize * base);
            const here = herd.out ? paddock : stall;
            mesh.position.copy(here);
            mesh.visible = Boolean(herd.out);
            grazeGroup.add(mesh);
            cowWalkers.push({
              mesh,
              stall: stall.clone(),
              gate: new THREE.Vector3(gx, 0.1, gz).addScaledVector(side, along * 0.5),
              paddock: paddock.clone(),
              walkFrom: here.clone(),
              walkTo: here.clone(),
              walkT0: -10,
              walkDur: 2.6,
              wander: i * 1.7,
              kind,
              buildingId: herd.buildingId,
              wantOut: Boolean(herd.out),
              // Le pas se règle sur la distance parcourue, comme les roues des
              // engins : deux bêtes à la même vitesse posent le pied ensemble.
              dist: 0,
              last: here.clone(),
              scale: cellSize * base,
              // À l'étable, une bête sur trois est couchée. Un troupeau
              // entièrement debout dans le noir n'a jamais existé.
              rests: i % 3 === 0,
            });
          }
        }
      } else if (nextOutKey !== grazeOutKey) {
        grazeOutKey = nextOutKey;
        let wi = 0;
        for (const herd of herds) {
          const shown = Math.min(8, herd.animals);
          for (let i = 0; i < shown; i++) {
            const w = cowWalkers[wi++];
            if (!w) continue;
            const nextOut = Boolean(herd.out);
            if (w.wantOut === nextOut) continue;
            w.wantOut = nextOut;
            w.walkFrom.set(w.mesh.position.x, 0.1, w.mesh.position.z);
            w.walkTo.copy(nextOut ? w.paddock : w.stall);
            // Le troupeau s'écoule par la porte : chaque bête part un peu
            // après la précédente, et la marche laisse le temps au vantail de
            // s'ouvrir devant elle.
            w.walkT0 = t + 0.45 + i * 0.38;
            w.walkDur = 2.6;
          }
        }
      }

      const signals = dataRef.current.yardSignals ?? [];
      /* —— Les caisses livrées ——
         Elles ne passent pas par la reconstruction de scène : une commande
         arrive et repart au rythme du joueur, pas à celui des dixièmes de
         progression des cultures. On les tient donc à jour ici, chaque image. */
      {
        const maintenant = Date.now();
        const attendues = (dataRef.current.supplies ?? []).filter(
          (c) => c.arrivesAt <= maintenant,
        );
        const vues = new Set(attendues.map((c) => c.id));
        for (const c of attendues) {
          let mesh = crates.get(c.id);
          if (!mesh) {
            mesh = makeSupplyCrate(SUPPLY_COLORS[c.commodity] ?? 0xcbbf9a);
            mesh.scale.setScalar(cellSize);
            supplyGroup.add(mesh);
            crates.set(c.id, mesh);
            mesh.userData.pose = maintenant;
          }
          const px = ox + (c.x + 0.5) * step;
          const pz = oz + (c.y + 0.5) * step;
          // Elle tombe du ciel sur un tiers de seconde, puis rebondit une fois :
          // c'est ce qui dit « on vient de la déposer » sans camion à animer.
          const age = (maintenant - (mesh.userData.pose as number)) / 1000;
          const chute = age < 0.34 ? (1 - age / 0.34) ** 2 * 1.6 * cellSize : 0;
          const rebond = age >= 0.34 && age < 0.7 ? Math.sin((age - 0.34) / 0.36 * Math.PI) * 0.06 * cellSize : 0;
          mesh.position.set(px, 0.1 + chute + rebond, pz);
          // Un léger balancement tant qu'elle attend : elle réclame un geste.
          mesh.rotation.y = Math.sin(t * 1.4 + c.x) * 0.08;
        }
        /* Les transports : du stockage vers le bâtiment qui reçoit. On les
           lance une fois, à leur apparition, et on les oublie ensuite — la
           liste côté application n'est qu'un signal de départ. */
        for (const h of dataRef.current.hauls ?? []) {
          if (partis.has(h.id)) continue;
          partis.add(h.id);
          const cible = new THREE.Vector3(ox + (h.x + 0.5) * step, 0.25, oz + (h.y + 0.5) * step);
          const mesh = makeSupplyCrate(SUPPLY_COLORS[h.commodity] ?? 0xcbbf9a);
          mesh.scale.setScalar(cellSize * 0.8);
          supplyGroup.add(mesh);
          vols.push({ mesh, from: storagePoint(cible), to: cible, t0: t });
        }

        for (const [id, mesh] of crates) {
          if (vues.has(id)) continue;
          crates.delete(id);
          // Rangée : elle s'envole vers le bâtiment qui la stocke.
          const cible = storagePoint(mesh.position);
          vols.push({ mesh, from: mesh.position.clone(), to: cible, t0: t });
        }
        if (vols.length > 0) {
          vols = vols.filter((v) => {
            const u = Math.min(1, (t - v.t0) / 0.9);
            const e = u * u * (3 - 2 * u);
            v.mesh.position.lerpVectors(v.from, v.to, e);
            // Une trajectoire en cloche : une caisse qui glisse au sol n'a pas
            // l'air rangée, elle a l'air poussée.
            v.mesh.position.y += Math.sin(e * Math.PI) * 0.9 * cellSize;
            v.mesh.scale.setScalar(cellSize * (1 - e * 0.75));
            v.mesh.rotation.y += 0.14;
            if (u >= 1) {
              supplyGroup.remove(v.mesh);
              disposeObject3D(v.mesh);
              return false;
            }
            return true;
          });
        }
      }

      const piles = dataRef.current.manurePiles ?? [];
      const nextPickupKey = [
        ...signals.map((s) => `${s.kind}:${s.originX}:${s.originY}`),
        ...piles.map((p) => `m:${p.buildingId}:${p.fill.toFixed(2)}`),
      ].join("|");
      if (nextPickupKey !== pickupKey) {
        pickupKey = nextPickupKey;
        while (pickupGroup.children.length) {
          const c = pickupGroup.children[0];
          pickupGroup.remove(c);
          disposeObject3D(c);
        }
        for (const sig of signals) {
          const mesh = sig.kind === "eggs" ? makeEggCrate() : makeWoolBale();
          const px = ox + (sig.originX + sig.w / 2) * step + 0.28 * step;
          const pz = oz + (sig.originY + sig.h) * step + 0.12 * step;
          mesh.position.set(px, 0.1, pz);
          mesh.scale.setScalar(cellSize);
          // Une caisse posée sur l'herbe ne dit pas ce qu'elle contient.
          const tag = makeTag(sig.kind === "eggs" ? "Œufs à ramasser" : "Laine à ramasser");
          tag.position.set(px, 0.1 + 0.42 * cellSize, pz);
          pickupGroup.add(tag);
          pickupGroup.add(mesh);
        }
        for (const pile of piles) {
          if (pile.fill <= 0.02) continue;
          const mesh = makeManurePile(pile.fill);
          /**
           * Le tas se pose au **centre d'une case**, pas entre deux.
           *
           * Il était décalé de 0,38 case : posé à cheval, aucun clic ne
           * pouvait le désigner — on touchait le tas et le jeu répondait
           * « sol labouré », ce qui décrit la case voisine. Une chose qu'on
           * voit doit occuper une case, sans quoi elle n'est pas dans le
           * jeu, elle est dessus.
           */
          const px = ox + (pile.originX + 0.5) * step;
          const pz = oz + (pile.originY + pile.h + 0.5) * step;
          mesh.position.set(px, 0.1, pz);
          mesh.scale.setScalar(cellSize);
          // Le tas brun n'a plus d'étiquette permanente : elle répondait à
          // « je comprends pas ce que c'est » en accrochant un panneau sur la
          // ferme, ce qui est cher payé pour une question qu'on ne se pose
          // qu'une fois. C'est le clic qui répond maintenant, comme pour tout
          // le reste — voir `describeCell`.
          pickupGroup.add(mesh);
        }
      }

      for (const w of cowWalkers) {
        const raw = (t - w.walkT0) / w.walkDur;
        const progress = Math.min(1, Math.max(0, raw));
        const eased = progress * progress * (3 - 2 * progress);
        const walking = progress > 0.02 && progress < 0.98;
        // Le trajet s'incurve vers le seuil : en ligne droite, une bête sort
        // par le pignon. La porte est le point de passage, pas une décoration.
        const u = eased;
        const bend = 2 * (1 - u) * u;
        w.mesh.position.set(
          (1 - u) * w.walkFrom.x + u * w.walkTo.x + bend * (w.gate.x - (w.walkFrom.x + w.walkTo.x) / 2),
          0.1,
          (1 - u) * w.walkFrom.z + u * w.walkTo.z + bend * (w.gate.z - (w.walkFrom.z + w.walkTo.z) / 2),
        );
        // Une bête rentrée n'est pas plantée devant la grange : elle est
        // dedans, donc invisible une fois le vantail refermé.
        w.mesh.visible = w.wantOut || progress < 0.9;
        if (walking) {
          w.mesh.position.y = 0.1 + Math.abs(Math.sin(t * 9 + w.wander)) * 0.04 * step;
        } else if (w.wantOut) {
          w.mesh.position.x += Math.sin(t * 0.35 + w.wander) * 0.1 * step;
          w.mesh.position.z += Math.cos(t * 0.28 + w.wander) * 0.1 * step;
        } else {
          w.mesh.position.x += Math.sin(t * 0.25 + w.wander) * 0.03 * step;
          w.mesh.position.z += Math.cos(t * 0.2 + w.wander) * 0.03 * step;
        }
        const graze =
          w.wantOut && !walking ? Math.min(1, Math.max(0, (t - w.walkT0 - w.walkDur) / 0.4)) : 0;
        // Distance réellement parcourue, ramenée à l'échelle de la bête : la
        // foulée est cotée dans le repère du modèle, pas dans celui du monde.
        w.dist += w.mesh.position.distanceTo(w.last) / Math.max(0.0001, w.scale);
        w.last.copy(w.mesh.position);
        applyHerdPose(w.mesh, w.kind, graze, walking, t, w.wander, w.dist, w.rests && !w.wantOut);
        const dir = walking
          ? w.walkTo.clone().sub(w.walkFrom)
          : new THREE.Vector3(w.wantOut ? 1 : 0.2, 0, w.wantOut ? 0.2 : 1);
        w.mesh.rotation.y = Math.atan2(dir.x, dir.z) + (walking ? Math.sin(t * 8 + w.wander) * 0.12 : 0);
        w.mesh.rotation.x = 0;
      }

      // Les vantaux appartiennent au bâtiment : c'est lui qu'on ouvre, pas un
      // panneau posé devant. Une porte reste ouverte tant qu'une bête est
      // dehors ou en chemin, et se referme derrière la dernière rentrée.
      for (const b of buildingRigs) {
        const mine = cowWalkers.filter((w) => w.buildingId === b.id);
        const open = mine.some((w) => {
          const p = Math.min(1, Math.max(0, (t - w.walkT0) / w.walkDur));
          return w.wantOut || p < 1;
        });
        b.rig.update({ t, doorOpen: open ? 1 : 0 });
      }

      // Pulse cases (flash ~0.55s)
      const { pulseCells: pc, activeWork: aw } = dataRef.current;
      const pulseKey = pc.map((c) => `${c.x},${c.y}`).join("|");
      if (pulseKey !== prevPulseKey.current) {
        prevPulseKey.current = pulseKey;
        if (pulseKey) pulseStartRef.current = t;
      }
      const pulseAge = t - pulseStartRef.current;
      const pulseActive = pulseKey.length > 0 && pulseAge < 0.55;
      const pulseSet = new Set(pc.map((c) => key(c.x, c.y)));
      const { hoverCell: hc, selected: sel } = dataRef.current;
      const hoverKey = hc ? key(hc.x, hc.y) : null;
      const selSet = new Set(sel.map((s) => key(s.x, s.y)));
      const hoverPulse = 0.45 + Math.sin(t * 7) * 0.18;
      const selPulse = 0.55 + Math.sin(t * 4.5) * 0.14;

      syncPreviewFootprint();

      for (const [k, mesh] of cellMeshes) {
        const mat = mesh.material as THREE.MeshLambertMaterial;
        const base = mesh.userData.baseColor as number;
        const isSelected = mesh.userData.isSelected as boolean;
        tmpColor.setHex(base);

        const picked = isSelected || selSet.has(k);
        if (picked) {
          tmpColor.lerp(selectColor, selPulse);
        }
        // Le relief suit la sélection. Écrire la même valeur à chaque image ne
        // coûte rien — Three.js ne recalcule la matrice que si elle change.
        mesh.position.y = picked ? SELECT_LIFT : 0;
        if (k === hoverKey) {
          tmpColor.lerp(hoverColor, hoverPulse);
        }
        if (pulseActive && pulseSet.has(k)) {
          const w = Math.sin((pulseAge / 0.55) * Math.PI);
          tmpColor.lerp(pulseColor, 0.55 * w);
        }
        mat.color.copy(tmpColor);
      }

      // Engin de travail : parcours des cases, rang par rang.
      const workKey = aw
        ? `${aw.type}:${aw.haul ? "H" : ""}:${aw.cargo ?? ""}:${aw.cells.map((c) => `${c.x},${c.y}`).join("|")}`
        : "";
      if (workKey !== prevWorkKey.current) {
        prevWorkKey.current = workKey;
        clearWorkVehicle();
        if (aw && aw.cells.length) {
          workStartRef.current = t;
          // Un outil traîné arrive attelé : un déchaumeur qui traverse le
          // champ tout seul ne trompe personne.
          workRig = createMachineRig(aw.haul ? "TRACTOR" : aw.type, {
            towed: !aw.haul && isTowedImplement(aw.type),
            shadows: quality.shadows,
            condition: aw.condition ?? undefined,
          });
          if (aw.haul) hitchTrailer(workRig, aw.cargo);
          workRig.group.scale.setScalar(MACHINE_SCALE);
          workGroup.add(workRig.group);
          workTravelled = 0;
          workHeading = null;
          lastWorkPos = null;
          // On ne traverse pas un champ en diagonale. L'engin descend un rang
          // d'un bout à l'autre, tourne, et remonte le suivant en sens
          // inverse : c'est le va-et-vient d'un vrai chantier, et cela se lit
          // immédiatement comme un travail méthodique plutôt qu'un vol plané.
          workPath = [...aw.cells].sort((p, q) =>
            p.y !== q.y ? p.y - q.y : (p.y % 2 === 0 ? p.x - q.x : q.x - p.x),
          );
        } else {
          workPath = [];
        }
      }
      if (workRig && workPath.length) {
        const dt = delta / 1000;
        const duration = workAnimationMs(workPath.length, aw?.durationMs) / 1000;
        const raw = Math.min(1, (t - workStartRef.current) / duration);
        // Démarrage et arrêt adoucis : un engin ne passe pas de zéro à sa
        // vitesse de travail en une image. Les roues suivent la distance,
        // elles accélèrent donc avec lui.
        const u = raw * raw * (3 - 2 * raw);
        const n = workPath.length;
        const f = u * Math.max(1, n - 1);
        const i0 = Math.min(n - 1, Math.floor(f));
        const i1 = Math.min(n - 1, i0 + 1);
        const local = f - i0;
        const a = workPath[i0];
        const b = workPath[i1];
        const pa = cellWorldPos(a.x, a.y);
        const pb = cellWorldPos(b.x, b.y);
        const px = pa.px + (pb.px - pa.px) * local;
        const pz = pa.pz + (pb.pz - pa.pz) * local;

        // La distance réellement parcourue entraîne roues, disques et
        // rabatteur : ils tournent à la vitesse de l'engin, et calent avec lui.
        const stepX = lastWorkPos ? px - lastWorkPos.x : 0;
        const stepZ = lastWorkPos ? pz - lastWorkPos.z : 0;
        workTravelled += Math.hypot(stepX, stepZ);
        // Cap : l'engin regarde vers +X dans son repère, d'où le −dz.
        const fallback = workHeading ?? Math.atan2(-(pb.pz - pa.pz), pb.px - pa.px);
        const heading = Math.hypot(stepX, stepZ) > 1e-5 ? Math.atan2(-stepZ, stepX) : fallback;
        const steer = workHeading === null ? 0 : shortestAngle(heading - workHeading);
        workHeading = heading;
        lastWorkPos = { x: px, z: pz };

        const working = u < 1;
        workRig.group.position.set(px, MACHINE_GROUND, pz);
        workRig.group.rotation.y = heading;
        workRig.group.visible = working;
        workRig.update({
          t,
          distance: workTravelled,
          working,
          steer: Math.max(-1, Math.min(1, steer * 6)),
          // Moissonneuse : la trémie se vide sur la fin du chantier.
          unloading: aw?.type === "HARVESTER" && u > 0.62,
        });

        // La coupe se voit : les brins des cases franchies se couchent au
        // passage, au lieu que le champ entier disparaisse d'un coup.
        if (aw?.type === "HARVESTER" || aw?.cut === "harvest" || aw?.cut === "mow") {
          for (let i = 0; i <= i0; i++) cropField.cut(workPath[i].x, workPath[i].y, t);
        }

        // Poussière au sol, fumée au pot : tant que l'engin roule.
        const rear = workRig.length * MACHINE_SCALE * 0.5;
        workDust.update(
          dt,
          px - Math.cos(heading) * rear,
          MACHINE_GROUND + 0.03,
          pz + Math.sin(heading) * rear,
          working,
        );
        if (workRig.exhaust) {
          workRig.exhaust.getWorldPosition(exhaustPoint);
          workGroup.worldToLocal(exhaustPoint);
          workSmoke.update(dt, exhaustPoint.x, exhaustPoint.y, exhaustPoint.z, working);
        }

        // Projections : chaque machine lance ce qu'elle travaille, depuis la
        // pièce qui le produit. Cadencées, jamais une gerbe par image.
        emitClock += dt;
        if (working && rich && emitClock > 0.045) {
          emitClock = 0;
          const rearX = -Math.cos(heading);
          const rearZ = Math.sin(heading);
          const anchorWorld = (node: THREE.Object3D) => {
            node.getWorldPosition(anchorPoint);
            workGroup.worldToLocal(anchorPoint);
            return anchorPoint;
          };

          if (aw?.type === "HARVESTER") {
            // Le grain saute du bec de coupe vers la trémie, en parabole.
            for (const reel of workRig.anchors("reel")) {
              const q = anchorWorld(reel);
              for (let k = 0; k < 3; k++) {
                grainSpray.emit(
                  q.x + (Math.random() - 0.5) * 0.3,
                  q.y,
                  q.z + (Math.random() - 0.5) * 0.3,
                  rearX * (0.5 + Math.random() * 0.4),
                  1.5 + Math.random() * 0.5,
                  rearZ * (0.5 + Math.random() * 0.4),
                );
              }
            }
            // Vidange : le grain coule de la vis en flux serré.
            if (u > 0.62) {
              for (const auger of workRig.anchors("auger")) {
                const q = anchorWorld(auger);
                grainSpray.emit(
                  q.x + (Math.random() - 0.5) * 0.06,
                  q.y - 0.05,
                  q.z + (Math.random() - 0.5) * 0.06,
                  0,
                  -0.4,
                  0,
                );
              }
            }
          } else if (aw?.type === "DISC_HARROW") {
            // La terre part vers l'arrière, à ras du sol.
            for (const gang of workRig.anchors("gang")) {
              const q = anchorWorld(gang);
              for (let k = 0; k < 2; k++) {
                soilSpray.emit(
                  q.x,
                  q.y + 0.02,
                  q.z,
                  rearX * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.3,
                  0.7 + Math.random() * 0.6,
                  rearZ * (0.6 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.3,
                );
              }
            }
          } else if (aw?.type === "SPREADER") {
            // Engrais : chaque disque envoie son éventail dans son sens.
            for (const disc of workRig.anchors("spinner")) {
              const q = anchorWorld(disc);
              const dir = (disc.userData.spin as number) || 1;
              for (let k = 0; k < 4; k++) {
                const spread = heading + Math.PI + dir * (0.4 + Math.random() * 1.1);
                const speed = 1.2 + Math.random() * 0.9;
                fertSpray.emit(
                  q.x,
                  q.y,
                  q.z,
                  Math.cos(spread) * speed,
                  0.5 + Math.random() * 0.4,
                  -Math.sin(spread) * speed,
                );
              }
            }
          }
        }
      } else {
        workDust.update(delta / 1000, 0, 0, 0, false);
        workSmoke.update(delta / 1000, 0, 0, 0, false);
      }

      grainSpray.update(delta / 1000);
      soilSpray.update(delta / 1000);
      fertSpray.update(delta / 1000);
      // La cheminée de la ferme fume en continu, doucement.
      chimneySmoke.update(
        delta / 1000,
        chimneyPos?.x ?? 0,
        chimneyPos?.y ?? 0,
        chimneyPos?.z ?? 0,
        chimneyPos !== null,
      );

      const { workers: fieldWorkers } = dataRef.current;
      for (const worker of fieldWorkers) {
        const mesh = farmerMeshes.get(worker.id);
        if (!mesh) continue;
        let px: number;
        let pz: number;
        let facing = 0;
        if (worker.working && workRig && workPath.length && workRig.group.visible) {
          px = workRig.group.position.x + 0.38;
          pz = workRig.group.position.z + 0.22;
          facing = workRig.group.rotation.y;
        } else {
          const pos = cellWorldPos(worker.x, worker.y);
          px = pos.px;
          pz = pos.pz;
        }
        mesh.position.set(px, TILE_TOP, pz);
        mesh.rotation.y = facing + Math.sin(t * 2.4) * 0.08;
        mesh.position.y = TILE_TOP + Math.abs(Math.sin(t * (worker.working ? 8 : 2.2))) * (worker.working ? 0.04 : 0.015);
      }

      renderer.render(scene, camera);
    }
    tick();

    // Un minuteur rappelait `layout()` trois fois par seconde, ce qui
    // reconstruisait dalles, cultures, engins et bâtiments en continu et
    // annulait purement et simplement la signature de scène censée l'éviter.
    // Tout ce qui change l'apparence figure dans cette signature ; le reste —
    // survol, sélection, aperçu de pose, météo, troupeaux au pré — est animé
    // image par image dans `tick`, sans reconstruction.
    layoutRef.current = layout;

    return () => {
      cancelAnimationFrame(raf);
      layoutRef.current = null;
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onSpaceDown);
      window.removeEventListener("keyup", onSpaceUp);
      window.removeEventListener("blur", onBlur);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      while (previewGroup.children.length) {
        const c = previewGroup.children[0];
        previewGroup.remove(c);
        disposeObject3D(c);
      }
      clearWorkVehicle();
      workDust.dispose();
      workSmoke.dispose();
      grainSpray.dispose();
      soilSpray.dispose();
      fertSpray.dispose();
      chimneySmoke.dispose();
      cropField.dispose();
      releaseEnvironment();
      // Marquée partagée pour survivre aux reconstructions de scène, la
      // géométrie de dalle doit être libérée explicitement au démontage.
      sharedTile?.geo.dispose();
      sharedTile = null;
      plowedMap.dispose();
      disposeThreeScene(scene);
      disposeRenderer(renderer, el);
    };
  }, []);

  /**
   * Signature de ce qui change réellement la scène.
   *
   * La parcelle est rechargée toutes les quatre secondes et renvoie des objets
   * neufs à chaque fois, même quand rien n'a bougé. Or `layout()` détruit et
   * reconstruit les 144 dalles, les cultures, les engins et les bâtiments :
   * sans ce garde-fou, le jeu s'interrompait un tiers de seconde à chaque
   * sondage, indéfiniment.
   */
  const sceneKey = useMemo(() => {
    const c = cells
      .map(
        (x) =>
          `${x.x},${x.y},${x.kind},${x.crop ?? ""},${x.fieldStage ?? ""},${x.machineType ?? ""},${x.hasStubble ? 1 : 0},${x.residuePasses ?? 0},${Math.round((x.weedPressure ?? 0) * 10)},${x.harvestsSincePlow ?? 0},${Math.round((x.strawTons ?? 0) * 10)},${x.baleCount ?? 0}`,
      )
      .join("|");
    const b = buildings
      .map((x) => `${x.id},${x.type},${x.level ?? 1},${x.originX},${x.originY},${x.rotation ?? 0}`)
      .join("|");
    // Le palier de maturité donne la couleur, la progression donne la hauteur
    // du plant. Cette dernière est continue : on l'arrondit au dixième, sans
    // quoi la scène se reconstruirait à chaque sondage pour un plant qui a
    // grandi d'un pixel. Un blé pousse en trois minutes, soit un redimen-
    // sionnement toutes les vingt secondes — largement assez pour qu'on le
    // voie pousser.
    const s = cellSims
      .map(
        (x) =>
          `${x.x},${x.y},${x.sim.ripeness?.stage ?? (x.sim.ready ? "R" : "G")},${Math.round(
            x.sim.progress * 10,
          )}`,
      )
      .join("|");
    const sel = selected.map((x) => `${x.x},${x.y}`).join("|");
    const w = workers.map((x) => x.id).join("|");
    // Le parc fait partie du décor : une machine achetée doit apparaître sur la
    // cour sans attendre qu'une case du champ change.
    const p = parked.map((x) => `${x.id}:${x.type}:${Math.round((x.condition ?? 100) / 5)}`).join("|");
    return `${gridW}x${gridH}#${c}#${b}#${s}#${sel}#${w}#${p}`;
  }, [cells, buildings, cellSims, selected, workers, parked, gridW, gridH]);

  useEffect(() => {
    layoutRef.current?.();
  }, [sceneKey]);

  return <div className="iso-viewport" ref={mountRef} aria-label="Vue isométrique de la ferme" />;
}
