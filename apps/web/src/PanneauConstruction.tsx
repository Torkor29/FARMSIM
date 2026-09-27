import { useEffect, useMemo, useRef } from "react";
import {
  ESPECES,
  GUILDES,
  HABITATS,
  INFOS_GUILDE,
  POLLINISATION_SAUVAGE_MAX,
  REGULATION_MAX,
  type Guilde,
  type Habitat,
  PRIX_COUPE,
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

export type BiodiversiteVue = {
  score: number;
  libelle: string;
  scoreCible: number;
  faune: Record<Guilde, number>;
  cible: Record<Guilde, number>;
  casesNature?: number;
  aideParJour?: number;
  /** Le carnet de nature : code → date de première observation. */
  carnet?: Record<string, string>;
};

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
  /** La biodiversité de la ferme : ce qui y vit, et où la faune va. */
  biodiversite?: BiodiversiteVue | null;
  /** Les habitats présents, pour la légende de la carte. */
  habitats?: { id: Habitat; surface: number }[];
  carteHabitats?: boolean;
  onCarteHabitats?: () => void;
  onCarnet?: () => void;
  selection: SelectionConstruction | null;
  onDeplacer: () => void;
  onTourner: () => void;
  onRetirer: () => void;
  onFiche: () => void;
  onQuitter: () => void;
  mobile: boolean;
};

/** Les catégories ont leur pictogramme ; un élément, sa vignette 3D ; un bâtiment, son illustration. */
const ICONE_CATEGORIE: Record<CategorieConstruction, string> = {
  TERRAFORMAGE: "terraformage",
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
  // Une vignette rendue depuis le modèle 3D du jeu : voir `scripts/vignettes/`.
  return `/assets/icons/catalogue/${d.id}.webp`;
}

function prixAffiche(d: DefConstruction): string {
  // Couper rapporte : la scierie paie la case.
  if (d.regle === "COUPE") return `+${PRIX_COUPE} €/case`;
  if (d.pose === "TERRAIN") return d.prix ? `${d.prix} €/case` : "gratuit";
  if (d.pose === "OUTIL") return "gratuit";
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
        {p.biodiversite && (
          <button
            type="button"
            className={`construction-bio${p.carteHabitats ? " on" : ""}`}
            title="La biodiversité : ce qui vit sur votre ferme. Touchez pour la carte des habitats."
            onClick={p.onCarteHabitats}
          >
            🐝 {p.biodiversite.score} · {p.biodiversite.libelle}
            {p.biodiversite.scoreCible > p.biodiversite.score + 1 && <em> ↗ {p.biodiversite.scoreCible}</em>}
          </button>
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

      {p.carteHabitats && p.biodiversite && (
        <FicheBiodiversite bio={p.biodiversite} habitats={p.habitats ?? []} onCarnet={p.onCarnet} />
      )}

      <div className="construction-elements" role="listbox" aria-label="Éléments">
        {p.categorie === "TERRAFORMAGE" && (
          <div className="construction-aide-terrain">
            Le terraformage se fait dans la campagne, autour de votre ferme — au-delà des lots à vendre. Creusez à
            main levée une mare ou une rivière, montez des buttes, puis prenez les Berges pour arrondir un coin.
          </div>
        )}
        {p.categorie === "TERRAIN" && (
          <div className="construction-aide-terrain">
            Survolez la friche dorée : chaque lot à vendre y affiche son prix. Un clic l'achète — avec ce que vous
            avez façonné dessus dans la campagne.
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

/**
 * La fiche de la biodiversité : les cinq groupes de faune, chacun avec sa
 * population et la cible vers laquelle il va, la légende de la carte, et un
 * conseil pour le groupe le plus en retard.
 */
const pct = (v: number) => (Math.round(v * 1000) / 10).toLocaleString("fr-FR");

function FicheBiodiversite({
  bio,
  habitats,
  onCarnet,
}: {
  bio: BiodiversiteVue;
  habitats: { id: Habitat; surface: number }[];
  onCarnet?: () => void;
}) {
  const retard = [...GUILDES].sort((a, b) => bio.cible[a] - bio.cible[b])[0]!;
  return (
    <div className="bio-fiche">
      <div className="bio-guildes">
        {GUILDES.map((g) => (
          <div key={g} className="bio-guilde" title={`${INFOS_GUILDE[g].qui} — aiment ${INFOS_GUILDE[g].aime}`}>
            <span className="bio-nom">
              {INFOS_GUILDE[g].icone} {INFOS_GUILDE[g].nom}
            </span>
            <span className="bio-barre">
              <i style={{ width: `${bio.faune[g]}%` }} />
              <b style={{ left: `${bio.cible[g]}%` }} />
            </span>
            <small>
              {Math.round(bio.faune[g])}
              {bio.cible[g] > bio.faune[g] + 1 ? ` → ${Math.round(bio.cible[g])}` : ""}
            </small>
          </div>
        ))}
      </div>
      {habitats.length > 0 && (
        <div className="bio-legende">
          {habitats.map((h) => (
            <span key={h.id}>
              <i style={{ background: HABITATS[h.id].couleur }} />
              {HABITATS[h.id].nom} <small>{Math.round(h.surface)}</small>
            </span>
          ))}
        </div>
      )}
      <p className="bio-effets">
        <span title="Colza et pois, près des fleurs">
          🌼 Pollinisation jusqu'à +{pct(POLLINISATION_SAUVAGE_MAX * (bio.faune.POLLINISATEURS / 100))} %
        </span>
        <span title="Toute culture, près des haies et des abris">
          🐞 Régulation jusqu'à +{pct(REGULATION_MAX * ((0.6 * bio.faune.AUXILIAIRES + 0.4 * bio.faune.OISEAUX) / 100))} %
        </span>
        {bio.aideParJour !== undefined && (
          <span title="Aides agro-environnementales : chaque case de campagne aménagée, pondérée par la santé de la faune">
            🌿 Aides {bio.aideParJour.toLocaleString("fr-FR")} €/jour · {bio.casesNature ?? 0} cases de campagne aménagées
          </span>
        )}
      </p>
      {onCarnet && (
        <button type="button" className="bio-carnet" onClick={onCarnet}>
          📖 Carnet de nature · {Object.keys(bio.carnet ?? {}).length} / {ESPECES.length} espèces
        </button>
      )}
      <p className="bio-conseil">
        Pour les {INFOS_GUILDE[retard].nom.toLowerCase()} ({INFOS_GUILDE[retard].qui}) : {INFOS_GUILDE[retard].aime}. La
        mosaïque compte — plusieurs habitats qui se touchent valent mieux qu'un seul, étendu.
      </p>
    </div>
  );
}
