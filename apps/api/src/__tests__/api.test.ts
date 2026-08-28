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
import { formatRecovery, isRecoveryCode } from "@farmsim/shared";
import {
  BUILDING_DEFS,
  MACHINE_DEFS,
  machineCost,
  machineUpgradeCost,
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
      /*
       * Une connexion par appel, et surtout pas de réutilisation.
       *
       * `fetch` garde ses connexions ouvertes dans un pool ; le serveur, lui,
       * ferme les siennes après cinq secondes d'inactivité — c'est le défaut
       * de Node. Or plusieurs tests posent leur décor avec `prismaExec`, qui
       * lance `npx prisma` en **synchrone** : quatre cases à marquer, et six
       * secondes passent sans qu'aucun octet ne circule. Le serveur ferme sa
       * moitié de la socket, `fetch` la ressort quand même du pool au test
       * suivant, et l'appel meurt sur « other side closed » — un échec qui
       * n'a rien à voir avec ce que le test mesure et qui accuse la route.
       *
       * Une suite d'intégration n'a aucun besoin de garder ses connexions :
       * on les ferme, et la classe entière de faux échecs disparaît.
       */
      connection: "close",
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
  const job = (lance.corps as unknown as {
    job: { id: string; endsAt: string; cells: { x: number; y: number }[] };
  }).job;
  const jobId = job.id;
  // On attend vraiment la fin du chantier, comme le ferait un joueur.
  const reste = new Date(job.endsAt).getTime() - Date.now();
  if (reste > 0) await new Promise((r) => setTimeout(r, reste + 30));
  // On travaille les cases que le chantier a **retenues** : une case déjà
  // prise ailleurs est laissée de côté, et le client suit cette liste-là.
  return appel(`/parcels/${parcelId}/${route}`, {
    methode: "POST",
    corps: { userId: moi.id, cells: job.cells ?? cells, jobId, ...extra },
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
  const b = r.corps as unknown as {
    token: string;
    recoveryCode?: string;
    player: { id: string; email: string; farm: { machines: { id: string }[] } };
  };
  return {
    jeton: b.token,
    id: b.player.id,
    email: b.player.email,
    secours: b.recoveryCode,
    machines: b.player.farm.machines,
  };
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
    /*
     * Juste de quoi en payer un seul : c'est ce qui met la concurrence à
     * l'épreuve. Avant correction, quatre passaient et le compte finissait
     * dans le rouge.
     *
     * La somme se déduit du prix du silo. Écrite « 1 500 » en dur, elle valait
     * pour un silo à 1 200 ; passée aux euros, elle n'en payait plus aucun et
     * le test mesurait zéro construction au lieu d'une.
     */
    const f = await fermeAvec(Math.round(BUILDING_DEFS.SILO.cost * 1.25));
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
      player: { crd: number; farm: { parcels: { buildings: { type: string }[] }[] } };
    }).player;

    assert.equal(reussis, 1, `${reussis} constructions acceptées au lieu d'une`);
    // On compte les silos, pas les bâtiments : l'étable de départ en est un,
    // et elle est maintenant posée pour tout le monde.
    const silos = joueur.farm.parcels[0]!.buildings.filter((b) => b.type === "SILO").length;
    assert.equal(silos, 1, `${silos} silos posés au lieu d'un`);
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
      player: { crd: number; farm: { parcels: { buildings: { type: string }[] }[] } };
    }).player;
    assert.equal(joueur.crd, 10, "un refus ne doit rien débiter");
    const silos = joueur.farm.parcels[0]!.buildings.filter((b) => b.type === "SILO").length;
    assert.equal(silos, 0, "un refus ne doit rien poser");
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

  /**
   * Les cases **semables** de la parcelle — ce que vise « Tout sélectionner ».
   *
   * La cour de ferme en est exclue : c'est là que les camions déposent, et on
   * n'y sème pas. Sans cette exclusion, « tout le champ » comprenait la cour et
   * le semis se faisait refuser — ce qui est exactement le comportement voulu,
   * mais fait échouer des tests qui mesurent tout autre chose.
   */
  async function champEntier(parcelId: string) {
    const r = await appel(`/parcels/${parcelId}`);
    const parcel = (r.corps as unknown as {
      parcel: { gridH: number; cells: { x: number; y: number; kind: string }[] };
    }).parcel;
    return parcel.cells
      .filter((c) => c.kind === "EMPTY")
      .map((c) => ({ x: c.x, y: c.y }));
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

  /**
   * Un prix d'annonce que la cote accepte, pour un tracteur de départ.
   *
   * Les tests posaient « 700 » ou « 800 », qui étaient de bons prix quand un
   * tracteur en valait 2 800. Passés aux euros, ils tombent sous le plancher
   * de la cote et le serveur refuse par un 409 — un chiffre recopié qui décrit
   * le prix d'hier, pas la règle. La moitié du prix catalogue tient dans les
   * bornes quel que soit le barème.
   */
  const prixAnnonce = (_: unknown): number => Math.round(MACHINE_DEFS.TRACTOR.cost * 0.5);

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
      corps: { userId: v.id, priceCrd: prixAnnonce(v) },
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
      corps: { userId: v.id, priceCrd: prixAnnonce(v) },
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
    assert.equal(Math.round(apresV - avantV), prixAnnonce(v), "le vendeur n'a pas été payé");
    assert.equal(Math.round(avantA - apresA), prixAnnonce(v), "l'acheteur n'a pas été débité");

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
      corps: { userId: v.id, priceCrd: prixAnnonce(v) },
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
      corps: { userId: v.id, priceCrd: prixAnnonce(v) },
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
    // La Coupe T1 vaut 200 000 € : avec exactement ça, il ne restait rien
    // pour les semences, et la moisson échouait sur un champ vide.
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 500000, level: 20 },
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
      parcel: { gridH: number; cells: { x: number; y: number; kind: string }[] };
    }).parcel.cells
      .filter((c) => c.kind === "EMPTY")
      .map((c) => ({ x: c.x, y: c.y }));

    const semis = await travailler(parcelle.id, "plant", "PLANT", moi, cells, { crop: cropDeSaison() });
    assert.equal(semis.statut, 200, `semis refusé : ${JSON.stringify(semis.corps)}`);
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
      parcel: { gridH: number; cells: { x: number; y: number; kind: string }[] };
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

  it("sème chaque culture de saison, à la main comme par l'entreprise", async () => {
    /*
     * Strea : le maïs à la main ne partait pas, « faire faire » si. Le
     * calendrier n'était pas en cause — le prestataire plantait sur les
     * chaumes, le joueur non. On vérifie ici que **toutes** les cultures
     * ouvertes aujourd'hui passent les deux chemins.
     */
    const { moi, parcelle, cells } = await fermeSemable();
    const saison = saisonCourante();
    const cultures = (Object.keys(PLANTING_WINDOW) as CropCode[]).filter(
      (c) => canSowInSeason(c, saison).ok,
    );
    assert.ok(cultures.length >= 1, "il doit rester une culture semable");
    assert.ok(cells.length >= cultures.length * 8, `pas assez de cases : ${cells.length}`);

    for (let i = 0; i < cultures.length; i++) {
      const crop = cultures[i]!;
      const main = cells.slice(i * 4, i * 4 + 4);
      const r = await travailler(parcelle.id, "plant", "PLANT", moi, main, { crop });
      assert.equal(r.statut, 200, `${crop} à la main refusé : ${JSON.stringify(r.corps)}`);
      const semees = (
        r.corps as unknown as { parcel: { cells: { crop: string | null }[] } }
      ).parcel.cells.filter((c) => c.crop === crop);
      assert.ok(semees.length >= 4, `${crop} : ${semees.length} cases semées`);
    }

    const base = cultures.length * 4;
    for (let i = 0; i < cultures.length; i++) {
      const crop = cultures[i]!;
      const lot = cells.slice(base + i * 4, base + i * 4 + 4);
      const r = await appel(`/parcels/${parcelle.id}/contractor`, {
        methode: "POST",
        corps: { userId: moi.id, work: "PLANT", crop, cells: lot },
        jeton: moi.jeton,
      });
      assert.equal(r.statut, 200, `${crop} par l'entreprise refusé : ${JSON.stringify(r.corps)}`);
    }
  });

  it("sème sur les chaumes, à la main comme le prestataire", async () => {
    /*
     * Après une moisson, la case porte des chaumes. Le prestataire y semait
     * quand même ; le joueur attendait la fin du chantier pour s'entendre
     * dire « déchaumez ». Les deux sèmes désormais en direct.
     */
    const { moi, parcelle, cells } = await fermeSemable();
    const crop = cropDeSaison();
    const lot = cells.slice(0, 4);
    for (const c of lot) {
      prismaExec(
        `UPDATE "ParcelCell" SET "hasStubble" = true, "harvestsSincePlow" = 1 ` +
          `WHERE "parcelId" = '${parcelle.id}' AND x = ${c.x} AND y = ${c.y};`,
      );
    }

    const main = await travailler(parcelle.id, "plant", "PLANT", moi, lot, { crop });
    assert.equal(main.statut, 200, `semis joueur sur chaumes : ${JSON.stringify(main.corps)}`);
    const corps = main.corps as unknown as {
      directSeeded?: boolean;
      parcel: { cells: { x: number; y: number; crop: string | null; hasStubble: boolean; directSeeded: boolean }[] };
    };
    assert.equal(corps.directSeeded, true, "le semis sur chaumes n'est pas marqué en direct");
    for (const c of lot) {
      const cell = corps.parcel.cells.find((x) => x.x === c.x && x.y === c.y);
      assert.equal(cell?.crop, crop);
      assert.equal(cell?.hasStubble, false, "les chaumes devraient être percées");
      assert.equal(cell?.directSeeded, true);
    }

    const lot2 = cells.slice(4, 8);
    for (const c of lot2) {
      prismaExec(
        `UPDATE "ParcelCell" SET "hasStubble" = true, "harvestsSincePlow" = 1 ` +
          `WHERE "parcelId" = '${parcelle.id}' AND x = ${c.x} AND y = ${c.y};`,
      );
    }
    const eta = await appel(`/parcels/${parcelle.id}/contractor`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop, cells: lot2 },
      jeton: moi.jeton,
    });
    assert.equal(eta.statut, 200, `semis prestataire sur chaumes : ${JSON.stringify(eta.corps)}`);
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
    // Un T5 tracteur coûte 920 000 € : 500 000 € ne suffisaient plus.
    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 2_000_000, level: 20 },
      jeton: moi.jeton,
    });
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const f = (me.corps as unknown as {
      player: { farm: { parcels: { id: string }[]; machines: { id: string; type: string; tier: number }[] } };
    }).player.farm;
    const det = await appel(`/parcels/${f.parcels[0]!.id}`);
    const cells = (det.corps as unknown as {
      parcel: { gridH: number; cells: { x: number; y: number; kind: string }[] };
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

  it("vend le haut de gamme à son prix, et refuse un palier hors catalogue", async () => {
    const { moi } = await ferme("Collectionneur");
    const avant = ((await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { crd: number };
    }).player.crd;
    const t5 = await appel("/machines/buy", {
      methode: "POST",
      corps: { userId: moi.id, type: "TRACTOR", tier: 5 },
      jeton: moi.jeton,
    });
    assert.equal(t5.statut, 201, `T5 refusé : ${JSON.stringify(t5.corps)}`);
    const apres = ((await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { crd: number; farm: { machines: { type: string; tier: number }[] } };
    }).player;
    assert.equal(Math.round(avant - apres.crd), machineCost("TRACTOR", 5));
    assert.ok(apres.farm.machines.some((m) => m.type === "TRACTOR" && m.tier === 5));

    const hors = await appel("/machines/buy", {
      methode: "POST",
      corps: { userId: moi.id, type: "TRACTOR", tier: 6 },
      jeton: moi.jeton,
    });
    assert.equal(hors.statut, 400);
  });

  it("améliore un engin au palier suivant, en payant la différence", async () => {
    const { moi } = await ferme("Mécano");
    const achat = await appel("/machines/buy", {
      methode: "POST",
      corps: { userId: moi.id, type: "TRAILER", tier: 1 },
      jeton: moi.jeton,
    });
    assert.equal(achat.statut, 201, `achat refusé : ${JSON.stringify(achat.corps)}`);
    const machine = (achat.corps as unknown as { machine: { id: string; tier: number } }).machine;
    const avant = ((await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { crd: number };
    }).player.crd;
    const attendu = machineUpgradeCost("TRAILER", 1);
    assert.ok(attendu && attendu > 0);
    const r = await appel(`/machines/${machine.id}/upgrade`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, `amélioration refusée : ${JSON.stringify(r.corps)}`);
    const corps = r.corps as unknown as {
      cost: number;
      tier: number;
      machine: { tier: number; condition: number; hours: number };
    };
    assert.equal(corps.tier, 2);
    assert.equal(corps.machine.tier, 2);
    assert.equal(corps.machine.condition, 100);
    assert.equal(corps.machine.hours, 0);
    assert.equal(corps.cost, attendu);
    const apres = ((await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { crd: number };
    }).player.crd;
    assert.equal(Math.round(avant - apres), attendu);
  });

  it("refuse d'améliorer un T5", async () => {
    const { moi } = await ferme("Sommet");
    const achat = await appel("/machines/buy", {
      methode: "POST",
      corps: { userId: moi.id, type: "TRAILER", tier: 5 },
      jeton: moi.jeton,
    });
    assert.equal(achat.statut, 201, `achat T5 refusé : ${JSON.stringify(achat.corps)}`);
    const machine = (achat.corps as unknown as { machine: { id: string } }).machine;
    const r = await appel(`/machines/${machine.id}/upgrade`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 409);
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
      parcel: { gridH: number; cells: { x: number; y: number; kind: string }[] };
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

    /*
     * On fige le chantier au champ, au lieu de courir après lui.
     *
     * `FARMSIM_JOB_SPEED` ramène un semis de huit cases à environ une seconde,
     * et ce test fait encore deux allers-retours HTTP avant de vendre. Sur un
     * exécuteur chargé, le chantier finissait dans l'intervalle : l'attelage
     * était rentré, la vente passait, et le test échouait sans que rien ne
     * soit cassé. Un test d'invariant qui dépend de la vitesse de la machine
     * ne prouve rien — et celui-ci gardait la porte du déploiement.
     *
     * Ce qu'on veut vérifier n'est pas « le chantier dure-t-il assez
     * longtemps » mais « un attelage parti au champ se vend-il ». On pose donc
     * l'état voulu, et on l'éprouve.
     */
    const jobId = (lance.corps as unknown as { job: { id: string } }).job.id;
    const loin = new Date(Date.now() + 60 * 60_000).toISOString();
    prismaExec(`UPDATE "FieldJob" SET "endsAt" = '${loin}' WHERE id = '${jobId}';`);
    prismaExec(
      `UPDATE "Machine" SET "busyUntil" = '${loin}' WHERE id IN (` +
        `SELECT "machineId" FROM "FieldJob" WHERE id = '${jobId}' ` +
        `UNION SELECT "tractorId" FROM "FieldJob" WHERE id = '${jobId}');`,
    );

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

  /**
   * Une case retenue ailleurs est **laissée de côté**, pas fatale au lot.
   *
   * Le refus portait sur la sélection entière : une seule case déjà prise, et
   * les soixante-douze autres étaient rejetées, à charge pour le joueur de
   * deviner laquelle retirer. « Si j'ai quelque chose en cours, ignore les
   * cases concernées » — c'est la seule issue qui ne demande rien à personne.
   */
  it("laisse de côté les cases déjà prises, et fait le reste", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Doublon");
    /*
     * Le partage partiel se teste sur un chantier **qui tourne encore** :
     * c'est le seul état où des cases sont vraiment retenues.
     *
     * Cette version-ci attendait le terme du premier chantier sans le
     * réclamer, et vérifiait que ses cases restaient prises. C'était le
     * comportement signalé en jouant le 28 août — « toutes ces cases sont
     * déjà sur un chantier en cours » devant un champ où plus rien ne
     * tournait. Un chantier fini du joueur lui-même ne retient plus rien.
     *
     * D'où le second attelage, acheté **avant** de lancer quoi que ce soit :
     * sans lui le chantier B n'aurait pas de quoi partir, et l'acheter après
     * prendrait plus longtemps que ne dure le chantier A.
     */
    // Le garage ne tient que cinq engins : on revend celui dont ce test n'a
    // que faire, sinon le second semoir n'a pas de place où rentrer.
    const parcAvant = (await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { farm: { machines: { id: string; type: string }[] } };
    };
    const inutile = parcAvant.player.farm.machines.find(
      (m) => m.type !== "TRACTOR" && m.type !== "SEEDER",
    );
    assert.ok(inutile, "il faut un engin à revendre pour libérer une place");
    await appel(`/machines/${inutile.id}/sell`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    for (const type of ["TRACTOR", "SEEDER"]) {
      const achat = await appel("/machines/buy", {
        methode: "POST",
        corps: { userId: moi.id, type },
        jeton: moi.jeton,
      });
      assert.equal(achat.statut, 201, `achat ${type} refusé : ${JSON.stringify(achat.corps)}`);
    }
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
    assert.equal(b.statut, 201, `le lot entier a été refusé : ${JSON.stringify(b.corps)}`);
    const job = (b.corps as unknown as {
      job: { cells: { x: number; y: number }[]; skipped: number };
    }).job;
    // Deux cases se chevauchaient : elles sont annoncées, et le chantier part
    // sur les quatre autres.
    assert.equal(job.skipped, 2, "le chantier n'a pas dit ce qu'il laissait");
    assert.equal(job.cells.length, 4, "le chantier n'a pas gardé le reste");
    const pris = new Set(cells.slice(0, 6).map((c) => `${c.x},${c.y}`));
    for (const c of job.cells) {
      assert.ok(!pris.has(`${c.x},${c.y}`), `case ${c.x},${c.y} partie sur deux chantiers`);
    }
  });

  it("refuse quand il ne reste vraiment rien à faire partir", async () => {
    // La sélection entièrement prise garde un refus : il n'y a pas de « reste »
    // à travailler, et partir sur zéro case n'aurait aucun sens.
    const { moi, parcelle, cells } = await fermeAuChamp("Toutprises");
    const a = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 6) },
      jeton: moi.jeton,
    });
    assert.equal(a.statut, 201);
    const b = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 6) },
      jeton: moi.jeton,
    });
    assert.equal(b.statut, 409);
  });

  /**
   * Un chantier que personne ne réclame ne bloque pas le champ pour toujours.
   *
   * Signalé en jouant : « Case 5,9 déjà sur un chantier en cours » — alors
   * qu'aucun chantier ne tournait. Un chantier reste `RUNNING` jusqu'à ce que
   * la route de travail vienne le consommer ; si cet appel n'arrive jamais —
   * onglet fermé, réseau coupé, ou un travail refusé après l'ouverture — le
   * chantier restait `RUNNING` sans fin, et ses cases avec lui. Rien dans le
   * jeu ne permettait de déloger le fantôme.
   */
  it("libère les cases d'un chantier que personne n'est venu réclamer", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Fantome");
    const bloc = cells.slice(0, 6);
    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(lance.statut, 201);
    const jobId = (lance.corps as unknown as { job: { id: string } }).job.id;

    // On vieillit le chantier : il est fini depuis longtemps, et jamais réclamé.
    // C'est exactement l'état que laisse un onglet fermé en cours de travail.
    const vieux = new Date(Date.now() - 60 * 60_000);
    prismaExec(
      `UPDATE "FieldJob" SET "endsAt" = '${vieux.toISOString()}' WHERE id = '${jobId}';`,
    );

    const repris = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(
      repris.statut,
      201,
      `les cases sont restées bloquées : ${JSON.stringify(repris.corps)}`,
    );
    const job = (repris.corps as unknown as { job: { cells: unknown[]; skipped: number } }).job;
    assert.equal(job.skipped, 0, "le fantôme retenait encore des cases");
    assert.equal(job.cells.length, 6);

    // Et l'attelage du fantôme est rentré : sinon la machine resterait
    // occupée par un chantier qui n'existe plus.
    const parc = (await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { farm: { machines: { id: string; busyUntil: string | null }[] } };
    };
    const encoreDehors = parc.player.farm.machines.filter((m) => {
      if (!m.busyUntil) return false;
      return new Date(m.busyUntil).getTime() < Date.now() - 60_000;
    });
    assert.equal(encoreDehors.length, 0, "un attelage est resté au champ pour toujours");
  });

  /**
   * Son propre chantier fini ne fait pas attendre le joueur.
   *
   * Relevé en production le 28 août : deux labours terminés depuis cinq et six
   * minutes, et « Toutes ces cases sont déjà sur un chantier en cours » devant
   * un champ où rien ne tournait. Le délai de grâce protège une reprise — un
   * téléphone qui sort de veille vient réclamer son travail — mais relancer
   * sur ses propres cases dit précisément qu'on ne viendra pas le réclamer.
   *
   * Le test se place **dans** la grâce, à une minute : c'est la fenêtre où le
   * refus tombait, et où il ne doit plus tomber.
   */
  it("laisse relancer sur ses propres cases sans attendre la grâce", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Grace");
    const bloc = cells.slice(0, 6);
    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(lance.statut, 201);
    const jobId = (lance.corps as unknown as { job: { id: string } }).job.id;

    // Fini il y a une minute, jamais réclamé : encore couvert par la grâce.
    const finiRecemment = new Date(Date.now() - 60_000);
    prismaExec(
      `UPDATE "FieldJob" SET "endsAt" = '${finiRecemment.toISOString()}' WHERE id = '${jobId}';`,
    );

    const repris = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(
      repris.statut,
      201,
      `le joueur attend cinq minutes pour rien : ${JSON.stringify(repris.corps)}`,
    );
    assert.equal(
      (repris.corps as unknown as { job: { skipped: number } }).job.skipped,
      0,
      "son propre chantier terminé retenait encore des cases",
    );
  });

  /**
   * Un chantier encore en cours, lui, retient — et le dit honnêtement.
   *
   * L'assouplissement ci-dessus ne doit pas ouvrir la porte à deux chantiers
   * sur les mêmes cases. Le refus reste, mais il annonce désormais quand la
   * sélection se libère : sans cette date, le joueur relançait en boucle.
   */
  it("refuse les cases d'un chantier qui tourne, et dit jusqu'à quand", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Occupe");
    const bloc = cells.slice(0, 6);
    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(lance.statut, 201);

    const repris = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(repris.statut, 409);
    const corps = repris.corps as unknown as { error: string; freeAt?: string };
    assert.ok(corps.freeAt, `le refus n'annonce pas de fin : ${JSON.stringify(corps)}`);
    assert.ok(
      new Date(corps.freeAt as string).getTime() > Date.now(),
      "la date de libération est déjà passée",
    );
    assert.ok(
      /libre dans/.test(corps.error),
      `le refus n'annonce pas l'attente : ${corps.error}`,
    );
  });

  /**
   * Le fantôme d'un champ qu'on ne revisite jamais finit par tomber.
   *
   * `libererChantiersAbandonnes` ne nettoie que la parcelle visitée. En
   * production, un chantier de semis était encore `RUNNING` **huit jours**
   * après sa fin : personne n'était retourné sur ce champ. Le tour de
   * simulation balaie maintenant, quelle que soit la parcelle.
   */
  it("balaie au tour de simulation les fantômes des champs délaissés", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Balai");
    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "PLANT", crop: cropDeSaison(), cells: cells.slice(0, 6) },
      jeton: moi.jeton,
    });
    assert.equal(lance.statut, 201);
    const jobId = (lance.corps as unknown as { job: { id: string } }).job.id;
    const vieux = new Date(Date.now() - 8 * 24 * 60 * 60_000);
    prismaExec(
      `UPDATE "FieldJob" SET "endsAt" = '${vieux.toISOString()}' WHERE id = '${jobId}';`,
    );

    // Aucune visite sur la parcelle : c'est le tour du monde qui doit le voir.
    const tick = await appel("/sim/tick", { methode: "POST", jeton: moi.jeton });
    assert.equal(tick.statut, 200, `le tour n'a pas tourné : ${JSON.stringify(tick.corps)}`);

    /*
     * On juge le balayage sur l'attelage, pas sur la ligne en base : c'est ce
     * que le joueur constate. Le chantier avait mis la machine de garde
     * jusqu'à la fin prévue ; le balayage la rend, et `busyUntil` retombe à
     * `null`. Sans lui, elle resterait retenue par un chantier mort.
     */
    const parc = (await appel("/auth/me", { jeton: moi.jeton })).corps as unknown as {
      player: { farm: { machines: { id: string; busyUntil: string | null }[] } };
    };
    const retenues = parc.player.farm.machines.filter((m) => m.busyUntil);
    assert.equal(
      retenues.length,
      0,
      `le fantôme retient encore un attelage : ${JSON.stringify(retenues)}`,
    );
  });

  /**
   * Une terre labourée puis laissée là peut redevenir verte.
   *
   * Signalé en jouant le 28 août : « je peux plus nettoyer le terrain pour
   * qu'après labour ça redevienne vert ». Les règles de `soil.ts` savent le
   * faire — `canRegrass` et `applyRegrass` existent, et disent en toutes
   * lettres à quel signalement de joueur elles répondent. Ce test-ci prend le
   * chemin complet, du chantier à la case relue, parce que c'est le seul qui
   * dirait où ça casse.
   */
  it("remet en herbe une terre labourée et nue", async () => {
    const { moi, parcelle, cells } = await fermeAuChamp("Enherbe");
    const bloc = cells.slice(0, 6);
    // L'état exact que laisse un labour : préparée, nue, sans chaumes. On le
    // pose directement — y arriver en jouant demanderait une saison entière.
    const paires = bloc.map((c) => `(${c.x}, ${c.y})`).join(", ");
    prismaExec(
      `UPDATE "ParcelCell" SET "fieldStage" = 'PREPARED', "hasStubble" = false, "crop" = NULL` +
        ` WHERE "parcelId" = '${parcelle.id}' AND (x, y) IN (${paires});`,
    );

    const lance = await appel(`/parcels/${parcelle.id}/jobs`, {
      methode: "POST",
      corps: { userId: moi.id, work: "STUBBLE", cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(lance.statut, 201, `chantier refusé : ${JSON.stringify(lance.corps)}`);
    const job = (lance.corps as unknown as { job: { id: string; endsAt: string } }).job;
    const reste = new Date(job.endsAt).getTime() - Date.now();
    if (reste > 0) await new Promise((r) => setTimeout(r, reste + 40));

    const fait = await appel(`/parcels/${parcelle.id}/stubble`, {
      methode: "POST",
      corps: { userId: moi.id, jobId: job.id, cells: bloc },
      jeton: moi.jeton,
    });
    assert.equal(fait.statut, 200, `déchaumage refusé : ${JSON.stringify(fait.corps)}`);
    assert.equal(
      (fait.corps as unknown as { regrassed: number }).regrassed,
      6,
      `les cases n'ont pas été remises en herbe : ${JSON.stringify(fait.corps)}`,
    );

    // Le vert, côté joueur, c'est `fieldStage` revenu à EMPTY sans résidus :
    // c'est ce couple, et lui seul, que la vue lit pour peindre en `PLAIN`.
    const det = await appel(`/parcels/${parcelle.id}`);
    const apres = (det.corps as unknown as {
      parcel: { cells: { x: number; y: number; fieldStage: string; residuePasses: number }[] };
    }).parcel.cells.filter((c) => bloc.some((b) => b.x === c.x && b.y === c.y));
    assert.equal(apres.length, 6);
    for (const c of apres) {
      assert.equal(c.fieldStage, "EMPTY", `case ${c.x},${c.y} encore travaillée`);
      assert.equal(c.residuePasses, 0, `case ${c.x},${c.y} garde des résidus, donc du marron`);
    }
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

/* ------------------------------------------------------------------ */
/* Code d'accès oublié                                                 */
/* ------------------------------------------------------------------ */

/**
 * Le code d'accès, haché — et les deux chemins de la migration.
 *
 * Il était stocké en clair sous un commentaire qui l'assumait, ce qui a permis
 * de retrouver le mot de passe d'un joueur en lisant une colonne. Ces
 * tests-ci parlent à la vraie base, parce que c'est là que se joue tout ce qui
 * peut mal tourner : la colonne doit accueillir les deux formes, un compte
 * encore en clair doit basculer sans être invalidé, et un compte déjà migré
 * doit continuer d'ouvrir.
 */
describe("code d'accès haché", () => {
  /** Ce que la colonne contient réellement, vu de la base. */
  function codeEnBase(email: string): string {
    return execFileSync(
      "psql",
      [base!.url, "-v", "ON_ERROR_STOP=1", "-tA", "-c",
       `SELECT "accessCode" FROM "User" WHERE email = '${email}'`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  }

  const EMPREINTE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

  it("l'inscription n'écrit jamais le code en clair", async () => {
    const moi = await inscrire("Code Neuf");
    const stocke = codeEnBase(moi.email);
    assert.match(stocke, EMPREINTE, "la colonne doit contenir une empreinte");
    assert.ok(!stocke.includes("ferme"), "le code ne doit apparaître nulle part");
  });

  it("compte déjà migré : il ouvre, et la colonne ne bouge pas", async () => {
    const moi = await inscrire("Code Migre");
    const avant = codeEnBase(moi.email);

    const r = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "ferme" },
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    // Re-hacher à chaque connexion coûterait un bcrypt pour rien, et surtout
    // ouvrirait une fenêtre où l'écriture peut échouer sur un compte qui va
    // très bien.
    assert.equal(codeEnBase(moi.email), avant);

    const faux = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "pas-le-bon" },
    });
    assert.equal(faux.statut, 401);
  });

  it("compte pas encore migré : il ouvre avec son code, et la colonne bascule", async () => {
    const moi = await inscrire("Code Ancien");
    // On remet la colonne dans l'état d'avant la correction : le clair, tel
    // qu'il y dormait pour tous les comptes existants.
    prismaExec(`UPDATE "User" SET "accessCode" = 'vieux-code' WHERE email = '${moi.email}';`);
    assert.equal(codeEnBase(moi.email), "vieux-code");

    const r = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "vieux-code" },
    });
    assert.equal(r.statut, 200, "un compte d'avant doit continuer d'entrer");

    const apres = codeEnBase(moi.email);
    assert.match(apres, EMPREINTE, "la connexion réussie doit avoir haché le code");
    assert.ok(!apres.includes("vieux-code"));

    // Et surtout : le même code ouvre toujours. C'est ce qui distingue une
    // migration d'une mise à la porte.
    const encore = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "vieux-code" },
    });
    assert.equal(encore.statut, 200, "le joueur n'a pas été invalidé");
  });

  it("compte pas encore migré : un mauvais code ne migre rien", async () => {
    // Migrer sur un échec écrirait l'empreinte du code **saisi**, c'est-à-dire
    // celui de l'attaquant. Le compte changerait de propriétaire.
    const moi = await inscrire("Code Attaque");
    prismaExec(`UPDATE "User" SET "accessCode" = 'vrai-code' WHERE email = '${moi.email}';`);

    const r = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "tentative" },
    });
    assert.equal(r.statut, 401);
    assert.equal(codeEnBase(moi.email), "vrai-code", "rien ne doit avoir été écrit");

    const vrai = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "vrai-code" },
    });
    assert.equal(vrai.statut, 200);
  });

  it("changer de code depuis le profil écrit une empreinte, jamais le clair", async () => {
    const moi = await inscrire("Code Change");
    const r = await appel("/auth/me", {
      methode: "PATCH",
      corps: { accessCode: "code-tout-neuf", currentAccessCode: "ferme" },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    assert.match(codeEnBase(moi.email), EMPREINTE);

    assert.equal(
      (await appel("/auth/login", {
        methode: "POST",
        corps: { email: moi.email, accessCode: "code-tout-neuf" },
      })).statut,
      200,
    );
    assert.equal(
      (await appel("/auth/login", {
        methode: "POST",
        corps: { email: moi.email, accessCode: "ferme" },
      })).statut,
      401,
    );
  });

  it("le code actuel se vérifie même sur un compte pas encore migré", async () => {
    // Sans cela, un joueur d'avant ne pourrait plus changer son code : la
    // route comparait la saisie à la colonne par égalité de chaînes.
    const moi = await inscrire("Code Profil Ancien");
    prismaExec(`UPDATE "User" SET "accessCode" = 'code-d-avant' WHERE email = '${moi.email}';`);

    const refuse = await appel("/auth/me", {
      methode: "PATCH",
      corps: { accessCode: "peu-importe", currentAccessCode: "pas-le-bon" },
      jeton: moi.jeton,
    });
    assert.equal(refuse.statut, 403);

    const ok = await appel("/auth/me", {
      methode: "PATCH",
      corps: { accessCode: "code-apres", currentAccessCode: "code-d-avant" },
      jeton: moi.jeton,
    });
    assert.equal(ok.statut, 200, JSON.stringify(ok.corps));
    assert.match(codeEnBase(moi.email), EMPREINTE);
  });

  it("la récupération pose une empreinte, pas un code en clair", async () => {
    const moi = await inscrire("Code Secours Hache");
    const r = await appel("/auth/recover", {
      methode: "POST",
      corps: { email: moi.email, recoveryCode: moi.secours, accessCode: "apres-secours" },
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    assert.match(codeEnBase(moi.email), EMPREINTE);
    assert.equal(
      (await appel("/auth/login", {
        methode: "POST",
        corps: { email: moi.email, accessCode: "apres-secours" },
      })).statut,
      200,
    );
  });
});

describe("code de secours", () => {
  it("est remis à l'inscription, une seule fois", async () => {
    const moi = await inscrire("Secours Neuf");
    assert.ok(moi.secours, "l'inscription doit remettre un code de secours");
    assert.ok(isRecoveryCode(moi.secours!));

    // Se reconnecter ne doit **pas** en redonner un : sinon le code noté par
    // le joueur cesserait de valoir à chaque visite.
    const r = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "ferme" },
    });
    assert.equal(r.statut, 200);
    assert.equal((r.corps as { recoveryCode?: string }).recoveryCode, undefined);
  });

  it("rouvre la ferme et pose un code d'accès neuf", async () => {
    const moi = await inscrire("Secours Oubli");
    const r = await appel("/auth/recover", {
      methode: "POST",
      corps: {
        email: moi.email,
        // Recopié comme sur un carnet : tirets, minuscules.
        recoveryCode: formatRecovery(moi.secours!).toLowerCase(),
        accessCode: "nouveau-code",
      },
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    const b = r.corps as { token: string; player: { id: string }; recoveryCode?: string };
    assert.equal(b.player.id, moi.id, "c'est bien la même ferme");

    // L'ancien code ne vaut plus, le nouveau vaut.
    const ancien = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "ferme" },
    });
    assert.equal(ancien.statut, 401);
    const neuf = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "nouveau-code" },
    });
    assert.equal(neuf.statut, 200);
  });

  it("brûle le code utilisé et en remet un autre", async () => {
    // Un bout de papier retrouvé dans six mois ne doit pas rouvrir la ferme.
    const moi = await inscrire("Secours Brule");
    const un = await appel("/auth/recover", {
      methode: "POST",
      corps: { email: moi.email, recoveryCode: moi.secours, accessCode: "code-un" },
    });
    assert.equal(un.statut, 200);
    const suivant = (un.corps as { recoveryCode?: string }).recoveryCode;
    assert.ok(suivant && suivant !== moi.secours, "un code neuf doit être remis");

    const rejoue = await appel("/auth/recover", {
      methode: "POST",
      corps: { email: moi.email, recoveryCode: moi.secours, accessCode: "code-deux" },
    });
    assert.equal(rejoue.statut, 401);

    const bon = await appel("/auth/recover", {
      methode: "POST",
      corps: { email: moi.email, recoveryCode: suivant, accessCode: "code-trois" },
    });
    assert.equal(bon.statut, 200);
  });

  it("met dehors les sessions ouvertes avec l'ancien code", async () => {
    // Sans cela, reprendre la main sur son compte serait une illusion : celui
    // qui était entré avec l'ancien code y resterait jusqu'à l'expiration.
    const moi = await inscrire("Secours Dehors");
    const avant = await appel("/auth/me", { jeton: moi.jeton });
    assert.equal(avant.statut, 200);

    const r = await appel("/auth/recover", {
      methode: "POST",
      corps: { email: moi.email, recoveryCode: moi.secours, accessCode: "code-repris" },
    });
    assert.equal(r.statut, 200);

    const apres = await appel("/auth/me", { jeton: moi.jeton });
    assert.equal(apres.statut, 401);
  });

  it("refuse sans dire si l'adresse existe", async () => {
    const moi = await inscrire("Secours Muet");
    const faux = await appel("/auth/recover", {
      methode: "POST",
      corps: {
        email: moi.email,
        recoveryCode: "ZZZZ-ZZZZ-ZZZZ-ZZZZ",
        accessCode: "peu-importe",
      },
    });
    const inconnu = await appel("/auth/recover", {
      methode: "POST",
      corps: {
        email: `personne-${Date.now()}@test.fr`,
        recoveryCode: "ZZZZ-ZZZZ-ZZZZ-ZZZZ",
        accessCode: "peu-importe",
      },
    });
    assert.equal(faux.statut, inconnu.statut);
    assert.deepEqual(faux.corps, inconnu.corps);
    assert.equal(faux.statut, 401);

    // Et le compte visé n'a pas bougé.
    const encore = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "ferme" },
    });
    assert.equal(encore.statut, 200);
  });
});

describe("mise à jour du compte", () => {
  it("refuse sans session", async () => {
    const r = await appel("/auth/me", {
      methode: "PATCH",
      corps: { displayName: "Intrus" },
    });
    assert.equal(r.statut, 401);
  });

  it("change le pseudo sans redemander le code", async () => {
    const moi = await inscrire("Patch Pseudo");
    const r = await appel("/auth/me", {
      methode: "PATCH",
      jeton: moi.jeton,
      corps: { displayName: "NouveauPseudo" },
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    const b = r.corps as { player: { displayName: string } };
    assert.equal(b.player.displayName, "NouveauPseudo");
  });

  it("refuse un nouvel e-mail sans le code actuel", async () => {
    const moi = await inscrire("Patch Mail Nu");
    const r = await appel("/auth/me", {
      methode: "PATCH",
      jeton: moi.jeton,
      corps: { email: `autre-${Date.now()}@test.fr` },
    });
    assert.equal(r.statut, 403);
  });

  it("change l'e-mail et le code avec le code actuel", async () => {
    const moi = await inscrire("Patch Secret");
    const neuf = `secret-${Date.now()}@test.fr`;
    const r = await appel("/auth/me", {
      methode: "PATCH",
      jeton: moi.jeton,
      corps: {
        email: neuf,
        accessCode: "nouveau-code",
        currentAccessCode: "ferme",
      },
    });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    const b = r.corps as { player: { email: string } };
    assert.equal(b.player.email, neuf);

    const ancien = await appel("/auth/login", {
      methode: "POST",
      corps: { email: moi.email, accessCode: "ferme" },
    });
    assert.equal(ancien.statut, 401);
    const ok = await appel("/auth/login", {
      methode: "POST",
      corps: { email: neuf, accessCode: "nouveau-code" },
    });
    assert.equal(ok.statut, 200);
  });

  it("refuse un e-mail déjà pris", async () => {
    const a = await inscrire("Patch Pris A");
    const b = await inscrire("Patch Pris B");
    const r = await appel("/auth/me", {
      methode: "PATCH",
      jeton: a.jeton,
      corps: { email: b.email, currentAccessCode: "ferme" },
    });
    assert.equal(r.statut, 409);
  });
});

/**
 * L'arbre de compétences, de bout en bout.
 *
 * Le module `skills` est éprouvé à part, sur des instantanés fabriqués. Ce qui
 * se joue **ici** est l'autre moitié, celle qu'un test unitaire ne peut pas
 * voir : est-ce que travailler dans le jeu fait vraiment bouger les compteurs
 * dont l'arbre vit ?
 *
 * C'est la question qui compte. Le jeu portait déjà un compteur mort —
 * `feedings`, que la quête « Nourrir le troupeau » attendait et que personne
 * n'incrémentait : un verrou sans serrure, invisible tant qu'on ne joue pas.
 */
describe("les compétences suivent le vrai jeu", () => {
  async function fermeNeuve(nom: string) {
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
    const detail = await appel(`/parcels/${parcelId}`, { jeton: moi.jeton });
    const parcelle = (detail.corps as unknown as { parcel: { id: string; cells: CellXY[] } }).parcel;
    return { moi, parcelle };
  }

  async function arbre(moi: { id: string; jeton: string }) {
    const r = await appel(`/players/${moi.id}/skills`, { jeton: moi.jeton });
    assert.equal(r.statut, 200, `arbre indisponible : ${JSON.stringify(r.corps)}`);
    return (r.corps as unknown as {
      skills: { id: string; unlocked: boolean; progress: { have?: number; need?: number }[] }[];
    }).skills;
  }

  it("part de zéro et n'invente rien", async () => {
    const { moi } = await fermeNeuve("ArbreNeuf");
    const skills = await arbre(moi);
    assert.ok(skills.length > 20, "l'arbre doit être conséquent");
    assert.equal(
      skills.filter((s) => s.unlocked).length,
      0,
      "une ferme neuve ne débloque rien",
    );
  });

  it("ouvre une compétence en travaillant vraiment le champ", async () => {
    const { moi, parcelle } = await fermeNeuve("ArbreSemis");
    const cells = parcelle.cells.filter((c) => c.kind === "EMPTY").slice(0, 24);
    assert.ok(cells.length >= 24, "il faut vingt-quatre cases libres");

    const avant = await arbre(moi);
    assert.equal(avant.find((s) => s.id === "SOWING_BASICS")?.unlocked, false);

    // On sème pour de vrai, par le même sas que le joueur.
    const r = await travailler(parcelle.id, "plant", "PLANT", moi, cells, {
      crop: cropDeSaison(),
    });
    assert.equal(r.statut, 200, `semis refusé : ${JSON.stringify(r.corps)}`);

    const apres = await arbre(moi);
    assert.equal(
      apres.find((s) => s.id === "SOWING_BASICS")?.unlocked,
      true,
      "semer vingt-quatre cases n'a pas ouvert le tour de main du semis",
    );
  });

  it("survit au redémarrage : l'état se recalcule, il ne se perd pas", async () => {
    /*
     * Rien n'est stocké — c'est le principe. Ce test le vérifie autrement
     * qu'en relisant la même réponse : le compteur, lui, est bien en base, et
     * c'est de lui que l'arbre se déduit à chaque appel. Deux lectures
     * séparées par d'autres écritures doivent donner le même verdict.
     */
    const { moi, parcelle } = await fermeNeuve("ArbrePersiste");
    const cells = parcelle.cells.filter((c) => c.kind === "EMPTY").slice(0, 24);
    await travailler(parcelle.id, "plant", "PLANT", moi, cells, { crop: cropDeSaison() });

    const un = await arbre(moi);
    const moi2 = await appel("/auth/me", { jeton: moi.jeton });
    assert.equal(moi2.statut, 200);
    const deux = await arbre(moi);
    assert.deepEqual(
      un.map((s) => `${s.id}:${s.unlocked}`),
      deux.map((s) => `${s.id}:${s.unlocked}`),
      "l'arbre a changé sans que rien ne se passe",
    );
  });

  it("chiffre la progression avec les vrais compteurs du serveur", async () => {
    const { moi, parcelle } = await fermeNeuve("ArbreJauge");
    const cells = parcelle.cells.filter((c) => c.kind === "EMPTY").slice(0, 10);
    await travailler(parcelle.id, "plant", "PLANT", moi, cells, { crop: cropDeSaison() });

    const skills = await arbre(moi);
    const semis = skills.find((s) => s.id === "SOWING_BASICS")!;
    assert.equal(semis.unlocked, false);
    // Dix cases semées sur les vingt-quatre demandées : c'est ce que le joueur
    // doit lire, et ça vient du compteur réel, pas d'une estimation.
    assert.equal(semis.progress[0]?.have, 10);
    assert.equal(semis.progress[0]?.need, 24);
  });

  it("donne à tout le monde de quoi cultiver ET de quoi élever", async () => {
    /*
     * Le déchaumeur n'allait qu'au céréalier, l'étable qu'à l'éleveur. Un
     * joueur qui changeait d'avis se retrouvait sans l'outil que le guide lui
     * réclamait, sans qu'aucun écran ne lui dise pourquoi.
     */
    const { moi } = await fermeNeuve("ArbreKit");
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const player = (me.corps as unknown as {
      player: {
        farm: { machines: { type: string }[]; parcels: { buildings: { type: string }[] }[] };
      };
    }).player;
    const parc = player.farm.machines.map((m) => m.type);
    for (const outil of ["TRACTOR", "SEEDER", "PLOUGH", "DISC_HARROW"]) {
      assert.ok(parc.includes(outil), `${outil} manque au parc de départ`);
    }
    // L'étable se lit dans les bâtiments : `/auth/me` ne remonte pas les
    // troupeaux, et c'est le bâtiment qui ouvre la branche élevage.
    const batis = player.farm.parcels.flatMap((p) => p.buildings.map((b) => b.type));
    assert.ok(batis.includes("CATTLE_BARN"), `l'étable de départ manque (${batis.join(", ")})`);
  });
});

describe("le voisinage d’une parcelle", () => {
  /**
   * La campagne 3D inventait ses voisins à partir d'une graine : des cultures
   * tirées au sort sur des parcelles sans identifiant, qu'on ne pouvait donc
   * ni regarder vraiment ni acheter. Or la carte existe, et trente pour cent
   * de ses parcelles appartiennent déjà à des fermes PNJ.
   *
   * Cette route est la jointure entre les deux. Ce qu'on vérifie ici, c'est
   * qu'elle rend bien **la carte** — et pas un décor de plus.
   */
  async function fermeAvecVoisins(nom: string) {
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
    const r = await appel(`/parcels/${parcelId}/voisinage`, { jeton: moi.jeton });
    assert.equal(r.statut, 200, JSON.stringify(r.corps));
    return {
      moi,
      parcelId,
      vue: r.corps as unknown as {
        centre: { id: string; mapX: number; mapY: number };
        zone: { code: string; mapW: number; mapH: number };
        parcelles: {
          id: string;
          col: number;
          rang: number;
          mapX: number;
          mapY: number;
          statut: string;
          culture: string | null;
          partCultivee: number;
          batiments: unknown[];
          cheptel: { kind: string; size: number }[];
          prix: number | null;
          achetable: boolean;
        }[];
      },
    };
  }

  it("rend de vraies parcelles de la carte, pas un décor", async () => {
    const { parcelId, vue } = await fermeAvecVoisins("Voisin Un");
    assert.ok(vue.parcelles.length >= 4, `trop peu de voisins : ${vue.parcelles.length}`);
    // Chacune porte l'identifiant qui permettra de l'acheter.
    for (const p of vue.parcelles) assert.match(p.id, /^[a-z0-9]+$/i);
    const centre = vue.parcelles.find((p) => p.id === parcelId);
    assert.ok(centre, "la parcelle du joueur doit figurer dans sa propre trame");
    assert.equal(centre.statut, "MOI");
  });

  it("centre la trame sur la ferme du joueur", async () => {
    /*
     * La case (0, 0) est la sienne. Si les deux axes ne pointaient pas dans le
     * même sens que ceux de la vue, la campagne serait le miroir de la carte —
     * et la parcelle qu'on croit acheter à droite arriverait à gauche.
     */
    const { parcelId, vue } = await fermeAvecVoisins("Voisin Deux");
    const centre = vue.parcelles.find((p) => p.id === parcelId)!;
    assert.equal(centre.col, 0);
    assert.equal(centre.rang, 0);
    for (const p of vue.parcelles) {
      assert.equal(p.col, p.mapX - vue.centre.mapX);
      assert.equal(p.rang, p.mapY - vue.centre.mapY);
    }
  });

  it("ne sort jamais de la commune", async () => {
    // Au-delà de la zone il n'y a pas de parcelle : c'est ce qui donne au pays
    // un bord crédible, bois et prés, plutôt qu'un damier sans fin.
    const { vue } = await fermeAvecVoisins("Voisin Trois");
    for (const p of vue.parcelles) {
      assert.ok(p.mapX >= 0 && p.mapX < vue.zone.mapW, `mapX hors zone : ${p.mapX}`);
      assert.ok(p.mapY >= 0 && p.mapY < vue.zone.mapH, `mapY hors zone : ${p.mapY}`);
    }
  });

  it("montre ce qui pousse vraiment sur une parcelle", async () => {
    /*
     * Ce que la route doit prouver : elle lit **les cases de la base**, et non
     * un décor tiré au sort. On sème donc pour de bon, et on regarde si la
     * trame le rapporte.
     *
     * Le serveur de test tourne avec `FARMSIM_SKIP_NPC=1` — les fermes PNJ,
     * qui peuplent trente pour cent de chaque commune en vrai, n'y sont pas
     * semées, et il n'y a donc pas de voisin cultivé sur qui compter. La
     * parcelle du joueur passe par exactement le même résumé.
     */
    const { moi, parcelId, vue } = await fermeAvecVoisins("Voisin Quatre");
    const avant = vue.parcelles.find((p) => p.id === parcelId)!;
    assert.equal(avant.culture, null, "une parcelle neuve ne cultive rien");
    assert.equal(avant.partCultivee, 0);

    const cases = [
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ];
    const crop = cropDeSaison();
    await travailler(parcelId, "plow", "PLOW", moi, cases);
    const seme = await travailler(parcelId, "plant", "PLANT", moi, cases, { crop });
    assert.equal(seme.statut, 200, JSON.stringify(seme.corps));

    const apres = await appel(`/parcels/${parcelId}/voisinage`, { jeton: moi.jeton });
    const trame = (apres.corps as unknown as { parcelles: typeof vue.parcelles }).parcelles;
    const mienne = trame.find((p) => p.id === parcelId)!;
    assert.equal(mienne.culture, crop);
    assert.ok(mienne.partCultivee > 0 && mienne.partCultivee <= 1, `part : ${mienne.partCultivee}`);
    // Trois cases sur cent quarante-quatre : la part doit rester une part, et
    // non un booléen déguisé.
    assert.ok(mienne.partCultivee < 0.1, `part trop grande : ${mienne.partCultivee}`);
  });

  it("chiffre toute parcelle libre ou PNJ du voisinage, même non mitoyenne", async () => {
    /*
     * On agrandit dans le voisinage, pas seulement collé. L'adjacence reste un
     * facteur de prix ; elle ne cache plus le devis. Un autre joueur, jamais.
     */
    const { parcelId, vue } = await fermeAvecVoisins("Voisin Cinq");
    const moi = vue.parcelles.find((p) => p.id === parcelId)!;
    let loin = 0;
    for (const p of vue.parcelles) {
      if (p.statut === "LIBRE" || p.statut === "PNJ") {
        assert.ok(p.prix !== null && p.prix > 0, `${p.id} ${p.statut} sans devis`);
        const collee = Math.abs(p.mapX - moi.mapX) + Math.abs(p.mapY - moi.mapY) === 1;
        if (!collee && p.id !== parcelId) loin += 1;
      } else {
        assert.equal(p.prix, null, `${p.id} chiffrée alors qu'elle est ${p.statut}`);
      }
    }
    assert.ok(loin > 0, "le voisinage doit contenir une parcelle rachetable non mitoyenne");
  });

  it("laisse acheter une parcelle libre même non mitoyenne", async () => {
    const { moi, parcelId, vue } = await fermeAvecVoisins("Voisin Loin");
    const chezMoi = vue.parcelles.find((p) => p.id === parcelId)!;
    const loin = vue.parcelles.find(
      (p) =>
        p.statut === "LIBRE" &&
        p.id !== parcelId &&
        Math.abs(p.mapX - chezMoi.mapX) + Math.abs(p.mapY - chezMoi.mapY) > 1,
    );
    assert.ok(loin, "il faut une parcelle libre non mitoyenne pour le test");

    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 400000, level: 20 },
      jeton: moi.jeton,
    });

    const achat = await appel(`/parcels/${loin.id}/buy`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(achat.statut, 200, `achat loin refusé : ${JSON.stringify(achat.corps)}`);
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const ids = (
      me.corps as unknown as { player: { farm: { parcels: { id: string }[] } } }
    ).player.farm.parcels.map((p) => p.id);
    assert.ok(ids.includes(loin.id), "la parcelle non mitoyenne n'est pas à la ferme");
  });

  it("laisse racheter la parcelle d'un voisin PNJ", async () => {
    /*
     * La moitié de la commune est déjà exploitée. Sans rachat, les quatre
     * voisins d'une ferme de départ sont souvent occupés, et le joueur
     * demande « est-ce qu'on va pouvoir acheter les parcelles voisines
     * bientôt ? ». On rachète au PNJ, jamais à un autre joueur.
     */
    const { moi, parcelId, vue } = await fermeAvecVoisins("Voisin Sept");
    const chezMoi = vue.parcelles.find((p) => p.id === parcelId)!;
    const voisine = vue.parcelles.find(
      (p) =>
        p.statut === "LIBRE" &&
        Math.abs(p.mapX - chezMoi.mapX) + Math.abs(p.mapY - chezMoi.mapY) === 1,
    );
    assert.ok(voisine, "il faut une parcelle libre mitoyenne pour le test");

    const npc = await inscrire("Exploitant Npc");
    await appel("/world/claim", {
      methode: "POST",
      corps: { userId: npc.id, specialization: "CEREALIER", parcelId: voisine.id },
      jeton: npc.jeton,
    });
    prismaExec(`UPDATE "User" SET "isNpc" = true WHERE id = '${npc.id}';`);

    await appel("/dev/grant", {
      methode: "POST",
      corps: { userId: moi.id, crd: 400000, level: 20 },
      jeton: moi.jeton,
    });

    const apres = await appel(`/parcels/${parcelId}/voisinage`, { jeton: moi.jeton });
    assert.equal(apres.statut, 200);
    const fiche = (
      apres.corps as unknown as {
        parcelles: { id: string; statut: string; prix: number | null; achetable: boolean }[];
      }
    ).parcelles.find((p) => p.id === voisine.id);
    assert.equal(fiche?.statut, "PNJ");
    assert.ok(fiche?.prix && fiche.prix > 0, "le devis du voisin PNJ manque");
    assert.equal(fiche?.achetable, true);

    const achat = await appel(`/parcels/${voisine.id}/buy`, {
      methode: "POST",
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(achat.statut, 200, `rachat PNJ refusé : ${JSON.stringify(achat.corps)}`);
    const me = await appel("/auth/me", { jeton: moi.jeton });
    const ids = (
      me.corps as unknown as { player: { farm: { parcels: { id: string }[] } } }
    ).player.farm.parcels.map((p) => p.id);
    assert.ok(ids.includes(voisine.id), "la parcelle rachetée n'est pas à la ferme");
  });

  it("refuse à qui n’a pas de session", async () => {
    const monde = await appel("/world/AUR");
    const id = (monde.corps as unknown as {
      regions: { parcels: { id: string }[] }[];
    }).regions[0]!.parcels[0]!.id;
    const r = await appel(`/parcels/${id}/voisinage`);
    assert.equal(r.statut, 401);
  });

  it("répond proprement sur une parcelle qui n’existe pas", async () => {
    const moi = await inscrire("Voisin Six");
    const r = await appel("/parcels/inexistante/voisinage", { jeton: moi.jeton });
    assert.equal(r.statut, 404);
  });
});
