/**
 * Trois signalements de partie, et ce que le code en disait vraiment.
 *
 * Les trois viennent de la même session de jeu, et les trois avaient la même
 * forme : une mécanique **entièrement écrite** que rien ne laissait
 * atteindre. Ce fichier tient les règles pures ; les parcours complets sont
 * dans `api.test.ts`, sur une vraie base.
 */

import {
  CROWDING_MAX,
  HAPPINESS,
  WEED_AFTER_PLOW,
  WEED_GROWTH_PER_DAY,
  WEED_SEASON_SPEED,
  GAME_DAY_MS,
  crowdingPenalty,
  crowdingWarning,
  maxAnimalsWithCrowding,
  weedPressureAfter,
  weedsAtSowing,
  weedYieldFactor,
} from "@farmsim/shared";

describe("entasser au-delà des places", () => {
  /**
   * « Les bêtes ne dépassent pas le nombre max qu'il est possible dans
   * l'étable, ce qui n'est pas normal, il faudrait que ce soit possible, au
   * détriment des conditions à cause d'une surpopulation. »
   *
   * Le reproche était exact, et le plus gênant est que la courbe de peine
   * existait déjà, documentée du plein au double. La route d'achat refusait à
   * la dernière place : `crowding` ne dépassait jamais 1, donc la peine
   * valait toujours zéro et toute cette moitié du modèle était morte.
   */
  it("laisse aller jusqu’au double de la capacité, et pas plus loin", () => {
    expect(CROWDING_MAX).toBe(HAPPINESS.crowdingCritical);
    expect(maxAnimalsWithCrowding(20)).toBe(40);
    expect(maxAnimalsWithCrowding(55)).toBe(110);
    // Une étable sans place n'accepte rien : le double de zéro reste zéro.
    expect(maxAnimalsWithCrowding(0)).toBe(0);
  });

  it("s’arrête exactement au sommet de la courbe — le seul plafond non arbitraire", () => {
    /*
     * Au-delà de `crowdingCritical`, la peine est bornée : entasser davantage
     * n'ajouterait aucune conséquence mécanique, seulement des bêtes qui
     * souffrent sans que le jeu en dise rien.
     */
    const auPlafond = crowdingPenalty(CROWDING_MAX);
    expect(auPlafond).toBeCloseTo(HAPPINESS.crowdingPenaltyMax, 6);
    expect(crowdingPenalty(CROWDING_MAX * 2)).toBeCloseTo(auPlafond, 6);
  });

  it("ne coûte rien tant qu’on reste dans ce qu’on a payé", () => {
    // La capacité s'utilise entièrement : 54/55 comme 55/55 ne doivent rien
    // coûter. C'est la correction du « encombrée devant quinze places vides ».
    for (const n of [1, 30, 54, 55]) {
      expect({ n, peine: crowdingPenalty(n / 55) }).toEqual({ n, peine: 0 });
    }
    expect(crowdingWarning({ size: 55, capacity: 55 })).toBeNull();
  });

  it("prévient dès la première bête en trop, et chiffre la perte", () => {
    const avis = crowdingWarning({ size: 56, capacity: 55 });
    expect(avis).not.toBeNull();
    expect(avis).toContain("56");
    expect(avis).toContain("55");
    expect(avis).toMatch(/%/);

    // Et la peine annoncée grandit avec l'entassement.
    expect(crowdingPenalty(72 / 55)).toBeGreaterThan(crowdingPenalty(60 / 55));
  });

  it("ne tue jamais — l’entassement coûte de la production, pas des bêtes", () => {
    // C'est la contrepartie qui rend le déplafonnement acceptable : on peut
    // se tromper sans perdre son troupeau.
    expect(crowdingPenalty(CROWDING_MAX)).toBeLessThan(0.5);
  });
});

describe("les adventices sur un champ laissé en l’état", () => {
  /**
   * « J'ai laissé les champs juste labourés, c'est tout et ils sont toujours
   * dans cet état, pas une seule mauvaise herbe, rien n'a poussé. »
   *
   * Le modèle montait bien. C'est le semis qui remettait le compteur à zéro
   * en silence : il lisait `cell.weedPressure`, c'est-à-dire la valeur figée
   * au dernier travail du sol — zéro après un labour — au lieu de la pression
   * **effective**, celle que `pressionAdventices` calcule depuis `weedAt`.
   * Tout ce qui avait levé entre le labour et le semis était jeté au moment
   * précis où il aurait compté.
   */
  const apres = (jours: number, saison: Parameters<typeof weedPressureAfter>[0]["season"]) =>
    weedPressureAfter({ start: WEED_AFTER_PLOW, elapsedMs: jours * GAME_DAY_MS, season: saison });

  it("salit bel et bien un champ labouré qu’on laisse reposer", () => {
    expect(apres(0, "SPRING")).toBe(0);
    expect(apres(3, "SPRING")).toBeGreaterThan(0.2);
    expect(apres(10, "SPRING")).toBeGreaterThan(0.9);
  });

  it("lève plus vite au printemps qu’en hiver — la saison décide", () => {
    expect(apres(5, "SPRING")).toBeGreaterThan(apres(5, "WINTER"));
    expect(WEED_SEASON_SPEED.WINTER).toBeLessThan(WEED_SEASON_SPEED.SPRING);
    // Cinq jours d'hiver ne salissent presque rien : un champ qui hiverne
    // reste propre, et c'est voulu.
    expect(apres(5, "WINTER")).toBeLessThan(0.1);
  });

  it("emporte au semis ce qui a levé depuis le labour", () => {
    /*
     * Le cœur du défaut, dit en une assertion. `weedsAtSowing` reçoit ce que
     * l'appelant lui donne : nourri de la valeur brute il rend zéro, nourri
     * de la pression effective il rend ce qui a réellement poussé. La
     * fonction n'était pas en cause — son appelant l'était.
     */
    const brut = WEED_AFTER_PLOW;
    const effectif = apres(6, "SPRING");
    expect(weedsAtSowing({ carried: brut, sameCropAgain: false })).toBe(0);
    expect(weedsAtSowing({ carried: effectif, sameCropAgain: false })).toBeGreaterThan(0.5);
  });

  it("fait payer la salissure au rendement — sinon elle ne serait qu’un décor", () => {
    const sale = apres(8, "SPRING");
    expect(weedYieldFactor(sale)).toBeLessThan(weedYieldFactor(0));
    // Un champ propre ne perd rien.
    expect(weedYieldFactor(0)).toBe(1);
  });

  it("monte à une vitesse qui se voit en une soirée", () => {
    /*
     * Le garde-fou de l'autre côté : des adventices qui mettraient un mois à
     * se voir n'existeraient pas davantage qu'avant. Un jour de jeu fait
     * 1 h 26 réelles ; trois jours, c'est une soirée.
     */
    expect(WEED_GROWTH_PER_DAY).toBeGreaterThan(0.05);
    expect(apres(3, "SPRING")).toBeGreaterThan(0.15);
  });
});
