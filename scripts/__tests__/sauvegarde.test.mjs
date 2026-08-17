/**
 * L'exercice de restauration, joué à chaque intégration.
 *
 * Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde : c'est un
 * fichier dont on espère quelque chose. Ces tests fabriquent une base, la
 * sauvegardent pendant qu'on écrit dedans, la détruisent, la restaurent, et
 * vérifient que les lignes sont revenues. Ils vérifient aussi le cas qui compte
 * le plus le jour venu : qu'une sauvegarde abîmée est **refusée** au lieu
 * d'être conservée avec la date du jour.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { élaguer, horodatage, instantané, sauvegarder, vérifier } from "../farmsim-backup.mjs";
import { libres as terreLibre, purger as purgerEssais } from "../farmsim-purge-essais.mjs";

const SCRIPTS = dirname(fileURLToPath(new URL("../farmsim-backup.mjs", import.meta.url)));

let dossier;
let base;

/** Une base minimale qui a les tables que la sauvegarde juge vitales. */
function fabriquerBase(chemin, joueurs = 40) {
  const db = new DatabaseSync(chemin);
  db.exec(`
    CREATE TABLE IF NOT EXISTS "User" (id INTEGER PRIMARY KEY, nom TEXT, crd REAL);
    CREATE TABLE IF NOT EXISTS "Farm" (id INTEGER PRIMARY KEY, userId INTEGER);
    CREATE TABLE IF NOT EXISTS "Parcel" (id INTEGER PRIMARY KEY, farmId INTEGER);
  `);
  // WAL : c'est le mode qui piège une sauvegarde par simple copie de fichier,
  // puisque les transactions validées vivent alors hors du .db.
  db.exec("PRAGMA journal_mode = WAL");
  const insU = db.prepare('INSERT INTO "User" (id, nom, crd) VALUES (?, ?, ?)');
  const insF = db.prepare('INSERT INTO "Farm" (id, userId) VALUES (?, ?)');
  const insP = db.prepare('INSERT INTO "Parcel" (id, farmId) VALUES (?, ?)');
  for (let i = 1; i <= joueurs; i++) {
    insU.run(i, `Joueur ${i}`, i * 100);
    insF.run(i, i);
    insP.run(i, i);
  }
  db.close();
}

before(() => {
  dossier = mkdtempSync(join(tmpdir(), "farmsim-sauv-"));
  base = join(dossier, "farmsim.db");
  fabriquerBase(base);
});

after(() => {
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

describe("instantané", () => {
  it("produit un fichier relisible, et en compte le contenu", () => {
    const dest = join(dossier, "copie-1.db");
    const r = instantané(base, dest);
    assert.equal(r.integrité, "ok");
    assert.equal(r.lignes.User, 40);
    assert.equal(r.lignes.Parcel, 40);
    assert.ok(r.octets > 0);
  });

  it("emporte ce qui n’est encore que dans le journal WAL", () => {
    // C'est tout l'intérêt de VACUUM INTO : une copie du seul fichier .db
    // laisserait ces vingt lignes derrière elle.
    const db = new DatabaseSync(base);
    db.exec("PRAGMA journal_mode = WAL");
    const ins = db.prepare('INSERT INTO "User" (id, nom, crd) VALUES (?, ?, ?)');
    for (let i = 41; i <= 60; i++) ins.run(i, `Tardif ${i}`, 1);
    // Volontairement : pas de checkpoint. Les lignes sont validées mais
    // n'ont pas encore été reversées dans le .db principal.
    db.close({ allowRemainingOpenStatements: true });

    const dest = join(dossier, "copie-wal.db");
    const r = instantané(base, dest);
    assert.equal(r.lignes.User, 60, "les lignes du WAL doivent être dans la sauvegarde");
  });

  it("refuse une base dont une table vitale est vide", () => {
    const vide = join(dossier, "vide.db");
    fabriquerBase(vide, 0);
    assert.throws(() => instantané(vide, join(dossier, "copie-vide.db")), /table User/);
  });
});

describe("vérification", () => {
  it("rejette un fichier corrompu", () => {
    const abimé = join(dossier, "abime.db");
    const bon = join(dossier, "bon.db");
    instantané(base, bon);
    // On écrase le milieu du fichier : l'en-tête reste crédible, les pages non.
    const octets = readFileSync(bon);
    octets.fill(0x7a, Math.floor(octets.length / 2), Math.floor(octets.length / 2) + 2048);
    writeFileSync(abimé, octets);
    assert.throws(() => vérifier(abimé), /corrompue|vide|SQLITE|malformed|database/i);
  });

  it("n’abandonne jamais un fichier douteux sur le disque", () => {
    const vide = join(dossier, "vide2.db");
    fabriquerBase(vide, 0);
    const cible = mkdtempSync(join(tmpdir(), "farmsim-jetable-"));
    assert.throws(() => sauvegarder({ source: vide, dossier: cible }));
    assert.deepEqual(readdirSync(cible), [], "le fichier raté doit avoir été effacé");
    rmSync(cible, { recursive: true, force: true });
  });
});

describe("rotation", () => {
  it("ne garde que les plus récentes", () => {
    const cible = mkdtempSync(join(tmpdir(), "farmsim-rot-"));
    for (const jour of ["01", "02", "03", "04", "05"]) {
      writeFileSync(join(cible, `farmsim-2026-01-${jour}T000000Z.db`), "x");
    }
    const r = élaguer(cible, 3);
    assert.equal(r.gardées, 3);
    assert.deepEqual(readdirSync(cible).sort(), [
      "farmsim-2026-01-03T000000Z.db",
      "farmsim-2026-01-04T000000Z.db",
      "farmsim-2026-01-05T000000Z.db",
    ]);
    rmSync(cible, { recursive: true, force: true });
  });

  it("compte chaque étiquette à part", () => {
    // Une journée à cinq déploiements ne doit pas chasser les quotidiennes,
    // et les sauvegardes étiquetées ne doivent pas s'accumuler sans fin.
    const cible = mkdtempSync(join(tmpdir(), "farmsim-etiq-"));
    for (const jour of ["01", "02", "03", "04"]) {
      writeFileSync(join(cible, `farmsim-2026-01-${jour}T000000Z.db`), "x");
      writeFileSync(join(cible, `farmsim-2026-01-${jour}T010000Z-avant-deploi.db`), "x");
    }
    const r = élaguer(cible, 2);
    const restants = readdirSync(cible).sort();
    assert.equal(r.gardées, 4, "deux de chaque groupe");
    assert.deepEqual(restants, [
      "farmsim-2026-01-03T000000Z.db",
      "farmsim-2026-01-03T010000Z-avant-deploi.db",
      "farmsim-2026-01-04T000000Z.db",
      "farmsim-2026-01-04T010000Z-avant-deploi.db",
    ]);
    rmSync(cible, { recursive: true, force: true });
  });

  it("range les sauvegardes dans l’ordre chronologique par leur nom", () => {
    const tôt = horodatage(new Date("2026-01-02T03:04:05.678Z"));
    const tard = horodatage(new Date("2026-11-30T23:59:59.000Z"));
    assert.ok(tôt < tard, `${tôt} devrait précéder ${tard}`);
    assert.match(tôt, /^\d{4}-\d{2}-\d{2}T\d{6}Z$/);
  });
});

describe("restauration", () => {
  it("rend les données après une perte totale", () => {
    const coffre = mkdtempSync(join(tmpdir(), "farmsim-coffre-"));
    const r = sauvegarder({ source: base, dossier: coffre, garder: 5 });
    const avant = r.lignes.User;

    // La catastrophe : le volume est perdu.
    rmSync(base, { force: true });
    rmSync(`${base}-wal`, { force: true });
    rmSync(`${base}-shm`, { force: true });
    assert.throws(() => statSync(base));

    // La restauration, telle que la fait `farmsim-restore.sh` : on remet le
    // fichier en place, sans journal résiduel.
    copyFileSync(r.fichier, base);

    const db = new DatabaseSync(base, { readOnly: true });
    const après = Number(db.prepare('SELECT COUNT(*) AS n FROM "User"').get().n);
    const crd = Number(db.prepare('SELECT crd FROM "User" WHERE id = 7').get().crd);
    db.close();
    assert.equal(après, avant, "toutes les lignes doivent être revenues");
    assert.equal(crd, 700, "et leur contenu avec");
    rmSync(coffre, { recursive: true, force: true });
  });
});

/**
 * L'enveloppe shell, exécutée pour de vrai.
 *
 * Le premier lancement en production a échoué sur `ÉTIQUETTE=avant-deploi:
 * command not found` : un nom de variable shell accentué. Bash n'accepte que
 * `[A-Za-z_][A-Za-z0-9_]*`, si bien que la ligne n'était pas une affectation
 * mais une commande inexistante.
 *
 * Rien ne pouvait l'attraper avant : `bash -n` la trouve syntaxiquement
 * valide, et relire un script ne dit pas ce que bash en comprendra. La seule
 * façon de le savoir est de **l'exécuter**. On lui donne donc un faux
 * `docker` : le script déroule ses variables, ses contrôles et sa commande, et
 * la moindre ligne qui n'est pas ce qu'on croit le fait tomber sous `set -e`.
 */
describe("scripts shell", () => {
  /** Un dossier contenant un `docker` de pacotille, à mettre en tête du PATH. */
  function fauxDocker(journal) {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-faux-"));
    const chemin = join(bac, "docker");
    writeFileSync(
      chemin,
      [
        "#!/usr/bin/env bash",
        `echo "$@" >> ${JSON.stringify(journal)}`,
        // `inspect -f` sert deux questions : le volume monté sur /data, et
        // l'image. On répond à chacune ce que le script attend.
        'if [[ "$1" == "inspect" ]]; then',
        '  if [[ "$*" == *Destination* ]]; then echo "farmsim-data"; else echo "farmsim-farmsim"; fi',
        "  exit 0",
        "fi",
        "exit 0",
        "",
      ].join("\n"),
    );
    chmodSync(chemin, 0o755);
    return bac;
  }

  it("se déroule en entier, étiquette comprise", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-shell-"));
    const journal = join(bac, "appels.txt");
    const faux = fauxDocker(journal);
    try {
      execFileSync("bash", [join(SCRIPTS, "farmsim-backup.sh"), "avant-deploi"], {
        env: { ...process.env, PATH: `${faux}:${process.env.PATH}`, FARMSIM_BACKUP_DIR: bac },
        stdio: "pipe",
      });
      const appels = readFileSync(journal, "utf8");
      assert.match(appels, /run --rm/, "le script doit avoir lancé le conteneur de sauvegarde");
      assert.match(
        appels,
        /FARMSIM_BACKUP_LABEL=avant-deploi/,
        "et lui avoir transmis l’étiquette reçue en argument",
      );
      assert.match(appels, /farmsim-data:\/data/, "avec le volume lu sur le conteneur");
    } finally {
      rmSync(bac, { recursive: true, force: true });
      rmSync(faux, { recursive: true, force: true });
    }
  });

  it("se déroule aussi sans étiquette", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-shell2-"));
    const journal = join(bac, "appels.txt");
    const faux = fauxDocker(journal);
    try {
      execFileSync("bash", [join(SCRIPTS, "farmsim-backup.sh")], {
        env: { ...process.env, PATH: `${faux}:${process.env.PATH}`, FARMSIM_BACKUP_DIR: bac },
        stdio: "pipe",
      });
      assert.match(readFileSync(journal, "utf8"), /FARMSIM_BACKUP_LABEL=/);
    } finally {
      rmSync(bac, { recursive: true, force: true });
      rmSync(faux, { recursive: true, force: true });
    }
  });

  it("liste les sauvegardes sans rien restaurer quand on l’appelle sans argument", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-shell3-"));
    const journal = join(bac, "appels.txt");
    const faux = fauxDocker(journal);
    try {
      const sortie = execFileSync("bash", [join(SCRIPTS, "farmsim-restore.sh")], {
        env: { ...process.env, PATH: `${faux}:${process.env.PATH}`, FARMSIM_BACKUP_DIR: bac },
        encoding: "utf8",
      });
      assert.match(sortie, /Sauvegardes disponibles/);
      // Le point capital : sans argument, il ne doit toucher à rien.
      assert.doesNotMatch(readFileSync(journal, "utf8"), /compose|run --rm/);
    } finally {
      rmSync(bac, { recursive: true, force: true });
      rmSync(faux, { recursive: true, force: true });
    }
  });

  it("n’emploie que des noms de variables que bash accepte", () => {
    // Le garde-fou direct, en plus de l'exécution : un nom accentué passe le
    // contrôle de syntaxe et ne se voit qu'à l'usage, parfois en production.
    for (const nom of ["farmsim-backup.sh", "farmsim-restore.sh", "farmsim-purge-essais.sh", "vps-deploy.sh"]) {
      const source = readFileSync(join(SCRIPTS, nom), "utf8");
      const fautifs = source
        .split("\n")
        .map((l, i) => [i + 1, l])
        .filter(([, l]) => /^\s*[A-Za-z_][^\s=]*=/.test(l) && !/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(l))
        .map(([n, l]) => `${nom}:${n} ${l.trim()}`);
      assert.deepEqual(fautifs, []);
    }
  });
});

/**
 * Le ménage des comptes d'essai.
 *
 * `POST /auth/demo` attribue une parcelle définitivement, et rien ne la
 * reprend — alors que le bouton qui l'appelle promet « effacée quand vous
 * partez ». Ce script rend la terre. Il touche à des données de production, et
 * la seule chose qui compte vraiment est ce qu'il **ne** doit **pas** faire :
 * effleurer un vrai joueur, ou détruire une parcelle du monde.
 */
describe("purge des comptes d’essai", () => {
  /** Un monde miniature : deux vrais joueurs, trois comptes d'essai. */
  function fabriquerMonde(chemin) {
    const db = new DatabaseSync(chemin);
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT, displayName TEXT, isNpc INTEGER DEFAULT 0, lastSeenAt INTEGER);
      CREATE TABLE "Farm" (id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT);
      CREATE TABLE "Parcel" (id TEXT PRIMARY KEY, farmId TEXT REFERENCES "Farm"(id) ON DELETE SET NULL);
      CREATE TABLE "Building" (id TEXT PRIMARY KEY, parcelId TEXT NOT NULL REFERENCES "Parcel"(id) ON DELETE CASCADE);
      CREATE TABLE "ParcelCell" (
        id TEXT PRIMARY KEY, parcelId TEXT NOT NULL REFERENCES "Parcel"(id) ON DELETE CASCADE,
        kind TEXT DEFAULT 'EMPTY', crop TEXT, fieldStage TEXT DEFAULT 'EMPTY',
        plantedAt INTEGER, readyAt INTEGER, fertilizedPasses INTEGER DEFAULT 0,
        weedsControlled INTEGER DEFAULT 0, harvestsSincePlow INTEGER DEFAULT 0,
        residuePasses INTEGER DEFAULT 0, hasStubble INTEGER DEFAULT 0,
        directSeeded INTEGER DEFAULT 0, lastCrop TEXT, cropStreak INTEGER DEFAULT 0,
        strawTons REAL DEFAULT 0, baleCount INTEGER DEFAULT 0,
        buildingId TEXT REFERENCES "Building"(id) ON DELETE SET NULL, machineId TEXT
      );
      CREATE TABLE "Machine" (id TEXT PRIMARY KEY, farmId TEXT NOT NULL REFERENCES "Farm"(id) ON DELETE RESTRICT);
      CREATE TABLE "InventoryItem" (id TEXT PRIMARY KEY, farmId TEXT NOT NULL REFERENCES "Farm"(id) ON DELETE RESTRICT);
    `);
    const gens = [
      ["vrai1", "jean@exemple.fr", 0],
      ["vrai2", "marie@exemple.fr", 0],
      ["npc1", "npc.x@farmsim.npc", 1],
      ["ess1", "essai-aaa@essai.invalid", 0],
      ["ess2", "essai-bbb@essai.invalid", 0],
      ["ess3", "essai-ccc@essai.invalid", 0],
    ];
    for (const [id, email, npc] of gens) {
      db.prepare('INSERT INTO "User" (id, email, displayName, isNpc, lastSeenAt) VALUES (?,?,?,?,?)').run(
        id,
        email,
        id,
        npc,
        Date.now(),
      );
      db.prepare('INSERT INTO "Farm" (id, userId) VALUES (?,?)').run(`f-${id}`, id);
      db.prepare('INSERT INTO "Parcel" (id, farmId) VALUES (?,?)').run(`p-${id}`, `f-${id}`);
      db.prepare('INSERT INTO "Machine" (id, farmId) VALUES (?,?)').run(`m-${id}`, `f-${id}`);
      db.prepare('INSERT INTO "InventoryItem" (id, farmId) VALUES (?,?)').run(`i-${id}`, `f-${id}`);
      db.prepare('INSERT INTO "Building" (id, parcelId) VALUES (?,?)').run(`b-${id}`, `p-${id}`);
      db.prepare(
        'INSERT INTO "ParcelCell" (id, parcelId, kind, crop, fieldStage, buildingId) VALUES (?,?,?,?,?,?)',
      ).run(`c-${id}`, `p-${id}`, "BUILDING", "WHEAT", "GROWING", `b-${id}`);
    }
    // Deux parcelles jamais attribuées.
    db.prepare('INSERT INTO "Parcel" (id, farmId) VALUES (?, NULL)').run("p-libre1");
    db.prepare('INSERT INTO "Parcel" (id, farmId) VALUES (?, NULL)').run("p-libre2");
    db.close();
  }

  it("ne supprime rien tant qu’on ne le lui demande pas explicitement", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-purge-"));
    const chemin = join(bac, "monde.db");
    fabriquerMonde(chemin);
    const r = purgerEssais(chemin);
    assert.equal(r.comptes, 3, "il doit voir les trois comptes d’essai");
    assert.equal(r.parcelles, 3);
    assert.equal(terreLibre(chemin).libres, 2, "et n’avoir rien libéré");
    rmSync(bac, { recursive: true, force: true });
  });

  it("rend la terre sans jamais détruire une parcelle", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-purge2-"));
    const chemin = join(bac, "monde.db");
    fabriquerMonde(chemin);
    const avant = terreLibre(chemin);
    purgerEssais(chemin, { vraiment: true });
    const après = terreLibre(chemin);
    assert.equal(après.total, avant.total, "le monde garde le même nombre de parcelles");
    assert.equal(après.libres, 5, "les trois parcelles d’essai reviennent au pot");
    rmSync(bac, { recursive: true, force: true });
  });

  it("n’effleure ni les vrais joueurs ni les fermes voisines", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-purge3-"));
    const chemin = join(bac, "monde.db");
    fabriquerMonde(chemin);
    purgerEssais(chemin, { vraiment: true });
    const db = new DatabaseSync(chemin, { readOnly: true });
    const n = (s) => Number(db.prepare(s).get().n);
    assert.equal(n(`SELECT COUNT(*) n FROM "User" WHERE id IN ('vrai1','vrai2','npc1')`), 3);
    assert.equal(n(`SELECT COUNT(*) n FROM "Farm" WHERE userId = 'vrai1'`), 1);
    assert.equal(n(`SELECT COUNT(*) n FROM "Machine" WHERE farmId = 'f-vrai1'`), 1);
    assert.equal(n(`SELECT COUNT(*) n FROM "Building" WHERE parcelId = 'p-vrai1'`), 1);
    assert.equal(n(`SELECT COUNT(*) n FROM "User" WHERE email LIKE 'essai-%'`), 0);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0, "aucune clé orpheline");
    db.close();
    rmSync(bac, { recursive: true, force: true });
  });

  it("rend une terre nue, et non un champ à moitié semé", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-purge4-"));
    const chemin = join(bac, "monde.db");
    fabriquerMonde(chemin);
    purgerEssais(chemin, { vraiment: true });
    const db = new DatabaseSync(chemin, { readOnly: true });
    // Le prochain arrivant ne doit pas hériter des bâtiments ni des cultures
    // du joueur d'essai. C'est le piège de `Parcel → Farm ON DELETE SET NULL` :
    // la parcelle se libère, mais garde tout son contenu.
    const sales = Number(
      db
        .prepare(
          `SELECT COUNT(*) n FROM "ParcelCell" c JOIN "Parcel" p ON p.id = c.parcelId
           WHERE p.farmId IS NULL AND (c.kind != 'EMPTY' OR c.crop IS NOT NULL)`,
        )
        .get().n,
    );
    assert.equal(sales, 0, "toute terre libre doit être vierge");
    assert.equal(Number(db.prepare(`SELECT COUNT(*) n FROM "Building"`).get().n), 3, "seuls les 3 bâtiments des comptes gardés restent");
    db.close();
    rmSync(bac, { recursive: true, force: true });
  });

  it("épargne les comptes d’essai encore récents quand on le demande", () => {
    const bac = mkdtempSync(join(tmpdir(), "farmsim-purge5-"));
    const chemin = join(bac, "monde.db");
    fabriquerMonde(chemin);
    // Tous ont été vus à l'instant : avec un seuil de 3 jours, aucun ne part.
    const r = purgerEssais(chemin, { vraiment: true, jours: 3 });
    assert.equal(r.comptes, 0);
    assert.equal(terreLibre(chemin).libres, 2);
    rmSync(bac, { recursive: true, force: true });
  });
});
