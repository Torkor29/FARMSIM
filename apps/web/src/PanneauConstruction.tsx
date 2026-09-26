import { useEffect, useMemo, useRef } from "react";
import {
  BUILDING_ART,
  CATEGORIES,
  catalogueConstruction,
  verrouConstruction,
  type CategorieConstruction,
  type BuildingType,
  type DefConstruction,
} from "@farmsim/shared";
import "./construction.css";

/**
 * Le panneau du mode construction.
 *
 * Une barre, pas une fenêtre : la ferme reste visible en entier pendant qu'on
 * l'aménage, et tout se fait en deux gestes — choisir, poser. Les catégories
 * en haut, leurs éléments dessous, une ligne d'état qui dit ce qui va se
 * passer (ou pourquoi ça ne se peut pas), et les actions de l'élément choisi.
 */

export type SelectionConstruction =
  | { kind: "OBJET"; id: string; nom: string; revente: number; tournable: boolean }
  | { kind: "BATIMENT"; id: string; nom: string };

type Props = {
  categorie: CategorieConstruction;
  onCategorie: (c: CategorieConstruction) => void;
  /** L'élément armé, par identifiant du catalogue. */
  arme: string | null;
  onChoisir: (def: DefConstruction) => void;
  niveau: number;
  argent: number;
  /** Ce que dit la ligne d'état, et si c'est un refus. */
  etat: { texte: string; refus?: boolean; cout?: number | null };
  charme: { valeur: number; libelle: string } | null;
  selection: SelectionConstruction | null;
  onDeplacer: () => void;
  onTourner: () => void;
  onRetirer: () => void;
  onFiche: () => void;
  onQuitter: () => void;
  mobile: boolean;
};

/** Les catégories et le décor ont leur icône du jeu ; un bâtiment, son illustration. */
const ICONE_CATEGORIE: Record<CategorieConstruction, string> = {
  TERRAIN: "terrain",
  AGRICULTURE: "agriculture",
  BATIMENTS: "batiments",
  ELEVAGE: "elevage",
  NATURE: "nature",
  CHEMINS: "chemins",
  DECORATION: "decoration",
};

export function iconeConstruction(d: DefConstruction): string {
  if (d.pose === "BATIMENT" && d.batiment) return BUILDING_ART[d.batiment as BuildingType];
  return `/assets/icons/jeu/${d.id}.svg`;
}

function prixAffiche(d: DefConstruction): string {
  if (d.pose === "TERRAIN") return d.prix ? `${d.prix} €/case` : "gratuit";
  return `${d.prix.toLocaleString("fr-FR")} €`;
}

export function PanneauConstruction(p: Props) {
  const racine = useRef<HTMLElement | null>(null);
  /* Sa hauteur, pour que la barre de pose d'un bâtiment se tienne au-dessus
     plutôt que dessous : elle change avec la largeur et la ligne d'état. */
  useEffect(() => {
    const el = racine.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const doc = document.documentElement;
    const ro = new ResizeObserver(() => doc.style.setProperty("--construction-h", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      doc.style.removeProperty("--construction-h");
    };
  }, []);
  const elements = useMemo(
    () => catalogueConstruction().filter((d) => d.categorie === p.categorie),
    [p.categorie],
  );
  return (
    <section
      ref={racine}
      className={`construction-panneau glass${p.mobile ? " mobile" : ""}`}
      aria-label="Construction"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <header className="construction-tete">
        <strong className="construction-titre">Construction</strong>
        {p.charme && (
          <span className="construction-charme" title="Ce que le décor dit de votre ferme">
            ✿ {p.charme.valeur} · {p.charme.libelle}
          </span>
        )}
        <button type="button" className="construction-fin" onClick={p.onQuitter}>
          Terminer
          {!p.mobile && <kbd>Échap</kbd>}
        </button>
      </header>

      <nav className="construction-onglets" role="tablist">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={p.categorie === c.id}
            className={p.categorie === c.id ? "on" : ""}
            onClick={() => p.onCategorie(c.id)}
          >
            <img src={`/assets/icons/jeu/${ICONE_CATEGORIE[c.id]}.svg`} alt="" width={24} height={24} />
            <span>{c.nom}</span>
          </button>
        ))}
      </nav>

      <div className="construction-elements" role="listbox" aria-label="Éléments">
        {p.categorie === "TERRAIN" && (
          <div className="construction-aide-terrain">
            Survolez la friche dorée : chaque lot à vendre y affiche son prix. Un clic l'achète.
          </div>
        )}
        {elements.map((d) => {
          const verrou = verrouConstruction(d, { level: p.niveau });
          const cher = d.pose !== "TERRAIN" && d.prix > p.argent;
          return (
            <button
              key={d.id}
              type="button"
              role="option"
              aria-selected={p.arme === d.id}
              className={`construction-carte${p.arme === d.id ? " on" : ""}${verrou ? " verrou" : ""}${cher ? " cher" : ""}`}
              disabled={Boolean(verrou)}
              title={verrou ?? d.description}
              onClick={() => p.onChoisir(d)}
            >
              <span className="construction-icone" aria-hidden="true">
                <img src={iconeConstruction(d)} alt="" width={48} height={48} loading="lazy" />
              </span>
              <span className="construction-nom">{d.nom}</span>
              <span className="construction-prix">{verrou ?? prixAffiche(d)}</span>
              {d.effet && !verrou && <span className="construction-effet">{d.effet.libelle}</span>}
            </button>
          );
        })}
      </div>

      <footer className="construction-pied">
        <p className={`construction-etat${p.etat.refus ? " refus" : ""}`} role="status" aria-live="polite">
          {p.etat.texte}
          {p.etat.cout != null && p.etat.cout > 0 && (
            <strong className="construction-cout"> · {p.etat.cout.toLocaleString("fr-FR")} €</strong>
          )}
        </p>
        {p.selection ? (
          <div className="construction-actions">
            <span className="construction-choisi">{p.selection.nom}</span>
            <button type="button" onClick={p.onDeplacer}>
              Déplacer
            </button>
            {(p.selection.kind === "BATIMENT" || p.selection.tournable) && (
              <button type="button" onClick={p.onTourner}>
                Tourner
              </button>
            )}
            {p.selection.kind === "OBJET" ? (
              <button type="button" className="danger" onClick={p.onRetirer}>
                Retirer (+{p.selection.revente} €)
              </button>
            ) : (
              <button type="button" onClick={p.onFiche}>
                Fiche
              </button>
            )}
          </div>
        ) : (
          !p.mobile && (
            <span className="construction-touches">
              <kbd>R</kbd> tourner · <kbd>Échap</kbd> annuler · glissez pour peindre le terrain
            </span>
          )
        )}
      </footer>
    </section>
  );
}
