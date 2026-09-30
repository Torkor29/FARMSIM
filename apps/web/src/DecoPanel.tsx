import { useMemo, useState } from "react";
import {
  CATEGORIES_DECO,
  DECO_CATALOGUE,
  TEINTES_DECO,
  articleDeco,
  prixRevente,
  type ArticleDeco,
  type CategorieDeco,
  type Decoration,
} from "@farmsim/shared";

/**
 * Le catalogue de décoration — une barre en bas de l'écran, comme le mode
 * construction des Sims : la scène reste visible et cliquable au-dessus.
 *
 * Deux états :
 * - **rien de touché** : les rayons du catalogue ; choisir un article le met
 *   en main (le fantôme suit le pointeur dans la vue) ;
 * - **une décoration touchée** : la déplacer, la tourner, la repeindre, la
 *   revendre.
 */

export type MainDeco = {
  article: ArticleDeco;
  rot: number;
  teinte?: number;
  /** La décoration qu'on déplace, si c'en est une. */
  deplace: string | null;
};

type Props = {
  niveau: number;
  argent: number;
  illimite: boolean;
  decorations: readonly Decoration[];
  main: MainDeco | null;
  selection: string | null;
  raison: string | null;
  busy: boolean;
  onPrendre: (main: MainDeco | null) => void;
  onTourner: (delta: number) => void;
  onTeinte: (teinte: number | undefined) => void;
  onDeplacer: (id: string) => void;
  onTournerPosee: (id: string, delta: number) => void;
  onTeintePosee: (id: string, teinte: number | undefined) => void;
  onVendre: (id: string) => void;
  onDeselectionner: () => void;
  onFermer: () => void;
};

const QUART = Math.PI / 4;

function euros(n: number): string {
  return `${n.toLocaleString("fr-FR")} €`;
}

export function DecoPanel(p: Props) {
  const [rayon, setRayon] = useState<CategorieDeco>("JARDIN");
  const articles = useMemo(() => DECO_CATALOGUE.filter((a) => a.categorie === rayon), [rayon]);
  const posee = p.selection ? p.decorations.find((d) => d.id === p.selection) : undefined;
  const articlePose = posee ? articleDeco(posee.code) : undefined;

  return (
    <section className="deco-barre" aria-label="Décorer la ferme">
      <header className="deco-tete">
        <strong>Décorer</strong>
        <span className="deco-aide">
          {p.main
            ? p.main.deplace
              ? "Cliquez où le reposer · R pour tourner · Échap pour annuler"
              : "Cliquez pour poser · R pour tourner · Échap pour lâcher"
            : "Choisissez un objet, ou touchez une décoration posée"}
        </span>
        <span className="deco-compte">{p.decorations.length} posée(s)</span>
        <button type="button" className="deco-fermer" onClick={p.onFermer} aria-label="Fermer la décoration">
          ×
        </button>
      </header>

      {posee && articlePose && !p.main ? (
        <div className="deco-fiche">
          <div className="deco-fiche-nom">
            <strong>{articlePose.nom}</strong>
            <span className="muted tiny">Revente {euros(prixRevente(articlePose))}</span>
          </div>
          <div className="deco-actions">
            <button type="button" className="chip" disabled={p.busy} onClick={() => p.onDeplacer(posee.id)}>
              Déplacer
            </button>
            <button type="button" className="chip" disabled={p.busy} onClick={() => p.onTournerPosee(posee.id, QUART)}>
              ↻ Tourner
            </button>
            <button type="button" className="chip" disabled={p.busy} onClick={() => p.onTournerPosee(posee.id, -QUART)}>
              ↺
            </button>
            <button type="button" className="chip deco-vendre" disabled={p.busy} onClick={() => p.onVendre(posee.id)}>
              Vendre
            </button>
            <button type="button" className="chip" onClick={p.onDeselectionner}>
              Retour au catalogue
            </button>
          </div>
          {articlePose.teinte && (
            <Nuancier
              teinte={posee.teinte}
              disabled={p.busy}
              onChoix={(t) => p.onTeintePosee(posee.id, t)}
            />
          )}
        </div>
      ) : (
        <>
          <nav className="deco-rayons" role="tablist">
            {CATEGORIES_DECO.map((c) => (
              <button
                key={c.code}
                type="button"
                role="tab"
                aria-selected={rayon === c.code}
                className={rayon === c.code ? "on" : ""}
                onClick={() => setRayon(c.code)}
              >
                {c.nom}
              </button>
            ))}
          </nav>
          <ul className="deco-articles">
            {articles.map((a) => {
              const verrou = p.niveau < a.niveau;
              const cher = !p.illimite && p.argent < a.prix;
              const enMain = p.main?.article.code === a.code && !p.main.deplace;
              return (
                <li key={a.code}>
                  <button
                    type="button"
                    className={`deco-article${enMain ? " on" : ""}`}
                    disabled={verrou || cher}
                    title={verrou ? `Niveau ${a.niveau} requis` : cher ? "Pas assez d'argent" : a.nom}
                    onClick={() =>
                      p.onPrendre(enMain ? null : { article: a, rot: 0, teinte: undefined, deplace: null })
                    }
                  >
                    <img
                      src={`/assets/decor3d/vignettes/${a.code}.webp`}
                      alt=""
                      loading="lazy"
                      onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")}
                    />
                    <span className="deco-nom">{a.nom}</span>
                    <span className="deco-prix">{verrou ? `Niv. ${a.niveau}` : euros(a.prix)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {p.main && (
            <div className="deco-main">
              <span className={`deco-etat${p.raison ? " non" : ""}`}>
                {p.raison ?? `${p.main.article.nom} en main`}
              </span>
              <button type="button" className="chip" onClick={() => p.onTourner(QUART)}>
                ↻
              </button>
              <button type="button" className="chip" onClick={() => p.onTourner(-QUART)}>
                ↺
              </button>
              {p.main.article.teinte && !p.main.deplace && (
                <Nuancier teinte={p.main.teinte} onChoix={p.onTeinte} />
              )}
              <button type="button" className="chip" onClick={() => p.onPrendre(null)}>
                {p.main.deplace ? "Annuler" : "Lâcher"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Nuancier({
  teinte,
  disabled,
  onChoix,
}: {
  teinte: number | undefined;
  disabled?: boolean;
  onChoix: (t: number | undefined) => void;
}) {
  return (
    <div className="deco-nuancier" role="radiogroup" aria-label="Couleur">
      <button
        type="button"
        role="radio"
        aria-checked={teinte == null}
        className={`deco-pastille origine${teinte == null ? " on" : ""}`}
        title="Couleur d'origine"
        disabled={disabled}
        onClick={() => onChoix(undefined)}
      />
      {TEINTES_DECO.map((t, i) => (
        <button
          key={t.nom}
          type="button"
          role="radio"
          aria-checked={teinte === i}
          className={`deco-pastille${teinte === i ? " on" : ""}`}
          style={{ background: t.hex }}
          title={t.nom}
          disabled={disabled}
          onClick={() => onChoix(i)}
        />
      ))}
    </div>
  );
}
