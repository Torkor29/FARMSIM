/**
 * Le tutoriel ne se rejoue pas parce qu'on a changé de navigateur.
 *
 * ## Le signalement
 *
 * « Faut pas renvoyer le tuto quand on réinitialise le mdp, là je viens de
 * l'avoir. »
 *
 * Son marque-page vit dans le stockage local, donc dans **ce** navigateur.
 * C'était sans conséquence tant qu'on revenait toujours par le même — et le
 * lien de réinitialisation, livré la veille, vient de casser cette
 * hypothèse : ouvert depuis une application de courrier, il s'affiche dans un
 * navigateur intégré, au stockage vierge.
 *
 * Le défaut valait déjà pour un nouveau téléphone ou des données de site
 * effacées. Le lien l'a seulement rendu courant.
 */

import { readFileSync } from "fs";

const APP = readFileSync("src/App.tsx", "utf8");

describe("qui voit le tutoriel", () => {
  it("se décide aussi sur l’expérience du joueur, pas seulement sur le navigateur", () => {
    /*
     * L'expérience vient du serveur : elle suit le compte et non l'appareil.
     * Et elle ne peut pas se tromper dans le sens gênant — on ne gagne pas
     * d'expérience sans avoir joué.
     */
    expect(APP).toContain("const debutant = (player?.xp ?? 0) === 0;");
    expect(APP).toContain("if (dejaVu || !debutant) {");
  });

  it("garde le stockage local comme premier recours", () => {
    // Il répond sans réseau et reste juste dans l'immense majorité des cas :
    // c'est l'expérience qui vient en second, pas l'inverse.
    expect(APP).toContain("const dejaVu = localStorage.getItem(playerStorageKey(TUTORIAL_KEY, player.id)) != null;");
  });

  it("pose le marque-page manquant, pour ne pas reposer la question", () => {
    /*
     * Sans cela, ce navigateur-là repasserait par le même calcul à chaque
     * visite — et le « Quoi de neuf » ne saurait jamais où il en est, puisque
     * son propre marque-page ne se pose qu'après lecture.
     */
    expect(APP).toMatch(/if \(!dejaVu\) \{\s*try \{\s*localStorage\.setItem\(playerStorageKey\(TUTORIAL_KEY/);
  });

  it("survit à un stockage local qui refuse", () => {
    // En navigation privée, l'écriture lève. Un tutoriel écarté par
    // l'expérience du joueur ne doit pas se solder par un écran blanc.
    expect(APP).toMatch(/localStorage\.setItem\(playerStorageKey\(TUTORIAL_KEY, player\.id\), "1"\);\s*\} catch \{/);
  });

  it("recalcule quand l’expérience arrive", () => {
    // `player` est posé avant que la ferme soit chargée : sans cette
    // dépendance, le calcul resterait figé sur le premier rendu.
    expect(APP).toContain("}, [installe, debutant, player?.id]);");
  });

  it("montre alors les nouveautés à la place", () => {
    // Un joueur qui revient sur un autre appareil n'a pas besoin du tutoriel ;
    // il a besoin de savoir ce qui a changé depuis sa dernière partie.
    expect(APP).toMatch(/if \(dejaVu \|\| !debutant\) \{[\s\S]{0,2000}setNouveautes\(/);
  });
});
