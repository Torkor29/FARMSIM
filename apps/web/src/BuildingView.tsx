import { useEffect, useRef } from "react";
import * as THREE from "three";
import { BUILDING_DEFS, type BuildingType } from "@farmsim/shared";
import { createBuildingRig } from "./buildings3d";
import { attachStudioEnvironment } from "./machine-kit";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";
import { initialQuality, qualityForContext } from "./render-quality";

type Props = {
  type: BuildingType;
  level?: number;
  /** Quarts de tour, 0 à 3 */
  rotation?: number;
  height?: number;
  /** Vantaux ouverts */
  open?: boolean;
};

/**
 * Un bâtiment sur son damier, hors du jeu.
 *
 * Le damier n'est pas décoratif : il montre l'empreinte exacte que le bâtiment
 * occupe. C'est le seul endroit où l'on vérifie d'un coup d'œil qu'un modèle
 * tient dans ses cases, qu'il touche la terre, et que la rotation ne le fait
 * pas mordre sur la parcelle voisine.
 */
export function BuildingView({
  type,
  level = 1,
  rotation = 0,
  height = 260,
  open = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const def = BUILDING_DEFS[type];
    const quarters = ((rotation % 4) + 4) % 4;
    const fw = quarters % 2 === 0 ? def.w : def.h;
    const fh = quarters % 2 === 0 ? def.h : def.w;

    const scene = new THREE.Scene();
    const width = host.clientWidth || 260;
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.05, 60);

    let quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true });
    quality = qualityForContext(renderer.getContext()) ?? quality;
    renderer.setPixelRatio(Math.min(2, quality.pixelRatio));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const detachEnv = attachStudioEnvironment(renderer, scene, 0.5);
    scene.add(new THREE.HemisphereLight(0xdff0ff, 0xbfa77c, 1.05));
    const key = new THREE.DirectionalLight(0xfff1d4, 1.6);
    key.position.set(2.4, 4.2, 2.8);
    key.castShadow = quality.shadows;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8d8ff, 0.65);
    rim.position.set(-2.6, 1.8, -2.2);
    scene.add(rim);

    // Le damier : une case claire, une case sombre, exactement à la maille du
    // jeu. Un modèle qui déborde se voit sans qu'on ait à mesurer.
    const pad = 1;
    for (let x = -Math.ceil(fw / 2) - pad; x <= Math.ceil(fw / 2) + pad; x++) {
      for (let z = -Math.ceil(fh / 2) - pad; z <= Math.ceil(fh / 2) + pad; z++) {
        const inside = Math.abs(x + 0.5) <= fw / 2 && Math.abs(z + 0.5) <= fh / 2;
        const tile = new THREE.Mesh(
          new THREE.BoxGeometry(0.96, 0.06, 0.96),
          new THREE.MeshStandardMaterial({
            color: inside ? 0xb9a074 : (x + z) % 2 === 0 ? 0x9ac06a : 0x8ab35e,
            roughness: 0.95,
          }),
        );
        tile.position.set(x + 0.5, -0.03, z + 0.5);
        tile.receiveShadow = quality.shadows;
        scene.add(tile);
      }
    }

    const rig = createBuildingRig(type, { level, seed: 3.7, shadows: quality.shadows });
    rig.group.rotation.y = quarters * (Math.PI / 2);
    scene.add(rig.group);

    // Cadrage : la diagonale de l'empreinte plus la hauteur, vue de la même
    // hauteur d'œil que dans le jeu.
    const reach = Math.max(Math.hypot(fw, fh), rig.height * 1.5) * 1.25;
    camera.position.set(reach * 0.82, reach * 0.72, reach * 0.9);
    camera.lookAt(0, rig.height * 0.35, 0);

    let raf = 0;
    let lastFrame = 0;
    const start = performance.now();
    const tick = () => {
      const now = performance.now();
      const tooSoon = Boolean(lastFrame) && now - lastFrame < 1000 / Math.max(1, quality.maxFps) - 1;
      if (document.hidden || (quality.maxFps && tooSoon)) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;
      rig.update({ t: (now - start) / 1000, doorOpen: openRef.current ? 1 : 0 });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || 260;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      detachEnv();
      rig.dispose();
      disposeThreeScene(scene);
      disposeRenderer(renderer, host);
    };
  }, [type, level, rotation, height]);

  return <div className="lowpoly-char" ref={hostRef} style={{ height }} aria-hidden="true" />;
}
