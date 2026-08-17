/**
 * Instantané vérifié de la base FARMSIM.
 *
 * Toute la partie qui peut faire perdre des données vit ici, en Node, pour une
 * raison : c'est la seule façon de l'éprouver ailleurs que sur le serveur de
 * production. L'enveloppe Docker (`farmsim-backup.sh`) ne fait que monter le
 * volume et appeler ce fichier ; `scripts/__tests__/sauvegarde.test.mjs` le
 * fait tourner sur une base jetable, à chaque intégration.
 *
 * Deux choix méritent d'être justifiés.
 *
 * **`VACUUM INTO` plutôt qu'une copie de fichier.** Copier `farmsim.db` pendant
 * que le jeu tourne produit une base éventuellement corrompue : on peut
 * attraper une écriture à moitié faite, et en mode WAL les transactions
 * validées vivent dans un fichier `-wal` séparé qu'une copie du seul `.db`
 * laisserait derrière elle. `VACUUM INTO` passe par le moteur : il écrit un
 * fichier neuf, cohérent, WAL compris, sans interrompre les joueurs.
 *
 * **Vérifier immédiatement.** Une sauvegarde jamais relue n'est pas une
 * sauvegarde, c'est une intention. On rouvre donc le fichier produit, on lui
 * demande un `integrity_check`, et on compte ce qui ne doit jamais être vide.
 * Une sauvegarde qui échoue à ce contrôle est effacée plutôt que gardée : un
 * fichier corrompu qui porte la date du jour est pire que pas de fichier, il
 * fait croire qu'on est couvert.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/** Tables dont le vide signale une sauvegarde inutilisable. */
const TABLES_VITALES = ["User", "Parcel", "Farm"];

/**
 * Écrit un instantané cohérent de `source` dans `destination`.
 *
 * @returns le compte des lignes vitales, tel que relu **dans l'instantané**.
 */
export function instantané(source, destination) {
  const src = new DatabaseSync(source);
  try {
    // Le chemin est interpolé dans du SQL : on refuse toute apostrophe plutôt
    // que d'inventer un échappement maison sur un chemin de fichier.
    if (destination.includes("'")) throw new Error(`Chemin de destination invalide : ${destination}`);
    src.exec(`VACUUM INTO '${destination}'`);
  } finally {
    src.close();
  }
  return vérifier(destination);
}

/**
 * Relit un fichier de sauvegarde et refuse tout ce qui n'est pas restaurable.
 *
 * @returns `{ integrité, lignes, octets }`
 */
export function vérifier(fichier) {
  const octets = statSync(fichier).size;
  const db = new DatabaseSync(fichier, { readOnly: true });
  try {
    const integrité = db.prepare("PRAGMA integrity_check").get()?.integrity_check;
    if (integrité !== "ok") throw new Error(`Sauvegarde corrompue — integrity_check : ${integrité}`);

    const lignes = {};
    for (const table of TABLES_VITALES) {
      const n = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get()?.n ?? 0;
      if (n === 0) throw new Error(`Sauvegarde vide : la table ${table} ne contient aucune ligne`);
      lignes[table] = Number(n);
    }
    return { integrité, lignes, octets };
  } finally {
    db.close();
  }
}

/**
 * Ne garde que les `combien` sauvegardes les plus récentes.
 *
 * Sans ce ménage, la première panne n'est pas la perte des données mais le
 * disque plein — qui, lui, met le jeu à l'arrêt *et* empêche la sauvegarde
 * suivante.
 */
export function élaguer(dossier, combien) {
  const NOM = /^farmsim-(\d{4}-\d{2}-\d{2}T\d{6}Z)(?:-(.+))?\.db$/;
  // On élague **par étiquette**, et non toutes sauvegardes confondues. Sans
  // cela, deux choses tournaient mal : les sauvegardes étiquetées
  // (« avant-deploi ») n'entraient dans aucun compte et s'accumulaient sans
  // fin ; et si on les avait comptées avec les autres, une journée à cinq
  // déploiements aurait chassé toutes les quotidiennes du jour même.
  const parGroupe = new Map();
  for (const f of readdirSync(dossier)) {
    const m = NOM.exec(f);
    if (!m) continue;
    const groupe = m[2] ?? "";
    if (!parGroupe.has(groupe)) parGroupe.set(groupe, []);
    parGroupe.get(groupe).push(f);
  }
  let gardées = 0;
  const effacées = [];
  for (const fichiers of parGroupe.values()) {
    // Le nom commence par l'horodatage : l'ordre alphabétique est l'ordre
    // chronologique, sans avoir à interroger le système de fichiers.
    const triés = fichiers.sort().reverse();
    gardées += Math.min(triés.length, combien);
    for (const f of triés.slice(combien)) {
      rmSync(join(dossier, f), { force: true });
      effacées.push(f);
    }
  }
  return { gardées, effacées };
}

/**
 * Horodatage utilisable comme nom de fichier.
 *
 * Sans les deux-points, que Windows refuse et qu'un shell demande d'échapper ;
 * et surtout dans un ordre où le tri alphabétique **est** le tri
 * chronologique, ce dont dépend toute la rotation.
 */
export function horodatage(date = new Date()) {
  return date.toISOString().replace(/\.\d+Z$/, "Z").replace(/:/g, "");
}

export function sauvegarder({ source, dossier, garder = 14, étiquette = "" }) {
  mkdirSync(dossier, { recursive: true });
  const nom = `farmsim-${horodatage()}${étiquette ? `-${étiquette}` : ""}.db`;
  const destination = join(dossier, nom);
  try {
    const rapport = instantané(source, destination);
    const ménage = élaguer(dossier, garder);
    return { fichier: destination, ...rapport, ...ménage };
  } catch (e) {
    // Un fichier douteux ne reste pas sur le disque : il ferait croire à une
    // sauvegarde valide le jour où l'on en aura besoin.
    rmSync(destination, { force: true });
    throw e;
  }
}

const estAppeléDirectement = process.argv[1]?.endsWith("farmsim-backup.mjs");
if (estAppeléDirectement) {
  const source = process.env.FARMSIM_DB ?? "/data/farmsim.db";
  const dossier = process.env.FARMSIM_BACKUP_DIR ?? "/sauvegardes";
  const garder = Number(process.env.FARMSIM_BACKUP_KEEP ?? 14);
  const étiquette = process.env.FARMSIM_BACKUP_LABEL ?? "";
  try {
    const r = sauvegarder({ source, dossier, garder, étiquette });
    const mo = (r.octets / 1024 / 1024).toFixed(2);
    const compte = Object.entries(r.lignes)
      .map(([t, n]) => `${t} ${n}`)
      .join(" · ");
    console.log(`OK ${r.fichier}`);
    console.log(`   ${mo} Mo · ${compte}`);
    console.log(`   ${r.gardées} sauvegarde(s) conservée(s), ${r.effacées.length} effacée(s)`);
  } catch (e) {
    console.error(`ÉCHEC de la sauvegarde : ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
