/**
 * Une terre labourée peut redevenir verte, et l'écran doit le dire.
 *
 * ## Ce qui s'est passé
 *
 * Signalé en jouant le 28 août : « je peux plus nettoyer le terrain pour
 * qu'après labour ça redevienne vert ». Le geste existait pourtant, et
 * fonctionnait : le déchaumeur sait reprendre une terre nue et la remettre en
 * herbe — `canRegrass` et `applyRegrass` dans `soil.ts`, la route
 * `/parcels/:id/stubble` qui renvoie `regrassed`, et un test d'API qui suit
 * le chemin complet du chantier à la case relue.
 *
 * Ce qui manquait était côté écran. Le client ne lisait que `stubbled`. Sur
 * un champ labouré il n'y a **pas** de chaumes à enfouir : le joueur payait,
 * son champ reverdissait pour de bon, et le message annonçait
 *
 *     Sol déchaumé ×0 · −360 € · +0 % sur la prochaine récolte
 *
 * — de quoi conclure que la fonctionnalité avait disparu. Elle n'avait
 * jamais été annoncée.
 *
 * Ces assertions lisent la source : c'est une propriété du code d'écran, pas
 * un comportement à exécuter.
 */

import fs from "node:fs";
import { SOIL_OPTIONS } from "../ui/tool-options";

const APP = fs.readFileSync("src/App.tsx", "utf8");

describe("la remise en herbe se voit", () => {
  it("est lue dans la réponse du déchaumage", () => {
    expect(APP).toMatch(/regrassed: number;/);
    expect(APP).toMatch(/r\.regrassed \? `Remis en herbe ×\$\{r\.regrassed\}`/);
  });

  it("n'annonce plus un déchaumage qui n'a pas eu lieu", () => {
    // L'ancien message était inconditionnel — d'où le « ×0 » et le « +0 % »
    // sur un champ pourtant remis en herbe.
    expect(APP).not.toMatch(/`Sol déchaumé ×\$\{r\.stubbled\} · −/);
  });

  it("ne promet un bonus de résidus que s'il y a eu des résidus", () => {
    /*
     * `nextBonus` vaut `null` quand rien n'a été déchaumé. `Math.round(null *
     * 100)` donne zéro sans broncher : le joueur lisait « +0 % sur la
     * prochaine récolte », une promesse vide plutôt qu'une absence.
     */
    expect(APP).toMatch(/nextBonus: number \| null;/);
    expect(APP).toMatch(/r\.stubbled && r\.nextBonus/);
  });

  it("s'annonce dans l'aide de l'outil, sinon personne ne la cherche là", () => {
    const dechaumer = SOIL_OPTIONS.find((o) => o.tool === "STUBBLE");
    expect(dechaumer).toBeDefined();
    expect(dechaumer!.hint).toMatch(/herbe/);
  });
});
