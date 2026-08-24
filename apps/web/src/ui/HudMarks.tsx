import type { ReactNode } from "react";
import type { Season, WeatherState } from "@farmsim/shared";

/**
 * Pictogrammes du bandeau — saison et météo.
 *
 * Au téléphone le mot « Gris » occupait une pastille entière sans rien dire
 * de plus qu'un nuage, et la saison n'existait que comme un point sur le
 * calendrier en bas. Un dessin de dix-huit pixels, la même couleur que le
 * texte, et on lit les deux d'un coup d'œil.
 */

type MarkProps = { className?: string };

function Mark({ className, children }: MarkProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function SeasonMark({ season, className }: MarkProps & { season: Season }) {
  if (season === "SUMMER") {
    return (
      <Mark className={className}>
        <circle cx="12" cy="12" r="3.4" />
        <path d="M12 3.2v1.8M12 19v1.8M3.2 12h1.8M19 12h1.8M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" />
      </Mark>
    );
  }
  if (season === "AUTUMN") {
    return (
      <Mark className={className}>
        <path d="M12 20.5c0 0-7-6.2-7-11.2 0-3.2 3.1-5 7-1.6 3.9-3.4 7-1.6 7 1.6 0 5-7 11.2-7 11.2z" />
        <path d="M12 20.5V8.2" />
      </Mark>
    );
  }
  if (season === "WINTER") {
    return (
      <Mark className={className}>
        <path d="M12 3.2v17.6M5.2 7.2l13.6 9.6M5.2 16.8 18.8 7.2" />
      </Mark>
    );
  }
  return (
    <Mark className={className}>
      <path d="M12 20.5V9.5" />
      <path d="M12 9.5c-3.2.2-5.2-2.4-4.2-5.3 3.4 1.3 4.2 5.3 4.2 5.3" />
      <path d="M12 11.2c3-.4 5.1-3 4-5.8" />
    </Mark>
  );
}

export function WeatherMark({ weather, className }: MarkProps & { weather: WeatherState }) {
  if (weather === "CLEAR") {
    return (
      <Mark className={className}>
        <circle cx="12" cy="12" r="3.4" />
        <path d="M12 3.2v1.8M12 19v1.8M3.2 12h1.8M19 12h1.8M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3" />
      </Mark>
    );
  }
  if (weather === "RAIN") {
    return (
      <Mark className={className}>
        <path d="M7.2 15.2h9.2a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.2A3.6 3.6 0 0 0 7.2 15.2z" />
        <path d="M9.2 17.6v1.8M12 17.2v2.4M14.8 17.6v1.8" />
      </Mark>
    );
  }
  if (weather === "STORM") {
    return (
      <Mark className={className}>
        <path d="M7.2 14.2h9.2a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.2A3.6 3.6 0 0 0 7.2 14.2z" />
        <path d="m11 14.5 2.2 3h-2.4L13 21" />
      </Mark>
    );
  }
  if (weather === "SNOW") {
    return (
      <Mark className={className}>
        <path d="M7.2 14.6h9.2a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.2A3.6 3.6 0 0 0 7.2 14.6z" />
        <path d="M9.4 17.6v.2M12 18.4v.2M14.6 17.6v.2" />
      </Mark>
    );
  }
  return (
    <Mark className={className}>
      <path d="M7.2 16h9.2a3.4 3.4 0 0 0 .4-6.8 5 5 0 0 0-9.6-1.2A3.6 3.6 0 0 0 7.2 16z" />
    </Mark>
  );
}
