import { useEffect, useRef } from "react";
import { CROP_DEFS, SPECIES, formatEuros, type CropCode } from "@farmsim/shared";
import type { VoisinReel } from "./countryside-plan";

/**
 * La fiche d'une parcelle voisine.
 *
 * On achetait la terre dans un plan en deux dimensions, au fond du Bureau,
 * sans l'avoir jamais vue. C'est le contraire de ce qu'on veut : on achète un
 * champ **parce qu'on l'a regardé**. Cette fiche s'ouvre en cliquant dessus
 * dans le paysage, et dit ce qu'un voisin dirait — à qui c'est, ce qui y
 * pousse, et si c'est à vendre.
 *
 * Elle ne décide rien : l'achat passe par la même route que le plan du Bureau,
 * avec le même devis et les mêmes plafonds.
 */

type Props = {
  voisin: VoisinReel | null;
  /** Achat en cours : le bouton attend plutôt que de se laisser cliquer deux fois. */
  enCours?: boolean;
  onAcheter: (id: string) => void;
  onFermer: () => void;
};

/** Ce que le stade raconte, en français. */
const STADES: Record<string, string> = {
  PREPARED: "terre travaillée",
  PLANTED: "tout juste semé",
  GROWING: "en pousse",
  READY: "à maturité",
  HARVESTED: "moissonné",
  SPOILED: "gâté sur pied",
};

/** Le nom d'une culture, tiré de la table du jeu et non recopié. */
function nomCulture(code: string | null): string | null {
  if (!code) return null;
  return CROP_DEFS[code as CropCode]?.name ?? code;
}

/**
 * Le nom d'une espèce, au pluriel, tiré de la table du jeu.
 *
 * `plural` et non un nom au singulier accordé à la main : un cheptel se compte,
 * et la table porte déjà la forme juste — « six vaches », pas « six vache ».
 */
function nomEspece(kind: string): string {
  return SPECIES[kind as keyof typeof SPECIES]?.plural ?? kind;
}

export function ParcelleVoisineSheet({ voisin, enCours = false, onAcheter, onFermer }: Props) {
  const premier = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!voisin) return;
    premier.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [voisin, onFermer]);

  if (!voisin) return null;

  const culture = nomCulture(voisin.culture);
  const stade = voisin.stade ? STADES[voisin.stade] : null;
  const aVendre = voisin.statut === "LIBRE";

  /*
   * Le titre dit d'abord à qui c'est. C'est la première question qu'on se pose
   * devant le champ du voisin, et celle qui décide de tout le reste : une
   * parcelle libre s'achète, celle d'un exploitant ne s'achète pas.
   */
  const tenue =
    voisin.statut === "MOI"
      ? "À moi"
      : voisin.statut === "LIBRE"
        ? "À vendre"
        : (voisin.proprietaire ?? "Exploitée");

  return (
    <div
      className="voisin-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voisin-titre"
      onClick={onFermer}
    >
      <div className="voisin-card glass" onClick={(e) => e.stopPropagation()}>
        <header className="voisin-tete">
          <div>
            <h3 id="voisin-titre">{voisin.label}</h3>
            <p className={`voisin-tenue s-${voisin.statut.toLowerCase()}`}>{tenue}</p>
          </div>
          <button type="button" className="voisin-fermer" onClick={onFermer} aria-label="Fermer">
            ×
          </button>
        </header>

        <dl className="voisin-faits">
          <div>
            <dt>Culture</dt>
            <dd>
              {culture ? (
                <>
                  {culture}
                  {stade && <span className="voisin-stade"> · {stade}</span>}
                </>
              ) : (
                "en herbe"
              )}
            </dd>
          </div>
          {voisin.partCultivee > 0 && (
            <div>
              <dt>Emblavée</dt>
              <dd>{Math.round(voisin.partCultivee * 100)} %</dd>
            </div>
          )}
          <div>
            <dt>Fertilité</dt>
            <dd>{Math.round(voisin.fertility * 100)} %</dd>
          </div>
          {voisin.batiments.length > 0 && (
            <div>
              <dt>Bâti</dt>
              <dd>
                {voisin.batiments.length} ouvrage{voisin.batiments.length > 1 ? "s" : ""}
              </dd>
            </div>
          )}
          {voisin.cheptel.length > 0 && (
            <div>
              <dt>Cheptel</dt>
              <dd>
                {voisin.cheptel.map((t) => `${t.size} ${nomEspece(t.kind).toLowerCase()}`).join(", ")}
              </dd>
            </div>
          )}
        </dl>

        {aVendre ? (
          <div className="voisin-marche">
            {voisin.prix !== null ? (
              <>
                <p className="voisin-prix">{formatEuros(voisin.prix)}</p>
                {voisin.achetable ? (
                  <button
                    ref={premier}
                    type="button"
                    className="voisin-acheter"
                    disabled={enCours}
                    onClick={() => onAcheter(voisin.id)}
                  >
                    {enCours ? "Achat en cours…" : "Acheter cette parcelle"}
                  </button>
                ) : (
                  <p className="voisin-refus">{voisin.refus ?? "Pas encore accessible."}</p>
                )}
              </>
            ) : (
              /*
               * Le devis ne se calcule que pour les parcelles mitoyennes : il
               * coûte quatre comptages, et une commune entière chiffrée
               * afficherait des prix pour des terres qu'on ne peut pas acheter.
               */
              <p className="voisin-refus">
                Trop loin de vos terres. On n'agrandit qu'en s'étendant de proche en proche.
              </p>
            )}
          </div>
        ) : voisin.statut === "MOI" ? (
          <p className="voisin-refus">Cette parcelle est déjà la vôtre.</p>
        ) : (
          <p className="voisin-refus">
            {voisin.exploitation ?? "Cette exploitation"} la travaille. Elle ne sera à reprendre que
            le jour où elle sera cédée.
          </p>
        )}
      </div>
    </div>
  );
}
