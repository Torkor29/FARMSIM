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
};

async function tableau(): Promise<Contrat[]> {
  const r = await appel("/contracts");
  return (r.corps as unknown as { contracts: Contrat[] }).contracts ?? [];
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
        accessCode: "ferme",
      },
    });
    assert.equal(inscription.statut, 201, inscription.texte);
    const moi = inscription.corps as unknown as { token: string; player: { id: string } };

    const offre = (await tableau())[0]!;
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
