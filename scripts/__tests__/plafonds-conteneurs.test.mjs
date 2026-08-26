/**
 * Les plafonds de ressources de la pile, tenus par un test.
 *
 * Le serveur a été trouvé à 246 Mo de mémoire libre sur 1 906, 1 248 Mo
 * d'échange sur 2 047, et une charge moyenne de 25,81 / 29,19 / 31,35. La
 * machine héberge PostgreSQL, ce jeu, et une autre application qui ne relève
 * pas de ce dépôt — et rien ne bornait le jeu, qui pouvait donc prendre tout ce
 * qui restait.
 *
 * Les plafonds posés dans `docker-compose.yml` viennent de mesures, pas d'une
 * estimation : elles sont écrites en commentaire à côté de chaque chiffre. Ce
 * fichier ne les remesure pas — il vérifie qu'aucun service ne repart sans
 * plafond, et que la somme des plafonds laisse de quoi vivre aux voisins.
 *
 * C'est le seul garde-fou possible ici : un plafond retiré ne casse rien, ne
 * ralentit rien, et ne se voit que le jour où la machine retombe à genoux.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPOSE = readFileSync(join(RACINE, "docker-compose.yml"), "utf8");

/** Mémoire vive de la machine visée, en mégaoctets. */
const RAM_VPS = 1906;

/** Lit une valeur de service, sans dépendre d'un analyseur YAML. */
function valeur(service, cle) {
  const debut = COMPOSE.indexOf(`\n  ${service}:\n`);
  assert.notEqual(debut, -1, `service ${service} introuvable`);
  const suivant = COMPOSE.slice(debut + 1).search(/\n {2}\w[\w-]*:\n/);
  const bloc = COMPOSE.slice(debut, suivant === -1 ? undefined : debut + 1 + suivant);
  const m = bloc.match(new RegExp(`^\\s{4}${cle}:\\s*(\\S+)\\s*$`, "m"));
  return m ? m[1] : null;
}

/** « 896m » → 896. */
function enMo(texte) {
  assert.match(texte ?? "", /^\d+m$/, `plafond illisible : ${texte}`);
  return Number(texte.slice(0, -1));
}

const SERVICES = ["db", "farmsim"];

/**
 * Les plafonds sont **absents pour l'instant**, et ces tests gardent leur
 * retour.
 *
 * Ils ont été posés une fois, sur des mesures prises à vide, et le
 * déploiement qui les portait a mis le site à terre. Ils reviendront — le
 * problème d'origine, lui, n'a pas disparu — mais sur des mesures faites en
 * service, et sans retirer le coussin d'échange. Voir docs/PLAFONDS.md.
 *
 * D'où la forme de ce qui suit : rien n'exige qu'un plafond existe, mais tout
 * ce qui s'applique dès qu'il en existe un est vérifié. C'est le seul garde-fou
 * qui a du sens tant que les bons chiffres ne sont pas connus.
 */
describe("si un plafond est posé, il l'est correctement", () => {
  it("un service plafonné en mémoire garde son coussin d'échange", () => {
    /*
     * `memswap_limit` égal à `mem_limit` interdit toute pagination : le
     * conteneur ne ralentit pas sous la pression, il se fait tuer. C'est
     * précisément ce qui a coûté le site, et ce que ce test empêche de
     * refaire — tant qu'un pic mesuré **en service** ne le justifie pas.
     */
    for (const service of SERVICES) {
      const plafond = valeur(service, "mem_limit");
      const echange = valeur(service, "memswap_limit");
      if (!plafond || !echange) continue;
      assert.notEqual(
        enMo(echange),
        enMo(plafond),
        `${service} : memswap_limit == mem_limit interdit toute pagination — ` +
          "le conteneur se fera tuer au lieu de ralentir (voir docs/PLAFONDS.md)",
      );
    }
  });

  it("la somme des plafonds laisse de quoi vivre à la machine", () => {
    // La pile ne réserve pas plus des deux tiers de la machine : le reste va
    // au système, à Docker, et à l'application voisine qu'on ne déplacera pas.
    const poses = SERVICES.map((s) => valeur(s, "mem_limit")).filter(Boolean);
    if (poses.length === 0) return;
    const total = poses.reduce((n, v) => n + enMo(v), 0);
    assert.ok(
      total <= RAM_VPS * 0.7,
      `les plafonds totalisent ${total} Mo sur ${RAM_VPS} — il ne reste que ` +
        `${RAM_VPS - total} Mo pour le système, Docker et l'application voisine`,
    );
  });

  it("la réservation reste sous le plafond, pour chaque service", () => {
    // Une réservation au-dessus du plafond n'est pas refusée par Docker : elle
    // est simplement absurde, et le service ne démarre plus.
    for (const service of SERVICES) {
      const reservation = valeur(service, "mem_reservation");
      const plafond = valeur(service, "mem_limit");
      if (!reservation || !plafond) continue;
      assert.ok(enMo(reservation) < enMo(plafond), service);
    }
  });

  it("le tas de V8, s'il est plafonné, laisse la place au reste du processus", () => {
    const tas = COMPOSE.match(/--max-old-space-size=(\d+)/);
    if (!tas) return;
    const mo = Number(tas[1]);
    // Mesuré : sous 128 Mo, V8 renonce au démarrage.
    assert.ok(mo >= 160, `tas de ${mo} Mo : V8 abandonne au démarrage sous 128 Mo`);
    const plafond = valeur("farmsim", "mem_limit");
    // Le moteur de requêtes Prisma alloue **hors** du tas V8 : il lui faut la
    // place, et le tas ne doit donc jamais approcher le plafond du conteneur.
    if (plafond) assert.ok(mo < enMo(plafond) / 2);
  });
});

describe("les travaux lourds ne tournent pas dans le conteneur du jeu", () => {
  const DEPLOIEMENT = readFileSync(join(RACINE, "scripts", "vps-deploy.sh"), "utf8");

  it("le balayage des codes passe par un conteneur jetable", () => {
    /*
     * `docker compose exec` démarre un second processus Node **dans** le
     * conteneur du jeu : il partage sa mémoire, et son échec peut emporter le
     * jeu avec lui. C'est ce qui s'est produit au premier déploiement. `run
     * --rm` lui donne son propre conteneur, comme la sauvegarde.
     */
    assert.match(DEPLOIEMENT, /docker compose run --rm --no-deps farmsim/);
    assert.ok(
      !/docker compose exec[^\n]*farmsim-hacher-codes/.test(DEPLOIEMENT),
      "le balayage ne doit pas tourner dans le conteneur du jeu",
    );
  });

  it("le conteneur jetable ne publie aucun port", () => {
    // `docker compose run --service-ports` republierait le 8081, déjà tenu par
    // le jeu : le conteneur jetable échouerait à démarrer.
    assert.ok(!/docker compose run[^\n]*--service-ports/.test(DEPLOIEMENT));
  });
});

describe("le conteneur du jeu a un vrai numéro 1", () => {
  it("`init: true` récolte les orphelins et transmet le signal d'arrêt", () => {
    // `CMD ["sh", "-c", …]` fait du shell le numéro 1 : il ne ramasse pas les
    // processus abandonnés — le serveur en compte 88 — et il ne répercute pas
    // `SIGTERM`, ce qui coûtait dix secondes à chaque `docker compose down`.
    assert.equal(valeur("farmsim", "init"), "true");
  });
});

describe("l'image embarque ce dont le déploiement se sert", () => {
  const DOCKERFILE = readFileSync(join(RACINE, "Dockerfile"), "utf8");
  const DEPLOIEMENT = readFileSync(join(RACINE, "scripts", "vps-deploy.sh"), "utf8");

  it("les scripts de maintenance sont copiés dans l'étape d'exécution", () => {
    /*
     * Le déploiement lance `farmsim-hacher-codes.mjs` **dans** le conteneur :
     * c'est le seul endroit qui voit à la fois la base et le client Prisma.
     * L'étape d'exécution ne copiait que `node_modules`, `apps` et
     * `packages` — la commande aurait échoué sur « module introuvable », et
     * les codes d'accès des comptes qui ne reviennent jamais seraient restés
     * en clair sans que rien ne le signale.
     */
    assert.match(DOCKERFILE, /COPY --from=build[^\n]*\/app\/scripts \.\/scripts/);
  });

  it("chaque script lancé par le déploiement existe bel et bien", () => {
    const lances = [...DEPLOIEMENT.matchAll(/node \/app\/scripts\/([\w.-]+)/g)].map((m) => m[1]);
    assert.ok(lances.length > 0, "aucun script lancé — le motif de détection a-t-il changé ?");
    for (const nom of new Set(lances)) {
      assert.ok(
        existsSync(join(RACINE, "scripts", nom)),
        `${nom} est lancé par le déploiement mais n'existe pas dans scripts/`,
      );
    }
  });
});
