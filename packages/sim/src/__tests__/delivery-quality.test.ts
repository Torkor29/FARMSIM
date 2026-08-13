import {
  DELIVERY_TTL_MS,
  DRYING,
  STARTER_COW_COUNT,
  STARTER_HAY_TONS,
  deliveryAutoFee,
  lotQualityLine,
} from "@farmsim/shared";

describe("départ sans moissonneuse", () => {
  it("offre trois vaches et deux tonnes de foin à l’éleveur", () => {
    expect(STARTER_COW_COUNT).toBe(3);
    expect(STARTER_HAY_TONS).toBe(2);
  });
});

describe("livraison après la criée", () => {
  it("laisse huit minutes avant le voisin auto", () => {
    expect(DELIVERY_TTL_MS).toBe(8 * 60 * 1000);
  });

  it("facture le voisin auto plus cher qu’un trajet soi-même", () => {
    expect(deliveryAutoFee(1)).toBe(8);
    expect(deliveryAutoFee(10)).toBe(40);
  });
});

describe("fiche halle", () => {
  it("dit pourquoi le prix baisse", () => {
    expect(lotQualityLine({ tons: 12, moisture: 0.18, quality: 3 })).toBe(
      `12 t · 18 % d’eau · −${Math.round(DRYING.sellPenaltyAbove * 100)} %`,
    );
  });

  it("signale une récolte trop tardive", () => {
    expect(lotQualityLine({ tons: 5, moisture: 0.12, quality: 2 })).toContain(
      "Récolté trop tard",
    );
  });

  it("ne décote pas un lot sec de bonne qualité", () => {
    expect(lotQualityLine({ tons: 8, moisture: 0.12, quality: 3 })).toBe(
      "8 t · 12 % d’eau",
    );
  });
});
