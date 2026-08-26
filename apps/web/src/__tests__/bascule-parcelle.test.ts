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

describe("un chantier n’éteint plus le jeu", () => {
  /*
   * Ce bloc remplace un test écrit quelques heures plus tôt, qui vérifiait
   * qu'une phrase expliquait le grisage : « un seul chantier à la fois ». La
   * règle a été levée depuis — « oui il peut utiliser le même engin pour
   * plusieurs parcelles » — et il n'y a donc plus rien à expliquer. Ce qu'il
   * faut tenir, c'est que la cause ne revienne pas.
   */
  it("le verrou tombe dès le chantier ouvert, pas à sa fin", () => {
    // `busy` couvrait toute la fonction, attente comprise : pendant les trois
    // minutes d'un semis, tous les boutons du jeu restaient éteints, sur
    // toutes les parcelles.
    const debut = APP.indexOf("async function runWorkOnCells");
    expect(debut).toBeGreaterThan(-1);
    const corps = APP.slice(debut, APP.indexOf("async function runSelectionAction", debut));
    const ouverture = corps.indexOf("rendreLeVerrou();");
    const attente = corps.indexOf("await attendreChantier(");
    expect(ouverture).toBeGreaterThan(-1);
    expect(attente).toBeGreaterThan(-1);
    expect(ouverture).toBeLessThan(attente);
  });

  it("« Tout récolter » suit la même règle", () => {
    const debut = APP.indexOf("async function harvestAll");
    const corps = APP.slice(debut, APP.indexOf("Achète une parcelle", debut));
    expect(corps.indexOf("rendreLeVerrou();")).toBeLessThan(corps.indexOf("await attendreChantier("));
  });

  it("les chantiers sont une liste, et chacun se clôt seul", () => {
    // Un seul emplacement, et ouvrir le second écrasait le premier : le
    // bandeau décrivait le dernier lancé et sa clôture remettait tout à zéro.
    expect(APP).toMatch(/const \[chantiers, setChantiers\] = useState</);
    expect(APP).toMatch(/setChantiers\(\(liste\) => liste\.filter\(\(c\) => c\.id !== id\)\)/);
  });

  it("les animations aussi, une minuterie par chantier", () => {
    // Elles vivaient dans une seule liste vidée à chaque départ : lancer un
    // travail sur une seconde parcelle coupait l'engin de la première en
    // pleine traversée.
    expect(APP).toMatch(/workTimers = useRef<Map<string, number\[\]>>/);
    expect(APP).toMatch(/function stopWork\(jobId\?: string\)/);
  });

  it("la vue ne reçoit que l’engin de la parcelle regardée", () => {
    expect(APP).toMatch(/activeWork=\{activeWorks\.find\(\(w\) => w\.parcelId === activeParcelId\) \?\? null\}/);
  });

  it("le serveur laisse un attelage repartir sur un autre champ", () => {
    // `pickMachineForWork` écartait tout engin dont `busyUntil` n'était pas
    // passé : le second chantier était refusé faute de matériel.
    const API = fs.readFileSync("../../apps/api/src/main.ts", "utf8");
    const debut = API.indexOf("function pickMachineForWork");
    const corps = API.slice(debut, API.indexOf("type CellXY", debut));
    expect(corps).not.toMatch(/busyUntil/);
  });

  it("mais on ne vend toujours pas un engin qui est au champ", () => {
    // `busyUntil` garde ce rôle-là : il porte désormais la fin du **dernier**
    // chantier en cours, recalculée à chaque ouverture comme à chaque clôture.
    const API = fs.readFileSync("../../apps/api/src/main.ts", "utf8");
    expect(API).toMatch(/async function reglerOccupation\(/);
    expect(API).toMatch(/Cet engin est au champ — attendez la fin du chantier\./);
    // Plus aucune remise à zéro aveugle : elle libérerait un engin qui
    // travaille encore ailleurs.
    expect(API).not.toMatch(/data: \{ busyUntil: null \}/);
  });
});
