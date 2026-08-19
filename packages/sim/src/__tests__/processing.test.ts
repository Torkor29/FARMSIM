/**
 * Les ateliers de transformation.
 *
 * Tout se vendait brut. Le lait partait en lait, le blé en blé, et la seule
 * stratégie de prix consistait à attendre le bon cours — un arbitrage à un
 * seul levier, qui se résume à de la patience.
 *
 * La laiterie et le moulin en ajoutent un second. Ce qui les empêche d'être
 * une pompe à argent tient en trois freins, et ce sont eux que les assertions
 * ci-dessous tiennent : le **débit** immobilise la matière, le **cours** du
 * produit fini peut s'inverser, et le **bâtiment** coûte une case et son prix.
 */

import {
  BUILDING_DEFS,
  BUILDING_LEVELS,
  GAME_DAY_MS,
  SEASON_DAYS,
  GOOD_DEFS,
  MARKET_BOUNDS,
  PROCESSING_BUILDINGS,
  RECIPES,
  SPOILAGE_PER_CYCLE,
  buildingUpgradeCost,
  processRun,
  processingMargin,
  processingThroughput,
  type BuildingType,
  type ProcessingKind,
} from "@farmsim/shared";

const KINDS = Object.keys(RECIPES) as ProcessingKind[];

/** Le bâtiment qui porte une recette. */
const batiment = (kind: ProcessingKind): BuildingType =>
  PROCESSING_BUILDINGS.find((t) => BUILDING_DEFS[t].processing === kind)!;

describe("la recette", () => {
  it("chaque atelier a son bâtiment, et réciproquement", () => {
    // La liste des bâtiments qui transforment est dérivée de leurs
    // définitions : une recette sans bâtiment ne serait jamais appelée, et un
    // bâtiment sans recette planterait au tick.
    const parBatiment = PROCESSING_BUILDINGS.map(
      (t) => BUILDING_DEFS[t].processing,
    ).sort();
    expect(parBatiment).toEqual([...KINDS].sort());
  });

  it("le produit fini vaut plus cher que sa matière, aux cours de départ", () => {
    for (const kind of KINDS) {
      const def = RECIPES[kind];
      const marge = processingMargin({
        kind,
        inputPrice: MARKET_BOUNDS[def.input].initial,
        outputPrice: MARKET_BOUNDS[def.output].initial,
      });
      // Une marge nulle rendrait l'atelier décoratif ; une marge triple en
      // ferait le seul geste rentable du jeu.
      expect(`${kind} marge=${marge}`).toBe(`${kind} marge=${marge}`);
      expect(marge).toBeGreaterThan(0.2);
      expect(marge).toBeLessThan(0.9);
    }
  });

  it("les deux produits se vendent, et ne s'achètent pas", () => {
    for (const kind of KINDS) {
      const out = GOOD_DEFS[RECIPES[kind].output];
      expect(out.sellable).toBe(true);
      // Acheter du fromage pour le revendre court-circuiterait tout l'atelier.
      expect(out.purchasable).toBe(false);
    }
  });

  it("transformer conserve : le produit fini ne s'abîme pas plus que sa matière", () => {
    /**
     * C'est la raison d'être du fromage, avant même la marge : le lait perd
     * 12 % par jour, et un joueur sans acheteur le regarde fondre. Un produit
     * fini qui pourrirait aussi vite n'apporterait rien qu'un cours différent.
     *
     * L'écueil ici est d'avoir deux vérités : le drapeau `perishable` de
     * `GOOD_DEFS`, qui sert à l'affichage, et `SPOILAGE_PER_CYCLE`, qui décide
     * vraiment. On vérifie donc les deux d'un coup.
     */
    for (const kind of KINDS) {
      const def = RECIPES[kind];
      const entree = SPOILAGE_PER_CYCLE[def.input] ?? 0;
      const sortie = SPOILAGE_PER_CYCLE[def.output] ?? 0;
      expect(`${kind} ${sortie} <= ${entree}`).toBe(`${kind} ${sortie} <= ${entree}`);
      expect(sortie).toBeLessThanOrEqual(entree);
      expect(GOOD_DEFS[def.output].perishable).toBe(sortie > 0);
      expect(GOOD_DEFS[def.input].perishable).toBe(entree > 0);
    }
  });
});

describe("le débit", () => {
  it("un atelier ne traite pas un silo d'un coup", () => {
    for (const kind of KINDS) {
      const perDay = processingThroughput(batiment(kind), 1);
      const run = processRun({ kind, perDay, elapsedMs: GAME_DAY_MS, stockIn: 10_000 });
      // Le stock est immense : c'est donc le débit qui borne, et lui seul.
      expect(run.consumed).toBeLessThanOrEqual(perDay + 0.01);
      expect(run.consumed).toBeGreaterThan(0);
    }
  });

  it("il ne transforme jamais plus qu'il n'a", () => {
    for (const kind of KINDS) {
      const run = processRun({
        kind,
        perDay: processingThroughput(batiment(kind), 5),
        elapsedMs: GAME_DAY_MS * 30,
        stockIn: 3,
      });
      expect(run.consumed).toBeLessThanOrEqual(3.0001);
    }
  });

  it("un atelier grandit du même pas que le reste de la ferme", () => {
    /**
     * Le piège serait de donner aux ateliers leur propre échelle de paliers :
     * la grille de coûts, elle, n'en a qu'une, et les deux auraient fini par
     * diverger — un niveau 5 payé au prix fort pour un débit décidé ailleurs.
     */
    for (const kind of KINDS) {
      for (const palier of BUILDING_LEVELS) {
        expect(processingThroughput(batiment(kind), palier.level)).toBeCloseTo(
          RECIPES[kind].inputPerDay * palier.capacityMult,
          2,
        );
      }
    }
  });

  it("rien ne se produit sans temps écoulé", () => {
    for (const kind of KINDS) {
      const perDay = processingThroughput(batiment(kind), 3);
      expect(processRun({ kind, perDay, elapsedMs: 0, stockIn: 500 })).toEqual({
        consumed: 0,
        produced: 0,
      });
    }
  });

  it("on ne rend jamais de fraction de fromage", () => {
    // Le tick monde passe toutes les vingt secondes : sans arrondi au
    // centième, chaque passage ajouterait un microgramme de produit fini et le
    // stock se remplirait de poussière.
    for (const kind of KINDS) {
      const perDay = processingThroughput(batiment(kind), 1);
      const run = processRun({ kind, perDay, elapsedMs: 700, stockIn: 500 });
      expect(run.produced).toBe(Math.round(run.produced * 100) / 100);
      if (run.produced === 0) expect(run.consumed).toBe(0);
    }
  });

  it("ce qui sort correspond à ce qui entre", () => {
    for (const kind of KINDS) {
      const def = RECIPES[kind];
      const run = processRun({
        kind,
        perDay: processingThroughput(batiment(kind), 4),
        elapsedMs: GAME_DAY_MS * 3,
        stockIn: 400,
      });
      expect(run.consumed / run.produced).toBeCloseTo(def.ratio, 2);
    }
  });
});

describe("le cours", () => {
  it("une flambée de la matière rend la vente brute plus rentable", () => {
    /**
     * C'est le seul frein qui demande un arbitrage plutôt que de la patience.
     * Si la marge restait positive à tout prix, l'atelier serait une pompe et
     * il n'y aurait plus jamais de raison de vendre du lait.
     */
    for (const kind of KINDS) {
      const def = RECIPES[kind];
      const marge = processingMargin({
        kind,
        inputPrice: MARKET_BOUNDS[def.input].max,
        outputPrice: MARKET_BOUNDS[def.output].min,
      });
      expect(`${kind} au pire ${marge < 0}`).toBe(`${kind} au pire true`);
    }
  });

  it("le marché du produit fini est plus étroit que celui de la matière", () => {
    for (const kind of KINDS) {
      const def = RECIPES[kind];
      // Écouler du fromage fait baisser le fromage bien plus vite qu'écouler
      // du lait ne fait baisser le lait : un atelier ne se déverse pas sur un
      // marché de niche sans en payer le prix.
      expect(MARKET_BOUNDS[def.output].depth).toBeLessThan(MARKET_BOUNDS[def.input].depth);
    }
  });
});

describe("le bâtiment", () => {
  /** Gain brut d'une journée pleine à un palier donné, aux cours de départ. */
  const gainParJour = (kind: ProcessingKind, level: number) => {
    const def = RECIPES[kind];
    const perDay = processingThroughput(batiment(kind), level);
    return (
      (perDay / def.ratio) * MARKET_BOUNDS[def.output].initial -
      perDay * MARKET_BOUNDS[def.input].initial
    );
  };

  it("l'atelier se rembourse en une année de jeu, pas en deux jours", () => {
    for (const kind of KINDS) {
      const jours = BUILDING_DEFS[batiment(kind)].cost / gainParJour(kind, 1);
      // Une année fait vingt-huit jours de jeu. En dessous d'une saison,
      // l'atelier serait offert et il n'y aurait aucune décision à prendre ;
      // au-delà de deux ans, personne ne le construirait.
      expect(`${kind} amorti en ${Math.round(jours)} j`).toBe(
        `${kind} amorti en ${Math.round(jours)} j`,
      );
      expect(jours).toBeGreaterThan(SEASON_DAYS * 2);
      expect(jours).toBeLessThan(SEASON_DAYS * 8);
    }
  });

  it("agrandir se paie plus lentement que construire", () => {
    // Sinon le bon coup serait de monter au dernier palier sans réfléchir, et
    // le choix du palier ne serait plus un choix.
    for (const kind of KINDS) {
      const bat = batiment(kind);
      const premier = BUILDING_DEFS[bat].cost / gainParJour(kind, 1);
      const cumul =
        BUILDING_DEFS[bat].cost +
        [1, 2, 3, 4].reduce((n, l) => n + (buildingUpgradeCost(bat, l) ?? 0), 0);
      expect(cumul / gainParJour(kind, 5)).toBeGreaterThan(premier);
    }
  });
});
