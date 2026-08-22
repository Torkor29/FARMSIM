import fs from "node:fs";

/**
 * Où vit le calendrier des cultures.
 *
 * Il est né d'une mesure, pas d'un coup d'œil. Posé dans le rendu, il marchait
 * parfaitement sur écran large — et n'existait pas du tout sur téléphone : le
 * bouton avait atterri dans la branche « bureau » du choix `isMobile ? … : …`,
 * de sorte que j'avais écrit une règle d'affichage étroite pour un panneau
 * qu'aucun doigt ne pouvait ouvrir. Rien ne le disait à la lecture ; il a fallu
 * ouvrir le jeu en 390 px pour que le compte de boutons tombe à zéro.
 *
 * Deuxième mesure, deuxième leçon : rendu visible, le bouton se posait *sur*
 * le dock, à cheval sur « Plus ». Le reculer d'une valeur devinée aurait tenu
 * un jour — le dock change de hauteur selon qu'un chantier tourne — d'où
 * l'ancrage dans la zone `stage` de la grille, qui s'arrête là où le champ
 * s'arrête.
 *
 * Ces assertions constatent l'endroit où vivent les choses, pas leur allure.
 */
const APP = fs.readFileSync("src/App.tsx", "utf8");
const PANNEAU = fs.readFileSync("src/CropCalendarPanel.tsx", "utf8");
const CSS = fs.readFileSync("src/styles.css", "utf8");

/** Les bornes de la branche réservée au bureau, dans le rendu de l'app. */
function brancheBureau(): { debut: number; fin: number } {
  const debut = APP.indexOf("      ) : (\n        <>");
  const fin = APP.indexOf("        </>\n      )}", debut);
  expect(debut).toBeGreaterThan(-1);
  expect(fin).toBeGreaterThan(debut);
  return { debut, fin };
}

describe("le bouton du calendrier", () => {
  it("existe", () => {
    expect(APP).toMatch(/className="calendrier-ouvrir"/);
    expect(APP).toMatch(/<CropCalendarPanel\b/);
  });

  it("n’est pas enfermé dans la branche de bureau", () => {
    // Le défaut exact qui l'a rendu introuvable sur téléphone.
    const { debut, fin } = brancheBureau();
    const bouton = APP.indexOf('className="calendrier-ouvrir"');
    const panneau = APP.indexOf("<CropCalendarPanel");
    for (const i of [bouton, panneau]) {
      expect(i).toBeGreaterThan(-1);
      expect(i > debut && i < fin).toBe(false);
    }
  });

  it("s’arrête où s’arrête le champ, plutôt qu’à une distance devinée du bas", () => {
    const regle = CSS.match(
      /\.game-stage\.mobile \.calendrier-ouvrir,\s*\n\.game-stage\.mobile \.calendrier \{([^}]*)\}/,
    );
    expect(regle).not.toBeNull();
    expect(regle![1]).toMatch(/grid-area:\s*stage/);
    expect(regle![1]).toMatch(/align-self:\s*end/);
    // Et surtout : plus rien qui parle en distance depuis le bord de l'écran.
    expect(regle![1]).toMatch(/bottom:\s*auto/);
  });
});

describe("l’entête des sept colonnes", () => {
  it("écrit chaque saison en long et en court", () => {
    // Sept « Printemps » côte à côte dans 390 px se chevauchaient jusqu'à
    // devenir illisibles ; abréger dans le composant garde le mot entier là
    // où il tient.
    for (const saison of ["SPRING", "SUMMER", "AUTUMN", "WINTER"]) {
      expect(PANNEAU).toMatch(new RegExp(`${saison}:\\s*"`));
    }
    expect(PANNEAU).toMatch(/className="long"/);
    expect(PANNEAU).toMatch(/className="court"/);
  });

  it("n’en montre jamais qu’une des deux à la fois", () => {
    expect(CSS).toMatch(/\.calendrier-jour \.court,\s*\n\.calendrier-marque \.court \{ display: none; \}/);
    expect(CSS).toMatch(/\.game-stage\.mobile \.calendrier-jour \.long/);
    expect(CSS).toMatch(/\.game-stage\.mobile \.calendrier-jour \.court/);
  });
});
