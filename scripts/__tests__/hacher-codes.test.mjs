/**
 * Le balayage des codes restés en clair.
 *
 * La migration paresseuse — hacher au prochain login réussi — laisse dehors le
 * cas qui compte le plus ici : **le compte qui ne se reconnecte jamais**. Son
 * code dort en clair, indéfiniment, et c'est exactement la ligne que quelqu'un
 * a fini par lire.
 *
 * Ce script balaie ce qui reste. Ce fichier vérifie qu'il ne perd personne :
 * hacher un code connu conserve la capacité de le vérifier, donc aucun joueur
 * n'est invalidé. Et il vérifie qu'on peut le relancer — une connexion peut
 * très bien tomber pendant qu'il tourne.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { codeCorrespond, estHache } from "../../apps/api/dist/access-code.js";
import { hacherCodesEnClair } from "../farmsim-hacher-codes.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const API = join(RACINE, "apps", "api");
const ADMIN =
  process.env.FARMSIM_TEST_PG ?? "postgresql://farmsim:farmsim-local@127.0.0.1:5432/postgres";

let nom = null;
let url = null;
/** Base en mémoire du script : on n'a besoin que de la table `User`. */
const comptes = new Map();

function psql(cible, texte) {
  return execFileSync("psql", [cible, "-v", "ON_ERROR_STOP=1", "-tA", "-c", texte], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

before(() => {
  nom = `farmsim_hachage_${randomBytes(6).toString("hex")}`;
  psql(ADMIN, `CREATE DATABASE "${nom}"`);
  const u = new URL(ADMIN);
  u.pathname = `/${nom}`;
  url = u.toString();
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: API,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
});

after(() => {
  if (nom) {
    try {
      psql(ADMIN, `DROP DATABASE IF EXISTS "${nom}" WITH (FORCE)`);
    } catch {
      /* le ménage ne fait pas échouer une suite qui a réussi */
    }
  }
});

/**
 * Un Prisma de façade.
 *
 * Le script ne se sert que de `findMany`, `updateMany` et `findUnique` sur
 * `user` : le simuler ici évite de charger un client Prisma généré et garde le
 * test rapide, sans rien lui retirer — c'est la logique de migration qu'on
 * mesure, pas la couche d'accès.
 */
const prismaFactice = {
  user: {
    findMany: async () =>
      [...comptes.values()].map((c) => ({ ...c })),
    findUnique: async ({ where }) => {
      const c = comptes.get(where.id);
      return c ? { ...c } : null;
    },
    updateMany: async ({ where, data }) => {
      const c = comptes.get(where.id);
      if (!c || (where.accessCode !== undefined && c.accessCode !== where.accessCode)) {
        return { count: 0 };
      }
      Object.assign(c, data);
      return { count: 1 };
    },
    update: async ({ where, data }) => {
      Object.assign(comptes.get(where.id), data);
      return comptes.get(where.id);
    },
  },
};

function poser(id, email, accessCode) {
  comptes.set(id, { id, email, accessCode });
}

describe("le balayage des codes en clair", () => {
  it("ne modifie rien sans --vraiment", async () => {
    comptes.clear();
    poser("u1", "un@test.fr", "code-un");
    poser("u2", "deux@test.fr", "code-deux");

    const bilan = await hacherCodesEnClair(prismaFactice, {});
    assert.equal(bilan.aMigrer, 2);
    assert.equal(bilan.migres, 0);
    assert.equal(comptes.get("u1").accessCode, "code-un", "rien ne doit avoir bougé");
  });

  it("hache tout le reste sans invalider personne", async () => {
    comptes.clear();
    poser("u1", "un@test.fr", "code-un");
    poser("u2", "deux@test.fr", "code-deux");
    // Un compte de PNJ : rien à mettre à l'abri, rien à toucher.
    poser("u3", "pnj@test.fr", "");

    const bilan = await hacherCodesEnClair(prismaFactice, { vraiment: true });
    assert.equal(bilan.migres, 2);
    assert.equal(bilan.dejaFaits, 1, "le compte sans code utilisable n'était pas à migrer");

    for (const [id, clair] of [["u1", "code-un"], ["u2", "code-deux"]]) {
      const stocke = comptes.get(id).accessCode;
      assert.ok(estHache(stocke), `${id} doit porter une empreinte`);
      assert.ok(!stocke.includes(clair));
      // Le point entier : le joueur se connectera avec le même code qu'avant.
      assert.ok(await codeCorrespond(stocke, clair), `${id} doit encore ouvrir`);
    }
    assert.equal(comptes.get("u3").accessCode, "", "le PNJ reste inutilisable");
  });

  it("se relance sans re-hacher ce qui l'est déjà", async () => {
    // Re-hacher une empreinte enfermerait le joueur dehors, définitivement :
    // le clair a disparu, il n'y a pas de retour en arrière.
    const avant = comptes.get("u1").accessCode;
    const bilan = await hacherCodesEnClair(prismaFactice, { vraiment: true });
    assert.equal(bilan.migres, 0);
    assert.equal(comptes.get("u1").accessCode, avant);
    assert.ok(await codeCorrespond(comptes.get("u1").accessCode, "code-un"));
  });

  it("laisse la ligne tranquille si une connexion l'a migrée entre-temps", async () => {
    /*
     * Le script lit, puis écrit. Entre les deux, le joueur peut se connecter
     * et déclencher la migration paresseuse. L'écriture est donc conditionnée
     * au clair encore présent — sinon on hacherait une empreinte.
     */
    comptes.clear();
    poser("u9", "course@test.fr", "code-course");

    const lecture = prismaFactice.user.findMany;
    prismaFactice.user.findMany = async () => {
      const vu = [...comptes.values()].map((c) => ({ ...c }));
      // La connexion tombe ici, juste après la lecture.
      comptes.get("u9").accessCode = "$2b$12$" + "a".repeat(53);
      return vu;
    };
    try {
      const bilan = await hacherCodesEnClair(prismaFactice, { vraiment: true });
      assert.equal(bilan.migres, 0, "la ligne déjà migrée ne doit pas être réécrite");
      assert.equal(comptes.get("u9").accessCode, "$2b$12$" + "a".repeat(53));
    } finally {
      prismaFactice.user.findMany = lecture;
    }
  });
});

describe("la table réelle accueille bien une empreinte", () => {
  it("soixante caractères tiennent dans la colonne", () => {
    // `accessCode` est un `String` sans longueur déclarée — donc `text` en
    // PostgreSQL. On le vérifie plutôt que de le supposer : une colonne
    // `varchar(32)` tronquerait l'empreinte, et personne ne se reconnecterait.
    psql(
      url,
      `INSERT INTO "User" (id,email,"displayName",specialization,"statsJson","accessCode")
       VALUES ('h1','hache@test.fr','Haché','CEREALIER','{}','$2b$12$${"a".repeat(53)}')`,
    );
    const relu = psql(url, `SELECT "accessCode" FROM "User" WHERE id='h1'`);
    assert.equal(relu.length, 60);
    assert.ok(estHache(relu));
  });
});
