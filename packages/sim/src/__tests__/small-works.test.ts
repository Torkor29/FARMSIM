/**
 * Les petits ouvrages doivent rester des paris, pas des paliers.
 *
 * Au-delà de quatre ou cinq bâtiments, construire cessait d'être une décision
 * pour devenir une liste de courses : chacun débloquait une capacité, on les
 * posait tous dans le même ordre. Ces trois-là ne débloquent rien — ils
 * branchent un système sur un autre, et il faut calculer s'ils se
 * rentabilisent.
 *
 * Ce fichier tient les trois règles qu'on s'est données. Si l'un d'eux se met
 * à stocker, à loger, ou à devenir indispensable, c'est ici qu'on le verra.
 */

import { BUILDING_DEFS, CLEAN_COST_CRD, GREASE_COST_CRD } from "@farmsim/shared";

const PETITS = ["SOLAR_PANELS", "WIND_TURBINE", "BEEHIVE"] as const;

describe("les petits ouvrages", () => {
  it("ne stockent rien et ne logent personne", () => {
    // C'est ce qui les distingue du reste du catalogue : aucun ne débloque une
    // capacité, donc aucun n'est un passage obligé.
    for (const t of PETITS) {
      const d = BUILDING_DEFS[t];
      expect({
        t,
        grain: d.storageGrain ?? 0,
        foin: d.storageHay ?? 0,
        machines: d.machineSlots ?? 0,
        bovins: d.cattleSlots ?? 0,
      }).toEqual({ t, grain: 0, foin: 0, machines: 0, bovins: 0 });
    }
  });

  it("tiennent dans un coin de la ferme", () => {
    // Une ruche qui prendrait 3×3 se paierait en terrain, pas en TRN.
    for (const t of PETITS) {
      const d = BUILDING_DEFS[t];
      expect({ t, cases: d.w * d.h }).toEqual({ t, cases: d.w * d.h });
      expect(d.w * d.h).toBeLessThanOrEqual(4);
    }
  });

  it("coûtent moins qu'un bâtiment de production", () => {
    // Ils doivent s'acheter en complément, pas à la place d'une étable.
    const etable = BUILDING_DEFS.CATTLE_BARN.cost;
    for (const t of PETITS) {
      expect(BUILDING_DEFS[t].cost).toBeLessThan(etable);
    }
  });

  it("les panneaux se remboursent en entretiens, pas en une saison", () => {
    /**
     * Le calcul que le joueur doit pouvoir faire : à 20 % de remise sur un
     * graissage et un nettoyage, combien d'entretiens avant d'être rentré dans
     * ses frais ? Assez pour que ce soit un pari sur la taille du parc — trop
     * peu, l'achat serait évident ; trop, personne n'y toucherait.
     */
    const remise = BUILDING_DEFS.SOLAR_PANELS.careDiscount ?? 0;
    expect(remise).toBeGreaterThan(0.1);
    const economieParEntretien = (GREASE_COST_CRD + CLEAN_COST_CRD) * remise;
    const entretiens = BUILDING_DEFS.SOLAR_PANELS.cost / economieParEntretien;
    expect(entretiens).toBeGreaterThan(50);
    expect(entretiens).toBeLessThan(600);
  });

  it("la ruche porte à quelques cases, pas sur toute la parcelle", () => {
    /**
     * C'est le seul bonus du jeu qui dépende de l'endroit où l'on pose le
     * bâtiment, et c'est tout son intérêt. Une portée qui couvrirait les
     * douze cases de large en ferait un bonus global, donc un achat évident
     * et un placement indifférent.
     */
    const r = BUILDING_DEFS.BEEHIVE.pollinationRange ?? 0;
    expect(r).toBeGreaterThan(2);
    expect(r).toBeLessThan(6);
    // Sa surface d'effet doit rester une minorité d'une parcelle de 12×12.
    const couvert = Math.PI * r * r;
    expect(couvert / (12 * 12)).toBeLessThan(0.5);
  });

  it("le gain de la ruche vaut la peine sans écraser la fertilisation", () => {
    const gain = BUILDING_DEFS.BEEHIVE.pollinationBonus ?? 0;
    expect(gain).toBeGreaterThan(0.03);
    expect(gain).toBeLessThan(0.15);
  });
});
