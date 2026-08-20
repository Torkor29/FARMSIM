/**
 * La conversion des valeurs, au transfert SQLite → PostgreSQL.
 *
 * Ce fichier existe à cause d'une bascule arrêtée en pleine course :
 *
 *     psql:…/farmsim-transfert-….sql:1183: ERROR: column "nan" does not exist
 *     LINE 2: …'SILO', 1, 0, 1, 0, to_timestamp(NaN / 1000…
 *
 * La cause tenait en une ligne de migration. `ALTER TABLE "Building" ADD
 * COLUMN "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` **remplit
 * les lignes existantes** — et SQLite y écrit le texte `2026-08-14 12:00:00`,
 * pas des millisecondes. La colonne portait donc deux formes à la fois :
 * des nombres pour les bâtiments posés depuis, du texte pour les autres.
 * `Number()` rendait NaN, et PostgreSQL lisait `NaN` comme un nom de colonne.
 *
 * Un transfert ne se rejoue pas : quand il casse, c'est le jour de la
 * bascule, sur les seules données qui comptent. D'où ces tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { cellule, epochMs, litteral, vrai } from "../farmsim-vers-postgres.mjs";

const HORODATAGE = "timestamp(3) without time zone";

describe("lecture d'une date", () => {
  it("lit les millisecondes que Prisma écrit", () => {
    assert.equal(epochMs(1787232761066), 1787232761066);
    assert.equal(epochMs(0), 0);
  });

  it("lit le texte que CURRENT_TIMESTAMP laisse derrière lui", () => {
    // C'est la forme exacte qui a arrêté la bascule.
    assert.equal(epochMs("2026-08-14 12:00:00"), Date.UTC(2026, 7, 14, 12, 0, 0));
  });

  it("prend CURRENT_TIMESTAMP pour du temps universel", () => {
    // SQLite écrit en UTC. Sans le « Z » ajouté, JavaScript lirait la chaîne
    // dans le fuseau de la machine : toutes ces dates glisseraient d'une ou
    // deux heures selon l'endroit d'où l'on lance le transfert.
    process.env.TZ = "Europe/Paris";
    assert.equal(epochMs("2026-08-14 12:00:00"), Date.UTC(2026, 7, 14, 12, 0, 0));
    assert.equal(epochMs("2026-01-14 12:00:00"), Date.UTC(2026, 0, 14, 12, 0, 0));
  });

  it("accepte aussi l'ISO, avec ou sans fuseau", () => {
    assert.equal(epochMs("2026-08-14T12:00:00Z"), Date.UTC(2026, 7, 14, 12, 0, 0));
    assert.equal(epochMs("2026-08-14T12:00:00"), Date.UTC(2026, 7, 14, 12, 0, 0));
    assert.equal(epochMs("2026-08-14T14:00:00+02:00"), Date.UTC(2026, 7, 14, 12, 0, 0));
  });

  it("accepte les millisecondes rendues en texte, et les grands entiers", () => {
    assert.equal(epochMs("1787232761066"), 1787232761066);
    assert.equal(epochMs(1787232761066n), 1787232761066);
  });

  it("rend null sur ce qui n'est pas une date", () => {
    assert.equal(epochMs("bonjour"), null);
    assert.equal(epochMs(""), null);
    assert.equal(epochMs(NaN), null);
    assert.equal(epochMs(Infinity), null);
  });
});

describe("écriture d'une cellule de date", () => {
  it("n'écrit jamais NaN dans le SQL", () => {
    // Le défaut se reconnaît à l'œil nu dans le fichier produit : c'est cela
    // qu'il faut interdire, pas seulement le cas connu.
    for (const valeur of [1787232761066, "2026-08-14 12:00:00", "2026-08-14T12:00:00Z"]) {
      const sql = cellule(valeur, HORODATAGE, "Building.createdAt");
      assert.ok(!sql.includes("NaN"), `NaN écrit pour ${valeur} : ${sql}`);
      assert.match(sql, /^to_timestamp\(-?\d+ \/ 1000\.0\)$/);
    }
  });

  it("rend le même instant, que la source soit en texte ou en nombre", () => {
    const ms = Date.UTC(2026, 7, 14, 12, 0, 0);
    assert.equal(
      cellule(ms, HORODATAGE, "Building.createdAt"),
      cellule("2026-08-14 12:00:00", HORODATAGE, "Building.createdAt"),
    );
  });

  it("laisse passer les colonnes de date vides", () => {
    assert.equal(cellule(null, HORODATAGE, "Building.processedAt"), "NULL");
    assert.equal(cellule(undefined, HORODATAGE, "Building.processedAt"), "NULL");
  });

  it("s'arrête net sur une date illisible, en la nommant", () => {
    // Écrire NULL ou 1970 ferait passer le transfert et perdrait la donnée
    // sans bruit — la panne se découvrirait des semaines plus tard, en jeu.
    assert.throws(
      () => cellule("pas une date", HORODATAGE, "Building.createdAt"),
      /Building\.createdAt/,
    );
  });
});

describe("écriture d'un booléen", () => {
  it("lit les 0 et 1 de SQLite", () => {
    assert.equal(cellule(1, "boolean", "User.isNpc"), "TRUE");
    assert.equal(cellule(0, "boolean", "User.isNpc"), "FALSE");
  });

  it("lit aussi un booléen stocké en texte", () => {
    // Même piège que les dates, mais silencieux : `Number("t")` vaut NaN,
    // donc faux. Toutes les fermes PNJ seraient devenues des comptes de
    // joueurs, sans qu'aucune erreur ne le signale.
    for (const oui of ["1", "t", "true", "TRUE", "yes", "on"]) {
      assert.equal(vrai(oui), true, oui);
    }
    for (const non of ["0", "f", "false", "no", "off", ""]) {
      assert.equal(vrai(non), false, non);
    }
  });
});

describe("écriture d'un littéral", () => {
  it("double les apostrophes plutôt que de les laisser fermer la chaîne", () => {
    assert.equal(litteral("Clos d'en Haut"), "'Clos d''en Haut'");
  });

  it("écrit les octets en hexadécimal", () => {
    assert.equal(litteral(new Uint8Array([0xde, 0xad])), "'\\xdead'::bytea");
  });
});
