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

/**
 * Le dernier compound d'un sélecteur : l'élément qu'il vise réellement.
 *
 * `.game-stage.mobile .dock-tray` **mentionne** la coquille mais vise le
 * plateau d'outils. Filtrer sur la simple mention mettait donc la grille du
 * plateau — deux colonnes, options et action — dans le même sac que celle de
 * la coquille, et le test refusait une grille interne parfaitement légitime
 * au motif que la coquille n'en a qu'une ou trois. On compare ce qui est
 * comparable : les règles qui posent la grille **de la coquille**.
 */
function cible(selecteur: string): string {
  // Les parenthèses peuvent contenir des espaces (`:has(.a .b)`) : on les
  // neutralise avant de découper sur les combinateurs.
  let profondeur = 0;
  let masque = "";
  for (const c of selecteur) {
    if (c === "(") profondeur++;
    if (c === ")") profondeur--;
    masque += profondeur > 0 && /\s/.test(c) ? "\u0000" : c;
  }
  const dernier = masque.split(/[\s>+~]+/).filter(Boolean).pop() ?? "";
  return dernier.replace(/\u0000/g, " ");
}

const coquille = toutes.filter((r) => /\.game-stage(?![\w-])/.test(cible(r.selecteur)));

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

describe("les listes dans une fenêtre", () => {
  /**
   * Les panneaux ont été écrits pour un rail de 292 px. Devenus des fenêtres
   * de 1440, ils gardaient leur colonne unique : le Bureau empilait 5 411 px
   * de contenu dans 644 px de boîte — huit écrans et demi — dont 3 183 px pour
   * vingt-quatre chantiers alignés à côté de 1 100 px de vide.
   *
   * La règle qui les met en colonnes doit rester **réversible** : le même
   * balisage sert le tiroir du téléphone, où une seule colonne tient. C'est ce
   * que garantissent `auto-fill` et le `min(100%, …)` — une colonne figée
   * (`repeat(3, …)`) casserait le tactile sans qu'aucun test ne le voie.
   */
  const dansFenetre = toutes.filter(
    (r) => r.selecteur.includes(".win-body") && declaration(r.corps, "grid-template-columns"),
  );

  it("existent — sinon personne ne met les listes en colonnes", () => {
    expect(dansFenetre.length).toBeGreaterThanOrEqual(4);
  });

  it("s’adaptent à la largeur au lieu de la figer", () => {
    /**
     * Deux formes seulement sont acceptables :
     *
     * - `auto-fill` avec `min(100%, …)` — la liste choisit son nombre de
     *   colonnes et retombe à une seule quand la place manque ;
     * - un nombre fixe de colonnes **toutes en `minmax(0, …)`** — une rangée
     *   de gestes, par exemple, dont les cases se compriment sans jamais
     *   déborder. C'est le cas de `.barn-actions` et ses quatre boutons.
     *
     * Tout le reste — `repeat(3, 20rem)`, `1fr 1fr 1fr` — déborde au doigt.
     */
    const figees = dansFenetre
      .map((r) => ({ sel: r.selecteur, val: declaration(r.corps, "grid-template-columns")! }))
      .filter((d) => {
        const adaptative = /auto-fill|auto-fit/.test(d.val) && /min\(\s*100%/.test(d.val);
        const compressible = /^repeat\(\s*\d+\s*,\s*minmax\(\s*0/.test(d.val.trim());
        return !adaptative && !compressible;
      });
    expect(figees).toEqual([]);
  });
});

/**
 * Les motifs saisonniers.
 *
 * Ce bloc existe à cause d'une phrase : « j'avais pas capté que c'était des
 * feuilles d'automne ». Le motif était une `radial-gradient` de 3 px sur 2,
 * à bord dur, **une par tuile** — donc des taches orange alignées sur un
 * réseau parfaitement régulier. Ce qu'on voyait n'était pas une chute de
 * feuilles mais une trame, du genre qu'on prend pour un défaut d'écran.
 *
 * Un motif dont on ne reconnaît pas le sujet a raté son seul travail : il est
 * là parce que le printemps et l'hiver partagent le même ciel bleu et que la
 * teinte seule demande qu'on compare. Trois exigences le tiennent désormais,
 * et aucune n'est une question de goût.
 */
describe("les motifs du ciel", () => {
  const NAPPES = [".sky-drift.petals", ".sky-drift.leaves", ".sky-drift.flakes"];
  const couches = (base: string) =>
    ["lente", "vive"].map((v) => {
      const sel = `${base}.${v}`;
      const r = regles(CSS).find((x) => x.selecteur === sel);
      expect(`${sel} déclarée : ${Boolean(r)}`).toBe(`${sel} déclarée : true`);
      return r!;
    });

  for (const base of NAPPES) {
    it(`${base} dessine une forme, pas un point`, () => {
      for (const c of couches(base)) {
        const img = declaration(c.corps, "background-image") ?? "";
        // Une silhouette, donc un tracé. Un dégradé radial ne peut produire
        // qu'une tache ronde : c'est exactement ce qu'on ne veut plus.
        expect(`${c.selecteur} tracé=${img.includes("%3Cpath")}`).toBe(
          `${c.selecteur} tracé=true`,
        );
        expect(`${c.selecteur} gradient=${/radial-gradient/.test(img)}`).toBe(
          `${c.selecteur} gradient=false`,
        );
      }
    });

    it(`${base} pose plusieurs marques par tuile`, () => {
      /**
       * Une seule marque par tuile aligne tout sur un réseau, et le réseau se
       * voit avant le motif. Plusieurs marques placées irrégulièrement dans
       * la même tuile cassent l'alignement sans coûter un nœud de plus.
       */
      for (const c of couches(base)) {
        const img = declaration(c.corps, "background-image") ?? "";
        const marques = (img.match(/%3Cg transform=/g) ?? []).length;
        expect(`${c.selecteur} ${marques} marques`).toBe(`${c.selecteur} ${marques} marques`);
        expect(marques).toBeGreaterThanOrEqual(4);
      }
    });

    it(`${base} superpose deux trames différentes`, () => {
      /**
       * Les deux nappes donnaient la profondeur par `transform: scale()` : la
       * même trame, en plus gros. Les deux réseaux coïncidaient donc, et
       * l'agrandissement ne faisait que rendre l'alignement plus lisible.
       * Deux `background-size` distincts font le même travail sans cela.
       */
      const [lente, vive] = couches(base);
      const tailles = [lente, vive].map((c) => declaration(c.corps, "background-size"));
      expect(tailles[0]).toBeDefined();
      expect(tailles[1]).not.toBe(tailles[0]);
      for (const c of [lente, vive]) {
        // La déclaration CSS, pas le corps entier : les tuiles SVG portent
        // elles-mêmes des `scale()`, qui sont légitimes — ce sont eux qui
        // donnent aux marques leurs tailles inégales.
        const t = declaration(c.corps, "transform");
        expect(`${c.selecteur} transform=${t}`).toBe(`${c.selecteur} transform=null`);
      }
    });
  }

  it("la feuille de premier plan a la même silhouette que la nappe", () => {
    // L'œil va toujours à l'intrus : un pâté arrondi posé à côté de vraies
    // feuilles était la seule chose qu'on remarquait.
    for (const sel of [".sky-leaf.f1", ".sky-leaf.f2", ".sky-leaf.f3"]) {
      const r = regles(CSS).find((x) => x.selecteur === sel);
      expect(`${sel} déclarée : ${Boolean(r)}`).toBe(`${sel} déclarée : true`);
      const img = declaration(r!.corps, "background-image") ?? "";
      expect(`${sel} tracé=${img.includes("%3Cpath")}`).toBe(`${sel} tracé=true`);
    }
  });
});

/**
 * Ce qui flotte au-dessus du dock doit rester au-dessus du dock.
 *
 * Signalé en partie : « je peux pas déchaumer, rien, tout se grise ». Rien
 * n'était cassé — un chantier tournait. Un déchaumage de 73 cases dure une
 * minute quarante, une presse deux minutes cinquante, et pendant tout ce
 * temps `busy` grise chaque bouton d'action. La barre qui l'explique existait
 * : « Déchaumer · 73 cases », une jauge, le temps restant. Elle était ancrée à
 * la fenêtre, à `bottom: 4.6rem` — une hauteur de dock devinée une fois. Le
 * dock tactile en fait treize, porte le même plan (`z-index: 6`) et vient
 * après dans le document : il se dessinait par-dessus. La seule chose qui
 * expliquait l'écran gris passait donc sous l'écran gris, et le joueur ne
 * voyait qu'une interface morte.
 *
 * Une distance devinée entre deux éléments qui grandissent chacun de leur
 * côté ne tient jamais longtemps. Empilé dans le dock, le bandeau ne peut
 * plus être recouvert et il n'y a plus de hauteur à deviner.
 *
 * Depuis que plusieurs chantiers peuvent tourner, l'ancrage n'est plus sur
 * chaque bandeau (ils se seraient superposés) : c'est la pile qui flotte, et
 * c'est elle qu'on empile dans le dock.
 */
describe("le bandeau de chantier", () => {
  const flottant = toutes.find((r) => r.selecteur === ".chantier-pile");
  const empile = toutes.find((r) => /\.field-dock\s+\.chantier-pile/.test(r.selecteur));

  it("existe sous les deux formes : flottante et empilée", () => {
    expect(`flottant=${Boolean(flottant)} empilé=${Boolean(empile)}`).toBe(
      "flottant=true empilé=true",
    );
  });

  it("ne garde aucune hauteur devinée une fois empilé", () => {
    // C'est **la** règle : dans le dock, plus de `position: fixed` et plus de
    // `bottom` — donc plus rien à faire coïncider avec la taille du dock.
    expect(declaration(empile!.corps, "position")).toBe("static");
    expect(declaration(empile!.corps, "bottom")).toBe("auto");
  });

  it("ne se laisse pas recouvrir par le dock quand il flotte", () => {
    // Hors du dock, la pile reste ancrée à la fenêtre : son plan doit alors
    // être au moins celui du dock, sinon on retombe sur le même recouvrement.
    const dock = toutes.find((r) => r.selecteur === ".field-dock");
    const planPile = Number(declaration(flottant!.corps, "z-index") ?? 0);
    const planDock = Number(declaration(dock!.corps, "z-index") ?? 0);
    expect(`${planPile} >= ${planDock}`).toBe(
      `${planPile} >= ${Math.min(planPile, planDock)}`,
    );
  });
});
