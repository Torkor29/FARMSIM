/**
 * Les adventices.
 *
 * Le désherbage n'existait pas comme geste. `weedsControlled` valait dix pour
 * cent de rendement et ne passait à vrai qu'en même temps que la
 * fertilisation, en silence : deux opérations réelles distinctes — épandeur et
 * pulvérisateur — confondues, et un bonus que personne ne pouvait ni voir ni
 * viser.
 *
 * Pire, `soil.ts` affirmait déjà en toutes lettres que le déchaumeur « détruit
 * les adventices » et que le labour « enfouit la pression d'adventices ».
 * Aucune de ces deux phrases n'était vraie. Les assertions ci-dessous les
 * tiennent.
 */

import {
  GAME_DAY_MS,
  HERBICIDE_COST_PER_CELL,
  WEED_AFTER_PLOW,
  WEED_AFTER_SPRAY,
  WEED_AFTER_STUBBLE,
  WEED_YIELD_MALUS,
  clampWeeds,
  weedLabel,
  weedPressureAfter,
  weedYieldFactor,
  weedsAfterSoilWork,
  weedsAtSowing,
} from "@farmsim/shared";
import { simulateCell } from "../index";

describe("la pression monte toute seule", () => {
  it("croît avec le temps passé en terre", () => {
    const apres5 = weedPressureAfter({ start: 0, elapsedMs: 5 * GAME_DAY_MS });
    const apres10 = weedPressureAfter({ start: 0, elapsedMs: 10 * GAME_DAY_MS });
    expect(apres5).toBeGreaterThan(0);
    expect(apres10).toBeGreaterThan(apres5);
  });

  it("lève avec la chaleur, pas sous la neige", () => {
    const printemps = weedPressureAfter({ start: 0, elapsedMs: 5 * GAME_DAY_MS, season: "SPRING" });
    const hiver = weedPressureAfter({ start: 0, elapsedMs: 5 * GAME_DAY_MS, season: "WINTER" });
    expect(printemps).toBeGreaterThan(hiver * 5);
  });

  it("ne dépasse jamais l'envahissement complet", () => {
    expect(weedPressureAfter({ start: 0.9, elapsedMs: 400 * GAME_DAY_MS })).toBe(1);
    expect(clampWeeds(-3)).toBe(0);
  });

  it("laisse une campagne normale se conduire sans être submergée", () => {
    // Une culture qui pousse en cinq à sept jours ne doit pas finir envahie
    // par la seule inattention : sinon le désherbage cesse d'être un choix.
    const finDeCycle = weedPressureAfter({ start: 0, elapsedMs: 6 * GAME_DAY_MS, season: "SUMMER" });
    expect(finDeCycle).toBeLessThan(0.7);
  });
});

describe("les trois gestes qui la font redescendre", () => {
  it("le labour enfouit tout — la phrase de soil.ts devient vraie", () => {
    expect(weedsAfterSoilWork("PLOW", 1)).toBe(WEED_AFTER_PLOW);
    expect(WEED_AFTER_PLOW).toBe(0);
  });

  it("le déchaumage fait un faux-semis et en retire une bonne part", () => {
    expect(weedsAfterSoilWork("STUBBLE", 1)).toBe(WEED_AFTER_STUBBLE);
    // Mais il n'améliore pas une case déjà plus propre que son plafond.
    expect(weedsAfterSoilWork("STUBBLE", 0.1)).toBe(0.1);
  });

  it("le semis direct reporte la pression sur la campagne suivante", () => {
    /**
     * Le vrai coût agronomique de la technique, et il manquait. Le semis
     * direct ne perdait jusqu'ici que du rendement de levée ; il perd
     * désormais ce qu'il perd vraiment au champ.
     */
    const report = weedsAfterSoilWork("DIRECT_SEED", 0.8);
    expect(report).toBeGreaterThan(WEED_AFTER_STUBBLE);
    expect(report).toBeLessThan(0.8);
  });

  it("le pulvérisateur nettoie la culture en place", () => {
    expect(WEED_AFTER_SPRAY).toBeLessThan(WEED_AFTER_STUBBLE);
    expect(WEED_AFTER_SPRAY).toBeGreaterThan(WEED_AFTER_PLOW);
  });
});

describe("ce que ça coûte et ce que ça rapporte", () => {
  it("punit la monoculture — les adventices se spécialisent", () => {
    const rupture = weedsAtSowing({ carried: 0.2, sameCropAgain: false });
    const retour = weedsAtSowing({ carried: 0.2, sameCropAgain: true });
    expect(retour).toBeGreaterThan(rupture);
  });

  it("plafonne la perte à ce que dit l'agronomie", () => {
    expect(weedYieldFactor(0)).toBe(1);
    expect(weedYieldFactor(1)).toBeCloseTo(1 - WEED_YIELD_MALUS, 3);
    expect(WEED_YIELD_MALUS).toBeCloseTo(0.2, 2);
  });

  it("descend sans marche d'escalier", () => {
    // Un palier se contourne en se calant juste en dessous ; une pente non.
    let precedent = 1;
    for (let p = 0.05; p <= 1; p += 0.05) {
      const ici = weedYieldFactor(p);
      expect(ici).toBeLessThan(precedent);
      precedent = ici;
    }
  });

  it("rend le désherbage moins cher que la perte qu'il évite", () => {
    /**
     * Sinon le geste n'existerait que pour la forme. On compare sur une case :
     * l'herbicide contre les vingt pour cent de récolte qu'une case envahie
     * laisse au champ.
     */
    const perteParCase = 0.35 * 220 * WEED_YIELD_MALUS; // ~une case de blé
    expect(HERBICIDE_COST_PER_CELL).toBeLessThan(perteParCase);
  });

  it("laisse le labour rester une alternative crédible", () => {
    // Labourer nettoie mieux et ne coûte pas d'herbicide : le pulvérisateur ne
    // doit pas être l'évidence, seulement l'option qui sauve une culture en
    // place.
    expect(WEED_AFTER_PLOW).toBeLessThan(WEED_AFTER_SPRAY);
  });
});

describe("ce que la simulation en fait", () => {
  it("fait rendre moins un champ envahi", () => {
    const base = {
      crop: "WHEAT" as const,
      plantedAt: 0,
      now: 6 * GAME_DAY_MS,
      fertility: 0.7,
      fertilizedPasses: 0 as const,
    };
    const propre = simulateCell({ ...base, weedPressure: 0 });
    const envahi = simulateCell({ ...base, weedPressure: 1 });
    expect(envahi.estimatedYieldTons).toBeLessThan(propre.estimatedYieldTons);
    expect(envahi.estimatedYieldTons / propre.estimatedYieldTons).toBeCloseTo(
      1 - WEED_YIELD_MALUS,
      2,
    );
  });

  it("écrit l'état en français, pour l'inspection de case", () => {
    expect(weedLabel(0)).toBe("propre");
    expect(weedLabel(1)).toBe("envahie");
  });
});
