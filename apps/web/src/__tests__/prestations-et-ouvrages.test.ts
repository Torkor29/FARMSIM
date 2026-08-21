import fs from "node:fs";
import {
  BUILDING_DEFS,
  DRYING,
  clampLaborOffer,
  laborEscrow,
  laborOfferBounds,
  suggestedLaborOffer,
  urgentContractorBill,
  type BuildingType,
} from "@farmsim/shared";

/**
 * Ce que le joueur lit doit être ce que le jeu fait.
 *
 * Deux signalements d'un testeur, deux formes du même défaut — un écart entre
 * la promesse affichée et le calcul réel.
 *
 * « Les prix PNJ / pour faire faire sont toujours aberrants et semblent
 * redondants. » Ils l'étaient : les deux boutons ne comptaient pas la même
 * chose. Le prestataire affichait sa seule main-d'œuvre pendant que la route
 * y ajoutait la semence ; l'entraide affichait sa consigne complète. Sur 134
 * cases de maïs le joueur lisait 1 325 contre 3 564 et concluait que le
 * prestataire était deux fois et demie moins cher — alors qu'il prélève
 * 3 737, donc **plus**.
 *
 * « Les bonus éoliennes et panneaux solaires à revoir car pas réalistes. »
 * Les panneaux annonçaient une remise sur le graissage ; l'éolienne un
 * séchoir qui n'existe pas et un séchage « plus vite » que le code ne faisait
 * pas. La moitié de la phrase était fausse.
 */
const SERVEUR = fs.readFileSync("../../apps/api/src/main.ts", "utf8");
const APP = fs.readFileSync("src/App.tsx", "utf8");

describe("le devis d’une prestation", () => {
  it("est chiffré par la même fonction des deux côtés", () => {
    /*
     * La seule garantie qui tienne. Tant que l'écran refait le calcul de son
     * côté, il finit par diverger — c'est exactement ce qui s'est passé : la
     * route avait appris à compter la semence, l'écran non.
     */
    expect(APP).toMatch(/urgentContractorBill\(/);
    expect(SERVEUR).toMatch(/urgentContractorBill\(/);
    // Ni l'un ni l'autre ne doit rechiffrer la semence dans son coin.
    expect(APP).not.toMatch(/seedCostPerCell/);
    expect(SERVEUR).not.toMatch(/seedCostPerCell\s*\*\s*cells/);
    // Une seule table d’intrants, partagée par les deux chemins.
    expect(SERVEUR).not.toMatch(/FERTILIZE_COST_PER_CELL\s*\*\s*cells/);
  });

  it("compte les intrants, qui restent à la charge du client", () => {
    // Rien ne reste dans le champ après un labour : que la main-d'œuvre.
    const labour = urgentContractorBill("PLOW", 50);
    expect(labour.inputs).toBe(0);
    expect(labour.total).toBe(labour.service);

    // La semence et l'engrais, si — et au même tarif que si le joueur les
    // mettait lui-même, ou les faisait mettre par un autre joueur.
    for (const [work, n, crop] of [
      ["PLANT", 134, "MAIZE"],
      ["FERTILIZE", 60, undefined],
    ] as const) {
      const bill = urgentContractorBill(work, n, crop);
      expect(bill.inputs).toBe(laborEscrow(work, n, crop).extras);
      expect(bill.total).toBe(bill.service + bill.inputs);
    }
  });

  it("laisse l’entreprise plus chère que l’entraide au prix conseillé", () => {
    /*
     * C'est la règle du jeu : l'entreprise vient tout de suite et facture 15 %
     * d'urgence, l'entraide attend un joueur et coûte moins. L'affichage
     * disait le contraire, et le calcul aussi sur le labour et l'engrais —
     * l'entraide y traînait des « extras » qui n'allaient à personne.
     *
     * Le joueur reste libre de proposer plus : on compare donc au **repère**,
     * qui est ce que la fenêtre lui propose d'abord.
     */
    const cas: [Parameters<typeof urgentContractorBill>[0], number, "MAIZE" | undefined][] = [
      ["PLANT", 134, "MAIZE"],
      ["PLANT", 8, "MAIZE"],
      ["HARVEST", 40, undefined],
      ["PLOW", 24, undefined],
      ["FERTILIZE", 60, undefined],
    ];
    const inverses = cas
      .map(([work, n, crop]) => ({
        cas: `${work}×${n}`,
        pnj: urgentContractorBill(work, n, crop).total,
        joueur: laborEscrow(work, n, crop).escrow,
      }))
      .filter((d) => d.pnj <= d.joueur);
    expect(inverses).toEqual([]);
  });
});

describe("le prix d’une demande d’aide", () => {
  it("appartient au client, et lui revient en entier chez le prestataire", () => {
    /*
     * « C'est toi-même qui doit fixer le prix. » Ce que le client écrit est ce
     * que le travailleur touche : pas de commission invisible, sans quoi le
     * chiffre qu'on vient de taper mentirait dès la ligne suivante.
     */
    const m = laborEscrow("PLOW", 24, undefined, false, 400);
    expect(m.quote).toBe(400);
    expect(m.payout).toBe(400);
    expect(m.escrow).toBe(400 + m.extras);
  });

  it("n’ajoute que les intrants qui restent dans le champ", () => {
    // Semence et engrais : oui, le client les paie déjà en travaillant seul.
    expect(laborEscrow("PLANT", 20, "MAIZE", false, 200).extras).toBeGreaterThan(0);
    expect(laborEscrow("FERTILIZE", 20, undefined, false, 200).extras).toBeGreaterThan(0);
    // Le gazole du prestataire est dans son prix : il ne se facture pas à part.
    expect(laborEscrow("PLOW", 24, undefined, false, 200).extras).toBe(0);
    expect(laborEscrow("STUBBLE", 24, undefined, false, 200).extras).toBe(0);
  });

  it("borne le prix sans jamais refuser la demande", () => {
    /*
     * Large, mais borné : à un TRN personne ne vient, et une annonce à cent
     * fois le prix sert à déplacer de l'argent entre comptes complices. On
     * ramène dans la fourchette au lieu de rejeter — un chiffre extrême ne
     * doit pas faire perdre la sélection.
     */
    const { min, max } = laborOfferBounds("PLOW", 24);
    expect(min).toBeGreaterThan(0);
    expect(max).toBeGreaterThan(min);
    expect(clampLaborOffer("PLOW", 24, 1)).toBe(min);
    expect(clampLaborOffer("PLOW", 24, 10_000_000)).toBe(max);
    expect(clampLaborOffer("PLOW", 24, suggestedLaborOffer("PLOW", 24))).toBe(
      suggestedLaborOffer("PLOW", 24),
    );
  });

  it("est borné par le serveur, pas seulement par l’écran", () => {
    // L'écran peut être contourné ; la route, non.
    expect(SERVEUR).toMatch(/offerCrd/);
    expect(APP).toMatch(/offerCrd/);
  });
});

describe("les ouvrages qui font du courant", () => {
  const electriques = (Object.keys(BUILDING_DEFS) as BuildingType[]).filter(
    (t) => (BUILDING_DEFS[t].dryingDiscount ?? 0) > 0,
  );

  it("existent — panneaux et éolienne", () => {
    expect(electriques.sort()).toEqual(["SOLAR_PANELS", "WIND_TURBINE"]);
  });

  it("annoncent le chiffre qu’ils appliquent vraiment", () => {
    /*
     * Un descriptif qui annonce autre chose que le champ est un mensonge que
     * rien ne rattrape : il n'y a pas d'écran où comparer les deux. On exige
     * donc que le pourcentage écrit soit celui du code.
     */
    const menteurs = electriques.filter((t) => {
      const attendu = `${Math.round((BUILDING_DEFS[t].dryingDiscount ?? 0) * 100)} %`;
      return !BUILDING_DEFS[t].description.includes(attendu);
    });
    expect(menteurs).toEqual([]);
  });

  it("ne promettent ni gratuité ni rapidité — ils n’en donnent aucune", () => {
    /*
     * « Le grain sèche gratuitement, et plus vite. » Le code ne touchait ni au
     * temps ni à la quantité, seulement au coût, et il ne l'annulait pas.
     * Aucun ouvrage ne doit reprendre cette promesse-là.
     */
    const abusifs = electriques.filter((t) =>
      /gratuit|sans facture|plus vite|séchoir/i.test(BUILDING_DEFS[t].description),
    );
    expect(abusifs).toEqual([]);
  });

  it("allègent la facture sans jamais l’effacer", () => {
    const cumul = electriques.reduce((n, t) => n + (BUILDING_DEFS[t].dryingDiscount ?? 0), 0);
    // Le plafond doit mordre : sans cela, deux ouvrages suffiraient à rendre
    // le séchage gratuit, et le poste cesserait d'être une décision.
    expect(cumul).toBeGreaterThan(DRYING.discountCap);
    expect(DRYING.discountCap).toBeLessThan(1);
    const restant = Math.round(
      DRYING.costPerTonPerPass * 100 * (1 - Math.min(DRYING.discountCap, cumul)),
    );
    expect(restant).toBeGreaterThan(0);
  });

  it("n’allègent plus l’entretien, qui appartient à l’atelier", () => {
    // Le soleil n'a jamais fait baisser le prix d'un bidon de graisse.
    for (const t of electriques) expect(BUILDING_DEFS[t].careDiscount ?? 0).toBe(0);
    expect(BUILDING_DEFS.WORKSHOP.careDiscount ?? 0).toBeGreaterThan(0);
  });

  it("sont branchés côté serveur, et bornés", () => {
    expect(SERVEUR).toMatch(/dryingDiscount/);
    expect(SERVEUR).toMatch(/Math\.min\(DRYING\.discountCap, dryingDiscount\)/);
    // L'ancienne gratuité ne doit plus traîner nulle part.
    expect(SERVEUR).not.toMatch(/freeDrying/);
  });
});
