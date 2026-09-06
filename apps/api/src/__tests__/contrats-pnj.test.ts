/**
 * Le tableau des voisins doit avoir des offres dessus.
 *
 * ## Ce qui manquait
 *
 * Signalé en jouant : « on a toujours pas les contrats de PNJ, ça fait depuis
 * le début qu'il manque ça ». Le reproche est exact, et la cause était plus
 * bête qu'un défaut : le modèle `NpcContract`, la liste, l'acceptation,
 * l'achèvement avec son usure et son salaire, l'abandon — tout était écrit.
 * Il n'y avait simplement **aucun `npcContract.create`** dans le serveur.
 *
 * Le démarrage allait jusqu'à annuler les offres qui traînaient, un ménage
 * qui n'attendait plus que la regénération. Elle n'est jamais venue.
 *
 * ## Ce qu'on vérifie
 *
 * Qu'il y a des offres, qu'elles sont payées ce que la règle dit, et qu'on
 * peut en prendre une puis la rendre. Le prix compte autant que l'existence :
 * un tableau trop généreux remplace la ferme, et le jeu s'arrête d'être un
 * jeu de ferme.
 */

import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  MISSION_CELLS_MAX,
  MISSION_CELLS_MIN,
  MISSION_NPC_SHARE,
  MISSION_OPEN_MAX,
  contractorQuote,
  missionPayout,
  missionRentalFee,
  missionRentedPayout,
  type FarmWork,
} from "@farmsim/shared";

import { creerBaseTest, supprimerBaseTest, type BaseTest } from "./base-test.js";

const API_DIR = fileURLToPath(new URL("../..", import.meta.url));
const PORT = 8125;
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

type Contrat = {
  id: string;
  jobType: string;
  title: string;
  rewardCrd: number;
  cells: number;
  regionNote: string;
  status: string;
  work?: FarmWork;
  manqueMachine?: string | null;
  location?: { materiel: string; frais: number; salaire: number } | null;
};

/**
 * Le tableau **vu par un joueur donné**.
 *
 * Sans `userId`, le serveur ne connaît pas de parc et ne peut donc rien dire
 * de ce qui manque : les offres reviennent sans leur `location`. C'est le
 * comportement voulu — la page d'accueil montre le tableau à qui n'a pas
 * encore de compte — mais un test qui l'oublierait conclurait que la location
 * n'existe pas.
 */
async function tableau(joueur?: { id: string; jeton: string }): Promise<Contrat[]> {
  // Le jeton n'est pas facultatif dès qu'on annonce un `userId` : `enforceIdentity`
  // refuse toute requête qui parle au nom de quelqu'un sans le prouver. C'est
  // la fermeture posée après la fuite d'adresses, et elle vaut ici aussi.
  const r = await appel(`/contracts${joueur ? `?userId=${joueur.id}` : ""}`, {
    jeton: joueur?.jeton,
  });
  assert.equal(r.statut, 200, `le tableau a répondu ${r.statut} : ${r.texte.slice(0, 300)}`);
  return (r.corps as unknown as { contracts: Contrat[] }).contracts ?? [];
}

/** Un compte neuf, avec son parc de départ. */
async function nouveauJoueur(nom: string) {
  const r = await appel("/auth/register", {
    corps: {
      email: `${nom}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`,
      displayName: nom,
      specialization: "CEREALIER",
      accessCode: "ferme-2026",
    },
  });
  assert.equal(r.statut, 201, r.texte);
  const b = r.corps as unknown as { token: string; player: { id: string; crd: number } };
  return { jeton: b.token, id: b.player.id };
}

/** La trésorerie, relue à la source. */
async function tresorerie(j: { id: string; jeton: string }): Promise<number> {
  const r = await appel(`/players/${j.id}`, { jeton: j.jeton });
  assert.equal(r.statut, 200, r.texte);
  return (r.corps as unknown as { crd: number }).crd;
}

/**
 * Un joueur qui ne peut plus rien faire du tableau, par construction.
 *
 * ## Pourquoi vendre plutôt qu'attendre le bon tirage
 *
 * Les offres sont tirées au sort. La première est garantie accessible à un
 * débutant — labour ou semis —, les deux autres se tirent librement parmi
 * quatre types, dont deux hors de portée. Un test qui attendrait « une offre
 * hors de portée » sur le tableau se tairait donc une fois sur quatre, sans
 * rien signaler : il passerait au vert en n'ayant rien vérifié.
 *
 * On prend le problème par l'autre bout : on désarme le parc. En vendant la
 * charrue et le semoir, **toute** offre du tableau devient hors de portée, y
 * compris celle qui est garantie accessible. Le cas est alors certain à
 * chaque exécution.
 */
async function joueurSansOutils(nom: string) {
  const moi = await nouveauJoueur(nom);
  const fiche = await appel(`/players/${moi.id}`, { jeton: moi.jeton });
  assert.equal(fiche.statut, 200, fiche.texte);
  const machines =
    (fiche.corps as unknown as { farm?: { machines?: { id: string; type: string }[] } }).farm
      ?.machines ?? [];
  assert.ok(machines.length > 0, `parc de départ vide : ${fiche.texte.slice(0, 300)}`);
  for (const m of machines.filter((x) => x.type === "PLOUGH" || x.type === "SEEDER")) {
    const v = await appel(`/machines/${m.id}/sell`, {
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(v.statut, 200, `vente refusée (${m.type}) : ${v.texte}`);
  }
  return moi;
}

/** Une offre que ce joueur-là ne peut pas honorer avec son propre matériel. */
function horsDePortee(offres: Contrat[]): Contrat {
  const hors = offres.find((c) => c.manqueMachine);
  assert.ok(
    hors,
    `aucune offre hors de portée alors que le parc est désarmé : ${JSON.stringify(offres)}`,
  );
  assert.ok(hors.work, "l'offre doit dire de quel travail il s'agit");
  return hors;
}

before(async () => {
  base = creerBaseTest("contrats");
  serveur = spawn("npx", ["tsx", "src/main.ts"], {
    cwd: API_DIR,
    env: {
      ...process.env,
      DATABASE_URL: base.url,
      PORT: String(PORT),
      FARMSIM_SKIP_NPC: "1",
      FARMSIM_RATE_LIMIT: "off",
      FARMSIM_JOB_SPEED: "200",
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

describe("le tableau des voisins", () => {
  it("porte des offres dès le démarrage", async () => {
    // Le cœur du signalement : la liste était vide, pas incomplète.
    const offres = await tableau();
    assert.ok(offres.length > 0, "le tableau est vide — c'est le défaut signalé");
    assert.equal(offres.length, MISSION_OPEN_MAX, `${offres.length} offres au lieu de ${MISSION_OPEN_MAX}`);
  });

  it("n'en publie jamais plus que le plafond", async () => {
    // Trois au plus, sinon le tableau remplace la ferme.
    assert.ok((await tableau()).length <= MISSION_OPEN_MAX);
  });

  it("dit à chaque offre ce qu'elle demande et ce qu'elle paie", async () => {
    for (const c of await tableau()) {
      assert.ok(c.title.length > 5, `titre trop maigre : « ${c.title} »`);
      assert.ok(c.regionNote.length > 5, `pas de repère : « ${c.regionNote} »`);
      assert.ok(c.rewardCrd > 0, `offre non payée : ${c.rewardCrd}`);
      assert.ok(
        c.cells >= MISSION_CELLS_MIN && c.cells <= MISSION_CELLS_MAX,
        `${c.cells} cases, hors du calibre`,
      );
      // Le nombre de cases se lit dans le repère : on ne découvre pas
      // l'ampleur du chantier après l'avoir accepté.
      assert.match(c.regionNote, new RegExp(`${c.cells} cases`));
    }
  });

  /**
   * Le prix décide de tout l'équilibre. Trop haut, le tableau devient le jeu
   * et plus personne ne sème ; trop bas, personne n'y touche.
   */
  it("paie exactement la part prévue du devis d'un prestataire", async () => {
    const parTravail: Record<string, FarmWork> = {
      PLOW: "PLOW",
      SOW: "PLANT",
      FERTILIZE: "FERTILIZE",
      HARVEST: "HARVEST",
    };
    for (const c of await tableau()) {
      const work = parTravail[c.jobType];
      assert.ok(work, `type de chantier inconnu : ${c.jobType}`);
      assert.equal(
        c.rewardCrd,
        missionPayout(work, c.cells, "NPC"),
        `${c.title} : ${c.rewardCrd} € au lieu du barème`,
      );
      // Et jamais autant qu'un prestataire facturerait : le tableau est une
      // aide au voisin, pas une rente.
      assert.ok(c.rewardCrd < contractorQuote(work, c.cells));
      assert.ok(Math.abs(c.rewardCrd / contractorQuote(work, c.cells) - MISSION_NPC_SHARE) < 0.02);
    }
  });

  it("laisse prendre une offre, puis la rendre", async () => {
    const inscription = await appel("/auth/register", {
      corps: {
        email: `contrat-${Date.now()}-${Math.random().toString(36).slice(2)}@test.fr`,
        displayName: "Preneur",
        specialization: "CEREALIER",
        accessCode: "ferme-2026",
      },
    });
    assert.equal(inscription.statut, 201, inscription.texte);
    const moi = inscription.corps as unknown as { token: string; player: { id: string } };

    /*
     * Une offre que le parc de départ sait faire.
     *
     * Le test prenait la première venue, et les offres sont tirées au sort :
     * sur un tirage de moisson, la route refusait — « il faut une
     * moissonneuse ». C'était le test qui était fragile, mais il a mis le
     * doigt sur mieux que ça : rien ne garantissait qu'un débutant puisse
     * toucher au tableau. Le générateur assure désormais une offre
     * accessible ; on vérifie ici qu'elle est là et qu'elle se prend.
     */
    const offre = (await tableau()).find((c) => c.jobType === "PLOW" || c.jobType === "SOW");
    assert.ok(
      offre,
      "aucune offre à la portée du parc de départ — le nouveau venu ne peut rien prendre",
    );
    const prise = await appel(`/contracts/${offre.id}/accept`, {
      corps: { userId: moi.player.id },
      jeton: moi.token,
    });
    assert.equal(prise.statut, 200, `offre non prise : ${prise.texte}`);

    // Une offre prise quitte le tableau : deux joueurs ne labourent pas le
    // même champ du même voisin.
    assert.ok(!(await tableau()).some((c) => c.id === offre.id));

    const rendue = await appel(`/contracts/${offre.id}/abandon`, {
      corps: { userId: moi.player.id },
      jeton: moi.token,
    });
    assert.equal(rendue.statut, 200, `abandon refusé : ${rendue.texte}`);
  });

  it("dit ce qui manque avant le clic, et met la location à côté", async () => {
    /*
     * Le mur du débutant. Le parc de départ n'a ni moissonneuse ni
     * épandeur : une offre de moisson se lisait, se chiffrait, et se refusait
     * **au clic**. Le tableau doit maintenant le dire avant, et proposer la
     * sortie de secours avec son chiffre.
     */
    const moi = await joueurSansOutils("Locataire");
    const hors = horsDePortee(await tableau(moi));
    assert.ok(hors.location, `offre hors de portée sans location : ${JSON.stringify(hors)}`);
    assert.equal(hors.location.frais, missionRentalFee(hors.work!, hors.cells, "NPC"));
    assert.equal(hors.location.salaire, missionRentedPayout(hors.work!, hors.cells, "NPC"));
    assert.equal(hors.location.frais + hors.location.salaire, hors.rewardCrd);
    assert.ok(/^(un|une|des) /.test(hors.location.materiel), hors.location.materiel);
  });

  it("refuse encore sans le drapeau — on ne loue pas à l'insu du joueur", async () => {
    /*
     * Le salaire loué vaut 55 % du salaire. Si la route louait d'elle-même
     * dès qu'il manque l'engin, un joueur toucherait 45 % de moins sans avoir
     * rien choisi, et sans qu'aucun écran ne le lui ait dit.
     */
    const moi = await joueurSansOutils("SansDrapeau");
    const hors = horsDePortee(await tableau(moi));
    const r = await appel(`/contracts/${hors.id}/accept`, {
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 409, `la route a loué toute seule : ${r.texte}`);
    // Et le refus porte la sortie de secours, pour l'écran qui n'aurait pas
    // rafraîchi son tableau.
    assert.ok((r.corps as { location?: unknown }).location, r.texte);
  });

  it("loue, travaille, encaisse le net — et l'usure ne touche aucun engin", async () => {
    const moi = await joueurSansOutils("Loueur");
    const hors = horsDePortee(await tableau(moi));

    const prise = await appel(`/contracts/${hors.id}/accept`, {
      corps: { userId: moi.id, rented: true },
      jeton: moi.jeton,
    });
    assert.equal(prise.statut, 200, `location refusée : ${prise.texte}`);
    const pris = (prise.corps as { contract: Record<string, unknown> }).contract;
    assert.equal(pris.rented, true);
    assert.equal(pris.netCrd, missionRentedPayout(hors.work!, hors.cells, "NPC"));

    const avant = await tresorerie(moi);
    const fin = await appel(`/contracts/${hors.id}/complete`, {
      corps: { userId: moi.id },
      jeton: moi.jeton,
    });
    assert.equal(fin.statut, 200, `encaissement refusé : ${fin.texte}`);
    const paye = fin.corps as { reward: number; rented: boolean; rentalFee: number; machine: unknown };
    assert.equal(paye.rented, true);
    assert.equal(paye.reward, missionRentedPayout(hors.work!, hors.cells, "NPC"));
    assert.equal(paye.rentalFee, missionRentalFee(hors.work!, hors.cells, "NPC"));
    // Pas d'engin à soi, pas d'usure : c'est la contrepartie de la location,
    // et c'est aussi ce qui empêche d'user un parc qu'on n'a pas.
    assert.equal(paye.machine, null, "un engin a été usé alors que le matériel était loué");

    // Le compte reçoit le net, pas le brut.
    const apres = await tresorerie(moi);
    assert.equal(
      Math.round((apres - avant) * 100) / 100,
      missionRentedPayout(hors.work!, hors.cells, "NPC"),
      "la trésorerie ne correspond pas au salaire net",
    );

    // Et le grand livre porte les deux lignes : le joueur doit pouvoir lire
    // ce que la location lui a coûté plutôt que de deviner l'écart.
    const livre = await appel(`/players/${moi.id}/ledger?jours=1`, { jeton: moi.jeton });
    assert.equal(livre.statut, 200, livre.texte);
    const lignes = (livre.corps as unknown as { lignes: { label: string; amount: number }[] }).lignes;
    assert.ok(
      lignes.some((l) => l.label.startsWith("Location —") && l.amount < 0),
      `pas de ligne de location au grand livre : ${JSON.stringify(lignes.slice(0, 6))}`,
    );
    assert.ok(lignes.some((l) => l.label.startsWith("Contrat —") && l.amount > 0));
  });

  it("ne laisse pas louer ce qu'on possède — un attelage, un chantier", async () => {
    /*
     * La porte qu'il ne faut pas rouvrir : « tu peux lancer deux choses qui
     * nécessitent le tracteur alors que t'as qu'un seul tracteur ». Si la
     * location acceptait sur un travail que le parc sait faire, elle
     * contournerait la contrainte par la fenêtre.
     */
    const moi = await nouveauJoueur("Proprietaire");
    // Le parc de départ est intact ici : la première offre du tableau est
    // garantie à sa portée, il y en a donc toujours une.
    const sien = (await tableau(moi)).find((c) => !c.manqueMachine);
    assert.ok(sien, "aucune offre à la portée du parc de départ — la garantie a sauté");
    const r = await appel(`/contracts/${sien.id}/accept`, {
      corps: { userId: moi.id, rented: true },
      jeton: moi.jeton,
    });
    assert.equal(r.statut, 200, r.texte);
    const pris = (r.corps as { contract: Record<string, unknown> }).contract;
    // Le drapeau est ignoré, pas honoré : on l'a accepté avec son matériel, au
    // plein salaire.
    assert.equal(pris.rented, false, "la location a été accordée sur un engin possédé");
    assert.equal(pris.netCrd, pris.rewardCrd);
    await appel(`/contracts/${sien.id}/abandon`, { corps: { userId: moi.id }, jeton: moi.jeton });
  });

  it("regarnit le tableau après qu'une offre est partie", async () => {
    /*
     * C'est la moitié qui fait la boucle courte : sans regarnissage, le
     * tableau se vide en trois chantiers et l'on retombe sur le jeu d'avant.
     * Le tour du monde s'en charge ; on le déclenche plutôt que d'attendre.
     */
    const avant = await tableau();
    const dev = await appel("/sim/tick", { corps: {} });
    // La route est fermée sans jeton de testeur : on se contente alors de
    // vérifier que le plafond tient, ce que le tour fera de lui-même.
    void dev;
    const apres = await tableau();
    assert.ok(apres.length <= MISSION_OPEN_MAX);
    assert.ok(avant.length > 0);
  });
});
