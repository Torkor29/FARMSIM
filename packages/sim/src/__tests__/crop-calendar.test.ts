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
  SEASON_CYCLE,
  SEASON_DURATION_MS,
  SEASON_GROWTH,
  SEASON_REAL_MS,
  canSowInSeason,
  cropGrowMs,
  currentSeason,
  growthRate,
  windowLabel,
  type CropCode,
  type Season,
} from "@farmsim/shared";

/**
 * Instant du premier instant de la saison demandée, hémisphère nord.
 *
 * Le calendrier ne se lit plus dans une table indexée par jour de la semaine —
 * c'est ce qui enfermait un joueur du week-end dans deux saisons à vie. Les
 * saisons se succèdent maintenant en un cycle continu depuis l'origine des
 * temps, et le début d'une saison est un simple multiple : c'est ce qui rend
 * ces repères exacts au lieu d'approchés.
 */
function debutDe(saison: Season, cycle = 0): number {
  return (SEASON_CYCLE.indexOf(saison) + cycle * SEASON_CYCLE.length) * SEASON_REAL_MS;
}

/**
 * Une saison entière, en millisecondes.
 *
 * Toute mesure qui veut rester *dans* une saison doit tenir là-dedans — sans
 * quoi elle déborde sur la suivante et mesure autre chose que ce qu'elle
 * croit. Les quatre saisons durent maintenant le même temps, ce qui supprime
 * la précaution qu'il fallait prendre du temps de l'hiver court.
 */
const DANS_UNE_SAISON = SEASON_REAL_MS;

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
    const ete = debutDe("SUMMER");
    const hiver = debutDe("WINTER");
    const enEte = integrateGrowth({
      crop: "MAIZE",
      plantedAt: ete,
      until: ete + DANS_UNE_SAISON,
      ...nord,
    });
    const enHiver = integrateGrowth({
      crop: "MAIZE",
      plantedAt: hiver,
      until: hiver + DANS_UNE_SAISON,
      ...nord,
    });
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

  it("ne laisse jamais un semis plus tardif mûrir plus tôt", () => {
    /**
     * La propriété que l'intégration doit garantir, et la seule qui ne
     * souffre aucune exception : décaler le semis ne peut pas avancer la
     * moisson.
     *
     * Ce n'est pas une évidence, c'est précisément ce que le découpage aux
     * frontières de saison protège. Un pas d'un jour entier lisait la saison
     * du **début** du pas et l'appliquait à toute la tranche : une frontière
     * tombant au milieu était ignorée, la vitesse de l'hiver pouvait
     * s'appliquer à des heures de printemps, et selon l'instant du semis on
     * pouvait gagner une tranche entière. La courbe cessait d'être monotone,
     * et un joueur qui décale son semis de deux heures récoltait avant son
     * voisin.
     */
    for (const crop of CULTURES) {
      const growMs = cropGrowMs(crop);
      let precedent = -Infinity;
      for (let pas = 0; pas <= 48; pas++) {
        const semis = Math.round((pas / 48) * 4 * SEASON_REAL_MS);
        const mur = projectReadyAt({ crop, plantedAt: semis, growMs, ...nord });
        expect({ crop, pas, monotone: mur >= precedent }).toEqual({ crop, pas, monotone: true });
        precedent = mur;
      }
    }
  });

  it("fait dire la même chose à la barre et à la date de maturité", () => {
    /**
     * `integrateGrowth` avance la barre de progression, `projectReadyAt`
     * annonce la date de récolte. Ce sont deux boucles distinctes, dans deux
     * fonctions distinctes, et rien dans le typage ne les oblige à intégrer la
     * même chose.
     *
     * Si elles divergent, le joueur voit une barre pleine sur un champ que le
     * serveur refuse de moissonner — ou l'inverse. C'est le genre d'écart
     * qu'on ne découvre qu'en jouant, et qu'aucun test de l'une ou l'autre
     * prise séparément ne peut voir.
     */
    for (const crop of CULTURES) {
      const growMs = cropGrowMs(crop);
      for (let pas = 0; pas < 12; pas++) {
        const semis = Math.round((pas / 12) * 4 * SEASON_REAL_MS);
        const pret = projectReadyAt({ crop, plantedAt: semis, growMs, ...nord });
        const acquis = integrateGrowth({ crop, plantedAt: semis, until: pret, ...nord });
        // Au millième près : `projectReadyAt` arrondit sa date à la
        // milliseconde, ce qui laisse une miette d'un côté ou de l'autre.
        expect(acquis / growMs).toBeCloseTo(1, 3);
      }
    }
  });

  it("fait payer le semis tardif là où la saison lente suit", () => {
    /**
     * L'arbitrage « semer tôt ou tard », et il n'est plus uniforme — c'est ce
     * que le nouveau calendrier apporte de plus intéressant.
     *
     * Il se lisait sur le blé seul : « il pousse en cinq jours, la saison en
     * dure sept ; semé le premier jour de l'automne il est prêt avant l'hiver,
     * semé le cinquième il attend le printemps ». Un blé qui se sème et se
     * moissonne dans la même saison n'est pas un blé d'hiver : c'était le
     * défaut, pas la leçon.
     *
     * Le maïs, lui, garde la leçon entière : semé tard au printemps, il entre
     * dans l'automne sans avance et l'hiver le fige. Le blé fait l'inverse —
     * semé en fin d'automne il attend moins, mais mûrit dans l'automne
     * suivant, la saison où les cours sont au plus bas. Deux arbitrages
     * différents valent mieux qu'un seul répété six fois.
     */
    const growMs = cropGrowMs("MAIZE");
    const printemps = debutDe("SPRING");
    const tardif = printemps + 0.9 * SEASON_REAL_MS;
    const tot = projectReadyAt({ crop: "MAIZE", plantedAt: printemps, growMs, ...nord }) - printemps;
    const tard = projectReadyAt({ crop: "MAIZE", plantedAt: tardif, growMs, ...nord }) - tardif;
    expect(tard).toBeGreaterThan(tot);
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

  it("décale le sud de deux saisons, exactement", () => {
    /*
     * L'hémisphère existait déjà pour les cours et le ciel ; la culture doit
     * le suivre, sinon deux régions vivraient deux calendriers différents.
     *
     * L'ancienne version se contentait de « le sud met plus longtemps », ce
     * qui n'était vrai que pour l'instant de semis choisi : selon la date, le
     * sud peut très bien mûrir plus vite — c'est l'hiver de l'un contre l'été
     * de l'autre. Ce qui est vrai à tout instant, c'est l'égalité du décalage.
     */
    const DEUX_SAISONS = 2 * SEASON_REAL_MS;
    for (const crop of CULTURES) {
      const growMs = cropGrowMs(crop);
      for (let i = 0; i < 8; i++) {
        const t = Math.round(i * 0.7 * SEASON_REAL_MS);
        const sud = projectReadyAt({ crop, plantedAt: t, growMs, hemisphere: "S" });
        const nord = projectReadyAt({ crop, plantedAt: t + DEUX_SAISONS, growMs, hemisphere: "N" });
        expect(sud - t).toBe(nord - (t + DEUX_SAISONS));
      }
    }
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
      fertilizedPasses: 0,
      hemisphere: "N",
    });
    const enSeve = simulateCell({
      crop: "MAIZE",
      plantedAt: debutDe("SUMMER"),
      now: debutDe("SUMMER") + trois,
      fertility: 0.5,
      fertilizedPasses: 0,
      hemisphere: "N",
    });
    expect(gele.progress).toBeLessThan(0.1);
    expect(enSeve.progress).toBeGreaterThan(gele.progress * 5);
    expect(gele.ready).toBe(false);
  });
});
