import * as THREE from "three";
import {
  MACHINE_CATALOG,
  MACHINE_DEFS,
  MACHINE_TIERS,
  TIER_SCALE_MAX,
  machineTierScale,
  type MachineType,
} from "@farmsim/shared";
import { isoOrthoFrustum } from "../machine-framing";
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

  it("un tracteur T5 a quatre bogies distincts, pas deux barres fusionnées", () => {
    const rig = createMachineRig("TRACTOR", { shadows: false, tier: 5 });
    const xs = rig.anchors("wheel").map((w) => {
      const p = new THREE.Vector3();
      w.getWorldPosition(p);
      return p.x;
    });
    const rear = xs.filter((x) => x < 0);
    const front = xs.filter((x) => x > 0);
    expect(rear.length).toBeGreaterThan(0);
    expect(front.length).toBeGreaterThan(0);
    expect(Math.max(...rear)).toBeLessThan(Math.min(...front) - 0.1);
    rig.dispose();
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
    expect(t1.anchors("wheel")).toHaveLength(2);
    expect(t5.anchors("wheel").length).toBeGreaterThan(t1.anchors("wheel").length);
    t1.dispose();
    t5.dispose();
  });

  it("une faucheuse T3 est déjà un combiné, plus une barre unique", () => {
    const t1 = createMachineRig("MOWER", { shadows: false, tier: 1 });
    const t3 = createMachineRig("MOWER", { shadows: false, tier: 3 });
    expect(t3.anchors("spinner").length).toBeGreaterThan(t1.anchors("spinner").length);
    t1.dispose();
    t3.dispose();
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
    const xs = t5.anchors("wheel").map((node) => {
      const p = new THREE.Vector3();
      node.getWorldPosition(p);
      return p.x;
    });
    expect(Math.max(...xs.filter((x) => x < -0.4))).toBeLessThan(
      Math.min(...xs.filter((x) => x > -0.35)) - 0.08,
    );
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

/**
 * La stature des paliers.
 *
 * Les tests ci-dessus vérifient le **détail** : plus de corps de charrue,
 * plus de roues, une rampe plus large. Aucun ne vérifiait que l'engin est
 * réellement plus **gros**, ni que la progression est régulière du T1 au T5.
 * C'est précisément ce qui manquait : la vignette cadrant sur la boîte
 * englobante, un T5 occupait la même place qu'un T1 à l'écran, et personne
 * ne pouvait le voir en lisant le code.
 */
describe("la stature grandit à chaque palier", () => {
  const TYPES = Object.keys(MACHINE_CATALOG) as (keyof typeof MACHINE_CATALOG)[];

  it.each(TYPES)("%s grossit strictement du T1 au T5", (type) => {
    const echelles = MACHINE_TIERS.map((t) => machineTierScale(type, t));
    for (let i = 1; i < echelles.length; i++) {
      expect({ type, palier: i + 1, plusGrand: echelles[i]! > echelles[i - 1]! }).toEqual({
        type,
        palier: i + 1,
        plusGrand: true,
      });
    }
  });

  it("part de un et culmine au plafond commun, pour tous les types", () => {
    // Un écart commun, et non proportionnel au catalogue : un semoir passe de
    // 3 à 24,4 m et un tracteur de 105 à 830 ch. À l'échelle exacte, le T5
    // écraserait tout le reste — et la largeur d'un pulvérisateur mesure sa
    // rampe déployée, pas son encombrement.
    for (const type of TYPES) {
      expect(machineTierScale(type, 1)).toBeCloseTo(1, 6);
      expect(machineTierScale(type, 5)).toBeCloseTo(TIER_SCALE_MAX, 6);
    }
  });

  it("place les paliers au rythme du catalogue, pas à intervalle égal", () => {
    /*
     * La remorque grandit peu jusqu'au T2 (2,5 → 2,6 m) puis franchit un cap
     * au T5 (3,1 → 3,4). Le pulvérisateur fait l'inverse : il bondit dès le
     * T2 (15 → 24 m) puis se tasse. Si les deux montaient par cinquièmes
     * égaux, l'échelle n'apprendrait rien qu'on ne sache déjà.
     */
    const pas = (type: keyof typeof MACHINE_CATALOG) =>
      MACHINE_TIERS.slice(1).map((t, i) => machineTierScale(type, t) - machineTierScale(type, MACHINE_TIERS[i]!));
    const remorque = pas("TRAILER");
    const pulve = pas("SPRAYER");
    expect(remorque[3]!).toBeGreaterThan(remorque[0]!);
    expect(pulve[0]!).toBeGreaterThan(pulve[3]!);
  });

  it("la fenêtre de cadrage s'élargit quand la stature baisse", () => {
    // Le mécanisme qui rend la stature visible : à modèle identique, un
    // palier bas se regarde de plus loin. Sans cela le cadrage annulerait
    // tout, ce qu'il faisait.
    const box = new THREE.Box3(new THREE.Vector3(-1, 0, -0.5), new THREE.Vector3(1, 0.8, 0.5));
    const plein = isoOrthoFrustum(box, 1.4, 1.5, 1);
    const bas = isoOrthoFrustum(box, 1.4, 1.5, 1 / TIER_SCALE_MAX);
    expect(bas.frustum).toBeGreaterThan(plein.frustum);
    expect(bas.frustum / plein.frustum).toBeCloseTo(TIER_SCALE_MAX, 3);
  });

  it("sans stature donnée, le cadrage ne bouge pas", () => {
    // La vue de ferme et la campagne appellent sans ce paramètre : elles
    // doivent retrouver exactement le cadrage d'avant.
    const box = new THREE.Box3(new THREE.Vector3(-1, 0, -0.5), new THREE.Vector3(1, 0.8, 0.5));
    expect(isoOrthoFrustum(box, 1.4).frustum).toBeCloseTo(isoOrthoFrustum(box, 1.4, 1.5, 1).frustum, 9);
  });
});

describe("les paliers ne régressent pas en géométrie", () => {
  it("la presse gagne en encombrement à chaque palier", () => {
    /*
     * On mesure le **volume** de la boîte, pas la hauteur — et c'est le
     * cœur de l'affaire. Le T5 n'est pas une ronde agrandie mais une presse
     * **cubique** (`buildSquareBaler`), longue et basse là où la ronde est
     * haute et courte. Comparer les hauteurs déclarerait donc le T5 plus
     * petit que le T4, ce qui est vrai et sans intérêt : ce sont deux
     * machines de forme différente.
     *
     * Le volume est la bonne mesure d'un « plus gros » qui traverse un
     * changement de forme.
     */
    const encombrement = (tier: 1 | 4 | 5) => {
      const rig = createMachineRig("BALER", { shadows: false, tier });
      const box = new THREE.Box3().setFromObject(rig.group);
      const v =
        (box.max.x - box.min.x) * (box.max.y - box.min.y) * (box.max.z - box.min.z);
      rig.dispose();
      return v;
    };
    expect(encombrement(4)).toBeGreaterThan(encombrement(1));
    expect(encombrement(5)).toBeGreaterThan(encombrement(4));
  });

  it("le tracteur annonce une longueur qui monte à chaque palier", () => {
    // Elle valait `tracks ? 1.95 : 1.35` : quatre paliers sur cinq
    // annonçaient la même, alors que c'est elle qui espace les engins dans
    // la vue de ferme.
    const longueurs = MACHINE_TIERS.map((tier) => {
      const rig = createMachineRig("TRACTOR", { shadows: false, tier });
      const l = rig.length;
      rig.dispose();
      return l;
    });
    for (let i = 1; i < longueurs.length; i++) {
      expect({ palier: i + 1, monte: longueurs[i]! >= longueurs[i - 1]! }).toEqual({
        palier: i + 1,
        monte: true,
      });
    }
    expect(longueurs[4]!).toBeGreaterThan(longueurs[0]!);
    expect(new Set(longueurs).size).toBeGreaterThan(2);
  });
});
