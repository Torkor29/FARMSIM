import { useState } from "react";
import {
  GUIDE_CHAPTERS,
  evaluateObjectives,
  type GuideChapterId,
  type GuideSnapshot,
  type ObjectiveView,
} from "@farmsim/shared";

type Props = {
  open: boolean;
  snapshot: GuideSnapshot;
  onClose: () => void;
};

const TABS: { id: "goals" | GuideChapterId; label: string }[] = [
  { id: "goals", label: "Objectifs" },
  { id: "crops", label: "Cultiver" },
  { id: "soil", label: "Sol" },
  { id: "goods", label: "Vendre" },
  { id: "build", label: "Bâtir" },
  { id: "machines", label: "Machines" },
  { id: "herd", label: "Troupeau" },
  { id: "triangle", label: "Métiers" },
];

export function PlayGuide({ open, snapshot, onClose }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("goals");
  if (!open) return null;

  const goals = evaluateObjectives(snapshot);
  const current = goals.find((g) => g.current) ?? null;
  const chapter = GUIDE_CHAPTERS.find((c) => c.id === tab);

  return (
    <div className="guide-backdrop" role="dialog" aria-modal="true" aria-labelledby="guide-title">
      <div className="guide-sheet glass">
        <header className="guide-head">
          <div>
            <p className="guide-kicker">Toujours sous la main</p>
            <h2 id="guide-title">Guide de ferme</h2>
          </div>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Fermer">
            Fermer
          </button>
        </header>

        <nav className="guide-tabs" aria-label="Chapitres du guide">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "on" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="guide-body">
          {tab === "goals" ? (
            <GoalsPane goals={goals} current={current} />
          ) : (
            chapter && (
              <>
                <p className="guide-lead">{chapter.lead}</p>
                <ul className="guide-list">
                  {chapter.entries.map((e) => (
                    <li key={e.id} className={e.soon ? "soon" : ""}>
                      <strong>
                        {e.name}
                        {e.soon ? <em> Bientôt</em> : null}
                      </strong>
                      <span>{e.how}</span>
                      <small>{e.usedBy}</small>
                    </li>
                  ))}
                </ul>
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function GoalsPane({
  goals,
  current,
}: {
  goals: ObjectiveView[];
  current: ObjectiveView | null;
}) {
  const remaining = goals.filter((g) => !g.done).length;
  return (
    <>
      {current ? (
        <div className="guide-now">
          <p className="guide-kicker">Maintenant</p>
          <h3>{current.title}</h3>
          <p>{current.hint}</p>
          <p className="guide-unlock">Ensuite : {current.unlock}</p>
        </div>
      ) : (
        <div className="guide-now done">
          <h3>Vous tenez la ferme</h3>
          <p>Les chapitres ci-dessus détaillent chaque geste, y compris ce que les autres métiers produisent pour vous.</p>
        </div>
      )}
      <ol className="guide-goals">
        {goals.map((g) => (
          <li key={g.id} className={g.done ? "done" : g.current ? "current" : ""}>
            <span className="goal-mark" aria-hidden="true">
              {g.done ? "✓" : g.current ? "➤" : "○"}
            </span>
            <span>
              <strong>{g.title}</strong>
              <small>{g.done ? "Fait" : g.unlock}</small>
            </span>
          </li>
        ))}
      </ol>
      <p className="guide-foot">
        {remaining ? `${remaining} objectif(s) devant vous.` : "Tous les objectifs de départ sont faits."}{" "}
        Le recueil reste là : cultures, bâtiments, ce que l’éleveur achète au céréalier, les travaux chez le voisin.
      </p>
    </>
  );
}
