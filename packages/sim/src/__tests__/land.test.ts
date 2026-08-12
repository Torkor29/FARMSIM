import {
  ADJACENCY_BONUS_CAP,
  ESTATE_BONUS_CAP,
  LAND_AUCTION,
  LAND_CAPS,
  LAND_FACTOR_BOUNDS,
  LAND_CYCLE_MS,
  LAND_CYCLES_PER_SEASON,
  LAND_PRICE_CEIL_MULT,
  LAND_PRICE_FLOOR_MULT,
  LAND_REFERENCE_PRICE,
  LAND_STATUS_LABELS,
  LAND_TAX_MULT_CAP,
  accessFactor,
  accessIndex,
  adjacencyFactor,
  askPrice,
  auctionCommission,
  auctionStartPrice,
  canAcquire,
  climateFactor,
  densityFactor,
  diminishingYield,
  estateBonuses,
  fallowRestorationCost,
  fertilityFactor,
  landStatusFor,
  landTax,
  landTaxMultiplier,
  landTaxPerCycle,
  managementLoad,
  marketValue,
  maximumBid,
  minimumBid,
  ownershipFactor,
  requiredLevelForParcel,
  scarcityFactor,
  volatilityReduction,
} from "../../../shared/src/land.js";
import type { AskPriceInput, LandStatus } from "../../../shared/src/land.js";

/** Parcelle « Beauce B-2 » de la doc §1.7 — profil moyen de région mature. */
const BEAUCE: AskPriceInput = {
  fertility: 0.72,
  koppen: "Cfb",
  accessIndex: 0.85,
  neighborDensity: 0.292,
  occupancy: 0.58,
  adjacentOwnedBorders: 0,
  ownershipRank: 1,
};

describe("prix foncier — escalade patrimoniale", () => {
  it("offre la première parcelle au prix public, sans surcote", () => {
    const { total } = askPrice({ ...BEAUCE, ownershipRank: 1, adjacentOwnedBorders: 0 });
    expect(total).toBe(marketValue(BEAUCE));
  });

  it("multiplie le prix par 1,40 à chaque rang supplémentaire", () => {
    const first = askPrice({ ...BEAUCE, ownershipRank: 1 }).total;
    const second = askPrice({ ...BEAUCE, ownershipRank: 2 }).total;
    const third = askPrice({ ...BEAUCE, ownershipRank: 3 }).total;
    expect(second / first).toBeGreaterThan(1.39);
    expect(second / first).toBeLessThan(1.41);
    expect(third / second).toBeGreaterThan(1.39);
    expect(third / second).toBeLessThan(1.41);
  });

  it("applique 1,40^(n−1) au rang demandé", () => {
    expect(ownershipFactor(1)).toBeCloseTo(1, 6);
    expect(ownershipFactor(5)).toBeCloseTo(3.8416, 4);
  });

  it("plafonne l’escalade au plafond dur de 16 parcelles", () => {
    expect(ownershipFactor(20)).toBeCloseTo(ownershipFactor(16), 6);
  });

  it("rend la 16ᵉ parcelle hors de portée d’une trésorerie ordinaire", () => {
    const last = askPrice({ ...BEAUCE, ownershipRank: 16 }).total;
    expect(last).toBeGreaterThan(1_000_000);
  });
});

describe("prix foncier — bornes des six facteurs", () => {
  it("borne la fertilité dans [0,70 ; 1,30]", () => {
    expect(fertilityFactor(0)).toBeCloseTo(LAND_FACTOR_BOUNDS.fertility.min, 6);
    expect(fertilityFactor(1)).toBeCloseTo(LAND_FACTOR_BOUNDS.fertility.max, 6);
    expect(fertilityFactor(0.5)).toBeCloseTo(1, 6);
  });

  it("borne le climat dans [0,80 ; 1,25] malgré le bonus de classement A", () => {
    expect(climateFactor("Cfb")).toBeCloseTo(1.15, 6);
    expect(climateFactor("BWh")).toBeCloseTo(LAND_FACTOR_BOUNDS.climate.min, 6);
    // Dfa (1,20) × 1,05 = 1,26 → écrêté au plafond.
    expect(climateFactor("Dfa", true)).toBeCloseTo(LAND_FACTOR_BOUNDS.climate.max, 6);
  });

  it("retombe sur la famille Köppen pour un climat hors table", () => {
    const cwb = climateFactor("Cwb");
    expect(cwb).toBeGreaterThanOrEqual(LAND_FACTOR_BOUNDS.climate.min);
    expect(cwb).toBeLessThanOrEqual(LAND_FACTOR_BOUNDS.climate.max);
  });

  it("borne l’accès dans [0,80 ; 1,10]", () => {
    expect(accessFactor(0)).toBeCloseTo(LAND_FACTOR_BOUNDS.access.min, 6);
    expect(accessFactor(1)).toBeCloseTo(LAND_FACTOR_BOUNDS.access.max, 6);
    expect(accessFactor(5)).toBeCloseTo(LAND_FACTOR_BOUNDS.access.max, 6);
  });

  it("compose l’indice d’accès à partir du hub et des infrastructures", () => {
    const parfait = accessIndex({ hubDistance: 0, road: 1, silo: 1, rail: 1 });
    const pionnier = accessIndex({ hubDistance: 8, road: 0, silo: 0, rail: 0 });
    expect(parfait).toBeCloseTo(1, 6);
    expect(pionnier).toBeCloseTo(0, 6);
    expect(accessFactor(parfait)).toBeGreaterThan(accessFactor(pionnier));
  });

  it("borne la densité dans [1,00 ; 1,35] et la fait croître", () => {
    expect(densityFactor(0)).toBeCloseTo(LAND_FACTOR_BOUNDS.density.min, 6);
    expect(densityFactor(1)).toBeCloseTo(LAND_FACTOR_BOUNDS.density.max, 6);
    expect(densityFactor(0.6)).toBeGreaterThan(densityFactor(0.2));
  });

  it("borne la rareté dans [1,00 ; 1,90] avec une montée quadratique", () => {
    expect(scarcityFactor(0)).toBeCloseTo(LAND_FACTOR_BOUNDS.scarcity.min, 6);
    expect(scarcityFactor(1)).toBeCloseTo(LAND_FACTOR_BOUNDS.scarcity.max, 6);
    // La tension ne mord qu’en fin de peuplement : +11 % à 35 % d’occupation.
    expect(scarcityFactor(0.35)).toBeCloseTo(1.11, 2);
  });

  it("borne l’adjacence à quatre bords communs", () => {
    expect(adjacencyFactor(0)).toBeCloseTo(1, 6);
    expect(adjacencyFactor(2)).toBeCloseTo(1.16, 6);
    expect(adjacencyFactor(9)).toBeCloseTo(LAND_FACTOR_BOUNDS.adjacency.max, 6);
  });

  it("reste dans les bornes même avec des entrées aberrantes", () => {
    for (const value of [-5, 0, 0.5, 1, 42]) {
      expect(fertilityFactor(value)).toBeLessThanOrEqual(LAND_FACTOR_BOUNDS.fertility.max);
      expect(fertilityFactor(value)).toBeGreaterThanOrEqual(LAND_FACTOR_BOUNDS.fertility.min);
      expect(densityFactor(value)).toBeLessThanOrEqual(LAND_FACTOR_BOUNDS.density.max);
      expect(scarcityFactor(value)).toBeGreaterThanOrEqual(LAND_FACTOR_BOUNDS.scarcity.min);
    }
  });
});

describe("valeur publique (marketValue)", () => {
  it("ignore l’adjacence et le patrimoine de l’acheteur", () => {
    const voisinDeRien: AskPriceInput = { ...BEAUCE, adjacentOwnedBorders: 0, ownershipRank: 1 };
    const gros: AskPriceInput = { ...BEAUCE, adjacentOwnedBorders: 4, ownershipRank: 12 };
    const isole = marketValue(voisinDeRien);
    const encercle = marketValue(gros);
    expect(encercle).toBe(isole);
  });

  it("diverge de l’askPrice dès que l’acheteur est voisin", () => {
    const publique = marketValue(BEAUCE);
    const perso = askPrice({ ...BEAUCE, adjacentOwnedBorders: 3 }).total;
    expect(perso).toBeGreaterThan(publique);
  });

  it("arrondit au multiple de 50 CRD supérieur", () => {
    expect(marketValue(BEAUCE) % 50).toBe(0);
    expect(askPrice({ ...BEAUCE, ownershipRank: 4 }).total % 50).toBe(0);
  });

  it("ne descend jamais sous 0,45 × le prix de référence", () => {
    const pire = marketValue({
      fertility: 0,
      koppen: "BWh",
      accessIndex: 0,
      neighborDensity: 0,
      occupancy: 0,
    });
    // 0,45 × 5 880 = 2 646, remonté au multiple de 50 supérieur.
    expect(pire).toBe(2650);
    expect(pire).toBeGreaterThanOrEqual(LAND_PRICE_FLOOR_MULT * LAND_REFERENCE_PRICE);
  });

  it("ne dépasse jamais 6,0 × le prix de référence", () => {
    const meilleure = marketValue({
      fertility: 1,
      koppen: "Dfa",
      cropFitA: true,
      accessIndex: 1,
      neighborDensity: 1,
      occupancy: 1,
    });
    expect(meilleure).toBeLessThanOrEqual(LAND_PRICE_CEIL_MULT * LAND_REFERENCE_PRICE);
  });

  it("valorise la terre fertile et bien desservie", () => {
    const pauvre = marketValue({ ...BEAUCE, fertility: 0.4, accessIndex: 0.2 });
    const riche = marketValue({ ...BEAUCE, fertility: 0.9, accessIndex: 0.95 });
    expect(riche).toBeGreaterThan(pauvre);
  });
});

describe("décomposition du prix (breakdown)", () => {
  const sommeBreakdown = (input: AskPriceInput): number => {
    const { breakdown } = askPrice(input);
    return (
      breakdown.base +
      breakdown.fertility.contribution +
      breakdown.climate.contribution +
      breakdown.access.contribution +
      breakdown.density.contribution +
      breakdown.scarcity.contribution +
      breakdown.adjacency.contribution +
      breakdown.ownership.contribution +
      breakdown.clampAdjustment +
      breakdown.roundingAdjustment
    );
  };

  it("somme exactement au total affiché", () => {
    for (const rank of [1, 2, 5, 9, 16]) {
      const input = { ...BEAUCE, ownershipRank: rank, adjacentOwnedBorders: rank % 5 };
      expect(sommeBreakdown(input)).toBeCloseTo(askPrice(input).total, 6);
    }
  });

  it("part du prix de référence de 5 880 CRD", () => {
    expect(askPrice(BEAUCE).breakdown.base).toBe(LAND_REFERENCE_PRICE);
    expect(LAND_REFERENCE_PRICE).toBe(5880);
  });

  it("expose la valeur de chacun des sept facteurs", () => {
    const { breakdown } = askPrice({ ...BEAUCE, adjacentOwnedBorders: 2, ownershipRank: 2 });
    expect(breakdown.fertility.value).toBeCloseTo(1.132, 3);
    expect(breakdown.climate.value).toBeCloseTo(1.15, 3);
    expect(breakdown.adjacency.value).toBeCloseTo(1.16, 3);
    expect(breakdown.ownership.value).toBeCloseTo(1.4, 3);
  });

  it("signale l’écrêtage quand le produit des facteurs dépasse le plafond", () => {
    const { breakdown } = askPrice({
      fertility: 1,
      koppen: "Dfa",
      cropFitA: true,
      accessIndex: 1,
      neighborDensity: 1,
      occupancy: 1,
      adjacentOwnedBorders: 4,
      ownershipRank: 1,
    });
    expect(breakdown.clampAdjustment).toBeLessThan(0);
  });

  it("n’écrête pas une parcelle ordinaire", () => {
    expect(askPrice(BEAUCE).breakdown.clampAdjustment).toBeCloseTo(0, 6);
  });
});

describe("anti-monopole", () => {
  const ok = {
    ownedTotal: 1,
    ownedInRegion: 1,
    regionParcelCount: 40,
    playerLevel: 99,
  };

  it("laisse passer une acquisition conforme", () => {
    expect(canAcquire(ok)).toEqual({ ok: true });
  });

  it("bloque au-delà de 16 parcelles au total", () => {
    expect(canAcquire({ ...ok, ownedTotal: 15 }).ok).toBe(true);
    expect(canAcquire({ ...ok, ownedTotal: 16 })).toEqual({
      ok: false,
      reason: "MAX_PARCELS_PER_PLAYER",
    });
    expect(LAND_CAPS.global).toBe(16);
  });

  it("bloque au-delà de 6 parcelles dans une même région", () => {
    expect(canAcquire({ ...ok, ownedTotal: 6, ownedInRegion: 6, regionParcelCount: 200 })).toEqual({
      ok: false,
      reason: "MAX_PARCELS_PER_REGION",
    });
  });

  it("bloque au-delà de 40 % des parcelles d’une région", () => {
    // 3 possédées sur 10 : la 4ᵉ ferait 40 %, la 5ᵉ dépasserait.
    expect(canAcquire({ ...ok, ownedTotal: 3, ownedInRegion: 3, regionParcelCount: 10 }).ok).toBe(
      true,
    );
    expect(canAcquire({ ...ok, ownedTotal: 4, ownedInRegion: 4, regionParcelCount: 10 })).toEqual({
      ok: false,
      reason: "MAX_REGION_SHARE_PLAYER",
    });
    expect(LAND_CAPS.regionSharePct).toBeCloseTo(0.4, 6);
  });

  it("verrouille l’expansion derrière les paliers de niveau", () => {
    expect(canAcquire({ ...ok, ownedTotal: 1, playerLevel: 5 })).toEqual({
      ok: false,
      reason: "LEVEL_TOO_LOW",
    });
    expect(canAcquire({ ...ok, ownedTotal: 1, playerLevel: 6 }).ok).toBe(true);
  });

  it("suit la table de paliers de la doc", () => {
    expect(requiredLevelForParcel(1)).toBe(1);
    expect(requiredLevelForParcel(2)).toBe(6);
    expect(requiredLevelForParcel(10)).toBe(45);
    expect(requiredLevelForParcel(16)).toBe(85);
    expect(requiredLevelForParcel(99)).toBe(85);
    for (let i = 2; i <= 16; i++) {
      expect(requiredLevelForParcel(i)).toBeGreaterThan(requiredLevelForParcel(i - 1));
    }
  });

  it("fait croître la charge de gestion en n^1,25", () => {
    expect(managementLoad(0)).toBe(0);
    expect(managementLoad(1)).toBe(180);
    expect(managementLoad(10)).toBe(3201);
    expect(managementLoad(10) / 10).toBeGreaterThan(managementLoad(2) / 2);
  });

  it("applique des rendements décroissants par palier de rang", () => {
    expect(diminishingYield(1)).toBe(1);
    expect(diminishingYield(4)).toBe(1);
    expect(diminishingYield(5)).toBeCloseTo(0.97, 6);
    expect(diminishingYield(9)).toBeCloseTo(0.94, 6);
    expect(diminishingYield(16)).toBeCloseTo(0.9, 6);
  });
});

describe("taxe foncière progressive", () => {
  const patrimoine = (n: number, value = 15000): { marketValue: number }[] =>
    Array.from({ length: n }, () => ({ marketValue: value }));

  it("prélève 1,6 % de la valeur publique par saison", () => {
    const { perParcel } = landTax(patrimoine(2));
    // 1re exonérée, 2ᵉ taxée à 1,6 % × 1,12.
    expect(perParcel[1]).toBe(Math.round(15000 * 0.016 * 1.12));
  });

  it("durcit le taux avec la taille du patrimoine", () => {
    expect(landTaxMultiplier(1)).toBeCloseTo(1, 6);
    expect(landTaxMultiplier(3)).toBeCloseTo(1.24, 6);
    expect(landTaxMultiplier(10)).toBeCloseTo(2.08, 6);
  });

  it("plafonne le multiplicateur à ×2,5", () => {
    expect(landTaxMultiplier(16)).toBeCloseTo(LAND_TAX_MULT_CAP, 6);
    expect(landTaxMultiplier(50)).toBeCloseTo(LAND_TAX_MULT_CAP, 6);
  });

  it("exonère la parcelle la moins valorisée", () => {
    const { perParcel, exemptCount } = landTax([
      { marketValue: 20000 },
      { marketValue: 8000 },
      { marketValue: 12000 },
    ]);
    expect(exemptCount).toBe(1);
    expect(perParcel[1]).toBe(0);
    expect(perParcel[0]).toBeGreaterThan(0);
    expect(perParcel[2]).toBeGreaterThan(0);
  });

  it("ne taxe pas du tout le joueur mono-parcelle", () => {
    expect(landTax(patrimoine(1)).total).toBe(0);
    expect(landTax([]).total).toBe(0);
  });

  it("totalise exactement la somme des lignes", () => {
    const resultat = landTax(patrimoine(8));
    expect(resultat.total).toBe(resultat.perParcel.reduce((a, b) => a + b, 0));
    expect(resultat.perParcel).toHaveLength(8);
  });

  it("alourdit la charge totale plus vite que le nombre de parcelles", () => {
    const petit = landTax(patrimoine(3)).total;
    const gros = landTax(patrimoine(12)).total;
    expect(gros / petit).toBeGreaterThan(12 / 3);
  });

  it("étale la taxe de saison sur sept cycles", () => {
    expect(landTaxPerCycle(700)).toBeCloseTo(100, 6);
    expect(LAND_CYCLES_PER_SEASON).toBe(7);
  });
});

describe("inactivité et jachère", () => {
  const now = 1_000 * LAND_CYCLE_MS;
  const ilYA = (cycles: number): number => now - cycles * LAND_CYCLE_MS;

  it("garde la parcelle active en deçà de 14 cycles", () => {
    expect(landStatusFor(ilYA(0), now)).toBe("ACTIVE");
    expect(landStatusFor(ilYA(13.9), now)).toBe("ACTIVE");
  });

  it("bascule en veille à 14 cycles", () => {
    expect(landStatusFor(ilYA(14), now)).toBe("DORMANT");
    expect(landStatusFor(ilYA(29.9), now)).toBe("DORMANT");
  });

  it("bascule en jachère à 30 cycles", () => {
    expect(landStatusFor(ilYA(30), now)).toBe("FALLOW");
    expect(landStatusFor(ilYA(59), now)).toBe("FALLOW");
  });

  it("saisit la parcelle à 60 cycles", () => {
    expect(landStatusFor(ilYA(60), now)).toBe("SEIZED");
    expect(landStatusFor(ilYA(500), now)).toBe("SEIZED");
  });

  it("traite une dernière connexion dans le futur comme une parcelle active", () => {
    expect(landStatusFor(now + LAND_CYCLE_MS, now)).toBe("ACTIVE");
  });

  it("nomme chaque statut pour l’UI", () => {
    const statuts: LandStatus[] = ["ACTIVE", "DORMANT", "FALLOW", "SEIZED"];
    for (const statut of statuts) {
      expect(LAND_STATUS_LABELS[statut].length).toBeGreaterThan(0);
    }
  });

  it("chiffre la remise en état proportionnellement à la fertilité perdue", () => {
    expect(fallowRestorationCost(0.7)).toBe(0);
    expect(fallowRestorationCost(0.45)).toBe(2250);
    expect(fallowRestorationCost(0)).toBe(4500);
  });
});

describe("bénéfices de l’expansion", () => {
  it("récompense l’adjacence, avec un plafond à +10 %", () => {
    expect(
      estateBonuses({ adjacentOwned: 2, hemispheres: ["N"], climates: ["Cfb"] }).adjacency,
    ).toBeCloseTo(0.03, 6);
    expect(
      estateBonuses({ adjacentOwned: 50, hemispheres: ["N"], climates: ["Cfb"] }).adjacency,
    ).toBeCloseTo(ADJACENCY_BONUS_CAP, 6);
  });

  it("récompense la présence dans les deux hémisphères", () => {
    const nord = estateBonuses({ adjacentOwned: 0, hemispheres: ["N"], climates: ["Cfb"] });
    const couvert = estateBonuses({
      adjacentOwned: 0,
      hemispheres: ["N", "S"],
      climates: ["Cfb"],
    });
    expect(nord.hedge).toBe(0);
    expect(couvert.hedge).toBeCloseTo(0.05, 6);
  });

  it("réduit la volatilité d’environ 29 % à quatre climats distincts", () => {
    expect(volatilityReduction(1)).toBeCloseTo(0, 6);
    expect(volatilityReduction(2)).toBeGreaterThan(0.15);
    const quatre = volatilityReduction(4);
    expect(quatre).toBeGreaterThan(0.27);
    expect(quatre).toBeLessThan(0.3);
  });

  it("ne compte qu’une fois les climats dupliqués", () => {
    const mono = estateBonuses({
      adjacentOwned: 0,
      hemispheres: ["N"],
      climates: ["Cfb", "Cfb", "Cfb"],
    });
    const varie = estateBonuses({
      adjacentOwned: 0,
      hemispheres: ["N"],
      climates: ["Cfb", "Dfa", "Csa"],
    });
    expect(mono.diversification).toBeCloseTo(0, 6);
    expect(varie.diversification).toBeGreaterThan(0);
  });

  it("plafonne la diversification et le bonus total", () => {
    const maximal = estateBonuses({
      adjacentOwned: 20,
      hemispheres: ["N", "S"],
      climates: ["Cfb", "Dfa", "Csa", "Aw", "BSk", "BWh"],
    });
    expect(maximal.diversification).toBeCloseTo(0.04, 6);
    expect(maximal.total).toBeCloseTo(ESTATE_BONUS_CAP, 6);
    expect(maximal.total).toBeLessThan(
      maximal.adjacency + maximal.hedge + maximal.diversification + 0.0001,
    );
  });

  it("n’accorde aucun bonus à une exploitation d’une seule parcelle", () => {
    const solo = estateBonuses({ adjacentOwned: 0, hemispheres: ["N"], climates: ["Cfb"] });
    expect(solo.total).toBeCloseTo(0, 6);
  });
});

describe("enchères", () => {
  it("met à prix à la valeur publique, arrondie au multiple de 50", () => {
    expect(auctionStartPrice(19400)).toBe(19400);
    expect(auctionStartPrice(19401)).toBe(19450);
    expect(auctionStartPrice(marketValue(BEAUCE))).toBe(marketValue(BEAUCE));
  });

  it("impose un incrément minimal de 2 %", () => {
    expect(minimumBid(21800)).toBe(22240);
    expect(minimumBid(10000)).toBe(10200);
    expect(LAND_AUCTION.minIncrementPct).toBeCloseTo(0.02, 6);
  });

  it("garantit une mise suivante strictement supérieure", () => {
    for (const mise of [50, 1234, 19400, 250000]) {
      expect(minimumBid(mise)).toBeGreaterThan(mise);
    }
  });

  it("plafonne la mise à 8 × la valeur publique ou à la trésorerie", () => {
    expect(maximumBid(10000, 500000)).toBe(80000);
    expect(maximumBid(10000, 25000)).toBe(25000);
  });

  it("détruit 5 % du prix final en commission", () => {
    expect(auctionCommission(20000)).toBe(1000);
  });
});
