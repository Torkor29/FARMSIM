import {
  BAYS_PER_ROW,
  BAY_ACROSS,
  BAY_ALONG,
  MIN_BAYS,
  parkingLayout,
  parkingSlot,
} from "@farmsim/shared";

/**
 * La cour de stationnement.
 *
 * Un engin garé mangeait une case de champ. Le parc est maintenant une aire
 * posée à côté de l'île : ces tests fixent sa géométrie, faute de quoi deux
 * machines se garent au même endroit ou débordent du béton.
 */
describe("la cour de stationnement", () => {
  it("dessine au moins quatre places, même pour un seul tracteur", () => {
    expect(parkingLayout(0).bays).toBe(MIN_BAYS);
    expect(parkingLayout(1).bays).toBe(MIN_BAYS);
    expect(parkingLayout(MIN_BAYS + 3).bays).toBe(MIN_BAYS + 3);
  });

  it("empile une seconde rangée plutôt que de s'allonger sans fin", () => {
    const petite = parkingLayout(BAYS_PER_ROW);
    expect(petite.rows).toBe(1);
    expect(petite.perRow).toBe(BAYS_PER_ROW);

    const grande = parkingLayout(BAYS_PER_ROW + 1);
    expect(grande.rows).toBe(2);
    // L'aire s'épaissit vers l'ouest, elle ne s'étire pas davantage.
    expect(grande.d).toBe(petite.d);
    expect(grande.w).toBeGreaterThan(petite.w);
  });

  it("ne fait jamais se chevaucher deux places", () => {
    const layout = parkingLayout(9);
    const vus = new Set<string>();
    for (let i = 0; i < layout.bays; i++) {
      const { dx, dz } = parkingSlot(i, layout);
      const k = `${dx.toFixed(3)},${dz.toFixed(3)}`;
      expect(vus.has(k)).toBe(false);
      vus.add(k);
    }
    expect(vus.size).toBe(layout.bays);
  });

  it("garde chaque engin sur le béton", () => {
    for (const parc of [1, 5, 6, 12]) {
      const layout = parkingLayout(parc);
      for (let i = 0; i < layout.bays; i++) {
        const { dx, dz } = parkingSlot(i, layout);
        const debordeX = Math.abs(dx) + BAY_ALONG / 2 > layout.w / 2;
        const debordeZ = Math.abs(dz) + BAY_ACROSS / 2 > layout.d / 2;
        expect(`parc ${parc} place ${i} ${debordeX || debordeZ}`).toBe(
          `parc ${parc} place ${i} false`,
        );
      }
    }
  });

  it("remplit d'abord la rangée qui borde le champ", () => {
    const layout = parkingLayout(BAYS_PER_ROW + 2);
    const premiere = parkingSlot(0, layout);
    const seconde = parkingSlot(BAYS_PER_ROW, layout);
    // `dx` croît vers le champ : la place n° 0 est devant, pas au fond.
    expect(premiere.dx).toBeGreaterThan(seconde.dx);
  });
});
