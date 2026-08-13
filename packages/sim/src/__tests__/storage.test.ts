import {
  allocateGrainIntake,
  grainForcedSaleReason,
  grainSoldTons,
  grainStockFromItems,
  isGrainGood,
  totalGrainTons,
} from "@farmsim/shared";

describe("silo à grain", () => {
  it("ne range que les céréales", () => {
    expect(isGrainGood("MAIZE")).toBe(true);
    expect(isGrainGood("PEA")).toBe(true);
    expect(isGrainGood("HAY")).toBe(false);
    expect(isGrainGood("MILK")).toBe(false);
  });

  it("compte le stock de céréales, pas le foin", () => {
    const stock = grainStockFromItems([
      { itemCode: "MAIZE", qty: 4 },
      { itemCode: "HAY", qty: 10 },
      { itemCode: "WHEAT", qty: 1.5 },
    ]);
    expect(stock.MAIZE).toBe(4);
    expect(stock.WHEAT).toBe(1.5);
    expect(totalGrainTons(stock)).toBe(5.5);
  });

  it("vend toute la récolte s'il n'y a pas de silo", () => {
    const plan = allocateGrainIntake({
      capacity: 0,
      current: {},
      incoming: [{ code: "MAIZE", tons: 8.2 }],
    });
    expect(plan.keptIncoming.MAIZE ?? 0).toBe(0);
    expect(plan.soldIncoming.MAIZE).toBe(8.2);
    expect(plan.stored.MAIZE).toBe(0);
    expect(grainSoldTons(plan)).toBe(8.2);
    expect(grainForcedSaleReason(0, grainSoldTons(plan))).toBe("NO_SILO");
  });

  it("vide un stock illégal déjà là sans silo", () => {
    const plan = allocateGrainIntake({
      capacity: 0,
      current: { MAIZE: 3, WHEAT: 1 },
      incoming: [{ code: "MAIZE", tons: 2 }],
    });
    expect(plan.dumpedExisting.MAIZE).toBe(3);
    expect(plan.dumpedExisting.WHEAT).toBe(1);
    expect(plan.soldIncoming.MAIZE).toBe(2);
    expect(totalGrainTons(plan.stored)).toBe(0);
  });

  it("range ce qui tient et vend le trop-plein", () => {
    const plan = allocateGrainIntake({
      capacity: 40,
      current: { WHEAT: 35 },
      incoming: [{ code: "MAIZE", tons: 12 }],
    });
    expect(plan.keptIncoming.MAIZE).toBe(5);
    expect(plan.soldIncoming.MAIZE).toBe(7);
    expect(plan.stored.WHEAT).toBe(35);
    expect(plan.stored.MAIZE).toBe(5);
    expect(grainForcedSaleReason(40, grainSoldTons(plan))).toBe("SILO_FULL");
  });

  it("garde toute la récolte tant que le silo a de la place", () => {
    const plan = allocateGrainIntake({
      capacity: 40,
      current: { WHEAT: 2 },
      incoming: [
        { code: "WHEAT", tons: 4 },
        { code: "PEA", tons: 1 },
      ],
    });
    expect(plan.soldIncoming.WHEAT ?? 0).toBe(0);
    expect(plan.keptIncoming.WHEAT).toBe(4);
    expect(plan.stored.WHEAT).toBe(6);
    expect(plan.stored.PEA).toBe(1);
    expect(grainSoldTons(plan)).toBe(0);
    expect(grainForcedSaleReason(40, 0)).toBeNull();
  });
});
