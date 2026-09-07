import { useEffect } from "react";
import { GlobeView, type GlobeContinent } from "./GlobeView";

type Props = {
  continents: GlobeContinent[];
  continentCode?: string | null;
  regionName: string;
  cityName: string;
  onDone: () => void;
};

/** Plongée depuis le globe jusqu'à la parcelle, à chaque retour en jeu. */
export function ArrivalTransition({
  continents,
  continentCode,
  regionName,
  cityName,
  onDone,
}: Props) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="arrival" role="status" aria-live="polite">
      <div className="arrival-globe">
        <GlobeView
          continents={continents}
          selected={continentCode}
          focus
          mode="arrival"
          height={Math.min(500, Math.round(window.innerHeight * 0.56))}
        />
      </div>
      <p className="arrival-caption">
        <small>VOYAGE VERS VOTRE MONDE</small>
        <strong>{regionName}</strong>
        <span>{cityName ? `Approche de ${cityName}…` : "Approche de votre exploitation…"}</span>
        <i aria-hidden="true"><b /></i>
      </p>
    </div>
  );
}
