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
    const p = marketNpcPressure({
      weatherStates: ["CLEAR"],
      season,
      price,
      reference: B.initial,
      rng: rnd,
    });
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

  it("ne tient pas debout grâce à un rappel décrété", () => {
    /**
     * La question de fond : *pourquoi* le cours reviendrait-il à 220 ?
     *
     * Il ne le devrait pas, et ce n'est plus ce qui se passe. Le rappel vers
     * `initial` n'est plus qu'un garde-fou contre les murs `min`/`max` : sa
     * demi-vie dépasse l'heure, quand une saison entière dure moins de deux
     * heures. Ce qui ramène le cours, c'est l'offre PNJ qui se retire.
     */
    const demiVieMin = (Math.log(2) / -Math.log(1 - MARKET_REVERSION)) * (SIM_TICK_MS / 60_000);
    expect(demiVieMin).toBeGreaterThan(60);
  });
});

describe("ce qui ramène le cours, c’est l’offre, pas un décret", () => {
  const B = MARKET_BOUNDS.WHEAT;
  const flux = (price: number) =>
    marketNpcPressure({
      weatherStates: ["CLEAR"],
      season: "SUMMER",
      price,
      reference: B.initial,
      rng: () => 0.5,
    });

  it("un cours effondré fait fuir les vendeurs et venir les acheteurs", () => {
    const bas = flux(B.initial * 0.6);
    const ref = flux(B.initial);
    expect(bas.supplyTons).toBeLessThan(ref.supplyTons);
    expect(bas.demandTons).toBeGreaterThan(ref.demandTons);
  });

  it("un cours élevé fait sortir les greniers", () => {
    const haut = flux(B.initial * 1.5);
    const ref = flux(B.initial);
    expect(haut.supplyTons).toBeGreaterThan(ref.supplyTons);
    expect(haut.demandTons).toBeLessThan(ref.demandTons);
  });

  it("mais l’offre ne se retire jamais complètement", () => {
    // Sans cette butée, inonder son marché n'aurait aucune conséquence : les
    // voisins se retireraient à mesure et le prix ne bougerait pas.
    const effondre = flux(B.min);
    expect(effondre.supplyTons).toBeGreaterThan(0.3);
  });

  it("et un excédent qui dure tient le cours bas tant qu’il dure", () => {
    /**
     * L'inverse du rappel décrété : tant que le joueur déverse, le cours reste
     * au fond. Il ne remonte que lorsqu'il arrête — parce que l'excédent s'est
     * écoulé, pas parce qu'une constante l'a ramené chez lui.
     */
    const tourne = (n: number, etat: { p: number; s: number }, joueur: number) => {
      for (let i = 0; i < n; i++) {
        const p = flux(etat.p);
        const out = tickMarket({
          commodity: "WHEAT",
          price: etat.p,
          supplyTons: p.supplyTons + joueur,
          demandTons: p.demandTons,
          stockTons: etat.s,
        });
        etat = { p: out.price, s: out.stockTons };
      }
      return etat;
    };
    const calme = tourne(600, { p: B.initial, s: B.depth * 0.3 }, 0);
    const noye = tourne(TICKS_SAISON, { ...calme }, 3);
    expect(noye.p).toBeLessThan(calme.p * 0.75);
    const apres = tourne(TICKS_SAISON, { ...noye }, 0);
    expect(apres.p).toBeGreaterThan(noye.p * 1.2);
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
    // Seuil descendu de 0,20 à 0,15 le jour où l'offre PNJ est devenue
    // élastique : les voisins se retirent à mesure que le cours cède, et
    // amortissent une partie du déversement. C'est le comportement voulu — la
    // mesure est passée de 24 % à 18 %, l'intention tient.
    const gros = effet(20);
    expect(gros).toBeGreaterThan(0.15);
    expect(gros).toBeLessThan(0.5);
  });

  it("et l’effet croît avec la surface, sans marche d’escalier", () => {
    expect(effet(20)).toBeGreaterThan(effet(10));
    expect(effet(10)).toBeGreaterThan(effet(5));
  });
});
