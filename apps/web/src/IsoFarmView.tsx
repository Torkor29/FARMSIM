import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BUILDING_DEFS,
  RIPENESS_COLORS,
  type BuildingType,
  type CropCode,
  type MachineType,
  type RipenessStage,
} from "@farmsim/shared";
import { disposeRenderer, disposeThreeScene, markShared } from "./three-cleanup";
import {
  createDustTrail,
  createMachineRig,
  isTowedImplement,
  type MachineRig,
} from "./machines3d";

export type IsoCell = {
  x: number;
  y: number;
  kind: "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";
  crop?: CropCode | null;
  fieldStage?: string;
  fertilizedPasses?: number;
  /** Chaumes après moisson : la case n'est pas semable en l'état */
  hasStubble?: boolean;
  /** Déchaumages consécutifs — le sol s'assombrit à mesure qu'il s'enrichit */
  residuePasses?: number;
  /** Type machine si kind === VEHICLE (sinon TRACTOR par défaut) */
  machineType?: MachineType | null;
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
};

/** Un troupeau au pré : de quelle étable il sort, et vers quel enclos. */
export type GrazingHerd = {
  buildingId: string;
  animals: number;
  barn: { originX: number; originY: number; w: number; h: number };
  paddock: { originX: number; originY: number; w: number; h: number };
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
  weather?: string;
  onCellClick: (x: number, y: number) => void;
  onCellHover?: (cell: { x: number; y: number } | null) => void;
};

const SOIL = 0x9ac06a;
const SOIL_DARK = 0x8ab35e;
const GROW = 0x7fbc4e;
const READY = 0xe8c65e;
const SELECT_GLOW = 0x5ee08a;
const HOVER = 0x53c5f5;
const PREVIEW_OK = 0x2fc46a;
const PREVIEW_BAD = 0xef4444;
const DIRT = 0xa4835c;
const PULSE = 0xfff2b0;

/**
 * Cap d'un engin garé : un quart de tour, pour qu'il présente son flanc et sa
 * cabine au joueur plutôt que son capot ou son cul.
 */
const PARK_HEADING = -Math.PI / 2;

/** Écart d'angle ramené dans ]−π, π] — sinon un passage par ±π braque à fond. */
function shortestAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Aire de stationnement des engins — terre battue claire */
const PARKING = 0xd8c9a8;

const STUBBLE_SOIL = 0xd9c48a;
const RESIDUE_SOIL = 0x7f6a44;

function cropColor(c: IsoCell, sim?: IsoSim): number {
  if (c.kind !== "CROP") {
    // Un champ moissonné se lit à sa couleur : chaume clair tant qu'il n'est
    // pas travaillé, terre sombre une fois les résidus incorporés.
    if (c.hasStubble) return STUBBLE_SOIL;
    if ((c.residuePasses ?? 0) > 0) return RESIDUE_SOIL;
    return SOIL;
  }
  // Passé la maturité, la teinte raconte la dégradation : l'or vire au brun
  // puis à la tige morte. C'est le seul signal qui prévienne le joueur.
  if (sim?.sim.ripeness) return RIPENESS_COLORS[sim.sim.ripeness.stage];
  if (c.fieldStage === "SPOILED") return RIPENESS_COLORS.LOST;
  if (c.fieldStage === "READY" || sim?.sim.ready) return READY;
  const p = sim?.sim.progress ?? 0.3;
  const g = new THREE.Color(GROW);
  const r = new THREE.Color(READY);
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

/** Vache low-poly, taille d'une demi-case. */
function makeCowMesh(): THREE.Group {
  const g = new THREE.Group();
  const hide = new THREE.MeshLambertMaterial({ color: 0xf4efe4, flatShading: true });
  const patch = new THREE.MeshLambertMaterial({ color: 0x5a4132, flatShading: true });
  const snout = new THREE.MeshLambertMaterial({ color: 0xe3b3a8, flatShading: true });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.19), hide);
  body.position.y = 0.21;
  body.castShadow = true;
  g.add(body);

  const spot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.2), patch);
  spot.position.set(0.05, 0.25, 0);
  g.add(spot);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.14, 0.14), hide);
  head.position.set(-0.24, 0.25, 0);
  g.add(head);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.1), snout);
  muzzle.position.set(-0.33, 0.22, 0);
  g.add(muzzle);

  for (const [lx, lz] of [
    [-0.11, 0.06],
    [-0.11, -0.06],
    [0.11, 0.06],
    [0.11, -0.06],
  ]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.14, 0.055),
      new THREE.MeshLambertMaterial({ color: 0xdcd4c6, flatShading: true }),
    );
    leg.position.set(lx, 0.07, lz);
    g.add(leg);
  }
  return g;
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      // Les engins partagent leurs géométries entre instances et entre
      // reconstructions de scène : les libérer ici viderait le cache et
      // laisserait les machines suivantes sans maillage.
      if (!o.geometry.userData?.shared) o.geometry.dispose();
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
  weather = "CLEAR",
  onCellClick,
  onCellHover,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onCellClick);
  onClickRef.current = onCellClick;
  const onHoverRef = useRef(onCellHover);
  onHoverRef.current = onCellHover;
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap est déprécié depuis r185 : le renderer le remplace de
    // toute façon par PCFShadowMap en émettant un avertissement.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    el.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(18, 16, 18);
    camera.lookAt(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x9ab87e, 1.25);
    scene.add(hemi);
    const ambient = new THREE.AmbientLight(0xfff6e4, 0.65);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff2d4, 1.55);
    sun.position.set(14, 24, 10);
    sun.castShadow = true;
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
        const geo = new THREE.CylinderGeometry(1.05, 1.05, 0.12, 6);
        const mesh = new THREE.Mesh(geo, (q + r) % 2 === 0 ? hexMat : hexEdge);
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
    const cropMeshes = new Map<string, THREE.Mesh>();
    /** Engins garés au parc — moteur coupé, mais gyrophare et roues prêts */
    const vehicleRigs = new Map<string, MachineRig>();
    const buildingGroup = new THREE.Group();
    world.add(buildingGroup);

    const workGroup = new THREE.Group();
    world.add(workGroup);
    let workRig: MachineRig | null = null;
    /** Distance cumulée du chantier en cours — entraîne roues et disques */
    let workTravelled = 0;
    let workHeading: number | null = null;
    let lastWorkPos: { x: number; z: number } | null = null;
    const workDust = createDustTrail(10);
    workGroup.add(workDust.object);

    const previewGroup = new THREE.Group();
    world.add(previewGroup);
    let prevPreviewKey = "";

    // Bêtes au pré : chaque vache garde sa propre trajectoire, sinon le
    // troupeau se déplace comme un bloc et l'illusion tombe.
    const grazeGroup = new THREE.Group();
    world.add(grazeGroup);
    let grazeKey = "";
    const cowWalkers: {
      mesh: THREE.Group;
      from: THREE.Vector3;
      to: THREE.Vector3;
      delay: number;
      wander: number;
    }[] = [];

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
        sharedTile = { size, geo: markShared(new THREE.BoxGeometry(size, 0.18, size)) };
      }
      return sharedTile.geo;
    }

    function cellWorldPos(x: number, y: number) {
      return { px: ox + x * step, pz: oz + y * step };
    }

    function clearWorkVehicle() {
      if (workRig) {
        workGroup.remove(workRig.group);
        workRig.dispose();
        workRig = null;
      }
    }

    function layout() {
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
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      cropMeshes.clear();
      for (const rig of vehicleRigs.values()) {
        world.remove(rig.group);
        rig.dispose();
      }
      vehicleRigs.clear();
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
      const treeMat = new THREE.MeshLambertMaterial({ color: 0x2f6b32, flatShading: true });
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22, flatShading: true });
      for (const [tx, tz] of [
        [-hw / 2, -hh / 2],
        [hw / 2, -hh / 2],
        [-hw / 2, hh / 2],
        [hw / 2, hh / 2],
      ] as const) {
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), trunkMat);
        trunk.position.set(tx, 0.2, tz);
        const crown = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), treeMat);
        crown.position.set(tx, 0.65, tz);
        fenceGroup.add(trunk, crown);
      }

      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const cell = cs.find((c) => c.x === x && c.y === y);
          const sim = sims.find((s) => s.x === x && s.y === y);
          const isSel = sel.some((s) => s.x === x && s.y === y);
          const { px, pz } = cellWorldPos(x, y);

          let col = (x + y) % 2 === 0 ? SOIL : SOIL_DARK;
          if (cell?.kind === "CROP") col = cropColor(cell, sim);
          if (cell?.kind === "BUILDING") col = DIRT;
          // Aire de stationnement : terre battue claire (charte §4.5), et non
          // plus un enrobé presque noir — les engins s'y détachaient comme sur
          // un trou dans la parcelle.
          if (cell?.kind === "VEHICLE") col = PARKING;

          const mat = new THREE.MeshLambertMaterial({
            color: isSel ? SELECT_GLOW : col,
            flatShading: true,
          });
          const mesh = new THREE.Mesh(tileGeo(cellSize), mat);
          mesh.position.set(px, 0, pz);
          mesh.receiveShadow = true;
          mesh.userData = { x, y, baseColor: col, isSelected: isSel };
          world.add(mesh);
          cellMeshes.set(key(x, y), mesh);
          pickables.push(mesh);

          if (cell?.kind === "CROP") {
            const h = 0.15 + (sim?.sim.progress ?? 0.25) * 0.55;
            const cropMat = new THREE.MeshLambertMaterial({
              color: cropColor(cell, sim),
              flatShading: true,
            });
            const crop = new THREE.Mesh(new THREE.BoxGeometry(0.55, h, 0.55), cropMat);
            crop.position.set(px, 0.1 + h / 2, pz);
            crop.castShadow = true;
            world.add(crop);
            cropMeshes.set(key(x, y), crop);
          }

          if (cell?.kind === "VEHICLE") {
            const mType = (cell.machineType as MachineType) || "TRACTOR";
            // Au parc, un outil est dételé : c'est ainsi qu'on le reconnaît
            // du même outil au travail, accroché derrière son tracteur.
            const rig = createMachineRig(mType, { seed: x * 7 + y * 13 });
            // L'engin tient dans sa case sans déborder sur les voisines.
            rig.group.scale.setScalar((cellSize * 0.92) / Math.max(1, rig.length));
            // Un parc rangé au cordeau sonne faux : chaque engin est posé de
            // travers de quelques degrés, toujours les mêmes.
            rig.group.rotation.y = PARK_HEADING + Math.sin(x * 3.7 + y * 1.9) * 0.5;
            rig.group.position.set(px, 0.09, pz);
            world.add(rig.group);
            vehicleRigs.set(key(x, y), rig);
          }
        }
      }

      for (const b of bs) {
        const def = BUILDING_DEFS[b.type];
        const pal = buildingPalette(b.type);
        const level = Math.max(1, Math.min(5, b.level ?? 1));
        // Le bâtiment prend de la hauteur et se garnit à chaque palier.
        const grow = 1 + (level - 1) * 0.16;
        const height = pal.h * grow;
        const cx = ox + (b.originX + (def.w - 1) / 2) * step;
        const cz = oz + (b.originY + (def.h - 1) / 2) * step;
        const bw = def.w * step - gap;
        const bd = def.h * step - gap;
        const bodyMat = new THREE.MeshLambertMaterial({
          color: pal.body,
          flatShading: true,
        });
        const roofMat = new THREE.MeshLambertMaterial({
          color: pal.roof,
          flatShading: true,
        });

        if (b.type === "PADDOCK" || b.type === "PIG_YARD") {
          const isPigYard = b.type === "PIG_YARD";
          // Un enclos n'est pas un bâtiment : de l'herbe, une clôture, un
          // abreuvoir. Lui coller un toit ferait exactement le contraire de
          // ce qu'il représente.
          const grass = new THREE.Mesh(
            new THREE.BoxGeometry(bw, 0.08, bd),
            new THREE.MeshLambertMaterial({
              color: isPigYard ? 0x8a6f52 : 0x8fcf6a,
              flatShading: true,
            }),
          );
          grass.position.set(cx, 0.04, cz);
          grass.receiveShadow = true;
          buildingGroup.add(grass);

          const postMat = new THREE.MeshLambertMaterial({
            color: WOOD_WARM,
            flatShading: true,
          });
          const railMat = new THREE.MeshLambertMaterial({
            color: 0xd8b689,
            flatShading: true,
          });
          const halfW = bw / 2;
          const halfD = bd / 2;
          for (const [sx, sz, len, horizontal] of [
            [0, -halfD, bw, true],
            [0, halfD, bw, true],
            [-halfW, 0, bd, false],
            [halfW, 0, bd, false],
          ] as [number, number, number, boolean][]) {
            for (const rail of [0.22, 0.4]) {
              const bar = new THREE.Mesh(
                horizontal
                  ? new THREE.BoxGeometry(len, 0.04, 0.05)
                  : new THREE.BoxGeometry(0.05, 0.04, len),
                railMat,
              );
              bar.position.set(cx + sx, rail, cz + sz);
              buildingGroup.add(bar);
            }
          }
          for (const [px, pz] of [
            [-halfW, -halfD],
            [halfW, -halfD],
            [-halfW, halfD],
            [halfW, halfD],
          ]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.5, 0.09), postMat);
            post.position.set(cx + px, 0.25, cz + pz);
            post.castShadow = true;
            buildingGroup.add(post);
          }

          const trough = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.14, 0.2),
            new THREE.MeshLambertMaterial({ color: 0x8a9299, flatShading: true }),
          );
          trough.position.set(cx + halfW * 0.5, 0.11, cz - halfD * 0.5);
          buildingGroup.add(trough);
          continue;
        }

        if (b.type === "SILO") {
          // Un silo de plus tous les deux paliers, comme sur la planche d'art.
          const tanks = 1 + Math.floor(level / 2);
          const spread = 0.34;
          for (let i = 0; i < tanks; i++) {
            const offX = (i - (tanks - 1) / 2) * spread;
            const tankH = height * (i === 0 ? 1 : 0.86);
            const cyl = new THREE.Mesh(
              new THREE.CylinderGeometry(0.3, 0.33, tankH, 10),
              bodyMat,
            );
            cyl.position.set(cx + offX, tankH / 2, cz + (i % 2 ? 0.18 : -0.12));
            cyl.castShadow = true;
            buildingGroup.add(cyl);
            const cap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.28, 10), roofMat);
            cap.position.set(cyl.position.x, tankH + 0.12, cyl.position.z);
            buildingGroup.add(cap);
          }
        } else {
          // Chaque palier change la SILHOUETTE, pas seulement l'échelle : un
          // appentis, puis un pignon relevé, puis une aile en L, puis une
          // toiture industrielle. C'est ce qui rend l'amélioration lisible de
          // loin, comme sur la planche d'art de référence.
          const body = new THREE.Mesh(new THREE.BoxGeometry(bw, height, bd), bodyMat);
          body.position.set(cx, height / 2, cz);
          body.castShadow = true;
          buildingGroup.add(body);

          const trimMat = new THREE.MeshLambertMaterial({
            color: 0x8a6a4a,
            flatShading: true,
          });
          const metalMat = new THREE.MeshLambertMaterial({
            color: 0xd8dde2,
            flatShading: true,
          });

          if (level <= 2) {
            // Toit à deux pans simple, faîtage bas.
            const ridge = new THREE.Mesh(
              new THREE.CylinderGeometry(bd * 0.58, bd * 0.58, bw * 1.06, 3, 1),
              roofMat,
            );
            ridge.rotation.z = Math.PI / 2;
            ridge.rotation.y = Math.PI / 2;
            ridge.position.set(cx, height + bd * 0.2, cz);
            ridge.castShadow = true;
            buildingGroup.add(ridge);
          } else if (level === 3) {
            // Pignon relevé et lucarne : le bâtiment prend de la prestance.
            const ridge = new THREE.Mesh(
              new THREE.CylinderGeometry(bd * 0.72, bd * 0.72, bw * 1.1, 3, 1),
              roofMat,
            );
            ridge.rotation.z = Math.PI / 2;
            ridge.rotation.y = Math.PI / 2;
            ridge.position.set(cx, height + bd * 0.3, cz);
            ridge.castShadow = true;
            buildingGroup.add(ridge);

            const dormer = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.26, bd * 0.34, bd * 0.42),
              bodyMat,
            );
            dormer.position.set(cx - bw * 0.12, height + bd * 0.3, cz + bd * 0.24);
            buildingGroup.add(dormer);
          } else {
            // Toiture industrielle en deux volumes décalés : la silhouette
            // devient franchement rectiligne, plus « usine » que « grange ».
            const main = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 1.06, bd * 0.3, bd * 1.06),
              roofMat,
            );
            main.position.set(cx, height + bd * 0.15, cz);
            main.rotation.z = 0.06;
            main.castShadow = true;
            buildingGroup.add(main);

            const clerestory = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.5, bd * 0.24, bd * 0.5),
              metalMat,
            );
            clerestory.position.set(cx, height + bd * 0.42, cz);
            buildingGroup.add(clerestory);
          }

          if (level === 2) {
            // Appentis accolé : le premier signe visible d'agrandissement.
            const lean = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.3, height * 0.6, bd * 0.82),
              trimMat,
            );
            lean.position.set(cx + bw * 0.62, height * 0.3, cz);
            lean.castShadow = true;
            buildingGroup.add(lean);
            const leanRoof = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.36, 0.08, bd * 0.9),
              roofMat,
            );
            leanRoof.position.set(cx + bw * 0.62, height * 0.62, cz);
            leanRoof.rotation.z = -0.16;
            buildingGroup.add(leanRoof);
          }

          if (level >= 3) {
            const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), trimMat);
            chimney.position.set(cx + bw * 0.3, height + bd * 0.48, cz - bd * 0.22);
            chimney.castShadow = true;
            buildingGroup.add(chimney);
          }

          if (level >= 4) {
            // Aile en L : l'emprise visuelle déborde, le bâtiment n'est plus
            // une simple boîte.
            const wing = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.44, height * 0.78, bd * 0.6),
              bodyMat,
            );
            wing.position.set(cx - bw * 0.6, height * 0.39, cz + bd * 0.3);
            wing.castShadow = true;
            buildingGroup.add(wing);
            const wingRoof = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.5, 0.1, bd * 0.66),
              roofMat,
            );
            wingRoof.position.set(cx - bw * 0.6, height * 0.8, cz + bd * 0.3);
            buildingGroup.add(wingRoof);
          }

          if (level >= 5) {
            for (const side of [-1, 1]) {
              const tank = new THREE.Mesh(
                new THREE.CylinderGeometry(0.19, 0.19, height * 0.95, 10),
                metalMat,
              );
              tank.position.set(cx + bw * 0.58 * side, height * 0.48, cz - bd * 0.3);
              tank.castShadow = true;
              buildingGroup.add(tank);
            }
            const walkway = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 1.2, 0.06, 0.12),
              metalMat,
            );
            walkway.position.set(cx, height * 0.95, cz - bd * 0.3);
            buildingGroup.add(walkway);
          }
        }
      }

      const span = Math.max(gw, gh) * step;
      const frustum = span * 0.72;
      const aspect = el.clientWidth / Math.max(1, el.clientHeight);
      camera.left = -frustum * aspect;
      camera.right = frustum * aspect;
      camera.top = frustum;
      camera.bottom = -frustum;
      camera.updateProjectionMatrix();
      camera.position.set(span * 0.95, span * 0.85, span * 0.95);
      camera.lookAt(0, 0, 0);
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

    function onPointerMove(ev: PointerEvent) {
      setPointerFromEvent(ev);
      const cell = raycastCell();
      onHoverRef.current?.(cell);
    }

    function onPointerLeave() {
      onHoverRef.current?.(null);
    }

    function onPointer(ev: PointerEvent) {
      setPointerFromEvent(ev);
      const cell = raycastCell();
      if (cell) onClickRef.current(cell.x, cell.y);
    }

    renderer.domElement.style.cursor = "crosshair";
    renderer.domElement.addEventListener("pointerdown", onPointer);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

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

    function tick() {
      raf = requestAnimationFrame(tick);
      timer.update();
      const dt = Math.min(0.05, timer.getDelta());
      const t = timer.getElapsed();
      const sky = skyFor(weatherRef.current);
      scene.background = new THREE.Color(sky);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(sky);
      hexGroup.rotation.y = Math.sin(t * 0.05) * 0.02;
      world.position.y = Math.sin(t * 0.7) * 0.015;

      // Engins garés : moteur coupé. Rien ne bouge — ni roue, ni gyrophare,
      // ni flottement. C'est le contraste avec l'engin au travail qui dit au
      // joueur quelle machine est occupée.
      for (const rig of vehicleRigs.values()) {
        rig.update({ t, distance: 0, working: false });
      }

      // Troupeaux au pré : sortie de l'étable, puis broutage dans l'enclos.
      const herds = dataRef.current.grazing ?? [];
      const nextGrazeKey = herds.map((h) => `${h.buildingId}:${h.animals}`).join("|");
      if (nextGrazeKey !== grazeKey) {
        grazeKey = nextGrazeKey;
        for (const w of cowWalkers) {
          grazeGroup.remove(w.mesh);
          disposeObject3D(w.mesh);
        }
        cowWalkers.length = 0;

        for (const herd of herds) {
          // Au plus huit bêtes visibles : au-delà, l'enclos devient illisible
          // et le coût de rendu grimpe pour rien.
          const shown = Math.min(8, herd.animals);
          for (let i = 0; i < shown; i++) {
            const doorX = ox + (herd.barn.originX + herd.barn.w / 2) * step;
            const doorZ = oz + (herd.barn.originY + herd.barn.h / 2) * step;
            const spreadX = (((i % 3) - 1) * 0.55 + (i * 0.13) % 0.4) * step;
            const spreadZ = ((Math.floor(i / 3) - 1) * 0.55 + (i * 0.21) % 0.4) * step;
            const targetX = ox + (herd.paddock.originX + herd.paddock.w / 2) * step + spreadX;
            const targetZ = oz + (herd.paddock.originY + herd.paddock.h / 2) * step + spreadZ;

            const mesh = makeCowMesh();
            mesh.scale.setScalar(cellSize * 0.85);
            grazeGroup.add(mesh);
            cowWalkers.push({
              mesh,
              from: new THREE.Vector3(doorX, 0.1, doorZ),
              to: new THREE.Vector3(targetX, 0.1, targetZ),
              delay: i * 0.55,
              wander: i * 1.7,
            });
          }
        }
      }

      for (const w of cowWalkers) {
        // Aller, brouter, revenir : un cycle lent qui se lit d'un coup d'œil.
        const local = Math.max(0, t - w.delay);
        const cycle = 26;
        const phase = (local % cycle) / cycle;
        let progress: number;
        if (phase < 0.18) progress = phase / 0.18;
        else if (phase < 0.82) progress = 1;
        else progress = 1 - (phase - 0.82) / 0.18;
        const eased = progress * progress * (3 - 2 * progress);

        w.mesh.position.lerpVectors(w.from, w.to, eased);
        if (progress === 1) {
          w.mesh.position.x += Math.sin(t * 0.35 + w.wander) * 0.1 * step;
          w.mesh.position.z += Math.cos(t * 0.28 + w.wander) * 0.1 * step;
          // Tête qui plonge dans l'herbe par intermittence.
          w.mesh.rotation.x = Math.max(0, Math.sin(t * 0.7 + w.wander)) * 0.22;
        } else {
          w.mesh.rotation.x = 0;
        }
        const dir = eased < 1 ? w.to.clone().sub(w.from) : new THREE.Vector3(1, 0, 0);
        w.mesh.rotation.y = Math.atan2(dir.z, dir.x) + Math.sin(t * 0.4 + w.wander) * 0.25;
        w.mesh.visible = local > 0;
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

      // Engin de chantier : il parcourt les cases travaillées, et tout le
      // reste de son animation en découle — roues, disques, rabatteur.
      const workKey = aw
        ? `${aw.type}:${aw.cells.map((c) => `${c.x},${c.y}`).join("|")}`
        : "";
      if (workKey !== prevWorkKey.current) {
        prevWorkKey.current = workKey;
        clearWorkVehicle();
        if (aw && aw.cells.length) {
          workStartRef.current = t;
          // Un outil traîné arrive attelé : un déchaumeur qui traverse le
          // champ tout seul ne trompe personne.
          workRig = createMachineRig(aw.type, { towed: isTowedImplement(aw.type) });
          workRig.group.scale.setScalar(0.92);
          workGroup.add(workRig.group);
          workTravelled = 0;
          workHeading = null;
          lastWorkPos = null;
        }
      }
      if (workRig && aw && aw.cells.length) {
        const duration = Math.max(0.7, aw.cells.length * 0.28);
        const u = Math.min(1, (t - workStartRef.current) / duration);
        const n = aw.cells.length;
        const f = u * Math.max(1, n - 1);
        const i0 = Math.min(n - 1, Math.floor(f));
        const i1 = Math.min(n - 1, i0 + 1);
        const local = f - i0;
        const a = aw.cells[i0];
        const b = aw.cells[i1];
        const pa = cellWorldPos(a.x, a.y);
        const pb = cellWorldPos(b.x, b.y);
        const px = pa.px + (pb.px - pa.px) * local;
        const pz = pa.pz + (pb.pz - pa.pz) * local;

        // La distance réellement parcourue pilote les roues : elles tournent
        // à la vitesse de l'engin, dans le bon sens, et calent à l'arrêt.
        const stepX = lastWorkPos ? px - lastWorkPos.x : 0;
        const stepZ = lastWorkPos ? pz - lastWorkPos.z : 0;
        workTravelled += Math.hypot(stepX, stepZ);
        // Cap : l'engin regarde vers +X dans son repère, d'où le −dz. Tant
        // qu'il n'a pas bougé, on vise la case suivante pour ne pas le poser
        // en travers au premier rendu.
        const fallback =
          workHeading ?? Math.atan2(-(pb.pz - pa.pz), pb.px - pa.px);
        const heading =
          Math.hypot(stepX, stepZ) > 1e-5 ? Math.atan2(-stepZ, stepX) : fallback;
        const steer = workHeading === null ? 0 : shortestAngle(heading - workHeading);
        workHeading = heading;
        lastWorkPos = { x: px, z: pz };

        workRig.group.position.set(px, 0.09, pz);
        workRig.group.rotation.y = heading;
        workRig.group.visible = u < 1;
        workRig.update({
          t,
          distance: workTravelled,
          working: true,
          steer: Math.max(-1, Math.min(1, steer * 6)),
          // Moissonneuse : la trémie se vide sur la fin du chantier.
          unloading: aw.type === "HARVESTER" && u > 0.62,
        });

        // Poussière derrière l'engin, tant qu'il roule.
        const back = workRig.length * 0.5;
        workDust.update(
          dt,
          px - Math.cos(heading) * back,
          0.12,
          pz + Math.sin(heading) * back,
          u < 1,
        );
      } else {
        workDust.update(dt, 0, 0, 0, false);
      }

      renderer.render(scene, camera);
    }
    tick();

    const sync = setInterval(() => layout(), 350);
    layoutRef.current = layout;

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(sync);
      layoutRef.current = null;
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointer);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      while (previewGroup.children.length) {
        const c = previewGroup.children[0];
        previewGroup.remove(c);
        disposeObject3D(c);
      }
      clearWorkVehicle();
      workDust.dispose();
      // Marquée partagée pour survivre aux reconstructions de scène, la
      // géométrie de dalle doit être libérée explicitement au démontage.
      sharedTile?.geo.dispose();
      sharedTile = null;
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
          `${x.x},${x.y},${x.kind},${x.crop ?? ""},${x.fieldStage ?? ""},${x.machineType ?? ""},${x.hasStubble ? 1 : 0},${x.residuePasses ?? 0}`,
      )
      .join("|");
    const b = buildings
      .map((x) => `${x.id},${x.type},${x.level ?? 1},${x.originX},${x.originY}`)
      .join("|");
    // Seul le palier de maturité compte visuellement, pas la progression fine.
    const s = cellSims
      .map((x) => `${x.x},${x.y},${x.sim.ripeness?.stage ?? (x.sim.ready ? "R" : "G")}`)
      .join("|");
    const sel = selected.map((x) => `${x.x},${x.y}`).join("|");
    return `${gridW}x${gridH}#${c}#${b}#${s}#${sel}`;
  }, [cells, buildings, cellSims, selected, gridW, gridH]);

  useEffect(() => {
    layoutRef.current?.();
  }, [sceneKey]);

  return <div className="iso-viewport" ref={mountRef} aria-label="Vue isométrique de la ferme" />;
}
