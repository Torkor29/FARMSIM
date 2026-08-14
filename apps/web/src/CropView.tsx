import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createCropField } from "./crop-field";
import { type CropShape } from "./crop-shapes";
import { attachStudioEnvironment } from "./machine-kit";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";
import { initialQuality, qualityForContext } from "./render-quality";

/** Teinte de la case, comme au champ à maturité. */
const READY_COLOR: Record<CropShape, number> = {
  WHEAT: 0xe8c65e,
  BARLEY: 0xe6d27a,
  MAIZE: 0xd9c65a,
  PEA: 0xc6d45a,
  RAPE: 0x9fc24a,
  GRASS: 0x5aad42,
};

type Props = {
  shape: CropShape;
  /** Maturité, 0 = en herbe, 1 = épi formé */
  ripe?: number;
  /** Peuplement, 0 = case affamée, 1 = case bien menée */
  density?: number;
  /** Affaissement de sur-maturité */
  droop?: number;
  height?: number;
  /** Force du vent, 0 à 1 */
  wind?: number;
};

/**
 * Une poignée de brins en gros plan, hors du champ.
 *
 * C'est le seul endroit où l'on juge le dessin d'un épi et la houle du vent :
 * dans la parcelle, un brin fait dix pixels. La touffe utilise le vrai champ,
 * nuancier compris — ce qu'on voit ici est exactement ce qui poussera.
 */
export function CropView({
  shape,
  ripe = 1,
  density = 1,
  droop = 0,
  height = 300,
  wind = 0.6,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const width = host.clientWidth || 260;
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.05, 40);

    let quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true });
    quality = qualityForContext(renderer.getContext()) ?? quality;
    renderer.setPixelRatio(Math.min(2, quality.pixelRatio));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    host.appendChild(renderer.domElement);

    const detachEnv = attachStudioEnvironment(renderer, scene, 0.45);
    scene.add(new THREE.HemisphereLight(0xdff0ff, 0xbfa77c, 1.1));
    const key = new THREE.DirectionalLight(0xfff1d4, 1.5);
    key.position.set(1.2, 2.2, 1.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8d8ff, 0.7);
    rim.position.set(-1.6, 1.1, -1.4);
    scene.add(rim);

    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 36),
      new THREE.MeshStandardMaterial({ color: 0x9a7d55, roughness: 0.98, metalness: 0 }),
    );
    soil.rotation.x = -Math.PI / 2;
    scene.add(soil);

    // Une seule case, semée dru : de quoi juger la masse autant que le brin.
    const field = createCropField(4);
    // Touffe serrée, vue de loin : on juge la plante entière, pas l'intérieur
    // du champ. Une case pleine grandeur mettait la caméra au milieu des
    // tiges.
    field.setCells(
      [{ x: 0, y: 0, px: 0, pz: 0, height: 0.62, color: READY_COLOR[shape], shape, ripe, density, droop }],
      0.42,
    );
    scene.add(field.object);

    camera.position.set(0.98, 0.82, 1.58);
    camera.lookAt(0, 0.36, 0);

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
      field.update((now - start) / 1000, wind);
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
      field.dispose();
      disposeThreeScene(scene);
      disposeRenderer(renderer, host);
    };
  }, [shape, ripe, density, droop, height, wind]);

  return <div className="lowpoly-char" ref={hostRef} style={{ height }} aria-hidden="true" />;
}
