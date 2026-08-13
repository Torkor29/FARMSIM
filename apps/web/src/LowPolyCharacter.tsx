import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  defaultAppearance,
  type CharacterAppearance,
  type ClassProfile,
} from "@farmsim/shared";
import { createCharacterRig } from "./character-mesh";
import { attachStudioEnvironment } from "./machine-kit";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";
import { initialQuality, qualityForContext } from "./render-quality";

type Props = {
  code: ClassProfile["code"];
  appearance?: CharacterAppearance;
  /** Le personnage se redresse, salue et se présente quand sa carte est choisie */
  active?: boolean;
  height?: number;
  /** Accessoire de métier (épi, veau) — onboarding seulement */
  showProp?: boolean;
  /** Le visiteur peut faire tourner le personnage à la souris ou au doigt */
  draggable?: boolean;
  /** `bust` cadre sur le visage : c'est ce qu'on veut en réglant les yeux */
  frame?: "full" | "bust";
};

/**
 * Le personnage sur son plateau.
 *
 * Un modèle 3D ne vaut que par la lumière qui l'éclaire : environnement de
 * studio pour la réflexion diffuse, clé chaude d'après-midi, contre-jour froid
 * qui détache la silhouette du fond, et une ombre portée sur le plateau — sans
 * elle, le bonhomme flotte.
 */
export function LowPolyCharacter({
  code,
  appearance,
  active = false,
  height = 190,
  showProp = true,
  draggable = false,
  frame = "full",
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
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 100);

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
    key.position.set(2.6, 4.2, 3.4);
    key.castShadow = quality.shadows;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.top = 1.4;
    key.shadow.camera.bottom = -0.4;
    key.shadow.camera.left = -1.2;
    key.shadow.camera.right = 1.2;
    key.shadow.bias = -0.0012;
    scene.add(key);
    // Contre-jour froid : c'est lui qui dessine le contour de l'épaule et du
    // chapeau sur le fond clair.
    const rim = new THREE.DirectionalLight(0xa8d8ff, 0.85);
    rim.position.set(-3.2, 2.4, -2.8);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe8c8, 0.35);
    fill.position.set(-1.5, 0.6, 2.6);
    scene.add(fill);

    // Plateau : un disque mat qui reçoit l'ombre, avec un liseré doré.
    const stage = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.92, 0.98, 0.06, 48),
      new THREE.MeshStandardMaterial({ color: 0xcfe3c6, roughness: 0.94, metalness: 0 }),
    );
    disc.position.y = -0.03;
    disc.receiveShadow = quality.shadows;
    stage.add(disc);
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(0.94, 0.016, 8, 56),
      new THREE.MeshStandardMaterial({ color: 0xd6b551, roughness: 0.34, metalness: 0.7 }),
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.002;
    stage.add(lip);
    scene.add(stage);

    const rig = createCharacterRig(look, {
      spec: code,
      prop: showProp,
      shadows: quality.shadows,
    });
    scene.add(rig.group);

    // Le cadre suit la taille réelle du personnage : une casquette et un
    // chapeau de cowboy n'occupent pas la même hauteur. En cadrage buste, on
    // ne garde que la tête et les épaules — la hauteur utile est alors la
    // distance du menton au sommet du chapeau.
    const full = Math.max(1.72, rig.height) + 0.06;
    const framed = frame === "bust" ? Math.max(0.52, rig.height - 1.24) : full;
    const aimY = frame === "bust" ? rig.height - framed * 0.46 : framed * 0.54;
    // L'accessoire est planté à côté du personnage : sans recul ni décentrage,
    // l'épi et le veau sortent du cadre par la droite.
    const wide = showProp && frame === "full";
    const aimX = wide ? 0.16 : 0;
    const place = () => {
      // L'ouverture est verticale : sur une vignette plus haute que large, il
      // faut reculer d'autant, sinon les épaules sortent du cadre.
      const aspect = camera.aspect;
      const pull = aspect < 1 ? 1 / Math.max(0.5, aspect) : 1;
      const distance = (framed / 2 / Math.tan((30 * Math.PI) / 360)) * pull * (wide ? 1.12 : 1);
      camera.position.set(aimX + distance * 0.3, aimY + framed * 0.1, distance * 0.95);
      camera.lookAt(aimX, aimY, 0);
    };
    place();

    /** Rotation du plateau : entraînée au doigt, sinon libre. */
    let spin = -0.35;
    let spinVel = 0;
    let dragging = false;
    let lastX = 0;
    let moved = false;

    const onDown = (ev: PointerEvent) => {
      if (!draggable) return;
      dragging = true;
      moved = false;
      lastX = ev.clientX;
      renderer.domElement.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent) => {
      if (!dragging) return;
      const dx = ev.clientX - lastX;
      lastX = ev.clientX;
      if (Math.abs(dx) > 1) moved = true;
      spin += dx * 0.012;
      spinVel = dx * 0.012;
    };
    const onUp = (ev: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.releasePointerCapture(ev.pointerId);
      if (!moved) spinVel = 0;
    };
    if (draggable) {
      renderer.domElement.addEventListener("pointerdown", onDown);
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerup", onUp);
      renderer.domElement.addEventListener("pointercancel", onUp);
      renderer.domElement.style.touchAction = "pan-y";
      renderer.domElement.style.cursor = "grab";
    }

    let raf = 0;
    let lastFrame = 0;
    const start = performance.now();
    /** Le salut est joué une fois à l'apparition, puis à chaque sélection. */
    let greetAt = 0.4;
    let wasActive = activeRef.current;

    const tick = () => {
      const now = performance.now();
      const tooSoon = Boolean(lastFrame) && now - lastFrame < 1000 / Math.max(1, quality.maxFps) - 1;
      if (document.hidden || (quality.maxFps && tooSoon)) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;
      const t = (now - start) / 1000;

      if (activeRef.current && !wasActive) greetAt = t + 0.15;
      wasActive = activeRef.current;

      if (!dragging) {
        // Une fois lâché, le plateau finit sa course puis reprend sa dérive.
        spinVel *= 0.93;
        spin += spinVel + (activeRef.current ? 0.0042 : 0.0016);
      }
      rig.group.rotation.y = spin;
      stage.rotation.y = spin * 0.35;

      // Salut : une seconde de main levée, montée et descente amorties par le
      // rig lui-même.
      const since = t - greetAt;
      const wave = since > 0 && since < 1.5 ? 1 : 0;

      rig.update({
        t,
        distance: 0,
        walking: false,
        wave,
        // Le personnage cherche le regard du visiteur : il se tourne un peu
        // vers la caméra quel que soit l'angle du plateau.
        look: THREE.MathUtils.clamp(-spin * 0.35, -0.5, 0.5),
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const w = host.clientWidth || 200;
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
      if (draggable) {
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("pointerup", onUp);
        renderer.domElement.removeEventListener("pointercancel", onUp);
      }
      rig.dispose();
      disposeThreeScene(scene);
      disposeRenderer(renderer, host);
    };
    // lookKey force un rebuild quand une pièce change.
  }, [code, height, lookKey, showProp, draggable, frame]);

  return <div className="lowpoly-char" ref={hostRef} style={{ height }} aria-hidden="true" />;
}
