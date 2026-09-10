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
    const monte = DEPLOY.indexOf("monter up -d");
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
    assert.match(DEPLOY, /setsid .*docker compose "\$@"/);
  });

  it("mais le script l’attend quand même", () => {
    // Sans `--wait`, `setsid` fork dès que le shell est déjà chef de groupe
    // et rend la main aussitôt : le script annoncerait un succès qu'il n'a
    // pas constaté, la pile se reconstruisant encore derrière.
    assert.match(DEPLOY, /setsid --wait docker compose "\$@"/);
    // Et il vérifie que `--wait` existe avant de s'en servir.
    assert.match(DEPLOY, /setsid --wait true >\/dev\/null 2>&1/);
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

/**
 * Le diagnostic doit nommer une clé refusée, pas seulement un port fermé.
 *
 * Le 28 août, tests et image verts, la session SSH a échoué en cinq
 * secondes :
 *
 *     ssh: handshake failed: ssh: unable to authenticate,
 *     attempted methods [none publickey], no supported methods remain
 *
 * Le diagnostic avait déjà déclaré « OK » : l'hôte n'était pas de l'IPv6,
 * la clé commençait par BEGIN, le port 22 acceptait le TCP. Il n'avait
 * jamais présenté la clé. C'est le cas qu'il existait pour distinguer.
 */
describe("le diagnostic SSH", () => {
  const WORKFLOW = readFileSync(join(RACINE, ".github", "workflows", "deploy.yml"), "utf8");

  it("vérifie l'utilisateur, pas seulement l'hôte et la clé", () => {
    assert.match(WORKFLOW, /UTILISATEUR: \$\{\{ secrets\.VPS_USER \}\}/);
    assert.match(WORKFLOW, /VPS_USER est vide/);
  });

  it("éprouve la clé avec OpenSSH, pas seulement sa première ligne", () => {
    assert.match(WORKFLOW, /ssh-keygen -y/);
    assert.match(WORKFLOW, /OpenSSH refuse de lire VPS_SSH_KEY/);
  });

  it("ouvre une session avant d'envoyer le script", () => {
    assert.match(WORKFLOW, /PreferredAuthentications=publickey/);
    assert.match(WORKFLOW, /le serveur a refusé la clé/);
  });

  it("déploie avec le fichier déjà accepté, pas le secret brut", () => {
    assert.match(WORKFLOW, /key_path: \$\{\{ runner\.temp \}\}\/vps_deploy_key/);
  });
});

/**
 * Le filet ne doit pas empêcher le sauvetage.
 *
 * Suite directe de la coupure : `farmsim-db` est resté à l'état `created`,
 * créé mais jamais démarré. Le déploiement suivant a buté là-dessus —
 *
 *     docker: cannot join network namespace of a non running container:
 *             container farmsim-db is created
 *     ERROR: la sauvegarde a échoué — déploiement interrompu.
 *
 * — et s'est arrêté en affirmant « rien n'a été touché, le jeu tourne
 * toujours sur l'ancienne version ». C'était faux : toutes les routes qui
 * touchent la base rendaient 500. Le garde-fou raisonnait sur un statu quo
 * sain qui n'existait plus, et il bloquait la seule chose qui réparait.
 *
 * Une base à l'arrêt n'a aucune donnée vivante qu'une migration puisse
 * abîmer, et il n'y a rien à extraire d'un conteneur qui ne répond pas.
 */
describe("la sauvegarde d’avant-déploiement, quand la base est à l’arrêt", () => {
  it("reconnaît le cas au lieu de buter dessus", () => {
    assert.match(DEPLOY, /\{\{\.State\.Status\}\}' farmsim-db/);
    assert.match(DEPLOY, /!= "running"/);
  });

  it("laisse le déploiement remonter la pile", () => {
    // La branche ne doit ni `exit` ni tenter la sauvegarde : c'est le
    // démarrage qui suit qui remet la base debout.
    const debut = DEPLOY.indexOf('!= "running"');
    const bloc = DEPLOY.slice(debut, DEPLOY.indexOf("\nelse", debut));
    assert.doesNotMatch(bloc, /exit 1/);
    assert.doesNotMatch(bloc, /farmsim-backup\.sh/);
    assert.match(bloc, /c'est le démarrage qui suit qui la remet/);
  });

  it("dit quel filet reste, avec le fichier", () => {
    // Sauter la sauvegarde sans nommer la dernière en date, ce serait
    // demander de faire confiance sans rien montrer.
    const debut = DEPLOY.indexOf('!= "running"');
    const bloc = DEPLOY.slice(debut, DEPLOY.indexOf("\nelse", debut));
    assert.match(bloc, /ls -t .*\.dump/);
  });

  it("garde le refus partout ailleurs", () => {
    // Une sauvegarde qui échoue sur une base **vivante** arrête toujours
    // tout : c'est le seul filet avant une migration.
    assert.match(DEPLOY, /ERROR: la sauvegarde a échoué — déploiement interrompu\./);
    assert.match(DEPLOY, /exit 1/);
  });
});
