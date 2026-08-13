import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { MachineType } from "@farmsim/shared";
import { attachStudioEnvironment } from "./machine-kit";
import { createDustTrail, createMachineRig, isTowedImplement } from "./machines3d";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";

type Props = {
  type: MachineType;
  /** Hauteur du rendu, en pixels */
  height?: number;
  /** Engin au travail : outil posé, gyrophare, poussière */
  working?: boolean;
  /** Vitesse d'avance simulée, unités monde par seconde */
  speed?: number;
  /** Outil traîné présenté attelé derrière son tracteur */
  towed?: boolean;
  /** Tour de plateau : l'engin pivote pour se montrer sous toutes ses faces */
  turntable?: boolean;
};

/**
 * Vitrine d'un engin : plateau tournant, éclairage de la charte, sol neutre.
 *
 * Sert la page atelier (`/machines.html`) et peut être posée telle quelle
 * dans le garage ou le catalogue à la place de l'illustration 2D.
 */
export function MachineView3D({
  type,
  height = 240,
  working = false,
  speed = 1.6,
  towed = false,
  turntable = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const liveRef = useRef({ working, speed, turntable });
  liveRef.current = { working, speed, turntable };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xcfeafb);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.94;
    host.appendChild(renderer.domElement);

    // Le modèle détaillé vit de ses reflets : sans environnement, la peinture
    // métallisée, le chrome et le verre rendent comme de la peinture mate.
    const releaseEnvironment = attachStudioEnvironment(renderer, scene);

    // Caméra isométrique, comme la vue ferme : un engin doit être jugé sous
    // l'angle où il sera vu en jeu.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    camera.position.set(9, 7.35, 9);
    camera.lookAt(0, 0.35, 0);

    scene.add(new THREE.HemisphereLight(0xdff0ff, 0xc8b48a, 0.6));
    scene.add(new THREE.AmbientLight(0xfff6e6, 0.12));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.7);
    sun.position.set(6, 9, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -3;
    sun.shadow.camera.right = 3;
    sun.shadow.camera.top = 3;
    sun.shadow.camera.bottom = -3;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xbfe0ff, 0.3);
    rim.position.set(-6, 4, -7);
    scene.add(rim);

    const turn = new THREE.Group();
    scene.add(turn);

    const rig = createMachineRig(type, { towed: towed && isTowedImplement(type), seed: 3 });
    turn.add(rig.group);

    // Le socle suit la taille de l'engin : un attelage de deux mètres ne se
    // juge pas sur la même motte de terre qu'un tracteur seul.
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(rig.length * 0.82, rig.length * 0.82, 0.16, 10),
      new THREE.MeshLambertMaterial({ color: 0x9ac169, flatShading: true }),
    );
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    scene.add(ground);

    const dust = createDustTrail(8);
    turn.add(dust.object);

    let raf = 0;
    let distance = 0;
    const clock = new THREE.Clock();

    const resize = () => {
      const w = host.clientWidth || 320;
      const h = height;
      renderer.setSize(w, h, false);
      // Cadrage serré : l'engin remplit la vignette quelle que soit sa taille.
      const frustum = rig.length * 0.62 + 0.3;
      const aspect = w / h;
      camera.left = -frustum * aspect;
      camera.right = frustum * aspect;
      camera.top = frustum;
      camera.bottom = -frustum;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, clock.getDelta());
      const t = clock.getElapsedTime();
      const live = liveRef.current;
      // Au travail l'engin avance : les roues, les disques et le rabatteur
      // en découlent. À l'arrêt, tout se fige — sauf le plateau.
      const advance = live.working ? live.speed : 0;
      distance += advance * dt;
      rig.update({
        t,
        distance,
        working: live.working,
        steer: Math.sin(t * 0.6) * 0.35,
        unloading: live.working && Math.sin(t * 0.22) > 0.4,
      });
      dust.update(dt, -rig.length * 0.42, 0.12, 0, live.working);
      if (live.turntable) turn.rotation.y = t * 0.35;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      rig.dispose();
      dust.dispose();
      releaseEnvironment();
      disposeThreeScene(scene);
      disposeRenderer(renderer, host);
    };
  }, [type, height, towed]);

  return <div className="machine-view3d" ref={hostRef} style={{ height }} aria-hidden="true" />;
}
