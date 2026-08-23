import {
  caseDeTrame,
  mitoyennes,
  resumerChamp,
  statutParcelle,
  type CaseResumable,
} from "@farmsim/shared";

/**
 * Le résumé d'une parcelle voisine.
 *
 * La campagne 3D inventait ses voisins à partir d'une graine : cultures tirées
 * au sort, états tirés au sort, bâtiments tirés au sort. Or la carte existe, et
 * trente pour cent de ses parcelles appartiennent déjà à des fermes PNJ dont
 * les cases sont semées en base.
 *
 * Ce fichier tient la jointure : ce qu'on lit d'une parcelle à distance, et à
 * qui elle est.
 */

/** Un champ de douze sur douze, dont `n` cases portent `culture`. */
function champ(culture: string, stade: string, n: number): CaseResumable[] {
  const cases: CaseResumable[] = [];
  for (let i = 0; i < 144; i++) {
    cases.push(i < n ? { kind: "CROP", crop: culture, fieldStage: stade } : { kind: "EMPTY" });
  }
  return cases;
}

describe("ce qu’on lit d’un champ à distance", () => {
  it("rend la culture qui occupe le plus de cases", () => {
    const cases = [...champ("WHEAT", "GROWING", 80), ...champ("MAIZE", "GROWING", 20)];
    expect(resumerChamp(cases, 288).culture).toBe("WHEAT");
  });

  it("rend le stade le plus répandu, et de cette culture-là", () => {
    /*
     * Le stade d'une autre culture n'a rien à faire dans le résumé : une
     * parcelle de blé mûr avec un coin de maïs tout juste semé se lit « blé
     * mûr », et c'est bien la couleur qu'on veut voir.
     */
    const cases: CaseResumable[] = [
      ...Array.from({ length: 30 }, () => ({ kind: "CROP", crop: "WHEAT", fieldStage: "READY" })),
      ...Array.from({ length: 10 }, () => ({ kind: "CROP", crop: "WHEAT", fieldStage: "GROWING" })),
      ...Array.from({ length: 8 }, () => ({ kind: "CROP", crop: "MAIZE", fieldStage: "PLANTED" })),
    ];
    const r = resumerChamp(cases, 144);
    expect(r.culture).toBe("WHEAT");
    expect(r.stade).toBe("READY");
  });

  it("dit quelle part de la parcelle est emblavée", () => {
    // C'est ce qui distingue à l'écran une exploitation qui tourne d'un champ à
    // moitié laissé : la part décide de la densité du semis dessiné.
    expect(resumerChamp(champ("BARLEY", "GROWING", 18), 144).partCultivee).toBeCloseTo(0.125, 6);
    expect(resumerChamp(champ("BARLEY", "GROWING", 144), 144).partCultivee).toBe(1);
  });

  it("ne rend rien d’une parcelle nue, sans se plaindre", () => {
    const r = resumerChamp(champ("WHEAT", "GROWING", 0), 144);
    expect(r.culture).toBeNull();
    expect(r.stade).toBeNull();
    expect(r.partCultivee).toBe(0);
    expect(r.cases).toBe(0);
  });

  it("ignore ce qui n’est pas un champ", () => {
    // Une case de bâtiment ou de véhicule porte parfois encore la trace d'une
    // culture d'avant : elle ne doit pas peser dans la dominante.
    const cases: CaseResumable[] = [
      { kind: "BUILDING", crop: "MAIZE", fieldStage: "GROWING" },
      { kind: "VEHICLE", crop: "MAIZE", fieldStage: "GROWING" },
      { kind: "CROP", crop: "WHEAT", fieldStage: "GROWING" },
    ];
    expect(resumerChamp(cases, 3).culture).toBe("WHEAT");
    expect(resumerChamp(cases, 3).cases).toBe(1);
  });

  it("tranche les égalités par le code, et non par l’ordre de lecture", () => {
    /*
     * Postgres ne garantit aucun ordre sans `ORDER BY`. Départagées « à la
     * première rencontrée », deux lectures des mêmes cases décriraient la même
     * parcelle de deux façons — et le champ du voisin changerait de couleur
     * d'un rafraîchissement à l'autre sans que rien n'ait poussé.
     */
    const a: CaseResumable[] = [
      { kind: "CROP", crop: "WHEAT", fieldStage: "GROWING" },
      { kind: "CROP", crop: "BARLEY", fieldStage: "GROWING" },
    ];
    expect(resumerChamp(a, 2).culture).toBe("BARLEY");
    expect(resumerChamp([...a].reverse(), 2).culture).toBe("BARLEY");
  });

  it("ne dépasse jamais la parcelle entière", () => {
    // Une surface annoncée plus petite que le nombre de cases lues ne doit pas
    // produire une part de cent quatre-vingts pour cent.
    expect(resumerChamp(champ("PEA", "GROWING", 100), 50).partCultivee).toBe(1);
  });

  it("se rabat sur le nombre de cases quand la surface n’est pas dite", () => {
    expect(resumerChamp(champ("PEA", "GROWING", 72).slice(0, 72)).partCultivee).toBe(1);
  });
});

describe("à qui est cette parcelle", () => {
  it("distingue la mienne des autres", () => {
    expect(statutParcelle({ farmId: "f1" }, { isNpc: false }, "f1")).toBe("MOI");
  });

  it("distingue un exploitant PNJ d’un autre joueur", () => {
    /*
     * Ce n'est pas une nuance d'affichage : on peut espérer racheter au
     * premier — il cédera, à son prix — jamais au second.
     */
    expect(statutParcelle({ farmId: "f2" }, { isNpc: true }, "f1")).toBe("PNJ");
    expect(statutParcelle({ farmId: "f3" }, { isNpc: false }, "f1")).toBe("JOUEUR");
  });

  it("appelle libre ce qui n’a pas de ferme", () => {
    expect(statutParcelle({ farmId: null }, null, "f1")).toBe("LIBRE");
    // Même sans ferme à soi : un joueur qui n'a pas encore de terre doit
    // pouvoir lire la carte.
    expect(statutParcelle({ farmId: null }, null, null)).toBe("LIBRE");
  });

  it("ne prend pas une parcelle occupée pour la sienne faute de ferme", () => {
    expect(statutParcelle({ farmId: "f2" }, { isNpc: false }, null)).toBe("JOUEUR");
  });
});

describe("la mitoyenneté", () => {
  it("compte les côtés, pas les coins", () => {
    /*
     * La règle du jeu, pas une commodité : le devis compte les **bordures**
     * mitoyennes, et deux parcelles qui ne se touchent que par un coin n'en
     * partagent aucune.
     */
    const moi = { mapX: 2, mapY: 3 };
    expect(mitoyennes(moi, { mapX: 3, mapY: 3 })).toBe(true);
    expect(mitoyennes(moi, { mapX: 2, mapY: 2 })).toBe(true);
    expect(mitoyennes(moi, { mapX: 3, mapY: 4 })).toBe(false);
    expect(mitoyennes(moi, { mapX: 4, mapY: 3 })).toBe(false);
    expect(mitoyennes(moi, moi)).toBe(false);
  });
});

describe("de la carte à la trame", () => {
  it("place la ferme du joueur au centre", () => {
    expect(caseDeTrame({ mapX: 3, mapY: 1 }, { mapX: 3, mapY: 1 })).toEqual({ col: 0, rang: 0 });
  });

  it("garde les deux axes dans le même sens", () => {
    // La vue pose `col` le long des `x` et `rang` le long des `z`. Si l'un des
    // deux se retournait, la campagne serait le miroir de la carte — et la
    // parcelle qu'on croit acheter à droite arriverait à gauche.
    expect(caseDeTrame({ mapX: 3, mapY: 1 }, { mapX: 4, mapY: 1 })).toEqual({ col: 1, rang: 0 });
    expect(caseDeTrame({ mapX: 3, mapY: 1 }, { mapX: 3, mapY: 2 })).toEqual({ col: 0, rang: 1 });
    expect(caseDeTrame({ mapX: 3, mapY: 1 }, { mapX: 1, mapY: 0 })).toEqual({ col: -2, rang: -1 });
  });
});
