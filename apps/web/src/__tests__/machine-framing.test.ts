import * as THREE from "three";
import { isoOrthoFrustum } from "../machine-framing";
import { createMachineRig } from "../machines3d";

const FICHE_ASPECT = 544 / 320;

function camOf(lookAtY: number) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  cam.position.set(9, 7.35 + lookAtY, 9);
  cam.lookAt(0, lookAtY, 0);
  cam.updateMatrixWorld();
  return cam;
}

function yawPoint(c: THREE.Vector3, yaw: number) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return new THREE.Vector3(c.x * cy + c.z * sy, c.y, -c.x * sy + c.z * cy);
}

/**
 * La vignette 3D d'un engin ne doit plus le couper.
 *
 * Trouvé sur la fiche Améliorer : la moissonneuse perdait le haut de la
 * trémie, le tracteur frôlait le bord. Un frustum symétrique autour de
 * l'origine caméra laissait tout l'air sous l'engin.
 */
describe("le cadrage iso d'un engin", () => {
  it("compte la hauteur, pas seulement la longueur", () => {
    const haut = new THREE.Box3(new THREE.Vector3(-0.6, 0, -0.4), new THREE.Vector3(0.6, 1.2, 0.4));
    const long = new THREE.Box3(new THREE.Vector3(-1.2, 0, -0.3), new THREE.Vector3(1.2, 0.35, 0.3));
    const large = 32 / 12;
    const fHaut = isoOrthoFrustum(haut, large).frustum;
    const fLong = isoOrthoFrustum(long, large).frustum;
    expect(fHaut).toBeGreaterThan(0.7);
    expect(fLong).toBeGreaterThan(0.7);
    expect(fHaut).toBeGreaterThan(isoOrthoFrustum(haut, 1).frustum * 0.5);
  });

  it("garde une marge : les coins ne collent pas au bord", () => {
    const box = new THREE.Box3(new THREE.Vector3(-1, 0, -0.5), new THREE.Vector3(1, 1, 0.5));
    const { frustum } = isoOrthoFrustum(box, 1.8, 1.36);
    const serre = isoOrthoFrustum(box, 1.8, 1).frustum;
    expect(frustum).toBeGreaterThan(serre);
    expect(frustum / serre).toBeGreaterThan(1.2);
  });

  it("laisse de l'air au-dessus d'une caisse plus haute d'un côté", () => {
    const box = new THREE.Box3(new THREE.Vector3(-0.7, 0, -0.35), new THREE.Vector3(1.15, 1.05, 0.35));
    const fit = isoOrthoFrustum(box, FICHE_ASPECT);
    const cam = camOf(fit.lookAtY);
    const viewH = fit.top - fit.bottom;
    let minHeadroom = Infinity;
    for (let k = 0; k < 8; k++) {
      const p = yawPoint(new THREE.Vector3(0, 1.05, 0), (k / 8) * Math.PI * 2);
      p.applyMatrix4(cam.matrixWorldInverse);
      minHeadroom = Math.min(minHeadroom, fit.top - p.y);
    }
    expect(minHeadroom / viewH).toBeGreaterThan(0.1);
  });

  it("cadre une Coupe T1 entière dans la fiche, toit compris", () => {
    const rig = createMachineRig("HARVESTER", { tier: 1, seed: 3 });
    rig.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(rig.group);
    box.min.y = Math.min(box.min.y, -0.16);
    const fit = isoOrthoFrustum(box, FICHE_ASPECT);
    const cam = camOf(fit.lookAtY);
    const viewH = fit.top - fit.bottom;
    const viewW = fit.right - fit.left;
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          corners.push(new THREE.Vector3(x, y, z));
        }
      }
    }
    let minHeadroom = Infinity;
    for (let k = 0; k < 8; k++) {
      const yaw = (k / 8) * Math.PI * 2;
      for (const c of corners) {
        const p = yawPoint(c, yaw);
        p.applyMatrix4(cam.matrixWorldInverse);
        expect(p.x).toBeGreaterThan(fit.left);
        expect(p.x).toBeLessThan(fit.right);
        expect(p.y).toBeGreaterThan(fit.bottom);
        expect(p.y).toBeLessThan(fit.top);
        minHeadroom = Math.min(minHeadroom, fit.top - p.y);
      }
    }
    expect(minHeadroom / viewH).toBeGreaterThan(0.1);
    expect(viewW / viewH).toBeCloseTo(FICHE_ASPECT, 5);
    rig.dispose();
  });
});
