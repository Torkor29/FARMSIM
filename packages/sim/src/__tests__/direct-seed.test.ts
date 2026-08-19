import {
  DIRECT_SEED_COST_PER_CELL,
  DIRECT_SEED_YIELD_MALUS,
  MAX_HARVESTS_BEFORE_PLOW,
  PLOW_COST_PER_CELL_SOIL,
  STUBBLE_COST_PER_CELL,
  SOIL_WORK_LABELS,
  applyDirectSeed,
  applyHarvest,
  applyPlow,
  applyStubble,
  canDirectSeed,
  residueBonus,
  soilSummary,
  type SoilState,
  fuelCost,
  fuelForJob,
  jobHours,
  machineHoursPerHectare,
  machinePower,
  machineRequiredHp,
} from "@farmsim/shared";
import { simulateCell } from "../index.js";

const PLOWED: SoilState = { harvestsSincePlow: 0, residuePasses: 0, hasStubble: false };

describe("semis direct", () => {
  it("est la troisième voie du travail du sol", () => {
    expect(SOIL_WORK_LABELS.DIRECT_SEED).toBe("Semis direct");
  });

  it("exige des chaumes : sans eux, c'est un semis ordinaire", () => {
    expect(canDirectSeed(PLOWED)).toEqual({ ok: false, reason: "NO_STUBBLE" });
    expect(canDirectSeed(applyHarvest(PLOWED)).ok).toBe(true);
  });

  it("est refusé quand le sol réclame la charrue, puisqu'il ne décompacte pas", () => {
    let soil = PLOWED;
    for (let i = 0; i < MAX_HARVESTS_BEFORE_PLOW; i++) soil = applyHarvest(soil);
    expect(canDirectSeed(soil)).toEqual({ ok: false, reason: "PLOW_REQUIRED" });
  });

  it("sème la case sans incorporer les résidus", () => {
    const stubbled = applyStubble(applyHarvest(PLOWED));
    expect(residueBonus(stubbled.residuePasses)).toBeGreaterThan(0);

    const direct = applyDirectSeed(applyHarvest(PLOWED));
    expect(direct.hasStubble).toBe(false);
    // Les résidus restent en surface : aucun bonus de décomposition.
    expect(residueBonus(direct.residuePasses)).toBe(0);
  });

  it("laisse le sol se tasser, ce qui rapproche le labour obligatoire", () => {
    const harvested = applyHarvest(PLOWED);
    expect(applyDirectSeed(harvested).harvestsSincePlow).toBe(harvested.harvestsSincePlow + 1);
    // Le déchaumage, lui, ne fait pas avancer ce compteur.
    expect(applyStubble(harvested).harvestsSincePlow).toBe(harvested.harvestsSincePlow);
  });

  it("coûte moins cher que travailler le sol", () => {
    /**
     * La comparaison porte désormais sur le **chantier entier**, gazole
     * compris — c'est là que le semis direct gagne : il supprime un passage.
     * Comparer les seuls forfaits n'a plus de sens depuis que ceux-ci ne
     * représentent que les pièces d'usure ; le test le disait encore, et il
     * échouait parce que le semis direct était devenu l'option la plus chère.
     */
    const CASES = 144;
    const gazolePasse = (outil: "DISC_HARROW" | "SEEDER") =>
      fuelForJob({
        powerHp: machinePower("TRACTOR", 1),
        requiredHp: machineRequiredHp(outil, 1),
        hours: jobHours(machineHoursPerHectare(outil, 1), CASES),
      });

    const parLeDechaumage =
      STUBBLE_COST_PER_CELL * CASES + fuelCost(gazolePasse("DISC_HARROW") + gazolePasse("SEEDER"));
    const enDirect = DIRECT_SEED_COST_PER_CELL * CASES + fuelCost(gazolePasse("SEEDER"));

    expect(enDirect).toBeLessThan(parLeDechaumage);
    // Et il reste plus cher que le semis nu : le semoir lourd se paie.
    expect(DIRECT_SEED_COST_PER_CELL).toBeGreaterThan(0);
  });

  it("se paie en rendement, ce qui rend l'arbitrage réel", () => {
    const base = {
      crop: "WHEAT" as const,
      plantedAt: 0,
      // Pile à maturité : au-delà, la sur-maturité écrase tout et masquerait
      // l'effet mesuré ici.
      now: 3 * 60 * 1000,
      fertility: 0.7,
      weedsControlled: true,
      fertilizedPasses: 1 as const,
    };
    const classic = simulateCell(base);
    const direct = simulateCell({ ...base, directSeeded: true });
    expect(direct.estimatedYieldTons).toBeCloseTo(
      classic.estimatedYieldTons * (1 - DIRECT_SEED_YIELD_MALUS),
      2,
    );
  });

  it("mentionne les trois voies quand la case porte des chaumes", () => {
    const summary = soilSummary(applyHarvest(PLOWED));
    expect(summary).toContain("semer direct");
  });

  it("le labour reste la remise à zéro complète", () => {
    expect(applyPlow()).toEqual(PLOWED);
  });
});
