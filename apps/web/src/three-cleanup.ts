import * as THREE from "three";

/**
 * Libère toutes les ressources GPU d'une scène.
 *
 * `renderer.dispose()` ne rend pas le contexte WebGL : il attend le ramasse-
 * miettes. Or un navigateur plafonne à une quinzaine de contextes simultanés
 * et supprime silencieusement les plus anciens au-delà. Le jeu monte et
 * démonte beaucoup de vues 3D — trois personnages sur l'écran des métiers,
 * le globe, le vol d'approche, la ferme, et tout cela en double sous
 * StrictMode en développement. Sans libération explicite, la limite est
 * atteinte et des canevas deviennent noirs sans la moindre erreur.
 */
/**
 * Marque une géométrie comme partagée entre plusieurs montages : le nettoyage
 * de scène la laissera intacte. Sert aux géométries mises en cache, coûteuses
 * à reconstruire et strictement identiques d'un montage à l'autre.
 */
export function markShared<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.userData.shared = true;
  return geometry;
}

export function disposeThreeScene(scene: THREE.Scene): void {
  scene.traverse((object) => {
    const mesh = object as Partial<THREE.Mesh>;
    if (!mesh.geometry?.userData?.shared) mesh.geometry?.dispose?.();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const m of material) disposeMaterial(m);
    } else if (material) {
      disposeMaterial(material);
    }
  });
  scene.clear();
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}

/**
 * Détache un rendu de son hôte et rend son contexte WebGL au navigateur.
 * Tolère un canevas déjà retiré du DOM : React peut avoir nettoyé avant nous.
 */
export function disposeRenderer(
  renderer: THREE.WebGLRenderer,
  host: HTMLElement | null,
): void {
  renderer.dispose();
  renderer.forceContextLoss();
  const canvas = renderer.domElement;
  if (host && canvas.parentNode === host) host.removeChild(canvas);
  else canvas.parentNode?.removeChild(canvas);
}
