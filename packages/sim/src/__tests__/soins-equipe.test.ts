/**
 * L'employé à l'élevage fait la corvée, et non un pourcentage.
 *
 * ## Ce qui n'allait pas
 *
 * Signalé deux fois en jouant : « je pige toujours pas l'intérêt du PNJ
 * éleveur ». Ce n'était pas un défaut de compréhension. L'employé affecté à
 * l'élevage ne faisait que deux choses — jusqu'à +20 % de production, et vider
 * la fumière — alors que la production est déjà bornée à 100 % par les besoins
 * que le joueur satisfait **à la main**. Le bonus multipliait donc un travail
 * qu'on continuait de faire, tout en payant un salaire pour ça. Aucune
 * configuration ne se rentabilisait ; le test `ne se rentabilisait jamais`
 * ci-dessous rejoue la mesure qui l'a établi.
 *
 * ## Ce que ce fichier tient
 *
 * Que l'équipe refait la mangeoire et la litière, qu'elle le fait **avec
 * votre stock et selon votre ration**, et qu'elle ne devient pas pour autant
 * une immunité : silo vide, tout s'arrête.
 */

import {
  CONCENTRES_PAR_PRIX,
  GOOD_DEFS,
  SEUIL_LITIERE,
  SEUIL_MANGEOIRE,
  gainElevage,
  litiereARefaire,
  mangeoireAServir,
  milkYield,
  rationDeLEquipe,
  rationQuality,
  feedUnits,
  salaireJournalier,
  type StockRation,
} from "@farmsim/shared";

const silo = (p: Partial<StockRation> = {}): StockRation => ({
  HAY: 0,
  MAIZE: 0,
  BARLEY: 0,
  WHEAT: 0,
  SILAGE: 0,
  ...p,
});

/** La qualité de ce que l'équipe a réellement sorti du silo. */
const qualiteDe = (t: StockRation) =>
  rationQuality(t.HAY, t.MAIZE, t.BARLEY, t.WHEAT, t.SILAGE);

const unitesDe = (t: StockRation) => feedUnits(t.HAY, t.MAIZE, t.BARLEY, t.WHEAT, t.SILAGE);

describe("le défaut d’origine", () => {
  it("ne se rentabilisait jamais — c’est la mesure qui a lancé ce module", () => {
    /*
     * On rejoue le calcul plutôt que de le raconter : si un jour le barème
     * change au point que +20 % couvre le salaire, cette assertion tombera et
     * il faudra relire la conception plutôt que de la maintenir par habitude.
     */
    const prixLait = GOOD_DEFS.MILK.basePrice;
    for (const taille of [8, 12, 20]) {
      const litres = milkYield({
        herdSize: taille,
        happiness: 1,
        barnLevel: 2,
        installationLevel: 1,
        feedQuality: 1,
      });
      const brutParJour = (litres / 100) * prixLait;
      const bonus = brutParJour * gainElevage(5);
      const salaire = salaireJournalier({ conduite: 1, mecanique: 1, elevage: 5 });
      expect({ taille, couvreLeSalaire: bonus >= salaire }).toEqual({
        taille,
        couvreLeSalaire: false,
      });
    }
  });
});

describe("quand l’équipe passe", () => {
  it("ressert quand la mangeoire descend sous la moitié, pas avant", () => {
    // Sans seuil, chaque tour de monde rajouterait trois kilos dans l'auge :
    // la mangeoire resterait pleine et la ration cesserait d'être un geste.
    expect(mangeoireAServir({ feedStock: 100, capacite: 100 })).toBe(false);
    expect(mangeoireAServir({ feedStock: 51, capacite: 100 })).toBe(false);
    expect(mangeoireAServir({ feedStock: 49, capacite: 100 })).toBe(true);
    expect(mangeoireAServir({ feedStock: 0, capacite: 100 })).toBe(true);
    expect(SEUIL_MANGEOIRE).toBe(0.5);
  });

  it("repaille plus tard que la mangeoire — la faim prime sur le confort", () => {
    expect(litiereARefaire({ beddingTons: 0.5, capacite: 1 })).toBe(false);
    expect(litiereARefaire({ beddingTons: 0.3, capacite: 1 })).toBe(true);
    expect(SEUIL_LITIERE).toBeLessThan(SEUIL_MANGEOIRE);
  });

  it("ne repaille pas un bâtiment qui n’a pas de litière", () => {
    // Une capacité nulle dit « pas de paille ici ». Sans ce cas, l'équipe
    // jetterait de la paille dans un poulailler sur caillebotis.
    expect(litiereARefaire({ beddingTons: 0, capacite: 0 })).toBe(false);
    expect(mangeoireAServir({ feedStock: 0, capacite: 0 })).toBe(false);
  });
});

describe("ce que l’équipe sort du silo", () => {
  it("comble exactement ce qu’il manque, pas davantage", () => {
    const r = rationDeLEquipe({
      unitesVoulues: 5000,
      qualiteVisee: 0,
      stock: silo({ HAY: 50 }),
    });
    expect(r.complet).toBe(true);
    expect(r.unites).toBeCloseTo(5000, 0);
    expect(unitesDe(r.tonnes)).toBeCloseTo(5000, 0);
    // Cinq tonnes de foin pour cinq mille unités : la valeur du foin est 1.
    expect(r.tonnes.HAY).toBeCloseTo(5, 3);
  });

  it("refait la ration du joueur au lieu d’en choisir une", () => {
    /*
     * Le cœur du module. Un éleveur qui soigne au concentré doit retrouver du
     * concentré dans l'auge ; un éleveur qui mène au foin ne doit pas voir son
     * maïs partir pendant son absence.
     */
    for (const q of [0, 0.25, 0.5, 0.75, 1]) {
      const r = rationDeLEquipe({
        unitesVoulues: 8000,
        qualiteVisee: q,
        stock: silo({ HAY: 100, MAIZE: 100, BARLEY: 100, WHEAT: 100, SILAGE: 100 }),
      });
      expect({ q, complet: r.complet }).toEqual({ q, complet: true });
      expect({ q, ecart: Math.abs(qualiteDe(r.tonnes) - q) < 0.06 }).toEqual({ q, ecart: true });
    }
  });

  it("garde le blé et brûle l’ensilage — le moins cher d’abord", () => {
    // L'ordre n'est pas décoratif : c'est lui qui décide ce que l'équipe
    // consomme à votre insu. Le blé se vend 220 €, l'ensilage 48.
    const r = rationDeLEquipe({
      unitesVoulues: 3000,
      qualiteVisee: 1,
      stock: silo({ SILAGE: 10, BARLEY: 10, MAIZE: 10, WHEAT: 10 }),
    });
    expect(r.tonnes.SILAGE).toBeGreaterThan(0);
    expect(r.tonnes.WHEAT).toBe(0);
    expect(r.tonnes.MAIZE).toBe(0);
    // Et l'ordre déclaré est bien celui des prix du catalogue.
    const prix = CONCENTRES_PAR_PRIX.map((c) => GOOD_DEFS[c].basePrice);
    expect([...prix].sort((a, b) => a - b)).toEqual(prix);
  });

  it("ne prélève jamais plus que le stock", () => {
    const r = rationDeLEquipe({
      unitesVoulues: 100_000,
      qualiteVisee: 0.5,
      stock: silo({ HAY: 2, SILAGE: 1 }),
    });
    expect(r.tonnes.HAY).toBeLessThanOrEqual(2);
    expect(r.tonnes.SILAGE).toBeLessThanOrEqual(1);
    expect(r.complet).toBe(false);
  });

  it("sert à moitié plutôt que pas du tout", () => {
    /*
     * Rendre une ration vide sous prétexte qu'elle serait incomplète
     * laisserait le troupeau à jeun avec du fourrage dans le hangar — le pire
     * des deux mondes, puisque le joueur paie un salaire pour ça.
     */
    const r = rationDeLEquipe({
      unitesVoulues: 10_000,
      qualiteVisee: 0.5,
      stock: silo({ HAY: 3 }),
    });
    expect(r.unites).toBeGreaterThan(0);
    expect(r.tonnes.HAY).toBeCloseTo(3, 3);
    expect(r.complet).toBe(false);
  });

  it("se rabat sur ce qu’il y a quand le camp voulu manque", () => {
    // Ration au concentré demandée, mais il ne reste que du foin : mieux vaut
    // une ration plus pauvre que prévu qu'un troupeau affamé.
    const r = rationDeLEquipe({
      unitesVoulues: 4000,
      qualiteVisee: 1,
      stock: silo({ HAY: 20 }),
    });
    expect(r.complet).toBe(true);
    expect(qualiteDe(r.tonnes)).toBe(0);

    // Et l'inverse : du concentré seulement, pour une ration de foin.
    const r2 = rationDeLEquipe({
      unitesVoulues: 4000,
      qualiteVisee: 0,
      stock: silo({ SILAGE: 20 }),
    });
    expect(r2.complet).toBe(true);
    expect(qualiteDe(r2.tonnes)).toBe(1);
  });

  it("ne rend rien quand il n’y a rien à combler", () => {
    const r = rationDeLEquipe({ unitesVoulues: 0, qualiteVisee: 0.5, stock: silo({ HAY: 10 }) });
    expect(r.unites).toBe(0);
    expect(r.complet).toBe(true);
    for (const t of Object.values(r.tonnes)) expect(t).toBe(0);
  });

  it("ne rend rien quand le silo est vide — et le dit", () => {
    // C'est la borne qui empêche l'employé de devenir une immunité : il
    // puise, il n'achète pas. Silo vide, l'alerte du joueur repart.
    const r = rationDeLEquipe({ unitesVoulues: 5000, qualiteVisee: 0.5, stock: silo() });
    expect(r.unites).toBe(0);
    expect(r.complet).toBe(false);
  });

  it("annonce des unités qui correspondent à ce qu’il a pris", () => {
    // Deux comptes séparés — ce que la fonction annonce, et ce que les tonnes
    // valent — finiraient par diverger, et le silo se viderait d'un côté sans
    // que la mangeoire se remplisse de l'autre.
    for (const q of [0, 0.3, 0.7, 1]) {
      for (const voulu of [500, 3000, 12_000]) {
        const r = rationDeLEquipe({
          unitesVoulues: voulu,
          qualiteVisee: q,
          stock: silo({ HAY: 40, MAIZE: 10, BARLEY: 10, WHEAT: 10, SILAGE: 10 }),
        });
        expect({ q, voulu, ok: Math.abs(unitesDe(r.tonnes) - r.unites) < 1 }).toEqual({
          q,
          voulu,
          ok: true,
        });
        // Et jamais plus que demandé : l'auge a un fond, la route de
        // distribution refuse au-delà de la capacité.
        expect({ q, voulu, pasTrop: r.unites <= voulu + 1 }).toEqual({ q, voulu, pasTrop: true });
      }
    }
  });
});
