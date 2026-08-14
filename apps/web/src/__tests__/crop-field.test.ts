import * as THREE from "three";
import { createCropField } from "../crop-field";
import { cropShape, cropShapeHeight } from "../crop-shapes";

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

describe("le brin", () => {
  it("porte des feuilles, un épi, et distingue les deux", () => {
    // `aAccent` peint l'épi et le fait sortir à maturité ; `aLeaf` donne à la
    // feuille son frisson propre. Sans ces deux marques, la plante bouge d'une
    // pièce et le colza est un buisson uniformément jaune, tige comprise.
    for (const kind of ["WHEAT", "BARLEY", "MAIZE", "PEA", "RAPE", "GRASS"] as const) {
      const geo = cropShape(kind);
      const accent = geo.getAttribute("aAccent");
      const leafy = geo.getAttribute("aLeaf");
      expect(`${kind} accent ${accent !== undefined}`).toBe(`${kind} accent true`);
      let ears = 0;
      let leaves = 0;
      for (let i = 0; i < accent.count; i++) {
        if (accent.getX(i) > 0.5) ears++;
        if (leafy.getX(i) > 0.5) leaves++;
      }
      expect(`${kind} épi ${ears > 0}`).toBe(`${kind} épi true`);
      expect(`${kind} feuille ${leaves > 0}`).toBe(`${kind} feuille true`);
      // Un brin tout en épi n'aurait plus de plante autour.
      expect(`${kind} mesure ${ears < accent.count * 0.8}`).toBe(`${kind} mesure true`);
    }
  });

  it("reste sous le plafond de triangles", () => {
    // Cinq mille brins par parcelle, contre huit bêtes : c'est l'élément le
    // plus cher de la vue, et celui qu'on regarde le plus.
    for (const kind of ["WHEAT", "BARLEY", "MAIZE", "PEA", "RAPE", "GRASS"] as const) {
      const geo = cropShape(kind);
      const n = geo.index ? geo.index.count : geo.getAttribute("position").count;
      expect(`${kind} ${n / 3 < 120}`).toBe(`${kind} true`);
    }
  });

  it("aucune culture ne dépasse ni ne rase le sol", () => {
    // L'instance étire le brin à la hauteur voulue par la case. Le port propre
    // à l'espèce se garde — un pois est plus bas qu'un blé, et doit le rester —
    // mais aucune ne doit sortir du fuseau : trop haute elle masquerait
    // l'engin au travail, trop basse elle disparaîtrait de la parcelle.
    for (const kind of ["WHEAT", "BARLEY", "MAIZE", "PEA", "RAPE", "GRASS"] as const) {
      const h = cropShapeHeight(kind);
      expect(`${kind} ${h > 0.55 && h < 1.15}`).toBe(`${kind} true`);
    }
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
