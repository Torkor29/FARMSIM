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
  kind: string;
  label: string;
  /** Les bêtes sont dehors en ce moment */
  out: boolean;
  canGraze: boolean;
  grazeRefusal: string | null;
  hungry: boolean;
  atRisk: boolean;
  canMilk: boolean;
  canCollectEggs?: boolean;
  canShear?: boolean;
  collectProgress?: number;
  milkPerCycle: number;
  eggsPerCycle?: number;
};

type FeedRation = "hay" | "maize" | "barley" | "wheat" | "silage";

type Props = {
  building: SheetBuilding;
  herd: SheetHerd | null;
  playerLevel: number;
  crd: number;
  busy: boolean;
  visiting: boolean;
  hayTons: number;
  maizeTons: number;
  barleyTons?: number;
  silageTons?: number;
  onClose: () => void;
  onRotate: () => void;
  onUpgrade: () => void;
  onDemolish: () => void;
  onGrazeOut: () => void;
  onShelter: () => void;
  onFeed?: (ration: FeedRation) => void;
  onMilk?: () => void;
  onCollectEggs?: () => void;
  onShear?: () => void;
  /**
   * Étable sans enclos collé : le geste naturel est de le construire depuis
   * le bâtiment qu'on vient de cliquer, pas depuis un autre panneau.
   */
  canBuildYard?: boolean;
  /** Pré ou courette, selon l'espèce logée ici */
  yardKind?: "paddock" | "yard";
  onBuildYard?: () => void;
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
  hayTons,
  maizeTons,
  barleyTons = 0,
  silageTons = 0,
  onClose,
  onRotate,
  onUpgrade,
  onDemolish,
  onGrazeOut,
  onShelter,
  onFeed,
  onMilk,
  onCollectEggs,
  onShear,
  canBuildYard,
  yardKind,
  onBuildYard,
}: Props) {
  const def = BUILDING_DEFS[building.type];
  const lvl = Math.max(1, Math.min(MAX_BUILDING_LEVEL, building.level ?? 1));
  const cost = buildingUpgradeCost(building.type, lvl);
  const next = lvl < MAX_BUILDING_LEVEL ? buildingLevelDef(lvl + 1) : null;
  const age = building.createdAt ? Date.now() - Date.parse(building.createdAt) : undefined;
  const fresh = withinRegret(age);
  const refund = buildingResaleValue(building.type, lvl, age);
  const locked = busy || visiting;
  const milkPct = Math.round((herd?.collectProgress ?? (herd?.canMilk ? 1 : 0)) * 100);

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

        {canBuildYard && onBuildYard && (
          <div className="building-sheet-actions">
            <button
              type="button"
              className="primary"
              disabled={locked}
              onClick={onBuildYard}
            >
              {yardKind === "yard" ? "Construire une courette attenante" : "Construire enclos attenant"}
            </button>
          </div>
        )}

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
            {herd.atRisk && (
              <p className="herd-alert">Le troupeau dépérit — donnez-leur à manger tout de suite.</p>
            )}
            {herd.hungry && !herd.atRisk && (
              <p className="herd-alert">Ration à distribuer. Un troupeau affamé ne se reproduit pas.</p>
            )}
            {herd.kind === "COW" && (
              <p>
                {herd.canMilk
                  ? `Lait prêt · ${herd.milkPerCycle.toFixed(0)} L`
                  : `Lait · ${milkPct} % — pas encore prêt à traire`}
              </p>
            )}
            {herd.kind === "HEN" && (
              <p>
                {herd.canCollectEggs
                  ? `Œufs prêts · ${(herd.eggsPerCycle ?? 0).toFixed(1)} caisse`
                  : `Œufs · ${milkPct} %`}
              </p>
            )}
            {herd.kind === "SHEEP" && (
              <p>{herd.canShear ? "Laine prête à tondre" : `Laine · ${milkPct} %`}</p>
            )}
            <p>{herd.out ? "Les bêtes sont dehors." : "Les bêtes sont à l'intérieur."}</p>
            {!herd.out && herd.grazeRefusal && <p className="graze-refusal">{herd.grazeRefusal}</p>}
            {herd.hungry && hayTons <= 0 && maizeTons <= 0 && barleyTons <= 0 && silageTons <= 0 && (
              <p className="graze-refusal">
                Pas de fourrage en stock — fauchez de l’herbe ou achetez-en à l’hôtel des ventes.
              </p>
            )}

            <div className="building-sheet-actions">
              {onFeed && (
                <button
                  type="button"
                  disabled={locked || hayTons <= 0}
                  title={hayTons <= 0 ? "Pas de fourrage en stock" : "Distribuer du fourrage"}
                  onClick={() => onFeed("hay")}
                >
                  Nourrir
                </button>
              )}
              {onFeed && maizeTons > 0 && (
                <button type="button" disabled={locked} onClick={() => onFeed("maize")}>
                  Ration maïs
                </button>
              )}
              {onFeed && barleyTons > 0 && (
                <button type="button" disabled={locked} onClick={() => onFeed("barley")}>
                  Ration orge
                </button>
              )}
              {onFeed && silageTons > 0 && (
                <button type="button" disabled={locked} onClick={() => onFeed("silage")}>
                  Ensilage
                </button>
              )}
              {herd.kind === "COW" && onMilk && (
                <button
                  type="button"
                  className="primary"
                  disabled={locked || !herd.canMilk}
                  title={herd.canMilk ? "Traire le troupeau" : "Le lait n’est pas encore prêt"}
                  onClick={onMilk}
                >
                  Traire
                </button>
              )}
              {herd.kind === "HEN" && onCollectEggs && (
                <button
                  type="button"
                  className="primary"
                  disabled={locked || !herd.canCollectEggs}
                  onClick={onCollectEggs}
                >
                  Ramasser
                </button>
              )}
              {herd.kind === "SHEEP" && onShear && (
                <button
                  type="button"
                  className="primary"
                  disabled={locked || !herd.canShear}
                  onClick={onShear}
                >
                  Tondre
                </button>
              )}
              {herd.out ? (
                <button type="button" className="primary" disabled={locked} onClick={onShelter}>
                  Faire rentrer
                </button>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={locked || !herd.canGraze}
                  title={herd.grazeRefusal ?? "Laisser sortir les bêtes"}
                  onClick={onGrazeOut}
                >
                  Faire sortir
                </button>
              )}
            </div>
          </section>
        )}

        <div className="building-sheet-actions">
          <button type="button" className="ghost" disabled={locked} onClick={onRotate}>
            ⟳ Tourner
          </button>
          {cost !== null && (
            <button
              type="button"
              className="ghost"
              disabled={locked || playerLevel < (next?.requiredLevel ?? 1) || crd < cost}
              title={
                playerLevel < (next?.requiredLevel ?? 1)
                  ? `Niveau joueur ${next?.requiredLevel} requis`
                  : `Passer au niveau ${lvl + 1} — ${buildingLevelDef(lvl + 1).name}`
              }
              onClick={onUpgrade}
            >
              ↑ Améliorer · {cost} TRN
            </button>
          )}
          <button
            type="button"
            className={`sell-btn${fresh ? " regret" : ""}`}
            disabled={locked}
            onClick={onDemolish}
          >
            {fresh ? `Annuler · +${refund} TRN` : `Démolir · +${refund} TRN`}
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
