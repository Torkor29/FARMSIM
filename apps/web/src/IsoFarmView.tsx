import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BUILDING_ART,
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
import { hitchTrailer, makeMachineMesh, tickMachine } from "./machine-meshes";
import { initialQuality, makeFrameGovernor, qualityForContext, type RenderQuality } from "./render-quality";
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
  weedsControlled?: boolean;
  /** Déchaumages consécutifs — le sol s'assombrit à mesure qu'il s'enrichit */
  residuePasses?: number;
  /** Type machine si kind === VEHICLE (sinon TRACTOR par défaut) */
  machineType?: MachineType | null;
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
};

export type IsoSim = {
  x: number;
  y: number;
  sim: {
    progress: number;
    ready: boolean;
    ripeness?: { stage: RipenessStage } | null;
    lost?: boolean;
  };
};

export type ActiveWork = {
  type: MachineType;
  cells: { x: number; y: number }[];
  /** La machine coupe : moisson (cache le plant) ou fauche (andain) */
  cut?: "harvest" | "mow";
  /** Livraison : tracteur + remorque, sans toucher aux cultures */
  haul?: boolean;
  cargo?: string;
};

/** Un troupeau au pré : de quelle étable il sort, et vers quel enclos. */
export type GrazingHerd = {
  buildingId: string;
  animals: number;
  kind?: AnimalKind | string;
  /** Moutons tondus : le volume rétrécit jusqu'à la prochaine laine. */
  sheared?: boolean;
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
  valid: boolean;
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
  /** Caisse d'œufs / ballot de laine au pied du bâtiment */
  yardSignals?: YardSignal[];
  /** Tas de fumier à côté des bâtiments d'élevage */
  manurePiles?: ManurePile[];
  /** Personnages présents (propriétaire, prestataire en mission) */
  workers?: FieldWorker[];
  weather?: string;
  onCellClick: (x: number, y: number) => void;
  onCellHover?: (cell: { x: number; y: number } | null) => void;
  /**
   * ETA au champ : un doigt glisse et travaille, deux doigts cadrent.
   * Le clic sans glisser reste une sélection.
   */
  strokeWork?: boolean;
  onStrokePreview?: (cells: { x: number; y: number }[]) => void;
  onWorkStroke?: (cells: { x: number; y: number }[]) => void;
};

const SOIL = 0x9ac06a;
const SOIL_DARK = 0x8ab35e;
/** Hauteur des dalles, centrées à y=0 : le dessus est à TILE_TOP. */
const TILE_THICK = 0.18;
const TILE_TOP = TILE_THICK / 2;
/** Pneus légèrement dans la dalle : un contact pile au sommet laisse un
 *  interstice d'un pixel iso, et l'engin a l'air de flotter. */
const MACHINE_GROUND = TILE_TOP - 0.012;
/** Aire de parking : terre tassée, pas un carré d'herbe au milieu du champ. */
const PARKING = 0x6a5538;
const WINDROW = 0xc9c46a;

type CropLook = {
  grow: number;
  ready: number;
  fullH: number;
};

const CROP_LOOK: Record<string, CropLook> = {
  WHEAT: { grow: 0x7fbc4e, ready: 0xe8c65e, fullH: 0.7 },
  MAIZE: { grow: 0x5aa63a, ready: 0xe8c65e, fullH: 0.98 },
  PEA: { grow: 0x6bb84a, ready: 0xc6d45a, fullH: 0.55 },
  BARLEY: { grow: 0x8cba4a, ready: 0xe6d27a, fullH: 0.58 },
  RAPE: { grow: 0x5aaa38, ready: 0xf2d429, fullH: 0.72 },
  GRASS: { grow: 0x4a9a36, ready: 0x5aad42, fullH: 0.38 },
};

function lookOf(crop?: CropCode | null): CropLook {
  return CROP_LOOK[crop ?? ""] ?? CROP_LOOK.WHEAT;
}
const SELECT_GLOW = 0x5ee08a;
const HOVER = 0x53c5f5;
const PREVIEW_OK = 0x2fc46a;
const PREVIEW_BAD = 0xef4444;
const DIRT = 0xa4835c;
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
type SoilLook = "PLOWED" | "STUBBLE" | "RESIDUE" | "DRY" | "WEEDS" | "PLAIN";

function soilLook(c: IsoCell): SoilLook {
  if (c.fieldStage === "SPOILED") return "DRY";
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
  // L'herbe reste verte à maturité : c'est du fourrage, pas un épi doré.
  if (c.crop !== "GRASS" && sim?.sim.ripeness) return RIPENESS_COLORS[sim.sim.ripeness.stage];
  if (c.fieldStage === "SPOILED") return RIPENESS_COLORS.LOST;
  if (c.fieldStage === "READY" || sim?.sim.ready) return look.ready;
  const p = sim?.sim.progress ?? 0.3;
  const g = new THREE.Color(look.grow);
  const r = new THREE.Color(look.ready);
  return g.lerp(r, Math.min(1, p)).getHex();
}

/**
 * Palette commune : toit vert sarcelle, murs bois miel, socle herbe — la
 * cohérence de la ferme vient du toit, la lecture du bâtiment vient du corps.
 */
const ROOF_TEAL = 0x3f8f7a;
const WOOD_WARM = 0xc79a5f;

function buildingPalette(type: BuildingType): { body: number; roof: number; h: number } {
  switch (type) {
    case "SILO":
      return { body: 0xd8dde2, roof: ROOF_TEAL, h: 2.4 };
    case "HAY_BARN":
      return { body: WOOD_WARM, roof: ROOF_TEAL, h: 1.2 };
    case "MACHINE_SHED":
      return { body: 0xe6dcc4, roof: ROOF_TEAL, h: 1.35 };
    case "CATTLE_BARN":
      return { body: 0xb07a4a, roof: ROOF_TEAL, h: 1.5 };
    case "PIGSTY":
      return { body: 0xa97a55, roof: ROOF_TEAL, h: 1.1 };
    case "HENHOUSE":
      return { body: 0xc4a06a, roof: ROOF_TEAL, h: 0.95 };
    case "SHEEPFOLD":
      return { body: 0xb08a5c, roof: ROOF_TEAL, h: 1.25 };
    case "HEN_YARD":
      return { body: 0x9bb56a, roof: 0x7a5c3a, h: 0.4 };
    case "COLD_ROOM":
      return { body: 0xc5d4dc, roof: ROOF_TEAL, h: 1.15 };
    case "WORKSHOP":
      return { body: 0xa8adb2, roof: ROOF_TEAL, h: 1.2 };
    case "FARMHOUSE":
      return { body: 0xf2e8d4, roof: ROOF_TEAL, h: 1.6 };
    case "PADDOCK":
      return { body: 0x8fcf6a, roof: WOOD_WARM, h: 0.5 };
    case "PIG_YARD":
      return { body: 0x8a6f52, roof: 0x7a5c3a, h: 0.45 };
    default:
      return { body: WOOD_WARM, roof: ROOF_TEAL, h: 1 };
  }
}

/** Cube coloré, ancré par le centre — brique des silhouettes de culture. */
function cropBox(
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color, flatShading: true }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Une silhouette par culture, dès le semis.
 *
 * Un cube unique + des épis par-dessus + des adventices, ça faisait trois
 * choses sur la même case. Ici le plant dit tout seul ce qui pousse.
 */
function makeCropPlant(
  crop: CropCode | null | undefined,
  progress: number,
  ready: boolean,
  lost: boolean,
  color: number,
  cuts: number,
): THREE.Group {
  const g = new THREE.Group();
  const p = lost ? 0.35 : Math.max(0.18, Math.min(1, progress));
  const look = lookOf(crop);
  const full = look.fullH * (cuts > 0 ? 0.78 : 1);
  const h = lost ? 0.22 : 0.14 + p * (full - 0.14);
  const kind = crop ?? "WHEAT";

  if (kind === "GRASS") {
    g.add(cropBox(0.72, h, 0.72, color, 0, h / 2, 0));
  } else if (kind === "MAIZE") {
    g.add(cropBox(0.1, h, 0.1, color, 0, h / 2, 0));
    const leafH = Math.max(0.06, h * 0.22);
    g.add(cropBox(0.32, leafH, 0.06, color, 0.12, h * 0.45, 0));
    g.add(cropBox(0.32, leafH, 0.06, color, -0.1, h * 0.62, 0.04));
    if (ready && !lost) {
      g.add(cropBox(0.08, 0.16, 0.08, look.ready, 0.06, h + 0.02, 0));
    }
  } else if (kind === "RAPE") {
    g.add(cropBox(0.08, h, 0.08, color, 0, h / 2, 0));
    const bloom = ready && !lost ? look.ready : color;
    if (p > 0.4) {
      g.add(cropBox(0.1, 0.08, 0.1, bloom, -0.08, h * 0.85, -0.04));
      g.add(cropBox(0.1, 0.08, 0.1, bloom, 0.09, h * 0.92, 0.05));
      g.add(cropBox(0.08, 0.07, 0.08, bloom, 0.02, h + 0.02, -0.06));
    }
  } else if (kind === "PEA") {
    const bh = h * 0.72;
    g.add(cropBox(0.22, bh, 0.22, color, -0.16, bh / 2, -0.08));
    g.add(cropBox(0.2, bh * 0.85, 0.2, color, 0.14, (bh * 0.85) / 2, 0.1));
    g.add(cropBox(0.18, bh * 0.75, 0.18, color, 0.02, (bh * 0.75) / 2, -0.16));
  } else if (kind === "BARLEY") {
    for (const [dx, dz] of [
      [-0.16, -0.08],
      [0.16, 0.06],
      [-0.04, 0.14],
      [0.08, -0.14],
    ]) {
      g.add(cropBox(0.07, h * 0.92, 0.07, color, dx, (h * 0.92) / 2, dz));
    }
  } else {
    for (const [dx, dz] of [
      [-0.18, -0.1],
      [0.18, 0.08],
      [0, 0.18],
      [-0.08, -0.16],
      [0.12, -0.04],
    ]) {
      g.add(cropBox(0.07, h, 0.07, color, dx, h / 2, dz));
    }
  }

  if (lost) g.rotation.z = 0.12;
  g.userData.plantH = h;
  return g;
}

/**
 * Maison alignée à la grille, pas un panneau qui tourne vers la caméra.
 * Le webp isométrique se mettait de travers sur le damier.
 */
function makeFarmhouseMesh(spanX: number, spanY: number): THREE.Group {
  const g = new THREE.Group();
  const w = Math.max(0.9, spanX * 0.62);
  const d = Math.max(0.75, spanX * 0.5);
  const wallH = Math.max(0.55, spanY * 0.38);
  const wall = new THREE.MeshLambertMaterial({ color: 0xe8d4b0, flatShading: true });
  const wood = new THREE.MeshLambertMaterial({ color: 0x8b5a2b, flatShading: true });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6b3f22, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a3424, flatShading: true });
  const glass = new THREE.MeshLambertMaterial({ color: 0x8ec8d8, flatShading: true });

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wall);
  body.position.y = wallH / 2;
  body.castShadow = true;
  g.add(body);

  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, wallH * 0.48, 0.04), wood);
  door.position.set(0, wallH * 0.28, d / 2 + 0.01);
  g.add(door);

  const w1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.14, wallH * 0.18, 0.03), glass);
  w1.position.set(-w * 0.28, wallH * 0.58, d / 2 + 0.01);
  g.add(w1);
  const w2 = w1.clone();
  w2.position.x = w * 0.28;
  g.add(w2);

  const roofH = wallH * 0.42;
  const left = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, 0.08, d * 0.72), roofMat);
  left.position.set(0, wallH + roofH * 0.35, -d * 0.18);
  left.rotation.x = 0.55;
  left.castShadow = true;
  g.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, 0.08, d * 0.72), roofMat);
  right.position.set(0, wallH + roofH * 0.35, d * 0.18);
  right.rotation.x = -0.55;
  right.castShadow = true;
  g.add(right);

  const chim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.12, wallH * 0.55, d * 0.12), dark);
  chim.position.set(w * 0.28, wallH + roofH * 0.7, 0);
  chim.castShadow = true;
  g.add(chim);

  return g;
}

type AnimalRig = {
  body: THREE.Object3D;
  head: THREE.Object3D;
  legs: THREE.Object3D[];
};

function hipLeg(w: number, h: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, -h / 2, 0);
  const leg = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  leg.position.set(x, y, z);
  return leg;
}

/**
 * Porte d’étable animée : 0 fermée, 1 grande ouverte.
 */
function makeBarnDoor(): THREE.Group {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4528, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a120c, flatShading: true });
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.04), dark);
  hole.position.set(0, 0.28, 0);
  g.add(hole);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.05), wood);
  left.name = "left";
  left.castShadow = true;
  g.add(left);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.52, 0.05), wood);
  right.name = "right";
  right.castShadow = true;
  g.add(right);
  setBarnDoorOpen(g, 0);
  return g;
}

function setBarnDoorOpen(g: THREE.Group, open: number): void {
  const o = Math.max(0, Math.min(1, open));
  const left = g.getObjectByName("left");
  const right = g.getObjectByName("right");
  if (left) {
    left.position.set(-0.1 - o * 0.22, 0.28, 0.03 + o * 0.09);
    left.rotation.y = o * 0.95;
  }
  if (right) {
    right.position.set(0.1 + o * 0.22, 0.28, 0.03 + o * 0.09);
    right.rotation.y = -o * 0.95;
  }
}

/** Vache : debout à l’étable, ou tête dans l’herbe au pré. */
function makeCowMesh(): THREE.Group {
  const g = new THREE.Group();
  const hide = new THREE.MeshLambertMaterial({ color: 0xf4efe4, flatShading: true });
  const patch = new THREE.MeshLambertMaterial({ color: 0x5a4132, flatShading: true });
  const snout = new THREE.MeshLambertMaterial({ color: 0xe3b3a8, flatShading: true });

  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.19), hide);
  torso.position.y = 0.21;
  torso.castShadow = true;
  body.add(torso);
  const spot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.2), patch);
  spot.position.set(0.05, 0.25, 0);
  body.add(spot);
  g.add(body);

  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.14), hide);
  skull.position.set(-0.24, 0.25, 0);
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.1), snout);
  muzzle.position.set(-0.33, 0.22, 0);
  head.add(muzzle);
  const earL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.02), hide);
  earL.position.set(-0.22, 0.34, 0.07);
  head.add(earL);
  const earR = earL.clone();
  earR.position.z = -0.07;
  head.add(earR);
  g.add(head);

  const legs = [
    hipLeg(0.055, 0.14, 0.055, 0xdcd4c6, -0.11, 0.14, 0.06),
    hipLeg(0.055, 0.14, 0.055, 0xdcd4c6, -0.11, 0.14, -0.06),
    hipLeg(0.055, 0.14, 0.055, 0xdcd4c6, 0.11, 0.14, 0.06),
    hipLeg(0.055, 0.14, 0.055, 0xdcd4c6, 0.11, 0.14, -0.06),
  ];
  for (const leg of legs) g.add(leg);

  g.userData.rig = { body, head, legs } satisfies AnimalRig;
  return g;
}

/** Poule : debout, ou tête au sol (picore). */
function makeHenMesh(): THREE.Group {
  const g = new THREE.Group();
  const hide = new THREE.MeshLambertMaterial({ color: 0xf4efe4, flatShading: true });
  const brown = new THREE.MeshLambertMaterial({ color: 0x8a5a32, flatShading: true });
  const comb = new THREE.MeshLambertMaterial({ color: 0xc23b22, flatShading: true });
  const beak = new THREE.MeshLambertMaterial({ color: 0xe8a317, flatShading: true });

  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), hide);
  torso.position.y = 0.12;
  torso.castShadow = true;
  body.add(torso);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.13), brown);
  wing.position.set(0.01, 0.13, 0);
  body.add(wing);
  g.add(body);

  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), hide);
  skull.position.set(-0.1, 0.18, 0);
  head.add(skull);
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.04), comb);
  crest.position.set(-0.1, 0.23, 0);
  head.add(crest);
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.03), beak);
  bill.position.set(-0.14, 0.16, 0);
  head.add(bill);
  g.add(head);

  const legs = [
    hipLeg(0.02, 0.07, 0.02, 0xe8a317, 0.01, 0.07, 0.03),
    hipLeg(0.02, 0.07, 0.02, 0xe8a317, 0.01, 0.07, -0.03),
  ];
  for (const leg of legs) g.add(leg);

  g.userData.rig = { body, head, legs } satisfies AnimalRig;
  return g;
}

/** Mouton : debout, ou museau dans l’herbe. */
function makeSheepMesh(sheared = false): THREE.Group {
  const g = new THREE.Group();
  const wool = new THREE.MeshLambertMaterial({ color: 0xf7f4ee, flatShading: true });
  const face = new THREE.MeshLambertMaterial({ color: 0x3d342c, flatShading: true });
  const h = sheared ? 0.12 : 0.16;

  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.26, h, 0.16), wool);
  torso.position.y = 0.14;
  torso.castShadow = true;
  body.add(torso);
  g.add(body);

  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), face);
  skull.position.set(-0.16, 0.16, 0);
  head.add(skull);
  g.add(head);

  const legs = [
    hipLeg(0.035, 0.09, 0.035, 0x3d342c, -0.08, 0.09, 0.045),
    hipLeg(0.035, 0.09, 0.035, 0x3d342c, -0.08, 0.09, -0.045),
    hipLeg(0.035, 0.09, 0.035, 0x3d342c, 0.08, 0.09, 0.045),
    hipLeg(0.035, 0.09, 0.035, 0x3d342c, 0.08, 0.09, -0.045),
  ];
  for (const leg of legs) g.add(leg);

  g.userData.rig = { body, head, legs } satisfies AnimalRig;
  return g;
}

function meshForHerd(kind?: string, sheared = false): THREE.Group {
  if (kind === "HEN") return makeHenMesh();
  if (kind === "SHEEP") return makeSheepMesh(sheared);
  return makeCowMesh();
}

/** graze 0 = debout, 1 = tête au sol. walk 0–1 = en train de marcher. */
function applyHerdPose(
  mesh: THREE.Group,
  kind: string,
  graze: number,
  walking: boolean,
  t: number,
  wander: number,
): void {
  const rig = mesh.userData.rig as AnimalRig | undefined;
  if (!rig) return;
  const g = Math.max(0, Math.min(1, graze));
  if (kind === "HEN") {
    rig.head.rotation.x = g * 1.05;
    rig.head.position.set(0, -g * 0.04, 0);
    rig.body.rotation.x = g * 0.2;
  } else if (kind === "SHEEP") {
    rig.head.rotation.x = g * 0.85;
    rig.head.position.set(-g * 0.03, -g * 0.05, 0);
    rig.body.rotation.x = g * 0.1;
  } else {
    rig.head.rotation.x = g * 1.05;
    rig.head.position.set(-g * 0.04, -g * 0.1, 0);
    rig.body.rotation.x = g * 0.18;
  }
  const swing = walking ? Math.sin(t * 9 + wander) * 0.55 : 0;
  rig.legs.forEach((leg, i) => {
    leg.rotation.x = swing * (i % 2 === 0 ? 1 : -1);
  });
}

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
 * Un engin sur la carte : un volume low-poly, pas l'illustration collée
 * sur un panneau. Le dessin reste au garage ; ici il faut des roues qui
 * tournent et un rabatteur qui bat, sinon le chantier n'est qu'une carte
 * qui glisse.
 */
function makeVehicleSprite(type: MachineType): THREE.Group {
  return makeMachineMesh(type);
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
  manurePiles = [],
  workers = [],
  weather = "CLEAR",
  onCellClick,
  onCellHover,
  strokeWork = false,
  onStrokePreview,
  onWorkStroke,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onCellClick);
  onClickRef.current = onCellClick;
  const onHoverRef = useRef(onCellHover);
  onHoverRef.current = onCellHover;
  const strokeWorkRef = useRef(strokeWork);
  strokeWorkRef.current = strokeWork;
  const onStrokePreviewRef = useRef(onStrokePreview);
  onStrokePreviewRef.current = onStrokePreview;
  const onWorkStrokeRef = useRef(onWorkStroke);
  onWorkStrokeRef.current = onWorkStroke;
  const layoutRef = useRef<(() => void) | null>(null);
  const weatherRef = useRef(weather);
  weatherRef.current = weather;

  const dataRef = useRef({
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
    manurePiles,
    workers,
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
    manurePiles,
    workers,
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
    scene.background = new THREE.Color(skyFor(weatherRef.current));
    scene.fog = new THREE.Fog(skyFor(weatherRef.current), 34, 66);

    let quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: false });
    // Le contexte n'existe qu'une fois le rendu construit : c'est le premier
    // moment où l'on peut savoir qui rasterise, et le seul sans allouer de
    // contexte supplémentaire.
    quality = qualityForContext(renderer.getContext()) ?? quality;
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
    const cropMeshes = new Map<string, THREE.Group>();
    const windrowMeshes = new Map<string, THREE.Mesh>();
    let windrowGeo: THREE.BoxGeometry | null = null;
    let windrowMat: THREE.MeshLambertMaterial | null = null;
    /** Véhicules stationnés — animés en idle (hors pickables) */
    const vehicleGroups = new Map<string, THREE.Group>();
    const buildingGroup = new THREE.Group();
    buildingGroup.renderOrder = 2;
    world.add(buildingGroup);

    const workGroup = new THREE.Group();
    world.add(workGroup);
    let workVehicle: THREE.Group | null = null;
    /** Cases à parcourir, ordonnées en va-et-vient rang par rang. */
    let workPath: { x: number; y: number }[] = [];

    /** Bouffées de poussière derrière l'engin au travail. */
    const dustPuffs: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: 0xd9c9a8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      puff.visible = false;
      puff.quaternion.copy(camera.quaternion);
      workGroup.add(puff);
      dustPuffs.push(puff);
    }

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
      door: THREE.Vector3;
      paddock: THREE.Vector3;
      walkFrom: THREE.Vector3;
      walkTo: THREE.Vector3;
      walkT0: number;
      walkDur: number;
      wander: number;
      kind: string;
      buildingId: string;
      wantOut: boolean;
    }[] = [];
    const herdDoors: { mesh: THREE.Group; buildingId: string; open: number }[] = [];
    const doorGroup = new THREE.Group();
    world.add(doorGroup);
    const pickupGroup = new THREE.Group();
    world.add(pickupGroup);
    let pickupKey = "";

    const platformMat = new THREE.MeshLambertMaterial({ color: 0x8a6b4a, flatShading: true });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 1), platformMat);
    platform.receiveShadow = true;
    platform.castShadow = true;
    world.add(platform);

    const hedgeMat = new THREE.MeshLambertMaterial({ color: 0x5c9a52, flatShading: true });
    const fenceGroup = new THREE.Group();
    world.add(fenceGroup);

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

    function placeWindrow(k: string, px: number, pz: number) {
      if (windrowMeshes.has(k)) return;
      windrowGeo ??= markShared(new THREE.BoxGeometry(0.7, 0.08, 0.28));
      windrowMat ??= new THREE.MeshLambertMaterial({ color: WINDROW, flatShading: true });
      const w = new THREE.Mesh(windrowGeo, windrowMat);
      w.position.set(px, 0.14, pz);
      w.rotation.y = ((px + pz) % 2 === 0 ? 0.35 : -0.28);
      w.castShadow = true;
      world.add(w);
      windrowMeshes.set(k, w);
    }

    function clearWindrows() {
      for (const m of windrowMeshes.values()) world.remove(m);
      windrowMeshes.clear();
    }

    function cellWorldPos(x: number, y: number) {
      return { px: ox + x * step, pz: oz + y * step };
    }

    function clearWorkVehicle() {
      if (workVehicle) {
        workGroup.remove(workVehicle);
        disposeObject3D(workVehicle);
        workVehicle = null;
      }
      for (const puff of dustPuffs) puff.visible = false;
    }

    function layout() {
      grazeIdKey = "";
      grazeOutKey = "";
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
      for (const m of cropMeshes.values()) {
        world.remove(m);
        disposeObject3D(m);
      }
      cropMeshes.clear();
      clearWindrows();
      for (const g of vehicleGroups.values()) {
        world.remove(g);
        disposeObject3D(g);
      }
      vehicleGroups.clear();
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
          if (cell?.kind === "CROP") col = cropColor(cell, sim);
          if (cell?.kind === "BUILDING") col = DIRT;
          if (cell?.kind === "VEHICLE") col = PARKING;
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
          // Les cases d'emprise d'un bâtiment ne doivent pas former un muret.
          // Les aires de parking, elles, restent à hauteur du champ : les
          // engins 3D posent leurs pneus sur le dessus de la dalle.
          if (cell?.kind === "BUILDING") {
            mesh.scale.y = 0.22;
            mesh.position.set(px, -0.07, pz);
            mat.depthWrite = false;
          } else {
            mesh.position.set(px, 0, pz);
          }
          mesh.receiveShadow = true;
          mesh.userData = { x, y, baseColor: col, isSelected: isSel };
          world.add(mesh);
          cellMeshes.set(key(x, y), mesh);
          pickables.push(mesh);

          if (cell?.kind === "CROP") {
            const progress = sim?.sim.progress ?? 0.25;
            const lost = cell.fieldStage === "SPOILED" || sim?.sim.ripeness?.stage === "LOST";
            const ready = Boolean(sim?.sim.ready || cell.fieldStage === "READY");
            const cuts = cell.crop === "GRASS" ? (cell.harvestsSincePlow ?? 0) : 0;
            const crop = makeCropPlant(
              cell.crop,
              progress,
              ready,
              lost,
              cropColor(cell, sim),
              cuts,
            );
            crop.position.set(px, 0.1, pz);
            world.add(crop);
            cropMeshes.set(key(x, y), crop);
          }

          if (cell?.kind === "VEHICLE") {
            const mType = (cell.machineType as MachineType) || "TRACTOR";
            const vg = makeVehicleSprite(mType);
            vg.position.set(px, MACHINE_GROUND, pz);
            vg.userData.baseX = px;
            vg.userData.baseY = MACHINE_GROUND;
            vg.userData.baseZ = pz;
            vg.userData.phase = (x * 1.7 + y * 2.3) % (Math.PI * 2);
            world.add(vg);
            vehicleGroups.set(key(x, y), vg);
          }
        }
      }

      buildSoilRelief(soilDetails, cellSize);

      for (const b of bs) {
        const def = BUILDING_DEFS[b.type];
        const level = Math.max(1, Math.min(5, b.level ?? 1));
        const cx = ox + (b.originX + (def.w - 1) / 2) * step;
        const cz = oz + (b.originY + (def.h - 1) / 2) * step;

        // Ombre portée peinte au sol : une image plate posée dans une scène 3D
        // flotte tant que rien ne l'y rattache. Ce disque sombre coûte un
        // maillage et fait tout le travail.
        const shadow = new THREE.Mesh(
          new THREE.PlaneGeometry(def.w * step * 0.82, def.h * step * 0.82),
          new THREE.MeshBasicMaterial({
            color: 0x2c3b2a,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          }),
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.set(cx, 0.1, cz);
        buildingGroup.add(shadow);

        // L'illustration elle-même. Le panneau fait face à la caméra, qui ne
        // pivote jamais dans cette vue : l'image isométrique tombe donc juste.
        // Chaque palier agrandit le bâtiment — la silhouette dessinée ne
        // change pas, mais l'emprise visuelle dit le niveau.
        const grow = 1 + (level - 1) * 0.1;
        const spanX = (def.w + def.h) * step * 0.56 * grow;
        const spanY = spanX * BUILDING_ART_RATIO;
        // La maison en photo se mettait de travers : le panneau suit la
        // caméra, pas la grille. On la pose en volumes, alignée au damier.
        if (b.type === "FARMHOUSE") {
          const house = makeFarmhouseMesh(spanX, spanY);
          house.position.set(cx, 0.1, cz);
          buildingGroup.add(house);
        } else {
          buildingGroup.add(
            makeArtBillboard(BUILDING_ART[b.type], camera, cx, 0.1, cz, spanX, spanY),
          );
        }
      }

      viewSpan = Math.max(gw, gh) * step;
      applyCamera();
    }

    /**
     * Cadre la caméra en tenant compte du zoom et du déplacement du joueur.
     *
     * Séparé de `layout()` : la scène se reconstruit à chaque changement de
     * données, et recadrer d'office renverrait le joueur au centre à chaque
     * fois — insupportable dès qu'on travaille sur un coin de la parcelle.
     */
    function applyCamera() {
      const span = viewSpan;
      const aspect = el.clientWidth / Math.max(1, el.clientHeight);
      // Le cadrage se réglait sur la hauteur seule. Sur un écran en portrait,
      // l'étendue horizontale — la hauteur multipliée par le rapport, donc
      // plus petite — ne suffisait pas à contenir la parcelle : on atterrissait
      // dans un coin, la grille coupée des deux côtés. On recule jusqu'à ce
      // qu'elle tienne dans la dimension la plus étroite.
      const frustum = (span * 0.72) / Math.min(1, aspect) / view.zoom;
      camera.left = -frustum * aspect;
      camera.right = frustum * aspect;
      camera.top = frustum;
      camera.bottom = -frustum;
      camera.updateProjectionMatrix();
      camera.position.set(span * 0.95 + view.panX, span * 0.85, span * 0.95 + view.panZ);
      camera.lookAt(view.panX, 0, view.panZ);
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

    function addStrokeCell(cell: { x: number; y: number } | null) {
      if (!cell) return;
      const k = `${cell.x},${cell.y}`;
      if (strokeKeys.has(k)) return;
      strokeKeys.add(k);
      strokeCells.push(cell);
      onStrokePreviewRef.current?.(strokeCells.slice());
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

    function onPointerDown(ev: PointerEvent) {
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      renderer.domElement.setPointerCapture?.(ev.pointerId);
      lastX = ev.clientX;
      lastY = ev.clientY;
      dragged = false;
      clearStroke();
      if (pointers.size === 2) {
        pinchStart = pinchDistance();
        zoomStart = view.zoom;
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
        return;
      }

      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      if (!dragged && Math.hypot(dx, dy) < DRAG_SLOP_PX) return;
      dragged = true;
      lastX = ev.clientX;
      lastY = ev.clientY;

      if (strokeWorkRef.current) {
        setPointerFromEvent(ev);
        addStrokeCell(raycastCell());
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
      if (strokeWorkRef.current && dragged && strokeCells.length) {
        const done = strokeCells.slice();
        clearStroke();
        onWorkStrokeRef.current?.(done);
        return;
      }
      if (dragged) return;
      setPointerFromEvent(ev);
      const cell = raycastCell();
      if (cell) onClickRef.current(cell.x, cell.y);
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

    renderer.domElement.style.cursor = "crosshair";
    // Sans cela, le navigateur intercepte le glissement pour faire défiler la
    // page et le zoom à deux doigts ne parvient jamais jusqu'ici.
    renderer.domElement.style.touchAction = "none";
    function onTouchMove(ev: TouchEvent) {
      if (ev.touches.length >= 2) ev.preventDefault();
    }
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
      const pk = pb ? `${pb.type}:${pb.originX}:${pb.originY}:${pb.valid}` : "";
      if (pk === prevPreviewKey) return;
      prevPreviewKey = pk;
      while (previewGroup.children.length) {
        const c = previewGroup.children[0];
        previewGroup.remove(c);
        disposeObject3D(c);
      }
      if (!pb) return;

      const def = BUILDING_DEFS[pb.type];
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

      for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
          const cx = pb.originX + dx;
          const cy = pb.originY + dy;
          const { px, pz } = cellWorldPos(cx, cy);
          const tile = new THREE.Mesh(new THREE.BoxGeometry(cellSize * 0.92, 0.22, cellSize * 0.92), ghostMat);
          tile.position.set(px, 0.14, pz);
          previewGroup.add(tile);
          const rim = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 0.04, cellSize), edgeMat);
          rim.position.set(px, 0.26, pz);
          previewGroup.add(rim);
        }
      }

      const bw = def.w * step - gap;
      const bd = def.h * step - gap;
      const centerX = ox + (pb.originX + (def.w - 1) / 2) * step;
      const centerZ = oz + (pb.originY + (def.h - 1) / 2) * step;
      const pal = buildingPalette(pb.type);
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(bw * 0.88, pal.h * 0.55, bd * 0.88),
        new THREE.MeshLambertMaterial({
          color: col,
          flatShading: true,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
      );
      shell.position.set(centerX, pal.h * 0.28, centerZ);
      previewGroup.add(shell);
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
      scene.background = new THREE.Color(sky);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(sky);
      hexGroup.rotation.y = Math.sin(t * 0.05) * 0.02;

      // Idle : un léger roulis de moteur, collé au sol.
      for (const vg of vehicleGroups.values()) {
        const bx = vg.userData.baseX as number;
        const by = vg.userData.baseY as number;
        const bz = vg.userData.baseZ as number;
        const ph = vg.userData.phase as number;
        vg.position.set(bx, by, bz);
        vg.rotation.y = Math.sin(t * 0.9 + ph) * 0.03;
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
        while (doorGroup.children.length) {
          const c = doorGroup.children[0];
          doorGroup.remove(c);
          disposeObject3D(c);
        }
        herdDoors.length = 0;

        for (const herd of herds) {
          const shown = Math.min(8, herd.animals);
          const kind = herd.kind ?? "COW";
          const doorX = ox + (herd.barn.originX + herd.barn.w / 2) * step;
          const doorZ = oz + (herd.barn.originY + herd.barn.h) * step + 0.08 * step;
          const door = makeBarnDoor();
          door.position.set(doorX, 0.1, doorZ);
          door.scale.setScalar(cellSize * (kind === "HEN" ? 0.7 : 1));
          setBarnDoorOpen(door, herd.out ? 1 : 0);
          doorGroup.add(door);
          herdDoors.push({ mesh: door, buildingId: herd.buildingId, open: herd.out ? 1 : 0 });

          for (let i = 0; i < shown; i++) {
            const along = ((i % 4) - 1.5) * 0.28 * step;
            const front = new THREE.Vector3(
              doorX + along,
              0.1,
              doorZ + 0.22 * step + Math.floor(i / 4) * 0.2 * step,
            );
            const spreadX = (((i % 3) - 1) * 0.55 + (i * 0.13) % 0.4) * step;
            const spreadZ = ((Math.floor(i / 3) - 1) * 0.55 + (i * 0.21) % 0.4) * step;
            const paddock = new THREE.Vector3(
              ox + (herd.paddock.originX + herd.paddock.w / 2) * step + spreadX,
              0.1,
              oz + (herd.paddock.originY + herd.paddock.h / 2) * step + spreadZ,
            );
            const mesh = meshForHerd(kind, Boolean(herd.sheared));
            const base = kind === "HEN" ? 0.55 : kind === "SHEEP" ? 0.75 : 0.85;
            const yScale = base * (kind === "SHEEP" && herd.sheared ? 0.75 : 1);
            mesh.scale.set(cellSize * base, cellSize * yScale, cellSize * base);
            const here = herd.out ? paddock : front;
            mesh.position.copy(here);
            grazeGroup.add(mesh);
            cowWalkers.push({
              mesh,
              door: front.clone(),
              paddock: paddock.clone(),
              walkFrom: here.clone(),
              walkTo: here.clone(),
              walkT0: -10,
              walkDur: 2.6,
              wander: i * 1.7,
              kind,
              buildingId: herd.buildingId,
              wantOut: Boolean(herd.out),
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
            w.walkTo.copy(nextOut ? w.paddock : w.door);
            w.walkT0 = t + i * 0.38;
            w.walkDur = 2.6;
          }
        }
      }

      const signals = dataRef.current.yardSignals ?? [];
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
          pickupGroup.add(mesh);
        }
        for (const pile of piles) {
          if (pile.fill <= 0.02) continue;
          const mesh = makeManurePile(pile.fill);
          const px = ox + (pile.originX + pile.w / 2) * step - 0.38 * step;
          const pz = oz + (pile.originY + pile.h) * step + 0.08 * step;
          mesh.position.set(px, 0.1, pz);
          mesh.scale.setScalar(cellSize);
          pickupGroup.add(mesh);
        }
      }

      for (const w of cowWalkers) {
        const raw = (t - w.walkT0) / w.walkDur;
        const progress = Math.min(1, Math.max(0, raw));
        const eased = progress * progress * (3 - 2 * progress);
        const walking = progress > 0.02 && progress < 0.98;
        w.mesh.position.lerpVectors(w.walkFrom, w.walkTo, eased);
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
        applyHerdPose(w.mesh, w.kind, graze, walking, t, w.wander);
        const dir = walking
          ? w.walkTo.clone().sub(w.walkFrom)
          : new THREE.Vector3(w.wantOut ? 1 : 0.2, 0, w.wantOut ? 0.2 : 1);
        w.mesh.rotation.y = Math.atan2(dir.z, dir.x) + (walking ? Math.sin(t * 8 + w.wander) * 0.12 : 0);
        w.mesh.rotation.x = 0;
        w.mesh.visible = true;
      }

      for (const d of herdDoors) {
        const mine = cowWalkers.filter((w) => w.buildingId === d.buildingId);
        const want = mine.some((w) => {
          const p = Math.min(1, Math.max(0, (t - w.walkT0) / w.walkDur));
          return w.wantOut || p < 1;
        })
          ? 1
          : 0;
        d.open += (want - d.open) * Math.min(1, 0.08);
        setBarnDoorOpen(d.mesh, d.open);
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
      const selPulse = 0.35 + Math.sin(t * 4.5) * 0.12;

      syncPreviewFootprint();

      for (const [k, mesh] of cellMeshes) {
        const mat = mesh.material as THREE.MeshLambertMaterial;
        const base = mesh.userData.baseColor as number;
        const isSelected = mesh.userData.isSelected as boolean;
        tmpColor.setHex(base);

        if (isSelected || selSet.has(k)) {
          tmpColor.lerp(selectColor, selPulse);
        }
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
          workVehicle = makeVehicleSprite(aw.type);
          if (aw.haul) hitchTrailer(workVehicle, aw.cargo);
          workGroup.add(workVehicle);
          workVehicle.userData.lastX = undefined;
          workVehicle.userData.lastZ = undefined;
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
      if (workVehicle && workPath.length) {
        const duration = workAnimationMs(workPath.length) / 1000;
        const u = Math.min(1, (t - workStartRef.current) / duration);
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
        const bounce = Math.sin(t * 14) * 0.012;
        workVehicle.position.set(px, MACHINE_GROUND + bounce, pz);
        workVehicle.rotation.y = Math.atan2(pb.px - pa.px, pb.pz - pa.pz) || 0;
        workVehicle.visible = u < 1;

        const lastX = workVehicle.userData.lastX as number | undefined;
        const lastZ = workVehicle.userData.lastZ as number | undefined;
        const dist =
          lastX == null || lastZ == null ? 0 : Math.min(0.45, Math.hypot(px - lastX, pz - lastZ));
        workVehicle.userData.lastX = px;
        workVehicle.userData.lastZ = pz;
        tickMachine(workVehicle, {
          distance: dist,
          working: u < 1,
          dt: delta / 1000,
        });

        // La coupe se voit : chaque case franchie perd sa culture au passage,
        // au lieu que le champ entier disparaisse d'un coup au rechargement.
        const cutting = aw?.cut === "harvest" || aw?.cut === "mow" || aw?.type === "HARVESTER";
        if (cutting) {
          for (let i = 0; i <= i0; i++) {
            const cell = workPath[i];
            const k = key(cell.x, cell.y);
            const done = cropMeshes.get(k);
            if (!done) continue;
            if (aw?.cut === "mow") {
              done.scale.set(1, 0.28, 1);
              const pos = cellWorldPos(cell.x, cell.y);
              placeWindrow(k, pos.px, pos.pz);
            } else {
              done.visible = false;
            }
          }
        }

        // Poussière soulevée derrière l'engin : trois bouffées qui gonflent et
        // s'effacent, décalées dans le temps.
        for (let d = 0; d < dustPuffs.length; d++) {
          const puff = dustPuffs[d];
          const age = (t * 1.6 + d * 0.33) % 1;
          puff.visible = true;
          puff.position.set(
            px - Math.sin(workVehicle.rotation.y) * (0.35 + age * 0.5),
            0.12 + age * 0.16,
            pz - Math.cos(workVehicle.rotation.y) * (0.35 + age * 0.5),
          );
          const s = 0.12 + age * 0.3;
          puff.scale.setScalar(s);
          (puff.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - age);
        }

        if (u >= 1) {
          // reste visible brièvement puis masqué jusqu’au prochain work
          workVehicle.visible = false;
        }
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
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      while (previewGroup.children.length) {
        const c = previewGroup.children[0];
        previewGroup.remove(c);
        disposeObject3D(c);
      }
      clearWorkVehicle();
      // Marquée partagée pour survivre aux reconstructions de scène, la
      // géométrie de dalle doit être libérée explicitement au démontage.
      sharedTile?.geo.dispose();
      sharedTile = null;
      windrowGeo?.dispose();
      windrowMat?.dispose();
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
          `${x.x},${x.y},${x.kind},${x.crop ?? ""},${x.fieldStage ?? ""},${x.machineType ?? ""},${x.hasStubble ? 1 : 0},${x.residuePasses ?? 0},${x.weedsControlled ? 1 : 0},${x.harvestsSincePlow ?? 0}`,
      )
      .join("|");
    const b = buildings
      .map((x) => `${x.id},${x.type},${x.level ?? 1},${x.originX},${x.originY}`)
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
    return `${gridW}x${gridH}#${c}#${b}#${s}#${sel}#${w}`;
  }, [cells, buildings, cellSims, selected, workers, gridW, gridH]);

  useEffect(() => {
    layoutRef.current?.();
  }, [sceneKey]);

  return <div className="iso-viewport" ref={mountRef} aria-label="Vue isométrique de la ferme" />;
}
