/**
 * L'horloge du jeu.
 *
 * Ce fichier existe pour une raison précise : deux constantes de durée vivaient
 * dans deux modules différents et valaient la même chose sans que personne
 * l'ait voulu. `LIVESTOCK_CYCLE_MS` et `SEASON_DURATION_MS` faisaient quinze
 * minutes chacune — **une saison durait donc un jour de jeu**, et l'année
 * entière une heure. Rien ne l'interdisait, rien ne le signalait.
 *
 * Les rapports entre les durées sont maintenant des assertions. Si quelqu'un
 * remet une constante en dur quelque part, c'est ici qu'on l'apprend.
 */

import {
  CROP_DEFS,
  cropGrowMs,
  GAME_DAY_MS,
  LIVESTOCK_CYCLE_MS,
  SEASON_DAYS,
  SEASON_DURATION_MS,
  YEAR_MS,
  currentSeason,
  dayOfSeason,
  gameDayIndex,
  seasonProgress,
  weatherForDay,
} from "@farmsim/shared";

describe("les durées s’emboîtent", () => {
  it("une saison vaut une semaine de jours de jeu", () => {
    expect(SEASON_DAYS).toBe(7);
    expect(SEASON_DURATION_MS).toBe(SEASON_DAYS * GAME_DAY_MS);
  });

  it("une année vaut quatre saisons", () => {
    expect(YEAR_MS).toBe(4 * SEASON_DURATION_MS);
  });

  it("un cycle d’élevage est un jour — pas une saison", () => {
    // C'est l'égalité qui s'était installée par accident, et le bug tout
    // entier : une traite par saison, un hiver traversé sans le voir.
    expect(LIVESTOCK_CYCLE_MS).toBe(GAME_DAY_MS);
    expect(SEASON_DURATION_MS).not.toBe(LIVESTOCK_CYCLE_MS);
    expect(SEASON_DURATION_MS / LIVESTOCK_CYCLE_MS).toBe(7);
  });

  it("laisse la place à sept journées d’activité par saison", () => {
    // La demande, littéralement : « chaque saison c'est une semaine, ça permet
    // de faire des activités chaque semaine dépendant de chaque saison ».
    const debut = 0;
    const jours = new Set<number>();
    for (let t = debut; t < SEASON_DURATION_MS; t += GAME_DAY_MS) jours.add(dayOfSeason(t));
    expect(jours.size).toBe(SEASON_DAYS);
    expect([...jours].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("le quantième de saison", () => {
  it("compte de 1 à 7 puis repart", () => {
    expect(dayOfSeason(0)).toBe(1);
    expect(dayOfSeason(GAME_DAY_MS * 3)).toBe(4);
    expect(dayOfSeason(GAME_DAY_MS * 6)).toBe(7);
    expect(dayOfSeason(GAME_DAY_MS * 7)).toBe(1);
  });

  it("repart à 1 exactement quand la saison change", () => {
    const veille = currentSeason("N", SEASON_DURATION_MS - 1);
    const lendemain = currentSeason("N", SEASON_DURATION_MS);
    expect(veille).not.toBe(lendemain);
    expect(dayOfSeason(SEASON_DURATION_MS)).toBe(1);
  });

  it("avance d’un jour par jour, et pas plus vite", () => {
    expect(gameDayIndex(GAME_DAY_MS * 5 + 1)).toBe(5);
    expect(gameDayIndex(GAME_DAY_MS * 6 - 1)).toBe(5);
  });
});

describe("la saison elle-même", () => {
  it("dure bien une semaine avant de tourner", () => {
    expect(currentSeason("N", 0)).toBe("SPRING");
    // Six jours plus tard, on est toujours au printemps — c'est tout l'objet.
    expect(currentSeason("N", GAME_DAY_MS * 6)).toBe("SPRING");
    expect(currentSeason("N", GAME_DAY_MS * 7)).toBe("SUMMER");
  });

  it("garde l’hémisphère sud à contretemps", () => {
    expect(currentSeason("S", 0)).toBe("AUTUMN");
    expect(currentSeason("S", GAME_DAY_MS * 7)).toBe("WINTER");
  });

  it("progresse continûment du début à la fin", () => {
    expect(seasonProgress(0)).toBeCloseTo(0, 6);
    expect(seasonProgress(SEASON_DURATION_MS / 2)).toBeCloseTo(0.5, 6);
    expect(seasonProgress(SEASON_DURATION_MS - 1)).toBeGreaterThan(0.99);
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
