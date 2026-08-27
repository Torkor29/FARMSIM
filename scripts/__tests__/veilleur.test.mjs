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

/**
 * Pose un faux `docker` qui rejoue un état de pile et journalise ses appels.
 *
 * Le veilleur interroge deux choses par conteneur — `.State.Status` et
 * `.State.Health.Status` — et il les interroge pour `farmsim-db` **puis**
 * `farmsim`. Le faux répond aux deux gabarits, pour les deux noms.
 */
function fauxDocker(pile) {
  const bin = join(bac, "bin");
  mkdirSync(bin, { recursive: true });
  const journal = join(bac, "appels.txt");
  const reponse = (nom, gabarit) => {
    const c = pile[nom];
    if (!c) return "";
    return gabarit.includes("Health") ? c.sante : c.etat;
  };
  const cas = Object.keys(pile)
    .map(
      (nom) => `    ${nom}) case "$gabarit" in
      *Health*) printf '%s' ${JSON.stringify(reponse(nom, "Health"))} ;;
      *) printf '%s' ${JSON.stringify(reponse(nom, "Status"))} ;;
    esac ;;`,
    )
    .join("\n");
  writeFileSync(
    join(bin, "docker"),
    `#!/bin/sh
echo "$@" >> ${JSON.stringify(journal)}
case "$1" in
  inspect)
    gabarit="$3"
    case "$4" in
${cas}
    esac ;;
  logs) echo "(journal du conteneur)" ;;
esac
exit 0
`,
  );
  chmodSync(join(bin, "docker"), 0o755);
  return { bin, journal };
}

/**
 * @param pile   { farmsim: {etat, sante}, "farmsim-db": {...} }
 * @param marque horodatage de la dernière intervention sur `farmsim`
 */
function lancer(pile, { marque = null, conteneurs = "farmsim" } = {}) {
  const { bin, journal } = fauxDocker(pile);
  const marques = join(bac, "marques");
  mkdirSync(marques, { recursive: true });
  if (marque !== null) writeFileSync(join(marques, "derniere-relance-farmsim"), String(marque));
  // Les refus du veilleur partent sur la sortie d'erreur — c'est là que
  // systemd les attend. Le test doit donc lire les deux flux.
  const sortie = execFileSync("bash", ["-c", `bash ${JSON.stringify(VEILLEUR)} 2>&1`], {
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      FARMSIM_VEILLEUR_CONTENEURS: conteneurs,
      FARMSIM_VEILLEUR_MARQUES: marques,
      FARMSIM_VEILLEUR_REPOS: "600",
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const appels = existsSync(journal) ? readFileSync(journal, "utf8") : "";
  return { sortie, appels, marques };
}

/** Raccourci : un seul conteneur `farmsim` dans l'état demandé. */
const seul = (etat, sante) => ({ farmsim: { etat, sante } });

describe("le veilleur", () => {
  beforeEach(() => {
    bac = mkdtempSync(join(tmpdir(), "veilleur-"));
  });
  after(() => {
    if (bac) rmSync(bac, { recursive: true, force: true });
  });

  it("relance un conteneur vivant mais malade", () => {
    const { appels, marques } = lancer(seul("running", "unhealthy"));
    assert.match(appels, /^restart farmsim$/m);
    // La trace d'abord : relancer efface ce qui a figé le processus.
    assert.match(appels, /logs --tail=100 farmsim/);
    assert.ok(existsSync(join(marques, "derniere-relance-farmsim")));
  });

  it("démarre un conteneur resté à l’état « created »", () => {
    // C'est l'état où une fenêtre SSH coupée en plein `--force-recreate` a
    // laissé `farmsim-db` : créé, jamais démarré. `restart: unless-stopped`
    // ne le voit pas — il ne relance que ce qui *sort* — et un `created`
    // n'est pas `unhealthy` non plus.
    const { appels } = lancer(seul("created", "sans-controle"));
    assert.match(appels, /^start farmsim$/m);
  });

  it("démarre aussi un conteneur sorti, mort ou en pause", () => {
    for (const etat of ["exited", "dead", "paused"]) {
      bac = mkdtempSync(join(tmpdir(), "veilleur-"));
      const { appels } = lancer(seul(etat, "sans-controle"));
      assert.match(appels, /^start farmsim$/m, `état ${etat}`);
    }
  });

  it("laisse tranquille un conteneur en bonne santé", () => {
    const { appels } = lancer(seul("running", "healthy"));
    assert.doesNotMatch(appels, /restart|start farmsim/);
  });

  it("laisse démarrer un conteneur qui s’amorce", () => {
    // L'amorçage du monde dure jusqu'à cinq minutes (start_period: 300s).
    // Relancer là-dessus l'empêcherait de finir, à chaque fois.
    const { appels } = lancer(seul("running", "starting"));
    assert.doesNotMatch(appels, /restart|start farmsim/);
  });

  it("ne touche pas à un conteneur qui tourne sans contrôle de santé", () => {
    const { appels } = lancer(seul("running", "sans-controle"));
    assert.doesNotMatch(appels, /restart|start farmsim/);
  });

  it("ignore un conteneur qui n’existe pas plutôt que de l’inventer", () => {
    // Ce n'est pas au veilleur de créer une pile : un déploiement le fera,
    // avec sa configuration.
    const { appels } = lancer({}, { conteneurs: "farmsim" });
    assert.doesNotMatch(appels, /restart|start/);
  });

  it("ne rejoue pas dans le délai de garde", () => {
    const ilYAUneMinute = Math.floor(Date.now() / 1000) - 60;
    const { appels, sortie } = lancer(seul("running", "unhealthy"), { marque: ilYAUneMinute });
    assert.doesNotMatch(appels, /restart/);
    assert.match(sortie, /on attend/);
  });

  it("rejoue une fois le délai passé", () => {
    const ilYALongtemps = Math.floor(Date.now() / 1000) - 3600;
    const { appels } = lancer(seul("running", "unhealthy"), { marque: ilYALongtemps });
    assert.match(appels, /^restart farmsim$/m);
  });

  it("survit à une marque illisible plutôt que de rester bloqué", () => {
    const { appels } = lancer(seul("running", "unhealthy"), { marque: "n'importe quoi" });
    assert.match(appels, /^restart farmsim$/m);
  });
});

describe("le veilleur surveille les deux conteneurs", () => {
  beforeEach(() => {
    bac = mkdtempSync(join(tmpdir(), "veilleur-"));
  });

  it("remonte la base avant le jeu", () => {
    // Une base tombée suffit à rendre le jeu inutilisable sans qu'il s'en
    // aperçoive : son contrôle de santé ne la regarde pas. La remonter en
    // premier évite de relancer le jeu une seconde fois pour qu'il la
    // retrouve.
    const { appels } = lancer(
      { "farmsim-db": { etat: "created", sante: "sans-controle" }, farmsim: { etat: "exited", sante: "sans-controle" } },
      { conteneurs: "farmsim-db farmsim" },
    );
    const rangDb = appels.indexOf("start farmsim-db");
    const rangJeu = appels.search(/^start farmsim$/m);
    assert.ok(rangDb > -1, "la base doit être démarrée");
    assert.ok(rangJeu > -1, "le jeu doit être démarré");
    assert.ok(rangDb < rangJeu, "la base doit passer avant le jeu");
  });

  it("agit sur la base même quand le jeu va bien", () => {
    // C'est très exactement l'état du 26 août à 23 h : jeu debout et « sain »,
    // base absente, toutes les routes en 500.
    const { appels } = lancer(
      { "farmsim-db": { etat: "created", sante: "sans-controle" }, farmsim: { etat: "running", sante: "healthy" } },
      { conteneurs: "farmsim-db farmsim" },
    );
    assert.match(appels, /^start farmsim-db$/m);
    assert.doesNotMatch(appels, /^(re)?start farmsim$/m);
  });

  it("tient un délai de garde par conteneur, pas un pour tous", () => {
    // Sans cela, relancer la base condamnerait le jeu à attendre dix minutes.
    const ilYAUneMinute = Math.floor(Date.now() / 1000) - 60;
    const marques = join(bac, "marques");
    mkdirSync(marques, { recursive: true });
    writeFileSync(join(marques, "derniere-relance-farmsim-db"), String(ilYAUneMinute));
    const { bin, journal } = fauxDocker({
      "farmsim-db": { etat: "created", sante: "sans-controle" },
      farmsim: { etat: "exited", sante: "sans-controle" },
    });
    execFileSync("bash", [VEILLEUR], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FARMSIM_VEILLEUR_CONTENEURS: "farmsim-db farmsim",
        FARMSIM_VEILLEUR_MARQUES: marques,
        FARMSIM_VEILLEUR_REPOS: "600",
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const appels = existsSync(journal) ? readFileSync(journal, "utf8") : "";
    assert.doesNotMatch(appels, /start farmsim-db/, "la base est au repos");
    assert.match(appels, /^start farmsim$/m, "le jeu, lui, doit repartir");
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
