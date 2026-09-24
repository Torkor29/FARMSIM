import fs from "node:fs";

import { GREASE_POINTS } from "@farmsim/shared";
import {
  SEUIL_PROPRE,
  ZONE_GRAISSE,
  etoilesGraissage,
  etoilesLavage,
} from "../atelier-notes";

/**
 * Les mini-jeux d'atelier sont des gestes, plus des ronds à toucher.
 *
 * « J'aimerais refaire le jeu de dégraissage et l'autre pour un truc un peu
 * plus sympa. » Le graissage se joue à la pompe — appuyer, maintenir,
 * relâcher dans le vert — et le lavage au jet, sur une boue qu'on décape.
 */
const SRC = fs.readFileSync("src/MachineCareOverlay.tsx", "utf8");

describe("la pompe à graisse", () => {
  it("a une zone verte qu'on peut viser, ni trop tôt ni collée au débordement", () => {
    expect(ZONE_GRAISSE.min).toBeGreaterThan(0.4);
    expect(ZONE_GRAISSE.max).toBeLessThan(1);
    // Au moins deux coups de pompe de large : sinon c'est de la chance.
    expect(ZONE_GRAISSE.max - ZONE_GRAISSE.min).toBeGreaterThanOrEqual(0.15);
  });

  it("note le premier essai, et ne descend jamais sous une étoile", () => {
    expect(etoilesGraissage(0)).toBe(3);
    expect(etoilesGraissage(1)).toBe(2);
    expect(etoilesGraissage(2)).toBe(2);
    expect(etoilesGraissage(9)).toBe(1);
  });

  it("se joue en maintenant, avec un débordement à essuyer", () => {
    expect(SRC).toMatch(/window\.addEventListener\("pointerup", relacher\)/);
    expect(SRC).toMatch(/className="care-debord"/);
    expect(SRC).toMatch(/Maintenir pour pomper/);
    // Plus de ronds à toucher un par un.
    expect(SRC).not.toMatch(/tapGrease|DUST_POINTS|MUD_POINTS/);
  });

  it("pose ses graisseurs sur l'illustration, pas dans ses marges", () => {
    for (const p of GREASE_POINTS) {
      expect(p.x).toBeGreaterThan(5);
      expect(p.x).toBeLessThan(95);
      expect(p.y).toBeGreaterThan(5);
      expect(p.y).toBeLessThan(95);
    }
  });
});

describe("le nettoyeur haute pression", () => {
  it("s'arrête à 90 % et récompense la vitesse sans jamais punir", () => {
    expect(SEUIL_PROPRE).toBe(0.9);
    expect(etoilesLavage(5)).toBe(3);
    expect(etoilesLavage(12)).toBe(2);
    expect(etoilesLavage(120)).toBe(1);
  });

  it("décape une couche de boue au doigt, comme un ticket à gratter", () => {
    expect(SRC).toMatch(/globalCompositeOperation = "destination-out"/);
    expect(SRC).toMatch(/className="care-boue"/);
    expect(SRC).toMatch(/care-goutte/);
  });
});

describe("la note", () => {
  it("reste un plaisir : elle ne change pas ce que l'entretien rapporte", () => {
    // `onDone` ne reçoit rien : le serveur ne voit pas les étoiles.
    expect(SRC).toMatch(/onDone: \(\) => void;/);
  });
});
