/**
 * L'arbre de compétences, à l'écran.
 *
 * Il ne calcule rien. Le serveur envoie l'état déjà résolu — débloquée ou non,
 * et où en est chaque condition — et cet écran le dessine. C'est ce qui évite
 * le défaut classique d'un arbre qui vit des deux côtés : une compétence que
 * l'écran annonce ouverte pendant que le serveur la tient fermée.
 *
 * Ce qu'il doit faire comprendre en un coup d'œil : **quoi faire ensuite**.
 * D'où l'ordre — ce qui est le plus proche d'aboutir remonte en tête des
 * compétences fermées — et la jauge chiffrée sur chaque condition, plutôt
 * qu'un cadenas muet.
 */

import { useMemo, useState } from "react";
import {
  BRANCH_ICONS,
  BRANCH_LABELS,
  type SkillBranch,
  type SkillEffectKind,
} from "@farmsim/shared";

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
  unlocked: boolean;
  ratio: number;
  effects: { kind: SkillEffectKind; value: number }[];
  progress: SkillConditionView[];
};

/** Ce que chaque levier fait, dit au joueur — jamais le nom technique. */
const EFFECT_LABELS: Record<SkillEffectKind, (v: string) => string> = {
  CROP_YIELD: (v) => `+${v} de rendement des cultures`,
  FUEL_USE: (v) => `−${v} de gazole sur les chantiers`,
  WEAR: (v) => `−${v} d’usure du matériel`,
  REPAIR_COST: (v) => `−${v} sur les réparations`,
  WORK_SPEED: (v) => `−${v} sur la durée des chantiers`,
  MILK_YIELD: (v) => `+${v} de production laitière`,
  EGG_YIELD: (v) => `+${v} de ponte`,
  WOOL_YIELD: (v) => `+${v} de laine`,
  FEED_USE: (v) => `−${v} de ration consommée`,
  ANIMAL_HAPPINESS: (v) => `+${v} de bien-être du troupeau`,
  STORAGE_GRAIN: (v) => `+${v} de stockage du grain`,
  SPOILAGE_SLOW: (v) => `−${v} de dégradation au stock`,
  SALE_PRICE: (v) => `+${v} sur le prix de vente`,
};

function effectText(e: { kind: SkillEffectKind; value: number }): string {
  // Le stockage se compte en tonnes, tout le reste en pourcentage : afficher
  // « +0,2 % de stockage » pour vingt tonnes n'aurait aucun sens.
  const valeur =
    e.kind === "STORAGE_GRAIN" ? `${Math.round(e.value)} t` : `${Math.round(e.value * 100)} %`;
  return EFFECT_LABELS[e.kind](valeur);
}

const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Base",
  2: "Confirmé",
  3: "Avancé",
  4: "Maîtrise",
};

function ConditionLine({ c }: { c: SkillConditionView }) {
  const chiffree = c.have !== undefined && c.need !== undefined;
  const part = chiffree ? Math.min(1, (c.have ?? 0) / Math.max(1, c.need ?? 1)) : c.ok ? 1 : 0;
  return (
    <li className={`skill-cond${c.ok ? " done" : ""}`}>
      <span className="skill-cond-mark" aria-hidden="true">
        {c.ok ? "✓" : "○"}
      </span>
      <span className="skill-cond-body">
        <span className="skill-cond-label">
          {chiffree ? `${c.have} / ${c.need} ${c.label}` : c.label}
        </span>
        {chiffree && !c.ok && (
          <span className="skill-cond-bar">
            <span className="skill-cond-fill" style={{ width: `${Math.round(part * 100)}%` }} />
          </span>
        )}
      </span>
    </li>
  );
}

function SkillCard({ s }: { s: SkillView }) {
  return (
    <li className={`skill-card${s.unlocked ? " on" : ""}`}>
      <div className="skill-card-head">
        <span className="skill-card-state" aria-hidden="true">
          {s.unlocked ? "✅" : "🔒"}
        </span>
        <span className="skill-card-title">
          <strong>{s.name}</strong>
          <span className="skill-card-tier">{TIER_LABELS[s.tier]}</span>
        </span>
      </div>
      <p className="skill-card-desc">{s.description}</p>
      <ul className="skill-effects">
        {s.effects.map((e) => (
          <li key={e.kind}>{effectText(e)}</li>
        ))}
      </ul>
      {/* Une compétence ouverte n'a plus rien à demander : afficher ses
          conditions remplies n'apprendrait rien et noierait le reste. */}
      {!s.unlocked && (
        <ul className="skill-conds">
          {s.progress.map((c, i) => (
            <ConditionLine key={`${c.label}-${i}`} c={c} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SkillTree({ skills }: { skills: SkillView[] }) {
  const [branche, setBranche] = useState<SkillBranch | "ALL">("ALL");

  const branches: SkillBranch[] = ["FIELD", "LIVESTOCK", "MACHINE", "TRADE"];

  const tally = useMemo(() => {
    const out: Record<string, { open: number; total: number }> = {};
    for (const b of branches) out[b] = { open: 0, total: 0 };
    for (const s of skills) {
      const t = out[s.branch];
      if (!t) continue;
      t.total++;
      if (s.unlocked) t.open++;
    }
    return out;
  }, [skills]);

  const ouvertes = skills.filter((s) => s.unlocked).length;

  /*
   * L'ordre : ce qui est acquis d'abord, puis ce qui est le plus près
   * d'aboutir. Un arbre trié par identifiant obligerait le joueur à lire les
   * quarante fiches pour trouver celle qu'il est sur le point d'ouvrir.
   */
  const liste = useMemo(() => {
    const filtre = branche === "ALL" ? skills : skills.filter((s) => s.branch === branche);
    return [...filtre].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked) return a.tier - b.tier;
      return b.ratio - a.ratio;
    });
  }, [skills, branche]);

  return (
    <div className="skill-tree">
      <p className="skill-intro">
        Les compétences ne se choisissent pas et ne se dépensent pas : elles s’ouvrent en
        travaillant. Rien n’est réservé à un métier — plus vous pratiquez une activité, plus la
        ferme y devient bonne. <strong>{ouvertes} / {skills.length}</strong> acquises.
      </p>

      <div className="skill-branches" role="tablist" aria-label="Branches">
        <button
          type="button"
          role="tab"
          aria-selected={branche === "ALL"}
          className={`skill-branch${branche === "ALL" ? " on" : ""}`}
          onClick={() => setBranche("ALL")}
        >
          Tout <span className="skill-branch-count">{ouvertes}/{skills.length}</span>
        </button>
        {branches.map((b) => (
          <button
            key={b}
            type="button"
            role="tab"
            aria-selected={branche === b}
            className={`skill-branch${branche === b ? " on" : ""}`}
            onClick={() => setBranche(b)}
          >
            <span aria-hidden="true">{BRANCH_ICONS[b]}</span> {BRANCH_LABELS[b]}{" "}
            <span className="skill-branch-count">
              {tally[b]?.open ?? 0}/{tally[b]?.total ?? 0}
            </span>
          </button>
        ))}
      </div>

      <ul className="skill-list">
        {liste.map((s) => (
          <SkillCard key={s.id} s={s} />
        ))}
      </ul>
    </div>
  );
}
