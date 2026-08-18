/**
 * Le journal, et la question à laquelle il sert à répondre.
 *
 * Le jeu ne gardait qu'un solde. Savoir qu'on a quatorze mille TRN n'apprend
 * ni si l'élevage paie sa nourriture, ni si la sous-traitance rapporte plus
 * qu'elle ne coûte, ni si une machine mérite d'être gardée — c'est-à-dire
 * aucune des vraies décisions de gestion. Le Bureau affichait donc des
 * chiffres sans pouvoir répondre à sa propre question.
 *
 * Les assertions ci-dessous portent sur la lecture, pas sur l'écriture : ce
 * qui compte est qu'un poste à l'équilibre ne se confonde pas avec un poste
 * inactif, parce que c'est exactement l'écart entre les deux qui décide.
 */

import { LEDGER_POSTES, resultat, totauxParPoste, type LedgerLine } from "@farmsim/shared";

const l = (amount: number, poste: LedgerLine["poste"], label = ""): LedgerLine => ({
  amount,
  poste,
  label,
  at: new Date().toISOString(),
});

describe("totaux par poste", () => {
  it("sépare ce qui rentre de ce qui sort", () => {
    // Un élevage qui encaisse 900 de lait et dépense 900 de fourrage n'est pas
    // un élevage sans activité : c'est un élevage qui ne gagne rien. Les deux
    // se ressemblent au solde et n'ont rien à voir en gestion.
    const t = totauxParPoste([l(900, "ELEVAGE", "Lait"), l(-900, "ELEVAGE", "Fourrage")]);
    expect(t).toHaveLength(1);
    expect(t[0].recettes).toBe(900);
    expect(t[0].depenses).toBe(900);
    expect(t[0].solde).toBe(0);
  });

  it("tait les postes sans mouvement", () => {
    // Huit postes affichés dont sept à zéro, c'est sept lignes à écarter du
    // regard avant de lire la seule qui parle.
    const t = totauxParPoste([l(120, "CULTURES")]);
    expect(t.map((x) => x.poste)).toEqual(["CULTURES"]);
    expect(LEDGER_POSTES.length).toBeGreaterThan(1);
  });

  it("met en tête ce qui pèse le plus, dans un sens comme dans l’autre", () => {
    // Un poste qui saigne mérite le haut de la liste autant qu'un poste qui
    // rapporte : on trie sur l'ampleur, pas sur le signe.
    const t = totauxParPoste([
      l(50, "CULTURES"),
      l(-4000, "MACHINES", "Achat moissonneuse"),
      l(300, "CHANTIERS"),
    ]);
    expect(t[0].poste).toBe("MACHINES");
    expect(t[1].poste).toBe("CHANTIERS");
  });

  it("ne perd rien en route", () => {
    const lignes = [
      l(900, "ELEVAGE"), l(-120, "ELEVAGE"), l(2400, "CULTURES"),
      l(-737, "MACHINES"), l(-1500, "TERRES"), l(310, "CHANTIERS"),
    ];
    const total = totauxParPoste(lignes).reduce((s, t) => s + t.solde, 0);
    expect(total).toBeCloseTo(resultat(lignes).solde, 6);
  });
});

describe("résultat d’ensemble", () => {
  it("compte les deux sens séparément", () => {
    const r = resultat([l(1000, "CULTURES"), l(-400, "INTRANTS"), l(-100, "MACHINES")]);
    expect(r.recettes).toBe(1000);
    expect(r.depenses).toBe(500);
    expect(r.solde).toBe(500);
  });

  it("ne s’effraie pas d’un journal vide", () => {
    expect(resultat([])).toEqual({ recettes: 0, depenses: 0, solde: 0 });
    expect(totauxParPoste([])).toEqual([]);
  });
});
