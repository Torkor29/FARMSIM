import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  SPECIALIZATION_LABELS,
  BUILDING_ART,
  BUILDING_DEFS,
  MACHINE_ART,
  MACHINE_DEFS,
  MAX_BUILDING_LEVEL,
  WORK_LABELS,
  buildingLevelDef,
  buildingResaleValue,
  buildingUpgradeCost,
  urgentContractorQuote,
  MISSION_CELLS_MIN,
  MISSION_CELLS_MAX,
  laborEscrow,
  type CharacterAppearance,
  type FieldWorkerView,
  repairHalfwayTarget,
  repairQuote,
  isPaddockAdjacent,
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
  footprintCells,
  currentObjective,
  evaluateObjectives,
  type GuideSnapshot,
  type Specialization,
  CROP_DEFS,
  GOOD_DEFS,
  isMowCrop,
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
  isBreakdownKind,
} from "@farmsim/shared";
import { AuthScreen } from "./AuthScreen";
import type { GrazingHerd, PreviewBuilding } from "./IsoFarmView";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { MachineCareOverlay, type CareMode } from "./MachineCareOverlay";
import { LivestockPanel, type BarnState } from "./LivestockPanel";
import { MarketPanel, type Listing, type MarketDelivery, type FuturesContract } from "./MarketPanel";
import { MissionsPanel } from "./MissionsPanel";
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
import { useIsMobile } from "./use-media-query";
import { DevPanel, type DevGrant } from "./DevPanel";
import { NO_ALERTS, tabBadge, useAwayAlerts, useNotificationState, type FarmAlerts } from "./use-alerts";
const API = "/api";

type SessionResume = {
  awayMs: number;
  awayLabel: string;
  cropsReady: number;
  cropsGrowing: number;
  marketDelta: Record<string, number>;
  weatherStates: string[];
  hint: string;
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
  weedsControlled?: boolean;
  directSeeded?: boolean;
  lastCrop?: CropCode | null;
  cropStreak?: number;
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

type Player = {
  id: string;
  displayName: string;
  specialization: Specialization;
  level: number;
  xp: number;
  crd: number;
  farm: {
    id: string;
    parcels: Parcel[];
    machines: {
      id: string;
      type: string;
      condition: number;
      parkedParcelId?: string | null;
      storedInBuildingId?: string | null;
      greased?: boolean;
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
};

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
type SheetKey = "INFO" | "BUILD" | "GARAGE" | "OFFICE" | "HERD" | "PROFILE" | "MORE";

const SHEET_TABS: { key: SheetKey; label: string; icon: string }[] = [
  { key: "INFO", label: "Parcelle", icon: "🌾" },
  { key: "BUILD", label: "Bâtir", icon: "🏗️" },
  { key: "HERD", label: "Troupeau", icon: "🐄" },
  { key: "GARAGE", label: "Garage", icon: "🚜" },
  { key: "OFFICE", label: "Missions", icon: "🤝" },
];

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
    return `Récolte ${total} t vendue tout de suite (pas de silo)${money}${hay}`;
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
  const [, setContracts] = useState<Contract[]>([]);
  const [laborBoard, setLaborBoard] = useState<LaborOrderView[]>([]);
  const [myPostedLabor, setMyPostedLabor] = useState<LaborOrderView[]>([]);
  const [visitOrder, setVisitOrder] = useState<LaborOrderView | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [authMode, setAuthMode] = useState<"register" | "login">("register");
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
  /** Semer dans les chaumes plutôt que de travailler le sol au préalable */
  const [directSeed, setDirectSeed] = useState(false);
  const [buildType, setBuildType] = useState<BuildingType>("SILO");
  const [selectedCells, setSelectedCells] = useState<{ x: number; y: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [care, setCare] = useState<{
    mode: CareMode;
    machineId: string;
    kind?: "BELT" | "HYDRAULIC" | "ENGINE";
  } | null>(null);
  const [showEta, setShowEta] = useState(false);
  const [showGarage, setShowGarage] = useState(false);
  const [showHerd, setShowHerd] = useState(false);
  const [weather, setWeather] = useState<WeatherSnap[]>([]);
  const [brush, setBrush] = useState<1 | 2 | 3>(1);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const [soldBanner, setSoldBanner] = useState<{
    tons: number;
    trn: number;
    crop: string;
  } | null>(null);
  const [walletFlash, setWalletFlash] = useState(false);
  const [marketTab, setMarketTab] = useState<"BUY" | "SELL">("BUY");
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
  } | null>(null);
  const haulPendingRef = useRef<Set<string>>(new Set());
  const haulSeenRef = useRef<Set<string>>(new Set());
  const haulReadyRef = useRef(false);
  const playHaulRef = useRef<(commodity?: string) => void>(() => undefined);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [toastTick, setToastTick] = useState(0);
  const [worldContinents, setWorldContinents] = useState<WorldContinent[]>([]);
  const [continentDetail, setContinentDetail] = useState<ContinentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [barns, setBarns] = useState<BarnState[]>([]);
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
    if (payload.resume && payload.resume.awayMs >= 30_000) {
      setResumeBanner(payload.resume.hint);
      setMsg(payload.resume.hint);
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
          ? `Grain vendu tout de suite (pas de silo)${money}`
          : `Silo plein : ${dump.soldTons.toFixed(2)} t vendues tout de suite${money}`,
      );
      markGuideFlag("sold");
    }
    setPlayer((prev) => keepIfSame(prev, me.player));
    if (!activeParcelId && me.player.farm?.parcels[0]) {
      setActiveParcelId(me.player.farm.parcels[0].id);
    }
    return me.player;
  }, [activeParcelId]);

  const loadLivestock = useCallback(async (parcelId: string) => {
    try {
      const r = await api<{ barns: BarnState[] }>(`/parcels/${parcelId}/livestock`);
      setBarns((prev) => keepIfSame(prev, r.barns));
    } catch {
      setBarns([]);
    }
  }, []);

  useEffect(() => {
    api<{ enabled: boolean }>("/dev/status")
      .then((r) => setDevEnabled(r.enabled))
      .catch(() => setDevEnabled(false));
  }, []);

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
        if (resume.awayMs >= 30_000) {
          setResumeBanner(resume.hint);
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
    const machines = visiting
      ? (parcel?.machines ?? [])
      : (player?.farm?.machines ?? []);
    return cells.map((c) => {
      const stained = { ...c, manuredUntil: manureStain[`${c.x},${c.y}`] };
      if (c.kind !== "VEHICLE" || !c.machineId) return stained;
      const m = machines.find((x) => x.id === c.machineId);
      return {
        ...stained,
        machineType: (m?.type as MachineType | undefined) ?? "TRACTOR",
        // L'état part jusqu'à la vue : une machine fatiguée se ternit sur le
        // champ, sans qu'il faille ouvrir le garage.
        // Sur la parcelle d'un voisin, l'API ne donne que le type : l'état
        // reste au propriétaire, et la machine s'affiche alors comme neuve.
        machineCondition: (m as { condition?: number } | undefined)?.condition,
      };
    });
  }, [parcel?.cells, parcel?.machines, player?.farm?.machines, visiting, manureStain]);
  const zoneName = parcel?.zone?.name ?? ownedParcels[0]?.zone?.name ?? "Votre région";
  const koppen = parcel?.zone?.koppen ?? "Cfb";
  const homeCity = parcel?.zone?.city ?? ownedParcels[0]?.zone?.city ?? "";
  const climateLabel = parcel?.zone?.climateLabel ?? "";
  const continentName = parcel?.zone?.continentName ?? "";
  const homeContinentCode =
    parcel?.zone?.continentCode ?? ownedParcels[0]?.zone?.continentCode ?? null;
  const hemisphere = (parcel?.zone?.hemisphere as "N" | "S" | undefined) ?? "N";
  const season = currentSeason(hemisphere);
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
      const barnBox = {
        originX: barnB.originX,
        originY: barnB.originY,
        w: barnDef.w,
        h: barnDef.h,
      };
      const yardType = barn.yardType;
      const paddockB = all.find((b) => {
        if (b.type !== yardType) return false;
        const d = BUILDING_DEFS[yardType];
        return isPaddockAdjacent(barnBox, {
          originX: b.originX,
          originY: b.originY,
          w: d.w,
          h: d.h,
        });
      });
      const outside = Boolean(herd.grazingUntil && herd.grazingUntil > now && paddockB);
      const pDef = paddockB ? BUILDING_DEFS[yardType] : barnDef;
      out.push({
        buildingId: barn.buildingId,
        animals: herd.size,
        kind: herd.kind,
        sheared: herd.kind === "SHEEP" && !herd.canShear,
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

  function flashToast(text: string, isError = false) {
    if (isError) setErr(text);
    else {
      setErr(null);
      setMsg(text);
    }
    setToastTick((n) => n + 1);
  }

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2800);
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

  function describeCell(x: number, y: number): string {
    const cell = grid.find((c) => c.x === x && c.y === y);
    const sim = parcelDetail?.cellSims?.find((s) => s.x === x && s.y === y);
    if (!cell || cell.kind === "EMPTY") {
      const soil = cell
        ? soilSummary({
            harvestsSincePlow: cell.harvestsSincePlow ?? 0,
            residuePasses: cell.residuePasses ?? 0,
            hasStubble: cell.hasStubble ?? false,
          })
        : "vide";
      return `Case (${x},${y}) · ${soil}`;
    }
    if (cell.kind === "CROP") {
      const crop = cell.crop ? (CROP_DEFS[cell.crop]?.name ?? cell.crop) : "?";
      const fert = cell.fertilizedPasses ?? 0;
      const ripe = sim?.sim.ripeness;
      if (ripe) {
        const keep = Math.round(ripe.yieldFactor * 100);
        if (ripe.stage === "LOST") {
          return `Case (${x},${y}) · ${crop} perdu — à labourer`;
        }
        const mins = Math.max(1, Math.round(ripe.msToLoss / 60000));
        return `Case (${x},${y}) · ${crop} · ${ripe.label} · ${keep} % du rendement · perdue dans ${mins} min`;
      }
      const prog = sim ? `${Math.round(sim.sim.progress * 100)}%` : "—";
      return `Case (${x},${y}) · ${crop} · en croissance ${prog} · ferti ${fert}`;
    }
    if (cell.kind === "BUILDING") {
      const b = parcel?.buildings?.find((bd) => bd.id === cell.buildingId);
      const name = b ? BUILDING_DEFS[b.type].name : "Bâtiment";
      return `Case (${x},${y}) · ${name}`;
    }
    if (cell.kind === "VEHICLE") {
      const mType = cell.machineType ?? "TRACTOR";
      const name = MACHINE_DEFS[mType]?.name ?? mType;
      return `Case (${x},${y}) · ${name} stationné`;
    }
    return `Case (${x},${y}) · ${cell.kind}`;
  }

  /**
   * Emprise libre ET budget suffisant. Le fantôme rouge signalait déjà le
   * manque de TRN, mais le clic partait quand même et le serveur répondait
   * 402 : un aller-retour perdu, et une erreur rouge en console pour une
   * situation parfaitement prévisible côté client.
   */
  function canPlaceBuildingAt(x: number, y: number): boolean {
    const def = BUILDING_DEFS[buildType];
    if (x + def.w > gw || y + def.h > gh) return false;
    if ((player?.crd ?? 0) < def.cost) return false;
    const footprint = footprintCells(x, y, def.w, def.h);
    return footprint.every((fc) => {
      const c = grid.find((cell) => cell.x === fc.x && cell.y === fc.y);
      return c?.kind === "EMPTY";
    });
  }

  const previewBuilding = useMemo((): PreviewBuilding | null => {
    if (tool !== "BUILD" || !hoverCell) return null;
    const def = BUILDING_DEFS[buildType];
    const spaceOk = canPlaceBuildingAt(hoverCell.x, hoverCell.y);
    const moneyOk = (player?.crd ?? 0) >= def.cost;
    return {
      type: buildType,
      originX: hoverCell.x,
      originY: hoverCell.y,
      valid: spaceOk && moneyOk,
    };
  }, [tool, buildType, hoverCell, grid, gw, gh, player?.crd]);

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

  function toggleCell(x: number, y: number) {
    const block = brushCells(x, y);
    setSelectedCells((prev) => {
      const allIn = block.every((c) => prev.some((s) => s.x === c.x && s.y === c.y));
      if (allIn) return prev.filter((s) => !block.some((c) => c.x === s.x && c.y === s.y));
      const next = [...prev];
      for (const c of block) {
        if (!next.some((s) => s.x === c.x && s.y === c.y)) next.push(c);
      }
      return next;
    });
  }

  /** Crée le compte seul : le métier et la terre se choisissent juste après. */
  async function register() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string; player: Player; resume?: SessionResume }>(
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            displayName: name.trim(),
            accessCode: accessCode || "ferme",
          }),
        },
      );
      applyAuth(r);
      await Promise.all([refreshMeta(), loadWorld()]);
      setMsg(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Essai sans compte : le serveur fabrique une identité jetable, avec une
   * terre et un tracteur, et ouvre la session. Personne ne devrait avoir à
   * remplir un formulaire pour voir à quoi ressemble le jeu.
   */
  async function tryDemo() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string; player: Player; resume?: SessionResume }>(
        "/auth/demo",
        { method: "POST" },
      );
      applyAuth(r);
      await Promise.all([refreshMeta(), loadWorld()]);
      setMsg("Compte d'essai ouvert — rien n'est enregistré à votre nom.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
      const r = await api<{ token: string; player: Player; resume?: SessionResume }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, accessCode: accessCode || "ferme" }),
        },
      );
      await loadWorld().catch(() => undefined);
      applyAuth(r);
      await refreshMeta();
      if (!r.resume || r.resume.awayMs < 30_000) setMsg("Connexion OK");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyToolOnCell(x: number, y: number) {
    if (!player || !activeParcelId) return;
    playUiSound("click");

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
      const block = brushCells(x, y);
      const allIn = block.every((c) => selectedCells.some((s) => s.x === c.x && s.y === c.y));
      const nextCount = allIn
        ? selectedCells.length -
          block.filter((c) => selectedCells.some((s) => s.x === c.x && s.y === c.y)).length
        : selectedCells.length +
          block.filter((c) => !selectedCells.some((s) => s.x === c.x && s.y === c.y)).length;
      toggleCell(x, y);
      const label = isPlantTool(tool)
        ? plantCropLabel(tool)
        : tool === "FERTILIZE"
          ? "Engrais"
          : tool === "PLOW"
            ? "Labour"
            : tool === "STUBBLE"
              ? "Nettoyer"
              : "Récolte";
      flashToast(`${label} · ${nextCount} case(s) sélectionnée(s)`);
      return;
    }

    if (tool === "BUILD") {
      if (visiting) {
        flashToast("Pas de construction chez le voisin", true);
        return;
      }
      const def = BUILDING_DEFS[buildType];
      if (!canPlaceBuildingAt(x, y)) {
        const reason =
          x + def.w > gw || y + def.h > gh
            ? "Emprise hors grille"
            : player.crd < def.cost
              ? `TRN insuffisants (${def.cost})`
              : "Collision ou case occupée";
        flashToast(reason, true);
        return;
      }
      flashToast(`Placement ${def.name}…`);
      setBusy(true);
      setErr(null);
      try {
        await api(`/parcels/${activeParcelId}/build`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, type: buildType, x, y }),
        });
        flashToast(`${def.name} placé · −${def.cost} TRN`);
        playUiSound("place");
        await refreshPlayer();
        await loadParcel(activeParcelId);
      } catch (e) {
        flashToast(e instanceof Error ? e.message : String(e), true);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (tool === "PARK") {
      flashToast("Stationnement…");
      setBusy(true);
      setErr(null);
      try {
        const free = player.farm?.machines.find((m) => !m.parkedParcelId && !m.storedInBuildingId);
        if (!free) throw new Error("Aucun véhicule libre à stationner");
        await api(`/machines/${free.id}/park`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, parcelId: activeParcelId, x, y }),
        });
        flashToast("Véhicule stationné");
        await refreshPlayer();
        await loadParcel(activeParcelId);
      } catch (e) {
        flashToast(e instanceof Error ? e.message : String(e), true);
      } finally {
        setBusy(false);
      }
    }
  }

  /** Le prestataire n'est proposé que là où il a un sens : sur du travail aux champs. */
  const selectedAreGrass = useMemo(() => {
    if (!selectedCells.length) return false;
    return selectedCells.every((sel) => {
      const cell = parcel?.cells?.find((c) => c.x === sel.x && c.y === sel.y);
      return isMowCrop(cell?.crop);
    });
  }, [selectedCells, parcel?.cells]);

  const readyAreGrass = useMemo(() => {
    const ready = (parcelDetail?.cellSims ?? []).filter((s) => s.sim.ready);
    if (!ready.length) return false;
    return ready.every((s) => {
      const cell = parcel?.cells?.find((c) => c.x === s.x && c.y === s.y);
      return isMowCrop(cell?.crop);
    });
  }, [parcelDetail?.cellSims, parcel?.cells]);

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
              : null;
    if (!work || !selectedCells.length) return null;
    const needed: MachineType =
      work === "HARVEST" ? "HARVESTER" : work === "STUBBLE" ? "DISC_HARROW" : "TRACTOR";
    const hasMachine = (player?.farm?.machines ?? []).some(
      (m) => m.type === needed && m.condition >= (MACHINE_DEFS[needed]?.minCondition ?? 15),
    );
    return { work, hasMachine, cost: urgentContractorQuote(work, selectedCells.length) };
  }, [tool, selectedCells.length, selectedAreGrass, player?.farm?.machines]);

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
    setBusy(true);
    setErr(null);
    const workCells = selectedCells.slice();
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

  function workMachineForTool(t: Tool): MachineType {
    if (t === "HARVEST") return "HARVESTER";
    // Le déchaumage se fait au déchaumeur à disques, seule machine que le
    // serveur accepte pour ce travail. L'animation montrait pourtant un
    // tracteur, alors que l'engin existait en modèle comme en illustration.
    if (t === "STUBBLE") return "DISC_HARROW";
    if (t === "FERTILIZE") {
      const hasSpreader = player?.farm?.machines.some((m) => m.type === "SPREADER");
      return hasSpreader ? "SPREADER" : "TRACTOR";
    }
    return "TRACTOR";
  }

  function flashWork(
    type: MachineType,
    cells: { x: number; y: number }[],
    cut?: "harvest" | "mow",
    extra?: { haul?: boolean; cargo?: string },
  ) {
    setPulseCells(cells);
    // L'engin envoyé au chantier est celui du garage : il arrive avec son
    // usure, visible sur sa carrosserie.
    const used = (player?.farm?.machines ?? []).find((m) => m.type === type);
    setActiveWork({ type, cells, cut, haul: extra?.haul, cargo: extra?.cargo, condition: used?.condition });
    // Un peu de marge sur la durée du parcours : l'engin doit atteindre la
    // dernière case avant qu'on ne l'efface.
    window.setTimeout(() => {
      setPulseCells([]);
      setActiveWork(null);
    }, workAnimationMs(cells.length) + 250);
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

  async function runWorkOnCells(cells: { x: number; y: number }[]) {
    if (!player || !activeParcelId || !cells.length || busy) return;
    setBusy(true);
    setErr(null);
    const workCells = cells.slice();
    const plantCrop = cropFromPlantTool(tool);
    const harvestCut = tool === "HARVEST" ? (selectedAreGrass ? "mow" : "harvest") : undefined;
    flashWork(
      tool === "HARVEST" && selectedAreGrass ? "TRACTOR" : workMachineForTool(tool),
      workCells,
      harvestCut,
    );
    type LaborBit = { remaining: number; completed: boolean; payout?: number };
    let labor: LaborBit | undefined;
    try {
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
          body: JSON.stringify({ userId: player.id, crop, cells: workCells, directSeed }),
        });
        setMsg(
          `Semé ${CROP_DEFS[crop].name} ×${workCells.length}${directSeed ? " en direct" : ""}` +
            wearNote(r.machine),
        );
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
          body: JSON.stringify({ userId: player.id, cells: workCells }),
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
          body: JSON.stringify({ userId: player.id, cells: workCells }),
        });
        const lost = r.lostCells ? ` · ${r.lostCells} perdue(s)` : "";
        setMsg(harvestGrainNote(r) + lost + wearNote(r.machine));
        noteForcedGrainSale(r, workCells);
        markGuideFlag("harvested");
        if (r.soldTons) markGuideFlag("sold");
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
          body: JSON.stringify({ userId: player.id, cells: workCells }),
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
          body: JSON.stringify({ userId: player.id, cells: workCells }),
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

  function cropLabelForHarvest(cells: { x: number; y: number }[]): string {
    const names = new Set<string>();
    for (const c of cells) {
      const cell = parcel?.cells?.find((p) => p.x === c.x && p.y === c.y);
      if (cell?.crop && CROP_DEFS[cell.crop]) names.add(CROP_DEFS[cell.crop].name.toLowerCase());
    }
    if (names.size === 1) return [...names][0];
    return "grain";
  }

  function noteForcedGrainSale(
    r: {
      soldTons?: number;
      soldRevenue?: number;
      soldReason?: "NO_SILO" | "SILO_FULL" | null;
    },
    cells: { x: number; y: number }[],
  ) {
    if (r.soldReason !== "NO_SILO" || !(r.soldTons && r.soldTons > 0)) return;
    setSoldBanner({
      tons: r.soldTons,
      trn: Math.round(r.soldRevenue ?? 0),
      crop: cropLabelForHarvest(cells),
    });
    setWalletFlash(true);
    window.setTimeout(() => setWalletFlash(false), 2200);
  }

  async function runSelectionAction() {
    await runWorkOnCells(selectedCells);
  }

  async function harvestAll() {
    if (!player || !activeParcelId) return;
    setBusy(true);
    try {
      const readyCells =
        (parcelDetail?.cellSims ?? [])
          .filter((s) => s.sim.ready)
          .map((s) => ({ x: s.x, y: s.y }))
          .filter((c) =>
            visiting && visitOrder
              ? visitOrder.cellList.some((r) => r.x === c.x && r.y === c.y)
              : true,
          ) || [];
      if (readyCells.length) {
        flashWork(
          readyAreGrass ? "TRACTOR" : "HARVESTER",
          readyCells,
          readyAreGrass ? "mow" : "harvest",
        );
      }
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
          cells: visiting ? readyCells : undefined,
        }),
      });
      setMsg(harvestGrainNote(r));
      noteForcedGrainSale(r, readyCells);
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

  /** Achat d'un intrant au négociant — du fourrage, pour l'instant. */
  async function buyInput(commodity: TradeGood, tons: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ bought: number; cost: number }>("/market/buy", {
        method: "POST",
        body: JSON.stringify({ userId: player.id, commodity, tons }),
      });
      flashToast(`${r.bought} t de fourrage · −${r.cost} TRN`);
      await refreshPlayer();
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

  async function buyMachine(type: MachineType) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/machines/buy`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, type }),
      });
      await refreshPlayer();
      if (activeParcelId) await loadParcel(activeParcelId);
      setMsg(`${MACHINE_DEFS[type].name} acheté`);
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

  async function buyAnimals(buildingId: string, count: number) {
    if (!player) return;
    setBusy(true);
    try {
      const r = await api<{ added: number; cost: number }>(`/buildings/${buildingId}/animals`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, count }),
      });
      flashToast(`+${r.added} bête(s) · −${r.cost} TRN`);
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

  /**
   * Distribue une ration complète : le joueur choisit l'aliment, pas la dose.
   * Le maïs nourrit mieux, mais c'est du maïs qu'il ne vendra pas.
   */
  async function feedHerd(herdId: string, ration: "hay" | "maize" | "barley" | "wheat") {
    if (!player) return;
    setBusy(true);
    try {
      const barn = barns.find((b) => b.herd?.id === herdId);
      const size = barn?.herd?.size ?? 1;
      const wanted = Math.max(1, Math.ceil(size / 3));
      const stock =
        ration === "maize"
          ? maizeInStock
          : ration === "barley"
            ? barleyInStock
            : ration === "wheat"
              ? wheatInStock
              : hayInStock;
      const tons = Math.min(stock, wanted);
      const r = await api<{ units: number; quality: number }>(`/herds/${herdId}/feed`, {
        method: "POST",
        body: JSON.stringify({
          userId: player.id,
          hayTons: ration === "hay" ? tons : 0,
          maizeTons: ration === "maize" ? tons : 0,
          barleyTons: ration === "barley" ? tons : 0,
          wheatTons: ration === "wheat" ? tons : 0,
        }),
      });
      const label =
        ration === "maize" ? "Maïs" : ration === "barley" ? "Orge" : ration === "wheat" ? "Blé" : "Fourrage";
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

  function sellMachine(id: string, label: string) {
    if (!player) return;
    setConfirmRequest({
      title: `Vendre ${label} ?`,
      detail: "La reprise dépend de l’état de la machine. Elle quitte le garage définitivement.",
      confirmLabel: "Vendre",
      destructive: true,
      onConfirm: () => void doSellMachine(id, label),
    });
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
    setConfirmRequest({
      title: `Démolir ${label} ?`,
      detail: "Vous récupérez une partie des matériaux. Les niveaux payés sont perdus.",
      confirmLabel: "Démolir",
      destructive: true,
      onConfirm: () => void doSellBuilding(id, label),
    });
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
      <AuthScreen
        authMode={authMode}
        onAuthModeChange={setAuthMode}
        onTryDemo={tryDemo}
        name={name}
        onNameChange={setName}
        email={email}
        onEmailChange={setEmail}
        accessCode={accessCode}
        onAccessCodeChange={setAccessCode}
        busy={busy}
        msg={msg}
        err={err}
        onRegister={register}
        onLogin={login}
      />
    );
  }

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
    <div className={`game-stage${isMobile ? " mobile" : ""}${isMobile && sheet ? " sheet-open" : ""}`}>
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
              weather={localWeather}
              strokeWork={visiting}
              onStrokePreview={setSelectedCells}
              onWorkStroke={(cells) => {
                if (busy) return;
                void runWorkOnCells(cells);
              }}
              onCellClick={applyToolOnCell}
              onCellHover={setHoverCell}
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
          <div className="hud-stats">
            <span className="stat-name">{player.displayName}</span>
            <span className="stat-job">{SPECIALIZATION_LABELS[player.specialization]}</span>
            <span className="stat-xp" title="Niveau / expérience">
              Nv.{player.level} · {player.xp} XP
            </span>
            <span className="stat-stock" title="Stock à la ferme">
              Blé {wheatInStock.toFixed(1)} t · Foin {hayInStock.toFixed(1)} t
            </span>
            <span className={`gold${walletFlash ? " flash" : ""}`} title="Terrons (TRN)">
              {Math.round(player.crd)} TRN
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
        {isMobile && (
          <button type="button" className="quest-chip quest-chip-hud" onClick={() => setShowGuide(true)}>
            <span className="quest-chip-mark" aria-hidden="true">
              {allGoalsDone ? "★" : "➤"}
            </span>
            <span className="quest-chip-body">
              <strong>{allGoalsDone ? "Guide de ferme" : "À faire"}</strong>
              <span>
                {allGoalsDone
                  ? "Tout est dans le recueil — cultures, bâtiments, métiers."
                  : nextGoal
                    ? `${nextGoal.title} · ${nextGoal.unlock}`
                    : "Ouvrir le guide"}
              </span>
            </span>
          </button>
        )}
        {soldBanner && (
          <div className="harvest-sold-banner" role="status">
            <p>
              {soldBanner.tons.toFixed(1)} t de {soldBanner.crop} vendues tout de suite · +
              {soldBanner.trn} TRN · bâtissez un silo pour attendre un meilleur prix.
            </p>
            <div className="harvest-sold-actions">
              <button
                type="button"
                className="accent"
                onClick={() => {
                  setSoldBanner(null);
                  if (isMobile) setSheet("BUILD");
                  else {
                    setTool("BUILD");
                    setBuildType("SILO");
                  }
                }}
              >
                Bâtir un silo
              </button>
              <button type="button" className="ghost" onClick={() => setSoldBanner(null)}>
                OK
              </button>
            </div>
          </div>
        )}
        {!isMobile && (
          <button
            type="button"
            className="who-now-bar"
            onClick={() => setShowEta((v) => !v)}
          >
            {onlinePlayers.some((p) => p.online) ? (
              <>
                <i className="who-dot on" aria-hidden="true" />
                {onlinePlayers
                  .filter((p) => p.online)
                  .map((p) => p.name)
                  .join(", ")}{" "}
                {onlinePlayers.filter((p) => p.online).length > 1
                  ? "sont connectés"
                  : "est connecté"}
              </>
            ) : (
              <>
                <i className="who-dot" aria-hidden="true" />
                Vous êtes seul pour l’instant
              </>
            )}
          </button>
        )}
        {(msg || err) && (
          <div key={toastTick} className={`toast ${err ? "bad" : "good"} pop`}>
            {err ?? msg}
          </div>
        )}
      </div>

      {/* Le bilan d'absence annonce parfois huit cultures perdues : il mérite
          d'être lu, donc acquitté, plutôt que de flotter sur la ferme. */}
      {resumeBanner && !err && (
        <div className="resume-backdrop" role="dialog" aria-modal="true">
          <div className="resume-card glass">
            <strong>Pendant votre absence</strong>
            <p>{resumeBanner}</p>
            <button type="button" className="accent" onClick={() => setResumeBanner(null)}>
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
              <dd>{Math.round(player.crd)} TRN</dd>
            </div>
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
            <dd>{SEASON_LABELS[season]}</dd>
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

      <aside className={panelClass("build-panel", "BUILD")} {...(isMobile ? sheetGesture : {})}>
        <h3>Construire</h3>
        <div className="build-list">
          {(Object.keys(BUILDING_DEFS) as BuildingType[]).map((t) => {
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
          })}
        </div>

        {(parcel?.buildings?.length ?? 0) > 0 && (
          <>
            <h3 className="spaced">Améliorer</h3>
            <div className="build-list">
              {(parcel?.buildings ?? []).map((b) => {
                const d = BUILDING_DEFS[b.type];
                const lvl = b.level ?? 1;
                const cost = buildingUpgradeCost(b.type, lvl);
                const next = lvl < MAX_BUILDING_LEVEL ? buildingLevelDef(lvl + 1) : null;
                const blocked = next ? player.level < next.requiredLevel : false;
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
                      ) : player.crd < cost ? (
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
                        className="sell-btn"
                        disabled={busy}
                        title={`Démolir et récupérer ${buildingResaleValue(b.type, lvl)} TRN`}
                        onClick={() => sellBuilding(b.id, d.name)}
                      >
                        Démolir {buildingResaleValue(b.type, lvl)}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </aside>

      <FieldDock
        tool={tool}
        brush={brush}
        isMobile={isMobile}
        isEta={visiting}
        visiting={visiting}
        busy={busy}
        selectedCount={selectedCells.length}
        readyCount={visiting ? Math.min(readyCellCount, visitOrder?.remaining ?? 0) : readyCellCount}
        stockTons={totalStockTons}
        crd={player.crd}
        directSeed={directSeed}
        contractor={visiting ? null : contractorOffer}
        laborQuote={laborQuote}
        objective={nextGoal}
        allGoalsDone={allGoalsDone}
        onTool={(t) => {
          const keep =
            (isPlantTool(tool) && isPlantTool(t)) || (isSoilTool(tool) && isSoilTool(t));
          setTool(t);
          if (!keep && t !== "BUILD") setSelectedCells([]);
        }}
        onBrush={setBrush}
        onDirectSeed={() => setDirectSeed((v) => !v)}
        onConfirm={runSelectionAction}
        onHarvestAll={harvestAll}
        mowSelected={selectedAreGrass}
        mowReadyAll={readyAreGrass}
        onContractor={callContractor}
        onPublishLabor={publishLaborOrder}
        onSell={() => {
          setMarketTab("SELL");
          setShowMarket(true);
        }}
        onMore={() => setSheet((cur) => (cur === "MORE" ? null : "MORE"))}
        moreOpen={sheet === "MORE"}
        hideQuest={isMobile}
        onGuide={() => setShowGuide(true)}
        desktopGarage={showGarage}
        desktopOffice={showEta}
        desktopHerd={showHerd}
        hasHerd={barns.length > 0}
        onDesktopGarage={() => setShowGarage((v) => !v)}
        onDesktopOffice={() => setShowEta((v) => !v)}
        onDesktopHerd={() => setShowHerd((v) => !v)}
        showDev={devEnabled}
        onDev={() => setShowDev(true)}
      />

      {(isMobile ? sheet === "GARAGE" : showGarage) && (
        <aside className={panelClass("garage-panel", "GARAGE")} {...(isMobile ? sheetGesture : {})}>
          <h3>Garage</h3>
          <p className="muted tiny">
            Graissez et nettoyez : la machine s’use moins et récolte un peu plus.
            Rafistoler ramène à mi-chemin, réviser remet à 100 %.
          </p>
          <ul className="list">
            {(player.farm?.machines ?? []).map((m) => {
              const def = MACHINE_DEFS[m.type as MachineType];
              const low = def ? m.condition < def.minCondition : m.condition < 15;
              const dirty = (m.dirt ?? 0) >= DIRT_DIRTY_THRESHOLD;
              const grease = m.grease ?? (m.greased === false ? 0 : GREASE_FULL);
              const greaseLow = grease < GREASE_OK;
              const greaseEmpty = grease <= 0;
              const panne = isBreakdownKind(m.breakdown) ? BREAKDOWN_LABELS[m.breakdown] : null;
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
              const canHalf = Boolean(halfQuote && halfQuote.points > 0.5 && m.condition < 99.5);
              const canFull = Boolean(fullQuote && fullQuote.points > 0.5 && m.condition < 99.5);
              return (
                <li key={m.id}>
                  <span>
                    <strong>{def?.name ?? m.type}</strong>
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
                      {grease >= GREASE_OK && !dirty && !panne ? " · nickel (+)" : ""}
                      {` · graisse ${Math.round(grease)} %`}
                      {greaseEmpty ? " · vide" : greaseLow ? " · à graisser" : ""}
                      {dirty ? " · sale" : ""}
                      {panne ? ` · panne ${panne}` : ""}
                      {m.storedInBuildingId ? " · hangar" : m.parkedParcelId ? " · parcelle" : ""}
                      {greaseLow ? " 💧" : ""}
                    </div>
                  </span>
                  <span className="row-actions">
                        <button
                          type="button"
                          disabled={busy || grease >= GREASE_FULL - 0.5}
                          title={`${GREASE_COST_CRD} TRN`}
                          onClick={() => setCare({ mode: "grease", machineId: m.id })}
                        >
                          Graisser
                        </button>
                        <button
                          type="button"
                          disabled={busy || (m.dirt ?? 0) < 8}
                          title={`${CLEAN_COST_CRD} TRN`}
                          onClick={() => setCare({ mode: "clean", machineId: m.id })}
                        >
                          Nettoyer
                        </button>
                    <button
                      type="button"
                      disabled={busy || !canHalf || (halfQuote != null && player.crd < halfQuote.cost)}
                      title={halfQuote ? `État → ${halfTarget.toFixed(0)} %` : ""}
                      onClick={() => repairMachine(m.id, "half")}
                    >
                      Rafistoler {halfQuote ? `${halfQuote.cost} TRN` : ""}
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canFull || (fullQuote != null && player.crd < fullQuote.cost)}
                      title="Révision complète"
                      onClick={() => repairMachine(m.id, "full")}
                    >
                      Réviser {fullQuote ? `${fullQuote.cost} TRN` : ""}
                    </button>
                    <button
                      type="button"
                      className="sell-btn"
                      disabled={busy}
                      title={`Reprise ${machineResaleValue(m.type as MachineType, m.condition)} TRN`}
                      onClick={() => sellMachine(m.id, def?.name ?? m.type)}
                    >
                      Vendre {machineResaleValue(m.type as MachineType, m.condition)}
                    </button>
                  </span>
                </li>
              );
            })}
            {(player.farm?.machines.length ?? 0) === 0 && (
              <li className="muted">Aucune machine</li>
            )}
          </ul>
          <h3 className="spaced">Acheter</h3>
          <div className="build-list">
            {(Object.keys(MACHINE_DEFS) as MachineType[]).map((t) => {
              const d = MACHINE_DEFS[t];
              return (
                <button
                  key={t}
                  type="button"
                  className="build-item art"
                  disabled={busy}
                  onClick={() => buyMachine(t)}
                >
                  <img className="build-art" src={MACHINE_ART[t]} alt="" loading="lazy" />
                  <span className="build-text">
                    <strong>{d.name}</strong>
                    <span>{d.cost} TRN</span>
                    <span className="muted tiny">{d.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      )}

      <MarketPanel
        open={showMarket}
        startTab={marketTab}
        forcedSaleNote={
          soldBanner && wheatInStock <= 0
            ? `Votre ${soldBanner.crop} a déjà été vendu (pas de silo). Il reste ${Math.round(player.crd)} TRN.`
            : null
        }
        onClose={() => {
          setShowMarket(false);
          setMarketTab("BUY");
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

      {(isMobile ? sheet === "HERD" : showHerd) && (
      <LivestockPanel
        className={panelClass("livestock-panel", "HERD")}
        gesture={isMobile ? sheetGesture : undefined}
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
        onSpreadManure={spreadManure}
        onSellManure={sellManure}
        hayTons={hayInStock}
        maizeTons={maizeInStock}
        barleyTons={barleyInStock}
        wheatTons={wheatInStock}
        onBuildPaddock={(yardType) => {
          setTool("BUILD");
          setBuildType(yardType);
          setSelectedCells([]);
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

      <TutorialOverlay open={showTutorial} onClose={() => setShowTutorial(false)} />
      <PlayGuide open={showGuide} snapshot={guideSnapshot} onClose={() => setShowGuide(false)} />

      {(isMobile ? sheet === "OFFICE" : showEta) && (
        <MissionsPanel
          className={panelClass("eta-panel", "OFFICE")}
          gesture={isMobile ? sheetGesture : undefined}
          busy={busy}
          onlinePlayers={onlinePlayers}
          visitName={visitOrder?.clientName ?? null}
          visitLeft={visitOrder?.remaining ?? null}
          helpWanted={laborBoard}
          myAsks={myPostedLabor}
          onAcceptHelp={(id) => void acceptLaborOrder(id)}
          onCancelAsk={(id) =>
            void api(`/labor-orders/${id}/cancel`, {
              method: "POST",
              body: JSON.stringify({ userId: player.id }),
            }).then(() => refreshMeta())
          }
          locked={Boolean(visitOrder)}
          zones={zones.filter(
            (z) =>
              ownedParcels.length === 0 ||
              ownedParcels.some((op) => op.zone?.code === z.code) ||
              z.parcels.some((p) => expandableParcelIds.has(p.id)),
          )}
          myFarmId={player.farm?.id}
          expandableIds={expandableParcelIds}
          onBuyField={buyAdjacent}
        />
      )}

      {isMobile && sheet === "MORE" && (
        <aside className={panelClass("more-panel", "MORE")} {...sheetGesture}>
          <h3>Plus</h3>
          <div className="more-list">
            {SHEET_TABS.map((t) => {
              const disabled = t.key === "HERD" && !barns.length;
              return (
                <button
                  key={t.key}
                  type="button"
                  className="more-item"
                  disabled={disabled}
                  title={disabled ? "Aucun bâtiment d’élevage sur la parcelle" : t.label}
                  onClick={() => setSheet(t.key)}
                >
                  <span aria-hidden="true">{t.icon}</span>
                  <strong>{t.label}</strong>
                  {tabBadge(alerts, t.key) > 0 && (
                    <span className="tab-badge" aria-label="à traiter">
                      {tabBadge(alerts, t.key)}
                    </span>
                  )}
                </button>
              );
            })}
            {devEnabled && (
              <button
                type="button"
                className="more-item"
                onClick={() => {
                  setSheet(null);
                  setShowDev(true);
                }}
              >
                <span aria-hidden="true">🛠</span>
                <strong>Test</strong>
              </button>
            )}
          </div>
        </aside>
      )}

      {isMobile && sheet && (
        <button
          type="button"
          className="sheet-scrim"
          aria-label="Fermer le panneau"
          onClick={() => setSheet(null)}
        />
      )}
    </div>
  );
}
