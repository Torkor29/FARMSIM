import * as THREE from "three";
import { CROP_ACCENT, CROP_DENSITY, cropShape, type CropShape } from "./crop-shapes";

/**
 * Le champ — de vraies tiges, pas un pavé coloré par case.
 *
 * Une culture était rendue par une boîte de 0,55 par case : lisible, mais
 * morte. Une parcelle de blé, c'est d'abord du **mouvement** — la houle du
 * vent sur les épis, et le coup de faux de la moissonneuse qui les couche.
 *
 * Trois choix tiennent l'ensemble :
 *
 * 1. **Une `InstancedMesh` par espèce semée.** Quarante brins par case, cent
 *    quarante-quatre cases : des milliers de tiges en un appel de rendu par
 *    culture présente — au plus six, en pratique une ou deux. Un maillage par
 *    tige aurait mis la vue à genoux ; un maillage unique pour tout le champ
 *    interdisait de donner sa silhouette à chaque culture, et l'orge ne se
 *    distinguait du blé que par sa teinte.
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
const STALKS_PER_CELL = 46;
/**
 * Durée de la chute d'une tige fauchée, secondes.
 *
 * Elle se règle sur l'allure de la machine : la coupe a suivi le ralentissement
 * du chantier, faute de quoi les brins s'abattent d'un coup sec derrière un
 * engin qui, lui, prend son temps.
 */
const CUT_TIME = 0.45;

type CellEntry = {
  x: number;
  y: number;
  px: number;
  pz: number;
  height: number;
  color: number;
  /** Espèce semée : c'est elle qui choisit la forme du brin */
  shape?: CropShape;
  /**
   * Densité du peuplement, 0 à 1. C'est le rendement attendu qui se voit :
   * une case fumée et désherbée est drue, une case affamée ou envahie est
   * clairsemée et laisse voir la terre.
   */
  density?: number;
  /**
   * Affaissement, 0 à 1. Une culture qui a passé son heure ploie avant de
   * verser — c'est le signal qui doit alarmer avant que la perte soit actée.
   */
  droop?: number;
  /**
   * Avancement de l'épi, 0 à 1.
   *
   * L'épi, la gousse et la fleur ne sortent qu'à maturité : à zéro ils sont
   * repliés contre la tige, à un ils sont formés. C'est ce qui remplace
   * l'ancien cube doré posé au-dessus de la case — un vrai épi qui grossit dit
   * la même chose sans rien ajouter à la scène.
   */
  ripe?: number;
};

export type CropField = {
  object: THREE.Object3D;
  /** Espèce semée sur une case, ou `null` si elle n'est pas semée. */
  shapeAt(x: number, y: number): CropShape | null;
  /** Redéfinit le champ. Les cases fauchées récemment gardent leur andain. */
  setCells(cells: CellEntry[], cellSize: number): void;
  /** Fauche une case : ses tiges se couchent à partir de `t`. */
  cut(x: number, y: number, t: number): void;
  /** Nombre de brins plantés sur une case — zéro si elle n'est pas semée. */
  stalkCount(x: number, y: number): number;
  /** Instant de fauche d'une case, ou `null` si elle est encore debout. */
  cutAt(x: number, y: number): number | null;
  /** `wind` : 0 (calme) à 1 (rafale) */
  update(t: number, wind: number): void;
  dispose(): void;
};

/**
 * Un lot d'instances : tout ce qui pousse d'une même espèce, en un appel de
 * rendu. Le lot est recréé quand la parcelle demande plus de brins qu'il n'en
 * tient — recréer coûte moins cher que de réserver six fois la place au cas où.
 */
type Bucket = {
  kind: CropShape;
  mesh: THREE.InstancedMesh;
  material: THREE.Material;
  cut: THREE.InstancedBufferAttribute;
  phase: THREE.InstancedBufferAttribute;
  droop: THREE.InstancedBufferAttribute;
  ripe: THREE.InstancedBufferAttribute;
  capacity: number;
  count: number;
};

/**
 * @param density Facteur de peuplement, 1 = plein.
 *
 * Une parcelle pleine, c'est plusieurs milliers de brins finement découpés :
 * c'est l'élément le plus cher de la vue, et c'est justement celui qu'on
 * regarde. Sur une machine qui peine, on éclaircit le semis plutôt que
 * d'appauvrir la forme — un champ moins dru reste un champ, un champ en
 * bâtonnets n'en est plus un.
 */
export function createCropField(maxCells: number, density = 1): CropField {
  const group = new THREE.Group();
  group.name = "crop-field";
  const sowing = Math.max(0.2, Math.min(1, density));

  const uniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.5 },
  };

  /**
   * Nuancier commun à toutes les espèces.
   *
   * Le vent est calculé ici et non sur le processeur : la tige se courbe en
   * fonction du carré de sa hauteur — le pied reste planté, l'épi balaie.
   * `uAccent` peint les sommets marqués : épi, gousse, fleur.
   */
  function makeMaterial(kind: CropShape): THREE.Material {
    // Les lames sont plates : sans `DoubleSide`, la moitié du champ disparaît
    // selon l'angle de la caméra.
    const material = new THREE.MeshLambertMaterial({ flatShading: true, side: THREE.DoubleSide });
    const accent = { value: new THREE.Color(CROP_ACCENT[kind]) };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uWind = uniforms.uWind;
      shader.uniforms.uAccent = accent;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
           uniform float uTime;
           uniform float uWind;
           uniform vec3 uAccent;
           attribute float aCut;
           attribute float aPhase;
           attribute float aDroop;
           attribute float aRipe;
           attribute float aAccent;
           attribute float aLeaf;`,
        )
        .replace(
          "#include <color_vertex>",
          `#include <color_vertex>
           // Épis, gousses et fleurs prennent la teinte de l'espèce ; la tige
           // garde celle de la case, qui dit la maturité.
           vColor.xyz = mix(vColor.xyz, uAccent, aAccent);`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           // L'épi, la gousse et la fleur sortent avec la maturité : avant
           // l'heure ils sont repliés contre la tige, presque invisibles.
           if (aAccent > 0.5) {
             transformed.x *= aRipe;
             transformed.z *= aRipe;
             transformed.y = mix(transformed.y * 0.6, transformed.y, aRipe);
           }
           // La courbure croît comme le carré de la hauteur : pied planté,
           // épi qui balaie.
           float h = clamp(transformed.y, 0.0, 1.2);

           // La rafale **roule** sur le champ au lieu de le secouer d'un
           // bloc. La phase dépend de la position de la touffe dans le monde,
           // projetée sur la direction du vent : la vague traverse la
           // parcelle, comme une vraie risée sur du blé. C'est le seul détail
           // qui distingue un champ d'un tapis de piquets qui vibrent.
           vec2 cell = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
           float along = dot(cell, vec2(0.82, 0.57));
           float gust = uTime * 1.35 - along * 0.9;
           // Enveloppe lente : le vent vient par bouffées, il ne souffle pas
           // à régime constant.
           float swell = 0.55 + 0.45 * sin(uTime * 0.29 - along * 0.28);

           // Un brin qui ploie oscille moins : il n'a plus la raideur d'une
           // tige verte.
           float stiff = (1.0 - aDroop * 0.6);
           float bend = uWind * h * h * stiff * swell *
             (sin(gust) * 0.055 + sin(gust * 2.1 + aPhase) * 0.018);

           // La feuille frissonne pour son compte : plus court, plus vif, et
           // seulement au bout. Sans elle, toute la plante bouge d'une pièce.
           float flutter = aLeaf * uWind * swell * h *
             sin(uTime * 6.1 + aPhase * 2.3) * 0.012;

           // L'épi est lourd : il suit la tige avec un temps de retard, ce qui
           // lui donne son balancement propre.
           float lag = aAccent * uWind * h * h * stiff * swell * sin(gust - 0.55) * 0.03;

           transformed.x += bend + lag;
           transformed.z += (bend + lag) * 0.45 + flutter;

           // Affaissement : la tige s'arque et perd de la hauteur, sans tomber
           // — la case reste récoltable, mais elle a mauvaise mine.
           if (aDroop > 0.0) {
             transformed.x += aDroop * 0.22 * h * h;
             transformed.y -= aDroop * 0.14 * h;
           }

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
    // Deux matériaux compilés séparément si la clé diffère : on la fixe par
    // espèce pour que toutes les tiges d'une culture partagent un programme.
    material.customProgramCacheKey = () => `crop-field:${kind}`;
    return material;
  }

  const buckets = new Map<CropShape, Bucket>();

  function makeBucket(kind: CropShape, capacity: number): Bucket {
    const material = makeMaterial(kind);
    // La forme du brin est partagée entre tous les champs, mais les attributs
    // d'instance — fauche, maturité, affaissement — sont propres à **ce**
    // champ. Les poser sur la géométrie partagée revenait à ce que deux champs
    // à l'écran se volent leurs données : dans l'atelier, quatre blés et deux
    // colzas se retrouvaient tous à la maturité du dernier construit.
    const mesh = new THREE.InstancedMesh(cropShape(kind).clone(), material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Aucune ombre portée sur la végétation (charte §4.9) : quatre mille brins
    // dans la passe d'ombre ne donneraient que du bruit.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.name = `crop-${kind}`;

    const cut = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(-1), 1);
    const phase = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    const droop = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    const ripe = new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1), 1);
    mesh.geometry.setAttribute("aCut", cut);
    mesh.geometry.setAttribute("aPhase", phase);
    mesh.geometry.setAttribute("aDroop", droop);
    mesh.geometry.setAttribute("aRipe", ripe);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    group.add(mesh);
    return { kind, mesh, material, cut, phase, droop, ripe, capacity, count: 0 };
  }

  /**
   * Lot d'une espèce, dimensionné pour `needed` brins.
   *
   * Les attributs d'instance vivent sur la géométrie **partagée** entre lots :
   * on les repose donc à chaque `setCells`, avant de remplir. Sans cela, deux
   * espèces à l'écran se disputeraient le même tampon de fauche.
   */
  function bucketFor(kind: CropShape, needed: number): Bucket {
    let bucket = buckets.get(kind);
    if (bucket && bucket.capacity < needed) {
      group.remove(bucket.mesh);
      bucket.mesh.dispose();
      bucket.material.dispose();
      buckets.delete(kind);
      bucket = undefined;
    }
    if (!bucket) {
      bucket = makeBucket(kind, Math.max(64, needed));
      buckets.set(kind, bucket);
    }
    return bucket;
  }

  /** Plage d'instances occupée par chaque case, pour la fauche. */
  const ranges = new Map<string, { shape: CropShape; start: number; count: number }>();
  /** Cases fauchées : l'andain doit survivre à une reconstruction du champ. */
  const cutCells = new Map<string, number>();

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  /** Nombre de brins semés sur une case, peuplement et espèce compris. */
  function plantedOn(cell: CellEntry): number {
    const perCell = STALKS_PER_CELL * CROP_DENSITY[cell.shape ?? "WHEAT"] * sowing;
    const health = Math.max(0, Math.min(1, cell.density ?? 1));
    return Math.max(5, Math.round(perCell * (0.34 + 0.66 * health)));
  }

  return {
    object: group,

    setCells(cells, cellSize) {
      ranges.clear();
      // Un premier passage compte, un second remplit : c'est ce qui permet de
      // dimensionner chaque lot exactement, sans réserver six fois la place.
      const need = new Map<CropShape, number>();
      for (const cell of cells) {
        const kind = cell.shape ?? "WHEAT";
        need.set(kind, (need.get(kind) ?? 0) + plantedOn(cell));
      }
      for (const [kind, n] of need) bucketFor(kind, n).count = 0;
      // Une espèce qui n'est plus semée garde son lot — la parcelle change
      // souvent de culture — mais n'affiche plus rien.
      for (const bucket of buckets.values()) if (!need.has(bucket.kind)) bucket.count = 0;

      for (const cell of cells) {
        const kind = cell.shape ?? "WHEAT";
        const bucket = buckets.get(kind)!;
        const { mesh } = bucket;
        const k = `${cell.x},${cell.y}`;
        const start = bucket.count;
        const planted = plantedOn(cell);
        let i = start;
        for (let s = 0; s < planted && i < bucket.capacity; s++, i++) {
          // Semis en quinconce, décalé au hasard mais toujours le même :
          // deux passages de `setCells()` ne doivent pas redistribuer le champ.
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
          // Un peuplement clairsemé est aussi plus chétif : la case affamée
          // n'a pas que des trous, elle a des brins courts.
          const grow = (0.78 + Math.abs(rx) * 0.5) * (0.72 + Math.max(0, Math.min(1, cell.density ?? 1)) * 0.28);
          dummy.scale.set(1, cell.height * grow, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);

          color.setHex(cell.color).offsetHSL(0, 0, rx * 0.05);
          mesh.setColorAt(i, color);
          bucket.phase.setX(i, (cell.px + cell.pz) * 1.6 + s * 0.7);
          bucket.droop.setX(i, Math.max(0, Math.min(1, cell.droop ?? 0)) * (0.7 + Math.abs(rz)));
          // Un épi par brin ne mûrit pas exactement comme son voisin.
          bucket.ripe.setX(i, Math.max(0, Math.min(1, (cell.ripe ?? 1) * (0.88 + Math.abs(rx) * 0.3))));
          bucket.cut.setX(i, cutCells.get(k) ?? -1);
        }
        bucket.count = i;
        ranges.set(k, { shape: kind, start, count: i - start });
      }

      for (const bucket of buckets.values()) {
        bucket.mesh.count = bucket.count;
        bucket.mesh.instanceMatrix.needsUpdate = true;
        if (bucket.mesh.instanceColor) bucket.mesh.instanceColor.needsUpdate = true;
        bucket.cut.needsUpdate = true;
        bucket.phase.needsUpdate = true;
        bucket.droop.needsUpdate = true;
        bucket.ripe.needsUpdate = true;
      }
    },

    shapeAt(x, y) {
      const range = ranges.get(`${x},${y}`);
      return range && range.count > 0 ? range.shape : null;
    },

    stalkCount(x, y) {
      return ranges.get(`${x},${y}`)?.count ?? 0;
    },

    cutAt(x, y) {
      return cutCells.get(`${x},${y}`) ?? null;
    },

    cut(x, y, t) {
      const k = `${x},${y}`;
      if (cutCells.has(k)) return;
      cutCells.set(k, t);
      const range = ranges.get(k);
      if (!range) return;
      const bucket = buckets.get(range.shape);
      if (!bucket) return;
      for (let i = range.start; i < range.start + range.count; i++) {
        // Un léger décalage par tige : la coupe balaie la case au lieu de
        // tomber d'un bloc.
        bucket.cut.setX(i, t + (i - range.start) * 0.012);
      }
      bucket.cut.needsUpdate = true;
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
      for (const bucket of buckets.values()) {
        bucket.material.dispose();
        bucket.mesh.geometry.dispose();
        bucket.mesh.dispose();
      }
      buckets.clear();
      group.clear();
      ranges.clear();
      cutCells.clear();
    },
  };
}
