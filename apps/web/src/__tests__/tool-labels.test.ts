import {
  isFieldWorkTool,
  toolActionLabel,
  toolVerb,
  type Tool,
} from "../tools";
import { HARVEST_OPTIONS, PLANT_OPTIONS, SOIL_OPTIONS } from "../ui/tool-options";

/**
 * Un outil armé doit s'annoncer par son nom.
 *
 * Suite du même signalement que `tool-catalog` : « ramasser aussi ça marche
 * pas ». Le clic était réparé, mais la barre de sélection du bureau gardait sa
 * propre liste d'outils — sans presser, ramasser ni désherber. Elle
 * disparaissait donc entièrement : ni compteur, ni « Tout sélectionner », ni
 * bouton pour lancer le travail. De l'écran du joueur, l'outil restait mort.
 *
 * La barre passe maintenant par `isFieldWorkTool` et par `toolVerb`. Ces tests
 * tiennent les deux : toute option du catalogue franchit la porte, et aucune
 * ne se fait appeler par le verbe d'une autre.
 */
const OPTIONS: Tool[] = [
  ...PLANT_OPTIONS.map((o) => o.tool),
  ...SOIL_OPTIONS.map((o) => o.tool),
  ...HARVEST_OPTIONS.map((o) => o.tool),
  "HARVEST",
];

describe("le libellé d'action", () => {
  it("nomme le geste de chaque outil du catalogue", () => {
    for (const tool of OPTIONS) {
      // « Travailler » est le dernier recours : personne ne doit y tomber.
      expect(`${tool} → ${toolVerb(tool)}`).not.toBe(`${tool} → Travailler`);
    }
  });

  it("dit presser, ramasser et déchaumer — pas récolter ni nettoyer", () => {
    expect(toolVerb("BALE")).toBe("Presser");
    expect(toolVerb("COLLECT")).toBe("Ramasser");
    // Le mot du métier : on ne nettoie pas un champ.
    expect(toolVerb("STUBBLE")).toBe("Déchaumer");
    expect(toolVerb("WEED")).toBe("Désherber");
  });

  it("distingue la moisson de la fauche", () => {
    expect(toolVerb("HARVEST")).toBe("Récolter");
    expect(toolVerb("HARVEST", true)).toBe("Faucher");
  });

  it("compte les cases sur le bouton du bureau", () => {
    expect(toolActionLabel("BALE", 12)).toBe("Presser · 12 case(s)");
    expect(toolActionLabel("PLANT_MAIZE", 3)).toBe("Semer Maïs · 3 case(s)");
  });

  it("laisse la barre de sélection s'afficher pour tout le catalogue", () => {
    // La barre du bureau n'agit que sur `isFieldWorkTool` : un outil hors de
    // cette porte n'a ni compteur, ni Ctrl+A, ni bouton d'action.
    for (const tool of OPTIONS) {
      expect(`${tool} ${isFieldWorkTool(tool)}`).toBe(`${tool} true`);
    }
  });
});
