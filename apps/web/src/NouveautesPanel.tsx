import { useEffect, useRef } from "react";
import type { Nouveaute } from "@farmsim/shared";
import { MenuClose } from "./ui/MenuClose";

/**
 * « Quoi de neuf » — ce qui a changé depuis la dernière visite.
 *
 * ## Le signalement
 *
 * « Je te fais pas de retour parce que tu m'en fais pas sur ce que tu as
 * modifié. »
 *
 * C'est une boucle de retour cassée, et elle coûte cher : un testeur qui
 * ignore ce qui a bougé ne peut ni vérifier la correction qu'il a demandée, ni
 * distinguer un nouveau défaut d'un ancien qu'il n'avait pas vu. Il se tait.
 *
 * ## Pourquoi il s'ouvre tout seul
 *
 * Un lien dans un menu n'aurait rien réglé : personne ne va chercher une
 * nouvelle dont il ignore l'existence. Le panneau s'ouvre donc une fois, à
 * l'arrivée, quand il y a réellement quelque chose à dire — et jamais sur un
 * compte neuf, à qui l'historique ne raconterait rien.
 *
 * Il ne se ferme pas d'un clic à côté, contrairement à la fiche d'une parcelle
 * voisine. Un écran qu'on balaie par mégarde ne serait pas lu, et il ne
 * reviendra pas.
 */
export function NouveautesPanel({
  nouveautes,
  onFermer,
}: {
  nouveautes: readonly Nouveaute[];
  onFermer: () => void;
}) {
  const bouton = useRef<HTMLButtonElement | null>(null);
  /* La fermeture arrive en lambda : son identité change à chaque rendu du
     parent, et la garder dans les dépendances relancerait le `focus()` à
     chaque sondage du serveur, arrachant le curseur au passage. */
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    if (!nouveautes.length) return;
    bouton.current?.focus();
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    window.addEventListener("keydown", auClavier);
    return () => window.removeEventListener("keydown", auClavier);
  }, [nouveautes.length]);

  if (!nouveautes.length) return null;

  return (
    <div className="voisin-backdrop" role="dialog" aria-modal="true" aria-labelledby="neuf-titre">
      <div className="voisin-card glass neuf-card">
        <header className="voisin-tete">
          <div>
            <h3 id="neuf-titre">Quoi de neuf</h3>
            <p className="muted tiny">
              {nouveautes.length === 1
                ? "Un changement depuis votre dernière partie"
                : `${nouveautes.length} changements depuis votre dernière partie`}
            </p>
          </div>
          <MenuClose onClose={onFermer} />
        </header>

        <ul className="neuf-liste">
          {nouveautes.map((n) => (
            <li key={n.id} className="neuf-entree">
              <strong className="neuf-titre">{n.titre}</strong>
              <p className="neuf-texte">{n.texte}</p>
            </li>
          ))}
        </ul>

        {/*
          Le mot qui ferme la boucle.

          Le panneau dit ce qui a changé ; il doit aussi dire qu'on attend un
          retour dessus, sans quoi on aurait réglé la moitié du problème —
          celle de l'information — et laissé l'autre entière.
        */}
        <p className="neuf-appel muted tiny">
          Si quelque chose ne va pas là-dedans, dites-le : c'est exactement ce
          qu'on cherche à savoir.
        </p>

        <button ref={bouton} type="button" className="voisin-acheter" onClick={onFermer}>
          J'ai lu
        </button>
      </div>
    </div>
  );
}
