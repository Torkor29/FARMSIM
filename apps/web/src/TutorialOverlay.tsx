import { useEffect, useState } from "react";

import { TUTORIAL_KEY } from "./storage-keys";

type Step = {
  id: string;
  title: string;
  body: string;
  hint?: string;
};

const STEPS: Step[] = [
  {
    id: "welcome",
    title: "Bienvenue chez vous",
    body: "Voici votre parcelle, vue du ciel. Les cases s’illuminent quand vous les survolez et quand vous les sélectionnez.",
    hint: "Le bouton ? en haut à gauche rejoue ce tutoriel à tout moment",
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
    body: "Outil Récolte + cases mûres (dorées) + OK. Sans moissonneuse, le bouton « Faire venir une ETA » fait le travail pour vous, contre paiement.",
    hint: "Pluie = grain humide → bouton Sécher dans le Bureau",
  },
  {
    id: "build",
    title: "5 — Construire",
    body: "Menu Bâtiments à droite → choisissez un type → survolez la grille : l’emprise s’affiche en vert (OK) ou rouge (bloqué) → cliquez pour placer.",
    hint: "Le fantôme montre TOUTES les cases occupées",
  },
  {
    id: "sell",
    title: "6 — Vendre et s’agrandir",
    body: "Le bouton Bureau ouvre votre stock, le marché, vos contrats et l’achat de terres. Une ETA — Entreprise de Travaux Agricoles — travaille les champs des autres : vous pouvez en faire venir une, ou en devenir une.",
    hint: "Terres voisines = bonus de rendement · terres dans l’autre hémisphère = récoltes toute l’année",
  },
  {
    id: "climate",
    title: "7 — Climat et saisons",
    body: "Le panneau de droite indique votre ville, votre climat et la saison en cours. Une saison dure 15 minutes et change les rendements.",
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
