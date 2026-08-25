import {
  MARKET_BOUNDS,
  MARKET_DEPTH_FLOOR,
  type TradeGood,
  type WeatherState,
} from "@farmsim/shared";
import { marketNpcPressure, tickMarket } from "../index";

/**
 * Le marché avait dérivé jusqu'à coller trois marchandises sur cinq à leur
 * plafond : guetter les cours ne servait plus à rien et le canal « cours
 * mondial » payait toujours le maximum. Ces tests interdisent la récidive.
 */
describe("stabilité du marché sur la durée", () => {
  const GOODS: TradeGood[] = ["WHEAT", "MAIZE", "MILK", "MEAT", "HAY"];

  function simulate(commodity: TradeGood, ticks: number, states: WeatherState[]) {
    const bounds = MARKET_BOUNDS[commodity];
    let price = bounds.initial;
    let stockTons = bounds.depth;
    const history: number[] = [];
    for (let i = 0; i < ticks; i++) {
      /*
       * On passe le cours et la référence : sans eux, `marketNpcPressure`
       * retombe sur des flux **inélastiques**, et c'est l'élasticité qui tient
       * le marché — les vendeurs se retirent quand le cours cède, les
       * acheteurs reviennent. Ce harnais était l'un des « vieux tests » que la
       * doc de la fonction mentionne : il simulait un carnet plein en
       * permanence, sans personne pour réagir au prix, et vérifiait ensuite
       * que le prix ne s'effondrait pas. Il ne tenait que parce que le cours
       * réagissait peu par saison.
       */
      const pressure = marketNpcPressure({
        weatherStates: states,
        price,
        reference: bounds.initial,
      });
      const r = tickMarket({
        commodity,
        price,
        supplyTons: pressure.supplyTons,
        demandTons: pressure.demandTons,
        stockTons,
      });
      price = r.price;
      stockTons = r.stockTons;
      history.push(price);
    }
    return { price, stockTons, history };
  }

  it("ne colle aucune marchandise à son plafond après 500 ticks", () => {
    for (const g of GOODS) {
      const { price } = simulate(g, 500, ["CLEAR"]);
      const bounds = MARKET_BOUNDS[g];
      expect({ g, saturé: price >= bounds.max * 0.99 }).toEqual({ g, saturé: false });
    }
  });

  it("ne colle aucune marchandise à son plancher non plus", () => {
    for (const g of GOODS) {
      const { price } = simulate(g, 500, ["STORM", "STORM"]);
      const bounds = MARKET_BOUNDS[g];
      expect({ g, effondré: price <= bounds.min * 1.01 }).toEqual({ g, effondré: false });
    }
  });

  it("garde les cours dans une fourchette raisonnable autour de la référence", () => {
    for (const g of GOODS) {
      const { price } = simulate(g, 500, ["CLEAR"]);
      const ref = MARKET_BOUNDS[g].initial;
      expect(price).toBeGreaterThan(ref * 0.5);
      expect(price).toBeLessThan(ref * 2);
    }
  });

  it("laisse malgré tout le cours bouger : un marché figé n'a pas d'intérêt", () => {
    const { history } = simulate("WHEAT", 120, ["CLEAR"]);
    const min = Math.min(...history);
    const max = Math.max(...history);
    expect(max - min).toBeGreaterThan(1);
  });

  it("maintient une profondeur de carnet, même après une longue série de ventes", () => {
    for (const g of GOODS) {
      const bounds = MARKET_BOUNDS[g];
      let stockTons = bounds.depth;
      let price = bounds.initial;
      for (let i = 0; i < 200; i++) {
        const r = tickMarket({
          commodity: g,
          price,
          supplyTons: 0,
          demandTons: 500,
          stockTons,
        });
        price = r.price;
        stockTons = r.stockTons;
      }
      expect(stockTons).toBeGreaterThanOrEqual(bounds.depth * MARKET_DEPTH_FLOOR - 0.01);
    }
  });
});
