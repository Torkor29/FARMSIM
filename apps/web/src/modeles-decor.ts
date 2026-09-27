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

/** Le kit nature de la forge (`blender/recettes/nature.py`). */
export const NATURE = "/assets/decor3d/nature.glb";

/** Les saisons du jeu, dans le vocabulaire des couleurs de la forge. */
export const SAISON_DECOR: Record<string, SaisonDecor | undefined> = {
  SPRING: "printemps",
  SUMMER: undefined,
  AUTUMN: "automne",
  WINTER: "hiver",
};

/** L'adresse des pancartes modélisées dans Blender (`blender/pancartes.py`). */
export const PANCARTES = "/assets/decor3d/pancartes.glb";

// ---------------------------------------------------------------------------
// La forge d'assets (`blender/forge`, `blender/recettes`)
// ---------------------------------------------------------------------------

/** L'adresse du manifeste que la forge tient à jour à chaque construction. */
export const MANIFESTE_DECOR = "/assets/decor3d/manifest.json";

export type SaisonDecor = "printemps" | "automne" | "hiver";

export interface PieceDecor {
  triangles: number;
  appels: number;
  sommets: number;
  /** Largeur, hauteur, profondeur, en unités du jeu. */
  taille: [number, number, number];
  matieres: string[];
  /** Les nœuds animables de la pièce (`ailes`, `treuil`…). */
  noeuds: string[];
}

export interface AssetDecor {
  titre: string;
  url: string;
  octets: number;
  echelle: number;
  source: string;
  empreinte: string;
  construit: string;
  /** Nom de matière → couleur sRGB d'été (la couleur du fichier). */
  matieres: Record<string, string>;
  /** Saison → (nom de matière → couleur sRGB) ; seules les matières qui changent. */
  saisons: Partial<Record<SaisonDecor, Record<string, string>>>;
  pieces: Record<string, PieceDecor>;
  etiquettes?: string[];
}

export interface ManifesteDecor {
  version: number;
  assets: Record<string, AssetDecor>;
}

let manifeste: Promise<ManifesteDecor> | null = null;

export function chargerManifeste(): Promise<ManifesteDecor> {
  if (!manifeste) {
    manifeste = fetch(MANIFESTE_DECOR).then((r) => {
      if (!r.ok) throw new Error(`manifeste des décors : ${r.status}`);
      return r.json() as Promise<ManifesteDecor>;
    });
    manifeste.catch(() => (manifeste = null));
  }
  return manifeste;
}

/**
 * Repeint un décor à la saison : chaque matière nommée dans `teintes` prend
 * sa couleur, les autres reviennent à celle du fichier. Les matières sont
 * partagées entre tous les clones d'un modèle — c'est voulu : la saison est
 * la même partout, et un seul appel repeint toute la carte.
 *
 * `teintes` vient du manifeste (`asset.saisons.automne`) ; `undefined`
 * ramène l'été.
 */
export function teinterSaison(objet: THREE.Object3D, teintes: Record<string, string> | undefined): void {
  objet.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.color) continue;
      if (mat.userData.teinteBase === undefined) mat.userData.teinteBase = mat.color.getHex();
      const t = teintes?.[mat.name];
      if (t) mat.color.set(t);
      else mat.color.setHex(mat.userData.teinteBase as number);
    }
  });
}

/**
 * Anime les nœuds conventionnels d'un décor de la forge, d'après leur nom :
 * `…:ailes` tournent autour de leur axe (celui du moyeu, vers la caméra),
 * `…:treuil` autour de X. `t` en secondes.
 */
export function animerDecor(objet: THREE.Object3D, t: number): void {
  objet.traverse((o) => {
    if (o.name.endsWith(":ailes")) o.rotation.z = -t * 0.9;
    else if (o.name.endsWith(":treuil")) o.rotation.x = Math.sin(t * 0.7) * 1.6;
  });
}
