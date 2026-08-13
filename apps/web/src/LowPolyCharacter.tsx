import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  defaultAppearance,
  type CharacterAppearance,
  type ClassProfile,
} from "@farmsim/shared";
import { buildCharacter } from "./character-mesh";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";
import { initialQuality, qualityForContext } from "./render-quality";

type Props = {
  code: ClassProfile["code"];
  appearance?: CharacterAppearance;
  /** Le personnage se redresse et tourne plus vite quand sa carte est choisie */
  active?: boolean;
  height?: number;
  /** Accessoire de métier (épi, veau) — onboarding seulement */
  showProp?: boolean;
};

/** Rendu 3D d'un personnage custom, sur fond transparent. */
export function LowPolyCharacter({
  code,
  appearance,
  active = false,
  height = 190,
  showProp = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const look = appearance ?? defaultAppearance(code);
  const lookKey = JSON.stringify(look);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const width = host.clientWidth || 200;
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 1.35, 4.4);
    camera.lookAt(0, 0.85, 0);

    let quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true });
    quality = qualityForContext(renderer.getContext()) ?? quality;
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.setSize(width, height, false);
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b58a, 1.5));
    const key = new THREE.DirectionalLight(0xfff4d6, 1.5);
    key.position.set(3, 6, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd9c4, 0.6);
    rim.position.set(-4, 2, -3);
    scene.add(rim);

    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.05, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: new THREE.Color("#8ec96f"), flatShading: true }),
    );
    disc.position.y = -0.06;
    scene.add(disc);

    const character = buildCharacter(look, { spec: code, prop: showProp });
    scene.add(character);

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
      const t = (now - start) / 1000;
      const speed = activeRef.current ? 0.75 : 0.28;
      character.rotation.y = t * speed;
      character.position.y = activeRef.current ? Math.sin(t * 2.2) * 0.035 : 0;
      disc.rotation.y = t * speed * 0.5;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || 200;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height, false);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      disposeThreeScene(scene);
      disposeRenderer(renderer, host);
    };
    // lookKey force un rebuild quand une pièce change.
  }, [code, height, lookKey, showProp]);

  return <div className="lowpoly-char" ref={hostRef} style={{ height }} aria-hidden="true" />;
}

