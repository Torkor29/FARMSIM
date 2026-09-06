/**
 * Un mot de passe, et plus un code de casier.
 *
 * ## Ce qui n'allait pas
 *
 * « Je veux un MDP stocké dans notre base, pas de code d'accès. » Il *était*
 * stocké, et haché en bcrypt au coût 12 — mais deux choses le trahissaient.
 *
 * **Il était facultatif.** L'inscription retombait alors sur le littéral
 * `"ferme"` : tout compte créé sans le préciser s'ouvrait avec un mot que
 * n'importe qui devine. La route étant publique, il suffisait de s'inscrire
 * sans le champ pour obtenir un compte à mot de passe connu — et rien
 * n'empêchait de le faire pour quelqu'un d'autre.
 *
 * **Trois signes suffisaient.** Ce n'est pas une longueur de mot de passe.
 *
 * ## La moitié qu'il ne faut pas casser
 *
 * Le plancher ne vaut qu'à l'inscription et au changement. La **connexion**
 * accepte toujours ce qui existe : les comptes créés avant, dont celui de
 * Strea, ont des mots plus courts, et les enfermer dehors du jour au
 * lendemain serait pire que le défaut qu'on répare.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { MDP_MIN, hacherCode } from "../access-code.js";
import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8126;
const BASE = `http://127.0.0.1:${PORT}`;

let serveur: ChildProcess | null = null;
let base: BaseTest | null = null;

async function appel(chemin: string, corps?: unknown) {
  const r = await fetch(`${BASE}${chemin}`, {
    method: corps ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    body: corps ? JSON.stringify(corps) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const texte = await r.text();
  return { statut: r.status, texte };
}

function sql(requete: string) {
  execFileSync("npx", ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: base!.url },
    input: requete,
    stdio: ["pipe", "ignore", "ignore"],
  });
}

const adresse = (n: string) => `${n}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`;

before(async () => {
  base = creerBaseTest("mdp");
  serveur = spawn("npx", ["tsx", "src/main.ts"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: base.url,
      PORT: String(PORT),
      FARMSIM_SKIP_NPC: "1",
      FARMSIM_RATE_LIMIT: "off",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let journal = "";
  const noter = (b: Buffer) => {
    journal = (journal + b.toString()).slice(-3000);
  };
  serveur.stdout?.on("data", noter);
  serveur.stderr?.on("data", noter);
  const limite = Date.now() + 180_000;
  for (;;) {
    if (serveur.exitCode !== null) throw new Error(`serveur arrêté :\n${journal}`);
    try {
      if ((await fetch(`${BASE}/health`)).ok) break;
    } catch {
      /* pas encore */
    }
    if (Date.now() > limite) throw new Error(`l'API n'a pas démarré :\n${journal}`);
    await new Promise((r) => setTimeout(r, 500));
  }
});

after(() => {
  if (serveur?.pid) {
    try {
      process.kill(-serveur.pid, "SIGKILL");
    } catch {
      /* déjà parti */
    }
  }
  supprimerBaseTest(base);
});

describe("l’inscription", () => {
  /**
   * Le défaut central. Sans mot de passe, le compte prenait « ferme » — et
   * la route est publique.
   */
  it("refuse un compte sans mot de passe", async () => {
    const r = await appel("/auth/register", {
      email: adresse("sans"),
      displayName: "SansMot",
      specialization: "CEREALIER",
    });
    assert.equal(r.statut, 400, `compte créé sans mot de passe : ${r.texte.slice(0, 200)}`);
  });

  it("n’ouvre plus rien avec « ferme »", async () => {
    // La preuve par l'usage : on crée un compte en règle, puis on essaie le
    // mot qui servait de repli. Il ne doit ouvrir aucune porte.
    const email = adresse("repli");
    const cree = await appel("/auth/register", {
      email,
      displayName: "Repli",
      specialization: "CEREALIER",
      accessCode: "un-vrai-mot-de-passe",
    });
    assert.equal(cree.statut, 201, cree.texte);

    const essai = await appel("/auth/login", { email, accessCode: "ferme" });
    assert.notEqual(essai.statut, 200, "« ferme » ouvre encore un compte");
  });

  it("refuse un mot trop court", async () => {
    const r = await appel("/auth/register", {
      email: adresse("court"),
      displayName: "Court",
      specialization: "CEREALIER",
      accessCode: "abc",
    });
    assert.equal(r.statut, 400, `trois signes acceptés : ${r.texte.slice(0, 200)}`);
    assert.ok(MDP_MIN >= 8, `plancher à ${MDP_MIN}, trop bas pour un mot de passe`);
  });

  it("accepte un mot de passe en règle, et laisse se connecter avec", async () => {
    const email = adresse("regle");
    const mdp = "sillon-2026";
    assert.equal(
      (
        await appel("/auth/register", {
          email,
          displayName: "EnRegle",
          specialization: "CEREALIER",
          accessCode: mdp,
        })
      ).statut,
      201,
    );
    assert.equal((await appel("/auth/login", { email, accessCode: mdp })).statut, 200);
    assert.notEqual((await appel("/auth/login", { email, accessCode: "autre-chose" })).statut, 200);
  });
});

describe("les comptes d’avant", () => {
  /**
   * La moitié qu'il ne faut pas casser. Strea et les autres ont des mots plus
   * courts que le nouveau plancher : la connexion doit continuer de les
   * accepter, sans quoi la correction met tout le monde dehors.
   */
  it("se connectent toujours, même avec un mot trop court pour aujourd’hui", async () => {
    const email = adresse("ancien");
    // On crée en règle, puis on remet à la main une empreinte de mot court —
    // exactement ce qu'un compte d'avant porte en base.
    assert.equal(
      (
        await appel("/auth/register", {
          email,
          displayName: "Ancien",
          specialization: "CEREALIER",
          accessCode: "provisoire-long",
        })
      ).statut,
      201,
    );
    const court = await hacherCode("ferme");
    sql(`UPDATE "User" SET "accessCode" = '${court}' WHERE email = '${email}';`);

    const r = await appel("/auth/login", { email, accessCode: "ferme" });
    assert.equal(r.statut, 200, `un compte d'avant est enfermé dehors : ${r.texte.slice(0, 200)}`);
  });
});

describe("ce qui est stocké", () => {
  it("n’est jamais le mot lui-même", async () => {
    const email = adresse("stock");
    const mdp = "jachere-du-nord";
    assert.equal(
      (
        await appel("/auth/register", {
          email,
          displayName: "Stock",
          specialization: "CEREALIER",
          accessCode: mdp,
        })
      ).statut,
      201,
    );
    // On relit la colonne : elle doit porter une empreinte bcrypt, et pas une
    // trace du mot. C'est le sens de « stocké dans notre base » — stocké,
    // mais illisible.
    const empreinte = execFileSync(
      "psql",
      [base!.url, "-tAc", `SELECT "accessCode" FROM "User" WHERE email = '${email}';`],
      { encoding: "utf8" },
    ).trim();
    assert.ok(!empreinte.includes(mdp), "le mot de passe se lit en clair dans la base");
    assert.match(empreinte, /^\$2[aby]\$12\$/, `empreinte inattendue : ${empreinte.slice(0, 12)}`);
  });
});
