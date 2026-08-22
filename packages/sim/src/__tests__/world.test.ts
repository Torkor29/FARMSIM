import {
  ALL_REGIONS,
  CLASS_PROFILES,
  CLIMATE_WEATHER,
  SEASON_DURATION_MS,
  WORLD,
  climateWeatherOdds,
  currentSeason,
  parcelName,
  weatherOdds,
} from "@farmsim/shared";

describe("monde", () => {
  it("expose six continents de six régions chacun", () => {
    expect(WORLD).toHaveLength(6);
    for (const c of WORLD) {
      expect(c.regions).toHaveLength(6);
    }
    expect(ALL_REGIONS).toHaveLength(36);
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
  /** Un lundi à minuit UTC : l'année de jeu commence au printemps. */
  const LUNDI = Date.UTC(2026, 7, 24);
  const JOUR = 24 * 60 * 60 * 1000;

  it("inverse les saisons entre les deux hémisphères", () => {
    expect(currentSeason("N", LUNDI)).toBe("SPRING");
    expect(currentSeason("S", LUNDI)).toBe("AUTUMN");
  });

  it("avance d’une saison au fil de la semaine", () => {
    // Deux jours réels par saison pleine, un seul pour l'hiver.
    expect(currentSeason("N", LUNDI)).toBe("SPRING");
    expect(currentSeason("N", LUNDI + JOUR * 2)).toBe("SUMMER");
    expect(currentSeason("N", LUNDI + JOUR * 4)).toBe("AUTUMN");
    expect(currentSeason("N", LUNDI + JOUR * 6)).toBe("WINTER");
    // Et la semaine suivante recommence.
    expect(currentSeason("N", LUNDI + JOUR * 7)).toBe("SPRING");
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

describe("table climatique détaillée", () => {
  it("couvre chaque code Köppen utilisé par une région", () => {
    for (const r of ALL_REGIONS) {
      expect(CLIMATE_WEATHER[r.koppen]).toBeDefined();
    }
  });

  it("somme chaque distribution à 1, pour tous les climats et saisons", () => {
    for (const [koppen, seasons] of Object.entries(CLIMATE_WEATHER)) {
      for (const [season, odds] of Object.entries(seasons)) {
        const total = Object.values(odds).reduce((a, b) => a + b, 0);
        expect({ koppen, season, total: Number(total.toFixed(3)) }).toEqual({
          koppen,
          season,
          total: 1,
        });
      }
    }
  });

  it("distingue deux climats tempérés que l’ancienne table confondait", () => {
    const mediterranean = climateWeatherOdds("Csa", "SUMMER");
    const oceanic = climateWeatherOdds("Cfb", "SUMMER");
    expect(mediterranean.CLEAR).toBeGreaterThan(oceanic.CLEAR);
    expect(mediterranean.RAIN).toBeLessThan(oceanic.RAIN);
  });

  it("réserve la neige aux climats et saisons qui la permettent", () => {
    expect(climateWeatherOdds("Aw", "WINTER").SNOW).toBe(0);
    expect(climateWeatherOdds("Dfb", "WINTER").SNOW).toBeGreaterThan(0);
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

  it("donne une seule machine de départ à chaque métier", () => {
    expect(Object.keys(CLASS_PROFILES)).toEqual(["CEREALIER", "ELEVEUR"]);
    expect(CLASS_PROFILES.CEREALIER.startingMachines.length).toBe(1);
    expect(CLASS_PROFILES.ELEVEUR.startingMachines.length).toBe(1);
  });
});
