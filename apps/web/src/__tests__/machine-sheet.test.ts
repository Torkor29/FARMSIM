import fs from "node:fs";

/**
 * Les cinq paliers des engins doivent se lire avant d'acheter ou d'améliorer.
 *
 * Le catalogue achetait d'un clic, et le garage ne disait pas le palier.
 * La fiche — illustration, stats, bonus, prix — est le geste unique.
 */
const sheet = fs.readFileSync("src/MachineSheet.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");

describe("la fiche des paliers d'engins", () => {
  it("existe et prévisualise avant l'achat comme avant l'amélioration", () => {
    expect(sheet).toContain("createPortal");
    expect(sheet).toContain("MachineView3D");
    expect(sheet).toContain("fiche.bonus");
    expect(sheet).toContain("Améliorer");
    expect(sheet).toContain("mode: \"upgrade\"");
    expect(app).toContain("MachineSheet");
    expect(app).toContain('mode: "upgrade"');
    expect(app).toContain('mode: "buy"');
    expect(app).toContain("onParkedClick");
    expect(app).not.toContain("onClick={() => buyMachine(t, tierAchat)}");
    expect(css).toContain(".machine-sheet");
  });

  it("montre les cinq crans T1–T5 sur le parc et au catalogue", () => {
    expect(app).toContain("MachineTierPips");
    expect(sheet).toContain("MACHINE_TIERS.map");
    expect(sheet).toContain("height={320}");
    expect(sheet).toContain("machine-sheet-tiers");
    expect(css).toContain("min-height: 320px");
  });
});
