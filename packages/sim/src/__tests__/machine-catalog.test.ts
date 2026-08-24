/**
 * Le catalogue à cinq paliers.
 *
 * Cinq modèles par famille, calés sur des machines réelles : ce n'est plus
 * « T2 = ×1,6 ». Chaque fiche a un nom générique, une référence interne, un
 * prix de jeu, et des notes qui ne montent pas toutes ensemble — le T5 est
 * puissant, il est aussi gourmand.
 */

import {
  MACHINE_CATALOG,
  MACHINE_DEFS,
  MACHINE_STAR_LABELS,
  MACHINE_TIERS,
  PRIX_ENGINS,
  TIER_ROLE_LABELS,
  canPull,
  machineCost,
  machineMeshScale,
  machineRepairPerPoint,
  machineVariant,
  TELEHANDLER_CATALOG,
  type MachineType,
} from "@farmsim/shared";

const TYPES = Object.keys(MACHINE_DEFS) as MachineType[];

describe("cinq fiches par famille", () => {
  it("couvre exactement le parc jouable, rien de plus", () => {
    expect(Object.keys(MACHINE_CATALOG).sort()).toEqual([...TYPES].sort());
    expect(MACHINE_TIERS).toEqual([1, 2, 3, 4, 5]);
    expect(Object.keys(TIER_ROLE_LABELS)).toHaveLength(5);
    expect(MACHINE_STAR_LABELS).toHaveLength(5);
  });

  it("ancre le palier 1 sur les prix T1 du jeu — et rien d'autre", () => {
    // T1 = MACHINE_DEFS = PRIX_ENGINS. Si l'un décroche, le garage ment.
    for (const t of TYPES) {
      const fiche = machineVariant(t, 1);
      const def = MACHINE_DEFS[t];
      expect(fiche.cost).toBe(PRIX_ENGINS[t]);
      expect(machineCost(t, 1)).toBe(PRIX_ENGINS[t]);
      expect(fiche.widthM).toBe(def.widthM);
      expect(fiche.powerHp ?? 0).toBe(def.powerHp ?? 0);
      expect(fiche.requiredHp ?? 0).toBe(def.requiredHp ?? 0);
    }
  });

  it("monte en prix, largeur et exigence à chaque palier", () => {
    for (const t of TYPES) {
      let prix = 0;
      for (const tier of MACHINE_TIERS) {
        const fiche = machineVariant(t, tier);
        expect(fiche.cost).toBeGreaterThan(prix);
        expect(fiche.label.length).toBeGreaterThan(2);
        expect(fiche.copy.length).toBeGreaterThan(12);
        expect(fiche.inspiredBy).toMatch(/\d/);
        expect(fiche.maker.length).toBeGreaterThan(2);
        expect(fiche.realPriceApprox).toBeGreaterThan(fiche.cost * 0.6);
        expect(fiche.fuelLPerHour).toBeGreaterThan(0);
        expect(fiche.constraints.length).toBeGreaterThan(8);
        expect(fiche.compatible.length).toBeGreaterThan(4);
        expect(fiche.role.length).toBeGreaterThan(8);
        expect(fiche.bonus.length).toBeGreaterThan(8);
        expect(fiche.label).not.toMatch(/John Deere|CLAAS|Fendt|Manitou|Amazone|Horsch/i);
        prix = fiche.cost;
        for (const n of Object.values(fiche.stars)) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it("fait du T5 le sommet du marché, pas un gros T4", () => {
    const tracteur = machineVariant("TRACTOR", 5);
    const moisson = machineVariant("HARVESTER", 5);
    const ensileuse = machineVariant("FORAGE_HARVESTER", 5);
    const pulve = machineVariant("SPRAYER", 5);
    const semoir = machineVariant("SEEDER", 5);
    expect(tracteur.powerHp ?? 0).toBeGreaterThanOrEqual(800);
    expect(moisson.capacityL ?? 0).toBeGreaterThanOrEqual(20000);
    expect(moisson.widthM).toBeGreaterThanOrEqual(15);
    expect(ensileuse.powerHp ?? 0).toBeGreaterThanOrEqual(900);
    expect(pulve.widthM).toBeGreaterThanOrEqual(48);
    expect(semoir.widthM).toBeGreaterThanOrEqual(18);
    expect(tracteur.cost).toBeGreaterThan(600000);
    expect(moisson.cost).toBeGreaterThan(1000000);
  });

  it("fait du T5 un choix, pas un automatisme : il boit plus", () => {
    // Le géant n'est pas meilleur partout. Sinon on achète le plus gros chiffre.
    const t1 = machineVariant("TRACTOR", 1);
    const t5 = machineVariant("TRACTOR", 5);
    expect(t5.stars.puissance).toBeGreaterThan(t1.stars.puissance);
    expect(t5.stars.sobriete).toBeLessThan(t1.stars.sobriete);
    expect(machineRepairPerPoint("TRACTOR", 5)).toBeGreaterThan(machineRepairPerPoint("TRACTOR", 1));
    expect(machineMeshScale(5)).toBeGreaterThan(machineMeshScale(1));
    expect(machineMeshScale(5)).toBeLessThan(1.4);
  });

  it("réserve la charrue T5 au géant — c'est la boucle d'outils", () => {
    expect(canPull({ type: "TRACTOR", tier: 1 }, { type: "PLOUGH", tier: 1 })).toBe(true);
    expect(canPull({ type: "TRACTOR", tier: 1 }, { type: "PLOUGH", tier: 2 })).toBe(false);
    expect(canPull({ type: "TRACTOR", tier: 5 }, { type: "PLOUGH", tier: 5 })).toBe(true);
    expect(canPull({ type: "TRACTOR", tier: 4 }, { type: "PLOUGH", tier: 5 })).toBe(false);
  });

  it("documente les chargeurs de cour sans les mêler au parc de champ", () => {
    expect(Object.keys(TELEHANDLER_CATALOG)).toEqual(["1", "2", "3", "4", "5"]);
    expect(TELEHANDLER_CATALOG[5].capacityL ?? 0).toBeGreaterThanOrEqual(5000);
    expect(TELEHANDLER_CATALOG[5].cost).toBeGreaterThan(200000);
    for (const tier of MACHINE_TIERS) {
      expect(TELEHANDLER_CATALOG[tier].label).not.toMatch(/Manitou|JCB|Merlo|CLAAS/i);
    }
  });
});
