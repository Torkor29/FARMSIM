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

/** Le maillage instancié d'une espèce, s'il y en a un. */
function meshOf(field: ReturnType<typeof createCropField>, kind: string) {
  return field.object.children.find(
    (o) => o.name === `crop-${kind}`,
  ) as THREE.InstancedMesh | undefined;
}

describe("semis", () => {
  it("une case semée porte des brins, une case vide n'en porte aucun", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 2, y: 3 })], 1);
    expect(field.stalkCount(2, 3)).toBeGreaterThan(10);
    expect(field.stalkCount(5, 5)).toBe(0);
    field.dispose();
  });

  it("une culture ne coûte qu'un appel de rendu, quel que soit le nombre de cases", () => {
    const field = createCropField(16);
    field.setCells(
      Array.from({ length: 12 }, (_, i) => cell({ x: i % 4, y: Math.floor(i / 4) })),
      1,
    );
    // Un maillage instancié par espèce semée : c'est ce qui rend un champ
    // dense soutenable. Douze cases de blé n'en font toujours qu'un.
    expect(field.object.children).toHaveLength(1);
    expect(meshOf(field, "WHEAT")!.isInstancedMesh).toBe(true);
    field.dispose();
  });

  it("chaque culture a sa propre forme de brin", () => {
    const field = createCropField(16);
    field.setCells(
      [
        cell({ x: 0, y: 0, shape: "WHEAT" }),
        cell({ x: 1, y: 0, shape: "BARLEY" }),
        cell({ x: 2, y: 0, shape: "RAPE" }),
      ],
      1,
    );
    expect(field.object.children).toHaveLength(3);
    const counts = ["WHEAT", "BARLEY", "RAPE"].map(
      (k) => meshOf(field, k)!.geometry.getAttribute("position").count,
    );
    // Trois géométries identiques voudraient dire qu'on ne distingue les
    // cultures qu'à la teinte — ce qui revient à ne pas les distinguer.
    expect(new Set(counts).size).toBe(3);
    field.dispose();
  });

  it("une case sait quelle culture elle porte", () => {
    const field = createCropField(16);
    field.setCells([cell({ x: 0, y: 0, shape: "MAIZE" })], 1);
    expect(field.shapeAt(0, 0)).toBe("MAIZE");
    expect(field.shapeAt(3, 3)).toBeNull();
    field.dispose();
  });

  it("le semis est stable : deux constructions donnent le même champ", () => {
    const field = createCropField(16);
    const cells = [cell({ x: 1, y: 1 }), cell({ x: 2, y: 1 })];
    field.setCells(cells, 1);
    const first = new THREE.Matrix4();
    meshOf(field, "WHEAT")!.getMatrixAt(7, first);
    field.setCells(cells, 1);
    const second = new THREE.Matrix4();
    meshOf(field, "WHEAT")!.getMatrixAt(7, second);
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
