import {
  ALL_REGIONS,
  CLASS_PROFILES,
  SEASON_DURATION_MS,
  WORLD,
  currentSeason,
  estateYieldBonus,
  landPrice,
  landUpkeep,
  parcelName,
  requiredLevelForParcel,
  weatherOdds,
} from "@farmsim/shared";

describe("monde", () => {
  it("expose six continents dotés de régions", () => {
    expect(WORLD).toHaveLength(6);
    for (const c of WORLD) {
      expect(c.regions.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("n’utilise aucun code de région en double", () => {
    const codes = ALL_REGIONS.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("place chaque région dans l’hémisphère de son continent", () => {
    for (const c of WORLD) {
      for (const r of c.regions) {
        expect(r.lat > 0 ? "N" : "S").toBe(c.hemisphere);
      }
    }
  });

  it("génère des noms de parcelle stables et variés", () => {
    expect(parcelName("AUR", 0)).toBe(parcelName("AUR", 0));
    expect(parcelName("AUR", 0)).not.toBe(parcelName("AUR", 1));
  });
});

describe("saisons", () => {
  it("inverse les saisons entre les deux hémisphères", () => {
    const now = 0;
    expect(currentSeason("N", now)).toBe("SPRING");
    expect(currentSeason("S", now)).toBe("AUTUMN");
  });

  it("avance d’une saison à chaque palier", () => {
    expect(currentSeason("N", SEASON_DURATION_MS)).toBe("SUMMER");
    expect(currentSeason("N", SEASON_DURATION_MS * 2)).toBe("AUTUMN");
    expect(currentSeason("N", SEASON_DURATION_MS * 4)).toBe("SPRING");
  });

  it("distribue une probabilité météo complète", () => {
    for (const koppen of ["Cfb", "Dfa", "Aw", "BWh"]) {
      const odds = weatherOdds(koppen, "SUMMER");
      const total = Object.values(odds).reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(1, 1);
    }
  });

  it("ne fait jamais neiger en climat désertique chaud l’été", () => {
    expect(weatherOdds("BWh", "SUMMER").SNOW).toBe(0);
  });
});

describe("économie foncière", () => {
  const base = { fertility: 0.8, regionPriceMult: 1, continentPriceMult: 1 };

  it("fait grimper le prix à chaque parcelle possédée", () => {
    const first = landPrice({ ...base, ownedCount: 0 });
    const third = landPrice({ ...base, ownedCount: 2 });
    expect(third).toBeGreaterThan(first * 1.5);
  });

  it("valorise la terre fertile", () => {
    const poor = landPrice({ ...base, fertility: 0.4, ownedCount: 0 });
    const rich = landPrice({ ...base, fertility: 0.9, ownedCount: 0 });
    expect(rich).toBeGreaterThan(poor);
  });

  it("facture un supplément pour agrandir un bloc existant", () => {
    const isolated = landPrice({ ...base, ownedCount: 1, adjacentOwned: 0 });
    const clustered = landPrice({ ...base, ownedCount: 1, adjacentOwned: 3 });
    expect(clustered).toBeGreaterThan(isolated);
  });

  it("récompense le regroupement des parcelles, avec un plafond", () => {
    expect(estateYieldBonus({ adjacentOwned: 1, hemispheres: ["N"] })).toBeCloseTo(0.03);
    expect(estateYieldBonus({ adjacentOwned: 99, hemispheres: ["N"] })).toBeCloseTo(0.12);
  });

  it("récompense la présence dans les deux hémisphères", () => {
    const single = estateYieldBonus({ adjacentOwned: 0, hemispheres: ["N"] });
    const hedged = estateYieldBonus({ adjacentOwned: 0, hemispheres: ["N", "S"] });
    expect(hedged - single).toBeCloseTo(0.05);
  });

  it("exonère d’entretien les deux premières parcelles", () => {
    expect(landUpkeep([3000, 5000])).toBe(0);
    expect(landUpkeep([3000, 5000, 10000])).toBeGreaterThan(0);
  });

  it("taxe les parcelles les plus chères en premier", () => {
    // Les deux moins chères sont exonérées : seule la plus chère est taxée.
    expect(landUpkeep([1000, 2000, 10000])).toBe(150);
  });

  it("verrouille l’expansion derrière des paliers de niveau", () => {
    expect(requiredLevelForParcel(1)).toBe(1);
    expect(requiredLevelForParcel(2)).toBeGreaterThan(1);
    expect(requiredLevelForParcel(10)).toBeGreaterThan(requiredLevelForParcel(5));
    expect(requiredLevelForParcel(100)).toBeLessThanOrEqual(20);
  });
});

describe("classes", () => {
  it("décrit avantages et inconvénients pour chaque métier", () => {
    for (const profile of Object.values(CLASS_PROFILES)) {
      expect(profile.perks.length).toBeGreaterThan(0);
      expect(profile.drawbacks.length).toBeGreaterThan(0);
      expect(profile.startingMachines.length).toBeGreaterThan(0);
    }
  });

  it("donne deux machines de départ à l’ETA", () => {
    expect(CLASS_PROFILES.ETA.startingMachines.length).toBe(2);
    expect(CLASS_PROFILES.CEREALIER.startingMachines.length).toBe(1);
  });
});
