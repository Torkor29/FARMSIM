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
 * complète de tracteur coûtait 600 € tous les cinq champs, pour un engin qui
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
  machineHoursPerHectare,
  machineLifeHours,
  repairQuote,
  type MachineType,
} from "@farmsim/shared";

const CHAMP = DEFAULT_GRID.w * DEFAULT_GRID.h;

/**
 * Travail principal de chaque engin, celui qu'il enchaîne.
 *
 * Le tracteur n'y figure plus : depuis la séparation porteur / outil, il ne
 * travaille pas — il tire. Son usure se mesure avec l'outil qu'il porte, et
 * `TRAVAILLEURS` ci-dessous est la liste de ceux qui ont un chantier à eux.
 */
const TRAVAIL: Partial<Record<MachineType, string>> = {
  HARVESTER: "HARVEST",
  FORAGE_HARVESTER: "SILAGE",
  PLOUGH: "PLOW",
  SEEDER: "PLANT",
  SPREADER: "FERTILIZE",
  DISC_HARROW: "STUBBLE",
  MOWER: "MOW",
  BALER: "BALE",
  TRAILER: "COLLECT",
};

/** Les engins qui font un travail : tout le parc, moins les porteurs. */
const TRAVAILLEURS = (Object.keys(MACHINE_DEFS) as MachineType[]).filter(
  (t) => MACHINE_DEFS[t].kind !== "TRACTOR",
);

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
  /* Plafond haut : depuis que la largeur de travail décide des heures, un
     outil léger comme le pulvérisateur passe quatre cents champs même à
     l'abandon. À 400, les deux branches de la comparaison butaient sur la
     borne et devenaient égales. */
  for (let champ = 1; champ <= 2000; champ++) {
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
    const h = jobHours(machineHoursPerHectare(type), CHAMP);
    heures += h;
    const usure = applyMachineWear({
      condition: etat.condition,
      hours: h,
      lifeHours: machineLifeHours(type),
      inShed: true,
      careMult: careWearMultiplier({ grease: etat.grease, dirt: etat.dirt }),
    });
    etat = applyJobCare(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...etat, condition: usure.condition } as any,
      { work: TRAVAIL[type] ?? "PLANT", cells: CHAMP, rng: () => 1 },
    ).next as typeof etat;
    if (etat.condition <= def.minCondition) return { champs: champ, heures, entretienCrd };
  }
  return { champs: 2000, heures, entretienCrd };
}

describe("l'usure se compte en heures", () => {
  it("chiffre un champ en heures agricoles plausibles", () => {
    // Un champ de 14 ha, c'est une demi-journée d'homme : entre deux et six
    // heures selon l'engin. C'est ce qui rend le compteur lisible.
    /* Bornes élargies, et pour une bonne raison : ces chiffres ne sont plus
       écrits à la main mais déduits de la largeur et de l'allure. Le parc va
       du pulvérisateur — dix-huit mètres, moins d'une heure — à la charrue —
       deux mètres, presque onze. C'est l'écart réel entre ces deux outils. */
    for (const type of TRAVAILLEURS) {
      const h = jobHours(machineHoursPerHectare(type), CHAMP);
      expect(h).toBeGreaterThan(0.5);
      expect(h).toBeLessThan(12);
    }
  });

  it("laisse le premier champ sans la moindre trace", () => {
    // Le reproche d'origine. Une machine neuve qui sort d'un champ n'a rien à
    // réparer, et son rendement n'a pas bougé d'un pouce.
    for (const type of TRAVAILLEURS) {
      const def = MACHINE_DEFS[type];
      const apres = applyMachineWear({
        condition: 100,
        hours: jobHours(machineHoursPerHectare(type), CHAMP),
        lifeHours: machineLifeHours(type),
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
    for (const type of TRAVAILLEURS) {
      const { champs } = jusquALAtelier(type, true);
      // Mesuré : la moissonneuse, engin le plus gourmand du parc, en tient 57.
      expect(champs).toBeGreaterThanOrEqual(40);
    }
  });

  it("garde la révision loin devant le prix de l'engin", () => {
    /**
     * La règle qui manquait, et le vrai défaut économique : avec l'ancien
     * barème, un tracteur à 2 800 € engloutissait 600 € de révision tous
     * les cinq champs. Sur cent champs — une poignée de saisons — il avait
     * coûté douze mille € de réparations, quatre fois son prix d'achat.
     *
     * Une révision complète doit rester une dépense d'entretien, jamais un
     * rachat déguisé.
     */
    for (const type of TRAVAILLEURS) {
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
     * L'entretien d'une moissonneuse T1 (neuf de petite exploitation) doit se
     * sentir — c'est un poste qu'on cherche à réduire — sans manger la
     * récolte. Quelques pour cent, pas un dixième.
     */
    const def = MACHINE_DEFS.HARVESTER;
    const heures = jobHours(machineHoursPerHectare("HARVESTER"), CHAMP);
    const points = applyMachineWear({
      condition: 100,
      hours: heures,
      lifeHours: machineLifeHours("HARVESTER"),
      careMult: careWearMultiplier({ grease: 100, dirt: 0 }),
    }).wearApplied;
    const usureCrd = points * def.repairCostPerPoint;
    const brut = CHAMP * CROP_DEFS.WHEAT.yieldPerCell * MARKET_BOUNDS.WHEAT.initial;
    expect(usureCrd / brut).toBeGreaterThan(0.01);
    expect(usureCrd / brut).toBeLessThan(0.1);
  });

  it("punit l'abandon sans transformer l'engin en consommable", () => {
    for (const type of TRAVAILLEURS) {
      const soigne = jusquALAtelier(type, true).champs;
      const laisse = jusquALAtelier(type, false).champs;
      expect(laisse).toBeLessThan(soigne);
      expect(laisse).toBeGreaterThanOrEqual(30);
    }
  });

  it("garde la révision douloureuse — c'est une décision, pas un clic", () => {
    /**
     * Une moissonneuse T1 à 200 000 € a une révision à ~40 000 €. Sur une
     * parcelle de quatorze hectares, le rendement perdu ne la rembourse pas
     * en trois champs : c'est voulu. On n'achète (ni ne révise) cette machine
     * que si la ferme a assez de surface pour que le temps de chantier vaille
     * la facture. Sur une grande exploitation, les pertes de la saison
     * dépassent enfin l'atelier.
     */
    const def = MACHINE_DEFS.HARVESTER;
    const usee = def.minCondition + 5;
    const brut = CHAMP * CROP_DEFS.WHEAT.yieldPerCell * MARKET_BOUNDS.WHEAT.initial;
    const perdu = brut * (1 - conditionYieldFactor(usee));
    const revision = repairQuote({
      condition: usee,
      repairCostPerPoint: def.repairCostPerPoint,
    }).cost;
    expect(perdu * 3).toBeLessThan(revision);
    expect(perdu * 24).toBeGreaterThan(revision);
    expect(revision).toBeLessThan(def.cost * 0.3);
  });
});
