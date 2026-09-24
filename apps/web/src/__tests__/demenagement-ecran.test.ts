/**
 * Déplacer un bâtiment, vu de l'écran.
 *
 * Demandé en jouant : « ça serait bien de pouvoir déplacer les bâtiments qu'on
 * a posé ». Le geste réutilise **exactement** celui de la pose — le fantôme
 * qui suit la souris, le quart de tour, la barre de confirmation. Ce n'est pas
 * une économie de code, c'est ce qui garantit qu'un réglage fait sur l'un vaut
 * pour l'autre : deux mécaniques de placement côte à côte auraient divergé au
 * premier ajustement, comme les deux listes de délégation l'avaient fait.
 *
 * Ce fichier tient les points où le partage pourrait mal tourner : le prix
 * annoncé, la place qu'on quitte, et les sorties.
 */

import fs from "node:fs";
import { BUILDING_DEFS, buildingMoveCost, type BuildingType } from "@farmsim/shared";

const APP = fs.readFileSync("src/App.tsx", "utf8");
const FICHE = fs.readFileSync("src/BuildingSheet.tsx", "utf8");

/** Le code seul : les commentaires expliquent la règle avec ses propres mots. */
function codeSeul(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const CODE = codeSeul(APP);
const CODE_FICHE = codeSeul(FICHE);

describe("on peut lancer un déménagement", () => {
  it("la fiche du bâtiment porte le bouton, avec son prix", () => {
    expect(CODE_FICHE).toContain("onMove");
    expect(FICHE).toMatch(/Déplacer/);
    // Le prix vient de la règle partagée, pas d'un nombre recopié.
    expect(CODE_FICHE).toContain("buildingMoveCost(");
  });

  it("le menu de la case le propose aussi", () => {
    expect(CODE).toMatch(/label: "Déplacer"[\s\S]{0,160}startMoveBuilding/);
  });

  it("le geste part de la place actuelle du bâtiment", () => {
    // Sinon le joueur perdrait de vue celle qu'il cherche justement à quitter.
    const i = CODE.indexOf("function startMoveBuilding");
    expect(i).toBeGreaterThan(0);
    expect(CODE.slice(i, i + 600)).toContain("setPendingBuild({ x: b.originX, y: b.originY })");
  });
});

describe("le prix annoncé est le prix débité", () => {
  it("l’écran et le serveur lisent la même fonction", () => {
    // C'est le défaut déjà corrigé sur le prestataire : le bouton annonçait le
    // service, le serveur débitait service plus semences.
    expect(CODE).toContain("buildingMoveCost(");
    const serveur = fs.readFileSync("../api/src/main.ts", "utf8");
    expect(serveur).toContain("buildingMoveCost(");
  });

  it("la barre montre le tarif du déplacement, pas le prix du catalogue", () => {
    /*
     * Le piège du partage : la barre de pose affiche `def.cost`. Réutilisée
     * telle quelle pour un déménagement, elle aurait annoncé le prix d'un
     * bâtiment neuf — sur un silo, vingt-huit mille € au lieu de deux mille
     * cinq cents.
     */
    expect(CODE).toContain("const prix = movingBuilding ? (moveCost ?? 0) : def.cost;");
    expect(CODE).toMatch(/\{movingBuilding \? "Déplacer" : "Construire"\} <b>\{prix\} €<\/b>/);
  });

  it("le tarif reste sous le prix du bâtiment neuf, partout", () => {
    // L'invariant que l'écran promet en affichant deux nombres différents.
    for (const type of Object.keys(BUILDING_DEFS) as BuildingType[]) {
      const neuf = BUILDING_DEFS[type].cost;
      expect(`${type} : ${buildingMoveCost(type, 1) < neuf}`).toBe(`${type} : true`);
    }
  });
});

describe("la place qu’on quitte ne se gêne pas elle-même", () => {
  it("les cases du bâtiment déménagé comptent comme libres", () => {
    /*
     * Un bâtiment qui glisse d'une case chevauche sa place d'avant. Sans cette
     * exception, tout déplacement de moins d'une emprise serait refusé — et le
     * réglage fin, qui est justement ce qu'on veut permettre, deviendrait le
     * seul cas impossible. Le serveur applique la même règle.
     */
    expect(CODE).toContain(
      'return c?.kind === "EMPTY" || (movingBuildingId != null && c?.buildingId === movingBuildingId);',
    );
  });

  it("déplacer sur place est refusé, et l’écran dit pourquoi", () => {
    // Un bouton actif qui débiterait pour ne rien changer serait pire qu'un
    // bouton gris.
    expect(CODE).toContain("Il est déjà là — choisissez une autre case");
    expect(CODE).toMatch(/disabled=\{busy \|\| !placeOk \|\| !bouge\}/);
  });
});

describe("les sorties", () => {
  it("Échap annule le déménagement sans rien débiter", () => {
    expect(CODE).toMatch(/if \(movingBuildingId\) cancelMoveBuilding\(\);\s*\n\s*else setPendingBuild\(null\);/);
  });

  it("changer d’outil ou de bâtiment abandonne le déménagement", () => {
    // Sans ce ménage, l'état survivrait sans fantôme ni barre, et le prochain
    // « Construire » partirait sur la route du déplacement.
    expect(CODE.match(/cancelMoveBuilding\(\)/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(CODE).toMatch(/if \(t !== "BUILD" && movingBuildingId\) cancelMoveBuilding\(\);/);
  });

  it("annuler quitte le mode au lieu de seulement effacer le fantôme", () => {
    expect(CODE).toMatch(
      /onClick=\{\(\) => \(movingBuilding \? cancelMoveBuilding\(\) : setPendingBuild\(null\)\)\}/,
    );
  });
});
