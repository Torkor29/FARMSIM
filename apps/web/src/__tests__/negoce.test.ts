import fs from "node:fs";

import { nomNegoce, partNegoce, partPropre } from "@farmsim/shared";

/**
 * Ce qu'on achète au négociant ne se revend pas aux joueurs.
 *
 * Signalé en jeu : paille achetée au PNJ, revendue à un second compte au
 * plafond de la criée, en boucle. Chaque lot garde sa part du négoce ; seule
 * la production du joueur se met en annonce.
 */
const MARCHE = fs.readFileSync("src/MarketPanel.tsx", "utf8");

describe("le négoce", () => {
  it("se borne au lot, et le reste est la production du joueur", () => {
    expect(partNegoce({ qty: 5, negoce: 2 })).toBe(2);
    expect(partPropre({ qty: 5, negoce: 2 })).toBe(3);
    // Un lot entamé ne peut pas garder plus de négoce qu'il n'a de tonnes.
    expect(partNegoce({ qty: 1, negoce: 4 })).toBe(1);
    expect(partPropre({ qty: 1, negoce: 4 })).toBe(0);
    // Les lots d'avant la marque sont de la production.
    expect(partPropre({ qty: 3 })).toBe(3);
  });

  it("porte son propre nom", () => {
    expect(nomNegoce("STRAW")).toBe("Paille du négoce");
    expect(nomNegoce("HAY")).toBe("Foin du négoce");
  });

  it("ne se met pas en annonce, et se jette pour faire de la place", () => {
    expect(MARCHE).toMatch(/ne se vend pas aux joueurs/);
    expect(MARCHE).toMatch(/tons > partPropre\(item\) \+ 0\.005/);
    expect(MARCHE).toMatch(/Jeter le négoce/);
  });
});
