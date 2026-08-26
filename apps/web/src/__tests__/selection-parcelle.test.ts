import fs from "node:fs";

/**
 * La sélection de cases ne survit pas à un changement de parcelle.
 *
 * Signalé en jeu : « quand on change de parcelle et qu'on utilise un outil, ça
 * change aléatoirement les états de parcelles ». Ce n'était pas aléatoire, et
 * ce n'était pas de l'affichage.
 *
 * `selectedCells` est une liste de coordonnées nues — `{x, y}` — sans le
 * moindre lien avec la parcelle où la sélection a été faite. Comme tous les
 * champs font douze cases sur douze, ces coordonnées restent valides sur
 * n'importe quelle autre parcelle. La séquence :
 *
 *   1. on sélectionne des cases sur la parcelle A ;
 *   2. on clique la parcelle B dans « Mes parcelles » ;
 *   3. `selectedCells` porte toujours les coordonnées de A ;
 *   4. on prend un outil : `workCells = selectedCells.slice()` part vers
 *      `/parcels/<B>/…`, et B est travaillée sur des cases que personne n'a
 *      désignées.
 *
 * Le serveur ne pouvait rien y voir : les cases existent, elles appartiennent
 * bien à B, la demande est licite. Seul le client sait que la sélection n'a
 * plus de sens.
 *
 * C'est le pendant d'un défaut déjà corrigé — la réponse tardive qui écrasait
 * la parcelle affichée (`course-parcelle.test.ts`). Celui-là touchait
 * l'affichage ; celui-ci touche les données.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");

describe("changer de parcelle efface la sélection", () => {
  it("un effet vide la sélection sur le seul changement de parcelle", () => {
    /*
     * `[activeParcelId]` et rien d'autre. Ajouter la ligne à l'effet de
     * chargement voisin — qui dépend aussi de `loadParcel` et `loadLivestock`
     * — la ferait rejouer dès qu'un chargeur change d'identité, et la
     * sélection s'effacerait sous les doigts du joueur.
     */
    const effets = [
      ...APP.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/g),
    ];
    const vidage = effets.find(
      (m) => /setSelectedCells\(\[\]\)/.test(m[1]) && m[2].trim() === "activeParcelId",
    );
    expect(vidage).toBeDefined();
  });

  it("le menu de case part avec elle", () => {
    // Il désigne une case de l'ancienne parcelle : le laisser ouvert offrirait
    // des gestes sur un champ qu'on ne regarde plus.
    const effets = [
      ...APP.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/g),
    ];
    const vidage = effets.find((m) => m[2].trim() === "activeParcelId");
    expect(vidage?.[1]).toMatch(/setCellMenu\(null\)/);
  });

  it("les outils travaillent bien la sélection courante — c'est ce qui rend le défaut grave", () => {
    // Si `workCells` ne venait pas de `selectedCells`, le vidage ci-dessus
    // serait cosmétique. Il ne l'est pas : c'est cette liste qui part au
    // serveur.
    expect(APP).toMatch(/const workCells = selectedCells\.slice\(\);/);
  });
});
