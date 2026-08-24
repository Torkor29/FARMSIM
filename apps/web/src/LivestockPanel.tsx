import {
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { herdAlerts, type HerdAlert } from "./ui/herd-alerts";
import { AlertIcon } from "./ui/AlertIcon";
import { Geste } from "./ui/Geste";
import { MenuClose } from "./ui/MenuClose";
import {
  YOUNG_PRICE_RATIO,
  YOUNG_GROW_MS,
  ANIMAL_ART,
  ANIMAL_GRAZE_ART,
  ANIMAL_PLURAL,
  feedAutonomyMs,
  rationCycles,
  autoCollects,
  type WelfareCause,
  troughCapacity,
  BUILDING_ART,
  BUILDING_DEFS,
  kindForBarn,
  type AnimalKind,
  type BuildingType,
} from "@farmsim/shared";

/**
 * Une durée réelle, dite comme on la dit à voix haute.
 *
 * « 0 j » pour un quart d'heure restant ne prévient de rien ; « 15 min » si.
 */
/** Ce que la mécanisation prend en charge, par espèce. */
const RAMASSAGE_AUTO: Partial<Record<AnimalKind, string>> = {
  COW: "Traite automatique",
  HEN: "Ramassage automatique des œufs",
  SHEEP: "Tonte automatique",
};

/**
 * Un débit par cycle, dit par jour réel.
 *
 * « 248 L par cycle » ne veut rien dire pour qui joue : un cycle est un jour
 * de jeu, c'est-à-dire un quart d'heure d'horloge. On multiplie donc par le
 * nombre de cycles que contient une journée réelle, la seule dont le joueur
 * dispose pour planifier.
 */
function parJourReel(parCycle: number): number {
  return parCycle * rationCycles();
}

function dureeReelle(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "à sec";
  if (minutes < 60) return `${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `${heures} h`;
  const jours = Math.floor(heures / 24);
  const reste = heures % 24;
  return reste > 0 ? `${jours} j ${reste} h` : `${jours} j`;
}

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
  /** Combien **tiendraient** au pré. Une capacité, pas un état. */
  outsideCount?: number;
  shelteredCount?: number;
  /** Combien y sont vraiment, maintenant. */
  outsideNow?: number;
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
    /** Jeunes du lot, comptés dans `size` — ils ne produisent pas encore. */
    young?: number;
    /** Quand le prochain lot de jeunes passe adulte. */
    youngMaturesAt?: number | null;
    /** Pourquoi le lot va mal, et quoi faire — calculé par le serveur. */
    welfareCauses?: WelfareCause[];
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
    label: "Foin",
    hint: "La ration de base, achetable à l’hôtel des ventes",
    manque: "Aucun foin en réserve — achetez-en à l’hôtel des ventes",
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
 * Une mesure du lot : son nom, sa valeur, et une jauge fine.
 *
 * Chacune de ces cinq mesures — ration, litière, fosse, gestation, collecte —
 * occupait auparavant **une barre pleine largeur suivie de sa ligne de
 * légende**. Cinq nombres coûtaient donc dix rangées, et sur un téléphone il
 * fallait faire défiler pour voir la dernière. Une mesure tient ici sur une
 * ligne : le nom à gauche, la valeur alignée à droite avec les autres, la
 * jauge réduite à un filet sous les deux.
 *
 * L'alignement des valeurs est la moitié du gain : une colonne de nombres se
 * compare d'un regard, des étiquettes de largeurs différentes non.
 */
function Mesure({
  nom,
  valeur,
  part,
  ton,
  detail,
}: {
  nom: string;
  valeur: string;
  /** Part remplie, 0 à 1. */
  part: number;
  /**
   * `inverse` pour les jauges qu'il vaut mieux voir basses — la fosse. Sans
   * elle, la barre la plus verte de l'écran serait celle du problème.
   */
  ton: "normal" | "alerte" | "prêt" | "inverse";
  detail?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, part)) * 100);
  return (
    <div className={`mesure ${ton}`}>
      <span className="mesure-nom">
        {nom}
        {detail && <em>{detail}</em>}
      </span>
      <b className="mesure-val">{valeur}</b>
      <span className="mesure-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

/**
 * Ce que chaque espèce produit, et quand c'est prêt.
 *
 * Trois blocs de rendu quasi identiques cohabitaient — un par espèce — avec
 * la même barre, le même calcul de pourcentage et le même libellé à trois
 * mots près. Ajouter une espèce demandait d'en recopier un quatrième.
 */
const PRODUITS: {
  espece: string;
  nom: string;
  pret: (h: NonNullable<BarnState["herd"]>) => boolean;
  rendement: (h: NonNullable<BarnState["herd"]>) => string;
}[] = [
  {
    espece: "COW",
    nom: "Lait",
    pret: (h) => h.canMilk,
    rendement: (h) => `${parJourReel(h.milkPerCycle).toFixed(0)} L par jour`,
  },
  {
    espece: "HEN",
    nom: "Œufs",
    pret: (h) => Boolean(h.canCollectEggs),
    rendement: (h) => `${parJourReel(h.eggsPerCycle ?? 0).toFixed(0)} caisses par jour`,
  },
  {
    espece: "SHEEP",
    nom: "Laine",
    pret: (h) => Boolean(h.canShear),
    rendement: (h) => `${(h.woolPerShear ?? 0).toFixed(3)} t par tonte`,
  },
];

/** Une aire de sortie qui ne touche aucun abri — donc qui ne sert à rien. */
export type OrphanYard = {
  buildingId: string;
  type: string;
  name: string;
  needs: string[];
};

type Props = {
  barns: BarnState[];
  /** Enclos posés seuls : ils n'apparaissaient sur aucun écran. */
  orphanYards?: OrphanYard[];
  busy: boolean;
  crd: number;
  onBuyAnimals: (buildingId: string, count: number, young?: boolean) => void;
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
  /**
   * Aller acheter de quoi nourrir **ce** lot précis.
   *
   * L'identifiant compte : le joueur qui appuie sur « Acheter du fourrage »
   * dans l'alerte « le troupeau dépérit » ne veut pas faire des courses, il
   * veut nourrir ses bêtes. Sans l'identifiant, l'achat s'arrêtait au silo et
   * il fallait revenir distribuer — un second geste que rien n'annonçait.
   */
  onBuyFeed?: (herdId: string) => void;
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
  /**
   * Un seul bâtiment à l'écran, avec de quoi passer de l'un à l'autre.
   *
   * Mesuré au téléphone : deux bâtiments faisaient **3 123 px** dans un tiroir
   * de 538 — près de six écrans de défilement, et cela grandit d'une carte
   * entière à chaque étable construite. Une fiche d'étable fait 1 277 px à
   * elle seule ; on ne la lit pas en même temps qu'une autre sur 390 px de
   * large. Sur bureau, la fenêtre les montre toutes : là, on compare.
   */
  unSeulBatiment?: boolean;
};

/** Panneau élevage : effectif, bien-être, sortie au pré. */
export function LivestockPanel({
  barns,
  orphanYards,
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
  unSeulBatiment = false,
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

  /**
   * Quel bâtiment est à l'écran, quand on n'en montre qu'un.
   *
   * On retient un identifiant, pas un rang : construire ou vendre une étable
   * décale les rangs et ferait sauter la vue sur un autre lot.
   */
  const [batimentVu, setBatimentVu] = useState<string | null>(null);
  /**
   * Acheter jeune ou adulte, par bâtiment.
   *
   * Un choix, pas un onglet : la fiche garde un seul geste d'achat, et deux
   * pastilles disent lequel on prend. C'est la consigne — de la profondeur,
   * pas des boutons.
   */
  const [jeunes, setJeunes] = useState<Record<string, boolean>>({});
  const vu = barns.find((b) => b.buildingId === batimentVu) ?? barns[0] ?? null;
  const barnsVus = unSeulBatiment && vu ? [vu] : barns;

  /** Exécute le geste que l'alerte propose, sans quitter la liste. */
  function runAlert(a: HerdAlert) {
    switch (a.action.kind) {
      case "FEED": {
        const ration = premiereRationDisponible();
        if (ration) onFeed(a.herdId, ration);
        else onBuyFeed?.(a.herdId);
        return;
      }
      case "BUY_FEED":
        onBuyFeed?.(a.herdId);
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
  const orphelins = orphanYards ?? [];

  // Un joueur qui n'a qu'une courette orpheline n'avait aucun panneau, donc
  // aucune explication : c'est précisément le cas qu'il faut couvrir.
  if (!barns.length && !orphelins.length) return null;

  return (
    <aside className={className} {...gesture}>
      <div className="panel-head">
        <h3>Élevage</h3>
        {onClose && <MenuClose onClose={onClose} />}
      </div>
      {/* Trois lignes d'explication en tête de panneau, c'est cent dix pixels
          repris à chaque ouverture pour un texte qu'on ne lit qu'une fois — et
          sur un téléphone, cela suffisait à repousser le bouton d'achat sous
          le pli. On garde ce qui est actionnable, le reste est dans le guide. */}
      <p className="muted tiny">
        Un troupeau affamé s’effondre ; une aire de sortie accolée le rend plus
        productif.
      </p>
      {orphelins.length > 0 && (
        /* L'enclos posé seul.
           Il était payé, muet et invisible : l'écran ne listait que les abris,
           et l'achat de bêtes répondait « ce bâtiment n'héberge pas
           d'animaux » sans dire ce qu'il fallait faire. On nomme donc ce qui
           manque, là où le joueur vient chercher ses bêtes. */
        <ul className="enclos-orphelins">
          {orphelins.map((y) => (
            <li key={y.buildingId}>
              <strong>{y.name}</strong>
              <span>
                Seule, elle n’accueille aucune bête. Il lui faut{" "}
                {y.needs.length > 1 ? y.needs.join(" ou ") : y.needs[0]} juste à côté, emprises
                jointives.
              </span>
            </li>
          ))}
        </ul>
      )}


      {/* Les alertes en tête, et actionnables : un clic fait le geste, il
          n'emmène pas vers un écran où le chercher. Il n'existait qu'une
          seule alerte d'élevage — « faute de ration » — et tout le reste
          (litière, fosse, pré épuisé, bêtes qui grelottent) ne se découvrait
          qu'en ouvrant le panneau. */}
      {alertes.length > 0 && (
        <ul className="herd-alerts">
          {alertes.map((a) => (
            <li key={a.id} className={`herd-alert-row ${a.level}`}>
              <AlertIcon name={a.icon} />
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

      {/* Le sélecteur n'apparaît que s'il y a de quoi choisir. Un bâtiment
          unique n'a pas besoin d'un onglet pour se désigner lui-même. */}
      {unSeulBatiment && barns.length > 1 && (
        <div className="barn-picker" role="tablist" aria-label="Bâtiments d’élevage">
          {barns.map((b) => {
            const n = b.herd?.size ?? 0;
            return (
              <button
                key={b.buildingId}
                type="button"
                role="tab"
                aria-selected={b.buildingId === (vu?.buildingId ?? null)}
                className={`barn-tab${b.buildingId === (vu?.buildingId ?? null) ? " on" : ""}`}
                onClick={() => setBatimentVu(b.buildingId)}
              >
                <span>{BUILDING_DEFS[b.type].name}</span>
                <em>{n} bête{n > 1 ? "s" : ""}</em>
              </button>
            );
          })}
        </div>
      )}

      {barnsVus.map((barn) => {
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
        /* Le prix dépend de l'âge choisi : un jeune coûte deux cinquièmes.
           Tout ce qui suit — ce qu'on peut s'offrir, le lot maximal, le total
           annoncé — en découle, sinon le sélecteur proposerait un achat au
           mauvais prix. */
        const jeune = jeunes[barn.buildingId] === true;
        const prixPiece = Math.round(barn.cowPrice * (jeune ? YOUNG_PRICE_RATIO : 1));
        const abordables = Math.floor(crd / Math.max(1, prixPiece));
        const maxLot = Math.max(0, Math.min(room, abordables, 50));
        const lot = Math.min(Math.max(1, lots[barn.buildingId] ?? 1), Math.max(1, maxLot));
        const canBuy = maxLot >= 1;
        // Un bouton grisé ne dit pas ce qui cloche, et sur un écran tactile il
        // n'y a pas d'infobulle pour le rattraper. On nomme l'empêchement.
        const empechement =
          room <= 0
            ? "Bâtiment plein — améliorez-le pour agrandir le troupeau"
            : !canBuy
              ? `Il vous manque ${barn.cowPrice - Math.floor(crd)} € pour une bête`
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
                {/* Ce qui compte d'un coup d'œil : l'effectif et le moral.
                    Ils étaient noyés — l'effectif en petit dans l'en-tête, le
                    moral sous une barre parmi cinq barres identiques. */}
                <div className="barn-key">
                  <div>
                    <em>Effectif</em>
                    <strong>
                      {herd.size}
                      <small> / {barn.capacity}</small>
                    </strong>
                    {/* Le lot ne se lit pas d'un seul chiffre quand il mélange
                        veaux et vaches : dire combien sont encore jeunes, et
                        dans combien de temps le prochain passe adulte. */}
                    {(herd.young ?? 0) > 0 && (
                      <em className="herd-young">
                        dont {herd.young} jeune{(herd.young ?? 0) > 1 ? "s" : ""}
                        {/* « 45 minutes de quoi, IRL ou en jeu ? » — la
                            question s'est posée, et elle était légitime : le
                            jeu compte en jours de quinze minutes, donc un
                            nombre nu ne veut rien dire. Celui-ci est en temps
                            réel, et le dit. */}
                        {herd.youngMaturesAt
                          ? ` · adulte dans ${dureeReelle(
                              Math.max(0, herd.youngMaturesAt - Date.now()),
                            )} (temps réel)`
                          : ""}
                      </em>
                    )}
                  </div>
                  <div className={pct >= 75 ? "bon" : pct >= 50 ? "moyen" : "mauvais"}>
                    <em>{herd.label}</em>
                    <strong>
                      {pct}
                      <small> %</small>
                    </strong>
                    <span className="barn-key-bar" role="img" aria-label={`Bien-être ${pct} %`}>
                      <i style={{ width: `${pct}%` }} />
                    </span>
                  </div>
                </div>

                {/* La copie, pas seulement la note.
                    « Elles sont stressées pour quoi ? » — l'écran donnait un
                    pourcentage et rien d'autre. Les causes viennent du serveur,
                    classées par ce qu'elles coûtent : on commence par la
                    première. */}
                {(herd.welfareCauses?.length ?? 0) > 0 && (
                  <ul className="welfare-why">
                    {herd.welfareCauses!.map((c) => (
                      <li key={c.code}>
                        <b>{c.texte}</b>
                        <span>{c.remede}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Les cinq mesures du lot.
                    Chacune occupait une barre pleine largeur **plus** sa ligne
                    de légende : dix rangées de décor pour cinq nombres, et il
                    fallait faire défiler pour toutes les voir. Une mesure tient
                    maintenant sur une ligne — nom, valeur, jauge fine. */}
                <section className="barn-part">
                  <h4>Le lot</h4>
                  <div className="mesures">
                    {/* L'autonomie se lit en heures **réelles**.
                        Elle s'affichait en jours de jeu — quinze minutes pièce
                        —, si bien qu'un « 1 j » se comprenait comme une
                        journée entière quand il valait un quart d'heure. Le
                        joueur revenait le lendemain devant un troupeau
                        affamé sans comprendre. */}
                    <Mesure
                      nom="Ration"
                      valeur={dureeReelle(
                        feedAutonomyMs({
                          besoinParCycle: herd.feedNeed,
                          feedStock: herd.feedStock,
                        }),
                      )}
                      part={
                        herd.feedStock / Math.max(1, troughCapacity(herd.feedNeed))
                      }
                      ton={herd.hungry ? "alerte" : "normal"}
                      detail={
                        herd.feedQuality > 0.5 ? "au maïs, rendement maximal" : "au foin"
                      }
                    />
                    <Mesure
                      nom="Litière"
                      valeur={`${(herd.beddingTons ?? 0).toFixed(2)} t`}
                      part={herd.beddingCover ?? 0}
                      ton={(herd.beddingCover ?? 1) < 0.5 ? "alerte" : "normal"}
                      detail={`${parJourReel(herd.beddingNeed ?? 0).toFixed(1)} t par jour`}
                    />
                    <Mesure
                      nom="Fosse"
                      valeur={`${(herd.manureTons ?? 0).toFixed(2)} / ${(herd.manureCap ?? 0).toFixed(2)} t`}
                      part={herd.manureFill ?? 0}
                      /* La fosse se lit à l'envers des autres : pleine, c'est
                         mauvais. Sans cette inversion, la jauge la plus verte
                         serait celle du problème. */
                      ton={herd.smelly ? "alerte" : "inverse"}
                    />
                    {herd.gestation > 0 ? (
                      <Mesure
                        nom="Gestation"
                        valeur={`${Math.round(herd.gestation * 100)} %`}
                        part={herd.gestation}
                        ton="normal"
                      />
                    ) : (
                      herd.breedRefusal && (
                        <p className="mesure-note">Reproduction — {herd.breedRefusal}</p>
                      )
                    )}
                  </div>

                  {/* L'environnement du lot : c'est lui qui explique le reste,
                      donc il se lit à côté des mesures, pas trois écrans plus bas. */}
                  <div className="barn-env">
                    <span>
                      Ressenti{" "}
                      <b
                        className={
                          (herd.tempC ?? 12) < 3 ? "cold" : (herd.tempC ?? 12) > 26 ? "hot" : ""
                        }
                      >
                        {herd.tempC ?? "—"} °C
                      </b>
                      {herd.housing !== "OUTSIDE" && herd.outdoorTempC !== undefined
                        ? ` · dehors ${herd.outdoorTempC} °C`
                        : ""}
                    </span>
                    {herd.grazes && barn.paddockCapacity > 0 && (
                      <span>
                        Pré{" "}
                        <b>
                          {(herd.grassTons ?? 0).toFixed(1)}
                          {herd.grassCapacityTons ? ` / ${herd.grassCapacityTons}` : ""} t
                        </b>
                      </span>
                    )}
                  </div>

                  {herd.atRisk && (
                    <p className="herd-alert">
                      Le troupeau dépérit — des bêtes vont mourir. Distribuez une ration
                      sans attendre.
                    </p>
                  )}
                </section>

                {/* Ce que le lot rapporte, et quand. Le compte à rebours de la
                    traite et le rendement par cycle vivaient dans deux blocs
                    séparés, à trois écrans l'un de l'autre. */}
                <section className="barn-part">
                  <h4>Production</h4>
                  <div className="mesures">
                    {PRODUITS.filter((p) => p.espece === herd.kind).map((p) => {
                      const pret = p.pret(herd);
                      return (
                        <Mesure
                          key={p.espece}
                          nom={p.nom}
                          valeur={pret ? "prêt" : `${Math.round((herd.collectProgress ?? 0) * 100)} %`}
                          part={herd.collectProgress ?? (pret ? 1 : 0)}
                          ton={pret ? "prêt" : "normal"}
                          detail={p.rendement(herd)}
                        />
                      );
                    })}
                    <p className="mesure-note">
                      Viande à l’abattage · <b>{herd.meatAtSlaughter.toFixed(0)} kg</b>
                    </p>
                  </div>
                </section>

                {/* Les réserves de la ferme, et non plus huit pilules mêlées
                    aux gestes. Le tonnage est aligné à droite : on compare une
                    colonne de nombres, pas des étiquettes de largeurs diverses. */}
                <section className="barn-part">
                  <h4>Réserves à distribuer</h4>
                  <div className="reserves">
                    {RATIONS.filter((r) => !r.especes || r.especes.includes(herd.kind)).map((r) => {
                      const stock = stockDe(r.code);
                      return (
                        <Geste
                          key={r.code}
                          busy={busy}
                          className="reserve"
                          label={
                            <>
                              <span>{r.label}</span>
                              <b>{stock.toFixed(1)} t</b>
                            </>
                          }
                          hint={r.hint}
                          blocage={stock <= 0 ? r.manque : null}
                          onDo={() => onFeed(herd.id, r.code)}
                          onExplain={onExplain}
                        />
                      );
                    })}
                    <Geste
                      busy={busy}
                      className="reserve"
                      label={
                        <>
                          <span>Paille (litière)</span>
                          <b>{strawTons.toFixed(1)} t</b>
                        </>
                      }
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
                  </div>
                </section>
              </>
            ) : (
              <p className="muted tiny">Bâtiment vide — achetez des bêtes pour démarrer.</p>
            )}

            <p className={`paddock-note ${barn.paddockCapacity > 0 ? "ok" : "none"}`}>
              {(() => {
                /* L'accord se lit sur la définition du bâtiment, il ne se
                   redevine pas ici : la phrase énumérait les types féminins à
                   la main, ce qui était faux dès qu'on en ajoutait un. */
                const aire = BUILDING_DEFS[barn.yardType];
                const e = aire.article === "une" ? "e" : "";
                return barn.paddockCapacity > 0
                  ? `${aire.name} attenant${e} · ${barn.paddockCapacity} places de sortie`
                  : `Aucun${e} ${aire.name.toLowerCase()} attenant${e} — les bêtes restent enfermées`;
              })()}
            </p>

            {/* Le lieu de vie d'abord : c'est la décision, pas un geste parmi
                douze. Elle était perdue au milieu d'une rangée qui passait à la
                ligne, entre « Ration orge » et « Abattre ». */}
            {barn.paddockCapacity === 0 ? (
              <button
                type="button"
                className="barn-cta"
                onClick={() => onBuildPaddock(barn.yardType)}
              >
                {barn.yardType === "PIG_YARD" || barn.yardType === "HEN_YARD"
                  ? "Construire une courette"
                  : "Construire un enclos"}
              </button>
            ) : herd ? (
              <span className="housing-switch" role="group" aria-label="Lieu de vie">
                <button
                  type="button"
                  className={`housing-side${herd.housing !== "OUTSIDE" ? " on" : ""}`}
                  aria-pressed={herd.housing !== "OUTSIDE"}
                  disabled={busy}
                  title="Les bêtes restent à l’étable : elles mangent la ration, à l’abri du temps."
                  onClick={() => onHousing(herd.id, "INSIDE")}
                >
                  {/* « Dedans » / « Dehors » nommaient un état, pas un geste :
                      devant deux moitiés dont l'une est allumée, on ne sait pas
                      si l'on lit où sont les bêtes ou ce qui va leur arriver.
                      Un bouton dit ce qu'il fait. */}
                  Rentrer les bêtes
                </button>
                {/* On se cale sur `canLiveOutside`, pas sur `canGraze` : le
                    serveur n'exige qu'un enclos pour changer de lieu de vie.
                    S'aligner sur la séance de pâture grisait le bouton les
                    jours de neige, et dès que le troupeau dépassait l'enclos
                    d'une seule bête. */}
                <Geste
                  busy={busy}
                  className={`housing-side${herd.housing === "OUTSIDE" ? " on" : ""}`}
                  label="Sortir les bêtes"
                  blocage={
                    (barn.canLiveOutside ?? barn.canGraze)
                      ? null
                      : (barn.outsideRefusal ?? "Sortie impossible")
                  }
                  hint={
                    (barn.shelteredCount ?? 0) > 0
                      ? `${barn.outsideCount} bêtes au pré, ${barn.shelteredCount} resteront à l’étable faute de place`
                      : "Les bêtes vivent au pré : elles s’y nourrissent tant qu’il y a de l’herbe, et subissent le temps qu’il fait."
                  }
                  onDo={() => onHousing(herd.id, "OUTSIDE")}
                  onExplain={onExplain}
                />
              </span>
            ) : null}

            {/* Ce qui empêche vraiment, puis ce qui se contente de limiter.
                L'ancienne ligne affichait « Enclos saturé » en rouge pour un
                enclos d'une place trop court : un constat sans issue, là où
                la sortie était en fait possible pour tout le reste du lot. */}
            {/* La ligne disait une capacité au présent de l'indicatif :
                « 18 bêtes au pré, 1 à l'étable » restait affiché après avoir
                rentré le troupeau. Elle raconte maintenant l'état réel, et ne
                parle de la place manquante que si les bêtes sont dehors. */}
            {barn.paddockCapacity > 0 && barn.outsideRefusal ? (
              <p className="graze-refusal">{barn.outsideRefusal}</p>
            ) : barn.paddockCapacity > 0 && (barn.outsideNow ?? 0) <= 0 ? (
              <p className="graze-note">
                Enclos de {barn.paddockCapacity} places · les bêtes sont à l’étable.
              </p>
            ) : (barn.shelteredCount ?? 0) > 0 ? (
              <p className="graze-note">
                Enclos de {barn.paddockCapacity} places : {barn.outsideNow} bêtes au pré,{" "}
                {barn.shelteredCount} à l’étable. Agrandissez l’enclos pour sortir tout le lot.
              </p>
            ) : null}

            {/* Achat de bêtes : c'est par là que démarre tout élevage, et
                c'était une seule case grisée sans explication. */}
            <div className="herd-buy">
              <span className="herd-buy-label">
                Acheter des {espece ? ANIMAL_PLURAL[espece] : "bêtes"}
                <em>
                  {prixPiece} € pièce · {room} place{room > 1 ? "s" : ""} libre
                  {room > 1 ? "s" : ""}
                </em>
              </span>
              {/* Le pari : payer moins et attendre, ou payer plein et traire
                  tout de suite. Deux pastilles, aucun écran de plus. */}
              <div className="age-switch" role="group" aria-label="Âge des bêtes">
                <button
                  type="button"
                  className={`age-side${!jeune ? " on" : ""}`}
                  aria-pressed={!jeune}
                  onClick={() => setJeunes((p) => ({ ...p, [barn.buildingId]: false }))}
                >
                  Adultes
                  <em>{barn.cowPrice} € · produisent tout de suite</em>
                </button>
                <button
                  type="button"
                  className={`age-side${jeune ? " on" : ""}`}
                  aria-pressed={jeune}
                  onClick={() => setJeunes((p) => ({ ...p, [barn.buildingId]: true }))}
                >
                  Jeunes
                  <em>
                    {Math.round(barn.cowPrice * YOUNG_PRICE_RATIO)} € · adultes dans{" "}
                    {dureeReelle(YOUNG_GROW_MS)} réelles
                  </em>
                </button>
              </div>
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
                  onClick={() => onBuyAnimals(barn.buildingId, lot, jeune)}
                >
                  Acheter <b>{lot * prixPiece} €</b>
                </button>
              </div>
              {empechement && <p className="herd-buy-why">{empechement}</p>}
            </div>


            {herd && (
              <section className="barn-part gestes">
                <h4>Gestes</h4>
                {/* Ce que le palier a acheté, dit à l'endroit où la corvée se
                    faisait. Sans cette ligne, on améliore le bâtiment, on
                    revient traire par habitude, et on ne voit jamais ce qu'on
                    a payé. */}
                {autoCollects(barn.level) && RAMASSAGE_AUTO[herd.kind as AnimalKind] && (
                  <p className="geste-auto">
                    {RAMASSAGE_AUTO[herd.kind as AnimalKind]} — le bâtiment s’en charge seul, en
                    continu. Le bouton reste là pour vider la cuve tout de suite.
                  </p>
                )}
                <div className="barn-actions">
                  {herd.kind === "COW" && (
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
                  {herd.kind === "HEN" && (
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
                  {herd.kind === "SHEEP" && (
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

                  <Geste
                    busy={busy}
                    label="Épandre le fumier"
                    hint="Épandre la fosse sur vos terres — le sol y gagne"
                    blocage={
                      (herd.manureTons ?? 0) <= 0 ? "La fosse est vide, rien à épandre" : null
                    }
                    onDo={() => onSpreadManure(barn.buildingId)}
                    onExplain={onExplain}
                  />

                  <Geste
                    busy={busy}
                    label="Vendre le fumier"
                    hint="Vendre le tas au voisin — sur place, tout de suite"
                    blocage={
                      (herd.manureTons ?? 0) <= 0 ? "La fosse est vide, rien à vendre" : null
                    }
                    onDo={() => onSellManure(barn.buildingId)}
                    onExplain={onExplain}
                  />

                  <Geste
                    busy={busy}
                    className="slaughter-btn"
                    label="Abattre une bête"
                    hint={`Environ ${(herd.meatAtSlaughter / Math.max(1, herd.size)).toFixed(0)} kg de viande`}
                    blocage={
                      herd.size <= 1 ? "Il ne reste qu’une bête — le lot disparaîtrait" : null
                    }
                    onDo={() => onSlaughter(herd.id, 1)}
                    onExplain={onExplain}
                  />
                </div>
              </section>
            )}

          </div>
        );
      })}
    </aside>
  );
}
