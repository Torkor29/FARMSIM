import { useMemo, useState, type PointerEvent as ReactPointerEvent } from "react";
import { WORK_LABELS, type FarmWork } from "@farmsim/shared";

export type MissionPlayContract = {
  id: string;
  title: string;
  jobType: string;
  rewardCrd: number;
  regionNote: string;
  cells: number;
  work: FarmWork;
  machineType?: string;
};

type Props = {
  contract: MissionPlayContract;
  busy?: boolean;
  onCancel: () => void;
  onDone: () => void;
};

function colsFor(n: number): number {
  if (n <= 8) return 4;
  if (n <= 12) return 4;
  if (n <= 18) return 6;
  return 8;
}

/**
 * Mini-jeu de chantier : glisser sur les cases du voisin.
 * Ce n'est pas un clic « Faire » — le fer idle doit vraiment passer.
 */
export function MissionPlay({ contract, busy = false, onCancel, onDone }: Props) {
  const total = Math.max(1, contract.cells);
  const cols = colsFor(total);
  const [done, setDone] = useState<boolean[]>(() => Array.from({ length: total }, () => false));

  const finished = done.every(Boolean);
  const progress = done.filter(Boolean).length;

  const workClass = useMemo(() => {
    const w = contract.work;
    if (w === "HARVEST") return "harvest";
    if (w === "PLANT") return "plant";
    if (w === "FERTILIZE") return "ferti";
    if (w === "PLOW") return "plow";
    return "stubble";
  }, [contract.work]);

  function paint(i: number) {
    setDone((prev) => {
      if (prev[i]) return prev;
      const next = prev.slice();
      next[i] = true;
      return next;
    });
  }

  function onGridPointer(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.buttons === 0 && e.pointerType !== "touch") return;
    const t = e.target as HTMLElement;
    const i = t.dataset.cell;
    if (i != null) paint(Number(i));
  }

  return (
    <div className="care-backdrop" role="dialog" aria-modal="true" aria-labelledby="mission-title">
      <div className="care-card glass mission-card" onClick={(e) => e.stopPropagation()}>
        <h3 id="mission-title">{contract.title}</h3>
        <p className="care-machine">
          {WORK_LABELS[contract.work]} · {contract.rewardCrd} TRN
        </p>
        <p className="muted tiny">
          Glissez sur les cases. Un travail à la fois — vos cultures poussent chez vous.
        </p>
        <div className="mission-progress" aria-live="polite">
          {progress} / {total}
        </div>
        <div
          className={`mission-grid ${workClass}`}
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          onPointerDown={onGridPointer}
          onPointerMove={onGridPointer}
        >
          {done.map((ok, i) => (
            <button
              key={i}
              type="button"
              data-cell={i}
              className={`mission-cell${ok ? " done" : ""}`}
              aria-label={ok ? `Case ${i + 1} faite` : `Case ${i + 1}`}
              onClick={() => paint(i)}
            />
          ))}
        </div>
        <div className="care-actions">
          <button type="button" onClick={onCancel} disabled={busy}>
            Laisser
          </button>
          <button type="button" className="go" disabled={!finished || busy} onClick={onDone}>
            Encaisser {contract.rewardCrd} TRN
          </button>
        </div>
      </div>
    </div>
  );
}
