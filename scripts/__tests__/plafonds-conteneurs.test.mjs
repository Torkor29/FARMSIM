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
import { readFileSync } from "node:fs";
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

describe("aucun conteneur ne peut affamer ses voisins", () => {
  for (const service of SERVICES) {
    it(`${service} a un plafond de mémoire et de processeur`, () => {
      assert.ok(enMo(valeur(service, "mem_limit")) > 0, `${service} : mem_limit manquant`);
      const cpus = Number(valeur(service, "cpus"));
      assert.ok(cpus > 0 && Number.isFinite(cpus), `${service} : cpus manquant`);
    });
  }

  it("la somme des plafonds laisse de quoi vivre à la machine", () => {
    /*
     * La règle : la pile ne réserve pas plus des deux tiers de la machine.
     * Le reste va au système, à Docker, et à l'application voisine — celle
     * qu'on ne déplacera pas.
     */
    const total = SERVICES.reduce((n, s) => n + enMo(valeur(s, "mem_limit")), 0);
    assert.ok(
      total <= RAM_VPS * 0.7,
      `les plafonds totalisent ${total} Mo sur ${RAM_VPS} — il ne reste que ` +
        `${RAM_VPS - total} Mo pour le système, Docker et l'application voisine`,
    );
  });

  it("le jeu n'a aucun droit à l'échange", () => {
    // Un Node qui pagine ne ralentit pas seulement : il fait exploser la
    // charge moyenne de toute la machine. Mieux vaut qu'il soit tué net et
    // relevé par `restart: unless-stopped`.
    assert.equal(valeur("farmsim", "memswap_limit"), valeur("farmsim", "mem_limit"));
  });

  it("la réservation reste sous le plafond, pour chaque service", () => {
    // Une réservation au-dessus du plafond n'est pas refusée par Docker : elle
    // est simplement absurde, et le service ne démarre plus.
    for (const service of SERVICES) {
      const reservation = valeur(service, "mem_reservation");
      if (!reservation) continue;
      assert.ok(enMo(reservation) < enMo(valeur(service, "mem_limit")), service);
    }
  });
});

describe("le jeu tient son tas, pas seulement son conteneur", () => {
  it("le tas de V8 est plafonné explicitement", () => {
    /*
     * Sans `--max-old-space-size`, Node dimensionne son tas d'après la mémoire
     * de **l'hôte**, pas d'après le plafond du conteneur. Le plafond seul ne
     * ferait donc que déplacer le problème : au lieu de paginer, le processus
     * se ferait tuer.
     */
    assert.match(COMPOSE, /NODE_OPTIONS:\s*"--max-old-space-size=(\d+)"/);
  });

  it("le tas reste au-dessus du plancher mesuré et sous le plafond du conteneur", () => {
    const tas = Number(COMPOSE.match(/--max-old-space-size=(\d+)/)[1]);
    // Mesuré : à 128 Mo, V8 renonce au démarrage. 160 laisse une marge au
    // plancher constaté sans prétendre qu'il ne bougera jamais.
    assert.ok(tas >= 160, `tas de ${tas} Mo : V8 abandonne au démarrage sous 128 Mo`);
    // Et il doit rester très en dessous du plafond du conteneur : le moteur de
    // requêtes Prisma alloue **hors** du tas V8, et il lui faut la place.
    assert.ok(tas < enMo(valeur("farmsim", "mem_limit")) / 2);
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
