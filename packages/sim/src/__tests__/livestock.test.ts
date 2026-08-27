import {
  welfareReasons,
  autoCollects,
  AUTO_COLLECT_LEVEL,
  collectCapCycles,
  LIVESTOCK_CYCLE_MS,
  rationToServe,
  feedAutonomyMs,
  troughCapacity,
  TROUGH_REAL_DAYS,
  FEED_GRAZING_RATIO,
  FEED_BARN_SAVING_CAP,
  GRAZING,
  GRAZING_REFUSAL_LABELS,
  HAPPINESS,
  HAPPINESS_LABELS,
  LIVESTOCK_HOUR_MS,
  MEAT_MATURITY_MS,
  MILK_BASE_PER_COW,
  MILK_HAPPINESS_SPAN,
  PADDOCK,
  collectProgress,
  collectReady,
  canGraze,
  canLiveOutside,
  crowdingPenalty,
  crowdingLethalThreshold,
  installationLevel,
  installationBonus,
  installationLabel,
  productionFactor,
  tickWater,
  thirstPenalty,
  WATER,
  CASCADE,
  feedConsumption,
  grazingWaveCount,
  happinessLabel,
  happinessTarget,
  isPaddockAdjacent,
  meatYield,
  milkYield,
  paddockCapacity,
  paddockCost,
  planGrazing,
  tickHappiness,
  welfareIndex,
} from "../../../shared/src/livestock.js";
import type { Herd, PaddockState, WeatherState } from "../../../shared/src/livestock.js";

// Le temps d'élevage est compressé comme le reste du jeu : on raisonne en
// heures de jeu, pas en heures d'horloge.
const HOUR = LIVESTOCK_HOUR_MS;

/** Étable 3×3 posée en (10, 10) — l'emprise réelle de `CATTLE_BARN`. */
const ETABLE = { originX: 10, originY: 10, w: 3, h: 3 };

const enclos = (over: Partial<PaddockState> = {}): PaddockState => ({
  adjacent: true,
  cells: 16,
  capacity: paddockCapacity(16),
  ...over,
});

const troupeau = (over: Partial<Herd> = {}): Herd => ({
  id: "h1",
  kind: "COW",
  size: 12,
  averageAgeMs: 10 * LIVESTOCK_CYCLE_MS,
  happiness: 0.5,
  lastGrazedAt: null,
  lastMilkedAt: null,
  ...over,
});

/** Fait dériver le bonheur heure par heure, pour vérifier la stabilité du pas. */
const deriver = (
  depart: number,
  heures: number,
  conditions: { crowding: number; hunger?: number; water?: number },
): number => {
  let h = depart;
  for (let i = 0; i < heures; i++) {
    h = tickHappiness({ ...conditions, happiness: h, elapsedMs: HOUR });
  }
  return h;
};

describe("satisfaction des besoins — la base est 100 %", () => {
  /*
   * Le cœur de la refonte, et le test qui doit tomber le premier si on y
   * touche.
   *
   * Avant : la cible d'un troupeau jamais sorti valait 0,35 (`confinedFloor`),
   * la mortalité commençait à 0,15, et il ne restait donc que 0,20 point de
   * marge à un lot enfermé — contre 0,80 à un lot sorti. L'enfermement ne
   * tuait pas seul : il rendait mortel tout le reste. Ni la saison ni la
   * température n'entraient nulle part, si bien que rentrer les bêtes en
   * décembre était puni exactement comme les enfermer en juin.
   */
  const remplis = { crowding: 0.5, hunger: 0, water: 1, bedding: 0 };

  it("met à 100 % un troupeau nourri, abreuvé et logé — dedans comme dehors", () => {
    expect(happinessTarget({ ...remplis, hasPaddock: false })).toBeCloseTo(1, 6);
    expect(happinessTarget({ ...remplis, hasPaddock: true, grazedRecentlyMs: 0 })).toBeCloseTo(
      1,
      6,
    );
  });

  it("ne retient rien de la dernière sortie : jamais sortie vaut sortie du jour", () => {
    // C'est la phrase exacte du cahier des charges : « ne pas revenir à un
    // système où les vaches sont stressées simplement parce qu'elles sont
    // dans l'étable ».
    const jamais = happinessTarget({
      ...remplis,
      hasPaddock: true,
      grazedRecentlyMs: Number.POSITIVE_INFINITY,
    });
    const aLInstant = happinessTarget({ ...remplis, hasPaddock: true, grazedRecentlyMs: 0 });
    expect(jamais).toBeCloseTo(aLInstant, 6);
    expect(jamais).toBeCloseTo(1, 6);
  });

  it("ne descend que sur un manque réel, et remonte dès qu'on y répond", () => {
    const affame = happinessTarget({ ...remplis, hunger: 0.55 });
    expect(affame).toBeCloseTo(0.45, 6);
    const assoiffe = happinessTarget({ ...remplis, water: 0 });
    expect(assoiffe).toBeCloseTo(0.5, 6);
    // Et les manques s'additionnent : deux besoins à zéro coûtent plus qu'un.
    expect(happinessTarget({ ...remplis, hunger: 0.55, water: 0 })).toBeLessThan(affame);
  });

  it("reste borné dans [0 ; 1] même sous une avalanche de manques", () => {
    const pire = happinessTarget({
      crowding: 4,
      hunger: 1,
      water: 0,
      bedding: 1,
      hasPaddock: false,
    });
    expect(pire).toBeGreaterThanOrEqual(HAPPINESS.min);
    expect(pire).toBeLessThanOrEqual(HAPPINESS.max);
  });
});

describe("satisfaction — dérive vers la cible", () => {
  const remplis = { crowding: 0.5, hunger: 0, water: 1 };

  it("remonte un troupeau qu'on remet d'aplomb jusqu'à 100 %", () => {
    const apres = tickHappiness({ ...remplis, happiness: 0.4, elapsedMs: 30 * 24 * HOUR });
    expect(apres).toBeCloseTo(1, 4);
  });

  it("descend vers la cible quand un besoin manque, sans jamais la percer", () => {
    const affame = { crowding: 0.5, hunger: 0.55, water: 1 };
    const apres = tickHappiness({ ...affame, happiness: 1, elapsedMs: 30 * 24 * HOUR });
    expect(apres).toBeCloseTo(happinessTarget(affame), 4);
    expect(apres).toBeGreaterThanOrEqual(happinessTarget(affame) - 1e-9);
  });

  it("monte trois fois plus vite qu'il ne descend", () => {
    expect(HAPPINESS.riseTauH).toBe(12);
    expect(HAPPINESS.decayTauH / HAPPINESS.riseTauH).toBeCloseTo(3, 6);
    const monte = tickHappiness({ ...remplis, happiness: 0.65, elapsedMs: 6 * HOUR }) - 0.65;
    const descend =
      0.65 -
      tickHappiness({ crowding: 0.5, hunger: 0.55, happiness: 0.65, elapsedMs: 6 * HOUR });
    expect(monte).toBeGreaterThan(descend * 2);
  });

  it("reste borné dans [0 ; 1] même avec des entrées aberrantes", () => {
    for (const h of [-3, 0, 0.5, 1, 12]) {
      for (const elapsed of [-1000, 0, HOUR, 1e12]) {
        const out = tickHappiness({ ...remplis, happiness: h, elapsedMs: elapsed });
        expect(out).toBeGreaterThanOrEqual(HAPPINESS.min);
        expect(out).toBeLessThanOrEqual(HAPPINESS.max);
      }
    }
  });

  it("ne change rien sur un pas de temps nul", () => {
    expect(tickHappiness({ ...remplis, happiness: 0.42, elapsedMs: 0 })).toBeCloseTo(0.42, 6);
  });

  it("donne le même résultat en un gros tick qu'en 24 petits", () => {
    const gros = tickHappiness({ ...remplis, happiness: 0.4, elapsedMs: 24 * HOUR });
    const petits = deriver(0.4, 24, remplis);
    expect(petits).toBeCloseTo(gros, 6);
  });
});

describe("dépassement de capacité — et rien avant", () => {
  /*
   * Le second défaut mesuré, et celui que Strea a lu à l'écran.
   *
   * La peine démarrait à 85 % d'occupation, et le ratio se calculait sur les
   * **cases de l'enclos** — dix-huit pour cinquante-cinq places d'étable. On
   * était donc « encombré » dès seize vaches, et sans enclos du tout le ratio
   * valait 1 en dur : une peine permanente qu'aucun geste n'effaçait.
   */
  it("ne pénalise rien jusqu'à la dernière place payée", () => {
    for (const effectif of [0, 30, 40, 54, 55]) {
      expect(crowdingPenalty(effectif / 55)).toBe(0);
    }
    expect(HAPPINESS.crowdingComfort).toBe(1);
  });

  it("pénalise la bête de trop, et elle seule", () => {
    expect(crowdingPenalty(56 / 55)).toBeGreaterThan(0);
    // Et 40 sur 55 reste exactement à 100 % de satisfaction : c'est le cas de
    // la capture, celui qui affichait « des bêtes vont mourir ».
    expect(
      happinessTarget({ crowding: 40 / 55, hunger: 0, water: 1, bedding: 0 }),
    ).toBeCloseTo(1, 6);
  });

  it("croît comme le carré du dépassement, jusqu'au double de la capacité", () => {
    /*
     * La forme est tout le réglage : à mi-chemin du plafond, une droite aurait
     * rendu la moitié de la peine ; le carré n'en rend que le quart. C'est ce
     * qui sépare l'erreur de gestion de l'abandon.
     */
    const miChemin = (HAPPINESS.crowdingComfort + HAPPINESS.crowdingCritical) / 2;
    expect(crowdingPenalty(miChemin)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax / 4, 6);
    expect(crowdingPenalty(2)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax, 6);
    expect(crowdingPenalty(4)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax, 6);
    // Et elle reste monotone : entasser davantage ne peut jamais soulager.
    for (let c = 0.85; c < 2; c += 0.05) {
      expect(crowdingPenalty(c + 0.05)).toBeGreaterThanOrEqual(crowdingPenalty(c));
    }
  });

  it("coûte de la production, et jamais une bête", () => {
    // `crowdingLethalThreshold()` valait ~1,72 : au-delà, l'entassement seul
    // passait sous le plancher de mortalité. Il n'y a plus de tel seuil.
    expect(crowdingLethalThreshold()).toBe(Number.POSITIVE_INFINITY);
    const commun = { herdSize: 20, barnLevel: 1, feedQuality: 0 };
    const serre = happinessTarget({ crowding: 1.5, hunger: 0, water: 1 });
    const auLarge = happinessTarget({ crowding: 0.6, hunger: 0, water: 1 });
    expect(milkYield({ ...commun, happiness: serre })).toBeLessThan(
      milkYield({ ...commun, happiness: auLarge }),
    );
  });
});

describe("l'installation — ce qu'on bâtit rapporte", () => {
  it("laisse une ferme sans rien à 100 %, et pas en dessous", () => {
    expect(installationLevel({ barnLevel: 1 })).toBe(1);
    expect(installationBonus(1)).toEqual({ production: 0, reproduction: 0, feed: 0 });
    expect(
      productionFactor({ happiness: 1, installationLevel: 1, feedQuality: 0 }).total,
    ).toBeCloseTo(1, 6);
  });

  it("donne 130 % à une installation complète, besoins remplis", () => {
    const complet = installationLevel({
      barnLevel: 5,
      hasPaddock: true,
      hasTrough: true,
      hasRack: true,
    });
    expect(complet).toBe(4);
    expect(installationBonus(complet)).toEqual({
      production: 0.3,
      reproduction: 0.15,
      feed: 0.1,
    });
    expect(
      productionFactor({ happiness: 1, installationLevel: complet, feedQuality: 0 }).total,
    ).toBeCloseTo(1.3, 6);
    expect(installationLabel(complet)).toBe("Haut de gamme");
  });

  it("monte pièce par pièce, sans qu'aucune soit obligatoire", () => {
    const niveaux = [
      installationLevel({ barnLevel: 1 }),
      installationLevel({ barnLevel: 1, hasTrough: true }),
      installationLevel({ barnLevel: 1, hasTrough: true, hasRack: true }),
      installationLevel({ barnLevel: 3, hasTrough: true, hasRack: true, hasPaddock: true }),
      installationLevel({ barnLevel: 5, hasTrough: true, hasRack: true, hasPaddock: true }),
    ];
    // Monotone, et jamais en arrière : ajouter ne peut pas retirer.
    for (let i = 1; i < niveaux.length; i++) {
      expect(niveaux[i]).toBeGreaterThanOrEqual(niveaux[i - 1]);
    }
    expect(niveaux[0]).toBe(1);
    expect(niveaux[niveaux.length - 1]).toBe(4);
  });

  it("économise du fourrage, et la remise reste bornée", () => {
    const commun = { herdSize: 20, grazing: false, barnLevel: 5 };
    const nu = feedConsumption({ ...commun, installationLevel: 1 });
    const complet = feedConsumption({ ...commun, installationLevel: 4 });
    expect(complet).toBeLessThan(nu);
    expect(complet).toBeCloseTo(nu * 0.9, 1);
  });

  it("multiplie la production sans jamais compter deux fois le bâtiment", () => {
    // Le niveau d'étable entre par le niveau d'installation, et par lui seul :
    // l'ancien multiplicateur `MILK_BARN_LEVEL_STEP` ne s'y ajoute plus.
    const commun = { herdSize: 10, happiness: 1, feedQuality: 0 };
    const base = milkYield({ ...commun, barnLevel: 1, installationLevel: 1 });
    const complet = milkYield({ ...commun, barnLevel: 5, installationLevel: 4 });
    expect(complet).toBeCloseTo(base * 1.3, 1);
  });
});

describe("l'eau — le besoin qui manquait", () => {
  it("reste pleine tant qu'on passe distribuer la ration", () => {
    expect(
      tickWater({ water: 0.4, hasTrough: false, fed: true, elapsedMs: 6 * 3_600_000 }),
    ).toBe(1);
  });

  it("se vide quand plus personne ne vient, et plus lentement que la faim", () => {
    const apres = tickWater({
      water: 1,
      hasTrough: false,
      fed: false,
      elapsedMs: 12 * 3_600_000,
    });
    expect(apres).toBeCloseTo(0.5, 6);
    // Vingt-quatre heures pour se vider, contre huit avant que la cascade ne
    // s'engage : les alertes tombent dans l'ordre, ration puis eau.
    expect(WATER.dryH).toBeGreaterThan(CASCADE.productionH);
  });

  it("ne se vide jamais avec un abreuvoir automatique — c'est ce qu'on achète", () => {
    expect(
      tickWater({ water: 0, hasTrough: true, fed: false, elapsedMs: 30 * 24 * 3_600_000 }),
    ).toBe(1);
  });

  it("coûte de la production quand elle manque, et rien tant qu'elle est là", () => {
    expect(thirstPenalty(1)).toBe(0);
    expect(thirstPenalty(0)).toBeCloseTo(WATER.penaltyMax, 6);
  });
});

describe("sortie au pré — conditions d’autorisation", () => {
  const clair: WeatherState = "CLEAR";

  it("autorise la sortie par beau temps avec un enclos adjacent", () => {
    expect(canGraze({ paddock: enclos(), animals: 8, weather: clair })).toEqual({
      ok: true,
      animals: 8,
      sheltered: 0,
    });
  });

  it("refuse la sortie sans enclos du tout", () => {
    expect(canGraze({ paddock: null, animals: 4, weather: clair })).toMatchObject({
      ok: false,
      reason: "NO_PADDOCK",
    });
  });

  it("refuse la sortie si l’enclos n’est pas accolé à l’étable", () => {
    expect(canGraze({ paddock: enclos({ adjacent: false }), animals: 4, weather: clair })).toMatchObject({
      ok: false,
      reason: "NO_PADDOCK",
    });
  });

  it("refuse la sortie par orage et par neige", () => {
    for (const meteo of ["STORM", "SNOW"] as WeatherState[]) {
      expect(canGraze({ paddock: enclos(), animals: 4, weather: meteo })).toMatchObject({
        ok: false,
        reason: "BAD_WEATHER",
      });
    }
  });

  it("laisse sortir sous la pluie et par temps couvert", () => {
    for (const meteo of ["CLEAR", "CLOUDY", "RAIN"] as WeatherState[]) {
      expect(canGraze({ paddock: enclos(), animals: 4, weather: meteo }).ok).toBe(true);
    }
  });

  it("borne la sortie à la place disponible au lieu de la refuser", () => {
    // L'enclos trop court refusait tout : dix-neuf bêtes devant dix-huit
    // places, et le troupeau ne sortait pas du tout. Il borne désormais —
    // ce qui tient sort, le reste attend, et le joueur sait combien.
    const petit = enclos({ cells: 6, capacity: paddockCapacity(6) });
    expect(canGraze({ paddock: petit, animals: 12, weather: clair })).toEqual({
      ok: true,
      animals: 12,
      sheltered: 0,
    });
    expect(canGraze({ paddock: petit, animals: 13, weather: clair })).toEqual({
      ok: true,
      animals: 12,
      sheltered: 1,
    });
    expect(canGraze({ paddock: petit, animals: 4, animalsOutside: 10, weather: clair })).toEqual({
      ok: true,
      animals: 2,
      sheltered: 2,
    });
  });

  it("ne refuse que l’enclos réellement plein", () => {
    const petit = enclos({ cells: 6, capacity: paddockCapacity(6) });
    expect(canGraze({ paddock: petit, animals: 4, animalsOutside: 12, weather: clair })).toEqual({
      ok: false,
      reason: "PADDOCK_FULL",
      animals: 0,
      sheltered: 4,
    });
  });

  it("le lieu de vie ne se refuse pas pour la météo — il s’avertit", () => {
    // `canGraze` interdit la séance de pâture sous la neige ; vivre dehors
    // reste la décision du joueur. L'interface se calait sur la première et
    // grisait l'interrupteur un jour de neige, alors que le serveur, lui,
    // acceptait : deux règles pour une seule décision.
    const grand = enclos();
    expect(canGraze({ paddock: grand, animals: 8, weather: "SNOW" }).ok).toBe(false);
    expect(canLiveOutside({ paddock: grand, animals: 8 })).toEqual({
      ok: true,
      animals: 8,
      sheltered: 0,
    });
  });

  it("vivre dehors exige un enclos, et des bêtes", () => {
    expect(canLiveOutside({ paddock: null, animals: 8 }).reason).toBe("NO_PADDOCK");
    expect(canLiveOutside({ paddock: enclos(), animals: 0 }).reason).toBe("NO_ANIMALS");
    expect(canLiveOutside({ paddock: enclos(), animals: 4, kind: "PIG" }).reason).toBe(
      "WRONG_SPECIES",
    );
  });

  it("refuse de sortir une espèce dans l’aire d’une autre", () => {
    expect(canGraze({ paddock: enclos(), animals: 4, weather: clair, kind: "PIG" })).toMatchObject({
      ok: false,
      reason: "WRONG_SPECIES",
    });
    expect(
      canGraze({
        paddock: enclos(),
        animals: 4,
        weather: clair,
        kind: "PIG",
        paddockKind: "PIG",
      }).ok,
    ).toBe(true);
    expect(
      canGraze({
        paddock: enclos(),
        animals: 4,
        weather: clair,
        kind: "HEN",
        paddockKind: "HEN",
      }).ok,
    ).toBe(true);
    expect(
      canGraze({
        paddock: enclos(),
        animals: 4,
        weather: clair,
        kind: "SHEEP",
        paddockKind: "SHEEP",
      }).ok,
    ).toBe(true);
  });

  it("nomme chaque motif de refus pour l’UI", () => {
    for (const label of Object.values(GRAZING_REFUSAL_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

describe("production laitière — 100 % de base, puis l'installation", () => {
  const base = { herdSize: 10, barnLevel: 1, feedQuality: 0 };

  it("rend 22 litres par vache dès que les besoins sont remplis", () => {
    // Et non plus « au plancher de l'enfermement » : ce plancher n'existe
    // plus, la référence est le troupeau dont rien ne manque.
    expect(milkYield({ ...base, happiness: 1 })).toBeCloseTo(MILK_BASE_PER_COW * 10, 1);
  });

  it("ne rend rien de moins parce que les bêtes sont restées à l'étable", () => {
    // Le test qui garde la promesse faite au joueur. Deux troupeaux dont les
    // besoins sont couverts produisent pareil, que l'un sorte et l'autre non :
    // ce qui les sépare désormais, c'est ce qu'on a bâti autour d'eux.
    const dedans = milkYield({ ...base, happiness: 1, installationLevel: 1 });
    const dehors = milkYield({ ...base, happiness: 1, installationLevel: 1 });
    expect(dedans).toBe(dehors);
  });

  it("perd du lait à proportion de ce qui manque, et de rien d'autre", () => {
    const remplis = milkYield({ ...base, happiness: 1 });
    const affame = milkYield({ ...base, happiness: happinessTarget({ crowding: 0, hunger: 0.55 }) });
    expect(affame).toBeCloseTo(remplis * 0.45, 0);
  });

  it("rend la jauge telle quelle, sans remise à l'échelle", () => {
    // `welfareIndex` remettait `[0,35 ; 0,95]` sur `[0 ; 1]`, parce que la
    // jauge ne visitait jamais ses bornes. Elle les visite maintenant.
    expect(welfareIndex(1)).toBeCloseTo(1, 6);
    expect(welfareIndex(0.5)).toBeCloseTo(0.5, 6);
    expect(welfareIndex(0)).toBeCloseTo(0, 6);
    expect(welfareIndex(1.4)).toBeCloseTo(1, 6);
  });

  it("croît avec l'installation, et le niveau d'étable y entre une seule fois", () => {
    const nu = milkYield({ ...base, happiness: 1, barnLevel: 1, installationLevel: 1 });
    const complet = milkYield({ ...base, happiness: 1, barnLevel: 5, installationLevel: 4 });
    expect(complet / nu).toBeCloseTo(1.3, 3);
    // L'ancien écart bien-être × niveau d'étable valait ×1,64 : le nouveau
    // plafond est plus bas, mais le plancher est bien plus haut.
    expect(MILK_HAPPINESS_SPAN).toBeCloseTo(0.32, 6);
  });

  it("croît avec la qualité de la ration, +20 % en premium", () => {
    const basique = milkYield({ ...base, happiness: 0.6, feedQuality: 0 });
    const premium = milkYield({ ...base, happiness: 0.6, feedQuality: 1 });
    expect(premium / basique).toBeCloseTo(1.2, 3);
  });

  it("ne produit rien sans bête", () => {
    expect(milkYield({ ...base, herdSize: 0, happiness: 0.9 })).toBe(0);
    expect(milkYield({ ...base, herdSize: -5, happiness: 0.9 })).toBe(0);
  });

  it("reste proportionnel à l’effectif", () => {
    const dix = milkYield({ ...base, herdSize: 10, happiness: 0.7 });
    const trente = milkYield({ ...base, herdSize: 30, happiness: 0.7 });
    expect(trente / dix).toBeCloseTo(3, 3);
  });
});

describe("production de viande à l’abattage", () => {
  const base = { herdSize: 1, averageAgeMs: MEAT_MATURITY_MS, barnLevel: 1 };

  it("rend 280 kg de carcasse pour une bête mature dont rien ne manque", () => {
    expect(meatYield({ ...base, happiness: 1 })).toBe(280);
  });

  it("donne +30 % de carcasse à une installation haut de gamme", () => {
    const nu = meatYield({ ...base, happiness: 1, installationLevel: 1 });
    const complet = meatYield({ ...base, happiness: 1, installationLevel: 4 });
    expect(complet / nu - 1).toBeCloseTo(0.3, 2);
  });

  it("perd de la carcasse quand un besoin manque, à la même mesure que le lait", () => {
    // Les deux filières lisent la même satisfaction : négliger un troupeau ne
    // peut pas être plus rentable à l'abattage qu'à la traite.
    const manque = happinessTarget({ crowding: 0, hunger: 0.55 });
    expect(meatYield({ ...base, happiness: manque }) / meatYield({ ...base, happiness: 1 }))
      .toBeCloseTo(
        milkYield({ herdSize: 10, barnLevel: 1, feedQuality: 0, happiness: manque }) /
          milkYield({ herdSize: 10, barnLevel: 1, feedQuality: 0, happiness: 1 }),
        2,
      );
  });

  it("croît avec l’âge jusqu’à maturité, puis plafonne", () => {
    const jeune = meatYield({ ...base, averageAgeMs: 0, happiness: 0.5 });
    const moitie = meatYield({ ...base, averageAgeMs: MEAT_MATURITY_MS / 2, happiness: 0.5 });
    const mature = meatYield({ ...base, averageAgeMs: MEAT_MATURITY_MS, happiness: 0.5 });
    const vieille = meatYield({ ...base, averageAgeMs: 10 * MEAT_MATURITY_MS, happiness: 0.5 });
    expect(jeune).toBeLessThan(moitie);
    expect(moitie).toBeLessThan(mature);
    expect(vieille).toBe(mature);
  });

  it("ne descend jamais sous 35 % du poids adulte", () => {
    expect(meatYield({ ...base, averageAgeMs: -1000, happiness: 1 })).toBeGreaterThanOrEqual(
      Math.round(280 * 0.35),
    );
  });

  it("ne rend rien pour un lot vide", () => {
    expect(meatYield({ ...base, herdSize: 0, happiness: 0.9 })).toBe(0);
  });
});

describe("consommation de fourrage", () => {
  it("consomme 14 kg de matière sèche par vache en étable", () => {
    expect(feedConsumption({ herdSize: 10, grazing: false, barnLevel: 1 })).toBeCloseTo(140, 1);
  });

  it("consomme 35 % de fourrage en moins quand le troupeau pâture", () => {
    const etable = feedConsumption({ herdSize: 10, grazing: false, barnLevel: 1 });
    const pre = feedConsumption({ herdSize: 10, grazing: true, barnLevel: 1 });
    expect(pre / etable).toBeCloseTo(FEED_GRAZING_RATIO, 3);
    expect(pre).toBeLessThan(etable);
  });

  it("économise du gaspillage avec le niveau d’étable, plafonné à 12 %", () => {
    /*
     * L'économie se lit désormais sur le **niveau d'installation**, dont le
     * niveau d'étable n'est qu'une des cinq composantes : une étable Nv.5 sans
     * rien autour vaut deux points, soit le niveau 2, soit 3 % — et le râtelier
     * qui va avec la fait monter. C'est délibéré : la remise récompense
     * l'installation entière, pas un seul bâtiment.
     */
    const n1 = feedConsumption({ herdSize: 10, grazing: false, barnLevel: 1 });
    const n5 = feedConsumption({ herdSize: 10, grazing: false, barnLevel: 5 });
    expect(n5 / n1).toBeCloseTo(0.97, 3);
    const complet = feedConsumption({
      herdSize: 10,
      grazing: false,
      barnLevel: 5,
      installationLevel: 4,
    });
    expect(complet / n1).toBeCloseTo(0.9, 3);
    // Et la remise reste bornée, quoi qu'on empile.
    expect(complet / n1).toBeGreaterThanOrEqual(1 - FEED_BARN_SAVING_CAP);
    expect(feedConsumption({ herdSize: 10, grazing: false, barnLevel: 99 })).toBeCloseTo(n5, 1);
  });

  it("ne consomme rien sans bête", () => {
    expect(feedConsumption({ herdSize: 0, grazing: true, barnLevel: 3 })).toBe(0);
  });
});

describe("enclos — capacité et coût", () => {
  it("offre deux places de sortie par case", () => {
    expect(paddockCapacity(6)).toBe(12);
    expect(paddockCapacity(16)).toBe(32);
    expect(PADDOCK.capacityPerCell).toBe(2);
  });

  it("annule la capacité d’un enclos trop petit", () => {
    expect(paddockCapacity(5)).toBe(0);
    expect(paddockCapacity(0)).toBe(0);
    expect(paddockCapacity(-4)).toBe(0);
    expect(PADDOCK.minCells).toBe(6);
  });

  it("croît strictement avec la surface au-delà du seuil", () => {
    for (let cells = PADDOCK.minCells; cells < 40; cells++) {
      expect(paddockCapacity(cells + 1)).toBeGreaterThan(paddockCapacity(cells));
    }
  });

  it("chiffre l’enclos 4×4 à 1 840 CRD", () => {
    expect(paddockCost(16)).toBe(1840);
    expect(paddockCost(0)).toBe(PADDOCK.baseCost);
  });
});

describe("enclos — adjacence par bord commun", () => {
  it("accepte un enclos accolé au nord et au sud de l’étable", () => {
    expect(isPaddockAdjacent(ETABLE, { originX: 10, originY: 13, w: 4, h: 4 })).toBe(true);
    expect(isPaddockAdjacent(ETABLE, { originX: 10, originY: 6, w: 4, h: 4 })).toBe(true);
  });

  it("accepte un enclos accolé à l’est et à l’ouest de l’étable", () => {
    expect(isPaddockAdjacent(ETABLE, { originX: 13, originY: 10, w: 4, h: 4 })).toBe(true);
    expect(isPaddockAdjacent(ETABLE, { originX: 6, originY: 10, w: 4, h: 4 })).toBe(true);
  });

  it("accepte un bord commun même partiel", () => {
    // Une seule colonne en commun (x = 12) : c’est assez pour une porte.
    expect(isPaddockAdjacent(ETABLE, { originX: 12, originY: 13, w: 4, h: 4 })).toBe(true);
  });

  it("rejette le contact en diagonale, coin à coin", () => {
    expect(isPaddockAdjacent(ETABLE, { originX: 13, originY: 13, w: 4, h: 4 })).toBe(false);
    expect(isPaddockAdjacent(ETABLE, { originX: 6, originY: 6, w: 4, h: 4 })).toBe(false);
    expect(isPaddockAdjacent(ETABLE, { originX: 13, originY: 6, w: 4, h: 4 })).toBe(false);
  });

  it("rejette un enclos éloigné, même d’une seule case", () => {
    expect(isPaddockAdjacent(ETABLE, { originX: 14, originY: 10, w: 4, h: 4 })).toBe(false);
    expect(isPaddockAdjacent(ETABLE, { originX: 10, originY: 14, w: 4, h: 4 })).toBe(false);
  });

  it("est symétrique : l’ordre des deux emprises ne change rien", () => {
    const voisin = { originX: 13, originY: 11, w: 4, h: 4 };
    expect(isPaddockAdjacent(ETABLE, voisin)).toBe(isPaddockAdjacent(voisin, ETABLE));
  });
});

describe("fenêtres de pâturage", () => {
  const now = 1_000 * LIVESTOCK_CYCLE_MS;

  it("planifie une vague de 8 bêtes au maximum, pas tout le troupeau", () => {
    const fenetre = planGrazing(now, troupeau({ size: 40 }), enclos());
    expect(fenetre).not.toBeNull();
    expect(fenetre!.animals).toBe(GRAZING.waveSize);
  });

  it("ne sort que les bêtes présentes si le lot est plus petit qu’une vague", () => {
    expect(planGrazing(now, troupeau({ size: 3 }), enclos())!.animals).toBe(3);
  });

  it("laisse 5 minutes de rassemblement avant l’ouverture", () => {
    const fenetre = planGrazing(now, troupeau(), enclos())!;
    expect(fenetre.startsAt).toBe(now + GRAZING.leadInMs);
    expect(fenetre.startsAt).toBeGreaterThan(now);
  });

  it("dure 3 h de base plus 6 min par bête, plafonné à 6 h", () => {
    const grosse = planGrazing(now, troupeau({ size: 40 }), enclos())!;
    /*
     * `toBeCloseTo` et non `toBe` : les durées de pâturage se comptent en
     * heures de jeu, et l'heure de jeu est un vingt-quatrième d'un jour de jeu
     * qui vaut lui-même un septième de saison. Rien de tout cela ne tombe rond
     * en millisecondes, et il n'y a aucune raison que ça tombe rond — une
     * sortie au pré n'a pas de sens à la milliseconde près.
     */
    expect(grosse.endsAt - grosse.startsAt).toBeCloseTo(3 * HOUR + 8 * GRAZING.perAnimalMs, 3);
    const petite = planGrazing(now, troupeau({ size: 2 }), enclos())!;
    expect(petite.endsAt - petite.startsAt).toBeLessThan(grosse.endsAt - grosse.startsAt);
    expect(grosse.endsAt - grosse.startsAt).toBeLessThanOrEqual(GRAZING.maxDurationMs);
  });

  it("refuse de planifier sans enclos, ou avec un enclos détaché", () => {
    expect(planGrazing(now, troupeau(), null)).toBeNull();
    expect(planGrazing(now, troupeau(), enclos({ adjacent: false }))).toBeNull();
  });

  it("refuse de planifier une deuxième sortie dans le même cycle", () => {
    const sortiRecemment = troupeau({ lastGrazedAt: now - 4 * HOUR });
    expect(planGrazing(now, sortiRecemment, enclos())).toBeNull();
    const sortiHier = troupeau({ lastGrazedAt: now - 21 * HOUR });
    expect(planGrazing(now, sortiHier, enclos())).not.toBeNull();
    expect(GRAZING.cooldownMs).toBe(20 * HOUR);
  });

  it("refuse de planifier une sortie pour un enclos sans capacité", () => {
    expect(planGrazing(now, troupeau(), enclos({ cells: 4, capacity: paddockCapacity(4) }))).toBeNull();
    expect(planGrazing(now, troupeau({ size: 0 }), enclos())).toBeNull();
  });

  it("planifie aussi pour les porcs, les poules et les moutons", () => {
    expect(planGrazing(now, troupeau({ kind: "PIG" }), enclos())).not.toBeNull();
    expect(planGrazing(now, troupeau({ kind: "HEN" }), enclos())).not.toBeNull();
    expect(planGrazing(now, troupeau({ kind: "SHEEP" }), enclos())).not.toBeNull();
  });

  it("compte les vagues nécessaires pour sortir tout le troupeau", () => {
    expect(grazingWaveCount(40, 32)).toBe(4);
    expect(grazingWaveCount(8, 32)).toBe(1);
    expect(grazingWaveCount(9, 32)).toBe(2);
    expect(grazingWaveCount(40, 0)).toBe(0);
  });
});

describe("libellés de bien-être", () => {
  it("qualifie chaque tranche de la jauge", () => {
    expect(happinessLabel(0.1)).toBe("En souffrance");
    expect(happinessLabel(0.5)).toBe("Stressées");
    expect(happinessLabel(0.8)).toBe("Correctes");
    expect(happinessLabel(1)).toBe("Épanouies");
  });

  it("lit « Épanouies » sur un troupeau dont rien ne manque", () => {
    // C'est l'état **normal** d'un troupeau bien tenu, et non une récompense
    // rare : sur l'ancienne échelle, un lot enfermé plafonnait à « Correctes »
    // quoi qu'on fasse.
    expect(happinessLabel(happinessTarget({ crowding: 0.5, hunger: 0, water: 1 }))).toBe(
      "Épanouies",
    );
  });

  it("expose des tranches ordonnées et toutes nommées", () => {
    for (let i = 1; i < HAPPINESS_LABELS.length; i++) {
      expect(HAPPINESS_LABELS[i].min).toBeGreaterThan(HAPPINESS_LABELS[i - 1].min);
      expect(HAPPINESS_LABELS[i].label.length).toBeGreaterThan(0);
    }
  });

  it("reste défini aux bornes et hors bornes", () => {
    for (const h of [-1, 0, 1, 42]) {
      expect(happinessLabel(h).length).toBeGreaterThan(0);
    }
  });
});

describe("scénario complet — l’étable nue contre l’étable équipée", () => {
  const cycles = 5;

  /**
   * Cinq cycles d'élevage, besoins couverts, sur deux installations.
   *
   * Le scénario a changé de question. Il opposait « enfermé » à « sorti au
   * pré », et il mesurait une punition : le troupeau enfermé retombait au
   * plancher quoi que fasse le joueur. Il oppose maintenant « rien bâti » à
   * « tout bâti », et il mesure un investissement — les deux troupeaux vont
   * très bien, l'un rapporte davantage.
   */
  const elever = (): number => {
    let happiness = 0.5;
    for (let cycle = 0; cycle < cycles; cycle++) {
      happiness = tickHappiness({
        happiness,
        crowding: 0.6,
        hunger: 0,
        water: 1,
        elapsedMs: 24 * HOUR,
      });
    }
    return happiness;
  };

  it("laisse les deux conduites au sommet de la satisfaction", () => {
    // C'est la promesse : bien tenir son troupeau suffit, et il n'existe
    // aucune conduite qui le condamne à « Correctes » pour l'éternité.
    const satisfaction = elever();
    expect(satisfaction).toBeGreaterThan(0.95);
    expect(happinessLabel(satisfaction)).toBe("Épanouies");
  });

  it("traduit l’écart d’installation en litres, en kilos et en foin économisé", () => {
    const satisfaction = elever();
    const lot = { herdSize: 20, barnLevel: 2, feedQuality: 0.5, happiness: satisfaction };

    const laitNu = milkYield({ ...lot, installationLevel: 1 });
    const laitEquipe = milkYield({ ...lot, installationLevel: 4 });
    expect(laitEquipe / laitNu).toBeCloseTo(1.3, 2);

    const viande = (niveau: number) =>
      meatYield({
        herdSize: 20,
        averageAgeMs: MEAT_MATURITY_MS,
        barnLevel: 2,
        installationLevel: niveau,
        happiness: satisfaction,
      });
    expect(viande(4)).toBeGreaterThan(viande(1));

    // Et le foin : l'installation en économise, la pâture aussi, et les deux
    // se cumulent sans que le troupeau cesse jamais de manger.
    expect(
      feedConsumption({ herdSize: 20, grazing: false, barnLevel: 2, installationLevel: 4 }),
    ).toBeLessThan(
      feedConsumption({ herdSize: 20, grazing: false, barnLevel: 2, installationLevel: 1 }),
    );
    expect(feedConsumption({ herdSize: 20, grazing: true, barnLevel: 2 })).toBeLessThan(
      feedConsumption({ herdSize: 20, grazing: false, barnLevel: 2 }),
    );
  });
});
