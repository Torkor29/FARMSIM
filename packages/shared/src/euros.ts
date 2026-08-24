/**
 * L'argent du jeu : des euros, calés sur des prix réels.
 *
 * ## Pourquoi ce module
 *
 * Les prix vivaient chacun dans leur table, sans que rien ne dise d'où ils
 * venaient. Les denrées se trouvaient être à peu près justes — le blé à 220,
 * le lait à 42 l'hectolitre — mais le capital ne l'était pas du tout : un
 * tracteur de 90 chevaux valait douze tonnes de blé, là où il en vaut trois ou
 * quatre cents. Une ferme se rachetait en une moisson et demie.
 *
 * Ce module ne contient pas de prix. Il dit **d'où ils sortent** et donne de
 * quoi les écrire lisiblement, pour que la table d'à côté reste la seule
 * source. Les valeurs elles-mêmes sont dans `MACHINE_DEFS`, `BUILDING_DEFS`,
 * `GOOD_DEFS`, `SPECIES` et `land.ts`, chacune annotée de son ancre réelle.
 *
 * ## Les ancres
 *
 * Prix de marché français, ordres de grandeur 2024-2025 :
 *
 *     blé tendre            210 € / t
 *     orge                  190 € / t
 *     maïs grain            205 € / t
 *     colza                 460 € / t
 *     pois protéagineux     265 € / t
 *     lait                   45 € / hL
 *     terre agricole      5 200 € / ha
 *     tracteur 90 ch     30 000 € (occasion révisée)
 *     moissonneuse       78 000 € (occasion)
 *     vache laitière      1 650 €
 *     brebis                170 €
 *     poule pondeuse          7 €
 *
 * ## Ce qui n'est pas réel, et pourquoi
 *
 * **Les rendements.** Le jeu rend 3,6 t de blé à l'hectare quand la France en
 * rend 7,2. C'est un choix ancien et assumé : il raccourcit les cycles sans
 * toucher aux surfaces. On ne l'a pas défait ici — le remonter changerait la
 * ration des bêtes, la taille des silos, les objectifs de mission et le calibre
 * des contrats, c'est-à-dire tout autre chose que « mettre des euros ».
 *
 * **Le gazole**, à 0,90 € le litre au lieu de 1,55. Conséquence directe du
 * point précédent : à moitié de récolte et plein tarif, il engloutissait un
 * tiers du résultat d'une saison — mesuré en jeu. Voir `fuel.ts`.
 *
 * **Le calendrier.** Une saison dure dix heures réelles, une année de jeu
 * quarante. Une ferme encaisse donc en une soirée ce qu'elle encaisserait en
 * une saison réelle — et c'est ce qui rend un tracteur d'occasion accessible
 * en quelques soirées plutôt qu'en deux ans.
 */

/**
 * Une somme en euros, écrite pour un humain.
 *
 * Espace comme séparateur de milliers, symbole après le nombre, pas de
 * centimes : c'est l'usage français, et c'est ce qui rend « 78 000 € » lisible
 * d'un coup d'œil là où « 78000€ » demande de compter les zéros.
 *
 * Espace ordinaire, et pas l'espace fine insécable de la typographie soignée :
 * elle s'était glissée ici et les comparaisons échouaient sur deux chaînes
 * rigoureusement identiques à l'œil. Une monnaie s'affiche à mille endroits ;
 * elle doit se comparer, se chercher et se copier sans piège.
 */
export function formatEuros(montant: number): string {
  const n = Math.round(montant);
  const signe = n < 0 ? "-" : "";
  const chiffres = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${signe}${chiffres} €`;
}

/**
 * La même somme, abrégée quand elle est longue.
 *
 * Pour les puces étroites du téléphone : « 200 000 € » n'y tient pas et se
 * faisait couper en « 200 000… », qui perd à la fois l'unité et l'ordre de
 * grandeur. Abréger est plus honnête que couper.
 */
export function formatEurosCourt(montant: number): string {
  const n = Math.round(montant);
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} M€`;
  }
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)} k€`;
  return formatEuros(n);
}

/** Un prix à la tonne, à l'unité près. */
export function formatEurosParTonne(montant: number, unite = "t"): string {
  return `${formatEuros(montant)} / ${unite}`;
}
