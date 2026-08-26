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
  conditions: { hasPaddock: boolean; grazedRecentlyMs: number; crowding: number },
): number => {
  let h = depart;
  for (let i = 0; i < heures; i++) {
    h = tickHappiness({ ...conditions, happiness: h, elapsedMs: HOUR });
  }
  return h;
};

describe("bonheur — dérive à la baisse (étable fermée)", () => {
  const enferme = { hasPaddock: false, grazedRecentlyMs: Number.POSITIVE_INFINITY, crowding: 0.5 };

  it("fait décroître le bonheur d’un troupeau qui ne sort jamais", () => {
    const apres = tickHappiness({ ...enferme, happiness: 0.9, elapsedMs: 24 * HOUR });
    expect(apres).toBeLessThan(0.9);
    expect(apres).toBeGreaterThan(HAPPINESS.confinedFloor);
  });

  it("décroît lentement : il reste du bonheur après une journée d’oubli", () => {
    // τ = 36 h ⇒ à 24 h on n’a comblé qu’environ la moitié de l’écart.
    const apres = tickHappiness({ ...enferme, happiness: 0.95, elapsedMs: 24 * HOUR });
    expect(apres).toBeGreaterThan(0.6);
    expect(HAPPINESS.decayTauH).toBe(36);
  });

  it("s’arrête au plancher de 0,35 et n’en descend pas", () => {
    const apres = tickHappiness({ ...enferme, happiness: 0.95, elapsedMs: 30 * 24 * HOUR });
    expect(apres).toBeCloseTo(HAPPINESS.confinedFloor, 4);
    expect(apres).toBeGreaterThanOrEqual(HAPPINESS.confinedFloor);
    expect(HAPPINESS.confinedFloor).toBeCloseTo(0.35, 6);
  });

  it("remonte un troupeau enfermé sous le plancher jusqu’au plancher", () => {
    const apres = tickHappiness({ ...enferme, happiness: 0.1, elapsedMs: 48 * HOUR });
    expect(apres).toBeGreaterThan(0.1);
    expect(apres).toBeLessThanOrEqual(HAPPINESS.confinedFloor);
  });

  it("ignore un enclos posé loin de l’étable, comme s’il n’existait pas", () => {
    const detache = tickHappiness({
      happiness: 0.5,
      hasPaddock: false,
      grazedRecentlyMs: 0,
      crowding: 0.2,
      elapsedMs: 12 * HOUR,
    });
    expect(detache).toBeLessThan(0.5);
  });
});

describe("bonheur — dérive à la hausse (sorties au pré)", () => {
  const auPre = { hasPaddock: true, grazedRecentlyMs: 0, crowding: 0.5 };

  it("fait monter le bonheur dès la première sortie", () => {
    const apres = tickHappiness({ ...auPre, happiness: 0.35, elapsedMs: 12 * HOUR });
    expect(apres).toBeGreaterThan(0.35);
  });

  it("monte trois fois plus vite qu’il ne descend", () => {
    expect(HAPPINESS.riseTauH).toBe(12);
    expect(HAPPINESS.decayTauH / HAPPINESS.riseTauH).toBeCloseTo(3, 6);
    const monte = tickHappiness({ ...auPre, happiness: 0.65, elapsedMs: 6 * HOUR }) - 0.65;
    const descend =
      0.65 -
      tickHappiness({
        happiness: 0.65,
        hasPaddock: false,
        grazedRecentlyMs: Number.POSITIVE_INFINITY,
        crowding: 0.5,
        elapsedMs: 6 * HOUR,
      });
    expect(monte).toBeGreaterThan(descend * 2);
  });

  it("plafonne à 0,95 et ne le dépasse jamais", () => {
    const apres = tickHappiness({ ...auPre, happiness: 0.9, elapsedMs: 30 * 24 * HOUR });
    expect(apres).toBeCloseTo(HAPPINESS.grazedCeiling, 4);
    expect(apres).toBeLessThanOrEqual(HAPPINESS.grazedCeiling);
  });

  it("reste borné dans [0 ; 1] même avec des entrées aberrantes", () => {
    for (const h of [-3, 0, 0.5, 1, 12]) {
      for (const elapsed of [-1000, 0, HOUR, 1e12]) {
        const out = tickHappiness({ ...auPre, happiness: h, elapsedMs: elapsed });
        expect(out).toBeGreaterThanOrEqual(HAPPINESS.min);
        expect(out).toBeLessThanOrEqual(HAPPINESS.max);
      }
    }
  });

  it("ne change rien sur un pas de temps nul", () => {
    expect(tickHappiness({ ...auPre, happiness: 0.42, elapsedMs: 0 })).toBeCloseTo(0.42, 6);
  });

  it("donne le même résultat en un gros tick qu’en 24 petits", () => {
    const gros = tickHappiness({ ...auPre, happiness: 0.4, elapsedMs: 24 * HOUR });
    const petits = deriver(0.4, 24, auPre);
    expect(petits).toBeCloseTo(gros, 6);
  });

  it("oublie la sortie au-delà de 48 h : la cible retombe au plancher", () => {
    expect(happinessTarget({ hasPaddock: true, grazedRecentlyMs: 0, crowding: 0 })).toBeCloseTo(
      HAPPINESS.grazedCeiling,
      6,
    );
    expect(
      happinessTarget({ hasPaddock: true, grazedRecentlyMs: 24 * HOUR, crowding: 0 }),
    ).toBeCloseTo(0.65, 6);
    expect(
      happinessTarget({ hasPaddock: true, grazedRecentlyMs: 72 * HOUR, crowding: 0 }),
    ).toBeCloseTo(HAPPINESS.confinedFloor, 6);
    expect(HAPPINESS.grazeMemoryMs).toBe(48 * HOUR);
  });
});

describe("bonheur — surpeuplement", () => {
  it("ne pénalise pas un enclos rempli jusqu’à 85 %", () => {
    expect(crowdingPenalty(0)).toBe(0);
    expect(crowdingPenalty(0.85)).toBe(0);
  });

  it("pénalise dès que l’enclos déborde, jusqu’à −0,35 point au double", () => {
    expect(crowdingPenalty(1)).toBeGreaterThan(0);
    // Le maximum est désormais atteint à **deux fois** la place, plus à une
    // fois et demie : au-delà de 150 %, entasser continue de coûter.
    expect(crowdingPenalty(1.5)).toBeLessThan(HAPPINESS.crowdingPenaltyMax);
    expect(crowdingPenalty(2)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax, 6);
    expect(crowdingPenalty(4)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax, 6);
  });

  it("croît comme le carré du dépassement, pas comme une droite", () => {
    /*
     * La forme est tout le réglage : à mi-chemin du plafond d'occupation, une
     * droite aurait rendu la moitié de la peine ; le carré n'en rend que le
     * quart. C'est ce qui sépare l'erreur de gestion de l'abandon.
     */
    const miChemin = (HAPPINESS.crowdingComfort + HAPPINESS.crowdingCritical) / 2;
    expect(crowdingPenalty(miChemin)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax / 4, 6);
    // Et elle reste monotone : entasser davantage ne peut jamais soulager.
    for (let c = 0.85; c < 2; c += 0.05) {
      expect(crowdingPenalty(c + 0.05)).toBeGreaterThanOrEqual(crowdingPenalty(c));
    }
  });

  it("abaisse la cible du troupeau entassé sous celle du troupeau au large", () => {
    const auLarge = happinessTarget({ hasPaddock: true, grazedRecentlyMs: 0, crowding: 0.5 });
    const entasse = happinessTarget({ hasPaddock: true, grazedRecentlyMs: 0, crowding: 1.4 });
    expect(entasse).toBeLessThan(auLarge);
  });

  it("peut pousser un troupeau entassé sous le plancher de l’enfermement", () => {
    const cible = happinessTarget({
      hasPaddock: false,
      grazedRecentlyMs: Number.POSITIVE_INFINITY,
      crowding: 1.5,
    });
    expect(cible).toBeLessThan(HAPPINESS.confinedFloor);
    expect(cible).toBeGreaterThanOrEqual(0);
  });

  it("fait perdre du lait au troupeau entassé malgré ses sorties", () => {
    const conditions = { hasPaddock: true, grazedRecentlyMs: 0 };
    const large = deriver(0.35, 96, { ...conditions, crowding: 0.6 });
    const serre = deriver(0.35, 96, { ...conditions, crowding: 1.5 });
    expect(serre).toBeLessThan(large);
    const commun = { herdSize: 20, barnLevel: 1, feedQuality: 0 };
    expect(milkYield({ ...commun, happiness: serre })).toBeLessThan(
      milkYield({ ...commun, happiness: large }),
    );
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

describe("production laitière — écart enfermé / au pré", () => {
  const base = { herdSize: 10, barnLevel: 1, feedQuality: 0 };

  it("part de 22 litres par vache et par cycle au plancher", () => {
    expect(milkYield({ ...base, happiness: HAPPINESS.confinedFloor })).toBeCloseTo(
      MILK_BASE_PER_COW * 10,
      1,
    );
  });

  it("donne +32 % de lait au troupeau au pré, dans la fourchette annoncée", () => {
    const enferme = milkYield({ ...base, happiness: HAPPINESS.confinedFloor });
    const auPre = milkYield({ ...base, happiness: HAPPINESS.grazedCeiling });
    const ecart = auPre / enferme - 1;
    expect(ecart).toBeCloseTo(MILK_HAPPINESS_SPAN, 3);
    expect(ecart).toBeGreaterThanOrEqual(0.25);
    expect(ecart).toBeLessThanOrEqual(0.4);
  });

  it("n’accorde aucun bonus au troupeau resté au plancher, même sans stress", () => {
    expect(welfareIndex(HAPPINESS.confinedFloor)).toBeCloseTo(0, 6);
    expect(welfareIndex(HAPPINESS.grazedCeiling)).toBeCloseTo(1, 6);
    expect(welfareIndex(0.2)).toBeCloseTo(0, 6);
  });

  it("croît avec le niveau d’étable, plafonné au niveau 5", () => {
    const n1 = milkYield({ ...base, happiness: 0.6, barnLevel: 1 });
    const n5 = milkYield({ ...base, happiness: 0.6, barnLevel: 5 });
    expect(n5 / n1).toBeCloseTo(1.24, 3);
    expect(milkYield({ ...base, happiness: 0.6, barnLevel: 99 })).toBeCloseTo(n5, 1);
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

  it("rend 280 kg de carcasse pour une bête mature et sans bonus", () => {
    expect(meatYield({ ...base, happiness: HAPPINESS.confinedFloor })).toBe(280);
  });

  it("donne +22 % de viande au troupeau élevé au pré", () => {
    const enferme = meatYield({ ...base, happiness: HAPPINESS.confinedFloor });
    const auPre = meatYield({ ...base, happiness: HAPPINESS.grazedCeiling });
    expect(auPre / enferme - 1).toBeCloseTo(0.22, 2);
  });

  it("récompense moins la viande que le lait, pour ne pas tuer la traite", () => {
    const laitier = milkYield({
      herdSize: 10,
      barnLevel: 1,
      feedQuality: 0,
      happiness: HAPPINESS.grazedCeiling,
    });
    const laitierEnferme = milkYield({
      herdSize: 10,
      barnLevel: 1,
      feedQuality: 0,
      happiness: HAPPINESS.confinedFloor,
    });
    const viande = meatYield({ ...base, happiness: HAPPINESS.grazedCeiling });
    const viandeEnfermee = meatYield({ ...base, happiness: HAPPINESS.confinedFloor });
    expect(viande / viandeEnfermee).toBeLessThan(laitier / laitierEnferme);
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
    expect(meatYield({ ...base, averageAgeMs: -1000, happiness: 0.5 })).toBeGreaterThanOrEqual(
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
    const n1 = feedConsumption({ herdSize: 10, grazing: false, barnLevel: 1 });
    const n5 = feedConsumption({ herdSize: 10, grazing: false, barnLevel: 5 });
    expect(n5 / n1).toBeCloseTo(0.88, 3);
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
    expect(happinessLabel(0.1)).toBe("Stressées");
    expect(happinessLabel(0.4)).toBe("Correctes");
    expect(happinessLabel(0.7)).toBe("Sereines");
    expect(happinessLabel(0.95)).toBe("Épanouies");
  });

  it("lit « Correctes » exactement au plancher de l’enfermement", () => {
    expect(happinessLabel(HAPPINESS.confinedFloor)).toBe("Correctes");
    expect(happinessLabel(HAPPINESS.confinedFloor - 0.01)).toBe("Stressées");
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

describe("scénario complet — l’étable seule contre l’étable + enclos", () => {
  const cycles = 5;

  /** Cinq cycles d'élevage, avec une sortie par cycle si l'enclos existe. */
  const elever = (hasPaddock: boolean): number => {
    let happiness = 0.5;
    for (let cycle = 0; cycle < cycles; cycle++) {
      // Sortie en début de cycle, puis 24 h de dérive.
      happiness = tickHappiness({
        happiness,
        hasPaddock,
        grazedRecentlyMs: hasPaddock ? 0 : Number.POSITIVE_INFINITY,
        crowding: 0.6,
        elapsedMs: 24 * HOUR,
      });
    }
    return happiness;
  };

  it("sépare nettement les deux conduites d’élevage après cinq cycles", () => {
    const ferme = elever(false);
    const ouvert = elever(true);
    expect(ferme).toBeGreaterThanOrEqual(HAPPINESS.confinedFloor);
    expect(ferme).toBeLessThan(HAPPINESS.confinedFloor + 0.01);
    expect(ouvert).toBeGreaterThan(0.9);
    expect(happinessLabel(ferme)).toBe("Correctes");
    expect(happinessLabel(ouvert)).toBe("Épanouies");
  });

  it("traduit l’écart en litres, en kilos et en foin économisé", () => {
    const ferme = elever(false);
    const ouvert = elever(true);
    const lot = { herdSize: 20, barnLevel: 2, feedQuality: 0.5 };

    const laitFerme = milkYield({ ...lot, happiness: ferme });
    const laitOuvert = milkYield({ ...lot, happiness: ouvert });
    expect(laitOuvert / laitFerme).toBeGreaterThan(1.25);
    expect(laitOuvert / laitFerme).toBeLessThan(1.4);

    const viandeFerme = meatYield({
      herdSize: 20,
      averageAgeMs: MEAT_MATURITY_MS,
      barnLevel: 2,
      happiness: ferme,
    });
    const viandeOuvert = meatYield({
      herdSize: 20,
      averageAgeMs: MEAT_MATURITY_MS,
      barnLevel: 2,
      happiness: ouvert,
    });
    expect(viandeOuvert).toBeGreaterThan(viandeFerme);
    expect(viandeOuvert / viandeFerme).toBeLessThan(1.25);

    expect(feedConsumption({ herdSize: 20, grazing: true, barnLevel: 2 })).toBeLessThan(
      feedConsumption({ herdSize: 20, grazing: false, barnLevel: 2 }),
    );
  });
});

describe("barre de lait", () => {
  it("passe de 0 à prêt en 15 % d’un cycle", () => {
    const born = 1_000;
    expect(collectProgress(born, born, born)).toBe(0);
    expect(collectReady(born, born, born)).toBe(false);
    const mid = born + LIVESTOCK_CYCLE_MS * 0.075;
    expect(collectProgress(born, born, mid)).toBeCloseTo(0.5, 5);
    const readyAt = born + LIVESTOCK_CYCLE_MS * 0.15;
    expect(collectReady(born, born, readyAt)).toBe(true);
    expect(collectProgress(born, born, readyAt)).toBe(1);
  });
});

/**
 * La ration se compte en temps réel, pas en temps de jeu.
 *
 * Un cycle d'élevage vaut un jour de jeu, soit quinze minutes d'horloge. La
 * distribution servait exactement un cycle : il fallait revenir nourrir ses
 * bêtes tous les quarts d'heure, faute de quoi le lot dépérissait. L'écran
 * disait « 1 j » et le joueur comprenait « une journée ».
 */
describe("une ration tient un jour réel", () => {
  const BESOIN = 98; // sept vaches à 14 kg

  it("couvre vingt-quatre heures d'horloge, pas quinze minutes", () => {
    const servie = rationToServe({ besoinParCycle: BESOIN, feedStock: 0 });
    const tenue = feedAutonomyMs({ besoinParCycle: BESOIN, feedStock: servie });
    expect(Math.round(tenue / 3_600_000)).toBe(24);
  });

  it("déduit ce qui reste dans l'auge", () => {
    const pleine = rationToServe({ besoinParCycle: BESOIN, feedStock: 0 });
    const demi = rationToServe({ besoinParCycle: BESOIN, feedStock: pleine / 2 });
    expect(Math.round(demi)).toBe(Math.round(pleine / 2));
    // Un lot déjà servi ne redemande rien.
    expect(rationToServe({ besoinParCycle: BESOIN, feedStock: pleine })).toBe(0);
  });

  it("ne laisse pas vider le silo dans l'auge", () => {
    const capacite = troughCapacity(BESOIN);
    const uneRation = rationToServe({ besoinParCycle: BESOIN, feedStock: 0 });
    // La mangeoire garde de l'avance, mais pas une saison entière.
    expect(capacite).toBeGreaterThan(uneRation);
    expect(capacite / uneRation).toBe(TROUGH_REAL_DAYS);
    expect(Math.round(feedAutonomyMs({ besoinParCycle: BESOIN, feedStock: capacite }) / 3_600_000)).toBe(48);
  });

  it("un lot sans besoin n'a pas d'autonomie infinie", () => {
    expect(feedAutonomyMs({ besoinParCycle: 0, feedStock: 500 })).toBe(0);
  });
});

/**
 * Améliorer un bâtiment doit se sentir.
 *
 * « J'ai mis l'étable niveau 2 mais je dois toujours me taper le lait à traire
 * moi-même. » Le palier coûtait cher et ne changeait rien à la corvée — d'autant
 * que la traite se refait toutes les quinze minutes réelles.
 */
describe("la mécanisation d'un bâtiment", () => {
  it("ne ramasse pas toute seule au niveau le plus rustique", () => {
    expect(autoCollects(1)).toBe(false);
  });

  it("ramasse dès le premier palier, et à tous les suivants", () => {
    for (let n = AUTO_COLLECT_LEVEL; n <= 5; n++) {
      expect(`niveau ${n} ${autoCollects(n)}`).toBe(`niveau ${n} true`);
    }
  });
});

describe("la cuve de production", () => {
  it("tient un jour réel, et non une demi-heure", () => {
    // Le plafond valait deux cycles, soit trente minutes d'horloge : passé ce
    // délai, tout ce que les bêtes produisaient disparaissait sans un mot. Une
    // nuit de sommeil suffisait à tout perdre.
    const heures = (collectCapCycles() * LIVESTOCK_CYCLE_MS) / 3_600_000;
    expect(Math.round(heures)).toBe(24);
  });

  it("plafonne quand même : il reste une raison de revenir", () => {
    expect(Number.isFinite(collectCapCycles())).toBe(true);
    expect(collectCapCycles()).toBeGreaterThan(2);
  });
});

/**
 * La jauge de bien-être doit dire pourquoi.
 *
 * « Elles sont stressées pour quoi ? » L'écran donnait la note sans la copie.
 */
describe("les causes du stress", () => {
  const bien = { hasPaddock: true, grazedRecentlyMs: 0, crowding: 0.5, hunger: 0, bedding: 0 };

  it("ne reproche rien à un lot qui va bien", () => {
    expect(welfareReasons(bien)).toEqual([]);
  });

  it("nomme l'absence d'enclos, et dit quoi construire", () => {
    const causes = welfareReasons({ ...bien, hasPaddock: false });
    expect(causes[0].code).toBe("SORTIE");
    expect(causes[0].remede).toMatch(/enclos/i);
  });

  it("met la faim avant le confort", () => {
    // Une bête affamée ne se console pas d'un beau pré : l'ordre d'affichage
    // doit dire par quoi commencer.
    const causes = welfareReasons({ ...bien, hunger: 0.5, bedding: 0.1 });
    expect(causes.map((c) => c.code)).toEqual(["FAIM", "LITIERE"]);
  });

  it("classe toujours de la plus coûteuse à la moindre", () => {
    const causes = welfareReasons({
      ...bien,
      hasPaddock: false,
      crowding: 2,
      hunger: 0.2,
      bedding: 0.05,
    });
    const couts = causes.map((c) => c.cout);
    expect(couts).toEqual([...couts].sort((a, b) => b - a));
    expect(causes.length).toBe(4);
  });

  it("chaque cause porte un geste, pas seulement un constat", () => {
    for (const c of welfareReasons({ ...bien, hasPaddock: false, crowding: 2, hunger: 0.3, bedding: 0.2 })) {
      expect(`${c.code} ${c.remede.length > 10}`).toBe(`${c.code} true`);
    }
  });
});
