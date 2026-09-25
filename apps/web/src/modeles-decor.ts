import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/**
 * Les décors modélisés dans Blender.
 *
 * Le reste de la campagne est construit en code, et c'est très bien pour un
 * silo ou une clôture. Pas pour une ruche ou un pied de lavande : trois
 * versions dessinées en pavés ont appelé « c'est quoi ça ? », puis « c'est
 * horrible ». Ces décors-là sont modélisés dans Blender (`apps/web/blender/`),
 * exportés en `.glb` compressé, et chargés ici.
 *
 * Un modèle n'est téléchargé et décodé qu'une fois : chaque lieu en pose un
 * clone, qui partage géométries et matières. On ne les libère donc jamais —
 * ils servent à la vue suivante.
 */
const cache = new Map<string, Promise<THREE.Object3D>>();

/**
 * Hors navigateur (les tests tournent dans Node), pas de fichier à aller
 * chercher : l'appelant pose sa version dessinée en code.
 */
export const MODELES_DISPONIBLES = typeof window !== "undefined" && typeof fetch === "function";

export function chargerModele(url: string): Promise<THREE.Object3D> {
  let p = cache.get(url);
  if (!p) {
    const chargeur = new GLTFLoader();
    chargeur.setMeshoptDecoder(MeshoptDecoder);
    p = chargeur.loadAsync(url).then((gltf) => {
      // Partagées entre tous les clones : la vue ne doit pas les libérer.
      gltf.scene.traverse((o) => {
        const g = (o as THREE.Mesh).geometry;
        if (g) g.userData.shared = true;
      });
      return gltf.scene;
    });
    // Un échec ne doit pas rester en cache : la vue suivante réessaiera.
    p.catch(() => cache.delete(url));
    cache.set(url, p);
  }
  return p;
}

/** Un clone du modèle, prêt à poser, ombres réglées comme le reste du décor. */
export async function poserModele(url: string, shadows: boolean): Promise<THREE.Object3D> {
  const modele = await chargerModele(url);
  const copie = modele.clone(true);
  copie.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = shadows;
    }
  });
  return copie;
}

/** Un clone d'une pièce nommée du modèle — une pancarte parmi d'autres. */
export async function poserPiece(url: string, nom: string, shadows: boolean): Promise<THREE.Object3D> {
  const modele = await chargerModele(url);
  const piece = modele.getObjectByName(nom);
  if (!piece) throw new Error(`${nom} absent de ${url}`);
  const copie = piece.clone(true);
  copie.position.set(0, 0, 0);
  copie.rotation.set(0, 0, 0);
  copie.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = shadows;
      o.receiveShadow = shadows;
    }
  });
  return copie;
}

/**
 * Une pièce posée à plusieurs endroits d'un coup : un maillage instancié par
 * matière. Trente pancartes « À VENDRE » de six matières faisaient cent
 * quatre-vingts appels de rendu ; instanciées, six.
 */
export async function instancierPiece(
  url: string,
  nom: string,
  poses: readonly THREE.Matrix4[],
  shadows: boolean,
): Promise<THREE.Group> {
  const modele = await chargerModele(url);
  const piece = modele.getObjectByName(nom);
  if (!piece) throw new Error(`${nom} absent de ${url}`);
  const groupe = new THREE.Group();
  groupe.name = `${nom}-instances`;
  if (!poses.length) return groupe;
  // Chaque maillage, dans le repère de la pièce : la compression pose une
  // échelle et un décalage sur les nœuds, qu'il faut garder.
  piece.updateWorldMatrix(true, true);
  const racine = piece.matrixWorld.clone().invert();
  const local = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  piece.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    local.multiplyMatrices(racine, mesh.matrixWorld);
    const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, poses.length);
    poses.forEach((p, i) => inst.setMatrixAt(i, m.multiplyMatrices(p, local)));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.castShadow = shadows;
    inst.receiveShadow = shadows;
    inst.name = mesh.name;
    groupe.add(inst);
  });
  return groupe;
}

/** L'adresse des pancartes modélisées dans Blender (`blender/pancartes.py`). */
export const PANCARTES = "/assets/decor3d/pancartes.glb";
