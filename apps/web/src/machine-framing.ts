import * as THREE from "three";

/**
 * Demi-hauteur du frustum ortho pour qu'un engin tienne dans la vignette,
 * y compris quand le plateau tourne.
 *
 * Le cadrage se déduisait de la seule longueur (`length × 0,62`). Ça remplissait
 * la case, mais une moissonneuse ou un T5 passait **au-dessus du cadre** : la
 * hauteur projetée en iso n'était pas comptée, et un canevas très large
 * n'ajoute aucun pixel en vertical.
 */
export function isoOrthoFrustum(
  box: THREE.Box3,
  aspect: number,
  pad = 1.34,
): { frustum: number; lookAtY: number } {
  const center = box.getCenter(new THREE.Vector3());
  const { min, max } = box;
  const corners: THREE.Vector3[] = [];
  for (const x of [min.x, max.x]) {
    for (const y of [min.y, max.y]) {
      for (const z of [min.z, max.z]) {
        corners.push(new THREE.Vector3(x, y, z));
      }
    }
  }

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  cam.position.set(9, 7.35 + center.y, 9);
  cam.lookAt(0, center.y, 0);
  cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse;

  let maxX = 0;
  let maxY = 0;
  for (let k = 0; k < 8; k++) {
    const yaw = (k / 8) * Math.PI * 2;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    for (const c of corners) {
      const p = new THREE.Vector3(c.x * cy + c.z * sy, c.y, -c.x * sy + c.z * cy);
      p.applyMatrix4(inv);
      maxX = Math.max(maxX, Math.abs(p.x));
      maxY = Math.max(maxY, Math.abs(p.y));
    }
  }
  const a = aspect > 0.15 ? aspect : 1;
  const frustum = Math.max(maxY, maxX / a) * pad;
  return { frustum: Math.max(0.55, frustum), lookAtY: center.y };
}
