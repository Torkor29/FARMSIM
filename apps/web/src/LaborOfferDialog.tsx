import { useEffect, useMemo, useRef, useState } from "react";
import {
  WORK_LABELS,
  laborExtras,
  laborOfferBounds,
  suggestedLaborOffer,
  type CropCode,
  type FarmWork,
} from "@farmsim/shared";

/**
 * Demander de l'aide — en fixant soi-même le prix.
 *
 * Le bouton publiait une annonce à un tarif imposé, calculé sur le barème de
 * l'entreprise. Un testeur l'a dit sans détour : « tu demandes aux autres
 * joueurs en envoyant une demande, et c'est toi-même qui doit fixer le prix,
 * pourquoi ça serait un prix gigantesque comme ça ». Il a raison — une
 * annonce, c'est un prix qu'on propose, pas un prix qu'on subit. C'est aussi
 * la seule façon de rendre l'entraide vivante : trop bas, personne ne vient ;
 * généreux, quelqu'un lâche son propre chantier pour venir.
 *
 * Ce que le joueur écrit va **en entier** au joueur qui prend le chantier. Il
 * n'y a pas de commission, et il ne doit pas y en avoir : une retenue
 * invisible ferait mentir le chiffre qu'on vient d'écrire.
 *
 * Les intrants, eux, ne se négocient pas — la semence est semée dans son
 * champ, et il la paie déjà quand il sème lui-même. Ils sont donc montrés à
 * part, jamais fondus dans le prix : c'est précisément la confusion qui
 * faisait paraître l'entraide deux fois plus chère qu'elle ne l'est.
 */
type Props = {
  open: boolean;
  work: FarmWork;
  cells: number;
  crop?: CropCode;
  /** Ce que le joueur a en caisse, pour ne pas proposer l'impossible. */
  purse: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (offerCrd: number) => void;
};

export function LaborOfferDialog({
  open,
  work,
  cells,
  crop,
  purse,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const repere = useMemo(() => suggestedLaborOffer(work, cells), [work, cells]);
  const bornes = useMemo(() => laborOfferBounds(work, cells), [work, cells]);
  const intrants = useMemo(() => laborExtras(work, cells, crop), [work, cells, crop]);

  // La saisie reste du texte : un `number` remis à zéro à chaque frappe
  // invalide efface ce que le joueur est en train d'écrire.
  const [saisie, setSaisie] = useState(String(repere));
  const champ = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setSaisie(String(repere));
    champ.current?.focus();
    champ.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, repere, onCancel]);

  if (!open) return null;

  const brut = Number.parseInt(saisie, 10);
  const propose = Number.isFinite(brut) ? brut : 0;
  const horsBornes =
    propose < bornes.min
      ? `Au moins ${bornes.min} TRN — en dessous, personne ne se déplace.`
      : propose > bornes.max
        ? `Au plus ${bornes.max} TRN pour ce chantier.`
        : null;
  const total = propose + intrants;
  const tropCher = total > purse;
  const bloque = Boolean(horsBornes) || tropCher || busy;

  return (
    <div
      className="confirm-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offre-title"
      onClick={onCancel}
    >
      <div className="confirm-card glass offer-card" onClick={(e) => e.stopPropagation()}>
        <h3 id="offre-title">
          {WORK_LABELS[work]} · {cells} case{cells > 1 ? "s" : ""}
        </h3>
        <p className="confirm-detail">
          Votre annonce part à tous les joueurs. Le premier qui la prend fait le travail et
          touche la totalité de votre prix.
        </p>

        <label className="offer-field">
          <span>Votre prix (TRN)</span>
          <input
            ref={champ}
            type="number"
            inputMode="numeric"
            value={saisie}
            min={bornes.min}
            max={bornes.max}
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !bloque) onConfirm(propose);
            }}
          />
        </label>
        <p className="offer-hint">
          Autour de {repere} TRN pour ce travail — libre à vous de payer moins, ou plus pour
          qu'on vienne vite.
        </p>

        <dl className="offer-bill">
          <div>
            <dt>Votre prix</dt>
            <dd>{Math.max(0, propose)} TRN</dd>
          </div>
          {intrants > 0 && (
            <div>
              <dt>{work === "PLANT" ? "Semence" : "Engrais"}</dt>
              <dd>{intrants} TRN</dd>
            </div>
          )}
          <div className="offer-total">
            <dt>Mis de côté</dt>
            <dd>{Math.max(0, total)} TRN</dd>
          </div>
        </dl>

        <p className="offer-hint">
          Rendu en entier si personne ne prend le chantier, ou si vous l'annulez.
        </p>
        {horsBornes && <p className="offer-warn">{horsBornes}</p>}
        {!horsBornes && tropCher && (
          <p className="offer-warn">Il vous manque {total - purse} TRN.</p>
        )}

        <div className="confirm-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="confirm-go"
            disabled={bloque}
            onClick={() => onConfirm(propose)}
          >
            Envoyer la demande
          </button>
        </div>
      </div>
    </div>
  );
}
