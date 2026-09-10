import { globeFitScale, globeSurfaceRadius } from "../globe-geometry";

describe("cadrage du globe", () => {
  const fov = 38 * Math.PI / 180;
  it.each([0.35, 0.56, 0.75, 1, 1.36, 2.4])("garde planète et atmosphère dans le cadre (aspect %s)", (aspect) => {
    const distance = 2 / Math.sin(fov / 2) * 1.18 * globeFitScale(aspect, fov);
    const angularRadius = Math.asin(2 * 1.11 / distance);
    expect(angularRadius).toBeLessThan(fov / 2);
    expect(angularRadius).toBeLessThan(Math.atan(Math.tan(fov / 2) * aspect));
  });
  it("reste défini pendant une mesure de conteneur vide", () => {
    for (const aspect of [0, -1, NaN, Infinity]) expect(globeFitScale(aspect, fov)).toBe(1);
  });
});

describe("relief du globe", () => {
  it("rejoint l’océan sans marche au rivage", () => {
    expect(globeSurfaceRadius(2, -1, 0.4)).toBe(2);
    expect(globeSurfaceRadius(2, 0, 0.4)).toBe(2);
    expect(globeSurfaceRadius(2, 0.000001, 0.4) - 2).toBeLessThan(1e-10);
  });
  it("borne les sommets et conserve des altitudes croissantes", () => {
    let previous = 2;
    for (let h = 0; h <= 2; h += 0.01) {
      const radius = globeSurfaceRadius(2, h, 1);
      expect(radius).toBeGreaterThanOrEqual(previous);
      expect(radius).toBeLessThanOrEqual(2.028);
      previous = radius;
    }
  });
});
