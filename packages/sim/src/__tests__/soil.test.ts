import {
  MACHINE_DEFS,
  MAX_HARVESTS_BEFORE_PLOW,
  PLOW_COST_PER_CELL_SOIL,
  RESIDUE_YIELD_BONUS,
  STUBBLE_COST_PER_CELL,
  applyHarvest,
  applyPlow,
  applyRegrass,
  applyStubble,
  canRegrass,
  canSow,
  canStubble,
  plowRequired,
  residueBonus,
  soilSummary,
  type SoilState,
} from "@farmsim/shared";
import { simulateCell } from "../index";

const NEUF: SoilState = { harvestsSincePlow: 0, residuePasses: 0, hasStubble: false };

describe("état du sol", () => {
  it("laisse des chaumes après chaque moisson", () => {
    const apres = applyHarvest(NEUF);
    expect(apres.hasStubble).toBe(true);
    expect(apres.harvestsSincePlow).toBe(1);
  });

  it("interdit de semer sur des chaumes", () => {
    expect(canSow(NEUF)).toBe(true);
    expect(canSow(applyHarvest(NEUF))).toBe(false);
  });

  it("rend la case semable après déchaumage comme après labour", () => {
    const chaumes = applyHarvest(NEUF);
    expect(canSow(applyStubble(chaumes))).toBe(true);
    expect(canSow(applyPlow())).toBe(true);
  });
});

describe("déchaumage", () => {
  it("incorpore les résidus sans toucher au compteur de récoltes", () => {
    const apres = applyStubble(applyHarvest(NEUF));
    expect(apres.residuePasses).toBe(1);
    expect(apres.harvestsSincePlow).toBe(1);
  });

  it("refuse une case sans chaumes", () => {
    const verdict = canStubble(NEUF);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("NO_STUBBLE");
  });

  it("cède la place à la charrue après trois récoltes", () => {
    let sol = NEUF;
    for (let i = 0; i < MAX_HARVESTS_BEFORE_PLOW - 1; i++) {
      sol = applyHarvest(sol);
      expect(canStubble(sol).ok).toBe(true);
      sol = applyStubble(sol);
    }
    sol = applyHarvest(sol);
    const verdict = canStubble(sol);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe("PLOW_REQUIRED");
  });

  it("plafonne le bonus de résidus", () => {
    let sol: SoilState = { ...NEUF, hasStubble: true };
    for (let i = 0; i < 10; i++) sol = applyStubble({ ...sol, hasStubble: true });
    expect(sol.residuePasses).toBe(RESIDUE_YIELD_BONUS.length - 1);
    expect(residueBonus(sol.residuePasses)).toBe(
      RESIDUE_YIELD_BONUS[RESIDUE_YIELD_BONUS.length - 1],
    );
  });

  it("apporte un gain décroissant à chaque passage", () => {
    const premier = residueBonus(1) - residueBonus(0);
    const second = residueBonus(2) - residueBonus(1);
    expect(premier).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThan(premier);
  });
});

describe("labour", () => {
  it("remet tout à zéro, bonus compris", () => {
    let sol = applyStubble(applyHarvest(NEUF));
    sol = applyHarvest(sol);
    expect(sol.residuePasses).toBeGreaterThan(0);
    const laboure = applyPlow();
    expect(laboure.harvestsSincePlow).toBe(0);
    expect(laboure.residuePasses).toBe(0);
    expect(laboure.hasStubble).toBe(false);
  });

  it("devient obligatoire exactement au seuil annoncé", () => {
    expect(plowRequired({ harvestsSincePlow: MAX_HARVESTS_BEFORE_PLOW - 1 })).toBe(false);
    expect(plowRequired({ harvestsSincePlow: MAX_HARVESTS_BEFORE_PLOW })).toBe(true);
  });

  it("coûte plus cher que le déchaumage", () => {
    expect(PLOW_COST_PER_CELL_SOIL).toBeGreaterThan(STUBBLE_COST_PER_CELL);
  });
});

describe("libellés", () => {
  it("décrit un sol prêt à semer", () => {
    expect(soilSummary(NEUF)).toMatch(/prêt à semer/i);
  });

  it("annonce le nombre de récoltes restantes avant labour", () => {
    expect(soilSummary(applyHarvest(NEUF))).toMatch(/2 récolte/);
  });

  it("annonce le labour obligatoire au seuil", () => {
    const sol: SoilState = {
      harvestsSincePlow: MAX_HARVESTS_BEFORE_PLOW,
      residuePasses: 2,
      hasStubble: true,
    };
    expect(soilSummary(sol)).toMatch(/labour obligatoire/i);
  });

  it("chiffre le bonus quand les résidus sont incorporés", () => {
    expect(soilSummary(applyStubble(applyHarvest(NEUF)))).toMatch(/\+5 %/);
  });
});

describe("effet sur le rendement", () => {
  const base = {
    crop: "WHEAT" as const,
    plantedAt: 0,
    now: 3 * 60 * 1000,
    fertility: 0.8,
    weedsControlled: true,
    fertilizedPasses: 2 as const,
  };

  it("fait produire davantage après déchaumage", () => {
    const sansResidus = simulateCell({ ...base, residuePasses: 0 });
    const unPassage = simulateCell({ ...base, residuePasses: 1 });
    const deuxPassages = simulateCell({ ...base, residuePasses: 2 });
    expect(unPassage.estimatedYieldTons).toBeGreaterThan(sansResidus.estimatedYieldTons);
    expect(deuxPassages.estimatedYieldTons).toBeGreaterThan(unPassage.estimatedYieldTons);
  });

  it("apporte un gain de l’ordre annoncé", () => {
    const sans = simulateCell({ ...base, residuePasses: 0 }).estimatedYieldTons;
    const avec = simulateCell({ ...base, residuePasses: 1 }).estimatedYieldTons;
    expect(avec / sans).toBeCloseTo(1 + RESIDUE_YIELD_BONUS[1], 2);
  });
});

describe("déchaumeur à disques", () => {
  it("est le seul outil capable de déchaumer", () => {
    const capables = (Object.keys(MACHINE_DEFS) as (keyof typeof MACHINE_DEFS)[]).filter((t) =>
      MACHINE_DEFS[t].works.includes("STUBBLE"),
    );
    expect(capables).toEqual(["DISC_HARROW"]);
  });

  it("s’use moins qu’un tracteur, puisqu’il travaille en surface", () => {
    // À heures égales : sa vie utile est plus longue que celle du tracteur.
    expect(MACHINE_DEFS.DISC_HARROW.lifeHours).toBeGreaterThan(MACHINE_DEFS.TRACTOR.lifeHours);
  });

  it("ne sait ni semer ni récolter", () => {
    expect(MACHINE_DEFS.DISC_HARROW.works).not.toContain("PLANT");
    expect(MACHINE_DEFS.DISC_HARROW.works).not.toContain("HARVEST");
  });
});

describe("remise en herbe", () => {
  it("accepte une terre travaillée et nue", () => {
    expect(canRegrass({ worked: true, hasCrop: false, hasStubble: false })).toBe(true);
  });

  it("refuse une case où quelque chose pousse", () => {
    expect(canRegrass({ worked: true, hasCrop: true, hasStubble: false })).toBe(false);
  });

  it("refuse une case en chaumes — c’est un déchaumage qu’il lui faut", () => {
    expect(canRegrass({ worked: true, hasCrop: false, hasStubble: true })).toBe(false);
  });

  it("refuse une prairie déjà en herbe : il n’y a rien à y faire", () => {
    expect(canRegrass({ worked: false, hasCrop: false, hasStubble: false })).toBe(false);
  });

  it("remet le compteur de récoltes à zéro, comme un labour", () => {
    const epuise: SoilState = {
      harvestsSincePlow: MAX_HARVESTS_BEFORE_PLOW,
      residuePasses: 2,
      hasStubble: false,
    };
    expect(plowRequired(epuise)).toBe(true);
    expect(plowRequired(applyRegrass())).toBe(false);
  });

  it("ne laisse ni chaumes ni résidus au crédit du semis suivant", () => {
    expect(applyRegrass().hasStubble).toBe(false);
    expect(applyRegrass().residuePasses).toBe(0);
  });
});
