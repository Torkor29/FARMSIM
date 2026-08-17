/**
 * Modèle de sélection.
 *
 * Premiers tests d'interface du projet : les 230 tests existants du front
 * portaient tous sur des maillages 3D, et rien ne couvrait la logique que le
 * joueur manipule à chaque clic. Ces règles-là ont un contrat vérifiable —
 * elles ne dépendent ni du DOM, ni de Three.js, ni du serveur.
 */

import {
  applySelection,
  brushBlock,
  cellKey,
  dedupe,
  expandBrush,
  readMods,
  rectBetween,
  TOUCH_MODS,
  type Cell,
} from "../ui/selection";

const ev = (o: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {}) => ({
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...o,
});

const keys = (cells: Cell[]) => cells.map(cellKey).sort();

describe("readMods", () => {
  it("remplace par défaut à la souris — convention de bureau", () => {
    expect(readMods(ev(), false)).toEqual({ mode: "replace", extend: false });
  });

  it("ajoute au doigt, quels que soient les modificateurs", () => {
    // Un écran tactile n'a pas de Ctrl : le tracé additif était le
    // comportement d'origine, et il ne doit pas changer.
    expect(readMods(ev(), true)).toEqual(TOUCH_MODS);
    expect(readMods(ev({ ctrlKey: true }), true)).toEqual(TOUCH_MODS);
  });

  it("Ctrl bascule, Cmd fait pareil pour les Mac", () => {
    expect(readMods(ev({ ctrlKey: true }), false).mode).toBe("toggle");
    expect(readMods(ev({ metaKey: true }), false).mode).toBe("toggle");
  });

  it("Alt retire", () => {
    expect(readMods(ev({ altKey: true }), false).mode).toBe("remove");
  });

  it("Maj étend", () => {
    expect(readMods(ev({ shiftKey: true }), false)).toEqual({ mode: "add", extend: true });
  });

  it("Alt l'emporte sur Ctrl — retirer est le geste le moins ambigu", () => {
    expect(readMods(ev({ altKey: true, ctrlKey: true }), false).mode).toBe("remove");
  });
});

describe("applySelection", () => {
  const prev: Cell[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ];

  it("replace ignore la sélection précédente", () => {
    expect(keys(applySelection(prev, [{ x: 5, y: 5 }], "replace"))).toEqual(["5,5"]);
  });

  it("add fait l'union sans doublon", () => {
    const out = applySelection(prev, [{ x: 1, y: 0 }, { x: 2, y: 0 }], "add");
    expect(keys(out)).toEqual(["0,0", "1,0", "2,0"]);
  });

  it("remove fait la différence", () => {
    expect(keys(applySelection(prev, [{ x: 1, y: 0 }], "remove"))).toEqual(["0,0"]);
  });

  it("remove sur une case absente ne change rien", () => {
    expect(keys(applySelection(prev, [{ x: 9, y: 9 }], "remove"))).toEqual(["0,0", "1,0"]);
  });

  it("toggle bascule chaque case une seule fois", () => {
    // Le point du mode `toggle` : un Ctrl+tracé qui repasse deux fois sur la
    // même case ne doit pas l'ajouter puis la retirer.
    const out = applySelection(prev, [{ x: 1, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }], "toggle");
    expect(keys(out)).toEqual(["0,0", "3,0"]);
  });

  it("garde l'ordre d'insertion — l'engin suit ce parcours", () => {
    const out = applySelection([], [{ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }], "replace");
    expect(out.map(cellKey)).toEqual(["2,0", "0,0", "1,0"]);
  });

  it("ne modifie pas le tableau reçu", () => {
    const base = [...prev];
    applySelection(base, [{ x: 7, y: 7 }], "add");
    expect(base).toHaveLength(2);
  });
});

describe("rectBetween", () => {
  it("prend les deux coins, quel que soit leur ordre", () => {
    const a = rectBetween({ x: 3, y: 3 }, { x: 1, y: 1 }, 10, 10);
    expect(keys(a)).toEqual(keys(rectBetween({ x: 1, y: 1 }, { x: 3, y: 3 }, 10, 10)));
    expect(a).toHaveLength(9);
  });

  it("un rectangle d'une seule case reste une case", () => {
    expect(rectBetween({ x: 2, y: 2 }, { x: 2, y: 2 }, 10, 10)).toHaveLength(1);
  });

  it("se borne à la grille", () => {
    // Sans bornes, Maj+clic près d'un bord retenait des cases inexistantes,
    // que le serveur refusait ensuite une par une.
    const out = rectBetween({ x: -5, y: -5 }, { x: 99, y: 99 }, 3, 2);
    expect(out).toHaveLength(6);
    expect(out.every((c) => c.x >= 0 && c.x < 3 && c.y >= 0 && c.y < 2)).toBe(true);
  });
});

describe("pinceau", () => {
  it("brushBlock donne un carré n×n", () => {
    expect(brushBlock({ x: 0, y: 0 }, 3, 10, 10)).toHaveLength(9);
  });

  it("se borne au bord de la grille", () => {
    expect(brushBlock({ x: 9, y: 9 }, 3, 10, 10)).toHaveLength(1);
  });

  it("expandBrush ne double aucune case sur un tracé qui se recoupe", () => {
    const out = expandBrush([{ x: 0, y: 0 }, { x: 1, y: 0 }], 2, 10, 10);
    expect(out).toHaveLength(6);
    expect(new Set(out.map(cellKey)).size).toBe(6);
  });

  it("expandBrush à 1 se contente de dédoublonner", () => {
    expect(expandBrush([{ x: 1, y: 1 }, { x: 1, y: 1 }], 1, 10, 10)).toHaveLength(1);
  });
});

describe("dedupe", () => {
  it("garde le premier passage", () => {
    const out = dedupe([{ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 1 }]);
    expect(out.map(cellKey)).toEqual(["1,1", "0,0"]);
  });
});
