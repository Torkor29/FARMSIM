/**
 * L'ordre des parcelles d'une ferme ne doit jamais bouger tout seul.
 *
 * Un joueur a signalé qu'« après un achat, ses parcelles ne sont plus au même
 * endroit ». Deux explications tenaient debout : la liste est réellement
 * réordonnée côté serveur, ou bien c'est la vue qui se recentre. Ce fichier
 * mesure la première — la seconde se lit dans `App.tsx`, où l'achat appelait
 * `setActiveParcelId()`.
 *
 * Ce que la mesure a donné, et ce n'est pas ce qu'on croyait :
 *
 *  - **l'achat, à lui seul, ne dérange rien.** La parcelle acquise s'ajoute à
 *    la fin, les autres ne bougent pas ;
 *  - **c'est le premier coup de charrue qui déplace tout.** Aucune de ces
 *    lectures ne portait de `ORDER BY` ; PostgreSQL rend alors les lignes dans
 *    l'ordre du tas, et un `UPDATE` réécrit la ligne ailleurs. Or
 *    `Parcel.fertility` est réécrite à chaque semis, labour, épandage et
 *    moisson.
 *
 * Le premier test reproduit le défaut sur la requête d'origine — il doit
 * rester rouge en l'absence de tri, sans quoi le second ne prouverait rien.
 * Le second vérifie le tri retenu.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";

const MAIN = fileURLToPath(new URL("../main.ts", import.meta.url));

let base: BaseTest | null = null;

/** Exécute du SQL et rend les lignes, une par élément. */
function sql(texte: string): string[] {
  const out = execFileSync("psql", [base!.url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", texte], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
  return out === "" ? [] : out.split("\n");
}

/** Le tri exact que produit `ORDRE_PARCELLES` dans `main.ts`. */
const TRI = 'ORDER BY "acquiredAt" ASC NULLS FIRST, "id" ASC';

before(() => {
  base = creerBaseTest("ordre");
  // Une ferme, trois parcelles déjà possédées, deux parcelles libres.
  sql(`
    INSERT INTO "Zone" (id,code,name,country,koppen,"riskNote")
      VALUES ('z','Z','Zone','FR','Cfb','');
    INSERT INTO "User" (id,email,"displayName",specialization,"statsJson")
      VALUES ('u','ordre@test.fr','Ordre','CEREALIER','{}');
    INSERT INTO "Farm" (id,"userId",name) VALUES ('f','u','Ferme');
    INSERT INTO "Parcel" (id,"zoneId","farmId",label,"mapX","mapY","landPrice") VALUES
      ('p1','z','f','A',0,0,100),
      ('p2','z','f','B',1,0,100),
      ('p3','z','f','C',2,0,100),
      ('p4','z',NULL,'D',3,0,100),
      ('p5','z',NULL,'E',4,0,100);
  `);
});

after(() => supprimerBaseTest(base));

/** L'achat, tel que le fait la route : la parcelle change de ferme et se date. */
function acheter(id: string): void {
  sql(`UPDATE "Parcel" SET "farmId"='f', "acquiredAt"=now() WHERE id='${id}';`);
}

/** Un chantier, tel que le font semis, labour, épandage et moisson. */
function travailler(id: string): void {
  sql(`UPDATE "Parcel" SET fertility=fertility-0.01 WHERE id='${id}';`);
}

const possedees = (tri: string) => sql(`SELECT label FROM "Parcel" WHERE "farmId"='f' ${tri};`);

/**
 * La même lecture, mais en interdisant les parcours d'index.
 *
 * Sans `ORDER BY`, l'ordre rendu **dépend du plan** : un parcours séquentiel
 * suit le tas, un parcours d'index suit l'index. C'est précisément le défaut —
 * l'ordre n'est pas seulement changeant, il n'est pas spécifié. On fige donc
 * le plan pour que la démonstration soit reproductible, au lieu de dépendre de
 * ce que le planificateur choisira ce jour-là.
 *
 * Corollaire utile : ajouter un index sans ajouter de tri aurait **masqué** le
 * symptôme sans le corriger, jusqu'au jour où le plan rebascule.
 */
const possedeesEnTas = () =>
  sql(
    `SET enable_indexscan=off; SET enable_bitmapscan=off;
     SELECT label FROM "Parcel" WHERE "farmId"='f';`,
  ).filter((l) => l !== "SET");

describe("le défaut, tel qu'il se produisait", () => {
  it("l'achat, lui, ne dérange rien : la nouvelle venue s'ajoute à la fin", () => {
    assert.deepEqual(possedeesEnTas(), ["A", "B", "C"], "décor de départ");
    acheter("p4");
    assert.deepEqual(possedeesEnTas(), ["A", "B", "C", "D"]);
  });

  it("mais un coup de charrue renvoie la parcelle travaillée en fin de liste", () => {
    // `Parcel.fertility` est réécrite par le semis, le labour, l'épandage et
    // la moisson. Un `UPDATE` écrit une nouvelle version de la ligne ailleurs
    // dans le tas : la parcelle qu'on vient de travailler passe donc à la fin.
    travailler("p1");
    assert.deepEqual(
      possedeesEnTas(),
      ["B", "C", "D", "A"],
      "sans tri, PostgreSQL déplace la ligne réécrite — si ce test échoue, " +
        "le tri ne répare plus rien de démontré",
    );
  });
});

describe("le tri qui répare", () => {
  it("garde l'ordre des parcelles déjà possédées, quoi qu'il arrive", () => {
    // Les trois premières n'ont pas de date : elles précèdent, par identifiant.
    assert.deepEqual(possedees(TRI), ["A", "B", "C", "D"]);

    travailler("p2");
    travailler("p3");
    travailler("p1");
    assert.deepEqual(possedees(TRI), ["A", "B", "C", "D"], "un chantier ne réordonne plus rien");
  });

  it("range une parcelle achetée à la fin, sans déplacer les autres", () => {
    acheter("p5");
    assert.deepEqual(possedees(TRI), ["A", "B", "C", "D", "E"]);
    travailler("p5");
    assert.deepEqual(possedees(TRI), ["A", "B", "C", "D", "E"]);
  });

  it("survit à un VACUUM FULL, qui réécrit toute la table", () => {
    // Le cas le plus dur pour un ordre de tas : PostgreSQL recompose le
    // fichier. Un tri explicite s'en moque, l'ordre du tas non.
    sql(`VACUUM FULL "Parcel";`);
    assert.deepEqual(possedees(TRI), ["A", "B", "C", "D", "E"]);
  });
});

describe("le serveur ne peut plus lire une liste non triée", () => {
  const source = readFileSync(MAIN, "utf8");

  it("toute lecture des parcelles d'une ferme porte l'ordre commun", () => {
    /*
     * Le tri est déclaré une fois et réutilisé. Ce test attrape la lecture
     * qu'on ajoutera demain en oubliant `orderBy` — c'est exactement ainsi que
     * le défaut est né.
     */
    const fautives: string[] = [];
    const lignes = source.split("\n");
    lignes.forEach((ligne, i) => {
      if (!/\bparcels:\s*(true|\{)/.test(ligne)) return;
      // Une projection de comptage ne rend aucune liste au joueur.
      const bloc = lignes.slice(i, i + 4).join(" ");
      if (/parcels:\s*\{\s*select:/.test(bloc)) return;
      if (/orderBy/.test(bloc)) return;
      fautives.push(`main.ts:${i + 1} — ${ligne.trim()}`);
    });
    assert.deepEqual(
      fautives,
      [],
      "lecture des parcelles sans `orderBy: ORDRE_PARCELLES` —\n" +
        "l'ordre du tas n'est pas un ordre :\n" +
        fautives.join("\n"),
    );
  });

  it("le tri place bien les parcelles indatables en tête", () => {
    // `nulls: "first"` n'est pas un détail : par défaut PostgreSQL met les
    // nuls **en dernier** en tri ascendant, ce qui ferait passer la parcelle
    // de départ après toutes les acquisitions.
    assert.match(source, /acquiredAt:\s*\{\s*sort:\s*"asc",\s*nulls:\s*"first"\s*\}/);
  });
});
