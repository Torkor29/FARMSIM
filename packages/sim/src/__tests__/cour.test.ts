import {
  DEFAULT_GRID,
  YARD_H,
  YARD_W,
  isYardCell,
  overlapsYard,
  yardCells,
} from "@farmsim/shared";

/**
 * La cour de ferme.
 *
 * Les livraisons se posaient sur n'importe quelle case libre. Une ferme bien
 * bâtie n'en a plus une seule, et l'achat devenait alors impossible : le jeu
 * punissait le développement de la ferme.
 */
describe("la cour de ferme", () => {
  const H = DEFAULT_GRID.h;

  it("fait bien dix cases, comme annoncé", () => {
    expect(YARD_W * YARD_H).toBe(10);
    expect(yardCells(H)).toHaveLength(10);
  });

  it("se tient au bord d'entrée, en bas à gauche", () => {
    for (const c of yardCells(H)) {
      expect(`${c.x},${c.y} ${c.x < YARD_W && c.y >= H - YARD_H}`).toBe(`${c.x},${c.y} true`);
    }
    expect(isYardCell(0, H - 1, H)).toBe(true);
    expect(isYardCell(YARD_W - 1, H - YARD_H, H)).toBe(true);
  });

  it("laisse le reste du champ libre", () => {
    expect(isYardCell(YARD_W, H - 1, H)).toBe(false);
    expect(isYardCell(0, H - YARD_H - 1, H)).toBe(false);
    expect(isYardCell(6, 6, H)).toBe(false);
    // Elle ne prend pas la moitié du champ : moins de sept pour cent.
    const part = (YARD_W * YARD_H) / (DEFAULT_GRID.w * DEFAULT_GRID.h);
    expect(part).toBeLessThan(0.08);
  });

  it("refuse une emprise qui mord dessus, même d'une seule case", () => {
    // Un bâtiment 3×3 posé juste au-dessus la touche par son coin bas-gauche.
    expect(overlapsYard({ x: YARD_W - 1, y: H - YARD_H, w: 3, h: 3 }, H)).toBe(true);
    expect(overlapsYard({ x: 0, y: H - 1, w: 1, h: 1 }, H)).toBe(true);
  });

  it("laisse passer ce qui est à côté", () => {
    // Collé à droite de la cour, et collé au-dessus : les deux doivent passer.
    expect(overlapsYard({ x: YARD_W, y: H - YARD_H, w: 3, h: 2 }, H)).toBe(false);
    expect(overlapsYard({ x: 0, y: H - YARD_H - 3, w: 3, h: 3 }, H)).toBe(false);
  });

  it("suit la hauteur de la grille, quelle qu'elle soit", () => {
    // Une parcelle plus haute garde sa cour en bas, pas au milieu.
    expect(isYardCell(0, 19, 20)).toBe(true);
    expect(isYardCell(0, 11, 20)).toBe(false);
  });
});
