import * as THREE from "three";
import { MACHINE_DEFS, type MachineType } from "@farmsim/shared";
import { createMachineRig, isTowedImplement } from "../machines3d";

/**
 * La signalisation routière des engins : panneaux zébrés à l'arrière des
 * outils et des automoteurs, plaque, catadioptres orange sur les flancs.
 * Elle est posée au rayon sur la carrosserie ; ce test vérifie qu'elle est
 * bien là, sur chaque engin et chaque palier.
 */

const TYPES = Object.keys(MACHINE_DEFS) as MachineType[];

function maillages(type: MachineType, tier: 1 | 2 | 3 | 4 | 5) {
  const rig = createMachineRig(type, { shadows: false, tier });
  const par = new Map<string, THREE.Box3>();
  rig.group.updateMatrixWorld(true);
  rig.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const b = new THREE.Box3().setFromObject(m);
    par.set(m.name, (par.get(m.name) ?? new THREE.Box3()).union(b));
  });
  rig.dispose();
  return par;
}

describe.each(TYPES)("%s", (type) => {
  it.each([1, 3, 5] as const)("palier %i : porte catadioptres et signalisation arrière", (tier) => {
    const m = maillages(type, tier);
    expect(m.has("reflector")).toBe(true);
    // Bandes blanches : panneaux zébrés (outils, automoteurs) ou plaque.
    expect(m.has("hazard")).toBe(true);
    if (isTowedImplement(type)) {
      // Les panneaux sont à l'arrière, donc côté X négatifs.
      const h = m.get("hazard")!;
      const tout = new THREE.Box3();
      for (const b of m.values()) tout.union(b);
      expect(h.min.x).toBeLessThan(tout.min.x + (tout.max.x - tout.min.x) * 0.45);
    }
  });
});
