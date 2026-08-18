/**
 * Ciel saisonnier — le fond de la ferme.
 *
 * Le fond était un dégradé fixe, le même toute l'année : deux couleurs
 * codées en dur derrière la scène 3D. La saison était pourtant déjà calculée
 * et déjà écrite dans le rail (« Saison · Été »), mais rien ne la donnait à
 * *voir*. On lisait la saison, on ne la sentait jamais.
 *
 * Quatre choses ici, et rien de plus :
 *
 * - une palette par saison, du ciel au sol ;
 * - un astre et quelques nuages, qui changent d'allure avec elle ;
 * - **un motif propre à chaque saison** : pétales qui montent, chaleur qui
 *   tremble, feuilles qui tombent, poudreuse qui descend ;
 * - une transition d'une seconde et demie au changement de saison, pour que
 *   le passage se remarque sans interrompre la partie.
 *
 * Le motif est venu après coup, et c'est lui qui règle vraiment la question.
 * Quatre palettes ne suffisaient pas : le printemps et l'hiver ont tous deux
 * un ciel bleu clair, et la teinte seule demande qu'on compare — or on ne
 * compare pas, on regarde. Un mouvement, lui, se reconnaît sans réfléchir :
 * ce qui monte n'est pas ce qui tombe.
 *
 * Tout est en CSS : aucun canevas de plus à peindre, aucun coût sur la scène
 * 3D qui, elle, occupe déjà le processeur graphique. Les motifs n'animent que
 * `transform` et `opacity` — les deux seules propriétés que le compositeur
 * traite sans repasser par la mise en page.
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
    /* Un ciel lavé de pluie et un horizon vert tendre : le printemps se
       reconnaît par le bas, là où tout reverdit. */
    skyTop: "#7ec8e8",
    skyBottom: "#dcf3bf",
    haze: "#b6e893",
    sun: "#fff0b4",
    sunGlow: "rgba(255, 240, 180, 0.6)",
    cloud: "#ffffff",
    cloudOpacity: 0.8,
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
       voit sans qu'on ait à le chercher.

       Deuxième passe : la couleur seule ne suffisait toujours pas, parce que
       le printemps et l'hiver partagent un ciel bleu clair. Chaque saison a
       donc reçu un **motif** — pétales, chaleur, feuilles, neige — et c'est
       lui qu'on reconnaît avant la teinte. L'hiver vire ici au gris violacé,
       qui n'appartient qu'à lui. */
    skyTop: "#8497ad",
    skyBottom: "#e2e6ee",
    haze: "#c9d2e0",
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
        <Motif season={current} />
      </div>
      {/* Précipitations : elles suivent la météo, pas le calendrier. */}
      {neige && <div className="sky-precip snow" />}
      {pluie && <div className="sky-precip rain" />}
    </div>
  );
}

/**
 * Le motif de la saison.
 *
 * Deux nappes tuilées qui glissent à des vitesses différentes suffisent à
 * donner de la profondeur, pour deux éléments seulement — c'est ce qui permet
 * de faire tomber cinquante feuilles sans poser cinquante nœuds. Les quelques
 * pièces « de premier plan » qui s'y ajoutent, elles, tournent sur
 * elles-mêmes : une nappe ne sait pas faire tourbillonner une feuille.
 */
function Motif({ season }: { season: Season }) {
  if (season === "SPRING") {
    return (
      <>
        {/* Ce qui monte : pétales et graines portés par l'air tiède. */}
        <span className="sky-drift petals lente" />
        <span className="sky-drift petals vive" />
        <span className="sky-bird b1" />
        <span className="sky-bird b2" />
      </>
    );
  }
  if (season === "SUMMER") {
    return (
      <>
        {/* Ce qui tremble : l'air chaud au ras de l'horizon, et l'éclat du
            soleil qui bat lentement. Aucune particule — un ciel d'été est
            vide, c'est justement ce qui le désigne. */}
        <span className="sky-heat" />
        <span className="sky-glare" />
      </>
    );
  }
  if (season === "AUTUMN") {
    return (
      <>
        {/* Ce qui tombe, et de travers : le vent d'automne pousse vers la
            gauche pendant que les feuilles descendent. */}
        <span className="sky-drift leaves lente" />
        <span className="sky-drift leaves vive" />
        <span className="sky-leaf f1" />
        <span className="sky-leaf f2" />
        <span className="sky-leaf f3" />
      </>
    );
  }
  return (
    <>
      {/* Ce qui descend tout droit : la poudreuse d'un jour sans vent. Elle
          existe même par beau temps — c'est l'hiver, pas la météo. */}
      <span className="sky-drift flakes lente" />
      <span className="sky-drift flakes vive" />
      <span className="sky-frost" />
    </>
  );
}

/** Le nom de la saison, pour l'annonce du changement. */
export const SEASON_NAMES: Record<Season, string> = {
  SPRING: "Printemps",
  SUMMER: "Été",
  AUTUMN: "Automne",
  WINTER: "Hiver",
};
