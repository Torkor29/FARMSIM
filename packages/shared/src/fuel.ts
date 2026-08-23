/**
 * Le gazole.
 *
 * Le mot n'apparaissait nulle part dans le code, alors que c'est le premier
 * poste variable d'une exploitation réelle et un pilier du genre. Les travaux
 * coûtaient un forfait par case — douze € pour un labour, cinq pour un
 * déchaumage — qui mélangeait semences, carburant et main-d'œuvre en un seul
 * nombre opaque : le joueur ne savait ni ce qu'il payait, ni comment le
 * réduire.
 *
 * ## Une seule jauge, une seule décision
 *
 * Pas de réservoir par engin. La ferme a **une cuve**, les chantiers y
 * puisent, et le joueur n'a qu'une chose à faire : la garder pleine. Un
 * réservoir par machine aurait ajouté un bouton « faire le plein » par engin
 * et par chantier — exactement l'usine à clics qu'on refuse.
 *
 * ## Ce qui rend le carburant intéressant
 *
 * La consommation suit la **charge**, pas la puissance nominale. Un gros
 * tracteur attelé à un petit outil tourne au ralenti et brûle quand même : il
 * consomme plus qu'un tracteur bien dimensionné pour le même travail. C'est le
 * seul arbitrage que ce système ajoute, et c'en est un vrai — celui du
 * machinisme réel.
 *
 *     tracteur T1 (90 ch) + charrue T1   →  177 L   (charge pleine)
 *     tracteur T3 (180 ch) + charrue T1  →  238 L   (surdimensionné, +34 %)
 *     tracteur T3 (180 ch) + charrue T3  →  149 L   (bien attelé, et trois
 *                                                    fois plus rapide)
 *
 * @see docs/research/24_MACHINES.md — carburant et compatibilité outils
 */

/**
 * Litres par cheval et par heure, à pleine charge `[RÉEL]`.
 *
 * L'ordre de grandeur du machinisme : un tracteur de 90 ch qui tire fort brûle
 * une quinzaine de litres à l'heure.
 */
export const FUEL_L_PER_HP_HOUR = 0.18;

/**
 * Part de la consommation qui ne dépend pas de la charge `[GD]`.
 *
 * Un moteur qui tourne consomme même sans tirer. Sans ce plancher, atteler un
 * gros tracteur à un petit outil serait gratuit, et le dimensionnement ne
 * serait plus une décision.
 */
export const FUEL_IDLE_SHARE = 0.35;

/**
 * Prix du litre `[GD]`, avant coefficient régional.
 *
 * Calé sur l'économie du jeu, pas sur celle du monde réel — et c'est un choix,
 * pas un renoncement. Les litres, eux, sont réalistes : une moissonneuse brûle
 * 247 L sur quatorze hectares, ce qui est juste. Mais un hectare rend ici 3,6 t
 * quand il en rend 7 en France, si bien qu'à 1,60 le litre le gazole
 * engloutissait 31 % du résultat d'une saison — mesuré en jeu.
 *
 * À 0,90 il pèse environ un dixième de la récolte brute : assez pour qu'on
 * cherche à le réduire, pas assez pour qu'il décide de tout.
 */
export const FUEL_PRICE_PER_L = 0.9;

/** Capacité de la cuve de ferme, en litres `[GD]`. */
export const FUEL_TANK_L = 3000;

/**
 * Gazole offert à l'installation `[GD]`.
 *
 * Six cents litres ne couvraient pas une saison complète — semis, moisson et
 * labour en brûlent 481 — et le joueur neuf se retrouvait à sec au milieu de
 * son premier cycle, avant même d'avoir vendu quoi que ce soit. Douze cents
 * laissent boucler la première campagne et voir la jauge descendre.
 */
export const FUEL_STARTER_L = 1200;

/**
 * Taux de charge d'un attelage, de 0 à 1.
 *
 * Un outil qui demande exactement la puissance disponible fait travailler le
 * moteur à plein ; un outil deux fois trop léger le laisse à mi-régime.
 */
export function engineLoad(powerHp: number, requiredHp: number): number {
  if (powerHp <= 0) return 1;
  return Math.max(0, Math.min(1, requiredHp / powerHp));
}

/**
 * Gazole consommé par un chantier, en litres.
 *
 * `requiredHp` vaut la puissance du porteur pour un automoteur : il est par
 * définition dimensionné pour lui-même.
 */
export function fuelForJob(opts: {
  powerHp: number;
  requiredHp: number;
  hours: number;
}): number {
  const charge = engineLoad(opts.powerHp, opts.requiredHp);
  const parHeure =
    opts.powerHp * FUEL_L_PER_HP_HOUR * (FUEL_IDLE_SHARE + (1 - FUEL_IDLE_SHARE) * charge);
  return Math.round(parHeure * Math.max(0, opts.hours) * 10) / 10;
}

/** Ce que coûte un plein d'appoint, coefficient régional compris. */
export function fuelCost(liters: number, priceMult = 1): number {
  return Math.round(Math.max(0, liters) * FUEL_PRICE_PER_L * Math.max(0.1, priceMult) * 100) / 100;
}
