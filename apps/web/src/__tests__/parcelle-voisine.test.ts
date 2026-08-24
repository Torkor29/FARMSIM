import fs from "node:fs";

/**
 * L'achat des terres alentours.
 *
 * La fiche voisine refusait ce qui n'était pas collé (« Trop loin… de proche
 * en proche »). On agrandit dans le voisinage, pas seulement mitoyen : ces
 * tests-là constatent que le verrou a disparu, pas l'apparence du bouton.
 */
const SHEET = fs.readFileSync("src/ParcelleVoisineSheet.tsx", "utf8");
const APP = fs.readFileSync("src/App.tsx", "utf8");
const OFFICE = fs.readFileSync("src/OfficePanel.tsx", "utf8");

describe("l’achat des parcelles alentours", () => {
  it("ne refuse plus une parcelle sous prétexte qu’elle n’est pas collée", () => {
    expect(SHEET).not.toMatch(/Trop loin de vos terres/);
    expect(SHEET).not.toMatch(/proche en proche/);
  });

  it("propose à l’achat les parcelles de la région, pas seulement les mitoyennes", () => {
    expect(APP).not.toMatch(/Math\.abs\(op\.mapX - fp\.mapX\) === 1/);
    expect(OFFICE).not.toMatch(/Parcelles adjacentes/);
    expect(OFFICE).not.toMatch(/parcelle adjacente/);
  });

  it("garde le bouton d’achat sur la fiche voisine", () => {
    expect(SHEET).toMatch(/Racheter cette parcelle/);
    expect(SHEET).toMatch(/Acheter cette parcelle/);
  });
});
