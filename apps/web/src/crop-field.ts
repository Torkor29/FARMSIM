import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { markShared } from "./three-cleanup";

/**
 * Le champ — de vraies tiges, pas un pavé coloré par case.
 *
 * Une culture était rendue par une boîte de 0,55 par case : lisible, mais
 * morte. Une parcelle de blé, c'est d'abord du **mouvement** — la houle du
 * vent sur les épis, et le coup de faux de la moissonneuse qui les couche.
 *
 * Trois choix tiennent l'ensemble :
 *
 * 1. **Une seule `InstancedMesh` pour tout le champ.** Douze tiges par case,
 *    cent quarante-quatre cases : ~1 700 tiges en **un seul appel de rendu**.
 *    Une par maillage aurait mis la vue à genoux.
 * 2. **Le vent est calculé dans le nuancier**, pas sur le processeur : la
 *    tige se courbe en fonction du carré de sa hauteur — le pied reste planté,
 *    l'épi balaie. Deux sinusoïdes déphasées suffisent à casser la régularité.
 * 3. **La fauche est un instant, pas un interrupteur.** Chaque tige porte
 *    l'heure à laquelle elle a été coupée ; le nuancier la couche et la
 *    raccourcit en un tiers de seconde. La moissonneuse laisse donc un
 *    andain derrière elle au lieu d'un champ qui clignote.
 */

/**
 * Densité du semis. Quarante brins par case, c'est ce qu'il faut pour qu'une
 * parcelle lise comme une masse d'épis et non comme quelques piquets plantés
 * dans un aplat. Le coût tient parce que le brin est une lame plate.
 */
const STALKS_PER_CELL = 40;
/** Durée de la chute d'une tige fauchée, secondes */
const CUT_TIME = 0.35;

type CellEntry = { x: number; y: number; px: number; pz: number; height: number; color: number };

export type CropField = {
  object: THREE.Object3D;
  /** Redéfinit le champ. Les cases fauchées récemment gardent leur andain. */
  setCells(cells: CellEntry[], cellSize: number): void;
  /** Fauche une case : ses tiges se couchent à partir de `t`. */
  cut(x: number, y: number, t: number): void;
  /** `wind` : 0 (calme) à 1 (rafale) */
  update(t: number, wind: number): void;
  dispose(): void;
};

/**
 * Un brin : une lame plate à trois segments — c'est elle qui se courbe — et
 * son épi en pointe. Quatorze faces en tout, hauteur unitaire, l'instance
 * l'étire à la hauteur voulue. Un chaume tourné en volume aurait coûté trois
 * fois plus pour un gain nul à cette échelle.
 */
function stalkGeometry(): THREE.BufferGeometry {
  const blade = new THREE.PlaneGeometry(0.045, 0.82, 1, 3);
  blade.translate(0, 0.41, 0);
  const ear = new THREE.ConeGeometry(0.022, 0.22, 4);
  ear.translate(0, 0.88, 0);
  const geo = mergeGeometries([blade.toNonIndexed(), ear.toNonIndexed()], false)!;
  blade.dispose();
  ear.dispose();
  return markShared(geo);
}

let sharedStalk: THREE.BufferGeometry | null = null;

export function createCropField(maxCells: number): CropField {
  if (!sharedStalk) sharedStalk = stalkGeometry();
  const capacity = Math.max(1, maxCells * STALKS_PER_CELL);

  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.5 },
  };

  // Les lames sont plates : sans `DoubleSide`, la moitié du champ disparaît
  // selon l'angle de la caméra.
  const material = new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uTime;
         uniform float uWind;
         attribute float aCut;
         attribute float aPhase;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         // La courbure croît comme le carré de la hauteur : pied planté,
         // épi qui balaie. Deux fréquences pour que la houle ne soit pas
         // un métronome.
         float h = clamp(transformed.y, 0.0, 1.2);
         float bend = uWind * h * h *
           (sin(uTime * 1.7 + aPhase) * 0.055 + sin(uTime * 3.3 + aPhase * 1.7) * 0.022);
         transformed.x += bend;
         transformed.z += bend * 0.45;

         // Fauche : la tige se couche vers l'avant en se tassant.
         if (aCut >= 0.0) {
           float k = clamp((uTime - aCut) / ${CUT_TIME.toFixed(2)}, 0.0, 1.0);
           float fall = k * k * (3.0 - 2.0 * k);
           transformed.y *= 1.0 - 0.86 * fall;
           transformed.x += 0.42 * fall * h;
           transformed.z += 0.12 * fall * h;
         }`,
      );
  };
  // Deux matériaux compilés séparément si la clé diffère : on la fixe pour que
  // les tiges partagent un seul programme.
  material.customProgramCacheKey = () => "crop-field";

  const mesh = new THREE.InstancedMesh(sharedStalk, material, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Aucune ombre portée sur la végétation (charte §4.9) : quatre mille brins
  // dans la passe d'ombre ne donneraient que du bruit.
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  mesh.count = 0;

  const cutAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(-1), 1);
  const phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
  mesh.geometry.setAttribute("aCut", cutAttr);
  mesh.geometry.setAttribute("aPhase", phaseAttr);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);

  /** Plage d'instances occupée par chaque case, pour la fauche. */
  const ranges = new Map<string, { start: number; count: number }>();
  /** Cases fauchées : l'andain doit survivre à une reconstruction du champ. */
  const cutCells = new Map<string, number>();

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  return {
    object: mesh,

    setCells(cells, cellSize) {
      ranges.clear();
      let i = 0;
      for (const cell of cells) {
        const k = `${cell.x},${cell.y}`;
        const start = i;
        for (let s = 0; s < STALKS_PER_CELL && i < capacity; s++, i++) {
          // Semis en quinconce, décalé au hasard mais toujours le même :
          // deux passages de `layout()` ne doivent pas redistribuer le champ.
          const noise = Math.sin((cell.x * 12.9 + cell.y * 78.2 + s * 37.7) * 1.7) * 43758.5453;
          const rx = (noise % 1) - 0.5;
          const rz = ((noise * 1.37) % 1) - 0.5;
          // Semis en quinconce sur une grille 8 × 5, brouillée par le bruit :
          // régulier de loin, jamais aligné de près.
          const spread = cellSize * 0.86;
          const gx = ((s % 8) - 3.5) / 8;
          const gz = (Math.floor(s / 8) - 2) / 5;
          dummy.position.set(
            cell.px + (gx + rx * 0.09) * spread,
            0.09,
            cell.pz + (gz + rz * 0.09) * spread,
          );
          dummy.rotation.set(0, noise % Math.PI, 0);
          const grow = 0.78 + Math.abs(rx) * 0.5;
          dummy.scale.set(1, cell.height * grow, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);

          color.setHex(cell.color).offsetHSL(0, 0, rx * 0.05);
          mesh.setColorAt(i, color);
          phaseAttr.setX(i, (cell.px + cell.pz) * 1.6 + s * 0.7);
          cutAttr.setX(i, cutCells.get(k) ?? -1);
        }
        ranges.set(k, { start, count: i - start });
      }
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      cutAttr.needsUpdate = true;
      phaseAttr.needsUpdate = true;
    },

    cut(x, y, t) {
      const k = `${x},${y}`;
      if (cutCells.has(k)) return;
      cutCells.set(k, t);
      const range = ranges.get(k);
      if (!range) return;
      for (let i = range.start; i < range.start + range.count; i++) {
        // Un léger décalage par tige : la coupe balaie la case au lieu de
        // tomber d'un bloc.
        cutAttr.setX(i, t + (i - range.start) * 0.012);
      }
      cutAttr.needsUpdate = true;
    },

    update(t, wind) {
      uniforms.uTime.value = t;
      uniforms.uWind.value = wind;
      // Une case resemée redevient debout : on oublie sa fauche passée.
      if (cutCells.size > 0) {
        for (const [k, at] of cutCells) {
          if (t - at > 60) cutCells.delete(k);
        }
      }
    },

    dispose() {
      material.dispose();
      mesh.dispose();
      ranges.clear();
      cutCells.clear();
    },
  };
}
