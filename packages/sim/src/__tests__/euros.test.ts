import {
  BUILDING_DEFS,
  CROP_DEFS,
  GOOD_DEFS,
  HECTARES_PER_CELL,
  LAND_BASE_PER_HA,
  MACHINE_DEFS,
  PARCEL_HECTARES,
  SPECIES,
  formatEuros,
  formatEurosCourt,
} from "@farmsim/shared";

/**
 * L'économie, en euros, mesurée.
 *
 * Les prix des denrées étaient déjà à peu près justes — le blé à 220 la tonne,
 * le lait à 42 l'hectolitre. Le capital, lui, ne l'était pas : un tracteur de
 * 90 chevaux valait douze tonnes de blé, une étable en valait treize, et une
 * parcelle de quatorze hectares une demi-moisson. Acheter n'était pas une
 * décision, c'était une formalité.
 *
 * Ces assertions ne fixent pas les prix — elles fixent les **rapports** entre
 * eux, en moissons, parce que c'est dans cette monnaie-là qu'un joueur
 * raisonne. Un prix qu'on change sans y penser les fait sortir de leur bande.
 */

/** Le produit brut d'une parcelle entière semée en blé, semences déduites. */
const CASES = PARCEL_HECTARES / HECTARES_PER_CELL;
const MOISSON =
  CASES * CROP_DEFS.WHEAT.yieldPerCell * GOOD_DEFS.WHEAT.basePrice -
  CASES * CROP_DEFS.WHEAT.seedCostPerCell;

/** Combien de moissons de blé pour se payer ça. */
function enMoissons(prix: number): number {
  return prix / MOISSON;
}

describe("ce que rapporte un champ", () => {
  it("nourrit son homme sans le rendre riche en un geste", () => {
    // Une parcelle de 14 ha, blé, semences payées. C'est l'unité de compte de
    // tout ce qui suit.
    expect(MOISSON).toBeGreaterThan(6_000);
    expect(MOISSON).toBeLessThan(14_000);
  });
});

describe("les engins", () => {
  it("coûtent des moissons, pas des poignées de main", () => {
    /*
     * Le défaut d'origine, en un chiffre : le tracteur valait 2 800 € quand le
     * blé en valait 220 la tonne — douze tonnes, soit un quart de moisson.
     *
     * L'autre extrême s'est révélé aussi faux. Aux prix du marché de
     * l'occasion — 30 000 € le tracteur, 78 000 € la moissonneuse — le
     * matériel ne se rentabilisait plus qu'au bout de quinze moissons : une
     * exploitation de quatorze hectares n'achète pas ce matériel-là, elle
     * appelle une entreprise. L'ancre juste est le capital par hectare, et
     * elle donne du vieux matériel de petite ferme : une moisson et demie pour
     * le tracteur.
     */
    expect(enMoissons(MACHINE_DEFS.TRACTOR.cost)).toBeGreaterThan(1);
    expect(enMoissons(MACHINE_DEFS.TRACTOR.cost)).toBeLessThan(3);
  });

  it("gardent l’ordre du vrai matériel", () => {
    const c = (t: keyof typeof MACHINE_DEFS) => MACHINE_DEFS[t].cost;
    // Une moissonneuse vaut deux à trois tracteurs ; une ensileuse davantage.
    // Une moissonneuse ancienne et étroite vaut une fois et demie le tracteur
    // qui la précède — c'est le rapport du marché de l'occasion ancienne.
    expect(c("HARVESTER")).toBeGreaterThan(c("TRACTOR") * 1.4);
    expect(c("FORAGE_HARVESTER")).toBeGreaterThan(c("HARVESTER"));
    // Les outils traînés valent une fraction du porteur.
    for (const outil of ["PLOUGH", "SEEDER", "MOWER", "SPREADER", "TRAILER"] as const) {
      expect(c(outil)).toBeLessThan(c("TRACTOR"));
    }
    // La charrue reste le premier achat abordable.
    expect(enMoissons(c("PLOUGH"))).toBeLessThan(0.6);
  });

  it("mettent la moissonneuse hors de portée d’un débutant", () => {
    // C'est ce qui donne sa raison d'être à l'entreprise de travaux : sans
    // écart, personne n'appellerait jamais quelqu'un pour moissonner.
    expect(enMoissons(MACHINE_DEFS.HARVESTER.cost)).toBeGreaterThan(2);
  });
});

describe("les bâtiments", () => {
  it("valent plus qu’un outil et moins qu’une ferme entière", () => {
    for (const b of Object.values(BUILDING_DEFS)) {
      expect(b.cost).toBeGreaterThan(1_000);
      expect(enMoissons(b.cost)).toBeLessThan(8);
    }
  });

  it("classent les abris dans l’ordre du bétail qu’ils tiennent", () => {
    const c = (t: keyof typeof BUILDING_DEFS) => BUILDING_DEFS[t].cost;
    expect(c("CATTLE_BARN")).toBeGreaterThan(c("SHEEPFOLD"));
    expect(c("SHEEPFOLD")).toBeGreaterThan(c("HENHOUSE"));
    // Une courette n'est qu'une clôture : elle ne vaut pas un bâtiment.
    expect(c("HEN_YARD")).toBeLessThan(c("HENHOUSE") / 2);
  });

  it("font de la transformation le gros investissement qu’elle est", () => {
    expect(BUILDING_DEFS.DAIRY.cost).toBeGreaterThan(BUILDING_DEFS.CATTLE_BARN.cost);
    expect(enMoissons(BUILDING_DEFS.DAIRY.cost)).toBeGreaterThan(2.5);
  });
});

describe("les bêtes", () => {
  it("valent ce qu’elles valent au marché aux bestiaux", () => {
    expect(SPECIES.COW.price).toBeGreaterThan(1_200);
    expect(SPECIES.COW.price).toBeLessThan(2_200);
    expect(SPECIES.SHEEP.price).toBeGreaterThan(120);
    expect(SPECIES.SHEEP.price).toBeLessThan(260);
    expect(SPECIES.HEN.price).toBeLessThan(15);
  });

  it("classent le cheptel dans l’ordre", () => {
    expect(SPECIES.COW.price).toBeGreaterThan(SPECIES.PIG.price);
    expect(SPECIES.PIG.price).toBeGreaterThan(SPECIES.SHEEP.price);
    expect(SPECIES.SHEEP.price).toBeGreaterThan(SPECIES.HEN.price);
  });

  it("laissent une vache se rembourser, mais pas en un jour", () => {
    // Le lait d'une vache doit payer la vache : sinon l'élevage est un
    // hobby. Mais pas en une traite, sinon c'est une machine à sous.
    const litresParTraite = 22;
    const parTraite = (litresParTraite / 100) * GOOD_DEFS.MILK.basePrice;
    const traites = SPECIES.COW.price / parTraite;
    expect(traites).toBeGreaterThan(60);
    expect(traites).toBeLessThan(400);
  });
});

describe("la terre", () => {
  it("coûte le prix d’une terre agricole", () => {
    expect(LAND_BASE_PER_HA).toBeGreaterThan(3_000);
    expect(LAND_BASE_PER_HA).toBeLessThan(9_000);
  });

  it("fait d’une deuxième parcelle un vrai projet", () => {
    // À 420 € l'hectare, une parcelle entière valait une demi-moisson :
    // s'agrandir n'était pas une décision.
    const parcelle = LAND_BASE_PER_HA * PARCEL_HECTARES;
    expect(enMoissons(parcelle)).toBeGreaterThan(5);
    expect(enMoissons(parcelle)).toBeLessThan(15);
  });
});

describe("les cours des denrées", () => {
  it("gardent la hiérarchie réelle des céréales", () => {
    const p = (g: keyof typeof GOOD_DEFS) => GOOD_DEFS[g].basePrice;
    // Le colza paie mieux que le blé, qui paie mieux que l'orge.
    expect(p("RAPE")).toBeGreaterThan(p("WHEAT") * 1.5);
    expect(p("WHEAT")).toBeGreaterThan(p("BARLEY"));
    // Le fourrage ne vaut pas la denrée : l'ensilage était à deux fois et
    // demie son prix, ce qui rendait l'ensileuse absurdement rentable.
    expect(p("SILAGE")).toBeLessThan(p("HAY"));
    expect(p("MANURE")).toBeLessThan(p("STRAW") / 3);
  });

  it("paient la transformation plus que la matière", () => {
    expect(GOOD_DEFS.FLOUR.basePrice).toBeGreaterThan(GOOD_DEFS.WHEAT.basePrice * 1.5);
    expect(GOOD_DEFS.CHEESE.basePrice).toBeGreaterThan(GOOD_DEFS.MILK.basePrice * 50);
  });
});

describe("l’écriture des sommes", () => {
  it("sépare les milliers et met le symbole après", () => {
    expect(formatEuros(0)).toBe("0 €");
    expect(formatEuros(950)).toBe("950 €");
    expect(formatEuros(78000)).toBe("78 000 €");
    expect(formatEuros(1234567)).toBe("1 234 567 €");
  });

  it("tient les dettes", () => {
    expect(formatEuros(-450)).toBe("-450 €");
    expect(formatEurosCourt(-25000)).toBe("-25 k€");
  });

  it("abrège plutôt que de se faire couper", () => {
    expect(formatEurosCourt(9999)).toBe("9 999 €");
    expect(formatEurosCourt(10000)).toBe("10 k€");
    expect(formatEurosCourt(148000)).toBe("148 k€");
    expect(formatEurosCourt(2400000)).toBe("2.4 M€");
    for (const n of [0, 9999, 10000, 999999, 1000000, 999000000]) {
      expect(formatEurosCourt(n).length).toBeLessThanOrEqual(10);
    }
  });
});
