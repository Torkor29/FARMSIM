/**
 * L'écran des compétences — un menu à part entière.
 *
 * L'arbre vivait dans un onglet du *Guide de ferme*, entre « Objectifs » et
 * « Niveaux ». Il y était deux fois mal placé : le guide est un recueil qu'on
 * consulte, alors que les compétences sont un **état de la partie** qu'on
 * suit ; et la fenêtre du guide, taillée pour une colonne de texte, écrasait
 * quatre branches dans 560 px — d'où les colonnes qui se chevauchaient sur la
 * capture d'écran qui a motivé cette refonte.
 *
 * L'écran a donc sa propre porte, au milieu du bandeau, et sa propre largeur.
 *
 * ## Deux onglets, et pas un de plus
 *
 * « Avantages » répond à *qu'est-ce que ça m'apporte, là, maintenant* : les
 * treize leviers du jeu, ce qu'ils changent, ce qu'ils valent aujourd'hui et
 * jusqu'où ils peuvent monter. C'est la question que l'arbre seul laissait
 * sans réponse — il fallait déplier trente-neuf cartes et additionner de tête.
 *
 * « L'arbre » répond à *où est-ce que je vais*. Les deux sont nécessaires,
 * aucun ne remplace l'autre.
 */

import { useMemo, useState } from "react";
import { SkillTree, type SkillView } from "./SkillTree";
import {
  BRANCH_LABELS,
  SKILL_EFFECT_CAPS,
  skillIconSrc,
  type SkillEffectKind,
} from "@farmsim/shared";
import { EFFECT_META, effectCap, effectSign, effectValue } from "./skill-effects";

/** Les bonus déjà cumulés, tels que le serveur les a bornés. */
export type SkillBonusView = Partial<Record<SkillEffectKind, number>>;

type Props = {
  open: boolean;
  skills: SkillView[];
  /** Les leviers agrégés. Absents tant que la requête n'a pas répondu. */
  bonuses?: SkillBonusView | null;
  onClose: () => void;
};

const LEVIERS = Object.keys(SKILL_EFFECT_CAPS) as SkillEffectKind[];

/**
 * Le cumul, recalculé depuis l'arbre **au cas où** le serveur ne l'aurait pas
 * envoyé.
 *
 * Ce n'est pas une deuxième vérité : c'est la même somme, faite à partir des
 * compétences que le serveur a déjà déclarées ouvertes. Sans ce repli, une
 * réponse partielle affichait « aucun avantage » à un joueur qui en a six —
 * un mensonge bien plus coûteux qu'un arrondi.
 */
function cumul(skills: SkillView[]): SkillBonusView {
  const out: SkillBonusView = {};
  for (const s of skills) {
    if (!s.unlocked) continue;
    for (const e of s.effects) out[e.kind] = (out[e.kind] ?? 0) + e.value;
  }
  for (const k of LEVIERS) {
    if (out[k] !== undefined) out[k] = Math.min(SKILL_EFFECT_CAPS[k], out[k] as number);
  }
  return out;
}

function AdvantageCard({
  kind,
  value,
  sources,
  next,
}: {
  kind: SkillEffectKind;
  value: number;
  sources: SkillView[];
  next: SkillView | null;
}) {
  const meta = EFFECT_META[kind];
  const actif = value > 0;
  const part = Math.min(1, value / SKILL_EFFECT_CAPS[kind]);
  return (
    <li className={`adv-card${actif ? " on" : ""}`}>
      <p className="adv-value">
        {actif ? `${effectSign(kind)}${effectValue(kind, value)}` : "—"}
      </p>
      <h4 className="adv-title">{meta.title}</h4>
      <p className="adv-where">{meta.where}</p>
      <span
        className="adv-bar"
        role="img"
        aria-label={`${effectValue(kind, value)} sur un plafond de ${effectCap(kind)}`}
      >
        <i style={{ width: `${Math.round(part * 100)}%` }} />
      </span>
      <p className="adv-cap">
        Plafond des compétences : {effectSign(kind)}
        {effectCap(kind)}
      </p>
      {actif ? (
        <p className="adv-from">
          Par {sources.length} compétence{sources.length > 1 ? "s" : ""} :{" "}
          {sources.map((s) => s.name).join(", ")}
        </p>
      ) : next ? (
        <p className="adv-from">
          S’ouvre avec « {next.name} » — {Math.round(next.ratio * 100)} %
        </p>
      ) : (
        <p className="adv-from">Aucune compétence de ce genre n’est encore à portée.</p>
      )}
    </li>
  );
}

/** Les trois compétences les plus proches — ce qu'on peut viser ce soir. */
function NextUp({ skills }: { skills: SkillView[] }) {
  const proches = useMemo(
    () =>
      skills
        .filter((s) => !s.unlocked)
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3),
    [skills],
  );
  if (!proches.length) return null;
  return (
    <section className="skills-section">
      <h3>À portée</h3>
      <ul className="skills-next">
        {proches.map((s) => (
          <li key={s.id}>
            <img src={skillIconSrc(s.icon)} alt="" width={24} height={24} />
            <span className="next-body">
              <strong>{s.name}</strong>
              <small>
                {BRANCH_LABELS[s.branch]} ·{" "}
                {s.progress.find((c) => !c.ok)?.label ?? "Presque"}
              </small>
              <span className="next-bar">
                <i style={{ width: `${Math.round(s.ratio * 100)}%` }} />
              </span>
            </span>
            <span className="next-pct">{Math.round(s.ratio * 100)} %</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AdvantagesPane({
  skills,
  bonuses,
}: {
  skills: SkillView[];
  bonuses: SkillBonusView;
}) {
  const parLevier = useMemo(() => {
    const out = new Map<SkillEffectKind, { sources: SkillView[]; next: SkillView | null }>();
    for (const k of LEVIERS) out.set(k, { sources: [], next: null });
    for (const s of skills) {
      for (const e of s.effects) {
        const entree = out.get(e.kind);
        if (!entree) continue;
        if (s.unlocked) entree.sources.push(s);
        else if (!entree.next || s.ratio > entree.next.ratio) entree.next = s;
      }
    }
    return out;
  }, [skills]);

  const actifs = LEVIERS.filter((k) => (bonuses[k] ?? 0) > 0);
  const dormants = LEVIERS.filter((k) => !((bonuses[k] ?? 0) > 0));

  return (
    <>
      <p className="skills-lead">
        Rien ne se choisit et rien ne se dépense : les compétences s’ouvrent en travaillant.
        Aucune n’est réservée à un métier — plus vous pratiquez une activité, plus la ferme y
        devient bonne. Chaque compétence ouverte pousse un des treize leviers ci-dessous, pour
        toujours, dans la limite de son plafond.
      </p>

      <section className="skills-section">
        <h3>
          Ce que vous gagnez déjà
          <span className="skills-count">
            {actifs.length} levier{actifs.length > 1 ? "s" : ""} sur {LEVIERS.length}
          </span>
        </h3>
        {actifs.length ? (
          <ul className="adv-grid">
            {actifs.map((k) => (
              <AdvantageCard
                key={k}
                kind={k}
                value={bonuses[k] ?? 0}
                sources={parLevier.get(k)?.sources ?? []}
                next={parLevier.get(k)?.next ?? null}
              />
            ))}
          </ul>
        ) : (
          <p className="skills-empty">
            Aucun levier n’est encore poussé — c’est normal au premier jour. Semez, labourez,
            trayez : les compétences de base s’ouvrent au bout de quelques chantiers, sans que
            vous ayez rien à choisir.
          </p>
        )}
      </section>

      {dormants.length > 0 && (
        <section className="skills-section">
          <h3>
            Ce qui reste à gagner
            <span className="skills-count">{dormants.length} en sommeil</span>
          </h3>
          <ul className="adv-grid">
            {dormants.map((k) => (
              <AdvantageCard
                key={k}
                kind={k}
                value={bonuses[k] ?? 0}
                sources={parLevier.get(k)?.sources ?? []}
                next={parLevier.get(k)?.next ?? null}
              />
            ))}
          </ul>
        </section>
      )}

      <NextUp skills={skills} />
    </>
  );
}

export function SkillsScreen({ open, skills, bonuses, onClose }: Props) {
  const [tab, setTab] = useState<"gains" | "tree">("gains");
  const effectifs = useMemo(
    () => (bonuses && Object.keys(bonuses).length ? bonuses : cumul(skills)),
    [bonuses, skills],
  );
  if (!open) return null;

  const ouvertes = skills.filter((s) => s.unlocked).length;
  const part = skills.length ? ouvertes / skills.length : 0;

  return (
    <div
      className="skills-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skills-title"
    >
      <div className="skills-screen glass">
        <header className="skills-head">
          <div className="skills-ident">
            <p className="skills-kicker">Le métier s’apprend en le faisant</p>
            <h2 id="skills-title">Compétences</h2>
          </div>

          <p className="skills-score">
            {/* Un anneau plutôt qu'une fraction seule : « 6 / 39 » demande un
                calcul, l'anneau se lit sans en faire un. */}
            <svg className="skills-ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="skills-ring-bg" cx="18" cy="18" r="16" />
              <circle
                className="skills-ring-fill"
                cx="18"
                cy="18"
                r="16"
                strokeDasharray={`${Math.round(part * 100.5)} 100.5`}
              />
            </svg>
            <span>
              <strong>{ouvertes}</strong>
              <small>sur {skills.length} acquises</small>
            </span>
          </p>

          <button type="button" className="skills-close" onClick={onClose} aria-label="Fermer">
            Fermer
          </button>
        </header>

        <nav className="skills-nav" aria-label="Vues des compétences">
          <button
            type="button"
            className={tab === "gains" ? "on" : ""}
            aria-current={tab === "gains"}
            onClick={() => setTab("gains")}
          >
            Vos avantages
          </button>
          <button
            type="button"
            className={tab === "tree" ? "on" : ""}
            aria-current={tab === "tree"}
            onClick={() => setTab("tree")}
          >
            L’arbre
          </button>
        </nav>

        <div className="skills-body">
          {skills.length === 0 ? (
            <p className="skills-empty">
              L’arbre se charge… S’il ne vient pas, c’est que le serveur n’a pas répondu :
              refermez et rouvrez cet écran.
            </p>
          ) : tab === "gains" ? (
            <AdvantagesPane skills={skills} bonuses={effectifs} />
          ) : (
            <SkillTree skills={skills} />
          )}
        </div>
      </div>
    </div>
  );
}
