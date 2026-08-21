import { useState } from "react";
import {
  GUIDE_CHAPTERS,
  evaluateObjectives,
  levelProgress,
  levelUnlocks,
  xpForLevel,
  type GuideChapterId,
  type GuideSnapshot,
  type ObjectiveView,
} from "@farmsim/shared";

type Props = {
  open: boolean;
  snapshot: GuideSnapshot;
  /** Expérience cumulée du joueur, pour situer les paliers */
  xp?: number;
  onClose: () => void;
};

/*
 * Les compétences ont quitté ce recueil.
 *
 * Elles n'y étaient pas à leur place : le guide se **consulte** — comment on
 * sème, ce que l'éleveur achète au céréalier — tandis que l'arbre est un état
 * de la partie, qu'on suit. Et la fenêtre du guide, large de 560 px pour une
 * colonne de texte, écrasait quatre branches côte à côte. Elles ont désormais
 * leur propre écran, appelé depuis le milieu du bandeau : voir `SkillsScreen`.
 */
const TABS: { id: "goals" | "levels" | GuideChapterId; label: string }[] = [
  { id: "goals", label: "Objectifs" },
  { id: "levels", label: "Niveaux" },
  { id: "crops", label: "Cultiver" },
  { id: "soil", label: "Sol" },
  { id: "goods", label: "Vendre" },
  { id: "build", label: "Bâtir" },
  { id: "machines", label: "Machines" },
  { id: "herd", label: "Troupeau" },
  { id: "triangle", label: "Métiers" },
];

export function PlayGuide({ open, snapshot, xp = 0, onClose }: Props) {
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
          ) : tab === "levels" ? (
            <LevelsPane xp={xp} />
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

/**
 * Ce que chaque palier ouvre — la réponse à « on ne sait pas ce que le niveau
 * donne ».
 *
 * La table n'est pas recopiée à la main : `levelUnlocks()` la **dérive** des
 * paliers de parcelle et de bâtiment. Si une règle bouge, cette page bouge
 * avec elle, au lieu de mentir poliment.
 */
function LevelsPane({ xp }: { xp: number }) {
  const here = levelProgress(xp);
  const unlocks = levelUnlocks();
  const next = unlocks.find((u) => u.level > here.level) ?? null;

  return (
    <>
      <div className="guide-now">
        <p className="guide-kicker">Vous êtes</p>
        <h3>Niveau {here.level}</h3>
        <div className="level-bar" role="img" aria-label={`${here.into} sur ${here.span} points`}>
          <i style={{ width: `${Math.round((here.into / here.span) * 100)}%` }} />
        </div>
        <p>
          {here.toNext > 0
            ? `${here.into} / ${here.span} XP — encore ${here.toNext} pour le niveau ${here.level + 1}.`
            : "Dernier palier atteint."}
        </p>
        <p className="guide-unlock">
          {next
            ? `Prochaine ouverture au niveau ${next.level} : ${next.label}.`
            : "Tout est ouvert."}
        </p>
      </div>

      <p className="guide-lead">
        Un niveau ouvre des portes, il ne rend pas plus fort : pas de bonus caché, pas de
        pourcentage. C'est le matériel, la rotation et l'entretien qui font le rendement.
      </p>

      <ul className="guide-list levels">
        {unlocks.map((u) => (
          <li key={u.level} className={u.level <= here.level ? "done" : ""}>
            <strong>
              Niveau {u.level}
              <em>{u.xp} XP</em>
            </strong>
            <span>{u.label}</span>
            <small>{u.detail}</small>
          </li>
        ))}
      </ul>

      <p className="guide-foot">
        L'expérience se gagne au travail : chaque case semée, labourée, déchaumée ou moissonnée,
        chaque tonne récoltée puis vendue, chaque bête soignée, chaque bâtiment posé. Rien ne se
        gagne à ne rien faire — et le niveau {unlocks[0]?.level ?? 3} demande déjà{" "}
        {xpForLevel(unlocks[0]?.level ?? 3)} points.
      </p>
    </>
  );
}
