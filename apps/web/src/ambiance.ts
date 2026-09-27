import { dayProgress, GAME_DAY_MS } from "@farmsim/shared";

/**
 * L'ambiance lumineuse : l'heure, la saison et le temps qu'il fait, en une
 * lumière.
 *
 * La ferme était éclairée en plein midi, toujours : la saison changeait la
 * teinte, rien ne bougeait dans la journée. Ce module fait tourner un jour
 * complet — nuit bleue, heure bleue, aube rose, lumière dorée du matin, midi
 * de la saison, lumière dorée du soir, coucher orangé, crépuscule violet — et
 * voile le tout selon la météo (gris de pluie, blanc de neige, sombre
 * d'orage).
 *
 * Tout se règle sur **la hauteur du soleil**, pas sur l'heure : un coucher
 * d'hiver à 17 h ressemble à un coucher d'été à 21 h, c'est le soleil au ras
 * de l'horizon qui fait l'orange. L'heure ne sert qu'à placer le soleil.
 *
 * Module pur : pas de three.js, pas de DOM. `IsoFarmView` en tire les
 * lumières et la brume, `SeasonSky` le ciel, `DecorShowcase` l'atelier.
 *
 * ## Le jour de jeu
 *
 * Un jour de jeu dure une heure et vingt-six minutes réelles. On ne veut pas
 * y passer une demi-heure dans le noir : le temps est **tassé** — la journée
 * (du lever moins une heure au coucher plus une heure) occupe les trois
 * quarts du cycle, la nuit passe en un quart. Voir `heureDuJeu`.
 */

export type Saison = "SPRING" | "SUMMER" | "AUTUMN" | "WINTER";
export type Meteo = "CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "SNOW";

export interface Lumiere {
  couleur: number;
  intensite: number;
}

export interface Ambiance {
  heure: number;
  /** Hauteur du soleil en degrés (négative la nuit). */
  elevation: number;
  /** La lumière directionnelle : le soleil le jour, la lune la nuit. */
  astre: Lumiere & { direction: [number, number, number]; lune: boolean };
  hemi: { ciel: number; sol: number; intensite: number };
  ambiante: Lumiere;
  rebond: Lumiere;
  brume: { couleur: number; proche: number; loin: number };
  ciel: {
    haut: number;
    bas: number;
    horizon: number;
    /** Opacité du calque d'heure sur le ciel de saison (0 à midi). */
    voile: number;
    /** Position de l'astre dans le ciel CSS, 0..1 (x gauche → droite, y haut → bas). */
    astreX: number;
    astreY: number;
    astreCouleur: number;
    etoiles: number;
  };
  /** 0 le jour, 1 en pleine nuit. */
  nuit: number;
  /** 0..1 : à quel point lanternes et fenêtres doivent briller. */
  lampes: number;
  /** 0 ciel dégagé, 1 plafond d'orage. */
  couverture: number;
}

/* ------------------------------------------------------------------------ */
/* Couleurs                                                                  */
/* ------------------------------------------------------------------------ */

function canaux(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

/** Mélange deux couleurs sRGB (t = 0 → a, t = 1 → b). */
export function melange(a: number, b: number, t: number): number {
  const u = Math.min(1, Math.max(0, t));
  const [ar, ag, ab] = canaux(a);
  const [br, bg, bb] = canaux(b);
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bl = Math.round(ab + (bb - ab) * u);
  return (r << 16) | (g << 8) | bl;
}

const lin = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

function lisse(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------------------ */
/* Le midi de chaque saison (repris de l'ancien barème d'IsoFarmView)        */
/* ------------------------------------------------------------------------ */

interface Cle {
  soleil: number;
  soleilI: number;
  hemiCiel: number;
  hemiSol: number;
  hemiI: number;
  amb: number;
  ambI: number;
  rebond: number;
  rebondI: number;
  haut: number;
  bas: number;
  horizon: number;
  brume: number;
}

/**
 * Le plein jour de chaque saison : un été franc et haut, un automne cuivré,
 * un hiver bleu, un printemps clair et vert. Ce sont les valeurs qui
 * éclairaient la ferme jusqu'ici, à toute heure.
 */
export const MIDI: Record<Saison, Cle> = {
  SPRING: {
    soleil: 0xfff4dc, soleilI: 1.5, hemiCiel: 0xffffff, hemiSol: 0x9ec98a, hemiI: 1.25,
    amb: 0xfff6e4, ambI: 0.65, rebond: 0xc6e8ce, rebondI: 0.42,
    haut: 0x7ec8e8, bas: 0xdcf3bf, horizon: 0xb6e893, brume: 0xbfe4f5,
  },
  SUMMER: {
    soleil: 0xfff0c4, soleilI: 1.85, hemiCiel: 0xfff8e0, hemiSol: 0x9ab87e, hemiI: 1.35,
    amb: 0xfff2d0, ambI: 0.7, rebond: 0xd8e8b8, rebondI: 0.38,
    haut: 0x4db4e8, bas: 0xffeeb8, horizon: 0xffd98a, brume: 0xbfe4f5,
  },
  AUTUMN: {
    soleil: 0xffce7e, soleilI: 1.35, hemiCiel: 0xf6e2c0, hemiSol: 0xa8894e, hemiI: 1.1,
    amb: 0xf7e2c0, ambI: 0.6, rebond: 0xd9b98a, rebondI: 0.4,
    haut: 0xb9c6d8, bas: 0xf2cf97, horizon: 0xe0a862, brume: 0xd8d8d0,
  },
  WINTER: {
    soleil: 0xe8f0fb, soleilI: 1.15, hemiCiel: 0xdce9f6, hemiSol: 0xb8c4cc, hemiI: 1.05,
    amb: 0xe4eef8, ambI: 0.62, rebond: 0xc4d4e4, rebondI: 0.34,
    haut: 0x8497ad, bas: 0xe2e6ee, horizon: 0xc9d2e0, brume: 0xdce8f2,
  },
};

/**
 * Les moments du jour, repérés par la hauteur du soleil. L'aube et le
 * soir diffèrent sous l'horizon : l'aube est rose et fraîche, le soir orangé
 * puis violet.
 */
const NUIT: Cle = {
  // La lune éclaire : bleue, assez forte pour que la ferme reste lisible.
  soleil: 0xb4c6ff, soleilI: 0.62, hemiCiel: 0x6a80c4, hemiSol: 0x243052, hemiI: 0.95,
  amb: 0x5a6cae, ambI: 0.55, rebond: 0x4a5a90, rebondI: 0.25,
  haut: 0x0d1633, bas: 0x273a70, horizon: 0x34487e, brume: 0x24345e,
};
const HEURE_BLEUE_AUBE: Cle = {
  soleil: 0x9fb0e8, soleilI: 0.3, hemiCiel: 0x8a98d8, hemiSol: 0x3c4260, hemiI: 1.0,
  amb: 0x8a8cc4, ambI: 0.55, rebond: 0x7a80b0, rebondI: 0.28,
  haut: 0x34508e, bas: 0xd6a6c0, horizon: 0xf4b4b0, brume: 0x9a9cc4,
};
const HEURE_BLEUE_SOIR: Cle = {
  // Le crépuscule : rose-violet et assez clair, jamais boueux.
  soleil: 0xc08ae0, soleilI: 0.35, hemiCiel: 0xc098e0, hemiSol: 0x4a4068, hemiI: 1.15,
  amb: 0xb090d8, ambI: 0.62, rebond: 0x7a70a8, rebondI: 0.28,
  haut: 0x2c3a7c, bas: 0xc88ab8, horizon: 0xe98a8a, brume: 0x8c80b4,
};
const HORIZON_AUBE: Cle = {
  soleil: 0xffa070, soleilI: 1.3, hemiCiel: 0xffc4b8, hemiSol: 0x6c6070, hemiI: 0.9,
  amb: 0xffc8c0, ambI: 0.45, rebond: 0xc0b0d0, rebondI: 0.32,
  haut: 0x6c86c4, bas: 0xffc4a8, horizon: 0xffa890, brume: 0xf0b8a8,
};
const HORIZON_SOIR: Cle = {
  soleil: 0xff7a38, soleilI: 1.4, hemiCiel: 0xffa878, hemiSol: 0x6e5048, hemiI: 0.85,
  amb: 0xffb090, ambI: 0.42, rebond: 0xd0a0a0, rebondI: 0.32,
  haut: 0x5a70b8, bas: 0xffa868, horizon: 0xff7a3c, brume: 0xf0a080,
};
const DOREE: Cle = {
  // La lumière dorée : un soleil fort et chaud, peu de lumière d'appoint —
  // ce sont les longues ombres contrastées qui font l'heure dorée.
  soleil: 0xffb964, soleilI: 1.95, hemiCiel: 0xffd9a8, hemiSol: 0x9aa07a, hemiI: 0.95,
  amb: 0xffdcb0, ambI: 0.45, rebond: 0xe0c8a0, rebondI: 0.38,
  haut: 0x78b2e0, bas: 0xffe2a8, horizon: 0xffc88a, brume: 0xf2d8b4,
};

function mixCle(a: Cle, b: Cle, t: number): Cle {
  const o = {} as Cle;
  for (const k of Object.keys(a) as (keyof Cle)[]) {
    const couleur = !k.endsWith("I");
    o[k] = couleur ? melange(a[k], b[k], t) : lin(a[k], b[k], t);
  }
  return o;
}

/** La clé de lumière pour une hauteur de soleil, le matin ou le soir. */
function cleSoleil(elevation: number, saison: Saison, matin: boolean): Cle {
  const bleue = matin ? HEURE_BLEUE_AUBE : HEURE_BLEUE_SOIR;
  const horizon = matin ? HORIZON_AUBE : HORIZON_SOIR;
  const midi = MIDI[saison];
  if (elevation <= -12) return NUIT;
  if (elevation <= -6) return mixCle(NUIT, bleue, (elevation + 12) / 6);
  if (elevation <= 0) return mixCle(bleue, horizon, (elevation + 6) / 6);
  if (elevation <= 8) return mixCle(horizon, DOREE, elevation / 8);
  if (elevation <= 26) return mixCle(DOREE, midi, (elevation - 8) / 18);
  return midi;
}

/* ------------------------------------------------------------------------ */
/* Le soleil                                                                 */
/* ------------------------------------------------------------------------ */

/** Lever, coucher (heures) et hauteur de midi (degrés) de chaque saison. */
export const COURSE: Record<Saison, { lever: number; coucher: number; midi: number }> = {
  SPRING: { lever: 6.3, coucher: 20.2, midi: 52 },
  SUMMER: { lever: 5.6, coucher: 21.4, midi: 64 },
  AUTUMN: { lever: 7.2, coucher: 18.6, midi: 36 },
  WINTER: { lever: 8.0, coucher: 17.4, midi: 24 },
};

/** Hauteur du soleil (degrés) à une heure donnée : continue sur 24 h. */
export function elevationSoleil(heure: number, saison: Saison): number {
  const { lever, coucher, midi } = COURSE[saison];
  const h = ((heure % 24) + 24) % 24;
  const jour = coucher - lever;
  if (h >= lever && h <= coucher) return midi * Math.sin((Math.PI * (h - lever)) / jour);
  // La nuit, le soleil plonge jusqu'à −40° au milieu de la nuit.
  const depuis = h > coucher ? h - coucher : h + 24 - coucher;
  return -40 * Math.sin((Math.PI * depuis) / (24 - jour));
}

/**
 * La direction de la lumière (vers la lumière, repère du jeu : y en haut).
 *
 * Le soleil de midi vient d'où il venait toujours — de l'avant-droite, du
 * côté de la caméra, pour que les façades restent éclairées. Il se lève
 * sur la gauche, se couche sur la droite. On ne le laisse pas descendre sous
 * 7° pour la direction : des ombres infinies traverseraient la carte ; les
 * couleurs, elles, suivent la vraie hauteur.
 */
function directionSoleil(heure: number, saison: Saison, elevation: number): [number, number, number] {
  const { lever, coucher } = COURSE[saison];
  const h = ((heure % 24) + 24) % 24;
  const t = Math.min(1, Math.max(0, (h - lever) / (coucher - lever)));
  const midi = Math.atan2(10, 14);
  const az = midi + ((t - 0.5) * 220 * Math.PI) / 180;
  const el = (Math.max(7, elevation) * Math.PI) / 180;
  return [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
}

/** La lune : haute, un peu en arrière à gauche, pour que ses ombres restent courtes. */
const LUNE: [number, number, number] = (() => {
  const v = [-0.35, 0.82, 0.45];
  const n = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / n, v[1] / n, v[2] / n];
})();

/* ------------------------------------------------------------------------ */
/* La météo                                                                  */
/* ------------------------------------------------------------------------ */

const COUVERTURE: Record<Meteo, number> = { CLEAR: 0, CLOUDY: 0.5, RAIN: 0.75, STORM: 0.92, SNOW: 0.6 };
const GRIS: Record<Meteo, number> = {
  CLEAR: 0xffffff,
  CLOUDY: 0xc8d0d8,
  RAIN: 0xa9b6c4,
  STORM: 0x7e8a9e,
  SNOW: 0xe8eef4,
};

/* ------------------------------------------------------------------------ */
/* L'ambiance                                                                */
/* ------------------------------------------------------------------------ */

export function ambiance(heure: number, saison: Saison, meteo: Meteo = "CLEAR"): Ambiance {
  const s = COURSE[saison] ? saison : "SUMMER";
  const m = COUVERTURE[meteo] !== undefined ? meteo : "CLEAR";
  const elevation = elevationSoleil(heure, s);
  const h = ((heure % 24) + 24) % 24;
  const matin = h < 12;
  const k = cleSoleil(elevation, s, matin);
  const c = COUVERTURE[m];
  const gris = GRIS[m];

  // La nuit, la lumière directionnelle est la lune ; le passage se fait sous
  // l'horizon, quand le soleil ne donne plus rien.
  const lune = elevation < -4;
  const direction = lune ? LUNE : directionSoleil(h, s, elevation);
  // Au ras de l'horizon le soleil s'éteint doucement, puis la lune se lève.
  const fondu = lune ? lisse(-4, -10, elevation) : lisse(-4, 1.5, elevation);
  const nuit = lisse(-2, -11, elevation);

  const voileGris = m === "STORM" ? 0.75 : 0.55;
  const astre = {
    couleur: melange(k.soleil, gris, c * 0.6),
    intensite: k.soleilI * (0.15 + 0.85 * fondu) * (1 - 0.82 * c),
    direction,
    lune,
  };
  const hemi = {
    ciel: melange(k.hemiCiel, gris, c * voileGris),
    sol: melange(k.hemiSol, melange(gris, 0x505a66, 0.5), c * 0.4),
    intensite: k.hemiI * (1 + 0.18 * c) * (m === "STORM" ? 0.8 : 1),
  };
  const ambiante = {
    couleur: melange(k.amb, gris, c * voileGris),
    intensite: k.ambI * (1 + 0.3 * c) * (m === "STORM" ? 0.85 : 1),
  };
  const rebond = { couleur: melange(k.rebond, gris, c * 0.5), intensite: k.rebondI * (1 - 0.4 * c) };

  // La brume : la couleur de l'horizon du moment, plus proche sous la pluie.
  const brumeJour = melange(k.brume, gris, c * 0.7);
  const proche = m === "RAIN" || m === "STORM" ? 34 : m === "SNOW" ? 38 : 46;
  const loin = m === "RAIN" || m === "STORM" ? 80 : m === "SNOW" ? 84 : 92;

  // Le ciel CSS : un voile par-dessus la palette de saison, nul en plein jour.
  const voile = Math.max(1 - lisse(8, 26, elevation), c * 0.75);
  const { lever, coucher } = COURSE[s];
  const tJour = (h - lever) / (coucher - lever);
  const tNuit = h > coucher ? (h - coucher) / (24 - (coucher - lever)) : (h + 24 - coucher) / (24 - (coucher - lever));
  const course = lune ? tNuit : tJour;
  const astreX = 0.08 + 0.84 * Math.min(1, Math.max(0, course));
  const haut = lune ? Math.sin(Math.PI * Math.min(1, Math.max(0, tNuit))) : Math.max(0, elevation) / COURSE[s].midi;
  const astreY = 0.62 - 0.52 * haut;

  return {
    heure: h,
    elevation,
    astre,
    hemi,
    ambiante,
    rebond,
    brume: { couleur: brumeJour, proche, loin },
    ciel: {
      haut: melange(k.haut, melange(gris, 0x3a4658, nuit), c * 0.7),
      bas: melange(k.bas, melange(gris, 0x2c3648, nuit), c * 0.7),
      horizon: melange(k.horizon, melange(gris, 0x3a4658, nuit), c * 0.7),
      voile,
      astreX,
      astreY,
      astreCouleur: lune ? 0xeef2ff : melange(0xff8a3c, 0xfff1c8, lisse(0, 20, elevation)),
      etoiles: nuit * (1 - c),
    },
    nuit,
    lampes: Math.min(1, lisse(6, -3, elevation) + (m === "STORM" ? 0.5 : m === "RAIN" ? 0.25 : 0)),
    couverture: c,
  };
}

/* ------------------------------------------------------------------------ */
/* L'horloge                                                                 */
/* ------------------------------------------------------------------------ */

/**
 * L'heure du jeu (0–24) pour une fraction du jour de jeu (0–1), temps tassé :
 * la journée — du lever moins une heure au coucher plus une heure — prend
 * les trois quarts du cycle réel ; la nuit passe dans le dernier quart.
 */
export function heureDuJeu(fraction: number, saison: Saison, partJour = 0.75): number {
  const { lever, coucher } = COURSE[saison] ?? COURSE.SUMMER;
  const debut = lever - 1;
  const fin = coucher + 1;
  const f = ((fraction % 1) + 1) % 1;
  if (f < partJour) return debut + (fin - debut) * (f / partJour);
  const nuit = 24 - (fin - debut);
  return (fin + nuit * ((f - partJour) / (1 - partJour))) % 24;
}

export interface Forcages {
  /** Heure figée (0–24). */
  heure?: number;
  /** Accélération du temps (1 = temps du jeu). */
  vitesse?: number;
  meteo?: Meteo;
  /** Saison de la lumière (développement : juger un été un jour d'automne). */
  saison?: Saison;
}

const METEOS: Meteo[] = ["CLEAR", "CLOUDY", "RAIN", "STORM", "SNOW"];

/**
 * Les réglages de l'URL, pour voir un coucher sans attendre le soir :
 *   ?heure=19.2      fige l'heure
 *   ?vitesse=60      un jour de jeu en une minute et demie
 *   ?meteo=RAIN      CLEAR | CLOUDY | RAIN | STORM | SNOW
 *   ?saison=SUMMER   la lumière d'une autre saison (le jeu, lui, ne change pas)
 */
export function lireForcages(recherche: string): Forcages {
  const p = new URLSearchParams(recherche);
  const f: Forcages = {};
  const h = Number(p.get("heure"));
  if (p.has("heure") && Number.isFinite(h)) f.heure = ((h % 24) + 24) % 24;
  const v = Number(p.get("vitesse"));
  if (p.has("vitesse") && Number.isFinite(v) && v > 0) f.vitesse = v;
  const m = p.get("meteo")?.toUpperCase() as Meteo | undefined;
  if (m && METEOS.includes(m)) f.meteo = m;
  const s = p.get("saison")?.toUpperCase() as Saison | undefined;
  if (s && s in COURSE) f.saison = s;
  return f;
}

const FORCAGES: Forcages = typeof location === "undefined" ? {} : lireForcages(location.search);
const DEPART = Date.now();

/** L'heure du jeu en ce moment, forçages de l'URL compris. */
export function heureCourante(saison: Saison, now: number = Date.now()): number {
  if (FORCAGES.heure !== undefined) return FORCAGES.heure;
  const v = FORCAGES.vitesse ?? 1;
  const t = DEPART + (now - DEPART) * v;
  return heureDuJeu(dayProgress(t), saison);
}

/** La saison de la lumière : celle du jeu, sauf forçage de l'URL. */
export function saisonCourante(saison: string): Saison {
  return FORCAGES.saison ?? ((saison in COURSE ? saison : "SUMMER") as Saison);
}

/** La météo à afficher : celle du jeu, sauf forçage de l'URL. */
export function meteoCourante(meteo: string): Meteo {
  if (FORCAGES.meteo) return FORCAGES.meteo;
  return (METEOS.includes(meteo as Meteo) ? meteo : "CLEAR") as Meteo;
}

/** Durée réelle d'un jour de jeu, pour qui voudrait l'afficher. */
export const DUREE_JOUR_MS = GAME_DAY_MS;

/** « 18:42 » : l'heure du jeu, lisible. */
export function formatHeure(heure: number): string {
  const h = ((heure % 24) + 24) % 24;
  const min = Math.floor((h % 1) * 60);
  return `${String(Math.floor(h)).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Le nom du moment : ce que le joueur voit dans le ciel. */
export function momentDuJour(heure: number, saison: Saison): string {
  const e = elevationSoleil(heure, saison);
  const h = ((heure % 24) + 24) % 24;
  const matin = h < 12;
  if (e < -8) return "nuit";
  if (e < 0) return matin ? "aube" : "crépuscule";
  if (e < 10) return matin ? "lever du soleil" : "coucher du soleil";
  const { lever, coucher } = COURSE[saison];
  const milieu = (lever + coucher) / 2;
  if (Math.abs(h - milieu) < 1.2) return "midi";
  return h < milieu ? "matin" : "après-midi";
}
