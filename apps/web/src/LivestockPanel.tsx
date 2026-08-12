import { BUILDING_ART, BUILDING_DEFS, type BuildingType } from "@farmsim/shared";

export type BarnState = {
  buildingId: string;
  type: BuildingType;
  level: number;
  capacity: number;
  paddockCells: number;
  paddockCapacity: number;
  cowPrice: number;
  canGraze: boolean;
  grazeRefusal: string | null;
  herd: {
    id: string;
    kind: string;
    size: number;
    happiness: number;
    label: string;
    grazingUntil: number | null;
    milkPerCycle: number;
    meatAtSlaughter: number;
  } | null;
};

type Props = {
  barns: BarnState[];
  busy: boolean;
  crd: number;
  onBuyAnimals: (buildingId: string, count: number) => void;
  onGraze: (herdId: string) => void;
  onBuildPaddock: () => void;
};

/** Panneau élevage : effectif, bien-être, sortie au pré. */
export function LivestockPanel({
  barns,
  busy,
  crd,
  onBuyAnimals,
  onGraze,
  onBuildPaddock,
}: Props) {
  if (!barns.length) return null;

  return (
    <aside className="glass livestock-panel">
      <h3>Élevage</h3>
      <p className="muted tiny">
        Enfermées, les bêtes s’étiolent. Un enclos collé à l’étable leur permet de
        sortir : elles deviennent plus heureuses, donnent plus de lait et plus de viande.
      </p>

      {barns.map((barn) => {
        const def = BUILDING_DEFS[barn.type];
        const herd = barn.herd;
        const pct = herd ? Math.round(herd.happiness * 100) : 0;
        const outside = herd?.grazingUntil && herd.grazingUntil > Date.now();
        const room = barn.capacity - (herd?.size ?? 0);
        const canBuy = room > 0 && crd >= barn.cowPrice;

        return (
          <div key={barn.buildingId} className="barn-card">
            <div className="barn-head">
              <img className="build-art small" src={BUILDING_ART[barn.type]} alt="" />
              <span className="build-text">
                <strong>{def.name}</strong>
                <span className="muted tiny">
                  Nv.{barn.level} · {herd?.size ?? 0}/{barn.capacity} places
                </span>
              </span>
            </div>

            {herd ? (
              <>
                <div className="happy-row">
                  <div className="happy-bar" role="img" aria-label={`Bien-être ${pct} %`}>
                    <span
                      className={`happy-fill ${pct >= 75 ? "high" : pct >= 50 ? "mid" : "low"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="happy-label">
                    {herd.label} · {pct} %
                  </span>
                </div>

                <dl className="barn-stats">
                  <div>
                    <dt>Lait / cycle</dt>
                    <dd>{herd.milkPerCycle.toFixed(0)} L</dd>
                  </div>
                  <div>
                    <dt>Viande à l’abattage</dt>
                    <dd>{herd.meatAtSlaughter.toFixed(0)} kg</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="muted tiny">Étable vide — achetez des bêtes pour démarrer.</p>
            )}

            <p className={`paddock-note ${barn.paddockCapacity > 0 ? "ok" : "none"}`}>
              {barn.paddockCapacity > 0
                ? `Enclos attenant · ${barn.paddockCapacity} places de sortie`
                : "Aucun enclos attenant — les bêtes restent enfermées"}
            </p>

            <div className="barn-actions">
              <button
                type="button"
                disabled={busy || !canBuy}
                title={
                  room <= 0
                    ? "Étable pleine — agrandissez-la"
                    : `Acheter une bête pour ${barn.cowPrice} CRD`
                }
                onClick={() => onBuyAnimals(barn.buildingId, 1)}
              >
                +1 bête · {barn.cowPrice}
              </button>

              {barn.paddockCapacity === 0 ? (
                <button type="button" className="accent-btn" onClick={onBuildPaddock}>
                  Construire un enclos
                </button>
              ) : outside ? (
                <span className="grazing-now">Au pré…</span>
              ) : (
                <button
                  type="button"
                  className="accent-btn"
                  disabled={busy || !herd || !barn.canGraze}
                  title={barn.grazeRefusal ?? "Laisser sortir les bêtes"}
                  onClick={() => herd && onGraze(herd.id)}
                >
                  Sortir les bêtes
                </button>
              )}
            </div>

            {barn.grazeRefusal && barn.paddockCapacity > 0 && (
              <p className="graze-refusal">{barn.grazeRefusal}</p>
            )}
          </div>
        );
      })}
    </aside>
  );
}
