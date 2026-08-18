/**
 * Équilibrage du marché — ce que les cours produisent réellement.
 *
 * L'audit avait mesuré trois choses, et les trois disaient la même : le
 * marché tournait à vide.
 *
 * 1. **La production du joueur ne comptait pas.** Zéro, une, cinq ou vingt
 *    parcelles finissaient au même prix au centime près. Les flux PNJ valaient
 *    près de vingt mille tonnes à l'heure quand une parcelle en produit
 *    quarante : le marché voisin pesait 491 fois une ferme.
 * 2. **Attendre ne rapportait rien.** Un écart de prix était comblé de moitié
 *    en cent-huit secondes, et les cours ne s'écartaient jamais de plus de
 *    29 % quand leurs bornes en permettaient 150.
 * 3. **Aucune saison.** La pression PNJ ne lisait que la météo.
 *
 * Ce fichier simule huit saisons et fixe les intentions. Comme pour
 * l'équilibrage de l'élevage : si l'on retouche une constante, c'est ici qu'on
 * verra ce qu'on a cassé, pas trois semaines plus tard en jouant.
 */

import {
  CROP_DEFS,
  MARKET_BOUNDS,
  MARKET_REVERSION,
  SEASON_DURATION_MS,
  SIM_TICK_MS,
  type Season,
} from "@farmsim/shared";
import { marketNpcPressure, tickMarket } from "../index";

const TICKS_SAISON = Math.round(SEASON_DURATION_MS / SIM_TICK_MS);
const TICKS_RECOLTE = Math.round(CROP_DEFS.WHEAT.growMs / SIM_TICK_MS);
/** Ce qu'une parcelle de 12 × 12 rentre à chaque moisson. */
const RECOLTE = 144 * CROP_DEFS.WHEAT.yieldPerCell;
const SAISONS: Season[] = ["SPRING", "SUMMER", "AUTUMN", "WINTER"];

/** Fait tourner le marché sur `saisons` saisons, le joueur y déversant sa récolte. */
function anneeDeMarche(opts: { parcelles?: number; saisons?: number; graine?: number }) {
  const B = MARKET_BOUNDS.WHEAT;
  let price = B.initial;
  let stock = B.depth * 0.3;
  let s = opts.graine ?? 11;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const ticks = TICKS_SAISON * (opts.saisons ?? 8);
  const parSaison: Record<Season, { somme: number; n: number }> = {
    SPRING: { somme: 0, n: 0 }, SUMMER: { somme: 0, n: 0 },
    AUTUMN: { somme: 0, n: 0 }, WINTER: { somme: 0, n: 0 },
  };
  let min = Infinity;
  let max = 0;

  for (let i = 0; i < ticks; i++) {
    const season = SAISONS[Math.floor(i / TICKS_SAISON) % 4];
    if (opts.parcelles && i > 0 && i % TICKS_RECOLTE === 0) {
      stock += RECOLTE * opts.parcelles;
    }
    const p = marketNpcPressure({ weatherStates: ["CLEAR"], season, rng: rnd });
    const out = tickMarket({
      commodity: "WHEAT",
      price,
      supplyTons: p.supplyTons,
      demandTons: p.demandTons,
      stockTons: stock,
    });
    price = out.price;
    stock = out.stockTons;
    // On ignore la première saison : le marché part d'un état arbitraire.
    if (i > TICKS_SAISON) {
      parSaison[season].somme += price;
      parSaison[season].n += 1;
      min = Math.min(min, price);
      max = Math.max(max, price);
    }
  }
  const moy = (x: Season) => parSaison[x].somme / Math.max(1, parSaison[x].n);
  const moyenne = SAISONS.reduce((a, x) => a + moy(x), 0) / 4;
  return { moy, moyenne, min, max, stock };
}

/** Moyenne sur plusieurs graines : une seule est du bruit, pas une mesure. */
function moyenneRobuste(parcelles: number): number {
  const graines = [3, 11, 29, 47, 83];
  return (
    graines.reduce((a, g) => a + anneeDeMarche({ parcelles, graine: g }).moyenne, 0) /
    graines.length
  );
}

describe("le marché sans joueur", () => {
  const r = anneeDeMarche({});

  it("ne dérive pas loin de son prix de référence", () => {
    expect(Math.abs(r.moyenne - MARKET_BOUNDS.WHEAT.initial)).toBeLessThan(35);
  });

  it("ne se colle à aucune de ses bornes", () => {
    // Un cours plaqué au plafond ou au plancher ne dit plus rien, et c'est
    // l'état où finissaient blé et viande avant le rappel au prix moyen.
    expect(r.min).toBeGreaterThan(MARKET_BOUNDS.WHEAT.min + 5);
    expect(r.max).toBeLessThan(MARKET_BOUNDS.WHEAT.max - 5);
  });

  it("respire assez pour qu’on regarde les cours", () => {
    // 29 % de battement sur 150 % permis, c'était l'ancien état : le marché
    // occupait un sixième de son échelle.
    const battement = (r.max - r.min) / MARKET_BOUNDS.WHEAT.initial;
    expect(battement).toBeGreaterThan(0.2);
    expect(battement).toBeLessThan(0.6);
  });

  it("laisse un écart de prix vivre plus que deux minutes", () => {
    // Demi-vie : c'est elle qui décide si « attendre un meilleur cours » est
    // une stratégie ou de la patience. Elle valait 108 secondes.
    const demiVieMin = (Math.log(2) / -Math.log(1 - MARKET_REVERSION)) * (SIM_TICK_MS / 60_000);
    expect(demiVieMin).toBeGreaterThan(8);
  });
});

describe("la saison décide du cours", () => {
  const r = anneeDeMarche({});

  it("l’automne est le moins cher — c’est la moisson du voisinage", () => {
    for (const autre of ["SPRING", "SUMMER", "WINTER"] as Season[]) {
      expect(r.moy("AUTUMN")).toBeLessThan(r.moy(autre));
    }
  });

  it("le printemps est le plus cher — c’est la soudure", () => {
    for (const autre of ["SUMMER", "AUTUMN", "WINTER"] as Season[]) {
      expect(r.moy("SPRING")).toBeGreaterThan(r.moy(autre));
    }
  });

  it("l’écart vaut la peine d’engranger, sans rendre la vente immédiate absurde", () => {
    const ecart = (r.moy("SPRING") - r.moy("AUTUMN")) / r.moyenne;
    expect(ecart).toBeGreaterThan(0.1);
    expect(ecart).toBeLessThan(0.35);
  });
});

describe("la production du joueur pèse sur le cours", () => {
  const sans = moyenneRobuste(0);
  const effet = (parcelles: number) => (sans - moyenneRobuste(parcelles)) / sans;

  it("une petite ferme subit le cours plutôt qu’elle ne le fait", () => {
    // C'est la bonne réponse économique : un producteur isolé est preneur de
    // prix. Ce qui était faux, c'est que vingt parcelles l'étaient aussi.
    expect(Math.abs(effet(1))).toBeLessThan(0.03);
  });

  it("un domaine moyen se voit sur les cours", () => {
    expect(effet(5)).toBeGreaterThan(0.04);
  });

  it("un gros domaine fait céder son propre marché", () => {
    // La sanction du surproducteur, et la raison d'aller vendre ailleurs ou
    // de transformer plutôt que de tout écouler brut.
    const gros = effet(20);
    expect(gros).toBeGreaterThan(0.2);
    expect(gros).toBeLessThan(0.5);
  });

  it("et l’effet croît avec la surface, sans marche d’escalier", () => {
    expect(effet(20)).toBeGreaterThan(effet(10));
    expect(effet(10)).toBeGreaterThan(effet(5));
  });
});
