/**
 * Combien de champs une machine encaisse avant l'atelier.
 *
 * Ce fichier existe à cause d'un message de joueur : « je lance un champ, faut
 * déjà le réparer au max ». Mesuré, il avait raison, et de loin.
 *
 * L'unité de jeu est le champ entier — « Tout sélectionner » travaille les 144
 * cases d'une parcelle d'un seul geste. Or l'usure et la saleté étaient
 * calibrées au geste isolé :
 *
 *   - un semis de 144 cases déposait **86 points de saleté** pour un seuil
 *     « sale » à 25 : la machine était sale dès son premier champ, à vie ;
 *   - franchir ce seuil multipliait l'usure par deux, sans rien annoncer ;
 *   - conséquence, le deuxième champ coûtait 2,7 fois le premier, et un
 *     tracteur neuf tombait sous son seuil de blocage en deux passages. Une
 *     moissonneuse à 4 000 TRN était un consommable de deux moissons.
 *
 * Les assertions ci-dessous fixent la cadence en champs, pas en cases : c'est
 * la seule échelle où la question « est-ce que je révise ? » se pose.
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
  WEAR_FIELDS_TARGET,
  conditionYieldFactor,
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
 * Enchaîne des champs entiers et rend le nombre de passages tenus.
 * `entretient` : le joueur regraisse et nettoie quand le jeu le lui signale.
 */
function champsTenus(type: MachineType, entretient: boolean) {
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
  for (let champ = 1; champ <= 40; champ++) {
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
    const usure = applyMachineWear({
      condition: etat.condition,
      wearPerCell: def.wearPerCell,
      cells: CHAMP,
      inShed: true,
      careMult: careWearMultiplier({ grease: etat.grease, dirt: etat.dirt }),
    });
    etat = applyJobCare(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...etat, condition: usure.condition } as any,
      { work: TRAVAIL[type], cells: CHAMP, rng: () => 1 },
    ).next as typeof etat;
    if (etat.condition <= def.minCondition) return { champs: champ, entretienCrd };
  }
  return { champs: 40, entretienCrd };
}

describe("une machine se compte en champs, pas en cases", () => {
  it("garde le premier champ loin du rouge, sur toutes les machines", () => {
    // Le reproche exact du joueur. Après un seul passage d'une machine neuve,
    // il ne doit rien y avoir à réparer.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const def = MACHINE_DEFS[type];
      const apres = applyMachineWear({
        condition: 100,
        wearPerCell: def.wearPerCell,
        cells: CHAMP,
        careMult: careWearMultiplier({ grease: 100, dirt: 0 }),
      }).condition;
      expect(apres).toBeGreaterThan(80);
    }
  });

  it("tient la cadence annoncée quand on l'entretient", () => {
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const { champs } = champsTenus(type, true);
      expect(champs).toBeGreaterThanOrEqual(WEAR_FIELDS_TARGET);
    }
  });

  it("punit l'abandon sans le rendre fatal", () => {
    // Ne jamais graisser ni nettoyer doit coûter, mais pas transformer la
    // machine en consommable : c'était exactement le défaut d'avant.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const soigne = champsTenus(type, true).champs;
      const laisse = champsTenus(type, false).champs;
      expect(laisse).toBeLessThan(soigne);
      expect(laisse).toBeGreaterThanOrEqual(3);
    }
  });

  it("laisse l'entretien courant très en dessous de la révision", () => {
    // Sinon le bon geste est de ne rien faire et de réviser d'un coup.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const { entretienCrd } = champsTenus(type, true);
      const revision = repairQuote({
        condition: MACHINE_DEFS[type].minCondition,
        repairCostPerPoint: MACHINE_DEFS[type].repairCostPerPoint,
      }).cost;
      expect(entretienCrd).toBeLessThan(revision);
    }
  });

  it("garde la révision rentable au moment où elle se présente", () => {
    /**
     * Le ralentissement de l'usure ne doit pas rendre l'atelier facultatif.
     * Quand la moissonneuse arrive au bout de ses champs, le rendement perdu
     * sur le champ suivant doit dépasser le prix de la révision — c'est ce qui
     * fait de la révision un calcul plutôt qu'une corvée.
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
