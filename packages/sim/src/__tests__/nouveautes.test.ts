/**
 * Le « Quoi de neuf », et la boucle de retour qu'il répare.
 *
 * « Je te fais pas de retour parce que tu m'en fais pas sur ce que tu as
 * modifié. »
 *
 * La phrase décrit une boucle cassée : un testeur qui ignore ce qui a bougé ne
 * peut ni vérifier la correction qu'il a demandée, ni distinguer un nouveau
 * défaut d'un ancien qu'il n'avait pas vu. Il se tait, et on corrige à
 * l'aveugle.
 *
 * Ces tests tiennent la règle pure — qui voit quoi. L'écran est dans
 * `quoi-de-neuf.test.ts`, côté client.
 */

import { DERNIERE_NOUVEAUTE, NOUVEAUTES, nouveautesNonLues } from "@farmsim/shared";

const HIER = "2026-09-20";
const AUJOURD_HUI = "2026-09-21";

describe("la liste", () => {
  it("va de la plus récente à la plus ancienne", () => {
    /*
     * L'ordre n'est pas cosmétique : `NOUVEAUTES[0]` sert de marque-page, et
     * une entrée ajoutée ailleurs qu'en tête ne serait jamais signalée.
     */
    const dates = NOUVEAUTES.map((n) => n.date);
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
    expect(DERNIERE_NOUVEAUTE).toBe(NOUVEAUTES[0]!.id);
  });

  it("n’a pas deux fois le même identifiant", () => {
    // Un identifiant réemployé masquerait une entrée neuve : le marque-page
    // pointerait sur la mauvaise.
    expect(new Set(NOUVEAUTES.map((n) => n.id)).size).toBe(NOUVEAUTES.length);
  });

  it("porte des dates lisibles et des textes écrits pour un joueur", () => {
    for (const n of NOUVEAUTES) {
      expect({ id: n.id, date: /^\d{4}-\d{2}-\d{2}$/.test(n.date) }).toEqual({
        id: n.id,
        date: true,
      });
      expect({ id: n.id, titre: n.titre.length > 10 }).toEqual({ id: n.id, titre: true });
      /*
       * Le garde-fou de rédaction. Une entrée qui nommerait une fonction, une
       * route ou une colonne serait un message de commit déguisé — ce que ce
       * panneau ne doit surtout pas être.
       */
      const jargon = /\b(commit|route|colonne|refactor|`[a-zA-Z]+\(\)`|gridW|API)\b/;
      expect({ id: n.id, jargon: jargon.test(n.texte) }).toEqual({ id: n.id, jargon: false });
      // Deux ou trois phrases : au-delà, personne ne lit.
      expect({ id: n.id, longueur: n.texte.length <= 420 }).toEqual({ id: n.id, longueur: true });
    }
  });
});

describe("ce qu’un joueur voit", () => {
  it("ne montre rien à qui vient de s’inscrire", () => {
    /*
     * Accueillir un compte créé ce matin par tout l'historique du jeu serait
     * le contraire du but : il n'a rien connu d'autre.
     */
    expect(nouveautesNonLues({ compteCreeLe: `${AUJOURD_HUI}T23:59:59Z` })).toEqual([]);
    expect(nouveautesNonLues({})).toEqual([]);
  });

  it("montre tout à un joueur installé de longue date", () => {
    // C'est le cas qui compte le jour de la mise en ligne : personne n'a de
    // marque-page, et ce sont justement les joueurs qu'on veut informer.
    const vu = nouveautesNonLues({ compteCreeLe: "2026-01-01T00:00:00Z" });
    expect(vu.length).toBe(NOUVEAUTES.length);
  });

  it("ne montre que ce qui est paru depuis l’inscription", () => {
    const vu = nouveautesNonLues({ compteCreeLe: `${HIER}T12:00:00Z` });
    expect(vu.length).toBeGreaterThan(0);
    expect(vu.length).toBeLessThan(NOUVEAUTES.length);
    for (const n of vu) {
      expect({ id: n.id, apres: n.date > HIER }).toEqual({ id: n.id, apres: true });
    }
  });

  it("ne montre que ce qui a paru depuis sa dernière lecture", () => {
    const troisieme = NOUVEAUTES[2]!;
    const vu = nouveautesNonLues({ vue: troisieme.id, compteCreeLe: "2026-01-01T00:00:00Z" });
    expect(vu.map((n) => n.id)).toEqual([NOUVEAUTES[0]!.id, NOUVEAUTES[1]!.id]);
  });

  it("ne montre plus rien une fois la dernière lue", () => {
    // Le panneau ne doit pas revenir à chaque connexion : c'est ce qui le
    // ferait fermer sans lire.
    expect(
      nouveautesNonLues({ vue: DERNIERE_NOUVEAUTE, compteCreeLe: "2026-01-01T00:00:00Z" }),
    ).toEqual([]);
  });

  it("retombe sur la date si le marque-page est abîmé", () => {
    /*
     * Un identifiant inconnu vient d'une entrée retirée depuis, ou d'un
     * stockage local trafiqué. Ne rien montrer alors serait le silence qu'on
     * corrige ; on repart de la date d'inscription.
     */
    const vu = nouveautesNonLues({ vue: "entrée-qui-n-existe-plus", compteCreeLe: "2026-01-01" });
    expect(vu.length).toBe(NOUVEAUTES.length);
  });

  it("ne tombe pas sur une date illisible", () => {
    expect(nouveautesNonLues({ compteCreeLe: "pas une date" })).toEqual([]);
    expect(nouveautesNonLues({ compteCreeLe: null })).toEqual([]);
  });
});
