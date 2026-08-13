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
  onGuide: () => void;
  desktopGarage?: boolean;
  desktopOffice?: boolean;
  onDesktopGarage?: () => void;
  onDesktopOffice?: () => void;
  showDev?: boolean;
  onDev?: () => void;
};

const DOCK: { id: "SELECT" | "PLANT" | "HARVEST" | "SOIL" | "SELL"; label: string; icon: string }[] =
  [
    { id: "SELECT", label: "Voir", icon: "/assets/icons/tools/select.svg" },
    { id: "PLANT", label: "Semer", icon: "/assets/icons/tools/plant.svg" },
    { id: "HARVEST", label: "Récolte", icon: "/assets/icons/tools/harvest.svg" },
    { id: "SOIL", label: "Sol", icon: "/assets/icons/tools/plow.svg" },
    { id: "SELL", label: "Vendre", icon: "" },
  ];

function dockOn(id: (typeof DOCK)[number]["id"], tool: Tool): boolean {
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
  onGuide,
  desktopGarage,
  desktopOffice,
  onDesktopGarage,
  onDesktopOffice,
  showDev,
  onDev,
}: Props) {
  const plant = isPlantTool(tool);
  const soil = isSoilTool(tool);
  const work = isFieldWorkTool(tool);
  const showTray = plant || soil || (work && selectedCount > 0) || readyCount > 0;

  function pickDock(id: (typeof DOCK)[number]["id"]) {
    if (id === "SELL") {
      onSell();
      return;
    }
    if (id === "SELECT") {
      if (tool !== "SELECT") onTool("SELECT");
      return;
    }
    if (id === "PLANT") {
      if (!isPlantTool(tool)) onTool("PLANT_WHEAT");
      return;
    }
    if (id === "HARVEST") {
      if (tool !== "HARVEST") onTool("HARVEST");
      return;
    }
    if (id === "SOIL" && !isSoilTool(tool)) onTool("STUBBLE");
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
        <div className="dock-tray" role="toolbar" aria-label="Options de l’outil">
          {isEta && work && (
            <p className="stroke-hint">Glissez sur le champ · deux doigts pour bouger</p>
          )}

          {plant && (
            <div className="dock-chips">
              {(
                [
                  ["PLANT_WHEAT", "Blé"],
                  ["PLANT_MAIZE", "Maïs"],
                  ["PLANT_PEA", "Pois"],
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
                Déchaumer
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
                Ferti
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
                Faire{plant ? ` ${plantCropLabel(tool)}` : ""} ×{selectedCount}
              </button>
            )}
            {contractor && !visiting && (
              <button
                type="button"
                className="chip eta"
                disabled={busy || selectedCount === 0 || crd < contractor.cost}
                title={
                  contractor.hasMachine
                    ? `Sous-traiter — ${contractor.cost} TRN`
                    : `Pas la machine : une entreprise le fait pour ${contractor.cost} TRN`
                }
                onClick={onContractor}
              >
                Entreprise · {contractor.cost} TRN
              </button>
            )}
            {laborQuote != null && !visiting && onPublishLabor && (
              <button
                type="button"
                className="chip"
                disabled={busy || crd < laborQuote}
                title={`Publier un chantier joueur — ${laborQuote} TRN en séquestre`}
                onClick={onPublishLabor}
              >
                Publier · {laborQuote} TRN
              </button>
            )}
            {readyCount > 0 && (
              <button
                type="button"
                className="chip go"
                disabled={busy}
                onClick={onHarvestAll}
              >
                Tout récolter ×{readyCount}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="dock-bar" role="toolbar" aria-label="Outils de champ">
        {DOCK.map((d) => {
          const on = d.id === "SELL" ? false : dockOn(d.id, tool);
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
              <span className="dock-label">Bureau</span>
            </button>
          </>
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
