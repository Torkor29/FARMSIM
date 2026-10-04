import fs from "node:fs";

import { REFUS_PAS_COLLEE, colleeAuxSiennes } from "@farmsim/shared";

/**
 * La terre s'achète parcelle par parcelle, dans le paysage.
 *
 * Il y a eu les lots de 6×6 : on complétait sa propre parcelle carré par
 * carré, autour d'elle. « Je préfère pouvoir acheter les parcelles voisines »,
 * comme dans un jeu de ferme : la parcelle d'à côté, entière, libre ou tenue
 * par un PNJ, collée à l'une des siennes — de l'autre côté du chemin ou de la
 * route s'il le faut.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");
const SHEET = fs.readFileSync("src/ParcelleVoisineSheet.tsx", "utf8");
const OFFICE = fs.readFileSync("src/OfficePanel.tsx", "utf8");

describe("la terre s'achète parcelle par parcelle, dans le paysage", () => {
  it("la fiche d'une parcelle voisine l'achète entière", () => {
    expect(APP).toMatch(/`\/parcels\/\$\{parcelId\}\/buy`/);
    expect(APP).toMatch(/onAcheter=\{async \(id\) => \{\s*await acheterParcelleVoisine\(id\);/);
    expect(SHEET).toContain("Acheter cette parcelle");
    expect(SHEET).toContain("Racheter cette parcelle");
    // Le refus vient du serveur, qui seul sait ce qui est collé et ce qui est permis.
    expect(SHEET).toContain("voisin.refus");
  });

  it("le Bureau renvoie au paysage, où sont les pancartes", () => {
    expect(OFFICE).toContain("Voir les parcelles à vendre");
    expect(OFFICE).not.toContain("lots de 6×6");
    expect(APP).toMatch(/onBuyLand=\{\(\) => \{\s*setShowEta\(false\);\s*agrandirMaFerme\(\);/);
  });

  it("le seul déplacement de vue reste celui que le joueur demande", () => {
    expect(APP).toMatch(/onClick=\{\(\) => setActiveParcelId\(p\.id\)\}/);
  });
});

describe("ce qu'on peut acheter", () => {
  const miennes = [{ zoneId: "Z", mapX: 4, mapY: 4 }];

  it("la parcelle collée par un côté, pas en diagonale ni plus loin", () => {
    expect(colleeAuxSiennes({ zoneId: "Z", mapX: 5, mapY: 4 }, miennes)).toBe(true);
    expect(colleeAuxSiennes({ zoneId: "Z", mapX: 4, mapY: 3 }, miennes)).toBe(true);
    expect(colleeAuxSiennes({ zoneId: "Z", mapX: 5, mapY: 5 }, miennes)).toBe(false);
    expect(colleeAuxSiennes({ zoneId: "Z", mapX: 6, mapY: 4 }, miennes)).toBe(false);
  });

  it("de proche en proche : chaque achat ouvre ses propres voisines", () => {
    const deux = [...miennes, { zoneId: "Z", mapX: 5, mapY: 4 }];
    expect(colleeAuxSiennes({ zoneId: "Z", mapX: 6, mapY: 4 }, deux)).toBe(true);
  });

  it("jamais dans une autre commune, et le refus le dit", () => {
    expect(colleeAuxSiennes({ zoneId: "Y", mapX: 5, mapY: 4 }, miennes)).toBe(false);
    expect(REFUS_PAS_COLLEE).toMatch(/collée/);
  });
});
