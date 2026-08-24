import {
  BUILDING_DEFS,
  MAX_BUILDING_LEVEL,
  buildingLevelDef,
  buildingResaleValue,
  buildingUpgradeCost,
  withinRegret,
  type BuildingType,
} from "@farmsim/shared";

export type SheetBuilding = {
  id: string;
  type: BuildingType;
  level?: number;
  originX: number;
  originY: number;
  rotation?: number;
  createdAt?: string;
};

/** Ce que le troupeau logé ici permet, s'il y en a un. */
export type SheetHerd = {
  id: string;
  size: number;
  label: string;
  /** Les bêtes sont dehors en ce moment */
  out: boolean;
  canGraze: boolean;
  grazeRefusal: string | null;
};

type Props = {
  building: SheetBuilding;
  herd: SheetHerd | null;
  playerLevel: number;
  crd: number;
  busy: boolean;
  visiting: boolean;
  onClose: () => void;
  onRotate: () => void;
  onUpgrade: () => void;
  onDemolish: () => void;
  onGrazeOut: () => void;
  onShelter: () => void;
};

/**
 * La fiche d'un bâtiment, ouverte en cliquant dessus sur la parcelle.
 *
 * Deux manques y trouvent leur réponse. Un bâtiment n'était cliquable nulle
 * part : pour l'améliorer ou le démolir il fallait le retrouver dans une liste
 * d'un panneau latéral, sans savoir lequel de ses homonymes on tenait. Et le
 * troupeau ne se commandait que depuis le panneau d'élevage, alors que le
 * geste naturel est de cliquer l'étable qu'on regarde.
 */
export function BuildingSheet({
  building,
  herd,
  playerLevel,
  crd,
  busy,
  visiting,
  onClose,
  onRotate,
  onUpgrade,
  onDemolish,
  onGrazeOut,
  onShelter,
}: Props) {
  const def = BUILDING_DEFS[building.type];
  const lvl = Math.max(1, Math.min(MAX_BUILDING_LEVEL, building.level ?? 1));
  const cost = buildingUpgradeCost(building.type, lvl);
  const next = lvl < MAX_BUILDING_LEVEL ? buildingLevelDef(lvl + 1) : null;
  const age = building.createdAt ? Date.now() - Date.parse(building.createdAt) : undefined;
  const fresh = withinRegret(age);
  const refund = buildingResaleValue(building.type, lvl, age);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="building-sheet glass" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h3>{def.name}</h3>
            <p className="building-sheet-sub">
              {def.w}×{def.h} · case ({building.originX},{building.originY}) ·{" "}
              {(building.rotation ?? 0) * 90}°
            </p>
          </div>
          <button type="button" className="ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>

        <p className="building-sheet-desc">{def.description}</p>

        <div className="building-sheet-level">
          <span className="level-row">
            {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (
              <i key={i} className={`pip ${i < lvl ? "on" : ""}`} />
            ))}
          </span>
          <em>
            Niveau {lvl} · {buildingLevelDef(lvl).name}
          </em>
        </div>

        {herd && (
          <section className="building-sheet-herd">
            <h4>
              {herd.size} {herd.label}
            </h4>
            <p>
              {herd.out
                ? "Les bêtes sont au pré — bonus de bien-être et d’herbe."
                : "Les bêtes sont à l’étable. Si tout est en ordre, elles vont bien."}
            </p>
            <div className="building-sheet-actions">
              {herd.out ? (
                <button type="button" className="primary" disabled={busy || visiting} onClick={onShelter}>
                  Faire rentrer
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={busy || visiting || !herd.canGraze}
                  title={herd.grazeRefusal ?? "Laisser sortir les bêtes"}
                  onClick={onGrazeOut}
                >
                  Faire sortir
                </button>
              )}
            </div>
            {!herd.out && herd.grazeRefusal && <p className="graze-refusal">{herd.grazeRefusal}</p>}
          </section>
        )}

        <div className="building-sheet-actions">
          <button type="button" className="ghost" disabled={busy || visiting} onClick={onRotate}>
            ⟳ Tourner
          </button>
          {cost !== null && (
            <button
              type="button"
              className="ghost"
              disabled={busy || visiting || playerLevel < (next?.requiredLevel ?? 1) || crd < cost}
              title={
                playerLevel < (next?.requiredLevel ?? 1)
                  ? `Niveau joueur ${next?.requiredLevel} requis`
                  : `Passer au niveau ${lvl + 1} — ${buildingLevelDef(lvl + 1).name}`
              }
              onClick={onUpgrade}
            >
              ↑ Améliorer · {cost} €
            </button>
          )}
          <button
            type="button"
            className={`sell-btn${fresh ? " regret" : ""}`}
            disabled={busy || visiting}
            onClick={onDemolish}
          >
            {fresh ? `Annuler · +${refund} €` : `Démolir · +${refund} €`}
          </button>
        </div>
        {fresh && (
          <p className="building-sheet-note">
            Posé à l'instant : l'annuler rend l'intégralité de la dépense.
          </p>
        )}
      </div>
    </div>
  );
}
