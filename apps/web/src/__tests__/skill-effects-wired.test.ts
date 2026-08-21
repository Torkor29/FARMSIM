import fs from "node:fs";
import { SKILL_DEFS, SKILL_EFFECT_CAPS, type SkillEffectKind } from "@farmsim/shared";

/**
 * Aucun effet de compétence ne doit rester décoratif.
 *
 * « Je ne veux pas d'un arbre purement décoratif. Chaque compétence débloquée
 * doit avoir un effet concret sur le gameplay. »
 *
 * Le piège est qu'un effet décoratif ne se voit pas : la compétence s'ouvre,
 * l'écran annonce « +5 % de production laitière », et rien ne change dans la
 * partie. Aucun test de comportement ne le rattrape — il faudrait déjà savoir
 * lequel manque. On vérifie donc l'inverse : que chaque levier déclaré est
 * **lu** quelque part dans le serveur.
 *
 * C'est un test structurel, comme celui qui compte les définitions de
 * `.game-stage` : il ne juge pas la valeur, il constate le branchement. Et
 * c'est précisément ce qu'une relecture ne voit pas, puisqu'il faudrait tenir
 * les treize leviers en tête en lisant dix mille lignes.
 */
const SERVEUR = fs.readFileSync("../../apps/api/src/main.ts", "utf8");

describe("les effets de compétences", () => {
  it("sont tous lus par le serveur", () => {
    const leviers = Object.keys(SKILL_EFFECT_CAPS) as SkillEffectKind[];
    const orphelins = leviers.filter((k) => !new RegExp(`\\.${k}\\b`).test(SERVEUR));
    expect(orphelins).toEqual([]);
  });

  it("n’en déclare aucun que l’arbre n’utilise pas", () => {
    // L'inverse du même défaut : un levier plafonné, branché, et que plus
    // aucune compétence ne produit. Il ne ferait rien, mais il laisserait
    // croire qu'il fait quelque chose.
    const utilises = new Set(SKILL_DEFS.flatMap((d) => d.effects.map((e) => e.kind)));
    const inutilises = (Object.keys(SKILL_EFFECT_CAPS) as SkillEffectKind[]).filter(
      (k) => !utilises.has(k),
    );
    expect(inutilises).toEqual([]);
  });

  it("passent tous par une enveloppe bornée", () => {
    // Un levier sans plafond finirait par écraser la mécanique qu'il modifie.
    for (const k of Object.keys(SKILL_EFFECT_CAPS) as SkillEffectKind[]) {
      expect(`${k} > 0 : ${SKILL_EFFECT_CAPS[k] > 0}`).toBe(`${k} > 0 : true`);
    }
  });
});
