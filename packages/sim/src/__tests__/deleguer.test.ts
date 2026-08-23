import { contractorTotal, laborEscrow, urgentContractorQuote, CROP_DEFS } from "@farmsim/shared";

/**
 * Les deux façons de déléguer un chantier.
 *
 * Signalé en jouant : « les prix PNJ / pour faire faire sont toujours
 * aberrants et semblent redondants ». Sur cent trente-quatre cases de maïs,
 * l'écran proposait « Faire faire · 1 325 € » à côté de « Demander de l'aide
 * · 3 564 € ». Trois fois moins cher pour le même travail : de quoi croire
 * que l'entraide n'a aucun intérêt.
 *
 * Les deux prix n'étaient tout simplement pas comparables. Le premier annonçait
 * le **service seul** ; le second, le service **plus les semences**. Le serveur,
 * lui, débitait les semences dans les deux cas — 3 737 € pour le dépannage.
 * Le bouton sous-facturait donc de deux mille €, et le clic répondait « €
 * insuffisants ».
 *
 * Une fois les deux devis mis sur le même pied, le classement s'inverse :
 * l'entraide est **moins chère**, elle demande seulement d'attendre qu'un
 * joueur passe. C'est le compromis qu'on voulait, et il était invisible.
 */
describe("faire faire ou demander de l’aide", () => {
  const CASES = 134;
  const CULTURE = "MAIZE" as const;

  it("annonce le prix que le serveur débitera, semences comprises", () => {
    const devis = contractorTotal("PLANT", CASES, CULTURE);
    const semences = CROP_DEFS[CULTURE].seedCostPerCell * CASES;
    // Le service seul est ce que le bouton affichait ; il ne suffit pas.
    expect(devis.service).toBe(urgentContractorQuote("PLANT", CASES));
    expect(devis.supplies).toBe(semences);
    expect(devis.total).toBe(devis.service + semences);
  });

  it("met les deux devis sur le même pied", () => {
    /*
     * Le cœur du signalement. Les deux totaux doivent porter les mêmes postes
     * — service et consommables — sinon le joueur compare des choses qui ne se
     * comparent pas, et conclut de travers.
     */
    const entreprise = contractorTotal("PLANT", CASES, CULTURE);
    const entraide = laborEscrow("PLANT", CASES, CULTURE);
    expect(entreprise.supplies).toBe(entraide.extras);
  });

  it("rend l’entraide moins chère que le dépannage", () => {
    // C'est ce qui donne un sens au choix : l'entreprise vient tout de suite
    // et se paie ; le joueur vient quand il passe et coûte moins. Sans cet
    // écart, l'un des deux boutons ne servirait à rien.
    const entreprise = contractorTotal("PLANT", CASES, CULTURE).total;
    const entraide = laborEscrow("PLANT", CASES, CULTURE).escrow;
    expect(entraide).toBeLessThan(entreprise);
  });

  it("ne facture pas de semences là où l’on n’en sème pas", () => {
    // Labourer ou déchaumer ne consomme pas de sac : le devis ne doit porter
    // que le service, sinon on inventerait une dépense.
    for (const travail of ["PLOW", "STUBBLE", "HARVEST"] as const) {
      const d = contractorTotal(travail, 40);
      expect(`${travail} consommables=${d.supplies}`).toBe(`${travail} consommables=0`);
      expect(d.total).toBe(d.service);
    }
  });

  it("garde l’écart quelle que soit la taille du chantier", () => {
    // Un classement qui s'inverserait selon la surface serait pire que pas de
    // classement du tout : le joueur ne pourrait rien apprendre.
    for (const n of [8, 24, 60, 134, 300]) {
      const entreprise = contractorTotal("PLANT", n, CULTURE).total;
      const entraide = laborEscrow("PLANT", n, CULTURE).escrow;
      expect(`${n} cases : entraide moins chère = ${entraide < entreprise}`).toBe(
        `${n} cases : entraide moins chère = true`,
      );
    }
  });
});
