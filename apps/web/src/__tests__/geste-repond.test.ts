/**
 * Un bouton d'action ne va jamais au silence.
 *
 * ## Le même signalement, deux fois
 *
 * D'abord au téléphone : les blocages vivaient dans l'attribut `title`, qui
 * n'existe pas sans survol. Une rangée de boutons gris, aucune explication,
 * et des touchers sans effet — « peu importe où je clique, ça fait rien ».
 * D'où `onExplain`, qui pousse la raison dans le bandeau du haut.
 *
 * Puis le 28 août, sur le même écran : « en cliquant sur les boutons d'action
 * en bas à droite il se passe rien ». Trois de ces quatre boutons étaient
 * légitimement bloqués — la fosse à fumier était vide — et ils répondaient.
 * Mais l'élevage s'ouvre dans une fenêtre qui prend toute la page, le bandeau
 * s'affiche en haut, et le joueur regarde en bas à droite. La réponse
 * arrivait hors de son champ de vision.
 *
 * Deux causes possibles écartées par la mesure avant d'en arriver là&nbsp;: la
 * boîte de confirmation est bien câblée, et son empilement est correct — un
 * essai dans Chromium, avec la vraie feuille de style et la fenêtre portée
 * dans `body` comme en vrai, montre qu'elle reçoit le clic au-dessus de la
 * fenêtre.
 *
 * ## Ce que ce fichier tient
 *
 * La réponse se donne **là où le doigt s'est posé**, et aucun état ne rend le
 * bouton muet — `disabled` inclus, qui était le dernier endroit où ce
 * composant trahissait son propre principe.
 */

import fs from "node:fs";

const SOURCE = fs.readFileSync("src/ui/Geste.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");

/**
 * Le code seul, commentaires retirés.
 *
 * Sans ce nettoyage le test se lirait lui-même : le commentaire qui explique
 * pourquoi `disabled={busy}` a disparu contient ces mots-là, et l'assertion
 * tombait dessus. On ne juge que de ce qui s'exécute.
 */
const GESTE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("un geste refusé", () => {
  it("n'est jamais désactivé — un bouton désactivé ne peut pas parler", () => {
    /*
     * `disabled` supprime l'événement de clic : pas de message, pas de
     * bandeau, rien. C'était le seul état où le composant se taisait, et il
     * couvrait tous les boutons du jeu pendant qu'une requête volait.
     */
    expect(GESTE).not.toMatch(/disabled=\{busy\}/);
    expect(GESTE).not.toMatch(/\sdisabled=/);
    // L'indisponibilité reste annoncée au lecteur d'écran.
    expect(GESTE).toMatch(/aria-disabled=\{empeche \|\| busy\}/);
  });

  it("répond quand même pendant qu'une action est en cours", () => {
    expect(GESTE).toMatch(/if \(busy\) \{\s*\n\s*repondre\(/);
    expect(GESTE).toMatch(/Une action est déjà en cours/);
  });

  it("dit la raison sous le bouton, pas seulement en haut de l'écran", () => {
    // Le bandeau reste — il sert si le panneau se referme — mais il ne suffit
    // pas quand le panneau occupe tout l'écran.
    expect(GESTE).toMatch(/onExplain\(raison\)/);
    expect(GESTE).toMatch(/className="geste-dit"/);
    expect(GESTE).toMatch(/role="status"/);
  });

  it("laisse la grille des boutons d'aplomb", () => {
    // La rangée de gestes est une grille à deux colonnes : sans cette règle,
    // la phrase prendrait une case et décalerait tout.
    expect(CSS).toMatch(/\.geste-dit \{[^}]*grid-column: 1 \/ -1;/s);
  });

  it("oublie sa raison dès que le geste passe", () => {
    // Sinon « la fosse est vide » resterait affiché sous un bouton qui vient
    // de fonctionner.
    expect(GESTE).toMatch(/setDit\(null\);\s*\n\s*onDo\(\);/);
  });
});
