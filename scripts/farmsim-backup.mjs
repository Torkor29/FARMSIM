/**
 * Instantané vérifié de la base FARMSIM.
 *
 * Toute la partie qui peut faire perdre des données vit ici, en Node, pour une
 * raison : c'est la seule façon de l'éprouver ailleurs que sur le serveur de
 * production. L'enveloppe Docker (`farmsim-backup.sh`) ne fait que joindre le
 * conteneur de base et appeler ce fichier ;
 * `scripts/__tests__/sauvegarde.test.mjs` le fait tourner sur une base
 * jetable, à chaque intégration.
 *
 * Trois choix méritent d'être justifiés.
 *
 * **`pg_dump` au format « custom » (`-Fc`).** Copier les fichiers de
 * PostgreSQL pendant que le jeu tourne produit une base éventuellement
 * incohérente. `pg_dump` passe par le moteur : il lit dans une transaction, à
 * un instant unique, sans interrompre les joueurs. Le format custom est
 * compressé et se restaure table par table si besoin, ce qu'un fichier SQL à
 * plat ne permet pas.
 *
 * **Vérifier en restaurant pour de bon.** Une sauvegarde jamais relue n'est
 * pas une sauvegarde, c'est une intention. On ne se contente donc pas de lire
 * le sommaire de l'archive : on la **restaure dans une base jetable**, on y
 * compte ce qui ne doit jamais être vide, et on jette la base. C'est plus
 * long, et c'est la seule vérification qui prouve ce qu'on veut savoir — que
 * le fichier est restaurable le jour où tout aura brûlé.
 *
 * **Effacer ce qui ne passe pas le contrôle.** Un fichier douteux qui porte la
 * date du jour est pire que pas de fichier : il fait croire qu'on est couvert.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

/** Tables dont le vide signale une sauvegarde inutilisable. */
const TABLES_VITALES = ["User", "Parcel", "Farm"];

/** Change la base visée dans une URL PostgreSQL, sans toucher au reste. */
function urlVers(url, base) {
  const u = new URL(url);
  u.pathname = `/${base}`;
  return u.toString();
}

function psql(url, sql) {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

/**
 * Erreur distincte : il n'y a **rien** à sauvegarder.
 *
 * Ce n'est pas la même chose qu'une sauvegarde ratée. Une base sans schéma —
 * fraîchement créée, jamais migrée — ne contient rien à perdre, et refuser de
 * continuer pour cela bloque précisément le déploiement qui va l'initialiser.
 * C'est arrivé pendant la bascule : le jeu était en panne, et le garde-fou
 * « pas de déploiement sans sauvegarde » empêchait le correctif de partir.
 *
 * Une base **migrée mais vide de joueurs**, elle, reste une erreur franche :
 * là, quelque chose a été perdu.
 */
export class RienASauvegarder extends Error {}

/** La base a-t-elle seulement ses tables ? */
function schemaPresent(url) {
  const n = psql(
    url,
    `SELECT COUNT(*) FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN (${TABLES_VITALES.map((t) => `'${t}'`).join(",")})`,
  );
  return Number(n) === TABLES_VITALES.length;
}

export function instantané(url, destination, { relire = true } = {}) {
  if (!schemaPresent(url)) {
    throw new RienASauvegarder(
      "la base n'a pas encore de schéma — rien à sauvegarder",
    );
  }
  execFileSync(
    "pg_dump",
    [url, "--format=custom", "--compress=6", "--no-owner", "--no-privileges", "--file", destination],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  if (!relire) {
    /*
     * Instantané sans relecture. **À n'employer qu'en repli**, jamais par
     * défaut, et voici l'arbitrage exact.
     *
     * Une sauvegarde jamais relue est une promesse invérifiée : c'est
     * précisément ce que la relecture existe pour empêcher, et elle reste le
     * comportement normal — la sauvegarde quotidienne, celle dont on se sert
     * un jour de catastrophe, la fait toujours.
     *
     * Mais la sauvegarde d'avant-déploiement a un autre métier : exister avant
     * qu'une migration touche aux données. La relecture y double le coût au
     * seul moment où la machine est déjà occupée à déployer — mesuré, elle a
     * tenu trente-cinq minutes sans finir et emporté le déploiement avec elle.
     * Le choix n'est donc pas « avec ou sans relecture » mais « un instantané
     * non relu, ou pas d'instantané du tout » : refuser le repli ne rend
     * personne plus sûr, ça déploie sans filet ou ça ne déploie pas.
     *
     * On vérifie au moins que l'archive est lisible et complète — `pg_restore
     * --list` lit le sommaire, ce qui attrape un fichier tronqué sans rien
     * restaurer.
     */
    const octets = statSync(destination).size;
    execFileSync("pg_restore", ["--list", destination], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    return { integrité: "sommaire lu, non restaurée", lignes: {}, octets };
  }
  return vérifier(destination, url);
}

/**
 * Restaure la sauvegarde dans une base jetable et refuse tout ce qui ne l'est
 * pas.
 *
 * `url` sert à joindre le serveur — on y crée et détruit la base d'essai.
 *
 * @returns `{ integrité, lignes, octets }`
 */
export function vérifier(fichier, url) {
  const octets = statSync(fichier).size;
  const essai = `farmsim_verif_${randomBytes(6).toString("hex")}`;
  const admin = urlVers(url, "postgres");
  psql(admin, `CREATE DATABASE "${essai}"`);
  try {
    execFileSync(
      "pg_restore",
      ["--dbname", urlVers(url, essai), "--no-owner", "--no-privileges", "--exit-on-error", fichier],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    const lignes = {};
    for (const table of TABLES_VITALES) {
      const n = Number(psql(urlVers(url, essai), `SELECT COUNT(*) FROM "${table}"`));
      if (!n) throw new Error(`Sauvegarde vide : la table ${table} ne contient aucune ligne`);
      lignes[table] = n;
    }
    return { integrité: "restaurée", lignes, octets };
  } finally {
    // `FORCE` coupe les connexions restées ouvertes : sans cela, une base
    // d'essai de plus resterait à chaque exécution.
    try {
      psql(admin, `DROP DATABASE IF EXISTS "${essai}" WITH (FORCE)`);
    } catch {
      /* le ménage ne doit pas masquer l'erreur d'origine */
    }
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
  const NOM = /^farmsim-(\d{4}-\d{2}-\d{2}T\d{6}Z)(?:-(.+))?\.dump$/;
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

export function sauvegarder({ url, dossier, garder = 14, étiquette = "", relire = true }) {
  mkdirSync(dossier, { recursive: true });
  const nom = `farmsim-${horodatage()}${étiquette ? `-${étiquette}` : ""}.dump`;
  const destination = join(dossier, nom);
  try {
    const rapport = instantané(url, destination, { relire });
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
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL manquante — impossible de savoir quoi sauvegarder");
    process.exit(2);
  }
  const dossier = process.env.FARMSIM_BACKUP_DIR ?? "/sauvegardes";
  const garder = Number(process.env.FARMSIM_BACKUP_KEEP ?? 14);
  const étiquette = process.env.FARMSIM_BACKUP_LABEL ?? "";
  try {
    // `FARMSIM_BACKUP_VERIFY=0` : instantané sans relecture. Le déploiement
    // ne s'en sert qu'en repli, après qu'une sauvegarde relue a dépassé son
    // temps — voir `scripts/vps-deploy.sh`.
    const relire = process.env.FARMSIM_BACKUP_VERIFY !== "0";
    const r = sauvegarder({ url, dossier, garder, étiquette, relire });
    const mo = (r.octets / 1024 / 1024).toFixed(2);
    const compte =
      Object.entries(r.lignes)
        .map(([t, n]) => `${t} ${n}`)
        .join(" · ") || r.integrité;
    console.log(`OK ${r.fichier}`);
    console.log(`   ${mo} Mo · ${compte}`);
    console.log(`   ${r.gardées} sauvegarde(s) conservée(s), ${r.effacées.length} effacée(s)`);
  } catch (e) {
    if (e instanceof RienASauvegarder) {
      // Code 3 : « rien à sauvegarder », que l'appelant distingue d'un échec.
      console.log(`RIEN À SAUVEGARDER — ${e.message}`);
      process.exit(3);
    }
    console.error(`ÉCHEC de la sauvegarde : ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
