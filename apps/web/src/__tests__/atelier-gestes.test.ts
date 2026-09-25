import fs from "node:fs";

import {
  GRAISSEURS,
  TOLERANCE_GRAISSE,
  VITESSE_ROUE,
  etoilesGraissage,
  etoilesLavage,
} from "../atelier-notes";

/**
 * Les jeux d'atelier sont de vrais petits jeux, dessinés.
 *
 * « Les jeux sont horribles. » Des ronds posés sur une photo, puis une jauge à
 * relâcher et une boue à gratter : des gestes, pas des jeux. Ils deviennent
 * la roue à graisser — un tir au bon moment — et la station de lavage — un
 * jet qu'on dirige sur des paquets de boue qui éclatent.
 */
const JEUX = fs.readFileSync("src/AtelierJeux.tsx", "utf8");
const OVERLAY = fs.readFileSync("src/MachineCareOverlay.tsx", "utf8");

describe("la roue à graisser", () => {
  it("laisse le temps de viser sans laisser de place au hasard", () => {
    // Le graisseur reste sous la buse entre un quart et une demi-seconde.
    const fenetre = (2 * TOLERANCE_GRAISSE) / VITESSE_ROUE;
    expect(fenetre).toBeGreaterThan(0.25);
    expect(fenetre).toBeLessThan(0.5);
    expect(GRAISSEURS).toBe(5);
  });

  it("accélère, change de sens, et marque les tirs ratés", () => {
    expect(JEUX).toMatch(/e\.vitesse \*= 1\.16/);
    expect(JEUX).toMatch(/if \(faits === 2 \|\| faits === 4\) e\.sens \*= -1/);
    expect(JEUX).toMatch(/e\.taches\.push/);
  });

  it("note le premier essai, et ne descend jamais sous une étoile", () => {
    expect(etoilesGraissage(0)).toBe(3);
    expect(etoilesGraissage(2)).toBe(2);
    expect(etoilesGraissage(9)).toBe(1);
  });
});

describe("la station de lavage", () => {
  it("fait éclater des paquets de boue, la boue sèche tenant plus longtemps", () => {
    expect(JEUX).toMatch(/pv: p\.sec \? 1\.7 : 1/);
    expect(JEUX).toMatch(/Splash !/);
  });

  it("se joue aussi au clavier : Espace vise le paquet suivant", () => {
    expect(JEUX).toMatch(/etat\.current\.clavier = true/);
  });

  it("récompense la vitesse sans jamais punir", () => {
    expect(etoilesLavage(5)).toBe(3);
    expect(etoilesLavage(10)).toBe(2);
    expect(etoilesLavage(60)).toBe(1);
  });
});

describe("l'atelier", () => {
  it("n'a plus de photo à ronds ni de jauge à relâcher pour ces deux gestes", () => {
    expect(OVERLAY).toMatch(/<JeuGraissage onFini=\{fini\} \/>/);
    expect(OVERLAY).toMatch(/<JeuLavage onFini=\{fini\} \/>/);
    expect(OVERLAY).not.toMatch(/PompeAGraisse|Karcher|GREASE_POINTS/);
  });

  it("garde une note qui ne change pas ce que l'entretien rapporte", () => {
    expect(OVERLAY).toMatch(/onDone: \(\) => void;/);
  });
});
