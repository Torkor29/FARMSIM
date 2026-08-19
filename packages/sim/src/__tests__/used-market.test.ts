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
