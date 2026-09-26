import { PRE_AMONT_MIN, planCampagne } from "../countryside-plan";

/**
 * Une ferme agrandie reste posée sur le sol.
 *
 * La lisière se comptait pour une parcelle de 12×12 : une ferme qui avait
 * grandi par lots dépassait le bord amont du sol, et son coin se dessinait
 * dans le ciel. Le coin amont de l'île est à `u = −emprise` ; il doit rester
 * du pré et du bois derrière lui.
 */
describe("la lisière d'une ferme agrandie", () => {
  const cour = { x: -20, z: 0, w: 6, d: 6 };
  it.each([13, 30, 60])("une île de %s unités garde son pré amont", (emprise) => {
    const plan = planCampagne({ graine: "test", emprise, pasCase: 1.06, cour });
    expect(plan.sol.uMin).toBeLessThanOrEqual(-emprise - PRE_AMONT_MIN);
  });
});
