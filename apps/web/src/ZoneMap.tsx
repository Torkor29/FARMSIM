export type ZoneMapParcel = {
  id: string;
  label: string;
  mapX: number;
  mapY: number;
  landPrice: number;
  farmId?: string | null;
};

export type ZoneMapZone = {
  code: string;
  name: string;
  koppen: string;
  mapW: number;
  mapH: number;
  parcels: ZoneMapParcel[];
};

export type ZoneMapProps = {
  zone: ZoneMapZone;
  /** Farm id of the current player — colors "à toi" */
  myFarmId?: string | null;
  selectedParcelId?: string | null;
  /**
   * When provided, only these free parcel ids are clickable
   * (e.g. adjacent parcels for expansion). Null/undefined = all free.
   */
  selectableIds?: ReadonlySet<string> | readonly string[] | null;
  onSelect?: (parcelId: string) => void;
  compact?: boolean;
  showLegend?: boolean;
};

type CellStatus = "free" | "mine" | "other" | "empty";

function statusOf(p: ZoneMapParcel | undefined, myFarmId?: string | null): CellStatus {
  if (!p) return "empty";
  if (!p.farmId) return "free";
  if (myFarmId && p.farmId === myFarmId) return "mine";
  return "other";
}

function toSet(ids?: ReadonlySet<string> | readonly string[] | null): Set<string> | null {
  if (ids == null) return null;
  return ids instanceof Set ? ids : new Set(ids);
}

export function ZoneMap({
  zone,
  myFarmId,
  selectedParcelId,
  selectableIds,
  onSelect,
  compact = false,
  showLegend = true,
}: ZoneMapProps) {
  const byCoord = new Map(zone.parcels.map((p) => [`${p.mapX},${p.mapY}`, p]));
  const allowed = toSet(selectableIds);

  return (
    <div className={`zone-map ${compact ? "compact" : ""}`}>
      <div className="zone-map-head">
        <strong className="zone-map-name">{zone.name}</strong>
        <span className="muted tiny">
          {zone.code} · {zone.koppen} · {zone.mapW}×{zone.mapH}
        </span>
      </div>

      <div
        className="zone-grid"
        style={{
          gridTemplateColumns: `repeat(${zone.mapW}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${zone.mapH}, minmax(0, 1fr))`,
        }}
        role="grid"
        aria-label={`Carte ${zone.name}`}
      >
        {Array.from({ length: zone.mapH }, (_, y) =>
          Array.from({ length: zone.mapW }, (_, x) => {
            const p = byCoord.get(`${x},${y}`);
            const status = statusOf(p, myFarmId);
            const isFree = status === "free";
            const isAllowed = isFree && (allowed == null || (p != null && allowed.has(p.id)));
            const selected = p != null && selectedParcelId === p.id;
            const title = p
              ? `${p.label} · (${p.mapX},${p.mapY}) · ${p.landPrice} CRD` +
                (status === "mine" ? " · à toi" : status === "other" ? " · occupée" : isAllowed ? " · libre" : " · non disponible")
              : `Case vide (${x},${y})`;

            return (
              <button
                key={`${x}-${y}`}
                type="button"
                role="gridcell"
                className={[
                  "zone-cell",
                  `st-${status}`,
                  selected ? "selected" : "",
                  isAllowed ? "clickable" : "locked",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title={title}
                disabled={!isAllowed || !onSelect}
                onClick={() => {
                  if (p && isAllowed && onSelect) onSelect(p.id);
                }}
                aria-label={title}
                aria-pressed={selected}
              >
                <span className="zone-cell-label">{p?.label ?? "·"}</span>
                {p && isFree ? (
                  <span className="zone-cell-price">{Math.round(p.landPrice)}</span>
                ) : null}
              </button>
            );
          }),
        )}
      </div>

      {showLegend ? (
        <ul className="zone-legend">
          <li>
            <i className="swatch st-free" /> Libre
          </li>
          <li>
            <i className="swatch st-mine" /> À toi
          </li>
          <li>
            <i className="swatch st-other" /> Autre
          </li>
        </ul>
      ) : null}
    </div>
  );
}
