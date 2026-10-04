import {
  PAS_TRAME_CASES,
  PRIX_REUNION_PAR_CASE,
  couloirEntre,
  decalageDansHote,
  rectDansHote,
  separeesParLaCour,
  separeesParLaRoute,
  surfaceRect,
  tourner,
} from "@farmsim/shared";

/**
 * Réunir deux parcelles : où tombe l'une dans l'autre, et quel chemin devient du champ.
 */
const p = (mapX: number, mapY: number, cote = 12) => ({ mapX, mapY, gridW: cote, gridH: cote });

describe("la place d'une parcelle dans l'hôte", () => {
  it("un pas de trame tout rond, plus la demi-différence des tailles", () => {
    expect(decalageDansHote(p(4, 4), p(5, 4), 0)).toEqual({ dx: PAS_TRAME_CASES, dy: 0 });
    // Une 10×10 à côté d'une 12×12 : centrée sur sa case, donc décalée d'une case.
    expect(decalageDansHote(p(4, 4), p(5, 4, 10), 0)).toEqual({ dx: PAS_TRAME_CASES + 1, dy: 1 });
  });

  it("suit l'orientation du paysage", () => {
    for (const q of [0, 1, 2, 3] as const) {
      const t = tourner({ col: 1, rang: 0 }, q);
      expect(decalageDansHote(p(4, 4), p(5, 4), q)).toEqual({ dx: t.col * PAS_TRAME_CASES, dy: t.rang * PAS_TRAME_CASES });
    }
  });

  it("se compose sans glisser : réunir par étapes ou d'un coup donne la même place", () => {
    // C dans B, puis B dans A, ou C directement dans A.
    const A = p(4, 4, 12);
    const B = p(5, 4, 16);
    const C = p(6, 4, 10);
    for (const q of [0, 1, 2, 3] as const) {
      const cb = decalageDansHote(B, C, q);
      const ba = decalageDansHote(A, B, q);
      expect({ dx: cb.dx + ba.dx, dy: cb.dy + ba.dy }).toEqual(decalageDansHote(A, C, q));
    }
  });
});

describe("le chemin entre deux parcelles", () => {
  it("la bande qui les sépare, sur la longueur où elles se font face", () => {
    const a = rectDansHote(p(4, 4), p(4, 4), 0);
    const b = rectDansHote(p(4, 4), p(5, 4, 10), 0);
    const c = couloirEntre(a, b)!;
    // De la fin de la première (x = 11) au début de la seconde (x = 21), sur les rangées communes.
    expect(c).toEqual({ x0: 12, x1: 20, y0: 1, y1: 10 });
    expect(surfaceRect(c) * PRIX_REUNION_PAR_CASE).toBe(9 * 10 * 50);
  });

  it("rien en diagonale", () => {
    const a = rectDansHote(p(4, 4), p(4, 4), 0);
    const d = rectDansHote(p(4, 4), p(5, 5), 0);
    expect(couloirEntre(a, d)).toBeNull();
  });
});

describe("ce qui ne s'efface pas", () => {
  const siege = { mapX: 4, mapY: 4 };

  it("la route : entre le rang du siège et le suivant, sur toute la commune", () => {
    expect(separeesParLaRoute(siege, p(4, 4), p(4, 5), 0)).toBe(true);
    expect(separeesParLaRoute(siege, p(6, 4), p(6, 5), 0)).toBe(true);
    expect(separeesParLaRoute(siege, p(4, 4), p(5, 4), 0)).toBe(false);
    expect(separeesParLaRoute(siege, p(4, 3), p(4, 4), 0)).toBe(false);
  });

  it("la cour : entre le siège et sa voisine de l'ouest, et seulement elle", () => {
    expect(separeesParLaCour(siege, p(4, 4), p(3, 4), 0)).toBe(true);
    expect(separeesParLaCour(siege, p(3, 4), p(2, 4), 0)).toBe(false);
    expect(separeesParLaCour(siege, p(4, 4), p(5, 4), 0)).toBe(false);
  });
});
