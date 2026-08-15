/**
 * Les migrations doivent survivre à une base qui contient déjà des données.
 *
 * Ce fichier existe à cause d'un incident : la migration
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
 * que ce soit (P3009), laissant le conteneur redémarrer en boucle.
 *
 * Un test qui ne s'exécute que sur du neuf ne voit pas ce genre de défaut.
 * Celui-ci le voit de deux façons : par lecture du SQL, et en rejouant
 * réellement les migrations sur une base peuplée.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const MIGRATIONS = join(API_DIR, "prisma", "migrations");

function dossiersDeMigration(): string[] {
  return readdirSync(MIGRATIONS)
    .filter((n) => statSync(join(MIGRATIONS, n)).isDirectory())
    .sort();
}

describe("écriture des migrations", () => {
  it("n'ajoute jamais une colonne dont le défaut n'est pas constant", () => {
    // SQLite refuse `CURRENT_TIMESTAMP`, `CURRENT_DATE`, `CURRENT_TIME` et
    // toute expression parenthésée en défaut d'une colonne ajoutée — dès lors
    // qu'il y a des lignes à remplir. Dans un `CREATE TABLE`, en revanche,
    // c'est parfaitement légal : la parade est de reconstruire la table, comme
    // le fait `20260812084004_building_levels`.
    const fautives: string[] = [];
    for (const nom of dossiersDeMigration()) {
      const sql = readFileSync(join(MIGRATIONS, nom, "migration.sql"), "utf8");
      for (const ligne of sql.split("\n")) {
        const nue = ligne.trim();
        if (nue.startsWith("--")) continue;
        if (!/ADD\s+COLUMN/i.test(nue)) continue;
        if (/DEFAULT\s+(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME|\()/i.test(nue)) {
          fautives.push(`${nom} : ${nue}`);
        }
      }
    }
    assert.deepEqual(
      fautives,
      [],
      `défaut non constant sur une colonne ajoutée — reconstruisez la table :\n${fautives.join("\n")}`,
    );
  });
});

describe("migrations sur une base peuplée", () => {
  it("applique la suite entière sans rien perdre", () => {
    const dossier = mkdtempSync(join(tmpdir(), "farmsim-migr-"));
    const chemin = join(dossier, "prod.db");
    const url = `file:${chemin}`;
    const prisma = join(API_DIR, "node_modules", ".bin", "prisma");
    const schema = join(API_DIR, "prisma", "schema.prisma");
    try {
      execFileSync(prisma, ["migrate", "deploy", "--schema", schema], {
        cwd: API_DIR,
        env: { ...process.env, DATABASE_URL: url },
        stdio: "ignore",
      });

      // On peuple les tables que les migrations retouchent, puis on rejoue :
      // `migrate deploy` est idempotent, mais le jour où une migration future
      // ajoutera une colonne mal fichue, elle butera ici sur des lignes
      // réelles — et non sur des tables vides, où elle passerait.
      const db = new DatabaseSync(chemin);
      db.exec(`
        INSERT INTO "Zone" (id,code,name,country,koppen,riskNote)
          VALUES ('z-test','Z-TEST','Zone','FR','Cfb','');
        INSERT INTO "Parcel" (id,zoneId,label,mapX,mapY,landPrice)
          VALUES ('p-test','z-test','Champ',0,0,1000);
        INSERT INTO "Building" (id,parcelId,type,level,originX,originY)
          VALUES ('b-test','p-test','SILO',1,0,0);
      `);
      const avant = db.prepare(`SELECT COUNT(*) AS n FROM "Building"`).get() as { n: number };
      db.close();

      execFileSync(prisma, ["migrate", "deploy", "--schema", schema], {
        cwd: API_DIR,
        env: { ...process.env, DATABASE_URL: url },
        stdio: "ignore",
      });

      const apres = new DatabaseSync(chemin);
      const n = apres.prepare(`SELECT COUNT(*) AS n FROM "Building"`).get() as { n: number };
      const echecs = apres
        .prepare(
          `SELECT COUNT(*) AS n FROM "_prisma_migrations"
             WHERE finished_at IS NULL AND rolled_back_at IS NULL`,
        )
        .get() as { n: number };
      const colonnes = apres
        .prepare(`SELECT name FROM pragma_table_info('Building')`)
        .all() as { name: string }[];
      apres.close();

      assert.equal(echecs.n, 0, "aucune migration ne doit rester en échec");
      assert.equal(n.n, avant.n, "aucune ligne ne doit disparaître");
      for (const attendue of ["rotation", "createdAt", "level"]) {
        assert.ok(
          colonnes.some((c) => c.name === attendue),
          `la colonne ${attendue} doit exister`,
        );
      }
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
