/**
 * Ce que l'employé à l'élevage fait doit se voir.
 *
 * ## Le défaut que ces tests gardent fermé
 *
 * La question a été posée deux fois : « je pige toujours pas l'intérêt du PNJ
 * éleveur ». Le serveur lui fait désormais refaire la mangeoire et la litière
 * — mais un travail bien fait est invisible par nature : le joueur ne voit que
 * ses alertes ne plus apparaître, ce qui ressemble exactement à un employé qui
 * ne sert à rien. Le silence était la moitié du problème.
 *
 * Deux endroits le disent maintenant, et ces tests tiennent les deux : la
 * fiche du lot porte la date du dernier passage, et l'écran d'embauche annonce
 * ce que le poste fait faire — pas seulement son nom.
 */

import { readFileSync } from "fs";

import { EMPLOYEE_POST_EFFECTS, EMPLOYEE_POST_LABELS } from "@farmsim/shared";

const ELEVAGE = readFileSync("src/LivestockPanel.tsx", "utf8");
const EMPLOYES = readFileSync("src/EmployeesPanel.tsx", "utf8");
const CSS = readFileSync("src/styles.css", "utf8");

describe("la fiche du lot", () => {
  it("porte la date du dernier passage de l’équipe", () => {
    expect(ELEVAGE).toContain("tendedAt");
    expect(ELEVAGE).toContain("barn-tended");
    expect(ELEVAGE).toContain("Votre équipe");
  });

  it("dit ce que l’équipe a fait, et pas seulement qu’elle est passée", () => {
    /*
     * La phrase était figée — « mangeoire et litière tenues par votre
     * équipe » — et laissait donc entière la question suivante, posée en
     * jouant : « ce qu'il faut que je teste, c'est ce qu'il fait à propos du
     * fumier : est-ce qu'il le traite, le vend, vide simplement ? ». Elle
     * énumère maintenant les gestes réellement accomplis.
     */
    expect(ELEVAGE).toContain("tendedWhat");
    expect(ELEVAGE).toContain("travauxDeLEquipe");
    for (const code of ["ration", "litiere", "fumier"]) {
      expect({ code, connu: ELEVAGE.includes(`${code}:`) }).toEqual({ code, connu: true });
    }
    // Et le fumier dit où il part : « vidée » seul ne distingue pas la benne
    // du voisin qui paie.
    expect(ELEVAGE).toMatch(/vendu au voisin/);
  });

  it("garde une phrase honnête pour un passage sans détail", () => {
    // Les lignes écrites avant que la colonne existe n'ont pas de codes : on
    // ne doit pas afficher un tiret solitaire ni inventer un geste.
    expect(ELEVAGE).toContain('if (!faits.length) return "Votre équipe est passée"');
  });

  it("ne montre rien tant que personne n’est passé", () => {
    // Une ligne « tenue par votre équipe » sur une ferme sans employé serait
    // un mensonge, et pire qu'un silence.
    expect(ELEVAGE).toContain("herd.tendedAt != null &&");
  });

  it("dit une durée écoulée, pas une durée restante", () => {
    /*
     * `dureeReelle` sert aux autonomies — « 3 h » de ration devant soi. La
     * réemployer ici donnerait « tenues par votre équipe — 20 min », qu'on lit
     * comme un délai à venir.
     */
    expect(ELEVAGE).toContain("function depuisQuand");
    expect(ELEVAGE).toContain("depuisQuand(herd.tendedAt)");
    expect(ELEVAGE).toMatch(/il y a \$\{minutes\} min/);
  });

  it("a de quoi se dessiner, et discrètement", () => {
    // C'est une bonne nouvelle, pas une alerte : elle ne doit pas porter les
    // couleurs de danger du panneau.
    expect(CSS).toContain(".barn-tended");
    expect(CSS).not.toMatch(/\.barn-tended\s*\{[^}]*var\(--danger\)/);
  });
});

describe("l’écran d’embauche", () => {
  it("dit ce que chaque poste fait faire, et pas seulement son nom", () => {
    /*
     * La cause directe de la question. L'écran ne montrait que les trois
     * compétences : l'élevage s'y lisait « +20 % de production », un chiffre
     * qui ne couvre jamais le salaire. La corvée déléguée n'apparaissait
     * nulle part.
     */
    expect(EMPLOYES).toContain("EMPLOYEE_POST_EFFECTS");
    expect(EMPLOYES).toContain("EMPLOYEE_POST_EFFECTS[e.poste]");
    expect(CSS).toContain(".emp-poste-effet");
  });

  it("annonce la corvée avant le pourcentage", () => {
    // L'ordre des mots compte : c'est la délégation qu'on achète, le bonus
    // n'est plus que la cerise.
    const texte = EMPLOYEE_POST_EFFECTS.ELEVAGE;
    expect(texte).toMatch(/mangeoire/i);
    expect(texte).toMatch(/litière/i);
    expect(texte.indexOf("mangeoire")).toBeLessThan(texte.indexOf("produit"));
  });

  it("dit aussi ce que le poste aux champs débloque", () => {
    expect(EMPLOYEE_POST_EFFECTS.CHAMP).toMatch(/chantier/i);
    // Les deux postes ont un libellé et un effet : un poste qui n'expliquerait
    // rien redeviendrait le nom nu qui a posé problème.
    for (const p of ["CHAMP", "ELEVAGE"] as const) {
      expect({ p, libelle: EMPLOYEE_POST_LABELS[p].length > 0 }).toEqual({ p, libelle: true });
      expect({ p, effet: EMPLOYEE_POST_EFFECTS[p].length > 20 }).toEqual({ p, effet: true });
    }
  });
});
