import fs from "node:fs";

/**
 * La fiche d'une parcelle voisine.
 *
 * Elle dit le prix et achète, ou dit pourquoi pas. Le verrou d'adjacence vit
 * au serveur (`colleeAuxSiennes`, voir `achat-parcelle.test.ts`) : la fiche
 * affiche son refus mot pour mot plutôt que d'en recopier la règle.
 */
const SHEET = fs.readFileSync("src/ParcelleVoisineSheet.tsx", "utf8");

describe("la fiche d’une parcelle voisine", () => {
  it("annonce le prix, puis achète ou dit pourquoi pas", () => {
    expect(SHEET).toContain("formatEuros(voisin.prix)");
    expect(SHEET).toContain("voisin.achetable ?");
    expect(SHEET).toContain('{voisin.refus ?? "Pas encore accessible."}');
  });

  it("mène sur une parcelle qu’on possède déjà", () => {
    expect(SHEET).toContain("Aller sur cette parcelle");
  });
});
