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
  yardType: BuildingType;
  herd: {
    id: string;
    kind: string;
    size: number;
    happiness: number;
    label: string;
    grazingUntil: number | null;
    feedStock: number;
    feedNeed: number;
    feedQuality: number;
    hungry: boolean;
    /** Le lot commence à perdre des bêtes : il faut agir maintenant */
    atRisk: boolean;
    canMilk: boolean;
    gestation: number;
    breedRefusal: string | null;
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
  onBuildPaddock: (yardType: BuildingType) => void;
  onFeed: (herdId: string, ration: "hay" | "maize" | "barley") => void;
  onMilk: (herdId: string) => void;
  onSlaughter: (herdId: string, count: number) => void;
  hayTons: number;
  maizeTons: number;
  barleyTons: number;
  /** Permet à la coque mobile d'en faire un tiroir du bas */
  className?: string;
};

/** Panneau élevage : effectif, bien-être, sortie au pré. */
export function LivestockPanel({
  barns,
  busy,
  crd,
  onBuyAnimals,
  onGraze,
  onBuildPaddock,
  onFeed,
  onMilk,
  onSlaughter,
  hayTons,
  maizeTons,
  barleyTons,
  className = "glass livestock-panel",
}: Props) {
  if (!barns.length) return null;

  return (
    <aside className={className}>
      <h3>Élevage</h3>
      <p className="muted tiny">
        Nourrissez, sortez, trayez. Un troupeau affamé s’effondre ; une aire de
        sortie accolée au bâtiment le rend nettement plus productif.
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

                <div className="feed-row">
                  {herd.atRisk && (
                    <p className="herd-alert">
                      Le troupeau dépérit — des bêtes vont mourir. Distribuez une
                      ration sans attendre.
                    </p>
                  )}
                  <div className="feed-bar">
                    <span
                      className={`feed-fill ${herd.hungry ? "low" : ""}`}
                      style={{
                        width: `${Math.min(100, Math.round((herd.feedStock / Math.max(1, herd.feedNeed)) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className={`feed-label ${herd.hungry ? "warn" : ""}`}>
                    {herd.hungry
                      ? "Ration à distribuer"
                      : herd.feedQuality > 0.5
                        ? "Ration au maïs — rendement maximal"
                        : "Ration au fourrage"}
                  </span>
                </div>

                {herd.gestation > 0 ? (
                  <div className="gest-row">
                    <div className="gest-bar">
                      <span
                        className="gest-fill"
                        style={{ width: `${Math.round(herd.gestation * 100)}%` }}
                      />
                    </div>
                    <span className="gest-label">
                      Gestation · {Math.round(herd.gestation * 100)} %
                    </span>
                  </div>
                ) : (
                  herd.breedRefusal && (
                    <p className="gest-blocked">{herd.breedRefusal}</p>
                  )
                )}

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
                ? `${BUILDING_DEFS[barn.yardType].name} attenant · ${barn.paddockCapacity} places de sortie`
                : `Aucun${barn.yardType === "PIG_YARD" ? "e courette" : " enclos"} attenant — les bêtes restent enfermées`}
            </p>

            <div className="barn-actions">
              <button
                type="button"
                disabled={busy || !canBuy}
                title={
                  room <= 0
                    ? "Bâtiment plein — agrandissez-le"
                    : `Acheter une bête pour ${barn.cowPrice} TRN`
                }
                onClick={() => onBuyAnimals(barn.buildingId, 1)}
              >
                +1 bête · {barn.cowPrice} TRN
              </button>

              {herd && (
                <button
                  type="button"
                  disabled={busy || hayTons <= 0}
                  title={
                    hayTons <= 0
                      ? "Aucun fourrage en silo — achetez-en au négociant"
                      : "Distribuer du fourrage"
                  }
                  onClick={() => onFeed(herd.id, "hay")}
                >
                  Nourrir
                </button>
              )}

              {herd && (
                <button
                  type="button"
                  disabled={busy || maizeTons <= 0}
                  title={
                    maizeTons <= 0
                      ? "Aucun maïs en silo — il faut en cultiver"
                      : "Ration au maïs : plus nutritive, mais c’est du maïs qu’on ne vend pas"
                  }
                  onClick={() => onFeed(herd.id, "maize")}
                >
                  Ration maïs
                </button>
              )}

              {herd && (
                <button
                  type="button"
                  disabled={busy || barleyTons <= 0}
                  title={
                    barleyTons <= 0
                      ? "Aucune orge en silo — semez-en, surtout pour les cochons"
                      : "Ration à l’orge : concentré un peu moins riche que le maïs"
                  }
                  onClick={() => onFeed(herd.id, "barley")}
                >
                  Ration orge
                </button>
              )}

              {herd && herd.kind === "COW" && (
                <button
                  type="button"
                  className="accent-btn"
                  disabled={busy || !herd.canMilk}
                  title={herd.canMilk ? "Traire le troupeau" : "Les vaches viennent d’être traites"}
                  onClick={() => onMilk(herd.id)}
                >
                  Traire
                </button>
              )}

              {herd && (
                <button
                  type="button"
                  className="slaughter-btn"
                  disabled={busy}
                  title={`Abattre une bête — environ ${(herd.meatAtSlaughter / Math.max(1, herd.size)).toFixed(0)} kg`}
                  onClick={() => onSlaughter(herd.id, 1)}
                >
                  Abattre
                </button>
              )}

              {barn.paddockCapacity === 0 ? (
                <button
                  type="button"
                  className="accent-btn"
                  onClick={() => onBuildPaddock(barn.yardType)}
                >
                  {barn.yardType === "PIG_YARD" ? "Construire une courette" : "Construire un enclos"}
                </button>
              ) : outside ? (
                <span className="grazing-now">Dehors…</span>
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
