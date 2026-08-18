import {
  applyMachineWear,
  applyJobCare,
  breakdownChance,
  careWearMultiplier,
  careYieldBonus,
  dirtFromWork,
  machineWorkBlock,
  pickBreakdownKind,
  repairTargetCondition,
} from "../index";

describe("entretien machines", () => {
  const sane = {
    condition: 80,
    greased: true,
    grease: 100,
    dirt: 0,
    greaseSkipStreak: 0,
    breakdown: null,
  };

  it("va de ×0,80 nickel à ×1,95 à l'abandon", () => {
    expect(careWearMultiplier({ grease: 100, dirt: 0 })).toBe(0.8);
    expect(careWearMultiplier({ grease: 0, dirt: 0 })).toBe(1.3);
    expect(careWearMultiplier({ grease: 100, dirt: 100 })).toBe(1.2);
    expect(careWearMultiplier({ grease: 0, dirt: 100 })).toBe(1.95);
  });

  it("monte sans marche d'escalier — c'est ce qui tuait les tracteurs", () => {
    /**
     * L'ancienne courbe sautait de ×0,75 à ×2 en franchissant saleté 25, et un
     * seul champ en déposait 86 : le deuxième passage d'un tracteur neuf
     * coûtait 2,7 fois le premier sans que rien ne l'annonce. Aucun point de
     * la pente ne doit plus faire plus que quelques pour cent d'écart avec son
     * voisin.
     */
    let precedent = careWearMultiplier({ grease: 100, dirt: 0 });
    for (let d = 1; d <= 100; d++) {
      const ici = careWearMultiplier({ grease: 100 - d, dirt: d });
      expect(ici).toBeGreaterThan(precedent);
      expect(ici / precedent).toBeLessThan(1.05);
      precedent = ici;
    }
  });

  it("donne un bonus de récolte si la machine est nickel", () => {
    expect(careYieldBonus({ grease: 100, dirt: 0 })).toBe(0.08);
    expect(careYieldBonus({ grease: 0, dirt: 100 })).toBe(-0.06);
    // Le palier du milieu valait 0 sur une plage énorme : le soin n'y était
    // ni récompensé ni puni, donc invisible. Il vaut désormais quelque chose.
    expect(careYieldBonus({ grease: 100, dirt: 50 })).toBeGreaterThan(0);
    expect(careYieldBonus({ grease: 100, dirt: 50 })).toBeLessThan(0.08);
  });

  it("salit un champ entier sans saturer la jauge", () => {
    /**
     * Le pendant du test de graisse plus bas, qui manquait. La graisse avait
     * été mise à l'échelle du chantier ; la saleté était restée à l'échelle du
     * geste, et un semis de 144 cases en déposait 86 pour un seuil à 25 — la
     * machine était sale à vie dès son premier champ.
     */
    for (const work of ["PLANT", "FERTILIZE", "HARVEST", "PLOW", "STUBBLE", "MOW", "BALE", "COLLECT", "SILAGE"]) {
      const depot = dirtFromWork(work, 144);
      expect(depot).toBeGreaterThan(15);
      expect(depot).toBeLessThan(60);
    }
  });

  it("applique le multiplicateur à l'usure", () => {
    const base = applyMachineWear({ condition: 100, wearPerCell: 1, cells: 10 });
    const dirty = applyMachineWear({
      condition: 100,
      wearPerCell: 1,
      cells: 10,
      careMult: 2,
    });
    expect(dirty.wearApplied).toBe(base.wearApplied * 2);
  });

  it("salit plus un épandage qu'une moisson", () => {
    expect(dirtFromWork("FERTILIZE", 10)).toBeGreaterThan(dirtFromWork("HARVEST", 10));
  });

  it("laisse finir le champ, refuse seulement quand la jauge est vide depuis un tour", () => {
    expect(machineWorkBlock({ ...sane, grease: 0, greased: false, greaseSkipStreak: 0 }, 12)).toBeNull();
    expect(machineWorkBlock({ ...sane, grease: 0, greased: false, greaseSkipStreak: 1 }, 12)?.code).toBe(
      "NEED_GREASE",
    );
    expect(machineWorkBlock({ ...sane, grease: 40, greased: true }, 12)).toBeNull();
  });

  it("bloque une panne même en bon état", () => {
    expect(machineWorkBlock({ ...sane, breakdown: "BELT" }, 12)?.code).toBe("BROKEN");
  });

  it("ne casse pas une machine graissée, propre et au-dessus de 50 %", () => {
    expect(breakdownChance({ condition: 80, grease: 100, dirt: 0 })).toBe(0);
  });

  it("classe la panne selon l'état", () => {
    expect(pickBreakdownKind(70)).toBe("BELT");
    expect(pickBreakdownKind(30)).toBe("HYDRAULIC");
    expect(pickBreakdownKind(10)).toBe("ENGINE");
  });

  it("vide un peu la jauge après un chantier, sans la mettre à zéro", () => {
    const { next, broke } = applyJobCare(sane, { work: "HARVEST", cells: 10, rng: () => 1 });
    expect(broke).toBe(false);
    expect(next.grease).toBeGreaterThan(90);
    expect(next.greased).toBe(true);
    expect(next.dirt).toBeGreaterThan(0);
    expect(next.greaseSkipStreak).toBe(0);
  });

  it("tient un champ entier (144 cases) sans vider la jauge", () => {
    const { next } = applyJobCare(sane, { work: "PLANT", cells: 144, rng: () => 1 });
    expect(next.grease).toBeGreaterThan(50);
    expect(next.greased).toBe(true);
  });

  it("tient deux champs (288 cases) avant de forcer l’atelier", () => {
    const { next } = applyJobCare(sane, { work: "PLANT", cells: 288, rng: () => 1 });
    expect(next.grease).toBeGreaterThan(0);
    expect(next.greased).toBe(true);
  });

  it("compte un départ à sec seulement quand la jauge était déjà vide", () => {
    const { next } = applyJobCare(
      { ...sane, grease: 0, greased: false },
      { work: "PLOW", cells: 4, rng: () => 1 },
    );
    expect(next.grease).toBe(0);
    expect(next.greaseSkipStreak).toBe(1);
  });

  it("force une panne si le tirage est en dessous de la chance", () => {
    const worn = { ...sane, condition: 30, grease: 0, greased: false, dirt: 60 };
    const { broke, next } = applyJobCare(worn, { work: "HARVEST", cells: 8, rng: () => 0 });
    expect(broke).toBe(true);
    expect(next.breakdown).toBe("HYDRAULIC");
  });

  it("répare le moteur à 100 %, une courroie de +30", () => {
    expect(repairTargetCondition("ENGINE", 12)).toBe(100);
    expect(repairTargetCondition("BELT", 40)).toBe(70);
  });
});
