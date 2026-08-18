/**
 * La coquille du jeu n'a qu'une grille.
 *
 * Ce fichier existe à cause d'une capture d'écran : la ferme réduite à une
 * bande de 292 px sur la droite, pendant que le menu de construction en
 * occupait 1025. La cause n'était pas une valeur mal choisie mais une
 * **collision de générations**. Trois jeux de règles avaient été écrits pour
 * `.game-stage` au fil des refontes :
 *
 *   1. deux rails, pas de rail d'outils            → 2 et 3 colonnes
 *   2. rail d'outils + deux rails de panneaux      → 3 et 4 colonnes
 *   3. rail d'outils + panneaux en fenêtres        → 3 colonnes  (la bonne)
 *
 * Aucune n'avait été supprimée. Elles ne se sont pas empilées proprement :
 * chacune déclarait `grid-template-columns` et `grid-template-areas` avec des
 * spécificités différentes, et les variantes `:has(.rail-left:empty)` — trois
 * à cinq classes — battaient les règles plus récentes mais plus simples. Le
 * navigateur composait donc les **colonnes** d'une génération avec les
 * **zones** d'une autre. Mesuré sur 1536 px :
 *
 *     colonnes  184px | 0px | 1060px | 292px   (quatre)
 *     zones     "tools stage right"            (trois)
 *
 * `stage` tombait sur la colonne de zéro pixel et `right` héritait du `1fr`.
 *
 * Une revue de code ne voit pas ça : chaque règle, prise isolément, est juste.
 * C'est leur coexistence qui ment. D'où un test structurel — il compte les
 * définitions au lieu de juger leur contenu.
 */

import fs from "node:fs";

// Les tests tournent en modules ES : pas de `__dirname`. Jest part de la
// racine du paquet, comme le fait déjà `assets.test.ts`.
const CSS = fs.readFileSync("src/styles.css", "utf8");

type Regle = { selecteur: string; corps: string; ligne: number };

/**
 * Découpe la feuille en règles `sélecteur { corps }`, en sautant le contenu
 * des blocs `@media` sans les traiter comme des règles. Suffisant ici : on ne
 * cherche pas à interpréter la cascade, seulement à dénombrer les endroits où
 * la grille est définie.
 */
function regles(css: string): Regle[] {
  const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const out: Regle[] = [];
  let i = 0;
  let debutSel = 0;
  const pile: number[] = [];
  let ligne = 1;
  const lignesAvant = (pos: number) => sansCommentaires.slice(0, pos).split("\n").length;
  while (i < sansCommentaires.length) {
    const c = sansCommentaires[i];
    if (c === "{") {
      const sel = sansCommentaires.slice(debutSel, i).trim();
      if (sel.startsWith("@")) {
        pile.push(-1);
      } else {
        // Trouver l'accolade fermante correspondante.
        let d = 1;
        let j = i + 1;
        while (j < sansCommentaires.length && d > 0) {
          if (sansCommentaires[j] === "{") d++;
          else if (sansCommentaires[j] === "}") d--;
          j++;
        }
        out.push({ selecteur: sel, corps: sansCommentaires.slice(i + 1, j - 1), ligne: lignesAvant(i) });
        i = j;
        debutSel = i;
        continue;
      }
      debutSel = i + 1;
    } else if (c === "}") {
      pile.pop();
      debutSel = i + 1;
    }
    i++;
  }
  void ligne;
  return out;
}

/** Nombre de pistes d'un `grid-template-columns`, parenthèses respectées. */
function pistes(valeur: string): number {
  let prof = 0;
  let n = 0;
  let dansPiste = false;
  for (const ch of valeur.trim()) {
    if (ch === "(") prof++;
    else if (ch === ")") prof--;
    if (prof === 0 && /\s/.test(ch)) {
      dansPiste = false;
      continue;
    }
    if (!dansPiste) {
      n++;
      dansPiste = true;
    }
  }
  return n;
}

/** Nombre de colonnes d'une carte de zones : la première chaîne suffit. */
function colonnesDeZones(valeur: string): number {
  const premiere = valeur.match(/"([^"]*)"/);
  if (!premiere) return 0;
  return premiere[1].trim().split(/\s+/).filter(Boolean).length;
}

function declaration(corps: string, prop: string): string | null {
  const m = corps.match(new RegExp(`(?:^|;|\\n)\\s*${prop}\\s*:([^;]+)`));
  return m ? m[1].trim() : null;
}

const toutes = regles(CSS);
const coquille = toutes.filter((r) => /\.game-stage(?![\w-])/.test(r.selecteur));

describe("la grille de la coquille de jeu", () => {
  const avecZones = coquille.filter((r) => declaration(r.corps, "grid-template-areas"));
  const avecColonnes = coquille.filter((r) => declaration(r.corps, "grid-template-columns"));

  it("n’est décrite qu’à deux endroits : le tactile et le bureau", () => {
    /**
     * Deux dispositions existent, donc deux cartes de zones — pas trois, pas
     * quatre. Si ce test tombe, quelqu'un vient d'ajouter une génération de
     * règles sans retirer la précédente : c'est exactement le geste qui a
     * produit la ferme dans le coin.
     */
    const ou = avecZones.map((r) => `${r.selecteur} (ligne ${r.ligne})`);
    expect(ou).toHaveLength(2);
  });

  it("compte une colonne au doigt et trois au bureau", () => {
    const cartes = avecZones.map((r) => ({
      selecteur: r.selecteur,
      colonnes: colonnesDeZones(declaration(r.corps, "grid-template-areas")!),
    }));
    // La coquille tactile empile tout dans une colonne unique ; celle de
    // bureau réserve le rail d'outils, la scène et le rail de panneaux.
    expect(cartes.map((c) => c.colonnes).sort()).toEqual([1, 3]);
  });

  it("ne déclare jamais un nombre de colonnes que les zones ignorent", () => {
    /**
     * Le cœur du défaut : `grid-template-columns` avec quatre pistes quand la
     * carte des zones n'en connaît que trois. La quatrième piste ne sert alors
     * à personne, et les zones glissent d'une colonne vers la gauche.
     */
    const permises = new Set(
      avecZones.map((r) => colonnesDeZones(declaration(r.corps, "grid-template-areas")!)),
    );
    const fautives = avecColonnes
      .map((r) => ({
        selecteur: r.selecteur,
        ligne: r.ligne,
        n: pistes(declaration(r.corps, "grid-template-columns")!),
      }))
      .filter((d) => !permises.has(d.n));
    expect(fautives).toEqual([]);
  });

  it("donne trois colonnes à toute règle de bureau", () => {
    // `:not(.mobile)` est la marque du bureau — c'est `useIsMobile()` qui pose
    // la classe, et lui seul décide. Une règle de bureau qui déclarerait deux
    // ou quatre pistes serait, par construction, d'une autre génération.
    const bureau = avecColonnes.filter((r) => r.selecteur.includes(":not(.mobile)"));
    expect(bureau.length).toBeGreaterThan(0);
    for (const r of bureau) {
      expect({ sel: r.selecteur, n: pistes(declaration(r.corps, "grid-template-columns")!) }).toEqual({
        sel: r.selecteur,
        n: 3,
      });
    }
  });
});
