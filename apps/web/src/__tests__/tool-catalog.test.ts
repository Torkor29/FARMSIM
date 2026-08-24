import {
  actsOnSelection,
  HARVEST_OPTIONS,
  PLANT_OPTIONS,
  SOIL_OPTIONS,
  TOOL_GROUPS,
  optionsFor,
} from "../ui/tool-options";
import { isFieldWorkTool, type Tool } from "../tools";

/**
 * Un outil proposé doit faire quelque chose.
 *
 * Trouvé en jouant : « dans le menu, je sélectionne presser mais je peux pas
 * cliquer sur le terrain, pas de Ctrl+A, rien ». La presse figurait bien au
 * catalogue, mais le clic sur une case et le tracé n'acceptaient qu'une liste
 * d'outils écrite à la main, où « Presser » et « Ramasser » manquaient. Le
 * joueur armait un outil parfaitement inerte, sans le moindre message.
 *
 * Ce test ferme la classe entière de ce défaut : tout outil affiché dans une
 * famille du catalogue est un travail de champ, donc cliquable et traçable.
 */
describe("le catalogue d'outils", () => {
  const tousLesOutils: Tool[] = [
    ...PLANT_OPTIONS.map((o) => o.tool),
    ...SOIL_OPTIONS.map((o) => o.tool),
    ...HARVEST_OPTIONS.map((o) => o.tool),
  ];

  it("ne propose aucun outil que le champ refuserait de recevoir", () => {
    for (const tool of tousLesOutils) {
      // `isFieldWorkTool` commande à la fois le clic sur une case, le tracé au
      // doigt et le Ctrl+A : un outil hors de cette porte est inerte.
      expect(`${tool} ${isFieldWorkTool(tool)}`).toBe(`${tool} true`);
    }
  });

  it("donne un bouton d'action à chaque outil, sur la coque de bureau", () => {
    // Second visage du même défaut : le clic posait bien la sélection, mais la
    // barre de bureau portait sa propre liste et n'affichait aucun « Faire »
    // pour la presse ni le ramassage. On sélectionnait, et rien ne partait.
    for (const tool of tousLesOutils) {
      expect(`${tool} ${actsOnSelection(tool)}`).toBe(`${tool} true`);
    }
  });

  it("propose bien la presse et le ramassage", () => {
    // Les deux qui manquaient. Nommés explicitement : une régression qui les
    // retirerait du catalogue passerait sinon inaperçue.
    expect(tousLesOutils).toContain("BALE");
    expect(tousLesOutils).toContain("COLLECT");
  });

  it("marque hors saison les cultures qui ne se sèment pas maintenant", () => {
    // Le rail de bureau lisait déjà `outOfSeason`. Le dock tactile
    // ignorait le drapeau : on choisissait le maïs en hiver, on semait,
    // et le serveur renvoyait la saison. Les deux coques passent par
    // `optionsFor` — ce test tient le drapeau, pas le pixel.
    const hiver = optionsFor("PLANT", "WINTER");
    expect(hiver.find((o) => o.tool === "PLANT_MAIZE")?.outOfSeason).toBe(true);
    expect(hiver.find((o) => o.tool === "PLANT_WHEAT")?.outOfSeason).toBeUndefined();
    const printemps = optionsFor("PLANT", "SPRING");
    expect(printemps.find((o) => o.tool === "PLANT_MAIZE")?.outOfSeason).toBeUndefined();
    expect(printemps.find((o) => o.tool === "PLANT_WHEAT")?.outOfSeason).toBe(true);
  });

  it("n'arme jamais une famille sur un outil inerte", () => {
    // « Récolte » n'a pas d'options : elle arme directement son outil d'entrée.
    // C'est précisément ce cas qui doit rester actionnable.
    for (const groupe of TOOL_GROUPS) {
      if (!groupe.entry || groupe.entry === "SELECT") continue;
      expect(`${groupe.id} → ${groupe.entry} ${isFieldWorkTool(groupe.entry)}`).toBe(
        `${groupe.id} → ${groupe.entry} true`,
      );
    }
  });

  it("range les options sous les bonnes familles", () => {
    expect(optionsFor("PLANT").length).toBeGreaterThan(0);
    expect(optionsFor("SOIL").length).toBeGreaterThan(0);
    // « Voir » et « Marché » n'arment aucun travail : elles n'ont rien à dire.
    expect(optionsFor("SELECT")).toHaveLength(0);
    expect(optionsFor("SELL")).toHaveLength(0);
  });
});
