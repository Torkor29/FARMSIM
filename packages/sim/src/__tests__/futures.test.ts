import {
  FUTURES_DISCOUNT,
  FUTURES_HORIZONS_H,
  FUTURES_MIN_TONS,
  FUTURES_PENALTY_RATE,
  MAX_OPEN_FUTURES,
  SELLABLE_GOODS,
  canOpenFuture,
  futuresOutcome,
  futuresPenalty,
  futuresPrice,
  futuresProceeds,
} from "@farmsim/shared";

const OK = {
  commodity: "WHEAT" as const,
  tons: 10,
  horizonH: 3,
  openContracts: 0,
  tradable: SELLABLE_GOODS,
};

describe("contrats à terme", () => {
  it("garantit un prix sous le cours du jour : la certitude se paie", () => {
    const spot = 300;
    for (const h of FUTURES_HORIZONS_H) {
      expect(futuresPrice(spot, h)).toBeLessThan(spot);
    }
  });

  it("décote d'autant plus que l'échéance est lointaine", () => {
    const spot = 300;
    const prix = FUTURES_HORIZONS_H.map((h) => futuresPrice(spot, h));
    for (let i = 1; i < prix.length; i++) {
      expect(prix[i]).toBeLessThan(prix[i - 1]);
    }
    expect(FUTURES_DISCOUNT[6]).toBeGreaterThan(FUTURES_DISCOUNT[1]);
  });

  it("accepte un engagement sans exiger le stock : c'est tout l'intérêt", () => {
    expect(canOpenFuture(OK).ok).toBe(true);
  });

  it("refuse un lot dérisoire, une marchandise hors marché, une échéance inconnue", () => {
    expect(canOpenFuture({ ...OK, tons: FUTURES_MIN_TONS / 2 }).reason).toBe("TOO_SMALL");
    expect(canOpenFuture({ ...OK, horizonH: 99 }).reason).toBe("EXPIRED_HORIZON");
    expect(
      canOpenFuture({ ...OK, commodity: "WHEAT", tradable: ["MAIZE"] }).reason,
    ).toBe("NOT_TRADED");
  });

  it("borne le nombre d'engagements ouverts", () => {
    expect(canOpenFuture({ ...OK, openContracts: MAX_OPEN_FUTURES }).reason).toBe("TOO_MANY_OPEN");
    expect(canOpenFuture({ ...OK, openContracts: MAX_OPEN_FUTURES - 1 }).ok).toBe(true);
  });

  it("pénalise le défaut plus lourdement que la décote la plus large", () => {
    // Sinon s'engager puis laisser filer serait une façon rentable d'emprunter.
    const pireDecote = Math.max(...Object.values(FUTURES_DISCOUNT));
    expect(FUTURES_PENALTY_RATE).toBeGreaterThan(pireDecote);
  });

  it("chiffre le gain et la pénalité", () => {
    expect(futuresProceeds(250, 10)).toBe(2500);
    expect(futuresPenalty(250, 10)).toBe(Math.round(2500 * FUTURES_PENALTY_RATE));
  });

  it("dit après coup si le pari valait le coup", () => {
    const gagnant = futuresOutcome({ pricePerTon: 280, tons: 10, marketPriceAtDue: 240 });
    expect(gagnant.better).toBe(true);
    expect(gagnant.delta).toBe(400);

    const perdant = futuresOutcome({ pricePerTon: 280, tons: 10, marketPriceAtDue: 320 });
    expect(perdant.better).toBe(false);
    expect(perdant.delta).toBe(-400);
  });

  it("laisse le comptant préférable quand le marché ne bouge pas", () => {
    // Une garantie qui rapporterait plus que la vente immédiate, à cours
    // constant, viderait le marché au comptant de tout intérêt.
    const spot = 300;
    const terme = futuresPrice(spot, 3);
    expect(futuresOutcome({ pricePerTon: terme, tons: 10, marketPriceAtDue: spot }).better).toBe(
      false,
    );
  });
});
