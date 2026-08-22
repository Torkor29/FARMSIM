import { formatTerrons } from "@farmsim/shared";

/**
 * Écrire une somme sans la faire couper.
 *
 * « 200000 TRN » débordait de la puce du bandeau et se faisait tronquer en
 * « 200000… » : le joueur perdait à la fois l'unité et l'ordre de grandeur, et
 * ne pouvait pas savoir s'il regardait deux cent mille ou deux millions.
 * Abréger est plus honnête que couper.
 */
describe("les terrons à l’écran", () => {
  it("écrit les petites sommes en entier", () => {
    expect(formatTerrons(0)).toBe("0 TRN");
    expect(formatTerrons(1234)).toBe("1234 TRN");
    expect(formatTerrons(9999)).toBe("9999 TRN");
  });

  it("abrège au millier au-delà de dix mille", () => {
    expect(formatTerrons(10_000)).toBe("10 k TRN");
    expect(formatTerrons(200_000)).toBe("200 k TRN");
    expect(formatTerrons(12_480)).toBe("12 k TRN");
  });

  it("abrège au million, avec une décimale quand elle dit quelque chose", () => {
    expect(formatTerrons(1_000_000)).toBe("1 M TRN");
    expect(formatTerrons(2_400_000)).toBe("2.4 M TRN");
  });

  it("arrondit plutôt que de tronquer", () => {
    expect(formatTerrons(1234.6)).toBe("1235 TRN");
  });

  it("tient les dettes comme les avoirs", () => {
    // La trésorerie peut passer sous zéro : un signe perdu se paierait cher.
    expect(formatTerrons(-450)).toBe("-450 TRN");
    expect(formatTerrons(-25_000)).toBe("-25 k TRN");
  });

  it("ne dépasse jamais ce que la puce peut montrer", () => {
    // Neuf caractères : la puce en tient dix à 0,78 rem sur 390 px.
    for (const n of [0, 999, 9999, 10_000, 999_999, 1_000_000, 999_000_000]) {
      expect(formatTerrons(n).length).toBeLessThanOrEqual(10);
    }
  });
});
