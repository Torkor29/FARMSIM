/**
 * Le lien de réinitialisation — les règles pures.
 *
 * ## La demande, et la correction qu'elle appelait
 *
 * « Intégrer la possibilité de mettre mot de passe oublié et de recevoir son
 * mdp sur son adresse mail. »
 *
 * La première moitié se fait ; la seconde est impossible, et c'est une bonne
 * nouvelle. Le serveur ne détient pas le mot de passe — seulement une
 * empreinte bcrypt, qui ne se remonte pas. C'est exactement la propriété que
 * le même joueur réclamait quelques jours plus tôt : « c'est censé être
 * crypté, et illisible ». Tout service capable de vous renvoyer votre mot de
 * passe est un service qui le stocke lisible.
 *
 * Ce qui part, c'est donc un lien à usage unique. Ce fichier tient sa forme ;
 * le tirage, l'empreinte et les routes sont côté serveur.
 */

import {
  REINIT_CHEMIN,
  REINIT_ENVOYE,
  REINIT_JETON_LEN,
  REINIT_PARAM,
  REINIT_REFUS,
  REINIT_TTL_LIBELLE,
  REINIT_TTL_MS,
  jetonDeReinitValide,
  lienDeReinit,
} from "@farmsim/shared";

describe("la durée de vie", () => {
  it("se compte en minutes, pas en jours", () => {
    /*
     * Les deux bornes sont réelles. Trop court, le joueur qui relève ses
     * courriels en rentrant trouve un lien mort ; trop long, un message qui
     * traîne dans une boîte mal fermée reste une clé de la ferme.
     */
    expect(REINIT_TTL_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
    expect(REINIT_TTL_MS).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
  });

  it("est dite en français au joueur, et pas en millisecondes", () => {
    expect(REINIT_TTL_LIBELLE).toMatch(/minute/);
    expect(REINIT_ENVOYE).toContain(REINIT_TTL_LIBELLE);
  });
});

describe("la forme d’un jeton", () => {
  it("accepte ce que le serveur produit", () => {
    // 32 octets en base64url font 43 caractères sans remplissage.
    const vrai = "a".repeat(REINIT_JETON_LEN);
    expect(jetonDeReinitValide(vrai)).toBe(true);
    expect(jetonDeReinitValide("aB3-_".padEnd(REINIT_JETON_LEN, "x"))).toBe(true);
  });

  it("refuse tout le reste, et avant tout aller-retour réseau", () => {
    /*
     * La vérification existe pour que la page ne bascule pas en « nouveau mot
     * de passe » — et n'envoie pas au serveur — sur n'importe quelle chaîne
     * collée derrière `?jeton=`. Une adresse tronquée par un client de
     * messagerie en est le cas le plus banal.
     */
    for (const faux of [
      "",
      "court",
      "a".repeat(REINIT_JETON_LEN - 1),
      "a".repeat(REINIT_JETON_LEN + 1),
      `${"a".repeat(REINIT_JETON_LEN - 1)}+`, // base64 classique, pas base64url
      `${"a".repeat(REINIT_JETON_LEN - 1)}/`,
      `${"a".repeat(REINIT_JETON_LEN - 1)} `,
    ]) {
      expect({ faux, accepte: jetonDeReinitValide(faux) }).toEqual({ faux, accepte: false });
    }
  });
});

describe("le lien", () => {
  const JETON = "a".repeat(REINIT_JETON_LEN);

  it("pointe sur la page qui sait le recevoir", () => {
    const lien = lienDeReinit("https://farming-navigator.com", JETON);
    expect(lien).toBe(`https://farming-navigator.com${REINIT_CHEMIN}?${REINIT_PARAM}=${JETON}`);
  });

  it("ne double pas la barre oblique", () => {
    // Une origine recopiée depuis un navigateur en porte souvent une.
    expect(lienDeReinit("https://farming-navigator.com/", JETON)).toBe(
      lienDeReinit("https://farming-navigator.com", JETON),
    );
    expect(lienDeReinit("https://farming-navigator.com///", JETON)).not.toContain("//reinit");
  });

  it("se relit tel quel", () => {
    // Le client retrouve le jeton dans l'adresse : la composition et la
    // lecture doivent employer le même paramètre et le même chemin.
    const url = new URL(lienDeReinit("https://exemple.fr", JETON));
    expect(url.pathname).toBe(REINIT_CHEMIN);
    expect(url.searchParams.get(REINIT_PARAM)).toBe(JETON);
  });
});

describe("ce que le joueur lit", () => {
  it("ne dit jamais si l’adresse est connue", () => {
    /*
     * La règle qui empêche l'écran de devenir un annuaire : sans elle,
     * n'importe qui essaie une adresse et sait, à la réponse, si elle joue.
     * `/auth/recover` l'applique déjà pour le code de secours ; celle-ci ne
     * peut pas faire moins, puisqu'elle prend une adresse **seule**, sans
     * aucune preuve.
     */
    expect(REINIT_ENVOYE).toMatch(/^Si un compte existe/);
    for (const mot of ["inconnu", "introuvable", "n'existe pas", "aucun compte"]) {
      expect({ mot, present: REINIT_ENVOYE.toLowerCase().includes(mot) }).toEqual({
        mot,
        present: false,
      });
    }
  });

  it("prévient pour les indésirables — c’est là qu’ils atterrissent", () => {
    expect(REINIT_ENVOYE).toMatch(/indésirable/i);
  });

  it("dit ce qu’un lien mort veut dire, et quoi faire ensuite", () => {
    // « Lien invalide » laisse le joueur devant un mur. Les deux causes
    // réelles — expiré, déjà servi — mènent au même geste : en redemander un.
    expect(REINIT_REFUS).toMatch(/expiré/);
    expect(REINIT_REFUS).toMatch(/déjà servi/);
    expect(REINIT_REFUS).toMatch(/nouveau/);
  });
});
