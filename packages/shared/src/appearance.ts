/** Création de personnage : pièces low-poly, indices persistés en JSON. */

export const SKIN_TONES = [
  { id: "ivory", hex: "#f3d7c3", label: "Ivoire" },
  { id: "peach", hex: "#e8b58a", label: "Pêche" },
  { id: "sand", hex: "#d4a574", label: "Sable" },
  { id: "amber", hex: "#c68642", label: "Ambre" },
  { id: "copper", hex: "#8d5524", label: "Cuivre" },
  { id: "umber", hex: "#5c3a21", label: "Ombre" },
  { id: "espresso", hex: "#3b2414", label: "Expresso" },
  { id: "ebony", hex: "#24150e", label: "Ébène" },
] as const;

export const EYE_COLORS = [
  { id: "brown", hex: "#3b2418", label: "Brun" },
  { id: "hazel", hex: "#6b4c2a", label: "Noisette" },
  { id: "green", hex: "#3d6b45", label: "Vert" },
  { id: "blue", hex: "#3d5a80", label: "Bleu" },
  { id: "grey", hex: "#5a6570", label: "Gris" },
  { id: "black", hex: "#1a1410", label: "Noir" },
] as const;

export const EYE_SHAPES = [
  { id: "round", label: "Ronds" },
  { id: "almond", label: "Amandes" },
  { id: "wide", label: "Écartés" },
  { id: "narrow", label: "Rapprochés" },
  { id: "sleepy", label: "Mi-clos" },
] as const;

export const MOUTHS = [
  { id: "smile", label: "Sourire" },
  { id: "neutral", label: "Neutre" },
  { id: "grin", label: "Grand sourire" },
  { id: "smirk", label: "De travers" },
  { id: "open", label: "Ouverte" },
] as const;

export const NOSES = [
  { id: "small", label: "Petit" },
  { id: "round", label: "Rond" },
  { id: "long", label: "Long" },
  { id: "button", label: "Bouton" },
  { id: "broad", label: "Large" },
] as const;

export const EARS = [
  { id: "small", label: "Petites" },
  { id: "round", label: "Rondes" },
  { id: "pointed", label: "Pointues" },
  { id: "wide", label: "Larges" },
] as const;

export const HATS = [
  { id: "none", label: "Aucun" },
  { id: "straw", label: "Paille" },
  { id: "cap", label: "Casquette" },
  { id: "beanie", label: "Bonnet" },
  { id: "cowboy", label: "Cowboy" },
  { id: "beret", label: "Béret" },
  { id: "bandana", label: "Bandana" },
] as const;

export const CLOTHES = [
  { id: "overalls", label: "Salopette" },
  { id: "shirt", label: "Chemise" },
  { id: "jacket", label: "Veste" },
  { id: "coverall", label: "Combinaison" },
  { id: "sweater", label: "Pull" },
  { id: "vest", label: "Gilet" },
] as const;

export const CLOTH_COLORS = [
  { id: "green", hex: "#3f8f52", label: "Vert" },
  { id: "denim", hex: "#3d5a80", label: "Denim" },
  { id: "brown", hex: "#8a5a3a", label: "Brun" },
  { id: "red", hex: "#b0453a", label: "Rouge" },
  { id: "navy", hex: "#2c3e6b", label: "Marine" },
  { id: "khaki", hex: "#9a8b5a", label: "Kaki" },
] as const;

export const ACCENT_COLORS = [
  { id: "gold", hex: "#d9b23c", label: "Or" },
  { id: "rust", hex: "#c0663f", label: "Rouille" },
  { id: "cream", hex: "#f0e6d2", label: "Crème" },
  { id: "teal", hex: "#2a9d8f", label: "Sarcelle" },
  { id: "wine", hex: "#7a3048", label: "Vin" },
  { id: "slate", hex: "#5c6b73", label: "Ardoise" },
] as const;

export const HAT_COLORS = [
  { id: "straw", hex: "#c9a227", label: "Paille" },
  { id: "cream", hex: "#f0e6d2", label: "Crème" },
  { id: "navy", hex: "#2c3e6b", label: "Marine" },
  { id: "red", hex: "#b0453a", label: "Rouge" },
  { id: "brown", hex: "#6b4423", label: "Brun" },
  { id: "black", hex: "#2a241c", label: "Noir" },
] as const;

export type CharacterAppearance = {
  skin: number;
  eyeColor: number;
  eyeShape: number;
  mouth: number;
  nose: number;
  ears: number;
  hat: number;
  hatColor: number;
  clothes: number;
  clothColor: number;
  accentColor: number;
};

const KEYS: (keyof CharacterAppearance)[] = [
  "skin",
  "eyeColor",
  "eyeShape",
  "mouth",
  "nose",
  "ears",
  "hat",
  "hatColor",
  "clothes",
  "clothColor",
  "accentColor",
];

const LENS: Record<keyof CharacterAppearance, number> = {
  skin: SKIN_TONES.length,
  eyeColor: EYE_COLORS.length,
  eyeShape: EYE_SHAPES.length,
  mouth: MOUTHS.length,
  nose: NOSES.length,
  ears: EARS.length,
  hat: HATS.length,
  hatColor: HAT_COLORS.length,
  clothes: CLOTHES.length,
  clothColor: CLOTH_COLORS.length,
  accentColor: ACCENT_COLORS.length,
};

export function clampIndex(i: number, len: number): number {
  if (!Number.isFinite(i) || len <= 0) return 0;
  const n = Math.round(i);
  return ((n % len) + len) % len;
}

export function defaultAppearance(spec?: "CEREALIER" | "ELEVEUR"): CharacterAppearance {
  if (spec === "ELEVEUR") {
    return {
      skin: 2,
      eyeColor: 0,
      eyeShape: 0,
      mouth: 0,
      nose: 1,
      ears: 1,
      hat: 4,
      hatColor: 1,
      clothes: 2,
      clothColor: 2,
      accentColor: 1,
    };
  }
  return {
    skin: 1,
    eyeColor: 0,
    eyeShape: 1,
    mouth: 0,
    nose: 0,
    ears: 0,
    hat: 1,
    hatColor: 0,
    clothes: 0,
    clothColor: 0,
    accentColor: 0,
  };
}

export function parseAppearance(
  raw: unknown,
  spec?: "CEREALIER" | "ELEVEUR",
): CharacterAppearance {
  const fallback = defaultAppearance(spec);
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const next = { ...fallback };
  for (const k of KEYS) {
    if (typeof o[k] === "number") next[k] = clampIndex(o[k] as number, LENS[k]);
  }
  return next;
}

export function appearanceFromJson(
  json: string | null | undefined,
  spec?: "CEREALIER" | "ELEVEUR",
): CharacterAppearance {
  if (!json) return defaultAppearance(spec);
  try {
    return parseAppearance(JSON.parse(json), spec);
  } catch {
    return defaultAppearance(spec);
  }
}

export function randomAppearance(spec?: "CEREALIER" | "ELEVEUR"): CharacterAppearance {
  const pick = (len: number) => Math.floor(Math.random() * len);
  return {
    skin: pick(LENS.skin),
    eyeColor: pick(LENS.eyeColor),
    eyeShape: pick(LENS.eyeShape),
    mouth: pick(LENS.mouth),
    nose: pick(LENS.nose),
    ears: pick(LENS.ears),
    hat: spec === "ELEVEUR" ? pick(LENS.hat - 1) + 1 : pick(LENS.hat),
    hatColor: pick(LENS.hatColor),
    clothes: pick(LENS.clothes),
    clothColor: pick(LENS.clothColor),
    accentColor: pick(LENS.accentColor),
  };
}

/** Présence au champ : au-delà, le perso disparaît de la parcelle. */
export const FIELD_PRESENCE_TTL_MS = 90_000;

export type FieldWorkerView = {
  id: string;
  name: string;
  x: number;
  y: number;
  appearance: CharacterAppearance;
  specialization?: "CEREALIER" | "ELEVEUR";
  working?: boolean;
};
