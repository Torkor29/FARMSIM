/**
 * Profil d'espèce — une seule table, une entrée par animal.
 *
 * Les caractéristiques d'une espèce vivaient dans huit tables parallèles,
 * réparties dans quatre fichiers : `FEED_BASE` et `ANIMAL_PRICE` et
 * `ANIMAL_PLURAL` et `ANIMAL_ART` dans `livestock.ts`, `MANURE_PER_ANIMAL`
 * dans `manure.ts`, `BEDDING_PER_ANIMAL` dans `bedding.ts`, `gestationCycles`
 * et `litterSize` dans `breeding.ts`, et un `meatBaseKg()` en `if/else`.
 *
 * Ajouter une chèvre demandait donc de retrouver chacune d'elles, et d'y
 * penser. En oublier une ne cassait rien de visible : la chèvre héritait
 * silencieusement des valeurs de la vache, par les `?? COW` semés partout.
 *
 * Ici tout est au même endroit, et le type l'exige : une espèce sans profil
 * complet ne compile pas. Les anciennes tables restent exportées et sont
 * **dérivées de celle-ci** — rien n'a changé de valeur, et le code appelant
 * n'a pas eu à bouger.
 */

import type { AnimalKind } from "./livestock.js";

/** Ce que produit une espèce, en dehors de la viande — que toutes donnent. */
export type SpeciesProduce = "MILK" | "EGGS" | "WOOL";

export type SpeciesProfile = {
  kind: AnimalKind;
  /** Nom au pluriel, tel qu'il s'affiche : « Acheter des vaches ». */
  plural: string;
  /** Dessin isométrique ; second dessin tête au sol quand il existe. */
  art: string;
  grazeArt?: string;

  /* — Besoins par bête et par cycle — */
  /** Ration de base, en kg de matière sèche. */
  feedKg: number;
  /** Paille de litière, en tonnes. */
  beddingTons: number;
  /** Fumier produit, en tonnes. */
  manureTons: number;

  /* — Économie — */
  /** Prix d'achat d'une bête, en €. */
  price: number;
  /** Poids de carcasse d'un adulte, en kg. */
  meatKg: number;

  /* — Reproduction — */
  /** Durée de gestation, en cycles. */
  gestationCycles: number;
  /** Nombre de petits par mise bas. */
  litterSize: number;

  /* — Environnement — */
  /**
   * L'espèce broute-t-elle ?
   *
   * Un cochon sort dans une souille et une poule dans une courette : ni l'un
   * ni l'autre n'y trouve sa ration. Seuls les ruminants tirent leur
   * nourriture du pré, et c'est cette distinction qui décide si une sortie
   * remplace la ration ou se contente de faire du bien.
   */
  grazes: boolean;
  /**
   * Confort thermique : bornes en degrés au-delà desquelles la bête souffre.
   *
   * Une poule supporte mal le froid, un mouton le porte sur le dos. Ces
   * bornes valent pour une bête **dehors** ; un bâtiment tempère (cf.
   * `shelterRelief`).
   */
  comfortMinC: number;
  comfortMaxC: number;
  /**
   * Part de l'écart thermique qu'un bâtiment absorbe, entre 0 et 1.
   *
   * Une étable close protège mieux qu'un poulailler de planches.
   */
  shelterRelief: number;
};

export const SPECIES: Record<AnimalKind, SpeciesProfile> = {
  COW: {
    kind: "COW",
    plural: "vaches",
    art: "/assets/animals/cow.svg",
    grazeArt: "/assets/animals/cow-graze.svg",
    feedKg: 14,
    beddingTons: 0.018,
    manureTons: 0.025,
    // Prix réel : une vache laitière prête à vêler vaut de 1 500 à 1 900 €.
    price: 1650,
    meatKg: 280,
    gestationCycles: 8,
    litterSize: 1,
    grazes: true,
    // Une vache laitière souffre de la chaleur bien avant du froid : elle
    // dissipe mal au-dessus de 25 °C, et tient sans peine jusqu'à −5 °C.
    comfortMinC: -5,
    comfortMaxC: 25,
    shelterRelief: 0.75,
  },
  PIG: {
    kind: "PIG",
    plural: "cochons",
    art: "/assets/animals/pig.svg",
    feedKg: 14,
    beddingTons: 0.012,
    manureTons: 0.02,
    // Prix réel : un porcelet de huit semaines vaut 60 à 90 €. Le prix du jeu
    // achète un animal déjà lancé, d'où la valeur plus haute.
    price: 180,
    meatKg: 280,
    gestationCycles: 4,
    litterSize: 4,
    // Un cochon fouille, il ne pâture pas : sa courette ne le nourrit pas.
    grazes: false,
    // Sans glandes sudoripares, il supporte très mal la chaleur.
    comfortMinC: 2,
    comfortMaxC: 22,
    shelterRelief: 0.8,
  },
  HEN: {
    kind: "HEN",
    plural: "poules",
    art: "/assets/animals/hen.svg",
    feedKg: 2,
    beddingTons: 0.002,
    manureTons: 0.003,
    // Prix réel : une poule pondeuse prête à pondre vaut 6 à 9 €.
    price: 8,
    meatKg: 2.2,
    gestationCycles: 2,
    litterSize: 6,
    grazes: false,
    comfortMinC: 5,
    comfortMaxC: 28,
    shelterRelief: 0.6,
  },
  SHEEP: {
    kind: "SHEEP",
    plural: "moutons",
    art: "/assets/animals/sheep.svg",
    feedKg: 8,
    beddingTons: 0.008,
    manureTons: 0.012,
    // Prix réel : une brebis vaut 150 à 200 €. Le seul de la table qui était
    // déjà juste.
    price: 170,
    meatKg: 42,
    gestationCycles: 5,
    litterSize: 1,
    grazes: true,
    // La laine fait le travail : le mouton tient le froid mieux que tout le
    // reste du cheptel, et souffre plus tôt de la chaleur, tondu ou non.
    comfortMinC: -12,
    comfortMaxC: 24,
    shelterRelief: 0.65,
  },
};

/** Le profil d'une espèce. Toujours défini — le type l'impose. */
export function speciesOf(kind: AnimalKind): SpeciesProfile {
  return SPECIES[kind];
}

/** Toutes les espèces, dans un ordre stable. */
export const ALL_SPECIES = Object.values(SPECIES);
