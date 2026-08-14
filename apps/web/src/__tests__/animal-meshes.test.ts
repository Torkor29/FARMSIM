import * as THREE from "three";
import { createAnimalRig, type AnimalKind } from "../animal-meshes";

/**
 * Les bêtes, mesurées.
 *
 * Une bête n'a pas qu'à être jolie : elle doit **dire** l'état de l'élevage.
 * Le jeu suit le bien-être et la production en attente depuis le début, mais
 * la parcelle n'en montrait rien — il fallait ouvrir un panneau pour savoir
 * qu'un lot allait mal. Ces tests vérifient que le signal existe vraiment sur
 * le modèle, et qu'il ne casse ni l'aplomb ni l'échelle.
 */

const KINDS: AnimalKind[] = ["COW", "SHEEP", "HEN", "PIG"];

function bounds(kind: AnimalKind, look = {}) {
  const rig = createAnimalRig(kind, look);
  const box = new THREE.Box3().setFromObject(rig.group);
  rig.dispose();
  return box;
}

/** Sommets portés par une matière donnée. */
function vertsOf(rig: { group: THREE.Object3D }, material: string): number {
  let n = 0;
  rig.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && mesh.name === material) n += mesh.geometry.getAttribute("position").count;
  });
  return n;
}

/** Teinte d'une matière, pour juger le ternissement. */
function hslOf(rig: { group: THREE.Object3D }, material: string) {
  let found: THREE.Color | null = null;
  rig.group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (found || !mesh.isMesh || mesh.name !== material) return;
    found = (mesh.material as THREE.MeshStandardMaterial).color;
  });
  if (!found) throw new Error(`matière ${material} absente`);
  return (found as THREE.Color).getHSL({ h: 0, s: 0, l: 0 });
}

describe("aplomb et échelle", () => {
  for (const kind of KINDS) {
    it(`${kind} pose ses pattes au sol`, () => {
      const box = bounds(kind);
      expect(box.min.y).toBeGreaterThan(-0.01);
      expect(box.min.y).toBeLessThan(0.02);
    });

    it(`${kind} tient sous la hauteur d'une case`, () => {
      const box = bounds(kind);
      // Une bête plus haute qu'une case masquerait la parcelle derrière elle.
      expect(box.max.y).toBeGreaterThan(0.1);
      expect(box.max.y).toBeLessThan(0.85);
    });
  }

  it("les quatre espèces ne font pas la même taille", () => {
    const heights = KINDS.map((k) => bounds(k).max.y);
    // Une poule aussi haute qu'une vache serait illisible de loin.
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights) * 1.8);
  });
});

describe("l'état de l'élevage se voit", () => {
  it("une bête mal tenue a le poil plus terne", () => {
    for (const kind of KINDS) {
      const bien = createAnimalRig(kind, { welfare: 1 });
      const mal = createAnimalRig(kind, { welfare: 0 });
      expect(hslOf(mal, "hide").s).toBeLessThan(hslOf(bien, "hide").s);
      bien.dispose();
      mal.dispose();
    }
  });

  it("une vache qu'on n'a pas traite a le pis plus gros", () => {
    const box = (y: number) => {
      const rig = createAnimalRig("COW", { welfare: 1, yield: y });
      const udder = rig.joints.udder!;
      rig.group.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(udder);
      rig.dispose();
      return b.max.x - b.min.x;
    };
    expect(box(1)).toBeGreaterThan(box(0) * 1.15);
  });

  it("une brebis tondue n'a plus de laine", () => {
    const laineuse = createAnimalRig("SHEEP", { yield: 1 });
    const tondue = createAnimalRig("SHEEP", { sheared: true });
    expect(vertsOf(tondue, "wool")).toBe(0);
    expect(vertsOf(laineuse, "wool")).toBeGreaterThan(0);
    laineuse.dispose();
    tondue.dispose();
  });

  it("la toison grossit entre deux tontes", () => {
    const size = (y: number) => {
      const rig = createAnimalRig("SHEEP", { yield: y });
      const b = new THREE.Box3().setFromObject(rig.group);
      rig.dispose();
      return b.max.x - b.min.x;
    };
    expect(size(1)).toBeGreaterThan(size(0));
  });

  it("l'état ne fait jamais décoller ni enterrer la bête", () => {
    for (const kind of KINDS) {
      for (const welfare of [0, 0.5, 1]) {
        for (const y of [0, 1]) {
          const box = bounds(kind, { welfare, yield: y });
          expect(box.min.y).toBeGreaterThan(-0.01);
          expect(box.max.y).toBeLessThan(0.85);
        }
      }
    }
  });
});

describe("le squelette", () => {
  const COMMON = ["body", "neck", "head", "jaw", "tail", "legFL", "legFR"] as const;

  for (const kind of KINDS) {
    it(`${kind} expose ses articulations`, () => {
      const rig = createAnimalRig(kind);
      for (const j of COMMON) expect(rig.joints[j]).toBeDefined();
      rig.dispose();
    });
  }

  it("un quadrupède a quatre pattes, une poule deux", () => {
    const cow = createAnimalRig("COW");
    const hen = createAnimalRig("HEN");
    expect(cow.joints.legBL).toBeDefined();
    expect(hen.joints.legBL).toBeUndefined();
    expect(hen.joints.wingL).toBeDefined();
    cow.dispose();
    hen.dispose();
  });

  it("seule la vache porte un pis", () => {
    for (const kind of KINDS) {
      const rig = createAnimalRig(kind);
      expect(Boolean(rig.joints.udder)).toBe(kind === "COW");
      rig.dispose();
    }
  });
});

describe("l'animation", () => {
  it("le pas suit la distance, pas le temps", () => {
    const rig = createAnimalRig("COW");
    rig.update({ t: 2, distance: 0.3, walking: true });
    const first = rig.joints.legFL!.rotation.x;
    rig.update({ t: 40, distance: 0.3, walking: true });
    expect(rig.joints.legFL!.rotation.x).toBeCloseTo(first, 12);
    rig.dispose();
  });

  it("les pattes marchent en diagonale", () => {
    const rig = createAnimalRig("COW");
    rig.update({ t: 1, distance: 0.15, walking: true });
    const fl = rig.joints.legFL!.rotation.x;
    const fr = rig.joints.legFR!.rotation.x;
    const br = rig.joints.legBR!.rotation.x;
    // Avant gauche et arrière droit vont ensemble : c'est l'allure d'un
    // quadrupède. Les quatre en phase donnent un jouet à ressort.
    expect(Math.sign(fl)).toBe(Math.sign(br));
    expect(Math.sign(fl)).toBe(-Math.sign(fr));
    rig.dispose();
  });

  it("à l'arrêt, les pattes ne battent pas", () => {
    const rig = createAnimalRig("COW");
    rig.update({ t: 7, distance: 3.3, walking: false });
    expect(rig.joints.legFL!.rotation.x).toBeCloseTo(0, 9);
    rig.dispose();
  });

  it("elle rumine sans arrêt", () => {
    const rig = createAnimalRig("COW");
    rig.update({ t: 0 });
    const a = rig.joints.jaw!.rotation.x;
    rig.update({ t: 0.4 });
    expect(rig.joints.jaw!.rotation.x).not.toBeCloseTo(a, 4);
    rig.dispose();
  });

  it("brouter baisse la tête", () => {
    const rig = createAnimalRig("COW");
    rig.update({ t: 1, graze: 0 });
    const haut = rig.joints.neck!.rotation.x;
    rig.update({ t: 1, graze: 1 });
    expect(rig.joints.neck!.rotation.x).toBeGreaterThan(haut + 0.5);
    rig.dispose();
  });

  it("couchée, la bête descend et replie ses pattes sous elle", () => {
    const rig = createAnimalRig("COW");
    for (let i = 0; i < 400; i++) rig.update({ t: i * 0.016, resting: false });
    const debout = rig.joints.body!.position.y;
    for (let i = 0; i < 400; i++) rig.update({ t: i * 0.016, resting: true });
    expect(rig.joints.body!.position.y).toBeLessThan(debout * 0.75);
    // Avant et arrière se replient en sens contraire : dans le même sens, la
    // bête fait le grand écart.
    expect(Math.sign(rig.joints.legFL!.rotation.x)).toBe(
      -Math.sign(rig.joints.legBL!.rotation.x),
    );
    rig.dispose();
  });

  it("le troupeau n'est pas un ballet", () => {
    const a = createAnimalRig("COW");
    const b = createAnimalRig("COW");
    a.update({ t: 3, seed: 0 });
    b.update({ t: 3, seed: 1.7 });
    // Deux bêtes qui balancent la queue à l'unisson trahissent la mécanique.
    expect(a.joints.tail!.rotation.z).not.toBeCloseTo(b.joints.tail!.rotation.z, 3);
    a.dispose();
    b.dispose();
  });

  it("aucune pose ne fait passer la bête sous le sol", () => {
    // Le garrot ne tient qu'à quelques millimètres du sol : toute pose qui
    // baisse le corps enfonce les sabots dans la terre si on n'y prend pas
    // garde. Marche, pâture et repos sont balayés pour chaque espèce.
    for (const kind of KINDS) {
      for (const resting of [false, true]) {
        const rig = createAnimalRig(kind, { welfare: 0 });
        let lowest = Infinity;
        for (let i = 0; i < 260; i++) {
          rig.update({ t: i * 0.03, distance: i * 0.05, walking: !resting, graze: 0.5, resting });
          rig.group.updateMatrixWorld(true);
          lowest = Math.min(lowest, new THREE.Box3().setFromObject(rig.group).min.y);
        }
        expect(`${kind}${resting ? " couchée" : ""} ${lowest > -0.03}`).toBe(
          `${kind}${resting ? " couchée" : ""} true`,
        );
        rig.dispose();
      }
    }
  });
});
