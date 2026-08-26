import {
  HAPPINESS,
  LIVESTOCK_CYCLE_MS,
  MEAT_MATURITY_MS,
  MORTALITY,
  PURCHASED_AGE_MS,
  blendedAgeMs,
  crowdingLethalThreshold,
  crowdingPenalty,
  happinessTarget,
  hungerPenalty,
  meatYield,
  mortalityToll,
  welfareIndex,
  welfareReasons,
} from "@farmsim/shared";

const CYCLE = LIVESTOCK_CYCLE_MS;

describe("mortalité d'un troupeau négligé", () => {
  it("épargne un troupeau au-dessus du seuil, si mal en point soit-il", () => {
    const r = mortalityToll({
      happiness: MORTALITY.floor + 0.01,
      herdSize: 20,
      elapsedMs: CYCLE * 50,
      cycleMs: CYCLE,
      debt: 0,
    });
    expect(r.deaths).toBe(0);
  });

  it("fait payer la famine, mais lentement", () => {
    const un = mortalityToll({
      happiness: 0,
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
      debt: 0,
    });
    // Six pour cent d'un lot de dix, soit moins d'une bête : la dette porte le
    // reste jusqu'au cycle suivant.
    expect(un.deaths).toBe(0);
    expect(un.debt).toBeCloseTo(0.6, 5);

    const deux = mortalityToll({
      happiness: 0,
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
      debt: un.debt,
    });
    expect(deux.deaths).toBe(1);
  });

  it("finit par emporter un petit lot, que la dette rendait immortel", () => {
    let size = 3;
    let debt = 0;
    let cycles = 0;
    while (size > 0 && cycles < 500) {
      const r = mortalityToll({ happiness: 0, herdSize: size, elapsedMs: CYCLE, cycleMs: CYCLE, debt });
      size -= r.deaths;
      debt = r.debt;
      cycles += 1;
    }
    expect(size).toBe(0);
    // Assez lent pour qu'on puisse rentrer et réagir.
    expect(cycles).toBeGreaterThan(10);
  });

  it("ne tue jamais plus de bêtes qu'il n'y en a", () => {
    const r = mortalityToll({
      happiness: 0,
      herdSize: 2,
      elapsedMs: CYCLE * 1000,
      cycleMs: CYCLE,
      debt: 0,
    });
    expect(r.deaths).toBeLessThanOrEqual(2);
  });

  it("efface la dette quand le troupeau va mieux", () => {
    const r = mortalityToll({
      happiness: 0.8,
      herdSize: 10,
      elapsedMs: CYCLE,
      cycleMs: CYCLE,
      debt: 0.9,
    });
    expect(r.debt).toBeLessThan(0.9);
    expect(r.deaths).toBe(0);
  });
});

describe("âge moyen du lot", () => {
  it("se dilue à la naissance : un veau ne vaut pas un adulte", () => {
    const adulte = MEAT_MATURITY_MS;
    const apres = blendedAgeMs({ herdSize: 3, averageAgeMs: adulte, added: 1, addedAgeMs: 0 });
    expect(apres).toBeCloseTo((adulte * 3) / 4, 5);
    expect(apres).toBeLessThan(adulte);
  });

  it("se déplace vers l'âge des bêtes achetées", () => {
    const apres = blendedAgeMs({
      herdSize: 0,
      averageAgeMs: 0,
      added: 4,
      addedAgeMs: PURCHASED_AGE_MS,
    });
    expect(apres).toBeCloseTo(PURCHASED_AGE_MS, 5);
  });

  it("ne bouge pas sans arrivée", () => {
    expect(blendedAgeMs({ herdSize: 5, averageAgeMs: 1234, added: 0, addedAgeMs: 0 })).toBe(1234);
  });

  it("fait vraiment baisser le rendement en viande", () => {
    const base = { herdSize: 4, happiness: 0.7, barnLevel: 1 };
    const adultes = meatYield({ ...base, averageAgeMs: MEAT_MATURITY_MS });
    const dilue = meatYield({
      ...base,
      averageAgeMs: blendedAgeMs({
        herdSize: 3,
        averageAgeMs: MEAT_MATURITY_MS,
        added: 1,
        addedAgeMs: 0,
      }),
    });
    expect(dilue).toBeLessThan(adultes);
  });

  it("on achète du bétail élevé, pas des nouveau-nés", () => {
    expect(PURCHASED_AGE_MS).toBeGreaterThan(0);
    expect(PURCHASED_AGE_MS).toBeLessThan(MEAT_MATURITY_MS);
  });
});

/**
 * Ce que le surpeuplement a le droit de coûter.
 *
 * Un joueur a perdu des bêtes avec vingt et une têtes pour dix-huit places —
 * rations parfaites, litière parfaite. La droite de pénalité d'alors rendait
 * 0,146 point pour dix-sept pour cent de trop, sur une marge totale de 0,20
 * entre le plancher de l'enfermement (0,35) et celui de la mortalité (0,15) :
 * il ne restait rien pour encaisser quoi que ce soit d'autre.
 *
 * L'intention, énoncée avant les chiffres : **un surpeuplement léger coûte de
 * la production et de la croissance, jamais des cadavres ; la mortalité reste
 * réservée à l'abandon — la faim, ou l'entassement massif.**
 */
describe("le surpeuplement coûte, mais ne tue pas tout de suite", () => {
  /** Cible d'un lot par ailleurs irréprochable : nourri, paillé, tempéré. */
  const cible = (occupation: number) =>
    happinessTarget({
      hasPaddock: true,
      grazedRecentlyMs: Number.MAX_SAFE_INTEGER,
      crowding: occupation,
      hunger: 0,
      bedding: 0,
    });

  it("le cas remonté — 21 pour 18 — n'est plus une condamnation", () => {
    const t = cible(21 / 18);
    expect(t).toBeGreaterThan(MORTALITY.floor);
    /*
     * Et avec de la marge, c'est là tout le point : la neige d'hiver sur un
     * troupeau dehors vaut 0,225 point. La marge doit l'absorber, sans quoi on
     * n'aurait fait que déplacer le seuil d'un cran.
     */
    expect(t - MORTALITY.floor).toBeGreaterThan(0.15);
  });

  it("jusqu'à 130 % d'occupation, aucun entassement n'est mortel", () => {
    for (let occupation = 0.85; occupation <= 1.3; occupation += 0.01) {
      expect(cible(occupation)).toBeGreaterThan(MORTALITY.floor);
    }
  });

  it("mais il se paie en production dès qu'il commence", () => {
    // La pénalité mord sur l'indice de bien-être, donc sur le lait et sur la
    // carcasse. Un lot au plafond du pâturage y perd quelques points.
    const auLarge = welfareIndex(
      happinessTarget({ hasPaddock: true, grazedRecentlyMs: 0, crowding: 0.8 }),
    );
    const serre = welfareIndex(
      happinessTarget({ hasPaddock: true, grazedRecentlyMs: 0, crowding: 21 / 18 }),
    );
    expect(serre).toBeLessThan(auLarge);
    // Une perte réelle mais mesurée : quelques pour cent, pas la moitié.
    expect(auLarge - serre).toBeGreaterThan(0.02);
    expect(auLarge - serre).toBeLessThan(0.15);
  });

  it("et le joueur en est averti avant d'en payer le prix", () => {
    // Nommer la cause n'est utile que si elle passe le seuil d'affichage.
    const causes = welfareReasons({
      hasPaddock: true,
      grazedRecentlyMs: 0,
      crowding: 21 / 18,
      hunger: 0,
      bedding: 0,
    });
    expect(causes.map((c) => c.code)).toContain("SURPEUPLEMENT");
  });

  it("l'entassement massif, lui, tue toujours", () => {
    // Au double de la place, la cible tombe au plancher absolu : c'est le
    // contrepoids sans lequel l'enclos n'aurait plus de taille utile.
    expect(cible(2)).toBeLessThan(MORTALITY.floor);
    expect(crowdingPenalty(2)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax, 6);
  });

  it("le seuil de mortalité par entassement seul est loin de l'erreur ordinaire", () => {
    const seuil = crowdingLethalThreshold();
    // Il valait 1,283 — vingt-trois bêtes pour dix-huit places. Il faut
    // désormais dépasser la place de plus de deux tiers pour tuer sans autre
    // cause.
    expect(seuil).toBeGreaterThan(1.6);
    expect(seuil).toBeLessThan(HAPPINESS.crowdingCritical);
    // Et la dérivée est vérifiée, pas supposée : juste sous le seuil on vit,
    // juste au-dessus on meurt.
    expect(cible(seuil - 0.01)).toBeGreaterThan(MORTALITY.floor);
    expect(cible(seuil + 0.01)).toBeLessThan(MORTALITY.floor);
  });

  it("la faim, elle, reste une condamnation immédiate — c'est le vrai abandon", () => {
    /*
     * Enclos à moitié vide : rien à reprocher au joueur sauf l'auge, qui est
     * à zéro. La faim seule doit suffire à passer sous le plancher — c'est
     * elle, et non le serrement, qui doit rester le chemin vers les pertes.
     */
    const aJeun = hungerPenalty({ feedStock: 0, herdSize: 20, kind: "COW" });
    const affame = happinessTarget({
      hasPaddock: true,
      grazedRecentlyMs: Number.MAX_SAFE_INTEGER,
      crowding: 0.5,
      hunger: aJeun,
      bedding: 0,
    });
    expect(affame).toBeLessThan(MORTALITY.floor);
    // Et le même lot repu va très bien : c'est bien la faim qui décide.
    expect(
      happinessTarget({
        hasPaddock: true,
        grazedRecentlyMs: Number.MAX_SAFE_INTEGER,
        crowding: 0.5,
        hunger: 0,
      }),
    ).toBeGreaterThan(MORTALITY.floor);
  });
});
