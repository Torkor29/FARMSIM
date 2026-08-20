/**
 * Une base PostgreSQL jetable, par suite de tests.
 *
 * Les suites d'intégration créaient chacune un fichier SQLite dans un dossier
 * temporaire. Le jeu ayant changé de base, elles doivent l'éprouver sur celle
 * qu'il utilisera vraiment : une suite verte sur SQLite ne prouverait plus rien
 * de ce qui tourne en production — les types diffèrent (les dates, les
 * booléens), les contraintes aussi.
 *
 * Chaque suite obtient sa propre base, créée et détruite autour d'elle : deux
 * suites qui tournent l'une après l'autre ne se marchent pas dessus, et il ne
 * reste rien derrière.
 *
 * `FARMSIM_TEST_PG` donne le serveur à utiliser. Par défaut on vise une
 * installation locale sur le port standard ; l'intégration continue en fournit
 * une dans un conteneur.
 */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));

/** Serveur d'accueil : c'est là qu'on crée et détruit les bases jetables. */
const ADMIN =
  process.env.FARMSIM_TEST_PG ?? "postgresql://farmsim:farmsim-local@127.0.0.1:5432/postgres";

function urlPour(base: string): string {
  const u = new URL(ADMIN);
  u.pathname = `/${base}`;
  return u.toString();
}

function admin(sql: string): void {
  execFileSync("psql", [ADMIN, "-v", "ON_ERROR_STOP=1", "-q", "-c", sql], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

export type BaseTest = {
  /** À passer au serveur comme `DATABASE_URL`. */
  url: string;
  nom: string;
};

/**
 * Le serveur répond-il ? Et si non, le dire une fois, clairement.
 *
 * Sans ce contrôle, un PostgreSQL éteint donnait quarante lignes de « test did
 * not finish before its parent and was cancelled » : le vrai message, une
 * connexion refusée, était noyé au milieu. On perd dix minutes à chercher un
 * bogue dans le jeu avant de comprendre qu'aucune base ne tourne.
 */
function exigerServeur(): void {
  try {
    execFileSync("psql", [ADMIN, "-v", "ON_ERROR_STOP=1", "-tAc", "SELECT 1"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
  } catch {
    throw new Error(
      `PostgreSQL ne répond pas sur ${ADMIN.replace(/:[^:@/]*@/, ":***@")}.\n` +
        "Les suites d'intégration ont besoin d'une vraie base depuis que le jeu\n" +
        "a quitté SQLite. Le plus court, sans rien installer :\n\n" +
        "  docker run -d --name farmsim-pg -p 5432:5432 \\\n" +
        "    -e POSTGRES_USER=farmsim -e POSTGRES_PASSWORD=farmsim-local \\\n" +
        "    -e POSTGRES_DB=postgres postgres:16-alpine\n\n" +
        "Ou pointez FARMSIM_TEST_PG sur un serveur existant.",
    );
  }
}

/** Crée une base vide et y applique les migrations. */
export function creerBaseTest(prefixe: string): BaseTest {
  exigerServeur();
  const nom = `farmsim_${prefixe}_${randomBytes(6).toString("hex")}`;
  admin(`CREATE DATABASE "${nom}"`);
  const url = urlPour(nom);
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  return { url, nom };
}

/**
 * Détruit la base.
 *
 * `WITH (FORCE)` coupe les connexions restées ouvertes : le serveur de test
 * vient d'être tué, et une connexion orpheline suffirait à faire échouer la
 * suppression — laissant une base de plus à chaque exécution.
 */
export function supprimerBaseTest(base: BaseTest | null): void {
  if (!base) return;
  try {
    admin(`DROP DATABASE IF EXISTS "${base.nom}" WITH (FORCE)`);
  } catch {
    /* le ménage ne doit jamais faire échouer une suite qui a réussi */
  }
}
