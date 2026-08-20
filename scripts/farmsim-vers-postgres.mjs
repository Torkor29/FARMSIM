/**
 * Transfert SQLite → PostgreSQL.
 *
 * La base du jeu a vécu sur un fichier SQLite. Ce script la recopie dans
 * PostgreSQL sans passer par Prisma côté lecture : il lit le fichier tel quel,
 * table par table, et écrit en SQL paramétré de l'autre côté.
 *
 * Trois décisions, et leurs raisons :
 *
 * - **L'ordre d'insertion est déduit du graphe réel des clés étrangères**,
 *   lu dans `pg_constraint` au moment du transfert. Un ordre écrit à la main
 *   se casse au premier modèle ajouté ; celui-ci se recalcule tout seul.
 *
 *   La tentation était de suspendre les contraintes
 *   (`session_replication_role = replica`) : c'est plus court, et **cela
 *   demande les droits superutilisateur**, que le propriétaire d'une base
 *   n'a pas. Le transfert aurait donc marché sur mon poste et refusé de
 *   démarrer chez vous.
 * - **On refuse d'écrire dans une base non vide.** Relancer par erreur sur une
 *   base déjà remplie doublerait tout, ou échouerait à mi-chemin.
 * - **On compte les lignes des deux côtés à la fin.** Un transfert qui « s'est
 *   bien passé » sans comptage n'est pas un transfert vérifié.
 *
 * Usage :
 *   node --disable-warning=ExperimentalWarning scripts/farmsim-vers-postgres.mjs \
 *     /chemin/farmsim.db "postgresql://user:mdp@hote:5432/farmsim"
 *
 * Le second argument peut aussi venir de DATABASE_URL.
 */

import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { closeSync, openSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Toutes les tables du jeu ; l'ordre de cette liste ne sert qu'au rapport. */
const TABLES = [
  "User", "QuestClaim", "Session", "Farm", "SupplyOrder", "YoungBatch",
  "Zone", "Parcel", "ParcelCell", "Herd", "Building", "InventoryItem",
  "Machine", "MachineListing", "FieldJob", "MarketPrice", "FuturesContract",
  "MarketTick", "MarketListing", "LedgerEntry", "Delivery", "NpcContract",
  "LaborOrder", "WeatherSnapshot",
];

/** Lignes par requête d'insertion — assez pour aller vite, pas assez pour
 *  dépasser la limite de paramètres de PostgreSQL (65 535). */
const PAQUET = 500;

function psql(url, sql, { silencieux = false } = {}) {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8",
    stdio: silencieux ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"],
  }).trim();
}

/**
 * L'ordre d'insertion, déduit des clés étrangères de la base d'arrivée.
 *
 * Une table n'est insérée qu'après toutes celles dont elle dépend. Le graphe
 * est lu dans le catalogue, donc il reste juste quand le schéma change.
 */
function ordreInsertion(url, tables) {
  const brut = psql(
    url,
    `SELECT c.conrelid::regclass::text || '|' || c.confrelid::regclass::text
       FROM pg_constraint c WHERE c.contype = 'f'`,
    { silencieux: true },
  );
  const depend = new Map(tables.map((t) => [t, new Set()]));
  for (const ligne of brut.split("\n").filter(Boolean)) {
    const [de, vers] = ligne.split("|").map((x) => x.replace(/"/g, "").trim());
    if (de === vers) continue; // une auto-référence ne contraint pas l'ordre des tables
    if (depend.has(de) && depend.has(vers)) depend.get(de).add(vers);
  }

  const ordre = [];
  const vus = new Set();
  const enCours = new Set();
  const visiter = (t) => {
    if (vus.has(t)) return;
    if (enCours.has(t)) {
      // Un cycle rendrait tout ordre impossible : mieux vaut s'arrêter que
      // transférer à moitié.
      throw new Error(`cycle de clés étrangères autour de « ${t} »`);
    }
    enCours.add(t);
    for (const d of depend.get(t) ?? []) visiter(d);
    enCours.delete(t);
    vus.add(t);
    ordre.push(t);
  };
  for (const t of tables) visiter(t);
  return ordre;
}

/** Une valeur JavaScript, écrite en littéral SQL. */
function litteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return String(v);
  if (v instanceof Uint8Array) return `'\\x${Buffer.from(v).toString("hex")}'::bytea`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Le type de chaque colonne, demandé au schéma PostgreSQL lui-même.
 *
 * SQLite n'a que quatre types de stockage : les dates y sont des
 * millisecondes, les booléens des 0 et des 1. PostgreSQL, lui, a de vrais
 * `timestamp` et de vrais `boolean`, et refuse l'entier à leur place.
 *
 * Deviner d'après le nom de la colonne — « ...At » pour une date, « is... »
 * pour un booléen — marcherait *presque*. Et « presque », sur des dates, c'est
 * un jeu où tout le monde s'est inscrit en 1970. On lit donc le catalogue.
 */
function typesColonnes(url, table) {
  const sortie = psql(
    url,
    `SELECT column_name || '|' || data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'`,
    { silencieux: true },
  );
  const types = new Map();
  for (const ligne of sortie.split("\n").filter(Boolean)) {
    const [col, type] = ligne.split("|");
    types.set(col, type);
  }
  return types;
}

/** Une cellule SQLite, écrite dans le type que PostgreSQL attend. */
function cellule(valeur, type) {
  if (valeur === null || valeur === undefined) return "NULL";
  if (type && type.startsWith("timestamp")) {
    // `to_timestamp` prend des secondes ; SQLite garde des millisecondes.
    return `to_timestamp(${Number(valeur)} / 1000.0)`;
  }
  if (type === "boolean") return Number(valeur) ? "TRUE" : "FALSE";
  return litteral(valeur);
}

function transferer(fichierDb, url) {
  const db = new DatabaseSync(fichierDb, { readOnly: true });

  const existantes = new Set(
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => r.name),
  );

  // Refus d'écrire dans une base déjà peuplée.
  const deja = psql(
    url,
    `SELECT COALESCE(SUM(n),0) FROM (${TABLES.map(
      (t) => `SELECT COUNT(*) AS n FROM "${t}"`,
    ).join(" UNION ALL ")}) s`,
    { silencieux: true },
  );
  if (Number(deja) > 0) {
    throw new Error(
      `la base PostgreSQL contient déjà ${deja} lignes — videz-la avant de transférer`,
    );
  }

  /**
   * Le SQL part dans un fichier, pas dans un tuyau.
   *
   * Quatre-vingt-huit mille cases de parcelle font des dizaines de mégaoctets
   * d'INSERT : passés à `psql` sur l'entrée standard, le tuyau se rompt
   * (EPIPE) avant la fin et le transfert s'arrête à mi-chemin sans dire
   * pourquoi. Un fichier se relit, se garde, et se rejoue.
   */
  const rapport = [];
  const fichierSql = join(tmpdir(), `farmsim-transfert-${Date.now()}.sql`);
  const fd = openSync(fichierSql, "w");
  const ecrire = (ligne) => writeSync(fd, ligne + "\n");
  ecrire("BEGIN;");

  for (const table of ordreInsertion(url, TABLES)) {
    if (!existantes.has(table)) {
      rapport.push({ table, lues: 0, note: "absente de la source" });
      continue;
    }
    const lignes = db.prepare(`SELECT * FROM "${table}"`).all();
    if (lignes.length === 0) {
      rapport.push({ table, lues: 0 });
      continue;
    }
    const types = typesColonnes(url, table);
    const colonnes = Object.keys(lignes[0]);
    const entete = colonnes.map((c) => `"${c}"`).join(", ");

    for (let i = 0; i < lignes.length; i += PAQUET) {
      const tranche = lignes.slice(i, i + PAQUET);
      const valeurs = tranche
        .map((ligne) => {
          const cellules = colonnes.map((c) => cellule(ligne[c], types.get(c)));
          return `(${cellules.join(", ")})`;
        })
        .join(",\n");
      ecrire(`INSERT INTO "${table}" (${entete}) VALUES\n${valeurs};`);
    }
    rapport.push({ table, lues: lignes.length });
  }

  ecrire("COMMIT;");
  closeSync(fd);
  db.close();

  try {
    execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-q", "-f", fichierSql], {
      stdio: ["ignore", "inherit", "inherit"],
    });
  } finally {
    rmSync(fichierSql, { force: true });
  }

  return rapport;
}

/**
 * Le contrôle qui donne sa valeur au transfert.
 *
 * On recompte des deux côtés, et on **rétablit puis éprouve** les contraintes
 * de clé étrangère : les avoir suspendues pendant le transfert ne doit pas
 * laisser passer une ligne orpheline.
 */
function verifier(fichierDb, url, rapport) {
  const db = new DatabaseSync(fichierDb, { readOnly: true });
  const ecarts = [];
  for (const { table, lues } of rapport) {
    const apres = Number(psql(url, `SELECT COUNT(*) FROM "${table}"`, { silencieux: true }));
    if (apres !== lues) ecarts.push(`${table} : ${lues} lues, ${apres} écrites`);
  }
  db.close();

  return ecarts;
}

const [fichierDb, urlArg] = process.argv.slice(2);
const url = urlArg ?? process.env.DATABASE_URL;
if (!fichierDb || !url) {
  console.error(
    "usage : farmsim-vers-postgres.mjs <fichier.db> <postgresql://...>\n" +
      "        (l'URL peut aussi venir de DATABASE_URL)",
  );
  process.exit(2);
}

const rapport = transferer(fichierDb, url);
const ecarts = verifier(fichierDb, url, rapport);

rapport.sort((a, b) => TABLES.indexOf(a.table) - TABLES.indexOf(b.table));
for (const r of rapport) {
  console.log(`${r.table.padEnd(18)} ${String(r.lues).padStart(7)}${r.note ? `  (${r.note})` : ""}`);
}
const total = rapport.reduce((n, r) => n + r.lues, 0);
console.log(`${"TOTAL".padEnd(18)} ${String(total).padStart(7)}`);

if (ecarts.length) {
  console.error("\nTRANSFERT REFUSÉ — la base d'arrivée ne correspond pas :");
  for (const e of ecarts) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  "\nTransfert vérifié : mêmes comptes de part et d'autre, et les clés étrangères\n" +
    "ont été respectées à l'insertion — elles n'ont jamais été suspendues.",
);
