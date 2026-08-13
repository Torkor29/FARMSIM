import {
  ART_ALPHA_CUTOFF,
  artGroundFraction,
  billboardLift,
  opaqueRowSpans,
} from "@farmsim/shared";

function rgba(
  width: number,
  height: number,
  paint: (x: number, y: number) => boolean,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!paint(x, y)) continue;
      const i = (y * width + x) * 4;
      data[i] = 180;
      data[i + 1] = 120;
      data[i + 2] = 40;
      data[i + 3] = 255;
    }
  }
  return data;
}

/** Losange 2:1 centré en (cx, cy). */
function inDiamond(
  x: number,
  y: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
): boolean {
  return Math.abs(x - cx) / halfW + Math.abs(y - cy) / halfH <= 1;
}

describe("ancrage des illustrations au sol", () => {
  it("plante le bas d'une image vide ou pleine", () => {
    const empty = opaqueRowSpans(new Uint8ClampedArray(10 * 10 * 4), 10, 10);
    expect(artGroundFraction(empty, 10)).toBe(1);
    expect(artGroundFraction([], 10)).toBe(1);

    const full = rgba(20, 20, () => true);
    expect(artGroundFraction(opaqueRowSpans(full, 20, 20), 20)).toBe(1);
  });

  it("ignore les pixels sous le seuil alpha des panneaux", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 4 * 4; i++) {
      data[i * 4 + 3] = ART_ALPHA_CUTOFF;
    }
    const spans = opaqueRowSpans(data, 4, 4);
    expect(spans.every((s) => s === 0)).toBe(true);
  });

  it("plante l'équateur d'une dalle isométrique, pas le bas du cadre", () => {
    const w = 100;
    const h = 100;
    const data = rgba(w, h, (x, y) => {
      const building = x >= 38 && x <= 62 && y >= 12 && y <= 48;
      const tile = inDiamond(x, y, 50, 62, 46, 22);
      return building || tile;
    });
    const t = artGroundFraction(opaqueRowSpans(data, w, h), w);
    // Équateur du losange vers y=62, pas le point bas vers y=84.
    expect(t).toBeGreaterThan(0.55);
    expect(t).toBeLessThan(0.72);
    expect(t).toBeLessThan(0.84);
  });

  it("garde le pied d'un arbre : houppier large, tronc long", () => {
    const w = 80;
    const h = 120;
    const data = rgba(w, h, (x, y) => {
      const canopy = (x - 40) ** 2 / 34 ** 2 + (y - 36) ** 2 / 28 ** 2 <= 1;
      const trunk = x >= 36 && x <= 44 && y >= 60 && y <= 116;
      return canopy || trunk;
    });
    const t = artGroundFraction(opaqueRowSpans(data, w, h), w);
    expect(t).toBeGreaterThan(0.95);
  });

  it("calcule le relevé du panneau pour poser le rang d'ancrage à l'origine", () => {
    expect(billboardLift(10, 1)).toBe(5);
    expect(billboardLift(10, 0.5)).toBe(0);
    expect(billboardLift(10, 0.66)).toBeCloseTo(1.6, 5);
  });
});
