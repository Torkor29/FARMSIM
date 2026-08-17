import {
  BALE_TONS,
  DEFAULT_CONSIGNES,
  NPC_PARCEL_SHARE,
  SILAGE_MIN_PROGRESS,
  STRAW_YIELD,
  balesFromStraw,
  GOOD_DEFS,
  MARKET_BOUNDS,
  SELLABLE_GOODS,
  canSilageHarvest,
  leavesSwath,
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

describe("andain laissé ou broyé", () => {
  it("garde l'andain par défaut — le comportement d'avant l'option", () => {
    // Deux arguments seulement : c'est ainsi que l'appellent le prestataire,
    // les consignes et les missions. Aucun d'eux ne doit perdre sa paille.
    expect(strawYieldFor("WHEAT", false)).toBeCloseTo(STRAW_YIELD.WHEAT);
  });

  it("ne laisse rien quand le moissonneur broie", () => {
    expect(strawYieldFor("WHEAT", false, false)).toBe(0);
    expect(strawYieldFor("BARLEY", false, false)).toBe(0);
  });

  it("garde l'andain quand on le demande explicitement", () => {
    expect(strawYieldFor("BARLEY", false, true)).toBeCloseTo(STRAW_YIELD.BARLEY);
  });

  it("l'ensilage l'emporte : plante entière, rien au sol", () => {
    expect(strawYieldFor("MAIZE", true, true)).toBe(0);
  });

  it("leavesSwath distingue les pailleuses de l'herbe", () => {
    expect(leavesSwath("WHEAT")).toBe(true);
    expect(leavesSwath("BARLEY")).toBe(true);
    expect(leavesSwath("MAIZE")).toBe(true);
    expect(leavesSwath("GRASS")).toBe(false);
    expect(leavesSwath(null)).toBe(false);
    expect(leavesSwath(undefined)).toBe(false);
  });
});

describe("bottes de paille comme marchandise", () => {
  it("se vendent et s'achètent, contrairement à l'ensilage qui reste local", () => {
    expect(GOOD_DEFS.STRAW_BALE.sellable).toBe(true);
    expect(GOOD_DEFS.STRAW_BALE.purchasable).toBe(true);
    expect(SELLABLE_GOODS).toContain("STRAW_BALE");
  });

  it("se comptent en bottes, pas en tonnes", () => {
    // C'est ce qui les distingue du vrac à l'écran comme au marché : on
    // charge un nombre de bottes, on ne pèse pas un tas.
    expect(GOOD_DEFS.STRAW_BALE.unit).toBe("bottes");
    expect(GOOD_DEFS.STRAW.unit).toBe("t");
  });

  it("valent plus cher la tonne que le vrac — la presse se paie", () => {
    // Sans cet écart, botteler ne rapporterait rien et la presse à balles
    // serait un achat perdu.
    const tonneBottelee = GOOD_DEFS.STRAW_BALE.basePrice / BALE_TONS;
    expect(tonneBottelee).toBeGreaterThan(GOOD_DEFS.STRAW.basePrice);
  });

  it("ont un cours amorçable par le marché", () => {
    expect(MARKET_BOUNDS.STRAW_BALE.min).toBeLessThan(MARKET_BOUNDS.STRAW_BALE.initial);
    expect(MARKET_BOUNDS.STRAW_BALE.max).toBeGreaterThan(MARKET_BOUNDS.STRAW_BALE.initial);
  });
});
