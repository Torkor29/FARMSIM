import { useState } from "react";
import type { ObjectiveView } from "@farmsim/shared";
import { DIRECT_SEED_COST_PER_CELL, DIRECT_SEED_YIELD_MALUS , type Season } from "@farmsim/shared";
import { isFieldWorkTool, isPlantTool, isSoilTool, plantCropLabel, type Tool } from "./tools";
import { BRUSH_SIZES, TOOL_GROUPS, groupOf, optionsFor } from "./ui/tool-options";

/**
 * Barre d'outils tactile.
 *
 * Elle ne sert plus **que** le téléphone : la souris a son propre rail
 * (`ui/desktop/ToolRail`). C'est ce qui permet de la garder telle qu'elle
 * était — elle marchait — sans qu'elle ait à porter en plus les besoins d'un
 * écran de bureau, qui l'avaient rendue mauvaise pour les deux.
 *
 * Un seul défaut lui restait, mesuré : sa rangée d'options ne montrait que
 * deux entrées sur dix sur un écran de 390 px, le reste défilant derrière un
 * masque. Un doigt peut faire glisser cette rangée — contrairement à une
 * souris — mais rien ne disait qu'il y avait une suite. Le bouton « ⋯ » la
 * déplie donc en grille, et là tout est visible d'un coup.
 */

type ContractorOffer = {
  cost: number;
  hasMachine: boolean;
};

type Props = {
  tool: Tool;
  /** Saison courante : elle décide des cultures semables. */
  season: Season;
  brush: 1 | 2 | 3;
  isMobile: boolean;
  isEta: boolean;
  visiting?: boolean;
  busy: boolean;
  selectedCount: number;
  readyCount: number;
  strawCount?: number;
  baleCount?: number;
  silageReadyCount?: number;
  stockTons: number;
  crd: number;
  directSeed: boolean;
  /** Laisser l'andain derrière la moissonneuse. */
  keepSwath: boolean;
  /** La culture sélectionnée laisse-t-elle de la paille ? L'herbe, non. */
  swathUseful: boolean;
  /**
   * Ce qui manque au parc pour ce travail, ou `null` s'il est faisable.
   *
   * Sans cela le bouton partait quel que soit le garage : un débutant, dont le
   * parc n'a que tracteur, semoir et charrue, pouvait lancer sept travaux sur
   * dix qui ne pouvaient que refuser.
   */
  machineManquante?: string | null;
  contractor: ContractorOffer | null;
  laborQuote?: number | null;
  objective: ObjectiveView | null;
  allGoalsDone: boolean;
  onTool: (t: Tool) => void;
  onBrush: (n: 1 | 2 | 3) => void;
  onDirectSeed: () => void;
  onKeepSwath: () => void;
  onConfirm: () => void;
  onHarvestAll: () => void;
  onContractor: () => void;
  onPublishLabor?: () => void;
  onSell: () => void;
  onGuide: () => void;
  hasHerd?: boolean;
  showDev?: boolean;
  onDev?: () => void;
  /**
   * Les panneaux tenaient dans une **seconde** barre collée sous celle-ci :
   * onze boutons sur deux rangées, soit près d'un quart de l'écran mangé en
   * permanence. Ils passent derrière une sixième case, « Plus », qui ouvre un
   * tiroir.
   */
  moreOpen?: boolean;
  moreBadge?: number;
  onMore?: () => void;
  /** La sélection n'est que de l'herbe mûre : on fauche, on ne moissonne pas */
  mowSelected?: boolean;
  /** Toutes les cases prêtes sont de l'herbe */
  mowReadyAll?: boolean;
};

export function FieldDock({
  tool,
  season,
  brush,
  isMobile,
  isEta,
  visiting = false,
  busy,
  selectedCount,
  readyCount,
  strawCount = 0,
  baleCount = 0,
  silageReadyCount = 0,
  stockTons,
  crd,
  directSeed,
  keepSwath,
  swathUseful,
  machineManquante,
  contractor,
  laborQuote = null,
  objective,
  allGoalsDone,
  onTool,
  onBrush,
  onDirectSeed,
  onKeepSwath,
  onConfirm,
  onHarvestAll,
  onContractor,
  onPublishLabor,
  onSell,
  onGuide,
  showDev,
  onDev,
  moreOpen,
  moreBadge = 0,
  onMore,
  mowSelected = false,
  mowReadyAll = false,
}: Props) {
  /** Rangée d'options dépliée en grille : tout devient visible d'un coup. */
  const [optionsOpen, setOptionsOpen] = useState(false);

  const group = groupOf(tool);
  const options = optionsFor(group, season);
  const plant = isPlantTool(tool);
  const soil = isSoilTool(tool);
  const harvest = tool === "HARVEST";
  const work = isFieldWorkTool(tool);
  const showTray =
    plant ||
    soil ||
    harvest ||
    (work && selectedCount > 0) ||
    readyCount > 0 ||
    strawCount > 0 ||
    baleCount > 0;

  /** Compteur collé à une option — « Presser ×12 ». */
  function optionCount(t: Tool): number {
    if (t === "BALE") return strawCount;
    if (t === "COLLECT") return baleCount;
    return 0;
  }

  return (
    <div className="field-dock">
      <button type="button" className="quest-chip" onClick={onGuide}>
        <span className="quest-chip-mark" aria-hidden="true">
          {allGoalsDone ? "★" : "➤"}
        </span>
        <span className="quest-chip-body">
          <strong>{allGoalsDone ? "Guide de ferme" : "À faire"}</strong>
          <span>
            {allGoalsDone
              ? "Tout est dans le recueil — cultures, bâtiments, métiers."
              : objective
                ? `${objective.title} · ${objective.unlock}`
                : "Ouvrir le guide"}
          </span>
        </span>
      </button>

      {showTray && (
        <div className={`dock-tray${optionsOpen ? " expanded" : ""}`} role="toolbar" aria-label="Options de l’outil">
          {isEta && work && (
            <p className="stroke-hint">Glissez sur le champ · deux doigts pour bouger</p>
          )}

          <div className="dock-chips">
            {options.map((o) => {
              const n = optionCount(o.tool);
              return (
                <button
                  key={o.tool}
                  type="button"
                  className={`chip ${tool === o.tool ? "on" : ""}`}
                  aria-pressed={tool === o.tool}
                  onClick={() => onTool(o.tool)}
                >
                  {o.label}
                  {n > 0 ? ` ×${n}` : ""}
                </button>
              );
            })}

            {/* L'andain n'a de sens que sur une moisson de pailleuse : ni sur
                l'herbe, ni en ensilage, où la plante part entière. */}
            {harvest && swathUseful && (
              <button
                type="button"
                className={`chip ${keepSwath ? "on" : ""}`}
                aria-pressed={keepSwath}
                title="Laisser la paille en andain, pour la presser ensuite en bottes."
                onClick={onKeepSwath}
              >
                Andain
              </button>
            )}

            {plant && (
              <button
                type="button"
                className={`chip ${directSeed ? "on" : ""}`}
                aria-pressed={directSeed}
                title={`Semer dans les chaumes : +${DIRECT_SEED_COST_PER_CELL} TRN/case, −${Math.round(
                  DIRECT_SEED_YIELD_MALUS * 100,
                )} % de rendement.`}
                onClick={onDirectSeed}
              >
                Semis direct
              </button>
            )}

            {/* Le pinceau termine la même rangée : sur sa propre ligne il
                coûtait une deuxième rangée. */}
            {BRUSH_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip brush ${brush === n ? "on" : ""}`}
                aria-label={`Pinceau ${n} sur ${n}`}
                aria-pressed={brush === n}
                onClick={() => onBrush(n)}
              >
                {n}×{n}
              </button>
            ))}
          </div>

          <div className="dock-chips dock-chips-end">
            {/* Deux options sur dix tenaient dans la rangée dès qu'une action
                occupait la colonne de droite. Ce bouton la déplie. */}
            {options.length > 0 && (
              <button
                type="button"
                className={`chip dock-expand ${optionsOpen ? "on" : ""}`}
                aria-expanded={optionsOpen}
                aria-label={optionsOpen ? "Replier les options" : "Voir toutes les options"}
                onClick={() => setOptionsOpen((v) => !v)}
              >
                {optionsOpen ? "▾" : "⋯"}
              </button>
            )}
            {work && (
              <button
                type="button"
                className="chip go"
                disabled={busy || selectedCount === 0 || Boolean(machineManquante)}
                title={machineManquante ?? undefined}
                onClick={onConfirm}
              >
                {tool === "HARVEST" && mowSelected
                  ? `Faucher ×${selectedCount}`
                  : `Faire${plant ? ` ${plantCropLabel(tool)}` : ""} ×${selectedCount}`}
              </button>
            )}
            {contractor && !visiting && (
              /* L'explication passe dans l'infobulle du bouton — elle reste
                 accessible, elle ne mange plus la parcelle. */
              <button
                type="button"
                className="chip eta"
                disabled={busy || selectedCount === 0 || crd < contractor.cost}
                title={
                  tool === "HARVEST" && !mowSelected && !contractor.hasMachine
                    ? `Vous n’avez pas la machine : quelqu’un le fait pour vous — ${contractor.cost} TRN`
                    : `Quelqu’un le fait pour vous, tout de suite — ${contractor.cost} TRN`
                }
                onClick={onContractor}
              >
                Payer · {contractor.cost} TRN
              </button>
            )}
            {laborQuote != null && !visiting && onPublishLabor && (
              <button
                type="button"
                className="chip"
                disabled={busy || crd < laborQuote}
                title="Cet argent est mis de côté jusqu’à la fin (ou l’annulation)."
                onClick={onPublishLabor}
              >
                Demander de l’aide · {laborQuote} TRN
              </button>
            )}
            {readyCount > 0 && (
              <button type="button" className="chip go" disabled={busy} onClick={onHarvestAll}>
                {mowReadyAll ? `Tout faucher ×${readyCount}` : `Tout récolter ×${readyCount}`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="dock-bar" role="toolbar" aria-label="Outils de champ">
        {TOOL_GROUPS.map((g) => {
          const on = group === g.id;
          return (
            <button
              key={g.id}
              type="button"
              className={`dock-tool ${on ? "on" : ""} ${g.id === "SELL" ? "sell" : ""}`}
              aria-pressed={on}
              onClick={() => {
                if (g.id === "SELL") onSell();
                else if (g.entry && !on) onTool(g.entry);
              }}
            >
              <img src={g.icon} alt="" width={22} height={22} />
              <span className="dock-label">
                {g.id === "SELL" && stockTons > 0 ? `${stockTons.toFixed(0)} t` : g.label}
              </span>
              {g.id === "HARVEST" && readyCount > 0 && (
                <span className="dock-badge">{readyCount}</span>
              )}
            </button>
          );
        })}
        {isMobile && onMore && (
          <button
            type="button"
            className={`dock-tool more ${moreOpen ? "on" : ""}`}
            aria-pressed={moreOpen}
            aria-expanded={moreOpen}
            onClick={onMore}
          >
            <span className="dock-emoji" aria-hidden="true">
              {moreOpen ? "✕" : "☰"}
            </span>
            <span className="dock-label">{moreOpen ? "Fermer" : "Plus"}</span>
            {!moreOpen && moreBadge > 0 && <span className="dock-badge">{moreBadge}</span>}
          </button>
        )}
        {showDev && (
          <button type="button" className="dock-tool extra" onClick={onDev}>
            <span className="dock-emoji" aria-hidden="true">
              🛠
            </span>
            <span className="dock-label">Test</span>
          </button>
        )}
      </div>
    </div>
  );
}
