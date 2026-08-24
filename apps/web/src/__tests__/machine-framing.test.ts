import * as THREE from "three";
import { isoOrthoFrustum } from "../machine-framing";

/**
 * La vignette 3D d'un engin ne doit plus le couper.
 *
 * Trouvé sur la fiche Améliorer : la moissonneuse perdait le haut de la
 * trémie, le tracteur frôlait le bord. Le frustum ne regardait que la
 * longueur, pas la hauteur projetée en iso.
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
    // Un engin haut dans une vignette large : c'est la verticale qui décide.
    expect(fHaut).toBeGreaterThan(isoOrthoFrustum(haut, 1).frustum * 0.5);
  });

  it("garde une marge : les coins ne collent pas au bord", () => {
    const box = new THREE.Box3(new THREE.Vector3(-1, 0, -0.5), new THREE.Vector3(1, 1, 0.5));
    const { frustum } = isoOrthoFrustum(box, 1.8, 1.34);
    const serre = isoOrthoFrustum(box, 1.8, 1).frustum;
    expect(frustum).toBeGreaterThan(serre);
    expect(frustum / serre).toBeGreaterThan(1.2);
  });
});
