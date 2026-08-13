import { useEffect, useMemo, useState } from "react";
import {
  BREAKDOWN_LABELS,
  DUST_POINTS,
  GREASE_POINTS,
  MACHINE_ART,
  MUD_POINTS,
  REPAIR_PARTS,
  REPAIR_RESTORE,
  type BreakdownKind,
  type MachineType,
} from "@farmsim/shared";

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
 * Mini-jeux d'atelier : graisser, souffler/laver, changer des pièces.
 * Même écran, plus ou moins de gestes selon la panne.
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

  const [greased, setGreased] = useState<boolean[]>(() => GREASE_POINTS.map(() => false));
  const [dust, setDust] = useState<boolean[]>(() => DUST_POINTS.map(() => true));
  const [mud, setMud] = useState<boolean[]>(() => MUD_POINTS.map(() => true));
  const [cleanPhase, setCleanPhase] = useState<"blow" | "wash">("blow");
  const [fitted, setFitted] = useState<boolean[]>(() => parts.map(() => false));
  const [nextOrdered, setNextOrdered] = useState(0);
  const [shake, setShake] = useState(false);

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
        ? cleanPhase === "blow"
          ? "Souffler la poussière"
          : "Laver les taches"
        : `Réparer — ${BREAKDOWN_LABELS[kind]}`;

  const hint =
    mode === "grease"
      ? "Touchez chaque point d'huile."
      : mode === "clean" && cleanPhase === "blow"
        ? "Passez le doigt sur la poussière."
        : mode === "clean"
          ? "Touchez chaque tache de boue."
          : ordered
            ? "Posez les pièces dans l'ordre, puis testez."
            : "Posez toutes les pièces, puis testez.";

  const greaseDone = greased.every(Boolean);
  const blowDone = dust.every((d) => !d);
  const washDone = mud.every((d) => !d);
  const repairDone = fitted.every(Boolean);

  const canFinish = useMemo(() => {
    if (mode === "grease") return greaseDone;
    if (mode === "clean") return washDone;
    return repairDone;
  }, [mode, greaseDone, washDone, repairDone]);

  function tapGrease(i: number) {
    setGreased((prev) => prev.map((v, k) => (k === i ? true : v)));
  }

  function clearDust(i: number) {
    setDust((prev) => prev.map((v, k) => (k === i ? false : v)));
  }

  function clearMud(i: number) {
    setMud((prev) => prev.map((v, k) => (k === i ? false : v)));
  }

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
    if (mode === "clean" && cleanPhase === "blow") {
      if (!blowDone) return;
      setCleanPhase("wash");
      return;
    }
    if (!canFinish || busy) return;
    onDone();
  }

  return (
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
        <div
          className="care-stage"
          onPointerMove={(e) => {
            if (mode !== "clean" || cleanPhase !== "blow" || e.buttons === 0) return;
            const t = e.target as HTMLElement;
            const i = t.dataset.dust;
            if (i != null) clearDust(Number(i));
          }}
        >
          <img src={art} alt="" draggable={false} />
          {mode === "grease" &&
            GREASE_POINTS.map((p, i) => (
              <button
                key={`g${i}`}
                type="button"
                className={`care-nipple${greased[i] ? " done" : ""}`}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                aria-label={`Point de graisse ${i + 1}`}
                onClick={() => tapGrease(i)}
              />
            ))}
          {mode === "clean" &&
            cleanPhase === "blow" &&
            DUST_POINTS.map((p, i) =>
              dust[i] ? (
                <span
                  key={`d${i}`}
                  data-dust={i}
                  className="care-dust"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  onPointerDown={() => clearDust(i)}
                />
              ) : null,
            )}
          {mode === "clean" &&
            cleanPhase === "wash" &&
            MUD_POINTS.map((p, i) =>
              mud[i] ? (
                <button
                  key={`m${i}`}
                  type="button"
                  className="care-mud"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  aria-label={`Tache ${i + 1}`}
                  onClick={() => clearMud(i)}
                />
              ) : null,
            )}
        </div>
        {mode === "repair" && (
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
        )}
        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
          <button
            type="button"
            disabled={
              busy ||
              (mode === "grease" && !greaseDone) ||
              (mode === "clean" && cleanPhase === "blow" && !blowDone) ||
              (mode === "clean" && cleanPhase === "wash" && !washDone) ||
              (mode === "repair" && !repairDone)
            }
            onClick={finish}
          >
            {mode === "clean" && cleanPhase === "blow"
              ? "Laver"
              : mode === "repair"
                ? "Tester"
                : "C'est bon"}
          </button>
        </div>
      </div>
    </div>
  );
}
