import {
  SALE_TOLERANCE_RATIO,
  SALE_TOLERANCE_TONS,
  maxSelectableTons,
  settleSaleTons,
} from "@farmsim/shared";

describe("vendre la totalité d'un lot", () => {
  it("laisse passer une demande inférieure au stock, sans la modifier", () => {
    expect(settleSaleTons(10, 83.714)).toBe(10);
    expect(settleSaleTons(83.714, 83.714)).toBe(83.714);
  });

  it("rabat sur le stock un dépassement d'arrondi au centième", () => {
    // Le cas signalé : l'écran propose 83,72 t pour 83,716 t en silo.
    expect(settleSaleTons(83.72, 83.716)).toBe(83.716);
  });

  it("absorbe la dégradation survenue depuis le dernier rafraîchissement", () => {
    // Le lait perd 12 % par cycle de quinze minutes ; entre deux
    // rafraîchissements, l'écart se compte en millièmes.
    const shown = 100;
    const actual = 99.6;
    expect(settleSaleTons(shown, actual)).toBe(actual);
  });

  it("refuse une demande franchement supérieure au stock", () => {
    expect(settleSaleTons(500, 5)).toBeNull();
    expect(settleSaleTons(12, 10)).toBeNull();
  });

  it("refuse une demande vide ou un silo vide", () => {
    expect(settleSaleTons(0, 10)).toBeNull();
    expect(settleSaleTons(-3, 10)).toBeNull();
    expect(settleSaleTons(5, 0)).toBeNull();
  });

  it("ne vend jamais plus que ce qui est là", () => {
    for (const [req, avail] of [
      [83.72, 83.716],
      [100, 99.6],
      [1, 0.999],
      [0.02, 0.011],
    ]) {
      const sold = settleSaleTons(req, avail);
      if (sold !== null) expect(sold).toBeLessThanOrEqual(avail);
    }
  });

  it("tolère au moins l'arrondi du centième sur les tout petits lots", () => {
    // La tolérance en valeur absolue protège les lots trop petits pour que la
    // tolérance proportionnelle suffise.
    expect(SALE_TOLERANCE_TONS).toBeGreaterThanOrEqual(0.01);
    expect(settleSaleTons(0.02, 0.015)).toBe(0.015);
  });

  it("échelonne la tolérance avec la taille du lot", () => {
    const big = 1000;
    const slack = big * SALE_TOLERANCE_RATIO;
    expect(settleSaleTons(big + slack * 0.9, big)).toBe(big);
    expect(settleSaleTons(big + slack * 1.5, big)).toBeNull();
  });
});

describe("quantité maximale sélectionnable", () => {
  it("tronque au pas du curseur au lieu d'arrondir", () => {
    expect(maxSelectableTons(83.716)).toBe(83.71);
    expect(maxSelectableTons(83.714)).toBe(83.71);
    expect(maxSelectableTons(12.005)).toBe(12);
  });

  it("ne propose jamais plus que le stock", () => {
    for (const qty of [0.004, 0.019, 1.999, 83.716, 1234.567]) {
      expect(maxSelectableTons(qty)).toBeLessThanOrEqual(qty);
    }
  });

  it("survit aux flottants qui tombent juste en dessous du pas", () => {
    // 0.1 + 0.2 vaut 0.30000000000000004 : sans marge, la troncature
    // renverrait 0,29 et le joueur ne pourrait jamais tout vendre.
    expect(maxSelectableTons(0.1 + 0.2)).toBe(0.3);
    expect(maxSelectableTons(3)).toBe(3);
  });

  it("renvoie zéro sur un silo vide plutôt qu'un négatif", () => {
    expect(maxSelectableTons(0)).toBe(0);
    expect(maxSelectableTons(0.004)).toBe(0);
  });
});
