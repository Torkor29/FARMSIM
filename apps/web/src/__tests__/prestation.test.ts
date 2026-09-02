import {
  LABOR_ORDER_WORKS,
  URGENT_CONTRACTOR_WORKS,
  acceptsLaborOrder,
  acceptsUrgentContractor,
  CONTRACTOR_RATE_PER_CELL,
  urgentContractorQuote,
  laborEscrow,
  type FarmWork,
} from "@farmsim/shared";
import { SOIL_OPTIONS, PLANT_OPTIONS } from "../ui/tool-options";
import type { Tool } from "../tools";

/**
 * Qui prend quel travail, et ce que l'écran en dit.
 *
 * ## Premier temps — un bouton payant qui ne peut que refuser
 *
 * Signalé en jouant, capture à l'appui : « Pour ça, publiez un chantier — pas
 * d'entreprise instantanée ». Le joueur avait armé la presse, retenu ses
 * cases, et appuyé sur « Payer · 428 € » — le seul bouton actif à l'écran.
 * Deux listes prétendaient dire qui prend quoi : cinq travaux côté serveur,
 * huit côté écran. Elles n'en font plus qu'une, dans `shared`.
 *
 * ## Second temps — la liste elle-même était le défaut
 *
 * Une fois les deux côtés d'accord, le bouton ne mentait plus : il
 * disparaissait. Et c'est ce qu'a vu Strea : « il y a des chantiers que tu
 * peux faire faire par le pnj et d'autres non ? presser, tu peux pas ;
 * ramasser tu peux pas ; déchaumer tu peux pas ». Trois défauts tenaient dans
 * cette absence :
 *
 * - elle ne se voyait pas — un bouton sur la moitié des outils, rien pour
 *   dire pourquoi sur l'autre ;
 * - elle laissait sans issue — l'entraide attend qu'un joueur accepte, et
 *   sans personne en ligne, presser n'avait aucune voie déléguée ;
 * - elle prenait le réel à l'envers — presse, ensilage et déchaumage sont
 *   précisément ce qu'on confie à une entreprise de travaux agricoles.
 *
 * Le dépannage prend donc les dix travaux. Ce qui protège l'entraide n'est
 * plus un mur, c'est le prix.
 */
describe("qui prend quel travail", () => {
  it("le dépannage prend les dix travaux", () => {
    for (const work of URGENT_CONTRACTOR_WORKS) {
      expect(`${work} ${acceptsUrgentContractor(work)}`).toBe(`${work} true`);
    }
    /*
     * Les trois que Strea a nommés. Ils ont fait le chemin complet : proposés
     * à tort, puis retirés, puis acceptés pour de bon. Ils restent nommés ici
     * — c'est sur eux que porte le signalement, et une régression qui les
     * sortirait de la liste rendrait le bouton muet une troisième fois.
     */
    for (const work of ["STUBBLE", "BALE", "COLLECT"] as FarmWork[]) {
      expect(`${work} ${acceptsUrgentContractor(work)}`).toBe(`${work} true`);
    }
    // Dix travaux, dix lignes au barème : la liste ne peut pas dépasser ce
    // que le prestataire sait chiffrer.
    expect(URGENT_CONTRACTOR_WORKS.length).toBe(Object.keys(CONTRACTOR_RATE_PER_CELL).length);
  });

  it("laisse l’entraide prendre ce que l’entreprise prend", () => {
    // La porte de sortie que le message nommait mal. Elle reste ouverte : les
    // deux voies coexistent, on choisit selon le prix et l'attente.
    for (const work of ["STUBBLE", "BALE", "COLLECT"] as FarmWork[]) {
      expect(`${work} ${acceptsLaborOrder(work)}`).toBe(`${work} true`);
    }
  });

  it("le dépannage coûte plus cher que l’entraide, partout", () => {
    /*
     * C'est ce qui remplace le mur. Si le dépannage devenait le moins cher,
     * plus personne n'aurait de raison de publier un chantier, et la boucle
     * entre joueurs mourrait — sans qu'aucune liste ne l'ait décidé.
     */
    for (const work of URGENT_CONTRACTOR_WORKS) {
      if (!acceptsLaborOrder(work)) continue;
      const depannage = urgentContractorQuote(work, 16);
      const entraide = laborEscrow(work, 16).quote;
      expect(`${work} : ${depannage > entraide}`).toBe(`${work} : true`);
    }
  });

  it("la seule différence entre les deux listes est le désherbage", () => {
    /*
     * Le désherbage ne se publie pas en entraide : il se traite à la case, sur
     * des surfaces plus petites que la fenêtre de huit. L'écran le dit
     * maintenant en clair au lieu d'effacer le bouton.
     */
    const seulementDepannage = URGENT_CONTRACTOR_WORKS.filter((w) => !acceptsLaborOrder(w));
    expect(seulementDepannage).toEqual(["WEED"]);
    const seulementEntraide = LABOR_ORDER_WORKS.filter((w) => !acceptsUrgentContractor(w));
    expect(seulementEntraide).toEqual([]);
  });

  it("laisse un recours à chaque outil du catalogue", () => {
    /**
     * L'invariant de fond : pour tout outil qu'on peut armer, le joueur sans
     * la machine doit avoir **au moins une** porte — le dépannage ou
     * l'entraide. Sinon le champ est simplement infranchissable, et rien à
     * l'écran ne le dit.
     */
    const travailDe: Partial<Record<Tool, FarmWork>> = {
      FERTILIZE: "FERTILIZE",
      PLOW: "PLOW",
      STUBBLE: "STUBBLE",
      BALE: "BALE",
      COLLECT: "COLLECT",
      HARVEST: "HARVEST",
      WEED: "WEED",
    };
    const outils = [...SOIL_OPTIONS, ...PLANT_OPTIONS].map((o) => o.tool);
    for (const outil of outils) {
      const work = travailDe[outil] ?? (outil.startsWith("PLANT_") ? "PLANT" : null);
      if (!work) continue;
      const recours = acceptsUrgentContractor(work) || acceptsLaborOrder(work);
      expect(`${outil} a un recours : ${recours}`).toBe(`${outil} a un recours : true`);
    }
  });

  it("le désherbage a désormais un recours, lui aussi", () => {
    // Il n'en avait aucun : ni dépannage, ni entraide. Un joueur sans
    // pulvérisateur regardait ses adventices monter sans porte de sortie.
    expect(acceptsUrgentContractor("WEED")).toBe(true);
  });
});
