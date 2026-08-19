/**
 * La cote du matériel d'occasion.
 *
 * Elle repose sur la distinction que le compteur horaire a rendue possible :
 * les **heures** sont l'âge, définitif, et la **condition** est l'entretien,
 * réparable. Avant, seule la condition existait — une révision à 100 %
 * remettait donc l'engin au prix du neuf, ce qui ouvrait une machine à
 * fabriquer de l'argent : acheter, réviser, revendre.
 */

import {
  CONTRACTOR_YIELD_MALUS,
  CROP_DEFS,
  DEFAULT_GRID,
  MACHINE_AGE_YIELD_MALUS,
  MARKET_BOUNDS,
  conditionYieldFactor,
  contractorQuote,
  machineAgeYieldFactor,
  MACHINE_DEFS,
  MACHINE_DEALER_RATE,
  MACHINE_END_OF_LIFE_HOURS,
  machineAgeFactor,
  machineDealerValue,
  machineResaleValue,
  repairQuote,
  type MachineType,
} from "@farmsim/shared";

describe("cote d'une machine d'occasion", () => {
  it("baisse avec les heures, même remise à neuf", () => {
    // Le trou de l'ancien modèle : la condition seule fixait le prix, donc
    // réviser un engin le revendait au prix du neuf.
    const neuf = machineResaleValue("TRACTOR", { condition: 100, hours: 0 });
    const vieux = machineResaleValue("TRACTOR", { condition: 100, hours: 1200 });
    expect(vieux).toBeLessThan(neuf);
  });

  it("baisse avec l'état, à heures égales", () => {
    const tenu = machineResaleValue("TRACTOR", { condition: 100, hours: 400 });
    const ruine = machineResaleValue("TRACTOR", { condition: 20, hours: 400 });
    expect(ruine).toBeLessThan(tenu);
  });

  it("ne descend jamais à rien — sinon l'occasion serait un piège", () => {
    const epave = machineResaleValue("TRACTOR", {
      condition: 0,
      hours: MACHINE_END_OF_LIFE_HOURS * 3,
    });
    expect(epave).toBeGreaterThan(0);
    expect(machineAgeFactor(MACHINE_END_OF_LIFE_HOURS * 3)).toBe(
      machineAgeFactor(MACHINE_END_OF_LIFE_HOURS),
    );
  });

  it("fait payer moins au concessionnaire qu'entre joueurs", () => {
    // C'est tout l'arbitrage : l'argent tout de suite, ou le bon prix mais il
    // faut attendre un acheteur.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const etat = { condition: 70, hours: 300 };
      expect(machineDealerValue(type, etat)).toBeLessThan(machineResaleValue(type, etat));
      expect(MACHINE_DEALER_RATE).toBeLessThan(1);
    }
  });

  it("ne rend jamais réviser-puis-revendre rentable", () => {
    /**
     * Le garde-fou qui compte. Si remettre à neuf coûtait moins que ce que la
     * révision ajoute à la cote, on ne jouerait plus : on ferait tourner de
     * l'argent à l'atelier.
     */
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const def = MACHINE_DEFS[type];
      for (const hours of [0, 200, 600, 1200]) {
        const avant = machineResaleValue(type, { condition: def.minCondition, hours });
        const apres = machineResaleValue(type, { condition: 100, hours });
        const revision = repairQuote({
          condition: def.minCondition,
          repairCostPerPoint: def.repairCostPerPoint,
        }).cost;
        expect(apres - avant).toBeLessThan(revision);
      }
    }
  });

  it("laisse l'occasion nettement moins chère que le neuf", () => {
    // Sinon le marché d'occasion n'a pas de raison d'exister.
    for (const type of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const def = MACHINE_DEFS[type];
      expect(machineResaleValue(type, { condition: 100, hours: 0 })).toBeLessThan(def.cost * 0.6);
    }
  });
});

describe("ce qu'une machine d'occasion fait perdre au champ", () => {
  const CHAMP = DEFAULT_GRID.w * DEFAULT_GRID.h;
  const brut = CHAMP * CROP_DEFS.WHEAT.yieldPerCell * MARKET_BOUNDS.WHEAT.initial;

  it("ne coûte rien à zéro heure et plafonne à −8 %", () => {
    expect(machineAgeYieldFactor(0)).toBe(1);
    expect(machineAgeYieldFactor(MACHINE_END_OF_LIFE_HOURS)).toBeCloseTo(
      1 - MACHINE_AGE_YIELD_MALUS,
      3,
    );
    // Au-delà de la fin de vie, on ne s'enfonce pas davantage.
    expect(machineAgeYieldFactor(MACHINE_END_OF_LIFE_HOURS * 4)).toBe(
      machineAgeYieldFactor(MACHINE_END_OF_LIFE_HOURS),
    );
  });

  it("descend sans marche d'escalier", () => {
    let precedent = 1;
    for (let h = 50; h <= MACHINE_END_OF_LIFE_HOURS; h += 50) {
      const ici = machineAgeYieldFactor(h);
      expect(ici).toBeLessThan(precedent);
      expect(precedent - ici).toBeLessThan(0.01);
      precedent = ici;
    }
  });

  it("ne se répare pas — c'est ce qui la distingue de la condition", () => {
    /**
     * Le trou que ce facteur bouche. Sans lui, un acheteur prenait une
     * moissonneuse de 1 500 h à 660 TRN, la révisait, et ramassait autant
     * qu'avec une neuve à 4 000 TRN.
     */
    const revisee = conditionYieldFactor(100) * machineAgeYieldFactor(1500);
    const neuve = conditionYieldFactor(100) * machineAgeYieldFactor(0);
    expect(revisee).toBeLessThan(neuve);
  });

  it("reste très loin devant l'entreprise, même en fin de vie", () => {
    /**
     * La contrainte posée par le joueur : « que ça tienne par rapport à un pnj
     * qui vient récolter ». Mesuré, faire moissonner un champ par une
     * entreprise coûte 22 % de sa valeur — service plus malus de rendement.
     * Même une machine bonne pour la casse doit rester nettement meilleure,
     * sinon l'occasion serait un piège et la cote plancher un mensonge.
     */
    const entreprise =
      contractorQuote("HARVEST", CHAMP) + brut * CONTRACTOR_YIELD_MALUS;
    const epave = brut * MACHINE_AGE_YIELD_MALUS;
    expect(epave).toBeLessThan(entreprise / 2);
  });

  it("garde le malus léger sur l'occasion courante", () => {
    // « Pas assez grave pour que ça punisse trop » : une occasion de 600 h ne
    // doit pas coûter plus de quelques pour cent.
    expect(1 - machineAgeYieldFactor(600)).toBeLessThan(0.04);
  });

  it("laisse l'occasion se rentabiliser en un champ ou deux", () => {
    /**
     * Le calcul que fait le joueur : acheter d'occasion plutôt que d'appeler
     * l'entreprise. Une moissonneuse à 600 h doit se payer très vite.
     */
    const cote = machineResaleValue("HARVESTER", { condition: 100, hours: 600 });
    const parChamp =
      contractorQuote("HARVEST", CHAMP) +
      brut * CONTRACTOR_YIELD_MALUS -
      brut * (1 - machineAgeYieldFactor(600));
    expect(cote / parChamp).toBeLessThan(2);
  });
});
