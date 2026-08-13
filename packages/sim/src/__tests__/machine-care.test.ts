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
    dirt: 0,
    greaseSkipStreak: 0,
    breakdown: null,
  };

  it("double l'usure si la machine est sale, ×1,5 si pas graissée, −25 % si nickel", () => {
    expect(careWearMultiplier({ greased: true, dirt: 0 })).toBe(0.75);
    expect(careWearMultiplier({ greased: false, dirt: 0 })).toBe(1.5);
    expect(careWearMultiplier({ greased: true, dirt: 25 })).toBe(2);
    expect(careWearMultiplier({ greased: false, dirt: 25 })).toBe(3);
  });

  it("donne un bonus de récolte si la machine est nickel", () => {
    expect(careYieldBonus({ greased: true, dirt: 0 })).toBe(0.08);
    expect(careYieldBonus({ greased: false, dirt: 25 })).toBe(-0.06);
    expect(careYieldBonus({ greased: true, dirt: 25 })).toBe(0);
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

  it("laisse partir une fois sans graisse, refuse la suivante", () => {
    expect(machineWorkBlock({ ...sane, greased: false, greaseSkipStreak: 0 }, 12)).toBeNull();
    expect(machineWorkBlock({ ...sane, greased: false, greaseSkipStreak: 1 }, 12)?.code).toBe(
      "NEED_GREASE",
    );
  });

  it("bloque une panne même en bon état", () => {
    expect(machineWorkBlock({ ...sane, breakdown: "BELT" }, 12)?.code).toBe("BROKEN");
  });

  it("ne casse pas une machine graissée, propre et au-dessus de 50 %", () => {
    expect(breakdownChance({ condition: 80, greased: true, dirt: 0 })).toBe(0);
  });

  it("classe la panne selon l'état", () => {
    expect(pickBreakdownKind(70)).toBe("BELT");
    expect(pickBreakdownKind(30)).toBe("HYDRAULIC");
    expect(pickBreakdownKind(10)).toBe("ENGINE");
  });

  it("consomme la graisse et salit après un chantier", () => {
    const { next, broke } = applyJobCare(sane, { work: "HARVEST", cells: 10, rng: () => 1 });
    expect(broke).toBe(false);
    expect(next.greased).toBe(false);
    expect(next.dirt).toBeGreaterThan(0);
    expect(next.greaseSkipStreak).toBe(0);
  });

  it("compte un départ sans graisse", () => {
    const { next } = applyJobCare(
      { ...sane, greased: false },
      { work: "PLOW", cells: 4, rng: () => 1 },
    );
    expect(next.greaseSkipStreak).toBe(1);
  });

  it("force une panne si le tirage est en dessous de la chance", () => {
    const worn = { ...sane, condition: 30, greased: false, dirt: 60 };
    const { broke, next } = applyJobCare(worn, { work: "HARVEST", cells: 8, rng: () => 0 });
    expect(broke).toBe(true);
    expect(next.breakdown).toBe("HYDRAULIC");
  });

  it("répare le moteur à 100 %, une courroie de +30", () => {
    expect(repairTargetCondition("ENGINE", 12)).toBe(100);
    expect(repairTargetCondition("BELT", 40)).toBe(70);
  });
});
