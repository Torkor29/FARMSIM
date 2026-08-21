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

  /**
   * Une place vide est une promesse, et elle doit être tenue.
   *
   * La cour suivait le **parc**, en s'agrandissant par paires pour que
   * l'agrandissement se voie — il restait donc toujours une place libre après
   * un achat. Sauf que le nombre d'engins est plafonné ailleurs, par le
   * garage : cette place libre ne pouvait pas être occupée. Le joueur la
   * voyait, allait acheter, et se faisait refuser au motif qu'il lui faut un
   * hangar. « Le parking s'agrandit pour rien, car tu ne peux pas
   * l'utiliser. »
   *
   * La cour se dimensionne maintenant sur la **capacité**. Elle ne dit plus
   * que ce qu'elle peut tenir.
   */
  it("dessine exactement les places qu'on a le droit d'occuper", () => {
    for (const places of [5, 6, 7, 11, 30]) {
      expect(`capacité ${places} → ${parkingLayout(places).bays}`).toBe(
        `capacité ${places} → ${places}`,
      );
    }
  });

  it("ne promet aucune place au-delà de la capacité", () => {
    // Le défaut exact du signalement : à cinq places de garage, la cour en
    // montrait six. La sixième ne servait à rien — l'achat était refusé.
    expect(parkingLayout(5).bays).toBe(5);
    expect(parkingLayout(7).bays).toBe(7);
  });

  it("ne s'agrandit plus toute seule — il faut bâtir le hangar", () => {
    // La capacité de départ, puis celle qu'ouvre un hangar : c'est la
    // construction qui fait grandir la cour, et ça se voit.
    const depart = parkingLayout(5).bays;
    const avecHangar = parkingLayout(11).bays;
    expect(avecHangar).toBeGreaterThan(depart);
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
