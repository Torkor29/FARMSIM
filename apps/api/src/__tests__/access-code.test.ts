/**
 * Le code d'accès : haché, et migré sans mettre personne dehors.
 *
 * Il était stocké en clair, sous un commentaire qui l'assumait. C'est ce qui a
 * permis de retrouver le mot de passe d'un joueur en lisant une colonne.
 *
 * Deux chemins doivent tenir, et ce sont eux que ce fichier éprouve :
 *
 *  - **compte déjà migré** — la colonne porte une empreinte, on vérifie ;
 *  - **compte pas encore migré** — la colonne porte encore le code, on
 *    compare, et l'appelant remplace la valeur par son empreinte.
 *
 * Le second est le plus dangereux : s'il se trompait, le joueur se retrouverait
 * dehors avec un code que plus rien ne reconnaît, et sans moyen de revenir en
 * arrière puisque le clair a disparu.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BCRYPT_COST,
  CODE_INUTILISABLE,
  codeCorrespond,
  doitEtreMigre,
  estHache,
  hacherCode,
} from "../access-code.js";

describe("l'empreinte", () => {
  it("ne contient rien du code", async () => {
    const empreinte = await hacherCode("mon-code-secret");
    assert.ok(!empreinte.includes("mon-code-secret"));
    assert.equal(empreinte.length, 60);
    assert.match(empreinte, /^\$2[aby]\$12\$/);
  });

  it("diffère à chaque fois, même pour le même code", async () => {
    // Le sel est tiré par bcrypt. Sans lui, deux joueurs ayant choisi « ferme »
    // — c'est le code par défaut, donc ce sera la moitié d'entre eux —
    // auraient la même ligne, et une seule attaque les ouvrirait tous.
    const a = await hacherCode("ferme");
    const b = await hacherCode("ferme");
    assert.notEqual(a, b);
    assert.ok(await codeCorrespond(a, "ferme"));
    assert.ok(await codeCorrespond(b, "ferme"));
  });

  it("coûte assez cher pour qu'une base volée ne s'ouvre pas au dictionnaire", () => {
    assert.ok(BCRYPT_COST >= 12, `coût ${BCRYPT_COST} : trop bas pour un secret choisi par un humain`);
  });
});

describe("compte déjà migré", () => {
  it("ouvre avec le bon code", async () => {
    const stocke = await hacherCode("bon-code");
    assert.ok(await codeCorrespond(stocke, "bon-code"));
  });

  it("refuse le mauvais, et n'est plus à migrer", async () => {
    const stocke = await hacherCode("bon-code");
    assert.ok(!(await codeCorrespond(stocke, "mauvais-code")));
    assert.ok(!(await codeCorrespond(stocke, "bon-cod")));
    assert.ok(!(await codeCorrespond(stocke, "")));
    assert.ok(!doitEtreMigre(stocke));
    assert.ok(estHache(stocke));
  });
});

describe("compte pas encore migré", () => {
  it("ouvre encore avec le code en clair", async () => {
    // Le point entier de la migration paresseuse : rien ne casse le jour du
    // déploiement, et il n'y a pas de fenêtre de bascule à surveiller.
    assert.ok(await codeCorrespond("ferme", "ferme"));
    assert.ok(!(await codeCorrespond("ferme", "grange")));
  });

  it("est signalé comme à migrer", () => {
    assert.ok(doitEtreMigre("ferme"));
    assert.ok(!estHache("ferme"));
  });

  it("s'ouvre toujours une fois migré — c'est ce qui garantit qu'on n'enferme personne", async () => {
    /*
     * Le chemin complet, dans l'ordre exact où la route le parcourt :
     * on vérifie le clair, on hache **le code saisi**, on remplace. Puis on
     * revérifie contre la nouvelle valeur.
     */
    let colonne = "code-du-joueur";
    assert.ok(await codeCorrespond(colonne, "code-du-joueur"));
    if (doitEtreMigre(colonne)) colonne = await hacherCode("code-du-joueur");

    assert.ok(estHache(colonne));
    assert.ok(!doitEtreMigre(colonne));
    assert.ok(await codeCorrespond(colonne, "code-du-joueur"));
    assert.ok(!(await codeCorrespond(colonne, "ferme")));
  });

  it("une seconde migration ne casse rien : l'opération est rejouable", async () => {
    // Le script de balayage peut être relancé, et une connexion peut tomber
    // pendant qu'il tourne. Re-hacher une empreinte enfermerait le joueur
    // dehors ; `doitEtreMigre` est le garde-fou, et il doit tenir.
    const empreinte = await hacherCode("code-du-joueur");
    assert.ok(!doitEtreMigre(empreinte));
    assert.ok(await codeCorrespond(empreinte, "code-du-joueur"));
  });
});

describe("compte sans code utilisable — les PNJ", () => {
  it("n'ouvre avec rien, pas même la chaîne vide", async () => {
    assert.ok(!(await codeCorrespond(CODE_INUTILISABLE, "")));
    assert.ok(!(await codeCorrespond(CODE_INUTILISABLE, "npc-abcd1234")));
    assert.ok(!(await codeCorrespond(CODE_INUTILISABLE, "ferme")));
  });

  it("n'est pas candidat à la migration : rien à mettre à l'abri", () => {
    // Le hacher coûterait trois cents fois le prix d'un bcrypt au démarrage du
    // monde, pour des comptes que personne n'ouvrira jamais.
    assert.ok(!doitEtreMigre(CODE_INUTILISABLE));
  });
});

describe("ce qu'on ne doit pas confondre avec une empreinte", () => {
  it("un code qui ressemble à du bcrypt sans en être n'est pas pris pour tel", async () => {
    /*
     * Un joueur peut choisir n'importe quoi entre trois et trente-deux
     * caractères. S'il tape `$2b$12$…`, la valeur stockée en clair serait lue
     * comme une empreinte, `bcrypt.compare` échouerait, et il n'ouvrirait plus
     * son compte. Le motif exige donc le format complet — et de toute façon un
     * code de trente-deux caractères ne peut pas atteindre les soixante d'une
     * empreinte.
     */
    assert.ok(!estHache("$2b$"));
    assert.ok(!estHache("$2b$1$court"));
    assert.ok(!estHache("$3b$12$autre-chose"));
    assert.ok(!estHache("2b$12$sans-le-dollar"));
    /*
     * Le pire cas possible : un joueur qui utilise les trente-deux caractères
     * que le schéma autorise pour imiter une empreinte au plus près. Le
     * préfixe est bon ; la longueur ne peut pas l'être, une empreinte en fait
     * soixante.
     */
    const CODE_MAX = 32;
    const imitation = "$2b$12$".padEnd(CODE_MAX, "a");
    assert.equal(imitation.length, CODE_MAX);
    assert.ok(!estHache(imitation));
    // Et le code piégeux s'ouvre bel et bien, avant comme après migration —
    // c'est ce que le motif protège.
    assert.ok(await codeCorrespond(imitation, imitation));
    assert.ok(await codeCorrespond(await hacherCode(imitation), imitation));
    // Une vraie empreinte, elle, est reconnue : sinon le test ci-dessus se
    // contenterait de tout refuser.
    assert.ok(estHache(await hacherCode(imitation)));
  });
});
