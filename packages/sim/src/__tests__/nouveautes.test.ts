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

/*
 * Les dates se déduisent de la liste, jamais écrites en dur.
 *
 * Elles l'étaient, et la première entrée ajoutée un autre jour a fait tomber
 * le test : « un compte créé le 21 ne voit rien » cessait d'être vrai le jour
 * où une nouveauté portait le 22. Le test mesurait le calendrier au lieu de
 * mesurer la règle.
 */
const AUJOURD_HUI = NOUVEAUTES[0]!.date;
/** Un jour strictement antérieur à la plus ancienne entrée. */
const AVANT_TOUT = "2026-01-01";
/** La date d'une entrée du milieu : il y a du neuf après, et de l'ancien avant. */
const MILIEU = NOUVEAUTES[Math.floor(NOUVEAUTES.length / 2)]!.date;

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
    expect(nouveautesNonLues({ compteCreeLe: `${AUJOURD_HUI}T12:00:00Z` })).toEqual([]);
    expect(nouveautesNonLues({})).toEqual([]);
  });

  it("montre tout à un joueur installé de longue date", () => {
    // C'est le cas qui compte le jour de la mise en ligne : personne n'a de
    // marque-page, et ce sont justement les joueurs qu'on veut informer.
    const vu = nouveautesNonLues({ compteCreeLe: `${AVANT_TOUT}T00:00:00Z` });
    expect(vu.length).toBe(NOUVEAUTES.length);
  });

  it("ne montre que ce qui est paru depuis l’inscription", () => {
    const vu = nouveautesNonLues({ compteCreeLe: `${MILIEU}T12:00:00Z` });
    expect(vu.length).toBeGreaterThan(0);
    expect(vu.length).toBeLessThan(NOUVEAUTES.length);
    for (const n of vu) {
      expect({ id: n.id, apres: n.date > MILIEU }).toEqual({ id: n.id, apres: true });
    }
  });

  it("ne montre que ce qui a paru depuis sa dernière lecture", () => {
    const troisieme = NOUVEAUTES[2]!;
    const vu = nouveautesNonLues({ vue: troisieme.id, compteCreeLe: `${AVANT_TOUT}T00:00:00Z` });
    expect(vu.map((n) => n.id)).toEqual([NOUVEAUTES[0]!.id, NOUVEAUTES[1]!.id]);
  });

  it("ne montre plus rien une fois la dernière lue", () => {
    // Le panneau ne doit pas revenir à chaque connexion : c'est ce qui le
    // ferait fermer sans lire.
    expect(
      nouveautesNonLues({ vue: DERNIERE_NOUVEAUTE, compteCreeLe: `${AVANT_TOUT}T00:00:00Z` }),
    ).toEqual([]);
  });

  it("retombe sur la date si le marque-page est abîmé", () => {
    /*
     * Un identifiant inconnu vient d'une entrée retirée depuis, ou d'un
     * stockage local trafiqué. Ne rien montrer alors serait le silence qu'on
     * corrige ; on repart de la date d'inscription.
     */
    const vu = nouveautesNonLues({ vue: "entrée-qui-n-existe-plus", compteCreeLe: AVANT_TOUT });
    expect(vu.length).toBe(NOUVEAUTES.length);
  });

  it("ne tombe pas sur une date illisible", () => {
    expect(nouveautesNonLues({ compteCreeLe: "pas une date" })).toEqual([]);
    expect(nouveautesNonLues({ compteCreeLe: null })).toEqual([]);
  });
});
