/**
 * L'horloge du jeu.
 *
 * Ce fichier existe pour une raison précise : deux constantes de durée vivaient
 * dans deux modules différents et valaient la même chose sans que personne
 * l'ait voulu. `LIVESTOCK_CYCLE_MS` et `SEASON_DURATION_MS` faisaient quinze
 * minutes chacune — **une saison durait donc un jour de jeu**, et l'année
 * entière une heure. Rien ne l'interdisait, rien ne le signalait.
 *
 * L'horloge a changé trois fois depuis. Elle est d'abord tombée sur la semaine
 * réelle — lundi le printemps, dimanche l'hiver — ce qui réglait le problème
 * de repère et en créait un pire : les fenêtres de semis étant verrouillées
 * par saison, un joueur du week-end ne pouvait **jamais** semer la moitié du
 * catalogue. Elle est ensuite passée à un cycle continu de quatre saisons
 * égales de dix heures, qui glisse dans la journée. L'hiver y redevient
 * enfin court — quatre jours de jeu contre sept —, cette fois sans la table
 * indexée par jour de semaine qui avait fait renoncer la première fois.
 *
 * Ce que ces tests tiennent : que les durées continuent de s'emboîter, que le
 * glissement soit réel — c'est-à-dire qu'aucune habitude de jeu, si régulière
 * soit-elle, n'enferme un joueur dans un sous-ensemble de saisons — et que le
 * prix de l'hiver court, l'opposition des hémisphères qui n'est plus exacte,
 * reste borné à ce qu'on a accepté.
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
  SEASON_LENGTH_DAYS,
  SEASON_REAL_HOURS,
  SEASON_REAL_MS,
  WINTER_DAYS,
  YEAR_DAYS,
  YEAR_MS,
  currentSeason,
  dayOfSeason,
  gameDayIndex,
  seasonDurationMs,
  seasonSpan,
  seasonLengthDays,
  seasonProgress,
  seasonStartOfIndex,
  weatherForDay,
  type Season,
} from "@farmsim/shared";

const HEURE = 60 * 60 * 1000;
/** Un lundi à minuit UTC, point de départ commode. */
const LUNDI = Date.UTC(2026, 7, 24);

describe("les durées s’emboîtent", () => {
  it("une saison pleine dure dix heures réelles, et c’est le seul réglage", () => {
    expect(SEASON_REAL_HOURS).toBe(10);
    expect(SEASON_REAL_MS).toBe(10 * HEURE);
    expect(SEASON_DURATION_MS).toBe(SEASON_REAL_MS);
    // Trois saisons pleines et un hiver court : l'année ne fait plus quatre
    // fois la saison.
    expect(YEAR_MS).toBeCloseTo(3 * SEASON_REAL_MS + WINTER_DAYS * GAME_DAY_MS, 6);
  });

  it("garde le jour de jeu inchangé — c’est le nombre de jours qui varie", () => {
    /*
     * L'invariant de calibrage du jeu entier tient à ceci : un jour de jeu
     * dure toujours la même chose. Les intérêts, la gestation, la péremption
     * et la pousse sont tous libellés en jours ; ils ne se décalent donc pas
     * les uns par rapport aux autres. Un hiver court, c'est **moins de
     * jours**, pas des jours plus courts.
     */
    expect(SEASON_DAYS).toBe(7);
    expect(WINTER_DAYS).toBe(4);
    expect(YEAR_DAYS).toBe(3 * SEASON_DAYS + WINTER_DAYS);
    expect(GAME_DAY_MS).toBeCloseTo(SEASON_REAL_MS / 7, 6);
    for (const s of SEASON_CYCLE) {
      expect(seasonDurationMs(s) / GAME_DAY_MS).toBeCloseTo(SEASON_LENGTH_DAYS[s], 9);
    }
  });

  it("un cycle d’élevage est un jour — pas une saison", () => {
    // C'est l'égalité qui s'était installée par accident, et le bug tout
    // entier : une traite par saison, un hiver traversé sans le voir.
    expect(LIVESTOCK_CYCLE_MS).toBe(GAME_DAY_MS);
    expect(SEASON_DURATION_MS).not.toBe(LIVESTOCK_CYCLE_MS);
    expect(SEASON_DURATION_MS / LIVESTOCK_CYCLE_MS).toBeCloseTo(7, 9);
  });

  it("donne sept journées aux saisons pleines et quatre à l’hiver", () => {
    /*
     * Les saisons ont déjà été inégales, puis rendues égales — non parce que
     * l'hiver méritait sept jours, mais parce que la seule implémentation à
     * portée de main était une table indexée par jour de semaine, qui
     * ramenait le calage hebdomadaire. Elles redeviennent inégales sans cette
     * table : l'année est une suite d'intervalles, et la saison se trouve par
     * un modulo sur la position dans l'année.
     */
    expect(seasonLengthDays("SPRING")).toBe(7);
    expect(seasonLengthDays("SUMMER")).toBe(7);
    expect(seasonLengthDays("AUTUMN")).toBe(7);
    expect(seasonLengthDays("WINTER")).toBe(4);

    // Et le quantième affiché va bien de 1 à la longueur de la saison — sans
    // sauter de jour, et sans en inventer un huitième.
    for (let rang = 0; rang < SEASON_CYCLE.length; rang++) {
      const saison = SEASON_CYCLE[rang]!;
      const debut = seasonStartOfIndex(rang);
      const jours = new Set<number>();
      for (let t = debut; t < debut + seasonDurationMs(saison); t += GAME_DAY_MS / 4) {
        jours.add(dayOfSeason(t));
      }
      const attendus = Array.from({ length: seasonLengthDays(saison) }, (_, i) => i + 1);
      expect({ saison, jours: [...jours].sort((a, b) => a - b) }).toEqual({
        saison,
        jours: attendus,
      });
    }
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
     *
     * On le fait pour les quatre saisons : c'est l'hiver, la plus courte, qui
     * déborderait le premier si le quantième se comptait sur une longueur type.
     */
    for (let rang = 0; rang < SEASON_CYCLE.length; rang++) {
      const saison = SEASON_CYCLE[rang]!;
      const debut = seasonStartOfIndex(rang);
      const duree = seasonDurationMs(saison);
      for (let j = 0; j < seasonLengthDays(saison); j++) {
        expect({ saison, j, jour: dayOfSeason(debut + GAME_DAY_MS * (j + 0.5)) }).toEqual({
          saison,
          j,
          jour: j + 1,
        });
      }
      // La dernière milliseconde reste dans la saison : sans borne on
      // afficherait « jour 8 sur 7 », ou « jour 5 sur 4 » en hiver.
      expect({ saison, dernier: dayOfSeason(debut + duree - 1) }).toEqual({
        saison,
        dernier: seasonLengthDays(saison),
      });
    }
  });

  it("repart à 1 exactement quand la saison change", () => {
    for (let rang = 0; rang < 8; rang++) {
      const fin = seasonStartOfIndex(rang + 1);
      expect(currentSeason("N", fin - 1)).not.toBe(currentSeason("N", fin));
      expect(dayOfSeason(fin)).toBe(1);
    }
  });

  it("avance d’un jour par jour, et pas plus vite", () => {
    expect(gameDayIndex(GAME_DAY_MS * 5 + 1)).toBe(5);
    expect(gameDayIndex(GAME_DAY_MS * 6 - 1)).toBe(5);
  });

  it("progresse continûment du début à la fin", () => {
    for (let rang = 0; rang < SEASON_CYCLE.length; rang++) {
      const debut = seasonStartOfIndex(rang);
      const duree = seasonDurationMs(SEASON_CYCLE[rang]!);
      expect(seasonProgress(debut)).toBeCloseTo(0, 6);
      expect(seasonProgress(debut + duree / 2)).toBeCloseTo(0.5, 6);
      expect(seasonProgress(debut + duree - 1)).toBeGreaterThan(0.99);
    }
  });

  it("tombe toujours sur une frontière de jour de jeu", () => {
    /*
     * Ce n'est pas une coquetterie : la simulation de pousse découpe son
     * intégration à la fois au jour et à la saison, et elle ne peut lire la
     * bonne vitesse que si les deux grilles coïncident. Une saison qui
     * finirait au milieu d'une journée ferait pousser des heures de printemps
     * à la vitesse de l'hiver, sans que rien ne le signale.
     */
    for (const h of ["N", "S"] as const) {
      for (let i = 0; i < 12; i++) {
        const { start, end } = seasonSpan(h, LUNDI + i * 3 * HEURE);
        expect(start / GAME_DAY_MS).toBeCloseTo(Math.round(start / GAME_DAY_MS), 6);
        expect(end / GAME_DAY_MS).toBeCloseTo(Math.round(end / GAME_DAY_MS), 6);
      }
    }
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

  /**
   * La quantité à surveiller n'est plus la saison mais l'**année**.
   *
   * Tant que les quatre saisons étaient égales, « avancer d'un nombre entier
   * de saisons par jour » suffisait à décrire le piège. Avec un hiver court,
   * ce n'est plus la bonne unité : ce qui enferme un joueur, c'est que sa
   * position dans l'année revienne toujours à la même place. On mesure donc
   * combien de positions distinctes une habitude régulière visite avant de se
   * répéter.
   */
  function positionsVisitees(periodeMs: number): number {
    const vues = new Set<number>();
    for (let i = 0; i < 4000; i++) {
      // Arrondi au dixième de jour de jeu : deux positions qui ne diffèrent
      // que d'une milliseconde ne sont pas deux positions pour un joueur.
      vues.add(Math.round((((i * periodeMs) % YEAR_MS) / GAME_DAY_MS) * 10));
    }
    return vues.size;
  }

  it("ne ramène pas le joueur quotidien à la même place dans l’année", () => {
    // Un jour réel avance de 84/125 d'année ; 84 est premier avec 125, donc
    // 125 positions avant répétition. Il en faut au moins autant qu'il y a de
    // jours dans l'année pour que les quatre saisons soient atteignables.
    expect(positionsVisitees(REAL_DAY_MS)).toBeGreaterThan(YEAR_DAYS);
  });

  it("ne ramène pas non plus le joueur hebdomadaire", () => {
    // Le second piège, et le plus discret : un joueur d'un seul soir par
    // semaine. C'est lui qui disqualifiait 7 h et 14 h du temps des saisons
    // égales, alors que la vérification quotidienne les laissait passer.
    expect(positionsVisitees(7 * REAL_DAY_MS)).toBeGreaterThan(YEAR_DAYS);
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

  /**
   * ## L'opposition des hémisphères, et sa couture
   *
   * Tant que les quatre saisons duraient le même temps, le sud était l'opposé
   * exact du nord : on renommait, et c'était tout. Un hiver plus court rend
   * cette opposition-là impossible, et c'est arithmétique. Renommer
   * l'intervalle où le nord hiverne donnerait au sud un **été de quatre
   * jours**, et à son hiver les sept jours de l'été du nord : l'hémisphère sud
   * paierait le confort du nord. Aucun choix de longueurs n'évite cela, sauf à
   * rendre l'été aussi court que l'hiver.
   *
   * Les deux hémisphères lisent donc la même suite d'intervalles, le sud avec
   * deux saisons pleines d'avance. Chacun a son hiver court. L'opposition
   * tient alors sur dix-neuf jours sur vingt-cinq, et se déchire sur deux
   * coutures de trois jours : la fin de l'été du nord, où le sud est déjà
   * sorti de l'hiver, et la fin de son automne, où le sud est déjà en été.
   *
   * Ces vingt-quatre pour cent sont un plancher, pas un réglage à améliorer :
   * quel que soit le décalage choisi, on ne descend pas en dessous. La seule
   * façon de retrouver l'opposition exacte serait de rendre l'été aussi court
   * que l'hiver — c'est-à-dire de payer le confort d'hiver avec la saison où
   * tout pousse.
   *
   * Ces tests nomment la couture plutôt que de faire comme si elle n'existait
   * pas : le premier borne exactement ce qui n'est plus vrai, le second tient
   * la propriété pour laquelle on l'accepte.
   */
  const OPPOSE: Record<Season, Season> = {
    SPRING: "AUTUMN",
    SUMMER: "WINTER",
    AUTUMN: "SPRING",
    WINTER: "SUMMER",
  };

  it("oppose les deux hémisphères partout sauf sur deux coutures nommées", () => {
    const coutures = new Set<string>();
    let desaccords = 0;
    for (let i = 0; i < 400; i++) {
      const t = LUNDI + i * (YEAR_MS / 400);
      const nord = currentSeason("N", t);
      const sud = currentSeason("S", t);
      if (sud === OPPOSE[nord]) continue;
      // Les deux seuls désaccords admis, et ils sont nommés. Tout autre
      // couple signifierait que le décalage a bougé.
      expect(`${nord}/${sud}`).toMatch(/^(SUMMER\/SPRING|AUTUMN\/SUMMER)$/);
      coutures.add(`${nord}/${sud}`);
      desaccords++;
    }
    // Et la couture reste une couture : six jours sur vingt-cinq, pas un
    // décalage général.
    expect(desaccords / 400).toBeLessThan(0.25);
    expect([...coutures].sort()).toEqual(["AUTUMN/SUMMER", "SUMMER/SPRING"]);
  });

  it("donne à chaque hémisphère le même hiver court", () => {
    // C'est la propriété pour laquelle la couture est acceptée : personne ne
    // paie l'hiver court de l'autre.
    for (const h of ["N", "S"] as const) {
      const compte = new Map<Season, number>();
      const pas = YEAR_MS / 2500;
      for (let i = 0; i < 2500; i++) {
        const s = currentSeason(h, LUNDI + i * pas);
        compte.set(s, (compte.get(s) ?? 0) + 1);
      }
      for (const s of SEASON_CYCLE) {
        const part = (compte.get(s) ?? 0) / 2500;
        expect({ h, s, part: Math.round(part * 100) }).toEqual({
          h,
          s,
          part: Math.round((seasonLengthDays(s) / YEAR_DAYS) * 100),
        });
      }
    }
  });

  it("fait passer moins de temps en hiver qu’ailleurs — c’est tout l’objet", () => {
    expect(seasonDurationMs("WINTER")).toBeLessThan(seasonDurationMs("SUMMER"));
    // 5 h 43 au lieu de 10 h : assez court pour qu'un joueur du soir ne tombe
    // pas deux sessions de suite sur la seule saison où son champ n'avance pas.
    expect(seasonDurationMs("WINTER") / HEURE).toBeCloseTo(40 / 7, 6);
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

  it("garde de quoi revenir vite, et bien plus vite qu'avant", () => {
    /*
     * Le garde-fou de l'autre côté. Si toutes les cultures tenaient trois
     * saisons, un débutant sans bêtes n'aurait rien à récolter de ses
     * premières heures.
     *
     * L'herbe tenait ce rôle, et ce test disait « l'herbe est la plus courte
     * du catalogue ». Elle ne l'est plus : le maraîchage passe dessous, et
     * c'est le but — douze heures, ce n'est toujours pas une soirée. Ce qu'il
     * fallait garder de l'assertion, c'est son intention : **il existe une
     * culture qui boucle dans une saison**, et une plus courte encore pour
     * qui ne revient qu'un soir.
     */
    // C'est la **repousse** qui boucle dans la saison, pas le premier cycle :
    // l'herbe met douze heures à s'installer, une saison en dure dix.
    expect(cropGrowMs("GRASS", 1)).toBeLessThan(SEASON_DURATION_MS);
    expect(cropGrowMs("GRASS", 1)).toBeLessThan(CROP_DEFS.GRASS.growMs);

    // L'herbe reste le cycle court des fourrages : aucune autre culture
    // destinée au troupeau ne doit être plus rapide qu'elle.
    for (const c of ["WHEAT", "MAIZE", "PEA", "BARLEY", "RAPE"] as const) {
      expect(CROP_DEFS[c].growMs).toBeGreaterThan(CROP_DEFS.GRASS.growMs);
    }

    // Et le plancher du catalogue tient maintenant dans une soirée.
    const plusCourte = Math.min(...Object.values(CROP_DEFS).map((d) => d.growMs));
    expect(plusCourte).toBeLessThanOrEqual(2 * 3_600_000);
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
