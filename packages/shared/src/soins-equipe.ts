/**
 * Ce que l'employé affecté à l'élevage fait vraiment — règles pures.
 *
 * ## Le défaut que ce module corrige
 *
 * Signalé en jouant, deux fois : « je pige toujours pas l'intérêt du PNJ
 * éleveur ». Ce n'était pas un défaut de compréhension, c'était un défaut de
 * conception, et les chiffres le disaient.
 *
 * L'employé à l'élevage ne faisait que deux choses : **+5 % de production par
 * niveau** au-delà du premier (plafond +20 %), et vider la fumière. Or la
 * production est déjà bornée à 100 % par les besoins — nourrir, abreuver,
 * laisser de la place. Le bonus multipliait donc un travail que le joueur
 * continuait de faire à la main, toutes les 1 h 26, pendant qu'il payait un
 * salaire pour ça.
 *
 * Mesuré sur le barème du jeu, aucune configuration ne se rentabilisait :
 *
 * | Troupeau                        | Production | +20 % | Salaire | Solde |
 * |---------------------------------|-----------:|------:|--------:|------:|
 * | 12 vaches                       |  133 €/j   | +27 € |   140 € | −113 €|
 * | 20 vaches                       |  222 €/j   | +44 € |   140 € |  −96 €|
 * | 20 vaches + 40 poules + 24 brebis| 553 €/j   | +111 €| 140–200 €| −29 à −89 €|
 *
 * Et il coûtait une seconde fois : affecté à l'élevage, il ne conduit pas,
 * donc il ne débloque aucun chantier simultané.
 *
 * ## Ce qu'on achète en embauchant un vacher
 *
 * Pas un pourcentage : **de ne plus avoir à revenir**. C'est ce que ce module
 * met en place. L'équipe refait la mangeoire et la litière à votre place, en
 * puisant dans **votre** stock. Le bonus de production ne bouge pas ; il
 * cesse simplement d'être la seule raison d'embaucher.
 *
 * ## Les trois bornes qui l'empêchent de devenir une immunité
 *
 *  1. **Il puise, il n'achète pas.** Silo vide, tout s'arrête et l'alerte
 *     existante repart. On achète une absence, pas une invulnérabilité.
 *  2. **Il refait la ration que vous avez servie**, au lieu de choisir à votre
 *     place. Un joueur qui sert du concentré garde son concentré ; un joueur
 *     qui sert du foin garde son foin.
 *  3. **Il ne remplit qu'à partir d'un creux.** Sans seuil, chaque tour de
 *     monde rajouterait trois kilos dans l'auge : la mangeoire resterait
 *     pleine en permanence et la ration cesserait d'être une décision.
 */

import { FEED_VALUE, type TradeGood } from "./goods.js";

/* ------------------------------------------------------------------ */
/* Les seuils                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sous quelle part de la mangeoire l'équipe ressert `[GD]`.
 *
 * La moitié : assez bas pour que le geste reste un vrai geste — la ration que
 * vous servez vous-même tient toujours —, assez haut pour qu'un lot ne
 * connaisse jamais la disette tant qu'il reste du fourrage au silo. La
 * mangeoire tient deux jours réels ; l'équipe passe donc quand il en reste
 * un.
 */
export const SEUIL_MANGEOIRE = 0.5;

/**
 * Sous quelle part de la litière l'équipe repaille.
 *
 * Plus bas que la mangeoire, et à dessein : une litière à 40 % ne fait pas
 * souffrir les bêtes, elle les fait produire un peu moins. Repailler trop tôt
 * brûlerait de la paille pour un gain nul.
 */
export const SEUIL_LITIERE = 0.4;

/* ------------------------------------------------------------------ */
/* La ration                                                           */
/* ------------------------------------------------------------------ */

/** Les cinq aliments qu'une ration peut contenir. */
export type AlimentRation = "HAY" | "MAIZE" | "BARLEY" | "WHEAT" | "SILAGE";

export const ALIMENTS_RATION: readonly AlimentRation[] = [
  "HAY",
  "MAIZE",
  "BARLEY",
  "WHEAT",
  "SILAGE",
] as const;

/** Ce qu'on a au silo, en tonnes, pour chacun des cinq. */
export type StockRation = Record<AlimentRation, number>;

/**
 * Les concentrés, du moins cher au plus cher.
 *
 * L'ordre n'est pas décoratif : c'est lui qui décide ce que l'équipe brûle en
 * premier. On sert l'ensilage (48 €) avant le blé (220 €), pour la même
 * raison qu'un éleveur le ferait — le blé se vend, l'ensilage se mange. Un
 * ordre arbitraire ferait consommer à votre insu la culture que vous gardiez
 * pour la criée.
 *
 * `rationQuality` ne connaît que deux camps : le foin d'un côté, tout le reste
 * de l'autre. Cette liste est donc exactement « tout le reste ».
 */
export const CONCENTRES_PAR_PRIX: readonly AlimentRation[] = [
  "SILAGE",
  "BARLEY",
  "MAIZE",
  "WHEAT",
] as const;

/** Ce que l'équipe sort du silo pour une distribution. */
export type RationServie = {
  /** Tonnes prélevées, par aliment. */
  tonnes: StockRation;
  /** Unités nutritives obtenues. */
  unites: number;
  /** Y avait-il de quoi servir tout ce qu'il fallait ? */
  complet: boolean;
};

const VIDE: StockRation = { HAY: 0, MAIZE: 0, BARLEY: 0, WHEAT: 0, SILAGE: 0 };

const valeur = (a: AlimentRation): number => FEED_VALUE[a as TradeGood] ?? 1;

/** Arrondi au kilo : on ne prélève pas des grammes au silo. */
const auKilo = (t: number): number => Math.round(t * 1000) / 1000;

/** Ce qu'on tolère de manque, en unités : le résidu de l'arrondi au kilo. */
const TOLERANCE_UNITES = 1;

/**
 * Ce que l'équipe prélève pour combler la mangeoire.
 *
 * ## Refaire la ration du joueur, et non en choisir une
 *
 * `qualiteVisee` est la qualité de la **dernière ration servie** — zéro pour
 * du foin seul, un pour du concentré pur. On reconduit ce partage en tonnage,
 * parce que c'est en tonnage que `rationQuality` le mesure. Un éleveur qui
 * soigne ses bêtes au maïs retrouve du maïs dans l'auge ; un éleveur qui les
 * mène au foin ne voit pas son maïs partir.
 *
 * ## Servir à moitié vaut mieux que ne pas servir
 *
 * Quand le silo ne suffit pas, on distribue ce qu'il y a et on le dit
 * (`complet: false`). Rendre une ration vide sous prétexte qu'elle serait
 * incomplète laisserait le troupeau à jeun avec du fourrage dans le hangar.
 */
export function rationDeLEquipe(input: {
  /** Unités nutritives à combler — voir `rationToServe`. */
  unitesVoulues: number;
  /** Qualité de la dernière ration servie, 0 → 1. */
  qualiteVisee: number;
  stock: StockRation;
}): RationServie {
  const voulu = Math.max(0, input.unitesVoulues);
  if (voulu <= 0) return { tonnes: { ...VIDE }, unites: 0, complet: true };

  const q = Math.min(1, Math.max(0, input.qualiteVisee));
  const tonnes: StockRation = { ...VIDE };
  /*
   * Ce qu'il reste au silo **au fil des prélèvements**.
   *
   * Sans cette copie, chaque appel relisait le stock d'origine : l'aliment
   * qu'on repasse prendre à la fin, faute d'avoir comblé le besoin, se
   * servait une seconde fois dans le même tas. On sortait alors deux tonnes
   * d'un silo qui n'en contenait qu'une.
   */
  const restant: StockRation = { ...VIDE, ...input.stock };
  let unites = 0;

  /** Prélève au plus `tMax` tonnes de cet aliment, sans dépasser le besoin. */
  const prendre = (aliment: AlimentRation, tMax: number) => {
    const dispo = Math.max(0, restant[aliment] ?? 0);
    const manque = (voulu - unites) / 1000 / valeur(aliment);
    const t = auKilo(Math.min(dispo, tMax, manque));
    if (t <= 0) return;
    tonnes[aliment] += t;
    restant[aliment] = auKilo(dispo - t);
    unites += t * valeur(aliment) * 1000;
  };

  /*
   * Le tonnage visé, si la ration était servie exactement à la qualité voulue.
   * Il sert de plafond par camp : sans lui, le premier aliment de la liste
   * comblerait tout le besoin et la qualité de la ration partirait à zéro ou
   * à un selon l'ordre de la boucle.
   */
  const valeurMoyenne = (1 - q) * valeur("HAY") + q * valeurDuConcentreServi(input.stock);
  const tonnageVise = voulu / 1000 / Math.max(0.1, valeurMoyenne);

  // Les concentrés d'abord, du moins cher au plus cher, dans la limite de
  // leur part. Puis le foin comble le reste — y compris la part de concentré
  // qu'on n'a pas pu servir, faute de stock.
  let partConcentre = tonnageVise * q;
  for (const c of CONCENTRES_PAR_PRIX) {
    if (partConcentre <= 0) break;
    const avant = tonnes[c];
    prendre(c, partConcentre);
    partConcentre -= tonnes[c] - avant;
  }
  prendre("HAY", Number.POSITIVE_INFINITY);
  // Il reste du besoin et du concentré : mieux vaut une ration plus riche que
  // prévu qu'un troupeau à moitié servi.
  for (const c of CONCENTRES_PAR_PRIX) prendre(c, Number.POSITIVE_INFINITY);

  return {
    tonnes,
    unites: Math.round(unites * 100) / 100,
    /*
     * Un kilo de tolérance, et pas une epsilon.
     *
     * On prélève au kilo — `auKilo` — donc la dernière pesée peut manquer
     * une demi-unité sur plusieurs milliers. Exiger l'égalité exacte
     * déclarerait « incomplet » une ration servie en entier, et l'écran
     * annoncerait un manque de fourrage qui n'existe pas.
     */
    complet: unites >= voulu - TOLERANCE_UNITES,
  };
}

/**
 * La valeur nutritive du concentré qui sera **réellement** servi.
 *
 * Le premier de la liste qui reste en stock, et non la moyenne des quatre.
 * La différence n'est pas cosmétique : on sert le moins cher d'abord, donc
 * une seule espèce couvre presque toujours toute la part de concentré. Avec
 * la moyenne, une ration à 50 % servie en ensilage — 1,6 contre une moyenne
 * de 1,325 — comblait le besoin avec moins de tonnes que prévu, le foin
 * rétrécissait d'autant, et la ration sortait à 58 % au lieu de 50.
 *
 * Quand il ne reste aucun concentré, la valeur n'a plus d'effet sur le
 * partage — il n'y a rien à mettre dans ce camp — et sert seulement à viser
 * le bon tonnage total.
 */
function valeurDuConcentreServi(stock: StockRation): number {
  const premier = CONCENTRES_PAR_PRIX.find((c) => (stock[c] ?? 0) > 0);
  return valeur(premier ?? "SILAGE");
}

/* ------------------------------------------------------------------ */
/* Faut-il passer ?                                                    */
/* ------------------------------------------------------------------ */

/**
 * La mangeoire appelle-t-elle l'équipe ?
 *
 * On compare à la **capacité**, pas au besoin d'un cycle : c'est la capacité
 * que la jauge de l'écran affiche, et deux mesures différentes pour la même
 * barre finiraient par se contredire.
 */
export function mangeoireAServir(input: { feedStock: number; capacite: number }): boolean {
  if (input.capacite <= 0) return false;
  return input.feedStock < input.capacite * SEUIL_MANGEOIRE;
}

/**
 * La litière appelle-t-elle l'équipe ?
 *
 * Une capacité nulle veut dire « pas de litière dans ce bâtiment » : on ne
 * repaille pas un poulailler sur caillebotis, et le zéro le dit déjà sans
 * qu'il faille tenir une seconde liste d'espèces à côté.
 */
export function litiereARefaire(input: { beddingTons: number; capacite: number }): boolean {
  if (input.capacite <= 0) return false;
  return input.beddingTons < input.capacite * SEUIL_LITIERE;
}
