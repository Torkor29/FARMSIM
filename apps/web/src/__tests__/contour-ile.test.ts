import { pansDeHaie, rectanglesDeCases } from "../contour-ile";

/**
 * Le contour d'une île réunie : une dalle par rectangle, une haie qui suit le bord.
 */
const carre = (x0: number, y0: number, w: number, h: number) => {
  const out: { x: number; y: number }[] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push({ x, y });
  return out;
};

describe("les rectangles d'une île", () => {
  it("une parcelle seule : un rectangle", () => {
    expect(rectanglesDeCases(carre(0, 0, 12, 12))).toEqual([{ x0: 0, x1: 11, y0: 0, y1: 11 }]);
  });

  it("deux parcelles et leur chemin : trois rectangles qui couvrent tout, sans recouvrement", () => {
    // Une 12×12, un chemin de 8 cases, puis une 10×10 centrée.
    const cells = [...carre(0, 0, 12, 12), ...carre(12, 1, 8, 10), ...carre(20, 1, 10, 10)];
    const rects = rectanglesDeCases(cells);
    const surface = rects.reduce((n, r) => n + (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1), 0);
    expect(surface).toBe(cells.length);
    expect(rects.length).toBeLessThanOrEqual(3);
  });
});

describe("la haie d'une île", () => {
  it("un carré : quatre pans, prolongés aux coins", () => {
    const pans = pansDeHaie(carre(0, 0, 2, 2), 0.5);
    expect(pans).toHaveLength(4);
    for (const p of pans) {
      expect(p.debut).toBe(-0.5);
      expect(p.fin).toBe(2.5);
    }
  });

  it("un L : six pans, le coin rentrant raccourci", () => {
    // Deux cases en bas, une en haut à gauche.
    const pans = pansDeHaie([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], 0.25);
    expect(pans).toHaveLength(6);
    // Le pan du haut de la case (1,1), en y = 1 − 0,25, court de 1 + 0,25 (rentrant) à 2 + 0,25 (saillant).
    const rentrant = pans.find((p) => p.axe === "x" && p.normale === -1 && p.a === 0.75)!;
    expect(rentrant.debut).toBe(1.25);
    expect(rentrant.fin).toBe(2.25);
  });

  it("deux parcelles réunies : la haie passe autour, jamais entre", () => {
    const cells = [...carre(0, 0, 12, 12), ...carre(12, 1, 8, 10), ...carre(20, 1, 10, 10)];
    const pans = pansDeHaie(cells, 0.4);
    // Aucun pan ne court à l'intérieur de l'île : ni le long du bord est de la
    // première parcelle là où le chemin la prolonge, ni à l'ouest de la seconde.
    for (const p of pans.filter((q) => q.axe === "y")) {
      expect([0 - 0.4, 12 + 0.4, 20 - 0.4, 30 + 0.4, 12 - 0.4, 20 + 0.4].some((a) => Math.abs(p.a - a) < 1e-9)).toBe(true);
      if (Math.abs(p.a - (12 + 0.4)) < 1e-9) {
        // Le bord est de la première, seulement au-dessus et au-dessous du chemin.
        expect(p.fin <= 1 + 1e-9 || p.debut >= 11 - 1e-9).toBe(true);
      }
    }
  });
});
