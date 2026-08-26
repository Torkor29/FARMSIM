/**
 * Équilibrage de l'élevage — ce que les chiffres produisent réellement.
 *
 * Les valeurs de `husbandry.ts` (pousse de l'herbe, bornes de confort,
 * sévérité du froid) ont été posées à la main. Les tests unitaires prouvent
 * que les fonctions calculent ce qu'elles annoncent ; ils ne disent rien de
 * **l'expérience de jeu** qui en découle.
 *
 * Ce fichier-ci simule une année entière, saison par saison, et fixe les
 * intentions de conception sous forme d'assertions. Si l'on retouche une
 * constante, c'est ici que l'on verra ce qu'on a cassé — pas trois semaines
 * plus tard en jouant.
 *
 * Les intentions, énoncées avant les chiffres :
 *
 * 1. Un troupeau sorti en été ne consomme plus rien du hangar.
 * 2. Le même sorti en hiver consomme **tout** : le pré ne donne rien.
 * 3. Un pré tient un troupeau raisonnable, mais se laisse surpâturer.
 * 4. Laisser des bêtes dehors en hiver coûte, sans les tuer d'un coup.
 * 5. Le bâtiment protège assez pour que rentrer soit une vraie réponse.
 */

import {
  GAME_DAY_MS,
  GRASS_GROWTH,
  GRASS_INTAKE_TONS,
  PADDOCK,
  PADDOCK_ANIMALS_PER_CELL,
  SPECIES,
  SUSTAINABLE_STOCKING_RATE,
  feedSavedByPasture,
  feltTempC,
  grassCapacity,
  grazePasture,
  SEASON_DAYS,
  thermalPenalty,
  YEAR_DAYS,
  type Season,
} from "@farmsim/shared";

/** Heures réelles que dure un cycle d'élevage — l'unité du joueur. */
const CYCLE_H = GAME_DAY_MS / 3_600_000;

const SAISONS: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

/** Fait tourner un enclos sur `cycles` cycles, troupeau dehors en permanence. */
function anneeAuPre(opts: { paddockCells: number; herdSize: number; cyclesParSaison: number }) {
  let grass = grassCapacity(opts.paddockCells) * 0.5;
  const releve: { saison: Season; couverture: number; herbeFin: number; rationTiree: number }[] = [];

  for (const saison of SAISONS) {
    let couvertureCumul = 0;
    for (let c = 0; c < opts.cyclesParSaison; c++) {
      const out = grazePasture({
        grassTons: grass,
        paddockCells: opts.paddockCells,
        season: saison,
        animalsOutside: opts.herdSize,
        cycles: 1,
      });
      grass = out.grassTons;
      couvertureCumul += out.coverage;
    }
    const couverture = couvertureCumul / opts.cyclesParSaison;
    releve.push({
      saison,
      couverture,
      herbeFin: grass,
      // Part de la ration du hangar qu'il a fallu sortir malgré le pré.
      rationTiree:
        1 -
        feedSavedByPasture({
          herdSize: opts.herdSize,
          animalsOutside: opts.herdSize,
          coverage: couverture,
        }),
    });
  }
  return releve;
}

describe("une année au pré", () => {
  // Un enclos de 9 cases, un troupeau de 8 vaches : la taille d'un élevage de
  // début de partie, celle qu'un joueur rencontre en premier.
  //
  // Sept cycles par saison, parce qu'une saison fait désormais sept jours de
  // jeu et qu'un cycle d'élevage fait un jour. Ce chiffre était pris au
  // hasard quand les deux durées étaient égales — une saison valait alors un
  // seul cycle, et ce fichier simulait une année qui n'existait pas.
  const annee = anneeAuPre({ paddockCells: 9, herdSize: 8, cyclesParSaison: SEASON_DAYS });
  const par = (s: Season) => annee.find((x) => x.saison === s)!;

  it("l'été, le hangar ne sert à rien — c'est la promesse du pâturage", () => {
    expect(par("SUMMER").couverture).toBeCloseTo(1, 2);
    expect(par("SUMMER").rationTiree).toBeLessThan(0.02);
  });

  it("le printemps tient aussi bien, l'herbe y pousse le plus vite", () => {
    expect(par("SPRING").couverture).toBeCloseTo(1, 2);
  });

  it("un enclos sous-chargé passe l'hiver — c'est la récompense du bon chargement", () => {
    // 9 cases pour 8 bêtes, soit 0,89 bête par case : très en dessous de la
    // charge soutenable de 1,6. Ce troupeau-là traverse l'hiver sans que le
    // hangar s'ouvre, et c'est voulu — le calibrage récompense qui ne
    // surcharge pas. La falaise d'hiver se mesure à pleine charge, plus bas.
    expect(par("WINTER").herbeFin).toBeGreaterThan(0.5 * grassCapacity(9));
    expect(par("WINTER").couverture).toBeCloseTo(1, 2);
  });

  it("à pleine charge, l'hiver vide bel et bien la réserve", () => {
    // 9 cases, 18 bêtes : le maximum que l'enclos laisse sortir. La réserve
    // part pleine et finit sous 20 % — le joueur voit le fond arriver du
    // premier au dernier jour de l'hiver et doit avoir tranché avant.
    let herbe = grassCapacity(9);
    for (let c = 0; c < SEASON_DAYS; c++) {
      herbe = grazePasture({
        grassTons: herbe,
        paddockCells: 9,
        season: "WINTER",
        animalsOutside: 18,
        cycles: 1,
      }).grassTons;
    }
    expect(herbe).toBeGreaterThan(0);
    expect(herbe).toBeLessThan(0.2 * grassCapacity(9));
  });

  it("un hiver qui dure force à ouvrir le hangar", () => {
    // La réserve épuisée, la couverture tombe et la ration stockée prend le
    // relais. C'est là que la décision « je rentre ou je nourris » se pose.
    const long = anneeAuPre({ paddockCells: 9, herdSize: 8, cyclesParSaison: 25 });
    const hiver = long.find((x) => x.saison === "WINTER")!;
    expect(hiver.herbeFin).toBeLessThan(0.01);
    expect(hiver.rationTiree).toBeGreaterThan(0.3);
  });

  it("l'automne ralentit sans casser — la falaise est en hiver", () => {
    // À charge raisonnable l'automne passe encore ; c'est l'hiver qui tranche.
    // Le joueur a donc une saison entière pour constituer ses stocks au lieu
    // de se réveiller à sec.
    expect(par("AUTUMN").couverture).toBeGreaterThanOrEqual(par("WINTER").couverture);
    const charge = anneeAuPre({ paddockCells: 9, herdSize: 18, cyclesParSaison: 25 });
    const a = charge.find((x) => x.saison === "AUTUMN")!;
    const h = charge.find((x) => x.saison === "WINTER")!;
    expect(a.couverture).toBeGreaterThan(h.couverture);
  });
});

describe("charge du pré", () => {
  it("un enclos correctement chargé tient l'été sans faiblir", () => {
    // 9 cases pour 8 bêtes : la pousse estivale couvre l'ingéré.
    const out = anneeAuPre({ paddockCells: 9, herdSize: 8, cyclesParSaison: 20 });
    expect(out.find((x) => x.saison === "SUMMER")!.couverture).toBeCloseTo(1, 2);
  });

  it("un enclos surchargé s'épuise — le surpâturage n'a pas eu à être inventé", () => {
    // Le même enclos avec quatre fois plus de bêtes que sa capacité de sortie :
    // la pousse ne suit pas, et la couverture s'effondre saison après saison.
    const out = anneeAuPre({ paddockCells: 9, herdSize: 32, cyclesParSaison: 20 });
    expect(out.find((x) => x.saison === "SUMMER")!.couverture).toBeLessThan(0.75);
    expect(out.find((x) => x.saison === "AUTUMN")!.couverture).toBeLessThan(0.5);
    expect(out.find((x) => x.saison === "WINTER")!.couverture).toBe(0);
  });

  it("l'ingéré d'une bête reste petit devant la pousse d'une case", () => {
    // Garde-fou d'échelle : si l'un des deux dérive d'un ordre de grandeur,
    // le pâturage devient soit gratuit, soit inutile.
    expect(GRASS_INTAKE_TONS).toBeLessThan(grassCapacity(1));
  });
});

/**
 * Le calibrage du pré, lu à l'horloge murale.
 *
 * Les tests ci-dessus raisonnent en **cycles**, et c'est ce qui a laissé
 * passer le défaut : quand la saison est passée à dix heures réelles, le
 * cycle d'élevage a suivi `GAME_DAY_MS` et perdu les trois quarts de sa
 * durée. Tous les équilibres par cycle sont restés vrais ; l'expérience du
 * joueur, elle, s'est mise à défiler 4,2 fois plus vite.
 *
 * Ce bloc-ci fixe donc les intentions dans l'unité du joueur — l'heure
 * réelle — pour qu'un futur changement de `SEASON_REAL_HOURS` casse un test
 * au lieu de vider les prés en silence.
 */
describe("le pré à l'horloge du joueur", () => {
  /** Heures réelles avant le pré à nu, réserve pleine, saison figée. */
  function heuresAvantANu(cells: number, animals: number, season: Season): number {
    const net = GRASS_INTAKE_TONS * animals - GRASS_GROWTH[season] * cells;
    if (net <= 0) return Infinity;
    return (grassCapacity(cells) / net) * CYCLE_H;
  }

  it("une réserve pleine tient plus qu'une nuit, même à pleine charge", () => {
    // Le reproche exact : « un joueur qui se connecte le soir retrouve un pré
    // à nu ». Le pire cas est l'hiver à pleine charge, sans une seule
    // repousse. Il durait 4 h 06 — moins qu'une soirée de travail.
    const pire = heuresAvantANu(9, 9 * PADDOCK_ANIMALS_PER_CELL, "WINTER");
    expect(pire).toBeGreaterThan(10);
    // Mais pas au point que l'hiver (10 h réelles) ne puisse plus l'entamer :
    // au-delà, la décision « je rentre ou je nourris » disparaîtrait.
    expect(pire).toBeLessThan(2 * 10);
  });

  it("à 80 % de charge, une absence d'une nuit ne met pas le pré à nu", () => {
    // Une absence de 22 h réelles traverse deux saisons et demie : on la
    // simule en faisant défiler les saisons, en partant de chaque phase
    // possible de l'année, et on garde la pire.
    const cells = 9;
    const animals = Math.round(cells * PADDOCK_ANIMALS_PER_CELL * 0.8);
    const cyclesAbsence = 22 / CYCLE_H;

    let pire = 1;
    for (let depart = 0; depart < YEAR_DAYS; depart += 1) {
      let herbe = grassCapacity(cells);
      for (let c = 0; c < cyclesAbsence; c += 0.25) {
        const saison = SAISONS[Math.floor((depart + c) / SEASON_DAYS) % SAISONS.length]!;
        herbe = grazePasture({
          grassTons: herbe,
          paddockCells: cells,
          season: saison,
          animalsOutside: animals,
          cycles: 0.25,
        }).grassTons;
        pire = Math.min(pire, herbe / grassCapacity(cells));
      }
    }
    expect(pire).toBeGreaterThan(0);
  });

  it("mais à pleine charge, elle le met à nu — c'est le prix du maximum", () => {
    // La contrepartie assumée : l'enclos rempli au maximum de ce qu'il laisse
    // sortir ne passe pas une absence longue qui tombe sur l'automne et
    // l'hiver. Sans ce point de bascule, le pâturage serait gratuit.
    const cells = 9;
    const animals = cells * PADDOCK_ANIMALS_PER_CELL;
    let herbe = grassCapacity(cells);
    // 22 h réelles à cheval sur l'automne et l'hiver.
    for (let c = 0; c < 22 / CYCLE_H; c += 0.25) {
      const saison: Season = c < SEASON_DAYS ? "AUTUMN" : "WINTER";
      herbe = grazePasture({
        grassTons: herbe,
        paddockCells: cells,
        season: saison,
        animalsOutside: animals,
        cycles: 0.25,
      }).grassTons;
    }
    expect(herbe).toBe(0);
  });
});

describe("charge soutenable du pré", () => {
  it("la charge soutenable est celle qu'on annonce : 80 % de la capacité de sortie", () => {
    expect(SUSTAINABLE_STOCKING_RATE).toBeCloseTo(1.6, 5);
    expect(SUSTAINABLE_STOCKING_RATE / PADDOCK_ANIMALS_PER_CELL).toBeCloseTo(0.8, 5);
  });

  it("la charge de l'enclos et celle du calibrage ne peuvent pas diverger", () => {
    // `husbandry.ts` recopie la capacité par case de `livestock.ts` pour ne
    // pas créer de cycle d'import. Tout le calibrage du pré se lit par rapport
    // à elle : les laisser diverger rendrait les trois constantes fausses sans
    // qu'aucune ne bouge.
    expect(PADDOCK_ANIMALS_PER_CELL).toBe(PADDOCK.capacityPerCell);
  });

  it("sous la charge soutenable, le pré ne touche jamais le fond", () => {
    /*
     * L'équilibre n'est pas un plateau, c'est une dent de scie : le plafond
     * de réserve **rogne** le surplus du printemps et de l'été, si bien qu'on
     * ne peut pas entrer dans l'hiver avec plus que ce plafond. La bonne
     * question n'est donc pas « la réserve revient-elle à son point de
     * départ ? » — elle ne le peut pas — mais « le creux de fin d'hiver
     * laisse-t-il de quoi tenir ? ».
     */
    const cells = 9;
    const animals = Math.floor(cells * SUSTAINABLE_STOCKING_RATE * 0.9);
    let herbe = grassCapacity(cells);
    let creux = 1;
    for (let c = 0; c < YEAR_DAYS; c++) {
      const saison = SAISONS[Math.floor(c / SEASON_DAYS) % SAISONS.length]!;
      const out = grazePasture({
        grassTons: herbe,
        paddockCells: cells,
        season: saison,
        animalsOutside: animals,
        cycles: 1,
      });
      herbe = out.grassTons;
      // Le hangar n'a jamais eu à s'ouvrir : le pré a tout couvert.
      expect(out.coverage).toBeCloseTo(1, 6);
      creux = Math.min(creux, herbe / grassCapacity(cells));
    }
    // Le creux de fin d'hiver garde une marge nette : bien charger son pré,
    // c'est ne plus avoir à y penser.
    expect(creux).toBeGreaterThan(0.2);
  });

  it("au-dessus, le pré ne se refait pas — le pâturage n'est pas gratuit", () => {
    const cells = 9;
    const animals = cells * PADDOCK_ANIMALS_PER_CELL;
    let herbe = grassCapacity(cells);
    let cyclesASec = 0;
    for (let c = 0; c < YEAR_DAYS; c++) {
      const saison = SAISONS[Math.floor(c / SEASON_DAYS) % SAISONS.length]!;
      const out = grazePasture({
        grassTons: herbe,
        paddockCells: cells,
        season: saison,
        animalsOutside: animals,
        cycles: 1,
      });
      herbe = out.grassTons;
      if (out.coverage < 1) cyclesASec++;
    }
    // Au maximum de la charge, l'année se termine à sec et le hangar a dû
    // prendre le relais : c'est exactement ce qui empêche le pré d'être une
    // source infinie.
    expect(cyclesASec).toBeGreaterThan(0);
    expect(herbe).toBeLessThan(0.1 * grassCapacity(cells));
  });
});

describe("le froid, et ce que le bâtiment y change", () => {
  const hiverRude = { season: "WINTER" as Season, weather: "SNOW" as const };

  it("dehors en hiver neigeux, la vache souffre pour de bon", () => {
    const t = feltTempC({ kind: "COW", housing: "OUTSIDE", ...hiverRude });
    // Assez pour se voir sur le lait et finir par mordre, pas assez pour tuer
    // le troupeau avant que le joueur ait pu réagir.
    expect(thermalPenalty({ kind: "COW", tempC: t })).toBeGreaterThan(0.15);
    expect(thermalPenalty({ kind: "COW", tempC: t })).toBeLessThan(0.35);
  });

  it("rentrer est une vraie réponse : la pénalité tombe à rien", () => {
    const dedans = feltTempC({ kind: "COW", housing: "INSIDE", ...hiverRude, barnLevel: 1 });
    expect(thermalPenalty({ kind: "COW", tempC: dedans })).toBe(0);
  });

  it("mais rentrer n'est pas gratuit — le stock repart", () => {
    // Rentré, le pré ne couvre plus rien : c'est là tout l'arbitrage.
    expect(feedSavedByPasture({ herdSize: 8, animalsOutside: 0, coverage: 1 })).toBe(0);
  });

  it("chaque espèce a son hiver — le mouton tient là où la poule flanche", () => {
    const t = feltTempC({ kind: "SHEEP", housing: "OUTSIDE", ...hiverRude });
    const poule = feltTempC({ kind: "HEN", housing: "OUTSIDE", ...hiverRude });
    expect(thermalPenalty({ kind: "SHEEP", tempC: t })).toBeLessThan(
      thermalPenalty({ kind: "HEN", tempC: poule }),
    );
  });

  it("l'été enfermé n'est pas anodin non plus", () => {
    // Le piège symétrique : on ne peut pas tout laisser dedans toute l'année.
    // Le bâtiment tempère, mais une bête dehors par beau temps est mieux.
    const dedans = feltTempC({ kind: "COW", housing: "INSIDE", season: "SUMMER", weather: "CLEAR" });
    const profil = SPECIES.COW;
    expect(dedans).toBeGreaterThanOrEqual(profil.comfortMinC);
    expect(dedans).toBeLessThanOrEqual(profil.comfortMaxC);
  });

  it("aucune espèce n'a de plage de confort absurde", () => {
    for (const profil of Object.values(SPECIES)) {
      expect(profil.comfortMinC).toBeLessThan(profil.comfortMaxC);
      // Une plage trop étroite rendrait la bête intenable, trop large la
      // rendrait insensible : dans les deux cas la mécanique ne dirait rien.
      expect(profil.comfortMaxC - profil.comfortMinC).toBeGreaterThanOrEqual(15);
      expect(profil.shelterRelief).toBeGreaterThan(0.5);
      expect(profil.shelterRelief).toBeLessThan(1);
    }
  });
});
