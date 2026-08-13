/**
 * Planche des engins 3D, même code et même cadrage iso que le champ.
 * Sert à capturer le rendu réel — pas une illustration.
 */
import * as THREE from "three";
import type { MachineType } from "@farmsim/shared";
import { makeMachineMesh, tickMachine } from "./machine-meshes";

const SOIL = 0x9ac06a;
const SOIL_DARK = 0x8ab35e;
const SKY = 0xe6f4fb;

function paintSlot(canvas: HTMLCanvasElement, type: MachineType): void {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(2);
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(SKY);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9ab87e, 1.25));
  scene.add(new THREE.AmbientLight(0xfff6e4, 0.65));
  const sun = new THREE.DirectionalLight(0xfff2d4, 1.55);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  const bounce = new THREE.DirectionalLight(0xbfe0c8, 0.4);
  bounce.position.set(-10, 6, -8);
  scene.add(bounce);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshLambertMaterial({ color: SOIL, flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshLambertMaterial({ color: SOIL_DARK, flatShading: true }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  pad.receiveShadow = true;
  scene.add(pad);

  const machine = makeMachineMesh(type);
  tickMachine(machine, { distance: 0.4, working: true, dt: 0.28 });
  scene.add(machine);

  const camera = new THREE.OrthographicCamera(-1.35, 1.35, 1.15, -1.15, 0.1, 40);
  camera.position.set(3.4, 2.9, 3.4);
  camera.lookAt(0, 0.22, 0);
  renderer.render(scene, camera);
}

const types: MachineType[] = ["TRACTOR", "HARVESTER", "SPREADER", "DISC_HARROW"];
for (const type of types) {
  const canvas = document.getElementById(type);
  if (canvas instanceof HTMLCanvasElement) paintSlot(canvas, type);
}
document.documentElement.dataset.ready = "1";
