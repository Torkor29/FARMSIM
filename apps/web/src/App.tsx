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
  contractorQuote,
  isPaddockAdjacent,
  machineResaleValue,
  soilSummary,
  MAX_HARVESTS_BEFORE_PLOW,
  workAnimationMs,
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
  type CropCode,
  type BuildingType,
  type MachineType,
  type WeatherState,
  BREAKDOWN_LABELS,
  GREASE_COST_CRD,
  CLEAN_COST_CRD,
  DIRT_DIRTY_THRESHOLD,
  isBreakdownKind,
  suggestedRepairKind,
} from "@farmsim/shared";
import { AuthScreen } from "./AuthScreen";
import type { GrazingHerd, PreviewBuilding } from "./IsoFarmView";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { MachineCareOverlay, type CareMode } from "./MachineCareOverlay";
import { LivestockPanel, type BarnState } from "./LivestockPanel";
import { MarketPanel, type Listing, type FuturesContract } from "./MarketPanel";
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
import { isFieldWorkTool, isPlantTool, isSoilTool, type Tool } from "./tools";
import { useIsMobile } from "./use-media-query";
import { DevPanel, type DevGrant } from "./DevPanel";
import { NO_ALERTS, tabBadge, useAwayAlerts, useNotificationState, type FarmAlerts } from "./use-alerts";
import { ZoneMap } from "./ZoneMap";

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
};

type Contract = {
  id: string;
  jobType: string;
  title: string;
  rewardCrd: number;
  regionNote: string;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur API");
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
type SheetKey = "INFO" | "BUILD" | "GARAGE" | "OFFICE" | "HERD" | "PROFILE";

const SHEET_TABS: { key: SheetKey; label: string; icon: string }[] = [
  { key: "INFO", label: "Parcelle", icon: "🌾" },
  { key: "BUILD", label: "Bâtir", icon: "🏗️" },
  { key: "HERD", label: "Troupeau", icon: "🐄" },
  { key: "GARAGE", label: "Garage", icon: "🚜" },
  { key: "OFFICE", label: "Bureau", icon: "📋" },
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
}): string {
  const total = r.totalTons != null ? r.totalTons.toFixed(2) : "";
  if (!r.soldTons) return `Récolte ${total} t`;
  const money = r.soldRevenue ? ` · +${Math.round(r.soldRevenue)} CRD` : "";
  if (r.soldReason === "NO_SILO") {
    return `Récolte ${total} t vendue au négociant (pas de silo)${money}`;
  }
  return `Récolte ${total} t · ${r.soldTons.toFixed(2)} t vendues (silo plein)${money}`;
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
  const [showGarage, setShowGarage] = useState(true);
  const [weather, setWeather] = useState<WeatherSnap[]>([]);
  const [brush, setBrush] = useState<1 | 2 | 3>(1);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideFlags, setGuideFlags] = useState(() => readGuideFlags());
  const [pulseCells, setPulseCells] = useState<{ x: number; y: number }[]>([]);
  const [activeWork, setActiveWork] = useState<{
    type: MachineType;
    cells: { x: number; y: number }[];
  } | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [toastTick, setToastTick] = useState(0);
  const [worldContinents, setWorldContinents] = useState<WorldContinent[]>([]);
  const [continentDetail, setContinentDetail] = useState<ContinentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [barns, setBarns] = useState<BarnState[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
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

  const refreshMeta = useCallback(async () => {
    const [z, m, c, w] = await Promise.all([
      api<Zone[]>("/zones"),
      api<MarketPrice[]>("/market"),
      api<Contract[]>("/contracts"),
      api<WeatherSnap[]>("/weather"),
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
    setContracts((prev) => keepIfSame(prev, c));
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
      const money = dump.revenue ? ` · +${Math.round(dump.revenue)} CRD` : "";
      flashToast(
        dump.reason === "NO_SILO"
          ? `Grain vendu au négociant (pas de silo)${money}`
          : `Silo plein : ${dump.soldTons.toFixed(2)} t vendues au négociant${money}`,
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
      flashToast(`Engagé ${tons} t à ${r.pricePerTon.toFixed(0)} CRD/t`);
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
            ? ` · ${r.outcome.delta} CRD de mieux que le comptant`
            : ` · ${Math.abs(r.outcome.delta)} CRD de moins que le comptant`;
      flashToast(`Livré · +${r.revenue} CRD${verdict}`);
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
    const t = setInterval(beat, 60_000);
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

  // La criée bouge sans nous : d'autres joueurs déposent et achètent.
  useEffect(() => {
    if (!player) return;
    loadListings(player.id);
    loadFutures();
    const t = setInterval(() => {
      loadListings(player.id);
      loadFutures();
    }, 8000);
    return () => clearInterval(t);
  }, [player?.id, loadListings]);
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
    const machines = player?.farm?.machines ?? [];
    return cells.map((c) => {
      if (c.kind !== "VEHICLE" || !c.machineId) return c;
      const m = machines.find((x) => x.id === c.machineId);
      return {
        ...c,
        machineType: (m?.type as MachineType | undefined) ?? "TRACTOR",
      };
    });
  }, [parcel?.cells, player?.farm?.machines]);
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

  /** Troupeaux effectivement dehors, avec l'enclos vers lequel ils marchent. */
  const grazingHerds = useMemo((): GrazingHerd[] => {
    const all = parcel?.buildings ?? [];
    const now = Date.now();
    const out: GrazingHerd[] = [];
    for (const barn of barns) {
      const herd = barn.herd;
      if (!herd?.grazingUntil || herd.grazingUntil <= now) continue;
      const barnB = all.find((b) => b.id === barn.buildingId);
      if (!barnB) continue;
      const barnDef = BUILDING_DEFS[barnB.type];
      const barnBox = {
        originX: barnB.originX,
        originY: barnB.originY,
        w: barnDef.w,
        h: barnDef.h,
      };
      const paddockB = all.find((b) => {
        if (b.type !== "PADDOCK") return false;
        const d = BUILDING_DEFS.PADDOCK;
        return isPaddockAdjacent(barnBox, {
          originX: b.originX,
          originY: b.originY,
          w: d.w,
          h: d.h,
        });
      });
      if (!paddockB) continue;
      const pDef = BUILDING_DEFS.PADDOCK;
      out.push({
        buildingId: barn.buildingId,
        animals: herd.size,
        barn: barnBox,
        paddock: {
          originX: paddockB.originX,
          originY: paddockB.originY,
          w: pDef.w,
          h: pDef.h,
        },
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
      hasHarvested: guideFlags.harvested || cells.some((c) => c.hasStubble) || stock("WHEAT") + stock("MAIZE") + stock("PEA") > 0,
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
          : "Déchaumez pour le rendement, labourez pour repartir à neuf, ou semez direct.",
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
    if (tool !== "PLANT_WHEAT" && tool !== "PLANT_MAIZE" && tool !== "PLANT_PEA") return null;
    if (!selectedCells.length) return null;
    const crop: CropCode =
      tool === "PLANT_WHEAT" ? "WHEAT" : tool === "PLANT_MAIZE" ? "MAIZE" : "PEA";
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
      const crop = cell.crop ?? "?";
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
   * manque de CRD, mais le clic partait quand même et le serveur répondait
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

  /** Fin de l'installation guidée : métier + parcelle offerte. */
  async function claimStarterParcel(opts: {
    specialization: Specialization;
    parcelId: string;
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
      tool === "PLANT_WHEAT" ||
      tool === "PLANT_MAIZE" ||
      tool === "PLANT_PEA" ||
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
      const label =
        tool === "PLANT_WHEAT"
          ? "Blé"
          : tool === "PLANT_MAIZE"
            ? "Maïs"
            : tool === "FERTILIZE"
              ? "Ferti"
              : "Récolte";
      flashToast(`${label} · ${nextCount} case(s) sélectionnée(s)`);
      return;
    }

    if (tool === "BUILD") {
      const def = BUILDING_DEFS[buildType];
      if (!canPlaceBuildingAt(x, y)) {
        const reason =
          x + def.w > gw || y + def.h > gh
            ? "Emprise hors grille"
            : player.crd < def.cost
              ? `CRD insuffisants (${def.cost})`
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
        flashToast(`${def.name} placé · −${def.cost} CRD`);
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
  const contractorOffer = useMemo(() => {
    const work: FarmWork | null =
      tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE" || tool === "PLANT_PEA"
        ? "PLANT"
        : tool === "FERTILIZE"
          ? "FERTILIZE"
          : tool === "HARVEST"
            ? "HARVEST"
            : tool === "PLOW"
              ? "PLOW"
              : tool === "STUBBLE"
                ? "STUBBLE"
                : null;
    if (!work || !selectedCells.length) return null;
    const needed: MachineType =
      work === "HARVEST" ? "HARVESTER" : work === "STUBBLE" ? "DISC_HARROW" : "TRACTOR";
    const hasMachine = (player?.farm?.machines ?? []).some(
      (m) => m.type === needed && m.condition >= (MACHINE_DEFS[needed]?.minCondition ?? 12),
    );
    return { work, hasMachine, cost: contractorQuote(work, selectedCells.length) };
  }, [tool, selectedCells.length, player?.farm?.machines]);

  async function callContractor() {
    if (!player || !activeParcelId || !contractorOffer) return;
    setBusy(true);
    setErr(null);
    const workCells = selectedCells.slice();
    flashWork(contractorOffer.work === "HARVEST" ? "HARVESTER" : "TRACTOR", workCells);
    try {
      const r = await api<{ cost: number; cells: number; totalTons?: number }>(
        `/parcels/${activeParcelId}/contractor`,
        {
          method: "POST",
          body: JSON.stringify({
            userId: player.id,
            work: contractorOffer.work,
            crop: tool === "PLANT_MAIZE" ? "MAIZE" : tool === "PLANT_WHEAT" ? "WHEAT" : undefined,
            cells: workCells,
          }),
        },
      );
      const tons = r.totalTons ? ` · ${r.totalTons.toFixed(2)} t` : "";
      flashToast(`ETA : ${WORK_LABELS[contractorOffer.work]} ×${r.cells}${tons} · −${r.cost} CRD`);
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

  function flashWork(type: MachineType, cells: { x: number; y: number }[]) {
    setPulseCells(cells);
    setActiveWork({ type, cells });
    // Un peu de marge sur la durée du parcours : l'engin doit atteindre la
    // dernière case avant qu'on ne l'efface.
    window.setTimeout(() => {
      setPulseCells([]);
      setActiveWork(null);
    }, workAnimationMs(cells.length) + 250);
  }

  async function runWorkOnCells(cells: { x: number; y: number }[]) {
    if (!player || !activeParcelId || !cells.length || busy) return;
    setBusy(true);
    setErr(null);
    const workCells = cells.slice();
    flashWork(workMachineForTool(tool), workCells);
    try {
      if (tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE" || tool === "PLANT_PEA") {
        const crop: CropCode =
          tool === "PLANT_WHEAT" ? "WHEAT" : tool === "PLANT_MAIZE" ? "MAIZE" : "PEA";
        const r = await api<{
          machine?: {
            wearApplied: number;
            condition: number;
            type: string;
            broke?: boolean;
            breakdown?: string | null;
          };
        }>(`/parcels/${activeParcelId}/plant`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, crop, cells: workCells, directSeed }),
        });
        setMsg(
          `Semé ${crop} ×${workCells.length}${directSeed ? " en direct" : ""}` + wearNote(r.machine),
        );
      } else if (tool === "FERTILIZE") {
        const r = await api<{
          machine?: {
            condition: number;
            type: string;
            broke?: boolean;
            breakdown?: string | null;
          };
        }>(`/parcels/${activeParcelId}/fertilize`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: workCells }),
        });
        setMsg("Fertilisé" + wearNote(r.machine));
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
          soldReason?: "NO_SILO" | "SILO_FULL" | null;
        }>(`/parcels/${activeParcelId}/harvest`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: workCells }),
        });
        const lost = r.lostCells ? ` · ${r.lostCells} perdue(s)` : "";
        setMsg(harvestGrainNote(r) + lost + wearNote(r.machine));
        markGuideFlag("harvested");
        if (r.soldTons) markGuideFlag("sold");
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
          `Labouré ×${r.plowed} · −${r.cost} CRD${fertNote} · sol remis à zéro` + wearNote(r.machine),
        );
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
        }>(`/parcels/${activeParcelId}/stubble`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: workCells }),
        });
        setMsg(
          `Déchaumé ×${r.stubbled} · −${r.cost} CRD · +${Math.round(r.nextBonus * 100)} % sur la prochaine récolte` +
            wearNote(r.machine),
        );
      }
      setSelectedCells([]);
      await refreshPlayer();
      await loadParcel(activeParcelId);
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
      const readyCells =
        (parcelDetail?.cellSims ?? [])
          .filter((s) => s.sim.ready)
          .map((s) => ({ x: s.x, y: s.y })) || [];
      if (readyCells.length) flashWork("HARVESTER", readyCells);
      const r = await api<{
        totalTons: number;
        soldTons?: number;
        soldRevenue?: number;
        soldReason?: "NO_SILO" | "SILO_FULL" | null;
      }>(`/parcels/${activeParcelId}/harvest`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setMsg(harvestGrainNote(r));
      markGuideFlag("harvested");
      if (r.soldTons) markGuideFlag("sold");
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
      flashToast(`Négociant : ${tons.toFixed(2)} t · +${r.revenue} CRD`);
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
      flashToast(`Lot déposé à la criée · frais ${r.fee} CRD`);
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
      flashToast(`Acheté ${r.bought.toFixed(2)} t · −${r.paid} CRD`);
      await refreshPlayer();
      await loadListings(player.id);
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
      flashToast(`${r.bought} t de fourrage · −${r.cost} CRD`);
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
      setMsg(`Vendu pour ${r.revenue} CRD`);
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
        `Séché (−${(r.reduction * 100).toFixed(0)} pts) · ${(r.moisture * 100).toFixed(0)} % · −${r.cost} CRD`,
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
      const r = await api<{ reward: number; machine?: { type: string; condition: number; wearApplied: number } }>(
        `/contracts/${id}/accept`,
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
      setMsg(`Mission +${r.reward} CRD${wearNote}`);
      markGuideFlag("contract");
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
      flashToast(`Niveau ${r.building.level} · ${r.levelName} — ${r.cost} CRD`);
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
      flashToast(`+${r.added} bête(s) · −${r.cost} CRD`);
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
  async function feedHerd(herdId: string, useMaize: boolean) {
    if (!player) return;
    setBusy(true);
    try {
      const barn = barns.find((b) => b.herd?.id === herdId);
      const size = barn?.herd?.size ?? 1;
      // Une tonne couvre une bête pendant environ 70 cycles : on vise large
      // sans vider le silo.
      const wanted = Math.max(1, Math.ceil(size / 3));
      const stock = useMaize ? maizeInStock : hayInStock;
      const tons = Math.min(stock, wanted);
      const r = await api<{ units: number; quality: number }>(`/herds/${herdId}/feed`, {
        method: "POST",
        body: JSON.stringify({
          userId: player.id,
          hayTons: useMaize ? 0 : tons,
          maizeTons: useMaize ? tons : 0,
        }),
      });
      flashToast(
        `${useMaize ? "Maïs" : "Fourrage"} distribué · ${tons.toFixed(1)} t · ${r.units} kg`,
      );
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
      flashToast(`${label} vendu · +${r.value} CRD`);
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
      flashToast(`${label} démoli · +${r.value} CRD`);
      await refreshPlayer();
      if (activeParcelId) await loadParcel(activeParcelId);
    } catch (e) {
      flashToast(e instanceof Error ? e.message : String(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function repairMachine(id: string) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ condition: number; cost: number }>(`/machines/${id}/repair`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      await refreshPlayer();
      setMsg(`Réparé → ${r.condition.toFixed(0)}% (−${r.cost} CRD)`);
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
        setMsg(`Graissé · −${r.cost} CRD`);
      } else if (care.mode === "clean") {
        const r = await api<{ cost: number }>(`/machines/${care.machineId}/clean`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id }),
        });
        setMsg(`Nettoyé · −${r.cost} CRD`);
      } else {
        const kind = care.kind ?? "BELT";
        const r = await api<{ condition: number; cost: number }>(`/machines/${care.machineId}/service`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, kind }),
        });
        setMsg(`Réparé → ${r.condition.toFixed(0)}% (−${r.cost} CRD)`);
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
    <div className={`game-stage${isMobile ? " mobile" : ""}`}>
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
              weather={localWeather}
              strokeWork={player.specialization === "ETA" && isFieldWorkTool(tool)}
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
            <span className="gold">{Math.round(player.crd)} CRD</span>
            {player.bonuses && (
              <span className="stat-bonus">
                grain {player.bonuses.storageGrain}t · +
                {Math.round(player.bonuses.yieldBonus * 100)}%
              </span>
            )}
            {/* Au téléphone, tout ce qui précède sauf les CRD passe dans un
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
                {m.commodity} {m.price.toFixed(1)}
                <small>
                  {delta > 0.05 ? " ▲" : delta < -0.05 ? " ▼" : " ·"}
                  {Math.abs(delta) > 0.05 ? Math.abs(delta).toFixed(1) : ""}
                </small>
              </span>
            );
          })}
          <span className="tick weather-tick">{weatherLabel}</span>
        </div>
      </div>

      {(msg || err) && (
        <div key={toastTick} className={`toast ${err ? "bad" : "good"} pop`}>{err ?? msg}</div>
      )}

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
              <dd>{Math.round(player.crd)} CRD</dd>
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
                    {d.w}×{d.h} · {d.cost} CRD
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
                        <span className="upgrade-locked poor">{cost} CRD</span>
                      ) : (
                        <button
                          type="button"
                          className="upgrade-btn"
                          disabled={busy}
                          title={`Passer au niveau ${lvl + 1} — ${buildingLevelDef(lvl + 1).name}`}
                          onClick={() => upgradeBuilding(b.id)}
                        >
                          ↑ {cost} CRD
                        </button>
                      )}
                      <button
                        type="button"
                        className="sell-btn"
                        disabled={busy}
                        title={`Démolir et récupérer ${buildingResaleValue(b.type, lvl)} CRD`}
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
        isEta={player.specialization === "ETA"}
        busy={busy}
        selectedCount={selectedCells.length}
        readyCount={readyCellCount}
        stockTons={totalStockTons}
        crd={player.crd}
        directSeed={directSeed}
        contractor={contractorOffer}
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
        onContractor={callContractor}
        onSell={() => setShowMarket(true)}
        onGuide={() => setShowGuide(true)}
        desktopGarage={showGarage}
        desktopOffice={showEta}
        onDesktopGarage={() => setShowGarage((v) => !v)}
        onDesktopOffice={() => setShowEta((v) => !v)}
        showDev={devEnabled}
        onDev={() => setShowDev(true)}
      />

      {(isMobile ? sheet === "GARAGE" : showGarage) && (
        <aside className={panelClass("garage-panel", "GARAGE")} {...(isMobile ? sheetGesture : {})}>
          <h3>Garage</h3>
          <p className="muted tiny">
            {player.specialization === "ETA"
              ? "Graissez avant de partir, soufflez en rentrant. Une panne se répare à la main."
              : "Semis / ferti → tracteur · Récolte → moissonneuse. Usure à chaque case."}
          </p>
          <ul className="list">
            {(player.farm?.machines ?? []).map((m) => {
              const def = MACHINE_DEFS[m.type as MachineType];
              const low = def ? m.condition < def.minCondition : m.condition < 12;
              const dirty = (m.dirt ?? 0) >= DIRT_DIRTY_THRESHOLD;
              const panne = isBreakdownKind(m.breakdown) ? BREAKDOWN_LABELS[m.breakdown] : null;
              const eta = player.specialization === "ETA";
              return (
                <li key={m.id}>
                  <span>
                    <strong>{def?.name ?? m.type}</strong>
                    <div className={`muted tiny ${low || panne ? "warn" : ""}`}>
                      État {m.condition.toFixed(0)}%
                      {m.greased === false ? " · pas graissé" : ""}
                      {dirty ? " · sale" : ""}
                      {panne ? ` · panne ${panne}` : ""}
                      {m.storedInBuildingId ? " · hangar" : m.parkedParcelId ? " · parcelle" : ""}
                    </div>
                  </span>
                  <span className="row-actions">
                    {eta ? (
                      <>
                        <button
                          type="button"
                          disabled={busy || (m.greased !== false && (m.greaseSkipStreak ?? 0) === 0)}
                          title={`${GREASE_COST_CRD} CRD`}
                          onClick={() => setCare({ mode: "grease", machineId: m.id })}
                        >
                          Graisser
                        </button>
                        <button
                          type="button"
                          disabled={busy || (m.dirt ?? 0) < 8}
                          title={`${CLEAN_COST_CRD} CRD`}
                          onClick={() => setCare({ mode: "clean", machineId: m.id })}
                        >
                          Nettoyer
                        </button>
                        <button
                          type="button"
                          disabled={busy || (!panne && m.condition >= 99.5)}
                          onClick={() =>
                            setCare({
                              mode: "repair",
                              machineId: m.id,
                              kind: suggestedRepairKind(m.breakdown, m.condition),
                            })
                          }
                        >
                          Réparer
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || m.condition >= 99.5}
                        onClick={() => repairMachine(m.id)}
                      >
                        Réparer
                      </button>
                    )}
                    <button
                      type="button"
                      className="sell-btn"
                      disabled={busy}
                      title={`Reprise ${machineResaleValue(m.type as MachineType, m.condition)} CRD`}
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
                    <span>{d.cost} CRD</span>
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
        onClose={() => setShowMarket(false)}
        stock={player.farm?.inventory ?? []}
        listings={listings}
        marketPrices={market}
        crd={player.crd}
        busy={busy}
        onSellDealer={sellToDealer}
        onSellMarket={sell}
        onList={createListing}
        onBuyListing={buyListing}
        onCancelListing={cancelListing}
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

      <LivestockPanel
        className={panelClass("livestock-panel", "HERD")}
        barns={barns}
        busy={busy}
        crd={player.crd}
        onBuyAnimals={buyAnimals}
        onGraze={grazeHerd}
        onFeed={feedHerd}
        onMilk={milkHerd}
        onSlaughter={slaughterHerd}
        hayTons={hayInStock}
        maizeTons={maizeInStock}
        onBuildPaddock={(yardType) => {
          setTool("BUILD");
          setBuildType(yardType);
          setSelectedCells([]);
          flashToast(
            yardType === "PIG_YARD"
              ? "Posez la courette contre un bord de la porcherie"
              : "Posez l’enclos contre un bord de l’étable",
          );
        }}
      />

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
        <aside className={panelClass("eta-panel", "OFFICE")} {...(isMobile ? sheetGesture : {})}>
          <h3>Travaux à façon</h3>
          <p className="muted tiny">
            Vous partez travailler chez d’autres exploitants avec votre matériel.
            C’est le métier d’une ETA — Entreprise de Travaux Agricoles.
          </p>
          <ul className="list">
            {contracts.map((c) => (
              <li key={c.id}>
                <span>
                  <strong>{c.title}</strong>
                  <div className="muted tiny">
                    {c.jobType} · {c.rewardCrd} CRD
                  </div>
                </span>
                <button type="button" disabled={busy} onClick={() => acceptContract(c.id)}>
                  Faire
                </button>
              </li>
            ))}
          </ul>
          <h3 className="spaced">Expansion</h3>
          {/* zone-map-ui: expansion */}
          <div className="zone-maps">
            {zones
              .filter(
                (z) =>
                  ownedParcels.length === 0 ||
                  ownedParcels.some((op) => op.zone?.code === z.code) ||
                  z.parcels.some((p) => expandableParcelIds.has(p.id)),
              )
              .map((z) => (
                <ZoneMap
                  key={z.id}
                  zone={z}
                  myFarmId={player.farm?.id}
                  selectableIds={expandableParcelIds}
                  onSelect={buyAdjacent}
                  compact
                />
              ))}
          </div>
          {expandableParcelIds.size === 0 ? (
            <p className="muted tiny">Aucune parcelle adjacente libre.</p>
          ) : null}
          <h3 className="spaced">Stock / marché</h3>
          <ul className="list">
            {(player.farm?.inventory ?? []).map((i) => {
              const moistPct = Math.round((i.moisture ?? 0) * 100);
              const canDry = (i.moisture ?? 0) > 0.1 && i.qty > 0;
              return (
                <li key={i.id}>
                  <span>
                    {i.itemCode} · {i.qty.toFixed(2)} t
                    <div className={`muted tiny ${moistPct > 14 ? "warn" : ""}`}>
                      Humidité {moistPct} % · q{i.quality}
                      {player.bonuses?.softDryer ? " · séchoir" : ""}
                    </div>
                  </span>
                  <span className="row-actions">
                    <button type="button" disabled={busy || !canDry} onClick={() => dryStock(i.id)}>
                      Sécher
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => sell(i.itemCode as CropCode, i.qty)}
                    >
                      Vendre
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <ul className="list">
            {market.map((m) => (
              <li key={m.commodity}>
                <span>
                  {m.commodity} · {m.price.toFixed(1)} CRD/t
                </span>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {isMobile && (
        <>
          {/* Un voile referme le tiroir d'une tape hors de lui : sur un
              téléphone, chercher la bonne croix est une corvée. */}
          {sheet && (
            <button
              type="button"
              className="sheet-scrim"
              aria-label="Fermer le panneau"
              onClick={() => setSheet(null)}
            />
          )}
          <nav className="tabbar" aria-label="Panneaux">
            {SHEET_TABS.map((t) => {
              const disabled = t.key === "HERD" && !barns.length;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`tab${sheet === t.key ? " on" : ""}`}
                  disabled={disabled}
                  title={disabled ? "Aucun bâtiment d’élevage sur la parcelle" : t.label}
                  aria-pressed={sheet === t.key}
                  onClick={() => setSheet((cur) => (cur === t.key ? null : t.key))}
                >
                  <span aria-hidden="true">{t.icon}</span>
                  <span className="tab-label">{t.label}</span>
                  {tabBadge(alerts, t.key) > 0 && (
                    <span className="tab-badge" aria-label="à traiter">
                      {tabBadge(alerts, t.key)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </>
      )}
    </div>
  );
}
