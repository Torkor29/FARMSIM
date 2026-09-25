import * as THREE from "three";

/**
 * Les dalles du domaine, en instances.
 *
 * Chaque case était un `Mesh` avec son propre matériau, recoloré à chaque
 * image : 144 appels de rendu pour une ferme de départ, 576 pour un domaine de
 * 24×24 — plus que toute la campagne réunie. Deux maillages instanciés les
 * remplacent : les dalles ordinaires, et les labours (qui portent la texture
 * des sillons). La couleur par instance porte le survol, la sélection et la
 * pulsation ; la matrice, le léger soulèvement d'une case choisie.
 */
export type Dalle = {
  x: number;
  y: number;
  px: number;
  pz: number;
  /** Couleur de repos. */
  couleur: number;
  /** Labour : dalle texturée de sillons. */
  labour: boolean;
  /** Sélectionnée d'avance (sélection venue du parent). */
  choisie: boolean;
};

export type DallesInstanciees = {
  object: THREE.Group;
  /** Repose toutes les dalles — à chaque `layout()`, pas à chaque image. */
  poser(dalles: readonly Dalle[], cote: number, epaisseur: number): void;
  /**
   * Recolore et soulève, à chaque image.
   *
   * `teinte` reçoit la clé et la couleur de repos, écrit dans `sortie` la
   * couleur voulue et rend le soulèvement.
   */
  animer(teinte: (cle: string, repos: THREE.Color, sortie: THREE.Color) => number): void;
  /** La dalle d'une case, s'il y en a une. */
  a(cle: string): Dalle | undefined;
  dispose(): void;
};

export function creerDalles(labourMap: THREE.Texture | null): DallesInstanciees {
  const object = new THREE.Group();
  object.name = "dalles";
  const matUni = new THREE.MeshLambertMaterial({ flatShading: true });
  const matLabour = new THREE.MeshLambertMaterial({ flatShading: true, map: labourMap });
  let geo: THREE.BoxGeometry | null = null;
  let uni: THREE.InstancedMesh | null = null;
  let labour: THREE.InstancedMesh | null = null;
  /** Pour chaque dalle : son maillage, son indice, sa couleur de repos. */
  let index: { mesh: THREE.InstancedMesh; i: number; repos: THREE.Color; dalle: Dalle; cle: string }[] = [];
  const parCle = new Map<string, Dalle>();
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const levees = new Float32Array(0);
  let dernieres = levees;

  function vider() {
    for (const mesh of [uni, labour]) {
      if (!mesh) continue;
      object.remove(mesh);
      mesh.dispose();
    }
    uni = null;
    labour = null;
    index = [];
    parCle.clear();
  }

  function poser(dalles: readonly Dalle[], cote: number, epaisseur: number) {
    vider();
    geo?.dispose();
    geo = new THREE.BoxGeometry(cote, epaisseur, cote);
    const nUni = dalles.filter((d) => !d.labour).length;
    const nLab = dalles.length - nUni;
    uni = new THREE.InstancedMesh(geo, matUni, Math.max(1, nUni));
    labour = new THREE.InstancedMesh(geo, matLabour, Math.max(1, nLab));
    uni.count = nUni;
    labour.count = nLab;
    for (const mesh of [uni, labour]) {
      mesh.receiveShadow = true;
      mesh.name = "dalles-instances";
      // Les dalles bougent d'un cheveu à la sélection : on ne les exclut pas
      // du rendu sur une sphère englobante recalculée à chaque image.
      mesh.frustumCulled = false;
      object.add(mesh);
    }
    let iu = 0;
    let il = 0;
    for (const d of dalles) {
      const mesh = d.labour ? labour : uni;
      const i = d.labour ? il++ : iu++;
      m.makeTranslation(d.px, 0, d.pz);
      mesh.setMatrixAt(i, m);
      const repos = new THREE.Color(d.couleur);
      mesh.setColorAt(i, repos);
      const cle = `${d.x},${d.y}`;
      index.push({ mesh, i, repos, dalle: d, cle });
      parCle.set(cle, d);
    }
    for (const mesh of [uni, labour]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    dernieres = new Float32Array(index.length);
  }

  function animer(teinte: (cle: string, repos: THREE.Color, sortie: THREE.Color) => number) {
    let matrices = false;
    for (let k = 0; k < index.length; k++) {
      const e = index[k]!;
      const lift = teinte(e.cle, e.repos, c);
      e.mesh.setColorAt(e.i, c);
      if (lift !== dernieres[k]) {
        dernieres[k] = lift;
        m.makeTranslation(e.dalle.px, lift, e.dalle.pz);
        e.mesh.setMatrixAt(e.i, m);
        matrices = true;
      }
    }
    for (const mesh of [uni, labour]) {
      if (!mesh) continue;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (matrices) mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    object,
    poser,
    animer,
    a: (cle) => parCle.get(cle),
    dispose() {
      vider();
      geo?.dispose();
      matUni.dispose();
      matLabour.dispose();
    },
  };
}
