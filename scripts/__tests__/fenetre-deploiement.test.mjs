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
    const monte = DEPLOY.indexOf("monter up -d --force-recreate");
    assert.ok(menage > 0 && sauvegarde > menage, "le ménage précède la sauvegarde");
    assert.ok(monte > sauvegarde, "la mise en ligne suit les précautions");
  });
});

/**
 * La recréation des conteneurs ne se laisse pas couper.
 *
 * Le 26 août à 23 h 05, la fenêtre SSH a expiré **au milieu** d'un
 * `docker compose up --force-recreate`, six minutes après la ligne
 * « Container farmsim-db Recreate ». L'état laissé derrière est le pire des
 * possibles, et personne ne pouvait le voir :
 *
 *   /api/meta/machines   200   (ne touche pas la base)
 *   /api/world           500   en 0,63 s
 *   /api/zones           500   en 0,59 s
 *   /api/auth/login      500   en 0,45 s
 *
 * Le conteneur du jeu était debout et se déclarait en bonne santé — son
 * contrôle interroge `/api/health`, qui ne touche pas la base. Pour Docker,
 * pour le veilleur, pour le portier, tout allait bien. Pour un joueur, le jeu
 * était mort : c'est très exactement l'écran « Erreur serveur » du début de
 * la soirée.
 */
describe("la recréation des conteneurs", () => {
  it("est détachée de la session SSH", () => {
    // Une session qui tombe ne doit pas pouvoir laisser la pile à moitié
    // reconstruite. `setsid` sort du groupe de processus de la session.
    assert.match(DEPLOY, /setsid docker compose "\$@"/);
  });

  it("passe par ce détachement partout où elle monte la pile", () => {
    // Un seul `docker compose up` resté nu suffirait à ramener le défaut.
    const nus = [...DEPLOY.matchAll(/^\s*docker compose up\b.*$/gm)].map((m) => m[0].trim());
    assert.deepEqual(nus, [], `un « up » n'est pas détaché : ${nus.join(" | ")}`);
  });

  it("retombe sur un appel direct là où setsid n’existe pas", () => {
    // Un déploiement qui refuserait de monter faute d'un utilitaire absent
    // serait un remède pire que le mal.
    assert.match(DEPLOY, /command -v setsid >\/dev\/null 2>&1/);
  });

  it("et le script vérifie ensuite que la base répond", () => {
    // C'est elle que la coupure a laissée en rade, et rien ensuite ne s'en
    // apercevait — le contrôle de santé du jeu ne la regarde pas.
    assert.match(DEPLOY, /==> La base répond \?/);
    assert.match(DEPLOY, /pg_isready -U/);
  });
});

describe("une base créée mais pas démarrée ne bloque plus le déploiement", () => {
  it("lit l'état du conteneur, pas seulement son existence", () => {
    // `docker inspect` réussit sur un conteneur `created`. C'est ce qui a
    // fait prendre la sauvegarde pour une base morte.
    assert.match(DEPLOY, /\.State\.Status/);
  });

  it("démarre la base au lieu de la sauvegarder", () => {
    assert.match(DEPLOY, /pas en marche/);
    assert.match(DEPLOY, /monter up -d db/);
    assert.match(DEPLOY, /sans instantané/);
  });
});

describe("la fenêtre SSH", () => {
  const WORKFLOW = readFileSync(join(RACINE, ".github", "workflows", "deploy.yml"), "utf8");

  it("laisse la place à un déploiement complet sur une machine lente", () => {
    const m = WORKFLOW.match(/command_timeout:\s*(\d+)m/);
    assert.ok(m, "command_timeout doit être déclaré");
    assert.ok(
      Number(m[1]) >= 60,
      `la fenêtre est de ${m[1]} min ; le déploiement du 26 août en a consommé 48 avant d'être coupé en pleine recréation`,
    );
  });
});
