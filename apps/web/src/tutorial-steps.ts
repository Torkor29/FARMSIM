/**
 * Le contenu du tutoriel — des données, pas un composant.
 *
 * Il vivait dans `TutorialOverlay.tsx`, ce qui obligeait quiconque voulait le
 * vérifier à charger React et toute la chaîne des imports. Un test qui doit
 * monter la moitié de l'application pour lire une liste de titres finit par
 * ne pas être écrit.
 *
 * Le composant lit ces étapes ; les scènes lisent le type `Scene`. Personne
 * n'a besoin de l'autre.
 */

import { GAME_DAY_MS, SEASON_REAL_HOURS, WINTER_DAYS } from "@farmsim/shared";

/** « 5 h 43 » — la durée réelle de l'hiver, écrite pour un humain. */
function dureeHiver(): string {
  const minutes = Math.round((WINTER_DAYS * GAME_DAY_MS) / 60000);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** Les maquettes animées disponibles — voir `TutorialScenes.tsx`. */
export type Scene =
  | "interface"
  | "onglets"
  | "outils"
  | "selection"
  | "chantier"
  | "desherber"
  | "dechaumer"
  | "fertiliser"
  | "pousse"
  | "recolte"
  | "batir"
  | "troupeau"
  | "cooperative"
  | "concession"
  | "mairie"
  | "personnel";

export type Etape = {
  id: string;
  /** Le chapitre auquel elle appartient — affiché en tête. */
  chapitre: string;
  titre: string;
  /** Ce qu'on lit avec une souris. */
  texte: string;
  /** Ce qu'on lit au doigt, si le geste diffère. */
  texteTactile?: string;
  astuce?: string;
  scene: Scene;
};

export const ETAPES: Etape[] = [
  /* ---- L'écran ---------------------------------------------------- */
  {
    id: "ecran",
    chapitre: "L’écran",
    titre: "Vos repères de jeu",
    texte:
      "Le bandeau du haut donne l’heure, la saison et votre argent. La ferme occupe le centre. Sur ordinateur, les outils sont à gauche et le détail de la case sélectionnée s’ouvre à droite.",
    texteTactile:
      "Le bandeau du haut donne l’heure, la saison et votre argent. La ferme occupe le centre. En bas, le dock rassemble les outils, Plus et le mode de sélection Trace ou Rectangle.",
    astuce: "La carte À faire, juste au-dessus du dock, ouvre le guide complet à tout moment.",
    scene: "interface",
  },
  {
    id: "onglets",
    chapitre: "L’écran",
    titre: "Les panneaux de la ferme",
    texte:
      "À gauche, Mon exploitation ouvre Construire, Personnel et Élevage. La fiche Parcelle s’ouvre à droite quand vous regardez une case. Tout le reste se trouve au village, en bord de route.",
    texteTactile:
      "Touchez Plus dans le dock : le tiroir Panneaux affiche Parcelle, Bâtir, Troupeau et Personnel. Pour vendre, réparer ou prendre des missions, on va au village.",
    astuce: "Le marché, le garage et le bureau ne sont plus des boutons : ce sont la coopérative, la concession et la mairie.",
    scene: "onglets",
  },

  /* ---- Travailler un champ ---------------------------------------- */
  {
    id: "outil",
    chapitre: "Travailler un champ",
    titre: "1 — Choisir l’outil d’abord",
    texte:
      "Choisissez d’abord une famille d’outils : Voir, Semer, Sol ou Récolte. Les choix précis — culture, désherbage, déchaumage, engrais — apparaissent ensuite.",
    texteTactile:
      "Touchez d’abord Voir, Semer, Sol ou Récolte dans le dock. Une rangée s’ouvre au-dessus pour choisir précisément la culture ou le travail du sol.",
    astuce: "Semer propose les céréales, l’herbe et le maraîchage ; Sol contient Désherber, Déchaumer, Labourer et Engrais.",
    scene: "outils",
  },
  {
    id: "selection",
    chapitre: "Travailler un champ",
    titre: "2 — Choisir les cases",
    texte:
      "Cliquez-glissez en travers du champ : toutes les cases du rectangle se sélectionnent d’un coup. Un clic simple en prend une seule.",
    texteTactile:
      "Avec Trace, glissez sur les cases à travailler. Avec Rectangle, un glissé prend toute la zone entre les deux coins. Un toucher simple ajoute ou retire une case.",
    astuce: "Les boutons Tout et Vider permettent de gérer rapidement une grande sélection.",
    scene: "selection",
  },
  {
    id: "faire",
    chapitre: "Travailler un champ",
    titre: "3 — Appuyer sur Faire",
    texte:
      "Une fois les cases choisies, le bouton doré porte l’action exacte et le nombre de cases — Semer ×4, par exemple. Cliquez-le pour envoyer l’attelage.",
    texteTactile:
      "Une fois les cases choisies, touchez le bouton doré qui porte l’action exacte et le nombre de cases — Semer ×4, par exemple.",
    astuce:
      "Pas la bonne machine ? Le dock l’explique et propose Entreprise ou Un joueur quand ces solutions sont disponibles.",
    scene: "chantier",
  },

  /* ---- Nettoyer et préparer --------------------------------------- */
  {
    id: "desherber",
    chapitre: "Nettoyer la terre",
    titre: "Désherber",
    texte:
      "Les mauvaises herbes poussent toutes seules et mangent le rendement. Choisissez Sol puis Désherber, sélectionnez les cases sales et lancez l’action. La fiche Parcelle indique la pression d’adventices.",
    texteTactile:
      "Dans le dock, touchez Sol puis Désherber. Sélectionnez les cases sales et touchez Désherber × le nombre de cases. Plus puis Parcelle affiche la pression d’adventices.",
    astuce: "Une terre propre rapporte plus : c’est le travail le plus rentable du jeu.",
    scene: "desherber",
  },
  {
    id: "dechaumer",
    chapitre: "Nettoyer la terre",
    titre: "Déchaumer et labourer",
    texte:
      "Après la moisson il reste du chaume. Dans Sol, Déchaumer remet la case en état de semer — et remet en herbe une terre nue si vous préférez la laisser reposer. Labourer sert aux cultures perdues.",
    astuce: "Semer dans le chaume est possible : c’est le semis direct, plus rapide et plus cher.",
    scene: "dechaumer",
  },
  {
    id: "fumer",
    chapitre: "Nettoyer la terre",
    titre: "Fertiliser",
    texte:
      "Un sol s’épuise. Dans Sol, Engrais lui rend ce que la culture a pris. Si vous avez des bêtes et une fumière, c’est leur fumier qui part au champ — et il ne coûte rien.",
    astuce: "Le panneau Parcelle affiche la fertilité restante, case par case.",
    scene: "fertiliser",
  },

  /* ---- Le cycle --------------------------------------------------- */
  {
    id: "pousse",
    chapitre: "Le cycle",
    titre: "Attendre",
    texte:
      "La culture passe du vert au doré. La fiche Parcelle donne sa progression. La saison et la météo décident de la vitesse — un blé d’avril ne pousse pas comme un blé d’août.",
    texteTactile:
      "La culture passe du vert au doré. Ouvrez Plus puis Parcelle pour lire sa progression. La saison et la météo décident de la vitesse.",
    // L'hiver est plus court que les trois autres : le dire ici évite qu'un
    // joueur croie son calendrier cassé en le voyant passer deux fois plus
    // vite. Les deux durées se déduisent des constantes, jamais recopiées.
    astuce: `Une saison dure ${SEASON_REAL_HOURS} heures réelles — l’hiver, ${dureeHiver()} seulement. Un jour de jeu, un peu plus d’une heure.`,
    scene: "pousse",
  },
  {
    id: "recolte",
    chapitre: "Le cycle",
    titre: "Récolter",
    texte:
      "Choisissez Récolte, les cases dorées, puis le bouton Récolter. Le grain part au silo. Sans silo, il se vend au champ tout de suite — et moins cher.",
    astuce: "Trop mûr, ça se perd. Le panneau prévient avant que ça n’arrive.",
    scene: "recolte",
  },
  /* ---- Le village ------------------------------------------------ */
  {
    id: "cooperative",
    chapitre: "Le village",
    titre: "Vendre à la coopérative",
    texte:
      "Au bord de la route, le village a trois bâtiments utiles. La coopérative, avec ses silos, ouvre l’hôtel des ventes quand on clique dessus — ou « Ventes » dans le menu de gauche. Le cours bouge chaque jour : garder son grain quelques jours peut rapporter plus, ou moins.",
    texteTactile:
      "Au bord de la route, le village a trois bâtiments utiles. Touchez la coopérative, avec ses silos, pour ouvrir l’hôtel des ventes. Le cours bouge chaque jour : garder son grain peut rapporter plus, ou moins.",
    astuce: "Le village est au bord de la route, derrière les champs : faites glisser la vue pour le trouver. Ma ferme vous ramène.",
    scene: "cooperative",
  },
  {
    id: "concession",
    chapitre: "Le village",
    titre: "Le garage de la concession",
    texte:
      "Cliquez la concession, le showroom aux tracteurs, pour ouvrir le garage — ou « Garage » dans le menu de gauche. On y graisse, nettoie et répare ses machines, on les améliore palier par palier, et on achète du neuf ou de l’occasion.",
    texteTactile:
      "Touchez la concession, le showroom aux tracteurs, pour ouvrir le garage. On y graisse, nettoie et répare ses machines, on les améliore et on achète du neuf ou de l’occasion.",
    astuce: "Une machine graissée et propre s’use moins et récolte un peu plus.",
    scene: "concession",
  },
  {
    id: "mairie",
    chapitre: "Le village",
    titre: "Le bureau de la mairie",
    texte:
      "Cliquez la mairie, sous son horloge — ou « Bureau » dans le menu de gauche — pour ouvrir le bureau : vos objectifs, la bourse des chantiers entre joueurs, la banque et les terres à acheter.",
    texteTactile:
      "Touchez la mairie, sous son horloge, pour ouvrir le bureau : vos objectifs, la bourse des chantiers entre joueurs, la banque et les terres à acheter.",
    astuce: "Un objectif terminé se réclame ici : pensez à passer à la mairie.",
    scene: "mairie",
  },

  /* ---- S'agrandir ------------------------------------------------- */
  {
    id: "batir",
    chapitre: "S’agrandir",
    titre: "Bâtir",
    texte:
      "Onglet Bâtir, un type de bâtiment, puis promenez l’emprise sur le champ : elle est verte où l’on peut poser, rouge ailleurs. Confirmez pour construire.",
    texteTactile:
      "Ouvrez Plus puis Bâtir, choisissez un bâtiment et placez son emprise : verte si la place est libre, rouge si elle est occupée. Confirmez pour construire.",
    astuce: "Le silo est le premier vrai objectif : il vous laisse choisir quand vendre.",
    scene: "batir",
  },
  {
    id: "troupeau",
    chapitre: "S’agrandir",
    titre: "Élever",
    texte:
      "Onglet Troupeau : achetez des bêtes, remplissez la mangeoire d’un geste, sortez-les au pré. Elles donnent lait, œufs, laine et viande — et du fumier pour vos champs.",
    texteTactile:
      "Ouvrez Plus puis Troupeau : achetez des bêtes, remplissez la mangeoire et sortez-les au pré. Elles produisent si elles sont nourries, abreuvées et propres.",
    astuce: "Une bête mal nourrie produit moins. La jauge Ration dit combien de temps il reste.",
    scene: "troupeau",
  },
  {
    id: "personnel",
    chapitre: "S’agrandir",
    titre: "Embaucher",
    texte:
      "Onglet Personnel. Un employé aux champs mène des chantiers à votre place et ménage les machines ; un employé à l’élevage fait mieux produire le troupeau et vide la fumière.",
    texteTactile:
      "Ouvrez Plus puis Personnel. Affectez un employé aux champs pour les chantiers, ou à l’élevage pour aider le troupeau et gérer la fumière.",
    astuce: "Il faut un logement, et un salaire à payer chaque jour. Vous voilà prêt.",
    scene: "personnel",
  },
];
