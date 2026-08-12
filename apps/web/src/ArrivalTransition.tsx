import { useEffect } from "react";
import { GlobeView, type GlobeContinent } from "./GlobeView";

type Props = {
  continents: GlobeContinent[];
  continentCode: string | null;
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
    const t = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="arrival" role="status" aria-live="polite">
      <div className="arrival-globe">
        <GlobeView
          continents={continents}
          selected={continentCode}
          focus
          height={Math.min(420, Math.round(window.innerHeight * 0.5))}
        />
      </div>
      <p className="arrival-caption">
        <strong>{regionName}</strong>
        <span>{cityName ? `Approche de ${cityName}…` : "Approche de votre exploitation…"}</span>
      </p>
    </div>
  );
}
