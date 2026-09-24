import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  BREAKDOWN_LABELS,
  GREASE_POINTS,
  MACHINE_ART,
  REPAIR_PARTS,
  REPAIR_RESTORE,
  type BreakdownKind,
  type MachineType,
} from "@farmsim/shared";
import { jouerSon } from "./audio";
import { SEUIL_PROPRE, ZONE_GRAISSE, etoilesGraissage, etoilesLavage } from "./atelier-notes";
import { Portail } from "./ui/Portail";

export type CareMode = "grease" | "clean" | "repair";

type Props = {
  mode: CareMode;
  machineName: string;
  machineType: MachineType;
  kind?: BreakdownKind;
  busy?: boolean;
  onCancel: () => void;
  onDone: () => void;
};

/**
 * Mini-jeux d'atelier : graisser, laver, changer des pièces.
 *
 * Le graissage et le lavage se résumaient à toucher des ronds posés sur
 * l'image — « j'aimerais refaire le jeu de dégraissage et l'autre pour un truc
 * un peu plus sympa ». Ils deviennent des gestes :
 *
 * - **la pompe à graisse** : on appuie, la jauge monte au rythme de la pompe,
 *   on relâche dans le vert. Trop peu, le graisseur reste sec ; trop, la
 *   graisse déborde et il faut l'essuyer ;
 * - **le nettoyeur haute pression** : l'engin est couvert de boue, on la
 *   décape au doigt comme un ticket à gratter, jusqu'à ce qu'il brille.
 *
 * La note (une à trois étoiles) est un plaisir, pas une règle : elle ne change
 * rien à ce que l'entretien rapporte.
 */
export function MachineCareOverlay({
  mode,
  machineName,
  machineType,
  kind = "BELT",
  busy = false,
  onCancel,
  onDone,
}: Props) {
  const art = MACHINE_ART[machineType];
  const parts = REPAIR_PARTS[kind];
  const ordered = REPAIR_RESTORE[kind].ordered;

  const [fitted, setFitted] = useState<boolean[]>(() => parts.map(() => false));
  const [nextOrdered, setNextOrdered] = useState(0);
  const [shake, setShake] = useState(false);
  /** Étoiles obtenues au graissage ou au lavage — `null` tant que ce n'est pas fini. */
  const [etoiles, setEtoiles] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const title =
    mode === "grease"
      ? "Graisser"
      : mode === "clean"
        ? "Laver au karcher"
        : `Réparer — ${BREAKDOWN_LABELS[kind]}`;

  const hint =
    mode === "grease"
      ? "Maintenez la pompe appuyée, relâchez quand la jauge est dans le vert."
      : mode === "clean"
        ? "Passez le jet sur la boue jusqu'à ce que l'engin brille."
        : ordered
          ? "Posez les pièces dans l'ordre, puis testez."
          : "Posez toutes les pièces, puis testez.";

  const repairDone = fitted.every(Boolean);
  const canFinish = mode === "repair" ? repairDone : etoiles !== null;

  const fini = useCallback((n: number) => {
    setEtoiles(n);
    jouerSon(n >= 3 ? "niveau" : "piece");
  }, []);

  function tapPart(i: number) {
    if (fitted[i]) return;
    if (ordered && i !== nextOrdered) {
      setShake(true);
      window.setTimeout(() => setShake(false), 280);
      return;
    }
    setFitted((prev) => prev.map((v, k) => (k === i ? true : v)));
    if (ordered) setNextOrdered(i + 1);
  }

  function finish() {
    if (!canFinish || busy) return;
    onDone();
  }

  return (
    <Portail>
      <div
        className="care-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-title"
        onClick={onCancel}
      >
        <div
          className={`care-card glass${shake ? " care-shake" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="care-title">{title}</h3>
          <p className="care-machine">{machineName}</p>
          <p className="muted tiny">{hint}</p>
          {mode === "grease" && <PompeAGraisse art={art} onFini={fini} />}
          {mode === "clean" && <Karcher art={art} onFini={fini} />}
          {mode === "repair" && (
            <>
              <div className="care-stage">
                <img src={art} alt="" draggable={false} />
              </div>
              <ol className="care-parts">
                {parts.map((name, i) => (
                  <li key={name}>
                    <button
                      type="button"
                      className={fitted[i] ? "done" : ""}
                      disabled={fitted[i]}
                      onClick={() => tapPart(i)}
                    >
                      {ordered ? `${i + 1}. ` : ""}
                      {name}
                      {fitted[i] ? " ✓" : ""}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {etoiles !== null && (
            <p className="care-note" role="status">
              <span className="care-etoiles" aria-label={`${etoiles} étoile${etoiles > 1 ? "s" : ""} sur 3`}>
                {[1, 2, 3].map((k) => (
                  <span key={k} className={k <= etoiles ? "on" : ""} aria-hidden="true">
                    ★
                  </span>
                ))}
              </span>
              {mode === "grease"
                ? etoiles >= 3
                  ? "Graissage parfait !"
                  : etoiles === 2
                    ? "Bien graissé."
                    : "Graissé — la main tremblait un peu."
                : etoiles >= 3
                  ? "Comme neuf !"
                  : etoiles === 2
                    ? "Propre."
                    : "Propre, enfin."}
            </p>
          )}
          <div className="confirm-actions">
            <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
              Annuler
            </button>
            <button type="button" disabled={busy || !canFinish} onClick={finish}>
              {mode === "repair" ? "Tester" : "C'est bon"}
            </button>
          </div>
        </div>
      </div>
    </Portail>
  );
}

/* ------------------------------------------------------------------ */
/* La pompe à graisse                                                  */
/* ------------------------------------------------------------------ */

/** Un coup de pompe toutes les 150 ms, qui fait monter la jauge d'autant. */
const COUP_MS = 150;
const COUP = 0.075;

type Graisseur = "ok" | "essuye" | null;

function PompeAGraisse({ art, onFini }: { art: string; onFini: (etoiles: number) => void }) {
  const [actif, setActif] = useState(0);
  const [niveau, setNiveau] = useState(0);
  const [appui, setAppui] = useState(false);
  const [faits, setFaits] = useState<Graisseur[]>(() => GREASE_POINTS.map(() => null));
  const [rates, setRates] = useState(0);
  const [message, setMessage] = useState<{ texte: string; ton: "ok" | "ko" } | null>(null);
  /** Le graisseur qui déborde et qu'il faut essuyer avant de continuer. */
  const [debord, setDebord] = useState<number | null>(null);
  const [essuyage, setEssuyage] = useState(0);
  const niveauRef = useRef(0);
  const pompe = useRef<number | null>(null);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const termine = actif >= GREASE_POINTS.length;

  const suivant = useCallback(
    (resultat: Graisseur, ratesFinal: number) => {
      setFaits((prev) => prev.map((v, k) => (k === actif ? resultat : v)));
      niveauRef.current = 0;
      setNiveau(0);
      const prochain = actif + 1;
      setActif(prochain);
      if (prochain >= GREASE_POINTS.length) onFini(etoilesGraissage(ratesFinal));
    },
    [actif, onFini],
  );

  const arreter = useCallback(() => {
    if (pompe.current !== null) {
      window.clearInterval(pompe.current);
      pompe.current = null;
    }
  }, []);

  const deborder = useCallback(() => {
    arreter();
    setAppui(false);
    setDebord(actif);
    setEssuyage(0);
    setRates((r) => r + 1);
    setMessage({ texte: "Trop ! Ça déborde — essuyez la graisse.", ton: "ko" });
    jouerSon("refus");
  }, [actif, arreter]);

  const presser = useCallback(() => {
    if (termine || debord !== null || pompe.current !== null) return;
    setAppui(true);
    setMessage(null);
    const coup = () => {
      niveauRef.current = Math.min(1, niveauRef.current + COUP + Math.random() * 0.02);
      setNiveau(niveauRef.current);
      jouerSon("clic");
      if (niveauRef.current >= 1) deborder();
    };
    coup();
    pompe.current = window.setInterval(coup, COUP_MS);
  }, [termine, debord, deborder]);

  const relacher = useCallback(() => {
    if (pompe.current === null) return;
    arreter();
    setAppui(false);
    const n = niveauRef.current;
    if (n < ZONE_GRAISSE.min) {
      setRates((r) => r + 1);
      setMessage({ texte: "Pas assez : le graisseur est resté sec. Recommencez.", ton: "ko" });
      niveauRef.current = 0;
      setNiveau(0);
      jouerSon("refus");
    } else if (n <= ZONE_GRAISSE.max) {
      setMessage({ texte: "Pile ce qu'il faut.", ton: "ok" });
      jouerSon("piece");
      suivant("ok", rates);
    } else {
      deborder();
    }
  }, [arreter, deborder, rates, suivant]);

  // Relâcher n'importe où compte : le doigt glisse souvent hors du bouton.
  useEffect(() => {
    window.addEventListener("pointerup", relacher);
    window.addEventListener("pointercancel", relacher);
    return () => {
      window.removeEventListener("pointerup", relacher);
      window.removeEventListener("pointercancel", relacher);
    };
  }, [relacher]);
  useEffect(() => arreter, [arreter]);

  function essuyer(e: ReactPointerEvent) {
    if (debord === null) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      dernier.current = null;
      return;
    }
    const p = { x: e.clientX, y: e.clientY };
    if (dernier.current) {
      const d = Math.hypot(p.x - dernier.current.x, p.y - dernier.current.y);
      const total = Math.min(1, essuyage + d / 260);
      setEssuyage(total);
      if (total >= 1) {
        setDebord(null);
        setMessage({ texte: "Essuyé. Au suivant.", ton: "ok" });
        dernier.current = null;
        suivant("essuye", rates);
        return;
      }
    }
    dernier.current = p;
  }

  const zoneG = `${ZONE_GRAISSE.min * 100}%`;
  const zoneL = `${(ZONE_GRAISSE.max - ZONE_GRAISSE.min) * 100}%`;

  return (
    <>
      <div className="care-stage">
        <img src={art} alt="" draggable={false} />
        {GREASE_POINTS.map((p, i) => (
          <button
            key={`g${i}`}
            type="button"
            className={`care-nipple${faits[i] ? " done" : ""}${i === actif && !termine ? " actif" : ""}${
              appui && i === actif ? " pompe" : ""
            }`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={`Graisseur ${i + 1}${faits[i] ? " — fait" : ""}`}
            onPointerDown={(e) => {
              if (i !== actif) return;
              e.preventDefault();
              presser();
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
        ))}
        {debord !== null && (
          <div
            className="care-debord"
            style={{
              left: `${GREASE_POINTS[debord]!.x}%`,
              top: `${GREASE_POINTS[debord]!.y}%`,
              opacity: 1 - essuyage * 0.85,
            }}
            onPointerDown={(e) => {
              dernier.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={essuyer}
          >
            <span>Essuyez</span>
          </div>
        )}
      </div>
      <div className="care-jauge" aria-label={`Graisse ${Math.round(niveau * 100)} %`}>
        <span className="care-jauge-vert" style={{ left: zoneG, width: zoneL }} />
        <span
          className={`care-jauge-niveau${niveau > ZONE_GRAISSE.max ? " trop" : niveau >= ZONE_GRAISSE.min ? " bon" : ""}`}
          style={{ width: `${niveau * 100}%` }}
        />
      </div>
      <p className={`care-message${message ? ` ${message.ton}` : ""}`} aria-live="polite">
        {message?.texte ??
          (termine
            ? "Tous les graisseurs sont faits."
            : `Graisseur ${actif + 1} sur ${GREASE_POINTS.length}`)}
      </p>
      <button
        type="button"
        className={`care-pompe${appui ? " on" : ""}`}
        disabled={termine || debord !== null}
        onPointerDown={(e) => {
          e.preventDefault();
          presser();
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            presser();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") relacher();
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg viewBox="0 0 48 24" aria-hidden="true">
          <path d="M4 9h22v6H4z" />
          <path d="M26 7h8l3 5-3 5h-8z" />
          <path d="M37 11h8v2h-8z" />
          <path d="M12 15l-3 8h6l2-8z" />
        </svg>
        {debord !== null ? "Essuyez d'abord" : appui ? "Tchk… tchk…" : "Maintenir pour pomper"}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Le nettoyeur haute pression                                         */
/* ------------------------------------------------------------------ */

const BOUES = ["#6b4a2b", "#7a5533", "#5a3d22", "#8a6a44", "#654427"];

function Karcher({ art, onFini }: { art: string; onFini: (etoiles: number) => void }) {
  const scene = useRef<HTMLDivElement>(null);
  const toile = useRef<HTMLCanvasElement>(null);
  const total = useRef(0);
  const debut = useRef<number | null>(null);
  const dernier = useRef<{ x: number; y: number } | null>(null);
  const derniereMesure = useRef(0);
  const derniereGoutte = useRef(0);
  const [propre, setPropre] = useState(0);
  const [fini, setFini] = useState(false);
  const [jet, setJet] = useState<{ x: number; y: number } | null>(null);
  const [gouttes, setGouttes] = useState<{ id: number; x: number; y: number; dx: number }[]>([]);
  const compteur = useRef(0);

  /** La part de boue qui reste, sur un pixel sur quatre. */
  const mesurer = useCallback((): number => {
    const c = toile.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !c.width || !c.height) return 0;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 16) if (data[i]! > 40) n++;
    return n;
  }, []);

  // La boue, posée une fois : des plaques et des éclaboussures sur l'engin,
  // plus denses en bas, là où les roues l'ont prise.
  useEffect(() => {
    const c = toile.current;
    const s = scene.current;
    const ctx = c?.getContext("2d");
    if (!c || !s || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(s.clientWidth * dpr));
    const h = Math.max(1, Math.round(s.clientHeight * dpr));
    c.width = w;
    c.height = h;
    const cx = w / 2;
    const cy = h * 0.55;
    const rx = w * 0.44;
    const ry = h * 0.34;
    for (let i = 0; i < 170; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      const x = cx + Math.cos(a) * r * rx;
      // Plus de boue vers le bas : on tire la moitié des plaques dans la moitié inférieure.
      const bas = i % 2 === 0 ? Math.abs(Math.sin(a)) : Math.sin(a);
      const y = cy + bas * r * ry;
      const rayon = w * (0.035 + Math.random() * 0.07);
      ctx.globalAlpha = 0.82 + Math.random() * 0.16;
      ctx.fillStyle = BOUES[i % BOUES.length]!;
      ctx.beginPath();
      ctx.ellipse(x, y, rayon, rayon * (0.6 + Math.random() * 0.5), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Les éclaboussures sèches, plus claires, pour que ce ne soit pas un aplat.
    for (let i = 0; i < 260; i++) {
      const x = cx + (Math.random() * 2 - 1) * rx * 1.05;
      const y = cy + (Math.random() * 2 - 1) * ry * 1.1;
      ctx.globalAlpha = 0.5 + Math.random() * 0.4;
      ctx.fillStyle = i % 3 ? "#a3845a" : "#4a321b";
      ctx.beginPath();
      ctx.arc(x, y, w * (0.004 + Math.random() * 0.012), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    total.current = mesurer();
  }, [mesurer]);

  function decaper(e: ReactPointerEvent<HTMLDivElement>) {
    if (fini) return;
    const s = scene.current;
    const c = toile.current;
    const ctx = c?.getContext("2d");
    if (!s || !c || !ctx) return;
    const r = s.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setJet({ x, y });
    if (e.pointerType === "mouse" && e.buttons === 0) {
      dernier.current = null;
      return;
    }
    if (debut.current === null) debut.current = performance.now();
    const k = c.width / r.width;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = c.width * 0.12;
    ctx.beginPath();
    const de = dernier.current ?? { x, y };
    ctx.moveTo(de.x * k, de.y * k);
    ctx.lineTo(x * k + 0.01, y * k);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    dernier.current = { x, y };

    const maintenant = performance.now();
    // Les gouttelettes : quelques-unes à la fois, jamais une averse.
    if (maintenant - derniereGoutte.current > 45) {
      derniereGoutte.current = maintenant;
      const id = ++compteur.current;
      setGouttes((g) => [...g.slice(-14), { id, x, y, dx: (Math.random() - 0.5) * 60 }]);
      window.setTimeout(() => setGouttes((g) => g.filter((d) => d.id !== id)), 650);
    }
    if (maintenant - derniereMesure.current > 200 && total.current > 0) {
      derniereMesure.current = maintenant;
      const part = 1 - mesurer() / total.current;
      setPropre(part);
      if (part >= SEUIL_PROPRE) {
        setFini(true);
        setJet(null);
        const secondes = (maintenant - (debut.current ?? maintenant)) / 1000;
        onFini(etoilesLavage(secondes));
      }
    }
  }

  const affiche = Math.min(1, propre / SEUIL_PROPRE);

  return (
    <>
      <div
        ref={scene}
        className={`care-stage care-karcher${fini ? " fini" : ""}`}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          dernier.current = null;
          decaper(e);
        }}
        onPointerMove={decaper}
        onPointerUp={() => {
          dernier.current = null;
          setJet(null);
        }}
        onPointerLeave={() => setJet(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <img src={art} alt="" draggable={false} />
        <canvas ref={toile} className="care-boue" aria-hidden="true" />
        {fini && <span className="care-brille" aria-hidden="true" />}
        {jet && !fini && (
          <span className="care-jet" style={{ left: jet.x, top: jet.y }} aria-hidden="true" />
        )}
        {gouttes.map((g) => (
          <span
            key={g.id}
            className="care-goutte"
            style={{ left: g.x, top: g.y, ["--dx" as string]: `${g.dx}px` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="care-jauge propre" aria-label={`Propreté ${Math.round(affiche * 100)} %`}>
        <span className="care-jauge-niveau bon" style={{ width: `${affiche * 100}%` }} />
      </div>
      <p className={`care-message${fini ? " ok" : ""}`} aria-live="polite">
        {fini ? "Il brille." : `Propreté ${Math.round(affiche * 100)} %`}
      </p>
    </>
  );
}
