/**
 * Les employés de la ferme — règles pures.
 *
 * ## D'où ça vient
 *
 * Un seul tracteur ne mène plus deux chantiers. La contrainte est juste, mais
 * elle ouvre aussitôt la question suivante, posée en jouant : « t'as deux
 * tracteurs mais t'es tout seul, et du coup avoir besoin d'un employé à ce
 * moment ». Sans main-d'œuvre, le second attelage ne sert à rien.
 *
 * ## La règle qui tient tout
 *
 * **Le matériel plafonne, l'employé débloque.** Un chantier simultané de plus
 * demande *et* un attelage libre *et* quelqu'un pour le conduire ; aucun des
 * deux ne remplace l'autre. Si l'employé remplaçait le matériel, on
 * embaucherait au lieu d'acheter et le catalogue d'engins perdrait son sens ;
 * s'il ne faisait qu'accélérer, ce serait une remise sur le temps.
 *
 * Le joueur reste conducteur par défaut : il mène toujours un chantier sans
 * personne. Le premier employé permet le deuxième, et ainsi de suite.
 *
 * ## Les chiffres, et d'où ils sortent
 *
 * Ils ne sont pas inventés : ils se déduisent de ce que rapporte une parcelle.
 * Douze sur douze, environ 120 cases cultivables, du blé à 0,35 t la case et
 * 220 € la tonne — 9 240 € bruts, dont 4 080 repartent en semence, engrais,
 * labour et déchaumage. Le blé mûrit en 28 heures réelles, soit près de vingt
 * jours de jeu : **une parcelle rapporte environ 260 € nets par jour de jeu**.
 *
 * C'est l'unité qui donne son sens au salaire. Un débutant à trois points
 * coûte 60 € par jour et se rentabilise dès qu'il fait tourner une
 * demi-parcelle de plus ; un excellent à quinze points en coûte 300 et ne se
 * paie que si ses compétences rapportent ailleurs — moins de casse, un
 * troupeau qui produit mieux. C'est l'arbitrage qu'on veut.
 */

import { hasard } from "./climate.js";

/** Ce qu'un employé sait faire. Trois axes, pas huit. */
export type EmployeeSkill = "conduite" | "mecanique" | "elevage";

export const EMPLOYEE_SKILLS: readonly EmployeeSkill[] = [
  "conduite",
  "mecanique",
  "elevage",
] as const;

export const EMPLOYEE_SKILL_LABELS: Record<EmployeeSkill, string> = {
  conduite: "Conduite",
  mecanique: "Mécanique",
  elevage: "Élevage",
};

/**
 * Ce que chaque compétence change, dit au joueur.
 *
 * Chacune s'accroche à un levier qui existe déjà dans le jeu. Une compétence
 * qui ne change rien n'est qu'un chiffre décoratif de plus.
 */
export const EMPLOYEE_SKILL_EFFECTS: Record<EmployeeSkill, string> = {
  conduite: "Chantiers plus rapides — jusqu’à 25 % au niveau 5",
  mecanique: "Moins d’usure et de pannes — jusqu’à 40 %",
  elevage: "Le troupeau produit mieux — jusqu’à 20 %",
};

/** Niveau d'une compétence : de 1 à 5, comme les paliers d'engins. */
export const SKILL_MIN = 1;
export const SKILL_MAX = 5;

/** Un employé, réduit à ce qui décide de quelque chose. */
export type Employee = {
  id: string;
  name: string;
  conduite: number;
  mecanique: number;
  elevage: number;
  /** Affecté au champ, ou au troupeau. Il ne fait pas les deux le même jour. */
  poste: EmployeePost;
};

/**
 * Où l'employé passe sa journée.
 *
 * C'est ce qui rend la troisième compétence intéressante plutôt qu'additive :
 * un employé affecté à l'élevage ne conduit pas, et ne débloque donc pas de
 * chantier ce jour-là. On choisit.
 */
export type EmployeePost = "CHAMP" | "ELEVAGE";

export const EMPLOYEE_POST_LABELS: Record<EmployeePost, string> = {
  CHAMP: "Aux champs",
  ELEVAGE: "À l’élevage",
};

/** Somme des points de compétence — c'est elle qui fait le salaire. */
export function skillPoints(e: Pick<Employee, "conduite" | "mecanique" | "elevage">): number {
  return (
    borneNiveau(e.conduite) + borneNiveau(e.mecanique) + borneNiveau(e.elevage)
  );
}

function borneNiveau(n: number): number {
  if (!Number.isFinite(n)) return SKILL_MIN;
  return Math.min(SKILL_MAX, Math.max(SKILL_MIN, Math.round(n)));
}

/* ------------------------------------------------------------------ */
/* Le salaire                                                          */
/* ------------------------------------------------------------------ */

/** Par point de compétence et par jour de jeu. */
export const SALAIRE_PAR_POINT = 20;

/** Plancher : personne ne travaille pour trois fois rien. */
export const SALAIRE_PLANCHER = 60;

/** Ce qu'un logement fait gagner sur le salaire de celui qu'il héberge. */
export const REMISE_LOGE = 0.35;

/**
 * Combien de jours de salaire impayés avant qu'un employé s'en aille.
 *
 * Deux, et pas zéro : une trésorerie qui passe sous le montant d'un salaire
 * arrive à tout le monde, et perdre son équipe pour une journée serrée serait
 * une punition sans avertissement. Deux jours de jeu font près de trois heures
 * réelles — de quoi vendre une récolte en se connectant une fois.
 *
 * Pas trois non plus : au-delà, la main-d'œuvre cesserait d'être une charge
 * qu'on doit tenir, et l'on embaucherait sans jamais regarder le solde.
 */
export const SALAIRE_IMPAYE_MAX_JOURS = 2;

/**
 * Le salaire journalier d'un employé, logé ou non.
 *
 * Prélevé au tour de simulation qui franchit le changement de jour — le même
 * mécanisme que les intérêts de la dette, qui court déjà hors connexion.
 */
export function salaireJournalier(
  e: Pick<Employee, "conduite" | "mecanique" | "elevage">,
  opts: { loge?: boolean } = {},
): number {
  const plein = Math.max(SALAIRE_PLANCHER, SALAIRE_PAR_POINT * skillPoints(e));
  return Math.round(opts.loge ? plein * (1 - REMISE_LOGE) : plein);
}

/** La masse salariale d'une journée, logements pris en compte. */
export function masseSalariale(
  employes: readonly Pick<Employee, "conduite" | "mecanique" | "elevage">[],
  litsDisponibles: number,
): number {
  // Les mieux payés dorment sur place : c'est là que la remise rapporte le
  // plus, et c'est ce que ferait n'importe quel patron.
  const tries = [...employes].sort((a, b) => skillPoints(b) - skillPoints(a));
  return tries.reduce(
    (somme, e, i) => somme + salaireJournalier(e, { loge: i < Math.max(0, litsDisponibles) }),
    0,
  );
}

/* ------------------------------------------------------------------ */
/* Le logement                                                         */
/* ------------------------------------------------------------------ */

/**
 * Combien on peut embaucher sans rien bâtir.
 *
 * Sans cette porte, le tout premier employé demanderait un bâtiment avant le
 * moindre bénéfice, et personne ne découvrirait le système. Ces deux-là
 * logent au village et coûtent plein tarif.
 */
export const EMPLOYES_SANS_LOGEMENT = 2;

/**
 * Lits offerts par un logement, selon son niveau.
 *
 * Reprend l'échelle de niveaux des bâtiments plutôt que d'en inventer une
 * seconde qui divergerait : un multiplicateur de capacité arrondi au
 * supérieur donne 1, 2, 3, 4, 5 — et les paliers de niveau joueur (3, 6, 10
 * pour les trois derniers) s'appliquent déjà.
 */
export function litsDuLogement(niveau: number, capacityMult: number): number {
  if (niveau <= 0) return 0;
  return Math.max(1, Math.ceil(capacityMult));
}

/** Peut-on encore embaucher, vu les lits et la tolérance sans logement ? */
export function peutEmbaucher(opts: { employes: number; lits: number }): boolean {
  return opts.employes < Math.max(EMPLOYES_SANS_LOGEMENT, opts.lits);
}

/* ------------------------------------------------------------------ */
/* Le plafond de chantiers                                             */
/* ------------------------------------------------------------------ */

/**
 * Combien de chantiers peuvent tourner en même temps.
 *
 * Le joueur compte pour un conducteur. Seuls les employés **aux champs**
 * ajoutent une paire de bras : celui qui passe sa journée à l'élevage ne
 * conduit pas.
 *
 * Le plafond compte les chantiers, pas les parcelles — une ferme dont une
 * parcelle entière ne porte que des bâtiments est un cas normal, et découper
 * un grand champ en plusieurs passages ne doit rien coûter.
 */
export function chantiersSimultanes(opts: {
  employesAuChamp: number;
  attelagesLibres: number;
}): number {
  const bras = 1 + Math.max(0, Math.floor(opts.employesAuChamp));
  return Math.max(0, Math.min(bras, Math.max(0, Math.floor(opts.attelagesLibres))));
}

/* ------------------------------------------------------------------ */
/* Ce que les compétences changent                                     */
/* ------------------------------------------------------------------ */

/** Chantier plus rapide : 5 % par niveau au-delà du premier, jusqu'à 25 %. */
export function gainConduite(niveau: number): number {
  return (borneNiveau(niveau) - 1) * 0.0625;
}

/** Moins d'usure : 10 % par niveau au-delà du premier, jusqu'à 40 %. */
export function gainMecanique(niveau: number): number {
  return (borneNiveau(niveau) - 1) * 0.1;
}

/** Troupeau mieux tenu : 5 % de production par niveau au-delà du premier. */
export function gainElevage(niveau: number): number {
  return (borneNiveau(niveau) - 1) * 0.05;
}

/* ------------------------------------------------------------------ */
/* Le vivier                                                           */
/* ------------------------------------------------------------------ */

/** Combien de candidats se présentent à la fois. */
export const CANDIDATS_PAR_JOUR = 3;

/**
 * Prénoms du vivier — courts, mixtes, sans connotation.
 *
 * Le jeu ne demande pas au joueur de choisir une personne mais un profil : le
 * prénom sert à s'en souvenir d'un menu à l'autre, rien de plus.
 */
const PRENOMS = [
  "Camille", "Sacha", "Noa", "Lou", "Éliot", "Maël", "Anouk", "Timéo",
  "Alix", "Nino", "Jade", "Robin", "Léa", "Youn", "Soline", "Marius",
] as const;

/** Un candidat : un employé qu'on n'a pas encore embauché. */
export type Candidate = Omit<Employee, "poste"> & { salaire: number };

/**
 * Les candidats du jour, pour cette ferme.
 *
 * **Déterministe, et c'est tout l'enjeu.** Sans cela le joueur recharge la
 * page jusqu'à tomber sur un conducteur 5/5, et le choix qu'on vient de lui
 * offrir disparaît. Le jeu sait déjà faire exactement ça pour la météo — même
 * fonction de tirage, même raison.
 *
 * Le vivier se renouvelle à chaque jour de jeu, soit toutes les 1 h 26
 * réelles. Assez court pour ne bloquer personne qui a besoin d'une paire de
 * bras, assez long pour qu'à l'intérieur d'une partie, refuser les trois soit
 * un vrai renoncement.
 */
export function candidatsDuJour(farmId: string, jourIndex: number): Candidate[] {
  const candidats: Candidate[] = [];
  for (let i = 0; i < CANDIDATS_PAR_JOUR; i++) {
    const graine = `${farmId}:${jourIndex}:${i}`;
    const prenom = PRENOMS[Math.floor(hasard(`${graine}:nom`) * PRENOMS.length)]!;
    const conduite = niveauTire(`${graine}:conduite`);
    const mecanique = niveauTire(`${graine}:mecanique`);
    const elevage = niveauTire(`${graine}:elevage`);
    const profil = { conduite, mecanique, elevage };
    candidats.push({
      // L'identifiant porte la graine : deux appels le même jour donnent les
      // mêmes gens, et l'embauche sait de qui elle parle.
      id: `cand-${farmId}-${jourIndex}-${i}`,
      name: `${prenom} ${String.fromCharCode(65 + Math.floor(hasard(`${graine}:initiale`) * 26))}.`,
      ...profil,
      salaire: salaireJournalier(profil),
    });
  }
  return candidats;
}

/**
 * Un niveau tiré au sort, penché vers le milieu.
 *
 * Un tirage plat donnerait autant de 5/5/5 que de 1/1/1 : les excellents
 * cesseraient d'être un événement, et le vivier n'aurait plus d'intérêt. La
 * moyenne de deux tirages suffit à recentrer, sans jamais interdire les
 * extrêmes.
 */
function niveauTire(graine: string): number {
  const moyenne = (hasard(`${graine}:a`) + hasard(`${graine}:b`)) / 2;
  return borneNiveau(SKILL_MIN + moyenne * (SKILL_MAX - SKILL_MIN + 0.99));
}
