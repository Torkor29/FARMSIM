import {
  currentObjective,
  evaluateObjectives,
  GUIDE_CHAPTERS,
  objectivesFor,
  type GuideSnapshot,
} from "@farmsim/shared";

const empty = (spec: GuideSnapshot["spec"]): GuideSnapshot => ({
  spec,
  plantedCells: 0,
  readyCells: 0,
  stubbleCells: 0,
  peaCells: 0,
  buildings: [],
  machines: [],
  stockTons: 0,
  hayTons: 0,
  milkOrMeat: 0,
  animals: 0,
  hasSold: false,
  hasHarvested: false,
  hasContract: false,
});

describe("guide et objectifs", () => {
  it("commence par semer, quel que soit le métier", () => {
    const cur = currentObjective(empty("CEREALIER"));
    expect(cur?.id).toBe("sow");
    expect(currentObjective(empty("ELEVEUR"))?.id).toBe("sow");
  });

  it("enchaîne semer → récolter → vendre", () => {
    const s = empty("CEREALIER");
    s.plantedCells = 4;
    expect(currentObjective(s)?.id).toBe("harvest");
    s.hasHarvested = true;
    expect(currentObjective(s)?.id).toBe("sell");
    s.hasSold = true;
    expect(currentObjective(s)?.id).toBe("silo");
  });

  /**
   * Le guide ne cache plus la moitié du jeu.
   *
   * Il filtrait ses consignes par métier : un céréalier ne voyait jamais
   * l'objectif « bâtir une étable », alors que **rien** ne l'empêchait d'en
   * bâtir une — le choix d'inscription ne verrouillait aucune mécanique, il
   * ne masquait que les consignes. C'était le pire des deux mondes :
   * l'impression d'une classe, sans la substance d'une classe.
   *
   * Les deux voies s'affichent donc pour tout le monde, et c'est en jouant que
   * le joueur décide de la sienne.
   */
  it("propose les deux voies à tout le monde", () => {
    for (const spec of ["CEREALIER", "ELEVEUR"] as const) {
      const ids = objectivesFor(spec).map((o) => o.id);
      expect(`${spec} pois=${ids.includes("pea")}`).toBe(`${spec} pois=true`);
      expect(`${spec} étable=${ids.includes("barn")}`).toBe(`${spec} étable=true`);
      expect(`${spec} atelier=${ids.includes("workshop")}`).toBe(`${spec} atelier=true`);
      expect(`${spec} contrat=${ids.includes("contract")}`).toBe(`${spec} contrat=true`);
    }
  });

  it("donne exactement la même liste aux deux métiers", () => {
    // La preuve que le filtre a bien disparu, et pas seulement qu'il laisse
    // passer les quatre objectifs qu'on a nommés au-dessus.
    expect(objectivesFor("CEREALIER").map((o) => o.id)).toEqual(
      objectivesFor("ELEVEUR").map((o) => o.id),
    );
  });

  it("compte le poulailler et la bergerie comme bâtiment d'élevage", () => {
    const barn = objectivesFor("ELEVEUR").find((o) => o.id === "barn")!;
    expect(barn.check({ ...empty("ELEVEUR"), buildings: ["HENHOUSE"] })).toBe(true);
    expect(barn.check({ ...empty("ELEVEUR"), buildings: ["SHEEPFOLD"] })).toBe(true);
    expect(barn.check({ ...empty("ELEVEUR"), buildings: ["SILO"] })).toBe(false);
  });

  it("verrouille les objectifs suivants tant que le courant n'est pas fait", () => {
    const views = evaluateObjectives(empty("CEREALIER"));
    expect(views.filter((o) => o.current)).toHaveLength(1);
    expect(views[0]?.current).toBe(true);
    expect(views.slice(1).every((o) => !o.current && !o.done)).toBe(true);
  });

  it("couvre cultures, sol, marchandises, bâtiments, machines, troupeau et métiers", () => {
    const ids = GUIDE_CHAPTERS.map((c) => c.id);
    expect(ids).toEqual(["crops", "soil", "goods", "build", "machines", "herd", "triangle"]);
    const soon = GUIDE_CHAPTERS.flatMap((c) => c.entries).filter((e) => e.soon);
    // Paille et ensilage ne sont plus « bientôt » : la fusion les a livrés.
    expect(soon.map((e) => e.id).sort()).toEqual(["SLURRY"]);
    const goods = GUIDE_CHAPTERS.find((c) => c.id === "goods");
    expect(goods?.entries.some((e) => e.id === "MANURE" && !e.soon)).toBe(true);
    expect(goods?.entries.some((e) => e.id === "STRAW" && !e.soon)).toBe(true);
    expect(goods?.entries.some((e) => e.id === "SILAGE" && !e.soon)).toBe(true);
  });

  it("explique qui utilise la production des autres", () => {
    const triangle = GUIDE_CHAPTERS.find((c) => c.id === "triangle");
    expect(triangle?.entries.some((e) => /paille|ensilage|lisier|travail/i.test(e.how))).toBe(
      true,
    );
  });
});
