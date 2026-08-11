import { useEffect, useRef } from "react";
import * as THREE from "three";
import { BUILDING_DEFS, type BuildingType, type CropCode } from "@farmsim/shared";

export type IsoCell = {
  x: number;
  y: number;
  kind: "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";
  crop?: CropCode | null;
  fieldStage?: string;
  fertilizedPasses?: number;
};

export type IsoBuilding = {
  id: string;
  type: BuildingType;
  originX: number;
  originY: number;
};

export type IsoSim = {
  x: number;
  y: number;
  sim: { progress: number; ready: boolean };
};

type Props = {
  gridW: number;
  gridH: number;
  cells: IsoCell[];
  buildings: IsoBuilding[];
  cellSims: IsoSim[];
  selected: { x: number; y: number }[];
  onCellClick: (x: number, y: number) => void;
};

const SOIL = 0x5a7a42;
const SOIL_DARK = 0x4a6436;
const GROW = 0x6f9a45;
const READY = 0xd4a84b;
const SELECT = 0x4ade80;
const DIRT = 0x6b5238;

function cropColor(c: IsoCell, sim?: IsoSim): number {
  if (c.kind !== "CROP") return SOIL;
  if (c.fieldStage === "READY" || sim?.sim.ready) return READY;
  const p = sim?.sim.progress ?? 0.3;
  const g = new THREE.Color(GROW);
  const r = new THREE.Color(READY);
  return g.lerp(r, Math.min(1, p)).getHex();
}

function buildingPalette(type: BuildingType): { body: number; roof: number; h: number } {
  switch (type) {
    case "SILO":
      return { body: 0xb8c0c8, roof: 0x8a939c, h: 2.4 };
    case "HAY_BARN":
      return { body: 0x8b6914, roof: 0x5c4030, h: 1.2 };
    case "MACHINE_SHED":
      return { body: 0x7a5c3a, roof: 0x3d4a3a, h: 1.35 };
    case "CATTLE_BARN":
      return { body: 0x8a5a3a, roof: 0xa84828, h: 1.5 };
    case "PIGSTY":
      return { body: 0x9a6a4a, roof: 0x6a4030, h: 1.1 };
    case "WORKSHOP":
      return { body: 0x6a6a6a, roof: 0x444444, h: 1.2 };
    case "FARMHOUSE":
      return { body: 0xe8dcc8, roof: 0xb84828, h: 1.6 };
    default:
      return { body: 0x888888, roof: 0x555555, h: 1 };
  }
}

export function IsoFarmView({
  gridW,
  gridH,
  cells,
  buildings,
  cellSims,
  selected,
  onCellClick,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onClickRef = useRef(onCellClick);
  onClickRef.current = onCellClick;
  const layoutRef = useRef<(() => void) | null>(null);

  const dataRef = useRef({ cells, buildings, cellSims, selected, gridW, gridH });
  dataRef.current = { cells, buildings, cellSims, selected, gridW, gridH };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const el = mount;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a2430);
    scene.fog = new THREE.Fog(0x1a2430, 28, 55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    el.appendChild(renderer.domElement);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(18, 16, 18);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xfff4e0, 0.55);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffe8c8, 1.05);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    scene.add(sun);

    // Hex-ish ground map (stylized France backdrop)
    const hexGroup = new THREE.Group();
    hexGroup.position.y = -0.35;
    const hexMat = new THREE.MeshLambertMaterial({ color: 0x2d4a38, flatShading: true });
    const hexEdge = new THREE.MeshLambertMaterial({ color: 0x3a5c48, flatShading: true });
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
    const buildingGroup = new THREE.Group();
    world.add(buildingGroup);

    const platformMat = new THREE.MeshLambertMaterial({ color: 0x4a3828, flatShading: true });
    const platform = new THREE.Mesh(new THREE.BoxGeometry(1, 0.45, 1), platformMat);
    platform.receiveShadow = true;
    platform.castShadow = true;
    world.add(platform);

    const hedgeMat = new THREE.MeshLambertMaterial({ color: 0x3d6b3a, flatShading: true });
    const fenceGroup = new THREE.Group();
    world.add(fenceGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pickables: THREE.Object3D[] = [];

    function key(x: number, y: number) {
      return `${x},${y}`;
    }

    function layout() {
      const { gridW: gw, gridH: gh, cells: cs, buildings: bs, cellSims: sims, selected: sel } =
        dataRef.current;

      // clear dynamic
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
      while (buildingGroup.children.length) {
        const c = buildingGroup.children[0];
        buildingGroup.remove(c);
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else (c.material as THREE.Material).dispose();
        }
      }
      while (fenceGroup.children.length) {
        const c = fenceGroup.children[0];
        fenceGroup.remove(c);
      }
      pickables.length = 0;

      const cellSize = 1;
      const gap = 0.06;
      const step = cellSize + gap;
      const ox = -((gw - 1) * step) / 2;
      const oz = -((gh - 1) * step) / 2;

      platform.scale.set(gw * step + 1.4, 1, gh * step + 1.4);
      platform.position.set(0, -0.28, 0);

      // hedges
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
      // corner trees
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
          const px = ox + x * step;
          const pz = oz + y * step;

          let col = (x + y) % 2 === 0 ? SOIL : SOIL_DARK;
          if (cell?.kind === "CROP") col = cropColor(cell, sim);
          if (cell?.kind === "BUILDING") col = DIRT;
          if (cell?.kind === "VEHICLE") col = 0x3a3f44;

          const mat = new THREE.MeshLambertMaterial({
            color: isSel ? SELECT : col,
            flatShading: true,
          });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 0.18, cellSize), mat);
          mesh.position.set(px, 0, pz);
          mesh.receiveShadow = true;
          mesh.userData = { x, y };
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
            const body = new THREE.Mesh(
              new THREE.BoxGeometry(0.55, 0.28, 0.35),
              new THREE.MeshLambertMaterial({ color: 0x3d8f3a, flatShading: true }),
            );
            body.position.set(px, 0.28, pz);
            body.castShadow = true;
            world.add(body);
            cropMeshes.set(key(x, y) + ":v", body);
          }
        }
      }

      for (const b of bs) {
        const def = BUILDING_DEFS[b.type];
        const pal = buildingPalette(b.type);
        const cx = ox + (b.originX + (def.w - 1) / 2) * step;
        const cz = oz + (b.originY + (def.h - 1) / 2) * step;
        const bw = def.w * step - gap;
        const bd = def.h * step - gap;

        if (b.type === "SILO") {
          const cyl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.45, 0.5, pal.h, 8),
            new THREE.MeshLambertMaterial({ color: pal.body, flatShading: true }),
          );
          cyl.position.set(cx, pal.h / 2, cz);
          cyl.castShadow = true;
          buildingGroup.add(cyl);
          const cap = new THREE.Mesh(
            new THREE.ConeGeometry(0.52, 0.35, 8),
            new THREE.MeshLambertMaterial({ color: pal.roof, flatShading: true }),
          );
          cap.position.set(cx, pal.h + 0.15, cz);
          buildingGroup.add(cap);
        } else {
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(bw, pal.h, bd),
            new THREE.MeshLambertMaterial({ color: pal.body, flatShading: true }),
          );
          body.position.set(cx, pal.h / 2, cz);
          body.castShadow = true;
          buildingGroup.add(body);
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(bw * 1.08, 0.18, bd * 1.08),
            new THREE.MeshLambertMaterial({ color: pal.roof, flatShading: true }),
          );
          roof.position.set(cx, pal.h + 0.05, cz);
          roof.rotation.z = 0.08;
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

    function onPointer(ev: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);
      if (hits[0]?.object.userData) {
        const { x, y } = hits[0].object.userData as { x: number; y: number };
        onClickRef.current(x, y);
      }
    }
    renderer.domElement.addEventListener("pointerdown", onPointer);

    let raf = 0;
    const clock = new THREE.Clock();
    function tick() {
      raf = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();
      hexGroup.rotation.y = Math.sin(t * 0.05) * 0.02;
      world.position.y = Math.sin(t * 0.7) * 0.015;
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
      renderer.dispose();
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    layoutRef.current?.();
  }, [cells, buildings, cellSims, selected, gridW, gridH]);

  return <div className="iso-viewport" ref={mountRef} aria-label="Vue isométrique de la ferme" />;
}
