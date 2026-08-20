/**
 * Les migrations doivent survivre à une base qui contient déjà des données.
 *
 * Ce fichier existe à cause d'un incident. Sous SQLite, la migration
 * `20260814120000_building_rotation` ajoutait une colonne ainsi —
 *
 *     ALTER TABLE "Building" ADD COLUMN "createdAt" DATETIME
 *       NOT NULL DEFAULT CURRENT_TIMESTAMP;
 *
 * — ce que SQLite refuse, **mais seulement s'il a des lignes à remplir**. Sur
 * une base neuve la table est vide et l'ordre passe. Toutes les suites de
 * tests, tous les postes de développement, toutes les bases jetables étaient
 * donc au vert. La seule base qui contenait de vrais bâtiments, celle de
 * production, a échoué — et `migrate deploy` a ensuite refusé d'appliquer quoi
 * que ce soit, laissant le conteneur redémarrer en boucle.
 *
 * **Le jeu est passé à PostgreSQL, et le piège a changé de forme.**
 * `CURRENT_TIMESTAMP` en défaut ne pose plus de problème : PostgreSQL sait
 * remplir les lignes existantes. En revanche il refuse net une colonne
 * `NOT NULL` **sans défaut** dès qu'il y a une ligne à remplir — c'est
 * exactement le même incident, avec une autre syntaxe. La leçon, elle, n'a pas
 * bougé : un test qui ne s'exécute que sur du neuf ne voit pas ce défaut.
 *
 * Il le voit donc de deux façons : par lecture du SQL, et en rejouant
 * réellement les migrations sur une base peuplée.
 */

import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const MIGRATIONS = join(API_DIR, "prisma", "migrations");

let base: BaseTest | null = null;
after(() => supprimerBaseTest(base));

function dossiersDeMigration(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((n) => statSync(join(MIGRATIONS, n)).isDirectory())
    .sort();
}

/** Exécute du SQL sur la base de test. */
function sql(url: string, texte: string): string {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", texte], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

describe("écriture des migrations", () => {
  it("n'ajoute jamais une colonne NOT NULL sans défaut", () => {
    /**
     * Le piège de PostgreSQL. `ADD COLUMN "x" TEXT NOT NULL` sur une table
     * vide passe ; sur une table peuplée, il échoue — et la migration reste
     * en échec, bloquant toutes les suivantes.
     *
     * La parade est toujours la même : donner un défaut, ou ajouter la colonne
     * en nullable puis la remplir puis la contraindre.
     */
    const fautives: string[] = [];
    for (const nom of dossiersDeMigration()) {
      const texte = readFileSync(join(MIGRATIONS, nom, "migration.sql"), "utf8");
      // Un ordre SQL peut tenir sur plusieurs lignes : on raisonne par ordre,
      // pas par ligne, sinon `NOT NULL` posé à la ligne suivante échappe.
      for (const brut of texte.split(";")) {
        const ordre = brut
          .split("\n")
          .filter((l) => !l.trim().startsWith("--"))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (!/ALTER\s+TABLE/i.test(ordre) || !/ADD\s+COLUMN/i.test(ordre)) continue;
        if (!/NOT\s+NULL/i.test(ordre)) continue;
        if (/DEFAULT/i.test(ordre)) continue;
        fautives.push(`${nom} : ${ordre.slice(0, 160)}`);
      }
    }
    assert.deepEqual(
      fautives,
      [],
      "colonne NOT NULL sans défaut sur une table qui peut contenir des lignes —\n" +
        "donnez-lui un défaut, ou ajoutez-la nullable puis remplissez-la :\n" +
        fautives.join("\n"),
    );
  });
});

describe("migrations sur une base peuplée", () => {
  it("applique la suite entière sans rien perdre", () => {
    base = creerBaseTest("migr");
    const url = base.url;
    const prisma = join(API_DIR, "node_modules", ".bin", "prisma");
    const schema = join(API_DIR, "prisma", "schema.prisma");

    // On peuple les tables que les migrations retouchent, puis on rejoue :
    // `migrate deploy` est idempotent, mais le jour où une migration future
    // ajoutera une colonne mal fichue, elle butera ici sur des lignes réelles
    // — et non sur des tables vides, où elle passerait.
    sql(
      url,
      `INSERT INTO "Zone" (id,code,name,country,koppen,"riskNote")
         VALUES ('z-test','Z-TEST','Zone','FR','Cfb','');
       INSERT INTO "Parcel" (id,"zoneId",label,"mapX","mapY","landPrice")
         VALUES ('p-test','z-test','Champ',0,0,1000);
       INSERT INTO "Building" (id,"parcelId",type,level,"originX","originY")
         VALUES ('b-test','p-test','SILO',1,0,0);`,
    );
    const avant = Number(sql(url, `SELECT COUNT(*) FROM "Building"`));

    execFileSync(prisma, ["migrate", "deploy", "--schema", schema], {
      cwd: API_DIR,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "ignore",
    });

    const apres = Number(sql(url, `SELECT COUNT(*) FROM "Building"`));
    const echecs = Number(
      sql(
        url,
        `SELECT COUNT(*) FROM "_prisma_migrations"
           WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
      ),
    );
    const colonnes = sql(
      url,
      `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name='Building'`,
    ).split("\n");

    assert.equal(echecs, 0, "aucune migration ne doit rester en échec");
    assert.equal(apres, avant, "aucune ligne ne doit disparaître");
    for (const attendue of ["rotation", "createdAt", "level"]) {
      assert.ok(colonnes.includes(attendue), `la colonne ${attendue} doit exister`);
    }
  });
});
