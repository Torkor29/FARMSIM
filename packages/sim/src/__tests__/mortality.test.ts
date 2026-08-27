import {
  CASCADE,
  HAPPINESS,
  HEALTH,
  LIVESTOCK_CYCLE_MS,
  MEAT_MATURITY_MS,
  MORTALITY,
  PURCHASED_AGE_MS,
  blendedAgeMs,
  cascadeStage,
  CASCADE_LABELS,
  crowdingLethalThreshold,
  crowdingPenalty,
  happinessTarget,
  hungerPenalty,
  meatYield,
  mortalityToll,
  tickHealth,
  welfareIndex,
  welfareReasons,
} from "@farmsim/shared";

const CYCLE = LIVESTOCK_CYCLE_MS;
/** Une heure d'horloge : la cascade se compte en temps réel, pas en jeu. */
const HEURE = 3_600_000;

describe("mortalité d'un troupeau négligé", () => {
  it("épargne un troupeau au-dessus du seuil, si mal en point soit-il", () => {
    const r = mortalityToll({
      health: MORTALITY.floor + 0.01,
      herdSize: 20,
      elapsedMs: CYCLE * 50,
      cycleMs: CYCLE,
      debt: 0,
    });
    expect(r.deaths).toBe(0);
  });

  it("fait payer la famine, mais lentement", () => {
    const un = mortalityToll({
      health: 0,
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
      health: 0,
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
      const r = mortalityToll({ health: 0, herdSize: size, elapsedMs: CYCLE, cycleMs: CYCLE, debt });
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
      health: 0,
      herdSize: 2,
      elapsedMs: CYCLE * 1000,
      cycleMs: CYCLE,
      debt: 0,
    });
    expect(r.deaths).toBeLessThanOrEqual(2);
  });

  it("efface la dette quand le troupeau va mieux", () => {
    const r = mortalityToll({
      health: 0.8,
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
 * Ce que le dépassement de capacité a le droit de coûter : de la production,
 * et rien d'autre.
 *
 * Un joueur a perdu des bêtes avec vingt et une têtes pour dix-huit places —
 * rations parfaites, litière parfaite. Puis Strea en a perdu avec **dix-neuf
 * têtes pour cinquante-cinq places**, ce qui n'a plus rien d'un entassement :
 * l'encombrement se calculait sur les cases de l'enclos, la peine démarrait à
 * 85 % d'occupation, et le plancher de l'enfermement ne laissait que 0,20
 * point de marge avant la mortalité.
 *
 * Les trois défauts sont corrigés ensemble, et la règle est simple :
 * **jusqu'à la dernière place payée, rien ; au-delà, de la production en
 * moins ; jamais un cadavre.**
 */
describe("le dépassement de capacité coûte, et ne tue jamais", () => {
  /** Satisfaction d'un lot par ailleurs irréprochable : nourri, abreuvé, paillé. */
  const cible = (occupation: number) =>
    happinessTarget({ crowding: occupation, hunger: 0, water: 1, bedding: 0 });

  it("le cas de la capture — 19 pour 55 — est à 100 %, sans une ombre", () => {
    expect(cible(19 / 55)).toBeCloseTo(1, 6);
    expect(
      welfareReasons({ crowding: 19 / 55, hunger: 0, water: 1, bedding: 0 }),
    ).toEqual([]);
  });

  it("ne coûte rien tant qu'on est dans la capacité, jamais", () => {
    for (const effectif of [0, 30, 40, 47, 54, 55]) {
      expect(cible(effectif / 55)).toBeCloseTo(1, 6);
    }
  });

  it("mais se paie en production dès la bête de trop", () => {
    const dansLaCapacite = welfareIndex(cible(1));
    const debordant = welfareIndex(cible(1.3));
    expect(debordant).toBeLessThan(dansLaCapacite);
    // Une perte réelle mais mesurée : quelques pour cent, pas la moitié.
    expect(dansLaCapacite - debordant).toBeGreaterThan(0.02);
    expect(dansLaCapacite - debordant).toBeLessThan(0.15);
  });

  it("et le joueur en est averti, avec le geste qui l'efface", () => {
    const causes = welfareReasons({ crowding: 1.3, hunger: 0, water: 1, bedding: 0 });
    const surpeuplement = causes.find((c) => c.code === "SURPEUPLEMENT");
    expect(surpeuplement).toBeDefined();
    expect(surpeuplement!.remede.length).toBeGreaterThan(0);
  });

  it("même à deux fois la place, il ne peut pas tuer", () => {
    // La peine plafonne à 0,35 point de satisfaction — et la satisfaction ne
    // décide plus de la mortalité. `crowdingLethalThreshold()` le dit en un
    // chiffre : il n'y a plus de seuil.
    expect(crowdingPenalty(2)).toBeCloseTo(HAPPINESS.crowdingPenaltyMax, 6);
    expect(cible(2)).toBeCloseTo(1 - HAPPINESS.crowdingPenaltyMax, 6);
    expect(crowdingLethalThreshold()).toBe(Number.POSITIVE_INFINITY);
    expect(
      mortalityToll({ health: 1, herdSize: 40, elapsedMs: CYCLE * 500, cycleMs: CYCLE, debt: 0 })
        .deaths,
    ).toBe(0);
  });

  it("la faim, elle, coûte de la production — et ouvre la cascade", () => {
    const aJeun = hungerPenalty({ feedStock: 0, herdSize: 20, kind: "COW" });
    const affame = happinessTarget({ crowding: 0.5, hunger: aJeun, water: 1 });
    expect(affame).toBeLessThan(1);
    // Mais elle ne tue pas d'elle-même : c'est la santé qui décide, et elle
    // met trente-six heures réelles à tomber.
    expect(happinessTarget({ crowding: 0.5, hunger: 0, water: 1 })).toBeCloseTo(1, 6);
  });
});

/**
 * La cascade : trente-six heures réelles, et trois avertissements avant.
 *
 * Il n'y avait pas de cascade. La satisfaction passait sous `MORTALITY.floor`
 * et les bêtes mouraient — sans étape, sans préavis, et sur des troupeaux
 * qu'aucun geste ne pouvait sauver puisque le reproche affiché était « sortez-
 * les au pré » devant un pré pelé. C'est ce qui a produit « je sais plus quoi
 * faire ».
 */
describe("la cascade — de la mangeoire vide à la première perte", () => {
  it("laisse huit heures de sursis avant que la santé ne bouge", () => {
    expect(cascadeStage(0)).toBe("OK");
    expect(cascadeStage(1)).toBe("PRODUCTION");
    expect(cascadeStage(CASCADE.productionH - 0.1)).toBe("PRODUCTION");
    // Et la santé remonte pendant le sursis : une soirée d'absence ne coûte rien.
    expect(tickHealth({ health: 0.8, deprivedH: 4, elapsedMs: 4 * HEURE })).toBeGreaterThan(0.8);
  });

  it("passe les trois avertissements dans l'ordre, chacun avec son geste", () => {
    const etapes = [
      cascadeStage(2),
      cascadeStage(12),
      cascadeStage(28),
      cascadeStage(40),
    ];
    expect(etapes).toEqual(["PRODUCTION", "SANTE", "CRITIQUE", "MORTEL"]);
    for (const etape of etapes) {
      const dit = CASCADE_LABELS[etape];
      expect(dit).not.toBeNull();
      expect(dit!.texte.length).toBeGreaterThan(0);
      expect(dit!.remede.length).toBeGreaterThan(0);
    }
    expect(CASCADE_LABELS.OK).toBeNull();
  });

  it("met trente-six heures réelles à vider la santé, pas une de moins", () => {
    // Huit heures de sursis, puis vingt-huit heures de chute : c'est le
    // curseur retenu, et il tient dans une nuit plus une journée de travail.
    expect(CASCADE.productionH + HEALTH.collapseH).toBe(CASCADE.criticalH);
    expect(CASCADE.criticalH).toBe(36);

    // Rien pendant le sursis, puis la chute complète sur `collapseH`.
    expect(tickHealth({ health: 1, deprivedH: CASCADE.productionH, elapsedMs: 8 * HEURE })).toBe(1);
    expect(
      tickHealth({ health: 1, deprivedH: 36, elapsedMs: (HEALTH.collapseH - 1) * HEURE }),
    ).toBeGreaterThan(0);
    expect(
      tickHealth({ health: 1, deprivedH: 36, elapsedMs: HEALTH.collapseH * HEURE }),
    ).toBeCloseTo(0, 6);
  });

  /** La santé d'un lot privé depuis `heures`, heure par heure. */
  const santeApres = (heures: number): number => {
    let sante = 1;
    for (let h = 1; h <= heures; h++) {
      sante = tickHealth({ health: sante, deprivedH: h, elapsedMs: HEURE });
    }
    return sante;
  };

  it("ne tue aucune bête avant le bout de la cascade", () => {
    // La santé reste au-dessus du plancher de mortalité pendant trente et une
    // heures : le joueur a une nuit entière pour rentrer.
    for (const h of [0, 8, 16, 24, 30]) {
      const perte = mortalityToll({
        health: santeApres(h),
        herdSize: 40,
        elapsedMs: CYCLE,
        cycleMs: CYCLE,
        debt: 0,
      });
      expect(perte.deaths).toBe(0);
    }
  });

  it("épargne un troupeau enfermé tout l'hiver, du moment qu'on le nourrit", () => {
    /*
     * Le test qui répond mot pour mot à la demande : « automne hiver elles
     * doivent pas l'être sans que ça affecte du coup leur santé car c'est
     * normal ». Quatre-vingt-dix jours réels à l'étable, ration servie, jamais
     * une sortie — et pas une bête perdue.
     */
    let sante = 1;
    let satisfaction = 1;
    let debt = 0;
    let taille = 40;
    for (let jour = 0; jour < 90; jour++) {
      sante = tickHealth({ health: sante, deprivedH: 0, elapsedMs: 24 * HEURE });
      satisfaction = happinessTarget({ crowding: 40 / 55, hunger: 0, water: 1, bedding: 0 });
      const perte = mortalityToll({
        health: sante,
        herdSize: taille,
        elapsedMs: 24 * HEURE,
        cycleMs: CYCLE,
        debt,
      });
      taille -= perte.deaths;
      debt = perte.debt;
    }
    expect(taille).toBe(40);
    expect(sante).toBe(1);
    expect(satisfaction).toBeCloseTo(1, 6);
  });

  it("remet un troupeau d'aplomb quand on revient, sans le condamner", () => {
    // Trente-six heures d'abandon, santé à zéro, puis on nourrit : la santé
    // remonte, et elle repasse le plancher de mortalité bien avant d'être
    // pleine. Aucun troupeau n'est perdu d'avance.
    let sante = tickHealth({ health: 1, deprivedH: 36, elapsedMs: 28 * HEURE });
    expect(sante).toBeCloseTo(0, 6);
    sante = tickHealth({ health: sante, deprivedH: 0, elapsedMs: 6 * HEURE });
    expect(sante).toBeGreaterThan(MORTALITY.floor);
    expect(
      mortalityToll({ health: sante, herdSize: 40, elapsedMs: CYCLE, cycleMs: CYCLE, debt: 0 })
        .deaths,
    ).toBe(0);
  });
});
