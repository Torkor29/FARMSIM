import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ConfirmRequest = {
  title: string;
  detail?: string;
  confirmLabel: string;
  /** Action irréversible : le bouton se teinte en rouge */
  destructive?: boolean;
  onConfirm: () => void;
};

type Props = {
  request: ConfirmRequest | null;
  onCancel: () => void;
};

/**
 * Confirmation intégrée au jeu.
 *
 * `window.confirm()` bloque le fil principal tout le temps où la boîte est
 * ouverte — Chrome le compte comme un gestionnaire de clic à 1 700 ms — et
 * affiche une fenêtre système qui n'a rien à faire dans une ferme.
 */
export function ConfirmDialog({ request, onCancel }: Props) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  /*
   * L'annulation vit dans une référence, pas dans les dépendances.
   *
   * Elle arrive en lambda depuis l'écran, donc neuve à chaque rendu. L'effet
   * se relançait d'autant, et ramenait le focus sur « Confirmer » : un joueur
   * qui avait tabulé jusqu'à « Annuler » se retrouvait, sans rien faire, sur
   * le bouton qui vend sa machine. Ici le défaut ne fait pas qu'agacer.
   */
  const annuler = useRef(onCancel);
  annuler.current = onCancel;

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") annuler.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;

  /*
   * Portée sur le corps du document, comme les deux autres calques hauts.
   *
   * `Window` et `MachineSheet` se portent déjà sur `document.body` ; la
   * confirmation, elle, restait dans l'arbre du jeu. Un `z-index` n'a de
   * valeur que dans son **contexte d'empilement** : il suffit qu'un ancêtre
   * gagne un `transform`, un `filter` ou une `opacity` — ce qu'une animation
   * de panneau fait couramment — pour que le 200 ci-dessous ne soit plus
   * comparable au 30 de la fenêtre, et que la confirmation se retrouve
   * derrière sans que rien n'ait changé dans sa feuille de style.
   *
   * Signalé deux fois en jouant : « la pop-up passe derrière, je ne peux pas
   * confirmer ». Monter le `z-index` traitait le symptôme du jour ; sortir de
   * l'arbre traite la cause, et met la confirmation dans le même plan que ce
   * qu'elle doit recouvrir.
   */
  return createPortal(
    <div
      className="confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
    >
      <div className="confirm-card glass" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-title">{request.title}</h3>
        {request.detail && <p className="confirm-detail">{request.detail}</p>}
        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={request.destructive ? "confirm-go danger" : "confirm-go"}
            onClick={() => {
              request.onConfirm();
              onCancel();
            }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
