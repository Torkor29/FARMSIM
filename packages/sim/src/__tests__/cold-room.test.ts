import {
  BUILDING_DEFS,
  LIVESTOCK_CYCLE_MS,
  SPOILAGE_PER_CYCLE,
  SPOILAGE_SLOW_CAP,
  afterSpoilage,
  buildingStatsAtLevel,
  chilledSpoilageRate,
} from "@farmsim/shared";

describe("chambre froide", () => {
  it("existe comme bâtiment, avec un effet déclaré", () => {
    expect(BUILDING_DEFS.COLD_ROOM.name).toBe("Chambre froide");
    expect(BUILDING_DEFS.COLD_ROOM.spoilageSlow).toBeGreaterThan(0);
  });

  it("ralentit sans jamais arrêter la dégradation", () => {
    const brut = SPOILAGE_PER_CYCLE.MILK!;
    expect(chilledSpoilageRate(brut, 0)).toBeCloseTo(brut);
    expect(chilledSpoilageRate(brut, 0.4)).toBeCloseTo(brut * 0.6);
    // Même suréquipé, le lait finit par tourner.
    expect(chilledSpoilageRate(brut, 5)).toBeGreaterThan(0);
    expect(chilledSpoilageRate(brut, 5)).toBeCloseTo(brut * (1 - SPOILAGE_SLOW_CAP));
  });

  it("conserve nettement plus de lait sur la même durée", () => {
    const commun = {
      good: "MILK" as const,
      qty: 100,
      elapsedMs: LIVESTOCK_CYCLE_MS * 4,
      cycleMs: LIVESTOCK_CYCLE_MS,
    };
    const sans = afterSpoilage(commun);
    const avec = afterSpoilage({ ...commun, spoilageSlow: 0.4 });
    expect(avec).toBeGreaterThan(sans);
    expect(avec).toBeLessThan(100);
  });

  it("gagne en efficacité avec les paliers du bâtiment", () => {
    const un = buildingStatsAtLevel("COLD_ROOM", 1).spoilageSlow ?? 0;
    const cinq = buildingStatsAtLevel("COLD_ROOM", 5).spoilageSlow ?? 0;
    expect(cinq).toBeGreaterThan(un);
  });

  it("ne touche pas à ce qui ne périt pas", () => {
    const blé = afterSpoilage({
      good: "WHEAT",
      qty: 50,
      elapsedMs: LIVESTOCK_CYCLE_MS * 100,
      cycleMs: LIVESTOCK_CYCLE_MS,
      spoilageSlow: 0.4,
    });
    expect(blé).toBe(50);
  });
});
