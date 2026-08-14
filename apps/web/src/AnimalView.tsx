import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createAnimalRig, type AnimalKind, type AnimalLook } from "./animal-meshes";
import { attachStudioEnvironment } from "./machine-kit";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";
import { initialQuality, qualityForContext } from "./render-quality";

type Props = {
  kind: AnimalKind;
  look?: AnimalLook;
  height?: number;
  /** Elle broute au lieu de regarder devant elle */
  grazing?: boolean;
  /** Elle marche : la foulée avance avec la distance, pas avec le temps */
  walking?: boolean;
  /** Elle est couchée */
  resting?: boolean;
};

/**
 * Une bête sur son plateau, hors du champ.
 *
 * Même éclairage que le plateau des personnages : environnement de studio,
 * clé chaude, contre-jour froid qui détache la silhouette. C'est le seul
 * endroit où l'on juge un poil et un port de tête sans que la parcelle et
 * l'étable viennent brouiller la lecture.
 */
export function AnimalView({
  kind,
  look,
  height = 260,
  grazing = false,
  walking = false,
  resting = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const lookKey = JSON.stringify(look ?? {});
  const state = useRef({ grazing, walking, resting });
  state.current = { grazing, walking, resting };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const width = host.clientWidth || 240;
    const camera = new THREE.PerspectiveCamera(32, width / height, 0.05, 60);

    let quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true });
    quality = qualityForContext(renderer.getContext()) ?? quality;
    renderer.setPixelRatio(Math.min(2, quality.pixelRatio));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);

    const detachEnv = attachStudioEnvironment(renderer, scene, 0.5);
    scene.add(new THREE.HemisphereLight(0xdff0ff, 0xbfa77c, 0.9));
    const key = new THREE.DirectionalLight(0xfff1d4, 1.6);
    key.position.set(1.4, 2.4, 1.8);
    key.castShadow = quality.shadows;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.top = 0.8;
    key.shadow.camera.bottom = -0.2;
    key.shadow.camera.left = -0.8;
    key.shadow.camera.right = 0.8;
    key.shadow.bias = -0.0012;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xa8d8ff, 0.85);
    rim.position.set(-1.8, 1.2, -1.6);
    scene.add(rim);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.66, 0.04, 40),
      new THREE.MeshStandardMaterial({ color: 0xcfe3c6, roughness: 0.94, metalness: 0 }),
    );
    disc.position.y = -0.02;
    disc.receiveShadow = quality.shadows;
    scene.add(disc);

    const rig = createAnimalRig(kind, look, { shadows: quality.shadows });
    scene.add(rig.group);

    // Le cadre suit la taille de la bête : une poule et une vache ne
    // demandent pas le même recul.
    const box = new THREE.Box3().setFromObject(rig.group);
    const span = Math.max(box.max.z - box.min.z, rig.height * 1.6);
    const place = () => {
      const aspect = camera.aspect;
      const pull = aspect < 1 ? 1 / Math.max(0.5, aspect) : 1;
      const distance = (span / 2 / Math.tan((32 * Math.PI) / 360)) * pull * 1.35;
      camera.position.set(distance * 0.62, rig.height * 1.15, distance * 0.72);
      camera.lookAt(0, rig.height * 0.5, 0);
    };
    place();

    let raf = 0;
    let lastFrame = 0;
    let distance = 0;
    const start = performance.now();
    const tick = () => {
      const now = performance.now();
      const tooSoon = Boolean(lastFrame) && now - lastFrame < 1000 / Math.max(1, quality.maxFps) - 1;
      if (document.hidden || (quality.maxFps && tooSoon)) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      const t = (now - start) / 1000;
      const s = state.current;
      // La bête avance sur place : c'est la distance qui règle la foulée.
      if (s.walking) distance += dt * 0.6;
      rig.group.rotation.y = Math.sin(t * 0.12) * 0.5 + 0.4;
      rig.update({
        t,
        distance,
        walking: s.walking,
        graze: s.grazing ? 1 : 0,
        resting: s.resting,
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || 240;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height, false);
      place();
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
  }, [kind, height, lookKey]);

  return <div className="lowpoly-char" ref={hostRef} style={{ height }} aria-hidden="true" />;
}
