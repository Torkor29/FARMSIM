import { applySelection, expandBrush, rectBetween } from "../ui/selection";

/**
 * Le glissé en rectangle.
 *
 * « Quand je glisse le doigt j'aimerais pouvoir faire aussi un carré, pas
 * juste des zigzags qui buguent. » Le tracé ne savait que suivre le doigt :
 * pour prendre une bande, il fallait repasser sur chaque case, et le moindre
 * écart de trajet se voyait dans la sélection.
 *
 * Le rectangle se redessine **en entier** à chaque image, à partir des deux
 * coins. C'est ce qui le distingue d'une trace qu'on allonge — et c'est aussi
 * ce qui permet de reculer le doigt pour le rétrécir.
 */
describe("le glissé en rectangle", () => {
  const G = 12;

  it("prend le bloc plein entre les deux coins", () => {
    const bloc = rectBetween({ x: 2, y: 3 }, { x: 4, y: 5 }, G, G);
    expect(bloc).toHaveLength(9);
    expect(bloc).toContainEqual({ x: 3, y: 4 });
  });

  it("se rétrécit quand le doigt revient en arrière", () => {
    // Le défaut d'une trace qu'on allonge : les cases du plus grand rectangle
    // atteint resteraient derrière. Ici chaque image repart des deux coins.
    const grand = rectBetween({ x: 0, y: 0 }, { x: 5, y: 5 }, G, G);
    const petit = rectBetween({ x: 0, y: 0 }, { x: 1, y: 1 }, G, G);
    expect(grand).toHaveLength(36);
    expect(petit).toHaveLength(4);
    expect(petit).not.toContainEqual({ x: 5, y: 5 });
  });

  it("marche dans les quatre sens, pas seulement vers le bas à droite", () => {
    // Un doigt qui remonte vers la gauche décrit le même rectangle.
    const bas = rectBetween({ x: 1, y: 1 }, { x: 3, y: 3 }, G, G);
    const haut = rectBetween({ x: 3, y: 3 }, { x: 1, y: 1 }, G, G);
    expect(haut).toEqual(bas);
  });

  it("ne déborde jamais de la grille", () => {
    const bloc = rectBetween({ x: 10, y: 10 }, { x: 40, y: 40 }, G, G);
    for (const c of bloc) {
      expect(`${c.x},${c.y} dans la grille`).toBe(
        `${c.x},${c.y} ${c.x < G && c.y < G ? "dans la grille" : "dehors"}`,
      );
    }
  });

  it("se combine au pinceau et à la sélection d’avant le geste", () => {
    /*
     * Le rectangle traverse la même chaîne qu'une trace : élargi par le
     * pinceau, puis fondu dans la sélection selon le mode du geste. C'est ce
     * qui garantit qu'il se comporte comme le reste — un tracé additif ajoute,
     * un tracé qui remplace remplace.
     */
    const bloc = rectBetween({ x: 0, y: 0 }, { x: 1, y: 1 }, G, G);
    const elargi = expandBrush(bloc, 1, G, G);
    const avant = [{ x: 9, y: 9 }];
    expect(applySelection(avant, elargi, "add")).toHaveLength(5);
    expect(applySelection(avant, elargi, "replace")).toHaveLength(4);
  });
});
