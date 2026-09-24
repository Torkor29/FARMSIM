/**
 * Le jeton de réinitialisation, et le transport qui le porte.
 *
 * Deux modules sans base ni réseau : le tirage du jeton, et la lecture des
 * réglages d'envoi. Le parcours complet — demander un lien, s'en servir — est
 * dans `api.test.ts`, sur une vraie base.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { REINIT_JETON_LEN, REINIT_TTL_MS, jetonDeReinitValide } from "@farmsim/shared";

import {
  courrielConfigure,
  envoyerCourriel,
  origineDuJeu,
  reglagesDepuisEnv,
} from "../courriel.js";
import {
  empreinteJeton,
  expirationJeton,
  jetonUtilisable,
  nouveauJetonReinit,
} from "../reinitialisation.js";

describe("le jeton", () => {
  it("a la forme que le client sait reconnaître", () => {
    // Les deux côtés doivent s'accorder : le serveur le fabrique, la page le
    // relit dans l'adresse avant de l'envoyer.
    for (let i = 0; i < 20; i++) {
      const { jeton } = nouveauJetonReinit();
      assert.equal(jeton.length, REINIT_JETON_LEN, jeton);
      assert.ok(jetonDeReinitValide(jeton), jeton);
    }
  });

  it("ne se répète jamais", () => {
    // Deux cent cinquante-six bits tirés au sort : une collision n'arrivera
    // pas. Le test garde le cas où l'on remplacerait le tirage par un
    // compteur ou par une graine fixe.
    const vus = new Set<string>();
    for (let i = 0; i < 200; i++) vus.add(nouveauJetonReinit().jeton);
    assert.equal(vus.size, 200);
  });

  it("ne laisse rien du jeton dans son empreinte", () => {
    const { jeton, empreinte } = nouveauJetonReinit();
    assert.ok(!empreinte.includes(jeton));
    assert.match(empreinte, /^[0-9a-f]{64}$/);
    // Déterministe : c'est elle qui sert de clé de recherche, puisqu'on reçoit
    // un jeton nu sans savoir à qui il appartient.
    assert.equal(empreinteJeton(jeton), empreinte);
  });

  it("expire au bout de la durée annoncée", () => {
    const t = Date.parse("2026-09-21T12:00:00Z");
    assert.equal(expirationJeton(t).getTime(), t + REINIT_TTL_MS);
  });
});

describe("ce qui rend un jeton inutilisable", () => {
  const t = Date.parse("2026-09-21T12:00:00Z");
  const bon = { expiresAt: new Date(t + 60_000), usedAt: null };

  it("accepte un jeton frais et vierge", () => {
    assert.equal(jetonUtilisable(bon, t), true);
  });

  it("refuse un jeton inconnu", () => {
    assert.equal(jetonUtilisable(null, t), false);
  });

  it("refuse un jeton expiré", () => {
    assert.equal(jetonUtilisable({ expiresAt: new Date(t - 1), usedAt: null }, t), false);
    // La borne compte : à l'instant exact de l'expiration, il ne vaut plus.
    assert.equal(jetonUtilisable({ expiresAt: new Date(t), usedAt: null }, t), false);
  });

  it("refuse un jeton déjà servi, même s’il n’a pas expiré", () => {
    /*
     * C'est la condition qu'on oublie, et la plus coûteuse : sans elle, un
     * lien reste une clé permanente dans une boîte de réception.
     */
    assert.equal(
      jetonUtilisable({ expiresAt: new Date(t + 60_000), usedAt: new Date(t - 10) }, t),
      false,
    );
  });
});

describe("les réglages d'envoi", () => {
  it("sont absents par défaut, et c'est un mode de fonctionnement", () => {
    /*
     * Sans cela, ni la suite de tests ni un poste de développement ne
     * pourraient tourner — et l'on ne pourrait pas déployer ce travail avant
     * que les identifiants existent.
     */
    assert.equal(reglagesDepuisEnv({}), null);
    assert.equal(courrielConfigure({}), false);
  });

  it("exigent un hôte, un utilisateur et un mot de passe — pas deux sur trois", () => {
    // Un état à moitié configuré où l'on croirait envoyer sans envoyer serait
    // pire que pas de configuration du tout.
    assert.equal(reglagesDepuisEnv({ FARMSIM_SMTP_HOST: "ssl0.ovh.net" }), null);
    assert.equal(
      reglagesDepuisEnv({ FARMSIM_SMTP_HOST: "ssl0.ovh.net", FARMSIM_SMTP_USER: "a@b.fr" }),
      null,
    );
  });

  it("déduisent le chiffrement du port", () => {
    /*
     * La source d'erreur numéro un : 465 parle TLS dès la poignée de main,
     * 587 commence en clair et monte par STARTTLS. Se tromper donne une
     * erreur de poignée de main illisible, pas un message d'aide — alors on
     * ne le demande pas.
     */
    const base = { FARMSIM_SMTP_HOST: "ssl0.ovh.net", FARMSIM_SMTP_USER: "a@b.fr", FARMSIM_SMTP_PASS: "x" };
    assert.equal(reglagesDepuisEnv({ ...base, FARMSIM_SMTP_PORT: "465" })?.sansHausse, true);
    assert.equal(reglagesDepuisEnv({ ...base, FARMSIM_SMTP_PORT: "587" })?.sansHausse, false);
    // Sans port : 465, le plus courant chez les hébergeurs mutualisés.
    assert.equal(reglagesDepuisEnv(base)?.port, 465);
    assert.equal(reglagesDepuisEnv(base)?.sansHausse, true);
  });

  it("écrivent depuis l'adresse authentifiée à défaut d'autre consigne", () => {
    // La plupart des hébergeurs refusent une adresse d'expédition qu'on n'a
    // pas authentifiée : le repli évite un rejet incompréhensible.
    const base = { FARMSIM_SMTP_HOST: "h", FARMSIM_SMTP_USER: "a@b.fr", FARMSIM_SMTP_PASS: "x" };
    assert.equal(reglagesDepuisEnv(base)?.expediteur, "a@b.fr");
    assert.equal(
      reglagesDepuisEnv({ ...base, FARMSIM_SMTP_FROM: "Jeu <no@b.fr>" })?.expediteur,
      "Jeu <no@b.fr>",
    );
  });

  it("ne lève jamais quand rien n'est configuré", async () => {
    /*
     * Les appelants sont des routes publiques. Un serveur de messagerie
     * absent ou injoignable ne doit pas rendre une erreur 500 à un joueur qui
     * a seulement demandé un lien.
     */
    const r = await envoyerCourriel(
      { destinataire: "a@b.fr", objet: "o", texte: "t" },
      {},
    );
    assert.equal(r.envoye, false);
    assert.match(r.raison ?? "", /non configuré/);
  });
});

describe("l'origine publique", () => {
  it("se lit dans l'environnement, jamais dans la requête", () => {
    /*
     * `Host` et `X-Forwarded-Host` viennent du client. Un lien de
     * réinitialisation composé depuis un en-tête fourni par l'attaquant est
     * le manuel du vol de jeton : le joueur reçoit un vrai courriel, signé par
     * le vrai domaine, qui pointe ailleurs.
     */
    assert.equal(origineDuJeu({ FARMSIM_PUBLIC_URL: "https://exemple.fr" }), "https://exemple.fr");
    assert.equal(origineDuJeu({ FARMSIM_PUBLIC_URL: "https://exemple.fr/" }), "https://exemple.fr");
    assert.equal(origineDuJeu({}), "https://farming-navigator.com");
  });
});
