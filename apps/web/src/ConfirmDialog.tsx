import { useEffect, useRef } from "react";

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

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, onCancel]);

  if (!request) return null;

  return (
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
    </div>
  );
}
