import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  TIER_SCALE_MAX,
  machineTierScale,
  type CatalogMachine,
  type MachineType,
  type MachineTier,
} from "@farmsim/shared";
import { attachStudioEnvironment } from "./machine-kit";
import { isoOrthoFrustum } from "./machine-framing";
import { createDustTrail, createMachineRig, isTowedImplement } from "./machines3d";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";

type Props = {
  type: MachineType;
  /**
   * Hauteur du rendu, en pixels. Omise, c'est la feuille de style qui
   * décide — ce que fait la fiche d'engin, dont la vignette rétrécit sur un
   * écran court pour laisser voir les chiffres.
   */
  height?: number;
  /** Engin au travail : outil posé, gyrophare, poussière */
  working?: boolean;
  /** Vitesse d'avance simulée, unités monde par seconde */
  speed?: number;
  /** Outil traîné présenté attelé derrière son tracteur */
  towed?: boolean;
  /** Tour de plateau : l'engin pivote pour se montrer sous toutes ses faces */
  turntable?: boolean;
  /** Palier catalogue : un T5 n’est pas un T1 agrandi. */
  tier?: MachineTier;
};

/**
 * Vitrine d'un engin : plateau tournant, éclairage de la charte, sol neutre.
 *
 * Sert la page atelier (`/machines.html`) et peut être posée telle quelle
 * dans le garage ou le catalogue à la place de l'illustration 2D.
 */
export function MachineView3D({
  type,
  height,
  working = false,
  speed = 1.6,
  towed = false,
  turntable = true,
  tier = 1,
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

    const rig = createMachineRig(type, { towed: towed && isTowedImplement(type), seed: 3, tier });
    turn.add(rig.group);
    rig.group.updateMatrixWorld(true);

    // Caméra isométrique, comme la vue ferme. Le cadrage se calcule sur la
    // silhouette projetée (pas un frustum centré sur l'origine) : sinon la
    // trémie, plus loin en iso, colle au plafond de la vignette.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    const box = new THREE.Box3().setFromObject(rig.group);
    // Le socle descend un peu sous les roues : sans lui, le centre optique
    // remonte et tout l'air se retrouve sous l'engin.
    box.min.y = Math.min(box.min.y, -0.16);

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
      const h = Math.max(1, host.clientHeight || height || 240);
      renderer.setSize(w, h, false);
      const aspect = w / h;
      /*
       * La stature du palier, rapportée au T5.
       *
       * Sans elle, la vignette cadrait sur la boîte de l'engin : la caméra
       * reculait d'autant qu'il était gros, et un T5 occupait exactement la
       * même place qu'un T1. On divise par le maximum pour que le T5 remplisse
       * le cadre comme avant — c'est lui la référence — et que les paliers
       * inférieurs s'y mesurent.
       */
      const stature = machineTierScale(type as CatalogMachine, tier) / TIER_SCALE_MAX;
      const fit = isoOrthoFrustum(box, aspect, 1.5, stature);
      camera.position.set(9, 7.35 + fit.lookAtY, 9);
      camera.lookAt(0, fit.lookAtY, 0);
      camera.left = fit.left;
      camera.right = fit.right;
      camera.top = fit.top;
      camera.bottom = fit.bottom;
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
  }, [type, height, towed, tier]);

  // Pas de hauteur en dur quand l'appelant n'en donne pas : un style en
  // ligne l'emporterait sur la feuille de style, et la vignette reprendrait
  // la place qu'on venait de lui retirer sur écran court. Le
  // `ResizeObserver` déjà en place recadre la caméra quand le conteneur
  // change de taille.
  return (
    <div
      className="machine-view3d"
      ref={hostRef}
      style={height ? { height } : undefined}
      aria-hidden="true"
    />
  );
}
