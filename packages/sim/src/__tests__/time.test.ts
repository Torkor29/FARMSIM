/**
 * L'horloge du jeu.
 *
 * Ce fichier existe pour une raison précise : deux constantes de durée vivaient
 * dans deux modules différents et valaient la même chose sans que personne
 * l'ait voulu. `LIVESTOCK_CYCLE_MS` et `SEASON_DURATION_MS` faisaient quinze
 * minutes chacune — **une saison durait donc un jour de jeu**, et l'année
 * entière une heure. Rien ne l'interdisait, rien ne le signalait.
 *
 * L'horloge a changé deux fois depuis. Elle est d'abord tombée sur la semaine
 * réelle — lundi le printemps, dimanche l'hiver — ce qui réglait le problème
 * de repère et en créait un pire : les fenêtres de semis étant verrouillées
 * par saison, un joueur du week-end ne pouvait **jamais** semer la moitié du
 * catalogue. Elle tourne maintenant sur un cycle continu de saisons de dix
 * heures, qui glisse dans la journée.
 *
 * Ce que ces tests tiennent : que les durées continuent de s'emboîter, et que
 * le glissement soit réel — c'est-à-dire qu'aucune habitude de jeu, si
 * régulière soit-elle, n'enferme un joueur dans un sous-ensemble de saisons.
 */

import {
  CROP_DEFS,
  cropGrowMs,
  GAME_DAY_MS,
  LIVESTOCK_CYCLE_MS,
  REAL_DAY_MS,
  SEASON_CYCLE,
  SEASON_DAYS,
  SEASON_DURATION_MS,
  SEASON_REAL_HOURS,
  SEASON_REAL_MS,
  YEAR_DAYS,
  YEAR_MS,
  currentSeason,
  dayOfSeason,
  gameDayIndex,
  seasonIndex,
  seasonLengthDays,
  seasonProgress,
  weatherForDay,
  type Season,
} from "@farmsim/shared";

const HEURE = 60 * 60 * 1000;
/** Un lundi à minuit UTC, point de départ commode. */
const LUNDI = Date.UTC(2026, 7, 24);

describe("les durées s’emboîtent", () => {
  it("une saison dure dix heures réelles, et c’est le seul réglage", () => {
    expect(SEASON_REAL_HOURS).toBe(10);
    expect(SEASON_REAL_MS).toBe(10 * HEURE);
    expect(SEASON_DURATION_MS).toBe(SEASON_REAL_MS);
    expect(YEAR_MS).toBe(4 * SEASON_REAL_MS);
  });

  it("une année tient toujours vingt-huit jours de jeu", () => {
    /*
     * C'est l'invariant de calibrage du jeu entier, et il ne bouge pas : les
     * intérêts d'une saison valent sept jours d'intérêts, un pré tient sept
     * cycles d'élevage, un jeune grandit en sept cycles. Toutes ces valeurs
     * sont écrites en jours de jeu, et elles gardent leur sens parce que le
     * **jour de jeu se déduit de la saison**, et non l'inverse.
     */
    expect(SEASON_DAYS).toBe(7);
    expect(YEAR_DAYS).toBe(28);
    expect(GAME_DAY_MS).toBeCloseTo(SEASON_REAL_MS / 7, 6);
    expect(SEASON_DURATION_MS / GAME_DAY_MS).toBeCloseTo(7, 9);
  });

  it("un cycle d’élevage est un jour — pas une saison", () => {
    // C'est l'égalité qui s'était installée par accident, et le bug tout
    // entier : une traite par saison, un hiver traversé sans le voir.
    expect(LIVESTOCK_CYCLE_MS).toBe(GAME_DAY_MS);
    expect(SEASON_DURATION_MS).not.toBe(LIVESTOCK_CYCLE_MS);
    expect(SEASON_DURATION_MS / LIVESTOCK_CYCLE_MS).toBeCloseTo(7, 9);
  });

  it("donne les mêmes sept journées à chaque saison", () => {
    // Les saisons étaient inégales — trois pleines et un hiver court — ce qui
    // imposait une table indexée par jour, donc le calage sur la semaine.
    for (const s of SEASON_CYCLE) expect(seasonLengthDays(s)).toBe(7);
    const jours = new Set<number>();
    for (let t = 0; t < SEASON_REAL_MS; t += GAME_DAY_MS / 4) jours.add(dayOfSeason(t));
    expect([...jours].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("le quantième de saison", () => {
  it("compte du premier au dernier jour, sans déborder", () => {
    /*
     * On échantillonne au **milieu** de chaque journée, pas sur ses bornes :
     * une saison de dix heures ne fait pas un nombre entier de millisecondes
     * de jour de jeu, et à un horodatage de l'ordre de 10^12 la frontière se
     * situe à l'ulp près d'un côté ou de l'autre. Aucun joueur ne regarde une
     * frontière à la milliseconde ; un test, si.
     */
    const debut = seasonIndex(LUNDI) * SEASON_REAL_MS;
    for (let j = 0; j < 7; j++) {
      expect(dayOfSeason(debut + GAME_DAY_MS * (j + 0.5))).toBe(j + 1);
    }
    // La dernière milliseconde de la saison reste dans la saison : la division
    // ne tombe pas ronde, et sans borne on afficherait « jour 8 sur 7 ».
    expect(dayOfSeason(debut + SEASON_REAL_MS - 1)).toBe(7);
  });

  it("repart à 1 exactement quand la saison change", () => {
    const fin = (seasonIndex(LUNDI) + 1) * SEASON_REAL_MS;
    expect(currentSeason("N", fin - 1)).not.toBe(currentSeason("N", fin));
    expect(dayOfSeason(fin)).toBe(1);
  });

  it("avance d’un jour par jour, et pas plus vite", () => {
    expect(gameDayIndex(GAME_DAY_MS * 5 + 1)).toBe(5);
    expect(gameDayIndex(GAME_DAY_MS * 6 - 1)).toBe(5);
  });

  it("progresse continûment du début à la fin", () => {
    const debut = seasonIndex(LUNDI) * SEASON_REAL_MS;
    expect(seasonProgress(debut)).toBeCloseTo(0, 6);
    expect(seasonProgress(debut + SEASON_REAL_MS / 2)).toBeCloseTo(0.5, 6);
    expect(seasonProgress(debut + SEASON_REAL_MS - 1)).toBeGreaterThan(0.99);
  });
});

describe("la saison glisse — c’est tout l’objet du réglage", () => {
  /**
   * Le défaut corrigé, dit en une phrase : les fenêtres de semis sont
   * verrouillées par saison, donc un joueur qui ne voit que deux saisons ne
   * peut jamais semer la moitié du catalogue. Ce n'était pas un déséquilibre,
   * c'était une porte fermée — et elle se refermerait sans bruit si l'on
   * changeait `SEASON_REAL_HOURS` sans regarder ces deux propriétés.
   */

  it("n’avance pas d’un nombre entier de saisons par jour réel", () => {
    /*
     * Si le quotient est entier, la saison revient à la même heure chaque
     * jour. Il reste alors une chance : qu'il soit premier avec 4, auquel cas
     * on parcourt quand même le cycle (8 h → 3 saisons/jour, et 3 et 4 sont
     * premiers entre eux). Sinon on est figé — 12 h donne éternellement deux
     * saisons sur quatre, 6 h une seule.
     */
    const parJour = 24 / SEASON_REAL_HOURS;
    const entier = Number.isInteger(parJour);
    const pgcd = (a: number, b: number): number => (b === 0 ? a : pgcd(b, a % b));
    expect(entier ? pgcd(parJour, 4) : 1).toBe(1);
  });

  it("ne retombe pas non plus sur la semaine", () => {
    // Le second piège, et le plus discret : un joueur d'un seul soir par
    // semaine. C'est lui qui disqualifie 7 h (168 ÷ 28 = 6) et 14 h.
    expect(Number.isInteger(168 / (SEASON_CYCLE.length * SEASON_REAL_HOURS))).toBe(false);
  });

  const habitudes: Array<{ nom: string; creneaux: (semaine: number) => number[] }> = [
    {
      nom: "tous les soirs, 20 h",
      creneaux: (s) => [0, 1, 2, 3, 4, 5, 6].map((j) => s * 7 + j),
    },
    {
      nom: "le samedi après-midi seulement",
      creneaux: (s) => [s * 7 + 5],
    },
    {
      nom: "le mardi soir seulement",
      creneaux: (s) => [s * 7 + 1],
    },
    {
      nom: "les midis de semaine",
      creneaux: (s) => [0, 1, 2, 3, 4].map((j) => s * 7 + j),
    },
  ];

  it.each(habitudes)("fait voir les quatre saisons à qui joue $nom", ({ creneaux }) => {
    /*
     * La mesure qui compte. On ne vérifie pas une formule : on rejoue
     * l'habitude d'un joueur réel — toujours le même créneau, semaine après
     * semaine — et on regarde ce qu'il a le droit de semer.
     *
     * Sous l'ancien modèle, « le samedi après-midi » donnait automne, et
     * automne seulement, à vie.
     */
    for (const heure of [12, 15, 20, 22]) {
      const vues = new Set<Season>();
      for (let semaine = 0; semaine < 8; semaine++) {
        for (const jour of creneaux(semaine)) {
          const t = LUNDI + jour * REAL_DAY_MS + heure * HEURE;
          // Une session dure ; on regarde le début et deux heures plus tard.
          vues.add(currentSeason("N", t));
          vues.add(currentSeason("N", t + 2 * HEURE));
        }
      }
      expect({ heure, vues: [...vues].sort() }).toEqual({
        heure,
        vues: [...SEASON_CYCLE].sort(),
      });
    }
  });

  it("garde les deux hémisphères à contretemps exact", () => {
    // Opposition, pas décalage : quand l'un est au plus froid, l'autre est au
    // plus chaud. Un décalage impair les mettrait en demi-saison l'un de
    // l'autre — ça ne s'oppose plus, ça se croise.
    const oppose: Record<Season, Season> = {
      SPRING: "AUTUMN",
      SUMMER: "WINTER",
      AUTUMN: "SPRING",
      WINTER: "SUMMER",
    };
    for (let i = 0; i < 12; i++) {
      const t = LUNDI + i * 3 * HEURE;
      expect(currentSeason("S", t)).toBe(oppose[currentSeason("N", t)]);
    }
  });

  it("passe autant de temps dans chaque saison", () => {
    const compte = new Map<Season, number>();
    for (let i = 0; i < 4 * 24 * 40; i++) {
      const s = currentSeason("N", LUNDI + i * HEURE);
      compte.set(s, (compte.get(s) ?? 0) + 1);
    }
    const parts = SEASON_CYCLE.map((s) => compte.get(s) ?? 0);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
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
    expect(memes.length).toBeLessThan(8);
  });

  it("respecte le climat : pas de neige en zone aride l’été", () => {
    for (let j = 0; j < 40; j++) {
      expect(weatherForDay("BWh", "SUMMER", "MER-DUNES", j)).not.toBe("SNOW");
    }
  });
});

describe("le calendrier agricole", () => {
  it("compte les pousses en heures réelles rondes", () => {
    /*
     * Les durées étaient des valeurs de dégrossissage — « 3 min MVP pour
     * itérer » — puis des multiples du jour de jeu. Elles se lisent maintenant
     * en heures réelles, parce que c'est ainsi qu'elles ont été recalculées :
     * une par une, en regardant à quelle saison chaque culture arrive à
     * maturité. Un chiffre non rond signalerait une constante reposée à
     * l'estime.
     */
    for (const def of Object.values(CROP_DEFS)) {
      expect(def.growMs / HEURE).toBeCloseTo(Math.round(def.growMs / HEURE), 6);
    }
  });

  it("laisse les céréales déborder leur saison — c’est ce qu’on voulait", () => {
    /*
     * L'ancienne version tenait l'inverse : « aucune culture ne dépasse sa
     * saison ». C'était la conséquence d'une saison de sept jours réels, et
     * c'est exactement ce que ce changement défait. Un blé d'hiver qui se
     * sèmerait et se moissonnerait dans la même saison n'est pas un blé
     * d'hiver — il se sème à l'automne et se moissonne l'été.
     */
    expect(CROP_DEFS.WHEAT.growMs).toBeGreaterThan(2 * SEASON_DURATION_MS);
    expect(CROP_DEFS.BARLEY.growMs).toBeGreaterThan(SEASON_DURATION_MS);
  });

  it("garde de quoi revenir vite : l’herbe boucle dans sa saison", () => {
    /*
     * Le garde-fou de l'autre côté. Si toutes les cultures tenaient trois
     * saisons, un débutant sans bêtes n'aurait rien à récolter de ses
     * premières heures. L'herbe est le cycle court — et la repousse est plus
     * courte encore.
     */
    const plusCourte = Math.min(...Object.values(CROP_DEFS).map((d) => d.growMs));
    expect(CROP_DEFS.GRASS.growMs).toBe(plusCourte);
    expect(cropGrowMs("GRASS", 1)).toBeLessThan(SEASON_DURATION_MS);
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

  it("fait du blé la culture qui engage le plus le champ", () => {
    /*
     * Et c'est le maïs qui paie le mieux à la case. L'arbitrage a changé de
     * nature avec le calendrier : ce n'est plus « quelle culture est la plus
     * longue », c'est « est-ce que j'immobilise ce champ de l'automne à l'été,
     * ou est-ce que je fais un maïs de printemps qui rapporte plus vite ». Le
     * blé ne se rattrape pas au rendement mais à la paille et à l'occupation
     * d'hiver, quand rien d'autre ne pousse.
     */
    const parDuree = Object.values(CROP_DEFS).sort((a, b) => b.growMs - a.growMs);
    expect(parDuree[0]!.code).toBe("WHEAT");
    expect(CROP_DEFS.MAIZE.yieldPerCell).toBeGreaterThan(CROP_DEFS.WHEAT.yieldPerCell);
  });
});
