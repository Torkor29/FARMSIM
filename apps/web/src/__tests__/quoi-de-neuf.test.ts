/**
 * L'écran « Quoi de neuf ».
 *
 * « Je te fais pas de retour parce que tu m'en fais pas sur ce que tu as
 * modifié. » La règle — qui voit quoi — est tenue dans `nouveautes.test.ts` ;
 * ici on garde les décisions d'écran, qui sont celles qui font qu'on lit le
 * panneau ou qu'on le balaie.
 */

import { readFileSync } from "fs";

import { NOUVEAUTES } from "@farmsim/shared";

const PANNEAU = readFileSync("src/NouveautesPanel.tsx", "utf8");
const APP = readFileSync("src/App.tsx", "utf8");
const CSS = readFileSync("src/styles.css", "utf8");

describe("le panneau", () => {
  it("s’ouvre tout seul — un lien dans un menu n’aurait rien réglé", () => {
    /*
     * Personne ne va chercher une nouvelle dont il ignore l'existence. C'est
     * tout le défaut : le jeu changeait sans que le testeur le sache.
     */
    expect(APP).toContain("<NouveautesPanel");
    expect(APP).toContain("nouveautesNonLues({");
  });

  it("ne s’empile pas sur le tutoriel", () => {
    // Les deux s'ouvrent au même moment et au même endroit de l'écran :
    // superposés, ils accueilleraient un joueur neuf par deux panneaux.
    expect(APP).toContain("if (localStorage.getItem(playerStorageKey(TUTORIAL_KEY, player.id))) {");
    expect(APP).toMatch(/setNouveautes\(\s*nouveautesNonLues\(/);
  });

  it("retient ce qui a été lu, par joueur", () => {
    /*
     * Sans marque-page, le panneau reviendrait à chaque connexion — et un
     * panneau qui revient toujours se ferme sans se lire. Le suffixe par
     * joueur évite qu'un second compte sur le même téléphone hérite du
     * premier, comme pour le tutoriel.
     */
    expect(APP).toContain("ecrireNouveauteVue(player.id, DERNIERE_NOUVEAUTE)");
    expect(APP).toContain("playerStorageKey(NOUVEAUTES_KEY, playerId)");
  });

  it("survit à un stockage local qui refuse", () => {
    // Il lève en navigation privée sur certains navigateurs, et une nouvelle
    // non lue ne vaut pas un écran blanc.
    expect(APP).toMatch(/function lireNouveauteVue[\s\S]{0,320}catch \{/);
    expect(APP).toMatch(/function ecrireNouveauteVue[\s\S]{0,320}catch \{/);
  });

  it("ne se ferme pas d’un clic à côté", () => {
    /*
     * La fiche d'une parcelle voisine, si — on la rouvre d'un clic. Celle-ci
     * ne revient pas : un écran balayé par mégarde ne serait jamais lu.
     */
    expect(PANNEAU).not.toMatch(/className="voisin-backdrop"[^>]*onClick/);
    // L'échappement reste, lui : c'est le geste de qui veut vraiment fermer.
    expect(PANNEAU).toContain('e.key === "Escape"');
  });

  it("demande un retour, et ne se contente pas d’informer", () => {
    // La moitié du défaut était l'ignorance ; l'autre moitié est le silence
    // qu'elle entretenait. Le panneau dit qu'on attend une réponse.
    expect(PANNEAU).toContain("neuf-appel");
    expect(PANNEAU).toMatch(/dites-le/i);
  });

  it("se dessine, et défile quand la liste est longue", () => {
    expect(CSS).toContain(".neuf-liste");
    expect(CSS).toMatch(/\.neuf-liste\s*\{[^}]*overflow-y:\s*auto/);
    expect(CSS).toContain(".neuf-entree");
  });

  it("annonce le bon compte, au singulier comme au pluriel", () => {
    // Six entrées et « 1 changement » se remarque tout de suite ; c'est le
    // genre de détail qui décide si l'écran a l'air soigné.
    expect(PANNEAU).toContain("nouveautes.length === 1");
    expect(PANNEAU).toMatch(/changements depuis votre dernière partie/);
  });
});

describe("le contenu", () => {
  it("annonce les corrections que le testeur a demandées", () => {
    /*
     * Le panneau n'a d'intérêt que s'il parle de ce qui vient d'être corrigé :
     * c'est là-dessus qu'on attend un retour. On vérifie que les quatre
     * signalements de la session y figurent.
     */
    const tout = NOUVEAUTES.map((n) => `${n.titre} ${n.texte}`).join(" ").toLowerCase();
    for (const sujet of ["taille", "mot de passe", "mauvaises herbes", "entasser"]) {
      expect({ sujet, present: tout.includes(sujet) }).toEqual({ sujet, present: true });
    }
  });
});
