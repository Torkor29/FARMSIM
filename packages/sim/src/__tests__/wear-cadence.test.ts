/**
 * Ce qu'une machine coûte sur sa vie.
 *
 * Ce fichier a changé deux fois d'échelle, à chaque fois sur signalement d'un
 * joueur, et c'est la deuxième correction qui touche le fond.
 *
 * D'abord l'usure se comptait à la case, et un semis de 144 cases déposait
 * assez de saleté pour doubler l'usure du passage suivant : un tracteur neuf
 * se bloquait en deux champs. Corrigé — mais seulement dans ses proportions.
 *
 * Le défaut de fond était ailleurs, et il est économique : une révision
 * complète de tracteur coûtait 600 TRN tous les cinq champs, pour un engin qui
 * en vaut 2 800. Sur sa vie, la machine se payait plusieurs fois en
 * réparations. « Un tracteur ça meurt pas en 2 jours » — non, en effet.
 *
 * L'usure se compte donc en **heures de travail**, et les assertions
 * ci-dessous tiennent la règle qui manquait : l'entretien d'un bien
 * d'équipement doit peser peu devant ce qu'il produit.
 */

import { applyJobCare, applyMachineWear, careWearMultiplier } from "../index";
import {
  CLEAN_COST_CRD,
  CROP_DEFS,
  DIRT_DIRTY_THRESHOLD,
  DEFAULT_GRID,
  GREASE_COST_CRD,
  GREASE_OK,
  MACHINE_DEFS,
  MARKET_BOUNDS,
  conditionYieldFactor,
  jobHours,
  repairQuote,
  type MachineType,
} from "@farmsim/shared";

const CHAMP = DEFAULT_GRID.w * DEFAULT_GRID.h;

/** Travail principal de chaque machine, celui qu'elle enchaîne. */
const TRAVAIL: Record<MachineType, string> = {
  TRACTOR: "PLANT",
  HARVESTER: "HARVEST",
  SPREADER: "FERTILIZE",
  DISC_HARROW: "STUBBLE",
  BALER: "BALE",
  FORAGE_HARVESTER: "SILAGE",
};

/**
 * Enchaîne des champs entiers jusqu'à l'atelier et rend ce que ça a coûté.
 * `entretient` : le joueur regraisse et nettoie quand le jeu le lui signale.
 */
function jusquALAtelier(type: MachineType, entretient: boolean) {
  const def = MACHINE_DEFS[type];
  let etat = {
    condition: 100,
    greased: true,
    grease: 100,
    dirt: 0,
    greaseSkipStreak: 0,
    breakdown: null as null | string,
  };
  let entretienCrd = 0;
  let heures = 0;
  for (let champ = 1; champ <= 400; champ++) {
    if (entretient) {
      if (etat.grease < GREASE_OK) {
        etat = { ...etat, grease: 100, greased: true, greaseSkipStreak: 0 };
        entretienCrd += GREASE_COST_CRD;
      }
      if (etat.dirt >= DIRT_DIRTY_THRESHOLD) {
        etat = { ...etat, dirt: 0 };
        entretienCrd += CLEAN_COST_CRD;
      }
    }
    const h = jobHours(def.hoursPerHectare, CHAMP);
    heures += h;
    const usure = applyMachineWear({
      condition: etat.condition,
      hours: h,
      lifeHours: def.lifeHours,
      inShed: true,
      careMult: careWearMultiplier({ grease: etat.grease, dirt: etat.dirt }),
    });
    etat = applyJobCare(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...etat, condition: usure.condition } as any,
      { work: TRAVAIL[type], cells: CHAMP, rng: () => 1 },
    ).next as typeof etat;
    if (etat.condition <= def.minCondition) return { champs: champ, heures, entretienCrd };
  }
  return { champs: 400, heures, entretienCrd };
}

describe("l'usure se compte en heures", () => {
  it("chiffre un champ en heures agricoles plausibles", () => {
    // Un champ de 14 ha, c'est une demi-journée d'homme : entre deux et six
    // heures selon l'engin. C'est ce qui rend le compteur lisible.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const h = jobHours(MACHINE_DEFS[type].hoursPerHectare, CHAMP);
      expect(h).toBeGreaterThan(1.5);
      expect(h).toBeLessThan(6);
    }
  });

  it("laisse le premier champ sans la moindre trace", () => {
    // Le reproche d'origine. Une machine neuve qui sort d'un champ n'a rien à
    // réparer, et son rendement n'a pas bougé d'un pouce.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const def = MACHINE_DEFS[type];
      const apres = applyMachineWear({
        condition: 100,
        hours: jobHours(def.hoursPerHectare, CHAMP),
        lifeHours: def.lifeHours,
        careMult: careWearMultiplier({ grease: 100, dirt: 0 }),
      }).condition;
      expect(apres).toBeGreaterThan(98);
      expect(conditionYieldFactor(apres)).toBe(1);
    }
  });
});

describe("une machine coûte moins qu'elle ne rapporte", () => {
  it("tient des dizaines de champs avant l'atelier", () => {
    // « Un tracteur ça meurt pas en 2 jours. » Le minimum est posé haut
    // volontairement : c'est la borne qui a sauté deux fois.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const { champs } = jusquALAtelier(type, true);
      expect(champs).toBeGreaterThanOrEqual(60);
    }
  });

  it("garde la révision loin devant le prix de l'engin", () => {
    /**
     * La règle qui manquait, et le vrai défaut économique : avec l'ancien
     * barème, un tracteur à 2 800 TRN engloutissait 600 TRN de révision tous
     * les cinq champs. Sur cent champs — une poignée de saisons — il avait
     * coûté douze mille TRN de réparations, quatre fois son prix d'achat.
     *
     * Une révision complète doit rester une dépense d'entretien, jamais un
     * rachat déguisé.
     */
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const def = MACHINE_DEFS[type];
      const revision = repairQuote({
        condition: def.minCondition,
        repairCostPerPoint: def.repairCostPerPoint,
      }).cost;
      expect(revision).toBeLessThan(def.cost * 0.3);
    }
  });

  it("pèse quelques pour cent d'une saison, pas le dixième", () => {
    /**
     * Le chiffre qui a motivé le changement : mesuré en jeu, l'entretien du
     * parc mangeait 9,6 % du revenu net d'une saison sur une seule parcelle.
     * Pour du matériel amorti sur des années, c'est un ordre de grandeur trop
     * haut.
     *
     * On rapporte ici le coût d'un champ moissonné au revenu de ce champ.
     */
    const def = MACHINE_DEFS.HARVESTER;
    const heures = jobHours(def.hoursPerHectare, CHAMP);
    const points = applyMachineWear({
      condition: 100,
      hours: heures,
      lifeHours: def.lifeHours,
      careMult: careWearMultiplier({ grease: 100, dirt: 0 }),
    }).wearApplied;
    const usureCrd = points * def.repairCostPerPoint;
    const brut = CHAMP * CROP_DEFS.WHEAT.yieldPerCell * MARKET_BOUNDS.WHEAT.initial;
    expect(usureCrd / brut).toBeLessThan(0.01);
  });

  it("punit l'abandon sans transformer l'engin en consommable", () => {
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const soigne = jusquALAtelier(type, true).champs;
      const laisse = jusquALAtelier(type, false).champs;
      expect(laisse).toBeLessThan(soigne);
      expect(laisse).toBeGreaterThanOrEqual(30);
    }
  });

  it("garde la révision rentable au moment où elle se présente", () => {
    /**
     * Ralentir l'usure ne doit pas rendre l'atelier facultatif : quand la
     * machine arrive en bas, le rendement perdu sur le champ suivant doit
     * dépasser la facture. C'est ce qui fait de la révision un calcul.
     */
    const def = MACHINE_DEFS.HARVESTER;
    const usee = def.minCondition + 5;
    const brut = CHAMP * CROP_DEFS.WHEAT.yieldPerCell * MARKET_BOUNDS.WHEAT.initial;
    const perdu = brut * (1 - conditionYieldFactor(usee));
    const revision = repairQuote({
      condition: usee,
      repairCostPerPoint: def.repairCostPerPoint,
    }).cost;
    expect(perdu).toBeGreaterThan(revision);
  });
});
