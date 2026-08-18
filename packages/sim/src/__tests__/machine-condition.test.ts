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

import { applyMachineWear, careYieldBonus, repairMachineCost } from "../index";
import {
  CONDITION_FULL_POWER,
  CONDITION_WORST_FACTOR,
  CROP_DEFS,
  MACHINE_DEFS,
  MARKET_BOUNDS,
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

  it("garde le plein rendement sur son premier champ", () => {
    // La perte ne doit pas se sentir dès le premier chantier d'une machine
    // neuve : ce serait punir l'usage même de l'engin qu'on vient de payer.
    expect(conditionYieldFactor(100)).toBe(1);
  });

  it("se fait sentir dès le deuxième — l’usure est rapide sur cet engin", () => {
    /**
     * Prémisse à corriger, et c'est le test qui l'a signalée : je pensais
     * l'usure lente et j'avais écrit « une saison d'oubli ». Mesuré, une
     * moissonneuse perd **quarante-six points par champ de 144 cases**
     * (`wearPerCell` 0,32). Ce n'est pas une dérive de saison, c'est un
     * consommable de deux chantiers.
     */
    const apres1 = applyMachineWear({
      condition: 100,
      wearPerCell: def.wearPerCell,
      cells: CASES,
    }).condition;
    expect(apres1).toBeLessThan(CONDITION_FULL_POWER);
    expect(conditionYieldFactor(apres1)).toBeLessThan(1);

    // Et le deuxième champ la met sous son seuil de blocage.
    const apres2 = applyMachineWear({
      condition: apres1,
      wearPerCell: def.wearPerCell,
      cells: CASES,
    }).condition;
    expect(apres2).toBeLessThan(def.minCondition);
  });

  it("rend la révision rentable, ce qui est tout l’objet du changement", () => {
    /**
     * Le chiffre qui décide. Après un champ, la machine tombe à 54 % : le
     * champ suivant se récolterait à 90 % de rendement. Sur une parcelle de
     * blé, les dix pour cent manquants valent plus que la révision.
     *
     * Sans cette inégalité, entretenir resterait une corvée qu'on repousse
     * jusqu'à la panne — l'état d'avant ce changement.
     */
    const apres1 = applyMachineWear({
      condition: 100,
      wearPerCell: def.wearPerCell,
      cells: CASES,
    }).condition;

    const brut = CASES * CROP_DEFS.WHEAT.yieldPerCell * MARKET_BOUNDS.WHEAT.initial;
    const perdu = brut * (1 - conditionYieldFactor(apres1));
    const revision = repairMachineCost({
      condition: apres1,
      repairCostPerPoint: def.repairCostPerPoint,
    }).cost;

    expect(perdu).toBeGreaterThan(revision);
  });
});
