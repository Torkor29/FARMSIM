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
 * côte et les paliers en profondeur.
 *
 * ## Les liens ne sont plus tracés — ils sont nommés
 *
 * Ils l'étaient : des courbes SVG entre les centres des cartes, calculées sur
 * leurs positions mesurées. Le résultat était illisible, et le graphe explique
 * pourquoi. Sur vingt-neuf liens, **deux** relient des cartes voisines. Vingt-
 * quatre sautent par-dessus une à huit cartes : entre deux centres alignés
 * dans la même colonne, la courbe dégénère en un trait vertical qui traverse
 * tout ce qui se trouve entre les deux. Et trois traversent jusqu'à trois
 * colonnes, en grandes arabesques au travers de l'écran.
 *
 * Aucun tracé entre centres ne peut être propre sur ces données — ce n'était
 * pas une question de courbure, mais de graphe.
 *
 * Alors chaque carte dit **de qui elle vient**, par son nom : « après
 * Labour ». C'est plus précis qu'un trait, qui apprend seulement que quelque
 * chose est relié ; ici on sait quoi. Les paliers, eux, sont marqués par des
 * bandeaux dans la colonne, ce qui rend la profondeur de l'arbre sans rien
 * dessiner. Plus de mesure, plus de `ResizeObserver`, plus de recalcul à
 * chaque carte dépliée.
 */

import { useMemo, useState } from "react";
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
  apres,
  open,
  onToggle,
}: {
  s: SkillView;
  /** Les compétences dont celle-ci descend, par leur nom. */
  apres: string[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className={`sk-node${s.unlocked ? " on" : ""}${open ? " open" : ""}`} data-skill={s.id}>
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
          {/* Le palier est écrit une fois pour toutes en tête de section : le
              répéter sur chaque carte prenait la ligne qui manquait ici. */}
          {apres.length > 0 && (
            <span className="sk-node-after">après {apres.join(", ")}</span>
          )}
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

  /** De l'identifiant au nom : c'est ce qui permet de dire « après Labour ». */
  const nomDe = useMemo(() => new Map(skills.map((s) => [s.id, s.name])), [skills]);

  const visibles = useMemo(
    () => (focus === "ALL" ? skills : skills.filter((s) => s.branch === focus)),
    [skills, focus],
  );

  /**
   * Une colonne par branche, découpée en paliers.
   *
   * Le palier était écrit sur chaque carte ; il l'est maintenant une fois, en
   * tête de section. C'est la même information, dite une fois au lieu de
   * treize, et elle rend la profondeur de l'arbre — ce que les liens tracés
   * étaient censés faire.
   */
  const parBranche = useMemo(() => {
    const out = new Map<SkillBranch, { tier: 1 | 2 | 3 | 4; liste: SkillView[] }[]>();
    for (const b of BRANCHES) {
      const liste = visibles
        .filter((s) => s.branch === b)
        .sort((a, z) => a.tier - z.tier || a.name.localeCompare(z.name));
      const paliers: { tier: 1 | 2 | 3 | 4; liste: SkillView[] }[] = [];
      for (const s of liste) {
        const dernier = paliers[paliers.length - 1];
        if (dernier && dernier.tier === s.tier) dernier.liste.push(s);
        else paliers.push({ tier: s.tier, liste: [s] });
      }
      out.set(b, paliers);
    }
    return out;
  }, [visibles]);

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

      <div className="sk-scene">
        <div className="sk-columns">
          {BRANCHES.filter((b) => (parBranche.get(b)?.length ?? 0) > 0).map((b) => {
            const paliers = parBranche.get(b) ?? [];
            const cartes = paliers.flatMap((p) => p.liste);
            const n = cartes.filter((s) => s.unlocked).length;
            return (
              <section className="sk-col" key={b}>
                <h3 className="sk-col-head">
                  <img src={skillIconSrc(BRANCH_ICON_FILES[b])} alt="" width={22} height={22} />
                  <span>{BRANCH_LABELS[b]}</span>
                  <span className="sk-col-count">
                    {n}/{cartes.length}
                  </span>
                </h3>
                {paliers.map((palier) => (
                  <div className="sk-tier" key={palier.tier}>
                    <p className="sk-tier-head">
                      <span>{TIER_LABELS[palier.tier]}</span>
                      <i aria-hidden="true" />
                    </p>
                    <ul className="sk-nodes">
                      {palier.liste.map((s) => (
                        <SkillNode
                          key={s.id}
                          s={s}
                          apres={s.requires
                            .map((id) => nomDe.get(id))
                            .filter((x): x is string => Boolean(x))}
                          open={open === s.id}
                          onToggle={() => setOpen((o) => (o === s.id ? null : s.id))}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
