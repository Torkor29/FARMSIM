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
    assert.match(DEPLOY, /if \(\( relire == 1 \)\); then budget=900; repli=600;/);
  });

  it("est réduite, et sans repli, quand il n’y a aucune migration à protéger", () => {
    assert.match(DEPLOY, /else budget=300; repli=0; fi/);
  });

  it("laisse alors le déploiement continuer plutôt que d’échouer", () => {
    // C'est l'arbitrage même : ne pas livrer est un risque, lui aussi. Le
    // journal dit comment rattraper la sauvegarde à la main.
    const bloc = DEPLOY.slice(DEPLOY.indexOf("elif (( code == 124 ))"));
    assert.match(bloc, /aucune migration à/);
    assert.match(bloc, /on déploie sans/);
    assert.match(bloc, /farmsim-backup\.sh manuel/);
    assert.match(bloc, /code=0/);
  });

  it("annonce son budget dans le journal", () => {
    // Le message précédent parlait de « sauvegarde relue » même quand la
    // relecture était désactivée : il nommait le mauvais coupable.
    assert.match(DEPLOY, /Sauvegarde avant migration \(budget \$\{budget\} s\)/);
  });
});

describe("l’ordre reste celui qu’on croit", () => {
  it("le déploiement des conteneurs vient après les précautions, mais il vient", () => {
    // Les précautions passent devant — c'est voulu, une base abîmée ne se
    // rattrape pas. Ce qui ne l'est pas, c'est qu'elles puissent tout manger.
    const menage = DEPLOY.indexOf("Place disque avant ménage");
    const sauvegarde = DEPLOY.indexOf("Sauvegarde avant migration");
    const monte = DEPLOY.indexOf("docker compose up -d");
    assert.ok(menage > 0 && sauvegarde > menage, "le ménage précède la sauvegarde");
    assert.ok(monte > sauvegarde, "la mise en ligne suit les précautions");
  });
});
