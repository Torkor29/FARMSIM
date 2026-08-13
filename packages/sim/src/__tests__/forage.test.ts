import {
  BALE_TONS,
  DEFAULT_CONSIGNES,
  NPC_PARCEL_SHARE,
  SILAGE_MIN_PROGRESS,
  STRAW_YIELD,
  balesFromStraw,
  canSilageHarvest,
  parseConsignes,
  silageYieldTons,
  strawFromBales,
  strawYieldFor,
} from "@farmsim/shared";

describe("paille", () => {
  it("laisse plus de paille sur le blé que sur le pois, puis le maïs grain", () => {
    expect(STRAW_YIELD.WHEAT).toBeGreaterThan(STRAW_YIELD.PEA);
    expect(STRAW_YIELD.PEA).toBeGreaterThan(STRAW_YIELD.MAIZE);
  });

  it("n’en laisse pas après un ensilage", () => {
    expect(strawYieldFor("MAIZE", true)).toBe(0);
    expect(strawYieldFor("WHEAT", false)).toBe(STRAW_YIELD.WHEAT);
  });

  it("convertit l’andain en bottes d’environ 350 kg", () => {
    expect(BALE_TONS).toBeCloseTo(0.35, 5);
    expect(balesFromStraw(0.7)).toBe(2);
    expect(strawFromBales(2)).toBeCloseTo(0.7, 5);
    expect(balesFromStraw(0)).toBe(0);
  });
});

describe("ensilage", () => {
  it("n’accepte que le maïs assez avancé", () => {
    expect(canSilageHarvest({ crop: "WHEAT", progress: 1 })).toBe(false);
    expect(canSilageHarvest({ crop: "MAIZE", progress: 0.4 })).toBe(false);
    expect(canSilageHarvest({ crop: "MAIZE", progress: SILAGE_MIN_PROGRESS })).toBe(true);
    expect(canSilageHarvest({ crop: "MAIZE", progress: 0.8, lost: true })).toBe(false);
  });

  it("rapporte plus de tonnage que le grain", () => {
    const grain = 0.45;
    expect(silageYieldTons(grain, 1)).toBeGreaterThan(grain * 2);
    expect(silageYieldTons(grain, 1)).toBeGreaterThan(silageYieldTons(grain, SILAGE_MIN_PROGRESS));
  });
});

describe("consignes", () => {
  it("ne sème jamais une culture nouvelle", () => {
    expect(DEFAULT_CONSIGNES.harvest).toBe(true);
    const parsed = parseConsignes('{"harvest":true,"plant":true}');
    expect(parsed).not.toHaveProperty("plant");
  });

  it("borne le plafond de dépense", () => {
    expect(parseConsignes('{"maxSpend":-12}').maxSpend).toBe(0);
    expect(parseConsignes("{}").maxSpend).toBe(DEFAULT_CONSIGNES.maxSpend);
  });

  it("cible un tiers des parcelles d’une région pour les PNJ", () => {
    expect(NPC_PARCEL_SHARE).toBeCloseTo(0.3, 5);
  });
});
