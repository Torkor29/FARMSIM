import fs from "node:fs";

/**
 * Changer de parcelle pendant un chantier.
 *
 * Rapporté en jeu : « on achète une parcelle, on l'a, on change de parcelle
 * pendant qu'on utilise un outil, alors ça bug complètement, ça switch de map,
 * on voit plus les mêmes parcelles, et ça le fait en boucle ».
 *
 * Rejoué au navigateur sur la pile complète (API + web), trois défauts
 * distincts se cachaient derrière cette seule phrase :
 *
 *  1. **La vue ne suivait pas.** Le déplacement de caméra (`view.panX/panZ`)
 *     vit dans la fermeture du grand effet de montage d'`IsoFarmView`, dont le
 *     tableau de dépendances est vide. Changer de parcelle remplaçait tout le
 *     décor mais gardait le décalage : sur la nouvelle carte, ce décalage
 *     tombe chez un voisin. Mesuré — après un glissement de vue puis une
 *     bascule, la parcelle du joueur était hors cadre et le bouton
 *     « Ma ferme » restait allumé.
 *
 *  2. **La sélection restait.** Les cent trente-cinq cases retenues sur le
 *     premier champ se rallumaient sur le second, et la barre proposait
 *     toujours « Semer · 135 cases » : des coordonnées nues, qui ne disent pas
 *     de quel champ elles viennent.
 *
 *  3. **Tous les boutons devenaient gris, sans un mot.** Un seul chantier à la
 *     fois est une règle — l'attelage ne peut pas être à deux champs — mais
 *     rien ne l'écrivait. Le joueur qui vient d'acheter une deuxième parcelle
 *     pour y travailler croit le jeu cassé.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");
const ISO = fs.readFileSync("src/IsoFarmView.tsx", "utf8");
const BARRE = fs.readFileSync("src/ui/desktop/SelectionBar.tsx", "utf8");
const DOCK = fs.readFileSync("src/FieldDock.tsx", "utf8");

describe("la vue suit la parcelle", () => {
  it("un recadrage sec existe, distinct du recentrage qui glisse", () => {
    // `recentrer()` — le bouton « Ma ferme » — glisse, parce qu'on revient
    // d'un endroit qu'on a choisi. Une bascule de parcelle n'est pas un
    // retour : on n'y est jamais allé, il n'y a rien à suivre des yeux.
    expect(ISO).toMatch(/recadrerRef\s*=\s*useRef</);
    expect(ISO).toMatch(/recadrerRef\.current\s*=\s*\(\)\s*=>\s*\{/);
  });

  it("il remet le déplacement à zéro et annule le rappel en cours", () => {
    const debut = ISO.indexOf("recadrerRef.current = () => {");
    expect(debut).toBeGreaterThan(-1);
    const corps = ISO.slice(debut, ISO.indexOf("};", debut));
    expect(corps).toMatch(/view\.panX\s*=\s*0/);
    expect(corps).toMatch(/view\.panZ\s*=\s*0/);
    expect(corps).toMatch(/retourVers\s*=\s*null/);
    // Sans quoi le bouton « Ma ferme » resterait allumé sur une vue déjà
    // centrée : la ferme est revenue, l'invitation à y revenir doit partir.
    expect(corps).toMatch(/onEgareRef\.current\?\.\(false\)/);
  });

  it("et il part au changement de parcelle, pas au changement de scène", () => {
    // `sceneKey` bouge à chaque sondage — toutes les quatre secondes pendant
    // un chantier. Recadrer là-dessus rendrait la vue impossible à déplacer.
    const effet = ISO.slice(ISO.indexOf("recadrerRef.current?.();"));
    expect(effet).toMatch(/recadrerRef\.current\?\.\(\);\s*\n\s*\},\s*\[parcelId\]\);/);
  });
});

describe("une sélection appartient à sa parcelle", () => {
  function effetDeBascule(): string {
    const debut = APP.indexOf("Une sélection appartient à sa parcelle");
    expect(debut).toBeGreaterThan(-1);
    const fin = APP.indexOf("}, [activeParcelId]);", debut);
    expect(fin).toBeGreaterThan(debut);
    return APP.slice(debut, fin);
  }

  it("les cases retenues sont vidées quand on change de champ", () => {
    expect(effetDeBascule()).toMatch(/setSelectedCells\(\[\]\)/);
  });

  it("le survol, le menu de case et le fantôme de bâtiment aussi", () => {
    // Tous pointent une case d'un champ qu'on ne regarde plus.
    const corps = effetDeBascule();
    expect(corps).toMatch(/setHoverCell\(null\)/);
    expect(corps).toMatch(/setCellMenu\(null\)/);
    expect(corps).toMatch(/setPendingBuild\(null\)/);
  });
});

describe("le grisage des outils s’explique", () => {
  it("la raison nomme le chantier qui retient le parc", () => {
    expect(APP).toMatch(/const chantierRetient = chantier/);
    const debut = APP.indexOf("const chantierRetient = chantier");
    const corps = APP.slice(debut, APP.indexOf(": null;", debut));
    expect(corps).toMatch(/Un seul chantier à la fois/);
    // La parcelle est nommée : « ailleurs » ne dit pas où aller regarder.
    expect(corps).toMatch(/ownedParcels\.find\(\(p\) => p\.id === chantier\.parcelId\)\?\.label/);
  });

  it("elle est passée à la barre de sélection", () => {
    expect(APP).toMatch(/chantierEnCours=\{chantierRetient\}/);
  });

  it("et la barre l’écrit, au lieu de la réserver à une infobulle", () => {
    // Au doigt il n'y a pas de survol : une raison qui ne vit que dans un
    // `title` n'existe pas pour la moitié des joueurs.
    expect(BARRE).toMatch(/\{chantierEnCours && \(/);
    expect(BARRE).toMatch(/className="selection-bar-note" role="status"/);
  });

  it("l’infobulle du bouton la reprend, sans écraser une raison plus précise", () => {
    // Une machine qui manque est un obstacle plus précis qu'un chantier en
    // cours : elle passe devant.
    expect(BARRE).toMatch(/title=\{machineManquante \?\? chantierEnCours \?\? undefined\}/);
  });

  it("le dock du téléphone l’écrit aussi, où il n’y a aucune infobulle", () => {
    // C'est la coque où le joueur a rapporté le défaut. Le dock renvoyait
    // `null` dès qu'un bandeau de chantier était là — le bandeau nomme le
    // chantier, il ne dit pas que c'est lui qui éteint les boutons.
    expect(DOCK).toMatch(/if \(chantierEnCours\) return chantierEnCours;/);
    expect(APP).toMatch(/chantierEnCours=\{chantierRetient\}[\s\S]{0,80}machineManquante=/);
  });
});
