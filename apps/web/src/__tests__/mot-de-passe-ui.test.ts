/**
 * Le mot de passe, vu du navigateur.
 *
 * Le serveur exige désormais un vrai mot de passe, mais la moitié cliente
 * portait le même défaut, et de façon plus grave : `accessCode: accessCode ||
 * "ferme"` remplaçait silencieusement un champ vide par un mot connu de tous.
 * Le joueur croyait n'avoir pas mis de mot de passe ; il en avait un, et
 * c'était le même que celui de tous les autres.
 *
 * Ces tests lisent le source. C'est le seul endroit où ce repli se voit : une
 * fois l'écran rendu, un champ vide et un champ rempli produisent la même
 * requête, et rien à l'écran ne les distingue.
 */

import { readFileSync } from "fs";

import { MDP_AIDE, MDP_MAX, MDP_MIN, motDePasseValide } from "@farmsim/shared";

const APP = readFileSync("src/App.tsx", "utf8");
const ECRAN = readFileSync("src/AuthScreen.tsx", "utf8");
const PROFIL = readFileSync("src/ProfilePanel.tsx", "utf8");

describe("l'inscription", () => {
  it("n'invente plus de mot de passe quand le champ est vide", () => {
    // La forme exacte du défaut : un `||` ou un `??` suivi d'un littéral,
    // juste après le champ.
    expect(APP).not.toMatch(/accessCode:\s*accessCode\s*(\|\||\?\?)/);
    expect(APP).toMatch(/accessCode,/);
  });

  it("ne laisse « ferme » nulle part comme repli", () => {
    for (const [nom, src] of [
      ["App.tsx", APP],
      ["AuthScreen.tsx", ECRAN],
    ] as const) {
      expect(`${nom}: ${/(\|\||\?\?)\s*"ferme"/.test(src)}`).toBe(`${nom}: false`);
    }
  });
});

describe("le bouton", () => {
  /**
   * Griser le bouton évite un aller-retour pour rien, mais c'est le serveur
   * qui décide : l'écran doit donc s'aligner sur la même règle, importée et
   * non recopiée.
   */
  it("s'aligne sur la règle partagée plutôt que sur un nombre recopié", () => {
    expect(ECRAN).toMatch(/motDePasseValide\(accessCode\)/);
    expect(ECRAN).not.toMatch(/accessCode\.length >= 3/);
    expect(PROFIL).toMatch(/motDePasseValide\(accessCode\)/);
    expect(PROFIL).not.toMatch(/accessCode\.length >= 3/);
  });

  /**
   * La moitié qu'il ne faut pas casser. Les comptes d'avant ont des mots plus
   * courts que le plancher d'aujourd'hui : si la **connexion** appliquait la
   * même règle, leur bouton resterait gris sans un mot d'explication.
   */
  it("laisse se connecter avec un mot court", () => {
    const connexion = ECRAN.slice(ECRAN.indexOf("const canSubmit"));
    const ligneConnexion = connexion.slice(0, connexion.indexOf(";"));
    expect(ligneConnexion).toMatch(/accessCode\.length >= 1/);
  });
});

describe("la règle partagée", () => {
  it("refuse ce qui est trop court et accepte ce qui ne l'est pas", () => {
    expect(MDP_MIN).toBeGreaterThanOrEqual(8);
    expect(motDePasseValide("abc")).toBe(false);
    expect(motDePasseValide("a".repeat(MDP_MIN - 1))).toBe(false);
    expect(motDePasseValide("a".repeat(MDP_MIN))).toBe(true);
    expect(motDePasseValide("a".repeat(MDP_MAX))).toBe(true);
    // bcrypt ne lit pas au-delà : refuser vaut mieux que rogner en silence.
    expect(motDePasseValide("a".repeat(MDP_MAX + 1))).toBe(false);
  });

  it("annonce le plancher au joueur avant qu'il ne le découvre au refus", () => {
    expect(MDP_AIDE).toContain(String(MDP_MIN));
    expect(ECRAN).toContain("MDP_AIDE");
    expect(PROFIL).toContain("MDP_AIDE");
  });
});

describe("le vocabulaire", () => {
  /**
   * « Code d'accès » décrivait un casier ; le joueur demandait un mot de
   * passe. L'écran d'entrée est le premier endroit où le mot compte.
   */
  it("dit « mot de passe » et non « code d'accès » sur l'écran d'entrée", () => {
    expect(ECRAN).not.toMatch(/code d'accès/i);
    // Le code de **secours** garde son nom : ce n'en est pas un.
    expect(ECRAN).toMatch(/Code de secours/);
  });
});
