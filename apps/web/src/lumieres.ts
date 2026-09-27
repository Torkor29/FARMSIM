import * as THREE from "three";
import { melange, type Ambiance } from "./ambiance";

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

export interface LumieresScene {
  hemi: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  bounce: THREE.DirectionalLight;
}

/**
 * Applique une ambiance (`ambiance.ts`) aux quatre lumières d'une scène, et
 * à sa brume. `eclair` (0..1) ajoute l'éclair d'orage en cours. La ferme et
 * l'atelier des décors passent par ici : ce qu'on règle dans l'atelier est
 * ce qu'on verra en jeu.
 */
export function appliquerAmbiance(
  l: LumieresScene,
  a: Ambiance,
  eclair = 0,
  brume: THREE.Fog | null = null,
  distance = 30,
): void {
  l.hemi.color.setHex(melange(a.hemi.ciel, 0xeef2ff, eclair));
  l.hemi.groundColor.setHex(a.hemi.sol);
  l.hemi.intensity = a.hemi.intensite + eclair * 1.6;
  l.ambient.color.setHex(a.ambiante.couleur);
  l.ambient.intensity = a.ambiante.intensite + eclair * 0.9;
  l.sun.color.setHex(a.astre.couleur);
  l.sun.intensity = a.astre.intensite;
  const [dx, dy, dz] = a.astre.direction;
  const cible = l.sun.target.position;
  l.sun.position.set(cible.x + dx * distance, cible.y + dy * distance, cible.z + dz * distance);
  l.bounce.color.setHex(a.rebond.couleur);
  l.bounce.intensity = a.rebond.intensite;
  if (brume) {
    brume.color.setHex(melange(a.brume.couleur, 0xdfe6f4, eclair * 0.6));
    brume.near = a.brume.proche;
    brume.far = a.brume.loin;
  }
}
