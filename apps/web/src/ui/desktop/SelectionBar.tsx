/**
 * Barre de sélection — coque de bureau.
 *
 * Avant elle, le nombre de cases retenues n'apparaissait que dans un message
 * passager de 3,2 secondes, puis disparaissait : on ne pouvait pas savoir ce
 * qu'on avait sélectionné sans re-cliquer. C'est le bug B-08 de l'audit.
 *
 * Elle occupe toute la largeur de l'écran, ce qui est précisément la place que
 * l'ancienne barre de 576 px n'utilisait pas — les libellés d'action tiennent
 * donc entiers, et ce sont eux qui poussaient les options hors de vue.
 */

import type { Tool } from "../../tools";
import { toolActionLabel } from "../../tools";
import { actsOnSelection } from "../tool-options";

type Props = {
  tool: Tool;
  selectedCount: number;
  readyCount: number;
  busy: boolean;
  /** Devis d'un prestataire pour la sélection, s'il peut intervenir. */
  contractorCost: number | null;
  contractorAffordable: boolean;
  /** Ce qui empêche le prestataire d'intervenir sur cette sélection. */
  contractorBlocage?: string | null;
  /** Mise de côté demandée pour publier une offre d'aide. */
  laborQuote: number | null;
  laborAffordable: boolean;
  /**
   * Pourquoi « Demander de l'aide » n'est pas là.
   *
   * Un bouton qui disparaît sans un mot se lit comme une panne. L'entraide ne
   * se demande qu'entre 8 et 24 cases : c'est une règle, pas un défaut, mais
   * encore faut-il l'écrire.
   */
  laborBlocage?: string | null;
  visiting: boolean;
  /** La sélection n'est que de l'herbe mûre : on fauche. */
  mowSelected: boolean;
  mowReadyAll: boolean;
  /**
   * Ce qui manque au parc pour ce travail, ou `null` s'il est faisable.
   *
   * Sans cela le bouton partait quel que soit le garage : un débutant, dont le
   * parc n'a que tracteur, semoir et charrue, pouvait lancer sept travaux sur
   * dix qui ne pouvaient que refuser en 409.
   */
  machineManquante?: string | null;
  onConfirm: () => void;
  onHarvestAll: () => void;
  onContractor: () => void;
  onPublishLabor?: () => void;
  onSelectAll: () => void;
  onClear: () => void;
};



export function SelectionBar({
  tool,
  selectedCount,
  readyCount,
  busy,
  contractorCost,
  contractorAffordable,
  contractorBlocage,
  laborQuote,
  laborAffordable,
  laborBlocage,
  visiting,
  mowSelected,
  mowReadyAll,
  machineManquante,
  onConfirm,
  onHarvestAll,
  onContractor,
  onPublishLabor,
  onSelectAll,
  onClear,
}: Props) {
  const acts = actsOnSelection(tool);
  const has = selectedCount > 0;
  // Rien à dire : la barre s'efface plutôt que d'afficher « 0 case ».
  if (!acts && readyCount === 0) return null;

  return (
    <div className="selection-bar" role="toolbar" aria-label="Sélection">
      <div className="selection-bar-count">
        <span className={`selection-bar-num${has ? " on" : ""}`}>{selectedCount}</span>
        <span className="selection-bar-unit">
          {selectedCount > 1 ? "cases retenues" : "case retenue"}
        </span>
      </div>

      {acts && (
        <div className="selection-bar-picks">
          <button type="button" className="selection-bar-link" onClick={onSelectAll}>
            Tout sélectionner <kbd>Ctrl A</kbd>
          </button>
          <button
            type="button"
            className="selection-bar-link"
            disabled={!has}
            onClick={onClear}
          >
            Vider <kbd>Échap</kbd>
          </button>
        </div>
      )}

      <div className="selection-bar-actions">
        {acts && (
          <button
            type="button"
            className="selection-bar-go"
            disabled={busy || !has || Boolean(machineManquante)}
            title={machineManquante ?? undefined}
            onClick={onConfirm}
          >
            {toolActionLabel(tool, selectedCount, mowSelected)}
            <kbd>⏎</kbd>
          </button>
        )}
        {contractorCost !== null && !visiting && (
          <button
            type="button"
            className="selection-bar-alt"
            disabled={busy || !has || !contractorAffordable || Boolean(contractorBlocage)}
            title={
              contractorBlocage ??
              (contractorAffordable
                ? "Un prestataire le fait tout de suite, avec son matériel."
                : "Trésorerie insuffisante pour ce devis.")
            }
            onClick={onContractor}
          >
            Faire faire · {contractorCost} TRN
          </button>
        )}
        {laborQuote !== null && !visiting && onPublishLabor && (
          <button
            type="button"
            className="selection-bar-alt"
            disabled={busy || !has || !laborAffordable}
            title="La somme est mise de côté jusqu’à la fin du chantier, ou son annulation."
            onClick={onPublishLabor}
          >
            Demander de l’aide · {laborQuote} TRN
          </button>
        )}
        {laborBlocage && <span className="selection-bar-note">{laborBlocage}</span>}
        {readyCount > 0 && (
          <button
            type="button"
            className="selection-bar-go ghost"
            disabled={busy}
            onClick={onHarvestAll}
          >
            {mowReadyAll ? `Tout faucher · ${readyCount}` : `Tout récolter · ${readyCount}`}
          </button>
        )}
      </div>
    </div>
  );
}
