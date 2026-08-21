/**
 * Ce que les compétences changent, dit au joueur.
 *
 * Les libellés vivaient dans `SkillTree`, qui ne dessine que l'arbre. L'écran
 * des compétences en a besoin ailleurs — dans la page des avantages, où l'on
 * ne montre pas une compétence mais un **levier** : « rendement des
 * cultures », son gain actuel, son plafond. Deux écrans, une seule table :
 * recopier les treize phrases aurait garanti qu'elles divergent au premier
 * changement de formulation.
 */

import { SKILL_EFFECT_CAPS, type SkillEffectKind } from "@farmsim/shared";

/** Ce que chaque levier fait, en une ligne — jamais le nom technique. */
export const EFFECT_LABELS: Record<SkillEffectKind, (v: string) => string> = {
  CROP_YIELD: (v) => `+${v} de rendement des cultures`,
  FUEL_USE: (v) => `−${v} de gazole sur les chantiers`,
  WEAR: (v) => `−${v} d’usure du matériel`,
  REPAIR_COST: (v) => `−${v} sur les réparations`,
  WORK_SPEED: (v) => `−${v} sur la durée des chantiers`,
  MILK_YIELD: (v) => `+${v} de production laitière`,
  EGG_YIELD: (v) => `+${v} de ponte`,
  WOOL_YIELD: (v) => `+${v} de laine`,
  FEED_USE: (v) => `−${v} de ration consommée`,
  ANIMAL_HAPPINESS: (v) => `+${v} de bien-être du troupeau`,
  STORAGE_GRAIN: (v) => `+${v} de stockage du grain`,
  SPOILAGE_SLOW: (v) => `−${v} de dégradation au stock`,
  SALE_PRICE: (v) => `+${v} sur le prix de vente`,
};

/**
 * Le levier tel qu'on le présente sur sa propre carte.
 *
 * `title` nomme la chose, `where` dit **où ça se voit dans la partie** — la
 * seule question que pose un joueur devant « +3 % ». Sans cette phrase, un
 * pourcentage n'est qu'un chiffre à côté d'un mot.
 */
export const EFFECT_META: Record<
  SkillEffectKind,
  { title: string; where: string; unit: "PART" | "TONNES"; sens: "gain" | "economie" }
> = {
  CROP_YIELD: {
    title: "Rendement des cultures",
    where: "Chaque moisson pèse davantage, à surface égale.",
    unit: "PART",
    sens: "gain",
  },
  FUEL_USE: {
    title: "Gazole",
    where: "Chaque chantier puise moins dans la cuve.",
    unit: "PART",
    sens: "economie",
  },
  WEAR: {
    title: "Usure du matériel",
    where: "Les engins vieillissent moins vite au travail.",
    unit: "PART",
    sens: "economie",
  },
  REPAIR_COST: {
    title: "Réparations",
    where: "L’atelier facture moins l’entretien et les remises en état.",
    unit: "PART",
    sens: "economie",
  },
  WORK_SPEED: {
    title: "Durée des chantiers",
    where: "Le même travail se termine plus tôt.",
    unit: "PART",
    sens: "economie",
  },
  MILK_YIELD: {
    title: "Production laitière",
    where: "Chaque traite ramène plus de lait.",
    unit: "PART",
    sens: "gain",
  },
  EGG_YIELD: {
    title: "Ponte",
    where: "Le poulailler donne plus d’œufs au ramassage.",
    unit: "PART",
    sens: "gain",
  },
  WOOL_YIELD: {
    title: "Laine",
    where: "Chaque tonte rend plus de laine.",
    unit: "PART",
    sens: "gain",
  },
  FEED_USE: {
    title: "Ration consommée",
    where: "Le troupeau mange moins pour le même bien-être.",
    unit: "PART",
    sens: "economie",
  },
  ANIMAL_HAPPINESS: {
    title: "Bien-être du troupeau",
    where: "Les bêtes tiennent mieux, et ce qu’elles donnent suit.",
    unit: "PART",
    sens: "gain",
  },
  STORAGE_GRAIN: {
    title: "Stockage du grain",
    where: "Le silo accepte plus de tonnes avant de refuser la benne.",
    unit: "TONNES",
    sens: "gain",
  },
  SPOILAGE_SLOW: {
    title: "Conservation au stock",
    where: "Ce qui dort au silo se dégrade moins vite.",
    unit: "PART",
    sens: "economie",
  },
  SALE_PRICE: {
    title: "Prix de vente",
    where: "Chaque tonne vendue part un peu plus cher.",
    unit: "PART",
    sens: "gain",
  },
};

/**
 * La valeur d'un levier, dans son unité.
 *
 * Le stockage se compte en tonnes, tout le reste en pourcentage : afficher
 * « +0,2 % de stockage » pour vingt tonnes n'aurait aucun sens.
 */
export function effectValue(kind: SkillEffectKind, value: number): string {
  return EFFECT_META[kind].unit === "TONNES"
    ? `${Math.round(value)} t`
    : `${Math.round(value * 100)} %`;
}

/** La phrase complète : « +5 % de rendement des cultures ». */
export function effectText(e: { kind: SkillEffectKind; value: number }): string {
  return EFFECT_LABELS[e.kind](effectValue(e.kind, e.value));
}

/** Le signe qu'on met devant : un gain s'ajoute, une économie se retire. */
export function effectSign(kind: SkillEffectKind): string {
  return EFFECT_META[kind].sens === "gain" ? "+" : "−";
}

/** Le plafond du levier, écrit comme sa valeur. */
export function effectCap(kind: SkillEffectKind): string {
  return effectValue(kind, SKILL_EFFECT_CAPS[kind]);
}
