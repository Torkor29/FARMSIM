/**
 * Catalogue des outils de champ — source unique des deux coques.
 *
 * La barre tactile et le rail de bureau affichent les mêmes outils, avec les
 * mêmes options, dans le même ordre. Tant que ces listes vivaient à
 * l'intérieur de `FieldDock`, la seule façon de donner au bureau une
 * disposition propre était de dupliquer les libellés — et deux listes qui se
 * ressemblent finissent toujours par diverger.
 *
 * Ce module ne contient aucune mise en forme : il dit *ce qu'il y a*, pas
 * *comment ça se dessine*. C'est précisément ce qui doit être commun entre un
 * écran tactile et un écran de bureau.
 */

import { isPlantTool, isSoilTool, type Tool } from "../tools";

/** Famille d'outils : ce que porte la barre principale. */
export type ToolGroup = "SELECT" | "PLANT" | "HARVEST" | "SOIL" | "SELL";

export type ToolGroupDef = {
  id: ToolGroup;
  label: string;
  icon: string;
  /** Emoji de repli quand il n'y a pas d'icône dessinée. */
  emoji?: string;
  /** Touche du clavier de bureau. Jamais affichée au téléphone. */
  hotkey: string;
  /** Outil armé quand on entre dans la famille. */
  entry?: Tool;
};

export const TOOL_GROUPS: ToolGroupDef[] = [
  { id: "SELECT", label: "Voir", icon: "/assets/icons/tools/select.svg", hotkey: "1", entry: "SELECT" },
  { id: "PLANT", label: "Semer", icon: "/assets/icons/tools/plant.svg", hotkey: "2", entry: "PLANT_WHEAT" },
  { id: "HARVEST", label: "Récolte", icon: "/assets/icons/tools/harvest.svg", hotkey: "3", entry: "HARVEST" },
  { id: "SOIL", label: "Sol", icon: "/assets/icons/tools/plow.svg", hotkey: "4", entry: "STUBBLE" },
  { id: "SELL", label: "Marché", icon: "", emoji: "💰", hotkey: "5" },
];

export type ToolOption = {
  tool: Tool;
  label: string;
  /** Infobulle de bureau — le survol n'existe pas au doigt. */
  hint?: string;
};

export const PLANT_OPTIONS: ToolOption[] = [
  { tool: "PLANT_WHEAT", label: "Blé", hint: "Culture de base, marché toujours ouvert" },
  { tool: "PLANT_BARLEY", label: "Orge", hint: "Récolte plus précoce que le blé" },
  { tool: "PLANT_MAIZE", label: "Maïs", hint: "Gros tonnage, ou ensilage plante entière" },
  { tool: "PLANT_RAPE", label: "Colza", hint: "Cours élevé, exigeant sur le sol" },
  { tool: "PLANT_PEA", label: "Pois", hint: "Légumineuse : laisse de l'azote au suivant" },
  { tool: "PLANT_GRASS", label: "Herbe", hint: "Se fauche, nourrit le troupeau" },
];

export const HARVEST_OPTIONS: ToolOption[] = [
  { tool: "HARVEST", label: "Grain", hint: "Moisson classique, grain en silo" },
  { tool: "SILAGE", label: "Ensilage", hint: "Maïs plante entière, plus tôt, plus de tonnage" },
];

export const SOIL_OPTIONS: ToolOption[] = [
  { tool: "STUBBLE", label: "Nettoyer", hint: "Déchaumage : enfouit les résidus" },
  { tool: "PLOW", label: "Labourer", hint: "Remet le compteur de récoltes à zéro" },
  { tool: "FERTILIZE", label: "Engrais", hint: "Relève la fertilité de la case" },
  { tool: "PARK", label: "Garer", hint: "Range une machine sur la case" },
  { tool: "BALE", label: "Presser", hint: "Met la paille en bottes" },
  { tool: "COLLECT", label: "Ramasser", hint: "Rentre les bottes au hangar" },
];

/** À quelle famille appartient l'outil actuellement armé. */
export function groupOf(tool: Tool): ToolGroup | null {
  if (tool === "SELECT") return "SELECT";
  if (isPlantTool(tool)) return "PLANT";
  if (tool === "HARVEST" || tool === "SILAGE") return "HARVEST";
  if (isSoilTool(tool)) return "SOIL";
  return null;
}

/** Options de la famille — liste vide pour celles qui n'en ont pas. */
export function optionsFor(group: ToolGroup | null): ToolOption[] {
  if (group === "PLANT") return PLANT_OPTIONS;
  if (group === "HARVEST") return HARVEST_OPTIONS;
  if (group === "SOIL") return SOIL_OPTIONS;
  return [];
}

/** Tailles de pinceau proposées partout. */
export const BRUSH_SIZES = [1, 2, 3] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];
