import { ESPECES, espece, especeObservable, indiceEspece, lireCarnet, observerEspeces } from "@farmsim/shared";

const pleine = { POLLINISATEURS: 100, AUXILIAIRES: 100, OISEAUX: 100, RAPACES: 100, AMPHIBIENS: 100 };
const vide = { POLLINISATEURS: 0, AUXILIAIRES: 0, OISEAUX: 0, RAPACES: 0, AMPHIBIENS: 0 };
const surfaces = { PRAIRIE: 40, FLEURS: 5, HAIE: 10, BOSQUET: 4, ARBRE: 4, FUTAIE: 12, ROCAILLE: 10, MARE: 8, RIVIERE: 4, ROSELIERE: 6 };

describe("le carnet de nature", () => {
  it("a une trentaine d'espèces, aux codes uniques", () => {
    expect(ESPECES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(ESPECES.map((e) => e.code)).size).toBe(ESPECES.length);
  });

  it("ne montre une espèce qu'au-dessus de son seuil, avec son habitat, en sa saison", () => {
    const machaon = espece("MACHAON")!;
    expect(especeObservable(machaon, pleine, surfaces, "SUMMER")).toBe(true);
    expect(especeObservable(machaon, pleine, surfaces, "WINTER")).toBe(false);
    expect(especeObservable(machaon, pleine, { PRAIRIE: 3 }, "SUMMER")).toBe(false);
    expect(especeObservable(machaon, { POLLINISATEURS: 20 }, surfaces, "SUMMER")).toBe(false);
    expect(indiceEspece(machaon)).toMatch(/prairie/);
  });

  it("tire les observations d'une façon déterministe, et rien sans faune", () => {
    const tirage = (g: string) =>
      observerEspeces({ graine: g, deja: new Set(), faune: pleine, surfaces, saison: "SUMMER", jourDebut: 10, jourFin: 16 });
    expect(tirage("ferme-a")).toEqual(tirage("ferme-a"));
    expect(tirage("ferme-a").length).toBeGreaterThan(5);
    expect(observerEspeces({ graine: "x", deja: new Set(), faune: vide, surfaces, saison: "SUMMER", jourDebut: 1, jourFin: 30 })).toEqual([]);
    // Une espèce déjà vue ne revient pas.
    const deja = new Set(tirage("ferme-a"));
    expect(
      observerEspeces({ graine: "ferme-a", deja, faune: pleine, surfaces, saison: "SUMMER", jourDebut: 10, jourFin: 16 }).some((c) => deja.has(c)),
    ).toBe(false);
  });

  it("relit un carnet sans planter, et oublie les codes inconnus", () => {
    expect(lireCarnet('{"MESANGE":"2026-01-01T00:00:00Z","DODO":"x"}')).toEqual({ MESANGE: "2026-01-01T00:00:00Z" });
    expect(lireCarnet("pas du json")).toEqual({});
  });
});
