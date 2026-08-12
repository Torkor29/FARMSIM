import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CLASS_PROFILES, type ClassProfile } from "@farmsim/shared";
import { disposeRenderer, disposeThreeScene } from "./three-cleanup";
import { initialQuality } from "./render-quality";

type Props = {
  code: ClassProfile["code"];
  /** Le personnage se redresse et tourne plus vite quand sa carte est choisie */
  active?: boolean;
  height?: number;
};

const FLAT = (color: number | string) =>
  new THREE.MeshLambertMaterial({ color: new THREE.Color(color), flatShading: true });

function box(w: number, h: number, d: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

/** Corps commun aux trois métiers : le détail vient de l'accessoire. */
function buildFarmer(profile: ClassProfile): THREE.Group {
  const g = new THREE.Group();
  const skin = FLAT(profile.palette.skin);
  const cloth = FLAT(profile.palette.cloth);
  const accent = FLAT(profile.palette.accent);
  const prop = FLAT(profile.palette.prop);
  const boot = FLAT("#3b2b1e");

  const legL = box(0.22, 0.52, 0.24, cloth);
  legL.position.set(-0.14, 0.26, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);

  const bootL = box(0.26, 0.14, 0.32, boot);
  bootL.position.set(-0.14, 0.07, 0.04);
  const bootR = bootL.clone();
  bootR.position.x = 0.14;
  g.add(bootL, bootR);

  const torso = box(0.52, 0.58, 0.3, cloth);
  torso.position.y = 0.81;
  g.add(torso);

  const bib = box(0.3, 0.34, 0.32, accent);
  bib.position.set(0, 0.86, 0.01);
  g.add(bib);

  const armL = box(0.14, 0.46, 0.16, cloth);
  armL.position.set(-0.33, 0.82, 0);
  armL.rotation.z = 0.12;
  const armR = armL.clone();
  armR.position.x = 0.33;
  armR.rotation.z = -0.12;
  g.add(armL, armR);

  const handL = box(0.15, 0.14, 0.17, skin);
  handL.position.set(-0.35, 0.56, 0);
  const handR = handL.clone();
  handR.position.x = 0.35;
  g.add(handL, handR);

  const neck = box(0.16, 0.1, 0.16, skin);
  neck.position.y = 1.15;
  g.add(neck);

  const head = box(0.36, 0.36, 0.34, skin);
  head.position.y = 1.37;
  g.add(head);

  const eyeL = box(0.05, 0.06, 0.03, FLAT("#2b2018"));
  eyeL.position.set(-0.08, 1.4, 0.18);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.08;
  g.add(eyeL, eyeR);

  if (profile.code === "CEREALIER") {
    const brim = cyl(0.36, 0.36, 0.04, 8, prop);
    brim.position.y = 1.55;
    const crown = cyl(0.19, 0.21, 0.2, 8, prop);
    crown.position.y = 1.65;
    g.add(brim, crown);

    const stalk = cyl(0.02, 0.02, 0.7, 5, FLAT("#c9a227"));
    stalk.position.set(0.4, 0.85, 0.1);
    stalk.rotation.z = -0.22;
    const ear = cyl(0.07, 0.02, 0.24, 6, FLAT("#e8c85a"));
    ear.position.set(0.47, 1.24, 0.1);
    ear.rotation.z = -0.22;
    g.add(stalk, ear);
  }

  if (profile.code === "ELEVEUR") {
    const hat = cyl(0.3, 0.34, 0.06, 8, prop);
    hat.position.y = 1.56;
    const crown = cyl(0.2, 0.22, 0.22, 8, prop);
    crown.position.y = 1.67;
    g.add(hat, crown);

    // Un veau à ses pieds : la signature visuelle de l'éleveur.
    const calf = new THREE.Group();
    const body = box(0.42, 0.24, 0.24, FLAT("#f2ece1"));
    body.position.y = 0.26;
    const patch = box(0.16, 0.12, 0.25, FLAT("#4a3527"));
    patch.position.set(0.06, 0.31, 0);
    const headC = box(0.2, 0.18, 0.18, FLAT("#f2ece1"));
    headC.position.set(-0.29, 0.32, 0);
    const snout = box(0.09, 0.1, 0.12, FLAT("#e0b6ac"));
    snout.position.set(-0.4, 0.28, 0);
    calf.add(body, patch, headC, snout);
    for (const [lx, lz] of [
      [-0.14, 0.08],
      [-0.14, -0.08],
      [0.14, 0.08],
      [0.14, -0.08],
    ]) {
      const leg = box(0.07, 0.18, 0.07, FLAT("#d9d2c6"));
      leg.position.set(lx, 0.09, lz);
      calf.add(leg);
    }
    calf.position.set(0.62, 0, 0.18);
    calf.rotation.y = -0.5;
    calf.scale.setScalar(0.86);
    g.add(calf);
  }

  if (profile.code === "ETA") {
    const helmet = cyl(0.21, 0.23, 0.18, 8, FLAT("#e0762f"));
    helmet.position.y = 1.6;
    const brim = box(0.3, 0.05, 0.16, FLAT("#e0762f"));
    brim.position.set(0, 1.53, 0.18);
    g.add(helmet, brim);

    const vest = box(0.54, 0.2, 0.32, FLAT("#f2b13c"));
    vest.position.y = 0.92;
    g.add(vest);

    // Clé à molette : il travaille les terres des autres, pas les siennes.
    const wrench = box(0.07, 0.62, 0.07, prop);
    wrench.position.set(-0.42, 0.78, 0.06);
    wrench.rotation.z = 0.3;
    const jaw = box(0.2, 0.14, 0.09, prop);
    jaw.position.set(-0.53, 1.06, 0.06);
    jaw.rotation.z = 0.3;
    g.add(wrench, jaw);
  }

  return g;
}

/** Rendu 3D d'un personnage de classe, sur fond transparent. */
export function LowPolyCharacter({ code, active = false, height = 190 }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const width = host.clientWidth || 200;
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 1.35, 4.4);
    camera.lookAt(0, 0.85, 0);

    // Trois de ces portraits tournent côte à côte sur l'écran des métiers,
    // chacun avec sa boucle de rendu : c'est là qu'un réglage sobre se voit le
    // plus sur une machine sans carte graphique.
    const quality = initialQuality();
    const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, alpha: true });
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
      FLAT("#8ec96f"),
    );
    disc.position.y = -0.06;
    scene.add(disc);

    const character = buildFarmer(CLASS_PROFILES[code]);
    scene.add(character);

    let raf = 0;
    let lastFrame = 0;
    const start = performance.now();
    const tick = () => {
      const now = performance.now();
      if (document.hidden || (quality.maxFps && now - lastFrame < 1000 / quality.maxFps - 1)) {
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
  }, [code, height]);

  return <div className="lowpoly-char" ref={hostRef} style={{ height }} aria-hidden="true" />;
}
