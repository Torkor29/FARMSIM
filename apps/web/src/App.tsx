import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  SPECIALIZATION_LABELS,
  BUILDING_ART,
  BUILDING_DEFS,
  MACHINE_ART,
  MACHINE_DEFS,
  explainNoMachine,
  type MachineForWork,
  MAX_BUILDING_LEVEL,
  WORK_LABELS,
  buildingLevelDef,
  buildingResaleValue,
  buildingUpgradeCost,
  urgentContractorQuote,
  MISSION_CELLS_MIN,
  MISSION_CELLS_MAX,
  laborEscrow,
  SILAGE_MIN_PROGRESS,
  DEFAULT_CONSIGNES,
  type CharacterAppearance,
  type FieldWorkerView,
  repairHalfwayTarget,
  repairQuote,
  isPaddockAdjacent,
  welfareIndex,
  machineResaleValue,
  soilSummary,
  MAX_HARVESTS_BEFORE_PLOW,
  workAnimationMs,
  deliveryHaulPath,
  rotationFactor,
  type FarmWork,
  type RipenessStage,
  type TradeGood,
  PARCEL_HECTARES,
  SEASON_LABELS,
  WEATHER_LABELS,
  currentSeason,
  conditionYieldFactor,
  type LedgerLine,
  dayOfSeason,
  SEASON_DAYS,
  footprintCells,
  orientedFootprint,
  withinRegret,
  levelProgress,
  levelUnlocks,
  type QuestView,
  currentObjective,
  evaluateObjectives,
  type GuideSnapshot,
  type Season,
  type Specialization,
  CROP_DEFS,
  GOOD_DEFS,
  FEED_VALUE,
  overlapsYard,
  YARD_REFUSAL,
  rationToServe,
  isMowCrop,
  leavesSwath,
  type CropCode,
  type BuildingType,
  type MachineType,
  type WeatherState,
  BREAKDOWN_LABELS,
  GREASE_COST_CRD,
  GREASE_FULL,
  GREASE_OK,
  CLEAN_COST_CRD,
  DIRT_DIRTY_THRESHOLD,
  careWearMultiplier,
  hoursBeforeWorkshop,
  jobHours,
  machineAgeYieldFactor,
  fuelCost,
  FUEL_TANK_L,
  weedLabel,
  machineLifeHours,
  machineHoursPerHectare,
  machinePower,
  machineWidth,
  machineRequiredHp,
  machineCost,
  asTier,
  TIER_LABELS,
  MACHINE_TIERS,
  canPull,
  type Tier,
  machineDealerValue,
  MACHINE_LISTING_MIN_RATE,
  MACHINE_LISTING_MAX_RATE,
  isBreakdownKind,
} from "@farmsim/shared";
import { AuthScreen, RecoveryNotice, type AuthMode } from "./AuthScreen";
import type { GrazingHerd, PreviewBuilding } from "./IsoFarmView";
import { BuildingSheet } from "./BuildingSheet";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { MachineCareOverlay, type CareMode } from "./MachineCareOverlay";
import { MissionPlay, type MissionPlayContract } from "./MissionPlay";
import { LivestockPanel, type BarnState, type OrphanYard } from "./LivestockPanel";
import type { SupplyCrate } from "./IsoFarmView";
import { MarketPanel, type Listing, type MarketDelivery, type FuturesContract } from "./MarketPanel";
import { OfficePanel, type CreditView, type ProcessingView } from "./OfficePanel";
import type { ContinentDetail, WorldContinent } from "./Onboarding";

// Three.js pèse plus lourd que tout le reste de l'application réunie. L'écran
// de connexion n'en a aucun besoin : on ne le télécharge qu'au moment où une
// vue 3D s'affiche vraiment.
const ArrivalTransition = lazy(() =>
  import("./ArrivalTransition").then((m) => ({ default: m.ArrivalTransition })),
);
const IsoFarmView = lazy(() =>
  import("./IsoFarmView").then((m) => ({ default: m.IsoFarmView })),
);
const Onboarding = lazy(() => import("./Onboarding").then((m) => ({ default: m.Onboarding })));
import { SplashScreen } from "./SplashScreen";
import { TutorialOverlay } from "./TutorialOverlay";
import { FieldDock } from "./FieldDock";
import { PlayGuide } from "./PlayGuide";
import { TOKEN_KEY, TUTORIAL_KEY, GUIDE_FLAGS_KEY } from "./storage-keys";
import { cropFromPlantTool, isPlantTool, isSoilTool, plantCropLabel, type Tool } from "./tools";
import {
  DEFAULT_MODS,
  applySelection,
  expandBrush,
  rectBetween,
  type PointerMods,
  type SelectMode,
} from "./ui/selection";
import { TOOL_GROUPS, groupOf, optionsFor } from "./ui/tool-options";
import { ToolRail } from "./ui/desktop/ToolRail";
import { SelectionBar } from "./ui/desktop/SelectionBar";
import { PanelHost, Window } from "./ui/desktop/Window";
import { Geste } from "./ui/Geste";
import {
  CellContextMenu,
  type CellContext,
  type CellContextItem,
} from "./ui/desktop/CellContextMenu";
import { SEASON_NAMES, SeasonSky } from "./ui/SeasonSky";
import { useIsMobile } from "./use-media-query";

/** Ce que la saison change vraiment, en une phrase. */
const SEASON_HINTS: Record<Season, string> = {
  SPRING: "l'herbe repousse vite, les bêtes se nourrissent au pré",
  SUMMER: "chaleur : surveillez les bêtes enfermées",
  AUTUMN: "la pousse ralentit, constituez les stocks",
  WINTER: "l'herbe ne pousse plus — rentrez les bêtes ou nourrissez-les",
};
import { DevPanel, type DevGrant } from "./DevPanel";
import { NO_ALERTS, tabBadge, useAwayAlerts, useNotificationState, type FarmAlerts } from "./use-alerts";

const API = "/api";

/** Durée d'affichage d'un message passager — charte §8.1 #17. */
const TOAST_MS = 3200;

type SessionResume = {
  awayMs: number;
  awayLabel: string;
  cropsReady: number;
  cropsGrowing: number;
  marketDelta: Record<string, number>;
  weatherStates: string[];
  hint: string;
  absenceLog?: { at: string; text: string }[];
  spent?: number;
};

type Cell = {
  id: string;
  x: number;
  y: number;
  kind: "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";
  crop?: CropCode | null;
  fieldStage?: string;
  fertilizedPasses?: number;
  harvestsSincePlow?: number;
  residuePasses?: number;
  hasStubble?: boolean;
  /** Pression d'adventices, 0 à 1. */
  weedPressure?: number;
  directSeeded?: boolean;
  lastCrop?: CropCode | null;
  cropStreak?: number;
  strawTons?: number;
  baleCount?: number;
  buildingId?: string | null;
  machineId?: string | null;
  machineType?: MachineType | null;
};

type Building = {
  id: string;
  type: BuildingType;
  originX: number;
  originY: number;
  level?: number;
  /** Quarts de tour, 0 à 3 */
  rotation?: number;
  /** Date de pose : elle ouvre la fenêtre de remboursement intégral */
  createdAt?: string;
};

type Parcel = {
  id: string;
  label: string;
  mapX: number;
  mapY: number;
  landPrice: number;
  farmId?: string | null;
  gridW: number;
  gridH: number;
  fertility?: number;
  zone?: ZoneRef;
  cells?: Cell[];
  buildings?: Building[];
  machines?: { id: string; type: string }[];
  farm?: { userId?: string; user?: { id: string; displayName: string } | null } | null;
};

type ZoneRef = {
  code: string;
  name: string;
  koppen: string;
  continentCode?: string;
  continentName?: string;
  city?: string;
  climateLabel?: string;
  hemisphere?: string;
};

type Zone = {
  id: string;
  code: string;
  name: string;
  koppen: string;
  mapW: number;
  mapH: number;
  parcels: Parcel[];
};

/** Une machine d'occasion en vente, telle que la renvoie l'API. */
type MachineListing = {
  id: string;
  sellerId: string;
  seller?: { id: string; displayName: string } | null;
  type: string;
  name: string;
  hours: number;
  condition: number;
  priceCrd: number;
  quote: number;
  breakdown?: string | null;
};

type Player = {
  id: string;
  displayName: string;
  specialization: Specialization;
  level: number;
  xp: number;
  crd: number;
  farm: {
    id: string;
    /** Gazole en cuve, en litres. */
    fuelL?: number;
    parcels: Parcel[];
    machines: {
      id: string;
      type: string;
      condition: number;
      /** Compteur horaire. Absent sur une base d'avant le compteur. */
      hours?: number;
      /** Palier 1 à 3 : il décide de la largeur, de la puissance et du prix. */
      tier?: number;
      parkedParcelId?: string | null;
      storedInBuildingId?: string | null;
      greased?: boolean;
      /** Niveau de graisse 0–100. Absent sur une base d'avant la jauge. */
      grease?: number;
      dirt?: number;
      greaseSkipStreak?: number;
      breakdown?: string | null;
    }[];
    inventory: { id: string; itemCode: string; qty: number; quality: number; moisture: number }[];
  } | null;
  bonuses?: {
    yieldBonus: number;
    storageGrain: number;
    storageHay: number;
    machineSlots: number;
    cattleSlots: number;
    pigSlots: number;
    softDryer?: boolean;
  };
  grainDump?: {
    soldTons: number;
    storedTons: number;
    revenue: number;
    reason: "NO_SILO" | "SILO_FULL" | null;
  };
  appearance?: CharacterAppearance;
  consignes?: {
    harvest: boolean;
    stubble: boolean;
    plow: boolean;
    straw: boolean;
    npcAllowed: boolean;
    maxSpend: number;
  };
  /** Compte développeur : panneau Test et trésorerie illimitée. */
  dev?: boolean;
  unlimitedCrd?: boolean;
};

function hasUnlimitedFunds(player: Player | null | undefined): boolean {
  return Boolean(player?.unlimitedCrd || player?.dev);
}

function canPay(player: Player | null | undefined, cost: number): boolean {
  if (hasUnlimitedFunds(player)) return true;
  return (player?.crd ?? 0) >= cost;
}

function walletLabel(player: Player): string {
  return hasUnlimitedFunds(player) ? "∞ TRN" : `${Math.round(player.crd)} TRN`;
}

type Contract = {
  id: string;
  jobType: string;
  title: string;
  rewardCrd: number;
  regionNote: string;
  cells?: number;
  status?: string;
  work?: FarmWork;
  machineType?: string;
};

type LaborOrderView = {
  id: string;
  kind: "P2P";
  work: FarmWork;
  crop: string | null;
  cells: number;
  remaining: number;
  cellList: { x: number; y: number }[];
  quoteCrd: number;
  escrowCrd: number;
  payoutCrd: number;
  status: string;
  parcelId: string;
  parcelLabel: string;
  zoneName: string;
  clientName: string;
  npc?: boolean;
  expiresAt: string;
};

type MarketPrice = { commodity: string; price: number; stockTons: number };
type WeatherSnap = { id: string; zoneCode: string; state: WeatherState; updatedAt?: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    /*
     * Jeton mort : on repart proprement à l'écran de connexion.
     *
     * Le serveur ne vérifiait la session que sur onze routes ; les autres
     * acceptaient n'importe quel `userId`, si bien qu'un jeton expiré
     * continuait de « marcher ». Maintenant qu'elles refusent toutes, ce
     * chemin devient atteignable — et sans cela, le joueur restait devant une
     * ferme vivante qui répondait « Session expirée » à chacun de ses gestes,
     * sans qu'aucun ne lui propose de se reconnecter.
     */
    if (res.status === 401 && token) {
      clearSession();
      window.location.reload();
    }
    const flat = data as { error?: string; formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const field = flat.fieldErrors
      ? Object.values(flat.fieldErrors).flat().find(Boolean)
      : undefined;
    throw new Error(flat.error ?? flat.formErrors?.[0] ?? field ?? "Erreur serveur");
  }
  return data as T;
}

/** Attente pendant le téléchargement d'une vue 3D. */
function SceneLoading({ label }: { label: string }) {
  return (
    <div className="scene-loading" role="status" aria-live="polite">
      <span className="scene-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

/**
 * Conserve la référence précédente quand la charge utile est identique.
 *
 * Le jeu interroge le serveur toutes les quatre, huit et dix secondes. Chaque
 * réponse produisait des objets neufs, même inchangés : React y voyait un
 * changement, invalidait tous les mémos qui en dépendent et rerendait l'écran
 * pour rien. Sur un appareil qui peine, ces rendus inutiles sont exactement ce
 * qui déclenche les violations de handler.
 *
 * La comparaison sérialisée coûte quelques dixièmes de milliseconde sur des
 * charges de cette taille, contre plusieurs millisecondes pour un rendu
 * complet.
 */
function keepIfSame<T>(prev: T, next: T): T {
  try {
    return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
  } catch {
    return next;
  }
}

/**
 * Faut-il barrer l'écran pour raconter l'absence ?
 *
 * Le seuil était de trente secondes, et le bilan s'affichait dans une fenêtre
 * modale. En jouant, un simple aller-retour vers un autre onglet suffisait à
 * décrocher un panneau bloquant plein écran intitulé « Pendant votre absence —
 * Absent 38s », qu'il fallait acquitter d'un clic pour reprendre la partie.
 *
 * Deux conditions désormais, et non plus une. La durée seule ne justifie rien :
 * revenir après une heure sur une ferme où rien n'a bougé ne mérite pas un
 * barrage. Ce qui le mérite, c'est qu'il se soit **passé** quelque chose qu'on
 * regretterait de manquer — une culture perdue, une dépense engagée par les
 * consignes, une bête laissée sans ration. C'est ce que porte le journal
 * d'absence.
 */
const RESUME_MODAL_MS = 10 * 60_000;
const RESUME_TOAST_MS = 60_000;

function resumeImportance(resume: SessionResume | null | undefined): "modale" | "toast" | "rien" {
  if (!resume) return "rien";
  const eventful = (resume.absenceLog?.length ?? 0) > 0 || (resume.spent ?? 0) > 0;
  if (eventful && resume.awayMs >= RESUME_MODAL_MS) return "modale";
  // Assez longtemps pour que le monde ait bougé, mais rien à acquitter : le
  // message passe, il ne barre pas.
  if (resume.awayMs >= RESUME_TOAST_MS) return "toast";
  return "rien";
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("farmsim_player");
}

type GuideFlags = { sold: boolean; harvested: boolean; contract: boolean };

function readGuideFlags(): GuideFlags {
  try {
    const raw = localStorage.getItem(GUIDE_FLAGS_KEY);
    if (!raw) return { sold: false, harvested: false, contract: false };
    const parsed = JSON.parse(raw) as Partial<GuideFlags>;
    return {
      sold: !!parsed.sold,
      harvested: !!parsed.harvested,
      contract: !!parsed.contract,
    };
  } catch {
    return { sold: false, harvested: false, contract: false };
  }
}

function writeGuideFlags(next: GuideFlags) {
  localStorage.setItem(GUIDE_FLAGS_KEY, JSON.stringify(next));
}

/** Tiroirs du bas, sur petit écran. */
type SheetKey = "INFO" | "BUILD" | "GARAGE" | "OFFICE" | "HERD" | "PROFILE";

/**
 * Les cinq onglets du bas.
 *
 * Leurs icônes étaient des emoji — 🌾 🏗️ 🐄 🚜 🤝 — alors que les outils, eux,
 * avaient de vrais dessins depuis toujours (`/assets/icons/tools/*.svg`). Les
 * cinq boutons les plus vus du jeu, présents sur chaque écran, étaient donc
 * les seuls dont l'apparence dépendait du téléphone du joueur : ronds et
 * brillants sur iPhone, plats sur Android, et jamais dans la palette.
 */
const SHEET_TABS: { key: SheetKey; label: string; icon: string }[] = [
  { key: "INFO", label: "Parcelle", icon: "/assets/icons/nav/parcelle.svg" },
  { key: "BUILD", label: "Bâtir", icon: "/assets/icons/nav/batir.svg" },
  { key: "HERD", label: "Troupeau", icon: "/assets/icons/nav/troupeau.svg" },
  { key: "GARAGE", label: "Garage", icon: "/assets/icons/nav/garage.svg" },
  { key: "OFFICE", label: "Missions", icon: "/assets/icons/nav/missions.svg" },
];

/** Temps restant d'un chantier, en clair. */
function formatChantierReste(endsAt: number, now: number): string {
  const reste = Math.max(0, endsAt - now);
  if (reste < 1000) return "terminé";
  const s = Math.ceil(reste / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}`;
}

function wearNote(machine?: {
  type?: string;
  condition?: number;
  broke?: boolean;
  breakdown?: string | null;
}): string {
  if (!machine || machine.condition == null) return "";
  const panne =
    machine.broke && isBreakdownKind(machine.breakdown)
      ? ` · PANNE ${BREAKDOWN_LABELS[machine.breakdown]}`
      : "";
  return ` · ${machine.type} ${machine.condition.toFixed(0)}%${panne}`;
}

function harvestGrainNote(r: {
  totalTons?: number;
  storedTons?: number;
  soldTons?: number;
  soldRevenue?: number;
  soldReason?: "NO_SILO" | "SILO_FULL" | null;
  hayTons?: number;
  grassRegrew?: number;
}): string {
  if (r.hayTons && r.hayTons > 0 && (r.totalTons ?? 0) <= r.hayTons + 0.001) {
    return r.grassRegrew
      ? `Foin ${r.hayTons.toFixed(2)} t en hangar · le champ reprend`
      : `Foin ${r.hayTons.toFixed(2)} t en hangar`;
  }
  const total = r.totalTons != null ? r.totalTons.toFixed(2) : "";
  const hay = r.hayTons ? ` · foin ${r.hayTons.toFixed(2)} t` : "";
  if (!r.soldTons) return `Récolte ${total} t${hay}`;
  const money = r.soldRevenue ? ` · +${Math.round(r.soldRevenue)} TRN` : "";
  if (r.soldReason === "NO_SILO") {
    return `Récolte ${total} t vendue au champ, faute de silo${money}${hay}`;
  }
  return `Récolte ${total} t · ${r.soldTons.toFixed(2)} t vendues (silo plein)${money}${hay}`;
}

/** Sons UI optionnels — ignorés tant qu’aucun asset n’est fourni */
function playUiSound(_kind: "click" | "place") {
  const urls: Partial<Record<"click" | "place", string>> = {};
  const url = urls[_kind];
  if (!url) return;
  try {
    new Audio(url).play().catch(() => undefined);
  } catch {
    /* skip */
  }
}

export function App() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [market, setMarket] = useState<MarketPrice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [laborBoard, setLaborBoard] = useState<LaborOrderView[]>([]);
  const [myPostedLabor, setMyPostedLabor] = useState<LaborOrderView[]>([]);
  const [visitOrder, setVisitOrder] = useState<LaborOrderView | null>(null);
  const [activeMission, setActiveMission] = useState<MissionPlayContract | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  /** Ce que le joueur tape dans l'écran d'oubli. */
  const [recoveryInput, setRecoveryInput] = useState("");
  /** Le code que le serveur vient de remettre, à montrer une seule fois. */
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("ferme");
  const [activeParcelId, setActiveParcelId] = useState<string | null>(null);
  const [parcelDetail, setParcelDetail] = useState<{
    parcel: Parcel;
    bonuses: Player["bonuses"];
    weather?: WeatherSnap | null;
    cellSims: {
      x: number;
      y: number;
      sim: {
        progress: number;
        ready: boolean;
        ripeness?: {
          stage: RipenessStage;
          label: string;
          yieldFactor: number;
          msToLoss: number;
        } | null;
        lost?: boolean;
      };
    }[];
    workers?: FieldWorkerView[];
    labor?: LaborOrderView[];
  } | null>(null);
  const [tool, setTool] = useState<Tool>("SELECT");
  /** Outils de test : n'existent que si le serveur les autorise. */
  const [devEnabled, setDevEnabled] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const isMobile = useIsMobile();
  /**
   * Tiroir ouvert sur petit écran. Un seul à la fois : superposer des
   * panneaux sur un téléphone revient à masquer la ferme, qui est pourtant
   * ce qu'on est venu regarder.
   */
  const [sheet, setSheet] = useState<SheetKey | null>(null);
  /**
   * Le menu « Plus », sur téléphone.
   *
   * Les cinq panneaux occupaient une barre permanente sous celle des outils.
   * Ils vivent maintenant dans un tiroir qu'on ouvre, et qui se referme dès
   * qu'un panneau s'ouvre : jamais deux couches de menu à la fois.
   */
  const [moreOpen, setMoreOpen] = useState(false);
  /** Semer dans les chaumes plutôt que de travailler le sol au préalable */
  const [directSeed, setDirectSeed] = useState(false);
  /**
   * Laisser l'andain derrière la moissonneuse.
   *
   * Vrai par défaut : c'est ce que le jeu faisait déjà, et une ferme qui
   * comptait sur sa paille ne doit pas la perdre parce qu'une option est
   * apparue. Sans andain, il n'y a rien à presser — donc pas de bottes, pas
   * de litière, pas de vente de paille.
   */
  const [keepSwath, setKeepSwath] = useState(true);
  const [buildType, setBuildType] = useState<BuildingType>("SILO");
  /** Quarts de tour du bâtiment à poser, 0 à 3 — touche `R` ou bouton ⟳ */
  const [buildRotation, setBuildRotation] = useState(0);
  /**
   * Place retenue mais pas encore payée.
   *
   * Un clic sur la parcelle déclenchait autrefois la dépense directement :
   * cinq clics involontaires posaient cinq silos, et la seule sortie était de
   * les démolir à perte. La pose se fait maintenant en deux temps — on retient
   * la case, on la tourne si besoin, puis on confirme.
   */
  const [pendingBuild, setPendingBuild] = useState<{ x: number; y: number } | null>(null);
  /** Bâtiment ouvert dans sa fiche : améliorer, tourner, démolir, faire sortir */
  const [openBuildingId, setOpenBuildingId] = useState<string | null>(null);
  /** Objectifs du joueur : l'avancement vient du serveur, pas du navigateur. */
  const [quests, setQuests] = useState<QuestView[]>([]);
  const [selectedCells, setSelectedCells] = useState<{ x: number; y: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [machineListings, setMachineListings] = useState<MachineListing[]>([]);
  /** Chantier en cours — ce que la ferme est en train de faire, et jusqu'à quand. */
  const [chantier, setChantier] = useState<{
    work: FarmWork;
    cells: { x: number; y: number }[];
    endsAt: number;
    durationMs: number;
  } | null>(null);
  /** Palier montré au catalogue — un seul réglage pour toute la liste. */
  const [tierAchat, setTierAchat] = useState<Tier>(1);
  /**
   * Les places de garage, lues là où le serveur les compte.
   *
   * Le catalogue proposait chaque engin quel que soit le parc, et le clic
   * revenait en 409 « Slots machines pleins ». Une place qui manque se sait
   * avant de cliquer, exactement comme un TRN qui manque.
   */
  const parcMachines = player?.farm?.machines?.length ?? 0;
  const slotsMachines = player?.bonuses?.machineSlots ?? 0;
  const placeAuGarage = parcMachines < slotsMachines;
  const cuveL = player?.farm?.fuelL ?? 0;
  /** L'état de la ligne de crédit, rechargé à l'ouverture du Bureau. */
  const [credit, setCredit] = useState<CreditView | null>(null);
  const [ateliers, setAteliers] = useState<ProcessingView[]>([]);
  const [care, setCare] = useState<{
    mode: CareMode;
    machineId: string;
    kind?: "BELT" | "HYDRAULIC" | "ENGINE";
  } | null>(null);
  const [showEta, setShowEta] = useState(false);
  /**
   * Le journal des mouvements, chargé à l'ouverture du Bureau.
   *
   * Il ne sert qu'à cet écran et ne change qu'au rythme des gestes du joueur :
   * le tenir en permanence dans l'état ferait vivre une liste que personne ne
   * regarde, et le recharger à chaque tick du monde n'apprendrait rien.
   */
  const [ledger, setLedger] = useState<LedgerLine[]>([]);
  const [showGarage, setShowGarage] = useState(false);
  const [showHerd, setShowHerd] = useState(false);
  const [weather, setWeather] = useState<WeatherSnap[]>([]);
  const [brush, setBrush] = useState<1 | 2 | 3>(1);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const [absenceLines, setAbsenceLines] = useState<string[]>([]);
  const [booting, setBooting] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideFlags, setGuideFlags] = useState(() => readGuideFlags());
  const [pulseCells, setPulseCells] = useState<{ x: number; y: number }[]>([]);
  const [activeWork, setActiveWork] = useState<{
    type: MachineType;
    cells: { x: number; y: number }[];
    condition?: number;
    cut?: "harvest" | "mow";
    haul?: boolean;
    cargo?: string;
    /** Durée du chantier : l'engin doit traverser le champ en ce temps-là. */
    durationMs?: number;
  } | null>(null);
  const haulPendingRef = useRef<Set<string>>(new Set());
  const haulSeenRef = useRef<Set<string>>(new Set());
  const haulReadyRef = useRef(false);
  const playHaulRef = useRef<(commodity?: string) => void>(() => undefined);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  /** Menu contextuel de case — bureau seulement, le doigt n'a pas de clic droit. */
  const [cellMenu, setCellMenu] = useState<CellContext | null>(null);
  /** Saison affichée la dernière fois : sert à annoncer le passage. */
  const lastSeasonRef = useRef<Season | null>(null);
  const [toastTick, setToastTick] = useState(0);
  const [toastTone, setToastTone] = useState<"good" | "warn">("good");
  const [worldContinents, setWorldContinents] = useState<WorldContinent[]>([]);
  const [continentDetail, setContinentDetail] = useState<ContinentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [barns, setBarns] = useState<BarnState[]>([]);
  const [orphanYards, setOrphanYards] = useState<OrphanYard[]>([]);
  /**
   * Les commandes passées au négociant, en route ou posées dans la cour.
   *
   * L'achat ne verse plus au silo : il envoie un camion. La caisse existe donc
   * sur la ferme, et c'est le joueur qui la rentre — voir `SupplyOrder` côté
   * serveur pour le pourquoi.
   */
  const [supplies, setSupplies] = useState<SupplyCrate[]>([]);

  /**
   * Les transports en cours vers un bâtiment.
   *
   * Une entrée est un **signal de départ**, pas un état : la vue lance la
   * caisse à son apparition et n'y revient plus. On les efface donc au bout
   * d'une seconde et demie, le temps du vol, pour que la liste ne grossisse
   * pas à chaque ration distribuée.
   */
  const [hauls, setHauls] = useState<{ id: string; x: number; y: number; commodity: string }[]>([]);

  function lancerTransport(buildingId: string, commodity: string) {
    const b = (parcel?.buildings ?? []).find((x) => x.id === buildingId);
    if (!b) return;
    const id = `${buildingId}:${Date.now()}`;
    const def = BUILDING_DEFS[b.type];
    setHauls((prev) => [
      ...prev,
      {
        id,
        x: b.originX + Math.floor(def.w / 2),
        y: b.originY + Math.floor(def.h / 2),
        commodity,
      },
    ]);
    window.setTimeout(() => setHauls((prev) => prev.filter((h) => h.id !== id)), 1500);
  }
  /** Cases assombries après un épandage de fumier, jusqu'à cette date. */
  const [manureStain, setManureStain] = useState<Record<string, number>>({});
  const [listings, setListings] = useState<Listing[]>([]);
  const [deliveries, setDeliveries] = useState<MarketDelivery[]>([]);
  const [onlinePlayers, setOnlinePlayers] = useState<
    { id: string; name: string; online: boolean; lastSeenAt: number | null }[]
  >([]);
  const onlineSeenRef = useRef<Set<string>>(new Set());
  const onlineReadyRef = useRef(false);
  const [showMarket, setShowMarket] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [showArrival, setShowArrival] = useState(false);
  const arrivalShownRef = useRef(false);

  function applyAuth(payload: { token: string; player: Player; resume?: SessionResume | null }) {
    localStorage.setItem(TOKEN_KEY, payload.token);
    // Le vol d'approche doit être décidé dans le même rendu que l'arrivée du
    // joueur : sinon la ferme s'affiche une fraction de seconde, puis
    // l'animation se déclenche par-dessus, ce qui n'a aucun sens.
    if (payload.player.farm?.parcels?.length) {
      arrivalShownRef.current = true;
      setShowArrival(true);
      setActiveParcelId(payload.player.farm.parcels[0].id);
    }
    setPlayer(payload.player);
    const poids = resumeImportance(payload.resume);
    if (poids === "modale") {
      setResumeBanner(payload.resume!.hint);
      setAbsenceLines((payload.resume!.absenceLog ?? []).map((l) => l.text));
    } else if (poids === "toast") {
      setMsg(payload.resume!.hint);
    }
  }

  const playerIdRef = useRef<string | null>(null);
  playerIdRef.current = player?.id ?? null;

  const refreshMeta = useCallback(async () => {
    const uid = playerIdRef.current;
    const [z, m, c, w, labor, peers] = await Promise.all([
      api<Zone[]>("/zones"),
      api<MarketPrice[]>("/market"),
      api<{ contracts: Contract[]; active: Contract | null }>(
        uid ? `/contracts?userId=${encodeURIComponent(uid)}` : "/contracts",
      ),
      api<WeatherSnap[]>("/weather"),
      uid
        ? api<{ orders: LaborOrderView[]; active: LaborOrderView | null; posted: LaborOrderView[] }>(
            `/labor-orders?userId=${encodeURIComponent(uid)}`,
          )
        : Promise.resolve({ orders: [] as LaborOrderView[], active: null, posted: [] as LaborOrderView[] }),
      uid
        ? api<{ players: { id: string; name: string; online: boolean; lastSeenAt: number | null }[] }>(
            `/players?userId=${encodeURIComponent(uid)}`,
          )
        : Promise.resolve({ players: [] }),
    ]);
    setPrevPrices((prev) => {
      if (Object.keys(prev).length === 0) {
        return Object.fromEntries(m.map((x) => [x.commodity, x.price]));
      }
      return prev;
    });
    // Zones, contrats et météo ne bougent presque jamais, mais chaque sondage
    // en livrait des objets neufs : React voyait un changement, invalidait les
    // mémos et rerendait tout l'écran pour des données identiques.
    setZones((prev) => keepIfSame(prev, z));
    setMarket((prev) => keepIfSame(prev, m));
    setContracts((prev) => keepIfSame(prev, c.contracts));
    setLaborBoard((prev) => keepIfSame(prev, labor.orders));
    setMyPostedLabor((prev) => keepIfSame(prev, labor.posted));
    setOnlinePlayers((prev) => keepIfSame(prev, peers.players));
    const liveNow = peers.players.filter((p) => p.online);
    if (onlineReadyRef.current) {
      const arrived = liveNow.find((p) => !onlineSeenRef.current.has(p.id));
      if (arrived) {
        setErr(null);
        setMsg(`${arrived.name} vient de se connecter`);
        setToastTick((n) => n + 1);
      }
    }
    onlineReadyRef.current = true;
    onlineSeenRef.current = new Set(liveNow.map((p) => p.id));
    if (labor.active) {
      setVisitOrder((prev) => (prev?.id === labor.active!.id ? prev : labor.active));
    }
    if (c.active && c.active.cells) {
      const work = (c.active.work ??
        (c.active.jobType === "HARVEST"
          ? "HARVEST"
          : c.active.jobType === "SOW"
            ? "PLANT"
            : c.active.jobType === "FERTILIZE"
              ? "FERTILIZE"
              : "PLOW")) as FarmWork;
      setActiveMission({
        id: c.active.id,
        title: c.active.title,
        jobType: c.active.jobType,
        rewardCrd: c.active.rewardCrd,
        regionNote: c.active.regionNote,
        cells: c.active.cells,
        work,
        machineType: c.active.machineType,
      });
    }
    setWeather((prev) => keepIfSame(prev, w));
  }, []);

  const loadWorld = useCallback(async () => {
    const w = await api<{ continents: WorldContinent[] }>("/world");
    setWorldContinents(w.continents);
  }, []);

  const loadContinent = useCallback(async (code: string) => {
    setDetailLoading(true);
    try {
      const d = await api<ContinentDetail>(`/world/${code}`);
      setContinentDetail(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshPlayer = useCallback(async () => {
    const me = await api<{ player: Player }>("/auth/me");
    if (me.player.grainDump && me.player.grainDump.soldTons > 0) {
      const dump = me.player.grainDump;
      const money = dump.revenue ? ` · +${Math.round(dump.revenue)} TRN` : "";
      flashToast(
        dump.reason === "NO_SILO"
          ? `${dump.soldTons.toFixed(1)} t vendues au champ, faute de silo${money}`
          : `Silo plein : ${dump.soldTons.toFixed(1)} t vendues au champ${money}`,
        "warn",
      );
      markGuideFlag("sold");
    }
    setPlayer((prev) => keepIfSame(prev, me.player));
    if (!activeParcelId && me.player.farm?.parcels[0]) {
      setActiveParcelId(me.player.farm.parcels[0].id);
    }
    return me.player;
  }, [activeParcelId]);

  /**
   * Les commandes en cours, relues régulièrement.
   *
   * Un camion met douze secondes : il faut donc revenir voir. On sonde toutes
   * les cinq secondes tant qu'il en reste une en route, et on s'arrête sinon —
   * une ferme sans commande n'a aucune raison d'interroger le serveur.
   */
  const loadSupplies = useCallback(async (farmId: string) => {
    try {
      const r = await api<{ supplies: SupplyCrate[] }>(`/farms/${farmId}/supplies`);
      setSupplies(r.supplies);
    } catch {
      setSupplies([]);
    }
  }, []);

  const loadLivestock = useCallback(async (parcelId: string) => {
    try {
      const r = await api<{ barns: BarnState[]; orphanYards?: OrphanYard[] }>(
        `/parcels/${parcelId}/livestock`,
      );
      setBarns((prev) => keepIfSame(prev, r.barns));
      setOrphanYards((prev) => keepIfSame(prev, r.orphanYards ?? []));
    } catch {
      setBarns([]);
      setOrphanYards([]);
    }
  }, []);

  const farmId = player?.farm?.id;
  useEffect(() => {
    if (!farmId) return;
    void loadSupplies(farmId);
    // On ne sonde que s'il y a de quoi attendre : soit une commande en route,
    // soit une caisse posée qu'on n'a pas encore rentrée.
    const t = window.setInterval(() => void loadSupplies(farmId), 5000);
    return () => window.clearInterval(t);
  }, [farmId, loadSupplies]);

  useEffect(() => {
    if (player?.dev || player?.unlimitedCrd) {
      setDevEnabled(true);
      return;
    }
    api<{ enabled: boolean }>("/dev/status")
      .then((r) => setDevEnabled(r.enabled))
      .catch(() => setDevEnabled(false));
  }, [player?.id, player?.dev, player?.unlimitedCrd]);

  async function devGrant(grant: DevGrant) {
    setBusy(true);
    try {
      const r = await api<{ done: string[] }>("/dev/grant", {
        method: "POST",
        body: JSON.stringify(grant),
      });
      await refreshPlayer();
      if (activeParcelId) await loadParcel(activeParcelId).catch(() => undefined);
      flashToast(r.done.length ? `Test : ${r.done.join(" · ")}` : "Rien à faire");
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function devTick() {
    setBusy(true);
    try {
      await api("/sim/tick", { method: "POST" });
      await Promise.all([refreshMeta(), refreshPlayer()]);
      flashToast("Monde avancé d’un tick");
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  const [futures, setFutures] = useState<FuturesContract[]>([]);

  const loadFutures = useCallback(async () => {
    try {
      const r = await api<{ contracts: FuturesContract[] }>("/futures");
      setFutures((prev) => keepIfSame(prev, r.contracts));
    } catch {
      setFutures([]);
    }
  }, []);

  async function openFuture(commodity: TradeGood, tons: number, horizonH: number) {
    setBusy(true);
    try {
      const r = await api<{ pricePerTon: number }>("/futures", {
        method: "POST",
        body: JSON.stringify({ commodity, tons, horizonH }),
      });
      await loadFutures();
      flashToast(`Engagé ${tons} t à ${r.pricePerTon.toFixed(0)} TRN/t`);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function deliverFuture(id: string) {
    setBusy(true);
    try {
      const r = await api<{ revenue: number; outcome: { delta: number; better: boolean } }>(
        `/futures/${id}/deliver`,
        { method: "POST" },
      );
      await Promise.all([refreshPlayer(), loadFutures()]);
      const verdict =
        r.outcome.delta === 0
          ? ""
          : r.outcome.better
            ? ` · ${r.outcome.delta} TRN de mieux que le comptant`
            : ` · ${Math.abs(r.outcome.delta)} TRN de moins que le comptant`;
      flashToast(`Livré · +${r.revenue} TRN${verdict}`);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  const loadPriceHistory = useCallback(async (commodity: TradeGood) => {
    const r = await api<{ series: Record<string, { at: string; price: number }[]> }>(
      `/market/history?commodity=${encodeURIComponent(commodity)}&hours=3`,
    );
    return r.series[commodity] ?? [];
  }, []);

  const loadListings = useCallback(async (playerId: string) => {
    try {
      const r = await api<{ listings: Listing[] }>(
        `/market/listings?userId=${encodeURIComponent(playerId)}`,
      );
      setListings((prev) => keepIfSame(prev, r.listings));
    } catch {
      setListings([]);
    }
  }, []);

  const loadDeliveries = useCallback(async (playerId: string) => {
    try {
      const r = await api<{ deliveries: MarketDelivery[] }>(
        `/deliveries?userId=${encodeURIComponent(playerId)}`,
      );
      setDeliveries((prev) => keepIfSame(prev, r.deliveries));
      for (const d of r.deliveries) {
        if (d.role !== "BUYER") continue;
        if (d.status === "PENDING") {
          haulPendingRef.current.add(d.id);
          continue;
        }
        if (d.status !== "DELIVERED") continue;
        const wasPending = haulPendingRef.current.has(d.id);
        haulPendingRef.current.delete(d.id);
        if (wasPending && haulReadyRef.current && !haulSeenRef.current.has(d.id)) {
          haulSeenRef.current.add(d.id);
          playHaulRef.current(d.commodity);
        } else {
          haulSeenRef.current.add(d.id);
        }
      }
      haulReadyRef.current = true;
    } catch {
      setDeliveries([]);
    }
  }, []);

  const loadParcel = useCallback(async (id: string) => {
    const d = await api<typeof parcelDetail>(`/parcels/${id}`);
    setParcelDetail((prev) => keepIfSame(prev, d));
  }, []);

  useEffect(() => {
    refreshMeta().catch((e) => setErr(String(e.message ?? e)));
    loadWorld().catch(() => undefined);
    const t = setInterval(() => {
      refreshMeta().catch(() => undefined);
      // Le stock aussi vieillit : le lait et la viande se dégradent sur le
      // tick du serveur, et sans ce rappel le silo restait figé à l'écran
      // pendant des minutes — d'où l'impression qu'ils ne périmaient jamais.
      //
      // Mais seulement une fois connecté : sans jeton, `/auth/me` répond 401,
      // et l'écran de connexion accumulait une erreur toutes les dix secondes
      // dans la console pour une requête qui ne pouvait pas aboutir.
      if (localStorage.getItem(TOKEN_KEY)) refreshPlayer().catch(() => undefined);
    }, 10000);
    return () => clearInterval(t);
  }, [refreshMeta, loadWorld, refreshPlayer]);

  /**
   * `R` tourne, `Échap` renonce.
   *
   * L'idiome est celui de tous les jeux de construction : on n'apprend pas une
   * touche, on la connaît déjà. Les boutons de la barre de pose font la même
   * chose, pour qui ne la connaît pas.
   */
  useEffect(() => {
    if (tool !== "BUILD") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "r" || e.key === "R") {
        setBuildRotation((r) => (r + 1) % 4);
      } else if (e.key === "Escape" && pendingBuild) {
        setPendingBuild(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tool, pendingBuild]);

  /**
   * Raccourcis de bureau.
   *
   * Le jeu n'en avait que deux, `R` et `Échap`, et uniquement en mode
   * construction : impossible de changer d'outil, de vider une sélection ou
   * d'ouvrir un panneau sans la souris. Ils sont volontairement absents au
   * téléphone — un clavier logiciel n'a pas de Ctrl, et rien ne doit changer
   * de comportement selon qu'un clavier Bluetooth est branché ou non.
   *
   * Chaque touche est affichée quelque part dans l'interface : le rail porte
   * les chiffres, la barre de sélection porte Entrée et Échap.
   */
  useEffect(() => {
    if (isMobile || !player) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (el?.isContentEditable) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+A : tout ce que l'outil courant peut travailler.
      if (ctrl && (e.key === "a" || e.key === "A")) {
        if (!isStrokeTool(tool)) return;
        e.preventDefault();
        setSelectedCells(eligibleCells(tool));
        return;
      }
      // Les autres raccourcis ne doivent jamais voler un Ctrl+C, Ctrl+R…
      if (ctrl || e.altKey) return;

      // Échap dégrade : d'abord le menu, puis la sélection, puis l'outil.
      if (e.key === "Escape") {
        if (cellMenu) setCellMenu(null);
        else if (selectedCells.length) setSelectedCells([]);
        else if (tool !== "SELECT") setTool("SELECT");
        return;
      }
      if (e.key === "Enter") {
        if (selectedCells.length && !busy) {
          e.preventDefault();
          runSelectionAction();
        }
        return;
      }

      const group = groupOf(tool);
      const options = optionsFor(group);
      // Q et E font défiler les options de la famille courante — c'est ce qui
      // remplace, au clavier, la rangée horizontale devenue inatteignable.
      if ((e.key === "q" || e.key === "e") && options.length > 1) {
        const i = options.findIndex((o) => o.tool === tool);
        const step = e.key === "e" ? 1 : -1;
        const next = options[(i + step + options.length) % options.length];
        if (next) setTool(next.tool);
        return;
      }
      if (e.key === "[" || e.key === "]") {
        setBrush((b) => {
          const n = e.key === "]" ? b + 1 : b - 1;
          return (Math.min(3, Math.max(1, n)) as 1 | 2 | 3);
        });
        return;
      }

      const digit = TOOL_GROUPS.find((g) => g.hotkey === e.key);
      if (digit) {
        if (digit.id === "SELL") setShowMarket(true);
        else if (digit.entry) pickTool(digit.entry);
        return;
      }

      if (e.key === "g" || e.key === "G") setShowGarage((v) => !v);
      else if (e.key === "t" || e.key === "T") setShowEta((v) => !v);
      else if (e.key === "m" || e.key === "M") setShowMarket((v) => !v);
      else if (e.key === "?") setShowGuide(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, player?.id, tool, selectedCells, cellMenu, busy]);

  // Changer de bâtiment ne garde pas la place retenue — un fantôme de silo
  // resté après le passage au poulailler poserait le mauvais. Mais on ne
  // revient pas à rien pour autant : on propose aussitôt une place tenable,
  // sans quoi choisir un bâtiment n'affichait rien du tout sur un écran sans
  // survol, et il fallait deviner qu'il restait une case à toucher.
  //
  // La rotation n'est volontairement pas dans les dépendances : tourner doit
  // faire pivoter le bâtiment sur place, pas le renvoyer au centre.
  //
  // Uniquement sans souris : sur un écran de bureau le survol montre déjà le
  // fantôme à l'instant où l'on passe sur le champ, et le figer d'office
  // retirerait ce suivi sans rien régler.
  useEffect(() => {
    const propose = isMobile && tool === "BUILD" ? firstFreeSpot(buildType, buildRotation) : null;
    setPendingBuild(propose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, buildType, activeParcelId, isMobile]);

  useEffect(() => {
    setPrevPrices((prev) => {
      const next = { ...prev };
      for (const m of market) {
        if (prev[m.commodity] === undefined) next[m.commodity] = m.price;
      }
      return next;
    });
    const t = setTimeout(() => {
      setPrevPrices(Object.fromEntries(market.map((x) => [x.commodity, x.price])));
    }, 4000);
    return () => clearTimeout(t);
  }, [market]);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      localStorage.removeItem("farmsim_player");
      setBooting(false);
      return;
    }
    api<{ player: Player }>("/auth/me")
      .then(async (me) => {
        // Le monde d'abord : le vol d'approche a besoin du globe peuplé.
        await loadWorld().catch(() => undefined);
        if (me.player.farm?.parcels?.length) {
          arrivalShownRef.current = true;
          setShowArrival(true);
          setActiveParcelId(me.player.farm.parcels[0].id);
        }
        setPlayer(me.player);
        const resume = await api<SessionResume>("/session/resume");
        const poids = resumeImportance(resume);
        if (poids === "modale") {
          setResumeBanner(resume.hint);
          setAbsenceLines((resume.absenceLog ?? []).map((l) => l.text));
        } else if (poids === "toast") {
          setMsg(resume.hint);
        }
        await api("/session/heartbeat", { method: "POST", body: "{}" });
      })
      .catch(() => {
        clearSession();
        setPlayer(null);
      })
      .finally(() => setBooting(false));
  }, []);

  useEffect(() => {
    if (!player) return;
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      const t = window.setTimeout(() => setShowTutorial(true), 600);
      return () => window.clearTimeout(t);
    }
  }, [player?.id]);

  useEffect(() => {
    if (!player) return;
    const beat = () => {
      api("/session/heartbeat", { method: "POST", body: "{}" }).catch(() => undefined);
    };
    const t = setInterval(beat, 30_000);
    window.addEventListener("pagehide", beat);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", beat);
    };
  }, [player]);

  useEffect(() => {
    if (!activeParcelId) return;
    loadParcel(activeParcelId).catch((e) => setErr(String(e.message ?? e)));
    loadLivestock(activeParcelId);
    const t = setInterval(() => {
      loadParcel(activeParcelId).catch(() => undefined);
      loadLivestock(activeParcelId);
    }, 4000);
    return () => clearInterval(t);
  }, [activeParcelId, loadParcel, loadLivestock]);

  useEffect(() => {
    if (!player || !activeParcelId) return;
    const beat = () => {
      const cell = selectedCells[0] ?? { x: 0, y: 0 };
      api(`/parcels/${activeParcelId}/presence`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, x: cell.x, y: cell.y }),
      }).catch(() => undefined);
    };
    beat();
    const t = setInterval(beat, 8000);
    return () => clearInterval(t);
  }, [player?.id, activeParcelId, selectedCells]);

  // L’hôtel des ventes bouge sans nous : d'autres joueurs déposent et achètent.
  useEffect(() => {
    if (!player) return;
    loadListings(player.id);
    loadDeliveries(player.id);
    loadFutures();
    const t = setInterval(() => {
      loadListings(player.id);
      loadDeliveries(player.id);
      loadFutures();
    }, 8000);
    return () => clearInterval(t);
  }, [player?.id, loadListings, loadDeliveries]);
  const freeParcels = useMemo(
    () =>
      zones.flatMap((z) =>
        z.parcels
          .filter((p) => !p.farmId)
          .map((p) => ({ ...p, zone: { code: z.code, name: z.name, koppen: z.koppen } })),
      ),
    [zones],
  );

  const ownedParcels = player?.farm?.parcels ?? [];
  const visiting = Boolean(
    visitOrder && activeParcelId && visitOrder.parcelId === activeParcelId,
  );
  const homeOwner =
    parcelDetail?.parcel?.farm?.user?.displayName ?? visitOrder?.clientName ?? null;

  /** Adjacent free parcels for expansion (all free if no land yet). */
  const expandableParcelIds = useMemo(() => {
    const ids = freeParcels
      .filter((fp) =>
        ownedParcels.length === 0
          ? true
          : ownedParcels.some(
              (op) =>
                op.zone?.code === fp.zone?.code &&
                ((Math.abs(op.mapX - fp.mapX) === 1 && op.mapY === fp.mapY) ||
                  (Math.abs(op.mapY - fp.mapY) === 1 && op.mapX === fp.mapX)),
            ),
      )
      .map((p) => p.id);
    return new Set(ids);
  }, [freeParcels, ownedParcels]);

  const parcel = parcelDetail?.parcel;
  const gw = parcel?.gridW ?? 12;
  const gh = parcel?.gridH ?? 12;
  const grid = useMemo(() => {
    const cells = parcel?.cells ?? [];
    return cells.map((c) => ({ ...c, manuredUntil: manureStain[`${c.x},${c.y}`] }));
  }, [parcel?.cells, manureStain]);

  /**
   * Le parc de la ferme, tel qu'il se voit sur la cour.
   *
   * Un engin garé occupait une case de champ ; il est maintenant rangé sur une
   * aire hors grille. Seule exception : la machine rentrée au hangar, qui est
   * sous un toit et n'a rien à faire dehors.
   */
  const parkedMachines = useMemo(() => {
    const machines = visiting ? (parcel?.machines ?? []) : (player?.farm?.machines ?? []);
    return machines
      .filter((m) => !(m as { storedInBuildingId?: string | null }).storedInBuildingId)
      .map((m) => ({
        id: m.id,
        type: (m.type as MachineType) ?? "TRACTOR",
        // Sur la parcelle d'un voisin, l'API ne donne que le type : l'état
        // reste au propriétaire, et la machine s'affiche alors comme neuve.
        condition: (m as { condition?: number }).condition,
      }));
  }, [parcel?.machines, player?.farm?.machines, visiting]);
  const zoneName = parcel?.zone?.name ?? ownedParcels[0]?.zone?.name ?? "Votre région";
  const koppen = parcel?.zone?.koppen ?? "Cfb";
  const homeCity = parcel?.zone?.city ?? ownedParcels[0]?.zone?.city ?? "";
  const climateLabel = parcel?.zone?.climateLabel ?? "";
  /**
   * L'horloge du jeu, relue chaque minute.
   *
   * La saison se calcule à partir de l'heure courante ; sans rien pour
   * redessiner, elle ne changeait à l'écran qu'au prochain rafraîchissement
   * venu d'ailleurs. Une minute suffit largement pour une journée de quinze.
   */
  const [horloge, setHorloge] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setHorloge(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const continentName = parcel?.zone?.continentName ?? "";
  const homeContinentCode =
    parcel?.zone?.continentCode ?? ownedParcels[0]?.zone?.continentCode ?? null;
  const hemisphere = (parcel?.zone?.hemisphere as "N" | "S" | undefined) ?? "N";
  const season = currentSeason(hemisphere, horloge);
  /**
   * Où l'on en est dans la saison — « jour 3 sur 7 ».
   *
   * Le rail n'affichait que le nom de la saison. Elle durait quinze minutes,
   * soit un seul jour de jeu, et personne ne pouvait s'en rendre compte : on
   * lisait « Été » puis « Automne » sans avoir rien fait entre les deux. Une
   * saison d'une semaine ne se voit pas davantage si on ne la compte pas.
   */
  const jourDeSaison = dayOfSeason(horloge);
  const zoneCode =
    parcel?.zone?.code ??
    ownedParcels[0]?.zone?.code ??
    zones[0]?.code ??
    "FR-BEAUCE";
  const localWeather =
    parcelDetail?.weather?.state ??
    weather.find((w) => w.zoneCode === zoneCode)?.state ??
    "CLEAR";
  const weatherLabel = WEATHER_LABELS[localWeather] ?? localWeather;

  /**
   * Annonce le passage d'une saison à l'autre.
   *
   * Le ciel change tout seul, mais un changement de décor sans un mot laisse
   * douter de ce qu'on vient de voir — d'autant que la saison décide de la
   * pousse de l'herbe et du froid que subissent les bêtes. On ne l'annonce
   * pas au premier rendu : arriver en été n'est pas « passer à l'été ».
   */
  useEffect(() => {
    if (!player) return;
    const avant = lastSeasonRef.current;
    lastSeasonRef.current = season;
    if (avant === null || avant === season) return;
    flashToast(`${SEASON_NAMES[season]} — ${SEASON_HINTS[season]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, player?.id]);

  const avgProgress = useMemo(() => {
    const sims = parcelDetail?.cellSims ?? [];
    if (!sims.length) return 0;
    return sims.reduce((a, s) => a + s.sim.progress, 0) / sims.length;
  }, [parcelDetail]);

  /** Troupeaux visibles : à l’étable, ou dehors dans l’enclos. */
  const grazingHerds = useMemo((): GrazingHerd[] => {
    const all = parcel?.buildings ?? [];
    const now = Date.now();
    const out: GrazingHerd[] = [];
    for (const barn of barns) {
      const herd = barn.herd;
      if (!herd || herd.size <= 0) continue;
      const barnB = all.find((b) => b.id === barn.buildingId);
      if (!barnB) continue;
      const barnDef = BUILDING_DEFS[barnB.type];
      // L'adjacence se juge sur l'emprise **posée**, orientation comprise —
      // comme le fait déjà le serveur. Lire `def.w × def.h` déclarait collés
      // deux bâtiments qui ne se touchent pas, ou l'inverse, dès qu'un des
      // deux était tourné d'un quart : une porcherie 2×3 tournée occupe 3×2.
      const barnBox = {
        originX: barnB.originX,
        originY: barnB.originY,
        ...orientedFootprint(barnB.type, barnB.rotation ?? 0),
      };
      const yardType = barn.yardType;
      const paddockB = all.find((b) => {
        if (b.type !== yardType) return false;
        return isPaddockAdjacent(barnBox, {
          originX: b.originX,
          originY: b.originY,
          ...orientedFootprint(yardType, b.rotation ?? 0),
        });
      });
      const outside = Boolean(herd.grazingUntil && herd.grazingUntil > now && paddockB);
      const pDef = paddockB ? BUILDING_DEFS[yardType] : barnDef;
      out.push({
        buildingId: barn.buildingId,
        animals: herd.size,
        kind: herd.kind,
        sheared: herd.kind === "SHEEP" && !herd.canShear,
        // Ce que la simulation sait déjà de l'élevage, la parcelle le montre :
        // le poil terne et l'échine creuse d'un lot mal tenu, le pis plein
        // d'un lot qu'on n'a pas trait. Ces deux jauges n'étaient visibles
        // que dans un panneau.
        welfare: Math.max(
          0,
          Math.min(1, welfareIndex(herd.happiness) - (herd.hungry ? 0.3 : 0) - (herd.atRisk ? 0.3 : 0)),
        ),
        yield: herd.collectProgress ?? 0,
        out: outside,
        barn: barnBox,
        paddock: paddockB
          ? {
              originX: paddockB.originX,
              originY: paddockB.originY,
              w: pDef.w,
              h: pDef.h,
            }
          : barnBox,
      });
    }
    return out;
  }, [barns, parcel?.buildings]);

  const hayInStock = useMemo(
    () => (player?.farm?.inventory ?? []).find((i) => i.itemCode === "HAY")?.qty ?? 0,
    [player?.farm?.inventory],
  );

  const maizeInStock = useMemo(
    () => (player?.farm?.inventory ?? []).find((i) => i.itemCode === "MAIZE")?.qty ?? 0,
    [player?.farm?.inventory],
  );

  const barleyInStock = useMemo(
    () => (player?.farm?.inventory ?? []).find((i) => i.itemCode === "BARLEY")?.qty ?? 0,
    [player?.farm?.inventory],
  );

  const wheatInStock = useMemo(
    () => (player?.farm?.inventory ?? []).find((i) => i.itemCode === "WHEAT")?.qty ?? 0,
    [player?.farm?.inventory],
  );

  const silageInStock = useMemo(
    () => (player?.farm?.inventory ?? []).find((i) => i.itemCode === "SILAGE")?.qty ?? 0,
    [player?.farm?.inventory],
  );

  /** Paille en silo : la litière du troupeau, achetée au céréalier ou pressée. */
  const strawInStock = useMemo(
    () => (player?.farm?.inventory ?? []).find((i) => i.itemCode === "STRAW")?.qty ?? 0,
    [player?.farm?.inventory],
  );

  /** Tonnage total en silo — affiché sur le bouton pour appeler à vendre. */
  const totalStockTons = useMemo(
    () => (player?.farm?.inventory ?? []).reduce((sum, i) => sum + i.qty, 0),
    [player?.farm?.inventory],
  );

  /** Cases réellement récoltables : mûres et pas encore perdues. */
  const readyCellCount = useMemo(
    () => (parcelDetail?.cellSims ?? []).filter((s) => s.sim.ready && !s.sim.lost).length,
    [parcelDetail],
  );

  const silageReadyCount = useMemo(
    () =>
      (parcelDetail?.cellSims ?? []).filter((s) => {
        const cell = (parcel?.cells ?? []).find((c) => c.x === s.x && c.y === s.y);
        return cell?.crop === "MAIZE" && !s.sim.lost && s.sim.progress >= SILAGE_MIN_PROGRESS;
      }).length,
    [parcelDetail, parcel?.cells],
  );

  /**
   * L'ensileuse au hangar — c'est elle, et non un bouton, qui fait l'ensilage.
   * Une machine en panne ou trop usée ne compte pas : le serveur la refuserait.
   */
  const hasForageHarvester = useMemo(
    () =>
      (player?.farm?.machines ?? []).some(
        (m) =>
          m.type === "FORAGE_HARVESTER" &&
          !m.breakdown &&
          m.condition >= (MACHINE_DEFS.FORAGE_HARVESTER?.minCondition ?? 15),
      ),
    [player?.farm?.machines],
  );

  const strawCellCount = useMemo(
    () => (parcel?.cells ?? []).filter((c) => (c.strawTons ?? 0) > 0).length,
    [parcel?.cells],
  );
  const baleCellCount = useMemo(
    () => (parcel?.cells ?? []).filter((c) => (c.baleCount ?? 0) > 0).length,
    [parcel?.cells],
  );

  const guideSnapshot: GuideSnapshot = useMemo(() => {
    const cells = parcel?.cells ?? [];
    const inv = player?.farm?.inventory ?? [];
    const stock = (code: string) => inv.filter((i) => i.itemCode === code).reduce((s, i) => s + i.qty, 0);
    return {
      spec: player?.specialization ?? "CEREALIER",
      plantedCells: cells.filter((c) => c.kind === "CROP").length,
      readyCells: readyCellCount,
      stubbleCells: cells.filter((c) => c.hasStubble).length,
      peaCells: cells.filter((c) => c.kind === "CROP" && c.crop === "PEA").length,
      buildings: (parcel?.buildings ?? []).map((b) => b.type),
      machines: (player?.farm?.machines ?? []).map((m) => m.type as MachineType),
      stockTons: totalStockTons,
      hayTons: stock("HAY"),
      milkOrMeat: stock("MILK") + stock("MEAT"),
      animals: barns.reduce((n, b) => n + (b.herd?.size ?? 0), 0),
      hasSold: guideFlags.sold,
      hasHarvested: guideFlags.harvested || cells.some((c) => c.hasStubble) || stock("WHEAT") + stock("MAIZE") + stock("PEA") + stock("BARLEY") + stock("RAPE") + stock("HAY") > 0,
      hasContract: guideFlags.contract,
    };
  }, [
    player?.specialization,
    player?.farm?.inventory,
    player?.farm?.machines,
    parcel?.cells,
    parcel?.buildings,
    readyCellCount,
    totalStockTons,
    barns,
    guideFlags,
  ]);

  const nextGoal = useMemo(() => currentObjective(guideSnapshot), [guideSnapshot]);
  const allGoalsDone = useMemo(
    () => evaluateObjectives(guideSnapshot).every((g) => g.done),
    [guideSnapshot],
  );

  /**
   * Alerte de fenêtre de récolte. Sans elle, la décote serait une punition
   * invisible : le joueur perdrait des tonnes sans jamais savoir pourquoi.
   */
  const harvestAlert = useMemo(() => {
    const sims = parcelDetail?.cellSims ?? [];
    let lost = 0;
    let poor = 0;
    let declining = 0;
    let soonestLossMs = Number.POSITIVE_INFINITY;
    for (const s of sims) {
      const r = s.sim.ripeness;
      if (!r) continue;
      if (r.stage === "LOST") lost += 1;
      else if (r.stage === "POOR") poor += 1;
      else if (r.stage === "DECLINING") declining += 1;
      if (r.stage !== "LOST") soonestLossMs = Math.min(soonestLossMs, r.msToLoss);
    }
    if (lost) {
      return {
        level: "bad" as const,
        title: `${lost} case(s) perdue(s)`,
        detail: "Trop tard pour récolter — passez l’outil Labour pour les libérer.",
      };
    }
    // Les chaumes ne sont pas une urgence, mais laisser le joueur chercher
    // pourquoi son semis est refusé n'aurait aucun intérêt.
    const stubble = (parcel?.cells ?? []).filter((c) => c.hasStubble);
    if (stubble.length) {
      const mustPlow = stubble.filter(
        (c) => (c.harvestsSincePlow ?? 0) >= MAX_HARVESTS_BEFORE_PLOW,
      ).length;
      return {
        level: mustPlow ? ("warn" as const) : ("soft" as const),
        title: `${stubble.length} case(s) en chaumes`,
        detail: mustPlow
          ? `${mustPlow} exigent la charrue : trois récoltes sans labour.`
          : "Nettoyez le sol pour le rendement, labourez pour repartir à neuf, ou semez direct.",
      };
    }
    if (poor || declining) {
      const mins = Math.max(0, Math.round(soonestLossMs / 60000));
      return {
        level: poor ? ("warn" as const) : ("soft" as const),
        title: poor
          ? `${poor} case(s) presque perdue(s)`
          : `${declining} case(s) se dégradent`,
        detail:
          mins > 0
            ? `Récoltez sous ${mins} min avant la perte totale.`
            : "Récoltez immédiatement.",
      };
    }
    return null;
  }, [parcelDetail, parcel?.cells]);

  /**
   * Ce que coûterait le semis en cours de préparation, du fait du précédent
   * cultural. Le joueur doit voir la facture de sa facilité avant de semer,
   * pas la découvrir à la moisson.
   */
  const rotationAlert = useMemo(() => {
    const crop = cropFromPlantTool(tool);
    if (!crop) return null;
    if (!selectedCells.length) return null;
    const cells = parcel?.cells ?? [];
    let worst = 1;
    let repeated = 0;
    for (const sel of selectedCells) {
      const cell = cells.find((c) => c.x === sel.x && c.y === sel.y);
      if (!cell) continue;
      const factor = rotationFactor(
        { lastCrop: (cell.lastCrop as CropCode | null) ?? null, cropStreak: cell.cropStreak ?? 0 },
        crop,
      );
      if (factor < 1) {
        repeated += 1;
        worst = Math.min(worst, factor);
      }
    }
    if (!repeated) return null;
    return {
      cells: repeated,
      malus: Math.round((1 - worst) * 100),
    };
  }, [tool, selectedCells, parcel?.cells]);

  /**
   * Classe d'un panneau latéral. Sur petit écran il devient un tiroir du bas,
   * visible seulement quand son onglet est actif : la place manque pour
   * border la ferme de colonnes, et la masquer serait absurde.
   */
  function logout() {
    clearSession();
    setPlayer(null);
    setParcelDetail(null);
    setResumeBanner(null);
    setAbsenceLines([]);
    setActiveParcelId(null);
    setSheet(null);
  }

  /**
   * Referme un tiroir d'un glissement vers le bas.
   *
   * Viser le voile à côté du tiroir n'est pas un geste naturel au pouce ; le
   * balayage l'est, et c'est ce que fait toute application mobile.
   */
  const sheetDrag = useRef<number | null>(null);
  const sheetGesture = {
    onPointerDown: (e: ReactPointerEvent) => {
      sheetDrag.current = e.clientY;
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const from = sheetDrag.current;
      sheetDrag.current = null;
      // Soixante pixels : assez pour ne pas déclencher sur un défilement de
      // liste, assez peu pour rester sans effort.
      if (from !== null && e.clientY - from > 60) setSheet(null);
    },
  };

  /**
   * Le catalogue de construction s'ouvre à la demande, sur bureau.
   *
   * Mesuré sur le jeu en marche : dix-neuf bâtiments en colonne unique dans un
   * rail de 292 px, cela faisait **1 665 px** de contenu — et le rail entier
   * 2 073 px pour 676 px de hauteur, trois écrans de défilement **en
   * permanence**, qu'on construise ou non. Un catalogue n'est pas un HUD.
   *
   * Il ne peut pas devenir une fenêtre comme le Garage : on choisit un
   * bâtiment, puis on le **pose sur la ferme** — une modale par-dessus le
   * terrain rendrait le geste impossible. On sépare donc les deux temps : le
   * choix est modal, la pose ne l'est pas. Le rail ne garde que le bâtiment
   * retenu et de quoi en changer.
   */
  const [showBuildPicker, setShowBuildPicker] = useState(false);



  function panelClass(base: string, key: SheetKey): string {
    if (!isMobile) return `glass ${base}`;
    return `glass ${base} sheet${sheet === key ? " open" : ""}`;
  }

  /**
   * Ce qui réclame l'attention, calculé une fois pour la barre d'onglets et
   * pour les notifications hors écran.
   */
  const alerts: FarmAlerts = useMemo(() => {
    const sims = parcelDetail?.cellSims ?? [];
    let ready = 0;
    let urgent = 0;
    let lost = 0;
    for (const s of sims) {
      const stage = s.sim.ripeness?.stage;
      if (stage === "LOST") lost += 1;
      else if (stage === "POOR" || stage === "DECLINING") urgent += 1;
      else if (s.sim.ready) ready += 1;
    }
    const herdsAtRisk = barns.filter((b) => b.herd?.atRisk).length;
    return { ready, urgent, lost, herdsAtRisk };
  }, [parcelDetail, barns]);

  const notifications = useNotificationState();
  useAwayAlerts(alerts, notifications.state === "granted");

  /**
   * Un message passager, et son **ton**.
   *
   * Il n'y avait que deux tons — vert « bon coup » et rouge « raté ». Une
   * vente forcée faute de silo s'affichait donc en vert, alors qu'elle
   * signale précisément qu'on a perdu de l'argent. Le ton `warn` dit ce
   * troisième cas : ça s'est fait, mais pas comme il aurait fallu.
   */
  function flashToast(text: string, isError: boolean | "warn" = false) {
    if (isError === true) {
      setErr(text);
    } else {
      setErr(null);
      setMsg(text);
      setToastTone(isError === "warn" ? "warn" : "good");
    }
    setToastTick((n) => n + 1);
  }

  // Trois secondes deux, charte §8.1 #17 — et la barre de progression du toast
  // lit la même durée, sinon elle ment sur le temps qu'il reste.
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [msg, toastTick]);

  const onFarm = Boolean(player && ownedParcels.length);
  useEffect(() => {
    document.documentElement.classList.toggle("playing", onFarm);
    const meta = document.querySelector('meta[name="viewport"]');
    const viewportBase =
      "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";
    // iOS ignore souvent maximum-scale tant que user-scalable reste omis.
    if (meta) {
      meta.setAttribute("content", onFarm ? `${viewportBase}, user-scalable=no` : viewportBase);
    }
    if (!onFarm) return;

    const block = (e: Event) => e.preventDefault();
    const blockPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    const blockBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false };
    document.addEventListener("gesturestart", block, opts);
    document.addEventListener("gesturechange", block, opts);
    document.addEventListener("gestureend", block, opts);
    document.addEventListener("touchmove", blockPinch, opts);
    document.addEventListener("wheel", blockBrowserZoom, opts);
    return () => {
      document.documentElement.classList.remove("playing");
      if (meta) meta.setAttribute("content", viewportBase);
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
      document.removeEventListener("touchmove", blockPinch);
      document.removeEventListener("wheel", blockBrowserZoom);
    };
  }, [onFarm]);

  function markGuideFlag(key: keyof GuideFlags) {
    setGuideFlags((prev) => {
      if (prev[key]) return prev;
      const next = { ...prev, [key]: true };
      writeGuideFlags(next);
      return next;
    });
  }

  /**
   * Ce qu'il y a sur la case, dit dans cet ordre.
   *
   * La ligne commençait par « Case (6,3) · » — deux nombres qui n'apprennent
   * rien, en tête de la seule phrase qui réponde à « qu'est-ce que j'ai semé
   * ici ? ». Le sujet passe devant, les coordonnées disparaissent : on clique
   * sur une case, on sait déjà laquelle.
   */
  function describeCell(x: number, y: number): string {
    const cell = grid.find((c) => c.x === x && c.y === y);
    const sim = parcelDetail?.cellSims?.find((s) => s.x === x && s.y === y);

    /**
     * Ce qui **traîne** sur la case, avant ce qu'elle est.
     *
     * Un andain de paille et des bottes se voient de loin — ce sont les
     * rectangles dorés du champ moissonné — et le clic n'en disait pas un mot :
     * il répondait « chaumes · déchaumer ou labourer », qui décrit le sol et
     * pas ce qui est posé dessus. On regarde donc d'abord ce qu'il y a à
     * ramasser, puis l'état du sol.
     */
    // Le tas de fumier occupe la case sous le coin gauche de son bâtiment —
    // même règle de calcul que la vue 3D, pour que le clic tombe sur ce qu'on
    // voit. Il n'était descriptible par aucun geste.
    const tas = barns.find((b) => {
      const bd = (parcel?.buildings ?? []).find((x) => x.id === b.buildingId);
      if (!bd || (b.herd?.manureFill ?? 0) <= 0.02) return false;
      const def = BUILDING_DEFS[bd.type];
      return bd.originX === x && bd.originY + def.h === y;
    });
    if (tas) {
      const pct = Math.round((tas.herd?.manureFill ?? 0) * 100);
      return `Fosse à fumier · ${pct} % · épandez-le sur vos champs ou vendez-le`;
    }

    if ((cell?.baleCount ?? 0) > 0) {
      const n = cell?.baleCount ?? 0;
      return `${n} botte${n > 1 ? "s" : ""} de paille · à charger`;
    }
    if ((cell?.strawTons ?? 0) > 0) {
      return `Andain de paille · ${(cell?.strawTons ?? 0).toFixed(1)} t · à presser ou ramasser`;
    }

    if (!cell || cell.kind === "EMPTY") {
      const soil = cell
        ? soilSummary({
            harvestsSincePlow: cell.harvestsSincePlow ?? 0,
            residuePasses: cell.residuePasses ?? 0,
            hasStubble: cell.hasStubble ?? false,
          })
        : "vide";
      return soil;
    }
    if (cell.kind === "CROP") {
      const crop = cell.crop ? (CROP_DEFS[cell.crop]?.name ?? cell.crop) : "?";
      const fert = cell.fertilizedPasses ?? 0;
      const ripe = sim?.sim.ripeness;
      if (ripe) {
        const keep = Math.round(ripe.yieldFactor * 100);
        if (ripe.stage === "LOST") {
          return `${crop} perdu — à labourer`;
        }
        const mins = Math.max(1, Math.round(ripe.msToLoss / 60000));
        return `${crop} · ${ripe.label} · ${keep} % du rendement · perdu dans ${mins} min`;
      }
      const prog = sim ? `${Math.round(sim.sim.progress * 100)}%` : "—";
      /* L'état d'enherbement se dit ici, sinon les dix pour cent de rendement
         qu'il coûte restent invisibles — c'était tout le problème du booléen
         qu'il remplace. */
      const herbe = cell.weedPressure && cell.weedPressure > 0.15
        ? ` · ${weedLabel(cell.weedPressure)}`
        : "";
      return `${crop} · en croissance ${prog} · ferti ${fert}${herbe}`;
    }
    if (cell.kind === "BUILDING") {
      const b = parcel?.buildings?.find((bd) => bd.id === cell.buildingId);
      const name = b ? BUILDING_DEFS[b.type].name : "Bâtiment";
      return name;
    }
    if (cell.kind === "VEHICLE") {
      const mType = cell.machineType ?? "TRACTOR";
      const name = MACHINE_DEFS[mType]?.name ?? mType;
      return `${name} · stationné`;
    }
    return cell.kind;
  }

  /**
   * Emprise libre ET budget suffisant. Le fantôme rouge signalait déjà le
   * manque de TRN, mais le clic partait quand même et le serveur répondait
   * 402 : un aller-retour perdu, et une erreur rouge en console pour une
   * situation parfaitement prévisible côté client.
   */
  function canPlaceBuildingAt(x: number, y: number, rot = buildRotation, type = buildType): boolean {
    const def = BUILDING_DEFS[type];
    // L'emprise suit le quart de tour : un hangar 3×2 tourné occupe 2×3.
    const foot = orientedFootprint(type, rot);
    if (x + foot.w > gw || y + foot.h > gh) return false;
    // La cour est réservée aux livraisons : le fantôme doit le refuser ici,
    // sinon on ne découvre la règle qu'au moment où le serveur dit non.
    if (overlapsYard({ x, y, w: foot.w, h: foot.h }, gh)) return false;
    if (!canPay(player, def.cost)) return false;
    const footprint = footprintCells(x, y, foot.w, foot.h);
    return footprint.every((fc) => {
      const c = grid.find((cell) => cell.x === fc.x && cell.y === fc.y);
      return c?.kind === "EMPTY";
    });
  }

  /**
   * Une place libre pour poser le fantôme dès le choix du bâtiment.
   *
   * Sans elle, choisir un bâtiment ne montrait rien : le fantôme suivait le
   * survol de la souris, et un téléphone n'a pas de survol. Il fallait fermer
   * le menu, puis toucher une case au hasard pour découvrir enfin ce qu'on
   * achetait. On propose maintenant une place d'emblée — la plus proche du
   * centre de la parcelle, là où on bâtit naturellement — que le joueur reste
   * libre de déplacer d'une touche.
   */
  function firstFreeSpot(type: BuildingType, rot: number): { x: number; y: number } | null {
    const foot = orientedFootprint(type, rot);
    // Pas tout à fait le centre : en vue isométrique, l'axe vertical de
    // l'écran suit x + y, et le bas de la parcelle passe sous la barre de
    // confirmation, la puce « À faire » et le dock — près de 40 % de la
    // hauteur sur un téléphone. Une proposition au centre géométrique
    // atterrissait donc à demi cachée, précisément au moment où il faut
    // regarder le bâtiment pour décider de le tourner. On recule des deux
    // côtés à la fois, ce qui le remonte tout droit dans la partie dégagée.
    const recul = 0.2;
    const cx = Math.max(0, (gw - foot.w) / 2 - gw * recul);
    const cy = Math.max(0, (gh - foot.h) / 2 - gh * recul);
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y + foot.h <= gh; y++) {
      for (let x = 0; x + foot.w <= gw; x++) {
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d >= bestD) continue;
        if (!canPlaceBuildingAt(x, y, rot, type)) continue;
        best = { x, y };
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Le fantôme de pose.
   *
   * Tant qu'aucune place n'est retenue, il suit la souris. Dès que le joueur a
   * cliqué, il se **fige** : c'est cette place-là qu'on tourne et qu'on
   * confirme. Un clic ne dépense plus rien par lui-même — l'ancienne version
   * postait aussitôt, et cinq clics involontaires posaient cinq silos.
   */
  const previewBuilding = useMemo((): PreviewBuilding | null => {
    if (tool !== "BUILD") return null;
    const at = pendingBuild ?? hoverCell;
    if (!at) return null;
    const def = BUILDING_DEFS[buildType];
    const spaceOk = canPlaceBuildingAt(at.x, at.y);
    const moneyOk = canPay(player, def.cost);
    return {
      type: buildType,
      originX: at.x,
      originY: at.y,
      rotation: buildRotation,
      valid: spaceOk && moneyOk,
      pending: Boolean(pendingBuild),
    };
  }, [tool, buildType, buildRotation, pendingBuild, hoverCell, grid, gw, gh, player?.crd, player?.dev, player?.unlimitedCrd]);

  /** Le bâtiment dont la fiche est ouverte, et le troupeau qu'il abrite. */
  /** Où en est le joueur dans son palier — pour la jauge du bandeau. */
  const xpHere = useMemo(() => levelProgress(player?.xp ?? 0), [player?.xp]);

  useEffect(() => {
    if (!showEta || !player?.id) return;
    let vivant = true;
    void api(`/players/${player.id}/ledger?jours=7`)
      .then((r) => {
        const rep = r as { lignes?: LedgerLine[] };
        if (vivant) setLedger(rep.lignes ?? []);
      })
      .catch(() => {
        /* Le Bureau reste utilisable sans son journal : il n'en dépend pas. */
      });
    return () => {
      vivant = false;
    };
  }, [showEta, player?.id]);

  const openBuilding = useMemo(
    () => (parcel?.buildings ?? []).find((b) => b.id === openBuildingId) ?? null,
    [parcel?.buildings, openBuildingId],
  );
  const openBuildingHerd = useMemo(() => {
    if (!openBuilding) return null;
    const barn = barns.find((b) => b.buildingId === openBuilding.id);
    if (!barn?.herd) return null;
    return {
      id: barn.herd.id,
      size: barn.herd.size,
      label: barn.herd.label,
      // Le lieu de vie est un état durable ; la fenêtre de sortie ne sert plus
      // qu'à jouer l'animation. La fiche lisait la seconde et affichait donc
      // « les bêtes sont à l'intérieur » pour un troupeau qui vivait au pré.
      out:
        barn.herd.housing === "OUTSIDE" ||
        Boolean(barn.herd.grazingUntil && barn.herd.grazingUntil > Date.now()),
      canGraze: barn.canLiveOutside ?? barn.canGraze,
      grazeRefusal: barn.outsideRefusal ?? barn.grazeRefusal,
      outsideCount: barn.outsideCount,
      shelteredCount: barn.shelteredCount,
    };
  }, [openBuilding, barns]);

  function brushCells(x: number, y: number): { x: number; y: number }[] {
    const cells: { x: number; y: number }[] = [];
    for (let dy = 0; dy < brush; dy++) {
      for (let dx = 0; dx < brush; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx >= 0 && cy >= 0 && cx < gw && cy < gh) cells.push({ x: cx, y: cy });
      }
    }
    return cells;
  }

  /** Les outils qui se tracent au doigt : ceux qui travaillent des cases. */
  function isStrokeTool(t: Tool): boolean {
    return (
      isPlantTool(t) || t === "FERTILIZE" || t === "HARVEST" || t === "STUBBLE" || t === "PLOW"
    );
  }

  /**
   * Sélection retenue au début d'un tracé.
   *
   * Le geste s'applique toujours à **cet** état, jamais au précédent aperçu :
   * sinon un tracé additif se dédoublerait à chaque image, et un tracé qui
   * retire effacerait sa propre trace au fur et à mesure. Le mode du geste
   * (ajouter, retirer, remplacer) est décidé par `ui/selection`.
   */
  const strokeBase = useRef<{ x: number; y: number }[]>([]);

  /**
   * Dernière case posée : point d'ancrage de Maj+clic.
   *
   * C'est l'idiome de toutes les listes de bureau — cliquer, puis Maj+cliquer
   * plus loin pour prendre tout ce qu'il y a entre les deux. Sur une grille,
   * « entre les deux » est le rectangle plein.
   */
  const selectionAnchor = useRef<{ x: number; y: number } | null>(null);

  /**
   * Pose un lot de cases selon le mode du geste.
   *
   * Un seul chemin pour le clic, le tracé et Ctrl+A : c'est ce qui garantit
   * que les trois se comportent pareil, ce qui n'était pas le cas avant —
   * le clic basculait, le tracé ajoutait toujours, et rien ne retirait.
   */
  function commitSelection(block: { x: number; y: number }[], mode: SelectMode) {
    setSelectedCells((prev) => applySelection(prev, block, mode));
  }

  /**
   * Change d'outil et décide du sort de la sélection.
   *
   * Passer de « Blé » à « Orge » garde les cases retenues — c'est le même
   * geste, on change d'avis sur la graine. Passer de « Semer » à « Labourer »
   * les vide : la sélection ne veut plus rien dire. Les deux coques appellent
   * cette même fonction, sinon clavier et souris divergeraient.
   */
  function pickTool(t: Tool) {
    const keep =
      (isPlantTool(tool) && isPlantTool(t)) ||
      (isSoilTool(tool) && isSoilTool(t)) ||
      (tool === "HARVEST" && t === "HARVEST");
    setTool(t);
    if (!keep && t !== "BUILD") {
      setSelectedCells([]);
      selectionAnchor.current = null;
    }
  }

  /** Cases éligibles à l'outil courant — sert à « Tout sélectionner ». */
  function eligibleCells(t: Tool): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const c of grid) {
      if (c.kind === "BUILDING" || c.kind === "VEHICLE") continue;
      if (isPlantTool(t) && c.kind === "CROP") continue;
      if (t === "HARVEST" && c.kind !== "CROP") continue;
      out.push({ x: c.x, y: c.y });
    }
    return out;
  }

  /** Crée le compte seul : le métier et la terre se choisissent juste après. */
  async function register() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{
        token: string;
        player: Player;
        resume?: SessionResume;
        recoveryCode?: string;
      }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          displayName: name.trim(),
          accessCode: accessCode || "ferme",
        }),
      });
      applyAuth(r);
      if (r.recoveryCode) setRecoveryCode(r.recoveryCode);
      await Promise.all([refreshMeta(), loadWorld()]);
      setMsg(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Pailler l'étable.
   *
   * On ne passe pas de tonnage : le serveur étale ce qu'il faut pour le cycle,
   * borné par la place et par le stock. Calculer des tonnes de paille de tête
   * n'a aucun intérêt de jeu.
   */
  async function spreadBedding(herdId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ tons: number; beddingTons: number }>(`/herds/${herdId}/bedding`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`Litière refaite · ${r.tons.toFixed(2)} t de paille étalée`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  /** Fin de l'installation guidée : métier + parcelle offerte. */
  async function claimStarterParcel(opts: {
    specialization: Specialization;
    parcelId: string;
    appearance: CharacterAppearance;
  }) {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ player: Player }>("/world/claim", {
        method: "POST",
        body: JSON.stringify(opts),
      });
      await Promise.all([refreshMeta(), loadWorld()]);
      // Un seul rendu : le vol d'approche, puis la ferme. Jamais l'inverse.
      arrivalShownRef.current = true;
      setShowArrival(true);
      if (r.player.farm?.parcels[0]) setActiveParcelId(r.player.farm.parcels[0].id);
      setPlayer(r.player);
      setMsg("Bienvenue chez vous !");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setErr(null);
    try {
      if (!email) throw new Error("Email requis");
      const r = await api<{
        token: string;
        player: Player;
        resume?: SessionResume;
        recoveryCode?: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, accessCode: accessCode || "ferme" }),
      });
      await loadWorld().catch(() => undefined);
      applyAuth(r);
      // Compte créé avant que le code de secours existe : le serveur vient
      // d'en remettre un. C'est la seule occasion de le montrer.
      if (r.recoveryCode) setRecoveryCode(r.recoveryCode);
      await refreshMeta();
      if (!r.resume || r.resume.awayMs < 30_000) setMsg("Connexion OK");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Code d'accès oublié : le code de secours en choisit un nouveau.
   *
   * La reprise en main est complète — le serveur ferme les sessions ouvertes
   * avec l'ancien code et en rend un neuf ici. Le joueur entre donc
   * directement dans sa ferme, sans avoir à se reconnecter derrière.
   */
  async function recover() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{
        token: string;
        player: Player;
        resume?: SessionResume;
        recoveryCode?: string;
      }>("/auth/recover", {
        method: "POST",
        body: JSON.stringify({ email, recoveryCode: recoveryInput, accessCode }),
      });
      await loadWorld().catch(() => undefined);
      applyAuth(r);
      setRecoveryInput("");
      // Le code qui vient de servir est brûlé : celui-ci le remplace.
      if (r.recoveryCode) setRecoveryCode(r.recoveryCode);
      await refreshMeta();
      setMsg("Nouveau code d'accès enregistré");
      setAuthMode("login");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Rentrer une caisse livrée.
   *
   * On la retire de la liste **avant** la réponse du serveur : c'est ce retrait
   * qui déclenche l'animation de rangement dans la vue 3D — la caisse s'envole
   * vers le bâtiment qui la stocke. Attendre l'aller-retour réseau ferait
   * démarrer le geste une demi-seconde après le doigt.
   */
  async function collectSupply(id: string) {
    setSupplies((prev) => prev.filter((s) => s.id !== id));
    try {
      const r = await api<{ collected: string; tons: number }>(`/supplies/${id}/collect`, {
        method: "POST",
      });
      const nom = GOOD_DEFS[r.collected as TradeGood]?.name ?? r.collected;
      flashToast(`${r.tons} t de ${nom.toLowerCase()} rentrées`);
      await refreshPlayer();
    } catch (e) {
      // Refusée — le camion n'était pas là, ou la caisse n'est plus : on
      // remet la liste au clair plutôt que de laisser un trou.
      if (farmId) void loadSupplies(farmId);
      flashToast(e instanceof Error ? e.message : String(e), true);
    }
  }

  async function applyToolOnCell(x: number, y: number, mods: PointerMods = DEFAULT_MODS) {
    if (!player || !activeParcelId) return;
    playUiSound("click");

    // Cliquer une construction ouvre sa fiche — c'est là qu'on la tourne, qu'on
    // l'améliore, qu'on la démolit, et qu'on fait sortir ou rentrer les bêtes.
    // Jusqu'ici un bâtiment n'était cliquable nulle part : tout passait par un
    // panneau latéral où il fallait le retrouver dans une liste.
    // Une caisse posée dans la cour se rentre d'un toucher, quel que soit
    // l'outil en main : c'est le geste le plus évident du jeu, il ne doit pas
    // demander de changer d'outil d'abord.
    const caisse = supplies.find(
      (c) => c.x === x && c.y === y && c.arrivesAt <= Date.now(),
    );
    if (caisse) {
      void collectSupply(caisse.id);
      return;
    }

    if (tool === "SELECT") {
      const cell = grid.find((c) => c.x === x && c.y === y);
      if (cell?.kind === "BUILDING" && cell.buildingId) {
        setOpenBuildingId(cell.buildingId);
        return;
      }
    }

    if (tool === "SELECT") {
      const block = brushCells(x, y);
      setSelectedCells(block);
      flashToast(describeCell(x, y));
      return;
    }

    if (
      isPlantTool(tool) ||
      tool === "FERTILIZE" ||
      tool === "HARVEST" ||
      tool === "STUBBLE" ||
      tool === "PLOW"
    ) {
      // Maj+clic prend tout le rectangle depuis la dernière case posée. Sans
      // ancre — premier clic de la partie — il n'y a rien à étendre, on pose.
      const anchor = selectionAnchor.current;
      const block =
        mods.extend && anchor
          ? expandBrush(rectBetween(anchor, { x, y }, gw, gh), brush, gw, gh)
          : brushCells(x, y);
      commitSelection(block, mods.mode);
      if (!mods.extend) selectionAnchor.current = { x, y };
      return;
    }

    if (tool === "BUILD") {
      if (visiting) {
        flashToast("Pas de construction chez le voisin", true);
        return;
      }
      const def = BUILDING_DEFS[buildType];
      const foot = orientedFootprint(buildType, buildRotation);
      if (!canPlaceBuildingAt(x, y)) {
        const reason =
          x + foot.w > gw || y + foot.h > gh
            ? "Emprise hors grille"
            : !canPay(player, def.cost)
              ? `TRN insuffisants (${def.cost})`
              : "Collision ou case occupée";
        flashToast(reason, true);
        return;
      }
      // Le clic **retient** la place, il ne dépense pas. La construction part
      // du bouton « Construire », donc jamais par accident.
      setPendingBuild({ x, y });
      return;
    }

  }

  /**
   * Clic droit sur une case — bureau seulement.
   *
   * Il ne duplique pas la barre d'outils : il propose ce qui est **propre à
   * cette case-là**, c'est-à-dire ce qu'on ne peut pas faire autrement sans la
   * retrouver dans une liste latérale.
   */
  function openCellMenu(cell: { x: number; y: number }, screen: { x: number; y: number }) {
    if (isMobile) return;
    const c = grid.find((g) => g.x === cell.x && g.y === cell.y);
    const items: CellContextItem[] = [];

    if (c?.kind === "BUILDING" && c.buildingId) {
      const b = (parcel?.buildings ?? []).find((x) => x.id === c.buildingId);
      items.push({
        label: "Ouvrir la fiche",
        hint: "Tourner, améliorer, démolir",
        onPick: () => setOpenBuildingId(c.buildingId!),
      });
      if (b && !visiting) {
        items.push({
          label: "Tourner d’un quart",
          onPick: () => void rotateBuilding(b.id, BUILDING_DEFS[b.type].name),
        });
      }
    } else {
      items.push({
        label: "Ajouter à la sélection",
        hint: "comme Ctrl+clic",
        onPick: () => commitSelection(brushCells(cell.x, cell.y), "add"),
      });
      items.push({
        label: "Retirer de la sélection",
        hint: "comme Alt+clic",
        disabled: selectedCells.length === 0,
        onPick: () => commitSelection(brushCells(cell.x, cell.y), "remove"),
      });
      items.push({
        label: "Sélectionner la ligne",
        onPick: () =>
          commitSelection(
            Array.from({ length: gw }, (_, x) => ({ x, y: cell.y })),
            "add",
          ),
      });
      items.push({
        label: "Sélectionner la colonne",
        onPick: () =>
          commitSelection(
            Array.from({ length: gh }, (_, y) => ({ x: cell.x, y })),
            "add",
          ),
      });
    }
    items.push({
      label: "Vider la sélection",
      disabled: selectedCells.length === 0,
      onPick: () => setSelectedCells([]),
    });

    setCellMenu({ cell, screen, title: describeCell(cell.x, cell.y), items });
  }

  /** Le prestataire n'est proposé que là où il a un sens : sur du travail aux champs. */
  const selectedAreGrass = useMemo(() => {
    if (!selectedCells.length) return false;
    return selectedCells.every((sel) => {
      const cell = parcel?.cells?.find((c) => c.x === sel.x && c.y === sel.y);
      return isMowCrop(cell?.crop);
    });
  }, [selectedCells, parcel?.cells]);

  /**
   * Y a-t-il de la paille à espérer ici ?
   *
   * L'option n'est proposée que si au moins une case concernée porte une
   * culture pailleuse. Sur de l'herbe seule, cocher « laisser l'andain »
   * n'aurait aucun effet — et un réglage sans effet fait douter de tous les
   * autres. Faute de sélection, on regarde ce qui est mûr : c'est ce que
   * « Tout récolter » va prendre.
   */
  const swathUsefulHere = useMemo(() => {
    const cible = selectedCells.length
      ? selectedCells.map((sel) => parcel?.cells?.find((c) => c.x === sel.x && c.y === sel.y))
      : (parcelDetail?.cellSims ?? [])
          .filter((s) => s.sim.ready)
          .map((s) => parcel?.cells?.find((c) => c.x === s.x && c.y === s.y));
    return cible.some((cell) => leavesSwath(cell?.crop));
  }, [selectedCells, parcel?.cells, parcelDetail?.cellSims]);

  const readyAreGrass = useMemo(() => {
    const ready = (parcelDetail?.cellSims ?? []).filter((s) => s.sim.ready);
    if (!ready.length) return false;
    return ready.every((s) => {
      const cell = parcel?.cells?.find((c) => c.x === s.x && c.y === s.y);
      return isMowCrop(cell?.crop);
    });
  }, [parcelDetail?.cellSims, parcel?.cells]);

  /**
   * Combien de cases de la sélection répondent à un critère de maturité.
   *
   * Le nombre de cases mûres affiché est celui de la **parcelle** ; la route,
   * elle, ne juge que la sélection. « Récolter 4 cases » restait donc actif sur
   * quatre cases vertes, et refusait en 409 après le chantier.
   */
  const dansSelection = useCallback(
    (predicat: (s: { ready: boolean; lost?: boolean }) => boolean) =>
      (parcelDetail?.cellSims ?? []).filter(
        (c) => selectedCells.some((sel) => sel.x === c.x && sel.y === c.y) && predicat(c.sim),
      ).length,
    [parcelDetail?.cellSims, selectedCells],
  );

  const contractorOffer = useMemo(() => {
    const work: FarmWork | null = isPlantTool(tool)
      ? "PLANT"
      : tool === "FERTILIZE"
        ? "FERTILIZE"
        : tool === "HARVEST"
          ? selectedAreGrass
            ? "MOW"
            : "HARVEST"
          : tool === "PLOW"
              ? "PLOW"
              : tool === "STUBBLE"
                ? "STUBBLE"
                : tool === "BALE"
                  ? "BALE"
                  : tool === "COLLECT"
                    ? "COLLECT"
                    : null;
    if (!work || !selectedCells.length) return null;
    const needed: MachineType =
      work === "HARVEST"
        ? "HARVESTER"
        : work === "STUBBLE"
            ? "DISC_HARROW"
            : work === "BALE"
              ? "BALER"
              : "TRACTOR";
    const hasMachine = (player?.farm?.machines ?? []).some(
      (m) => m.type === needed && m.condition >= (MACHINE_DEFS[needed]?.minCondition ?? 15),
    );
    /*
     * Ce qui empêcherait le prestataire d'intervenir.
     *
     * Il vient avec son matériel : la question n'est donc pas le garage mais
     * la sélection. « Faire faire » restait cliquable sur des cases où il n'y
     * avait rien à récolter, et le devis payé partait en 409.
     */
    const blocage =
      work === "HARVEST" || work === "MOW"
        ? dansSelection((sim) => sim.ready && !sim.lost) === 0
          ? "Rien de mûr dans la sélection — le prestataire n’aurait rien à récolter."
          : null
        : work === "PLOW"
          ? dansSelection((sim) => Boolean(sim.lost)) === 0
            ? "Aucune culture perdue à labourer dans la sélection."
            : null
          : null;
    return {
      work,
      hasMachine,
      blocage,
      cost: urgentContractorQuote(work, selectedCells.length),
    };
  }, [tool, selectedCells, selectedAreGrass, player?.farm?.machines, dansSelection]);

  /**
   * Ce qui manque au parc pour l'outil en main.
   *
   * Même fonction que le serveur — c'est le point : l'écran doit dire avant le
   * clic ce que la route répondrait après, mot pour mot. Un débutant pouvait
   * lancer sept travaux sur dix qui ne pouvaient que refuser en 409.
   */
  const machineManquante = useMemo(() => {
    const work = workOfTool(tool);
    if (!work) return null;
    const parc = explainNoMachine((player?.farm?.machines ?? []) as MachineForWork[], work);
    if (parc) return parc;
    // La machine est là ; reste à savoir si la sélection a de quoi l'occuper.
    if ((work === "HARVEST" || work === "MOW") && selectedCells.length) {
      if (dansSelection((sim) => sim.ready && !sim.lost) === 0) {
        return "Rien de mûr dans la sélection.";
      }
    }
    return null;
  }, [tool, player?.farm?.machines, selectedCells.length, dansSelection]);

  const laborQuote = useMemo(() => {
    if (visiting || !contractorOffer) return null;
    const n = selectedCells.length;
    if (n < MISSION_CELLS_MIN || n > MISSION_CELLS_MAX) return null;
    const crop: CropCode | undefined = cropFromPlantTool(tool) ?? undefined;
    return laborEscrow(contractorOffer.work, n, crop).escrow;
  }, [visiting, contractorOffer, selectedCells.length, tool]);

  async function publishLaborOrder() {
    if (!player || !activeParcelId || !contractorOffer || laborQuote == null) return;
    setBusy(true);
    try {
      const crop = cropFromPlantTool(tool) ?? undefined;
      const r = await api<{ escrow: number }>(`/parcels/${activeParcelId}/labor-orders`, {
        method: "POST",
        body: JSON.stringify({
          userId: player.id,
          work: contractorOffer.work,
          crop,
          cells: selectedCells,
        }),
      });
      flashToast("Cet argent est bloqué jusqu’à la fin (ou l’annulation).");
      setSelectedCells([]);
      await refreshPlayer();
      await refreshMeta();
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function acceptLaborOrder(id: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ order: LaborOrderView }>(`/labor-orders/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setVisitOrder(r.order);
      setActiveParcelId(r.order.parcelId);
      setSheet(null);
      setShowEta(false);
      flashToast(`Chez ${r.order.clientName} — ${WORK_LABELS[r.order.work]}`);
      await loadParcel(r.order.parcelId);
      await refreshMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function abandonVisit() {
    if (!player || !visitOrder) return;
    setBusy(true);
    try {
      await api(`/labor-orders/${visitOrder.id}/abandon`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setVisitOrder(null);
      const home = player.farm?.parcels[0]?.id;
      if (home) setActiveParcelId(home);
      flashToast("Chantier relâché");
      await refreshMeta();
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  function goHome() {
    const home = player?.farm?.parcels[0]?.id;
    if (home) setActiveParcelId(home);
    setVisitOrder(null);
  }

  async function callContractor() {
    if (!player || !activeParcelId || !contractorOffer) return;
    if (contractorOffer.work === "BALE" || contractorOffer.work === "COLLECT") {
      flashToast("Pour ça, publiez un chantier — pas d’entreprise instantanée", true);
      return;
    }
    setBusy(true);
    setErr(null);
    const workCells = selectedCells.slice();
    // Pressage, ramassage et ensilage sont écartés juste au-dessus : ils
    // passent par un chantier publié, jamais par l'entreprise instantanée.
    flashWork(
      contractorOffer.work === "HARVEST" ? "HARVESTER" : "TRACTOR",
      workCells,
      contractorOffer.work === "MOW" ? "mow" : contractorOffer.work === "HARVEST" ? "harvest" : undefined,
    );
    try {
      const r = await api<{ cost: number; cells: number; totalTons?: number }>(
        `/parcels/${activeParcelId}/contractor`,
        {
          method: "POST",
          body: JSON.stringify({
            userId: player.id,
            work: contractorOffer.work,
            crop: cropFromPlantTool(tool) ?? undefined,
            cells: workCells,
          }),
        },
      );
      const tons = r.totalTons ? ` · ${r.totalTons.toFixed(2)} t` : "";
      flashToast(`C’est fait : ${WORK_LABELS[contractorOffer.work]} ×${r.cells}${tons} · −${r.cost} TRN`);
      setSelectedCells([]);
      await refreshPlayer();
      await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
      setPulseCells([]);
      setActiveWork(null);
    } finally {
      setBusy(false);
    }
  }

  /**
   * L'engin qu'on voit partir au champ.
   *
   * Cette fonction listait les correspondances à la main, avec les hypothèses
   * du tracteur à tout faire — « fertiliser, c'est un tracteur si l'on n'a pas
   * d'épandeur ». Depuis la séparation porteur / outil, un travail appartient à
   * exactement un outil, et le catalogue le dit déjà : le déduire évite qu'un
   * nouvel outil arrive sans que l'écran le sache.
   */
  function workMachineForTool(t: Tool): MachineType {
    const work = workOfTool(t);
    if (!work) return "TRACTOR";
    const outil = (Object.keys(MACHINE_DEFS) as MachineType[]).find((m) =>
      MACHINE_DEFS[m].works.includes(work as never),
    );
    return outil ?? "TRACTOR";
  }

  function flashWork(
    type: MachineType,
    cells: { x: number; y: number }[],
    cut?: "harvest" | "mow",
    extra?: { haul?: boolean; cargo?: string; jobMs?: number },
  ) {
    setPulseCells(cells);
    // L'engin envoyé au chantier est celui du garage : il arrive avec son
    // usure, visible sur sa carrosserie.
    const used = (player?.farm?.machines ?? []).find((m) => m.type === type);
    // La traversée dure exactement ce que dure le chantier. Sans cela, une
    // moissonneuse T3 — deux fois plus rapide au compteur — traverserait le
    // champ comme une T1, et le palier ne se verrait nulle part.
    const duree = workAnimationMs(cells.length, extra?.jobMs);
    setActiveWork({
      type,
      cells,
      cut,
      haul: extra?.haul,
      cargo: extra?.cargo,
      condition: used?.condition,
      durationMs: duree,
    });
    // Un peu de marge sur la durée du parcours : l'engin doit atteindre la
    // dernière case avant qu'on ne l'efface.
    window.setTimeout(() => {
      setPulseCells([]);
      setActiveWork(null);
    }, duree + 250);
  }

  /** Tracteur + remorque sur la parcelle d’arrivée, comme chez le voisin. */
  function flashDeliveryArrival(commodity?: string) {
    if (visiting) return;
    const destBuilding = (parcel?.buildings ?? []).find(
      (b) =>
        b.type === "SILO" ||
        b.type === "HAY_BARN" ||
        b.type === "FARMHOUSE" ||
        b.type === "CATTLE_BARN",
    );
    const cells = deliveryHaulPath(
      gw,
      gh,
      destBuilding
        ? { x: destBuilding.originX, y: destBuilding.originY }
        : null,
    );
    if (cells.length < 2) return;
    setShowMarket(false);
    flashWork("TRACTOR", cells, undefined, { haul: true, cargo: commodity });
  }
  playHaulRef.current = flashDeliveryArrival;

  /** Travail de champ correspondant à l'outil en main. */
  function workOfTool(t: Tool): FarmWork | null {
    if (isPlantTool(t)) return "PLANT";
    if (t === "FERTILIZE") return "FERTILIZE";
    if (t === "PLOW") return "PLOW";
    if (t === "STUBBLE") return "STUBBLE";
    if (t === "WEED") return "WEED";
    if (t === "BALE") return "BALE";
    if (t === "COLLECT") return "COLLECT";
    if (t === "HARVEST") return selectedAreGrass ? "MOW" : "HARVEST";
    return null;
  }

  /**
   * Ouvre un chantier et attend qu'il soit fait.
   *
   * Un travail de champ ne part plus au clic : il réserve ses cases, immobilise
   * son attelage, et prend le temps que sa largeur de travail impose. Tout est
   * vérifié à l'ouverture — l'attelage, la saison, les cases — pour que le
   * joueur sache tout de suite si son champ partira, plutôt qu'au bout de sept
   * minutes d'attente.
   */
  async function ouvrirChantier(
    work: FarmWork,
    cells: { x: number; y: number }[],
    crop?: CropCode,
  ): Promise<{ id: string; durationMs: number } | null> {
    if (!player || !activeParcelId) return null;
    const r = await api<{ job: { id: string; endsAt: string; durationMs: number } }>(
      `/parcels/${activeParcelId}/jobs`,
      {
        method: "POST",
        body: JSON.stringify({ userId: player.id, work, cells, ...(crop ? { crop } : {}) }),
      },
    );
    const fin = new Date(r.job.endsAt).getTime();
    setChantier({ work, cells, endsAt: fin, durationMs: r.job.durationMs });
    const reste = fin - Date.now();
    if (reste > 0) await new Promise((resolve) => window.setTimeout(resolve, reste + 60));
    setChantier(null);
    return { id: r.job.id, durationMs: r.job.durationMs };
  }

  async function runWorkOnCells(cells: { x: number; y: number }[]) {
    if (!player || !activeParcelId || !cells.length || busy) return;
    setBusy(true);
    setErr(null);
    const workCells = cells.slice();
    const plantCrop = cropFromPlantTool(tool);
    const harvestCut = tool === "HARVEST" ? (selectedAreGrass ? "mow" : "harvest") : undefined;
    type LaborBit = { remaining: number; completed: boolean; payout?: number };
    let labor: LaborBit | undefined;
    let jobId: string | undefined;
    try {
      const work = workOfTool(tool);
      if (work) {
        const chantierOuvert = await ouvrirChantier(work, workCells, plantCrop ?? undefined);
        if (!chantierOuvert) return;
        jobId = chantierOuvert.id;
        // L'engin traverse le champ pendant que le chantier tourne : c'est la
        // même durée des deux côtés, pas deux horloges qui divergent.
        flashWork(
          tool === "HARVEST" && selectedAreGrass ? "TRACTOR" : workMachineForTool(tool),
          workCells,
          harvestCut,
          { jobMs: chantierOuvert.durationMs },
        );
      }
      if (plantCrop) {
        const crop = plantCrop;
        const r = await api<{
          machine?: {
            wearApplied: number;
            condition: number;
            type: string;
            broke?: boolean;
            breakdown?: string | null;
          };
          labor?: LaborBit;
        }>(`/parcels/${activeParcelId}/plant`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, crop, cells: workCells, directSeed }),
        });
        setMsg(
          `Semé ${CROP_DEFS[crop].name} ×${workCells.length}${directSeed ? " en direct" : ""}` +
            wearNote(r.machine),
        );
        labor = r.labor;
      } else if (tool === "WEED") {
        const r = await api<{
          weeded: number;
          cost: number;
          machine?: { condition: number; type: string; broke?: boolean; breakdown?: string | null };
          labor?: LaborBit;
        }>(`/parcels/${activeParcelId}/weed`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, cells: workCells }),
        });
        setMsg(`Désherbé ×${r.weeded} · −${Math.round(r.cost)} TRN` + wearNote(r.machine));
        labor = r.labor;
      } else if (tool === "FERTILIZE") {
        const r = await api<{
          machine?: {
            condition: number;
            type: string;
            broke?: boolean;
            breakdown?: string | null;
          };
          labor?: { remaining: number; completed: boolean; payout?: number };
          usedManure?: boolean;
        }>(`/parcels/${activeParcelId}/fertilize`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, cells: workCells }),
        });
        setMsg((r.usedManure ? "Fumier épandu" : "Fertilisé") + wearNote(r.machine));
        if (r.usedManure) {
          const until = Date.now() + 60_000;
          setManureStain((prev) => {
            const next = { ...prev };
            for (const c of workCells) next[`${c.x},${c.y}`] = until;
            return next;
          });
          if (activeParcelId) await loadLivestock(activeParcelId);
        }
        labor = r.labor;
      } else if (tool === "HARVEST") {
        const r = await api<{
          machine?: {
            condition: number;
            type: string;
            broke?: boolean;
            breakdown?: string | null;
          };
          totalTons?: number;
          lostCells?: number;
          soldTons?: number;
          soldRevenue?: number;
          hayTons?: number;
          grassRegrew?: number;
          soldReason?: "NO_SILO" | "SILO_FULL" | null;
          labor?: { remaining: number; completed: boolean; payout?: number };
        }>(`/parcels/${activeParcelId}/harvest`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, cells: workCells, swath: keepSwath }),
        });
        const lost = r.lostCells ? ` · ${r.lostCells} perdue(s)` : "";
        setMsg(harvestGrainNote(r) + lost + wearNote(r.machine));
        markGuideFlag("harvested");
        if (r.soldTons) markGuideFlag("sold");
        labor = r.labor;
      } else if (tool === "BALE") {
        const r = await api<{
          baled: number;
          bales: number;
          machine?: { condition: number; type: string };
          labor?: { remaining: number; completed: boolean; payout?: number };
        }>(`/parcels/${activeParcelId}/bale`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, cells: workCells }),
        });
        setMsg(`Pressé ×${r.baled} · ${r.bales} botte(s)` + wearNote(r.machine));
        labor = r.labor;
      } else if (tool === "COLLECT") {
        const r = await api<{
          collected: number;
          tons: number;
          machine?: { condition: number; type: string };
          labor?: { remaining: number; completed: boolean; payout?: number };
        }>(`/parcels/${activeParcelId}/collect`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, cells: workCells }),
        });
        setMsg(`Ramassé ${r.tons.toFixed(2)} t de paille`);
        labor = r.labor;
      } else if (tool === "PLOW") {
        const r = await api<{
          plowed: number;
          cost: number;
          fertilityDelta: number;
          machine?: {
            condition: number;
            type: string;
            broke?: boolean;
            breakdown?: string | null;
          };
          labor?: { remaining: number; completed: boolean; payout?: number };
        }>(`/parcels/${activeParcelId}/plow`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, cells: workCells }),
        });
        const fert = r.fertilityDelta;
        const fertNote =
          Math.abs(fert) < 0.0005
            ? ""
            : ` · fertilité ${fert > 0 ? "+" : "−"}${Math.abs(fert * 100).toFixed(1)} pt`;
        setMsg(
          `Labouré ×${r.plowed} · −${r.cost} TRN${fertNote} · sol remis à zéro` + wearNote(r.machine),
        );
        labor = r.labor;
      } else if (tool === "STUBBLE") {
        const r = await api<{
          stubbled: number;
          cost: number;
          nextBonus: number;
          machine?: {
            condition: number;
            type: string;
            broke?: boolean;
            breakdown?: string | null;
          };
          labor?: { remaining: number; completed: boolean; payout?: number };
        }>(`/parcels/${activeParcelId}/stubble`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, jobId, cells: workCells }),
        });
        setMsg(
          `Sol nettoyé ×${r.stubbled} · −${r.cost} TRN · +${Math.round(r.nextBonus * 100)} % sur la prochaine récolte` +
            wearNote(r.machine),
        );
        labor = r.labor;
      }
      setSelectedCells([]);
      await refreshPlayer();
      await loadParcel(activeParcelId);
      if (labor?.completed) {
        flashToast(`Chantier terminé · +${Math.round(labor.payout ?? 0)} TRN`);
        setVisitOrder(null);
        const home = player.farm?.parcels[0]?.id;
        if (home) setActiveParcelId(home);
      } else if (labor) {
        setVisitOrder((prev) => (prev ? { ...prev, remaining: labor!.remaining } : prev));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      flashToast(e instanceof Error ? e.message : String(e), true);
      setPulseCells([]);
      setActiveWork(null);
    } finally {
      setBusy(false);
    }
  }

  async function runSelectionAction() {
    await runWorkOnCells(selectedCells);
  }

  async function harvestAll() {
    if (!player || !activeParcelId) return;
    setBusy(true);
    try {
      // Le maïs bon à ensiler compte comme prêt **si l'on a l'ensileuse** :
      // il se récolte avant maturité grain, et « Tout récolter » doit le
      // prendre au lieu de le laisser sur pied. Sans la machine, il attend sa
      // maturité comme n'importe quelle céréale.
      const readyCells = (parcelDetail?.cellSims ?? [])
        .filter((s) => {
          if (s.sim.ready) return true;
          if (!hasForageHarvester || s.sim.lost) return false;
          const cell = (parcel?.cells ?? []).find((c) => c.x === s.x && c.y === s.y);
          return cell?.crop === "MAIZE" && s.sim.progress >= SILAGE_MIN_PROGRESS;
        })
        .map((s) => ({ x: s.x, y: s.y }))
        .filter((c) =>
          visiting && visitOrder
            ? visitOrder.cellList.some((r) => r.x === c.x && r.y === c.y)
            : true,
        );
      if (!readyCells.length) {
        setMsg("Rien n'est mûr sur cette parcelle.");
        return;
      }
      /*
       * Le chantier d'abord, comme pour n'importe quel travail.
       *
       * « Tout récolter » appelait la route directement. Depuis que les travaux
       * passent par un sas, elle répondait « Il faut lancer le chantier avant
       * de le terminer » — le bouton ne pouvait plus aboutir, quel que soit
       * l'état du champ. Il faut aussi nommer les cases : le sas ne travaille
       * que celles qu'il a réservées.
       */
      const work: FarmWork = readyAreGrass ? "MOW" : "HARVEST";
      const chantier = await ouvrirChantier(work, readyCells);
      if (!chantier) return;
      flashWork(
        readyAreGrass ? "TRACTOR" : "HARVESTER",
        readyCells,
        readyAreGrass ? "mow" : "harvest",
        { jobMs: chantier.durationMs },
      );
      const r = await api<{
        totalTons: number;
        soldTons?: number;
        soldRevenue?: number;
        hayTons?: number;
        grassRegrew?: number;
        soldReason?: "NO_SILO" | "SILO_FULL" | null;
        labor?: { remaining: number; completed: boolean; payout?: number };
      }>(`/parcels/${activeParcelId}/harvest`, {
        method: "POST",
        body: JSON.stringify({
          userId: player.id,
          jobId: chantier.id,
          cells: readyCells,
          swath: keepSwath,
        }),
      });
      setMsg(harvestGrainNote(r));
      markGuideFlag("harvested");
      if (r.soldTons) markGuideFlag("sold");
      if (r.labor?.completed) {
        flashToast(`Chantier terminé · +${Math.round(r.labor.payout ?? 0)} TRN`);
        setVisitOrder(null);
        const home = player.farm?.parcels[0]?.id;
        if (home) setActiveParcelId(home);
      }
      await refreshPlayer();
      await loadParcel(activeParcelId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPulseCells([]);
      setActiveWork(null);
    } finally {
      setBusy(false);
    }
  }

  async function buyAdjacent(parcelId: string) {
    if (!player) return;
    setBusy(true);
    try {
      await api(`/parcels/${parcelId}/buy`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      await refreshPlayer();
      await refreshMeta();
      setActiveParcelId(parcelId);
      setMsg("Parcelle acquise");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Rachat immédiat par le négociant : prix bas, mais toujours preneur. */
  async function sellToDealer(commodity: TradeGood, tons: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ revenue: number; pricePerTon: number }>("/market/dealer", {
        method: "POST",
        body: JSON.stringify({ userId: player.id, commodity, tons }),
      });
      flashToast(`Négociant : ${tons.toFixed(2)} t · +${r.revenue} TRN`);
      markGuideFlag("sold");
      await refreshPlayer();
      await refreshMeta();
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function createListing(commodity: TradeGood, tons: number, pricePerTon: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ fee: number }>("/market/listings", {
        method: "POST",
        body: JSON.stringify({ userId: player.id, commodity, tons, pricePerTon }),
      });
      flashToast(`Lot mis en vente · frais ${r.fee} TRN`);
      await refreshPlayer();
      await loadListings(player.id);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function cancelListing(id: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ returned: number }>(`/market/listings/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`${r.returned.toFixed(2)} t revenues au silo`);
      await refreshPlayer();
      await loadListings(player.id);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function buyListing(id: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ bought: number; paid: number }>(`/market/listings/${id}/buy`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast("Pas encore chez vous : quelqu’un doit livrer.");
      await refreshPlayer();
      await loadListings(player.id);
      await loadDeliveries(player.id);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function deliverLot(id: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ delivered: number }>(`/deliveries/${id}/deliver`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`Livré ${r.delivered.toFixed(2)} t`);
      await refreshPlayer();
      await loadDeliveries(player.id);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function autoDeliverLot(id: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ delivered: number; autoFee: number; commodity?: string }>(
        `/deliveries/${id}/auto`,
        {
          method: "POST",
          body: JSON.stringify({ userId: player.id }),
        },
      );
      flashToast(`Arrivé · −${r.autoFee} TRN`);
      haulSeenRef.current.add(id);
      flashDeliveryArrival(r.commodity);
      await refreshPlayer();
      await loadDeliveries(player.id);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Quel lot attend sa ration.
   *
   * Posé quand le joueur part acheter depuis une alerte de faim, consommé dès
   * que la marchandise arrive. Sans lui, l'achat s'arrêtait au silo.
   */
  const [nourrirApres, setNourrirApres] = useState<string | null>(null);

  /** La denrée derrière chaque ration — c'est elle qui porte la valeur nutritive. */
  const RATION_GOOD: Record<"hay" | "maize" | "barley" | "wheat" | "silage", TradeGood> = {
    hay: "HAY",
    maize: "MAIZE",
    barley: "BARLEY",
    wheat: "WHEAT",
    silage: "SILAGE",
  };

  /** Ce que chaque denrée achetable vaut comme ration, si elle en est une. */
  const RATION_DE: Partial<Record<TradeGood, "hay" | "maize" | "barley" | "wheat" | "silage">> = {
    HAY: "hay",
    MAIZE: "maize",
    BARLEY: "barley",
    WHEAT: "wheat",
    SILAGE: "silage",
  };

  /** Achat d'un intrant au négociant — du fourrage, pour l'instant. */
  async function buyInput(commodity: TradeGood, tons: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ bought: number; cost: number }>("/market/buy", {
        method: "POST",
        body: JSON.stringify({ userId: player.id, commodity, tons }),
      });
      const nom = GOOD_DEFS[commodity]?.name ?? commodity;
      const ration = RATION_DE[commodity];
      const pourLeLot = nourrirApres;
      await refreshPlayer();
      if (pourLeLot && ration) {
        // La marchandise est au silo : on enchaîne sur ce que le joueur
        // voulait vraiment. `feedHerd` gère lui-même le `busy` et la quantité.
        setNourrirApres(null);
        setBusy(false);
        await feedHerd(pourLeLot, ration, r.bought);
        flashToast(`${r.bought} t de ${nom.toLowerCase()} · −${r.cost} TRN · distribué au troupeau`);
        return;
      }
      flashToast(`${r.bought} t de ${nom.toLowerCase()} · −${r.cost} TRN`);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function sell(commodity: TradeGood, tons: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ revenue: number }>(`/market/sell`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, commodity, tons }),
      });
      await refreshPlayer();
      await refreshMeta();
      setMsg(`Vendu pour ${r.revenue} TRN`);
      markGuideFlag("sold");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function dryStock(itemId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ cost: number; moisture: number; reduction: number }>(`/inventory/dry`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, itemId, passes: 1 }),
      });
      await refreshPlayer();
      setMsg(
        `Séché (−${(r.reduction * 100).toFixed(0)} pts) · ${(r.moisture * 100).toFixed(0)} % · −${r.cost} TRN`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function acceptContract(id: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ contract: MissionPlayContract }>(`/contracts/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setActiveMission(r.contract);
      await refreshMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finishMission() {
    if (!player || !activeMission) return;
    setBusy(true);
    try {
      const r = await api<{ reward: number; machine?: { type: string; condition: number; wearApplied: number } }>(
        `/contracts/${activeMission.id}/complete`,
        {
          method: "POST",
          body: JSON.stringify({ userId: player.id }),
        },
      );
      await refreshPlayer();
      await refreshMeta();
      const wearNote = r.machine
        ? ` · ${r.machine.type} −${r.machine.wearApplied.toFixed(1)}%`
        : "";
      flashToast(`Chantier honoré · +${r.reward} TRN${wearNote}`);
      setActiveMission(null);
      markGuideFlag("contract");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function abandonMission() {
    if (!player || !activeMission) return;
    setBusy(true);
    try {
      await api(`/contracts/${activeMission.id}/abandon`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setActiveMission(null);
      await refreshMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /** Remplir la cuve. Le prix suit la région, comme les cours. */
  async function loadCredit() {
    if (!player) return;
    try {
      setCredit(await api<CreditView>(`/farm/credit?userId=${player.id}`));
    } catch {
      /* la banque est un écran de plus : son absence ne bloque pas le Bureau */
    }
  }

  /** Ce que font les ateliers de transformation, et à quelle marge. */
  async function loadAteliers() {
    if (!player) return;
    try {
      const r = await api<{ ateliers: ProcessingView[] }>(
        `/farm/processing?userId=${player.id}`,
      );
      setAteliers(r.ateliers);
    } catch {
      /* une ferme sans atelier n'a rien à montrer ici */
    }
  }

  async function borrow(amount: number) {
    if (!player) return;
    setBusy(true);
    try {
      await api("/farm/loan", {
        method: "POST",
        body: JSON.stringify({ userId: player.id, amount }),
      });
      flashToast(`Emprunté ${Math.round(amount)} TRN`);
      await refreshPlayer();
      await loadCredit();
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function repay(amount: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ repaid: number }>("/farm/repay", {
        method: "POST",
        body: JSON.stringify({ userId: player.id, amount }),
      });
      flashToast(`Remboursé ${Math.round(r.repaid)} TRN`);
      await refreshPlayer();
      await loadCredit();
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function buyFuel(liters: number) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ fuelL: number; liters: number; cost: number }>("/farm/fuel", {
        method: "POST",
        body: JSON.stringify({ userId: player.id, liters }),
      });
      flashToast(`${Math.round(r.liters)} L de gazole · −${Math.round(r.cost)} TRN`);
      await refreshPlayer();
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function buyMachine(type: MachineType, tier: Tier = 1) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/machines/buy`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, type, tier }),
      });
      await refreshPlayer();
      if (activeParcelId) await loadParcel(activeParcelId);
      setMsg(`${MACHINE_DEFS[type].name} ${TIER_LABELS[tier]} acheté`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function upgradeBuilding(id: string) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ cost: number; levelName: string; building: { level: number } }>(
        `/buildings/${id}/upgrade`,
        { method: "POST", body: JSON.stringify({ userId: player.id }) },
      );
      flashToast(`Niveau ${r.building.level} · ${r.levelName} — ${r.cost} TRN`);
      await refreshPlayer();
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function buyAnimals(buildingId: string, count: number, young = false) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ added: number; cost: number; young?: boolean }>(
        `/buildings/${buildingId}/animals`,
        {
          method: "POST",
          body: JSON.stringify({ userId: player.id, count, young }),
        },
      );
      flashToast(`+${r.added} ${young ? "jeune(s)" : "bête(s)"} · −${r.cost} TRN`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function grazeHerd(herdId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ animals: number }>(`/herds/${herdId}/graze`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`${r.animals} bête(s) sortent au pré`);
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  const loadQuests = useCallback(async () => {
    if (!player?.id) return;
    try {
      const r = await api<{ quests: QuestView[] }>(`/quests?userId=${player.id}`);
      setQuests(r.quests);
    } catch {
      // Le carnet d'objectifs n'est pas vital : son absence ne doit pas
      // empêcher de travailler la parcelle.
    }
  }, [player?.id]);

  useEffect(() => {
    void loadQuests();
  }, [loadQuests, player?.xp]);

  /**
   * La montée de palier s'annonce.
   *
   * On la guette sur le niveau du joueur plutôt que dans la réponse de chaque
   * route : le niveau peut monter en semant, en moissonnant, en vendant, en
   * encaissant une quête — six endroits à ne pas oublier, contre une seule
   * sentinelle ici.
   */
  const lastLevel = useRef<number | null>(null);
  useEffect(() => {
    const level = player?.level;
    if (level == null) return;
    const before = lastLevel.current;
    lastLevel.current = level;
    if (before == null || level <= before) return;
    const opened = levelUnlocks().find((u) => u.level === level);
    flashToast(opened ? `Niveau ${level} — ${opened.label}` : `Niveau ${level}`);
    playUiSound("place");
  }, [player?.level]);

  async function claimQuest(id: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ reward: { xp: number; crd: number } }>(`/quests/${id}/claim`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`Objectif tenu · +${r.reward.crd} TRN · +${r.reward.xp} XP`);
      playUiSound("place");
      await refreshPlayer();
      await loadQuests();
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  /** Rentrer le troupeau avant la fin de sa sortie. */
  async function shelterHerd(herdId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ animals: number }>(`/herds/${herdId}/shelter`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`${r.animals} bête(s) rentrent`);
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Distribue une ration complète : le joueur choisit l'aliment, pas la dose.
   * Le maïs nourrit mieux, mais c'est du maïs qu'il ne vendra pas.
   */
  async function feedHerd(
    herdId: string,
    ration: "hay" | "maize" | "barley" | "wheat" | "silage",
    /**
     * Ce dont on dispose vraiment, quand l'appelant en sait plus que l'état.
     *
     * Après un achat, `player` n'a pas encore été rendu à nouveau : les stocks
     * fermés dans cette closure valent encore zéro, et la distribution partait
     * avec zéro tonne — refusée par le serveur. L'appelant passe donc ce qu'il
     * vient d'acheter.
     */
    stockConnu?: number,
  ) {
    if (!player) return;
    setBusy(true);
    try {
      const barn = barns.find((b) => b.herd?.id === herdId);
      const size = barn?.herd?.size ?? 1;
      /**
       * Ce qu'il manque, pas une tonne de plus.
       *
       * La quantité était `taille / 3` arrondie au supérieur : un chiffre
       * commode qui ne regardait ni la faim du lot ni la valeur nutritive de
       * la ration. Un troupeau presque rassasié recevait autant qu'un troupeau
       * à jeun, et une tonne d'ensilage — soixante pour cent plus nourrissante
       * que le foin — comptait comme une tonne de foin.
       *
       * On distribue donc le **manque** : le besoin du cycle moins ce qui
       * reste dans la mangeoire, converti en tonnes par la valeur de la
       * ration choisie. Un minimum d'une centaine de kilos, sans quoi un lot
       * repu ferait des allers-retours pour rien.
       */
      /**
       * Une distribution = **un jour réel**, pas un cycle.
       *
       * Un cycle vaut quinze minutes réelles : servir un cycle obligeait à
       * revenir toutes les quinze minutes sous peine de voir le lot dépérir.
       * On sert donc de quoi tenir vingt-quatre heures d'horloge, ce qui reste
       * dans l'auge déduit. La consommation, elle, n'a pas bougé d'un kilo.
       */
      const besoinKg = rationToServe({
        besoinParCycle: barn?.herd?.feedNeed ?? size * 14,
        feedStock: barn?.herd?.feedStock ?? 0,
      });
      const valeur = FEED_VALUE[RATION_GOOD[ration]] ?? 1;
      const wanted = Math.max(0.1, Math.round((besoinKg / 1000 / valeur) * 100) / 100);
      const stock = stockConnu ?? (
        ration === "maize"
          ? maizeInStock
          : ration === "barley"
            ? barleyInStock
            : ration === "wheat"
              ? wheatInStock
              : ration === "silage"
                ? silageInStock
                : hayInStock);
      const tons = Math.min(stock, wanted);
      const r = await api<{ units: number; quality: number }>(`/herds/${herdId}/feed`, {
        method: "POST",
        body: JSON.stringify({
          userId: player.id,
          hayTons: ration === "hay" ? tons : 0,
          maizeTons: ration === "maize" ? tons : 0,
          barleyTons: ration === "barley" ? tons : 0,
          wheatTons: ration === "wheat" ? tons : 0,
          silageTons: ration === "silage" ? tons : 0,
        }),
      });
      lancerTransport(barn?.buildingId ?? "", RATION_GOOD[ration]);
      const label =
        ration === "maize"
          ? "Maïs"
          : ration === "barley"
            ? "Orge"
            : ration === "wheat"
              ? "Blé"
              : ration === "silage"
                ? "Ensilage"
                : "Foin";
      flashToast(`${label} distribué · ${tons.toFixed(1)} t · ${r.units} kg`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function milkHerd(herdId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ hectolitres: number; litres: number }>(`/herds/${herdId}/milk`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`Traite : ${r.litres} L au silo`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Rentre ou sort le troupeau, durablement.
   *
   * Le seul geste que le joueur n'avait pas : « Sortir les bêtes » ouvrait
   * une séance de trois heures, puis tout rentrait tout seul. C'est ici que
   * se prend la décision « est-ce que je les laisse dehors ? », et le serveur
   * répond avec la température, pour qu'elle ne soit pas prise à l'aveugle.
   */
  async function setHerdHousing(herdId: string, housing: "INSIDE" | "OUTSIDE") {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ housing: string; tempC: number | null; warning: string | null }>(
        `/herds/${herdId}/housing`,
        { method: "POST", body: JSON.stringify({ userId: player.id, housing }) },
      );
      const ou = r.housing === "OUTSIDE" ? "Bêtes sorties" : "Bêtes rentrées";
      const temp = r.tempC !== null ? ` · ${r.tempC} °C` : "";
      flashToast(r.warning ? `${ou}${temp} — ${r.warning}` : `${ou}${temp}`, r.warning ? "warn" : false);
      await refreshPlayer();
      if (activeParcelId) loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  function spreadManure(_buildingId: string) {
    setTool("FERTILIZE");
    setSelectedCells([]);
    flashToast("Sélectionnez les cultures, puis Faire — le fumier part de la fosse");
  }

  async function sellManure(buildingId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ tons: number; proceeds: number }>(
        `/buildings/${buildingId}/manure/sell`,
        { method: "POST", body: JSON.stringify({ userId: player.id }) },
      );
      flashToast(`Fumier vendu au voisin · ${r.tons.toFixed(2)} t · +${r.proceeds} TRN`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function collectEggs(herdId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ crates: number }>(`/herds/${herdId}/collect-eggs`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`Œufs : ${r.crates} caisse(s) au stock`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function shearHerd(herdId: string) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ tons: number }>(`/herds/${herdId}/shear`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`Tonte : ${r.tons.toFixed(3)} t de laine`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  function slaughterHerd(herdId: string, count: number) {
    if (!player) return;
    setConfirmRequest({
      title: `Abattre ${count} bête(s) ?`,
      detail: "La viande part au silo, les bêtes ne reviennent pas.",
      confirmLabel: "Abattre",
      destructive: true,
      onConfirm: () => void doSlaughter(herdId, count),
    });
  }

  async function doSlaughter(herdId: string, count: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ kg: number; maturity: number; remaining: number }>(
        `/herds/${herdId}/slaughter`,
        { method: "POST", body: JSON.stringify({ userId: player.id, count }) },
      );
      flashToast(`Abattu · ${r.kg} kg de viande · maturité ${r.maturity} %`);
      await refreshPlayer();
      if (activeParcelId) await loadLivestock(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  function sellMachine(id: string, label: string, reprise: number) {
    if (!player) return;
    setConfirmRequest({
      title: `Reprise de ${label} ?`,
      detail: `Le concessionnaire en donne ${reprise} TRN, tout de suite. C’est moins que la cote entre joueurs : c’est le prix de ne pas attendre. L’engin quitte le garage définitivement.`,
      confirmLabel: "Reprendre",
      destructive: true,
      onConfirm: () => void doSellMachine(id, label),
    });
  }

  /**
   * Mise en vente d'occasion.
   *
   * L'engin quitte la ferme dès l'annonce publiée — c'est ce qui empêche de
   * continuer à labourer avec un tracteur qu'on est en train de vendre, et ce
   * qui garantit qu'un seul exemplaire existe à tout instant.
   */
  function listMachine(id: string, label: string, cote: number) {
    if (!player) return;
    const min = Math.round(cote * MACHINE_LISTING_MIN_RATE);
    const max = Math.round(cote * MACHINE_LISTING_MAX_RATE);
    setConfirmRequest({
      title: `Mettre ${label} en vente ?`,
      detail: `Cote ${cote} TRN. Vous fixerez un prix entre ${min} et ${max} TRN. L’engin quitte la ferme le temps de l’annonce et revient si personne ne l’achète.`,
      confirmLabel: `Publier à ${cote} TRN`,
      onConfirm: () => void doListMachine(id, label, cote),
    });
  }

  async function doListMachine(id: string, label: string, priceCrd: number) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/machines/${id}/list`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, priceCrd }),
      });
      flashToast(`${label} en vente · ${priceCrd} TRN`);
      await refreshPlayer();
      await loadMachineListings();
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  /* Le marché d'occasion se recharge à l'ouverture du garage : une annonce
     vendue entre-temps ne doit pas rester affichée comme disponible. */
  /* La ligne de crédit se recharge à l'ouverture du Bureau : une dette qui a
     couru pendant qu'on jouait doit se voir en arrivant. */
  useEffect(() => {
    const ouvert = isMobile ? sheet === "OFFICE" : showEta;
    if (ouvert) {
      void loadCredit();
      void loadAteliers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEta, sheet, isMobile, player?.id]);

  useEffect(() => {
    const ouvert = isMobile ? sheet === "GARAGE" : showGarage;
    if (ouvert) void loadMachineListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGarage, sheet, isMobile]);

  async function loadMachineListings() {
    try {
      const r = await api<{ listings: MachineListing[] }>("/machines/listings");
      setMachineListings(r.listings ?? []);
    } catch {
      /* le marché d'occasion est un bonus : son absence ne bloque pas le garage */
    }
  }

  async function buyUsedMachine(listingId: string, label: string) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/machines/listings/${listingId}/buy`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`${label} acheté d’occasion`);
      await refreshPlayer();
      await loadMachineListings();
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function cancelMachineListing(listingId: string) {
    if (!player) return;
    setBusy(true);
    try {
      await api(`/machines/listings/${listingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast("Annonce retirée");
      await refreshPlayer();
      await loadMachineListings();
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function doSellMachine(id: string, label: string) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ value: number }>(`/machines/${id}/sell`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`${label} vendu · +${r.value} TRN`);
      await refreshPlayer();
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  function sellBuilding(id: string, label: string) {
    if (!player) return;
    const b = (parcel?.buildings ?? []).find((x) => x.id === id);
    const fresh = withinRegret(b?.createdAt ? Date.now() - Date.parse(b.createdAt) : undefined);
    setConfirmRequest({
      title: `Démolir ${label} ?`,
      // Une erreur de clic ne se paie pas : tant que la construction est
      // fraîche, la démolition rend tout. Le dire ici évite l'hésitation.
      detail: fresh
        ? "Posé à l'instant : vous récupérez la totalité de la dépense."
        : "Vous récupérez une partie des matériaux. Les niveaux payés sont perdus.",
      confirmLabel: "Démolir",
      destructive: !fresh,
      onConfirm: () => void doSellBuilding(id, label),
    });
  }

  /** Quart de tour d'un bâtiment déjà posé. */
  async function rotateBuilding(id: string, label: string) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/buildings/${id}/rotate`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`${label} tourné d'un quart`);
      playUiSound("place");
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  /** Pose confirmée : c'est le seul endroit d'où part la dépense. */
  async function confirmBuild() {
    if (!player || !pendingBuild || !activeParcelId) return;
    const def = BUILDING_DEFS[buildType];
    setBusy(true);
    setErr(null);
    try {
      await api(`/parcels/${activeParcelId}/build`, {
        method: "POST",
        body: JSON.stringify({
          userId: player.id,
          type: buildType,
          x: pendingBuild.x,
          y: pendingBuild.y,
          rotation: buildRotation,
        }),
      });
      flashToast(`${def.name} bâti · −${def.cost} TRN`);
      playUiSound("place");
      setPendingBuild(null);
      await refreshPlayer();
      await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function doSellBuilding(id: string, label: string) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ value: number }>(`/buildings/${id}/sell`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      flashToast(`${label} démoli · +${r.value} TRN`);
      await refreshPlayer();
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function repairMachine(id: string, extent: "half" | "full") {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ condition: number; cost: number }>(`/machines/${id}/repair`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, extent }),
      });
      await refreshPlayer();
      setMsg(
        extent === "half"
          ? `Rafistolé → ${r.condition.toFixed(0)}% (−${r.cost} TRN)`
          : `Révisé → ${r.condition.toFixed(0)}% (−${r.cost} TRN)`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function finishCare() {
    if (!player || !care) return;
    setBusy(true);
    setErr(null);
    try {
      if (care.mode === "grease") {
        const r = await api<{ cost: number }>(`/machines/${care.machineId}/grease`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id }),
        });
        setMsg(`Graissé · −${r.cost} TRN`);
      } else if (care.mode === "clean") {
        const r = await api<{ cost: number }>(`/machines/${care.machineId}/clean`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id }),
        });
        setMsg(`Nettoyé · −${r.cost} TRN`);
      } else {
        const kind = care.kind ?? "BELT";
        const r = await api<{ condition: number; cost: number }>(`/machines/${care.machineId}/service`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, kind }),
        });
        setMsg(`Réparé → ${r.condition.toFixed(0)}% (−${r.cost} TRN)`);
      }
      setCare(null);
      await refreshPlayer();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (booting) {
    return (
      <div className="auth-loading">
        <p className="muted">Chargement de la session…</p>
      </div>
    );
  }

  if (!player) {
    return (
      <>
        <AuthScreen
          authMode={authMode}
          onAuthModeChange={(m) => {
            setAuthMode(m);
            setErr(null);
            setMsg(null);
          }}
          name={name}
          onNameChange={setName}
          email={email}
          onEmailChange={setEmail}
          accessCode={accessCode}
          onAccessCodeChange={setAccessCode}
          recoveryInput={recoveryInput}
          onRecoveryInputChange={setRecoveryInput}
          busy={busy}
          msg={msg}
          err={err}
          onRegister={register}
          onLogin={login}
          onRecover={recover}
        />
        {recoveryCode && (
          <RecoveryNotice code={recoveryCode} onClose={() => setRecoveryCode(null)} />
        )}
      </>
    );
  }

  /**
   * « Améliorer » : la même description pour ses deux hôtes.
   *
   * Elle a quitté le rail pour la fenêtre — trois bâtiments y faisaient déjà
   * 519 px et la liste grandit avec la ferme. Mais la fenêtre n'existe pas au
   * doigt : sans cette variable partagée, le téléphone perdait purement et
   * simplement l'amélioration, la rotation et la revente des bâtiments.
   */
  const blocAmeliorer = (parcel?.buildings?.length ?? 0) > 0 && (
            <>
              <h3 className="spaced">Améliorer</h3>
              <div className="build-list">
                {(parcel?.buildings ?? []).map((b) => {
                  const d = BUILDING_DEFS[b.type];
                  const lvl = b.level ?? 1;
                  const cost = buildingUpgradeCost(b.type, lvl);
                  const next = lvl < MAX_BUILDING_LEVEL ? buildingLevelDef(lvl + 1) : null;
                  const blocked = next ? player.level < next.requiredLevel : false;
                  // Le montant affiché est celui qu'on touchera vraiment : dans
                  // la fenêtre de regret, la démolition rend l'intégralité.
                  const age = b.createdAt ? Date.now() - Date.parse(b.createdAt) : undefined;
                  const refund = buildingResaleValue(b.type, lvl, age);
                  return (
                    <div key={b.id} className="upgrade-item">
                      <img className="build-art small" src={BUILDING_ART[b.type]} alt="" />
                      <span className="build-text">
                        <strong>{d.name}</strong>
                        <span className="level-row">
                          {Array.from({ length: MAX_BUILDING_LEVEL }, (_, i) => (
                            <i key={i} className={`pip ${i < lvl ? "on" : ""}`} />
                          ))}
                          <em>
                            Nv.{lvl} · {buildingLevelDef(lvl).name}
                          </em>
                        </span>
                      </span>
                      <span className="upgrade-actions">
                        {cost === null ? (
                          <span className="upgrade-max">Niveau max</span>
                        ) : blocked ? (
                          <span className="upgrade-locked">Nv. joueur {next?.requiredLevel}</span>
                        ) : !canPay(player, cost) ? (
                          <span className="upgrade-locked poor">{cost} TRN</span>
                        ) : (
                          <button
                            type="button"
                            className="upgrade-btn"
                            disabled={busy}
                            title={`Passer au niveau ${lvl + 1} — ${buildingLevelDef(lvl + 1).name}`}
                            onClick={() => upgradeBuilding(b.id)}
                          >
                            ↑ {cost} TRN
                          </button>
                        )}
                        <button
                          type="button"
                          className="upgrade-btn"
                          disabled={busy}
                          title="Tourner d'un quart de tour"
                          onClick={() => void rotateBuilding(b.id, d.name)}
                        >
                          ⟳
                        </button>
                        <button
                          type="button"
                          className={`sell-btn${age != null && withinRegret(age) ? " regret" : ""}`}
                          disabled={busy}
                          title={
                            age != null && withinRegret(age)
                              ? `Posé à l'instant — démolition intégralement remboursée (${refund} TRN)`
                              : `Démolir et récupérer ${refund} TRN`
                          }
                          onClick={() => sellBuilding(b.id, d.name)}
                        >
                          Démolir {refund}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          );

  /** Le catalogue de construction, décrit une fois pour ses deux hôtes. */
  const catalogueBatiments = (Object.keys(BUILDING_DEFS) as BuildingType[]).map((t) => {
    const d = BUILDING_DEFS[t];
    return (
      <button
        key={t}
        type="button"
        className={`build-item art ${tool === "BUILD" && buildType === t ? "on" : ""}`}
        onClick={() => {
          setTool("BUILD");
          setBuildType(t);
          setSelectedCells([]);
          // Le fantôme se pose tout seul (voir l'effet plus haut) ; ici on
          // s'efface, car le menu couvrait précisément la ferme qu'il fallait
          // regarder. Même raison sur bureau : le choix fait, la fenêtre part.
          if (isMobile) setSheet(null);
          setShowBuildPicker(false);
        }}
      >
        <img className="build-art" src={BUILDING_ART[t]} alt="" loading="lazy" />
        <span className="build-text">
          <strong>{d.name}</strong>
          <span>
            {d.w}×{d.h} · {d.cost} TRN
          </span>
          <span className="muted tiny">{d.description}</span>
        </span>
      </button>
    );
  });

  // Pas encore de terre : on déroule l'installation guidée avant le jeu.
  if (!ownedParcels.length) {
    return (
      <Suspense fallback={<SceneLoading label="Préparation du globe…" />}>
        <Onboarding
          playerName={player.displayName}
          continents={worldContinents}
          detail={continentDetail}
          detailLoading={detailLoading}
          onLoadContinent={loadContinent}
          onConfirm={claimStarterParcel}
          busy={busy}
          err={err}
        />
      </Suspense>
    );
  }

  if (showArrival) {
    return (
      <Suspense fallback={<SceneLoading label="Approche…" />}>
        <ArrivalTransition
          continents={worldContinents}
          continentCode={homeContinentCode}
          regionName={zoneName}
          cityName={homeCity}
          onDone={() => setShowArrival(false)}
        />
      </Suspense>
    );
  }

  return (
    <div className={`game-stage${isMobile ? " mobile" : ""}`}>
      {/* Le ciel, derrière la scène 3D. Le fond était un dégradé fixe : la
          saison était calculée et écrite dans le rail, mais jamais donnée à
          voir. */}
      <SeasonSky season={season} weather={localWeather} />
      <div className="iso-layer">
        {parcel ? (
          <Suspense fallback={<SceneLoading label="Chargement de la ferme…" />}>
            <IsoFarmView
              gridW={gw}
              gridH={gh}
              cells={grid}
              buildings={parcel.buildings ?? []}
              cellSims={parcelDetail?.cellSims ?? []}
              selected={selectedCells}
              hoverCell={hoverCell}
              previewBuilding={previewBuilding}
              pulseCells={pulseCells}
              activeWork={activeWork}
              grazing={grazingHerds}
              manurePiles={barns.flatMap((barn) => {
                const b = (parcel?.buildings ?? []).find((x) => x.id === barn.buildingId);
                const fill = barn.herd?.manureFill ?? 0;
                if (!b || fill <= 0.02) return [];
                const def = BUILDING_DEFS[b.type];
                return [
                  {
                    buildingId: b.id,
                    originX: b.originX,
                    originY: b.originY,
                    w: def.w,
                    h: def.h,
                    fill,
                  },
                ];
              })}
              yardSignals={barns.flatMap((barn) => {
                const b = (parcel?.buildings ?? []).find((x) => x.id === barn.buildingId);
                if (!b || !barn.herd) return [];
                const def = BUILDING_DEFS[b.type];
                const out: { kind: "eggs" | "wool"; originX: number; originY: number; w: number; h: number }[] =
                  [];
                if (barn.herd.canCollectEggs) {
                  out.push({
                    kind: "eggs",
                    originX: b.originX,
                    originY: b.originY,
                    w: def.w,
                    h: def.h,
                  });
                }
                if (barn.herd.canShear) {
                  out.push({
                    kind: "wool",
                    originX: b.originX,
                    originY: b.originY,
                    w: def.w,
                    h: def.h,
                  });
                }
                return out;
              })}
              workers={[]}
              parked={parkedMachines}
              weather={localWeather}
              /* La saison ne réglait que le ciel CSS ; la ferme, elle, était
                 éclairée pareil toute l'année. C'est la lumière qui fait la
                 différence entre un hiver et un été. */
              season={season}
              strokeWork={visiting}
              // Chez soi, tout outil qui travaille des cases se trace au doigt.
              // « Il faudrait pouvoir le glisser au lieu de devoir cliquer » :
              // vingt-quatre touchers pour une bande de blé, c'était le geste
              // le plus répété du jeu.
              strokeSelect={!visiting && isStrokeTool(tool)}
              onStrokeStart={() => {
                strokeBase.current = selectedCells;
              }}
              // L'aperçu part toujours de la sélection **d'avant le geste** :
              // sinon un tracé en mode « retirer » mangerait sa propre trace au
              // fur et à mesure, et un tracé additif se dédoublerait.
              onStrokePreview={(cells, mods) =>
                setSelectedCells(
                  applySelection(strokeBase.current, expandBrush(cells, brush, gw, gh), mods.mode),
                )
              }
              onStrokeSelect={(cells, mods) => {
                const next = applySelection(
                  strokeBase.current,
                  expandBrush(cells, brush, gw, gh),
                  mods.mode,
                );
                setSelectedCells(next);
                const last = cells[cells.length - 1];
                if (last) selectionAnchor.current = last;
              }}
              onWorkStroke={(cells) => {
                if (busy) return;
                void runWorkOnCells(cells);
              }}
              supplies={supplies}
              hauls={hauls}
              onCellClick={applyToolOnCell}
              onCellHover={setHoverCell}
              onCellContext={openCellMenu}
            />
          </Suspense>
        ) : (
          <div className="iso-viewport empty-farm">
            <p>Achetez une parcelle pour ouvrir la grille {gw}×{gh}.</p>
          </div>
        )}
      </div>

      {/* Bandeau, pastilles et cotations vivaient en trois calques posés à des
          décalages fixes : dès que l'un s'allongeait, il recouvrait le suivant.
          Empilés en flux, ils ne peuvent plus se marcher dessus. */}
      <div className="hud-stack">
        {visiting && visitOrder && (
          <div className="visit-banner">
            <strong>Chez {homeOwner ?? visitOrder.clientName}</strong>
            <span>
              {WORK_LABELS[visitOrder.work]} · {visitOrder.remaining} case(s) · {visitOrder.payoutCrd}{" "}
              TRN
            </span>
            <button type="button" className="chip" onClick={goHome}>
              Rentrer
            </button>
            <button type="button" className="chip" onClick={() => void abandonVisit()}>
              Abandonner
            </button>
          </div>
        )}
        <header className="hud-top">
          <div className="brand-row">
            <img className="brand-logo" src="/logo.webp" alt="" width={36} height={36} />
            <div className="brand-mark">Farming Navigateur</div>
            <span className="mvp-badge" title="Build jouable minimale">
              Première version · MVP
            </span>
            <button
              type="button"
              className="help-btn"
              title="Guide de ferme"
              aria-label="Ouvrir le guide"
              onClick={() => setShowGuide(true)}
            >
              ?
            </button>
          </div>
          {/* Les boutons de panneaux ont quitté cette barre pour le rail de
              gauche : ils s'y perdaient entre le nom du jeu, le niveau et la
              bourse, et un testeur a demandé pourquoi ils n'étaient pas à
              gauche avec le reste des commandes. Voir `ToolRail`. */}
          <div className="hud-stats">
            <span className="stat-name">{player.displayName}</span>
            <span className="stat-job">{SPECIALIZATION_LABELS[player.specialization]}</span>
            <span
              className="stat-xp"
              title={
                xpHere.toNext > 0
                  ? `${xpHere.into} / ${xpHere.span} XP — encore ${xpHere.toNext} pour le niveau ${xpHere.level + 1}`
                  : "Dernier palier atteint"
              }
            >
              Nv.{player.level} · {player.xp} XP
              {/* Une jauge, sinon « 0 XP » ne dit pas où l'on en est. */}
              <i
                className="stat-xp-bar"
                aria-hidden="true"
                style={{ ["--fill" as string]: `${Math.round((xpHere.into / xpHere.span) * 100)}%` }}
              />
            </span>
            <span className="gold" title={hasUnlimitedFunds(player) ? "Trésorerie illimitée (compte développeur)" : "Terrons (TRN)"}>
              {walletLabel(player)}
            </span>
            {player.bonuses && (
              <span className="stat-bonus">
                grain {player.bonuses.storageGrain}t · +
                {Math.round(player.bonuses.yieldBonus * 100)}%
              </span>
            )}
            {/* Au téléphone, tout ce qui précède sauf les TRN passe dans un
                tiroir : le bandeau doit tenir sur une ligne. */}
            <button
              type="button"
              className="profile-btn"
              aria-label="Profil et déconnexion"
              onClick={() => setSheet((cur) => (cur === "PROFILE" ? null : "PROFILE"))}
            >
              ☰
            </button>
            <button
              className="ghost logout-btn"
              type="button"
              onClick={logout}
            >
              Déconnexion
            </button>
          </div>
        </header>

        <div className="market-ticker">
          {market.map((m) => {
            const prev = prevPrices[m.commodity] ?? m.price;
            const delta = m.price - prev;
            const cls = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
            return (
              <span key={m.commodity} className={`tick ${cls}`}>
                {GOOD_DEFS[m.commodity as TradeGood]?.name ?? m.commodity} {m.price.toFixed(1)}
                <small>
                  {delta > 0.05 ? " ▲" : delta < -0.05 ? " ▼" : " ·"}
                  {Math.abs(delta) > 0.05 ? Math.abs(delta).toFixed(1) : ""}
                </small>
              </span>
            );
          })}
          <span className="tick weather-tick">{weatherLabel}</span>
        </div>
        {/* Une rangée permanente occupée à dire qu'il n'y a personne : c'était
            trente pixels de haut, à toutes les tailles, pour une information
            nulle. Le bandeau n'apparaît que quand quelqu'un est vraiment là —
            là, il vaut la place qu'il prend. */}
        {/* Se compter soi-même donnait « Mes est connecté » : une rangée
            permanente de quarante pixels pour apprendre au joueur qu'il est
            là. Le bandeau ne parle que des **autres**. */}
        {onlinePlayers.some((p) => p.online && p.id !== player.id) && (
          <button
            type="button"
            className="who-now-bar"
            onClick={() => {
              if (isMobile) setShowEta(true);
              else setShowEta((v) => !v);
            }}
          >
            <i className="who-dot on" aria-hidden="true" />
            {onlinePlayers
              .filter((p) => p.online && p.id !== player.id)
              .map((p) => p.name)
              .join(", ")}{" "}
            {onlinePlayers.filter((p) => p.online && p.id !== player.id).length > 1
              ? "sont connectés"
              : "est connecté"}
          </button>
        )}
        {(msg || err) && (
          <div key={toastTick} className={`toast ${err ? "bad" : toastTone}`} role="status">
            <span>{err ?? msg}</span>
            <i className="toast-bar" />
          </div>
        )}
      </div>

      {/* Le code de secours passe **devant** le bilan d'absence : il ne se
          redemande pas, alors que le bilan se relit dans le journal. */}
      {recoveryCode && (
        <RecoveryNotice code={recoveryCode} onClose={() => setRecoveryCode(null)} />
      )}

      {/* Le bilan d'absence annonce parfois huit cultures perdues : il mérite
          d'être lu, donc acquitté, plutôt que de flotter sur la ferme. */}
      {resumeBanner && !err && (
        <div className="resume-backdrop" role="dialog" aria-modal="true">
          <div className="resume-card glass">
            <strong>Pendant votre absence</strong>
            <p>{resumeBanner}</p>
            {absenceLines.length > 0 && (
              <ul className="list">
                {absenceLines.map((line, i) => (
                  <li key={i}>
                    <span className="muted tiny">{line}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="accent"
              onClick={() => {
                setResumeBanner(null);
                setAbsenceLines([]);
              }}
            >
              J’ai vu
            </button>
          </div>
        </div>
      )}

      {sheet === "PROFILE" && isMobile && (
        <aside className={panelClass("profile-panel", "PROFILE")} {...(isMobile ? sheetGesture : {})}>
          <h3>{player.displayName}</h3>
          <dl>
            <div>
              <dt>Métier</dt>
              <dd>{SPECIALIZATION_LABELS[player.specialization]}</dd>
            </div>
            <div>
              <dt>Niveau</dt>
              <dd>
                Nv.{player.level} · {player.xp} XP
              </dd>
            </div>
            <div>
              <dt>Trésorerie</dt>
              <dd>{walletLabel(player)}</dd>
            </div>
            {hasUnlimitedFunds(player) && (
              <div>
                <dt>Compte</dt>
                <dd>Développeur · argent illimité</dd>
              </div>
            )}
            {player.bonuses && (
              <div>
                <dt>Bonus ferme</dt>
                <dd>
                  grain {player.bonuses.storageGrain} t · +
                  {Math.round(player.bonuses.yieldBonus * 100)} % rendement
                </dd>
              </div>
            )}
          </dl>
          <div className="profile-actions">
            {notifications.state === "default" && (
              <button type="button" className="ghost" onClick={notifications.ask}>
                M’alerter en cas de problème
              </button>
            )}
            {notifications.state === "granted" && (
              <span className="muted tiny">Alertes activées</span>
            )}
            {notifications.state === "denied" && (
              <span className="muted tiny">
                Alertes refusées — à rouvrir dans les réglages du navigateur
              </span>
            )}
            <button type="button" className="ghost" onClick={() => setShowGuide(true)}>
              Guide de ferme
            </button>
            <button type="button" className="ghost" onClick={() => setShowTutorial(true)}>
              Revoir le tutoriel
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Déconnexion
            </button>
          </div>
        </aside>
      )}



      {/*
        Barre de pose. Elle n'apparaît qu'une fois la place retenue, et c'est
        d'elle seule que part la dépense : un clic sur la parcelle ne bâtit
        plus rien tout seul. C'est la réponse directe aux cinq silos posés
        par accident, sans moyen d'annuler.
      */}
      {pendingBuild && !visiting && (() => {
        const def = BUILDING_DEFS[buildType];
        const foot = orientedFootprint(buildType, buildRotation);
        const placeOk = canPlaceBuildingAt(pendingBuild.x, pendingBuild.y);
        // Un bouton grisé ne dit pas ce qui cloche. Les deux seuls empêchements
        // possibles se nomment, et la barre le dit à la place du bouton.
        const souci =
          (player?.crd ?? 0) < def.cost
            ? `Il vous manque ${def.cost - Math.round(player?.crd ?? 0)} TRN`
            : overlapsYard({ x: pendingBuild.x, y: pendingBuild.y, w: foot.w, h: foot.h }, gh)
              ? YARD_REFUSAL
              : !placeOk
                ? "Place occupée — touchez une autre case"
              : null;
        return (
          <div className={`build-confirm glass ${souci ? "blocked" : ""}`}>
            <div className="build-confirm-what">
              <img className="build-confirm-art" src={BUILDING_ART[buildType]} alt="" />
              <span className="build-confirm-lines">
                <strong>{def.name}</strong>
                <span className="build-confirm-meta">
                  {foot.w}×{foot.h} cases · face {["nord", "est", "sud", "ouest"][buildRotation % 4]}
                </span>
                {souci && <span className="build-confirm-why">{souci}</span>}
              </span>
              {/* Tourner monte sur la ligne du titre : la place est libre à
                  droite du nom, et chaque rangée de boutons en moins, c'est
                  autant de ferme qui reste visible sous la barre. */}
              <button
                type="button"
                className="ghost build-turn"
                onClick={() => setBuildRotation((r) => (r + 1) % 4)}
                title="Tourner d'un quart de tour (R)"
              >
                <span aria-hidden="true">⟳</span> Tourner
              </button>
            </div>
            <div className="build-confirm-actions">
              <button type="button" className="ghost" onClick={() => setPendingBuild(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="primary build-go"
                disabled={busy || !placeOk}
                onClick={() => void confirmBuild()}
              >
                Construire <b>{def.cost} TRN</b>
              </button>
            </div>
          </div>
        );
      })()}


      {/*
        Les deux rails.

        Les panneaux flottaient chacun en absolu, ancrés à des `top`/`bottom`
        en rem : le garage et l'élevage démarraient l'un dans l'autre, les
        missions percutaient le garage sous mille pixels de haut, et le bandeau
        du haut leur passait dessus dès que les cotations passaient à la ligne.
        Ils vivent maintenant dans deux colonnes qui défilent — la grille de
        `.game-shell` réserve leur largeur, la scène 3D reste plein écran
        derrière. Sur téléphone les rails s'effacent (`display: contents`) et
        les panneaux redeviennent des tiroirs.
      */}
      <div className="rail rail-left">
        <PanelHost
          mobile={isMobile}
          open={showGarage}
          title="Garage"
          subtitle={`${(player.farm?.machines ?? []).length} machine(s)`}
          width="wide"
          onClose={() => setShowGarage(false)}
        >
        {(isMobile ? sheet === "GARAGE" : showGarage) && (
          <aside className={panelClass("garage-panel", "GARAGE")} {...(isMobile ? sheetGesture : {})}>
            <h3 className="only-mobile">Garage</h3>
            <p className="muted tiny">
              Graissez et nettoyez : la machine s’use moins et récolte un peu plus.
              Réparer ramène à mi-chemin, remettre à neuf va jusqu’à 100 %. Le
              compteur horaire, lui, ne se répare pas : c’est ce qui fixe la cote
              d’un engin et ce qui rend l’occasion moins chère.
            </p>
            <ul className="list">
              {(player.farm?.machines ?? []).map((m) => {
                const def = MACHINE_DEFS[m.type as MachineType];
                const low = def ? m.condition < def.minCondition : m.condition < 15;
                const dirty = (m.dirt ?? 0) >= DIRT_DIRTY_THRESHOLD;
                const panne = isBreakdownKind(m.breakdown) ? BREAKDOWN_LABELS[m.breakdown] : null;
                // La graisse est une jauge et non un interrupteur : « pas
                // graissé » n'apparaissait qu'une fois à sec, sans jamais
                // prévenir. Le booléen reste le repli des bases d'avant.
                const grease = m.grease ?? (m.greased === false ? 0 : GREASE_FULL);
                const eta = true;
                const halfTarget = repairHalfwayTarget(m.condition);
                const halfQuote = def
                  ? repairQuote({
                      condition: m.condition,
                      repairCostPerPoint: def.repairCostPerPoint,
                      targetCondition: halfTarget,
                    })
                  : null;
                const fullQuote = def
                  ? repairQuote({
                      condition: m.condition,
                      repairCostPerPoint: def.repairCostPerPoint,
                      targetCondition: 100,
                    })
                  : null;
                const rendement = conditionYieldFactor(m.condition);
                const salete = Math.max(0, Math.min(100, m.dirt ?? 0));
                const compteur = m.hours ?? 0;
                const ageFactor = machineAgeYieldFactor(compteur);
                const palier = asTier(m.tier);
                const heuresRestantes = def
                  ? hoursBeforeWorkshop({
                      condition: m.condition,
                      minCondition: def.minCondition,
                      lifeHours: machineLifeHours(m.type as MachineType, palier),
                      careMult: careWearMultiplier({ grease, dirt: salete }),
                      inShed: Boolean(m.storedInBuildingId),
                    })
                  : 0;
                const heuresParChamp = def
                  ? jobHours(machineHoursPerHectare(m.type as MachineType, palier), gw * gh)
                  : 0;
                const champsRestants =
                  heuresParChamp > 0 ? Math.floor(heuresRestantes / heuresParChamp) : 0;
                const etat = { condition: m.condition, hours: compteur, tier: palier };
                const cote = machineResaleValue(m.type as MachineType, etat);
                const reprise = machineDealerValue(m.type as MachineType, etat);
                const canHalf = Boolean(halfQuote && halfQuote.points > 0.5 && m.condition < 99.5);
                const canFull = Boolean(fullQuote && fullQuote.points > 0.5 && m.condition < 99.5);
                return (
                  <li key={m.id}>
                    <span>
                      <strong>
                        {def?.name ?? m.type} {TIER_LABELS[palier]}
                      </strong>
                      {/* Ce qui décide de tout depuis la séparation porteur /
                          outil : les chevaux d'un tracteur, la largeur d'un
                          outil. Sans ces deux nombres, on ne peut pas savoir
                          si un achat sera tractable. */}
                      {def && (
                        <div className="muted tiny">
                          {def.kind === "TRACTOR"
                            ? `Porteur · ${machinePower(m.type as MachineType, palier)} ch`
                            : def.kind === "SELF_PROPELLED"
                              ? `Automoteur · ${machineWidth(m.type as MachineType, palier)} m de largeur`
                              : `Outil · ${machineWidth(m.type as MachineType, palier)} m · demande ${machineRequiredHp(m.type as MachineType, palier)} ch`}
                        </div>
                      )}
                      <div className={`muted tiny ${low || panne ? "warn" : ""}`}>
                        État {m.condition.toFixed(0)}% ·{" "}
                        {m.condition <= 0
                          ? "HS"
                          : m.condition < 15
                            ? "à réparer"
                            : m.condition < 40
                              ? "usé"
                              : m.condition < 70
                                ? "correct"
                                : m.condition < 90
                                  ? "bon"
                                  : "neuf"}
                        {/* Ce que l'usure coûte, en clair.
                            La perte de rendement existait désormais dans la
                            simulation, mais nulle part à l'écran : une
                            mécanique qu'on ne voit pas ne décide de rien, et
                            le joueur aurait continué de repousser la révision
                            sans savoir ce qu'elle lui rapportait. */}
                        {rendement < 1 && (
                          <> · <b className="wear-cost">rendement −{Math.round((1 - rendement) * 100)} %</b></>
                        )}
                        {grease >= GREASE_OK && !dirty && !panne ? " · propre et graissé (+)" : ""}
                        {dirty ? " · sale" : ""}
                        {panne ? ` · panne ${panne}` : ""}
                        {m.storedInBuildingId ? " · hangar" : m.parkedParcelId ? " · parcelle" : ""}
                      </div>
                      <div
                        className={`grease-gauge ${grease <= 0 ? "empty" : grease < GREASE_OK ? "low" : ""}`}
                        title={`Graisse ${grease.toFixed(0)} % — plus la jauge baisse, plus l’usure monte`}
                      >
                        <span className="grease-label">Graisse</span>
                        <span className="grease-track">
                          <span className="grease-fill" style={{ width: `${Math.max(0, Math.min(100, grease))}%` }} />
                        </span>
                        <span className="grease-num">{grease.toFixed(0)}%</span>
                      </div>
                      {/* La saleté pesait plus lourd que la graisse sur l'usure
                          et n'avait pourtant aucune jauge : elle n'apparaissait
                          qu'en un mot, « sale », une fois le mal fait. Même
                          gabarit que la graisse, remplissage inversé — ici
                          c'est le vide qui est bon signe. */}
                      <div
                        className={`grease-gauge dirt-gauge ${dirty ? "empty" : salete >= DIRT_DIRTY_THRESHOLD / 2 ? "low" : ""}`}
                        title={`Saleté ${salete.toFixed(0)} % — au-delà de ${DIRT_DIRTY_THRESHOLD} %, un nettoyage s’impose`}
                      >
                        <span className="grease-label">Saleté</span>
                        <span className="grease-track">
                          <span className="grease-fill" style={{ width: `${Math.max(0, Math.min(100, salete))}%` }} />
                        </span>
                        <span className="grease-num">{salete.toFixed(0)}%</span>
                      </div>
                      {/* La question que le joueur se pose avant de lancer un
                          chantier — « est-ce que je peux y aller ? » — ne se
                          déduisait d'aucun des chiffres affichés. */}
                      {/* Le compteur horaire, comme sur un vrai engin : il ne
                          recule pas, pas même après une révision, et c'est lui
                          qui fixe la cote à la revente. */}
                      <div className="muted tiny">
                        Compteur <b>{compteur.toFixed(0)} h</b>
                        {/* Un porteur n'a pas de cadence à lui : il prend celle
                            de l'outil qu'il tire. Afficher « 0,0 h par champ »
                            puis « plus de quoi faire un champ » sur un tracteur
                            neuf était un mensonge pur et simple. */}
                        {heuresParChamp > 0 && ` · ${heuresParChamp.toFixed(1)} h par champ entier`}
                        {/* Le malus d'âge ne se répare pas : s'il n'était pas
                            écrit ici, le joueur réviserait sa machine en
                            croyant récupérer un rendement qui ne revient pas. */}
                        {ageFactor < 1 && (
                          <> · <b className="wear-cost">−{Math.round((1 - ageFactor) * 100)} % d’usure moteur</b></>
                        )}
                      </div>
                      {def && !panne && (
                        <div className={`muted tiny ${heuresRestantes <= 20 ? "warn" : ""}`}>
                          {heuresRestantes <= 0
                            ? "À bout de course — passez à l’atelier."
                            : heuresParChamp > 0
                              ? `Encore ${heuresRestantes} h de travail, soit ${champsRestants} champ${champsRestants > 1 ? "s" : ""} entier${champsRestants > 1 ? "s" : ""} à ce rythme d’entretien.`
                              : `Encore ${heuresRestantes} h de travail à ce rythme d’entretien.`}
                        </div>
                      )}
                    </span>
                    {/* Chacun de ces gestes se grisait en rangeant sa raison
                        dans un `title` — invisible au doigt. Mesuré au
                        téléphone : trente-deux boutons du seul Garage étaient
                        muets. `Geste` les rend touchables : ils n'agissent
                        pas, mais ils répondent. */}
                    <span className="row-actions">
                      <Geste
                        busy={busy}
                        blocage={
                          grease >= GREASE_FULL - 0.5
                            ? "Le graisseur est déjà au plein."
                            : !canPay(player, GREASE_COST_CRD)
                              ? `Il vous manque ${Math.ceil(GREASE_COST_CRD - player.crd)} TRN pour graisser.`
                              : null
                        }
                        hint={`Refaire le plein de graisse · ${GREASE_COST_CRD} TRN`}
                        label={
                          <>
                            <span>Graisser · {GREASE_COST_CRD} TRN</span>
                            <em>ralentit l’usure</em>
                          </>
                        }
                        onDo={() => setCare({ mode: "grease", machineId: m.id })}
                        onExplain={(raison) => flashToast(raison, "warn")}
                      />
                      <Geste
                        busy={busy}
                        blocage={
                          (m.dirt ?? 0) < 8
                            ? "Cette machine est propre — rien à nettoyer."
                            : !canPay(player, CLEAN_COST_CRD)
                              ? `Il vous manque ${Math.ceil(CLEAN_COST_CRD - player.crd)} TRN pour le nettoyage.`
                              : null
                        }
                        hint={`${CLEAN_COST_CRD} TRN`}
                        label={
                          <>
                            <span>Nettoyer · {CLEAN_COST_CRD} TRN</span>
                            <em>rend son rendement</em>
                          </>
                        }
                        onDo={() => setCare({ mode: "clean", machineId: m.id })}
                        onExplain={(raison) => flashToast(raison, "warn")}
                      />
                      <Geste
                        busy={busy}
                        blocage={
                          !canHalf
                            ? "L’état est encore bon : il n’y a rien à rafistoler."
                            : halfQuote != null && !canPay(player, halfQuote.cost)
                              ? `Il vous manque ${Math.ceil(halfQuote.cost - player.crd)} TRN pour ce rafistolage.`
                              : null
                        }
                        hint={halfQuote ? `État → ${halfTarget.toFixed(0)} %` : undefined}
                        /* « Rafistoler » et « Réviser » ne disaient pas ce
                           qu'ils font ni en quoi ils diffèrent : deux verbes
                           de garagiste, deux prix, et au joueur de deviner.
                           Le bouton annonce maintenant l'état d'arrivée —
                           c'est la seule chose qui distingue les deux.
                           Sur une machine neuve les devis valent zéro : le
                           bouton annonçait « Rafistoler 0 TRN », un prix nul
                           pour un travail impossible. */
                        label={
                          canHalf ? (
                            <>
                              <span>Réparer · {halfQuote?.cost ?? 0} TRN</span>
                              <em>
                                état {m.condition.toFixed(0)} → {halfTarget.toFixed(0)} %
                              </em>
                            </>
                          ) : (
                            "Rien à réparer"
                          )
                        }
                        onDo={() => repairMachine(m.id, "half")}
                        onExplain={(raison) => flashToast(raison, "warn")}
                      />
                      <Geste
                        busy={busy}
                        blocage={
                          !canFull
                            ? "Cette machine est déjà à neuf."
                            : fullQuote != null && !canPay(player, fullQuote.cost)
                              ? `Il vous manque ${Math.ceil(fullQuote.cost - player.crd)} TRN pour la révision.`
                              : null
                        }
                        hint="Révision complète"
                        label={
                          canFull ? (
                            <>
                              <span>Remettre à neuf · {fullQuote?.cost ?? 0} TRN</span>
                              <em>état {m.condition.toFixed(0)} → 100 %</em>
                            </>
                          ) : (
                            "Déjà à neuf"
                          )
                        }
                        onDo={() => repairMachine(m.id, "full")}
                        onExplain={(raison) => flashToast(raison, "warn")}
                      />
                      {/* Deux sorties, et c'est un vrai arbitrage : l'argent
                          tout de suite en reprise, ou la cote pleine mais il
                          faut qu'un joueur passe. */}
                      <button
                        type="button"
                        className="sell-btn"
                        disabled={busy}
                        title={`Le concessionnaire reprend tout de suite, sous la cote (${cote} TRN)`}
                        onClick={() => sellMachine(m.id, def?.name ?? m.type, reprise)}
                      >
                        Reprise · {reprise} TRN
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={busy}
                        title={`Cote ${cote} TRN — l’engin quitte la ferme le temps de l’annonce`}
                        onClick={() => listMachine(m.id, def?.name ?? m.type, cote)}
                      >
                        Mettre en vente · cote {cote} TRN
                      </button>
                    </span>
                  </li>
                );
              })}
              {(player.farm?.machines.length ?? 0) === 0 && (
                <li className="muted">Aucune machine</li>
              )}
            </ul>
            {/* Le marché de l'occasion. Il précède le neuf : c'est là que
                démarre un joueur sans trésorerie, et c'est la sortie qui donne
                sa valeur au compteur horaire. */}
            {/* La cuve.
                Elle est au garage plutôt qu'au marché parce que c'est là qu'on
                pense au matériel — et parce qu'un chantier refusé faute de
                gazole renvoie ici. */}
            <h3 className="spaced">Gazole</h3>
            <div className="grease-gauge" title={`Cuve ${Math.round(cuveL)} L sur ${FUEL_TANK_L} L`}>
              <span className="grease-label">Cuve</span>
              <span className="grease-track">
                <span
                  className="grease-fill"
                  style={{ width: `${Math.max(0, Math.min(100, (cuveL / FUEL_TANK_L) * 100))}%` }}
                />
              </span>
              <span className="grease-num">{Math.round(cuveL)} L</span>
            </div>
            <p className="muted tiny">
              Chaque chantier fait son plein ici. Un tracteur surdimensionné pour son outil
              tourne au ralenti et brûle davantage — atteler juste, c’est ce qui se voit sur
              cette jauge.
            </p>
            <div className="build-choice">
              {[500, 1500, FUEL_TANK_L].map((l) => {
                const place = Math.max(0, FUEL_TANK_L - cuveL);
                const litres = Math.min(l, place);
                const prix = fuelCost(litres, 1);
                return (
                  <button
                    key={l}
                    type="button"
                    disabled={busy || litres <= 0 || player.crd < prix}
                    title={
                      litres <= 0
                        ? "Cuve déjà pleine"
                        : `${Math.round(litres)} L pour environ ${Math.round(prix)} TRN`
                    }
                    onClick={() => void buyFuel(l)}
                  >
                    +{l === FUEL_TANK_L ? "plein" : `${l} L`}
                  </button>
                );
              })}
            </div>

            <h3 className="spaced">Occasion</h3>
            {machineListings.length === 0 ? (
              <p className="muted tiny">
                Aucune annonce pour l’instant. Le matériel mis en vente par les autres
                fermes apparaît ici, avec son compteur et sa cote.
              </p>
            ) : (
              <ul className="list used-list">
                {machineListings.map((l) => {
                  const mien = l.sellerId === player.id;
                  const affaire = l.priceCrd <= l.quote;
                  return (
                    <li key={l.id}>
                      <span>
                        <strong>{l.name}</strong>
                        <div className="muted tiny">
                          {l.hours.toFixed(0)} h au compteur · état {l.condition.toFixed(0)} %
                          {/* Ce qu'un acheteur doit savoir avant de payer : les
                              heures coûtent du rendement, et la révision ne les
                              efface pas. */}
                          {machineAgeYieldFactor(l.hours) < 1 &&
                            ` · rendement −${Math.round((1 - machineAgeYieldFactor(l.hours)) * 100)} %`}
                          {l.breakdown ? " · en panne" : ""}
                          {mien ? " · votre annonce" : ` · ${l.seller?.displayName ?? "un voisin"}`}
                        </div>
                        <div className={`muted tiny ${affaire ? "wear-cost" : ""}`}>
                          {l.priceCrd} TRN — cote {l.quote} TRN
                          {affaire ? " (sous la cote)" : " (au-dessus de la cote)"}
                        </div>
                      </span>
                      {mien ? (
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={busy}
                          onClick={() => void cancelMachineListing(l.id)}
                        >
                          Retirer
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy || player.crd < l.priceCrd}
                          title={
                            player.crd < l.priceCrd
                              ? "TRN insuffisants"
                              : `Reprend l’engin tel quel : ${l.hours.toFixed(0)} h, état ${l.condition.toFixed(0)} %`
                          }
                          onClick={() => void buyUsedMachine(l.id, l.name)}
                        >
                          Acheter · {l.priceCrd} TRN
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <h3 className="spaced">Acheter neuf</h3>
            {/* Le catalogue se lit désormais en trois tailles. Un palier plus
                haut ne travaille pas mieux : il travaille plus large, donc plus
                vite — et il demande un tracteur qui suive. */}
            <p className="muted tiny">
              Palier affiché : <strong>{TIER_LABELS[tierAchat]}</strong>. Un outil plus large va
              plus vite, mais exige plus de chevaux.
            </p>
            <div className="age-switch" role="group" aria-label="Palier de matériel">
              {MACHINE_TIERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={tierAchat === t ? "on" : ""}
                  aria-pressed={tierAchat === t}
                  onClick={() => setTierAchat(t)}
                >
                  {TIER_LABELS[t]}
                </button>
              ))}
            </div>
            {/* Le compte des places, avant le catalogue : c'est la contrainte
                qui décide de tout ce qui suit. */}
            <p className={`muted tiny${placeAuGarage ? "" : " perte"}`}>
              {placeAuGarage
                ? `${parcMachines}/${slotsMachines} emplacements occupés`
                : `Garage plein — ${parcMachines}/${slotsMachines}. Bâtissez ou agrandissez un hangar matériel, ou revendez un engin.`}
            </p>
            <div className="build-list">
              {(Object.keys(MACHINE_DEFS) as MachineType[]).map((t) => {
                const d = MACHINE_DEFS[t];
                const prix = machineCost(t, tierAchat);
                const largeur = machineWidth(t, tierAchat);
                const besoin = machineRequiredHp(t, tierAchat);
                // Un outil qu'aucun tracteur de la ferme ne peut tirer reste
                // achetable — on prépare parfois son parc — mais il le dit.
                const tractable =
                  d.kind !== "IMPLEMENT" ||
                  (player.farm?.machines ?? []).some(
                    (m) =>
                      MACHINE_DEFS[m.type as MachineType]?.kind === "TRACTOR" &&
                      canPull(
                        { type: m.type as MachineType, tier: asTier(m.tier) },
                        { type: t, tier: tierAchat },
                      ),
                  );
                return (
                  <button
                    key={t}
                    type="button"
                    className="build-item art"
                    /* Le garage plein grisait le bouton nulle part : le
                       catalogue proposait chaque engin, et le clic revenait en
                       409 « Slots machines pleins ». Une place manquante se
                       sait avant de cliquer, comme un TRN manquant. */
                    disabled={busy || player.crd < prix || !placeAuGarage}
                    title={
                      !placeAuGarage
                        ? `Garage plein — ${parcMachines}/${slotsMachines} emplacements. Agrandissez ou bâtissez un hangar matériel, ou revendez un engin.`
                        : player.crd < prix
                          ? `TRN insuffisants — ${prix} requis`
                          : tractable
                            ? d.description
                            : `Aucun de vos tracteurs ne donne les ${besoin} ch nécessaires`
                    }
                    onClick={() => buyMachine(t, tierAchat)}
                  >
                    <img className="build-art" src={MACHINE_ART[t]} alt="" loading="lazy" />
                    <span className="build-text">
                      <strong>
                        {d.name} {TIER_LABELS[tierAchat]}
                      </strong>
                      <span>{prix} TRN</span>
                      <span className="muted tiny">
                        {d.kind === "TRACTOR"
                          ? `${machinePower(t, tierAchat)} ch`
                          : d.kind === "SELF_PROPELLED"
                            ? `${largeur} m · automoteur`
                            : `${largeur} m · ${besoin} ch requis`}
                        {!tractable ? " · rien pour le tirer" : ""}
                      </span>
                      <span className="muted tiny">{d.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        )}
        </PanelHost>

        <PanelHost
          mobile={isMobile}
          open={showHerd}
          title="Élevage"
          subtitle={`${barns.reduce((n, b) => n + (b.herd?.size ?? 0), 0)} bête(s) · ${barns.length} bâtiment(s)`}
          width="wide"
          onClose={() => setShowHerd(false)}
        >
        {(isMobile ? sheet === "HERD" : showHerd) && (
        <LivestockPanel
          orphanYards={orphanYards}
          className={panelClass("livestock-panel", "HERD")}
          gesture={isMobile ? sheetGesture : undefined}
          unSeulBatiment={isMobile}
          onClose={() => {
            if (isMobile) setSheet(null);
            else setShowHerd(false);
          }}
          barns={barns}
          busy={busy}
          crd={player.crd}
          onBuyAnimals={buyAnimals}
          onGraze={grazeHerd}
          onFeed={feedHerd}
          onMilk={milkHerd}
          onCollectEggs={collectEggs}
          onShear={shearHerd}
          onSlaughter={slaughterHerd}
          onSpreadBedding={spreadBedding}
          strawTons={strawInStock}
          onSpreadManure={spreadManure}
          onSellManure={sellManure}
          onHousing={setHerdHousing}
          /* Un geste empêché doit dire pourquoi : au téléphone, l'attribut
             `title` n'est jamais lu, et le joueur ne voyait qu'une rangée de
             boutons gris qui ne répondaient pas. */
          onExplain={(raison) => flashToast(raison, "warn")}
          onBuyFeed={(herdId) => {
            /**
             * Acheter puis distribuer, sans y penser.
             *
             * Le seul geste qui reste quand la réserve est vide, c'est d'aller
             * au négociant — l'alerte y mène au lieu de distribuer du vide.
             * Mais l'achat s'arrêtait là : le fourrage entrait au silo et les
             * bêtes continuaient de dépérir, parce qu'il fallait revenir
             * appuyer sur « Nourrir ». Rien ne le disait, et le joueur en
             * concluait — à raison — qu'il avait acheté pour rien.
             *
             * On retient donc le lot qui a demandé : dès que la marchandise
             * arrive, la ration part.
             */
            setNourrirApres(herdId);
            if (isMobile) setSheet(null);
            setShowMarket(true);
          }}
          hayTons={hayInStock}
          maizeTons={maizeInStock}
          barleyTons={barleyInStock}
          wheatTons={wheatInStock}
          /* Oublié au branchement : faute de valeur, le panneau retombait sur
             son défaut de 0 et le bouton « Ration ensilage » restait gris même
             avec un silo plein. */
          silageTons={silageInStock}
          onBuildPaddock={(yardType) => {
            setTool("BUILD");
            setBuildType(yardType);
            setSelectedCells([]);
            // Second chemin vers la construction, et il avait été oublié : la
            // feuille d'élevage restait ouverte par-dessus la scène, si bien
            // qu'on ne voyait pas que la demande avait été prise en compte. Le
            // fantôme se pose tout seul derrière (voir l'effet plus haut) —
            // encore faut-il pouvoir le regarder.
            if (isMobile) setSheet(null);
            flashToast(
              yardType === "PIG_YARD"
                ? "Posez la courette contre un bord de la porcherie"
                : yardType === "HEN_YARD"
                  ? "Posez la courette contre un bord du poulailler"
                  : "Posez l’enclos contre un bord de l’étable",
            );
          }}
        />
        )}
        </PanelHost>

        {/* Le panneau « Missions » a été supprimé, pas déplacé.
            Il s'ouvrait sur la même touche que la bourse des chantiers, donc
            **en même temps** qu'elle : deux fenêtres superposées dont celle-ci
            répétait les chantiers, les offres postées et les terres que la
            bourse montre déjà, en mieux. Mesuré : 5 411 px de contenu pour
            redire ce qui tient là-bas en cinq onglets. Ce qu'elle avait en
            propre — les objectifs et la présence des voisins — a rejoint la
            bourse sous l'onglet « Objectifs ». */}
      </div>

      {/* Le catalogue en grand, à la demande. `PanelHost` ne convient pas ici :
          au doigt le catalogue vit déjà dans le tiroir du rail, il ne doit pas
          exister en double. */}
      {!isMobile && (
        <Window
          open={showBuildPicker}
          title="Bâtiments"
          subtitle={`${Object.keys(BUILDING_DEFS).length} bâtiments à poser · ${parcel?.buildings?.length ?? 0} sur la ferme`}
          width="wide"
          onClose={() => setShowBuildPicker(false)}
        >
          <h3 className="spaced">Construire</h3>
          <div className="build-list">{catalogueBatiments}</div>
          {blocAmeliorer}
        </Window>
      )}

      <div className="rail rail-right">
        <aside className={panelClass("geo-panel", "INFO")} {...(isMobile ? sheetGesture : {})}>
          <h3>{homeCity || zoneName}</h3>
          <dl>
            <div>
              <dt>Région</dt>
              <dd>{zoneName}</dd>
            </div>
            <div>
              <dt>Continent</dt>
              <dd>{continentName || "—"}</dd>
            </div>
            <div>
              <dt>Climat</dt>
              <dd title={koppen}>{climateLabel || koppen}</dd>
            </div>
            <div>
              <dt>Saison</dt>
              <dd>
                {SEASON_LABELS[season]} · jour {jourDeSaison}/{SEASON_DAYS}
              </dd>
            </div>
            <div>
              <dt>Météo</dt>
              <dd className="wx">{weatherLabel}</dd>
            </div>
            <div>
              <dt>Fertilité</dt>
              <dd>{Math.round((parcel?.fertility ?? 0.7) * 100)} %</dd>
            </div>
            <div>
              <dt>Parcelle</dt>
              <dd>
                {PARCEL_HECTARES} Ha ({gw}×{gh})
              </dd>
            </div>
          </dl>
          <div className="progress">
            <span style={{ width: `${Math.round(avgProgress * 100)}%` }} />
          </div>
          <p className="muted tiny">Occupation cultures · {Math.round(avgProgress * 100)}%</p>

          {rotationAlert && (
            <div className="harvest-alert warn">
              <strong>
                Même culture sur {rotationAlert.cells} case
                {rotationAlert.cells > 1 ? "s" : ""}
              </strong>
              <span>
                Jusqu’à −{rotationAlert.malus} % de rendement : les maladies du sol s’installent.
                Alternez pour retrouver l’effet précédent.
              </span>
            </div>
          )}
          {harvestAlert && (
            <div className={`harvest-alert ${harvestAlert.level}`}>
              <strong>{harvestAlert.title}</strong>
              <span>{harvestAlert.detail}</span>
            </div>
          )}

          <h3 className="spaced">Mes parcelles</h3>
          <div className="chip-row">
            {ownedParcels.map((p) => (
              <button
                key={p.id}
                type="button"
                className={activeParcelId === p.id ? "chip on" : "chip"}
                onClick={() => setActiveParcelId(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </aside>
        {/* Au doigt seulement.

            Sur bureau, cette carte était le seul menu du jeu qu'on n'ouvrait
            pas : elle restait plantée dans le rail de droite pendant que
            Garage, Bureau et Élevage s'ouvraient depuis un bouton. « Ça n'a
            aucun sens » — et c'est vrai. Le bouton « Construire » du rail de
            gauche ouvre désormais directement le catalogue, comme les autres.
            Au doigt la carte reste : c'est elle qui porte le tiroir. */}
        {isMobile && (
          <aside className={panelClass("build-panel", "BUILD")} {...(isMobile ? sheetGesture : {})}>
            <h3>Construire</h3>
            {/* Au doigt, le catalogue reste dans le tiroir : il y occupe tout
                l'écran, ce qui est le bon geste sur un téléphone. Sur bureau il
                passe dans une fenêtre, et le rail ne garde que le choix courant.
                Voir `showBuildPicker` pour le pourquoi, plus haut. */}
            {isMobile ? (
              <div className="build-list">{catalogueBatiments}</div>
            ) : (
              <div className="build-choice">
                {tool === "BUILD" && buildType ? (
                  <span className="build-current">
                    <img className="build-art small" src={BUILDING_ART[buildType]} alt="" />
                    <span className="build-text">
                      <strong>{BUILDING_DEFS[buildType].name}</strong>
                      <span>
                        {BUILDING_DEFS[buildType].w}×{BUILDING_DEFS[buildType].h} ·{" "}
                        {BUILDING_DEFS[buildType].cost} TRN
                      </span>
                      <span className="muted tiny">Cliquez la ferme pour le poser.</span>
                    </span>
                  </span>
                ) : (
                  <p className="muted tiny">
                    Choisissez un bâtiment, puis cliquez la case où le poser.
                  </p>
                )}
                <button
                  type="button"
                  className="build-open"
                  onClick={() => setShowBuildPicker(true)}
                >
                  {tool === "BUILD" && buildType ? "Changer de bâtiment" : "Choisir un bâtiment"}
                  <em>{Object.keys(BUILDING_DEFS).length} bâtiments</em>
                </button>
              </div>
            )}

            {/* « Améliorer » a suivi le catalogue dans la fenêtre sur bureau :
                trois bâtiments y faisaient déjà 519 px, et la liste grandit
                avec la ferme. Améliorer ne demande pas de viser une case, rien
                n'oblige ce bloc à rester au-dessus du terrain. Au doigt, en
                revanche, il n'y a pas de fenêtre : le tiroir le garde. */}
            {isMobile && blocAmeliorer}
          </aside>
        )}
      </div>

      {/*
        Les deux coques.

        Le même état de jeu, deux interfaces qui ne partagent pas un pixel :
        au doigt la barre du bas, qui marchait déjà et n'a pas bougé ; à la
        souris un rail vertical qui montre **toutes** les options d'un coup, et
        une barre de sélection pleine largeur. C'est l'aiguillage demandé —
        `useIsMobile()` choisit une coque entière, jamais un attribut passé à
        un composant qui bifurque huit fois à l'intérieur.
      */}
      {/* Le chantier en cours.
            Un travail qui prend sept minutes sans rien afficher se lit comme
            une panne. La barre dit ce qui se fait, sur combien de cases, et
            combien de temps il reste. */}
      {chantier && (
        <div className="chantier-bar" role="status" aria-live="polite">
          <span className="chantier-nom">
            {WORK_LABELS[chantier.work] ?? chantier.work} · {chantier.cells.length} cases
            </span>
          <span className="chantier-piste">
            <span
              className="chantier-avance"
              style={{ animationDuration: `${Math.max(1, chantier.durationMs)}ms` }}
            />
            </span>
          <span className="chantier-reste">{formatChantierReste(chantier.endsAt, horloge)}</span>
          </div>
        )}
      {isMobile ? (
        <FieldDock
          machineManquante={machineManquante}
          tool={tool}
          season={season}
          brush={brush}
          isMobile={isMobile}
          isEta={visiting}
          visiting={visiting}
          busy={busy}
          selectedCount={selectedCells.length}
          readyCount={
            visiting ? Math.min(readyCellCount, visitOrder?.remaining ?? 0) : readyCellCount
          }
          strawCount={strawCellCount}
          baleCount={baleCellCount}
          silageReadyCount={silageReadyCount}
          stockTons={totalStockTons}
          crd={player.crd}
          directSeed={directSeed}
          keepSwath={keepSwath}
          swathUseful={swathUsefulHere}
          contractor={visiting ? null : contractorOffer}
          laborQuote={laborQuote}
          objective={nextGoal}
          allGoalsDone={allGoalsDone}
          onTool={pickTool}
          onBrush={setBrush}
          onDirectSeed={() => setDirectSeed((v) => !v)}
          onKeepSwath={() => setKeepSwath((v) => !v)}
          onConfirm={runSelectionAction}
          onHarvestAll={harvestAll}
          mowSelected={selectedAreGrass}
          mowReadyAll={readyAreGrass}
          onContractor={callContractor}
          onPublishLabor={publishLaborOrder}
          onSell={() => setShowMarket(true)}
          onGuide={() => setShowGuide(true)}
          hasHerd={barns.length > 0}
          showDev={devEnabled}
          onDev={() => setShowDev(true)}
          moreOpen={moreOpen}
          /* Refermé, « Plus » porte la somme de ce qui attend derrière lui :
             sinon cacher les panneaux cacherait aussi leurs alertes. */
          moreBadge={SHEET_TABS.reduce((n, t) => n + tabBadge(alerts, t.key), 0)}
          onMore={() => {
            setMoreOpen((v) => !v);
            setSheet(null);
          }}
        />
      ) : (
        <>
          <ToolRail
            tool={tool}
            season={season}
            brush={brush}
            directSeed={directSeed}
            keepSwath={keepSwath}
            swathUseful={swathUsefulHere}
            readyCount={
              visiting ? Math.min(readyCellCount, visitOrder?.remaining ?? 0) : readyCellCount
            }
            strawCount={strawCellCount}
            baleCount={baleCellCount}
            visiting={visiting}
            onTool={pickTool}
            onBrush={setBrush}
            onDirectSeed={() => setDirectSeed((v) => !v)}
            onKeepSwath={() => setKeepSwath((v) => !v)}
            onMarket={() => setShowMarket(true)}
            onGuide={() => setShowGuide(true)}
            panneaux={[
              {
                id: "BUILD",
                label: "Construire",
                icon: "/assets/icons/nav/batir.svg",
                on: showBuildPicker,
                onOpen: () => setShowBuildPicker((v) => !v),
              },
              {
                id: "GARAGE",
                label: "Garage",
                icon: "/assets/icons/nav/garage.svg",
                hotkey: "G",
                on: showGarage,
                onOpen: () => setShowGarage((v) => !v),
              },
              {
                id: "OFFICE",
                label: "Bureau",
                icon: "/assets/icons/nav/missions.svg",
                hotkey: "T",
                on: showEta,
                onOpen: () => setShowEta((v) => !v),
              },
              ...(barns.length > 0
                ? [
                    {
                      id: "HERD",
                      label: "Élevage",
                      icon: "/assets/icons/nav/troupeau.svg",
                      on: showHerd,
                      onOpen: () => setShowHerd((v) => !v),
                    },
                  ]
                : []),
              ...(devEnabled
                ? [
                    {
                      id: "DEV",
                      label: "Test",
                      on: false,
                      onOpen: () => setShowDev(true),
                    },
                  ]
                : []),
            ]}
          />
          <SelectionBar
            tool={tool}
            machineManquante={machineManquante}
            selectedCount={selectedCells.length}
            readyCount={
              visiting ? Math.min(readyCellCount, visitOrder?.remaining ?? 0) : readyCellCount
            }
            busy={busy}
            contractorCost={visiting ? null : (contractorOffer?.cost ?? null)}
            contractorAffordable={canPay(player, contractorOffer?.cost ?? 0)}
            contractorBlocage={visiting ? null : (contractorOffer?.blocage ?? null)}
            laborQuote={laborQuote}
            laborAffordable={canPay(player, laborQuote ?? 0)}
            visiting={visiting}
            mowSelected={selectedAreGrass}
            mowReadyAll={readyAreGrass}
            onConfirm={runSelectionAction}
            onHarvestAll={harvestAll}
            onContractor={callContractor}
            onPublishLabor={publishLaborOrder}
            onSelectAll={() => setSelectedCells(eligibleCells(tool))}
            onClear={() => setSelectedCells([])}
          />
          <CellContextMenu context={cellMenu} onClose={() => setCellMenu(null)} />
        </>
      )}


      <MarketPanel
        open={showMarket}
        onClose={() => {
          // Repartir sans rien acheter annule l'intention : sans cela, le
          // prochain achat de fourrage, fait pour tout autre chose, serait
          // versé d'office à un troupeau qu'on n'a plus en tête.
          setNourrirApres(null);
          setShowMarket(false);
        }}
        stock={player.farm?.inventory ?? []}
        listings={listings}
        deliveries={deliveries}
        marketPrices={market}
        crd={player.crd}
        busy={busy}
        onSellDealer={sellToDealer}
        onSellMarket={sell}
        onList={createListing}
        onBuyListing={buyListing}
        onCancelListing={cancelListing}
        onDeliverLot={deliverLot}
        onAutoDeliverLot={autoDeliverLot}
        onDry={dryStock}
        onBuyInput={buyInput}
        onLoadHistory={loadPriceHistory}
        futures={futures}
        onOpenFuture={openFuture}
        onDeliverFuture={deliverFuture}
      />

      <DevPanel
        open={showDev}
        onClose={() => setShowDev(false)}
        busy={busy}
        onGrant={devGrant}
        onTick={devTick}
      />


      {openBuilding && (
        <BuildingSheet
          building={openBuilding}
          herd={openBuildingHerd}
          playerLevel={player.level}
          crd={player.crd}
          busy={busy}
          visiting={visiting}
          onClose={() => setOpenBuildingId(null)}
          onRotate={() => void rotateBuilding(openBuilding.id, BUILDING_DEFS[openBuilding.type].name)}
          onUpgrade={() => void upgradeBuilding(openBuilding.id)}
          onDemolish={() => {
            setOpenBuildingId(null);
            sellBuilding(openBuilding.id, BUILDING_DEFS[openBuilding.type].name);
          }}
          /* Un seul mécanisme pour une seule décision : la fiche commande le
             lieu de vie, comme l'interrupteur du panneau d'élevage. Elle
             ouvrait auparavant une séance de trois heures, après quoi le
             troupeau rentrait seul — deux comportements pour un même geste. */
          onGrazeOut={() => openBuildingHerd && void setHerdHousing(openBuildingHerd.id, "OUTSIDE")}
          onShelter={() => openBuildingHerd && void setHerdHousing(openBuildingHerd.id, "INSIDE")}
        />
      )}

      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
      {care && player && (() => {
        const m = player.farm?.machines.find((x) => x.id === care.machineId);
        const def = m ? MACHINE_DEFS[m.type as MachineType] : null;
        return (
          <MachineCareOverlay
            mode={care.mode}
            machineName={def?.name ?? "Machine"}
            machineType={(m?.type as MachineType) ?? "TRACTOR"}
            kind={care.kind}
            busy={busy}
            onCancel={() => setCare(null)}
            onDone={() => void finishCare()}
          />
        );
      })()}

      {activeMission && (
        <MissionPlay
          contract={activeMission}
          busy={busy}
          onCancel={() => void abandonMission()}
          onDone={() => void finishMission()}
        />
      )}

      <TutorialOverlay open={showTutorial} onClose={() => setShowTutorial(false)} />
      <PlayGuide
        open={showGuide}
        snapshot={guideSnapshot}
        xp={player.xp}
        onClose={() => setShowGuide(false)}
      />

      {/* La bourse des chantiers s'ouvre par une décision, sur les deux
          coques. Elle était liée à `sheet === "OFFICE"` sur téléphone, si bien
          que l'onglet « Missions » ouvrait à la fois le tiroir des missions et
          cette modale par-dessus : deux panneaux pour un toucher, dont l'un
          restait invisible avec tout ce qu'il contenait. */}
      <OfficePanel
        credit={credit}
        onLoan={(n) => void borrow(n)}
        onRepay={(n) => void repay(n)}
        ateliers={ateliers}
        open={showEta}
        // Fermer la bourse ne ferme plus le tiroir : ce sont deux surfaces
        // distinctes, et l'on revient au tiroir d'où l'on est parti.
        onClose={() => setShowEta(false)}
        crd={player.crd}
        consignes={player.consignes ?? DEFAULT_CONSIGNES}
        busy={busy}
        board={laborBoard}
        posted={myPostedLabor}
        active={visitOrder}
        ghost={contracts}
        takeLocked={Boolean(activeMission)}
        onTake={(id) => void acceptLaborOrder(id)}
        onCancelPosted={(id) =>
          void api(`/labor-orders/${id}/cancel`, {
            method: "POST",
            body: JSON.stringify({ userId: player.id }),
          })
            .then(() => refreshMeta())
            .catch((e) => flashToast(e instanceof Error ? e.message : String(e), true))
        }
        onAbandonActive={() => void abandonVisit()}
        onTakeGhost={(id) => {
          void acceptContract(id);
          setShowEta(false);
          setSheet(null);
        }}
        onSaveConsignes={async (next) => {
          const r = await api<{ consignes: NonNullable<Player["consignes"]> }>("/me/consignes", {
            method: "POST",
            body: JSON.stringify(next),
          });
          setPlayer((p) => (p ? { ...p, consignes: r.consignes } : p));
          flashToast("Consignes enregistrées");
        }}
        zones={zones.filter(
          (z) =>
            ownedParcels.length === 0 ||
            ownedParcels.some((op) => op.zone?.code === z.code) ||
            z.parcels.some((p) => expandableParcelIds.has(p.id)),
        )}
        myFarmId={player.farm?.id}
        expandableIds={expandableParcelIds}
        onBuyLand={buyAdjacent}
        ledger={ledger}
        quests={quests}
        onClaimQuest={(id) => void claimQuest(id)}
        onlinePlayers={onlinePlayers}
      />

      {isMobile && (
        <>
          {/* Un voile referme le tiroir d'une tape hors de lui : sur un
              téléphone, chercher la bonne croix est une corvée. */}
          {(sheet && sheet !== "OFFICE") || moreOpen ? (
            <button
              type="button"
              className="sheet-scrim"
              aria-label="Fermer le panneau"
              onClick={() => {
                setSheet(null);
                setMoreOpen(false);
              }}
            />
          ) : null}
          {moreOpen && (
            <nav className="tab-drawer" aria-label="Panneaux">
              {SHEET_TABS.map((t, i) => {
                const disabled = t.key === "HERD" && !barns.length;
                const badge = tabBadge(alerts, t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`tab${(t.key === "OFFICE" ? showEta : sheet === t.key) ? " on" : ""}`}
                    disabled={disabled}
                    /* Entrée en cascade, 45 ms par carte — charte §8.1 #7. */
                    style={{ animationDelay: `${i * 45}ms` }}
                    title={disabled ? "Aucun bâtiment d’élevage sur la parcelle" : t.label}
                    aria-pressed={t.key === "OFFICE" ? showEta : sheet === t.key}
                    onClick={() => {
                      setMoreOpen(false);
                      // « Missions » n'a plus de tiroir : son contenu a rejoint
                      // la bourse des chantiers, qui le montrait déjà en
                      // double. L'onglet ouvre donc directement la bourse.
                      if (t.key === "OFFICE") {
                        setSheet(null);
                        setShowEta(true);
                        return;
                      }
                      setSheet((cur) => (cur === t.key ? null : t.key));
                    }}
                  >
                    <img className="tab-icon" src={t.icon} alt="" aria-hidden="true" />
                    <span className="tab-label">{t.label}</span>
                    {badge > 0 && (
                      <span className="tab-badge" aria-label="à traiter">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
              {devEnabled && (
                <button
                  type="button"
                  className="tab"
                  style={{ animationDelay: `${SHEET_TABS.length * 45}ms` }}
                  onClick={() => {
                    setShowDev(true);
                    setMoreOpen(false);
                  }}
                >
                  <span className="tab-icon" aria-hidden="true">
                    🛠
                  </span>
                  <span className="tab-label">Test</span>
                </button>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
