import * as THREE from "three";
import { createCropField } from "../crop-field";

/**
 * Le champ doit dire la vérité sur la parcelle.
 *
 * Ce qui se voit sur les brins — leur nombre, leur taille, leur inclinaison —
 * n'est pas de la décoration : c'est le rendement attendu, l'état sanitaire et
 * la fenêtre de récolte. Un signal qui ment est pire qu'un signal absent, d'où
 * ces vérifications.
 */

type Cell = Parameters<ReturnType<typeof createCropField>["setCells"]>[0][number];

function cell(over: Partial<Cell> = {}): Cell {
  return { x: 0, y: 0, px: 0, pz: 0, height: 0.4, color: 0xe8c65c, ...over };
}

describe("semis", () => {
  it("une case semée porte des brins, une case vide n'en porte aucun", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 2, y: 3 })], 1);
    expect(field.stalkCount(2, 3)).toBeGreaterThan(10);
    expect(field.stalkCount(5, 5)).toBe(0);
    field.dispose();
  });

  it("tout le champ tient dans un seul objet de scène", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 0, y: 0 }), cell({ x: 1, y: 0 }), cell({ x: 2, y: 0 })], 1);
    // Un maillage instancié, donc un appel de rendu, quel que soit le nombre
    // de cases : c'est ce qui rend un champ dense soutenable.
    expect((field.object as THREE.InstancedMesh).isInstancedMesh).toBe(true);
    expect(field.object.children).toHaveLength(0);
    field.dispose();
  });

  it("le semis est stable : deux constructions donnent le même champ", () => {
    const field = createCropField(16);
    const cells = [cell({ x: 1, y: 1 }), cell({ x: 2, y: 1 })];
    field.setCells(cells, 1);
    const first = new THREE.Matrix4();
    (field.object as THREE.InstancedMesh).getMatrixAt(7, first);
    field.setCells(cells, 1);
    const second = new THREE.Matrix4();
    (field.object as THREE.InstancedMesh).getMatrixAt(7, second);
    // La vue reconstruit sa scène à chaque rechargement de parcelle : si le
    // semis se redistribuait, le champ scintillerait.
    expect(second.elements).toEqual(first.elements);
    field.dispose();
  });
});

describe("la densité dit le rendement", () => {
  it("une case fumée et désherbée est plus fournie qu'une case affamée", () => {
    const field = createCropField(16);
    field.setCells(
      [cell({ x: 0, y: 0, density: 1 }), cell({ x: 1, y: 0, density: 0.2 })],
      1,
    );
    expect(field.stalkCount(0, 0)).toBeGreaterThan(field.stalkCount(1, 0));
    field.dispose();
  });

  it("même une case au plus mal garde de quoi se lire", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 0, y: 0, density: 0 })], 1);
    // Zéro brin voudrait dire « pas de culture ici », ce qui serait faux :
    // la case est semée, elle est juste en souffrance.
    expect(field.stalkCount(0, 0)).toBeGreaterThan(4);
    field.dispose();
  });
});

describe("la fauche", () => {
  it("ne couche que la case franchie", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 0, y: 0 }), cell({ x: 1, y: 0 })], 1);
    field.cut(0, 0, 4.2);
    expect(field.cutAt(0, 0)).toBe(4.2);
    expect(field.cutAt(1, 0)).toBeNull();
    field.dispose();
  });

  it("garde l'andain quand la scène se reconstruit", () => {
    const field = createCropField(16);
    const cells = [cell({ x: 0, y: 0 })];
    field.setCells(cells, 1);
    field.cut(0, 0, 2);
    // La parcelle est rechargée toutes les quelques secondes : sans cette
    // mémoire, le blé fauché se relèverait derrière la moissonneuse.
    field.setCells(cells, 1);
    expect(field.cutAt(0, 0)).toBe(2);
    field.dispose();
  });

  it("ne rejoue pas la chute d'une case déjà fauchée", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 0, y: 0 })], 1);
    field.cut(0, 0, 1);
    field.cut(0, 0, 9);
    expect(field.cutAt(0, 0)).toBe(1);
    field.dispose();
  });
});

describe("le vent", () => {
  it("se règle sans reconstruire le champ", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 0, y: 0 })], 1);
    const before = field.stalkCount(0, 0);
    // La houle vit dans le nuancier : faire souffler le vent ne doit rien
    // coûter côté processeur, donc rien resemer.
    field.update(3, 1.7);
    expect(field.stalkCount(0, 0)).toBe(before);
    field.dispose();
  });
});
