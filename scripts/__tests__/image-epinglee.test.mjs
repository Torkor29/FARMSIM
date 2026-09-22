/**
 * L'image déployée est épinglée dans `.env`.
 *
 * ## Le piège que ceci referme
 *
 * `.env` portait `FARMSIM_IMAGE=ghcr.io/…/farmsim:main` — une cible mouvante.
 * Le déploiement, lui, tire l'image par l'empreinte du commit, mais ne l'y
 * écrivait pas : il se contentait de l'exporter pour son propre
 * `docker compose`.
 *
 * Conséquence, un jour de dépannage : un `docker compose up -d` tapé à la
 * main ne retélécharge rien et repart de l'image `:main` posée sur le disque,
 * qui peut avoir plusieurs déploiements de retard. La base, elle, porte déjà
 * les migrations du dernier. Une image ancienne y trouve des migrations
 * qu'elle ne connaît pas, `prisma migrate deploy` refuse de continuer, le
 * processus sort, Docker relance — le site tombe sur un geste anodin.
 *
 * Ce n'est pas une crainte d'école : le retrait du code de secours a supprimé
 * deux colonnes de `User`. Une image d'avant, relancée sur cette base-là, ne
 * démarrerait pas.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, statSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEPLOY = readFileSync(join(RACINE, "scripts", "vps-deploy.sh"), "utf8");

/** Rejoue la fonction du script sur un `.env` jetable, et rend son contenu. */
function epingler(depart, ...images) {
  const dir = mkdtempSync(join(tmpdir(), "farmsim-env-"));
  const env = join(dir, ".env");
  writeFileSync(env, depart);
  chmodSync(env, 0o600);
  // La fonction est extraite du script lui-même : un test qui recopierait son
  // corps validerait sa propre copie, et laisserait le script dériver.
  const corps = DEPLOY.match(/epingler_image\(\) \{[\s\S]*?\n\}/);
  assert.ok(corps, "la fonction epingler_image a disparu du script de déploiement");
  const appels = images.map((i) => `epingler_image ${JSON.stringify(i)}`).join("\n");
  execFileSync("bash", ["-c", `cd ${JSON.stringify(dir)}\n${corps[0]}\n${appels}`]);
  return { contenu: readFileSync(env, "utf8"), droits: statSync(env).mode & 0o777 };
}

describe("le déploiement", () => {
  it("écrit l'image dans .env, et ne se contente pas de l'exporter", () => {
    assert.match(DEPLOY, /epingler_image "\$FARMSIM_IMAGE"/);
    // Et le dit à l'écran : un déploiement qui modifie `.env` en silence
    // surprendrait celui qui vient d'y poser ses identifiants à la main.
    assert.match(DEPLOY, /épinglée dans \.env/);
  });
});

describe("l'épinglage", () => {
  const DEPART = "FARMSIM_DB_PASSWORD=secret\nFARMSIM_IMAGE=ghcr.io/x/farmsim:main\nFARMSIM_SMTP_PASS=mdp\n";

  it("remplace la ligne au lieu d'en ajouter une seconde", () => {
    /*
     * Deux lignes `FARMSIM_IMAGE=` et c'est la dernière qui gagne : ça
     * marcherait, jusqu'au jour où quelqu'un relit le fichier et corrige la
     * première.
     */
    const { contenu } = epingler(DEPART, "ghcr.io/x/farmsim:abc123");
    const lignes = contenu.split("\n").filter((l) => l.startsWith("FARMSIM_IMAGE="));
    assert.deepEqual(lignes, ["FARMSIM_IMAGE=ghcr.io/x/farmsim:abc123"]);
  });

  it("ne touche à rien d'autre — le fichier porte des secrets", () => {
    const { contenu } = epingler(DEPART, "ghcr.io/x/farmsim:abc123");
    assert.match(contenu, /^FARMSIM_DB_PASSWORD=secret$/m);
    assert.match(contenu, /^FARMSIM_SMTP_PASS=mdp$/m);
  });

  it("garde les droits du fichier", () => {
    // `mv` d'un fichier temporaire aurait apporté les droits du `mktemp` ;
    // un `.env` lisible par tous est un mot de passe de base de données
    // lisible par tous.
    const { droits } = epingler(DEPART, "ghcr.io/x/farmsim:abc123");
    assert.equal(droits, 0o600);
  });

  it("ajoute la ligne quand elle manque", () => {
    const { contenu } = epingler("A=1\n", "ghcr.io/x/farmsim:abc123");
    assert.match(contenu, /^A=1$/m);
    assert.match(contenu, /^FARMSIM_IMAGE=ghcr\.io\/x\/farmsim:abc123$/m);
  });

  it("se rejoue sans se dédoubler", () => {
    // Deux déploiements de suite, c'est le cas courant.
    const { contenu } = epingler(DEPART, "ghcr.io/x/farmsim:abc123", "ghcr.io/x/farmsim:def456");
    const lignes = contenu.split("\n").filter((l) => l.startsWith("FARMSIM_IMAGE="));
    assert.deepEqual(lignes, ["FARMSIM_IMAGE=ghcr.io/x/farmsim:def456"]);
  });
});
