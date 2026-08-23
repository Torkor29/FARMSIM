/**
 * Le gazole.
 *
 * Le mot n'apparaissait nulle part dans le code, alors que c'est le premier
 * poste variable d'une exploitation réelle. Les travaux coûtaient un forfait
 * par case — douze € pour un labour — qui mélangeait carburant, main-d'œuvre
 * et pièces d'usure en un seul nombre que le joueur ne pouvait ni décomposer
 * ni réduire.
 *
 * Ce que ce système doit apporter tient en une phrase : **une seule décision,
 * mais une vraie**. Le dimensionnement de l'attelage.
 */

import {
  FUEL_IDLE_SHARE,
  FUEL_STARTER_L,
  FUEL_TANK_L,
  MACHINE_DEFS,
  MACHINE_TIERS,
  PLOW_COST_PER_CELL_SOIL,
  engineLoad,
  fuelCost,
  fuelForJob,
  jobHours,
  machineHoursPerHectare,
  machinePower,
  machineRequiredHp,
  type MachineType,
  type Tier,
} from "@farmsim/shared";

const CHAMP = 144;

/** Gazole d'un labour de champ entier, avec cet attelage. */
function labour(tracteur: Tier, charrue: Tier): number {
  return fuelForJob({
    powerHp: machinePower("TRACTOR", tracteur),
    requiredHp: machineRequiredHp("PLOUGH", charrue),
    hours: jobHours(machineHoursPerHectare("PLOUGH", charrue), CHAMP),
  });
}

describe("la consommation suit la charge", () => {
  it("punit le tracteur surdimensionné", () => {
    /**
     * L'arbitrage que ce système ajoute, et le seul. Un gros tracteur attelé à
     * un petit outil tourne au ralenti et brûle quand même : il consomme plus
     * qu'un tracteur bien dimensionné, sans aller plus vite d'une minute.
     */
    expect(labour(3, 1)).toBeGreaterThan(labour(1, 1) * 1.2);
  });

  it("récompense l'attelage juste", () => {
    // Bien attelé, le gros ensemble consomme moins au champ — et va trois fois
    // plus vite. C'est ce qui justifie son prix.
    expect(labour(3, 3)).toBeLessThan(labour(1, 1));
  });

  it("fait brûler un moteur même à vide — sinon rien ne dissuade", () => {
    const àVide = fuelForJob({ powerHp: 100, requiredHp: 0, hours: 1 });
    const àPlein = fuelForJob({ powerHp: 100, requiredHp: 100, hours: 1 });
    expect(àVide).toBeGreaterThan(0);
    expect(àVide / àPlein).toBeCloseTo(FUEL_IDLE_SHARE, 2);
  });

  it("plafonne la charge : un outil trop lourd ne serait pas tractable", () => {
    expect(engineLoad(100, 250)).toBe(1);
    expect(engineLoad(100, 50)).toBe(0.5);
  });

  it("croît avec la surface et avec les heures", () => {
    const plein = fuelForJob({ powerHp: 90, requiredHp: 90, hours: 10 });
    const moitie = fuelForJob({ powerHp: 90, requiredHp: 90, hours: 5 });
    expect(plein).toBeCloseTo(moitie * 2, 1);
  });
});

describe("ce que ça pèse dans une saison", () => {
  it("reste un poste sensible sans étrangler la ferme", () => {
    /**
     * Un champ de blé rapporte environ onze mille € bruts. Le gazole d'un
     * labour doit se sentir — c'est le poste qu'on cherche à réduire — sans
     * dépasser ce que la parcelle rapporte.
     */
    const litres = labour(1, 1);
    const prix = fuelCost(litres);
    expect(prix).toBeGreaterThan(80);
    expect(prix).toBeLessThan(400);
  });

  it("a remplacé le forfait opaque, pas doublé la note", () => {
    /**
     * Douze € la case faisaient 1 728 € pour une parcelle entière, de loin
     * le poste le plus lourd d'une saison sans que rien n'explique pourquoi.
     * Le gazole prend le relais : il doit coûter moins que ce qu'il remplace,
     * sinon on aurait simplement renchéri le labour.
     */
    const ancienForfait = 12 * CHAMP;
    expect(fuelCost(labour(1, 1)) + PLOW_COST_PER_CELL_SOIL * CHAMP).toBeLessThan(ancienForfait);
  });

  it("tient plusieurs chantiers dans une cuve", () => {
    // Une cuve qui se vide à chaque passage transformerait le plein en corvée.
    expect(FUEL_TANK_L / labour(1, 1)).toBeGreaterThan(3);
  });

  it("laisse une ferme neuve boucler sa première campagne", () => {
    /**
     * Mesuré en jeu : semis, moisson et labour d'un champ entier brûlent 481 L.
     * La dotation de départ valait 600 L et le joueur tombait à sec au milieu
     * de son premier cycle, avant d'avoir rien vendu.
     */
    const campagne =
      fuelForJob({
        powerHp: machinePower("TRACTOR", 1),
        requiredHp: machineRequiredHp("SEEDER", 1),
        hours: jobHours(machineHoursPerHectare("SEEDER", 1), CHAMP),
      }) +
      fuelForJob({
        powerHp: machinePower("HARVESTER", 1),
        requiredHp: machinePower("HARVESTER", 1),
        hours: jobHours(machineHoursPerHectare("HARVESTER", 1), CHAMP),
      }) +
      labour(1, 1);
    expect(FUEL_STARTER_L).toBeGreaterThan(campagne);
  });

  it("laisse tout le parc travailler sans déborder de la cuve", () => {
    // Un chantier qu'aucune cuve pleine ne peut couvrir serait un mur.
    for (const t of Object.keys(MACHINE_DEFS) as MachineType[]) {
      const def = MACHINE_DEFS[t];
      if (def.kind === "TRACTOR") continue;
      for (const tier of MACHINE_TIERS) {
        const porteur = def.kind === "SELF_PROPELLED" ? machinePower(t, tier) : machinePower("TRACTOR", 3);
        const besoin = def.kind === "SELF_PROPELLED" ? porteur : machineRequiredHp(t, tier);
        const litres = fuelForJob({
          powerHp: porteur,
          requiredHp: besoin,
          hours: jobHours(machineHoursPerHectare(t, tier), CHAMP),
        });
        expect(litres).toBeLessThan(FUEL_TANK_L);
      }
    }
  });
});
