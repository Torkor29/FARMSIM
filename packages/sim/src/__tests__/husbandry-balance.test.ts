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
  GRASS_INTAKE_TONS,
  SPECIES,
  feedSavedByPasture,
  feltTempC,
  grassCapacity,
  grazePasture,
  SEASON_DAYS,
  thermalPenalty,
  type Season,
} from "@farmsim/shared";

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

  it("l'hiver vide la réserve — le pré ne se reconstitue plus", () => {
    // Dix cycles d'hiver suffisent à ramener un enclos correctement chargé
    // presque à zéro : le joueur a le temps de voir venir, pas de l'ignorer.
    expect(par("WINTER").herbeFin).toBeLessThan(0.2);
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
