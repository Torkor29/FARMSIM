import { useEffect, useState } from "react";

export const TUTORIAL_KEY = "farmsim_tutorial_v1";

type Step = {
  id: string;
  title: string;
  body: string;
  hint?: string;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Bienvenue sur votre ferme",
    body: "Vous gérez une parcelle en vue isométrique. Les cases s’illuminent au survol et à la sélection.",
    hint: "Suivez les étapes — vous pouvez rejouer le tutoriel dans le menu ?",
  },
  {
    id: "select",
    title: "1 — Outil Inspect",
    body: "Touchez une case pour voir son état (vide, culture, bâtiment, véhicule).",
    hint: "Bouton en bas : icône curseur",
  },
  {
    id: "plant",
    title: "2 — Semer",
    body: "Choisissez Semer, sélectionnez des cases libres (pinceau 1×1 à 3×3), puis validez avec OK.",
    hint: "Il faut un tracteur en bon état (Garage)",
  },
  {
    id: "grow",
    title: "3 — Attendre la croissance",
    body: "Les cultures passent du vert à l’or. La barre de progression est dans le panneau à droite.",
    hint: "~3 min en démo · tick serveur en continu",
  },
  {
    id: "harvest",
    title: "4 — Récolter",
    body: "Outil Récolte + cases mûres (dorées) + OK. Une moissonneuse est obligatoire — achetez-la au Garage.",
    hint: "Pluie = grain humide → bouton Sécher dans ETA",
  },
  {
    id: "build",
    title: "5 — Construire",
    body: "Menu Bâtiments à droite → choisissez un type → survolez la grille : l’emprise s’affiche en vert (OK) ou rouge (bloqué) → cliquez pour placer.",
    hint: "Le fantôme montre TOUTES les cases occupées",
  },
  {
    id: "sell",
    title: "6 — Vendre & expand",
    body: "ETA Presta : stock, marché, missions. Achetez des parcelles voisines sur la carte.",
    hint: "Vous êtes prêt — bonne récolte !",
  },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function TutorialOverlay({ open, onClose }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const s = STEPS[step];
  const last = step >= STEPS.length - 1;

  function finish() {
    localStorage.setItem(TUTORIAL_KEY, "1");
    onClose();
  }

  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tut-title">
      <div className="tutorial-card glass">
        <div className="tutorial-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={`tutorial-dot ${i <= step ? "on" : ""}`} />
          ))}
        </div>
        <p className="tutorial-step-label">
          Étape {step + 1} / {STEPS.length}
        </p>
        <h2 id="tut-title">{s.title}</h2>
        <p className="tutorial-body">{s.body}</p>
        {s.hint && <p className="tutorial-hint">{s.hint}</p>}
        <div className="tutorial-actions">
          {step > 0 && (
            <button type="button" className="ghost" onClick={() => setStep((x) => x - 1)}>
              Retour
            </button>
          )}
          <button type="button" className="ghost" onClick={finish}>
            Passer
          </button>
          {!last ? (
            <button type="button" className="tutorial-next" onClick={() => setStep((x) => x + 1)}>
              Suivant
            </button>
          ) : (
            <button type="button" className="tutorial-next" onClick={finish}>
              Jouer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
