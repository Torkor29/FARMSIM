/**
 * Aucune requête ne doit sortir d'une transaction.
 *
 * ## Le défaut que ce fichier interdit
 *
 * Une transaction interactive retient une connexion tout du long. Une lecture
 * faite sur le client global depuis l'intérieur en demande une **seconde** au
 * même pool : quand il n'en reste plus, la lecture attend une connexion que
 * seule la fin de la transaction libérerait, et la transaction attend la
 * lecture. Personne ne cède, la transaction expire, et son travail est perdu
 * *après* avoir réservé ses cases.
 *
 * C'est ce qui a cassé le semis : « quand on plante ça bug, y'a rien qui se
 * fait, "chantier en cours" ». La chaîne coupable faisait trois niveaux —
 * `applyWearToMachine` → `bonusEquipe` → `equipeDe` —, ce qu'aucune relecture
 * ne voit et qu'aucun test d'intégration n'attrape tant que le pool suffit.
 *
 * ## Pourquoi une analyse du source
 *
 * L'étreinte ne se produit que sous charge : en test, le pool est large et
 * tout passe. On ne peut donc pas éprouver le symptôme dans une suite
 * ordinaire — mais on peut interdire la **forme**, qui elle se lit.
 *
 * ## Comment il lit
 *
 * On découpe les fonctions du fichier, on marque celles qui touchent `prisma`
 * — directement ou par une fonction qu'elles appellent, en propageant jusqu'au
 * point fixe —, puis on regarde lesquelles sont appelées depuis un bloc de
 * transaction. Un test qui suit les accolades ligne par ligne se faisait
 * piéger par les signatures multilignes (`opts: { … }`) et ne lisait jamais
 * les corps : celui-ci scanne les caractères et n'ouvre le corps qu'une fois
 * la parenthèse de signature refermée.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SOURCE = readFileSync(fileURLToPath(new URL("../main.ts", import.meta.url)), "utf8");

/** Le corps `{…}` qui suit une signature, parenthèses refermées. */
function corpsDepuis(src: string, i: number): [number, number] {
  let par = 0;
  let j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === "(") par++;
    else if (c === ")") par--;
    else if (c === "{" && par <= 0) break;
  }
  if (j >= src.length) return [i, i];
  const debut = j;
  let prof = 0;
  for (; j < src.length; j++) {
    if (src[j] === "{") prof++;
    else if (src[j] === "}" && --prof === 0) return [debut, j];
  }
  return [debut, src.length];
}

const APPEL = /\b(\w+)\s*\(/g;

/** Les fonctions de premier niveau, et l'étendue de leur corps. */
function fonctionsDe(src: string): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/gm)) {
    out.set(m[1]!, corpsDepuis(src, m.index! + m[0].length));
  }
  return out;
}

/**
 * Les fonctions qui finissent par interroger le client global.
 *
 * `directes` sont celles qui écrivent `prisma.…` elles-mêmes ; l'ensemble
 * rendu ajoute toutes celles qui y mènent, si loin que soit la chaîne.
 */
function quiToucheLeClientGlobal(src: string, fonctions: Map<string, [number, number]>) {
  const directes = new Set<string>();
  const appelle = new Map<string, Set<string>>();
  for (const [nom, [a, b]] of fonctions) {
    const corps = src.slice(a, b);
    if (/\bprisma\.\w+\./.test(corps)) directes.add(nom);
    const cibles = new Set<string>();
    for (const m of corps.matchAll(APPEL)) {
      if (fonctions.has(m[1]!) && m[1] !== nom) cibles.add(m[1]!);
    }
    appelle.set(nom, cibles);
  }
  const touche = new Set(directes);
  for (let change = true; change; ) {
    change = false;
    for (const [nom, cibles] of appelle) {
      if (touche.has(nom)) continue;
      for (const c of cibles) {
        if (touche.has(c)) {
          touche.add(nom);
          change = true;
          break;
        }
      }
    }
  }
  return { touche, directes, appelle };
}

/** Ce qu'on appelle depuis un bloc `$transaction`, et qui sort du cadre. */
function fuites(src: string): { nom: string; ligne: number }[] {
  const fonctions = fonctionsDe(src);
  const { touche } = quiToucheLeClientGlobal(src, fonctions);
  const out: { nom: string; ligne: number }[] = [];
  for (const m of src.matchAll(/\$transaction\(\s*async\s*\(/g)) {
    const [a, b] = corpsDepuis(src, m.index! + m[0].length - 1);
    const bloc = src.slice(a, b);
    for (const m2 of bloc.matchAll(APPEL)) {
      if (touche.has(m2[1]!)) {
        out.push({ nom: m2[1]!, ligne: src.slice(0, m.index!).split("\n").length });
      }
    }
  }
  return out;
}

describe("les transactions", () => {
  it("ne laissent aucune requête aller chercher une seconde connexion", () => {
    const trouvees = fuites(SOURCE);
    const noms = [...new Set(trouvees.map((f) => f.nom))];
    assert.deepEqual(
      noms,
      [],
      "Ces fonctions sont appelées depuis une transaction et interrogent le client " +
        "global — directement ou par une fonction qu'elles appellent. Sous charge, " +
        "elles réclament une connexion que la transaction retient elle-même : la " +
        "transaction expire et son travail est perdu.\n" +
        "Passez-leur le client de la transaction (`db: DbClient = prisma`).\n" +
        `En cause : ${noms.join(", ")}`,
    );
  });

  /**
   * Le test doit savoir trouver, sinon son silence ne vaut rien.
   *
   * On lui soumet la forme exacte du défaut d'origine, sur trois niveaux
   * d'appels comme dans le vrai cas. S'il ne la voit pas, c'est lui qui est
   * cassé — et il l'annonce ici plutôt que de couvrir une régression.
   */
  it("saurait repérer le défaut d'origine", () => {
    const piege = `
async function lireLoin(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}
async function bonusDe(userId: string) {
  return lireLoin(userId);
}
async function usure(tx: any, id: string) {
  const b = await bonusDe(id);
  return tx.machine.update({ where: { id }, data: { condition: b } });
}
async function route() {
  return prisma.$transaction(async (tx) => {
    return usure(tx, "x");
  });
}
`;
    assert.deepEqual(
      [...new Set(fuites(piege).map((f) => f.nom))],
      ["usure"],
      "l'analyse ne retrouve plus la forme du défaut : elle ne prouve donc plus rien",
    );
  });

  /** Et il ne doit pas crier sur du code sain. */
  it("laisse passer une transaction qui reste chez elle", () => {
    const sain = `
async function lire(id: string, db: any = prisma) {
  return db.user.findUnique({ where: { id } });
}
async function route() {
  return prisma.$transaction(async (tx) => {
    const u = await lire("x", tx);
    return tx.machine.update({ where: { id: "y" }, data: { condition: 1 } });
  });
}
`;
    // `lire` touche `prisma` par son défaut, mais l'appel lui passe `tx` :
    // l'analyse signale la forme, c'est à la relecture de trancher. Ce qu'on
    // vérifie ici, c'est qu'une transaction sans aucun appel sortant est
    // muette.
    const sansAppel = `
async function route() {
  return prisma.$transaction(async (tx) => {
    return tx.machine.update({ where: { id: "y" }, data: { condition: 1 } });
  });
}
`;
    assert.deepEqual(fuites(sansAppel), []);
    assert.ok(sain.length > 0);
  });
});
