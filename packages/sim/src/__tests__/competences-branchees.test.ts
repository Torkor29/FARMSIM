import {
  applyJobCare,
  breakdownChance,
  type MachineCareState,
} from "../index";
import {
  EMPLOYEE_SKILL_EFFECTS,
  gainConduite,
  gainElevage,
  gainMecanique,
  SKILL_MAX,
} from "@farmsim/shared";

/**
 * Une compétence qui ne fait rien est un mensonge à l'écran.
 *
 * ## D'où ça vient
 *
 * Demandé en jouant : « il fait quoi l'employé à l'élevage ? ». La réponse
 * honnête, ce jour-là, était **rien**. Le système d'employés a été livré avec
 * trois compétences ; `bonusEquipe` les calculait toutes les trois et n'en
 * branchait qu'une. Conduite raccourcissait bien les chantiers ; mécanique et
 * élevage étaient calculées, puis jetées.
 *
 * Un employé qu'on ne peut pas embaucher est une fonctionnalité manquante. Un
 * employé qu'on paie et qui ne fait rien est pire : c'est un mauvais marché
 * déguisé en choix, et rien à l'écran ne le dit.
 *
 * ## Ce que ce fichier tient, et ce qu'il ne tient pas
 *
 * Ici, les règles pures : les gains valent ce qu'ils annoncent, et le
 * multiplicateur de panne agit sur le tirage. **Que le serveur les lise** est
 * une autre affaire, et une recherche de texte serait un mauvais témoin — un
 * `grep` vert prouve qu'une ligne existe, pas qu'un litre de lait de plus
 * arrive au silo. C'est `api.test.ts` qui l'éprouve, sur une vraie ferme.
 */

describe("les trois gains ont l’effet que l’écran annonce", () => {
  it("un débutant n’apporte rien, un excellent apporte le maximum", () => {
    // Niveau 1 : on paie le plancher, on n'achète pas de compétence. C'est ce
    // qui rend le vivier intéressant — tous les candidats ne se valent pas.
    expect(gainConduite(1)).toBe(0);
    expect(gainMecanique(1)).toBe(0);
    expect(gainElevage(1)).toBe(0);
    expect(gainConduite(SKILL_MAX)).toBeCloseTo(0.25, 5);
    expect(gainMecanique(SKILL_MAX)).toBeCloseTo(0.4, 5);
    expect(gainElevage(SKILL_MAX)).toBeCloseTo(0.2, 5);
  });

  it("les libellés de l’écran citent les mêmes plafonds", () => {
    // Le texte et le calcul se lisent dans le même fichier ; c'est le seul
    // moyen qu'ils ne divergent pas au prochain réglage.
    expect(EMPLOYEE_SKILL_EFFECTS.conduite).toContain("25 %");
    expect(EMPLOYEE_SKILL_EFFECTS.mecanique).toContain("40 %");
    expect(EMPLOYEE_SKILL_EFFECTS.elevage).toContain("20 %");
  });
});

describe("le mécanicien réduit vraiment les pannes", () => {
  /** Une machine en mauvais état : c'est là que la casse arrive. */
  const usee: MachineCareState = {
    condition: 20,
    grease: 0,
    greased: false,
    dirt: 70,
    greaseSkipStreak: 2,
    breakdown: null,
  };

  it("le risque nu est réel — sinon ce test ne mesurerait rien", () => {
    expect(breakdownChance({ condition: 20, grease: 0, dirt: 70 })).toBeGreaterThan(0.2);
  });

  it("un mécanicien 5/5 rend la casse plus rare, sans la supprimer", () => {
    /*
     * `rng` est fourni, donc le tirage est décidé, pas subi. On vise entre les
     * deux risques — celui qui cassait sans mécanicien, et celui qui ne casse
     * plus avec. Le seuil se **calcule** au lieu d'être écrit en dur : le jour
     * où le barème de casse bougera, ce test suivra au lieu de mentir.
     */
    const risqueNu = breakdownChance({ condition: 20, grease: 0, dirt: 70 });
    const risqueAvec = risqueNu * (1 - gainMecanique(5));
    const entreLesDeux = (risqueNu + risqueAvec) / 2;
    const nu = applyJobCare(usee, { work: "PLOW", cells: 20, rng: () => entreLesDeux });
    const avec = applyJobCare(usee, {
      work: "PLOW",
      cells: 20,
      rng: () => entreLesDeux,
      risqueMult: 1 - gainMecanique(5),
    });
    expect(nu.broke).toBe(true);
    expect(avec.broke).toBe(false);

    // Mais elle reste possible : un mauvais tirage casse quand même.
    const malchance = applyJobCare(usee, {
      work: "PLOW",
      cells: 20,
      rng: () => 0,
      risqueMult: 1 - gainMecanique(5),
    });
    expect(malchance.broke).toBe(true);
  });

  it("sans mécanicien, rien ne change du comportement d’avant", () => {
    // Le multiplicateur est facultatif : les douze appels qui ne le passent
    // pas doivent se comporter exactement comme avant son existence.
    for (const rng of [0, 0.1, 0.25, 0.5, 0.9]) {
      expect(applyJobCare(usee, { work: "PLOW", cells: 20, rng: () => rng }).broke).toBe(
        applyJobCare(usee, { work: "PLOW", cells: 20, rng: () => rng, risqueMult: 1 }).broke,
      );
    }
  });
});
