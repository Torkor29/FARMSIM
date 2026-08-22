/**
 * L'horloge du jeu.
 *
 * Ce fichier existe pour une raison précise : deux constantes de durée vivaient
 * dans deux modules différents et valaient la même chose sans que personne
 * l'ait voulu. `LIVESTOCK_CYCLE_MS` et `SEASON_DURATION_MS` faisaient quinze
 * minutes chacune — **une saison durait donc un jour de jeu**, et l'année
 * entière une heure. Rien ne l'interdisait, rien ne le signalait.
 *
 * L'horloge a depuis changé de nature : l'année ne tourne plus sur un compteur
 * parti de l'époque Unix, elle tombe sur la **semaine réelle**. Lundi et mardi
 * font le printemps, mercredi et jeudi l'été, vendredi et samedi l'automne, et
 * l'hiver tient dans le dimanche. Ce que ces tests tiennent, c'est que le
 * découpage reste celui-là et que les durées continuent de s'emboîter.
 */

import {
  CROP_DEFS,
  cropGrowMs,
  GAME_DAY_MS,
  GAME_DAYS_PER_REAL_DAY,
  LIVESTOCK_CYCLE_MS,
  REAL_DAY_MS,
  SEASON_DAYS,
  SEASON_DURATION_MS,
  SEASON_REAL_DAYS,
  YEAR_DAYS,
  YEAR_MS,
  YEAR_REAL_DAYS,
  currentSeason,
  dayOfSeason,
  gameDayIndex,
  seasonLengthDays,
  seasonProgress,
  weatherForDay,
} from "@farmsim/shared";

/** Un lundi à minuit UTC, point de départ commode pour parcourir la semaine. */
const LUNDI = Date.UTC(2026, 7, 24);

describe("les durées s’emboîtent", () => {
  it("une année vaut une semaine réelle", () => {
    // C'est tout l'intérêt du modèle : le joueur sait la saison sans ouvrir le
    // jeu, parce qu'il sait quel jour on est.
    expect(YEAR_REAL_DAYS).toBe(7);
    expect(YEAR_MS).toBe(7 * REAL_DAY_MS);
  });

  it("une année tient toujours vingt-huit jours de jeu", () => {
    /*
     * Le nombre n'a pas bougé en passant à la semaine réelle, et c'est
     * volontaire : toutes les durées écrites en jours de jeu — pousse,
     * gestation, péremption, intérêts — gardent leur sens sans être retouchées.
     * Seule l'échelle réelle a changé.
     */
    expect(YEAR_DAYS).toBe(28);
    expect(GAME_DAYS_PER_REAL_DAY).toBe(4);
    expect(SEASON_DAYS).toBe(7);
  });

  it("trois saisons pleines et un hiver court", () => {
    expect(SEASON_REAL_DAYS).toEqual({ SPRING: 2, SUMMER: 2, AUTUMN: 2, WINTER: 1 });
    // Leur somme fait bien la semaine : aucun jour n'est sans saison.
    const total = Object.values(SEASON_REAL_DAYS).reduce((a, b) => a + b, 0);
    expect(total).toBe(YEAR_REAL_DAYS);
  });

  it("un cycle d’élevage est un jour — pas une saison", () => {
    // C'est l'égalité qui s'était installée par accident, et le bug tout
    // entier : une traite par saison, un hiver traversé sans le voir.
    expect(LIVESTOCK_CYCLE_MS).toBe(GAME_DAY_MS);
    expect(SEASON_DURATION_MS).not.toBe(LIVESTOCK_CYCLE_MS);
    expect(SEASON_DURATION_MS / LIVESTOCK_CYCLE_MS).toBe(7);
    // Quatre traites par jour réel : la journée bouge sans qu'on la surveille.
    expect(REAL_DAY_MS / LIVESTOCK_CYCLE_MS).toBe(4);
  });

  it("laisse la place à huit journées d’activité par saison pleine", () => {
    /*
     * La demande d'origine — « chaque saison permet des activités qui lui sont
     * propres » — tient toujours, à ceci près que la saison ne se compte plus
     * en semaines de jeu mais en jours réels. Deux jours réels font huit jours
     * de jeu : le compte des journées distinctes doit les couvrir toutes, sans
     * trou ni répétition.
     */
    const jours = new Set<number>();
    for (let t = LUNDI; t < LUNDI + REAL_DAY_MS * 2; t += GAME_DAY_MS) jours.add(dayOfSeason(t));
    expect([...jours].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(jours.size).toBe(seasonLengthDays("SPRING"));
  });
});

describe("le quantième de saison", () => {
  it("compte du premier au dernier jour de la saison", () => {
    // Le printemps couvre lundi et mardi, soit huit jours de jeu de six heures.
    expect(dayOfSeason(LUNDI)).toBe(1);
    expect(dayOfSeason(LUNDI + GAME_DAY_MS * 3)).toBe(4);
    expect(dayOfSeason(LUNDI + REAL_DAY_MS)).toBe(5);
    expect(dayOfSeason(LUNDI + REAL_DAY_MS * 2 - 1)).toBe(8);
  });

  it("repart à 1 exactement quand la saison change", () => {
    const mardiSoir = LUNDI + REAL_DAY_MS * 2 - 1;
    const mercredi = LUNDI + REAL_DAY_MS * 2;
    expect(currentSeason("N", mardiSoir)).not.toBe(currentSeason("N", mercredi));
    expect(dayOfSeason(mercredi)).toBe(1);
  });

  it("l’hiver ne compte que quatre jours de jeu", () => {
    // Un seul jour réel : c'est le jour creux, on ne l'allonge pas.
    const dimanche = LUNDI + REAL_DAY_MS * 6;
    expect(currentSeason("N", dimanche)).toBe("WINTER");
    expect(seasonLengthDays("WINTER")).toBe(4);
    expect(dayOfSeason(dimanche + REAL_DAY_MS - 1)).toBe(4);
  });

  it("avance d’un jour par jour, et pas plus vite", () => {
    expect(gameDayIndex(GAME_DAY_MS * 5 + 1)).toBe(5);
    expect(gameDayIndex(GAME_DAY_MS * 6 - 1)).toBe(5);
  });
});

describe("la saison elle-même", () => {
  const SEMAINE = [
    ["lundi", "SPRING"],
    ["mardi", "SPRING"],
    ["mercredi", "SUMMER"],
    ["jeudi", "SUMMER"],
    ["vendredi", "AUTUMN"],
    ["samedi", "AUTUMN"],
    ["dimanche", "WINTER"],
  ] as const;

  it("tombe sur les bons jours de la semaine", () => {
    for (const [i, [nom, saison]] of SEMAINE.entries()) {
      const t = LUNDI + i * REAL_DAY_MS;
      expect(`${nom} ${currentSeason("N", t)}`).toBe(`${nom} ${saison}`);
    }
  });

  it("met l’hiver le dimanche, et lui seul", () => {
    /*
     * C'est le cœur du modèle. L'hiver est le jour où rien ne pousse : le
     * poser sur le dimanche fait du jour creux un repos plutôt qu'une
     * punition, et c'est le seul jour dont chacun sait d'avance qu'il tombe.
     */
    const hivers = SEMAINE.filter((_, i) => currentSeason("N", LUNDI + i * REAL_DAY_MS) === "WINTER");
    expect(hivers.map(([nom]) => nom)).toEqual(["dimanche"]);
  });

  it("garde l’hémisphère sud à contretemps aux deux extrêmes", () => {
    // Opposition exacte là où elle compte : quand l'un est au plus froid,
    // l'autre est au plus chaud.
    const dimanche = LUNDI + REAL_DAY_MS * 6;
    const mercredi = LUNDI + REAL_DAY_MS * 2;
    expect(currentSeason("N", dimanche)).toBe("WINTER");
    expect(currentSeason("S", dimanche)).toBe("SUMMER");
    expect(currentSeason("N", mercredi)).toBe("SUMMER");
    expect(currentSeason("S", mercredi)).toBe("WINTER");
  });

  it("donne au sud la même année : trois saisons pleines et un hiver court", () => {
    const compte = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const s = currentSeason("S", LUNDI + i * REAL_DAY_MS);
      compte.set(s, (compte.get(s) ?? 0) + 1);
    }
    expect(Object.fromEntries(compte)).toEqual({ SPRING: 2, SUMMER: 2, AUTUMN: 2, WINTER: 1 });
  });

  it("progresse continûment du début à la fin", () => {
    expect(seasonProgress(LUNDI)).toBeCloseTo(0, 6);
    expect(seasonProgress(LUNDI + REAL_DAY_MS)).toBeCloseTo(0.5, 6);
    expect(seasonProgress(LUNDI + REAL_DAY_MS * 2 - 1)).toBeGreaterThan(0.99);
  });
});

describe("le temps qu’il fait tient la journée", () => {
  it("ne change pas d’une seconde à l’autre", () => {
    // Il était retiré au sort à chaque tour de simulation — toutes les vingt
    // secondes. Neige, soleil et orage se succédaient dans la même minute.
    const jour = gameDayIndex(GAME_DAY_MS * 3 + 1000);
    const a = weatherForDay("Cfb", "WINTER", "AUR-VALBLE", jour);
    const b = weatherForDay("Cfb", "WINTER", "AUR-VALBLE", jour);
    expect(a).toBe(b);
  });

  it("change d’un jour à l’autre", () => {
    // Sur une année entière, on doit voir passer plus d'un temps : un ciel
    // immuable serait le défaut inverse.
    const vus = new Set<string>();
    for (let j = 0; j < 60; j++) vus.add(weatherForDay("Cfb", "WINTER", "AUR-VALBLE", j));
    expect(vus.size).toBeGreaterThan(1);
  });

  it("donne des ciels différents à deux régions le même jour", () => {
    const memes = [0, 1, 2, 3, 4, 5, 6, 7].filter(
      (j) =>
        weatherForDay("Cfb", "SUMMER", "AUR-VALBLE", j) ===
        weatherForDay("Cfb", "SUMMER", "AUR-BRUMES", j),
    );
    // Elles peuvent coïncider — pas systématiquement.
    expect(memes.length).toBeLessThan(8);
  });

  it("respecte le climat : pas de neige en zone aride l’été", () => {
    for (let j = 0; j < 40; j++) {
      expect(weatherForDay("BWh", "SUMMER", "MER-DUNES", j)).not.toBe("SNOW");
    }
  });
});

describe("le calendrier agricole", () => {
  it("compte les pousses en jours de jeu, pas en minutes de mise au point", () => {
    // Les durées étaient des valeurs de dégrossissage — « 3 min MVP pour
    // itérer » — restées en place. Chacune doit maintenant être un nombre
    // entier ou demi de journées, sinon c'est qu'on a reposé une constante.
    for (const def of Object.values(CROP_DEFS)) {
      const jours = def.growMs / GAME_DAY_MS;
      expect(Math.abs(jours * 2 - Math.round(jours * 2))).toBeLessThan(0.01);
    }
  });

  it("aucune culture ne dépasse sa saison", () => {
    // Une culture plus longue qu'une saison ne pourrait jamais être semée et
    // récoltée dans la même : le calendrier agricole cesserait d'exister.
    for (const def of Object.values(CROP_DEFS)) {
      expect(def.growMs).toBeLessThan(SEASON_DURATION_MS);
    }
  });

  it("garde une culture courte, pour qu’il y ait toujours de quoi revenir", () => {
    // Avec des céréales à plus d'une heure, un céréalier débutant sans bêtes
    // n'aurait rien à faire de sa première heure de jeu. Le pois est le
    // garde-fou : il tient sous deux jours.
    const plusCourte = Math.min(...Object.values(CROP_DEFS).map((d) => d.growMs));
    expect(plusCourte).toBeLessThanOrEqual(2 * GAME_DAY_MS);
    expect(CROP_DEFS.PEA.growMs).toBe(plusCourte);
  });

  it("classe les cultures de la plus rapide à la plus lente, sans ex æquo", () => {
    // Des durées égales rendraient le choix de culture arbitraire : c'est le
    // temps d'immobilisation du champ qui doit faire l'arbitrage avec le
    // rendement.
    const durees = Object.values(CROP_DEFS).map((d) => d.growMs);
    expect(new Set(durees).size).toBe(durees.length);
  });

  it("laisse l’herbe repartir plus vite qu’elle n’a poussé", () => {
    expect(CROP_DEFS.GRASS.regrowMs).toBeLessThan(CROP_DEFS.GRASS.growMs);
    expect(cropGrowMs("GRASS", 1)).toBe(CROP_DEFS.GRASS.regrowMs);
    expect(cropGrowMs("GRASS", 0)).toBe(CROP_DEFS.GRASS.growMs);
  });

  it("le maïs est la culture qui engage le plus la saison", () => {
    const parDuree = Object.values(CROP_DEFS).sort((a, b) => b.growMs - a.growMs);
    expect(parDuree[0].code).toBe("MAIZE");
    // Et il paie mieux à la case : le temps immobilisé doit se rémunérer.
    expect(CROP_DEFS.MAIZE.yieldPerCell).toBeGreaterThan(CROP_DEFS.WHEAT.yieldPerCell);
  });
});
