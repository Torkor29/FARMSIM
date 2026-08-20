import {
  BAYS_PER_ROW,
  BAY_ACROSS,
  BAY_ALONG,
  BAY_STEP,
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
  });

  it("s'agrandit par paires, et garde toujours une place d'avance", () => {
    // Une place ajoutée seule est occupée aussitôt : l'agrandissement ne se
    // verrait pas. Par deux, il en reste une de libre après l'achat.
    for (const parc of [5, 6, 7, 8, 9]) {
      const { bays } = parkingLayout(parc);
      expect(`${parc} places=${bays} ${bays % BAY_STEP === 0}`).toBe(
        `${parc} places=${bays} true`,
      );
      expect(bays).toBeGreaterThanOrEqual(parc);
    }
    expect(parkingLayout(5).bays).toBe(6);
    expect(parkingLayout(6).bays).toBe(6);
    expect(parkingLayout(7).bays).toBe(8);
  });

  it("ne refuse jamais une machine : la cour suit le parc", () => {
    // Aucune place ne s'achète. Un parc de trente engins a trente places, et
    // acheter ne peut donc pas échouer faute de cour.
    for (const parc of [1, 12, 30]) {
      expect(parkingLayout(parc).bays).toBeGreaterThanOrEqual(parc);
    }
  });

  it("empile une rangée de plus plutôt que de s'allonger sans fin", () => {
    // Une fois la rangée pleine, la cour s'épaissit vers l'ouest : allongée
    // sans fin, elle sortirait du cadrage avant la dixième machine.
    const pleine = parkingLayout(BAYS_PER_ROW * 2);
    expect(pleine.perRow).toBe(BAYS_PER_ROW);
    expect(pleine.rows).toBe(2);

    const grande = parkingLayout(BAYS_PER_ROW * 2 + 2);
    expect(grande.rows).toBe(3);
    expect(grande.d).toBe(pleine.d);
    expect(grande.w).toBeGreaterThan(pleine.w);
  });

  it("ne met jamais plus de cinq places dans une rangée", () => {
    for (const parc of [1, 4, 6, 9, 14, 40]) {
      expect(parkingLayout(parc).perRow).toBeLessThanOrEqual(BAYS_PER_ROW);
    }
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
