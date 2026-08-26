/**
 * Le déploiement sur le VPS.
 *
 * Mesuré le 26 août 2026, run 33013537990 : tests verts, image publiée, et
 * la session SSH coupée à quarante minutes **pendant la sauvegarde**.
 * Chronologie sur une machine à 14 de charge, 1 Go de swap, disque à 27 % :
 *
 *   10 min  ménage Docker (`prune` borné, place inchangée)
 *    7 min  `docker exec` pour compter les migrations (base déjà à jour)
 *   15 min  instantané **sans** relecture, borne atteinte
 *    5 min  **second** instantané, identique, jusqu'à la coupure SSH
 *
 * L'image n'a jamais été tirée. Rien de tout cela ne protégeait d'une
 * migration : il n'y en avait pas.
 *
 * Ce fichier tient les trois décisions qui cassent cette chaîne. Relire le
 * script ne dit pas ce que bash en comprendra ; `bash -n` le fait, et les
 * motifs ci-dessous disent **où** les décisions tiennent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(RACINE, "scripts", "vps-deploy.sh");
const WORKFLOW = join(RACINE, ".github", "workflows", "deploy.yml");

const DEPLOI = readFileSync(SCRIPT, "utf8");
const ACTION = readFileSync(WORKFLOW, "utf8");

describe("le script de déploiement est du bash", () => {
  it("passe `bash -n`", () => {
    execFileSync("bash", ["-n", SCRIPT], { stdio: "pipe" });
  });
});

describe("le ménage Docker ne se paie que si le disque est plein", () => {
  it("mesure l'occupation avant de lancer les prune", () => {
    const avant = DEPLOI.indexOf("Place disque avant ménage");
    const prune = DEPLOI.indexOf("docker builder prune");
    const seuil = DEPLOI.indexOf("occupe_pct < 70");
    assert.ok(avant > 0 && prune > avant, "le prune vient après la mesure");
    assert.ok(seuil > avant && seuil < prune, "le seuil 70 % est entre les deux");
  });

  it("saute le prune sous ce seuil", () => {
    assert.match(DEPLOI, /Ménage Docker sauté/);
  });
});

describe("un dump déjà écrit arrête la sauvegarde, on ne la relance pas", () => {
  function blocSauvegarde() {
    const debut = DEPLOI.indexOf("Sauvegarde avant migration");
    const fin = DEPLOI.indexOf("l'image", debut);
    assert.ok(debut > 0 && fin > debut, "le bloc sauvegarde est introuvable");
    return DEPLOI.slice(debut, fin);
  }

  it("cherche le fichier dès que la borne a parlé, avant tout second essai", () => {
    const bloc = blocSauvegarde();
    const timeout = bloc.indexOf("code == 124");
    const dump = bloc.indexOf("dump_avant_deploi", timeout);
    const repli = bloc.indexOf("FARMSIM_BACKUP_VERIFY=0", dump);
    assert.ok(timeout >= 0, "la borne 124 est lue");
    assert.ok(dump > timeout, "le dump est cherché après le 124");
    assert.ok(repli > dump, "le repli sans relecture vient après ce dump");
  });

  it("ne relance pas un instantané qui l'était déjà", () => {
    const bloc = blocSauvegarde();
    const repli = bloc.indexOf("FARMSIM_BACKUP_VERIFY=0");
    const garde = bloc.lastIndexOf("relire != 0", repli);
    assert.ok(repli > 0 && garde > 0 && garde < repli, "le repli est derrière `relire != 0`");
  });
});

describe("la session SSH tient le rythme d'une machine saturée", () => {
  it("laisse cinquante minutes au script", () => {
    assert.match(ACTION, /command_timeout:\s*50m/);
  });
});
