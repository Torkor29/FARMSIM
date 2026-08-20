/**
 * Les outils de test, en production, n'appartiennent qu'aux comptes nommés.
 *
 * `FARMSIM_DEV_TOOLS=1` ouvre `/dev/grant` et `/sim/tick` à **quiconque est
 * connecté** : trésorerie illimitée, niveau au choix, cultures mûres d'un
 * clic, et le tick du monde entier au bout d'un `curl`. C'est très bien sur
 * une installation locale, et impensable sur un jeu public.
 *
 * Il fallait pourtant pouvoir tout éprouver sur le serveur en service. D'où
 * `FARMSIM_TESTERS`, une liste d'adresses. Ce fichier vérifie les deux moitiés
 * de la promesse : le compte listé y a droit, tous les autres reçoivent 404 —
 * et non 403, une route de triche ne devant pas même signaler qu'elle existe.
 *
 * Le serveur est lancé ici **sans** `FARMSIM_DEV_TOOLS`, contrairement à
 * `api.test.ts` : c'est précisément la configuration de production qu'on veut
 * mettre à l'épreuve.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 3998;
const BASE = `http://127.0.0.1:${PORT}`;
const TESTEUR = "patron@farmsim.test";

let serveur: ChildProcess | null = null;
let base: BaseTest | null = null;

async function appel(
  chemin: string,
  opts: { methode?: string; corps?: unknown; jeton?: string | null } = {},
) {
  const r = await fetch(BASE + chemin, {
    method: opts.methode ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.jeton ? { authorization: `Bearer ${opts.jeton}` } : {}),
    },
    body: opts.corps === undefined ? undefined : JSON.stringify(opts.corps),
  });
  let corps: unknown = null;
  try {
    corps = await r.json();
  } catch {
    /* certaines réponses n'ont pas de corps */
  }
  return { statut: r.status, corps };
}

async function inscrire(email: string) {
  const r = await appel("/auth/register", {
    methode: "POST",
    corps: { email, displayName: email.split("@")[0], specialization: "CEREALIER", accessCode: "ferme" },
  });
  assert.equal(r.statut, 201, `inscription refusée : ${JSON.stringify(r.corps)}`);
  const b = r.corps as { token: string; player: { id: string } };
  return { jeton: b.token, id: b.player.id };
}

before(async () => {
  base = creerBaseTest("testeurs");
  const url = base.url;
  serveur = spawn("npx", ["tsx", "src/main.ts"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: url,
      PORT: String(PORT),
      // Volontairement absent : c'est tout l'objet du fichier.
      FARMSIM_DEV_TOOLS: "",
      FARMSIM_TESTERS: `  ${TESTEUR.toUpperCase()} , `,
      FARMSIM_SKIP_NPC: "1",
      // Cette suite crée des dizaines de comptes en quelques secondes depuis
      // la même adresse : c'est le profil même que la limite de débit arrête.
      // C'est `debit.test.ts` qui l'éprouve, limite activée.
      FARMSIM_RATE_LIMIT: "off",
    },
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
  supprimerBaseTest(base);
});

describe("outils de test en production", () => {
  it("les refuse à un joueur ordinaire, sans révéler qu'ils existent", async () => {
    const quidam = await inscrire(`quidam-${Date.now()}@test.fr`);
    const grant = await appel("/dev/grant", {
      methode: "POST",
      corps: { crd: 99_000_000 },
      jeton: quidam.jeton,
    });
    assert.equal(grant.statut, 404, "un joueur ordinaire ne doit pas pouvoir se donner de l'argent");

    const tick = await appel("/sim/tick", { methode: "POST", jeton: quidam.jeton });
    assert.equal(tick.statut, 404, "ni faire vieillir le monde de tout le monde");

    const statut = await appel("/dev/status", { jeton: quidam.jeton });
    assert.deepEqual(statut.corps, { enabled: false }, "et le panneau de test doit rester caché");
  });

  it("les accorde au compte listé, quelle que soit la casse ou les espaces", async () => {
    const patron = await inscrire(TESTEUR);
    const grant = await appel("/dev/grant", {
      methode: "POST",
      corps: { crd: 5_000_000 },
      jeton: patron.jeton,
    });
    assert.equal(grant.statut, 200, `refusé : ${JSON.stringify(grant.corps)}`);

    const moi = await appel("/auth/me", { jeton: patron.jeton });
    const crd = (moi.corps as { player: { crd: number } }).player.crd;
    assert.equal(crd, 5_000_000, "la trésorerie doit avoir été posée");

    const statut = await appel("/dev/status", { jeton: patron.jeton });
    assert.deepEqual(statut.corps, { enabled: true });
  });

  it("les refuse à qui n'a pas de session du tout", async () => {
    const r = await appel("/dev/grant", { methode: "POST", corps: { crd: 1_000_000 } });
    assert.equal(r.statut, 404);
  });
});

describe("compte d'essai", () => {
  /**
   * La route est supprimée, pas éteinte.
   *
   * `POST /auth/demo` attribuait une parcelle du monde à chaque appel,
   * définitivement, sans authentification ni limite : soixante comptes en
   * 2,4 secondes, mesuré. Le monde ayant un nombre fixe de parcelles, il
   * suffisait de quelques secondes pour qu'aucun nouveau joueur ne puisse
   * plus s'installer.
   *
   * Ce test existe pour qu'elle ne revienne pas par mégarde — une route de ce
   * genre se réintroduit facilement en reprenant un ancien morceau de code.
   */
  it("n'existe plus, et ne consomme donc plus de terre", async () => {
    const r = await appel("/auth/demo", { methode: "POST" });
    assert.equal(r.statut, 404, "la route d'essai doit avoir disparu");
  });
});
