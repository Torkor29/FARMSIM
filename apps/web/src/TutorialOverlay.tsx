import { useEffect, useMemo, useState } from "react";

import { TUTORIAL_KEY } from "./storage-keys";
import { TutorialScene } from "./TutorialScenes";
import { ETAPES } from "./tutorial-steps";
import { MenuClose } from "./ui/MenuClose";

/**
 * Le tutoriel : quatorze étapes montrées, contre huit décrites.
 *
 * ## Ce qui n'allait pas
 *
 * « Le tuto est beaucoup trop court, il ne montre pas du tout les sections,
 * les outils, ce qu'il faut faire pour planter, pour nettoyer. » Le reproche
 * est exact, et il vise deux choses distinctes.
 *
 * **Il ne montrait rien.** Huit paragraphes de texte pour un jeu qui se joue
 * au doigt sur une grille. « Touchez des cases nues, puis le bouton d'or
 * Faire » est une phrase juste et inutilisable : on n'a jamais vu le bouton
 * d'or. Chaque étape porte maintenant une petite scène animée où le geste se
 * fait tout seul, en boucle.
 *
 * **Il sautait la moitié du jeu.** Rien sur la barre d'outils — qu'il faut
 * pourtant régler *avant* de toucher une case —, rien sur le désherbage ni le
 * déchaumage, rien sur le troupeau, rien sur le personnel. Un joueur qui
 * suivait le tutoriel jusqu'au bout ignorait quatre des six onglets.
 *
 * ## Le geste dépend de l'écran
 *
 * On glisse à la souris, on tapote au doigt. Montrer un lasso à quelqu'un qui
 * joue au téléphone, c'est lui montrer ce qu'il ne peut pas faire. Le texte
 * *et* l'animation changent donc selon l'appareil.
 *
 * ## Quand il s'ouvre
 *
 * À l'arrivée sur la ferme, pas à la connexion : voir `App.tsx`. Il se
 * déclenchait dès qu'un joueur existait, c'est-à-dire pendant l'installation,
 * derrière l'écran qui la mène — et il ne revenait jamais.
 */

type Props = {
  open: boolean;
  onClose: () => void;
};

/** L'écran répond-il au doigt ? Le tutoriel montre alors d'autres gestes. */
function useTactile(): boolean {
  return useMemo(() => {
    try {
      return window.matchMedia("(pointer: coarse)").matches;
    } catch {
      return false;
    }
  }, []);
}

export function TutorialOverlay({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const tactile = useTactile();

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  /**
   * Les flèches et Échap.
   *
   * Quatorze étapes se parcourent au clavier ou pas du tout : cliquer
   * « Suivant » treize fois est ce qui fait fermer un tutoriel.
   */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setStep((x) => Math.min(ETAPES.length - 1, x + 1));
      else if (e.key === "ArrowLeft") setStep((x) => Math.max(0, x - 1));
      else if (e.key === "Escape") finir();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const s = ETAPES[step]!;
  const dernier = step >= ETAPES.length - 1;

  function finir() {
    try {
      localStorage.setItem(TUTORIAL_KEY, "1");
    } catch {
      /* navigation privée : le tutoriel reviendra, ce n'est pas grave */
    }
    onClose();
  }

  return (
    <div className="tutorial-backdrop" role="dialog" aria-modal="true" aria-labelledby="tut-title">
      <div className="tutorial-card glass">
        <MenuClose onClose={finir} label="Fermer le tutoriel" />

        <p className="tutorial-chapitre">{s.chapitre}</p>
        <h2 id="tut-title">{s.titre}</h2>

        <TutorialScene scene={s.scene} tactile={tactile} />

        <p className="tutorial-body">{tactile ? (s.texteTactile ?? s.texte) : s.texte}</p>
        {s.astuce && <p className="tutorial-hint">{s.astuce}</p>}

        <div className="tutorial-progress" aria-hidden="true">
          {ETAPES.map((e, i) => (
            <span key={e.id} className={`tutorial-dot ${i <= step ? "on" : ""}`} />
          ))}
        </div>
        <p className="tutorial-step-label">
          Étape {step + 1} / {ETAPES.length}
        </p>

        <div className="tutorial-actions">
          {step > 0 && (
            <button type="button" className="ghost" onClick={() => setStep((x) => x - 1)}>
              Retour
            </button>
          )}
          <button type="button" className="ghost" onClick={finir}>
            Passer
          </button>
          {!dernier ? (
            <button type="button" className="tutorial-next" onClick={() => setStep((x) => x + 1)}>
              Suivant
            </button>
          ) : (
            <button type="button" className="tutorial-next" onClick={finir}>
              Jouer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
