import {
  PART_PRIX_NATURE,
  construireGrille,
  defConstruction,
  prixLotNature,
  validerPeinture,
  validerPose,
  vocationDuLot,
  type CaseSource,
} from "@farmsim/shared";

/** La réserve : quatre fois moins chère, on y façonne, on n'y cultive ni ne bâtit. */
const cells: CaseSource[] = [];
for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) cells.push({ x, y, sol: "PRE", vocation: x >= 6 ? "NATURE" : "CULTURE" });
const grille = construireGrille({ bornes: { minX: -1, minY: -1, maxX: 13, maxY: 7 }, cells });

describe("la réserve naturelle", () => {
  it("coûte le quart d'un lot agricole, arrondi aux 50 €", () => {
    expect(PART_PRIX_NATURE).toBe(0.25);
    expect(prixLotNature(9200)).toBe(2300);
    expect(prixLotNature(10_030)).toBe(2550);
  });

  it("ne se cultive pas, mais se creuse, se boise, se fleurit", () => {
    expect(validerPeinture(grille, defConstruction("champ")!, [{ x: 7, y: 2 }]).raison).toBe("RESERVE");
    expect(validerPeinture(grille, defConstruction("champ")!, [{ x: 2, y: 2 }]).ok).toBe(true);
    for (const outil of ["etang", "boiser", "surelever"]) {
      expect(validerPeinture(grille, defConstruction(outil)!, [{ x: 7, y: 2 }]).ok).toBe(true);
    }
  });

  it("n'accueille qu'un rucher", () => {
    expect(validerPose(grille, defConstruction("batiment:SILO")!, { x: 7, y: 1 }).raison).toBe("RESERVE");
    expect(validerPose(grille, defConstruction("batiment:BEEHIVE")!, { x: 7, y: 1 }).ok).toBe(true);
    expect(validerPose(grille, defConstruction("batiment:SILO")!, { x: 1, y: 1 }).ok).toBe(true);
  });

  it("donne à un lot la vocation de ses cases", () => {
    const de = (x: number) => (x >= 6 ? "NATURE" : "CULTURE");
    expect(vocationDuLot({ x: 6, y: 0, w: 6, h: 6 }, (x) => de(x))).toBe("NATURE");
    expect(vocationDuLot({ x: 0, y: 0, w: 6, h: 6 }, (x) => de(x))).toBe("CULTURE");
  });
});
