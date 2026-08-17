import { rectCells, rectFootprint } from "../rect-select";

describe("sélection rectangulaire", () => {
  it("remplit le carré entre deux coins, dans n'importe quel sens", () => {
    const a = rectCells({ x: 2, y: 1 }, { x: 4, y: 3 }, 12, 12);
    const b = rectCells({ x: 4, y: 3 }, { x: 2, y: 1 }, 12, 12);
    expect(a).toHaveLength(9);
    expect(b).toEqual(a);
    expect(a[0]).toEqual({ x: 2, y: 1 });
    expect(a[a.length - 1]).toEqual({ x: 4, y: 3 });
  });

  it("accepte une seule case", () => {
    expect(rectCells({ x: 5, y: 5 }, { x: 5, y: 5 }, 12, 12)).toEqual([{ x: 5, y: 5 }]);
  });

  it("reste dans la grille", () => {
    const cells = rectCells({ x: -4, y: 10 }, { x: 40, y: 11 }, 8, 12);
    expect(cells.every((c) => c.x >= 0 && c.x < 8 && c.y >= 0 && c.y < 12)).toBe(true);
    expect(rectFootprint(cells)).toEqual({ w: 8, h: 2 });
  });

  it("chiffre largeur et hauteur pour le toast", () => {
    expect(rectFootprint(rectCells({ x: 0, y: 0 }, { x: 3, y: 1 }, 10, 10))).toEqual({
      w: 4,
      h: 2,
    });
    expect(rectFootprint([])).toEqual({ w: 0, h: 0 });
  });
});
