/**
 * Litière — le pont aller du céréalier vers l'éleveur.
 *
 * `forage.ts` l'annonçait depuis le début : « la paille est le pont céréalier
 * ↔ éleveur (litière) ». La paille était bien produite à la moisson, pressable
 * en bottes, vendable à 72 € la tonne — mais **rien ne la consommait**. Elle
 * n'entrait dans aucune ration, aucune mécanique. Le céréalier la vendait donc
 * à un marché anonyme, et l'éleveur n'avait aucune raison d'en acheter : deux
 * métiers côte à côte, jamais clients l'un de l'autre.
 *
 * Ce module ferme l'aller. Le retour est le fumier (`manure.ts`), qui devient
 * achetable par le céréalier dans le même mouvement.
 *
 * La boucle complète :
 *
 *     moisson → paille → litière → bonheur ET fumier → fertilité → moisson
 *
 * C'est le second effet qui rend l'ensemble intéressant plutôt que punitif :
 * pailler ne se contente pas d'éviter une pénalité, cela **produit davantage
 * de fumier**. L'éleveur qui achète de la paille revend du fumier ; le
 * céréalier qui vend sa paille rachète de la fertilité. Chacun gagne sur le
 * déchet de l'autre.
 *
 * @see docs/research/49_TRIANGLE_METIERS.md
 */

import { SPECIES } from "./species.js";
import type { AnimalKind } from "./livestock.js";
import { rationCycles } from "./livestock.js";

/**
 * Tonnes de paille par bête et par cycle `[GD]`.
 *
 * Calé sur `MANURE_PER_ANIMAL` : une vache paillée produit à peu près autant
 * de fumier qu'elle consomme de paille, la masse venant surtout des déjections
 * mais le volume de la litière. Les proportions entre espèces suivent la
 * surface couchée, pas le poids vif — d'où une poule à peine plus économe
 * qu'un mouton rapportée à la bête.
 */
export const BEDDING_PER_ANIMAL: Record<AnimalKind, number> = Object.fromEntries(
  Object.values(SPECIES).map((e) => [e.kind, e.beddingTons]),
) as Record<AnimalKind, number>;

/**
 * Part de paille économisée quand les bêtes sont au pré `[GD]`.
 *
 * Une bête dehors ne salit pas sa litière. C'est la même logique que le
 * fourrage économisé au pâturage, et cela récompense deux fois la sortie —
 * ce qui est voulu : l'enclos est la mécanique centrale de l'élevage.
 */
export const BEDDING_GRAZING_SAVING = 0.5;

/**
 * La litière d'un bâtiment plein tient **un jour réel** `[GD]`.
 *
 * Elle tenait trois cycles, soit quarante-cinq minutes d'horloge : il fallait
 * repailler trois fois par heure de jeu. C'est le même reproche que pour la
 * ration — « beaucoup trop compliqué à gérer sinon » —, et il vaut identique
 * ici, la paille se salissant au même rythme que le fourrage se mange.
 *
 * La consommation par cycle ne bouge pas : seule la profondeur du lit change,
 * donc la fréquence du geste. Sur vingt-quatre heures, la même paille.
 */
export const BEDDING_STORE_REAL_DAYS = 1;

export const BEDDING_STORE_CYCLES = rationCycles() * BEDDING_STORE_REAL_DAYS;

/** Pénalité maximale de bonheur, litière absente `[GD]` */
export const BEDDING_PENALTY_MAX = 0.2;

/**
 * Supplément de fumier quand la litière est complète `[GD]`.
 *
 * +60 % : c'est ce qui doit rendre le paillage rentable et non subi. La paille
 * ne disparaît pas, elle passe dans le tas de fumier — laquelle revient au
 * céréalier, qui l'a vendue en paille.
 */
export const BEDDING_MANURE_BONUS = 0.6;

/** Réserve de paille qu'un bâtiment plein peut recevoir, en tonnes. */
export function beddingCapacity(kind: AnimalKind, slots: number): number {
  const n = Math.max(0, Math.floor(slots));
  const per = BEDDING_PER_ANIMAL[kind] ?? BEDDING_PER_ANIMAL.COW;
  return Math.round(per * n * BEDDING_STORE_CYCLES * 1000) / 1000;
}

/** Paille qu'il faut prévoir pour un cycle, en tonnes. */
export function beddingNeed(kind: AnimalKind, herdSize: number): number {
  const size = Math.max(0, Math.floor(herdSize));
  const per = BEDDING_PER_ANIMAL[kind] ?? BEDDING_PER_ANIMAL.COW;
  return Math.round(per * size * 1000) / 1000;
}

/** Paille consommée sur une durée, en tonnes. */
export function beddingBurn(input: {
  kind: AnimalKind;
  herdSize: number;
  elapsedMs: number;
  cycleMs: number;
  /** Au pré, la litière se salit moins */
  grazing?: boolean;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size <= 0) return 0;
  const cycles = Math.max(0, input.elapsedMs) / Math.max(1, input.cycleMs);
  const per = BEDDING_PER_ANIMAL[input.kind] ?? BEDDING_PER_ANIMAL.COW;
  const économie = input.grazing ? 1 - BEDDING_GRAZING_SAVING : 1;
  return Math.round(per * size * cycles * économie * 1000) / 1000;
}

/**
 * Part du besoin d'un cycle réellement couverte, `∈ [0 ; 1]`.
 *
 * Un troupeau vide est considéré couvert : il n'y a rien à pailler, et une
 * étable en construction ne doit pas afficher une alerte rouge.
 */
export function beddingCover(input: {
  kind: AnimalKind;
  herdSize: number;
  stockTons: number;
}): number {
  const need = beddingNeed(input.kind, input.herdSize);
  if (need <= 0) return 1;
  return Math.max(0, Math.min(1, Math.max(0, input.stockTons) / need));
}

/**
 * Pénalité de bonheur `∈ [0 ; BEDDING_PENALTY_MAX]`.
 *
 * Linéaire dans le manque : une litière à moitié faite vaut une demi-pénalité.
 * Volontairement plus douce que la faim — dormir sur le béton n'est pas
 * mourir de faim, et l'éleveur ne doit pas être puni deux fois pour la même
 * négligence de ravitaillement.
 */
export function beddingPenalty(cover: number): number {
  return BEDDING_PENALTY_MAX * (1 - Math.max(0, Math.min(1, cover)));
}

/**
 * Multiplicateur de production de fumier selon la litière.
 *
 * `1` sans paille, `1 + BEDDING_MANURE_BONUS` avec une litière complète.
 */
export function beddingManureMultiplier(cover: number): number {
  return 1 + BEDDING_MANURE_BONUS * Math.max(0, Math.min(1, cover));
}
