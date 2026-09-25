import { useEffect, useRef } from "react";
import {
  CROP_DEFS,
  SPECIES,
  formatEuros,
  hectaresDeGrille,
  libelleDeTaille,
  peutRacheter,
  type CropCode,
} from "@farmsim/shared";
import type { VoisinReel } from "./countryside-plan";
import { MenuClose } from "./ui/MenuClose";
import { Portail } from "./ui/Portail";

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
  /** Rejoindre une parcelle qu'on possède déjà, au lieu de l'impasse d'avant. */
  onAller?: (id: string) => void;
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

export function ParcelleVoisineSheet({
  voisin,
  enCours = false,
  onAcheter,
  onAller,
  onFermer,
}: Props) {
  const premier = useRef<HTMLButtonElement | null>(null);
  /* La fermeture arrive en lambda : son identité change à chaque rendu du
     parent. La garder dans les dépendances relançait l'effet — et donc le
     `focus()` — à chaque sondage de prix, arrachant le curseur au passage. */
  const fermer = useRef(onFermer);
  fermer.current = onFermer;

  useEffect(() => {
    if (!voisin) return;
    premier.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [voisin]);

  if (!voisin) return null;

  const culture = nomCulture(voisin.culture);
  const stade = voisin.stade ? STADES[voisin.stade] : null;
  const aVendre = peutRacheter(voisin.statut);

  /*
   * Le titre dit d'abord à qui c'est. Une parcelle libre s'achète, un voisin
   * PNJ cède la sienne, un autre joueur ne s'expulse pas.
   */
  const tenue =
    voisin.statut === "MOI"
      ? "À moi"
      : voisin.statut === "LIBRE"
        ? "À vendre"
        : voisin.statut === "PNJ"
          ? `${voisin.proprietaire ?? "Voisin"} · à vendre`
          : (voisin.proprietaire ?? "Exploitée");

  return (
    <Portail>
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
            <MenuClose onClose={onFermer} />
          </header>

          <dl className="voisin-faits">
            {/* La surface d'abord : c'est ce qui change d'un lot à l'autre
                depuis que les parcelles n'ont plus toutes la même taille, et
                c'est ce qui explique l'écart de prix plus bas. */}
            {voisin.gridW != null && voisin.gridH != null && (
              <div>
                <dt>Surface</dt>
                <dd>
                  {hectaresDeGrille(voisin.gridW, voisin.gridH).toLocaleString("fr-FR")} ha
                  <span className="voisin-stade">
                    {" "}
                    · {libelleDeTaille(voisin.gridW, voisin.gridH)}
                  </span>
                </dd>
              </div>
            )}
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
            /* La terre du pays ne se vend plus à la parcelle : la ferme grandit
               d'un seul tenant, autour d'elle. La fiche y renvoie plutôt que
               de laisser croire qu'un bouton manque. */
            <div className="voisin-marche">
              <p className="voisin-refus">
                Cette terre n'est pas à vendre. Votre ferme grandit d'un seul tenant : achetez la friche
                qui l'entoure, lot par lot, aussi loin que vous voulez.
              </p>
              <button
                ref={premier}
                type="button"
                className="voisin-acheter"
                disabled={enCours}
                onClick={() => onAcheter(voisin.id)}
              >
                Agrandir ma ferme
              </button>
            </div>
          ) : voisin.statut === "MOI" ? (
            /* L'impasse d'avant. « Cette parcelle est déjà la vôtre » était vrai
               et sans issue : il fallait fermer la fiche et repasser par les
               pastilles du rail pour y aller. */
            <button
              ref={premier}
              type="button"
              /* La même classe que « Agrandir ma ferme » : c'est le même
                 geste au même endroit de la fiche, il doit avoir la même tenue.
                 Inventer une classe qui n'existe pas dans la feuille rendrait un
                 bouton nu. */
              className="voisin-acheter"
              onClick={() => onAller?.(voisin.id)}
              disabled={!onAller}
            >
              Aller sur cette parcelle
            </button>
          ) : (
            <p className="voisin-refus">
              {voisin.exploitation ?? "Cette exploitation"} la travaille. Elle ne sera à reprendre que
              le jour où elle sera cédée.
            </p>
          )}
        </div>
      </div>
    </Portail>
  );
}
