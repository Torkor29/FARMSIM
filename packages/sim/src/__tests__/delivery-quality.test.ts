import {
  DELIVERY_TTL_MS,
  DRYING,
  STARTER_COW_COUNT,
  STARTER_HAY_TONS,
  deliveryAutoFee,
  deliveryHaulPath,
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

  it("fait entrer le tracteur par le bord opposé au silo", () => {
    const path = deliveryHaulPath(12, 12, { x: 9, y: 2 });
    expect(path[0]).toEqual({ x: 0, y: 2 });
    expect(path[path.length - 1]).toEqual({ x: 9, y: 2 });
    expect(path.length).toBeGreaterThanOrEqual(2);
    expect(path.every((c) => c.x >= 0 && c.x < 12 && c.y >= 0 && c.y < 12)).toBe(true);
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
