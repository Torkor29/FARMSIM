/**
 * Environnement de l'animal : lieu de vie, pâture et confort thermique.
 *
 * Ces trois entrées manquaient à la simulation. Les tests ci-dessous fixent
 * ce qu'elles doivent produire, et surtout ce qu'elles ne doivent **pas**
 * casser : le comportement d'avant se retrouve intact quand on n'y touche pas.
 */

import {
  DEFAULT_HOUSING,
  GRASS_GROWTH,
  GRASS_INTAKE_TONS,
  SPECIES,
  THERMAL_MAX_PENALTY,
  feedSavedByPasture,
  feltTempC,
  grassCapacity,
  grazePasture,
  grazesForFood,
  outdoorTempC,
  parseHousing,
  thermalAlert,
  thermalPenalty,
} from "@farmsim/shared";

describe("lieu de vie", () => {
  it("rentre par défaut — une base d'avant la colonne ne sort pas les bêtes toute seule", () => {
    expect(DEFAULT_HOUSING).toBe("INSIDE");
    expect(parseHousing(null)).toBe("INSIDE");
    expect(parseHousing(undefined)).toBe("INSIDE");
    expect(parseHousing("n'importe quoi")).toBe("INSIDE");
  });

  it("lit le seul état qui sort les bêtes", () => {
    expect(parseHousing("OUTSIDE")).toBe("OUTSIDE");
  });
});

describe("température", () => {
  it("l'hiver est plus froid que l'été, la neige plus froide que le beau temps", () => {
    expect(outdoorTempC("WINTER", "CLEAR")).toBeLessThan(outdoorTempC("SUMMER", "CLEAR"));
    expect(outdoorTempC("WINTER", "SNOW")).toBeLessThan(outdoorTempC("WINTER", "CLEAR"));
  });

  it("le bâtiment rapproche du confort, il ne chauffe pas au hasard", () => {
    const dehors = feltTempC({ kind: "COW", housing: "OUTSIDE", season: "WINTER", weather: "SNOW" });
    const dedans = feltTempC({ kind: "COW", housing: "INSIDE", season: "WINTER", weather: "SNOW" });
    expect(dedans).toBeGreaterThan(dehors);
    // Et en pleine canicule il rafraîchit, au lieu d'ajouter bêtement des degrés.
    const chaudDehors = feltTempC({ kind: "COW", housing: "OUTSIDE", season: "SUMMER", weather: "CLEAR" });
    const chaudDedans = feltTempC({ kind: "COW", housing: "INSIDE", season: "SUMMER", weather: "CLEAR" });
    expect(chaudDedans).toBeLessThan(chaudDehors);
  });

  it("une étable améliorée tempère mieux — une raison de la monter en niveau", () => {
    const n1 = feltTempC({ kind: "COW", housing: "INSIDE", season: "WINTER", weather: "SNOW", barnLevel: 1 });
    const n5 = feltTempC({ kind: "COW", housing: "INSIDE", season: "WINTER", weather: "SNOW", barnLevel: 5 });
    expect(n5).toBeGreaterThan(n1);
  });

  it("ne pénalise rien dans la plage de confort", () => {
    const profil = SPECIES.COW;
    const milieu = (profil.comfortMinC + profil.comfortMaxC) / 2;
    expect(thermalPenalty({ kind: "COW", tempC: milieu })).toBe(0);
  });

  it("pénalise le froid comme le chaud, et plafonne", () => {
    expect(thermalPenalty({ kind: "COW", tempC: -40 })).toBeCloseTo(THERMAL_MAX_PENALTY);
    expect(thermalPenalty({ kind: "COW", tempC: 60 })).toBeCloseTo(THERMAL_MAX_PENALTY);
  });

  it("le mouton tient le froid mieux que la poule", () => {
    const froid = -8;
    expect(thermalPenalty({ kind: "SHEEP", tempC: froid })).toBeLessThan(
      thermalPenalty({ kind: "HEN", tempC: froid }),
    );
  });

  it("hiérarchise l'alerte", () => {
    expect(thermalAlert(0)).toBe("none");
    expect(thermalAlert(0.1)).toBe("warn");
    expect(thermalAlert(THERMAL_MAX_PENALTY)).toBe("danger");
  });
});

describe("pâture", () => {
  it("l'herbe ne pousse pas en hiver", () => {
    expect(GRASS_GROWTH.WINTER).toBe(0);
    expect(GRASS_GROWTH.SPRING).toBeGreaterThan(0);
  });

  it("pousse jusqu'au plafond de l'enclos, jamais au-delà", () => {
    const out = grazePasture({
      grassTons: 0,
      paddockCells: 10,
      season: "SPRING",
      animalsOutside: 0,
      cycles: 1000,
    });
    expect(out.grassTons).toBeCloseTo(grassCapacity(10));
  });

  it("un pré vert couvre tout le besoin des bêtes sorties", () => {
    const out = grazePasture({
      grassTons: 5,
      paddockCells: 10,
      season: "SUMMER",
      animalsOutside: 8,
      cycles: 1,
    });
    expect(out.coverage).toBeCloseTo(1);
    expect(out.eatenTons).toBeCloseTo(GRASS_INTAKE_TONS * 8);
  });

  it("un pré nu ne couvre rien — c'est le surpâturage, sans mécanique à part", () => {
    const out = grazePasture({
      grassTons: 0,
      paddockCells: 10,
      season: "WINTER",
      animalsOutside: 20,
      cycles: 1,
    });
    expect(out.eatenTons).toBe(0);
    expect(out.coverage).toBe(0);
  });

  it("épargne la ration à proportion des bêtes réellement dehors", () => {
    // Tout le lot dehors sur un pré vert : plus rien ne sort du hangar.
    expect(feedSavedByPasture({ herdSize: 10, animalsOutside: 10, coverage: 1 })).toBeCloseTo(1);
    // La moitié dehors : au mieux la moitié d'épargnée.
    expect(feedSavedByPasture({ herdSize: 10, animalsOutside: 5, coverage: 1 })).toBeCloseTo(0.5);
    // Rentré : rien d'épargné, on mange le stock — c'est l'hiver à l'étable.
    expect(feedSavedByPasture({ herdSize: 10, animalsOutside: 0, coverage: 1 })).toBe(0);
  });

  it("ne peut pas épargner plus que tout", () => {
    expect(
      feedSavedByPasture({ herdSize: 4, animalsOutside: 99, coverage: 1 }),
    ).toBeLessThanOrEqual(1);
  });

  it("seuls les ruminants se nourrissent au pré", () => {
    expect(grazesForFood("COW")).toBe(true);
    expect(grazesForFood("SHEEP")).toBe(true);
    // Un cochon fouille sa souille, une poule gratte sa courette : la sortie
    // leur fait du bien, elle ne remplace pas la ration.
    expect(grazesForFood("PIG")).toBe(false);
    expect(grazesForFood("HEN")).toBe(false);
  });
});
