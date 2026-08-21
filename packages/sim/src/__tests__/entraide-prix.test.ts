import {
  MISSION_CELLS_MIN,
  MISSION_CELLS_MAX,
  laborEscrow,
  missionPayout,
} from "@farmsim/shared";

/**
 * Le prix de l'entraide suit le travail réel.
 *
 * Deux choses se tenaient, et il fallait les défaire ensemble.
 *
 * L'entraide était plafonnée à vingt-quatre cases : « Déchaumer · 144 cases »
 * et, à côté, « L'entraide se demande par 24 cases au plus ». Ces
 * vingt-quatre étaient le calibre des offres **PNJ** — la taille à laquelle
 * on découpe le tableau — et rien ne justifiait de l'imposer à quelqu'un qui
 * veut faire déchaumer sa parcelle.
 *
 * Mais `laborEscrow` écrêtait aussi à vingt-quatre **avant de chiffrer**.
 * Tant que la route refusait au-delà, le trou restait fermé par accident ; il
 * se serait ouvert à la seconde où l'on levait la limite — l'aidant aurait
 * labouré cent quarante-quatre cases pour le salaire de vingt-quatre. Lever
 * le plafond sans corriger le prix aurait transformé une gêne en vol.
 */
describe("le prix de l’entraide", () => {
  it("croît avec le nombre de cases, au-delà du calibre PNJ", () => {
    const petit = laborEscrow("STUBBLE", MISSION_CELLS_MAX);
    const grand = laborEscrow("STUBBLE", MISSION_CELLS_MAX * 6);
    expect(grand.escrow).toBeGreaterThan(petit.escrow);
  });

  it("ne facture plus 144 cases comme 24", () => {
    // Le cœur du trou : les deux devis auraient été **identiques**, puisque
    // l'écrêtage ramenait 144 à 24 avant de chiffrer.
    const vingtQuatre = laborEscrow("STUBBLE", 24);
    const centQuaranteQuatre = laborEscrow("STUBBLE", 144);
    expect(centQuaranteQuatre.escrow).toBeGreaterThan(vingtQuatre.escrow);
  });

  it("garde un tarif à la case constant, forfait de déplacement mis à part", () => {
    /*
     * Le devis n'est pas proportionnel aux cases : il porte un forfait de
     * déplacement, puis un tarif à la case. C'est ce forfait qui fait qu'un
     * petit chantier coûte cher au rapport — et c'est voulu, un prestataire
     * qui sort son camion pour huit cases le facture.
     *
     * Ce qui doit être constant, c'est le **tarif marginal** : la case
     * cent-quarantième vaut la case vingt-cinquième. Sans ça, un grand
     * chantier serait puni ou bradé sans que personne l'ait décidé.
     */
    const q = (n: number) => laborEscrow("STUBBLE", n).quote;
    const marge = (a: number, b: number) => (q(b) - q(a)) / (b - a);
    // Le devis est arrondi au TRN entier : sur vingt-quatre cases, cet
    // arrondi pèse jusqu'à 0,04 TRN par case. La tolérance couvre l'arrondi,
    // pas un changement de tarif — qui se compterait en dixièmes.
    expect(marge(24, 48)).toBeCloseTo(marge(24, 144), 1);
  });

  it("paie l’aidant à proportion, lui aussi", () => {
    // L'écrêtage frappait les deux bouts : le devis payé par le donneur
    // d'ordre et le salaire touché par l'aidant.
    const petit = missionPayout("STUBBLE", 24, "P2P");
    const grand = missionPayout("STUBBLE", 144, "P2P");
    expect(grand).toBeGreaterThan(petit);
  });

  it("garde un plancher : l’entraide n’est pas faite pour trois cases", () => {
    // Le minimum, lui, n'a pas bougé — il évite qu'on publie trente demandes
    // d'une case. C'est une règle de jeu, pas une limite arbitraire.
    expect(MISSION_CELLS_MIN).toBe(8);
  });

  it("laisse le calibre des offres PNJ où il était", () => {
    // Ce que la levée du plafond ne devait pas emporter : le tableau continue
    // de proposer des chantiers qu'on prend entre deux travaux.
    expect(MISSION_CELLS_MAX).toBe(24);
  });
});
