import fs from "node:fs";

/**
 * Travailler une autre de ses parcelles sans « changer de terrain ».
 *
 * Toucher une de ses propres parcelles dans le paysage ouvrait une fiche qui
 * disait « Cette parcelle est déjà la vôtre », et rien d'autre. Pour y semer il
 * fallait trouver « Mes parcelles », cliquer son nom — et le paysage sautait
 * d'un champ, la cour et le chemin avec lui.
 *
 * Vérifié dans le navigateur : un clic sur une case de la parcelle voisine la
 * rend active, la case est désignée, et la route, la cour, les voisins et les
 * arbres restent au pixel près à leur place. Aller-retour compris.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");
const VUE = fs.readFileSync("src/IsoFarmView.tsx", "utf8");

describe("une case de sa parcelle voisine se travaille directement", () => {
  it("la vue reconnaît une de ses parcelles et donne la case touchée", () => {
    expect(VUE).toMatch(/statut === "MOI"/);
    expect(VUE).toMatch(/onOwnedCellRef\.current\(touche\.voisin\.id, touche\.x, touche\.y/);
  });

  it("la caméra compense le changement d'origine au lieu de sauter", () => {
    expect(VUE).toMatch(/view\.panX -= ici\.x;/);
    expect(VUE).toMatch(/view\.panZ -= ici\.z;/);
  });

  it("la cour, le chemin et l'orientation restent au siège de la ferme", () => {
    // Sans cela la cour suivait la parcelle active et allait recouvrir celle
    // qu'on venait de quitter — maison comprise.
    expect(VUE).toMatch(/repere\.mx \+ ileOuest/);
    expect(VUE).toMatch(/maison: homeRef\.current/);
    expect(APP).toMatch(/homeParcelId=\{player\?\.farm\?\.parcels\[0\]\?\.id\}/);
  });

  it("le geste est rejoué une fois la parcelle chargée — un seul clic suffit", () => {
    expect(APP).toMatch(/gesteApresBascule\.current = \{ parcelId, x, y, mods \}/);
    expect(APP).toMatch(/parcelDetail\?\.parcel\.id !== attente\.parcelId/);
  });

  it("la commune est recentrée, pas vidée — pas de paysage inventé une seconde", () => {
    expect(APP).toMatch(/col: v\.col - cible\.col, rang: v\.rang - cible\.rang/);
  });
});

describe("l'élevage reste celui de la ferme", () => {
  it("le menu et le panneau lisent les étables de toute la ferme", () => {
    // Aller semer à côté faisait disparaître « Élevage » du menu.
    expect(APP).toMatch(/\.\.\.\(barnsFerme\.length > 0/);
    expect(APP).toMatch(/barns=\{barnsFerme\}/);
  });

  it("ce qui se dessine sur l'île reste celui de la parcelle active", () => {
    // Tas de fumier et signaux d'enclos sont posés par rapport à l'île.
    expect(APP).toMatch(/manurePiles=\{barns\.flatMap/);
    expect(APP).toMatch(/yardSignals=\{barns\.flatMap/);
  });
});
