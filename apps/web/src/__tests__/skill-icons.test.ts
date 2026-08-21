import fs from "node:fs";
import {
  BRANCH_ICON_FILES,
  SKILL_DEFS,
  skillIconSrc,
  type SkillBranch,
} from "@farmsim/shared";

/**
 * Chaque compétence a son dessin, et chaque dessin existe.
 *
 * Une icône manquante ne casse rien : le navigateur affiche un carré vide, la
 * page continue de fonctionner, et personne ne s'en aperçoit avant qu'un
 * joueur ouvre l'arbre. C'est exactement le genre de défaut qu'un test doit
 * attraper à la place d'un relecteur — il faudrait sinon vérifier trente-neuf
 * chemins à la main.
 */
const RACINE = "public";

function fichierDe(src: string): string {
  return `${RACINE}${src}`;
}

describe("les dessins de l’arbre", () => {
  it("existent tous, pour chaque compétence", () => {
    const manquants = SKILL_DEFS.filter((d) => !fs.existsSync(fichierDe(skillIconSrc(d.icon)))).map(
      (d) => `${d.id} → ${d.icon}`,
    );
    expect(manquants).toEqual([]);
  });

  it("existent pour les quatre branches", () => {
    const branches = Object.keys(BRANCH_ICON_FILES) as SkillBranch[];
    const manquants = branches.filter(
      (b) => !fs.existsSync(fichierDe(skillIconSrc(BRANCH_ICON_FILES[b]))),
    );
    expect(manquants).toEqual([]);
  });

  it("suivent le style maison : trait, pas aplat", () => {
    /*
     * Les icônes du jeu sont des tracés linéaires en 24×24. Une icône pleine
     * au milieu d'elles se voit immédiatement — et `currentColor` est ce qui
     * leur permet de suivre l'état de la carte, verte une fois acquise et
     * grise tant qu'elle ne l'est pas. Un `stroke` en dur casserait ça sans
     * qu'aucun test de rendu ne le remarque.
     */
    for (const d of SKILL_DEFS) {
      const svg = fs.readFileSync(fichierDe(skillIconSrc(d.icon)), "utf8");
      expect(`${d.icon} viewBox`).toBe(
        svg.includes('viewBox="0 0 24 24"') ? `${d.icon} viewBox` : `${d.icon} MAUVAIS CADRAGE`,
      );
      expect(`${d.icon} couleur`).toBe(
        svg.includes('stroke="currentColor"') ? `${d.icon} couleur` : `${d.icon} COULEUR FIGÉE`,
      );
    }
  });

  it("donne une icône propre aux sommets de branche", () => {
    // Les quatre aboutissements ne doivent pas partager le dessin d'une
    // compétence de base : c'est là que l'arbre se lit d'un coup d'œil.
    const sommets = SKILL_DEFS.filter((d) => d.tier === 4);
    expect(sommets.length).toBeGreaterThanOrEqual(3);
    for (const s of sommets) expect(typeof s.icon).toBe("string");
  });
});
