export type Tool =
  | "SELECT"
  | "PLANT_WHEAT"
  | "PLANT_MAIZE"
  | "PLANT_PEA"
  | "FERTILIZE"
  | "HARVEST"
  | "STUBBLE"
  | "PLOW"
  | "BUILD"
  | "PARK";

export function isFieldWorkTool(t: Tool): boolean {
  return (
    t === "PLANT_WHEAT" ||
    t === "PLANT_MAIZE" ||
    t === "PLANT_PEA" ||
    t === "FERTILIZE" ||
    t === "HARVEST" ||
    t === "STUBBLE" ||
    t === "PLOW"
  );
}

export function isPlantTool(t: Tool): boolean {
  return t === "PLANT_WHEAT" || t === "PLANT_MAIZE" || t === "PLANT_PEA";
}

export function isSoilTool(t: Tool): boolean {
  return t === "FERTILIZE" || t === "STUBBLE" || t === "PLOW" || t === "PARK";
}

export function plantCropLabel(t: Tool): string {
  if (t === "PLANT_MAIZE") return "Maïs";
  if (t === "PLANT_PEA") return "Pois";
  return "Blé";
}
