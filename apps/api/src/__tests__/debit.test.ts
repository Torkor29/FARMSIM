/**
 * La limite de débit, contre un serveur réel.
 *
 * `rate-limit.test.ts` éprouve le seau ; ici on vérifie qu'il est **branché** —
 * la moitié qu'on oublie. Deux promesses : une boucle sur la connexion se fait
 * couper, et une partie normale ne rencontre jamais 429.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { BAREMES } from "../rate-limit.js";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 3997;
const BASE = `http://127.0.0.1:${PORT}`;

let serveur: ChildProcess | null = null;
let dossier = "";

before(async () => {
  dossier = mkdtempSync(join(tmpdir(), "farmsim-debit-"));
  const url = `file:${join(dossier, "test.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  serveur = spawn("npx", ["tsx", "src/main.ts"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: url, PORT: String(PORT), FARMSIM_SKIP_NPC: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let journal = "";
  const noter = (b: Buffer) => {
    journal = (journal + b.toString()).slice(-4000);
  };
  serveur.stdout?.on("data", noter);
  serveur.stderr?.on("data", noter);

  const limite = Date.now() + 180_000;
  for (;;) {
    if (serveur.exitCode !== null) {
      throw new Error(`le serveur s'est arrêté (code ${serveur.exitCode}) :\n${journal}`);
    }
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) break;
    } catch {
      /* pas encore là */
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
      serveur.kill("SIGKILL");
    }
  }
  if (dossier) rmSync(dossier, { recursive: true, force: true });
});

describe("la limite de débit est branchée", () => {
  it("coupe une boucle sur le code d'accès", async () => {
    /**
     * C'est le scénario qui motive tout le reste : un code à cinq chiffres
     * essayé en boucle. Sans limite, cent mille essais tiennent en quelques
     * minutes.
     */
    let coupe = 0;
    let dernier: Response | null = null;
    for (let i = 0; i < BAREMES.AUTH.capacite + 6; i++) {
      const r = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "personne@farmsim.test", accessCode: String(10000 + i) }),
      });
      if (r.status === 429) {
        coupe++;
        dernier = r;
      }
      await r.text();
    }
    assert.ok(coupe >= 5, `${coupe} essais coupés seulement`);
    // Le client doit savoir combien de temps attendre, pas seulement qu'il a
    // été refusé.
    assert.ok(Number(dernier?.headers.get("retry-after") ?? 0) >= 1);
  });

  it("laisse jouer normalement", async () => {
    /**
     * Trente lectures d'affilée, comme à l'ouverture de deux ou trois écrans :
     * aucune ne doit être refusée.
     */
    let refus = 0;
    for (let i = 0; i < 30; i++) {
      const r = await fetch(`${BASE}/market/prices`);
      if (r.status === 429) refus++;
      await r.text();
    }
    assert.equal(refus, 0);
  });

  it("ne coupe jamais la sonde de santé", async () => {
    let refus = 0;
    for (let i = 0; i < 200; i++) {
      const r = await fetch(`${BASE}/health`);
      if (r.status === 429) refus++;
      await r.text();
    }
    assert.equal(refus, 0);
  });
});
