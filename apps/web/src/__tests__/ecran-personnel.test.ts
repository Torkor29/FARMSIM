/**
 * L'écran du personnel : ce qu'il montre, et par où on y entre.
 *
 * Le système d'employés naît d'un signalement de Strea : « tu peux lancer deux
 * choses qui nécessitent le tracteur alors que t'as qu'un seul tracteur ». La
 * règle qui en découle a deux faces — un attelage libre **et** quelqu'un pour
 * le conduire — et la seconde n'a de sens que si le joueur trouve où embaucher.
 *
 * Un panneau qui n'a pas de porte n'existe pas. Ces tests tiennent la porte
 * ouverte : une entrée dans le rail de bureau, un onglet dans le tiroir du
 * téléphone, et une lecture des données au moment où l'écran s'ouvre. Ils
 * tiennent aussi la promesse de l'écran : aucun bouton qui ne réponde pas, et
 * une phrase de règle qui dit la même chose que le serveur.
 */

import fs from "node:fs";
import {
  chantiersSimultanes,
  EMPLOYES_SANS_LOGEMENT,
  SALAIRE_IMPAYE_MAX_JOURS,
  SKILL_MAX,
} from "@farmsim/shared";

const PANNEAU = fs.readFileSync("src/EmployeesPanel.tsx", "utf8");
const APP = fs.readFileSync("src/App.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");

/**
 * Le code seul, commentaires retirés.
 *
 * Les commentaires de ce panneau expliquent la règle avec les mêmes mots que
 * la règle elle-même : sans ce nettoyage, un test qui cherche « attelage
 * libre » dans le rendu se contenterait de relire l'explication du rendu.
 */
function codeSeul(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const CODE = codeSeul(PANNEAU);
const CODE_APP = codeSeul(APP);

describe("on peut atteindre l'écran", () => {
  it("le rail de bureau porte une entrée Personnel", () => {
    expect(CODE_APP).toMatch(/id: "STAFF"[\s\S]{0,220}onOpen: \(\) => setShowStaff/);
  });

  it("l'entrée du rail a une icône dessinée, pas un emoji", () => {
    expect(CODE_APP).toMatch(/id: "STAFF"[\s\S]{0,200}icons\/nav\/personnel\.svg/);
    expect(fs.existsSync("public/assets/icons/nav/personnel.svg")).toBe(true);
  });

  it("le raccourci annoncé fait bien ce qu'il annonce", () => {
    // « E » fait déjà défiler les options de l'outil courant : l'afficher sur
    // le rail promettrait un raccourci qui ferait autre chose.
    expect(CODE_APP).toMatch(/id: "STAFF"[\s\S]{0,220}hotkey: "P"/);
    expect(CODE_APP).toMatch(/e\.key === "p" \|\| e\.key === "P"\) setShowStaff/);
  });

  it("le tiroir du téléphone porte le même onglet", () => {
    expect(CODE_APP).toMatch(/key: "STAFF"[\s\S]{0,120}icons\/nav\/personnel\.svg/);
  });

  it("le panneau a sa propre fenêtre, et n'est pas caché dans celle de l'élevage", () => {
    // Il l'a été le temps d'un montage : la fenêtre de l'élevage l'enveloppait,
    // et l'écran ne s'ouvrait donc qu'avec le troupeau. La fenêtre du personnel
    // doit se fermer sur elle-même avant que celle de l'élevage ne s'ouvre.
    const staff = CODE_APP.indexOf('title="Personnel"');
    const finStaff = CODE_APP.indexOf("</PanelHost>", staff);
    const herd = CODE_APP.indexOf('title="Élevage"');
    expect(staff).toBeGreaterThan(0);
    expect(herd).toBeGreaterThan(finStaff);
    expect(CODE_APP.indexOf("<EmployeesPanel")).toBeLessThan(finStaff);
  });

  it("l'équipe se lit à l'ouverture de l'écran", () => {
    // Sans cela le panneau s'ouvrirait sur `staff === null` et ne s'afficherait
    // jamais : sa condition de montage exige les données.
    expect(CODE_APP).toMatch(/staffOuvert[\s\S]{0,200}void loadStaff\(\)/);
  });

  it("l'équipe se relit après chaque geste qui la change", () => {
    for (const geste of ["/employees/hire", "/post`", "/fire`"]) {
      const i = CODE_APP.indexOf(geste);
      expect(i).toBeGreaterThan(0);
      expect(CODE_APP.slice(i, i + 320)).toContain("loadStaff()");
    }
  });
});

describe("la phrase de règle dit ce que le serveur applique", () => {
  it("compte le joueur comme un conducteur", () => {
    // `1 + auChamp` dans l'écran, `1 + employés` dans la règle partagée : si
    // l'un des deux change, ce test tombe avant le joueur.
    expect(CODE).toContain("{1 + auChamp}");
    for (const employes of [0, 1, 2, 4]) {
      expect(
        chantiersSimultanes({ employesAuChamp: employes, attelagesLibres: 99 }),
      ).toBe(1 + employes);
    }
  });

  it("ne compte que les employés aux champs", () => {
    expect(CODE).toMatch(/employees\.filter\(\(e\) => e\.poste === "CHAMP"\)\.length/);
  });

  it("nomme les deux conditions, l'attelage et le conducteur", () => {
    expect(PANNEAU).toMatch(/attelage libre[\s\S]{0,80}pour le\s*\n?\s*conduire/);
  });
});

describe("aucun bouton muet", () => {
  it("aucun bouton du panneau n'est désactivé", () => {
    // Même principe que `Geste` : un bouton gris qui ne dit pas pourquoi est
    // la panne que Strea a signalée deux fois. Ici tout bouton répond, quitte
    // à répondre « pas maintenant ».
    expect(CODE).not.toMatch(/\sdisabled[={\s]/);
  });

  it("chaque bouton bloqué explique le blocage", () => {
    // Trois familles de boutons — poste, renvoi, embauche — et trois appels à
    // `onExplain` sur le chemin empêché.
    expect(CODE.match(/onExplain\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("le refus d'embauche distingue le lit manquant du logement absent", () => {
    expect(PANNEAU).toMatch(/agrandissez le logement/i);
    expect(PANNEAU).toMatch(/logent au village/i);
    expect(CODE).toMatch(/lits > 0\s*\n?\s*\?/);
  });

  it("se séparer de quelqu'un passe par une confirmation", () => {
    const i = CODE_APP.indexOf("function fireEmployee");
    expect(i).toBeGreaterThan(0);
    const corps = CODE_APP.slice(i, i + 500);
    expect(corps).toContain("setConfirmRequest");
    expect(corps).toContain("destructive: true");
  });
});

describe("les compétences se lisent d'un coup d'œil", () => {
  it("chaque compétence a autant de pastilles que de crans", () => {
    expect(CODE).toMatch(/Array\.from\(\{ length: SKILL_MAX \}/);
    expect(SKILL_MAX).toBe(5);
  });

  it("les pastilles ont un libellé lu à voix haute", () => {
    // Une rangée de carrés colorés ne dit rien à un lecteur d'écran.
    expect(CODE).toMatch(/aria-label=\{`\$\{e\[s\]\} sur \$\{SKILL_MAX\}`\}/);
  });

  it("la feuille de style dessine les pastilles et le panneau", () => {
    for (const regle of [".emp-pips i", ".emp-pips i.on", ".emp-fiche", ".staff-panel"]) {
      expect(CSS).toContain(regle);
    }
  });

  it("le panneau est rangé par le rail comme les autres", () => {
    // Les panneaux ne se placent plus eux-mêmes : celui-ci doit figurer dans
    // la règle commune, sinon il déborde de la grille du bureau.
    expect(CSS).toMatch(/\.staff-panel,\n\.livestock-panel \{/);
  });
});

describe("ce que l'écran promet sur le logement", () => {
  it("annonce le même nombre d'embauches sans bâtiment que la règle", () => {
    expect(EMPLOYES_SANS_LOGEMENT).toBe(2);
    expect(PANNEAU).toMatch(/Deux embauches sont possibles sans rien bâtir/);
  });

  it("dit qui est logé, et ce que cela change", () => {
    expect(PANNEAU).toMatch(/logé/);
    expect(PANNEAU).toMatch(/35\s?%/);
  });
});

describe("un départ ne surprend personne", () => {
  it("l'écran affiche les jours de salaire impayés", () => {
    // Le grand livre n'inscrit que l'argent qui bouge : un salaire qu'on ne
    // paie pas n'y laisse rien. Sans cette ligne, quelqu'un disparaîtrait de
    // l'équipe sans qu'aucun écran ne l'ait annoncé.
    expect(CODE).toMatch(/e\.impayeJours > 0/);
    expect(PANNEAU).toMatch(/jour\(s\) de salaire impayé/);
  });

  it("dit combien de jours il reste, sans recopier le nombre", () => {
    // Le préavis vient du serveur, qui le tient de la règle partagée. Le
    // panneau ne doit pas en garder une copie qui vieillirait toute seule.
    expect(CODE).toContain("preavisJours - e.impayeJours");
    expect(SALAIRE_IMPAYE_MAX_JOURS).toBe(2);
    expect(CODE).not.toMatch(/impayeJours >= 2\b/);
  });

  it("le serveur envoie le compteur et le préavis", () => {
    const API = fs.readFileSync("../api/src/main.ts", "utf8");
    expect(API).toContain("impayeJours:");
    expect(API).toContain("preavisJours: SALAIRE_IMPAYE_MAX_JOURS");
  });
});
