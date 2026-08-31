import {
  EMPLOYEE_SKILL_EFFECTS,
  EMPLOYEE_SKILL_LABELS,
  EMPLOYEE_POST_LABELS,
  EMPLOYEE_SKILLS,
  SKILL_MAX,
  type EmployeePost,
  type EmployeeSkill,
} from "@farmsim/shared";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MenuClose } from "./ui/MenuClose";

/**
 * Le personnel de la ferme.
 *
 * Deux listes et une règle. En haut l'équipe, avec ce que chacun coûte et où
 * il passe sa journée ; en bas les trois candidats du jour. Entre les deux, la
 * phrase qui explique pourquoi on embauche : un chantier de plus demande un
 * attelage libre **et** quelqu'un pour le conduire.
 *
 * Le vivier se renouvelle à chaque jour de jeu et ne se retire pas d'un
 * rechargement de page : c'est un choix qu'on fait, pas une loterie qu'on
 * relance.
 */

export type EmployeeRow = {
  id: string;
  name: string;
  conduite: number;
  mecanique: number;
  elevage: number;
  poste: EmployeePost;
  salaire: number;
  /** Jours de salaire qu'on lui doit. Zéro tant que la caisse suit. */
  impayeJours: number;
};

export type CandidateRow = {
  id: string;
  name: string;
  conduite: number;
  mecanique: number;
  elevage: number;
  salaire: number;
};

type Props = {
  className?: string;
  embedded?: boolean;
  /** Au téléphone, le tiroir se referme d'un glissement comme tous les autres. */
  gesture?: {
    onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp?: (e: ReactPointerEvent<HTMLElement>) => void;
  };
  busy: boolean;
  employees: EmployeeRow[];
  candidates: CandidateRow[];
  lits: number;
  loges: number;
  masseSalariale: number;
  peutEmbaucher: boolean;
  sansLogement: number;
  preavisJours: number;
  onClose: () => void;
  onHire: (candidateId: string) => void;
  onPost: (id: string, poste: EmployeePost) => void;
  onFire: (id: string, nom: string) => void;
  onExplain: (raison: string) => void;
};

function Jauges({ e }: { e: Pick<EmployeeRow, EmployeeSkill> }) {
  return (
    <div className="emp-jauges">
      {EMPLOYEE_SKILLS.map((s) => (
        <div key={s} className="emp-jauge" title={EMPLOYEE_SKILL_EFFECTS[s]}>
          <span>{EMPLOYEE_SKILL_LABELS[s]}</span>
          <span className="emp-pips" aria-label={`${e[s]} sur ${SKILL_MAX}`}>
            {Array.from({ length: SKILL_MAX }, (_, i) => (
              <i key={i} className={i < e[s] ? "on" : ""} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function EmployeesPanel({
  className,
  embedded = false,
  gesture,
  busy,
  employees,
  candidates,
  lits,
  loges,
  masseSalariale,
  peutEmbaucher,
  sansLogement,
  preavisJours,
  onClose,
  onHire,
  onPost,
  onFire,
  onExplain,
}: Props) {
  const auChamp = employees.filter((e) => e.poste === "CHAMP").length;
  return (
    <aside className={className} {...gesture}>
      {!embedded && (
        <header className="emp-tete">
          <h3>Personnel</h3>
          <MenuClose onClose={onClose} />
        </header>
      )}

      <p className="emp-regle">
        Un chantier de plus demande un attelage libre <strong>et</strong> quelqu’un pour le
        conduire. Vous comptez pour un conducteur : avec {auChamp} employé(s) aux champs, vous
        pouvez mener <strong>{1 + auChamp} chantier(s)</strong> à la fois.
      </p>

      <section className="emp-bloc">
        <h4>
          L’équipe <span className="emp-compte">{employees.length}</span>
        </h4>
        {employees.length === 0 ? (
          <p className="emp-vide">
            Personne pour l’instant. Deux embauches sont possibles sans rien bâtir&nbsp;; au-delà,
            il faut un logement du personnel.
          </p>
        ) : (
          <ul className="emp-liste">
            {employees.map((e, i) => (
              <li key={e.id} className="emp-fiche">
                <div className="emp-entete">
                  <strong>{e.name}</strong>
                  <span className="emp-prix">
                    {e.salaire} € / jour
                    {i < loges && <em title="Logé sur place : −35 %"> · logé</em>}
                  </span>
                </div>
                <Jauges e={e} />
                {e.impayeJours > 0 && (
                  /* Le seul avertissement avant un départ. Le grand livre
                     n'inscrit que l'argent qui bouge : un salaire qu'on ne
                     paie pas n'y laisse aucune trace, et sans cette ligne
                     quelqu'un disparaîtrait de l'équipe sans explication. */
                  <p className="emp-impaye" role="status">
                    {e.impayeJours} jour(s) de salaire impayé
                    {e.impayeJours >= preavisJours
                      ? " — il part au prochain jour de jeu si la caisse ne suit pas."
                      : ` — il en reste ${preavisJours - e.impayeJours} avant qu’il s’en aille.`}
                  </p>
                )}
                <div className="emp-actions">
                  <div className="emp-poste" role="group" aria-label="Poste">
                    {(["CHAMP", "ELEVAGE"] as EmployeePost[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        className={e.poste === p ? "on" : ""}
                        aria-pressed={e.poste === p}
                        onClick={() =>
                          busy ? onExplain("Une action est déjà en cours — un instant.") : onPost(e.id, p)
                        }
                      >
                        {EMPLOYEE_POST_LABELS[p]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="emp-renvoi"
                    onClick={() =>
                      busy ? onExplain("Une action est déjà en cours — un instant.") : onFire(e.id, e.name)
                    }
                  >
                    Se séparer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="emp-bloc">
        <h4>Candidats du jour</h4>
        <p className="emp-note">
          Trois profils par jour de jeu, renouvelés au changement de jour. Recharger la page n’en
          change aucun, et celui qu’on embauche quitte le tableau.
        </p>
        {candidates.length === 0 && (
          <p className="emp-vide">
            Le vivier du jour est épuisé — trois nouveaux profils au prochain jour de jeu.
          </p>
        )}
        <ul className="emp-liste">
          {candidates.map((c) => (
            <li key={c.id} className="emp-fiche">
              <div className="emp-entete">
                <strong>{c.name}</strong>
                <span className="emp-prix">{c.salaire} € / jour</span>
              </div>
              <Jauges e={c} />
              <button
                type="button"
                className="emp-embauche"
                onClick={() => {
                  if (busy) return onExplain("Une action est déjà en cours — un instant.");
                  if (!peutEmbaucher) {
                    return onExplain(
                      lits > 0
                        ? `Plus de lit libre — agrandissez le logement du personnel (${lits} lit(s)).`
                        : `Deux employés logent au village ; au-delà, il faut bâtir un logement du personnel.`,
                    );
                  }
                  onHire(c.id);
                }}
              >
                Embaucher
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="emp-pied">
        <p>
          <strong>{masseSalariale} € par jour de jeu</strong> — prélevé au changement de jour, comme
          les intérêts. Une trésorerie vide laisse une journée pour renflouer.
        </p>
        <p className="emp-note">
          {lits > 0
            ? `${loges} logé(s) sur ${lits} lit(s) — un employé logé coûte 35 % de moins.`
            : `Aucun logement bâti : ${sansLogement} employés au maximum, au village et à plein tarif.`}
        </p>
      </footer>
    </aside>
  );
}
