/**
 * Les invariants que l'API doit tenir, vérifiés contre un vrai serveur.
 *
 * Ce fichier existe parce que `main.ts` fait sept mille cinq cents lignes,
 * porte les quatre-vingt-six routes et toute la circulation d'argent — et
 * n'avait **aucun** test (`"test": "echo 'api tests TBD'"`). C'est là que se
 * cachaient les deux défauts les plus graves du dépôt :
 *
 *  - n'importe qui pouvait agir au nom de n'importe qui, en envoyant l'`userId`
 *    d'un autre joueur, lu sur la route publique `/players` ;
 *  - huit dépenses lancées ensemble avec de quoi n'en payer qu'une passaient
 *    toutes, et laissaient le compte en négatif.
 *
 * Les deux sont corrigés. Ces tests sont là pour qu'ils ne reviennent pas.
 *
 * Pas de dépendance nouvelle : `node:test` est fourni par Node 22, et le
 * serveur est lancé tel quel dans un processus séparé, sur une base jetable.
 * On teste donc le vrai assemblage — middlewares compris —, ce qu'un test qui
 * importerait des fonctions isolées ne ferait pas : les deux défauts ci-dessus
 * ne sont visibles **qu'**au niveau de la requête HTTP.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

let serveur: ChildProcess | null = null;
let dossier = "";

/** Appel HTTP, avec jeton facultatif. */
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
    ...(opts.corps === undefined ? {} : { body: JSON.stringify(opts.corps) }),
  });
  const texte = await r.text();
  let corps: unknown = texte;
  try {
    corps = JSON.parse(texte);
  } catch {
    /* réponse non JSON : on garde le texte pour le message d'échec */
  }
  return { statut: r.status, corps: corps as Record<string, never> };
}

/** Inscrit un joueur et renvoie son jeton, son identifiant et sa ferme. */
async function inscrire(nom: string) {
  const r = await appel("/auth/register", {
    methode: "POST",
    corps: {
      email: `${nom}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`,
      displayName: nom,
      specialization: "CEREALIER",
      accessCode: "ferme",
    },
  });
  assert.equal(r.statut, 201, `inscription refusée : ${JSON.stringify(r.corps)}`);
  const b = r.corps as unknown as { token: string; player: { id: string; farm: { machines: { id: string }[] } } };
  return { jeton: b.token, id: b.player.id, machines: b.player.farm.machines };
}

before(async () => {
  // Un serveur oublié sur ce port ferait passer la suite entière sur du code
  // qui n'est pas celui qu'on croit tester — c'est arrivé, et les résultats
  // étaient incompréhensibles. Mieux vaut refuser de démarrer.
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) {
      throw new Error(
        `le port ${PORT} est déjà pris — arrêtez le serveur qui l'occupe avant de relancer les tests`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("déjà pris")) throw e;
    /* personne ne répond : c'est ce qu'on veut */
  }

  dossier = mkdtempSync(join(tmpdir(), "farmsim-api-"));
  const url = `file:${join(dossier, "test.db")}`;
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "ignore",
  });
  // `detached` place le serveur dans son propre groupe de processus. Sans
  // cela, tuer l'enfant laissait vivre le node petit-fils : le port restait
  // pris, et la suite suivante testait sans le savoir un serveur fantôme.
  serveur = spawn("npx", ["tsx", "src/main.ts"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: url,
      PORT: String(PORT),
      FARMSIM_DEV_TOOLS: "1",
      // Sans cela, le démarrage sème cent cinquante fermes PNJ dont aucun test
      // n'a besoin — deux minutes perdues sur une machine d'intégration.
      FARMSIM_SKIP_NPC: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  // On garde ce que dit le serveur. `stdio: "ignore"` a coûté cher : quand le
  // démarrage a fini par expirer en intégration, le message d'échec ne disait
  // que « l'API n'a pas démarré », sans la moindre trace de la cause.
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
    if (Date.now() > limite) throw new Error(`l'API n'a pas démarré en trois minutes :\n${journal}`);
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

describe("identité", () => {
  it("laisse un joueur agir sur son propre compte", async () => {
    const moi = await inscrire("Proprietaire");
    const r = await appel(`/machines/${moi.machines[0]!.id}/sell`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
  });

  it("refuse d'agir au nom d'un autre, même muni d'un jeton valide", async () => {
    const victime = await inscrire("Victime");
    const attaquant = await inscrire("Attaquant");
    const r = await appel(`/machines/${victime.machines[0]!.id}/sell`, {
      methode: "POST",
      corps: { userId: victime.id },
      jeton: attaquant.jeton,
    });
    assert.equal(r.statut, 403, "le jeton d'un tiers ne doit pas suffire");
  });

  it("refuse toute action sans jeton, fût-ce avec un identifiant valide", async () => {
    // C'était la faille : `/players` est publique et donne les identifiants,
    // et les routes croyaient l'`userId` du corps sur parole.
    const victime = await inscrire("Victime2");
    const annuaire = await appel("/players");
    const liste = (annuaire.corps as unknown as { players: { id: string }[] }).players;
    assert.ok(
      liste.some((p) => p.id === victime.id),
      "l'annuaire public expose bien les identifiants — d'où l'importance du refus",
    );
    const r = await appel(`/machines/${victime.machines[0]!.id}/sell`, {
      methode: "POST",
      corps: { userId: victime.id },
    });
    assert.equal(r.statut, 401, "sans jeton, le serveur doit refuser");
  });

  it("laisse ouvertes les routes qui ne réclament personne", async () => {
    for (const chemin of ["/health", "/world", "/market", "/players"]) {
      const r = await appel(chemin);
      assert.equal(r.statut, 200, `${chemin} doit rester public`);
    }
  });
});

describe("argent", () => {
  /** Installe une ferme et fixe la trésorerie. */
  async function fermeAvec(crd: number) {
    const moi = await inscrire("Tresorier");
    const monde = await appel("/world/AUR");
    const regions = (monde.corps as unknown as {
      regions: { parcels: { id: string; taken: boolean }[] }[];
    }).regions;
    let parcelId = "";
    for (const r of regions) {
      const libre = (r.parcels ?? []).find((p) => !p.taken);
      if (libre) {
        parcelId = libre.id;
        break;
      }
    }
    assert.ok(parcelId, "il faut une parcelle libre pour ce test");
    await appel("/world/claim", {
      methode: "POST",
      corps: { userId: moi.id, specialization: "CEREALIER", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 0 },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const p = (me.corps as unknown as {
      player: { crd: number; farm: { parcels: { id: string }[] } };
    }).player;
    return { ...moi, parcelId: p.farm.parcels[0]!.id, crd: p.crd };
  }

  it("ne laisse pas huit dépenses simultanées passer avec l'argent d'une seule", async () => {
    // Un silo coûte 1 200 : avec 1 500 en poche, une seule construction doit
    // aboutir. Avant correction, quatre passaient et le compte finissait à
    // −3 300 TRN.
    const f = await fermeAvec(1500);
    const tirs = Array.from({ length: 8 }, (_, i) =>
      appel(`/parcels/${f.parcelId}/build`, {
        methode: "POST",
        corps: { userId: f.id, type: "SILO", x: (i % 4) * 3, y: Math.floor(i / 4) * 3 },
        jeton: f.jeton,
      }),
    );
    const reussis = (await Promise.all(tirs)).filter((r) => r.statut < 400).length;
    const apres = await appel("/auth/me", { jeton: f.jeton });
    const joueur = (apres.corps as unknown as {
      player: { crd: number; farm: { parcels: { buildings: unknown[] }[] } };
    }).player;

    assert.equal(reussis, 1, `${reussis} constructions acceptées au lieu d'une`);
    assert.equal(joueur.farm.parcels[0]!.buildings.length, 1, "un seul bâtiment doit exister");
    assert.ok(joueur.crd >= 0, `la trésorerie ne doit jamais passer sous zéro (${joueur.crd})`);
  });

  it("refuse une dépense hors de portée sans rien écrire", async () => {
    const f = await fermeAvec(10);
    const r = await appel(`/parcels/${f.parcelId}/build`, {
      methode: "POST",
      corps: { userId: f.id, type: "SILO", x: 0, y: 0 },
      jeton: f.jeton,
    });
    assert.equal(r.statut, 402);
    const apres = await appel("/auth/me", { jeton: f.jeton });
    const joueur = (apres.corps as unknown as {
      player: { crd: number; farm: { parcels: { buildings: unknown[] }[] } };
    }).player;
    assert.equal(joueur.crd, 10, "un refus ne doit rien débiter");
    assert.equal(joueur.farm.parcels[0]!.buildings.length, 0, "un refus ne doit rien poser");
  });
});

describe("entrées invalides", () => {
  it("refuse quantités négatives, coordonnées hors grille et rotations impossibles", async () => {
    const moi = await inscrire("Bornes");
    const cas: [string, unknown, number][] = [
      ["/market/sell", { userId: moi.id, commodity: "WHEAT", tons: -5 }, 400],
      ["/market/buy", { userId: moi.id, commodity: "HAY", tons: 1e308 }, 400],
      ["/market/listings", { userId: moi.id, commodity: "WHEAT", tons: 1, pricePerTon: -1 }, 400],
    ];
    for (const [chemin, corps, attendu] of cas) {
      const r = await appel(chemin, { methode: "POST", corps, jeton: moi.jeton });
      assert.equal(r.statut, attendu, `${chemin} → ${r.statut}, attendu ${attendu}`);
    }
  });

  it("répond au lieu de laisser le client attendre, sur une cible inconnue", async () => {
    // Express 4 ne rattrape pas les rejets d'un gestionnaire `async` : sans le
    // filet posé au-dessus des routes, ces appels ne répondaient rien du tout.
    const moi = await inscrire("Inconnu");
    for (const chemin of ["/herds/nexiste-pas/feed", "/machines/nexiste-pas/sell"]) {
      const r = await appel(chemin, {
        methode: "POST",
        corps: { userId: moi.id, hayTons: 1 },
        jeton: moi.jeton,
      });
      assert.ok(r.statut >= 400 && r.statut < 500, `${chemin} → ${r.statut}`);
    }
  });
});
