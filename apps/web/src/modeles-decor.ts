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
    p = chargeur.loadAsync(url).then((gltf) => gltf.scene);
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
