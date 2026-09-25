import fs from "node:fs";

/**
 * Une seule façon d'avoir de la terre.
 *
 * Le jeu en avait deux, qui se marchaient dessus : acheter une parcelle du
 * monde, puis acheter chaque lot autour de sa ferme. « T'achètes une parcelle
 * ET t'achètes chaque carré. » Il n'en reste qu'une : la ferme grandit d'un
 * seul tenant, lot par lot, depuis le mode construction, sans limite. Tous
 * les chemins qui vendaient une parcelle mènent maintenant là.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");
const SHEET = fs.readFileSync("src/ParcelleVoisineSheet.tsx", "utf8");
const OFFICE = fs.readFileSync("src/OfficePanel.tsx", "utf8");

describe("la terre s'achète autour de sa ferme, et nulle part ailleurs", () => {
  it("le jeu n'achète plus de parcelle du monde", () => {
    expect(APP).not.toMatch(/`\/parcels\/\$\{parcelId\}\/buy`/);
    expect(APP).not.toContain("async function buyAdjacent");
  });

  it("la fiche d'une parcelle voisine et le Bureau mènent à l'agrandissement", () => {
    expect(SHEET).toContain("Agrandir ma ferme");
    expect(SHEET).not.toMatch(/Acheter cette parcelle/);
    expect(OFFICE).toContain("Agrandir ma ferme");
    expect(APP).toMatch(/onBuyLand=\{\(\) => \{\s*setShowEta\(false\);\s*agrandirMaFerme\(\);/);
  });

  it("agrandir ramène chez soi s'il le faut, puis ouvre la construction", () => {
    const debut = APP.indexOf("function agrandirMaFerme()");
    expect(debut).toBeGreaterThan(-1);
    const corps = APP.slice(debut, APP.indexOf("\n  }\n", debut));
    // Déjà chez soi : on reste où l'on est, rien ne saute.
    expect(corps).toMatch(/if \(!visiting && domaine\) \{\s*entrerConstruction\(\);/);
    // Chez un voisin : on rentre au siège, et la construction s'ouvre à l'arrivée.
    expect(corps).toContain("setActiveParcelId(siege)");
  });

  it("le seul déplacement de vue reste celui que le joueur demande", () => {
    expect(APP).toMatch(/onClick=\{\(\) => setActiveParcelId\(p\.id\)\}/);
  });
});
