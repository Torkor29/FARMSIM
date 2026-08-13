import type { ObjectiveView } from "@farmsim/shared";
import { DIRECT_SEED_COST_PER_CELL, DIRECT_SEED_YIELD_MALUS } from "@farmsim/shared";
import { isFieldWorkTool, isPlantTool, isSoilTool, plantCropLabel, type Tool } from "./tools";

type ContractorOffer = {
  cost: number;
  hasMachine: boolean;
};

type Props = {
  tool: Tool;
  brush: 1 | 2 | 3;
  isMobile: boolean;
  isEta: boolean;
  visiting?: boolean;
  busy: boolean;
  selectedCount: number;
  readyCount: number;
  stockTons: number;
  crd: number;
  directSeed: boolean;
  contractor: ContractorOffer | null;
  laborQuote?: number | null;
  objective: ObjectiveView | null;
  allGoalsDone: boolean;
  onTool: (t: Tool) => void;
  onBrush: (n: 1 | 2 | 3) => void;
  onDirectSeed: () => void;
  onConfirm: () => void;
  onHarvestAll: () => void;
  onContractor: () => void;
  onPublishLabor?: () => void;
  onSell: () => void;
  onMore?: () => void;
  moreOpen?: boolean;
  hideQuest?: boolean;
  onGuide: () => void;
  desktopGarage?: boolean;
  desktopOffice?: boolean;
  desktopHerd?: boolean;
  hasHerd?: boolean;
  onDesktopGarage?: () => void;
  onDesktopOffice?: () => void;
  onDesktopHerd?: () => void;
  showDev?: boolean;
  onDev?: () => void;
  /** La sélection n'est que de l'herbe mûre : on fauche, on ne moissonne pas */
  mowSelected?: boolean;
  /** Toutes les cases prêtes sont de l'herbe */
  mowReadyAll?: boolean;
};

type DockId = "SELECT" | "PLANT" | "HARVEST" | "SOIL" | "SELL" | "MORE";

const DESKTOP_DOCK: { id: DockId; label: string; icon: string }[] = [
  { id: "SELECT", label: "Voir", icon: "/assets/icons/tools/select.svg" },
  { id: "PLANT", label: "Semer", icon: "/assets/icons/tools/plant.svg" },
  { id: "HARVEST", label: "Récolte", icon: "/assets/icons/tools/harvest.svg" },
  { id: "SOIL", label: "Sol", icon: "/assets/icons/tools/plow.svg" },
  { id: "SELL", label: "Vendre", icon: "" },
];

const MOBILE_DOCK: { id: DockId; label: string; icon: string }[] = [
  { id: "PLANT", label: "Semer", icon: "/assets/icons/tools/plant.svg" },
  { id: "HARVEST", label: "Récolte", icon: "/assets/icons/tools/harvest.svg" },
  { id: "SOIL", label: "Sol", icon: "/assets/icons/tools/plow.svg" },
  { id: "SELL", label: "Vendre", icon: "" },
  { id: "MORE", label: "Plus", icon: "" },
];

function dockOn(id: DockId, tool: Tool): boolean {
  if (id === "SELECT") return tool === "SELECT";
  if (id === "PLANT") return isPlantTool(tool);
  if (id === "HARVEST") return tool === "HARVEST";
  if (id === "SOIL") return isSoilTool(tool);
  return false;
}

export function FieldDock({
  tool,
  brush,
  isMobile,
  isEta,
  visiting = false,
  busy,
  selectedCount,
  readyCount,
  stockTons,
  crd,
  directSeed,
  contractor,
  laborQuote = null,
  objective,
  allGoalsDone,
  onTool,
  onBrush,
  onDirectSeed,
  onConfirm,
  onHarvestAll,
  onContractor,
  onPublishLabor,
  onSell,
  onMore,
  moreOpen = false,
  hideQuest = false,
  onGuide,
  desktopGarage,
  desktopOffice,
  desktopHerd,
  hasHerd,
  onDesktopGarage,
  onDesktopOffice,
  onDesktopHerd,
  showDev,
  onDev,
  mowSelected = false,
  mowReadyAll = false,
}: Props) {
  const plant = isPlantTool(tool);
  const soil = isSoilTool(tool);
  const work = isFieldWorkTool(tool);
  const harvestOn = tool === "HARVEST";
  const showTray = plant || soil || (harvestOn && (selectedCount > 0 || readyCount > 0));

  function pickDock(id: DockId) {
    if (id === "MORE") {
      onMore?.();
      return;
    }
    if (id === "SELL") {
      onSell();
      return;
    }
    if (id === "SELECT") {
      if (tool !== "SELECT") onTool("SELECT");
      return;
    }
    if (id === "PLANT") {
      if (isPlantTool(tool)) onTool("SELECT");
      else onTool("PLANT_WHEAT");
      return;
    }
    if (id === "HARVEST") {
      if (tool === "HARVEST") onTool("SELECT");
      else onTool("HARVEST");
      return;
    }
    if (id === "SOIL") {
      if (isSoilTool(tool)) onTool("SELECT");
      else onTool("STUBBLE");
    }
  }

  return (
    <div className="field-dock">
      {!hideQuest && (
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
      )}

      {showTray && (
        <div className="dock-tray" role="toolbar" aria-label="Options de l’outil">
          {isEta && work && (
            <p className="stroke-hint">Glissez sur le champ · deux doigts pour bouger</p>
          )}

          {plant && (
            <div className="dock-chips">
              {(
                [
                  ["PLANT_WHEAT", "Blé"],
                  ["PLANT_BARLEY", "Orge"],
                  ["PLANT_MAIZE", "Maïs"],
                  ["PLANT_RAPE", "Colza"],
                  ["PLANT_PEA", "Pois"],
                  ["PLANT_GRASS", "Herbe"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${tool === t ? "on" : ""}`}
                  onClick={() => onTool(t)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className={`chip ${directSeed ? "on" : ""}`}
                title={`Semer dans les chaumes : +${DIRECT_SEED_COST_PER_CELL} TRN/case, −${Math.round(
                  DIRECT_SEED_YIELD_MALUS * 100,
                )} % de rendement.`}
                onClick={onDirectSeed}
              >
                Semis direct
              </button>
            </div>
          )}

          {soil && (
            <div className="dock-chips">
              <button
                type="button"
                className={`chip ${tool === "STUBBLE" ? "on" : ""}`}
                onClick={() => onTool("STUBBLE")}
              >
                Nettoyer
              </button>
              <button
                type="button"
                className={`chip ${tool === "PLOW" ? "on" : ""}`}
                onClick={() => onTool("PLOW")}
              >
                Labourer
              </button>
              <button
                type="button"
                className={`chip ${tool === "FERTILIZE" ? "on" : ""}`}
                onClick={() => onTool("FERTILIZE")}
              >
                Engrais
              </button>
              <button
                type="button"
                className={`chip ${tool === "PARK" ? "on" : ""}`}
                onClick={() => onTool("PARK")}
              >
                Garer
              </button>
            </div>
          )}

          <div className="dock-chips dock-chips-end">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`chip brush ${brush === n ? "on" : ""}`}
                aria-label={`Pinceau ${n} sur ${n}`}
                onClick={() => onBrush(n)}
              >
                {n}×{n}
              </button>
            ))}
            {work && (
              <button
                type="button"
                className="chip go"
                disabled={busy || selectedCount === 0}
                onClick={onConfirm}
              >
                {tool === "HARVEST" && mowSelected
                  ? `Faucher ×${selectedCount}`
                  : `Faire${plant ? ` ${plantCropLabel(tool)}` : ""} ×${selectedCount}`}
              </button>
            )}
            {contractor && !visiting && selectedCount > 0 && (
              <button
                type="button"
                className="chip eta"
                disabled={busy || crd < contractor.cost}
                title={`Quelqu’un le fait pour vous — ${contractor.cost} TRN`}
                onClick={onContractor}
              >
                Payer · {contractor.cost} TRN
              </button>
            )}
            {laborQuote != null && !visiting && selectedCount > 0 && onPublishLabor && (
              <button
                type="button"
                className="chip"
                disabled={busy || crd < laborQuote}
                title="Cet argent est mis de côté jusqu’à la fin (ou l’annulation)."
                onClick={onPublishLabor}
              >
                Aide · {laborQuote} TRN
              </button>
            )}
            {harvestOn && readyCount > 0 && (
              <button
                type="button"
                className="chip go"
                disabled={busy}
                onClick={onHarvestAll}
              >
                {mowReadyAll ? `Tout faucher ×${readyCount}` : `Tout récolter ×${readyCount}`}
              </button>
            )}
            <button
              type="button"
              className="chip"
              onClick={() => onTool("SELECT")}
            >
              Masquer
            </button>
          </div>
        </div>
      )}

      <div className="dock-bar" role="toolbar" aria-label="Outils de champ">
        {(isMobile ? MOBILE_DOCK : DESKTOP_DOCK).map((d) => {
          const on = d.id === "MORE" ? moreOpen : d.id === "SELL" ? false : dockOn(d.id, tool);
          return (
            <button
              key={d.id}
              type="button"
              className={`dock-tool ${on ? "on" : ""} ${d.id === "SELL" ? "sell" : ""}`}
              aria-pressed={on}
              onClick={() => pickDock(d.id)}
            >
              {d.id === "SELL" ? (
                <span className="dock-emoji" aria-hidden="true">
                  💰
                </span>
              ) : d.id === "MORE" ? (
                <span className="dock-emoji" aria-hidden="true">
                  ＋
                </span>
              ) : (
                <img src={d.icon} alt="" width={22} height={22} />
              )}
              <span className="dock-label">
                {d.id === "SELL" && stockTons > 0 ? `${stockTons.toFixed(0)} t` : d.label}
              </span>
              {d.id === "HARVEST" && readyCount > 0 && (
                <span className="dock-badge">{readyCount}</span>
              )}
            </button>
          );
        })}
        {!isMobile && (
          <>
            <button
              type="button"
              className={`dock-tool extra ${desktopGarage ? "on" : ""}`}
              onClick={onDesktopGarage}
            >
              <span className="dock-emoji" aria-hidden="true">
                🚜
              </span>
              <span className="dock-label">Garage</span>
            </button>
            <button
              type="button"
              className={`dock-tool extra ${desktopOffice ? "on" : ""}`}
              onClick={onDesktopOffice}
            >
              <span className="dock-emoji" aria-hidden="true">
                📋
              </span>
              <span className="dock-label">Missions</span>
            </button>
            {hasHerd && (
              <button
                type="button"
                className={`dock-tool extra ${desktopHerd ? "on" : ""}`}
                onClick={onDesktopHerd}
              >
                <span className="dock-emoji" aria-hidden="true">
                  🐄
                </span>
                <span className="dock-label">Élevage</span>
              </button>
            )}
          </>
        )}
        {showDev && !isMobile && (
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
