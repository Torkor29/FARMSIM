import { useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ANIMAL_ART,
  ANIMAL_GRAZE_ART,
  ANIMAL_PLURAL,
  BUILDING_ART,
  BUILDING_DEFS,
  kindForBarn,
  type AnimalKind,
  type BuildingType,
} from "@farmsim/shared";

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
    canCollectEggs?: boolean;
    canShear?: boolean;
    /** 0 = vient d’être collecté, 1 = prêt à traire / ramasser / tondre */
    collectProgress?: number;
    gestation: number;
    breedRefusal: string | null;
    milkPerCycle: number;
    eggsPerCycle?: number;
    woolPerShear?: number;
    meatAtSlaughter: number;
    manureTons?: number;
    manureCap?: number;
    manureFill?: number;
    smelly?: boolean;
  } | null;
};

type FeedRation = "hay" | "maize" | "barley" | "wheat" | "silage";

type Props = {
  barns: BarnState[];
  busy: boolean;
  crd: number;
  onBuyAnimals: (buildingId: string, count: number) => void;
  onGraze: (herdId: string) => void;
  onBuildPaddock: (yardType: BuildingType) => void;
  onFeed: (herdId: string, ration: FeedRation) => void;
  onMilk: (herdId: string) => void;
  onCollectEggs: (herdId: string) => void;
  onShear: (herdId: string) => void;
  onSlaughter: (herdId: string, count: number) => void;
  onSpreadManure: (buildingId: string) => void;
  onSellManure: (buildingId: string) => void;
  hayTons: number;
  maizeTons: number;
  barleyTons: number;
  wheatTons: number;
  silageTons?: number;
  /** Permet à la coque mobile d'en faire un tiroir du bas */
  className?: string;
  onClose?: () => void;
  gesture?: {
    onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp?: (e: ReactPointerEvent<HTMLElement>) => void;
  };
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
  onCollectEggs,
  onShear,
  onSlaughter,
  onSpreadManure,
  onSellManure,
  hayTons,
  maizeTons,
  barleyTons,
  wheatTons,
  silageTons = 0,
  className = "glass livestock-panel",
  onClose,
  gesture,
}: Props) {
  /**
   * Combien de bêtes on s'apprête à acheter, par bâtiment.
   *
   * Il n'y avait qu'un bouton « +1 bête » : remplir une étable de douze places
   * demandait douze touchers et douze allers-retours au serveur. L'API accepte
   * cinquante bêtes d'un coup depuis toujours — c'est l'interface qui n'en
   * proposait qu'une.
   */
  const [lots, setLots] = useState<Record<string, number>>({});

  if (!barns.length) return null;

  return (
    <aside className={className} {...gesture}>
      <div className="panel-head">
        <h3>Élevage</h3>
        {onClose && (
          <button type="button" className="ghost tiny" onClick={onClose}>
            Fermer
          </button>
        )}
      </div>
      {/* Trois lignes d'explication en tête de panneau, c'est cent dix pixels
          repris à chaque ouverture pour un texte qu'on ne lit qu'une fois — et
          sur un téléphone, cela suffisait à repousser le bouton d'achat sous
          le pli. On garde ce qui est actionnable, le reste est dans le guide. */}
      <p className="muted tiny">
        Un troupeau affamé s’effondre ; une aire de sortie accolée le rend plus
        productif.
      </p>

      {barns.map((barn) => {
        const def = BUILDING_DEFS[barn.type];
        const herd = barn.herd;
        const pct = herd ? Math.round(herd.happiness * 100) : 0;
        const outside = herd?.grazingUntil && herd.grazingUntil > Date.now();
        const room = barn.capacity - (herd?.size ?? 0);
        // L'espèce se déduit du bâtiment, et non du troupeau : une étable vide
        // n'a pas de troupeau, et c'est justement là qu'on achète.
        const espece = kindForBarn(barn.type);
        // Ce qu'on peut réellement s'offrir, borné par la place et par la
        // caisse : le sélecteur ne propose jamais un achat qui sera refusé.
        const abordables = Math.floor(crd / Math.max(1, barn.cowPrice));
        const maxLot = Math.max(0, Math.min(room, abordables, 50));
        const lot = Math.min(Math.max(1, lots[barn.buildingId] ?? 1), Math.max(1, maxLot));
        const canBuy = maxLot >= 1;
        // Un bouton grisé ne dit pas ce qui cloche, et sur un écran tactile il
        // n'y a pas d'infobulle pour le rattraper. On nomme l'empêchement.
        const empechement =
          room <= 0
            ? "Bâtiment plein — améliorez-le pour agrandir le troupeau"
            : !canBuy
              ? `Il vous manque ${barn.cowPrice - Math.floor(crd)} TRN pour une bête`
              : null;

        return (
          <div key={barn.buildingId} className="barn-card">
            <div className="barn-head">
              <img
                className="build-art small"
                src={
                  herd
                    ? (outside && ANIMAL_GRAZE_ART[herd.kind as AnimalKind]) ||
                      ANIMAL_ART[herd.kind as AnimalKind] ||
                      BUILDING_ART[barn.type]
                    : BUILDING_ART[barn.type]
                }
                alt=""
              />
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

                {herd.kind === "COW" && (
                  <div className="feed-row">
                    <div className="feed-bar milk-bar">
                      <span
                        className={`feed-fill ${herd.canMilk ? "ready" : ""}`}
                        style={{
                          width: `${Math.round((herd.collectProgress ?? (herd.canMilk ? 1 : 0)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`feed-label ${herd.canMilk ? "ok" : ""}`}>
                      {herd.canMilk
                        ? `Lait prêt · ${herd.milkPerCycle.toFixed(0)} L`
                        : `Lait · ${Math.round((herd.collectProgress ?? 0) * 100)} %`}
                    </span>
                  </div>
                )}
                {herd.kind === "HEN" && (
                  <div className="feed-row">
                    <div className="feed-bar milk-bar">
                      <span
                        className={`feed-fill ${herd.canCollectEggs ? "ready" : ""}`}
                        style={{
                          width: `${Math.round((herd.collectProgress ?? (herd.canCollectEggs ? 1 : 0)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`feed-label ${herd.canCollectEggs ? "ok" : ""}`}>
                      {herd.canCollectEggs
                        ? `Œufs prêts · ${(herd.eggsPerCycle ?? 0).toFixed(1)} caisse`
                        : `Œufs · ${Math.round((herd.collectProgress ?? 0) * 100)} %`}
                    </span>
                  </div>
                )}
                {herd.kind === "SHEEP" && (
                  <div className="feed-row">
                    <div className="feed-bar milk-bar">
                      <span
                        className={`feed-fill ${herd.canShear ? "ready" : ""}`}
                        style={{
                          width: `${Math.round((herd.collectProgress ?? (herd.canShear ? 1 : 0)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className={`feed-label ${herd.canShear ? "ok" : ""}`}>
                      {herd.canShear
                        ? `Laine prête · ${(herd.woolPerShear ?? 0).toFixed(3)} t`
                        : `Laine · ${Math.round((herd.collectProgress ?? 0) * 100)} %`}
                    </span>
                  </div>
                )}

                <dl className="barn-stats">
                  {herd.kind === "COW" && (
                    <div>
                      <dt>Lait / cycle</dt>
                      <dd>{herd.milkPerCycle.toFixed(0)} L</dd>
                    </div>
                  )}
                  {herd.kind === "HEN" && (
                    <div>
                      <dt>Œufs / cycle</dt>
                      <dd>{(herd.eggsPerCycle ?? 0).toFixed(1)} caisse</dd>
                    </div>
                  )}
                  {herd.kind === "SHEEP" && (
                    <div>
                      <dt>Laine / tonte</dt>
                      <dd>{(herd.woolPerShear ?? 0).toFixed(3)} t</dd>
                    </div>
                  )}
                  <div>
                    <dt>Viande à l’abattage</dt>
                    <dd>{herd.meatAtSlaughter.toFixed(0)} kg</dd>
                  </div>
                </dl>

                <div className="feed-row">
                  {herd.smelly && (
                    <p className="herd-alert">
                      La fosse est pleine : les bêtes sont moins bien. Épandez ou vendez.
                    </p>
                  )}
                  <div className="feed-bar">
                    <span
                      className={`feed-fill ${herd.smelly ? "low" : ""}`}
                      style={{ width: `${Math.round((herd.manureFill ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className={`feed-label ${herd.smelly ? "warn" : ""}`}>
                    Fosse · {(herd.manureTons ?? 0).toFixed(2)} / {(herd.manureCap ?? 0).toFixed(2)} t
                  </span>
                </div>
              </>
            ) : (
              <p className="muted tiny">Bâtiment vide — achetez des bêtes pour démarrer.</p>
            )}

            <p className={`paddock-note ${barn.paddockCapacity > 0 ? "ok" : "none"}`}>
              {barn.paddockCapacity > 0
                ? `${BUILDING_DEFS[barn.yardType].name} attenant · ${barn.paddockCapacity} places de sortie`
                : `Aucun${barn.yardType === "PIG_YARD" || barn.yardType === "HEN_YARD" ? "e courette" : " enclos"} attenant — les bêtes restent enfermées`}
            </p>

            {/* Achat de bêtes : c'est par là que démarre tout élevage, et
                c'était une seule case grisée sans explication. */}
            <div className="herd-buy">
              <span className="herd-buy-label">
                Acheter des {espece ? ANIMAL_PLURAL[espece] : "bêtes"}
                <em>
                  {barn.cowPrice} TRN pièce · {room} place{room > 1 ? "s" : ""} libre
                  {room > 1 ? "s" : ""}
                </em>
              </span>
              <div className="herd-buy-row">
                <div className="herd-stepper">
                  <button
                    type="button"
                    aria-label="Une bête de moins"
                    disabled={busy || !canBuy || lot <= 1}
                    onClick={() =>
                      setLots((p) => ({ ...p, [barn.buildingId]: Math.max(1, lot - 1) }))
                    }
                  >
                    −
                  </button>
                  <b>{canBuy ? lot : 0}</b>
                  <button
                    type="button"
                    aria-label="Une bête de plus"
                    disabled={busy || !canBuy || lot >= maxLot}
                    onClick={() =>
                      setLots((p) => ({ ...p, [barn.buildingId]: Math.min(maxLot, lot + 1) }))
                    }
                  >
                    +
                  </button>
                </div>
                {maxLot > 1 && (
                  <button
                    type="button"
                    className="ghost tiny"
                    disabled={busy || lot >= maxLot}
                    onClick={() => setLots((p) => ({ ...p, [barn.buildingId]: maxLot }))}
                  >
                    Au max · {maxLot}
                  </button>
                )}
                <button
                  type="button"
                  className="herd-buy-go"
                  disabled={busy || !canBuy}
                  onClick={() => onBuyAnimals(barn.buildingId, lot)}
                >
                  Acheter <b>{lot * barn.cowPrice} TRN</b>
                </button>
              </div>
              {empechement && <p className="herd-buy-why">{empechement}</p>}
            </div>

            <div className="barn-actions">

              {herd && (
                <button
                  type="button"
                  disabled={busy || hayTons <= 0}
                  title={
                    hayTons <= 0
                      ? "Aucun fourrage — achetez-en à l’hôtel des ventes"
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
                      ? "Aucune orge en silo — semez-en, surtout pour les cochons et les poules"
                      : "Ration à l’orge : concentré un peu moins riche que le maïs"
                  }
                  onClick={() => onFeed(herd.id, "barley")}
                >
                  Ration orge
                </button>
              )}

              {herd && (herd.kind === "HEN" || herd.kind === "SHEEP") && (
                <button
                  type="button"
                  disabled={busy || wheatTons <= 0}
                  title={
                    wheatTons <= 0
                      ? "Aucun blé en silo — semez-en pour les poules"
                      : "Ration au blé : un peu moins riche que l’orge"
                  }
                  onClick={() => onFeed(herd.id, "wheat")}
                >
                  Ration blé
                </button>
              )}

              {herd && (
                <button
                  type="button"
                  disabled={busy || silageTons <= 0}
                  title={
                    silageTons <= 0
                      ? "Pas d’ensilage — récoltez le maïs plante entière"
                      : "Ration d’hiver, plus énergétique que le grain"
                  }
                  onClick={() => onFeed(herd.id, "silage")}
                >
                  Ration ensilage
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

              {herd && herd.kind === "HEN" && (
                <button
                  type="button"
                  className="accent-btn"
                  disabled={busy || !herd.canCollectEggs}
                  title={
                    herd.canCollectEggs
                      ? "Ramasser les œufs"
                      : "Les œufs viennent d’être ramassés"
                  }
                  onClick={() => onCollectEggs(herd.id)}
                >
                  Ramasser
                </button>
              )}

              {herd && herd.kind === "SHEEP" && (
                <button
                  type="button"
                  className="accent-btn"
                  disabled={busy || !herd.canShear}
                  title={herd.canShear ? "Tondre le lot" : "Les moutons viennent d’être tondus"}
                  onClick={() => onShear(herd.id)}
                >
                  Tondre
                </button>
              )}

              {herd && (herd.manureTons ?? 0) > 0 && (
                <button
                  type="button"
                  className="accent-btn"
                  disabled={busy}
                  title="Épandre le fumier sur les cultures — moins cher que l’engrais du magasin"
                  onClick={() => onSpreadManure(barn.buildingId)}
                >
                  Épandre
                </button>
              )}

              {herd && (herd.manureTons ?? 0) > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  title="Vendre le tas au voisin — sur place, tout de suite"
                  onClick={() => onSellManure(barn.buildingId)}
                >
                  Vendre le fumier
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
                  {barn.yardType === "PIG_YARD" || barn.yardType === "HEN_YARD"
                    ? "Construire une courette"
                    : "Construire un enclos"}
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
