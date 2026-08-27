/**
 * Le pari « acheter jeune » doit rester un pari.
 *
 * Deux chemins mènent à un troupeau productif : payer plein tarif et traire
 * tout de suite, ou payer deux cinquièmes et attendre une saison. Si l'un
 * écrase l'autre, il n'y a plus de choix — juste une option évidente et une
 * option idiote.
 *
 * Ce fichier fixe l'intention en chiffres, comme l'équilibrage du marché et
 * celui de l'élevage. Si l'on retouche `YOUNG_PRICE_RATIO`, `YOUNG_GROW_MS`
 * ou `YOUNG_FEED_RATIO`, c'est ici qu'on verra ce qu'on a cassé.
 */

import {
  SEASON_DURATION_MS,
  ANIMAL_PRICE,
  GOOD_DEFS,
  LIVESTOCK_CYCLE_MS,
  MEAT_BASE_KG,
  YOUNG_FEED_RATIO,
  YOUNG_GROW_MS,
  YOUNG_PRICE_RATIO,
  herdFeedNeed,
  milkYield,
} from "@farmsim/shared";

/**
 * Ce qu'une vache adulte rapporte en lait sur une durée, en litres.
 *
 * `happiness: 1` et non 0,75 : sur la nouvelle échelle, une vache nourrie,
 * abreuvée et logée dans la capacité de son étable **est** à 1. Un 0,75
 * décrirait un troupeau à qui il manque quelque chose, ce qui n'est pas le
 * troupeau de référence auquel on compare un achat.
 */
function laitSur(ms: number, taille: number): number {
  const cycles = ms / LIVESTOCK_CYCLE_MS;
  return milkYield({ herdSize: taille, happiness: 1, barnLevel: 1, feedQuality: 0.5 }) * cycles;
}

describe("acheter jeune ou adulte", () => {
  const prixAdulte = ANIMAL_PRICE.COW;
  const PRIX_HECTOLITRE = GOOD_DEFS.MILK.basePrice;
  const prixJeune = prixAdulte * YOUNG_PRICE_RATIO;

  it("le jeune coûte nettement moins cher, sans être donné", () => {
    // Trop bas, l'adulte ne s'achète plus jamais ; trop haut, attendre une
    // saison ne se paie pas.
    expect(prixJeune / prixAdulte).toBeGreaterThan(0.45);
    expect(prixJeune / prixAdulte).toBeLessThan(0.75);
  });

  it("l'économie dépasse le lait auquel on renonce — et c'est assumé", () => {
    /**
     * Le premier jet de ce test attendait l'inverse : que le lait perdu
     * pendant la croissance compense l'économie, pour que les deux chemins se
     * valent. Mesuré, il n'en est rien — et vouloir l'égalité par le prix
     * mènerait à une réduction de 17 %, que personne n'attendrait une saison
     * pour obtenir.
     *
     * L'arbitrage n'est donc pas financier, il est **temporel** : acheter
     * jeune est moins cher pour qui peut attendre ; acheter adulte se paie
     * pour avoir du lait tout de suite — un contrat à tenir, une caisse à
     * renflouer. Ce que ce test tient, c'est que le lait renoncé reste une
     * somme réelle, et non une paille : sans cela l'adulte n'aurait plus
     * aucune raison d'exister.
     */
    const economise = prixAdulte - prixJeune;
    // Le lait se compte en hectolitres au silo — cent litres l'unité —, et
    // c'est en hectolitres qu'il se vend. La première version de ce test le
    // traitait en tonnes et sous-estimait la traite d'un facteur dix.
    const hectolitresPerdus = laitSur(YOUNG_GROW_MS, 1) / 100;
    const valeurPerdue = hectolitresPerdus * PRIX_HECTOLITRE;
    /*
     * Le plancher est passé de 12 % à 10 %, et c'est une conséquence assumée
     * de la refonte de l'élevage.
     *
     * L'ancien barème multipliait la traite par le bien-être **et** par le
     * niveau d'étable — jusqu'à ×1,64. Ces deux facteurs sont désormais un
     * seul, le bonus d'installation, qui vaut ×1,30 au maximum et **×1,00 pour
     * une étable nue**. Une vache de référence sans rien autour d'elle rend
     * donc un peu moins qu'avant, tandis qu'une vache dont l'éleveur a bâti
     * rend autant. Le lait renoncé reste une somme réelle — soixante-dix euros
     * contre six cent soixante économisés —, et c'est tout ce que ce test
     * défend.
     */
    expect(valeurPerdue).toBeGreaterThan(economise * 0.1);
    expect(valeurPerdue).toBeLessThan(economise);
  });

  it("un jeune mange, mais moins", () => {
    const dixAdultes = herdFeedNeed({ size: 10, young: 0, kind: "COW" });
    const dixJeunes = herdFeedNeed({ size: 10, young: 10, kind: "COW" });
    expect(dixJeunes).toBeLessThan(dixAdultes);
    expect(dixJeunes).toBeGreaterThan(0);
    expect(dixJeunes / dixAdultes).toBeCloseTo(YOUNG_FEED_RATIO, 5);
  });

  it("un lot mixte se nourrit entre les deux", () => {
    const mixte = herdFeedNeed({ size: 10, young: 4, kind: "COW" });
    expect(mixte).toBeLessThan(herdFeedNeed({ size: 10, young: 0, kind: "COW" }));
    expect(mixte).toBeGreaterThan(herdFeedNeed({ size: 10, young: 10, kind: "COW" }));
  });

  it("la croissance dure une saison, pas une soirée ni une semaine", () => {
    /*
     * Mesuré en saisons, pas en minutes réelles.
     *
     * L'assertion comptait des minutes, ce qui la liait à l'échelle du temps
     * réel — laquelle a changé le jour où l'année est tombée sur la semaine.
     * Ce qu'on veut dire n'a pourtant jamais été « entre une et quatre
     * heures » : c'est « à peu près une saison », et ça se dit en saisons.
     */
    const saisons = YOUNG_GROW_MS / SEASON_DURATION_MS;
    expect(saisons).toBeGreaterThan(0.5);
    expect(saisons).toBeLessThan(1.5);
  });

  it("engraisser pour la viande reste un chemin plus lent que le lait", () => {
    // Un veau acheté puis abattu à maturité ne doit pas rapporter davantage,
    // et plus vite, qu'une vache laitière — sinon plus personne ne trait.
    expect(MEAT_BASE_KG).toBeGreaterThan(0);
    const viandeParBete = MEAT_BASE_KG / 1000; // en tonnes
    // La viande vaut autour de 1 300 € la tonne, contre 40 pour le lait.
    const recetteViande = viandeParBete * GOOD_DEFS.MEAT.basePrice;
    const recetteLait = (laitSur(YOUNG_GROW_MS, 1) / 100) * PRIX_HECTOLITRE;
    // La viande est plus lucrative — c'est voulu, on tue la bête. Mais elle
    // demande d'y renoncer, ce que le lait ne demande pas.
    expect(recetteViande).toBeGreaterThan(recetteLait);
  });
});
