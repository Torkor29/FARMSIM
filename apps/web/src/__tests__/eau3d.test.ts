import { avecStyleCoin, cleCase } from "@farmsim/shared";
import { BISEAU, RIVE, dansForme, formeCase, maillerEau } from "../eau3d";

/**
 * Les lacs : la forme de chaque case, et la nappe qui en sort.
 */
const eaux = (cases: [number, number, number?][]) => new Map(cases.map(([x, y, f]) => [cleCase(x, y), f ?? 0]));

/** Aire de la nappe, en cases², à partir de ses triangles. */
function aire(pos: number[]): number {
  let a = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const [ax, , az, bx, , bz, cx, , cz] = pos.slice(i, i + 9) as number[];
    a += Math.abs((bx! - ax!) * (cz! - az!) - (cx! - ax!) * (bz! - az!)) / 2;
  }
  return a;
}

describe("la forme d'une case d'eau", () => {
  it("une case seule est un disque, en retrait de la berge", () => {
    const f = formeCase(eaux([[0, 0]]), 0, 0);
    const r = 0.5 - RIVE;
    expect(dansForme(f, 0, 0)).toBe(true);
    expect(dansForme(f, r - 0.01, 0)).toBe(true);
    expect(dansForme(f, r * 0.8, r * 0.8)).toBe(false); // coin arrondi
    expect(dansForme(f, 0.45, 0)).toBe(false); // la berge
    const m = maillerEau(eaux([[0, 0]]));
    expect(aire(m.nappe.pos)).toBeCloseTo(Math.PI * r * r, 1);
  });

  it("un coin d'équerre garde son angle, un biseau le coupe droit", () => {
    const r = 0.5 - RIVE;
    const carre = formeCase(eaux([[0, 0, avecStyleCoin(0, 2, 1)]]), 0, 0);
    expect(dansForme(carre, r - 0.02, r - 0.02)).toBe(true);
    const biseau = formeCase(eaux([[0, 0, avecStyleCoin(0, 2, 2)]]), 0, 0);
    expect(dansForme(biseau, r - 0.02, r - 0.02)).toBe(false);
    // Juste en deçà du pan : coupé ; juste au-delà : de l'eau.
    expect(dansForme(biseau, r - (BISEAU / 2 - 0.02), r - (BISEAU / 2 - 0.02))).toBe(false);
    expect(dansForme(biseau, r - (BISEAU / 2 + 0.03), r - (BISEAU / 2 + 0.03))).toBe(true);
    expect(dansForme(biseau, r - BISEAU - 0.02, r - 0.02)).toBe(true);
  });

  it("deux cases d'eau se rejoignent sans couture ni berge entre elles", () => {
    const e = eaux([[0, 0], [1, 0]]);
    const a = formeCase(e, 0, 0);
    const b = formeCase(e, 1, 0);
    expect(dansForme(a, 0.5, 0)).toBe(true);
    expect(dansForme(b, -0.5, 0)).toBe(true);
    // Un lac de 3×3 : la case du centre est de l'eau d'un bord à l'autre.
    const lac: [number, number][] = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) lac.push([x, y]);
    const c = formeCase(eaux(lac), 1, 1);
    for (const [u, v] of [[-0.5, -0.5], [0.5, 0.5], [0, 0]]) expect(dansForme(c, u!, v!)).toBe(true);
  });

  it("un coin rentrant garde sa berge, adoucie d'un congé", () => {
    // Un L : la diagonale (1, −1) est à sec.
    const e = eaux([[0, 0], [1, 0], [0, -1]]);
    const f = formeCase(e, 0, 0);
    expect(f.rentrant[1]).toBe(true);
    // L'encoche : au ras du coin nord-est, c'est la berge.
    expect(dansForme(f, 0.49, -0.49)).toBe(false);
    // Le congé : juste à l'intérieur de l'angle, l'eau reprend.
    expect(dansForme(f, 0.5 - RIVE + 0.02, -0.5 + RIVE - 0.02)).toBe(true);
  });
});

describe("la nappe d'un lac", () => {
  it("a une profondeur qui croît vers le large, et un contour fermé", () => {
    const lac: [number, number][] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) lac.push([x, y]);
    const m = maillerEau(eaux(lac));
    expect(Math.max(...m.nappe.prof)).toBeGreaterThan(1);
    expect(Math.min(...m.nappe.prof)).toBe(0);
    expect(m.large.length).toBeGreaterThan(20);
    // Chaque bout de contour en rejoint un autre : le rivage ne s'interrompt pas.
    const bouts = new Map<string, number>();
    for (let i = 0; i < m.contour.length; i += 2) {
      const k = `${m.contour[i]!.toFixed(4)},${m.contour[i + 1]!.toFixed(4)}`;
      bouts.set(k, (bouts.get(k) ?? 0) + 1);
    }
    for (const n of bouts.values()) expect(n % 2).toBe(0);
  });
});
