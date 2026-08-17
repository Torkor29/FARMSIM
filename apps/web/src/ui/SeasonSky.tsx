/**
 * Ciel saisonnier — le fond de la ferme.
 *
 * Le fond était un dégradé fixe, le même toute l'année : deux couleurs
 * codées en dur derrière la scène 3D. La saison était pourtant déjà calculée
 * et déjà écrite dans le rail (« Saison · Été »), mais rien ne la donnait à
 * *voir*. On lisait la saison, on ne la sentait jamais.
 *
 * Trois choses ici, et rien de plus :
 *
 * - une palette par saison, du ciel au sol ;
 * - un astre et quelques nuages, qui changent d'allure avec elle ;
 * - une transition d'une seconde et demie au changement de saison, pour que
 *   le passage se remarque sans interrompre la partie.
 *
 * Tout est en CSS et en SVG : aucun canevas de plus à peindre, aucun coût sur
 * la scène 3D qui, elle, occupe déjà le processeur graphique.
 */

import { useEffect, useRef, useState } from "react";
import type { Season } from "@farmsim/shared";

type Palette = {
  /** Haut du ciel, bas du ciel, brume d'horizon. */
  skyTop: string;
  skyBottom: string;
  haze: string;
  /** Astre : couleur et halo. */
  sun: string;
  sunGlow: string;
  /** Nuages, plus ou moins présents selon la saison. */
  cloud: string;
  cloudOpacity: number;
};

/**
 * Palettes.
 *
 * Le parti pris : on reste dans les tons clairs du jeu, on ne bascule pas
 * dans la nuit ni dans le sombre. Ce qui change, c'est la **température de
 * couleur** — un printemps vert tendre, un été franc, un automne cuivré, un
 * hiver bleuté et lavé. Assez pour reconnaître la saison d'un regard, pas
 * assez pour que la ferme cesse d'être lisible par-dessus.
 */
const PALETTES: Record<Season, Palette> = {
  SPRING: {
    skyTop: "#bfe6f5",
    skyBottom: "#eaf6e4",
    haze: "#d8f0c9",
    sun: "#ffe9a8",
    sunGlow: "rgba(255, 233, 168, 0.55)",
    cloud: "#ffffff",
    cloudOpacity: 0.75,
  },
  SUMMER: {
    skyTop: "#8fd4f0",
    skyBottom: "#f6efdd",
    haze: "#ffeec2",
    sun: "#ffd45e",
    sunGlow: "rgba(255, 212, 94, 0.6)",
    cloud: "#ffffff",
    cloudOpacity: 0.45,
  },
  AUTUMN: {
    skyTop: "#cfdcea",
    skyBottom: "#f7e3c4",
    haze: "#eccf9a",
    sun: "#f6b45a",
    sunGlow: "rgba(246, 180, 90, 0.5)",
    cloud: "#f3f1ec",
    cloudOpacity: 0.85,
  },
  WINTER: {
    skyTop: "#cfdae6",
    skyBottom: "#eef3f7",
    haze: "#e8eef4",
    // Un soleil d'hiver est bas et pâle : il éclaire, il ne chauffe pas.
    sun: "#fdf6e3",
    sunGlow: "rgba(253, 246, 227, 0.45)",
    cloud: "#ffffff",
    cloudOpacity: 0.9,
  },
};

/** Combien de temps dure le fondu d'une saison à l'autre. */
const CROSSFADE_MS = 1500;

function vars(p: Palette): Record<string, string> {
  return {
    "--sky-top": p.skyTop,
    "--sky-bottom": p.skyBottom,
    "--sky-haze": p.haze,
    "--sky-sun": p.sun,
    "--sky-sun-glow": p.sunGlow,
    "--sky-cloud": p.cloud,
    "--sky-cloud-opacity": String(p.cloudOpacity),
  };
}

type Props = {
  season: Season;
  /**
   * Neige et pluie viennent de la météo, pas de la saison : il neige en
   * hiver, mais pas tous les jours, et une averse d'été existe aussi.
   */
  weather?: string;
};

export function SeasonSky({ season, weather }: Props) {
  /**
   * Saison sortante, gardée le temps du fondu.
   *
   * Deux calques superposés : l'ancien s'efface pendant que le nouveau
   * apparaît. Sans cela le fond changerait d'un coup, et le passage
   * d'automne à hiver ressemblerait à un défaut d'affichage.
   */
  const [current, setCurrent] = useState(season);
  const [leaving, setLeaving] = useState<Season | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (season === current) return;
    setLeaving(current);
    setCurrent(season);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(null), CROSSFADE_MS);
    return () => window.clearTimeout(timer.current);
  }, [season, current]);

  const neige = weather === "SNOW";
  const pluie = weather === "RAIN" || weather === "STORM";

  return (
    <div className="season-sky" aria-hidden="true" data-season={current}>
      {leaving && (
        <div className="season-layer leaving" style={vars(PALETTES[leaving]) as never} />
      )}
      <div key={current} className="season-layer entering" style={vars(PALETTES[current]) as never}>
        <span className="sky-sun" />
        <span className="sky-cloud c1" />
        <span className="sky-cloud c2" />
        <span className="sky-cloud c3" />
      </div>
      {/* Précipitations : elles suivent la météo, pas le calendrier. */}
      {neige && <div className="sky-precip snow" />}
      {pluie && <div className="sky-precip rain" />}
    </div>
  );
}

/** Le nom de la saison, pour l'annonce du changement. */
export const SEASON_NAMES: Record<Season, string> = {
  SPRING: "Printemps",
  SUMMER: "Été",
  AUTUMN: "Automne",
  WINTER: "Hiver",
};
