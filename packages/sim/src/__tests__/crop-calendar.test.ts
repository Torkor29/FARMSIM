/**
 * Le calendrier cultural.
 *
 * Avant ce module, la pousse était un minuteur : la route de semis écrivait
 * `readyAt = now + growMs`, et `cropGrowMs()` ne prenait en argument ni la
 * saison, ni la météo, ni la région. Un blé semé le 2 janvier levait
 * exactement à la vitesse d'un blé d'avril. Les quatre saisons existaient —
 * peintes dans le ciel, lisibles dans les cours — sans toucher un seul épi.
 *
 * Les assertions ci-dessous tiennent les deux moitiés du modèle : la fenêtre
 * de semis, qui refuse le maïs en novembre, et l'intégration jour par jour,
 * qui fait qu'un semis tardif se fait rattraper par l'hiver.
 */

import { integrateGrowth, projectReadyAt, simulateCell } from "../index";
import {
  CROP_SEASONALITY,
  GAME_DAY_MS,
  PLANTING_WINDOW,
  SEASON_DURATION_MS,
  SEASON_GROWTH,
  canSowInSeason,
  cropGrowMs,
  currentSeason,
  growthRate,
  windowLabel,
  type CropCode,
  type Season,
} from "@farmsim/shared";

/** Instant du premier jour de la saison demandée, hémisphère nord. */
function debutDe(saison: Season, cycle = 0): number {
  const ordre: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];
  return (cycle * 4 + ordre.indexOf(saison)) * SEASON_DURATION_MS;
}

const CULTURES = Object.keys(CROP_SEASONALITY) as CropCode[];

describe("fenêtre de semis", () => {
  it("refuse le maïs en hiver et l'accepte au printemps", () => {
    expect(canSowInSeason("MAIZE", "WINTER").ok).toBe(false);
    expect(canSowInSeason("MAIZE", "SPRING").ok).toBe(true);
  });

  it("dit pourquoi elle refuse, et quand revenir", () => {
    // Un refus qui dit seulement « non » oblige à deviner la règle, et une
    // règle qu'on devine n'est pas une décision.
    const verdict = canSowInSeason("MAIZE", "WINTER");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) {
      expect(verdict.reason).toContain("printemps");
      expect(verdict.window.length).toBeGreaterThan(0);
    }
  });

  it("laisse chaque culture semable, mais jamais toute l'année", () => {
    for (const crop of CULTURES) {
      const ouvertes = PLANTING_WINDOW[crop];
      expect(ouvertes.length).toBeGreaterThanOrEqual(1);
      expect(ouvertes.length).toBeLessThanOrEqual(3);
    }
  });

  it("laisse toujours au moins une culture à semer, quelle que soit la saison", () => {
    // Sans cela, une saison entière serait du temps mort — le joueur n'aurait
    // rien à faire de sa terre pendant une heure quarante-cinq.
    for (const saison of ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as Season[]) {
      const possibles = CULTURES.filter((c) => canSowInSeason(c, saison).ok);
      expect(possibles.length).toBeGreaterThan(0);
    }
  });

  it("écrit la fenêtre en français lisible", () => {
    expect(windowLabel("MAIZE")).toBe("au printemps ou en été");
  });
});

describe("vitesse de pousse", () => {
  it("arrête presque les cultures de printemps en hiver", () => {
    expect(growthRate("MAIZE", "WINTER")).toBeLessThan(0.1);
    expect(growthRate("MAIZE", "SUMMER")).toBeGreaterThan(1);
  });

  it("laisse les céréales d'hiver pousser sous le froid — c'est leur raison d'être", () => {
    expect(growthRate("WHEAT", "WINTER")).toBeGreaterThan(growthRate("MAIZE", "WINTER") * 3);
  });

  it("garde la météo modeste devant la saison", () => {
    // La météo tient la journée, la saison tient la semaine. Si le ciel pesait
    // autant que la saison, le calendrier ne se planifierait plus.
    const ecartSaison =
      SEASON_GROWTH.SPRING_CROP.SUMMER - SEASON_GROWTH.SPRING_CROP.WINTER;
    const ecartCiel =
      growthRate("MAIZE", "SUMMER", "RAIN") - growthRate("MAIZE", "SUMMER", "STORM");
    expect(ecartCiel).toBeLessThan(ecartSaison / 2);
  });
});

describe("intégration jour par jour", () => {
  const nord = { hemisphere: "N" as const };

  it("compte le temps qui pousse, pas le temps qui passe", () => {
    /**
     * La fenêtre de mesure tient **dans** une saison. Première version de ce
     * test : dix jours, alors qu'une saison en dure sept — la mesure d'hiver
     * débordait de trois jours sur le printemps et rendait dix fois trop. Le
     * modèle était juste, la prémisse du test ne l'était pas.
     */
    const cinq = 5 * GAME_DAY_MS;
    const ete = debutDe("SUMMER");
    const hiver = debutDe("WINTER");
    const enEte = integrateGrowth({ crop: "MAIZE", plantedAt: ete, until: ete + cinq, ...nord });
    const enHiver = integrateGrowth({ crop: "MAIZE", plantedAt: hiver, until: hiver + cinq, ...nord });
    expect(enEte).toBeGreaterThan(enHiver * 10);
  });

  it("retombe sur l'ancien comportement sans hémisphère", () => {
    // Les appels qui ne connaissent pas la parcelle — tests, aperçus — doivent
    // continuer de fonctionner exactement comme avant.
    const brut = integrateGrowth({ crop: "WHEAT", plantedAt: 0, until: 5 * GAME_DAY_MS });
    expect(brut).toBe(5 * GAME_DAY_MS);
    expect(projectReadyAt({ crop: "WHEAT", plantedAt: 0, growMs: 5 * GAME_DAY_MS })).toBe(
      5 * GAME_DAY_MS,
    );
  });

  it("fait rattraper un semis tardif par l'hiver", () => {
    /**
     * Le cœur de la leçon. Le blé pousse en cinq jours et une saison en dure
     * sept : semé le premier jour de l'automne il est prêt avant l'hiver ;
     * semé au bout de cinq jours, il attend le printemps.
     */
    const growMs = cropGrowMs("WHEAT");
    const automne = debutDe("AUTUMN");
    const tot = projectReadyAt({ crop: "WHEAT", plantedAt: automne, growMs, ...nord });
    const tard = projectReadyAt({
      crop: "WHEAT",
      plantedAt: automne + 5 * GAME_DAY_MS,
      growMs,
      ...nord,
    });
    expect(currentSeason("N", tot)).toBe("AUTUMN");
    expect(tard - (automne + 5 * GAME_DAY_MS)).toBeGreaterThan(tot - automne);
  });

  it("finit toujours par mûrir, même semé au pire moment", () => {
    // Une culture qui n'arriverait jamais à maturité serait un piège, pas une
    // leçon d'agronomie.
    for (const crop of CULTURES) {
      const growMs = cropGrowMs(crop);
      for (const saison of ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as Season[]) {
        const semis = debutDe(saison);
        const pret = projectReadyAt({ crop, plantedAt: semis, growMs, ...nord });
        expect(pret).toBeGreaterThan(semis);
        expect(pret - semis).toBeLessThan(2 * 4 * SEASON_DURATION_MS);
      }
    }
  });

  it("décale le sud de deux saisons", () => {
    // L'hémisphère existait déjà pour les cours et le ciel ; la culture doit
    // le suivre, sinon deux régions vivraient deux calendriers différents.
    const growMs = cropGrowMs("MAIZE");
    const t = debutDe("SUMMER");
    const nordPret = projectReadyAt({ crop: "MAIZE", plantedAt: t, growMs, hemisphere: "N" });
    const sudPret = projectReadyAt({ crop: "MAIZE", plantedAt: t, growMs, hemisphere: "S" });
    expect(sudPret).toBeGreaterThan(nordPret);
  });
});

describe("ce que la simulation en fait", () => {
  it("avance la barre de progression au rythme réel de la pousse", () => {
    /**
     * La barre suivait le temps écoulé. Avec un hiver qui gèle la culture,
     * elle aurait continué d'avancer sur un champ qui ne bouge pas — le pire
     * des deux mondes, une mécanique invisible doublée d'un affichage qui ment.
     */
    const hiver = debutDe("WINTER");
    const trois = 3 * GAME_DAY_MS;
    const gele = simulateCell({
      crop: "MAIZE",
      plantedAt: hiver,
      now: hiver + trois,
      fertility: 0.5,
      weedsControlled: false,
      fertilizedPasses: 0,
      hemisphere: "N",
    });
    const enSeve = simulateCell({
      crop: "MAIZE",
      plantedAt: debutDe("SUMMER"),
      now: debutDe("SUMMER") + trois,
      fertility: 0.5,
      weedsControlled: false,
      fertilizedPasses: 0,
      hemisphere: "N",
    });
    expect(gele.progress).toBeLessThan(0.1);
    expect(enSeve.progress).toBeGreaterThan(gele.progress * 5);
    expect(gele.ready).toBe(false);
  });
});
