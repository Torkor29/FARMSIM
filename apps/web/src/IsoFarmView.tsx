import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  BUILDING_DEFS,
  type BuildingType,
  type CropCode,
  type MachineType,
} from "@farmsim/shared";

export type IsoCell = {
  x: number;
  y: number;
  kind: "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";
  crop?: CropCode | null;
  fieldStage?: string;
  fertilizedPasses?: number;
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
  sim: { progress: number; ready: boolean };
};

export type ActiveWork = {
  type: MachineType;
  cells: { x: number; y: number }[];
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

const MACHINE_LOOK: Record<
  MachineType,
  { body: number; accent: number; w: number; h: number; d: number }
> = {
  TRACTOR: { body: 0x3d8f3a, accent: 0x2a6a28, w: 0.55, h: 0.28, d: 0.35 },
  HARVESTER: { body: 0xc44a2f, accent: 0xd4a84b, w: 0.72, h: 0.32, d: 0.4 },
  SPREADER: { body: 0x6a7380, accent: 0xc9a227, w: 0.5, h: 0.34, d: 0.42 },
};

function cropColor(c: IsoCell, sim?: IsoSim): number {
  if (c.kind !== "CROP") return SOIL;
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
    default:
      return { body: WOOD_WARM, roof: ROOF_TEAL, h: 1 };
  }
}

function makeVehicleMesh(type: MachineType): THREE.Group {
  const look = MACHINE_LOOK[type] ?? MACHINE_LOOK.TRACTOR;
  const g = new THREE.Group();
  g.userData.machineType = type;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(look.w, look.h, look.d),
    new THREE.MeshLambertMaterial({ color: look.body, flatShading: true }),
  );
  body.castShadow = true;
  body.position.y = look.h / 2;
  g.add(body);

  if (type === "TRACTOR") {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.28),
      new THREE.MeshLambertMaterial({ color: look.accent, flatShading: true }),
    );
    cabin.position.set(-0.05, look.h + 0.08, 0);
    cabin.castShadow = true;
    g.add(cabin);
  } else if (type === "HARVESTER") {
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.12, 0.55),
      new THREE.MeshLambertMaterial({ color: look.accent, flatShading: true }),
    );
    header.position.set(look.w * 0.42, look.h * 0.35, 0);
    header.castShadow = true;
    g.add(header);
    const pipe = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.35, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x888888, flatShading: true }),
    );
    pipe.position.set(-0.15, look.h + 0.12, 0);
    g.add(pipe);
  } else {
    // SPREADER — cuve dorée
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.18, 0.38, 6),
      new THREE.MeshLambertMaterial({ color: look.accent, flatShading: true }),
    );
    tank.rotation.z = Math.PI / 2;
    tank.position.set(0, look.h + 0.06, 0);
    tank.castShadow = true;
    g.add(tank);
  }

  return g;
}

function disposeObject3D(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
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
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
    /** Véhicules stationnés — animés en idle (hors pickables) */
    const vehicleGroups = new Map<string, THREE.Group>();
    const buildingGroup = new THREE.Group();
    world.add(buildingGroup);

    const workGroup = new THREE.Group();
    world.add(workGroup);
    let workVehicle: THREE.Group | null = null;

    const previewGroup = new THREE.Group();
    world.add(previewGroup);
    let prevPreviewKey = "";

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

    function cellWorldPos(x: number, y: number) {
      return { px: ox + x * step, pz: oz + y * step };
    }

    function clearWorkVehicle() {
      if (workVehicle) {
        workGroup.remove(workVehicle);
        disposeObject3D(workVehicle);
        workVehicle = null;
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
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      cellMeshes.clear();
      for (const m of cropMeshes.values()) {
        world.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      cropMeshes.clear();
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
          if (cell?.kind === "VEHICLE") col = 0x3a3f44;

          const mat = new THREE.MeshLambertMaterial({
            color: isSel ? SELECT_GLOW : col,
            flatShading: true,
          });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 0.18, cellSize), mat);
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
            const vg = makeVehicleMesh(mType);
            vg.position.set(px, 0.12, pz);
            vg.userData.baseX = px;
            vg.userData.baseY = 0.12;
            vg.userData.baseZ = pz;
            vg.userData.phase = (x * 1.7 + y * 2.3) % (Math.PI * 2);
            world.add(vg);
            vehicleGroups.set(key(x, y), vg);
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

        if (b.type === "PADDOCK") {
          // Un enclos n'est pas un bâtiment : de l'herbe, une clôture, un
          // abreuvoir. Lui coller un toit ferait exactement le contraire de
          // ce qu'il représente.
          const grass = new THREE.Mesh(
            new THREE.BoxGeometry(bw, 0.08, bd),
            new THREE.MeshLambertMaterial({ color: 0x8fcf6a, flatShading: true }),
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
          const body = new THREE.Mesh(new THREE.BoxGeometry(bw, height, bd), bodyMat);
          body.position.set(cx, height / 2, cz);
          body.castShadow = true;
          buildingGroup.add(body);

          // Toit à deux pans : le prisme donne la silhouette de grange.
          const ridge = new THREE.Mesh(
            new THREE.CylinderGeometry(bd * 0.62, bd * 0.62, bw * 1.06, 3, 1),
            roofMat,
          );
          ridge.rotation.z = Math.PI / 2;
          ridge.rotation.y = Math.PI / 2;
          ridge.position.set(cx, height + bd * 0.24, cz);
          ridge.castShadow = true;
          buildingGroup.add(ridge);

          if (level >= 3) {
            const chimney = new THREE.Mesh(
              new THREE.BoxGeometry(0.14, 0.34, 0.14),
              new THREE.MeshLambertMaterial({ color: 0x9a6a52, flatShading: true }),
            );
            chimney.position.set(cx + bw * 0.28, height + bd * 0.42, cz - bd * 0.2);
            buildingGroup.add(chimney);
          }
          if (level >= 4) {
            const annex = new THREE.Mesh(
              new THREE.BoxGeometry(bw * 0.34, height * 0.55, bd * 0.5),
              bodyMat,
            );
            annex.position.set(cx - bw * 0.58, height * 0.275, cz + bd * 0.16);
            annex.castShadow = true;
            buildingGroup.add(annex);
          }
          if (level >= 5) {
            const tank = new THREE.Mesh(
              new THREE.CylinderGeometry(0.2, 0.2, height * 0.9, 10),
              new THREE.MeshLambertMaterial({ color: 0xd8dde2, flatShading: true }),
            );
            tank.position.set(cx + bw * 0.56, height * 0.45, cz - bd * 0.24);
            tank.castShadow = true;
            buildingGroup.add(tank);
          }

          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(bw * 1.08, 0.12, bd * 1.08),
            roofMat,
          );
          roof.position.set(cx, height + 0.02, cz);
          buildingGroup.add(roof);
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
    const clock = new THREE.Clock();
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
      const t = clock.getElapsedTime();
      const sky = skyFor(weatherRef.current);
      scene.background = new THREE.Color(sky);
      if (scene.fog instanceof THREE.Fog) scene.fog.color.setHex(sky);
      hexGroup.rotation.y = Math.sin(t * 0.05) * 0.02;
      world.position.y = Math.sin(t * 0.7) * 0.015;

      // Idle bob / légère avance sur véhicules stationnés
      for (const vg of vehicleGroups.values()) {
        const bx = vg.userData.baseX as number;
        const by = vg.userData.baseY as number;
        const bz = vg.userData.baseZ as number;
        const ph = vg.userData.phase as number;
        vg.position.y = by + Math.sin(t * 2.1 + ph) * 0.028;
        vg.position.x = bx + Math.sin(t * 1.15 + ph) * 0.018;
        vg.position.z = bz;
        vg.rotation.y = Math.sin(t * 0.9 + ph) * 0.04;
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

      // Engin de travail : parcours simple des cases
      const workKey = aw
        ? `${aw.type}:${aw.cells.map((c) => `${c.x},${c.y}`).join("|")}`
        : "";
      if (workKey !== prevWorkKey.current) {
        prevWorkKey.current = workKey;
        clearWorkVehicle();
        if (aw && aw.cells.length) {
          workStartRef.current = t;
          workVehicle = makeVehicleMesh(aw.type);
          workGroup.add(workVehicle);
        }
      }
      if (workVehicle && aw && aw.cells.length) {
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
        workVehicle.position.set(px, 0.2 + Math.sin(t * 8) * 0.02, pz);
        workVehicle.rotation.y = Math.atan2(pb.px - pa.px, pb.pz - pa.pz) || 0;
        workVehicle.visible = u < 1;
        if (u >= 1) {
          // reste visible brièvement puis masqué jusqu’au prochain work
          workVehicle.visible = false;
        }
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
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    layoutRef.current?.();
  }, [cells, buildings, cellSims, selected, gridW, gridH]);

  return <div className="iso-viewport" ref={mountRef} aria-label="Vue isométrique de la ferme" />;
}
