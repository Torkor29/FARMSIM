import {
  BOIS_MATURITE_MS,
  GAME_DAY_MS,
  cibleFaune,
  deriveFaune,
  lireHabitats,
  mosaique,
  refugesDecor,
  scoreBiodiversite,
  type CaseNature,
} from "@farmsim/shared";

const T = 1_000_000_000_000;
function terrain(w: number, h: number, f: (x: number, y: number) => Partial<CaseNature>): CaseNature[] {
  const out: CaseNature[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push({ x, y, sol: "PRE", vocation: "NATURE", ...f(x, y) });
  return out;
}

describe("les habitats", () => {
  it("se lisent sur les cases : prairie, bois, lisière, mare, roselière", () => {
    const cells = terrain(6, 3, (x, y) =>
      x === 0 ? { sol: "BOIS", boiseDepuis: new Date(T - BOIS_MATURITE_MS * 1.2) } : x === 5 && y === 1 ? { sol: "EAU" } : {},
    );
    const l = lireHabitats({ cells, maintenant: T });
    expect(l.parCase.get("0,1")).toEqual(["FUTAIE", "LISIERE"]);
    expect(l.parCase.get("3,1")).toEqual(["PRAIRIE"]);
    expect(l.parCase.get("5,1")).toEqual(["MARE", "ROSELIERE"]);
    expect(l.surfaces.PRAIRIE).toBe(14);
  });

  it("comptent deux fois moins en terre de culture qu'en réserve", () => {
    const reserve = lireHabitats({ cells: terrain(2, 1, () => ({ sol: "EAU" })), maintenant: T });
    const champs = lireHabitats({ cells: terrain(2, 1, () => ({ sol: "EAU", vocation: "CULTURE" })), maintenant: T });
    expect(champs.surfaces.MARE).toBe(reserve.surfaces.MARE / 2);
  });

  it("un bois de deux ans devient un vieux bois", () => {
    const l = lireHabitats({ cells: [{ x: 0, y: 0, sol: "BOIS", boiseDepuis: new Date(T - BOIS_MATURITE_MS * 2.1) }], maintenant: T });
    expect(l.parCase.get("0,0")![0]).toBe("VIEUX_BOIS");
  });
});

describe("la faune", () => {
  it("préfère une mosaïque à un seul habitat", () => {
    expect(mosaique(1)).toBeLessThan(mosaique(7));
    const monotone = cibleFaune(lireHabitats({ cells: terrain(10, 4, () => ({})), maintenant: T }));
    const varie = cibleFaune(
      lireHabitats({
        cells: terrain(10, 4, (x, y) =>
          x < 3 ? { sol: "BOIS", boiseDepuis: new Date(T - BOIS_MATURITE_MS * 2.5) } : x > 7 && y > 1 ? { sol: "EAU" } : {},
        ),
        amenagements: [{ type: "haie", originX: 5, originY: 0 }, { type: "haie", originX: 6, originY: 0 }, { type: "fleurs", originX: 4, originY: 3 }],
        maintenant: T,
      }),
    );
    expect(scoreBiodiversite(varie)).toBeGreaterThan(scoreBiodiversite(monotone));
    expect(varie.AMPHIBIENS).toBeGreaterThan(0);
    expect(monotone.AMPHIBIENS).toBe(0);
  });

  it("s'installe peu à peu, et part plus vite qu'elle ne vient", () => {
    const cible = { POLLINISATEURS: 80, AUXILIAIRES: 80, OISEAUX: 80, RAPACES: 80, AMPHIBIENS: 80 };
    const un = deriveFaune({}, cible, GAME_DAY_MS);
    expect(un.POLLINISATEURS).toBeCloseTo(40, 0);
    expect(un.RAPACES).toBeLessThan(15);
    const vide = { POLLINISATEURS: 0, AUXILIAIRES: 0, OISEAUX: 0, RAPACES: 0, AMPHIBIENS: 0 };
    expect(deriveFaune(cible, vide, GAME_DAY_MS).RAPACES).toBeCloseTo(40, 0);
  });

  it("compte les nichoirs et les fleurs de la décoration libre, avec un plafond", () => {
    const r = refugesDecor([{ code: "NICHOIR" }, { code: "NICHOIR" }, { code: "LAVANDE" }, ...Array(20).fill({ code: "NICHOIR" })]);
    expect(r.OISEAUX).toBe(5 * 6);
    expect(r.POLLINISATEURS).toBe(2);
  });
});
