/**
 * Le veilleur, éprouvé sur un faux Docker.
 *
 * Le conteneur du jeu a un contrôle de santé depuis longtemps ; rien ne s'en
 * servait. `restart: unless-stopped` ne relance qu'un conteneur qui **sort** —
 * un conteneur vivant mais figé reste figé. Mesuré le 26 août : plus une
 * réponse à partir de 20 h 12, la poignée de main TLS aboutissait mais
 * `/api/health` ne répondait jamais, et rien n'avait bougé une heure et demie
 * plus tard.
 *
 * Ce que ce fichier vérifie tient en quatre décisions, et chacune a un coût
 * réel si elle se perd :
 *
 *  - relancer quand c'est `unhealthy` — sinon le veilleur ne sert à rien ;
 *  - **ne pas** relancer sur `starting` — l'amorçage du monde dure jusqu'à
 *    cinq minutes, et un veilleur zélé empêcherait le jeu de démarrer, pour
 *    toujours ;
 *  - **ne pas** relancer sur `healthy` — évident, et c'est ce qui rend le
 *    reste sûr ;
 *  - respecter le délai de garde — une machine qui s'effondre rendra le
 *    conteneur malade aussitôt après, et une relance en boucle ajouterait au
 *    désordre en effaçant la trace de ce qui se passe.
 *
 * Le faux `docker` est un script shell posé en tête de `PATH` : il répond ce
 * qu'on lui dit de répondre et note ce qu'on lui a demandé. Le veilleur ne
 * sait pas qu'il n'est pas sur le VPS.
 */
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const VEILLEUR = join(RACINE, "deploy", "farmsim-veilleur.sh");

let bac;

/** Pose un faux `docker` qui répond `etat` et journalise ses appels. */
function fauxDocker(etat) {
  const bin = join(bac, "bin");
  mkdirSync(bin, { recursive: true });
  const journal = join(bac, "appels.txt");
  writeFileSync(
    join(bin, "docker"),
    `#!/bin/sh
echo "$@" >> ${JSON.stringify(journal)}
case "$1" in
  inspect) printf '%s' ${JSON.stringify(etat)} ;;
  logs) echo "(journal du conteneur)" ;;
  restart) ;;
esac
exit 0
`,
  );
  chmodSync(join(bin, "docker"), 0o755);
  // `timeout` est appelé par le veilleur : il doit trouver notre faux docker.
  return { bin, journal };
}

function lancer(etat, { marque = null } = {}) {
  const { bin, journal } = fauxDocker(etat);
  const fichierMarque = join(bac, "derniere-relance");
  if (marque !== null) writeFileSync(fichierMarque, String(marque));
  const sortie = execFileSync("bash", [VEILLEUR], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      FARMSIM_CONTENEUR: "farmsim",
      FARMSIM_VEILLEUR_MARQUE: fichierMarque,
      FARMSIM_VEILLEUR_REPOS: "600",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const appels = existsSync(journal) ? readFileSync(journal, "utf8") : "";
  return { sortie, appels, fichierMarque };
}

describe("le veilleur", () => {
  beforeEach(() => {
    bac = mkdtempSync(join(tmpdir(), "veilleur-"));
  });
  after(() => {
    if (bac) rmSync(bac, { recursive: true, force: true });
  });

  it("relance un conteneur malade", () => {
    const { appels, fichierMarque } = lancer("unhealthy");
    assert.match(appels, /^restart farmsim$/m);
    // La trace d'abord : relancer efface ce qui a figé le processus.
    assert.match(appels, /logs --tail=100 farmsim/);
    assert.ok(existsSync(fichierMarque), "la relance doit être datée");
  });

  it("laisse tranquille un conteneur en bonne santé", () => {
    const { appels } = lancer("healthy");
    assert.doesNotMatch(appels, /restart/);
  });

  it("laisse démarrer un conteneur qui s’amorce", () => {
    // L'amorçage du monde dure jusqu'à cinq minutes (start_period: 300s).
    // Relancer là-dessus l'empêcherait de finir, à chaque fois.
    const { appels } = lancer("starting");
    assert.doesNotMatch(appels, /restart/);
  });

  it("ne relance pas deux fois dans le délai de garde", () => {
    const ilYAUneMinute = Math.floor(Date.now() / 1000) - 60;
    const { appels, sortie } = lancer("unhealthy", { marque: ilYAUneMinute });
    assert.doesNotMatch(appels, /restart/);
    assert.match(sortie + "", /toujours malade|on attend|^$/m);
  });

  it("relance de nouveau une fois le délai passé", () => {
    const ilYALongtemps = Math.floor(Date.now() / 1000) - 3600;
    const { appels } = lancer("unhealthy", { marque: ilYALongtemps });
    assert.match(appels, /^restart farmsim$/m);
  });

  it("ne touche pas à un conteneur sans contrôle de santé", () => {
    const { appels } = lancer("sans-controle");
    assert.doesNotMatch(appels, /restart/);
  });

  it("survit à une marque illisible plutôt que de rester bloqué", () => {
    // Un fichier corrompu ne doit pas condamner le jeu à rester figé.
    const { appels } = lancer("unhealthy", { marque: "n'importe quoi" });
    assert.match(appels, /^restart farmsim$/m);
  });
});

describe("le déploiement pose le veilleur", () => {
  const DEPLOY = readFileSync(join(RACINE, "scripts", "vps-deploy.sh"), "utf8");

  it("installe le service et allume la minuterie", () => {
    assert.match(DEPLOY, /install -m 0755 .*farmsim-veilleur\.sh.* \/usr\/local\/bin\/farmsim-veilleur/);
    assert.match(DEPLOY, /systemctl enable --now farmsim-veilleur\.timer/);
  });

  it("le fait à chaque déploiement, sans condition d’état", () => {
    // C'est ce qui le répare si quelqu'un l'a désactivé, ou si le fichier a
    // changé : un veilleur posé une seule fois se serait périmé en silence.
    assert.match(DEPLOY, /systemctl daemon-reload/);
  });

  it("ne fait pas échouer le déploiement là où systemd n’existe pas", () => {
    assert.match(DEPLOY, /command -v systemctl >\/dev\/null 2>&1/);
    assert.match(DEPLOY, /veilleur non posé/);
  });
});
