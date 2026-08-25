import * as THREE from "three";

export type IsoOrthoFit = {
  /** Cible monde : même hauteur que le centre de la boîte. */
  lookAtY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Demi-hauteur visible, utile aux tests. */
  frustum: number;
};

/** Échantillons de lacet : un cran de trop et un gyrophare passe au-dessus. */
const YAWS = 16;

/**
 * Fenêtre ortho pour qu'un engin tienne dans la vignette, y compris quand
 * le plateau tourne.
 *
 * Un cadrage symétrique autour de l'origine caméra (`±max |y|`) collait le
 * toit au bord : en iso, la trémie (loin, en haut) n'est pas en face de la
 * coupe (près, en bas). On cadre le **rectangle projeté**, centré, avec une
 * marge — et un peu plus de ciel que de sol, parce que le socle remplit déjà
 * le bas.
 */
export function isoOrthoFrustum(
  box: THREE.Box3,
  aspect: number,
  pad = 1.5,
  /**
   * Stature du palier, de 0 à 1 : 1 remplit le cadre, 0,6 n'en occupe que
   * les trois cinquièmes.
   *
   * ## Pourquoi ce paramètre existe
   *
   * Cadrer sur la boîte englobante **annule toute différence de taille** :
   * la caméra recule d'autant que l'engin est gros, et un T5 occupe donc
   * exactement la même place qu'un T1. Toute la montée en gamme se voyait
   * dans le détail — plus de corps de charrue, quatre chenilles — et jamais
   * dans la stature. Le joueur qui paie quatre-vingt-dix mille euros voyait
   * la même machine, en plus fournie.
   *
   * On élargit donc la fenêtre à mesure que le palier baisse. Le résultat
   * ne dépend que de la stature, jamais de la géométrie : un palier qui
   * gagne un essieu ne rétrécit pas pour autant, il montre son essieu de
   * plus **à taille croissante**.
   *
   * Un par défaut : sans stature donnée, on retrouve exactement le cadrage
   * d'avant, ce dont dépendent la vue de ferme et la campagne.
   */
  stature = 1,
): IsoOrthoFit {
  const center = box.getCenter(new THREE.Vector3());
  const lookAtY = center.y;
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
  cam.position.set(9, 7.35 + lookAtY, 9);
  cam.lookAt(0, lookAtY, 0);
  cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < YAWS; k++) {
    const yaw = (k / YAWS) * Math.PI * 2;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    for (const c of corners) {
      const p = new THREE.Vector3(c.x * cy + c.z * sy, c.y, -c.x * sy + c.z * cy);
      p.applyMatrix4(inv);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
  }

  const a = aspect > 0.15 ? aspect : 1;
  const cx = (minX + maxX) / 2;
  const cyCam = (minY + maxY) / 2;
  let halfW = ((maxX - minX) / 2) * pad;
  let halfH = ((maxY - minY) / 2) * pad;
  halfW = Math.max(halfW, 0.4);
  halfH = Math.max(halfH, 0.4);
  if (halfW / halfH > a) halfH = halfW / a;
  else halfW = halfH * a;

  // Plus de ciel que de terre : le socle occupe déjà le bas, c'est le toit
  // qui passait au-dessus du cadre quand le plateau tournait.
  const sky = halfH * 0.16;
  halfH += sky / 2;
  halfW = halfH * a;

  // La stature agrandit la fenêtre, elle ne rétrécit pas l'engin : c'est le
  // même modèle, vu de plus loin. Bornée pour qu'une valeur aberrante ne
  // renvoie pas une vignette vide.
  const recul = 1 / Math.min(1, Math.max(0.2, stature));
  halfH *= recul;
  halfW *= recul;

  return {
    lookAtY,
    left: cx - halfW,
    right: cx + halfW,
    top: cyCam + halfH + sky / 2,
    bottom: cyCam - halfH + sky / 2,
    frustum: halfH,
  };
}
