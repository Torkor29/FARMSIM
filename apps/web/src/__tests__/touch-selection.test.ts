import {
  applySelection,
  readMods,
  TOUCH_MODS,
  TOUCH_STROKE_MODS,
  type Cell,
} from "../ui/selection";

/**
 * Au doigt, un glissé délimite une zone — il ne s'ajoute pas à la précédente.
 *
 * Signalé en jouant : « j'ai sélectionné qu'en bas mais ça m'a sélectionné en
 * haut aussi, je sais pas pourquoi, c'est pas la première fois ». Le haut
 * venait d'un geste précédent. Tout était additif au doigt, donc la sélection
 * ne pouvait que grossir — et la coque tactile n'offrait aucun bouton pour la
 * vider. On finissait par lancer « Labourer ×78 » en croyant en avoir pris
 * vingt, et le champ entier y passait.
 *
 * Le partage est maintenant : **toucher ajoute** (composer case par case sans
 * Ctrl), **glisser remplace** (délimiter une zone, comme dans n'importe quelle
 * liste). Ce sont deux gestes distincts, ils n'ont plus les mêmes mods.
 */
const bas: Cell[] = [
  { x: 0, y: 8 },
  { x: 1, y: 8 },
];
const haut: Cell[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
];

describe("la sélection au doigt", () => {
  it("ne garde pas le geste d’avant quand on glisse ailleurs", () => {
    // Le cœur du signalement : deux glissés, seul le second doit compter.
    const apresPremier = applySelection([], haut, TOUCH_STROKE_MODS.mode);
    const apresSecond = applySelection(apresPremier, bas, TOUCH_STROKE_MODS.mode);
    expect(apresSecond).toEqual(bas);
    expect(apresSecond).not.toContainEqual({ x: 0, y: 0 });
  });

  it("laisse le toucher composer case par case", () => {
    // L'autre moitié du contrat : sans Ctrl au doigt, le toucher reste le seul
    // moyen d'ajouter une case isolée. Il doit rester additif.
    const un = applySelection([], [haut[0]!], TOUCH_MODS.mode);
    const deux = applySelection(un, [bas[0]!], TOUCH_MODS.mode);
    expect(deux).toHaveLength(2);
  });

  it("distingue les deux gestes", () => {
    // S'ils repartageaient le même mode, le défaut reviendrait tel quel.
    expect(TOUCH_MODS.mode).toBe("add");
    expect(TOUCH_STROKE_MODS.mode).toBe("replace");
  });

  it("ne change rien à la souris", () => {
    // Le bureau garde ses modificateurs : un clic remplace, Ctrl bascule,
    // Alt retire, Maj étend. Rien de tout cela ne dépend du tactile.
    const clic = readMods(
      { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
      false,
    );
    expect(clic.mode).toBe("replace");
    const alt = readMods({ ctrlKey: false, metaKey: false, altKey: true, shiftKey: false }, false);
    expect(alt.mode).toBe("remove");
  });
});
