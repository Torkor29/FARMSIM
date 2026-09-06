/**
 * Ce que le joueur règle, et ce qu'on lui garde.
 *
 * Trois curseurs plutôt qu'un, parce que trois choses très différentes
 * sortent du même haut-parleur :
 *
 * - la **musique**, qu'on écoute pendant des heures ;
 * - les **effets**, qui répondent à un geste et doivent s'entendre ;
 * - l'**ambiance** — les bêtes, le vent —, qui ne doit jamais couvrir le
 *   reste. C'est elle qui transforme une ferme en brouhaha si on la laisse
 *   faire, donc elle part basse.
 *
 * L'ancien format `{ muted, volume }` se relit sans rien perdre : une partie
 * déjà jouée retrouve son volume, et hérite des trois nouveaux réglages à
 * leur valeur par défaut.
 */

import { AUDIO_KEY } from "../storage-keys";

/** Les trois bus. Tout son sort par l'un des trois, jamais à côté. */
export type Bus = "musique" | "effets" | "ambiance";

export type AudioPrefs = {
  /** Coupe tout, d'un seul geste. */
  muted: boolean;
  /** Volume général, appliqué par-dessus les trois autres. 0 à 1. */
  volume: number;
  /** 0 à 1. */
  musique: number;
  /** 0 à 1. */
  effets: number;
  /** 0 à 1. */
  ambiance: number;
};

/**
 * Les valeurs de départ, et pourquoi celles-là.
 *
 * L'ambiance est à 0,35 quand les effets sont à 0,8 : c'est la consigne
 * « beaucoup moins fort que la musique », écrite dans les nombres plutôt que
 * laissée à la bonne volonté de chaque appel.
 */
export const DEFAULT_AUDIO: AudioPrefs = {
  muted: false,
  volume: 0.7,
  musique: 0.55,
  effets: 0.8,
  ambiance: 0.35,
};

function clampVolume(v: unknown, defaut: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return defaut;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function parseAudioPrefs(raw: string | null): AudioPrefs {
  if (!raw) return { ...DEFAULT_AUDIO };
  try {
    const p = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      muted: Boolean(p.muted),
      volume: clampVolume(p.volume, DEFAULT_AUDIO.volume),
      musique: clampVolume(p.musique, DEFAULT_AUDIO.musique),
      effets: clampVolume(p.effets, DEFAULT_AUDIO.effets),
      ambiance: clampVolume(p.ambiance, DEFAULT_AUDIO.ambiance),
    };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

export function readAudioPrefs(): AudioPrefs {
  try {
    return parseAudioPrefs(localStorage.getItem(AUDIO_KEY));
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

export function writeAudioPrefs(next: Partial<AudioPrefs>): AudioPrefs {
  const merged: AudioPrefs = { ...readAudioPrefs(), ...next };
  merged.volume = clampVolume(merged.volume, DEFAULT_AUDIO.volume);
  merged.musique = clampVolume(merged.musique, DEFAULT_AUDIO.musique);
  merged.effets = clampVolume(merged.effets, DEFAULT_AUDIO.effets);
  merged.ambiance = clampVolume(merged.ambiance, DEFAULT_AUDIO.ambiance);
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(merged));
  } catch {
    /* stockage plein ou navigation privée : le réglage tient la session */
  }
  return merged;
}

/**
 * Le gain effectif d'un bus, une fois tout multiplié.
 *
 * Le calcul vit ici, seul, pour qu'aucun appel ne puisse l'oublier : c'est
 * la seule porte par laquelle un volume atteint le haut-parleur.
 */
export function gainDuBus(prefs: AudioPrefs, bus: Bus): number {
  if (prefs.muted) return 0;
  return prefs.volume * prefs[bus];
}
