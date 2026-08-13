import {
  ANIMAL_PRICE,
  BREEDING,
  EGGS_BASE_PER_HEN,
  FEED_BASE,
  FEED_VALUE,
  GOOD_DEFS,
  MARKET_BOUNDS,
  SELLABLE_GOODS,
  SPOILAGE_PER_CYCLE,
  WOOL_BASE_PER_SHEEP,
  eggYield,
  feedUnits,
  isPerishable,
  kindForBarn,
  litterFor,
  meatBaseKg,
  meatYield,
  rationQuality,
  woolYield,
  yardTypeForBarn,
} from "@farmsim/shared";

const CYCLE = 15 * 60 * 1000;

describe("poules et moutons — bâtiments", () => {
  it("associe chaque bâtiment à son espèce et à son aire", () => {
    expect(kindForBarn("CATTLE_BARN")).toBe("COW");
    expect(kindForBarn("PIGSTY")).toBe("PIG");
    expect(kindForBarn("HENHOUSE")).toBe("HEN");
    expect(kindForBarn("SHEEPFOLD")).toBe("SHEEP");
    expect(kindForBarn("SILO")).toBeNull();
    expect(yardTypeForBarn("PIGSTY")).toBe("PIG_YARD");
    expect(yardTypeForBarn("HENHOUSE")).toBe("HEN_YARD");
    expect(yardTypeForBarn("CATTLE_BARN")).toBe("PADDOCK");
    expect(yardTypeForBarn("SHEEPFOLD")).toBe("PADDOCK");
  });

  it("vend les poules et les moutons moins cher que les bovins", () => {
    expect(ANIMAL_PRICE.HEN).toBe(28);
    expect(ANIMAL_PRICE.SHEEP).toBe(160);
    expect(ANIMAL_PRICE.HEN).toBeLessThan(ANIMAL_PRICE.COW);
    expect(ANIMAL_PRICE.SHEEP).toBeLessThan(ANIMAL_PRICE.COW);
  });

  it("donne une ration plus légère aux poules et aux moutons", () => {
    expect(FEED_BASE.HEN).toBe(2);
    expect(FEED_BASE.SHEEP).toBe(8);
    expect(FEED_BASE.HEN).toBeLessThan(FEED_BASE.SHEEP);
    expect(FEED_BASE.SHEEP).toBeLessThan(FEED_BASE.COW);
  });
});

describe("poules et moutons — production", () => {
  const base = { herdSize: 10, happiness: 0.7, barnLevel: 1, feedQuality: 0.3 };

  it("pond des caisses d'œufs, pas des litres", () => {
    const crates = eggYield(base);
    expect(crates).toBeGreaterThan(0);
    expect(crates).toBeLessThan(EGGS_BASE_PER_HEN * 10 * 2);
  });

  it("tond peu de laine par mouton", () => {
    const tons = woolYield(base);
    expect(tons).toBeGreaterThan(0);
    expect(tons).toBeLessThan(WOOL_BASE_PER_SHEEP * 10 * 2);
  });

  it("donne une carcasse légère à la poule, moyenne au mouton", () => {
    expect(meatBaseKg("HEN")).toBe(2.2);
    expect(meatBaseKg("SHEEP")).toBe(42);
    expect(meatBaseKg("COW")).toBe(280);
    const poule = meatYield({
      herdSize: 1,
      happiness: 0.7,
      averageAgeMs: CYCLE * 30,
      barnLevel: 1,
      kind: "HEN",
    });
    const mouton = meatYield({
      herdSize: 1,
      happiness: 0.7,
      averageAgeMs: CYCLE * 30,
      barnLevel: 1,
      kind: "SHEEP",
    });
    expect(poule).toBeLessThan(mouton);
    expect(mouton).toBeLessThan(280);
  });
});

describe("poules et moutons — reproduction", () => {
  it("fait porter la poule plus vite, avec une portée plus large", () => {
    expect(BREEDING.gestationCycles.HEN).toBe(2);
    expect(BREEDING.gestationCycles.SHEEP).toBe(5);
    expect(BREEDING.gestationCycles.HEN).toBeLessThan(BREEDING.gestationCycles.SHEEP);
    expect(litterFor("HEN", 20)).toBe(6);
    expect(litterFor("SHEEP", 20)).toBe(1);
  });
});

describe("poules et moutons — marché", () => {
  it("vend les œufs et la laine à la halle", () => {
    expect(GOOD_DEFS.EGGS.sellable).toBe(true);
    expect(GOOD_DEFS.WOOL.sellable).toBe(true);
    expect(SELLABLE_GOODS).toContain("EGGS");
    expect(SELLABLE_GOODS).toContain("WOOL");
    expect(MARKET_BOUNDS.EGGS).toBeDefined();
    expect(MARKET_BOUNDS.WOOL).toBeDefined();
  });

  it("gâte les œufs, pas la laine", () => {
    expect(isPerishable("EGGS")).toBe(true);
    expect(isPerishable("WOOL")).toBe(false);
    expect(SPOILAGE_PER_CYCLE.EGGS).toBe(0.18);
    expect(SPOILAGE_PER_CYCLE.WOOL ?? 0).toBe(0);
  });

  it("compte le blé dans la ration", () => {
    expect(FEED_VALUE.WHEAT).toBe(1.1);
    expect(feedUnits(0, 0, 0, 1)).toBeGreaterThan(feedUnits(1, 0));
    expect(rationQuality(0, 0, 0, 10)).toBe(1);
    expect(rationQuality(5, 0, 0, 5)).toBeCloseTo(0.5, 2);
  });
});
