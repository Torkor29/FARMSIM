/**
 * L'état d'une machine, et ce qu'il coûte.
 *
 * Ce fichier existe parce que l'usure ne coûtait rien. Elle se calculait à
 * chaque chantier, se réparait contre de l'argent, et n'entrait dans aucun
 * rendement : une moissonneuse à 13 % de condition ramassait autant qu'une
 * machine neuve. Elle n'agissait que de deux façons, toutes deux tout-ou-rien
 * — bloquer sous `minCondition`, et tirer une panne au sort sous 50 %.
 *
 * Le joueur n'avait donc aucune raison d'entretenir au-dessus du seuil de
 * blocage : on repoussait jusqu'à la panne. Les assertions ci-dessous fixent
 * la forme de la perte, pour que ce calcul reste un calcul.
 */

import { applyMachineWear, careWearMultiplier, careYieldBonus, repairMachineCost } from "../index";
import {
  CONDITION_FULL_POWER,
  CONDITION_WORST_FACTOR,
  CROP_DEFS,
  MACHINE_DEFS,
  MARKET_BOUNDS,
  jobHours,
  machineHoursPerHectare,
  machineLifeHours,
  conditionYieldFactor,
} from "@farmsim/shared";

describe("l’usure se paie en rendement", () => {
  it("ne coûte rien tant que la machine est bonne", () => {
    // Il faut une plage où entretenir davantage ne rapporte plus rien, sinon
    // le joueur passe sa partie à l'atelier.
    expect(conditionYieldFactor(100)).toBe(1);
    expect(conditionYieldFactor(CONDITION_FULL_POWER)).toBe(1);
    expect(conditionYieldFactor(CONDITION_FULL_POWER + 5)).toBe(1);
  });

  it("coûte de plus en plus, et sans marche d’escalier", () => {
    // Une perte par paliers se contourne : on se cale juste au-dessus du
    // palier et on n'entretient plus. Une pente continue ne se contourne pas.
    const paliers = [80, 70, 60, 50, 40, 30, 20, 10, 0];
    for (let i = 1; i < paliers.length; i++) {
      expect(conditionYieldFactor(paliers[i])).toBeLessThan(
        conditionYieldFactor(paliers[i - 1]),
      );
    }
  });

  it("tient les valeurs annoncées au joueur", () => {
    expect(conditionYieldFactor(40)).toBeCloseTo(0.85, 3);
    expect(conditionYieldFactor(20)).toBeCloseTo(0.775, 3);
    expect(conditionYieldFactor(0)).toBeCloseTo(CONDITION_WORST_FACTOR, 3);
  });

  it("ne descend jamais sous le plancher, ni au-dessus du plein", () => {
    for (const c of [-50, 0, 13, 55, 99, 100, 500]) {
      const f = conditionYieldFactor(c);
      expect(f).toBeGreaterThanOrEqual(CONDITION_WORST_FACTOR);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it("pèse plus lourd que le soin courant — c’est ce qui hiérarchise les gestes", () => {
    // Graisser et nettoyer valent au mieux +8 %. Réviser une machine à bout
    // en vaut le double : la révision doit primer sur le coup de chiffon.
    const soin = careYieldBonus({ grease: 100, dirt: 0 });
    const revision = 1 - conditionYieldFactor(12);
    expect(revision).toBeGreaterThan(soin);
  });
});

describe("ce que ça change sur une vraie moissonneuse", () => {
  const def = MACHINE_DEFS.HARVESTER;
  const CASES = 12 * 12;

  /** Une moisson de parcelle entière, machine tenue propre et graissée. */
  function apresChamps(n: number): number {
    let c = 100;
    for (let i = 0; i < n; i++) {
      c = applyMachineWear({
        condition: c,
        hours: jobHours(machineHoursPerHectare("HARVESTER"), CASES),
        lifeHours: machineLifeHours("HARVESTER"),
        careMult: careWearMultiplier({ grease: 100, dirt: 0 }),
      }).condition;
    }
    return c;
  }

  it("garde le plein rendement sur son premier champ", () => {
    // La perte ne doit pas se sentir dès le premier chantier d'une machine
    // neuve : ce serait punir l'usage même de l'engin qu'on vient de payer.
    expect(conditionYieldFactor(apresChamps(1))).toBe(1);
  });

  it("ne se dégrade qu'après plusieurs parcelles", () => {
    /**
     * Prémisse corrigée, et deux fois plutôt qu'une.
     *
     * Une première session avait écrit « une saison d'oubli », mesuré 46 points
     * par champ, et conclu que l'engin était « un consommable de deux
     * chantiers ». Elle a inscrit ce chiffre ici comme s'il était l'intention.
     * Il ne l'était pas : c'était le symptôme. Un joueur l'a signalé dans ces
     * termes — « je lance un champ, faut déjà le réparer au max ».
     *
     * La bonne échelle est le champ, pas la case, et la bonne cadence est la
     * saison : plusieurs parcelles avant que l'usure ne se voie, la révision
     * quand elle se voit. Voir `wear-cadence.test.ts` pour le détail.
     */
    /*
     * Mesuré : 1,16 point par parcelle bien tenue, contre 46 au départ.
     *
     * Le chiffre a bougé une seconde fois en devenant plus juste : les heures
     * par hectare ne sont plus écrites à la main mais déduites de la largeur
     * de coupe et de la vitesse d'avancement. Une moissonneuse de 4,20 m à
     * 6 km/h met sept heures pour quatorze hectares — c'est un chantier réel,
     * pas un nombre choisi.
     */
    expect(conditionYieldFactor(apresChamps(1))).toBe(1);
    expect(apresChamps(15)).toBeGreaterThan(CONDITION_FULL_POWER);
    expect(apresChamps(20)).toBeLessThan(CONDITION_FULL_POWER);
    expect(apresChamps(60)).toBeGreaterThan(def.minCondition);
  });

  it("rend la révision rentable une fois l'engin réellement usé", () => {
    /**
     * Le chiffre qui décide. Ralentir l'usure ne doit pas rendre l'atelier
     * facultatif : au moment où la machine arrive en bas, le rendement perdu
     * sur le champ suivant doit dépasser la facture. Sans cette inégalité,
     * entretenir redeviendrait une corvée qu'on repousse jusqu'à la panne.
     */
    const usee = def.minCondition + 5;
    const brut = CASES * CROP_DEFS.WHEAT.yieldPerCell * MARKET_BOUNDS.WHEAT.initial;
    const perdu = brut * (1 - conditionYieldFactor(usee));
    const revision = repairMachineCost({
      condition: usee,
      repairCostPerPoint: def.repairCostPerPoint,
    }).cost;

    expect(perdu).toBeGreaterThan(revision);
  });
});
