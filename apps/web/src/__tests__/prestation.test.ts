import {
  LABOR_ORDER_WORKS,
  URGENT_CONTRACTOR_WORKS,
  acceptsLaborOrder,
  acceptsUrgentContractor,
  type FarmWork,
} from "@farmsim/shared";
import { SOIL_OPTIONS, PLANT_OPTIONS } from "../ui/tool-options";
import type { Tool } from "../tools";

/**
 * Un bouton payant qui ne peut que refuser.
 *
 * Signalé en jouant, capture à l'appui : « Pour ça, publiez un chantier — pas
 * d'entreprise instantanée ». Le joueur avait armé la presse, retenu ses
 * cases, et appuyé sur « Payer · 428 € » — le seul bouton actif à l'écran.
 *
 * Deux listes prétendaient dire qui prend quel travail : une énumération côté
 * serveur (cinq travaux) et une cascade de conditions côté écran (huit). Le
 * bouton s'affichait donc, avec un prix calculé, sur trois travaux que la
 * route refuse — la presse et le ramassage par un message, le déchaumage par
 * une erreur de validation informe.
 *
 * Elles n'en font plus qu'une, dans `shared`, que les deux côtés lisent. Ce
 * test tient l'invariant qui compte : on ne propose que ce qui aboutit.
 */
describe("qui prend quel travail", () => {
  it("ne propose l’entreprise instantanée que pour ce qu’elle accepte", () => {
    for (const work of URGENT_CONTRACTOR_WORKS) {
      expect(`${work} ${acceptsUrgentContractor(work)}`).toBe(`${work} true`);
    }
    // Les trois qui s'affichaient et refusaient. Nommés : une régression qui
    // les remettrait dans la liste rendrait le bouton mort à nouveau.
    for (const work of ["STUBBLE", "BALE", "COLLECT"] as FarmWork[]) {
      expect(`${work} ${acceptsUrgentContractor(work)}`).toBe(`${work} false`);
    }
  });

  it("laisse l’entraide prendre ce que l’entreprise refuse", () => {
    // C'est la porte de sortie que le message nommait mal. Elle doit exister
    // pour tout ce que l'entreprise décline, sinon le joueur est sans recours.
    for (const work of ["STUBBLE", "BALE", "COLLECT"] as FarmWork[]) {
      expect(`${work} ${acceptsLaborOrder(work)}`).toBe(`${work} true`);
    }
  });

  it("garde l’entraide plus large que le dépannage", () => {
    for (const work of URGENT_CONTRACTOR_WORKS) {
      expect(`${work} confiable : ${acceptsLaborOrder(work)}`).toBe(`${work} confiable : true`);
    }
    expect(LABOR_ORDER_WORKS.length).toBeGreaterThan(URGENT_CONTRACTOR_WORKS.length);
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
    };
    const outils = [...SOIL_OPTIONS, ...PLANT_OPTIONS].map((o) => o.tool);
    for (const outil of outils) {
      const work = travailDe[outil] ?? (outil.startsWith("PLANT_") ? "PLANT" : null);
      // Le désherbage n'a ni dépannage ni entraide : il n'est dans aucune des
      // deux listes, et c'est assumé — le pulvérisateur est bon marché.
      if (!work) continue;
      const recours = acceptsUrgentContractor(work) || acceptsLaborOrder(work);
      expect(`${outil} a un recours : ${recours}`).toBe(`${outil} a un recours : true`);
    }
  });
});
