/**
 * Croix de fermeture, petite et discrète.
 *
 * Les menus se fermaient par un voile, un balayage ou un bouton « Fermer »
 * verbeux — et le joueur cherchait une croix en haut à droite, le geste de
 * n'importe quel téléphone. Le glyphe tient en douze pixels ; la cible, elle,
 * reste à quarante-quatre, plancher tactile de la charte.
 */

type Props = {
  onClose: () => void;
  /** Lu par le lecteur d'écran. */
  label?: string;
  className?: string;
};

export function MenuClose({ onClose, label = "Fermer", className = "" }: Props) {
  return (
    <button
      type="button"
      className={`menu-close${className ? ` ${className}` : ""}`}
      onClick={onClose}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
        <path
          d="M2 2l8 8M10 2L2 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
