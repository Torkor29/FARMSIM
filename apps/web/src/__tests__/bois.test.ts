import {
  BOIS_MATURITE_MS,
  PRIX_COUPE,
  accesEngins,
  bonusAmenagementCase,
  charmeDe,
  construireGrille,
  croissanceBois,
  defConstruction,
  stadeBois,
  validerPeinture,
  type CaseSource,
} from "@farmsim/shared";

/**
 * Le bois : il pousse seul, se coupe à la lisière, coupe le vent — et
 * arrête les engins.
 */
const T = 1_000_000_000_000;
const vieux = new Date(T - BOIS_MATURITE_MS - 1000);
const jeune = new Date(T - BOIS_MATURITE_MS * 0.5);
const neuf = new Date(T - 1000);
function ferme(w: number, h: number, f: (x: number, y: number) => Partial<CaseSource> = () => ({})): CaseSource[] {
  const out: CaseSource[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push({ x, y, sol: "PRE", niveau: 0, ...f(x, y) });
  return out;
}
const bornes = { minX: -1, minY: -1, maxX: 12, maxY: 12 };

describe("la pousse du bois", () => {
  it("passe des plants au jeune bois puis à la futaie en une année de jeu", () => {
    expect(stadeBois(croissanceBois(neuf, T))).toBe("PLANTS");
    expect(stadeBois(croissanceBois(jeune, T))).toBe("JEUNE");
    expect(stadeBois(croissanceBois(vieux, T))).toBe("FUTAIE");
    expect(croissanceBois(vieux, T)).toBe(1);
  });
});

describe("boiser et couper", () => {
  // Un bois de trois sur trois au milieu d'un pré, tout en futaie.
  const cells = ferme(8, 8, (x, y) => (x >= 2 && x <= 4 && y >= 2 && y <= 4 ? { sol: "BOIS", boiseDepuis: vieux } : {}));
  const grille = construireGrille({ bornes, cells, maintenant: T });

  it("se plante dans la campagne, sur l'herbe — pas sur la ferme", () => {
    const campagne = construireGrille({ bornes, cells, maintenant: T, zone: "CAMPAGNE" });
    const v = validerPeinture(campagne, defConstruction("boiser")!, [{ x: 0, y: 0 }, { x: 3, y: 3 }]);
    expect(v.cases.map((c) => c.ok)).toEqual([true, false]);
    expect(v.cout).toBe(25);
    expect(validerPeinture(grille, defConstruction("boiser")!, [{ x: 0, y: 0 }]).raison).toBe("CAMPAGNE");
  });

  it("se coupe à la lisière ; le cœur d'un bois attend un chemin", () => {
    const v = validerPeinture(grille, defConstruction("couper")!, [{ x: 2, y: 2 }, { x: 3, y: 3 }, { x: 0, y: 0 }]);
    expect(v.cases.map((c) => c.raison ?? "ok")).toEqual(["ok", "ISOLE", "PAS_BOIS"]);
    expect(v.cout).toBe(0);
    expect(PRIX_COUPE).toBeGreaterThan(0);
    // Un chemin jusqu'au cœur : il devient pré, et la coupe y arrive.
    const layon = cells.map((c) => (c.x === 3 && c.y === 2 ? { ...c, sol: "PRE" as const, revetement: "TERRE", boiseDepuis: null } : c));
    const g2 = construireGrille({ bornes, cells: layon, maintenant: T });
    expect(validerPeinture(g2, defConstruction("couper")!, [{ x: 3, y: 3 }]).ok).toBe(true);
  });

  it("ne coupe pas un jeune bois", () => {
    const g = construireGrille({ bornes, cells: cells.map((c) => (c.sol === "BOIS" ? { ...c, boiseDepuis: jeune } : c)), maintenant: T });
    expect(validerPeinture(g, defConstruction("couper")!, [{ x: 2, y: 2 }]).raison).toBe("JEUNE");
  });

  it("arrête les engins : un champ enclos dans un bois est coupé de la cour", () => {
    const enclos = ferme(9, 9, (x, y) => {
      const bord = (x === 2 || x === 6 || y === 2 || y === 6) && x >= 2 && x <= 6 && y >= 2 && y <= 6;
      return bord ? { sol: "BOIS", boiseDepuis: vieux } : x === 4 && y === 4 ? { sol: "CHAMP" } : {};
    });
    expect(accesEngins(enclos, []).has("4,4")).toBe(false);
    expect(accesEngins(enclos, []).has("0,0")).toBe(true);
  });
});

describe("ce que rapporte un bois", () => {
  it("coupe le vent mieux qu'une haie, sans s'y ajouter", () => {
    expect(bonusAmenagementCase({ objets: [], eaux: [], bois: [{ x: 0, y: 0 }] }, 2, 0)).toBeCloseTo(0.03, 5);
    const haie = { type: "haie", originX: 1, originY: 0 };
    expect(bonusAmenagementCase({ objets: [haie], eaux: [], bois: [{ x: 0, y: 0 }] }, 2, 0)).toBeCloseTo(0.03, 5);
    expect(bonusAmenagementCase({ objets: [], eaux: [], bois: [{ x: 0, y: 0 }] }, 3, 0)).toBe(0);
  });

  it("ajoute au charme à mesure qu'il se lève", () => {
    const deux = [
      { x: 0, y: 0, sol: "BOIS" as const, boiseDepuis: vieux },
      { x: 1, y: 0, sol: "BOIS" as const, boiseDepuis: vieux },
    ];
    expect(charmeDe({ cells: deux, amenagements: [], maintenant: T })).toBe(1);
    expect(charmeDe({ cells: deux.map((c) => ({ ...c, boiseDepuis: neuf })), amenagements: [], maintenant: T })).toBe(0);
  });
});
