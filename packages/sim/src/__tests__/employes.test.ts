/**
 * Les employés : la règle, les chiffres, et le vivier.
 *
 * ## D'où viennent ces valeurs
 *
 * Elles ne sont pas choisies au doigt mouillé, et c'est ce que ces tests
 * tiennent en premier. Une parcelle de blé — 12×12, environ 120 cases
 * cultivables, 0,35 t la case à 220 € la tonne, moins 4 080 € de semence,
 * engrais, labour et déchaumage — dégage 5 160 € nets par cycle. Le blé mûrit
 * en 28 heures réelles, soit près de vingt jours de jeu : **260 € nets par
 * jour de jeu et par parcelle**.
 *
 * Un premier barème à 60 € le point mettait un employé moyen à 420 € par
 * jour : il coûtait plus qu'une parcelle entière. D'où 20 € le point.
 *
 * ## La règle
 *
 * « Le matériel plafonne, l'employé débloque. » Un chantier simultané de plus
 * demande *et* un attelage libre *et* quelqu'un pour le conduire. C'est la
 * seule formulation qui évite les deux pièges : un employé qui remplacerait
 * le matériel viderait le catalogue d'engins de son sens, un employé qui ne
 * ferait qu'accélérer serait une remise sur le temps.
 */

import {
  CANDIDATS_PAR_JOUR,
  EMPLOYES_SANS_LOGEMENT,
  candidatsDuJour,
  chantiersSimultanes,
  gainConduite,
  gainElevage,
  gainMecanique,
  litsDuLogement,
  masseSalariale,
  peutEmbaucher,
  salaireJournalier,
  skillPoints,
  SALAIRE_IMPAYE_MAX_JOURS,
  BUILDING_LEVELS,
} from "@farmsim/shared";

const DEBUTANT = { conduite: 1, mecanique: 1, elevage: 1 };
const MOYEN = { conduite: 4, mecanique: 2, elevage: 1 };
const EXCELLENT = { conduite: 5, mecanique: 5, elevage: 5 };

describe("le salaire", () => {
  it("suit les points, avec un plancher", () => {
    expect(skillPoints(DEBUTANT)).toBe(3);
    // 3 points × 20 € = 60 € : le plancher et le barème se rejoignent ici.
    expect(salaireJournalier(DEBUTANT)).toBe(60);
    expect(salaireJournalier(MOYEN)).toBe(140);
    expect(salaireJournalier(EXCELLENT)).toBe(300);
  });

  it("reste sous ce que rapporte une parcelle, sauf tout en haut", () => {
    /*
     * 260 € nets par jour de jeu et par parcelle. Un employé moyen en coûte
     * un peu plus de la moitié : il se rentabilise dès qu'il fait tourner une
     * demi-parcelle de plus. L'excellent dépasse — voulu : il ne se paie que
     * si ses compétences rapportent ailleurs.
     */
    expect(salaireJournalier(MOYEN)).toBeLessThan(260);
    expect(salaireJournalier(EXCELLENT)).toBeGreaterThan(260);
  });

  it("baisse de 35 % pour un logé", () => {
    expect(salaireJournalier(MOYEN, { loge: true })).toBe(91);
  });

  it("loge les mieux payés d'abord", () => {
    // La remise rapporte le plus là où le salaire est le plus gros. Un seul
    // lit pour deux : il revient à l'excellent, pas au débutant.
    const avecUnLit = masseSalariale([DEBUTANT, EXCELLENT], 1);
    expect(avecUnLit).toBe(salaireJournalier(EXCELLENT, { loge: true }) + 60);
    // Sans lit, tout le monde paie plein tarif.
    expect(masseSalariale([DEBUTANT, EXCELLENT], 0)).toBe(360);
  });
});

describe("le logement", () => {
  it("reprend l'échelle de niveaux des bâtiments : 1 à 5 lits", () => {
    const lits = BUILDING_LEVELS.map((n) => litsDuLogement(n.level, n.capacityMult));
    expect(lits).toEqual([1, 2, 3, 4, 5]);
  });

  it("laisse embaucher deux personnes sans rien bâtir", () => {
    // Sinon le premier employé demanderait un bâtiment avant le moindre
    // bénéfice, et personne ne découvrirait le système.
    expect(EMPLOYES_SANS_LOGEMENT).toBe(2);
    expect(peutEmbaucher({ employes: 0, lits: 0 })).toBe(true);
    expect(peutEmbaucher({ employes: 1, lits: 0 })).toBe(true);
    expect(peutEmbaucher({ employes: 2, lits: 0 })).toBe(false);
  });

  it("ouvre au-delà dès qu'il y a des lits", () => {
    expect(peutEmbaucher({ employes: 2, lits: 3 })).toBe(true);
    expect(peutEmbaucher({ employes: 3, lits: 3 })).toBe(false);
    // Un logement plus petit que la tolérance ne retire rien à personne.
    expect(peutEmbaucher({ employes: 1, lits: 1 })).toBe(true);
  });
});

describe("le plafond de chantiers", () => {
  it("le joueur compte pour un conducteur", () => {
    expect(chantiersSimultanes({ employesAuChamp: 0, attelagesLibres: 3 })).toBe(1);
    expect(chantiersSimultanes({ employesAuChamp: 2, attelagesLibres: 3 })).toBe(3);
  });

  it("le matériel plafonne autant que les bras", () => {
    // Deux employés, un seul attelage libre : un seul chantier. C'est toute
    // la règle — aucun des deux ne remplace l'autre.
    expect(chantiersSimultanes({ employesAuChamp: 2, attelagesLibres: 1 })).toBe(1);
    expect(chantiersSimultanes({ employesAuChamp: 0, attelagesLibres: 0 })).toBe(0);
  });

  it("celui qui est à l'élevage ne conduit pas", () => {
    // C'est ce qui rend le troisième axe un choix plutôt qu'un bonus de plus.
    expect(chantiersSimultanes({ employesAuChamp: 0, attelagesLibres: 5 })).toBe(1);
  });
});

describe("ce que les compétences changent", () => {
  it("ne donne rien au niveau 1, et le maximum annoncé au niveau 5", () => {
    expect(gainConduite(1)).toBe(0);
    expect(gainMecanique(1)).toBe(0);
    expect(gainElevage(1)).toBe(0);
    expect(gainConduite(5)).toBeCloseTo(0.25, 5);
    expect(gainMecanique(5)).toBeCloseTo(0.4, 5);
    expect(gainElevage(5)).toBeCloseTo(0.2, 5);
  });

  it("borne un niveau aberrant au lieu de s'emballer", () => {
    expect(gainConduite(99)).toBeCloseTo(0.25, 5);
    expect(gainConduite(-3)).toBe(0);
  });
});

describe("le vivier", () => {
  it("propose trois candidats", () => {
    expect(candidatsDuJour("ferme-1", 10)).toHaveLength(CANDIDATS_PAR_JOUR);
  });

  it("redonne exactement les mêmes le même jour", () => {
    /*
     * C'est l'enjeu du tirage déterministe : sans lui, le joueur recharge la
     * page jusqu'à tomber sur un conducteur 5/5, et le choix qu'on vient de
     * lui offrir n'existe plus.
     */
    expect(candidatsDuJour("ferme-1", 10)).toEqual(candidatsDuJour("ferme-1", 10));
  });

  it("en propose d'autres le lendemain, et d'autres à la ferme voisine", () => {
    const aujourdhui = candidatsDuJour("ferme-1", 10);
    expect(candidatsDuJour("ferme-1", 11)).not.toEqual(aujourdhui);
    expect(candidatsDuJour("ferme-2", 10)).not.toEqual(aujourdhui);
  });

  it("tient les niveaux dans les bornes, et annonce le bon salaire", () => {
    for (let jour = 0; jour < 40; jour++) {
      for (const c of candidatsDuJour("ferme-test", jour)) {
        for (const n of [c.conduite, c.mecanique, c.elevage]) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(5);
          expect(Number.isInteger(n)).toBe(true);
        }
        expect(c.salaire).toBe(salaireJournalier(c));
        expect(c.name).toMatch(/^\S+ [A-Z]\.$/);
      }
    }
  });

  it("penche vers le milieu : un 5/5/5 reste un événement", () => {
    /*
     * Un tirage plat donnerait autant d'excellents que de débutants, et le
     * vivier n'aurait plus d'intérêt. On vérifie la forme, pas une valeur :
     * la majorité des candidats se tient dans la moitié centrale.
     */
    let centraux = 0;
    let total = 0;
    for (let jour = 0; jour < 200; jour++) {
      for (const c of candidatsDuJour("ferme-forme", jour)) {
        total += 1;
        const pts = skillPoints(c);
        if (pts >= 6 && pts <= 11) centraux += 1;
      }
    }
    expect(centraux / total).toBeGreaterThan(0.6);
  });
});

describe("le préavis d'un salaire impayé", () => {
  it("laisse deux jours de jeu, pas zéro et pas trois", () => {
    /*
     * Zéro serait une punition sans avertissement : une trésorerie qui passe
     * sous un salaire arrive en jouant normalement. Trois videraient la charge
     * de son poids — on embaucherait sans regarder le solde.
     */
    expect(SALAIRE_IMPAYE_MAX_JOURS).toBe(2);
  });

  it("le préavis vaut moins qu'un cycle de blé", () => {
    // Sinon le joueur pourrait attendre sa récolte sans rien risquer, et le
    // salaire cesserait d'être une contrainte de trésorerie.
    expect(SALAIRE_IMPAYE_MAX_JOURS).toBeLessThan(20);
  });
});
