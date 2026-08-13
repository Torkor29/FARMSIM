import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MACHINE_DEFS, type MachineType } from "@farmsim/shared";
import { createMachineRig, isTowedImplement } from "./machines3d";

/**
 * Export glTF du parc matériel.
 *
 * Le jeu n'a pas besoin de fichiers : il construit ses engins en géométrie
 * procédurale au chargement. Mais un modèle qu'on ne peut pas ouvrir ailleurs
 * n'est pas vraiment un asset — impossible de le retoucher dans Blender, de le
 * confier à un graphiste ou de le réutiliser dans un autre moteur.
 *
 * Cette page produit donc, à la demande, un `.glb` par machine :
 *
 * - **hiérarchie nommée** — `wheel_1`… `steer_1`, `reel_1`, `gang_1`,
 *   `spinner_1`, `tool_1`, `auger_1`, `beacon_1` : de quoi animer la machine
 *   dans n'importe quel outil ;
 * - **une animation « Travail »** déjà posée, en boucle de deux secondes :
 *   roues, rabatteur, disques et trains entraînés, outil abaissé ;
 * - **matières PBR** conservées (peinture vernie, chrome, verre).
 *
 * Page de travail : elle ne fait pas partie du build du jeu.
 */

const LOOP = 2;
const SPEED = 1.6;

const AXIS_Z = new THREE.Vector3(0, 0, 1);
const AXIS_Y = new THREE.Vector3(0, 1, 0);

/**
 * Piste de rotation régulière. Le nombre de tours est arrondi pour que la
 * boucle se referme exactement : sans cela, l'animation « saute » à chaque
 * reprise.
 */
function spinTrack(path: string, axis: THREE.Vector3, turns: number, steps = 24) {
  const whole = Math.max(1, Math.round(Math.abs(turns))) * Math.sign(turns || 1);
  const times: number[] = [];
  const values: number[] = [];
  const q = new THREE.Quaternion();
  for (let i = 0; i <= steps; i++) {
    times.push((i / steps) * LOOP);
    q.setFromAxisAngle(axis, (i / steps) * whole * Math.PI * 2);
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${path}.quaternion`, times, values);
}

function workClip(root: THREE.Object3D): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const distance = SPEED * LOOP;

  root.traverse((node) => {
    const name = node.name;
    if (!name) return;
    const radius = (node.userData.radius as number) || 0.2;
    const dir = (node.userData.spin as number) || 1;

    if (name.startsWith("wheel")) {
      tracks.push(spinTrack(name, AXIS_Z, -distance / (2 * Math.PI * radius)));
    } else if (name.startsWith("reel")) {
      tracks.push(spinTrack(name, AXIS_Z, -(distance * 1.25) / (2 * Math.PI * radius)));
    } else if (name.startsWith("gang")) {
      tracks.push(spinTrack(name, AXIS_Z, (-distance / (2 * Math.PI * radius)) * dir));
    } else if (name.startsWith("spinner")) {
      // Entraîné par la prise de force : régime constant, six tours par boucle.
      tracks.push(spinTrack(name, AXIS_Y, 6 * dir));
    }
  });

  return new THREE.AnimationClip("Travail", LOOP, tracks);
}

async function exportOne(type: MachineType): Promise<string> {
  const rig = createMachineRig(type, {
    towed: isTowedImplement(type),
    shadows: false,
  });
  // Outil posé, gyrophare allumé : le modèle est exporté en position de
  // travail, celle qu'on veut voir en ouvrant le fichier.
  for (let i = 0; i < 40; i++) rig.update({ t: i / 40, distance: 0, working: true });

  const scene = new THREE.Scene();
  scene.name = MACHINE_DEFS[type].name;
  scene.add(rig.group);

  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    new GLTFExporter().parse(
      scene,
      (result) => resolve(result as ArrayBuffer),
      (err) => reject(err),
      { binary: true, animations: [workClip(rig.group)] },
    );
  });

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

declare global {
  interface Window {
    exportMachine?: (type: MachineType) => Promise<string>;
  }
}

window.exportMachine = exportOne;

const root = document.getElementById("root");
if (root) {
  root.textContent =
    "Export glTF du parc matériel — page de travail. " +
    "Utilisée par scripts/export-machines.mjs pour produire les .glb.";
}
