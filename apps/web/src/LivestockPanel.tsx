import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { herdAlerts, type HerdAlert } from "./ui/herd-alerts";
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
  /**
   * Le troupeau peut-il vivre dehors ? Distinct de `canGraze` : une séance de
   * pâture se refuse par mauvais temps, un lieu de vie non — c'est au joueur
   * de trancher, on ne fait que l'avertir.
   */
  canLiveOutside?: boolean;
  outsideRefusal?: string | null;
  /** Bêtes qui tiendront au pré, et celles qui resteront à l'étable. */
  outsideCount?: number;
  shelteredCount?: number;
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
    /** Paille en litière, en tonnes */
    beddingTons?: number;
    /** Paille qu'il faut pour un cycle */
    beddingNeed?: number;
    /** Ce que la réserve peut contenir */
    beddingCap?: number;
    /** Part du besoin couverte, 0 à 1 */
    beddingCover?: number;
    /* — Environnement — */
    /** Où vit le lot, durablement. C'est la décision que le joueur n'avait pas. */
    housing?: "INSIDE" | "OUTSIDE";
    /** Température ressentie, bâtiment compris. */
    tempC?: number;
    /** Température dehors, pour comparer avant de sortir les bêtes. */
    outdoorTempC?: number;
    thermal?: number;
    thermalAlert?: "none" | "warn" | "danger";
    /** Herbe sur pied dans l'enclos, en tonnes. */
    grassTons?: number;
    grassCapacityTons?: number;
    /** L'espèce tire-t-elle sa nourriture du pré ? */
    grazes?: boolean;
  } | null;
};

type FeedRation = "hay" | "maize" | "barley" | "wheat" | "silage";

/**
 * Le catalogue des rations — une table, plus six blocs recopiés.
 *
 * `especes` restreint la ration à ce qui la mange : le blé n'était proposé
 * qu'aux poules et aux moutons, et cette règle vivait dans une condition JSX
 * au milieu du rendu.
 */
const RATIONS: {
  code: FeedRation;
  label: string;
  hint: string;
  /** Ce qu'on dit quand le silo est vide — et où en trouver. */
  manque: string;
  especes?: string[];
}[] = [
  {
    code: "hay",
    label: "Fourrage",
    hint: "La ration de base, achetable à l’hôtel des ventes",
    manque: "Aucun fourrage en réserve — achetez-en à l’hôtel des ventes",
  },
  {
    code: "silage",
    label: "Ensilage",
    hint: "Ration d’hiver, plus énergétique que le grain",
    manque: "Pas d’ensilage — récoltez du maïs plante entière avec une ensileuse",
  },
  {
    code: "maize",
    label: "Maïs",
    hint: "Plus nutritif, mais c’est du maïs qu’on ne vend pas",
    manque: "Aucun maïs en silo — semez-en, ou achetez-en à l’hôtel des ventes",
  },
  {
    code: "barley",
    label: "Orge",
    hint: "Concentré un peu moins riche que le maïs",
    manque: "Aucune orge en silo — semez-en, surtout pour les cochons et les poules",
  },
  {
    code: "wheat",
    label: "Blé",
    hint: "Un peu moins riche que l’orge",
    manque: "Aucun blé en silo — semez-en pour les poules",
    especes: ["HEN", "SHEEP"],
  },
];

/**
 * Ce qu'il reste à attendre avant la prochaine collecte.
 *
 * « Les vaches viennent d'être traites » ne dit pas s'il faut revenir dans une
 * minute ou dans une heure. La progression était déjà dans la charge utile ;
 * il ne restait qu'à la lire.
 */
function attente(progress: number | undefined): string {
  const p = Math.max(0, Math.min(1, progress ?? 0));
  const part = Math.round((1 - p) * 100);
  return part <= 0 ? "un instant" : `${part} % du cycle`;
}

/**
 * Un geste, et ce qui l'empêche — dit à voix haute.
 *
 * Tous les blocages du panneau étaient rangés dans l'attribut `title`.
 * Au téléphone, cet attribut **n'existe pas** : il n'y a pas de survol. Le
 * joueur avait donc sous les yeux une rangée de boutons gris, sans une ligne
 * pour dire lequel manquait de quoi, et ses touchers ne produisaient rien —
 * ce qui se raconte très exactement « peu importe où je clique, ça fait
 * rien ».
 *
 * Un geste empêché reste donc **touchable** : il ne s'exécute pas, mais il
 * répond. Il annonce ce qui manque, dans le bandeau, à l'endroit où le joueur
 * regarde déjà. `aria-disabled` plutôt que `disabled` : le lecteur d'écran
 * apprend qu'il est indisponible, et le doigt garde une cible qui parle.
 */
function Geste({
  label,
  className,
  busy,
  blocage,
  onDo,
  onExplain,
  hint,
}: {
  label: ReactNode;
  className?: string;
  busy: boolean;
  /** Ce qui empêche, `null` si rien n'empêche. */
  blocage: string | null;
  onDo: () => void;
  onExplain: (raison: string) => void;
  /** Ce que le geste fait, quand il est possible — pour la souris. */
  hint?: string;
}) {
  const empeche = blocage !== null;
  return (
    <button
      type="button"
      className={`${className ?? ""}${empeche ? " blocked" : ""}`.trim()}
      // `busy` est le seul cas où l'on refuse vraiment le toucher : une
      // requête est en vol, et un second envoi ferait double emploi.
      disabled={busy}
      aria-disabled={empeche}
      title={blocage ?? hint}
      onClick={() => (empeche ? onExplain(blocage) : onDo())}
    >
      {label}
    </button>
  );
}

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
  onSpreadBedding: (herdId: string) => void;
  onSpreadManure: (buildingId: string) => void;
  onSellManure: (buildingId: string) => void;
  /** Rentrer ou sortir le lot, durablement. */
  onHousing: (herdId: string, housing: "INSIDE" | "OUTSIDE") => void;
  /**
   * Ouvrir l'hôtel des ventes — la sortie de secours quand la réserve est
   * vide. Sans elle, l'alerte « le troupeau dépérit » ne menait nulle part.
   */
  onBuyFeed?: () => void;
  /**
   * Dire au joueur ce qui empêche un geste. Sur un téléphone, c'est le seul
   * canal : l'attribut `title` n'y est jamais lu.
   */
  onExplain?: (raison: string) => void;
  strawTons: number;
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
  onSpreadBedding,
  onSpreadManure,
  onSellManure,
  onHousing,
  onBuyFeed,
  onExplain = () => {},
  strawTons,
  hayTons,
  maizeTons,
  barleyTons,
  wheatTons,
  silageTons = 0,
  className = "glass livestock-panel",
  onClose,
  gesture,
}: Props) {
  // Les alertes se déduisent de l'état — elles ne sont pas une donnée de plus
  // à tenir à jour, donc elles ne peuvent pas mentir.
  const alertes = useMemo(
    () =>
      herdAlerts(
        barns.map((b) => ({
          buildingId: b.buildingId,
          name: BUILDING_DEFS[b.type].name,
          paddockCapacity: b.paddockCapacity,
          herd: b.herd as never,
        })),
        // Ce que la ferme a réellement sous la main : l'alerte propose de
        // nourrir si quelque chose se distribue, et d'aller acheter sinon.
        {
          hasFeed: hayTons + maizeTons + barleyTons + wheatTons + silageTons > 0,
          hasStraw: strawTons > 0,
        },
      ),
    [barns, hayTons, maizeTons, barleyTons, wheatTons, silageTons, strawTons],
  );

  /**
   * La ration qu'on distribue quand l'alerte dit « Nourrir ».
   *
   * Elle envoyait toujours du foin. Un joueur qui avait trois tonnes de maïs
   * et pas un brin de foin cliquait donc sur un bouton qui ne faisait rien,
   * et l'alerte revenait au tick suivant.
   */
  function premiereRationDisponible(): FeedRation | null {
    return RATIONS.find((r) => stockDe(r.code) > 0)?.code ?? null;
  }

  /** Ce qu'il reste de cette ration, en tonnes. */
  function stockDe(code: FeedRation): number {
    switch (code) {
      case "hay":
        return hayTons;
      case "silage":
        return silageTons;
      case "maize":
        return maizeTons;
      case "barley":
        return barleyTons;
      case "wheat":
        return wheatTons;
    }
  }

  /** Exécute le geste que l'alerte propose, sans quitter la liste. */
  function runAlert(a: HerdAlert) {
    switch (a.action.kind) {
      case "FEED": {
        const ration = premiereRationDisponible();
        if (ration) onFeed(a.herdId, ration);
        else onBuyFeed?.();
        return;
      }
      case "BUY_FEED":
        onBuyFeed?.();
        return;
      case "BEDDING":
        onSpreadBedding(a.herdId);
        return;
      case "SHELTER":
        onHousing(a.herdId, "INSIDE");
        return;
      case "GRAZE":
        onHousing(a.herdId, "OUTSIDE");
        return;
      case "MANURE":
        onSpreadManure(a.buildingId);
        return;
      case "COLLECT": {
        const herd = barns.find((b) => b.herd?.id === a.herdId)?.herd;
        if (herd?.canMilk) onMilk(a.herdId);
        else if (herd?.canCollectEggs) onCollectEggs(a.herdId);
        else if (herd?.canShear) onShear(a.herdId);
        return;
      }
    }
  }
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

      {/* Les alertes en tête, et actionnables : un clic fait le geste, il
          n'emmène pas vers un écran où le chercher. Il n'existait qu'une
          seule alerte d'élevage — « faute de ration » — et tout le reste
          (litière, fosse, pré épuisé, bêtes qui grelottent) ne se découvrait
          qu'en ouvrant le panneau. */}
      {alertes.length > 0 && (
        <ul className="herd-alerts">
          {alertes.map((a) => (
            <li key={a.id} className={`herd-alert-row ${a.level}`}>
              <span className="herd-alert-icon" aria-hidden="true">
                {a.icon}
              </span>
              <span className="herd-alert-text">{a.text}</span>
              <button
                type="button"
                className="herd-alert-do"
                disabled={busy}
                onClick={() => runAlert(a)}
              >
                {a.actionLabel}
              </button>
            </li>
          ))}
        </ul>
      )}

      {barns.map((barn) => {
        const def = BUILDING_DEFS[barn.type];
        /**
         * Un lot vidé n'est plus un troupeau.
         *
         * Le panneau se contentait de l'existence de la ligne, sans regarder
         * l'effectif. Un troupeau décimé par la faim n'étant supprimé que par
         * l'abattage, on se retrouvait avec une étable à zéro bête qui
         * réclamait de la litière — « les bêtes dorment sur le béton » — et
         * offrait de traire. Le filet est ici ; la cause est corrigée côté
         * serveur, qui supprime désormais la ligne à la dernière perte.
         */
        const herd = barn.herd && barn.herd.size > 0 ? barn.herd : null;
        const pct = herd ? Math.round(herd.happiness * 100) : 0;
        // Dehors se lit d'abord dans l'état durable ; la fenêtre de sortie ne
        // sert plus qu'à jouer l'animation de la transition.
        const outside =
          herd?.housing === "OUTSIDE" || Boolean(herd?.grazingUntil && herd.grazingUntil > Date.now());
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

                {/* Ce que le lot vit vraiment : la température qu'il ressent
                    et ce qu'il reste à brouter. Sans cela, le joueur subit la
                    saison sans jamais la voir. */}
                <p className="herd-env">
                  <span>
                    Ressenti{" "}
                    <b className={(herd.tempC ?? 12) < 3 ? "cold" : (herd.tempC ?? 12) > 26 ? "hot" : ""}>
                      {herd.tempC ?? "—"} °C
                    </b>
                    {herd.housing !== "OUTSIDE" && herd.outdoorTempC !== undefined
                      ? ` (dehors ${herd.outdoorTempC} °C)`
                      : ""}
                  </span>
                  <span>
                    Ration <b>{Math.floor(herd.feedStock / Math.max(1, herd.feedNeed))} j</b>
                  </span>
                  {herd.grazes && barn.paddockCapacity > 0 && (
                    <span>
                      Pré <b>{(herd.grassTons ?? 0).toFixed(1)} t</b>
                      {herd.grassCapacityTons ? ` / ${herd.grassCapacityTons} t` : ""}
                    </span>
                  )}
                </p>

                <div className="feed-row">
                  {(herd.beddingCover ?? 1) < 0.5 && (
                    <p className="herd-alert">
                      Litière à refaire : les bêtes dorment sur le béton, et la fosse
                      se remplit moins vite.
                    </p>
                  )}
                  <div className="feed-bar">
                    <span
                      className={`feed-fill ${(herd.beddingCover ?? 1) < 0.5 ? "low" : ""}`}
                      style={{ width: `${Math.round((herd.beddingCover ?? 0) * 100)}%` }}
                    />
                  </div>
                  <span className={`feed-label ${(herd.beddingCover ?? 1) < 0.5 ? "warn" : ""}`}>
                    Litière · {(herd.beddingTons ?? 0).toFixed(2)} t
                    {" · "}
                    {(herd.beddingNeed ?? 0).toFixed(2)} t par cycle
                  </span>
                </div>

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
                <Geste
                  busy={busy}
                  label="Pailler"
                  hint="Étaler de la paille sous les bêtes"
                  blocage={
                    strawTons <= 0
                      ? "Aucune paille en réserve — achetez-en à l’hôtel des ventes, ou pressez la vôtre"
                      : (herd.beddingCover ?? 0) >= 1
                        ? "La litière est déjà complète"
                        : null
                  }
                  onDo={() => onSpreadBedding(herd.id)}
                  onExplain={onExplain}
                />
              )}

              {/* Les rations, une seule fois.
                  Elles étaient six blocs recopiés, à quatre lignes de `title`
                  chacun ; et le tonnage disponible n'apparaissait nulle part,
                  si bien qu'un bouton gris ne disait pas s'il manquait cent
                  kilos ou tout le silo. Il est maintenant sur l'étiquette. */}
              {herd &&
                RATIONS.filter((r) => !r.especes || r.especes.includes(herd.kind)).map((r) => {
                  const stock = stockDe(r.code);
                  return (
                    <Geste
                      key={r.code}
                      busy={busy}
                      label={
                        <>
                          {r.label} <b>{stock.toFixed(1)} t</b>
                        </>
                      }
                      hint={r.hint}
                      blocage={stock <= 0 ? r.manque : null}
                      onDo={() => onFeed(herd.id, r.code)}
                      onExplain={onExplain}
                    />
                  );
                })}

              {herd && herd.kind === "COW" && (
                <Geste
                  busy={busy}
                  className="accent-btn"
                  label="Traire"
                  hint="Traire le troupeau"
                  blocage={
                    herd.canMilk
                      ? null
                      : `Les vaches viennent d’être traites — encore ${attente(herd.collectProgress)}`
                  }
                  onDo={() => onMilk(herd.id)}
                  onExplain={onExplain}
                />
              )}

              {herd && herd.kind === "HEN" && (
                <Geste
                  busy={busy}
                  className="accent-btn"
                  label="Ramasser"
                  hint="Ramasser les œufs"
                  blocage={
                    herd.canCollectEggs
                      ? null
                      : `Les œufs viennent d’être ramassés — encore ${attente(herd.collectProgress)}`
                  }
                  onDo={() => onCollectEggs(herd.id)}
                  onExplain={onExplain}
                />
              )}

              {herd && herd.kind === "SHEEP" && (
                <Geste
                  busy={busy}
                  className="accent-btn"
                  label="Tondre"
                  hint="Tondre le lot"
                  blocage={
                    herd.canShear
                      ? null
                      : `Les moutons viennent d’être tondus — encore ${attente(herd.collectProgress)}`
                  }
                  onDo={() => onShear(herd.id)}
                  onExplain={onExplain}
                />
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
              ) : herd ? (
                /* L'interrupteur, à la place de la séance de trois heures.
                   « Dehors… » n'était même pas un bouton : un texte d'état
                   coincé dans une rangée d'actions, tronqué à l'écran. */
                <span className="housing-switch" role="group" aria-label="Lieu de vie">
                  <button
                    type="button"
                    className={`housing-side${herd.housing !== "OUTSIDE" ? " on" : ""}`}
                    aria-pressed={herd.housing !== "OUTSIDE"}
                    disabled={busy}
                    title="Les bêtes restent à l’étable : elles mangent la ration, à l’abri du temps."
                    onClick={() => onHousing(herd.id, "INSIDE")}
                  >
                    Dedans
                  </button>
                  {/* On se cale sur `canLiveOutside`, pas sur `canGraze` : le
                      serveur n'exige qu'un enclos pour changer de lieu de vie.
                      S'aligner sur la séance de pâture grisait le bouton les
                      jours de neige, et dès que le troupeau dépassait l'enclos
                      d'une seule bête. */}
                  <Geste
                    busy={busy}
                    className={`housing-side${herd.housing === "OUTSIDE" ? " on" : ""}`}
                    label="Dehors"
                    blocage={(barn.canLiveOutside ?? barn.canGraze) ? null : barn.outsideRefusal ?? "Sortie impossible"}
                    hint={
                      (barn.shelteredCount ?? 0) > 0
                        ? `${barn.outsideCount} bêtes au pré, ${barn.shelteredCount} resteront à l’étable faute de place`
                        : "Les bêtes vivent au pré : elles s’y nourrissent tant qu’il y a de l’herbe, et subissent le temps qu’il fait."
                    }
                    onDo={() => onHousing(herd.id, "OUTSIDE")}
                    onExplain={onExplain}
                  />
                </span>
              ) : (
                <button
                  type="button"
                  className="accent-btn"
                  disabled
                  title="Achetez des bêtes avant de les sortir"
                >
                  Sortir les bêtes
                </button>
              )}
            </div>

            {/* Ce qui empêche vraiment, puis ce qui se contente de limiter.
                L'ancienne ligne affichait « Enclos saturé » en rouge pour un
                enclos d'une place trop court : un constat sans issue, là où
                la sortie était en fait possible pour tout le reste du lot. */}
            {barn.paddockCapacity > 0 && barn.outsideRefusal ? (
              <p className="graze-refusal">{barn.outsideRefusal}</p>
            ) : (barn.shelteredCount ?? 0) > 0 ? (
              <p className="graze-note">
                Enclos de {barn.paddockCapacity} places : {barn.outsideCount} bêtes au pré,{" "}
                {barn.shelteredCount} à l’étable. Agrandissez l’enclos pour sortir tout le lot.
              </p>
            ) : null}
          </div>
        );
      })}
    </aside>
  );
}
