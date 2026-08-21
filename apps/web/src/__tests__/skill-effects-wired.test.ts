import fs from "node:fs";
import {
  SKILL_DEFS,
  SKILL_EFFECT_CAPS,
  STAT_LABELS,
  type SkillEffectKind,
  type StatKey,
} from "@farmsim/shared";

/**
 * L'arbre doit être branché des deux côtés — l'entrée et la sortie.
 *
 * « Vérifie que ce ne soit pas juste indiquer "faire ci ça déclenche ça", mais
 * que ça détecte bien chaque action pour faire avancer les compétences, et que
 * tout est bien branché pour que les bonus soient bien réels. »
 *
 * Deux pannes possibles, symétriques, et invisibles l'une comme l'autre à la
 * relecture :
 *
 * **L'entrée.** Une condition assise sur un compteur que personne
 * n'incrémente est un verrou sans clé : la compétence reste à 0 % pour
 * toujours, et rien ne le signale. Le jeu en a déjà porté un — la quête
 * « Nourrir le troupeau » attendait dix rations sur un compteur mort.
 *
 * **La sortie.** Un effet déclaré, plafonné, affiché à l'écran — et jamais
 * appliqué. La compétence s'ouvre, l'écran annonce « +5 % de production
 * laitière », et la traite rend exactement la même chose qu'avant.
 *
 * Ces tests sont structurels, comme celui qui compte les définitions de
 * `.game-stage` : ils ne jugent pas les valeurs, ils constatent le
 * branchement. C'est précisément ce qu'une relecture ne voit pas, puisqu'il
 * faudrait tenir treize leviers et quinze compteurs en tête en lisant dix
 * mille lignes.
 */
const SERVEUR = fs.readFileSync("../../apps/api/src/main.ts", "utf8");
const SIM = fs.readFileSync("../../packages/sim/src/index.ts", "utf8");

/** Les compteurs qu'une condition de l'arbre interroge. */
function compteursLus(): Map<StatKey, string[]> {
  const plat = (c: unknown): unknown[] => {
    if (!c || typeof c !== "object") return [];
    const n = c as { of?: unknown[] };
    return [c, ...(n.of ?? []).flatMap(plat)];
  };
  const out = new Map<StatKey, string[]>();
  for (const d of SKILL_DEFS) {
    for (const c of plat(d.condition)) {
      const n = c as { kind?: string; stat?: StatKey };
      if (n.kind !== "stat" || !n.stat) continue;
      out.set(n.stat, [...(out.get(n.stat) ?? []), d.name]);
    }
  }
  return out;
}

/**
 * Le texte de chaque appel à `grantXp`, parenthèses équilibrées.
 *
 * C'est `grantXp` qui écrit les compteurs — il est le seul chemin vers
 * `statsJson`. Chercher `cellsPlanted` n'importe où dans le fichier aurait
 * accepté une mention en commentaire ou un `select` ; on ne regarde donc que
 * là où l'écriture a lieu vraiment.
 */
function appelsGrantXp(src: string): string[] {
  const out: string[] = [];
  const re = /grantXp\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let prof = 1;
    let i = m.index + m[0].length;
    while (i < src.length && prof > 0) {
      if (src[i] === "(") prof++;
      else if (src[i] === ")") prof--;
      i++;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
}

describe("l’entrée de l’arbre : ce que le joueur fait", () => {
  const lus = compteursLus();
  const ecrits = appelsGrantXp(SERVEUR).join("\n");

  it("interroge au moins la moitié des compteurs du jeu", () => {
    // Garde-fou du test lui-même : s'il ne trouvait plus aucune condition, il
    // passerait en silence et ne garderait plus rien.
    expect(lus.size).toBeGreaterThanOrEqual(Object.keys(STAT_LABELS).length / 2);
  });

  it("n’attend aucun compteur que le serveur n’incrémente jamais", () => {
    /*
     * Le cœur du défaut : `atLeast: 200` sur un compteur mort. La compétence
     * affiche « 0 / 200 » à vie, et le joueur croit avoir mal compris la
     * consigne alors que le geste n'est simplement pas compté.
     */
    const morts = [...lus.entries()]
      .filter(([stat]) => !new RegExp(`\\b${stat}\\s*:`).test(ecrits))
      .map(([stat, par]) => `${stat} (attendu par ${par.join(", ")})`);
    expect(morts).toEqual([]);
  });

  it("compte chaque geste au moment où il est fait", () => {
    // Un compteur n'est honnête que s'il est écrit là où le geste a lieu. On
    // vérifie l'appariement du compteur et de l'évènement d'expérience, qui
    // nomme l'action : semer écrit `cellsPlanted`, vendre écrit `tonsSold`.
    const attendus: [StatKey, RegExp][] = [
      ["cellsPlanted", /"PLANT"/],
      ["cellsPlowed", /"PLOW"/],
      ["cellsStubbled", /"STUBBLE"/],
      ["cellsFertilized", /"FERTILIZE"/],
      ["cellsHarvested", /"HARVEST"/],
      ["tonsHarvested", /"HARVEST"/],
      ["tonsSold", /"SELL"/],
      ["feedings", /"FEED"/],
    ];
    const mal: string[] = [];
    for (const [stat, evenement] of attendus) {
      const appel = appelsGrantXp(SERVEUR).find((a) => new RegExp(`\\b${stat}\\s*:`).test(a));
      if (!appel) mal.push(`${stat} : jamais écrit`);
      else if (!evenement.test(appel)) mal.push(`${stat} : écrit hors de ${evenement.source}`);
    }
    expect(mal).toEqual([]);
  });
});

describe("la sortie de l’arbre : ce que les compétences changent", () => {
  const leviers = Object.keys(SKILL_EFFECT_CAPS) as SkillEffectKind[];

  it("n’en déclare aucun que l’arbre ne produit pas", () => {
    // Un levier plafonné, branché, et que plus aucune compétence ne pousse :
    // il ne ferait rien, mais il laisserait croire qu'il fait quelque chose.
    const utilises = new Set(SKILL_DEFS.flatMap((d) => d.effects.map((e) => e.kind)));
    expect(leviers.filter((k) => !utilises.has(k))).toEqual([]);
  });

  it("passe tous par une enveloppe bornée", () => {
    // Un levier sans plafond finirait par écraser la mécanique qu'il modifie.
    const sansPlafond = leviers.filter((k) => !(SKILL_EFFECT_CAPS[k] > 0));
    expect(sansPlafond).toEqual([]);
  });

  it("applique chaque levier dans un vrai calcul, pas dans une mention", () => {
    /*
     * La version précédente de ce test cherchait `.MILK_YIELD` n'importe où
     * dans le serveur. Elle serait passée sur un commentaire, sur un `console
     * .log`, ou sur une valeur lue puis jetée — exactement le défaut qu'elle
     * prétendait attraper.
     *
     * On exige donc que la valeur atteigne un **opérateur** : `1 - x.FUEL_USE`
     * qui retire, `1 + x.MILK_YIELD` qui ajoute, `stock + x.STORAGE_GRAIN` qui
     * augmente une capacité. Un levier simplement nommé ne passe plus.
     */
    const applique = (k: SkillEffectKind) =>
      new RegExp(`[-+]\\s*[A-Za-z_$][\\w.$]*\\.${k}\\b`).test(SERVEUR);
    // Le rendement est le seul levier qui traverse une frontière de paquet :
    // le serveur le passe au simulateur, qui l'applique. Le test suit ce
    // chemin-là plutôt que de l'exempter.
    const indirects: Partial<Record<SkillEffectKind, () => boolean>> = {
      CROP_YIELD: () =>
        /skillYieldBonus:\s*[\w.?\s]*\.CROP_YIELD/.test(SERVEUR) &&
        /1\s*\+\s*Math\.min\([^)]*input\.skillYieldBonus/.test(SIM),
    };
    const decoratifs = leviers.filter((k) => !(indirects[k]?.() ?? applique(k)));
    expect(decoratifs).toEqual([]);
  });

  it("lit les bonus du joueur qui agit, jamais une table vide", () => {
    /*
     * Le dernier piège : appliquer consciencieusement `(1 - x.FUEL_USE)` sur
     * un `x` obtenu par `noSkillBonuses()`. Le calcul serait juste, le levier
     * toujours nul, et aucun test d'arithmétique ne le verrait.
     *
     * `noSkillBonuses()` a un usage légitime — la ferme ou la machine dont on
     * ne retrouve pas le propriétaire — mais il doit rester une **retombée**,
     * jamais la source principale. On compte donc les deux.
     */
    const reels = (SERVEUR.match(/getSkillBonuses\(|bonusesFor\(/g) ?? []).length;
    const vides = (SERVEUR.match(/noSkillBonuses\(\)/g) ?? []).length;
    expect(`${reels} lectures réelles > ${vides} retombées vides`).toBe(
      reels > vides ? `${reels} lectures réelles > ${vides} retombées vides` : "SOURCE VIDE DOMINANTE",
    );
  });
});
