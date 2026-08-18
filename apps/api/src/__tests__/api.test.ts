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
import { DIRT_DIRTY_THRESHOLD } from "@farmsim/shared";

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
      // Le camion met douze secondes en jeu : c'est le bon délai pour un
      // joueur, une éternité dans une suite d'intégration. On ne raccourcit
      // que le compte à rebours — la caisse existe toujours, et il faut
      // toujours la rentrer pour que la marchandise entre au stock.
      FARMSIM_DELIVERY_MS: "0",
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

/**
 * Litière : le pont aller du céréalier vers l'éleveur.
 *
 * La paille était produite à la moisson, pressable et vendable depuis
 * longtemps — mais **rien ne la consommait**, alors que `forage.ts` l'annonçait
 * lui-même comme « le pont céréalier ↔ éleveur (litière) ». Ces tests tiennent
 * la route qui manquait, au niveau de la requête : ce sont les refus qui
 * comptent le plus, puisque c'est là qu'on renseigne ou qu'on égare le joueur.
 */
/**
 * Commander au négociant **et** rentrer la caisse.
 *
 * L'achat ne verse plus au silo : il pose une caisse dans la cour, et c'est
 * un second geste qui la range. Les tests qui achètent pour se servir juste
 * après doivent donc faire les deux — c'est le parcours du joueur.
 */
async function commanderEtRentrer(
  moi: { id: string; jeton: string },
  farmId: string,
  commodity: string,
  tons: number,
) {
  const achat = await appel("/market/buy", {
    methode: "POST",
    corps: { userId: moi.id, commodity, tons },
    jeton: moi.jeton,
  });
  assert.equal(achat.statut, 200, `achat refusé : ${JSON.stringify(achat.corps)}`);
  const liste = await appel(`/farms/${farmId}/supplies`, { jeton: moi.jeton });
  const caisses = (liste.corps as unknown as { supplies: { id: string }[] }).supplies;
  assert.ok(caisses.length > 0, "l'achat doit poser une caisse dans la cour");
  for (const c of caisses) {
    const r = await appel(`/supplies/${c.id}/collect`, { methode: "POST", jeton: moi.jeton });
    assert.equal(r.statut, 200, `rentrée refusée : ${JSON.stringify(r.corps)}`);
  }
}

describe("lieu de vie", () => {
  /**
   * « Je dis de rentrer mes bêtes, ça met le message mais elles rentrent pas. »
   *
   * Deux sources pour un seul fait, et elles se contredisaient :
   *
   *  - la vue et le tick lisent `housing === "OUTSIDE" || grazingUntil > now` ;
   *  - sortir le troupeau posait une fenêtre de pâture — c'est elle qui fait
   *    franchir la porte à l'écran — et rentrer ne touchait que `housing`.
   *
   * La fenêtre continuait donc de courir : le message annonçait « bêtes
   * rentrées » pendant qu'elles restaient au pré.
   *
   * Deuxième moitié du même défaut, côté panneau : `outsideCount` répond à
   * « combien tiendraient dehors ? », pas à « combien y sont ? ». Il servait
   * pourtant à écrire « 18 bêtes au pré, 1 à l'étable », qui restait affiché
   * après avoir rentré le lot.
   */
  async function eleveurAvecEnclos() {
    const moi = await inscrire("Berger");
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
    assert.ok(parcelId, "il faut une parcelle libre");
    await appel("/world/claim", {
      methode: "POST",
      corps: { userId: moi.id, specialization: "ELEVEUR", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 300_000 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const pid = (me.corps as unknown as { player: { farm: { parcels: { id: string }[] } } }).player
      .farm.parcels[0]!.id;
    await appel(`/parcels/${pid}/build`, {
      methode: "POST",
      corps: { userId: moi.id, type: "CATTLE_BARN", x: 2, y: 2, rotation: 0 },
      jeton: moi.jeton,
    });
    /**
     * L'enclos se pose sous **l'étable qui héberge le lot**, pas sous celle
     * qu'on vient de bâtir : un éleveur démarre déjà avec un bâtiment, et
     * poser l'enclos à côté du mauvais donnait une capacité nulle — le test
     * échouait sur un décor, pas sur le défaut qu'il traque.
     */
    const el0 = await appel(`/parcels/${pid}/livestock`, { jeton: moi.jeton });
    const avecLot = (el0.corps as unknown as {
      barns: { buildingId: string; herd: { id: string } | null }[];
    }).barns.find((b) => b.herd);
    assert.ok(avecLot, "il faut une étable habitée");
    const apres = await appel("/auth/me", { jeton: moi.jeton });
    const bat = (apres.corps as unknown as {
      player: {
        farm: {
          parcels: { buildings: { id: string; originX: number; originY: number }[] }[];
        };
      };
    }).player.farm.parcels[0]!.buildings.find((b) => b.id === avecLot.buildingId)!;
    // Une étable fait trois cases de haut : l'enclos se colle juste dessous.
    const enclos = await appel(`/parcels/${pid}/build`, {
      methode: "POST",
      corps: {
        userId: moi.id,
        type: "PADDOCK",
        x: bat.originX,
        y: bat.originY + 3,
        rotation: 0,
      },
      jeton: moi.jeton,
    });
    assert.equal(enclos.statut, 201, `enclos refusé : ${JSON.stringify(enclos.corps)}`);
    return { moi, pid, herdId: avecLot.herd!.id, buildingId: avecLot.buildingId };
  }

  type Etat = {
    housing: string;
    grazingUntil: number | null;
    outsideNow: number;
    paddockCapacity: number;
  };

  async function etat(
    pid: string,
    buildingId: string,
    jeton: string,
  ): Promise<Etat> {
    const el = await appel(`/parcels/${pid}/livestock`, { jeton });
    const b = (el.corps as unknown as {
      barns: {
        buildingId: string;
        paddockCapacity: number;
        outsideNow?: number;
        herd: { housing: string; grazingUntil: number | null } | null;
      }[];
    }).barns.find((x) => x.buildingId === buildingId)!;
    return {
      housing: b.herd!.housing,
      grazingUntil: b.herd!.grazingUntil,
      outsideNow: b.outsideNow ?? 0,
      paddockCapacity: b.paddockCapacity,
    };
  }

  it("rentrer le troupeau met fin à la séance de pâture", async () => {
    const { moi, pid, herdId, buildingId } = await eleveurAvecEnclos();
    const avant = await etat(pid, buildingId, moi.jeton);
    assert.ok(avant.paddockCapacity > 0, "l'enclos doit être reconnu comme attenant");

    const sortie = await appel(`/herds/${herdId}/housing`, {
      methode: "POST",
      corps: { userId: moi.id, housing: "OUTSIDE" },
      jeton: moi.jeton,
    });
    assert.equal(sortie.statut, 200, JSON.stringify(sortie.corps));
    const dehors = await etat(pid, buildingId, moi.jeton);
    assert.equal(dehors.housing, "OUTSIDE");
    assert.ok(dehors.grazingUntil, "sortir pose une fenêtre de pâture");
    assert.ok(dehors.outsideNow > 0, "des bêtes doivent être comptées au pré");

    await appel(`/herds/${herdId}/housing`, {
      methode: "POST",
      corps: { userId: moi.id, housing: "INSIDE" },
      jeton: moi.jeton,
    });
    const dedans = await etat(pid, buildingId, moi.jeton);
    assert.equal(dedans.housing, "INSIDE");
    // Le cœur du défaut : sans cette remise à zéro, la vue gardait les bêtes
    // au pré tant que la fenêtre courait, message contraire à l'appui.
    assert.equal(dedans.grazingUntil, null, "rentrer doit clore la séance");
    assert.equal(dedans.outsideNow, 0, "plus personne au pré une fois rentré");
  });

  it("distingue ce qui tiendrait dehors de ce qui y est", async () => {
    const { moi, pid, herdId, buildingId } = await eleveurAvecEnclos();
    const el = await appel(`/parcels/${pid}/livestock`, { jeton: moi.jeton });
    const b = (el.corps as unknown as {
      barns: { buildingId: string; outsideCount?: number; outsideNow?: number }[];
    }).barns.find((x) => x.buildingId === buildingId)!;
    // À l'étable : la capacité reste positive — c'est une réponse à « si je
    // les sors » — mais personne n'est dehors.
    assert.ok((b.outsideCount ?? 0) > 0, "la capacité de sortie doit rester lisible");
    assert.equal(b.outsideNow ?? 0, 0);
    void herdId;
  });
});

describe("litière", () => {
  /** Installe un éleveur, son étable et un troupeau. */
  async function eleveurAvecEtable() {
    const moi = await inscrire("Eleveur");
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
    assert.ok(parcelId, "il faut une parcelle libre");
    await appel("/world/claim", {
      methode: "POST",
      corps: { userId: moi.id, specialization: "ELEVEUR", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 300_000 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const pid = (me.corps as unknown as { player: { farm: { parcels: { id: string }[] } } }).player
      .farm.parcels[0]!.id;
    await appel(`/parcels/${pid}/build`, {
      methode: "POST",
      corps: { userId: moi.id, type: "CATTLE_BARN", x: 2, y: 2, rotation: 0 },
      jeton: moi.jeton,
    });
    const el = await appel(`/parcels/${pid}/livestock`, { jeton: moi.jeton });
    const barn = (el.corps as unknown as {
      barns: { buildingId: string; herd: { id: string } | null }[];
    }).barns[0]!;
    if (!barn.herd) {
      await appel(`/buildings/${barn.buildingId}/animals`, {
        methode: "POST",
        corps: { userId: moi.id, count: 4 },
        jeton: moi.jeton,
      });
    }
    const el2 = await appel(`/parcels/${pid}/livestock`, { jeton: moi.jeton });
    const b2 = (el2.corps as unknown as {
      barns: {
        herd: { id: string; beddingTons?: number; beddingCover?: number; beddingNeed?: number } | null;
      }[];
    }).barns[0]!;
    assert.ok(b2.herd, "l'étable doit héberger un troupeau");
    const farmId = (me.corps as unknown as { player: { farm: { id: string } } }).player.farm.id;
    return { moi, pid, farmId, herd: b2.herd! };
  }

  it("refuse de pailler sans paille, et dit où en trouver", async () => {
    const { moi, herd } = await eleveurAvecEtable();
    const r = await appel(`/herds/${herd.id}/bedding`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 409);
    // Le message doit orienter : un refus qui ne dit pas quoi faire est un
    // cul-de-sac, comme l'était « la case n'a pas de chaumes ».
    assert.match(String((r.corps as { error?: string }).error), /paille/i);
  });

  it("étale la paille achetée, et remplit la litière", async () => {
    const { moi, pid, herd, farmId } = await eleveurAvecEtable();
    // Acheter ne suffit plus : la paille arrive en caisse, il faut la rentrer.
    await commanderEtRentrer(moi, farmId, "STRAW", 4);

    const r = await appel(`/herds/${herd.id}/bedding`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    const posée = (r.corps as { tons: number }).tons;
    assert.ok(posée > 0, "il faut de la paille sur le sol");

    const el = await appel(`/parcels/${pid}/livestock`, { jeton: moi.jeton });
    const après = (el.corps as unknown as {
      barns: { herd: { beddingCover?: number; beddingTons?: number } | null }[];
    }).barns[0]!.herd!;
    assert.equal(après.beddingCover, 1, "la litière doit être complète après un paillage");
    assert.ok((après.beddingTons ?? 0) > 0);
  });

  it("n'accepte pas qu'un joueur paille l'étable d'un autre", async () => {
    const { herd } = await eleveurAvecEtable();
    const voisin = await inscrire("Curieux");
    const r = await appel(`/herds/${herd.id}/bedding`, {
      methode: "POST",
      corps: { userId: voisin.id },
      jeton: voisin.jeton,
    });
    assert.ok(r.statut === 403 || r.statut === 401, `${r.statut} — doit être refusé`);
  });

  it("achète du fumier : le retour du pont est ouvert", async () => {
    // `MANURE` était `purchasable: false`, ce qui fermait la moitié retour :
    // le céréalier ne pouvait pas se procurer le fumier de l'éleveur.
    const { moi } = await eleveurAvecEtable();
    const r = await appel("/market/buy", {
      methode: "POST",
      corps: { userId: moi.id, commodity: "MANURE", tons: 2 },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, `le fumier doit être achetable : ${JSON.stringify(r.corps)}`);
  });
});

describe("livraisons", () => {
  /**
   * L'achat versait la marchandise au silo dans la même milliseconde : on
   * cliquait, un chiffre changeait quelque part, et rien ne se passait à
   * l'écran. Une commande part maintenant en camion, se pose dans la cour, et
   * n'entre au stock que lorsqu'on la rentre.
   *
   * Ce qui doit rester vrai, et que ces tests tiennent :
   *
   *  - on paie à la commande, mais on ne possède rien avant de l'avoir rentrée ;
   *  - la caisse est posée sur une case libre de la parcelle ;
   *  - deux commandes ne se superposent pas, sinon un seul objet à cliquer
   *    répondrait pour deux caisses.
   */
  async function acheteur() {
    const moi = await inscrire("Client");
    const monde = await appel("/world/AUR");
    const regions = (monde.corps as unknown as {
      regions: { parcels: { id: string; taken: boolean }[] }[];
    }).regions;
    let parcelId = "";
    for (const r of regions) {
      const libre = (r.parcels ?? []).find((p) => !p.taken);
      if (libre) { parcelId = libre.id; break; }
    }
    assert.ok(parcelId, "il faut une parcelle libre");
    await appel("/world/claim", {
      methode: "POST",
      corps: { userId: moi.id, specialization: "CEREALIER", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 300_000 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const farm = (me.corps as unknown as { player: { farm: { id: string } } }).player.farm;
    return { moi, farmId: farm.id };
  }

  const stockDe = async (moi: { id: string; jeton: string }, code: string) => {
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const inv = (me.corps as unknown as {
      player: { farm: { inventory: { itemCode: string; qty: number }[] } };
    }).player.farm.inventory;
    return inv.find((i) => i.itemCode === code)?.qty ?? 0;
  };

  it("payer ne suffit pas : la marchandise reste dehors tant qu'on ne la rentre pas", async () => {
    const { moi, farmId } = await acheteur();
    const avant = await stockDe(moi, "STRAW");
    const achat = await appel("/market/buy", {
      methode: "POST",
      corps: { userId: moi.id, commodity: "STRAW", tons: 5 },
      jeton: moi.jeton,
    });
    assert.equal(achat.statut, 200, JSON.stringify(achat.corps));
    // Le cœur du changement : rien au silo, une caisse dans la cour.
    assert.equal(await stockDe(moi, "STRAW"), avant, "le stock ne bouge pas à l'achat");

    const liste = await appel(`/farms/${farmId}/supplies`, { jeton: moi.jeton });
    const caisses = (liste.corps as unknown as {
      supplies: { id: string; tons: number; x: number; y: number }[];
    }).supplies;
    assert.equal(caisses.length, 1);
    assert.equal(caisses[0]!.tons, 5);

    const r = await appel(`/supplies/${caisses[0]!.id}/collect`, {
      methode: "POST",
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    assert.equal(await stockDe(moi, "STRAW"), avant + 5, "rentrer la caisse verse au stock");
  });

  it("deux commandes ne se posent pas sur la même case", async () => {
    const { moi, farmId } = await acheteur();
    for (const t of [2, 3]) {
      await appel("/market/buy", {
        methode: "POST",
        corps: { userId: moi.id, commodity: "HAY", tons: t },
        jeton: moi.jeton,
      });
    }
    const liste = await appel(`/farms/${farmId}/supplies`, { jeton: moi.jeton });
    const caisses = (liste.corps as unknown as {
      supplies: { x: number; y: number }[];
    }).supplies;
    assert.equal(caisses.length, 2);
    const cases = new Set(caisses.map((c) => `${c.x},${c.y}`));
    assert.equal(cases.size, 2, "chaque caisse a sa case, sinon on n'en clique qu'une");
  });

  it("n'accepte pas qu'un joueur rentre la caisse d'un autre", async () => {
    const { moi, farmId } = await acheteur();
    await appel("/market/buy", {
      methode: "POST",
      corps: { userId: moi.id, commodity: "HAY", tons: 1 },
      jeton: moi.jeton,
    });
    const liste = await appel(`/farms/${farmId}/supplies`, { jeton: moi.jeton });
    const id = (liste.corps as unknown as { supplies: { id: string }[] }).supplies[0]!.id;
    const autre = await inscrire("Voisin");
    const r = await appel(`/supplies/${id}/collect`, { methode: "POST", jeton: autre.jeton });
    assert.equal(r.statut, 403);
  });
});

describe("usure au champ", () => {
  /** Installe une ferme cérealière avec une parcelle et de quoi semer. */
  async function cerealier() {
    const moi = await inscrire("Laboureur");
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
      corps: { userId: moi.id, crd: 200000 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const ferme = (me.corps as unknown as {
      player: { farm: { parcels: { id: string; gridW: number; gridH: number }[] } };
    }).player.farm;
    return { moi, parcelle: ferme.parcels[0]! };
  }

  /** Les cases semables de la parcelle — ce que vise « Tout sélectionner ». */
  async function champEntier(parcelId: string) {
    const r = await appel(`/parcels/${parcelId}`);
    const cells = (r.corps as unknown as {
      parcel: { cells: { x: number; y: number; kind: string }[] };
    }).parcel.cells;
    return cells.filter((c) => c.kind === "EMPTY").map((c) => ({ x: c.x, y: c.y }));
  }

  it("laisse le tracteur en bon état après un champ entier", async () => {
    /**
     * Le reproche d'un joueur, mesuré de bout en bout : « je lance un champ,
     * faut déjà le réparer au max ». Il avait raison — un semis de 144 cases
     * déposait 86 points de saleté pour un seuil à 25, franchir ce seuil
     * doublait l'usure, et le tracteur neuf tombait sous son seuil de blocage
     * au deuxième passage.
     *
     * Les tests de `packages/sim` fixent la formule ; celui-ci vérifie que
     * c'est bien elle qui arrive jusqu'à la base, avec la vraie route et la
     * vraie taille de parcelle.
     */
    const { moi, parcelle } = await cerealier();
    const cases = await champEntier(parcelle.id);
    // La ferme de départ occupe quelques cases ; le reste est le vrai champ.
    assert.ok(cases.length > 120, `champ trop petit pour la mesure : ${cases.length} cases`);

    const r = await appel(`/parcels/${parcelle.id}/plant`, {
      methode: "POST",
      corps: { userId: moi.id, crop: "WHEAT", cells: cases },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, `semis refusé : ${JSON.stringify(r.corps)}`);
    const machine = (r.corps as unknown as { machine: { condition: number; dirt: number } }).machine;

    assert.ok(
      machine.condition > 80,
      `un champ entier laisse le tracteur à ${machine.condition} % — il devrait rester au-dessus de 80`,
    );
    assert.ok(
      machine.dirt < DIRT_DIRTY_THRESHOLD,
      `un seul champ salit la machine à ${machine.dirt}, au-delà du seuil « sale » (${DIRT_DIRTY_THRESHOLD})`,
    );
  });
});
