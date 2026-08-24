import * as THREE from "three";
import { MACHINE_DEFS, MACHINE_TIERS, type MachineType } from "@farmsim/shared";
import { createMachineRig, isTowedImplement } from "../machines3d";

/**
 * Ce que la simulation ne peut pas attraper.
 *
 * Le moteur de jeu est couvert par des centaines de tests ; la partie visible
 * ne l'était pas du tout — et ça s'est vu : deux implémentations des engins
 * ont livré **le même défaut**, des roues enfoncées de trois centimètres dans
 * la dalle. Personne ne l'a vu parce que rien ne le mesurait.
 *
 * Trois.js construit une scène sans le moindre contexte graphique : boîtes
 * englobantes, hiérarchie et matériaux se vérifient donc dans Node, sans
 * navigateur. Ces tests couvrent ce qui casse en silence — l'assiette, les
 * pièces animées, l'entraînement des roues, l'usure.
 */

const TYPES = Object.keys(MACHINE_DEFS) as MachineType[];

/** Bornes verticales d'un engin, après stabilisation des mouvements amortis. */
function verticalBounds(
  type: MachineType,
  opts: { towed: boolean; working: boolean; tier?: 1 | 2 | 3 | 4 | 5 },
) {
  const rig = createMachineRig(type, { towed: opts.towed, shadows: false, tier: opts.tier });
  // Les vérins et la vis sont amortis : il leur faut quelques images pour
  // arriver en butée.
  for (let i = 0; i < 200; i++) {
    rig.update({ t: i * 0.016, distance: 0, working: opts.working });
  }
  const box = new THREE.Box3().setFromObject(rig.group);
  rig.dispose();
  return box;
}

describe("assiette des engins", () => {
  for (const type of TYPES) {
    const towedCases = isTowedImplement(type) ? [false, true] : [false];
    for (const towed of towedCases) {
      for (const working of [false, true]) {
        const label = `${type}${towed ? " attelé" : ""}${working ? " au travail" : " à l'arrêt"}`;

        it(`${label} pose ses roues sur le sol`, () => {
          const box = verticalBounds(type, { towed, working });
          // Deux millimètres de tolérance : c'est la corde d'un pneu à
          // vingt-six facettes, pas un défaut de montage.
          expect(box.min.y).toBeGreaterThan(-0.005);
          expect(box.min.y).toBeLessThan(0.02);
        });

        it(`${label} garde une hauteur plausible`, () => {
          const box = verticalBounds(type, { towed, working });
          // Une case fait une unité : un engin qui la dépasserait en hauteur
          // écraserait la lecture de la parcelle.
          expect(box.max.y).toBeGreaterThan(0.4);
          expect(box.max.y).toBeLessThan(1.2);
        });
      }
    }
  }
});

describe("emprise annoncée", () => {
  for (const type of TYPES) {
    it(`${type} annonce la longueur qu'il occupe vraiment`, () => {
      const rig = createMachineRig(type, { shadows: false });
      const box = new THREE.Box3().setFromObject(rig.group);
      const measured = box.max.x - box.min.x;
      rig.dispose();
      // `length` sert au cadrage de l'atelier et au placement de la
      // poussière : une valeur fantaisiste déréglerait les deux en silence.
      expect(measured).toBeGreaterThan(rig.length * 0.75);
      expect(measured).toBeLessThan(rig.length * 1.25);
    });
  }
});

describe("pièces animées", () => {
  const expected: Record<MachineType, string[]> = {
    TRACTOR: ["wheel", "steer", "beacon", "exhaust"],
    HARVESTER: ["wheel", "steer", "reel", "auger", "tool", "beacon", "exhaust"],
    SPREADER: ["wheel", "spinner"],
    DISC_HARROW: ["wheel", "gang", "tool"],
    // La presse ramasse par un rouleau à dents, comme la moissonneuse
    // rabat par son rabatteur : même rôle, même entraînement à la distance.
    BALER: ["wheel", "reel", "beacon"],
    FORAGE_HARVESTER: ["wheel", "steer", "reel", "beacon", "exhaust"],
    // Les corps de charrue descendent et se relèvent : c'est le geste qui la
    // distingue d'une poutre traînée.
    PLOUGH: ["wheel", "tool"],
    SEEDER: ["wheel", "tool"],
    // Les disques d'un lamier tournent à la prise de force, comme les
    // assiettes d'un épandeur — même rôle, même entraînement au régime.
    MOWER: ["wheel", "tool", "spinner"],
    // La rampe se replie en transport : c'est son geste, comme les corps d'une
    // charrue qui remontent.
    SPRAYER: ["wheel", "tool"],
    // Une remorque ne travaille pas la terre : elle porte. Pas de rôle `tool`.
    TRAILER: ["wheel"],
  };

  for (const type of TYPES) {
    it(`${type} expose ses nœuds animés`, () => {
      const rig = createMachineRig(type, { shadows: false });
      for (const role of expected[type]) {
        expect(rig.anchors(role as never).length).toBeGreaterThan(0);
      }
      rig.dispose();
    });
  }

  it("un automoteur T1 a quatre roues et une sortie de pot", () => {
    const rig = createMachineRig("TRACTOR", { shadows: false });
    expect(rig.anchors("wheel")).toHaveLength(4);
    expect(rig.exhaust).not.toBeNull();
    rig.dispose();
  });

  it("un tracteur T5 pose des chenilles — pas un T4 jumelé agrandi", () => {
    const t4 = createMachineRig("TRACTOR", { shadows: false, tier: 4 });
    const t5 = createMachineRig("TRACTOR", { shadows: false, tier: 5 });
    expect(t4.anchors("wheel").length).toBeGreaterThan(4);
    expect(t5.anchors("wheel").length).toBeGreaterThan(t4.anchors("wheel").length);
    t4.dispose();
    t5.dispose();
  });

  it("un outil dételé n'a pas de pot d'échappement", () => {
    const rig = createMachineRig("DISC_HARROW", { shadows: false });
    expect(rig.exhaust).toBeNull();
    rig.dispose();
  });
});

describe("les roues suivent la distance, pas le temps", () => {
  it("une machine à l'arrêt garde ses roues immobiles", () => {
    const rig = createMachineRig("TRACTOR", { shadows: false });
    rig.update({ t: 12, distance: 0, working: true });
    // `toBe(0)` échouerait sur un zéro négatif, qui est pourtant une roue
    // parfaitement immobile.
    for (const wheel of rig.anchors("wheel")) expect(wheel.rotation.z).toBeCloseTo(0, 10);
    rig.dispose();
  });

  it("une roue fait un tour par circonférence parcourue", () => {
    const rig = createMachineRig("TRACTOR", { shadows: false });
    const wheel = rig.anchors("wheel")[0];
    const radius = wheel.userData.radius as number;
    rig.update({ t: 1, distance: 2 * Math.PI * radius, working: true });
    expect(Math.abs(wheel.rotation.z)).toBeCloseTo(Math.PI * 2, 5);
    rig.dispose();
  });

  it("deux instants différents à distance égale donnent la même roue", () => {
    const rig = createMachineRig("HARVESTER", { shadows: false });
    const wheel = rig.anchors("wheel")[0];
    rig.update({ t: 3, distance: 1.4, working: true });
    const first = wheel.rotation.z;
    rig.update({ t: 9, distance: 1.4, working: true });
    expect(wheel.rotation.z).toBe(first);
    rig.dispose();
  });
});

describe("outil posé au travail, relevé en transport", () => {
  for (const type of ["HARVESTER", "DISC_HARROW", "PLOUGH", "SEEDER", "MOWER", "SPRAYER", "FORAGE_HARVESTER"] as MachineType[]) {
    it(`${type} relève son outil hors chantier`, () => {
      const rig = createMachineRig(type, { shadows: false });
      const settle = (working: boolean) => {
        for (let i = 0; i < 200; i++) rig.update({ t: i * 0.016, distance: 0, working });
        return rig.anchors("tool")[0].position.y;
      };
      const down = settle(true);
      const up = settle(false);
      expect(up).toBeGreaterThan(down + 0.05);
      rig.dispose();
    });
  }
});

describe("l'usure se voit", () => {
  /** Teinte de la carrosserie, seule matière peinte du corps de l'engin. */
  function paintColor(rig: { group: THREE.Object3D }): THREE.Color {
    let found: THREE.Color | null = null;
    rig.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (found || !mesh.isMesh || mesh.name !== "paint") return;
      found = (mesh.material as THREE.MeshStandardMaterial).color;
    });
    if (!found) throw new Error("aucune pièce peinte trouvée");
    return found;
  }

  it("une machine fatiguée est plus terne qu'une neuve", () => {
    const neuve = createMachineRig("TRACTOR", { shadows: false, condition: 100 });
    const usee = createMachineRig("TRACTOR", { shadows: false, condition: 10 });
    const hslNeuve = paintColor(neuve).getHSL({ h: 0, s: 0, l: 0 });
    const hslUsee = paintColor(usee).getHSL({ h: 0, s: 0, l: 0 });
    // La peinture tire vers la terre : elle perd de la saturation.
    expect(hslUsee.s).toBeLessThan(hslNeuve.s);
    neuve.dispose();
    usee.dispose();
  });

  it("une machine bien entretenue reste comme neuve", () => {
    const neuve = createMachineRig("TRACTOR", { shadows: false, condition: 100 });
    const suivie = createMachineRig("TRACTOR", { shadows: false, condition: 80 });
    expect(paintColor(suivie).getHex()).toBe(paintColor(neuve).getHex());
    neuve.dispose();
    suivie.dispose();
  });

  it("l'usure ne déforme pas la machine", () => {
    const box = (condition: number) => {
      const rig = createMachineRig("HARVESTER", { shadows: false, condition });
      const b = new THREE.Box3().setFromObject(rig.group);
      rig.dispose();
      return b;
    };
    const neuve = box(100);
    const usee = box(5);
    expect(usee.min.y).toBeCloseTo(neuve.min.y, 6);
    expect(usee.max.y).toBeCloseTo(neuve.max.y, 6);
  });
});

describe("cinq paliers, cinq silhouettes", () => {
  for (const type of TYPES) {
    for (const tier of MACHINE_TIERS) {
      it(`${type} T${tier} pose ses roues et tient sous le plafond`, () => {
        const box = verticalBounds(type, { towed: false, working: true, tier });
        expect(box.min.y).toBeGreaterThan(-0.005);
        expect(box.min.y).toBeLessThan(0.02);
        expect(box.max.y).toBeLessThan(1.2);
      });
    }

    it(`${type} T5 annonce la longueur qu'il occupe vraiment`, () => {
      const rig = createMachineRig(type, { shadows: false, tier: 5 });
      const box = new THREE.Box3().setFromObject(rig.group);
      const measured = box.max.x - box.min.x;
      rig.dispose();
      expect(measured).toBeGreaterThan(rig.length * 0.75);
      expect(measured).toBeLessThan(rig.length * 1.25);
    });
  }

  it("une charrue T5 a plus de corps qu'une T1", () => {
    const t1 = createMachineRig("PLOUGH", { shadows: false, tier: 1 });
    const t5 = createMachineRig("PLOUGH", { shadows: false, tier: 5 });
    expect(t5.anchors("tool").length).toBeGreaterThan(t1.anchors("tool").length);
    expect(t1.anchors("tool")).toHaveLength(3);
    expect(t5.anchors("tool")).toHaveLength(12);
    t1.dispose();
    t5.dispose();
  });

  it("une faucheuse T5 a plus de disques qu'une T1 — papillon, pas T1 élargi", () => {
    const t1 = createMachineRig("MOWER", { shadows: false, tier: 1 });
    const t5 = createMachineRig("MOWER", { shadows: false, tier: 5 });
    expect(t1.anchors("spinner")).toHaveLength(4);
    expect(t5.anchors("spinner").length).toBeGreaterThan(t1.anchors("spinner").length);
    t1.dispose();
    t5.dispose();
  });

  it("un pulvérisateur T5 déploie une rampe plus large", () => {
    const span = (tier: 1 | 5) => {
      const rig = createMachineRig("SPRAYER", { shadows: false, tier });
      const box = new THREE.Box3().setFromObject(rig.group);
      const w = box.max.z - box.min.z;
      rig.dispose();
      return w;
    };
    expect(span(5)).toBeGreaterThan(span(1) * 1.4);
  });

  it("une presse T5 est plus longue — chambre cubique, plus une ronde agrandie", () => {
    const len = (tier: 1 | 5) => {
      const rig = createMachineRig("BALER", { shadows: false, tier });
      const box = new THREE.Box3().setFromObject(rig.group);
      const x = box.max.x - box.min.x;
      rig.dispose();
      return x;
    };
    expect(len(5)).toBeGreaterThan(len(1));
  });

  it("une remorque T5 a plus de roues qu'une T1 — tridem", () => {
    const t1 = createMachineRig("TRAILER", { shadows: false, tier: 1 });
    const t5 = createMachineRig("TRAILER", { shadows: false, tier: 5 });
    expect(t5.anchors("wheel").length).toBeGreaterThan(t1.anchors("wheel").length);
    t1.dispose();
    t5.dispose();
  });

  it("une moissonneuse T5 est sur quatre chenilles, plus large au bec", () => {
    const t1 = createMachineRig("HARVESTER", { shadows: false, tier: 1 });
    const t4 = createMachineRig("HARVESTER", { shadows: false, tier: 4 });
    const t5 = createMachineRig("HARVESTER", { shadows: false, tier: 5 });
    expect(t1.anchors("wheel")).toHaveLength(4);
    expect(t4.anchors("wheel").length).toBeGreaterThan(4);
    expect(t5.anchors("wheel").length).toBeGreaterThan(t4.anchors("wheel").length);
    const w = (rig: { group: THREE.Object3D }) => {
      const box = new THREE.Box3().setFromObject(rig.group);
      return box.max.z - box.min.z;
    };
    expect(w(t5)).toBeGreaterThan(w(t1));
    t1.dispose();
    t4.dispose();
    t5.dispose();
  });

  it("une ensileuse T5 est sur quatre chenilles, pas un T4 jumelé", () => {
    const t1 = createMachineRig("FORAGE_HARVESTER", { shadows: false, tier: 1 });
    const t4 = createMachineRig("FORAGE_HARVESTER", { shadows: false, tier: 4 });
    const t5 = createMachineRig("FORAGE_HARVESTER", { shadows: false, tier: 5 });
    expect(t5.anchors("wheel").length).toBeGreaterThan(t4.anchors("wheel").length);
    expect(t4.anchors("wheel").length).toBeGreaterThan(t1.anchors("wheel").length);
    t1.dispose();
    t4.dispose();
    t5.dispose();
  });
});
