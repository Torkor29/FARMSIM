import { CROP_DEFS, type CropCode } from "@farmsim/shared";

export type Tool =
  | "SELECT"
  | "PLANT_WHEAT"
  | "PLANT_MAIZE"
  | "PLANT_PEA"
  | "PLANT_BARLEY"
  | "PLANT_RAPE"
  | "PLANT_GRASS"
  | "PLANT_MESCLUN"
  | "PLANT_RADISH"
  | "PLANT_SPINACH"
  | "PLANT_LETTUCE"
  | "PLANT_POTATO"
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

/**
 * L'outil de semis de chaque culture, et rien d'autre à tenir à jour.
 *
 * Trois fonctions listaient les six outils à la main : « est-ce un semis »,
 * « quelle culture », « quel nom ». Passer de six cultures à onze aurait
 * demandé trois chaînes de onze `if` cohérentes entre elles — trois occasions
 * d'en oublier une, et un outil qui sème sans rien semer.
 *
 * La table est la seule source ; les trois fonctions la lisent.
 */
export const SEMIS: Record<string, CropCode> = {
  PLANT_WHEAT: "WHEAT",
  PLANT_MAIZE: "MAIZE",
  PLANT_PEA: "PEA",
  PLANT_BARLEY: "BARLEY",
  PLANT_RAPE: "RAPE",
  PLANT_GRASS: "GRASS",
  PLANT_MESCLUN: "MESCLUN",
  PLANT_RADISH: "RADISH",
  PLANT_SPINACH: "SPINACH",
  PLANT_LETTUCE: "LETTUCE",
  PLANT_POTATO: "POTATO",
};

export function isPlantTool(t: Tool): boolean {
  return t in SEMIS;
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
  return SEMIS[t] ?? null;
}

/** Le nom de la culture semée, tel que le catalogue l'écrit. */
export function plantCropLabel(t: Tool): string {
  const crop = SEMIS[t];
  return crop ? CROP_DEFS[crop].name : "Blé";
}

/**
 * Le geste que fait l'outil, dit comme au champ.
 *
 * Le bureau et le téléphone nommaient l'action chacun de son côté : la barre
 * de sélection listait les outils à la main et retombait sur « Récolter », le
 * dock disait « Faire ». « Presser », « Ramasser » et « Désherber » n'étaient
 * donc jamais annoncés par leur nom. Ici, à côté de la liste des outils, un
 * oubli se voit — et se teste. Le verbe nu sert aux phrases (« les cases à
 * semer »), celui d'en dessous aux boutons (« Semer Blé ×12 »).
 */
export function toolBareVerb(t: Tool, mow = false): string {
  if (isPlantTool(t)) return "Semer";
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

/** Le geste **et** sa culture : « Semer Blé » sur le bouton d'action. */
export function toolVerb(t: Tool, mow = false): string {
  const verbe = toolBareVerb(t, mow);
  return isPlantTool(t) ? `${verbe} ${plantCropLabel(t)}` : verbe;
}

/** Le même geste, avec le nombre de cases — libellé du bouton de bureau. */
export function toolActionLabel(t: Tool, count: number, mow = false): string {
  return `${toolVerb(t, mow)} · ${count} case(s)`;
}
