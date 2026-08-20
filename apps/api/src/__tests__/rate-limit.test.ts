/**
 * Le seau à jetons, mesuré.
 *
 * Une limite de débit se juge sur deux promesses opposées : elle doit arrêter
 * une boucle, et ne jamais gêner un joueur. Ces tests tiennent les deux bouts,
 * horloge injectée pour n'avoir à dormir nulle part.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { BAREMES, Limiteur, classer, cleAppelant } from "../rate-limit.js";

describe("classement des routes", () => {
  it("reconnaît la connexion, où l'attaque est gratuite", () => {
    assert.equal(classer("POST", "/auth/login"), "AUTH");
  });

  it("ne confond pas s'inscrire et se connecter", () => {
    // Deviner un code est une attaque gratuite qu'on étrangle ; créer des
    // comptes est un abus de volume qu'on ralentit. Le même barème punissait
    // une famille derrière une seule adresse pour un risque qui n'est pas le
    // sien — et coupait la suite d'intégration au passage.
    assert.equal(classer("POST", "/auth/register"), "INSCRIPTION");
    assert.ok(BAREMES.INSCRIPTION.parSeconde > BAREMES.AUTH.parSeconde);
  });

  it("sépare la lecture de l'écriture", () => {
    assert.equal(classer("GET", "/players"), "LECTURE");
    assert.equal(classer("POST", "/market/buy"), "ECRITURE");
    assert.equal(classer("DELETE", "/listings/abc"), "ECRITURE");
  });

  it("ne prend pas la chaîne de requête pour un chemin", () => {
    assert.equal(classer("POST", "/auth/login?next=/jeu"), "AUTH");
  });
});

describe("clé d'appelant", () => {
  it("distingue deux sessions derrière la même adresse", () => {
    const a = cleAppelant({ authorization: "Bearer aaa", ip: "1.2.3.4" });
    const b = cleAppelant({ authorization: "Bearer bbb", ip: "1.2.3.4" });
    assert.notEqual(a, b);
  });

  it("ne garde pas le jeton en clair dans la table", () => {
    const cle = cleAppelant({ authorization: "Bearer secret-en-clair", ip: "1.2.3.4" });
    assert.ok(!cle.includes("secret-en-clair"));
  });

  it("retombe sur l'adresse quand il n'y a pas de session", () => {
    assert.equal(cleAppelant({ ip: "9.9.9.9" }), "a:9.9.9.9");
  });
});

describe("le seau arrête une boucle", () => {
  it("laisse passer la rafale, puis refuse", () => {
    const l = new Limiteur();
    const t = 1_000_000;
    for (let i = 0; i < BAREMES.AUTH.capacite; i++) {
      assert.equal(l.autorise("a:1.2.3.4", BAREMES.AUTH, t).ok, true, `essai ${i + 1}`);
    }
    const refus = l.autorise("a:1.2.3.4", BAREMES.AUTH, t);
    assert.equal(refus.ok, false);
    assert.ok(refus.attendreS >= 1);
  });

  it("cent mille codes ne se devinent plus en une soirée", () => {
    /**
     * Le calcul qui justifie le barème : à raison d'un essai toutes les
     * trente secondes, épuiser un code à cinq chiffres demande plus d'un mois
     * d'acharnement continu sur une seule adresse.
     */
    const essaisParJour = 24 * 3600 * BAREMES.AUTH.parSeconde;
    const jours = 100_000 / essaisParJour;
    assert.ok(jours > 30, `${Math.round(jours)} jours`);
  });

  it("se remplit avec le temps", () => {
    const l = new Limiteur();
    const t = 1_000_000;
    for (let i = 0; i < BAREMES.AUTH.capacite; i++) l.autorise("a:1", BAREMES.AUTH, t);
    assert.equal(l.autorise("a:1", BAREMES.AUTH, t).ok, false);
    // Trente secondes plus tard, un jeton exactement.
    assert.equal(l.autorise("a:1", BAREMES.AUTH, t + 30_000).ok, true);
    assert.equal(l.autorise("a:1", BAREMES.AUTH, t + 30_000).ok, false);
  });

  it("un appelant n'épuise pas le seau d'un autre", () => {
    const l = new Limiteur();
    const t = 1_000_000;
    for (let i = 0; i < BAREMES.AUTH.capacite + 5; i++) l.autorise("a:1", BAREMES.AUTH, t);
    assert.equal(l.autorise("a:2", BAREMES.AUTH, t).ok, true);
  });
});

describe("le seau ne gêne pas un joueur", () => {
  it("encaisse l'ouverture d'un écran", () => {
    // Une vingtaine d'appels d'un coup à l'ouverture d'un panneau.
    const l = new Limiteur();
    const t = 1_000_000;
    for (let i = 0; i < 20; i++) {
      assert.equal(l.autorise("j:abc", BAREMES.LECTURE, t + i * 10).ok, true, `appel ${i}`);
    }
  });

  it("tient une heure de jeu soutenu sans jamais refuser", () => {
    /**
     * Un geste par seconde pendant une heure — bien au-delà de ce qu'un joueur
     * réel produit, y compris en glissant le doigt sur une parcelle entière.
     */
    const l = new Limiteur();
    const debut = 1_000_000;
    let refus = 0;
    for (let s = 0; s < 3600; s++) {
      if (!l.autorise("j:abc", BAREMES.ECRITURE, debut + s * 1000).ok) refus++;
    }
    assert.equal(refus, 0);
  });
});

describe("la table ne grandit pas sans fin", () => {
  it("oublie les appelants disparus", () => {
    const l = new Limiteur();
    const t = 1_000_000;
    for (let i = 0; i < 500; i++) l.autorise(`a:${i}`, BAREMES.LECTURE, t);
    assert.equal(l.taille, 500);
    // Onze minutes plus tard, plus personne.
    assert.equal(l.purge(t + 11 * 60 * 1000), 500);
    assert.equal(l.taille, 0);
  });

  it("garde ceux qui sont encore là", () => {
    const l = new Limiteur();
    const t = 1_000_000;
    l.autorise("a:vieux", BAREMES.LECTURE, t);
    l.autorise("a:recent", BAREMES.LECTURE, t + 10 * 60 * 1000);
    l.purge(t + 11 * 60 * 1000);
    assert.equal(l.taille, 1);
  });
});
