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
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";
import {
  machineCost,
  PLANTING_WINDOW,
  SEASON_DURATION_MS,
  canSowInSeason,
  currentSeason,
  type CropCode,
  type Season,
  DIRT_DIRTY_THRESHOLD,
  MACHINE_AGE_YIELD_MALUS,
  MACHINE_END_OF_LIFE_HOURS,
  machineResaleValue,
} from "@farmsim/shared";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 3999;
const BASE = `http://127.0.0.1:${PORT}`;

let serveur: ChildProcess | null = null;
/** Base du serveur de test — sert aux montages qu'aucune route ne permet. */
let base: BaseTest | null = null;

/**
 * Écrit directement en base, pour poser un état que le jeu met des heures à
 * produire. Réservé aux montages de test : vieillir une machine de 1 500 h ne
 * s'obtient par aucune route, et le faire en jouant ferait varier du même coup
 * la condition et la saleté — donc mesurerait autre chose.
 */
function prismaExec(sql: string) {
  execFileSync("npx", ["prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: base!.url },
    input: sql,
    stdio: ["pipe", "ignore", "ignore"],
  });
}

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

/**
 * Une culture semable maintenant.
 *
 * Deux tests codaient « blé » en dur. Ils passaient l'hiver et échouaient
 * l'été : le blé est une céréale d'hiver, et la saison du serveur suit
 * l'horloge réelle. Un test dont le résultat dépend du jour où on le lance
 * n'est pas un test.
 */
function cropDeSaison(): CropCode {
  const saison = currentSeason("N", Date.now());
  return (Object.keys(PLANTING_WINDOW) as CropCode[]).find((c) => canSowInSeason(c, saison).ok)!;
}

/**
 * Lance un chantier puis exécute le travail.
 *
 * Un travail de champ ne s'exécute plus directement : il faut d'abord réserver
 * ses cases et son attelage. Les tests passent par le même sas que le joueur —
 * seule l'attente est raccourcie, par `FARMSIM_JOB_SPEED`.
 */
async function travailler(
  parcelId: string,
  route: string,
  work: string,
  moi: { id: string; jeton: string },
  cells: { x: number; y: number }[],
  extra: Record<string, unknown> = {},
) {
  const lance = await appel(`/parcels/${parcelId}/jobs`, {
    methode: "POST",
    corps: { userId: moi.id, work, cells, ...(extra.crop ? { crop: extra.crop } : {}) },
    jeton: moi.jeton,
  });
  if (lance.statut !== 201) return lance;
  const job = (lance.corps as unknown as { job: { id: string; endsAt: string } }).job;
  const jobId = job.id;
  // On attend vraiment la fin du chantier, comme le ferait un joueur.
  const reste = new Date(job.endsAt).getTime() - Date.now();
  if (reste > 0) await new Promise((r) => setTimeout(r, reste + 30));
  return appel(`/parcels/${parcelId}/${route}`, {
    methode: "POST",
    corps: { userId: moi.id, cells, jobId, ...extra },
    jeton: moi.jeton,
  });
}

/** Inscrit un joueur et renvoie son jeton, son identifiant et sa ferme. */
async function inscrire(nom: string) {
  const r = await appel("/auth/register", {
    methode: "POST",
    corps: {
      // Le nom sert d'adresse : un accent ou une espace la rendait invalide, et
      // le test échouait sur l'inscription plutôt que sur ce qu'il mesurait.
      email: `${nom
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`,
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

  base = creerBaseTest("api");
  const url = base.url;
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
      // Cette suite crée des dizaines de comptes en quelques secondes depuis
      // la même adresse : c'est le profil même que la limite de débit arrête.
      // C'est `debit.test.ts` qui l'éprouve, limite activée.
      FARMSIM_RATE_LIMIT: "off",
      // Le camion met douze secondes en jeu : c'est le bon délai pour un
      // joueur, une éternité dans une suite d'intégration. On ne raccourcit
      // que le compte à rebours — la caisse existe toujours, et il faut
      // toujours la rentrer pour que la marchandise entre au stock.
      FARMSIM_DELIVERY_MS: "0",
      /* Les chantiers tournent deux cents fois plus vite qu'en jeu : un champ
         entier labouré passe de sept minutes à deux secondes. C'est un
         diviseur et non une durée fixe, pour que l'attente reste
         proportionnelle à la surface et à l'outil — c'est ce qu'on vérifie. */
      FARMSIM_JOB_SPEED: "200",
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
  supprimerBaseTest(base);
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

  it("avance le compteur horaire du temps réellement passé", async () => {
    // Le compteur est la nouvelle échelle : il doit correspondre au chantier,
    // pas à un nombre abstrait. Un champ de 14 ha, c'est quelques heures.
    const { moi, parcelle } = await cerealier();
    const cases = await champEntier(parcelle.id);
    const r = await travailler(parcelle.id, "plant", "PLANT", { id: moi.id, jeton: moi.jeton }, cases, { crop: cropDeSaison() });
    assert.equal(r.statut, 200, `semis refusé : ${JSON.stringify(r.corps)}`);
    const m = (r.corps as unknown as { machine: { hours: number; hoursWorked: number } }).machine;
    assert.ok(m.hoursWorked > 1.5 && m.hoursWorked < 6, `chantier de ${m.hoursWorked} h`);
    assert.ok(Math.abs(m.hours - m.hoursWorked) < 0.01, "un engin neuf part de zéro heure");
  });

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

    const r = await travailler(parcelle.id, "plant", "PLANT", { id: moi.id, jeton: moi.jeton }, cases, { crop: cropDeSaison() });
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

describe("marché de l'occasion", () => {
  /** Une ferme installée, avec de quoi acheter. */
  async function ferme(nom: string) {
    const moi = await inscrire(nom);
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
      corps: { userId: moi.id, specialization: "CEREALIER", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", { methode: "POST", corps: { userId: moi.id, crd: 50000 }, jeton: moi.jeton });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const p = (me.corps as unknown as {
      player: { crd: number; farm: { id: string; machines: { id: string; type: string }[] } };
    }).player;
    return { ...moi, crd: p.crd, machines: p.farm.machines };
  }

  const argent = async (jeton: string) =>
    (await appel("/auth/me", { jeton })).corps as unknown as { player: { crd: number } };

  it("sort l'engin de la ferme dès la mise en vente", async () => {
    /**
     * Le point qui décide de tout le reste : l'annonce *est* la machine
     * pendant sa durée. Sans ça, on continuerait de labourer avec un tracteur
     * qu'on est en train de vendre, et deux exemplaires existeraient à la
     * fois — celui de la ferme et celui de l'annonce.
     */
    const v = await ferme("Vendeur");
    const tracteur = v.machines.find((m) => m.type === "TRACTOR")!;
    const r = await appel(`/machines/${tracteur.id}/list`, {
      methode: "POST",
      corps: { userId: v.id, priceCrd: 800 },
      jeton: v.jeton,
    });
    assert.equal(r.statut, 201, `mise en vente refusée : ${JSON.stringify(r.corps)}`);

    const apres = (await appel("/auth/me", { jeton: v.jeton })).corps as unknown as {
      player: { farm: { machines: { id: string }[] } };
    };
    assert.ok(
      !apres.player.farm.machines.some((m) => m.id === tracteur.id),
      "le tracteur mis en vente est encore au garage",
    );
  });

  it("refuse un prix hors des bornes de la cote", async () => {
    // Sans bornes, la criée sert à se transférer de l'argent entre comptes.
    const v = await ferme("Malin");
    const tracteur = v.machines.find((m) => m.type === "TRACTOR")!;
    const r = await appel(`/machines/${tracteur.id}/list`, {
      methode: "POST",
      corps: { userId: v.id, priceCrd: 999999 },
      jeton: v.jeton,
    });
    assert.equal(r.statut, 409, `un prix délirant a été accepté : ${JSON.stringify(r.corps)}`);
  });

  it("transfère l'engin et l'argent, état compris", async () => {
    const v = await ferme("Cede");
    const a = await ferme("Reprend");
    const tracteur = v.machines.find((m) => m.type === "TRACTOR")!;

    const pose = await appel(`/machines/${tracteur.id}/list`, {
      methode: "POST",
      corps: { userId: v.id, priceCrd: 700 },
      jeton: v.jeton,
    });
    assert.equal(pose.statut, 201);
    const annonce = (pose.corps as unknown as { listing: { id: string } }).listing;

    const avantV = (await argent(v.jeton)).player.crd;
    const avantA = (await argent(a.jeton)).player.crd;

    const achat = await appel(`/machines/listings/${annonce.id}/buy`, {
      methode: "POST",
      corps: { userId: a.id },
      jeton: a.jeton,
    });
    assert.equal(achat.statut, 201, `achat refusé : ${JSON.stringify(achat.corps)}`);

    const apresV = (await argent(v.jeton)).player.crd;
    const apresA = (await argent(a.jeton)).player.crd;
    assert.equal(Math.round(apresV - avantV), 700, "le vendeur n'a pas été payé");
    assert.equal(Math.round(avantA - apresA), 700, "l'acheteur n'a pas été débité");

    const parc = (await appel("/auth/me", { jeton: a.jeton })).corps as unknown as {
      player: { farm: { machines: { type: string }[] } };
    };
    assert.equal(
      parc.player.farm.machines.filter((m) => m.type === "TRACTOR").length,
      2,
      "l'acheteur devrait avoir son tracteur de départ plus celui d'occasion",
    );
  });

  it("ne vend pas deux fois la même machine", async () => {
    const v = await ferme("Unique");
    const a = await ferme("Premier");
    const b = await ferme("Second");
    const tracteur = v.machines.find((m) => m.type === "TRACTOR")!;
    const pose = await appel(`/machines/${tracteur.id}/list`, {
      methode: "POST",
      corps: { userId: v.id, priceCrd: 700 },
      jeton: v.jeton,
    });
    const annonce = (pose.corps as unknown as { listing: { id: string } }).listing;

    const [r1, r2] = await Promise.all([
      appel(`/machines/listings/${annonce.id}/buy`, { methode: "POST", corps: { userId: a.id }, jeton: a.jeton }),
      appel(`/machines/listings/${annonce.id}/buy`, { methode: "POST", corps: { userId: b.id }, jeton: b.jeton }),
    ]);
    const reussites = [r1, r2].filter((r) => r.statut === 201).length;
    assert.equal(reussites, 1, `deux acheteurs sont repartis avec le même tracteur (${r1.statut}/${r2.statut})`);
  });

  it("rend l'engin au vendeur qui retire son annonce", async () => {
    const v = await ferme("Regret");
    const tracteur = v.machines.find((m) => m.type === "TRACTOR")!;
    const pose = await appel(`/machines/${tracteur.id}/list`, {
      methode: "POST",
      corps: { userId: v.id, priceCrd: 700 },
      jeton: v.jeton,
    });
    const annonce = (pose.corps as unknown as { listing: { id: string } }).listing;
    const r = await appel(`/machines/listings/${annonce.id}/cancel`, {
      methode: "POST",
      corps: { userId: v.id },
      jeton: v.jeton,
    });
    assert.equal(r.statut, 200, `retrait refusé : ${JSON.stringify(r.corps)}`);
    const parc = (await appel("/auth/me", { jeton: v.jeton })).corps as unknown as {
      player: { farm: { machines: { type: string }[] } };
    };
    assert.ok(parc.player.farm.machines.some((m) => m.type === "TRACTOR"), "le tracteur n'est pas revenu");
  });

  it("fait payer moins au concessionnaire qu'entre joueurs", async () => {
    // L'arbitrage que le joueur a demandé : l'argent tout de suite, ou le bon
    // prix mais il faut attendre.
    const v = await ferme("Presse");
    const tracteur = v.machines.find((m) => m.type === "TRACTOR")!;
    const avant = (await argent(v.jeton)).player.crd;
    const r = await appel(`/machines/${tracteur.id}/sell`, {
      methode: "POST",
      corps: { userId: v.id },
      jeton: v.jeton,
    });
    assert.equal(r.statut, 200);
    const reprise = (r.corps as unknown as { value: number }).value;
    const apres = (await argent(v.jeton)).player.crd;
    assert.equal(Math.round(apres - avant), Math.round(reprise));
    assert.ok(reprise < machineResaleValue("TRACTOR", { condition: 100, hours: 0 }));
  });
});

describe("les heures pèsent sur la récolte", () => {
  /**
   * Le trou que ce test garde fermé : sans malus d'âge, une moissonneuse de
   * 1 500 h remise à neuf ramassait autant qu'une neuve. On achetait
   * d'occasion moins cher, sans jamais rien perdre — le marché de l'occasion
   * n'avait donc pas de contrepartie.
   *
   * Le facteur vit dans `packages/shared` et ses formes sont tenues par
   * `used-market.test.ts` ; ici on vérifie qu'il arrive bien jusqu'aux tonnes,
   * par la vraie route de moisson.
   */
  async function moissonne(heuresCompteur: number) {
    const moi = await inscrire("Moissonneur");
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
      corps: { userId: moi.id, specialization: "CEREALIER", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 200000, level: 20 },
      jeton: moi.jeton,
    });
    await appel("/machines/buy", {
      methode: "POST",
      corps: { userId: moi.id, type: "HARVESTER" },
      jeton: moi.jeton,
    });

    const me = await appel("/auth/me", { jeton: moi.jeton });
    const ferme = (me.corps as unknown as {
      player: { farm: { parcels: { id: string }[]; machines: { id: string; type: string }[] } };
    }).player.farm;
    const parcelle = ferme.parcels[0]!;
    const moissonneuse = ferme.machines.find((m) => m.type === "HARVESTER")!;

    // On vieillit l'engin directement en base : c'est le seul moyen d'isoler
    // l'effet des heures sans faire varier aussi la condition et la saleté.
    // Les identifiants sont entre guillemets : PostgreSQL replie les noms nus
    // en minuscules, si bien que `Machine` y désignait une table `machine` qui
    // n'existe pas. SQLite passait, lui, sans rien dire.
    prismaExec(
      `UPDATE "Machine" SET "hours" = ${heuresCompteur}, "condition" = 100,` +
        ` "grease" = 100, "dirt" = 0 WHERE "id" = '${moissonneuse.id}'`,
    );

    const cellsR = await appel(`/parcels/${parcelle.id}`);
    const cells = (cellsR.corps as unknown as {
      parcel: { cells: { x: number; y: number; kind: string }[] };
    }).parcel.cells
      .filter((c) => c.kind === "EMPTY")
      .map((c) => ({ x: c.x, y: c.y }));

    await travailler(parcelle.id, "plant", "PLANT", moi, cells, { crop: cropDeSaison() });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, ripenAll: true },
      jeton: moi.jeton,
    });
    const r = await travailler(parcelle.id, "harvest", "HARVEST", moi, cells);
    assert.equal(r.statut, 200, `moisson refusée : ${JSON.stringify(r.corps)}`);
    const lots = (r.corps as unknown as { harvested: { tons: number }[] }).harvested;
    return lots.reduce((a, l) => a + l.tons, 0);
  }

  it("fait moins rendre une moissonneuse usée, révisée ou non", async () => {
    /**
     * L'assertion porte sur le **rapport attendu**, pas sur un simple « moins
     * que » : les deux fermes tombent sur des parcelles différentes, dont la
     * fertilité varie d'environ un pour cent. Une comparaison lâche passait
     * donc au vert même avec le malus désactivé — vérifié en le mettant à zéro.
     *
     * La tolérance couvre ce bruit sans couvrir l'effet mesuré, qui est huit
     * fois plus grand.
     */
    const neuve = await moissonne(0);
    const usee = await moissonne(MACHINE_END_OF_LIFE_HOURS);
    assert.ok(neuve > 0, "la moissonneuse neuve n'a rien ramassé");

    const rapport = usee / neuve;
    const attendu = 1 - MACHINE_AGE_YIELD_MALUS;
    assert.ok(
      Math.abs(rapport - attendu) < 0.03,
      `1 500 h au compteur donnent un rapport de ${rapport.toFixed(3)} au lieu de ${attendu} (${usee.toFixed(2)} t contre ${neuve.toFixed(2)} t)`,
    );
    // « Pas assez grave pour que ça punisse trop. »
    assert.ok(1 - rapport < 0.1, `écart de ${(100 * (1 - rapport)).toFixed(1)} %`);
  });
});

describe("calendrier cultural", () => {
  /**
   * La saison décide de deux choses : si l'on a le droit de semer, et à quelle
   * vitesse ça pousse. Avant, elle ne décidait de rien — `readyAt` valait
   * `now + growMs` et `cropGrowMs()` ne prenait ni saison ni région.
   *
   * Les formes du modèle sont tenues par `crop-calendar.test.ts` ; ici on
   * vérifie que la règle arrive jusqu'aux routes, pour le joueur comme pour
   * l'entreprise qu'il pourrait payer pour la contourner.
   */
  async function fermeSemable() {
    const moi = await inscrire("Semeur");
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
      corps: { userId: moi.id, specialization: "CEREALIER", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 200000, level: 20 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const ferme = (me.corps as unknown as {
      player: { farm: { parcels: { id: string; zone?: { hemisphere?: string } }[] } };
    }).player.farm;
    const parcelle = ferme.parcels[0]!;
    const det = await appel(`/parcels/${parcelle.id}`);
    const cells = (det.corps as unknown as {
      parcel: { cells: { x: number; y: number; kind: string }[] };
    }).parcel.cells
      .filter((c) => c.kind === "EMPTY")
      .map((c) => ({ x: c.x, y: c.y }));
    return { moi, parcelle, cells };
  }

  /** La saison du serveur, telle que le joueur la voit dans le monde. */
  function saisonCourante(): Season {
    return currentSeason("N", Date.now());
  }

  it("accepte une culture de saison et refuse l'autre", async () => {
    const { moi, parcelle, cells } = await fermeSemable();
    const saison = saisonCourante();
    const dedans = (Object.keys(PLANTING_WINDOW) as CropCode[]).find(
      (c) => canSowInSeason(c, saison).ok,
    );
    const dehors = (Object.keys(PLANTING_WINDOW) as CropCode[]).find(
      (c) => !canSowInSeason(c, saison).ok,
    );
    assert.ok(dedans, "il doit toujours rester une culture semable");
    assert.ok(dehors, "et une hors saison, sinon la règle ne dit rien");

    const refus = await travailler(parcelle.id, "plant", "PLANT", { id: moi.id, jeton: moi.jeton }, cells.slice(0, 4), { crop: dehors });
    assert.equal(refus.statut, 409, `${dehors} semé en ${saison} aurait dû être refusé`);
    // Le refus doit dire quand revenir : une règle qu'on devine n'est pas une
    // décision.
    const message = (refus.corps as unknown as { error: string }).error;
    assert.match(message, /sème/, `message peu utile : ${message}`);

    const ok = await travailler(parcelle.id, "plant", "PLANT", { id: moi.id, jeton: moi.jeton }, cells.slice(0, 4), { crop: dedans });
    assert.equal(ok.statut, 200, `${dedans} refusé en ${saison} : ${JSON.stringify(ok.corps)}`);
  });

  it("ne laisse pas l'entreprise contourner le calendrier", async () => {
    // Payer un prestataire pour semer hors saison viderait la règle de son sens.
    const { moi, parcelle, cells } = await fermeSemable();
    const dehors = (Object.keys(PLANTING_WINDOW) as CropCode[]).find(
      (c) => !canSowInSeason(c, saisonCourante()).ok,
    )!;
    const r = await appel(`/parcels/${parcelle.id}/contractor`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: dehors, cells: cells.slice(0, 4) },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 409, `l'entreprise a semé hors saison : ${JSON.stringify(r.corps)}`);
  });

  it("annonce une maturité qui tient compte de la saison", async () => {
    /**
     * La date renvoyée n'est plus `semis + temps de pousse` mais une
     * projection intégrée. Elle doit rester exacte : météo et saison étant des
     * fonctions pures du calendrier, une culture semée maintenant a une date
     * de maturité calculable et définitive.
     */
    const { moi, parcelle, cells } = await fermeSemable();
    const saison = saisonCourante();
    const crop = (Object.keys(PLANTING_WINDOW) as CropCode[]).find(
      (c) => canSowInSeason(c, saison).ok,
    )!;
    const avant = Date.now();
    const r = await travailler(parcelle.id, "plant", "PLANT", moi, cells.slice(0, 4), { crop });
    assert.equal(r.statut, 200, `semis refusé : ${JSON.stringify(r.corps)}`);
    const parcelleApres = (r.corps as unknown as {
      parcel: { cells: { crop: string | null; readyAt: string | null }[] };
    }).parcel;
    const semee = parcelleApres.cells.find((c) => c.crop === crop && c.readyAt);
    assert.ok(semee?.readyAt, "aucune case semée n'a de date de maturité");
    const pret = new Date(semee!.readyAt!).getTime();
    assert.ok(pret > avant, "la maturité doit être dans le futur");
    // Bornée : une culture qui n'arriverait jamais à maturité serait un piège.
    assert.ok(
      pret - avant < 8 * SEASON_DURATION_MS,
      `maturité annoncée dans ${(pret - avant) / SEASON_DURATION_MS} saisons`,
    );
  });
});

describe("porteur et outils", () => {
  /**
   * Un tracteur ne sème plus : il tire. Les formes du modèle sont tenues par
   * `implements.test.ts` ; ici on vérifie que la règle arrive jusqu'aux routes
   * — le parc de départ, le refus quand l'outil manque, et le palier à l'achat.
   */
  async function ferme(nom: string) {
    const moi = await inscrire(nom);
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
      corps: { userId: moi.id, specialization: "CEREALIER", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 500000, level: 20 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const f = (me.corps as unknown as {
      player: { farm: { parcels: { id: string }[]; machines: { id: string; type: string; tier: number }[] } };
    }).player.farm;
    const det = await appel(`/parcels/${f.parcels[0]!.id}`);
    const cells = (det.corps as unknown as {
      parcel: { cells: { x: number; y: number; kind: string }[] };
    }).parcel.cells
      .filter((c) => c.kind === "EMPTY")
      .map((c) => ({ x: c.x, y: c.y }));
    return { moi, parcelle: f.parcels[0]!, machines: f.machines, cells };
  }

  it("livre une ferme neuve avec de quoi travailler", async () => {
    // Un tracteur seul ne fait plus rien : sans outil, la première parcelle
    // resterait en friche et l'accueil serait un mur.
    const { machines } = await ferme("Debutant");
    const types = machines.map((m) => m.type);
    assert.ok(types.includes("TRACTOR"), `parc de départ : ${types.join(", ")}`);
    assert.ok(types.includes("SEEDER"), `pas de semoir : ${types.join(", ")}`);
    assert.ok(types.includes("PLOUGH"), `pas de charrue : ${types.join(", ")}`);
  });

  it("refuse de semer quand le semoir est vendu, et dit lequel manque", async () => {
    const { moi, parcelle, machines, cells } = await ferme("SansSemoir");
    const semoir = machines.find((m) => m.type === "SEEDER")!;
    const vente = await appel(`/machines/${semoir.id}/sell`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(vente.statut, 200, `revente refusée : ${JSON.stringify(vente.corps)}`);

    const r = await travailler(parcelle.id, "plant", "PLANT", { id: moi.id, jeton: moi.jeton }, cells.slice(0, 4), { crop: cropDeSaison() });
    assert.equal(r.statut, 409, "un tracteur seul a semé");
    const message = (r.corps as unknown as { error: string }).error;
    // Trois causes possibles — outil absent, outil en panne, tracteur trop
    // faible : le message doit dire laquelle, sinon on achète le mauvais engin.
    assert.match(message, /Semoir/i, `message peu utile : ${message}`);
  });

  it("use le tracteur en même temps que l'outil qu'il tire", async () => {
    /**
     * Le tracteur a tiré pendant tout le chantier : son compteur doit avancer
     * autant que celui de l'outil. C'est ce qui fait de lui la machine la plus
     * chargée de la ferme, exactement comme sur une vraie exploitation.
     */
    const { moi, parcelle, machines, cells } = await ferme("Attelage");
    const r = await travailler(parcelle.id, "plant", "PLANT", moi, cells, { crop: cropDeSaison() });
    assert.equal(r.statut, 200, `semis refusé : ${JSON.stringify(r.corps)}`);

    const apres = (await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { farm: { machines: { type: string; hours: number }[] } };
    };
    const tracteur = apres.player.farm.machines.find((m) => m.type === "TRACTOR")!;
    const semoir = apres.player.farm.machines.find((m) => m.type === "SEEDER")!;
    const charrue = apres.player.farm.machines.find((m) => m.type === "PLOUGH")!;
    assert.ok(semoir.hours > 0, "le semoir n'a pas tourné");
    assert.ok(
      Math.abs(tracteur.hours - semoir.hours) < 0.01,
      `tracteur ${tracteur.hours} h contre semoir ${semoir.hours} h`,
    );
    assert.equal(charrue.hours, 0, "la charrue n'a pas participé au semis");
  });

  it("vend un palier supérieur à son prix, plus large et plus exigeant", async () => {
    const { moi } = await ferme("Investisseur");
    const avant = ((await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { crd: number };
    }).player.crd;
    const r = await appel("/machines/buy", {
      methode: "POST",
      corps: { userId: moi.id, type: "TRACTOR", tier: 3 },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 201, `achat refusé : ${JSON.stringify(r.corps)}`);
    const apres = ((await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { crd: number; farm: { machines: { type: string; tier: number }[] } };
    }).player;
    assert.equal(Math.round(avant - apres.crd), machineCost("TRACTOR", 3));
    assert.ok(
      apres.farm.machines.some((m) => m.type === "TRACTOR" && m.tier === 3),
      "le palier n'a pas été enregistré",
    );
  });
});

describe("un chantier prend du temps", () => {
  /**
   * Les travaux étaient instantanés : on cliquait, le champ était labouré. Ça
   * tenait tant que rien ne disait combien de temps ça prend — mais depuis que
   * les heures sont réelles, un labour de quatorze hectares demande onze heures
   * de tracteur et un épandage une seule. Les faire tenir dans le même clic
   * effaçait exactement ce que la largeur de travail venait d'apporter.
   *
   * L'attente est raccourcie par `FARMSIM_JOB_SPEED` (posé au démarrage du
   * serveur de test) : ce qu'on vérifie, c'est le sas — qu'on ne puisse pas
   * travailler sans chantier, que l'attelage soit immobilisé, et que les cases
   * soient réservées. Le commentaire nommait ici `FARMSIM_JOB_MS`, qui n'a
   * jamais existé : les chantiers duraient donc leur temps réel.
   */
  async function fermeAuChamp(nom: string) {
    const moi = await inscrire(nom);
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
      corps: { userId: moi.id, specialization: "CEREALIER", parcelId },
      jeton: moi.jeton,
    });
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 200000, level: 20 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const parcelle = (me.corps as unknown as {
      player: { farm: { parcels: { id: string }[] } };
    }).player.farm.parcels[0]!;
    const det = await appel(`/parcels/${parcelle.id}`);
    const cells = (det.corps as unknown as {
      parcel: { cells: { x: number; y: number; kind: string }[] };
    }).parcel.cells
      .filter((c) => c.kind === "EMPTY")
      .map((c) => ({ x: c.x, y: c.y }));
    return { moi, parcelle, cells };
  }

  it("ne lance pas un chantier qui n'a rien à faire", async () => {
    /**
     * Trouvé en pilotant le jeu bouton par bouton. Cliquer « Labourer » sur de
     * la terre nue ouvrait le chantier : l'engin partait, le plein était
     * débité, et la route de labour répondait « rien à labourer » **après** le
     * travail. Le refus était juste ; il arrivait après l'attente.
     *
     * Ce qui se sait sans simuler doit se dire au départ.
     */
    const { moi, parcelle, cells } = await fermeAuChamp("Labour à vide");
    const avant = await appel("/auth/me", { jeton: moi.jeton });
    const cuveAvant = (avant.corps as unknown as {
      player: { farm: { fuelL: number } };
    }).player.farm.fuelL;

    const r = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLOW", cells: cells.slice(0, 3) },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 409, `le chantier est parti quand même : ${JSON.stringify(r.corps)}`);
    assert.match(String((r.corps as { error?: string }).error ?? ""), /[Rr]ien à labourer/);

    const apres = await appel("/auth/me", { jeton: moi.jeton });
    const cuveApres = (apres.corps as unknown as {
      player: { farm: { fuelL: number } };
    }).player.farm.fuelL;
    // Pas un litre : l'engin n'a pas quitté la cour.
    assert.equal(cuveApres, cuveAvant, "du gazole est parti pour un chantier refusé");
  });

  it("rend le plein quand le refus ne peut venir qu'après", async () => {
    /**
     * Toutes les refusals ne se prévoient pas : savoir si une culture est mûre
     * demande de la simuler. Le chantier part donc, et c'est au retour qu'on
     * apprend qu'il n'y avait rien. Ce qui ne doit pas rester au joueur, c'est
     * la facture : il a payé une sélection, pas un travail.
     */
    const { moi, parcelle, cells } = await fermeAuChamp("Moisson à vide");
    // Le parc de départ n'a pas de moissonneuse : sans elle, le chantier se
    // ferait refuser pour la mauvaise raison.
    const achat = await appel("/machines/buy", {
      methode: "POST",
      corps: { userId: moi.id, type: "HARVESTER", tier: 1 },
      jeton: moi.jeton,
    });
    assert.equal(achat.statut, 201, `moissonneuse refusée : ${JSON.stringify(achat.corps)}`);
    const lot = cells.slice(0, 3);
    const avant = await appel("/auth/me", { jeton: moi.jeton });
    const cuveAvant = (avant.corps as unknown as {
      player: { farm: { fuelL: number } };
    }).player.farm.fuelL;

    const ouvert = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "HARVEST", cells: lot },
      jeton: moi.jeton,
    });
    assert.equal(ouvert.statut, 201, `chantier refusé : ${JSON.stringify(ouvert.corps)}`);
    const job = (ouvert.corps as unknown as { job: { id: string; endsAt: string } }).job;

    const pendant = await appel("/auth/me", { jeton: moi.jeton });
    const cuvePendant = (pendant.corps as unknown as {
      player: { farm: { fuelL: number } };
    }).player.farm.fuelL;
    assert.ok(cuvePendant < cuveAvant, "le plein aurait dû partir au départ de la cour");

    /*
      Attendre la fin du chantier, comme le fait `travailler()`.

      Ce test-ci ouvrait le chantier à la main et appelait la moisson dans la
      foulée : le sas répondait alors « chantier encore en cours » (425) au
      lieu du refus qu'on voulait mesurer. La course ne se voyait pas sur une
      machine rapide, et tombait sur l'intégration continue — le pire endroit
      pour l'apprendre, puisqu'elle y bloque le déploiement.
    */
    const reste = new Date(job.endsAt).getTime() - Date.now();
    if (reste > 0) await new Promise((r) => setTimeout(r, reste + 30));

    const travail = await appel(`/parcels/${parcelle.id}/harvest`, {
      methode: "POST",
      corps: { userId: moi.id, jobId: job.id, cells: lot },
      jeton: moi.jeton,
    });
    assert.equal(
      travail.statut,
      409,
      `une moisson sur des cases vides devrait être refusée : ${JSON.stringify(travail.corps)}`,
    );

    // Le remboursement suit la réponse : on laisse le serveur la terminer.
    await new Promise((r) => setTimeout(r, 400));
    const apres = await appel("/auth/me", { jeton: moi.jeton });
    const cuveApres = (apres.corps as unknown as {
      player: { farm: { fuelL: number } };
    }).player.farm.fuelL;
    assert.ok(
      Math.abs(cuveApres - cuveAvant) < 0.05,
      `gazole non rendu : ${cuveAvant} avant, ${cuveApres} après`,
    );
  });

  it("refuse un travail qu'aucun chantier n'a lancé", async () => {
    // Sans ce sas, il suffirait d'appeler la route pour effacer l'attente — et
    // l'attente est ce qui donne sa valeur à un outil plus large.
    const { moi, parcelle, cells } = await fermeAuChamp("Pressé");
    const r = await appel(`/parcels/${parcelle.id}/plant`, {
      methode: "POST",
      corps: { userId: moi.id, crop: cropDeSaison(), cells: cells.slice(0, 4) },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 409, "un semis est parti sans chantier");
    assert.match((r.corps as unknown as { error: string }).error, /chantier/i);
  });

  it("annonce une durée proportionnelle à la surface et à l'outil", async () => {
    /**
     * On mesure la durée annoncée, pas l'attente : le raccourci de test met
     * l'horloge à zéro, mais la route renvoie toujours ce que le chantier
     * aurait coûté en vrai.
     */
    const { moi, parcelle, cells } = await fermeAuChamp("Chronomètre");
    const petit = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 4) },
      jeton: moi.jeton,
    });
    assert.equal(petit.statut, 201, `chantier refusé : ${JSON.stringify(petit.corps)}`);
    const jobPetit = (petit.corps as unknown as { job: { id: string; durationMs: number } }).job;

    await appel(`/jobs/${jobPetit.id}/cancel`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });

    const grand = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 40) },
      jeton: moi.jeton,
    });
    const jobGrand = (grand.corps as unknown as { job: { durationMs: number } }).job;
    assert.ok(
      jobGrand.durationMs > jobPetit.durationMs * 5,
      `dix fois plus de cases pour ${jobGrand.durationMs} ms contre ${jobPetit.durationMs} ms`,
    );
  });

  it("immobilise l'attelage pendant le chantier", async () => {
    // Un tracteur au champ ne peut ni repartir sur un autre travail, ni se
    // vendre : sans ça, un seul engin ferait toute la ferme à la fois.
    const { moi, parcelle, cells } = await fermeAuChamp("Occupé");
    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 8) },
      jeton: moi.jeton,
    });
    assert.equal(lance.statut, 201);

    const parc = (await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { farm: { machines: { id: string; type: string; busyUntil: string | null }[] } };
    };
    // C'est l'outil du travail lancé qui part, pas un autre : le semis
    // emmène le semoir, et la charrue reste disponible à la cour.
    const tracteur = parc.player.farm.machines.find((m) => m.type === "TRACTOR")!;
    const semoir = parc.player.farm.machines.find((m) => m.type === "SEEDER")!;
    const charrue = parc.player.farm.machines.find((m) => m.type === "PLOUGH")!;
    assert.ok(tracteur.busyUntil, "le tracteur n'est pas marqué au champ");
    assert.ok(semoir.busyUntil, "le semoir n'est pas marqué au champ");
    assert.equal(charrue.busyUntil, null, "la charrue est partie sans raison");

    const vente = await appel(`/machines/${tracteur.id}/sell`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(vente.statut, 409, "on a vendu un tracteur parti au champ");
  });

  it("réserve ses cases : deux chantiers ne se marchent pas dessus", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Doublon");
    const a = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 6) },
      jeton: moi.jeton,
    });
    assert.equal(a.statut, 201);
    const b = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(4, 10) },
      jeton: moi.jeton,
    });
    assert.equal(b.statut, 409, "deux chantiers se sont partagé les mêmes cases");
  });

  it("rend l'attelage quand on abandonne", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Renonce");
    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 6) },
      jeton: moi.jeton,
    });
    const jobId = (lance.corps as unknown as { job: { id: string } }).job.id;
    const r = await appel(`/jobs/${jobId}/cancel`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, `abandon refusé : ${JSON.stringify(r.corps)}`);

    const parc = (await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { farm: { machines: { type: string; busyUntil: string | null }[] } };
    };
    assert.ok(
      parc.player.farm.machines.every((m) => !m.busyUntil),
      "l'attelage est resté bloqué après un abandon",
    );
  });

  it("libère l'attelage une fois le travail fait", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Fini");
    const r = await travailler(parcelle.id, "plant", "PLANT", moi, cells.slice(0, 6), {
      crop: cropDeSaison(),
    });
    assert.equal(r.statut, 200, `semis refusé : ${JSON.stringify(r.corps)}`);

    const parc = (await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { farm: { machines: { busyUntil: string | null }[] } };
    };
    assert.ok(
      parc.player.farm.machines.every((m) => !m.busyUntil),
      "l'attelage est resté au champ après la fin du travail",
    );
    const restants = await appel(`/parcels/${parcelle.id}/jobs`);
    assert.equal(
      (restants.corps as unknown as { jobs: unknown[] }).jobs.length,
      0,
      "le chantier n'a pas été clos",
    );
  });
});
