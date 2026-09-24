/**
 * Ce qui a changé dans le jeu, dit au joueur.
 *
 * ## Pourquoi ce fichier existe
 *
 * « Je te fais pas de retour parce que tu m'en fais pas sur ce que tu as
 * modifié. »
 *
 * La phrase est plus grave qu'elle n'en a l'air : elle décrit une boucle de
 * retour cassée. Un testeur qui ignore ce qui a bougé ne peut ni vérifier la
 * correction qu'il a demandée, ni distinguer un nouveau défaut d'un ancien
 * qu'il n'avait pas remarqué. Il se tait, et on continue à corriger à
 * l'aveugle.
 *
 * ## Ce que ce n'est pas
 *
 * Ce n'est pas le journal des commits. Les messages de commit s'adressent à
 * qui lit le code : ils nomment des fonctions, des routes, des colonnes. Un
 * joueur n'a rien à en faire. Chaque entrée ci-dessous est écrite pour
 * quelqu'un qui joue, dit **ce qu'il peut faire ou voir de différent**, et
 * tient en deux ou trois phrases.
 *
 * La règle de rédaction, une fois pour toutes : si l'entrée ne se termine pas
 * par quelque chose que le joueur peut aller essayer, elle n'a rien à faire
 * ici.
 *
 * ## Où c'est stocké
 *
 * Nulle part ailleurs. La liste voyage avec le jeu ; le navigateur retient
 * seulement la dernière entrée lue, par joueur, comme pour le tutoriel. Une
 * colonne en base aurait suivi le joueur d'un appareil à l'autre — mais le
 * pire qui puisse arriver ici, c'est de relire une bonne nouvelle.
 */

/** Une nouveauté, telle qu'elle s'affiche. */
export type Nouveaute = {
  /**
   * Identifiant stable, et jamais réemployé.
   *
   * C'est lui qui sert de marque-page : le changer rouvrirait le panneau chez
   * tout le monde, le réutiliser masquerait une entrée neuve.
   */
  id: string;
  /** Date de mise en ligne, `AAAA-MM-JJ`. */
  date: string;
  /** Le titre, du point de vue du joueur. */
  titre: string;
  /** Deux ou trois phrases, pas davantage. */
  texte: string;
};

/**
 * De la plus récente à la plus ancienne.
 *
 * L'ordre est celui de l'affichage, et `NOUVEAUTES[0]` est le marque-page :
 * une entrée ajoutée ailleurs qu'en tête ne serait jamais signalée.
 */
export const NOUVEAUTES: readonly Nouveaute[] = [
  {
    id: "2026-09-22-fin-code-secours",
    date: "2026-09-22",
    titre: "Le code de secours n'existe plus",
    texte:
      "Si vous aviez noté un code de secours à la création de votre ferme, vous pouvez " +
      "jeter le papier : il ne sert plus à rien. Le lien par e-mail le remplace, et il ne " +
      "demande rien à conserver. Une seule chose compte désormais — que votre adresse soit " +
      "la bonne dans l'écran Compte.",
  },
  {
    id: "2026-09-21-lien-mot-de-passe",
    date: "2026-09-21",
    titre: "Mot de passe oublié : un lien par e-mail",
    texte:
      "L'écran de connexion peut maintenant vous envoyer un lien pour choisir un nouveau " +
      "mot de passe, valable trente minutes. Personne ne vous renverra jamais l'ancien : " +
      "le serveur ne le détient pas, il n'en garde qu'une empreinte illisible. Vérifiez que " +
      "votre adresse est la bonne dans l'écran Compte — c'est elle qui vous rouvrira la porte.",
  },
  {
    id: "2026-09-21-parcellaire",
    date: "2026-09-21",
    titre: "Les parcelles n'ont plus toutes la même taille",
    texte:
      "Le pays est redécoupé : autour de chez vous, des lots de six à vingt-cinq hectares, " +
      "et la différence se voit dans le paysage. Le prix suit la surface — un grand lot " +
      "coûte plus cher, mais un peu moins cher à l'hectare. Votre parcelle de départ reste " +
      "au format standard, pour tout le monde.",
  },
  {
    id: "2026-09-21-aller-parcelle",
    date: "2026-09-21",
    titre: "Cliquez sur une de vos parcelles pour y aller",
    texte:
      "Dans le paysage, un clic sur un champ qui vous appartient vous y emmène " +
      "directement — plus besoin de passer par les pastilles du rail. Une borne dorée " +
      "plantée au coin de chaque champ vous dit lesquels sont à vous.",
  },
  {
    id: "2026-09-20-entasser",
    date: "2026-09-20",
    titre: "On peut entasser les bêtes au-delà des places",
    texte:
      "L'étable accepte jusqu'au double de sa capacité. Rien ne meurt, mais les conditions " +
      "se dégradent et la production baisse — l'écran d'achat vous dit de combien avant " +
      "que vous validiez.",
  },
  {
    id: "2026-09-20-adventices",
    date: "2026-09-20",
    titre: "Les mauvaises herbes lèvent pour de bon",
    texte:
      "Un champ laissé en l'état se salit, d'autant plus vite que la saison est chaude, et " +
      "la salissure se paie au rendement. L'outil Désherber sert enfin à quelque chose, et " +
      "semer dans un champ sale ne remet plus le compteur à zéro.",
  },
  {
    id: "2026-09-20-vacher",
    date: "2026-09-20",
    titre: "On voit ce que fait l'employé d'élevage",
    texte:
      "La fiche du lot dit ce qu'il a fait à son dernier passage : ration servie, litière " +
      "refaite, fumière vidée à moitié — le surplus part chez le voisin, qui le paie.",
  },
];

/** Le marque-page : l'entrée la plus récente. */
export const DERNIERE_NOUVEAUTE = NOUVEAUTES[0]?.id ?? "";

/**
 * Ce que le joueur n'a pas encore lu.
 *
 * Deux cas, et le second est celui qui compte le jour où ce panneau apparaît.
 *
 * **Il a déjà lu quelque chose** (`vue` désigne une entrée connue) : on rend
 * tout ce qui la précède, c'est-à-dire ce qui est sorti depuis.
 *
 * **Il n'a jamais rien lu.** C'est le cas de tous les joueurs déjà installés —
 * dont le testeur qui a demandé ce panneau. Rendre une liste vide les
 * laisserait dans l'ignorance qu'on cherche justement à corriger ; rendre la
 * liste entière accueillerait un compte créé ce matin par un historique qui ne
 * le concerne pas. On se sert donc de la **date d'inscription** : sont
 * nouvelles les entrées publiées après son arrivée. Un compte neuf n'en a
 * aucune, sans qu'on ait eu à le traiter à part.
 */
export function nouveautesNonLues(opts: {
  /** Identifiant de la dernière entrée lue, si le navigateur s'en souvient. */
  vue?: string | null;
  /** Date de création du compte. */
  compteCreeLe?: string | number | Date | null;
}): readonly Nouveaute[] {
  if (opts.vue) {
    const rang = NOUVEAUTES.findIndex((n) => n.id === opts.vue);
    /* Un identifiant inconnu vient d'une entrée retirée ou d'un marque-page
       abîmé : on retombe sur la date, plutôt que de ne rien montrer. */
    if (rang >= 0) return NOUVEAUTES.slice(0, rang);
  }
  if (opts.compteCreeLe == null) return [];
  const arrivee = new Date(opts.compteCreeLe);
  if (!Number.isFinite(arrivee.getTime())) return [];
  /*
   * Comparaison **au jour**, et de deux chaînes plutôt que de deux instants.
   *
   * Une entrée porte une date, pas une heure : on ne sait pas si la mise en
   * ligne du 20 a précédé ou suivi une inscription du 20 à midi. Le jour
   * d'arrivée est donc considéré comme déjà connu — mieux vaut taire une
   * nouvelle que le joueur a peut-être vue que la lui annoncer alors qu'il
   * jouait déjà avec.
   *
   * Les chaînes `AAAA-MM-JJ` se comparent dans l'ordre chronologique, ce qui
   * évite le piège du fuseau : deux `Date` construites l'une d'un jour nu et
   * l'autre d'un instant ne se comparent pas au même midi.
   */
  const jourArrivee = arrivee.toISOString().slice(0, 10);
  return NOUVEAUTES.filter((n) => n.date > jourArrivee);
}
