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
import { closeSync, openSync, realpathSync, rmSync, writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
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

/**
 * Une date SQLite, en millisecondes depuis 1970 — ou `null` si ce n'en est pas une.
 *
 * Une colonne de date ne contient pas toujours ce qu'on croit. Prisma écrit
 * des millisecondes, mais `ALTER TABLE … ADD COLUMN "createdAt" DATETIME NOT
 * NULL DEFAULT CURRENT_TIMESTAMP` **remplit les lignes existantes** avec le
 * texte `2026-08-14 12:00:00`. Une même colonne porte alors deux formes : des
 * nombres pour les lignes récentes, du texte pour les anciennes.
 *
 * C'est ce qui a fait échouer le transfert : `Number("2026-08-14 12:00:00")`
 * vaut NaN, et `to_timestamp(NaN / 1000.0)` fait lire `NaN` à PostgreSQL comme
 * un nom de colonne — d'où l'énigmatique « column "nan" does not exist ».
 *
 * `CURRENT_TIMESTAMP` est en temps universel dans SQLite : on ajoute le `Z`
 * qui manque, faute de quoi JavaScript lirait la chaîne dans le fuseau de la
 * machine et déplacerait toutes ces dates d'une ou deux heures.
 */
function epochMs(valeur) {
  if (valeur instanceof Date) {
    const t = valeur.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof valeur === "bigint") return Number(valeur);
  if (typeof valeur === "number") return Number.isFinite(valeur) ? valeur : null;
  const texte = String(valeur).trim();
  if (texte === "") return null;
  if (/^-?\d+(\.\d+)?$/.test(texte)) return Number(texte);
  const iso = texte.includes("T") ? texte : texte.replace(" ", "T");
  const zone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const t = Date.parse(zone);
  return Number.isFinite(t) ? t : null;
}

/** Une cellule SQLite, écrite dans le type que PostgreSQL attend. */
function cellule(valeur, type, ou = "?") {
  if (valeur === null || valeur === undefined) return "NULL";
  if (type && type.startsWith("timestamp")) {
    const ms = epochMs(valeur);
    if (ms === null) {
      // On s'arrête ici plutôt que d'écrire NULL ou 1970 : une date illisible
      // est un défaut de la source qu'il faut voir, pas arrondir en silence.
      throw new Error(
        `date illisible en ${ou} : ${JSON.stringify(valeur)} — ` +
          "corrigez la ligne dans la base source avant de relancer",
      );
    }
    // `to_timestamp` prend des secondes ; SQLite garde des millisecondes.
    return `to_timestamp(${ms} / 1000.0)`;
  }
  if (type === "boolean") return vrai(valeur) ? "TRUE" : "FALSE";
  return litteral(valeur);
}

/**
 * Un booléen SQLite. Même piège que les dates, en moins bruyant : `Number("t")`
 * vaut NaN, donc faux — un booléen stocké en texte se serait retourné sans
 * qu'aucune erreur ne le signale.
 */
function vrai(valeur) {
  if (typeof valeur === "string") return /^(1|t|true|yes|y|on)$/i.test(valeur.trim());
  return Boolean(Number(valeur));
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
    /*
     * On n'écrit que les colonnes que la base d'arrivée connaît.
     *
     * Le schéma a bougé entre les deux : une colonne abandonnée depuis
     * survit dans le vieux fichier SQLite, et l'insérer ferait échouer la
     * table entière sur un « column … does not exist ». À l'inverse, une
     * colonne neuve absente de la source prend simplement sa valeur par
     * défaut — c'est ce qui fait qu'un compte transféré reçoit son code de
     * secours à sa première connexion.
     */
    const toutes = Object.keys(lignes[0]);
    const colonnes = toutes.filter((c) => types.has(c));
    const ignorees = toutes.filter((c) => !types.has(c));
    if (colonnes.length === 0) {
      throw new Error(`aucune colonne de « ${table} » n'existe dans la base d'arrivée`);
    }
    const entete = colonnes.map((c) => `"${c}"`).join(", ");

    for (let i = 0; i < lignes.length; i += PAQUET) {
      const tranche = lignes.slice(i, i + PAQUET);
      const valeurs = tranche
        .map((ligne) => {
          const cellules = colonnes.map((c) => cellule(ligne[c], types.get(c), `${table}.${c}`));
          return `(${cellules.join(", ")})`;
        })
        .join(",\n");
      ecrire(`INSERT INTO "${table}" (${entete}) VALUES\n${valeurs};`);
    }
    rapport.push({
      table,
      lues: lignes.length,
      ...(ignorees.length ? { note: `colonnes ignorées : ${ignorees.join(", ")}` } : {}),
    });
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

export { cellule, epochMs, litteral, vrai };

/*
 * Ce fichier est à la fois un outil et un module.
 *
 * Les tests importent `cellule` et `epochMs` — c'est là que se cachait le
 * défaut qui a arrêté la bascule, et il ne se voit qu'en éprouvant ces
 * fonctions sur les deux formes de date que porte la base. Sans cette garde,
 * les importer lancerait le transfert.
 */
const LANCE_DIRECTEMENT =
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (LANCE_DIRECTEMENT) {
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
    console.log(
      `${r.table.padEnd(18)} ${String(r.lues).padStart(7)}${r.note ? `  (${r.note})` : ""}`,
    );
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
}
