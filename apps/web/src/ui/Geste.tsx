import type { ReactNode } from "react";

/**
 * Un geste, et ce qui l'empêche — dit à voix haute.
 *
 * Tous les blocages du panneau étaient rangés dans l'attribut `title`.
 * Au téléphone, cet attribut **n'existe pas** : il n'y a pas de survol. Le
 * joueur avait donc sous les yeux une rangée de boutons gris, sans une ligne
 * pour dire lequel manquait de quoi, et ses touchers ne produisaient rien —
 * ce qui se raconte très exactement « peu importe où je clique, ça fait
 * rien ».
 *
 * Un geste empêché reste donc **touchable** : il ne s'exécute pas, mais il
 * répond. Il annonce ce qui manque, dans le bandeau, à l'endroit où le joueur
 * regarde déjà. `aria-disabled` plutôt que `disabled` : le lecteur d'écran
 * apprend qu'il est indisponible, et le doigt garde une cible qui parle.
 */
export function Geste({
  label,
  className,
  busy,
  blocage,
  onDo,
  onExplain,
  hint,
}: {
  label: ReactNode;
  className?: string;
  busy: boolean;
  /** Ce qui empêche, `null` si rien n'empêche. */
  blocage: string | null;
  onDo: () => void;
  onExplain: (raison: string) => void;
  /** Ce que le geste fait, quand il est possible — pour la souris. */
  hint?: string;
}) {
  const empeche = blocage !== null;
  return (
    <button
      type="button"
      className={`${className ?? ""}${empeche ? " blocked" : ""}`.trim()}
      // `busy` est le seul cas où l'on refuse vraiment le toucher : une
      // requête est en vol, et un second envoi ferait double emploi.
      disabled={busy}
      aria-disabled={empeche}
      title={blocage ?? hint}
      onClick={() => (empeche ? onExplain(blocage) : onDo())}
    >
      {label}
    </button>
  );
}
