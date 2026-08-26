/**
 * La fenêtre de déploiement appartient au déploiement.
 *
 * Le 26 août, un déploiement a expiré sans jamais atteindre
 * `docker compose up`. Le journal donne le compte exact, et aucune de ces
 * minutes n'a servi à mettre le jeu en ligne :
 *
 *     21:10:50 → 21:20:19   ménage Docker          9 min 29
 *     21:21:52 → 21:29:00   lecture des migrations 7 min 08
 *     21:29:18 → 21:44:05   sauvegarde (bornée)   14 min 47
 *     21:44:05 → 21:49:46   repli de sauvegarde    5 min 41
 *     21:49:46              Run Command Timeout
 *
 * Le disque était à **27 %**, quarante-deux gigaoctets libres : le ménage n'a
 * rien libéré. La base était **à jour, quatre migrations sur quatre** : la
 * sauvegarde ne protégeait d'aucune migration. Toutes ces précautions se sont
 * payées, aucune n'avait de risque à couvrir, et le jeu est resté sur son
 * ancienne image — celle dont on savait qu'elle se figeait.
 *
 * Un garde-fou qui empêche la mise en ligne ne garde plus rien. Ce fichier
 * tient les trois bornes qui en découlent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEPLOY = readFileSync(join(RACINE, "scripts", "vps-deploy.sh"), "utf8");
const ACTION = readFileSync(join(RACINE, ".github", "workflows", "deploy.yml"), "utf8");

describe("le ménage Docker", () => {
  it("ne tourne que si le disque se remplit", () => {
    assert.match(DEPLOY, /if \(\( occupe_pct >= 70 \)\)/);
  });

  it("reste forçable pour un dépannage", () => {
    assert.match(DEPLOY, /FARMSIM_FORCE_PRUNE/);
  });

  it("dit qu’il a été sauté, et pourquoi", () => {
    // Un journal qui saute une étape sans le dire fera soupçonner le script
    // au prochain incident.
    assert.match(DEPLOY, /Ménage Docker sauté — disque à \$\{occupe_pct\} %/);
  });
});

describe("la lecture des migrations", () => {
  it("est bornée", () => {
    // Sept minutes mesurées. Non bornée, une requête qui n'aboutit pas
    // emporte la fenêtre entière.
    assert.match(
      DEPLOY,
      /appliquees="\$\(timeout \d+ docker exec/,
      "la lecture de _prisma_migrations doit passer par `timeout`",
    );
  });
});

describe("la sauvegarde d’avant-déploiement", () => {
  it("garde son budget entier quand une migration s’annonce", () => {
    assert.match(DEPLOY, /budget=900/);
    assert.match(DEPLOY, /repli=600/);
  });

  it("est sautée quand il n’y a aucune migration à protéger", () => {
    // Attendre cinq minutes un dump qu'on a déjà décidé d'ignorer a laissé
    // un conteneur orphelin se battre avec `docker compose up`.
    assert.match(DEPLOY, /Aucune migration : instantané sauté/);
    assert.match(DEPLOY, /farmsim-backup\.sh manuel/);
  });

  it("n’emploie plus le budget de cinq minutes sans migration", () => {
    assert.doesNotMatch(DEPLOY, /budget=300/);
  });
});

describe("l’ordre reste celui qu’on croit", () => {
  it("le déploiement des conteneurs vient après les précautions, mais il vient", () => {
    const menage = DEPLOY.indexOf("Place disque avant ménage");
    const sauvegarde = DEPLOY.indexOf("Sauvegarde avant migration");
    const monte = DEPLOY.indexOf("docker compose up -d --no-deps --force-recreate farmsim");
    assert.ok(menage > 0 && sauvegarde > menage, "le ménage précède la sauvegarde");
    assert.ok(monte > sauvegarde, "la mise en ligne suit les précautions");
  });
});

describe("la session SSH", () => {
  it("laisse cinquante minutes au script", () => {
    // Quatorze minutes de pull, dix d'ouverture de session : quarante n'ont
    // pas suffi une fois le jeu prêt à démarrer.
    assert.match(ACTION, /command_timeout:\s*50m/);
  });
});

describe("le jeu redémarre, pas la base", () => {
  it("recrée farmsim sans ses dépendances", () => {
    assert.match(DEPLOY, /docker compose up -d --no-deps --force-recreate farmsim/);
  });

  it("ne force pas la recréation de PostgreSQL", () => {
    assert.doesNotMatch(
      DEPLOY,
      /docker compose up -d --force-recreate\s*$/m,
      "un `--force-recreate` nu recréerait farmsim-db",
    );
  });

  it("arrête les sauvegardes orphelines avant de monter le jeu", () => {
    const tuer = DEPLOY.lastIndexOf("tuer_sauvegardes");
    const monte = DEPLOY.indexOf("docker compose up -d --no-deps --force-recreate farmsim");
    assert.ok(tuer > 0 && tuer < monte, "les orphelines tombent avant le compose up");
  });
});
