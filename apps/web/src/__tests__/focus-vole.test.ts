/**
 * Ne jamais arracher le curseur à qui est en train de taper.
 *
 * ## Le défaut
 *
 * Signalé en jouant : « quand les prix s'actualisent, la fenêtre perd la
 * priorité et tu écris dans le vent ».
 *
 * Trois écrans piégeaient le focus dans un `useEffect` dont les dépendances
 * comprenaient le rappel de fermeture. Or ce rappel arrive en lambda — les
 * vingt-quatre appelants écrivent `onClose={() => setSheet(null)}` — donc
 * **neuf à chaque rendu du parent**. L'effet se démontait et se remontait
 * aussi souvent, et ses deux gestes reprenaient : rendre le focus à l'élément
 * de départ, ou le poser sur le premier bouton.
 *
 * Les cours arrivent par un sondage, le sondage rerend l'écran, l'écran refait
 * la lambda. Toutes les quelques secondes, le curseur quittait le champ en
 * cours de frappe, sans que rien ne l'explique.
 *
 * Dans la fenêtre de confirmation, le défaut faisait plus qu'agacer : un
 * joueur qui avait tabulé jusqu'à « Annuler » se retrouvait ramené sur
 * « Confirmer », et la touche Entrée vendait sa machine.
 *
 * ## Ce qu'on vérifie
 *
 * Que le rappel vit dans une référence et non dans les dépendances. C'est la
 * forme du défaut, elle se lit — là où le symptôme demanderait un vrai
 * navigateur, une vraie frappe et un vrai sondage.
 */

import { readFileSync } from "node:fs";

const FICHIERS = {
  "la fenêtre de bureau": "src/ui/desktop/Window.tsx",
  "la fiche du voisin": "src/ParcelleVoisineSheet.tsx",
  "la confirmation": "src/ConfirmDialog.tsx",
} as const;

/** Les tableaux de dépendances d'un fichier, tels qu'écrits. */
function dependances(source: string): string[] {
  return [...source.matchAll(/\}, \[([^\]]*)\]\);/g)].map((m) => m[1]!.trim());
}

describe("les écrans qui prennent le focus", () => {
  for (const [nom, chemin] of Object.entries(FICHIERS)) {
    const source = readFileSync(chemin, "utf8");

    it(`${nom} ne relance pas son effet à chaque rendu du parent`, () => {
      // Un rappel dans les dépendances, c'est l'effet qui se rejoue sans fin :
      // sa lambda est neuve à chaque rendu.
      for (const deps of dependances(source)) {
        expect(deps).not.toMatch(/\bon[A-Z]\w*/);
      }
    });

    it(`${nom} garde le rappel dans une référence`, () => {
      // Il faut bien appeler la dernière fermeture connue : sans référence,
      // sortir le rappel des dépendances le figerait sur celui du premier
      // rendu, et Échap fermerait un panneau déjà remplacé.
      expect(source).toMatch(/useRef\((?:onClose|onFermer|onCancel)\)/);
      expect(source).toMatch(/\.current = (?:onClose|onFermer|onCancel);/);
      expect(source).toMatch(/\.current\(\)/);
    });
  }

  /**
   * La fenêtre a un cas de plus : elle rend le focus d'où il venait. Ce geste
   * n'a de sens qu'à la vraie fermeture — pendant qu'on tape dedans, il n'y a
   * rien à rendre.
   */
  it("la fenêtre ne rend le focus que si le joueur n'y est plus", () => {
    const source = readFileSync(FICHIERS["la fenêtre de bureau"], "utf8");
    expect(source).toMatch(/contains\(document\.activeElement\)/);
    expect(source).toMatch(/if \(!dedans\) returnFocus\.current\?\.focus\?\.\(\)/);
  });
});
