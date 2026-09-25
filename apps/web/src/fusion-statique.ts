import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Cuire des maillages immobiles en quelques maillages.
 *
 * Les fermes des voisins sont les vrais modèles du jeu : une maison, c'est
 * vingt-cinq pièces, une étable quarante. Trente-deux bâtiments faisaient donc
 * près de six cents appels de rendu par image — le double avec la passe
 * d'ombres — pour des murs qui ne bougent jamais. « Le jeu est super lent » :
 * c'est ce que coûtait une campagne vue en entier.
 *
 * Ici, tout ce qui ne bouge pas est reporté dans le repère de `repere`, puis
 * fusionné par famille de matière (même brillance, même transparence) ; la
 * couleur de chaque pièce passe dans ses sommets. Ce que `anime` désigne —
 * une girouette, une hélice — reste à sa place, avec ses enfants.
 */
export type Fusion = {
  meshes: THREE.Mesh[];
  dispose(): void;
};

type Famille = {
  materiau: THREE.MeshStandardMaterial;
  geometries: THREE.BufferGeometry[];
  ombre: boolean;
  recoit: boolean;
};

/** Ce qui distingue deux matières une fois la couleur passée aux sommets. */
function signature(m: THREE.MeshStandardMaterial): string {
  return [
    m.type,
    m.transparent ? m.opacity.toFixed(2) : "opaque",
    m.side,
    m.emissive.getHexString(),
    m.emissiveIntensity.toFixed(2),
    m.metalness.toFixed(1),
    m.roughness.toFixed(1),
  ].join("|");
}

/** Retourne chaque triangle : un repère en miroir inverse le sens des faces. */
function retourner(geo: THREE.BufferGeometry): void {
  for (const nom of ["position", "normal"]) {
    const a = geo.getAttribute(nom) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const t = a.array as Float32Array;
    for (let i = 0; i + 8 < t.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const v = t[i + 3 + k]!;
        t[i + 3 + k] = t[i + 6 + k]!;
        t[i + 6 + k] = v;
      }
    }
    a.needsUpdate = true;
  }
}

export function fusionnerStatique(
  racines: readonly THREE.Object3D[],
  repere: THREE.Object3D,
  anime: (o: THREE.Object3D) => boolean,
): Fusion {
  repere.updateWorldMatrix(true, true);
  const inverse = repere.matrixWorld.clone().invert();
  const familles = new Map<string, Famille>();
  const cuits: THREE.Mesh[] = [];
  const local = new THREE.Matrix4();

  const visiter = (o: THREE.Object3D) => {
    if (anime(o) || !o.visible) return;
    const mesh = o as THREE.Mesh;
    const m = mesh.material;
    if (
      mesh.isMesh &&
      !(mesh as Partial<THREE.InstancedMesh>).isInstancedMesh &&
      m instanceof THREE.MeshStandardMaterial &&
      !m.map
    ) {
      const source = mesh.geometry;
      const geo = source.index ? source.toNonIndexed() : source.clone();
      for (const nom of Object.keys(geo.attributes)) {
        if (nom !== "position" && nom !== "normal") geo.deleteAttribute(nom);
      }
      if (!geo.getAttribute("normal")) geo.computeVertexNormals();
      local.multiplyMatrices(inverse, mesh.matrixWorld);
      geo.applyMatrix4(local);
      if (local.determinant() < 0) retourner(geo);
      const n = geo.getAttribute("position").count;
      const couleurs = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        couleurs[i * 3] = m.color.r;
        couleurs[i * 3 + 1] = m.color.g;
        couleurs[i * 3 + 2] = m.color.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(couleurs, 3));
      const cle = signature(m);
      let f = familles.get(cle);
      if (!f) {
        f = { materiau: m, geometries: [], ombre: false, recoit: false };
        familles.set(cle, f);
      }
      f.geometries.push(geo);
      f.ombre ||= mesh.castShadow;
      f.recoit ||= mesh.receiveShadow;
      cuits.push(mesh);
    }
    for (const c of o.children) visiter(c);
  };
  for (const r of racines) visiter(r);

  const meshes: THREE.Mesh[] = [];
  for (const f of familles.values()) {
    const geo = mergeGeometries(f.geometries, false);
    for (const g of f.geometries) g.dispose();
    if (!geo) continue;
    const materiau = f.materiau.clone();
    materiau.vertexColors = true;
    materiau.color.set(0xffffff);
    const mesh = new THREE.Mesh(geo, materiau);
    mesh.name = "fusion-statique";
    mesh.castShadow = f.ombre;
    mesh.receiveShadow = f.recoit;
    meshes.push(mesh);
  }
  // Les pièces cuites quittent la scène ; leurs géométries sont partagées
  // (mises en cache par les modèles), on ne les libère donc pas ici.
  for (const c of cuits) c.removeFromParent();

  return {
    meshes,
    dispose() {
      for (const m of meshes) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        m.removeFromParent();
      }
    },
  };
}
