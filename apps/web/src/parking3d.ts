import * as THREE from "three";
import { BAY_ACROSS, BAY_ALONG, parkingSlot, type ParkingLayout } from "@farmsim/shared";
import { Part, box, createBuildingMaterials, cyl, type Role } from "./machine-kit";

/**
 * La cour de stationnement, en volume.
 *
 * Le parc, c'était une case de champ repeinte en brun avec un tracteur posé
 * dessus : « c'est très moche », et c'était surtout une case de blé en moins.
 * On sort donc le parc de la grille et on lui donne un vrai ouvrage.
 *
 * Ce qui fait qu'une aire de stationnement se lit comme telle, et qu'on
 * retrouve ici : une **plateforme de terre** qui la porte comme l'île porte le
 * champ, une **dalle de béton** balayée, des **places peintes** en blanc, une
 * **bordure** de trottoir, un **chemin** qui la raccorde au champ, et deux
 * repères verticaux — mât d'éclairage et panneau — sans quoi une dalle vue de
 * trois quarts reste un rectangle plat.
 *
 * Repère local : `x` = axe des engins (le champ est vers +x), `z` = travers,
 * `y` = hauteur, sol à `y = 0`, une unité = une case.
 */

/** Teintes de la cour : béton clair, terre battue, garde-corps galvanisé. */
const PALETTE = { roof: 0x8f9aa4, wall: 0xc8c6be, timber: 0x7d6a4a, metal: 0xa9b0b6 };

/** Épaisseur de la dalle. */
const SLAB = 0.06;

/** Hauteur du talus de terre qui porte la dalle, comme l'île porte le champ. */
const BASE = 0.28;

/** Blanc des marquages : une matière à part, elle ne vieillit pas comme le béton. */
const PAINT = 0xe8e6df;

export type ParkingRig = {
  group: THREE.Group;
  /** Hauteur du dessus de dalle : c'est là que posent les pneus. */
  deck: number;
  /** Centre de chaque place, en unités locales — l'appelant y pose ses engins. */
  slots: { x: number; z: number }[];
  /** Cap des engins garés, radians : tous nez vers le champ. */
  heading: number;
  dispose(): void;
};

/**
 * Monte la cour pour une emprise donnée.
 *
 * `cellSize` n'entre pas ici : le modèle est coté en cases, comme les
 * bâtiments, et c'est l'appelant qui met le groupe à l'échelle du monde.
 */
export function createParkingRig(
  layout: ParkingLayout,
  opts: { shadows?: boolean; seed?: number } = {},
): ParkingRig {
  const root = new Part();
  const { w, d } = layout;

  // Talus : la cour est un morceau de terrain, pas une dalle en lévitation.
  // Il déborde de la dalle et descend sous le sol, comme la plateforme de l'île.
  root.add("dirt", box(w + 0.34, BASE, d + 0.34, [0, -BASE / 2 + 0.001, 0]));
  // Herbe rase sur le pourtour du talus : la transition terre/béton sans elle
  // fait un liseré noir en vue isométrique.
  root.add("foliage", box(w + 0.3, 0.03, d + 0.3, [0, 0.015, 0]));

  // Dalle balayée.
  root.add("concrete", box(w, SLAB, d, [0, SLAB / 2, 0]));

  /**
   * Bordure de trottoir sur trois côtés.
   *
   * Pas du côté du champ (+x) : c'est par là qu'on entre et qu'on sort, et un
   * bourrelet en travers de l'accès ferait buter les roues.
   */
  const kerb = 0.09;
  root.add("wallDark", box(0.08, kerb, d, [-w / 2 + 0.04, kerb / 2, 0]));
  for (const side of [-1, 1]) {
    root.add("wallDark", box(w, kerb, 0.08, [0, kerb / 2, (side * d) / 2 - side * 0.04]));
  }

  /**
   * Marquage au sol.
   *
   * Une bande **entre** deux places, pas une par place : c'est ainsi qu'on
   * peint un parking, et cela évite le damier de traits qu'on obtient en
   * cernant chaque emplacement. Un butoir ferme le fond de chaque place.
   */
  const slots: { x: number; z: number }[] = [];
  for (let i = 0; i < layout.bays; i++) {
    const { dx, dz } = parkingSlot(i, layout);
    slots.push({ x: dx, z: dz });
  }
  const paint = (pw: number, pd: number, x: number, z: number) => {
    root.add("paint", box(pw, 0.006, pd, [x, SLAB + 0.004, z]));
  };
  for (let row = 0; row < layout.rows; row++) {
    const rowX = ((layout.rows - 1) / 2 - row) * BAY_ALONG;
    for (let line = 0; line <= layout.perRow; line++) {
      const z = (line - layout.perRow / 2) * BAY_ACROSS;
      paint(BAY_ALONG * 0.86, 0.05, rowX, z);
    }
    // Butoir de fond : un merlon de béton bas, qui dit dans quel sens on se gare.
    root.add(
      "wallDark",
      box(0.09, 0.07, layout.perRow * BAY_ACROSS * 0.96, [
        rowX - BAY_ALONG * 0.42,
        SLAB + 0.035,
        0,
      ]),
    );
  }
  // Allée de circulation devant la première rangée : une ligne pointillée.
  const alleeX = w / 2 - 0.16;
  for (let i = 0; i < Math.max(2, Math.round(d / 0.42)); i++) {
    const z = -d / 2 + 0.21 + i * 0.42;
    if (z > d / 2 - 0.1) break;
    paint(0.05, 0.2, alleeX, z);
  }

  /**
   * Chemin d'accès vers le champ.
   *
   * Sans lui, la cour est une île à côté d'une île : on ne comprend pas que
   * les engins en sortent pour aller travailler.
   */
  const path = 0.9;
  root.add("dirt", box(0.75, BASE * 0.9, path, [w / 2 + 0.34, -BASE * 0.45 + 0.001, 0]));
  root.add("concrete", box(0.78, 0.04, path * 0.82, [w / 2 + 0.32, 0.02, 0]));

  /**
   * Mât d'éclairage et panneau.
   *
   * Deux verticales suffisent à donner de la hauteur à une dalle : sans elles
   * la cour disparaît dès qu'on dézoome. Le mât est planté dans un angle, du
   * côté opposé à l'accès pour ne gêner ni la manœuvre ni la lecture.
   */
  const mastX = -w / 2 + 0.22;
  const mastZ = -d / 2 + 0.22;
  root.add("wallDark", box(0.16, 0.05, 0.16, [mastX, SLAB + 0.025, mastZ]));
  root.add("corrugate", cyl(0.032, 0.038, 0.95, 6, [mastX, SLAB + 0.5, mastZ]));
  root.add("corrugate", box(0.22, 0.035, 0.06, [mastX + 0.09, SLAB + 0.96, mastZ]));
  root.add("lamp", box(0.16, 0.05, 0.11, [mastX + 0.16, SLAB + 0.93, mastZ]));

  const signX = w / 2 - 0.2;
  const signZ = d / 2 - 0.18;
  root.add("corrugate", cyl(0.022, 0.022, 0.42, 5, [signX, SLAB + 0.21, signZ]));
  root.add("paint", box(0.024, 0.2, 0.26, [signX, SLAB + 0.5, signZ]));

  const materials = createBuildingMaterials(PALETTE, opts.seed ?? 0, 0.25);
  // Le béton frais et la peinture ne sont pas dans la palette des bâtiments :
  // on les substitue, sinon les marquages se lisent comme du bardage.
  const painted = new THREE.MeshLambertMaterial({ color: PAINT, flatShading: true });
  const own: THREE.Material[] = [painted];
  const kit = { ...materials, paint: painted } as typeof materials;

  const roles = new Map<Role, THREE.Object3D[]>();
  const group = new THREE.Group();
  group.add(root.build(kit, roles, opts.shadows ?? true));

  return {
    group,
    deck: SLAB,
    slots,
    // Les engins regardent le champ : leur modèle pointe vers +x, le champ est
    // à l'est, donc aucun quart de tour à appliquer.
    heading: 0,
    dispose() {
      for (const m of new Set<THREE.Material>([...Object.values(materials), ...own])) m.dispose();
      group.clear();
    },
  };
}
