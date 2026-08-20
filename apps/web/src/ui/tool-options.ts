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

import { canSowInSeason, windowLabel, type Season } from "@farmsim/shared";
import { cropFromPlantTool, isPlantTool, isSoilTool, type Tool } from "../tools";

/** Famille d'outils : ce que porte la barre principale. */
export type ToolGroup = "SELECT" | "PLANT" | "HARVEST" | "SOIL" | "SELL";

export type ToolGroupDef = {
  id: ToolGroup;
  label: string;
  icon: string;
  /** Touche du clavier de bureau. Jamais affichée au téléphone. */
  hotkey: string;
  /** Outil armé quand on entre dans la famille. */
  entry?: Tool;
};

export const TOOL_GROUPS: ToolGroupDef[] = [
  { id: "SELECT", label: "Voir", icon: "/assets/icons/tools/select.svg", hotkey: "1", entry: "SELECT" },
  { id: "PLANT", label: "Semer", icon: "/assets/icons/tools/plant.svg", hotkey: "2", entry: "PLANT_WHEAT" },
  /* L'ordre suit la saison, pas l'ordre d'écriture du code : on prépare le
     sol, on sème, on récolte, on nettoie — et on vend. « Récolte » se trouvait
     avant « Sol », ce qui plaçait la moisson avant le labour. */
  { id: "SOIL", label: "Sol", icon: "/assets/icons/tools/plow.svg", hotkey: "3", entry: "STUBBLE" },
  { id: "HARVEST", label: "Récolte", icon: "/assets/icons/tools/harvest.svg", hotkey: "4", entry: "HARVEST" },
  // Le seul outil qui n'avait pas de dessin retombait sur un emoji, au milieu
  // de quatre voisins illustrés. Il en a un maintenant, dans la même famille.
  { id: "SELL", label: "Marché", icon: "/assets/icons/nav/marche.svg", hotkey: "5" },
];

export type ToolOption = {
  tool: Tool;
  label: string;
  /** Infobulle de bureau — le survol n'existe pas au doigt. */
  hint?: string;
  /** Hors fenêtre de semis : le geste sera refusé, autant le dire avant. */
  outOfSeason?: boolean;
};

export const PLANT_OPTIONS: ToolOption[] = [
  { tool: "PLANT_WHEAT", label: "Blé", hint: "Culture de base, marché toujours ouvert" },
  { tool: "PLANT_BARLEY", label: "Orge", hint: "Récolte plus précoce que le blé" },
  { tool: "PLANT_MAIZE", label: "Maïs", hint: "Gros tonnage, ou ensilage plante entière" },
  { tool: "PLANT_RAPE", label: "Colza", hint: "Cours élevé, exigeant sur le sol" },
  { tool: "PLANT_PEA", label: "Pois", hint: "Légumineuse : laisse de l'azote au suivant" },
  { tool: "PLANT_GRASS", label: "Herbe", hint: "Se fauche, nourrit le troupeau" },
];

/**
 * La récolte n'a plus de « mode » à choisir.
 *
 * On y trouvait « Grain » et « Ensilage ». Mais aux champs on n'ensile pas
 * parce qu'on l'a coché : on ensile parce qu'on a une ensileuse et du maïs.
 * C'est donc le hangar qui décide, côté serveur, case par case — le maïs part
 * en ensilage si l'ensileuse est là, en grain sinon, et le blé reste du blé
 * dans les deux cas. Un choix de moins, et il n'en manque aucun.
 */
export const HARVEST_OPTIONS: ToolOption[] = [];

export const SOIL_OPTIONS: ToolOption[] = [
  {
    tool: "WEED",
    label: "Désherber",
    hint: "Pulvérisateur : nettoie la culture en place, sans la retourner",
  },
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
  if (tool === "HARVEST") return "HARVEST";
  if (isSoilTool(tool)) return "SOIL";
  return null;
}

/**
 * Options de la famille — liste vide pour celles qui n'en ont pas.
 *
 * La saison est annotée ici plutôt que dans chacun des deux rendus — le rail
 * de bureau et le dock mobile. Un joueur ne doit pas apprendre la fenêtre de
 * semis en se faisant refuser son champ ; il doit la voir sur le bouton, avec
 * la saison où revenir.
 */
export function optionsFor(group: ToolGroup | null, season?: Season): ToolOption[] {
  if (group === "HARVEST") return HARVEST_OPTIONS;
  if (group === "SOIL") return SOIL_OPTIONS;
  if (group !== "PLANT") return [];
  if (!season) return PLANT_OPTIONS;
  return PLANT_OPTIONS.map((o) => {
    const crop = cropFromPlantTool(o.tool);
    if (!crop) return o;
    const verdict = canSowInSeason(crop, season);
    return verdict.ok
      ? { ...o, hint: `${o.hint} · se sème ${windowLabel(crop)}` }
      : { ...o, outOfSeason: true, hint: verdict.reason };
  });
}

/** Tailles de pinceau proposées partout. */
export const BRUSH_SIZES = [1, 2, 3] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];
