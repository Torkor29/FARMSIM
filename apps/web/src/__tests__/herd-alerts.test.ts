import { feedDaysLeft, herdAlerts, herdBadgeCount, type BarnSnapshot } from "../ui/herd-alerts";

const troupeau = (over: Partial<BarnSnapshot["herd"]> = {}): BarnSnapshot => ({
  buildingId: "b1",
  name: "Étable nord",
  paddockCapacity: 12,
  herd: {
    id: "h1",
    kind: "COW",
    size: 6,
    atRisk: false,
    hungry: false,
    feedStock: 100,
    feedNeed: 20,
    beddingCover: 1,
    manureFill: 0,
    smelly: false,
    housing: "INSIDE",
    thermalAlert: "none",
    tempC: 12,
    grassTons: 2,
    grazes: true,
    ...over,
  } as BarnSnapshot["herd"],
});

describe("alertes d'élevage", () => {
  it("ne dit rien d'une étable vide — c'est le bug de l'étable fantôme", () => {
    expect(herdAlerts([{ buildingId: "b1", name: "Étable", paddockCapacity: 0, herd: null }])).toEqual([]);
    expect(herdAlerts([troupeau({ size: 0, atRisk: true, hungry: true })])).toEqual([]);
  });

  it("ne dit rien d'un troupeau qui va bien", () => {
    expect(herdAlerts([troupeau()])).toEqual([]);
  });

  it("classe la mortalité avant tout le reste", () => {
    const a = herdAlerts([
      troupeau({ atRisk: true, hungry: true, beddingCover: 0, smelly: true, canMilk: true }),
    ]);
    expect(a[0].level).toBe("danger");
    expect(a[0].action.kind).toBe("FEED");
    // Et l'information passe en dernier : la traite n'est pas un problème.
    expect(a[a.length - 1].level).toBe("info");
  });

  it("mène à l’hôtel des ventes quand il ne reste rien à distribuer", () => {
    // « Nourrir » sur une réserve vide distribuait du vide : le bouton
    // s'appuyait, l'alerte revenait, et rien n'expliquait pourquoi.
    const a = herdAlerts([troupeau({ atRisk: true, hungry: true })], { hasFeed: false });
    expect(a[0].action.kind).toBe("BUY_FEED");
    expect(a[0].actionLabel).toMatch(/Acheter/);
    expect(a[0].text).toMatch(/rien à distribuer/);
  });

  it("garde le geste de distribution tant qu’il reste de quoi", () => {
    const a = herdAlerts([troupeau({ atRisk: true, hungry: true })], { hasFeed: true });
    expect(a[0].action.kind).toBe("FEED");
    expect(a[0].actionLabel).toBe("Nourrir");
  });

  it("applique la même règle à la litière", () => {
    const sansPaille = herdAlerts([troupeau({ beddingCover: 0 })], { hasStraw: false });
    expect(sansPaille[0].action.kind).toBe("BUY_FEED");
    const avec = herdAlerts([troupeau({ beddingCover: 0 })], { hasStraw: true });
    expect(avec[0].action.kind).toBe("BEDDING");
  });

  it("ne double pas faim et mortalité — une seule alerte de ration", () => {
    const a = herdAlerts([troupeau({ atRisk: true, hungry: true })]);
    expect(a.filter((x) => x.action.kind === "FEED")).toHaveLength(1);
  });

  it("propose de rentrer quand les bêtes souffrent dehors", () => {
    const a = herdAlerts([troupeau({ housing: "OUTSIDE", thermalAlert: "danger", tempC: -8 })]);
    expect(a[0].action.kind).toBe("SHELTER");
    expect(a[0].actionLabel).toBe("Rentrer");
    expect(a[0].icon).toBe("❄️");
  });

  it("propose de sortir quand c'est le bâtiment qui étouffe", () => {
    const a = herdAlerts([troupeau({ housing: "INSIDE", thermalAlert: "danger", tempC: 34 })]);
    expect(a[0].action.kind).toBe("GRAZE");
    expect(a[0].icon).toBe("🔥");
  });

  it("signale un pré épuisé, mais seulement aux bêtes qui broutent", () => {
    const rumine = herdAlerts([troupeau({ housing: "OUTSIDE", grassTons: 0, grazes: true })]);
    expect(rumine.some((x) => x.id.endsWith(":grass"))).toBe(true);
    // Un cochon ne pâture pas : lui parler d'herbe n'aurait aucun sens.
    const cochon = herdAlerts([
      troupeau({ kind: "PIG", housing: "OUTSIDE", grassTons: 0, grazes: false }),
    ]);
    expect(cochon.some((x) => x.id.endsWith(":grass"))).toBe(false);
  });

  it("ne réclame pas de litière pour des bêtes au pré", () => {
    const dehors = herdAlerts([troupeau({ housing: "OUTSIDE", beddingCover: 0 })]);
    expect(dehors.some((x) => x.action.kind === "BEDDING")).toBe(false);
    const dedans = herdAlerts([troupeau({ housing: "INSIDE", beddingCover: 0 })]);
    expect(dedans.some((x) => x.action.kind === "BEDDING")).toBe(true);
  });

  it("ne compte pas l'information dans la pastille", () => {
    const a = herdAlerts([troupeau({ canMilk: true })]);
    expect(a).toHaveLength(1);
    expect(herdBadgeCount(a)).toBe(0);
  });

  it("porte toujours une action — une alerte sans geste est une inquiétude", () => {
    const a = herdAlerts([
      troupeau({ atRisk: true, beddingCover: 0, smelly: true, canMilk: true, thermalAlert: "danger" }),
    ]);
    expect(a.length).toBeGreaterThan(3);
    for (const x of a) expect(x.actionLabel.length).toBeGreaterThan(0);
  });
});

describe("jours de ration", () => {
  it("traduit un stock en durée, ce qui se décide", () => {
    expect(feedDaysLeft({ feedStock: 100, feedNeed: 20 })).toBe(5);
  });

  it("ne divise pas par zéro sur un lot sans besoin", () => {
    expect(feedDaysLeft({ feedStock: 5, feedNeed: 0 })).toBe(Infinity);
  });
});
