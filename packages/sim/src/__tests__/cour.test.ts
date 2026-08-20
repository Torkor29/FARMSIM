import {
  DEFAULT_GRID,
  YARD_H,
  YARD_PLACES,
  YARD_SIZE,
  YARD_SLOT,
  YARD_W,
  freeYardSlot,
  isYardSlot,
  yardSlotOffset,
  yardSlots,
} from "@farmsim/shared";

/**
 * La cour de ferme.
 *
 * Les livraisons se posaient sur n'importe quelle case libre : une ferme bien
 * bâtie n'en avait plus une seule, et l'achat devenait impossible. La cour a
 * d'abord réservé dix cases dans la grille — au prix de dix cases de blé et
 * d'un camion qui déchargeait au milieu du champ. Elle est maintenant **hors**
 * de la grille : dix places à côté de la parcelle.
 */
describe("la cour de ferme", () => {
  it("offre bien dix places, comme annoncé", () => {
    expect(YARD_W * YARD_H).toBe(10);
    expect(YARD_PLACES).toBe(10);
    expect(yardSlots()).toHaveLength(10);
  });

  it("ne prend plus une seule case de champ", () => {
    // Le champ entier redevient cultivable : c'est tout l'objet de la sortie
    // de la cour. Aucune place ne porte de coordonnée de grille.
    for (const s of yardSlots()) {
      expect(isYardSlot(s)).toBe(true);
    }
    expect(DEFAULT_GRID.w * DEFAULT_GRID.h).toBe(144);
  });

  it("rejette une place qui n'existe pas", () => {
    expect(isYardSlot({ x: -1, y: 0 })).toBe(false);
    expect(isYardSlot({ x: YARD_W, y: 0 })).toBe(false);
    expect(isYardSlot({ x: 0, y: YARD_H })).toBe(false);
    expect(isYardSlot({ x: 1.5, y: 0 })).toBe(false);
  });

  it("remplit la cour place par place, sans jamais superposer", () => {
    const prises: { x: number; y: number }[] = [];
    for (let i = 0; i < YARD_PLACES; i++) {
      const libre = freeYardSlot(prises);
      expect(libre).not.toBeNull();
      // Deux commandes coup sur coup ne doivent pas tomber au même endroit :
      // il n'y aurait qu'un objet à cliquer pour deux caisses.
      expect(prises.some((p) => p.x === libre!.x && p.y === libre!.y)).toBe(false);
      prises.push(libre!);
    }
    expect(freeYardSlot(prises)).toBeNull();
  });

  it("rend une place dès qu'une caisse est rentrée", () => {
    const toutes = yardSlots();
    const saufUne = toutes.slice(1);
    expect(freeYardSlot(saufUne)).toEqual(toutes[0]);
  });

  it("garde chaque place sur le béton de l'aire", () => {
    for (const s of yardSlots()) {
      const { dx, dz } = yardSlotOffset(s);
      expect(Math.abs(dx) + YARD_SLOT / 2).toBeLessThanOrEqual(YARD_SIZE.w / 2);
      expect(Math.abs(dz) + YARD_SLOT / 2).toBeLessThanOrEqual(YARD_SIZE.d / 2);
    }
  });

  it("place la première rangée du côté du champ", () => {
    // On sort par l'ouverture et on tombe sur la rangée qu'on remplit d'abord.
    const premiere = yardSlotOffset({ x: 0, y: 0 });
    const seconde = yardSlotOffset({ x: 0, y: 1 });
    expect(premiere.dx).toBeGreaterThan(seconde.dx);
  });
});
