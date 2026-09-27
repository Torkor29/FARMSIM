import * as THREE from "three";

/**
 * Les lumières qui s'allument le soir.
 *
 * Trois sortes de matières le déclarent :
 * - les vitres des bâtiments (`userData.allumable = "fenetre"`), éteintes le
 *   jour, d'un jaune chaud la nuit ;
 * - les lampes des bâtiments (`userData.allumable = "lampe"`), qui brillent
 *   déjà un peu le jour et beaucoup la nuit ;
 * - la matière `lumiere` des décors de la forge (lanternes, guirlandes,
 *   bougies des bateaux de papier).
 *
 * `lampes` vient de l'ambiance (0 en plein jour, 1 la nuit ou sous l'orage).
 * Les matières sont partagées entre bâtiments : un passage règle toute la
 * scène, et on ne repasse que si la valeur a bougé.
 */
export function allumerLumieres(racine: THREE.Object3D, lampes: number): void {
  const vues = new Set<THREE.Material>();
  racine.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh && !(o as THREE.Points).isPoints) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || vues.has(m)) continue;
      vues.add(m);
      const mat = m as THREE.MeshStandardMaterial;
      const genre = mat.userData?.allumable ?? (mat.name === "lumiere" ? "lampe" : undefined);
      if (!genre || !mat.emissive) continue;
      if (mat.userData.emissionBase === undefined) mat.userData.emissionBase = mat.emissiveIntensity;
      if (genre === "fenetre") {
        mat.emissiveIntensity = lampes * 1.15;
      } else {
        const base = (mat.userData.emissionBase as number) || 1;
        mat.emissiveIntensity = base * (0.35 + lampes * 1.4);
      }
    }
  });
}
