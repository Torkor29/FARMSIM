/**
 * « Mot de passe oublié » par courriel — les décisions d'écran.
 *
 * La demande était de « recevoir son mdp sur son adresse mail ». Impossible,
 * et c'est une bonne nouvelle : le serveur n'en garde qu'une empreinte bcrypt,
 * exactement la propriété que le même joueur réclamait en écrivant « c'est
 * censé être crypté, et illisible ». Ce qui part est un lien à usage unique.
 *
 * Les règles pures sont dans `lien-reinitialisation.test.ts` et
 * `reinitialisation.test.ts` ; ici on garde ce qui fait qu'un joueur perdu
 * retrouve sa ferme au lieu de tourner en rond.
 */

import { readFileSync } from "fs";

import { REINIT_CHEMIN, REINIT_PARAM } from "@farmsim/shared";

const PORTE = readFileSync("src/AuthScreen.tsx", "utf8");
const APP = readFileSync("src/App.tsx", "utf8");

/**
 * Le fichier sans ses commentaires.
 *
 * « Le code de secours a été retiré » doit pouvoir s'écrire dans un
 * commentaire — c'est même l'endroit où cette phrase a le plus de valeur, pour
 * qui se demandera dans six mois pourquoi il n'y a qu'une seule voie. Ce qu'on
 * interdit, c'est que le **joueur** le lise. Les assertions portent donc sur
 * ce qui reste une fois les explications ôtées.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

const PORTE_VUE = sansCommentaires(PORTE);

describe("le lien reçu par courriel", () => {
  it("ouvre directement le choix du nouveau mot de passe", () => {
    /*
     * Le cœur du geste. Amener le joueur sur « Je débute » et le laisser
     * chercher son chemin annulerait tout l'intérêt du lien — il vient de
     * cliquer précisément pour ne pas avoir à chercher.
     */
    expect(APP).toContain('jetonDansLAdresse() ? "reset" : "register"');
    expect(APP).toContain("function jetonDansLAdresse");
    expect(APP).toContain("REINIT_CHEMIN");
    expect(APP).toContain("REINIT_PARAM");
  });

  it("refuse une chaîne qui n’a pas la forme d’un jeton, avant tout envoi", () => {
    // Sans cela, n'importe quoi collé derrière `?jeton=` basculerait l'écran
    // et partirait au serveur.
    expect(APP).toContain("jetonDeReinitValide(brut)");
  });

  it("retire le jeton de la barre d’adresse une fois servi", () => {
    /*
     * Un jeton laissé dans l'adresse se retrouve dans l'historique, dans un
     * signet pris par mégarde, et dans le `Referer` de la requête suivante.
     * Il est déjà brûlé côté serveur ; l'effacer referme le cas où la réponse
     * ne serait jamais parvenue.
     */
    expect(APP).toContain("function effacerJetonDeLAdresse");
    expect(APP).toContain("window.history.replaceState");
    // Dans le `finally` : même si la route échoue, le jeton ne reste pas.
    expect(APP).toMatch(/finally \{\s*setJetonReinit\(null\);\s*effacerJetonDeLAdresse\(\);/);
  });

  it("ne construit pas le chemin à la main de son côté", () => {
    // Le serveur compose le lien, le client le relit : une constante partagée
    // ou les deux finiront par diverger d'un « s » final.
    expect(REINIT_CHEMIN.startsWith("/")).toBe(true);
    expect(REINIT_PARAM.length).toBeGreaterThan(0);
    expect(APP).not.toContain('"/reinitialiser"');
  });
});

describe("l’écran d’oubli", () => {
  it("ne propose le courriel que si le serveur sait en envoyer", () => {
    /*
     * Un bouton qui échoue en silence sur une instance sans SMTP promettrait
     * un secours qui n'arriverait jamais. Le code de secours tenait autrefois
     * ce rôle hors ligne ; il a été retiré, donc l'écran n'a plus rien à
     * proposer dans ce cas — et il le dit au lieu d'afficher un lien mort.
     */
    expect(APP).toContain('api<{ disponible: boolean }>("/auth/courriel")');
    expect(PORTE).toContain("courrielDisponible");
    expect(PORTE).toMatch(/L'envoi d'e-mail n'est pas actif sur ce serveur/);
  });

  it("dit ce qui n’arrivera pas, et pourquoi", () => {
    /*
     * « Nous ne pouvons pas vous renvoyer l'ancien » a l'air d'un aveu de
     * faiblesse ; c'est l'inverse. Le dire évite surtout qu'on cherche dans le
     * message un mot de passe qui n'y sera jamais.
     */
    expect(PORTE).toMatch(/ne pouvons pas vous renvoyer l'ancien/);
    expect(PORTE).toMatch(/empreinte illisible/);
  });

  it("n’a plus qu’une voie, et ne laisse pas traîner l’autre", () => {
    /*
     * Il y en avait deux — le code de secours et le lien — qui tombaient en
     * panne pour des raisons différentes. La première a été retirée : il ne
     * doit en rester aucune trace à l'écran, sans quoi on proposerait un
     * chemin que le serveur ne sait plus suivre.
     */
    expect(PORTE_VUE).not.toMatch(/code de secours/i);
    expect(PORTE_VUE).not.toContain('"recover"');
    expect(PORTE).toContain('onAuthModeChange("forgot")');
  });

  it("affiche la réponse du serveur telle quelle", () => {
    /*
     * Le serveur répond la même chose pour une adresse connue et pour une
     * inconnue — c'est ce qui empêche l'écran de devenir un annuaire. Le
     * nuancer côté client selon ce qu'on croit savoir referait la fuite.
     */
    expect(APP).toContain("setMsg(r.message)");
    expect(APP).toContain('api<{ message: string }>("/auth/forgot"');
  });

  it("ne demande pas l’adresse quand le jeton dit déjà de qui il s’agit", () => {
    // La demander inviterait à se tromper, et laisserait croire qu'elle est
    // vérifiée.
    expect(PORTE).toContain('<label className="field" hidden={isReset}>');
  });

  it("ne demande pas de mot de passe quand on ne fait que réclamer un lien", () => {
    expect(PORTE).toContain('<label className="field" hidden={isForgot}>');
  });

  it("nomme le bouton d’après ce qu’il fait", () => {
    expect(PORTE).toContain('? "Recevoir le lien"');
    expect(PORTE).toContain('? "Changer mon mot de passe"');
  });
});
