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
  | "BALE"
  | "COLLECT"
  | "BUILD"
  | "PARK";

export function isFieldWorkTool(t: Tool): boolean {
  return (
    isPlantTool(t) ||
    t === "FERTILIZE" ||
    t === "HARVEST" ||
    t === "STUBBLE" ||
    t === "PLOW" ||
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
  return t === "FERTILIZE" || t === "STUBBLE" || t === "PLOW" || t === "PARK" || t === "BALE" || t === "COLLECT";
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
