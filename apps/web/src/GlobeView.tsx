import { useEffect, useRef } from "react";
import * as THREE from "three";

export type GlobeContinent = {
  code: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
  accent: string;
  parcelFree: number;
  parcelTotal: number;
};

type Props = {
  continents: GlobeContinent[];
  selected?: string | null;
  onSelect?: (code: string) => void;
  /** Vue focalisée : le globe cesse de tourner et zoome sur la sélection */
  focus?: boolean;
  height?: number;
};

const R = 2;

function latLonToVec3(lat: number, lon: number, radius = R): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/** Générateur pseudo-aléatoire déterministe : même monde à chaque visite. */
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function hashCode(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Un continent = une grappe de tuiles hexagonales posées sur la sphère.
 * L'ensemble donne la silhouette irrégulière d'une vraie masse continentale
 * tout en restant franchement low-poly.
 */
function buildLandmass(c: GlobeContinent): THREE.Group {
  const group = new THREE.Group();
  group.userData.continentCode = c.code;

  const rand = seededRandom(hashCode(c.code));
  const tileGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.09, 6);
  const base = new THREE.MeshLambertMaterial({
    color: new THREE.Color(c.color),
    flatShading: true,
  });
  const high = new THREE.MeshLambertMaterial({
    color: new THREE.Color(c.accent),
    flatShading: true,
  });

  const spreadLat = 16 + rand() * 8;
  const spreadLon = 20 + rand() * 12;
  const tiles = 26 + Math.floor(rand() * 10);

  for (let i = 0; i < tiles; i++) {
    // Distribution elliptique décroissante : dense au centre, effilochée aux bords.
    const a = rand() * Math.PI * 2;
    const r = Math.pow(rand(), 0.62);
    const dLat = Math.cos(a) * r * spreadLat;
    const dLon = Math.sin(a) * r * spreadLon;
    const lat = Math.max(-78, Math.min(78, c.lat + dLat));
    const lon = c.lon + dLon;

    const relief = rand() > 0.78;
    const tile = new THREE.Mesh(tileGeo, relief ? high : base);
    const pos = latLonToVec3(lat, lon, R + (relief ? 0.055 : 0.03));
    tile.position.copy(pos);
    tile.lookAt(0, 0, 0);
    tile.rotateX(Math.PI / 2);
    tile.rotation.y += rand() * Math.PI;
    tile.scale.setScalar(0.75 + rand() * 0.6);
    group.add(tile);
  }
  return group;
}

/** Globe interactif : sélection de continent avant l'installation. */
export function GlobeView({
  continents,
  selected = null,
  onSelect,
  focus = false,
  height = 380,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ selected, focus, onSelect });
  stateRef.current = { selected, focus, onSelect };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const width = host.clientWidth || 480;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 1.1, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(width, height, false);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x88aacc, 1.35));
    const sun = new THREE.DirectionalLight(0xfff3d0, 1.7);
    sun.position.set(5, 4, 6);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9ecfe8, 0.55);
    fill.position.set(-6, -2, -4);
    scene.add(fill);

    const world = new THREE.Group();
    scene.add(world);

    const ocean = new THREE.Mesh(
      new THREE.IcosahedronGeometry(R, 3),
      new THREE.MeshLambertMaterial({ color: 0x3f8fc4, flatShading: true }),
    );
    world.add(ocean);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.13, 24, 18),
      new THREE.MeshBasicMaterial({
        color: 0x9fd8f5,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
      }),
    );
    world.add(halo);

    const landByCode = new Map<string, THREE.Group>();
    const markerByCode = new Map<string, THREE.Mesh>();

    for (const c of continents) {
      const land = buildLandmass(c);
      world.add(land);
      landByCode.set(c.code, land);

      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.34, 6),
        new THREE.MeshLambertMaterial({
          color: c.parcelFree > 0 ? 0xf0d27a : 0xb0a89c,
          flatShading: true,
        }),
      );
      const p = latLonToVec3(c.lat, c.lon, R + 0.34);
      marker.position.copy(p);
      marker.lookAt(0, 0, 0);
      marker.rotateX(-Math.PI / 2);
      marker.userData.continentCode = c.code;
      world.add(marker);
      markerByCode.set(c.code, marker);
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: string | null = null;
    let dragging = false;
    let dragMoved = false;
    let lastX = 0;
    let spin = 0;
    let manualSpin = 0;

    function pick(ev: PointerEvent): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(world.children, true);
      for (const hit of hits) {
        let o: THREE.Object3D | null = hit.object;
        while (o) {
          const code = o.userData?.continentCode as string | undefined;
          if (code) return code;
          o = o.parent;
        }
      }
      return null;
    }

    const onPointerDown = (ev: PointerEvent) => {
      dragging = true;
      dragMoved = false;
      lastX = ev.clientX;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (dragging) {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        if (Math.abs(dx) > 1) dragMoved = true;
        manualSpin += dx * 0.005;
        return;
      }
      const code = pick(ev);
      if (code !== hovered) {
        hovered = code;
        renderer.domElement.style.cursor = code ? "pointer" : "grab";
      }
    };
    const onPointerUp = (ev: PointerEvent) => {
      const wasDrag = dragMoved;
      dragging = false;
      dragMoved = false;
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {
        /* pointer déjà relâché */
      }
      if (wasDrag) return;
      const code = pick(ev);
      if (code) stateRef.current.onSelect?.(code);
    };

    renderer.domElement.style.cursor = "grab";
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", () => {
      dragging = false;
    });

    let raf = 0;
    let camZ = 7.2;
    const tick = () => {
      const { selected: sel, focus: foc } = stateRef.current;
      if (!dragging && !foc) spin += 0.0016;
      world.rotation.y = spin + manualSpin;

      // Amener le continent choisi face à la caméra, en douceur.
      if (sel) {
        const c = continents.find((x) => x.code === sel);
        if (c) {
          const target = -((c.lon + 180) * Math.PI) / 180 - Math.PI / 2;
          const current = world.rotation.y;
          const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
          const step = delta * 0.06;
          spin += step;
          world.rotation.y = spin + manualSpin;
        }
      }

      const wantZ = foc ? 5.1 : 7.2;
      camZ += (wantZ - camZ) * 0.06;
      camera.position.z = camZ;
      camera.lookAt(0, 0, 0);

      for (const [code, marker] of markerByCode) {
        const isSel = code === sel;
        const isHover = code === hovered;
        const s = isSel ? 1.5 : isHover ? 1.25 : 1;
        marker.scale.lerp(new THREE.Vector3(s, s, s), 0.15);
        marker.position.setLength(R + 0.34 + (isSel ? 0.12 : 0));
      }
      for (const [code, land] of landByCode) {
        const lift = code === stateRef.current.selected ? 1.035 : 1;
        land.scale.lerp(new THREE.Vector3(lift, lift, lift), 0.12);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || 480;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose());
          else m.dispose();
        }
      });
      host.removeChild(renderer.domElement);
    };
  }, [continents, height]);

  return <div className="globe-host" ref={hostRef} style={{ height }} />;
}
