/**
 * L'arbre de compétences — l'écran.
 *
 * Il ne calcule rien. Le serveur envoie l'état déjà résolu, cet écran le
 * dessine. C'est ce qui évite le défaut classique d'un arbre qui vit des deux
 * côtés : une compétence que l'écran annonce ouverte pendant que le serveur la
 * tient fermée.
 *
 * ## Pourquoi un arbre, et pas une liste
 *
 * Une liste répond à « qu'est-ce que j'ai ? ». Un arbre répond à « où est-ce
 * que je vais ? », qui est la seule question intéressante quand rien ne se
 * dépense et que tout se mérite. On dessine donc les quatre branches côte à
 * côte, les paliers en profondeur, et les liens de prérequis entre les
 * cartes — pour qu'on voie d'un coup d'œil ce qui ouvre quoi.
 *
 * Les liens sont tracés en SVG **derrière** les cartes, à partir de leurs
 * positions réelles mesurées après rendu. Les calculer d'avance supposerait
 * de connaître la hauteur des cartes, qui dépend du texte, donc de la police,
 * donc de l'appareil.
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  BRANCH_ICON_FILES,
  BRANCH_LABELS,
  skillIconSrc,
  type SkillBranch,
  type SkillEffectKind,
} from "@farmsim/shared";
import { effectText } from "./skill-effects";

export type SkillConditionView = {
  have?: number;
  need?: number;
  label: string;
  ok: boolean;
};

export type SkillView = {
  id: string;
  name: string;
  description: string;
  branch: SkillBranch;
  tier: 1 | 2 | 3 | 4;
  icon: string;
  unlocked: boolean;
  ratio: number;
  effects: { kind: SkillEffectKind; value: number }[];
  progress: SkillConditionView[];
  requires: string[];
};

const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Base",
  2: "Confirmé",
  3: "Avancé",
  4: "Maîtrise",
};

const BRANCHES: SkillBranch[] = ["FIELD", "LIVESTOCK", "MACHINE", "TRADE"];

function ConditionLine({ c }: { c: SkillConditionView }) {
  const chiffree = c.have !== undefined && c.need !== undefined;
  const part = chiffree ? Math.min(1, (c.have ?? 0) / Math.max(1, c.need ?? 1)) : c.ok ? 1 : 0;
  return (
    <li className={`sk-cond${c.ok ? " done" : ""}`}>
      <span className="sk-cond-mark" aria-hidden="true">
        {c.ok ? "✓" : "○"}
      </span>
      <span className="sk-cond-body">
        <span className="sk-cond-label">
          {chiffree ? `${c.have} / ${c.need} ${c.label}` : c.label}
        </span>
        {chiffree && !c.ok && (
          <span className="sk-cond-bar">
            <span className="sk-cond-fill" style={{ width: `${Math.round(part * 100)}%` }} />
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Une carte. Fermée, elle s'efface **sans disparaître** : ce qu'elle demande
 * est précisément l'information qu'on vient chercher.
 */
function SkillNode({
  s,
  refFor,
  open,
  onToggle,
}: {
  s: SkillView;
  refFor: (id: string, el: HTMLElement | null) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li
      className={`sk-node${s.unlocked ? " on" : ""}${open ? " open" : ""}`}
      ref={(el) => refFor(s.id, el)}
      data-skill={s.id}
    >
      <button
        type="button"
        className="sk-node-head"
        aria-expanded={open}
        onClick={onToggle}
        title={s.description}
      >
        <span className="sk-icon" aria-hidden="true">
          <img src={skillIconSrc(s.icon)} alt="" width={26} height={26} />
          {/* La pastille dit l'état sans qu'on ait à lire : un anneau plein
              pour acquis, une part d'anneau pour la progression. */}
          {!s.unlocked && (
            <svg className="sk-ring" viewBox="0 0 36 36" aria-hidden="true">
              <circle className="sk-ring-bg" cx="18" cy="18" r="16" />
              <circle
                className="sk-ring-fill"
                cx="18"
                cy="18"
                r="16"
                strokeDasharray={`${Math.round(s.ratio * 100.5)} 100.5`}
              />
            </svg>
          )}
        </span>
        <span className="sk-node-text">
          <strong>{s.name}</strong>
          <span className="sk-node-tier">{TIER_LABELS[s.tier]}</span>
        </span>
        <span className="sk-node-state" aria-hidden="true">
          {s.unlocked ? "✓" : `${Math.round(s.ratio * 100)} %`}
        </span>
      </button>

      {open && (
        <div className="sk-node-body">
          <p className="sk-desc">{s.description}</p>
          <ul className="sk-effects">
            {s.effects.map((e) => (
              <li key={e.kind}>{effectText(e)}</li>
            ))}
          </ul>
          {/* Une compétence acquise n'a plus rien à demander : lister ses
              conditions remplies n'apprendrait rien et noierait le reste. */}
          {!s.unlocked && (
            <ul className="sk-conds">
              {s.progress.map((c, i) => (
                <ConditionLine key={`${c.label}-${i}`} c={c} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

export function SkillTree({ skills }: { skills: SkillView[] }) {
  const [focus, setFocus] = useState<SkillBranch | "ALL">("ALL");
  const [open, setOpen] = useState<string | null>(null);

  const scene = useRef<HTMLDivElement | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const [liens, setLiens] = useState<{ id: string; d: string; on: boolean }[]>([]);

  const refFor = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodes.current.set(id, el);
    else nodes.current.delete(id);
  }, []);

  const visibles = useMemo(
    () => (focus === "ALL" ? skills : skills.filter((s) => s.branch === focus)),
    [skills, focus],
  );

  const parBranche = useMemo(() => {
    const out = new Map<SkillBranch, SkillView[]>();
    for (const b of BRANCHES) out.set(b, []);
    for (const s of visibles) out.get(s.branch)?.push(s);
    // Dans une colonne, on descend par palier : c'est le sens de lecture de
    // l'arbre, et il doit correspondre au sens des liens.
    for (const [, liste] of out) liste.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
    return out;
  }, [visibles]);

  /**
   * Trace les liens à partir des positions **mesurées**.
   *
   * On relit après chaque changement de filtre ou de carte dépliée : une carte
   * qui s'ouvre pousse toutes celles du dessous, et un lien qui pointerait
   * encore vers l'ancienne position se verrait immédiatement.
   */
  useLayoutEffect(() => {
    const hote = scene.current;
    if (!hote) return;
    const calc = () => {
      const base = hote.getBoundingClientRect();
      const out: { id: string; d: string; on: boolean }[] = [];
      for (const s of visibles) {
        const cible = nodes.current.get(s.id);
        if (!cible) continue;
        for (const req of s.requires) {
          const source = nodes.current.get(req);
          if (!source) continue;
          const a = source.getBoundingClientRect();
          const b = cible.getBoundingClientRect();
          const x1 = a.left - base.left + a.width / 2;
          const y1 = a.top - base.top + a.height;
          const x2 = b.left - base.left + b.width / 2;
          const y2 = b.top - base.top;
          // Une courbe douce plutôt qu'un trait brisé : sur une colonne, deux
          // liens droits se superposent et deviennent illisibles.
          const m = (y1 + y2) / 2;
          out.push({
            id: `${req}->${s.id}`,
            d: `M${x1},${y1} C${x1},${m} ${x2},${m} ${x2},${y2}`,
            on: skills.find((x) => x.id === req)?.unlocked === true && s.unlocked,
          });
        }
      }
      setLiens(out);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(hote);
    window.addEventListener("resize", calc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", calc);
    };
  }, [visibles, open, focus, skills]);

  return (
    <div className="sk-tree">
      {/* Le compte des acquises a rejoint l'en-tête de l'écran : il y est vrai
          quel que soit l'onglet, alors qu'ici il n'existait que sur l'arbre. */}
      <div className="sk-filters" role="tablist" aria-label="Branches">
        <button
          type="button"
          role="tab"
          aria-selected={focus === "ALL"}
          className={`sk-filter${focus === "ALL" ? " on" : ""}`}
          onClick={() => setFocus("ALL")}
        >
          Tout l’arbre
        </button>
        {BRANCHES.map((b) => {
          const liste = skills.filter((s) => s.branch === b);
          const n = liste.filter((s) => s.unlocked).length;
          return (
            <button
              key={b}
              type="button"
              role="tab"
              aria-selected={focus === b}
              className={`sk-filter${focus === b ? " on" : ""}`}
              onClick={() => setFocus(b)}
            >
              <img src={skillIconSrc(BRANCH_ICON_FILES[b])} alt="" width={18} height={18} />
              {BRANCH_LABELS[b]}
              <span className="sk-filter-count">
                {n}/{liste.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sk-scene" ref={scene}>
        {/* Les liens passent derrière les cartes, jamais dessus. */}
        <svg className="sk-links" aria-hidden="true">
          {liens.map((l) => (
            <path key={l.id} d={l.d} className={l.on ? "sk-link on" : "sk-link"} />
          ))}
        </svg>

        <div className="sk-columns">
          {BRANCHES.filter((b) => (parBranche.get(b)?.length ?? 0) > 0).map((b) => {
            const liste = parBranche.get(b) ?? [];
            const n = liste.filter((s) => s.unlocked).length;
            return (
              <section className="sk-col" key={b}>
                <h3 className="sk-col-head">
                  <img src={skillIconSrc(BRANCH_ICON_FILES[b])} alt="" width={22} height={22} />
                  <span>{BRANCH_LABELS[b]}</span>
                  <span className="sk-col-count">
                    {n}/{liste.length}
                  </span>
                </h3>
                <ul className="sk-nodes">
                  {liste.map((s) => (
                    <SkillNode
                      key={s.id}
                      s={s}
                      refFor={refFor}
                      open={open === s.id}
                      onToggle={() => setOpen((o) => (o === s.id ? null : s.id))}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
