import { useEffect, useState } from "react";

type SplashPhase = "fade-in" | "hold" | "fade-out";

type Props = {
  onComplete: () => void;
};

export function SplashScreen({ onComplete }: Props) {
  const [phase, setPhase] = useState<SplashPhase>("fade-in");
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [useTextLogo, setUseTextLogo] = useState(false);

  useEffect(() => {
    const raster = new Image();
    raster.onload = () => setLogoSrc("/logo.webp");
    raster.onerror = () => {
      const svg = new Image();
      svg.onload = () => setLogoSrc("/logo.svg");
      svg.onerror = () => setUseTextLogo(true);
      svg.src = "/logo.svg";
    };
    raster.src = "/logo.webp";
  }, []);

  useEffect(() => {
    const holdTimer = window.setTimeout(() => setPhase("hold"), 700);
    const fadeOutTimer = window.setTimeout(() => setPhase("fade-out"), 2000);
    const doneTimer = window.setTimeout(() => onComplete(), 2700);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(fadeOutTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen splash-${phase}`} aria-hidden="true">
      <div className="splash-bg" />
      <div className="splash-glow" />
      <div className="splash-content">
        {useTextLogo ? (
          <div className="splash-text-logo">
            <span className="splash-text-top">FARMING</span>
            <span className="splash-text-bottom">NAVIGATOR</span>
          </div>
        ) : logoSrc ? (
          <img className="splash-logo" src={logoSrc} alt="Farming Navigateur" draggable={false} />
        ) : (
          <div className="splash-logo-placeholder" />
        )}
      </div>
      <p className="splash-tagline">Élevage · Cultivation · Gestion</p>
    </div>
  );
}
