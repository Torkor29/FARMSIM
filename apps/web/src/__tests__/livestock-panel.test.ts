import fs from "node:fs";

const PANEL = fs.readFileSync("src/LivestockPanel.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");

/**
 * L'élevage doit se lire en quelques secondes : combien de bêtes, si elles
 * vont bien, ce qui cloche, et le détail au clic. Ce test empêche de
 * recoller toutes les jauges au même niveau, et surtout de ramener la
 * phrase « enfermées depuis trop longtemps ».
 */
describe("panneau d’élevage", () => {
  it("plie les catégories au lieu de tout afficher d’un coup", () => {
    expect(PANEL).toContain("NeedFold");
    expect(PANEL).toContain("Espace disponible");
    expect(PANEL).toContain("Bien-être");
    expect(PANEL).toContain("Nourriture");
    expect(PANEL).toContain("Litière");
    expect(PANEL).toContain("Eau");
    expect(PANEL).toContain("Production");
    expect(CSS).toContain(".herd-need");
    expect(CSS).toContain(".welfare-ok");
  });

  it("ne punit plus le fait de rester à l’étable", () => {
    expect(PANEL).not.toMatch(/enfermées depuis trop longtemps/i);
    expect(PANEL).toMatch(/pré est un bonus/i);
    expect(PANEL).toContain("welfareOkLine");
    expect(PANEL).toContain("SPACE_COMFORT_LABELS");
  });
});
