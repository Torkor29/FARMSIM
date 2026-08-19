/**
 * La ligne de crédit.
 *
 * Une exploitation réelle se finance à la dette : on achète la moissonneuse
 * avant d'avoir moissonné. Ici tout était comptant, et le temps d'attente
 * remplaçait l'arbitrage financier — le joueur qui voulait un tracteur plus
 * large n'avait qu'une chose à faire, attendre.
 *
 * Ce qui rend le crédit intéressant tient en une phrase : **pouvoir se
 * surendetter**. Un plafond qu'on ne peut pas approcher n'est pas un plafond,
 * c'est une commodité. Les assertions ci-dessous tiennent cette exigence.
 */

import {
  GAME_DAY_MS,
  LOAN_DAILY_RATE,
  LOAN_EQUITY_RATIO,
  LOAN_FLOOR_CRD,
  LOAN_MAX_ACCRUAL_DAYS,
  MACHINE_DEFS,
  SEASON_DAYS,
  accrueInterest,
  borrowingRoom,
  creditCeiling,
  creditHealth,
  farmEquity,
  machineCost,
  seasonInterest,
} from "@farmsim/shared";

/** Une ferme installée : une parcelle, quelques bâtiments, le parc de base. */
const INSTALLEE = {
  landCrd: 9000,
  buildingsCrd: 3000,
  machinesCrd: 4000,
  stockCrd: 800,
  cashCrd: 1200,
  debtCrd: 0,
};

describe("les capitaux propres portent la ligne", () => {
  it("comptent tout l'actif, moins ce qu'on doit", () => {
    const net = farmEquity(INSTALLEE);
    expect(net).toBe(9000 + 3000 + 4000 + 800 + 1200);
    expect(farmEquity({ ...INSTALLEE, debtCrd: 5000 })).toBe(net - 5000);
  });

  it("laisse une ferme neuve emprunter quand même", () => {
    // Sans plancher, un débutant sans terre n'aurait aucune ligne — et le
    // crédit ne servirait qu'à ceux qui n'en ont pas besoin.
    const debutant = farmEquity({
      landCrd: 0,
      buildingsCrd: 0,
      machinesCrd: 0,
      stockCrd: 0,
      cashCrd: 0,
      debtCrd: 0,
    });
    expect(creditCeiling(debutant)).toBe(LOAN_FLOOR_CRD);
  });

  it("finance un vrai saut de matériel, pas un doublement de ferme", () => {
    /**
     * Le calibrage qui compte. La ligne doit permettre d'acheter une
     * moissonneuse T2 sur une ferme installée — c'est l'usage même du crédit —
     * sans couvrir tout le patrimoine.
     */
    const plafond = creditCeiling(farmEquity(INSTALLEE));
    expect(plafond).toBeGreaterThan(machineCost("HARVESTER", 2));
    expect(plafond).toBeLessThan(farmEquity(INSTALLEE));
    expect(LOAN_EQUITY_RATIO).toBeLessThan(1);
  });
});

describe("on peut se surendetter — c'est tout l'intérêt", () => {
  it("ferme la ligne quand la dette atteint le plafond", () => {
    const net = farmEquity(INSTALLEE);
    const plafond = creditCeiling(net);
    expect(borrowingRoom({ equity: net, debtCrd: plafond })).toBe(0);
    expect(creditHealth({ equity: net, debtCrd: plafond })).toBe("SATUREE");
  });

  it("prévient avant la saturation", () => {
    // Une ligne qui passe de « tout va bien » à « fermée » sans palier
    // intermédiaire ne se pilote pas.
    const net = farmEquity(INSTALLEE);
    expect(creditHealth({ equity: net, debtCrd: 0 })).toBe("SAINE");
    expect(creditHealth({ equity: net, debtCrd: creditCeiling(net) * 0.8 })).toBe("TENDUE");
  });

  it("fait courir les intérêts, composés à la journée", () => {
    const { interest, debtCrd } = accrueInterest({
      debtCrd: 10000,
      elapsedMs: SEASON_DAYS * GAME_DAY_MS,
    });
    expect(interest).toBeGreaterThan(0);
    expect(debtCrd).toBeCloseTo(10000 * Math.pow(1 + LOAN_DAILY_RATE, SEASON_DAYS), 0);
  });

  it("pèse sur la saison sans l'écraser", () => {
    /**
     * Le chiffre que le joueur ressent. Sur dix mille TRN empruntés, la saison
     * doit coûter assez pour entrer dans le calcul — une saison sur une
     * parcelle rapporte environ 2 300 TRN — et jamais assez pour la manger.
     */
    const cout = seasonInterest(10000);
    expect(cout).toBeGreaterThan(150);
    expect(cout).toBeLessThan(700);
  });

  it("borne l'absence : on ne revient pas sur une partie perdue", () => {
    /**
     * Une ferme laissée un an ne doit pas se réveiller avec une dette
     * multipliée par cinquante. Le joueur n'aurait rien décidé, et perdre sans
     * avoir joué n'apprend rien.
     */
    const unAn = accrueInterest({ debtCrd: 10000, elapsedMs: 400 * GAME_DAY_MS });
    const borne = accrueInterest({ debtCrd: 10000, elapsedMs: LOAN_MAX_ACCRUAL_DAYS * GAME_DAY_MS });
    expect(unAn.debtCrd).toBe(borne.debtCrd);
    expect(unAn.debtCrd).toBeLessThan(10000 * 3);
  });

  it("ne fait rien courir sur une ligne à zéro", () => {
    expect(accrueInterest({ debtCrd: 0, elapsedMs: 999 * GAME_DAY_MS }).interest).toBe(0);
  });
});

describe("ce que ça change au jeu", () => {
  it("rend le matériel accessible plus tôt qu'en attendant", () => {
    // C'est l'usage du crédit : acheter la machine avant d'avoir la somme.
    const net = farmEquity({ ...INSTALLEE, cashCrd: 200 });
    const room = borrowingRoom({ equity: net, debtCrd: 0 });
    expect(room + 200).toBeGreaterThan(MACHINE_DEFS.HARVESTER.cost);
  });

  it("garde le remboursement toujours plus intéressant que le report", () => {
    // Sinon la dette serait un cadeau : on emprunterait sans jamais rendre.
    const surUneSaison = seasonInterest(10000);
    expect(surUneSaison).toBeGreaterThan(0);
    expect(LOAN_DAILY_RATE).toBeGreaterThan(0);
  });
});
