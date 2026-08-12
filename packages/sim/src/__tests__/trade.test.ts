import {
  DEALER_RATIO,
  LISTING_COMMISSION_RATE,
  LISTING_FEE_RATE,
  LISTING_PRICE_MAX_RATIO,
  LISTING_PRICE_MIN_RATIO,
  MAX_OPEN_LISTINGS,
  MAX_SLIPPAGE,
  SALE_CHANNEL_LABELS,
  canList,
  dealerPricePerTon,
  listingFee,
  listingProceeds,
  marketPricePerTon,
  quoteAllChannels,
  volumeSlippage,
} from "@farmsim/shared";

const COURS = 220;
const PROFONDEUR = 2000;

describe("le négociant", () => {
  it("paie une fraction fixe du cours", () => {
    expect(dealerPricePerTon(COURS)).toBeCloseTo(COURS * DEALER_RATIO, 2);
  });

  it("paie moins que le marché, quel que soit le cours", () => {
    for (const cours of [120, 220, 450]) {
      expect(dealerPricePerTon(cours)).toBeLessThan(cours);
    }
  });

  it("reste franchement décevant : c'est un filet, pas une stratégie", () => {
    expect(DEALER_RATIO).toBeLessThanOrEqual(0.7);
    expect(DEALER_RATIO).toBeGreaterThanOrEqual(0.4);
  });
});

describe("décote de volume", () => {
  it("est négligeable sur un petit lot", () => {
    expect(volumeSlippage(1, PROFONDEUR)).toBeLessThan(0.03);
  });

  it("croît avec le volume vendu", () => {
    const petit = volumeSlippage(10, PROFONDEUR);
    const gros = volumeSlippage(200, PROFONDEUR);
    expect(gros).toBeGreaterThan(petit);
  });

  it("est plafonnée : le marché ne s'effondre jamais totalement", () => {
    expect(volumeSlippage(1e9, PROFONDEUR)).toBeLessThanOrEqual(MAX_SLIPPAGE);
  });

  it("mord moins sur un marché profond", () => {
    const etroit = volumeSlippage(100, 200);
    const profond = volumeSlippage(100, 5000);
    expect(profond).toBeLessThan(etroit);
  });

  it("rend le fractionnement des ventes payant", () => {
    // Vendre 200 t d'un coup doit rapporter moins que le même tonnage vendu
    // au prix d'un petit lot : c'est ce qui donne un intérêt à étaler.
    const enUneFois = marketPricePerTon(COURS, 200, PROFONDEUR) * 200;
    const auDetail = marketPricePerTon(COURS, 10, PROFONDEUR) * 200;
    expect(enUneFois).toBeLessThan(auDetail);
  });
});

describe("la criée", () => {
  it("facture des frais de dépôt proportionnels", () => {
    expect(listingFee(200, 10)).toBe(Math.round(200 * 10 * LISTING_FEE_RATE));
  });

  it("facture au minimum 1 CRD, même sur un lot dérisoire", () => {
    expect(listingFee(1, 0.01)).toBeGreaterThanOrEqual(1);
  });

  it("prélève une commission à la vente", () => {
    expect(listingProceeds(200, 10)).toBe(Math.round(200 * 10 * (1 - LISTING_COMMISSION_RATE)));
  });

  it("refuse un prix sous le plancher", () => {
    const v = canList({
      pricePerTon: COURS * (LISTING_PRICE_MIN_RATIO - 0.05),
      tons: 5,
      marketPrice: COURS,
      openListings: 0,
      stockTons: 10,
      crd: 10000,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("PRICE_TOO_LOW");
  });

  it("refuse un prix irréaliste", () => {
    const v = canList({
      pricePerTon: COURS * (LISTING_PRICE_MAX_RATIO + 0.5),
      tons: 5,
      marketPrice: COURS,
      openListings: 0,
      stockTons: 10,
      crd: 10000,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("PRICE_TOO_HIGH");
  });

  it("refuse au-delà du nombre d'annonces autorisé", () => {
    const v = canList({
      pricePerTon: COURS,
      tons: 5,
      marketPrice: COURS,
      openListings: MAX_OPEN_LISTINGS,
      stockTons: 10,
      crd: 10000,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("TOO_MANY_LISTINGS");
  });

  it("refuse sans le stock correspondant", () => {
    const v = canList({
      pricePerTon: COURS,
      tons: 50,
      marketPrice: COURS,
      openListings: 0,
      stockTons: 10,
      crd: 10000,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("NOT_ENOUGH_STOCK");
  });

  it("refuse si les frais de dépôt ne sont pas payables", () => {
    const v = canList({
      pricePerTon: COURS,
      tons: 50,
      marketPrice: COURS,
      openListings: 0,
      stockTons: 100,
      crd: 1,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("CANNOT_AFFORD_FEE");
  });

  it("accepte une annonce raisonnable", () => {
    expect(
      canList({
        pricePerTon: COURS * 1.15,
        tons: 5,
        marketPrice: COURS,
        openListings: 1,
        stockTons: 10,
        crd: 10000,
      }).ok,
    ).toBe(true);
  });
});

describe("comparaison des canaux", () => {
  const base = {
    commodity: "WHEAT" as const,
    tons: 20,
    marketPrice: COURS,
    stockTons: PROFONDEUR,
    moisturePenalty: 0,
  };

  it("propose exactement les trois débouchés", () => {
    const q = quoteAllChannels(base);
    expect(q.map((x) => x.channel)).toEqual(["DEALER", "MARKET", "LISTING"]);
    for (const x of q) expect(SALE_CHANNEL_LABELS[x.channel]).toBeTruthy();
  });

  it("classe le négociant en dessous du marché sur un lot ordinaire", () => {
    const [dealer, marche] = quoteAllChannels(base);
    expect(dealer.net).toBeLessThan(marche.net);
  });

  it("distingue l'encaissement garanti de l'incertain", () => {
    const q = quoteAllChannels(base);
    expect(q.find((x) => x.channel === "DEALER")!.guaranteed).toBe(true);
    expect(q.find((x) => x.channel === "MARKET")!.guaranteed).toBe(true);
    expect(q.find((x) => x.channel === "LISTING")!.guaranteed).toBe(false);
  });

  it("récompense la criée quand on accepte d'attendre", () => {
    const q = quoteAllChannels({ ...base, askPricePerTon: COURS * 1.3 });
    const criee = q.find((x) => x.channel === "LISTING")!;
    const marche = q.find((x) => x.channel === "MARKET")!;
    expect(criee.net).toBeGreaterThan(marche.net);
  });

  it("rapproche le marché du négociant quand on brade un très gros lot", () => {
    // Le sens de la mécanique : dumper 1 500 t érode l'avantage du cours.
    const petit = quoteAllChannels({ ...base, tons: 5 });
    const enorme = quoteAllChannels({ ...base, tons: 1500 });
    const ecartPetit = petit[1].pricePerTon - petit[0].pricePerTon;
    const ecartEnorme = enorme[1].pricePerTon - enorme[0].pricePerTon;
    expect(ecartEnorme).toBeLessThan(ecartPetit);
  });

  it("applique le malus d'humidité à tous les canaux", () => {
    const sec = quoteAllChannels(base);
    const humide = quoteAllChannels({ ...base, moisturePenalty: 0.15 });
    for (let i = 0; i < sec.length; i++) {
      expect(humide[i].net).toBeLessThan(sec[i].net);
    }
  });

  it("ne propose rien de négatif sur un lot minuscule", () => {
    for (const q of quoteAllChannels({ ...base, tons: 0.05 })) {
      expect(q.pricePerTon).toBeGreaterThan(0);
    }
  });
});
