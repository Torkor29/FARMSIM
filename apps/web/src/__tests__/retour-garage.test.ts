/**
 * L'engin rentre au garage au lieu de s'évaporer.
 *
 * ## Ce qui s'est passé
 *
 * La dernière case franchie, l'engin de chantier s'éteignait sur place — une
 * seule ligne, `workRig.group.visible = working` — et le joueur voyait sa
 * moissonneuse disparaître au milieu du champ. Signalé en jouant le 28 août :
 * « quand l'engin a fini dans le champ, au lieu qu'il disparaisse faudrait
 * qu'il aille à sa place au parking ».
 *
 * ## Les deux pièges du retour
 *
 * **Le chantier ne dure pas assez.** Il disparaît des données dès que le
 * client vient réclamer son travail, quelques centaines de millisecondes
 * après la dernière case — bien avant que l'engin ait traversé la cour.
 * L'attelage change donc de mains : `workRig` le lâche, `retour` le garde
 * jusqu'à sa place, puis le libère. Un retour accroché à `workRig` aurait été
 * effacé en route.
 *
 * **La machine serait à deux endroits.** Le serveur rend l'attelage au même
 * moment : la cour se redessine avec l'engin déjà garé, alors qu'à l'écran il
 * roule encore. La place visée est donc masquée le temps du trajet.
 *
 * Ces assertions lisent la source : ce qui compte est la forme du cycle de
 * vie, et aucun rendu hors navigateur ne le montrerait.
 */

import fs from "node:fs";

const ISO = fs.readFileSync("src/IsoFarmView.tsx", "utf8");
/* L'aller se décide dans `App.tsx` — c'est lui qui annonce le chantier et
   porte le délai d'acheminement — et se joue dans la vue. Les deux fichiers. */
const APP = fs.readFileSync("src/App.tsx", "utf8");

describe("la fin de chantier", () => {
  it("n'efface plus l'engin sur place", () => {
    expect(ISO).not.toMatch(/workRig\.group\.visible = working;/);
    expect(ISO).toMatch(/function rentrerAuGarage\(t: number\): boolean/);
  });

  it("ne garde le repli que si la cour existe", () => {
    // Une ferme sans cour bâtie n'a nulle part où ranger : on retombe alors
    // sur l'effacement, faute de destination — pas d'engin abandonné au champ.
    expect(ISO).toMatch(/if \(!workRig \|\| !parkingSlots\.length\) return false;/);
    expect(ISO).toMatch(/if \(!working && !retour && !rentrerAuGarage\(t\)\) \{/);
  });

  it("détache l'engin du chantier, qui va disparaître avant lui", () => {
    expect(ISO).toMatch(/retour = \{ rig: workRig, chemin, debut: t, distance: workTravelled, cible \};/);
    expect(ISO).toMatch(/workRig = null;\n {6}return true;/);
  });

  it("masque la place visée tant que l'engin n'y est pas", () => {
    expect(ISO).toMatch(/if \(retour && retour\.cible === i\) mRig\.group\.visible = false;/);
    expect(ISO).toMatch(/const dejaGaree = parkedSlotGroups\[retour\.cible\];/);
    // Et la rend : sans cela, une place resterait vide pour toujours.
    expect(ISO).toMatch(/if \(dejaGaree\) dejaGaree\.visible = true;/);
  });

  it("amène l'engin depuis la cour au lieu de le poser sur sa case", () => {
    /*
     * Le pendant de l'arrivée. Le chantier n'était publié qu'à la fin du
     * délai d'acheminement : la vue n'avait rien à dessiner pendant ce
     * temps-là, et la machine se matérialisait sur sa première case —
     * « faudrait qu'il arrive tranquillement sur le champ, pas pop d'un
     * coup ». Le chantier est désormais annoncé tout de suite, avec le temps
     * qui reste avant le premier sillon.
     */
    expect(APP).toMatch(/approcheMs: attente,/);
    expect(APP).toMatch(/const annoncer = \(\) => \{/);
    expect(ISO).toMatch(/approcheMs\?: number;/);
    // Le travail attend l'arrivée, il ne démarre plus à la seconde zéro.
    expect(ISO).toMatch(/workStartRef\.current = t \+ approcheS;/);
    expect(ISO).toMatch(/if \(arrivee && workRig\) \{/);
    expect(ISO).toMatch(/\} else if \(workRig && workPath\.length\) \{/);
  });

  it("part de la place où il rentrera, pas d'à côté", () => {
    // Départ et retour visent le même index de place : sinon l'engin sortirait
    // d'une case et se rangerait dans une autre, sous les yeux du joueur.
    const depart = ISO.match(/Math\.min\(dataRef\.current\.parked\.length, parkingSlots\.length - 1\)/g);
    expect(depart).not.toBeNull();
    expect(ISO).toMatch(/const cible = Math\.min\(occupees, parkingSlots\.length - 1\);/);
  });

  it("libère l'attelage au démontage de la scène", () => {
    // `retour` n'appartient plus à `workRig` : le nettoyage habituel ne le
    // voit pas, et sa géométrie survivrait à la vue.
    expect(ISO).toMatch(/if \(retour\) \{\n\s+workGroup\.remove\(retour\.rig\.group\);/);
  });
});
