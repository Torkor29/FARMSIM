import type { CropCode } from "@farmsim/shared";

export type Tool =
  | "SELECT"
  | "PLANT_WHEAT"
  | "PLANT_MAIZE"
  | "PLANT_PEA"
  | "PLANT_BARLEY"
  | "PLANT_RAPE"
  | "PLANT_GRASS"
  | "FERTILIZE"
  | "HARVEST"
  | "STUBBLE"
  | "PLOW"
  | "WEED"
  | "BALE"
  | "COLLECT"
  | "BUILD";

export function isFieldWorkTool(t: Tool): boolean {
  return (
    isPlantTool(t) ||
    t === "FERTILIZE" ||
    t === "HARVEST" ||
    t === "STUBBLE" ||
    t === "PLOW" ||
    t === "WEED" ||
    t === "BALE" ||
    t === "COLLECT"
  );
}

export function isPlantTool(t: Tool): boolean {
  return (
    t === "PLANT_WHEAT" ||
    t === "PLANT_MAIZE" ||
    t === "PLANT_PEA" ||
    t === "PLANT_BARLEY" ||
    t === "PLANT_RAPE" ||
    t === "PLANT_GRASS"
  );
}

export function isSoilTool(t: Tool): boolean {
  return (
    t === "FERTILIZE" ||
    t === "STUBBLE" ||
    t === "PLOW" ||
    t === "WEED" ||
    t === "BALE" ||
    t === "COLLECT"
  );
}

export function cropFromPlantTool(t: Tool): CropCode | null {
  if (t === "PLANT_WHEAT") return "WHEAT";
  if (t === "PLANT_MAIZE") return "MAIZE";
  if (t === "PLANT_PEA") return "PEA";
  if (t === "PLANT_BARLEY") return "BARLEY";
  if (t === "PLANT_RAPE") return "RAPE";
  if (t === "PLANT_GRASS") return "GRASS";
  return null;
}

export function plantCropLabel(t: Tool): string {
  if (t === "PLANT_MAIZE") return "Maïs";
  if (t === "PLANT_PEA") return "Pois";
  if (t === "PLANT_BARLEY") return "Orge";
  if (t === "PLANT_RAPE") return "Colza";
  if (t === "PLANT_GRASS") return "Herbe";
  return "Blé";
}

/**
 * Le geste que fait l'outil, dit comme au champ.
 *
 * Le bureau et le téléphone nommaient l'action chacun de son côté : la barre
 * de sélection listait les outils à la main et retombait sur « Récolter », le
 * dock disait « Faire ». « Presser », « Ramasser » et « Désherber » n'étaient
 * donc jamais annoncés par leur nom. Ici, à côté de la liste des outils, un
 * oubli se voit — et se teste.
 */
export function toolVerb(t: Tool, mow = false): string {
  if (isPlantTool(t)) return `Semer ${plantCropLabel(t)}`;
  if (t === "HARVEST") return mow ? "Faucher" : "Récolter";
  if (t === "FERTILIZE") return "Fertiliser";
  if (t === "PLOW") return "Labourer";
  // On ne nettoie pas un champ : on le déchaume. Le mot juste est celui du
  // métier, pas celui du ménage.
  if (t === "STUBBLE") return "Déchaumer";
  if (t === "WEED") return "Désherber";
  if (t === "BALE") return "Presser";
  if (t === "COLLECT") return "Ramasser";
  return "Travailler";
}

/** Le même geste, avec le nombre de cases — libellé du bouton de bureau. */
export function toolActionLabel(t: Tool, count: number, mow = false): string {
  return `${toolVerb(t, mow)} · ${count} case(s)`;
}
