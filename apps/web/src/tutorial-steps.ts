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

/** Les maquettes animées disponibles — voir `TutorialScenes.tsx`. */
export type Scene =
  | "interface"
  | "outils"
  | "selection"
  | "chantier"
  | "pousse"
  | "recolte"
  | "nettoyer"
  | "batir"
  | "troupeau"
  | "vendre";

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
    titre: "Trois zones, et c’est tout",
    texte:
      "Au centre, votre ferme vue du ciel. À droite, le détail de ce que vous avez sous le curseur. En bas, la barre : à gauche les outils, à droite les six onglets.",
    texteTactile:
      "Au centre, votre ferme vue du ciel. À droite, le détail de ce que vous touchez. En bas, la barre : à gauche les outils, à droite les six onglets.",
    astuce: "Le bouton ? ouvre le guide complet à tout moment.",
    scene: "interface",
  },
  {
    id: "onglets",
    chapitre: "L’écran",
    titre: "Les six onglets",
    texte:
      "Parcelle décrit votre terre. Bâtir pose les bâtiments. Troupeau gère les bêtes. Garage tient les machines. Missions donne les objectifs. Personnel embauche.",
    astuce: "Chacun a un raccourci clavier — P pour le personnel, par exemple.",
    scene: "interface",
  },

  /* ---- Travailler un champ ---------------------------------------- */
  {
    id: "outil",
    chapitre: "Travailler un champ",
    titre: "1 — Choisir l’outil d’abord",
    texte:
      "C’est l’étape qu’on oublie. Cliquez un outil dans la barre du bas — Semer, Désherber, Récolter — avant de toucher la moindre case. L’outil décide de ce qui va se passer.",
    texteTactile:
      "C’est l’étape qu’on oublie. Touchez un outil dans la barre du bas — Semer, Désherber, Récolter — avant de toucher la moindre case. L’outil décide de ce qui va se passer.",
    astuce: "Semer ouvre le choix de la culture : blé, maïs, orge, pois, colza, herbe.",
    scene: "outils",
  },
  {
    id: "selection",
    chapitre: "Travailler un champ",
    titre: "2 — Choisir les cases",
    texte:
      "Cliquez-glissez en travers du champ : toutes les cases du rectangle se sélectionnent d’un coup. Un clic simple en prend une seule.",
    texteTactile:
      "Touchez les cases une à une : chacune s’ajoute à la sélection. Retouchez-en une pour la retirer.",
    astuce: "Plus l’outil est large, plus le chantier va vite par case.",
    scene: "selection",
  },
  {
    id: "faire",
    chapitre: "Travailler un champ",
    titre: "3 — Appuyer sur Faire",
    texte:
      "Rien ne part tant que vous n’avez pas touché le bouton doré. L’attelage sort du garage, traverse le champ, et le travail prend le temps qu’il faut.",
    astuce:
      "Pas la bonne machine ? Le bouton vous le dit avant, et Missions propose de faire faire le travail par quelqu’un d’autre.",
    scene: "chantier",
  },

  /* ---- Nettoyer et préparer --------------------------------------- */
  {
    id: "desherber",
    chapitre: "Nettoyer la terre",
    titre: "Désherber",
    texte:
      "Les mauvaises herbes poussent toutes seules et mangent le rendement. Outil Désherber, les cases sales, puis Faire. Le panneau de droite indique la pression d’adventices.",
    astuce: "Une terre propre rapporte plus : c’est le travail le plus rentable du jeu.",
    scene: "nettoyer",
  },
  {
    id: "dechaumer",
    chapitre: "Nettoyer la terre",
    titre: "Déchaumer et labourer",
    texte:
      "Après la moisson il reste du chaume. Déchaumer remet la case en état de semer — et remet en herbe une terre nue si vous préférez la laisser reposer. Labourer sert aux cultures perdues.",
    astuce: "Semer dans le chaume est possible : c’est le semis direct, plus rapide et plus cher.",
    scene: "nettoyer",
  },
  {
    id: "fumer",
    chapitre: "Nettoyer la terre",
    titre: "Fertiliser",
    texte:
      "Un sol s’épuise. Fertiliser lui rend ce que la culture a pris. Si vous avez des bêtes et une fumière, c’est leur fumier qui part au champ — et il ne coûte rien.",
    astuce: "Le panneau Parcelle affiche l’azote restant, case par case.",
    scene: "nettoyer",
  },

  /* ---- Le cycle --------------------------------------------------- */
  {
    id: "pousse",
    chapitre: "Le cycle",
    titre: "Attendre",
    texte:
      "La culture passe du vert au doré. La barre du panneau de droite dit où elle en est. La saison et la météo décident de la vitesse — un blé d’avril ne pousse pas comme un blé d’août.",
    astuce: "Une saison dure dix heures réelles, un jour de jeu un peu plus d’une heure.",
    scene: "pousse",
  },
  {
    id: "recolte",
    chapitre: "Le cycle",
    titre: "Récolter",
    texte:
      "Outil Récolter, les cases dorées, puis Faire. Le grain part au silo. Sans silo, il se vend au champ tout de suite — et moins cher.",
    astuce: "Trop mûr, ça se perd. Le panneau prévient avant que ça n’arrive.",
    scene: "recolte",
  },
  {
    id: "vendre",
    chapitre: "Le cycle",
    titre: "Vendre au bon moment",
    texte:
      "L’onglet Missions ouvre l’hôtel des ventes. Le cours bouge chaque jour : garder son grain quelques jours peut rapporter davantage, ou moins.",
    astuce: "Vous pouvez aussi vendre aux autres joueurs — l’éleveur cherche du foin et du maïs.",
    scene: "vendre",
  },

  /* ---- S'agrandir ------------------------------------------------- */
  {
    id: "batir",
    chapitre: "S’agrandir",
    titre: "Bâtir",
    texte:
      "Onglet Bâtir, un type de bâtiment, puis promenez l’emprise sur le champ : elle est verte où l’on peut poser, rouge ailleurs. Confirmez pour construire.",
    astuce: "Le silo est le premier vrai objectif : il vous laisse choisir quand vendre.",
    scene: "batir",
  },
  {
    id: "troupeau",
    chapitre: "S’agrandir",
    titre: "Élever",
    texte:
      "Onglet Troupeau : achetez des bêtes, remplissez la mangeoire d’un geste, sortez-les au pré. Elles donnent lait, œufs, laine et viande — et du fumier pour vos champs.",
    astuce: "Une bête mal nourrie produit moins. La jauge Ration dit combien de temps il reste.",
    scene: "troupeau",
  },
  {
    id: "personnel",
    chapitre: "S’agrandir",
    titre: "Embaucher",
    texte:
      "Onglet Personnel. Un employé aux champs mène des chantiers à votre place et ménage les machines ; un employé à l’élevage fait mieux produire le troupeau et vide la fumière.",
    astuce: "Il faut un logement, et un salaire à payer chaque jour. Vous voilà prêt.",
    scene: "troupeau",
  },
];
