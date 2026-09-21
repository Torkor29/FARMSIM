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
     * « un secours qui n'arrivera jamais » — le travers que `recovery.ts`
     * refusait déjà, et la raison d'être du code de secours.
     */
    expect(APP).toContain('api<{ disponible: boolean }>("/auth/courriel")');
    expect(PORTE).toContain("courrielDisponible");
    expect(PORTE).toContain('onAuthModeChange(courrielDisponible ? "forgot" : "recover")');
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

  it("garde les deux voies, et les relie", () => {
    /*
     * Le papier se perd, la boîte aux lettres se ferme : les deux secours
     * tombent en panne pour des raisons différentes. Celui qui échoue d'un
     * côté doit trouver l'autre sans repasser par la connexion.
     */
    expect(PORTE).toContain("Recevoir plutôt un lien par e-mail");
    expect(PORTE).toContain("J'ai mon code de secours");
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
