/**
 * Une transaction ne doit pas aller chercher une seconde connexion.
 *
 * ## Le défaut que cette suite reproduit
 *
 * Signalé en jouant : « quand on plante ça bug, il n'y a rien qui se fait,
 * "chantier en cours", et du coup la case ne change pas du tout d'état ».
 *
 * Le semis ouvre une transaction interactive — elle tient une connexion tout
 * du long. À l'intérieur, `applyWearToMachine` lisait le savoir-faire du
 * joueur et les compétences de son équipe **sur le client global**, ce qui
 * demande une *deuxième* connexion au même pool. Quand le pool n'en a plus de
 * libre, cette lecture attend une connexion que seule la fin de la
 * transaction libérerait, et la transaction attend la lecture. Personne ne
 * cède.
 *
 * La suite s'annulait alors **après** avoir réservé les cases : le chantier
 * restait ouvert, la case gardait son verrou, et le joueur qui relançait
 * s'entendait répondre « chantier en cours ». Rien ne poussait, et rien
 * n'expliquait pourquoi.
 *
 * ## Comment on le rend certain
 *
 * En production, il fallait de la charge pour épuiser le pool — d'où un défaut
 * qui apparaît sur le serveur et jamais en test. Ici on force
 * `connection_limit=1` : la deuxième connexion n'existe pas, l'étreinte est
 * garantie, et le semis échouait à tous les coups.
 *
 * Le serveur de cette suite est donc démarré à part, avec sa propre base et
 * cette limite — il ne peut pas partager celui d'`api.test.ts`.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import { currentSeason, canSowInSeason, PLANTING_WINDOW, type CropCode } from "@farmsim/shared";

import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}`;

let serveur: ChildProcess | null = null;
let base: BaseTest | null = null;

async function appel(
  chemin: string,
  opts: { methode?: string; corps?: unknown; jeton?: string } = {},
) {
  const r = await fetch(`${BASE}${chemin}`, {
    method: opts.methode ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts.jeton ? { authorization: `Bearer ${opts.jeton}` } : {}),
    },
    body: opts.corps ? JSON.stringify(opts.corps) : undefined,
    // Sans plafond, le test *pend* au lieu d'échouer : c'est exactement le
    // symptôme, et un test qui pend ne dit rien à personne.
    signal: AbortSignal.timeout(45_000),
  });
  return { statut: r.status, corps: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * Un joueur installé sur sa terre, avec de quoi payer ses semences.
 *
 * S'inscrire ne suffit pas : la ferme naît quand on revendique une parcelle.
 * Sans cette étape, `/auth/me` ne rend aucune ferme et le test échoue avant
 * d'avoir rien mesuré.
 */
async function joueurInstalle(nom: string) {
  const inscription = await appel("/auth/register", {
    methode: "POST",
    corps: {
      email: `${nom}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`,
      displayName: nom,
      specialization: "CEREALIER",
      accessCode: "ferme",
    },
  });
  assert.equal(inscription.statut, 201, JSON.stringify(inscription.corps));
  const moi = inscription.corps as unknown as { token: string; player: { id: string } };
  const jeton = moi.token;
  const userId = moi.player.id;

  const monde = await appel("/world/AUR");
  const regions = (
    monde.corps as unknown as { regions: { parcels: { id: string; taken: boolean }[] }[] }
  ).regions;
  let parcelId = "";
  for (const r of regions) {
    const libre = (r.parcels ?? []).find((c) => !c.taken);
    if (libre) {
      parcelId = libre.id;
      break;
    }
  }
  assert.ok(parcelId, "il faut une parcelle libre");
  await appel("/world/claim", {
    methode: "POST",
    corps: { userId, specialization: "CEREALIER", parcelId },
    jeton,
  });
  await appel("/dev/grant", { methode: "POST", corps: { userId, crd: 50000 }, jeton });

  const me = await appel("/auth/me", { jeton });
  const parcelle = (
    me.corps as unknown as { player?: { farm?: { parcels?: { id: string }[] } } }
  ).player?.farm?.parcels?.[0];
  assert.ok(parcelle, `aucune parcelle sur la ferme : ${JSON.stringify(me.corps).slice(0, 300)}`);
  return { jeton, userId, parcelle };
}

/** Les cases nues de la parcelle — celles où l'on peut semer. */
async function casesLibres(parcelId: string, jeton: string) {
  const r = await appel(`/parcels/${parcelId}`, { jeton });
  const cells = (
    r.corps as unknown as { parcel?: { cells?: { x: number; y: number; kind: string }[] } }
  ).parcel?.cells;
  assert.ok(cells, `pas de cases : ${JSON.stringify(r.corps).slice(0, 300)}`);
  return cells.filter((c) => c.kind === "EMPTY").map((c) => ({ x: c.x, y: c.y }));
}

/** L'état d'une case après coup : c'est lui qui dit si le semis a pris. */
async function casesDe(parcelId: string, jeton: string) {
  const r = await appel(`/parcels/${parcelId}`, { jeton });
  return (
    r.corps as unknown as { parcel: { cells: { x: number; y: number; crop?: string | null }[] } }
  ).parcel.cells;
}

function cropDeSaison(): CropCode {
  const saison = currentSeason("N", Date.now());
  return (Object.keys(PLANTING_WINDOW) as CropCode[]).find((c) => canSowInSeason(c, saison).ok)!;
}

before(async () => {
  base = creerBaseTest("pool");
  const url = new URL(base.url);
  // Le cœur du dispositif : une seule connexion pour tout le serveur.
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "10");

  serveur = spawn("npx", ["tsx", "src/main.ts"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: url.toString(),
      PORT: String(PORT),
      FARMSIM_DEV_TOOLS: "1",
      FARMSIM_SKIP_NPC: "1",
      FARMSIM_RATE_LIMIT: "off",
      FARMSIM_DELIVERY_MS: "0",
      FARMSIM_JOB_SPEED: "200",
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
      if ((await fetch(`${BASE}/health`)).ok) break;
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
      /* déjà parti */
    }
  }
  supprimerBaseTest(base);
});

describe("le semis, avec une seule connexion à la base", () => {
  it("sème et change l'état de la case", async () => {
    const { jeton, userId, parcelle } = await joueurInstalle("Pool");

    const cases = (await casesLibres(parcelle.id, jeton)).slice(0, 4);
    assert.ok(cases.length >= 1, "il faut au moins une case libre pour semer");

    const crop = cropDeSaison();
    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId, work: "PLANT", cells: cases, crop },
      jeton,
    });
    assert.equal(lance.statut, 201, `chantier refusé : ${JSON.stringify(lance.corps)}`);
    const job = (
      lance.corps as unknown as {
        job: { id: string; endsAt: string; cells: { x: number; y: number }[] };
      }
    ).job;

    const reste = new Date(job.endsAt).getTime() - Date.now();
    if (reste > 0) await new Promise((r) => setTimeout(r, reste + 30));

    /*
     * Le geste qui échouait.
     *
     * La route ouvre une transaction, et `applyWearToMachine` y lit le
     * savoir-faire et l'équipe. Tant que ces lectures passaient par le client
     * global, elles réclamaient une connexion que la transaction retenait
     * elle-même : le semis expirait, et la case restait comme avant.
     */
    const semis = await appel(`/parcels/${parcelle.id}/plant`, {
      methode: "POST",
      corps: { userId, cells: job.cells, jobId: job.id, crop },
      jeton,
    });
    assert.equal(semis.statut, 200, `semis refusé : ${JSON.stringify(semis.corps)}`);

    // Et surtout : la case a vraiment changé d'état. Une réponse 200 sur une
    // transaction annulée aurait laissé la terre nue.
    const semees = (await casesDe(parcelle.id, jeton)).filter((c) =>
      job.cells.some((j) => j.x === c.x && j.y === c.y),
    );
    assert.ok(
      semees.every((c) => c.crop === crop),
      `les cases devaient porter du ${crop} : ${JSON.stringify(semees)}`,
    );
  });

  it("libère ses cases : un second chantier peut repartir dessus", async () => {
    /*
     * Le symptôme tel qu'il se voyait : « chantier en cours ».
     *
     * Quand la transaction expirait, le chantier restait ouvert et gardait ses
     * cases. Le joueur relançait, et le serveur lui répondait qu'un chantier
     * les retenait — sans qu'aucun ne tourne vraiment. On vérifie donc qu'après
     * un semis mené à bien, les mêmes cases repartent au travail.
     */
    const { jeton, userId, parcelle } = await joueurInstalle("PoolDeux");
    const cases = (await casesLibres(parcelle.id, jeton)).slice(0, 2);

    const crop = cropDeSaison();
    const un = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId, work: "PLANT", cells: cases, crop },
      jeton,
    });
    assert.equal(un.statut, 201);
    const job = (un.corps as unknown as { job: { id: string; endsAt: string; cells: unknown[] } })
      .job;
    const reste = new Date(job.endsAt).getTime() - Date.now();
    if (reste > 0) await new Promise((r) => setTimeout(r, reste + 30));
    await appel(`/parcels/${parcelle.id}/plant`, {
      methode: "POST",
      corps: { userId, cells: job.cells, jobId: job.id, crop },
      jeton,
    });

    /*
     * Plus aucun chantier ne tourne.
     *
     * On interroge les chantiers plutôt que d'en ouvrir un second : celui-ci
     * demanderait un outil que la ferme de départ n'a pas forcément, et le
     * test échouerait sur le garage au lieu de mesurer le verrou. Un chantier
     * resté `RUNNING` après son travail, c'est précisément le fantôme qui
     * répond « chantier en cours » à tous les coups suivants.
     */
    const encours = await appel(`/parcels/${parcelle.id}/jobs?userId=${userId}`, { jeton });
    const jobs = (encours.corps as unknown as { jobs?: { id: string }[] }).jobs ?? [];
    assert.equal(
      jobs.length,
      0,
      `un chantier fantôme retient encore les cases : ${JSON.stringify(encours.corps)}`,
    );
  });
});
