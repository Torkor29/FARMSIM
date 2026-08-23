import * as THREE from "three";
import { BETES_MAX, casesSemees, creerVoisinDetaille } from "../voisin3d";
import { planCampagne, type OptionsPlan, type VoisinReel } from "../countryside-plan";

/**
 * Une parcelle de voisin, en détail.
 *
 * « La parcelle devait ressembler à la nôtre avec des cultures, élevage, tout
 * ça. » Les champs alentour étaient un damier de couleur : de loin ça passait,
 * de près c'était du papier peint.
 *
 * Ce qu'on vérifie ici, c'est que les vrais modules du jeu sont bien à
 * l'œuvre — brins instanciés, bâtiments, bêtes — et que rien ne fuit quand la
 * parcelle repasse en nappe.
 */

const EMPRISE = 12 * 1.06 + 1.4;

const OPTIONS: OptionsPlan = {
  graine: "clos-d-orme",
  emprise: EMPRISE,
  cour: { x: -11.5, z: 2.5, w: 6, d: 9 },
};

function voisin(p: Partial<VoisinReel> = {}): VoisinReel {
  return {
    id: "p-1-0",
    label: "Champ d'Orme",
    col: 1,
    rang: 0,
    statut: "PNJ",
    proprietaire: "Ferme Duval",
    exploitation: "Duval",
    culture: "WHEAT",
    stade: "READY",
    partCultivee: 1,
    fertility: 0.7,
    batiments: [],
    cheptel: [],
    prix: null,
    achetable: false,
    refus: null,
    ...p,
  };
}

function parcelleDe(v: VoisinReel) {
  const plan = planCampagne({ ...OPTIONS, voisins: [v] });
  const p = plan.parcelles[0];
  if (!p) throw new Error("la parcelle n'a pas été posée");
  return { plan, p };
}

function detail(v: VoisinReel) {
  const { plan, p } = parcelleDe(v);
  return creerVoisinDetaille({
    parcelle: p,
    emprise: plan.emprise,
    cases: 12,
    y: -0.44,
  });
}

/** Compte les brins instanciés, toutes espèces confondues. */
function brins(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((x) => {
    if (x instanceof THREE.InstancedMesh) n += x.count;
  });
  return n;
}

describe("les cultures du voisin", () => {
  it("plante de vrais brins, et non un aplat", () => {
    const d = detail(voisin());
    expect(brins(d.object)).toBeGreaterThan(500);
    d.dispose();
  });

  it("n’en plante aucun sur une terre nue", () => {
    for (const stade of ["HARVESTED", "PREPARED", null]) {
      const d = detail(voisin({ stade }));
      expect(brins(d.object)).toBe(0);
      d.dispose();
    }
  });

  it("en plante moins sur un champ à moitié emblavé", () => {
    const plein = detail(voisin({ partCultivee: 1 }));
    const demi = detail(voisin({ partCultivee: 0.5 }));
    expect(brins(demi.object)).toBeGreaterThan(0);
    expect(brins(demi.object)).toBeLessThan(brins(plein.object) * 0.7);
    plein.dispose();
    demi.dispose();
  });

  it("les tient dans la parcelle", () => {
    // Un brin qui déborde pousserait dans le chemin, ou chez le voisin d'à
    // côté — et la trame se lirait de travers.
    const d = detail(voisin());
    d.object.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(d.object);
    const demi = EMPRISE / 2;
    expect(b.min.x).toBeGreaterThan(d.object.position.x - demi);
    expect(b.max.x).toBeLessThan(d.object.position.x + demi);
    expect(b.min.z).toBeGreaterThan(d.object.position.z - demi);
    expect(b.max.z).toBeLessThan(d.object.position.z + demi);
    d.dispose();
  });
});

describe("le semis se répartit", () => {
  it("prend exactement la part annoncée", () => {
    expect(casesSemees(12, 1, 7)).toHaveLength(144);
    expect(casesSemees(12, 0.5, 7)).toHaveLength(72);
    expect(casesSemees(12, 0, 7)).toHaveLength(0);
  });

  it("ne prend jamais deux fois la même case", () => {
    for (const part of [0.13, 0.37, 0.5, 0.66, 0.9]) {
      const k = casesSemees(12, part, 42);
      expect(new Set(k).size).toBe(k.length);
      for (const i of k) expect(i).toBeLessThan(144);
    }
  });

  it("répartit au lieu de grouper", () => {
    /*
     * Le défaut qu'on évite : `n` cases prises dans l'ordre feraient un
     * rectangle plein en haut du champ et une bande nue en bas. Un champ à
     * moitié semé se voit clairsemé, pas coupé en deux.
     */
    const k = casesSemees(12, 0.5, 3);
    const hautes = k.filter((i) => Math.floor(i / 12) < 6).length;
    expect(hautes).toBeGreaterThan(k.length * 0.35);
    expect(hautes).toBeLessThan(k.length * 0.65);
  });

  it("rend le même semis à la même graine", () => {
    expect(casesSemees(12, 0.4, 11)).toEqual(casesSemees(12, 0.4, 11));
  });

  it("ne boucle pas quand le pas divise la grille", () => {
    // Un pas et un total qui partagent un diviseur enferment la suite dans un
    // sous-ensemble : sans garde-fou, la boucle ne se terminerait jamais.
    for (const n of [4, 6, 8, 10, 12, 16]) {
      expect(casesSemees(n, 0.5, 5)).toHaveLength(Math.round(n * n * 0.5));
    }
  });
});

describe("le bâti et les bêtes", () => {
  it("pose les vrais bâtiments, à leur place sur la grille", () => {
    const d = detail(
      voisin({ batiments: [{ type: "CATTLE_BARN", level: 1, x: 1, y: 1, rotation: 0 }] }),
    );
    const batis = d.object.children.filter((c) => c.name === "voisin-batiment");
    expect(batis).toHaveLength(1);
    // Un vrai modèle et non une boîte : bardage, toit, portes, soubassement.
    let volumes = 0;
    batis[0]!.traverse((x) => {
      if (x instanceof THREE.Mesh) volumes++;
    });
    expect(volumes).toBeGreaterThan(4);
    d.dispose();
  });

  it("montre une poignée de bêtes, jamais tout le troupeau", () => {
    /*
     * Trente vaches modélisées coûteraient plus que toute la campagne réunie,
     * et à cette distance on ne les compte pas — on voit qu'il y en a.
     */
    const d = detail(voisin({ cheptel: [{ kind: "COW", size: 40 }] }));
    const betes = d.object.children.filter((c) => c.name === "voisin-bete");
    expect(betes.length).toBeLessThanOrEqual(BETES_MAX);
    expect(betes.length).toBeGreaterThan(0);
    d.dispose();
  });

  it("n’en met aucune sans cheptel", () => {
    const d = detail(voisin({ cheptel: [] }));
    expect(d.object.children.filter((c) => c.name === "voisin-bete")).toHaveLength(0);
    d.dispose();
  });
});

describe("l’animation", () => {
  it("fait brouter et marcher, sans jamais quitter le champ", () => {
    const d = detail(voisin({ cheptel: [{ kind: "COW", size: 6 }] }));
    const betes = d.object.children.filter((c) => c.name === "voisin-bete");
    const demi = EMPRISE / 2;
    const vus = new Set<string>();
    for (let t = 0; t < 200; t += 1.3) {
      d.update(t, 0.4);
      for (const b of betes) {
        expect(Math.abs(b.position.x)).toBeLessThan(demi);
        expect(Math.abs(b.position.z)).toBeLessThan(demi);
        vus.add(`${b.position.x.toFixed(1)},${b.position.z.toFixed(1)}`);
      }
    }
    // Elles bougent : une bête plantée est un décor, pas un troupeau.
    expect(vus.size).toBeGreaterThan(betes.length);
    d.dispose();
  });
});

describe("le démontage", () => {
  it("ne laisse rien derrière lui", () => {
    const d = detail(
      voisin({
        batiments: [{ type: "SILO", level: 1, x: 2, y: 2, rotation: 1 }],
        cheptel: [{ kind: "SHEEP", size: 8 }],
      }),
    );
    d.dispose();
    expect(d.object.children).toHaveLength(0);
  });
});
