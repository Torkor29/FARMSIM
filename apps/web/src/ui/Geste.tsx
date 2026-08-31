import { useState, type ReactNode } from "react";

/**
 * Un geste, et ce qui l'empêche — dit là où le doigt vient de se poser.
 *
 * ## Deux fois le même défaut, à deux endroits
 *
 * Tous les blocages du panneau étaient d'abord rangés dans l'attribut `title`.
 * Au téléphone, cet attribut **n'existe pas** : il n'y a pas de survol. Le
 * joueur avait donc sous les yeux une rangée de boutons gris, sans une ligne
 * pour dire lequel manquait de quoi, et ses touchers ne produisaient rien —
 * ce qui se raconte très exactement « peu importe où je clique, ça fait
 * rien ». D'où `onExplain`, qui pousse la raison dans le bandeau.
 *
 * Le même signalement est revenu le 28 août, sur le même écran : « en cliquant
 * sur les boutons d'action en bas à droite il se passe rien ». Le bandeau
 * s'affiche en haut de l'écran — et l'élevage s'ouvre désormais dans une
 * fenêtre qui prend toute la page. Le joueur regarde le bas à droite, la
 * réponse arrive en haut à gauche, hors de son champ de vision. Le geste
 * répondait ; personne ne l'entendait.
 *
 * La raison s'affiche donc **aussi sous le bouton**, à l'endroit exact où le
 * doigt vient de se poser. Le bandeau reste : il sert quand le panneau est
 * refermé entre-temps.
 *
 * ## Et le cas où il ne répondait pas du tout
 *
 * `disabled={busy}` rendait le bouton muet pendant qu'une requête volait :
 * pas de clic, pas de message, rien. C'est le seul état où ce composant
 * trahissait son propre principe. Il reste touchable et le dit — refuser
 * n'oblige pas à se taire.
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
  const [dit, setDit] = useState<string | null>(null);
  const empeche = blocage !== null;

  function repondre(raison: string) {
    setDit(raison);
    onExplain(raison);
  }

  return (
    <>
      <button
        type="button"
        className={`${className ?? ""}${empeche ? " blocked" : ""}`.trim()}
        // Plus de `disabled` : il rendait le bouton muet. Le double envoi est
        // arrêté dans le gestionnaire, qui lui dit pourquoi.
        aria-disabled={empeche || busy}
        title={blocage ?? hint}
        onClick={() => {
          if (busy) {
            repondre("Une action est déjà en cours — un instant.");
            return;
          }
          if (empeche) {
            repondre(blocage);
            return;
          }
          setDit(null);
          onDo();
        }}
      >
        {label}
      </button>
      {dit && (
        <p className="geste-dit" role="status">
          {dit}
        </p>
      )}
    </>
  );
}
