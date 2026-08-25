import fs from "node:fs";

/**
 * La caméra ne se téléporte pas parce qu'on a signé un acte de vente.
 *
 * Un joueur a rapporté qu'« après un achat, ses parcelles ne sont plus au même
 * endroit ». Deux causes étaient possibles. Mesurées, les deux existaient, mais
 * pas au même moment :
 *
 *  - la liste renvoyée par le serveur n'avait **aucun tri**, et le moindre
 *    travail de champ y déplaçait la parcelle travaillée. C'est réel, c'est
 *    corrigé côté API (`ordre-parcelles.test.ts`), mais cela ne se déclenche
 *    pas à l'achat ;
 *  - `buyAdjacent()` appelait `setActiveParcelId(parcelId)` juste après
 *    l'achat. **C'est celle-là que le joueur ressent** : la vue saute sur la
 *    parcelle qu'il vient d'acheter, au milieu du chantier qu'il regardait.
 *
 * On achète souvent une terre en prévision, pas pour y aller. Le déplacement
 * redevient donc un geste : un clic dans « Mes parcelles ».
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");

/** Le corps de `buyAdjacent`, du nom de la fonction à sa dernière accolade. */
function corpsDeBuyAdjacent(): string {
  const debut = APP.indexOf("async function buyAdjacent");
  expect(debut).toBeGreaterThan(-1);
  const suivant = APP.indexOf("\n  async function ", debut + 1);
  const fin = APP.indexOf("\n  /** Rachat immédiat", debut);
  return APP.slice(debut, Math.min(...[suivant, fin].filter((i) => i > debut)));
}

describe("acheter une parcelle ne déplace pas le joueur", () => {
  it("l’achat ne change pas la parcelle regardée", () => {
    expect(corpsDeBuyAdjacent()).not.toMatch(/setActiveParcelId\(/);
  });

  it("mais il le dit, et nomme la parcelle acquise", () => {
    // Sans retour visible, l'achat n'aurait plus aucun effet perceptible :
    // supprimer le saut ne doit pas supprimer la confirmation.
    const corps = corpsDeBuyAdjacent();
    expect(corps).toMatch(/setMsg\(/);
    expect(corps).toMatch(/Mes parcelles/);
  });

  it("le seul déplacement de vue reste celui que le joueur demande", () => {
    // Le rail « Mes parcelles » est la porte de sortie : c'est lui, et lui
    // seul, qui doit emmener sur une parcelle qu'on vient d'acheter.
    expect(APP).toMatch(/onClick=\{\(\) => setActiveParcelId\(p\.id\)\}/);
  });
});
