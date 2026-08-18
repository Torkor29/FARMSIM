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
    skyTop: "#9fd8ef",
    skyBottom: "#e6f6d8",
    haze: "#cdefb4",
    sun: "#ffe9a8",
    sunGlow: "rgba(255, 233, 168, 0.55)",
    cloud: "#ffffff",
    cloudOpacity: 0.75,
  },
  SUMMER: {
    // Un bleu franc, saturé, et une brume dorée sur l'horizon : c'est ce
    // qu'on doit reconnaître d'un coup d'œil, sans lire le mot « Été ».
    skyTop: "#4db4e8",
    skyBottom: "#ffeeb8",
    haze: "#ffd98a",
    sun: "#ffc93c",
    sunGlow: "rgba(255, 201, 60, 0.7)",
    cloud: "#ffffff",
    cloudOpacity: 0.35,
  },
  AUTUMN: {
    skyTop: "#b9c6d8",
    skyBottom: "#f2cf97",
    haze: "#e0a862",
    sun: "#ef9a42",
    sunGlow: "rgba(239, 154, 66, 0.55)",
    cloud: "#eae4d8",
    cloudOpacity: 0.9,
  },
  WINTER: {
    /* Les quatre palettes étaient quatre nuances du même bleu pâle : l'hiver
       et l'été ne se distinguaient « pas des masses », et c'était vrai — huit
       points de teinte les séparaient. L'hiver descend maintenant dans les
       gris-bleus froids, l'été monte dans les bleus saturés, et l'écart se
       voit sans qu'on ait à le chercher. */
    skyTop: "#8ea3b8",
    skyBottom: "#dfe8f0",
    haze: "#cfdae6",
    // Un soleil d'hiver est bas et pâle : il éclaire, il ne chauffe pas.
    sun: "#f4f7fb",
    sunGlow: "rgba(244, 247, 251, 0.4)",
    cloud: "#f4f8fc",
    cloudOpacity: 0.95,
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
