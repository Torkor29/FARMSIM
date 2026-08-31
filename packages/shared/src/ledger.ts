/**
 * Les postes du journal.
 *
 * Un solde ne dit rien. Savoir qu'on a 14 000 € n'apprend ni si l'élevage
 * paie sa nourriture, ni si la sous-traitance rapporte plus qu'elle ne coûte,
 * ni si une machine mérite d'être gardée. Ce sont pourtant les seules vraies
 * décisions de gestion du jeu, et aucune n'était possible : rien n'était
 * enregistré.
 *
 * Le découpage suit les **ateliers de l'exploitation**, pas les routes de
 * l'API : le joueur raisonne en « mon élevage », « mes cultures », « mes
 * machines », pas en `POST /herds/:id/milk`. Un poste qui ne répond à aucune
 * question qu'on se pose n'a rien à faire ici.
 */

export type LedgerPoste =
  | "CULTURES"
  | "ELEVAGE"
  | "MACHINES"
  | "BATIMENTS"
  | "TERRES"
  | "CHANTIERS"
  | "INTRANTS"
  | "PROGRESSION"
  /** Intérêts, tirages et remboursements de la ligne de crédit. */
  | "BANQUE"
  /** Les salaires du personnel, prélevés au changement de jour de jeu. */
  | "SALAIRES";

export const LEDGER_POSTES: LedgerPoste[] = [
  "CULTURES",
  "ELEVAGE",
  "MACHINES",
  "BATIMENTS",
  "TERRES",
  "CHANTIERS",
  "INTRANTS",
  "PROGRESSION",
  "BANQUE",
  "SALAIRES",
];

export const LEDGER_LABELS: Record<LedgerPoste, string> = {
  CULTURES: "Cultures",
  ELEVAGE: "Élevage",
  MACHINES: "Machines",
  BATIMENTS: "Bâtiments",
  TERRES: "Terres",
  CHANTIERS: "Chantiers",
  INTRANTS: "Intrants",
  PROGRESSION: "Progression",
  BANQUE: "Banque",
  SALAIRES: "Salaires",
};

/** Ce que chaque poste recouvre, pour l'infobulle du Bureau. */
export const LEDGER_HINTS: Record<LedgerPoste, string> = {
  CULTURES: "Ventes de récolte, semences",
  ELEVAGE: "Lait, œufs, laine, viande, fumier, achat de bêtes",
  MACHINES: "Achat, revente, réparations, graissage, lavage",
  BATIMENTS: "Construction, amélioration, démolition",
  TERRES: "Achat de parcelles",
  CHANTIERS: "Travail pris chez les voisins, travail fait faire",
  INTRANTS: "Fourrage, paille, engrais achetés",
  PROGRESSION: "Récompenses de quêtes et de contrats",
  BANQUE: "Tirages, remboursements et intérêts de la ligne de crédit",
  SALAIRES: "Le personnel, payé chaque jour de jeu",
};

export type LedgerLine = {
  amount: number;
  poste: LedgerPoste;
  label: string;
  at: string;
};

export type PosteTotal = {
  poste: LedgerPoste;
  recettes: number;
  depenses: number;
  solde: number;
};

/**
 * Recettes et dépenses par poste, sur les lignes fournies.
 *
 * Les deux sens sont gardés séparés : un poste à l'équilibre n'est pas un
 * poste sans activité, et c'est justement l'écart entre ce qu'un atelier
 * encaisse et ce qu'il coûte qui répond à « est-ce que ça vaut le coup ».
 */
export function totauxParPoste(lignes: LedgerLine[]): PosteTotal[] {
  const par = new Map<LedgerPoste, PosteTotal>();
  for (const poste of LEDGER_POSTES) {
    par.set(poste, { poste, recettes: 0, depenses: 0, solde: 0 });
  }
  for (const l of lignes) {
    const t = par.get(l.poste);
    if (!t) continue;
    if (l.amount >= 0) t.recettes += l.amount;
    else t.depenses += -l.amount;
    t.solde += l.amount;
  }
  return [...par.values()]
    .filter((t) => t.recettes > 0 || t.depenses > 0)
    .sort((a, b) => Math.abs(b.solde) - Math.abs(a.solde));
}

/** Le résultat d'ensemble sur la période lue. */
export function resultat(lignes: LedgerLine[]): {
  recettes: number;
  depenses: number;
  solde: number;
} {
  let recettes = 0;
  let depenses = 0;
  for (const l of lignes) {
    if (l.amount >= 0) recettes += l.amount;
    else depenses += -l.amount;
  }
  return { recettes, depenses, solde: recettes - depenses };
}
