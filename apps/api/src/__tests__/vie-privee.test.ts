/**
 * Ce qu'un joueur ne doit pas pouvoir lire d'un autre.
 *
 * ## La chaîne trouvée en auditant
 *
 * `enforceIdentity` compare le `userId` annoncé au porteur du jeton, et c'est
 * solide — mais il laisse passer sans rien vérifier les requêtes qui
 * n'annoncent **aucun** `userId`. Trois routes désignent pourtant leur joueur
 * par un simple morceau d'URL :
 *
 *   - `GET /players/:id` rend la fiche complète, **email compris** ;
 *   - `GET /players/:id/ledger` rend jusqu'à trente jours de comptabilité,
 *     chaque recette et chaque dépense avec son libellé ;
 *   - `GET /players/:id/skills` rend la progression.
 *
 * Aucune ne demandait de jeton. Et `GET /players` distribue quarante
 * identifiants à qui les demande, sans authentification non plus : de quoi
 * moissonner quarante adresses en deux requêtes, puis recommencer à mesure que
 * la liste tourne.
 *
 * ## Ce que ce fichier vérifie
 *
 * Qu'un joueur connecté ne lit rien d'un autre, et — tout aussi important —
 * qu'il lit toujours les siennes. Une fermeture qui casse l'écran des
 * compétences ou le Bureau ne serait pas une fermeture.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}`;

let serveur: ChildProcess | null = null;
let base: BaseTest | null = null;

async function appel(chemin: string, opts: { corps?: unknown; jeton?: string } = {}) {
  const r = await fetch(`${BASE}${chemin}`, {
    method: opts.corps ? "POST" : "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.jeton ? { authorization: `Bearer ${opts.jeton}` } : {}),
    },
    body: opts.corps ? JSON.stringify(opts.corps) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const texte = await r.text();
  return { statut: r.status, texte, corps: JSON.parse(texte || "{}") as Record<string, unknown> };
}

async function inscrire(nom: string) {
  const email = `${nom}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`;
  const r = await appel("/auth/register", {
    corps: { email, displayName: nom, specialization: "CEREALIER", accessCode: "ferme" },
  });
  assert.equal(r.statut, 201, r.texte);
  const b = r.corps as unknown as { token: string; player: { id: string } };
  return { jeton: b.token, id: b.player.id, email };
}

before(async () => {
  base = creerBaseTest("prive");
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

describe("la fiche d'un joueur", () => {
  it("ne livre pas son adresse à un autre joueur", async () => {
    const victime = await inscrire("Victime");
    const curieux = await inscrire("Curieux");

    const r = await appel(`/players/${victime.id}`, { jeton: curieux.jeton });
    assert.ok(
      !r.texte.includes(victime.email),
      "l'adresse de la victime est sortie du serveur — c'est la fuite qu'on ferme",
    );
    assert.ok(r.statut === 403 || r.statut === 404, `attendu un refus, reçu ${r.statut}`);
  });

  it("ne livre rien du tout sans jeton", async () => {
    const victime = await inscrire("Anonyme");
    const r = await appel(`/players/${victime.id}`);
    assert.equal(r.statut, 401, `attendu 401, reçu ${r.statut} : ${r.texte.slice(0, 200)}`);
  });

  it("laisse le joueur lire la sienne", async () => {
    // Fermer la porte sans enfermer le joueur dehors : c'est la moitié qui
    // compte, et celle qu'on casse en se pressant.
    const moi = await inscrire("Moi");
    const r = await appel(`/players/${moi.id}`, { jeton: moi.jeton });
    assert.equal(r.statut, 200, r.texte);
    assert.equal((r.corps as { email?: string }).email, moi.email);
  });
});

describe("le grand livre", () => {
  it("ne s’ouvre pas sur la comptabilité d’un autre", async () => {
    const victime = await inscrire("Comptable");
    const curieux = await inscrire("Fouineur");
    const r = await appel(`/players/${victime.id}/ledger?jours=30`, { jeton: curieux.jeton });
    assert.ok(r.statut === 403 || r.statut === 404, `attendu un refus, reçu ${r.statut}`);
  });

  it("reste ouvert au sien", async () => {
    const moi = await inscrire("MonBureau");
    const r = await appel(`/players/${moi.id}/ledger?jours=7`, { jeton: moi.jeton });
    assert.equal(r.statut, 200, r.texte);
    assert.ok(Array.isArray((r.corps as { lignes?: unknown[] }).lignes));
  });
});

describe("l’arbre de compétences", () => {
  it("ne se lit pas chez le voisin", async () => {
    const victime = await inscrire("Douee");
    const curieux = await inscrire("Voisin");
    const r = await appel(`/players/${victime.id}/skills`, { jeton: curieux.jeton });
    assert.ok(r.statut === 403 || r.statut === 404, `attendu un refus, reçu ${r.statut}`);
  });

  it("se lit chez soi", async () => {
    const moi = await inscrire("MesTalents");
    const r = await appel(`/players/${moi.id}/skills`, { jeton: moi.jeton });
    assert.equal(r.statut, 200, r.texte);
    assert.ok(Array.isArray((r.corps as { skills?: unknown[] }).skills));
  });
});

describe("l’annuaire des joueurs", () => {
  /**
   * Il reste ouvert — c'est lui qui affiche les voisins en ligne — mais il ne
   * doit rendre que ce qu'un voisin peut voir : un nom et une présence.
   */
  it("ne publie ni adresse ni argent", async () => {
    const moi = await inscrire("Annuaire");
    const r = await appel("/players", { jeton: moi.jeton });
    assert.equal(r.statut, 200);
    assert.ok(!r.texte.includes("@test.fr"), "l'annuaire laisse filtrer des adresses");
    assert.ok(!/"crd"/.test(r.texte), "l'annuaire publie la trésorerie");
  });
});
