/**
 * Sons d'interface et préférences du joueur.
 *
 * Les assets peuvent manquer : le réglage existe quand même, pour que le
 * menu « Son » ne mente pas le jour où un clic aura vraiment un bruit.
 */

import { AUDIO_KEY } from "./storage-keys";

export type AudioPrefs = {
  muted: boolean;
  /** 0 à 1 */
  volume: number;
};

const DEFAULT_AUDIO: AudioPrefs = { muted: false, volume: 0.7 };

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_AUDIO.volume;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function parseAudioPrefs(raw: string | null): AudioPrefs {
  if (!raw) return { ...DEFAULT_AUDIO };
  try {
    const p = JSON.parse(raw) as Partial<AudioPrefs>;
    return {
      muted: Boolean(p.muted),
      volume: clampVolume(typeof p.volume === "number" ? p.volume : DEFAULT_AUDIO.volume),
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
  const merged: AudioPrefs = {
    ...readAudioPrefs(),
    ...next,
  };
  merged.volume = clampVolume(merged.volume);
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(merged));
  } catch {
    /* stockage plein ou privé : le réglage tient le temps de la session */
  }
  return merged;
}

export function playUiSound(_kind: "click" | "place") {
  const prefs = readAudioPrefs();
  if (prefs.muted || prefs.volume <= 0) return;
  const urls: Partial<Record<"click" | "place", string>> = {};
  const url = urls[_kind];
  if (!url) return;
  try {
    const a = new Audio(url);
    a.volume = prefs.volume;
    void a.play().catch(() => undefined);
  } catch {
    /* skip */
  }
}
