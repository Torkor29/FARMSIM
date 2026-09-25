import { useCallback, useEffect, useState } from "react";
import {
  BREAKDOWN_LABELS,
  MACHINE_ART,
  REPAIR_PARTS,
  REPAIR_RESTORE,
  type BreakdownKind,
  type MachineType,
} from "@farmsim/shared";
import { JeuGraissage, JeuLavage } from "./AtelierJeux";
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
 * Le graissage et le lavage sont deux petites scènes d'arcade — la roue à
 * graisser et la station de lavage, voir `AtelierJeux.tsx`. La note (une à
 * trois étoiles) est un plaisir, pas une règle : elle ne change rien à ce que
 * l'entretien rapporte.
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
        ? "Station de lavage"
        : `Réparer — ${BREAKDOWN_LABELS[kind]}`;

  const hint =
    mode === "grease"
      ? "Touchez quand un graisseur rouge passe sous le pistolet. La roue accélère !"
      : mode === "clean"
        ? "Maintenez et visez la boue avec le jet : la boue sèche résiste plus longtemps."
        : ordered
          ? "Posez les pièces dans l'ordre, puis testez."
          : "Posez toutes les pièces, puis testez.";

  const repairDone = fitted.every(Boolean);
  const canFinish = mode === "repair" ? repairDone : etoiles !== null;

  // Le son de la fin, la scène le joue déjà : ici, on retient la note.
  const fini = useCallback((n: number) => setEtoiles(n), []);

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
          {mode === "grease" && <JeuGraissage onFini={fini} />}
          {mode === "clean" && <JeuLavage onFini={fini} />}
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
