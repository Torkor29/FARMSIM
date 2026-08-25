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
    /*
     * La vignette n'impose plus sa hauteur en pixels : c'est la feuille de
     * style qui l'accorde, et elle la réduit sur un écran court.
     *
     * En dur à 320 px, elle occupait la moitié du panneau sur un téléphone
     * tenu droit et coupait « Conso » et « Prix neuf » en plein milieu d'une
     * ligne. Le corps défile, donc rien n'était perdu — mais une ligne
     * tranchée par le bas se lit comme un bogue, pas comme un défilement.
     *
     * On tient donc l'inverse de ce qu'on tenait : pas de hauteur en dur, et
     * une borne qui vient du CSS.
     */
    expect(sheet).not.toContain("height={320}");
    expect(css).toMatch(/\.machine-sheet-art \.machine-view3d \{ height: clamp\(/);
    expect(sheet).toContain("machine-sheet-tiers");
    // Le cadre suit la même borne que la toile : plein sur écran large,
    // réduit sur écran court pour laisser voir la première rangée de chiffres.
    expect(css).toMatch(/\.machine-sheet-art \{[^}]*min-height: clamp\(/s);
  });
});
