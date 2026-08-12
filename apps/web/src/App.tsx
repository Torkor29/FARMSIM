import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type FarmWork,
  type RipenessStage,
  PARCEL_HECTARES,
  SEASON_LABELS,
  WEATHER_LABELS,
  currentSeason,
  footprintCells,
  type Specialization,
  type CropCode,
  type BuildingType,
  type MachineType,
  type WeatherState,
} from "@farmsim/shared";
import { ArrivalTransition } from "./ArrivalTransition";
import { AuthScreen } from "./AuthScreen";
import {
  IsoFarmView,
  type GrazingHerd,
  type PreviewBuilding,
} from "./IsoFarmView";
import { LivestockPanel, type BarnState } from "./LivestockPanel";
import {
  Onboarding,
  type ContinentDetail,
  type WorldContinent,
} from "./Onboarding";
import { SplashScreen } from "./SplashScreen";
import { TutorialOverlay, TUTORIAL_KEY } from "./TutorialOverlay";
import { ZoneMap } from "./ZoneMap";

const API = "/api";
const TOKEN_KEY = "farmsim_token";

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

type Tool =
  | "SELECT"
  | "PLANT_WHEAT"
  | "PLANT_MAIZE"
  | "FERTILIZE"
  | "HARVEST"
  | "STUBBLE"
  | "PLOW"
  | "BUILD"
  | "PARK";

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

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("farmsim_player");
}

const ACTION_BAR: { tool: Tool; label: string; icon: string }[] = [
  { tool: "SELECT", label: "Inspect", icon: "/assets/icons/tools/select.svg" },
  { tool: "PLANT_WHEAT", label: "Semer", icon: "/assets/icons/tools/plant.svg" },
  { tool: "FERTILIZE", label: "Ferti", icon: "/assets/icons/tools/fertilize.svg" },
  { tool: "HARVEST", label: "Récolte", icon: "/assets/icons/tools/harvest.svg" },
  { tool: "BUILD", label: "Bâtir", icon: "/assets/icons/tools/build.svg" },
  { tool: "STUBBLE", label: "Déchaum.", icon: "/assets/icons/tools/stubble.svg" },
  { tool: "PLOW", label: "Labour", icon: "/assets/icons/tools/plow.svg" },
  { tool: "PARK", label: "Park", icon: "/assets/icons/tools/park.svg" },
];

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
  const [buildType, setBuildType] = useState<BuildingType>("SILO");
  const [selectedCells, setSelectedCells] = useState<{ x: number; y: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEta, setShowEta] = useState(false);
  const [showGarage, setShowGarage] = useState(true);
  const [weather, setWeather] = useState<WeatherSnap[]>([]);
  const [brush, setBrush] = useState<1 | 2 | 3>(1);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
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
    setZones(z);
    setMarket(m);
    setContracts(c);
    setWeather(w);
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
    setPlayer(me.player);
    if (!activeParcelId && me.player.farm?.parcels[0]) {
      setActiveParcelId(me.player.farm.parcels[0].id);
    }
    return me.player;
  }, [activeParcelId]);

  const loadLivestock = useCallback(async (parcelId: string) => {
    try {
      const r = await api<{ barns: BarnState[] }>(`/parcels/${parcelId}/livestock`);
      setBarns(r.barns);
    } catch {
      setBarns([]);
    }
  }, []);

  const loadParcel = useCallback(async (id: string) => {
    const d = await api<typeof parcelDetail>(`/parcels/${id}`);
    setParcelDetail(d);
  }, []);

  useEffect(() => {
    refreshMeta().catch((e) => setErr(String(e.message ?? e)));
    loadWorld().catch(() => undefined);
    const t = setInterval(() => {
      refreshMeta().catch(() => undefined);
    }, 10000);
    return () => clearInterval(t);
  }, [refreshMeta, loadWorld]);

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
          : "Déchaumez pour gagner du rendement, ou labourez pour repartir à neuf.",
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

  function flashToast(text: string, isError = false) {
    if (isError) setErr(text);
    else {
      setErr(null);
      setMsg(text);
    }
    setToastTick((n) => n + 1);
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

  function canPlaceBuildingAt(x: number, y: number): boolean {
    const def = BUILDING_DEFS[buildType];
    if (x + def.w > gw || y + def.h > gh) return false;
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
      tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE"
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
    if (t === "FERTILIZE") {
      const hasSpreader = player?.farm?.machines.some((m) => m.type === "SPREADER");
      return hasSpreader ? "SPREADER" : "TRACTOR";
    }
    return "TRACTOR";
  }

  function flashWork(type: MachineType, cells: { x: number; y: number }[]) {
    setPulseCells(cells);
    setActiveWork({ type, cells });
    window.setTimeout(() => {
      setPulseCells([]);
      setActiveWork(null);
    }, 900);
  }

  async function runSelectionAction() {
    if (!player || !activeParcelId || !selectedCells.length) return;
    setBusy(true);
    setErr(null);
    const workCells = selectedCells.slice();
    flashWork(workMachineForTool(tool), workCells);
    try {
      if (tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE") {
        const crop: CropCode = tool === "PLANT_WHEAT" ? "WHEAT" : "MAIZE";
        const r = await api<{ machine?: { wearApplied: number; condition: number; type: string } }>(
          `/parcels/${activeParcelId}/plant`,
          {
            method: "POST",
            body: JSON.stringify({ userId: player.id, crop, cells: selectedCells }),
          },
        );
        setMsg(
          `Semé ${crop} ×${selectedCells.length}` +
            (r.machine ? ` · ${r.machine.type} ${r.machine.condition.toFixed(0)}%` : ""),
        );
      } else if (tool === "FERTILIZE") {
        const r = await api<{ machine?: { condition: number; type: string } }>(
          `/parcels/${activeParcelId}/fertilize`,
          {
            method: "POST",
            body: JSON.stringify({ userId: player.id, cells: selectedCells }),
          },
        );
        setMsg(
          "Fertilisé" + (r.machine ? ` · ${r.machine.type} ${r.machine.condition.toFixed(0)}%` : ""),
        );
      } else if (tool === "HARVEST") {
        const r = await api<{
          machine?: { condition: number; type: string };
          totalTons?: number;
          lostCells?: number;
        }>(`/parcels/${activeParcelId}/harvest`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: selectedCells }),
        });
        const lost = r.lostCells ? ` · ${r.lostCells} perdue(s)` : "";
        setMsg(
          `Récolte ${r.totalTons?.toFixed(2) ?? ""} t${lost}` +
            (r.machine ? ` · ${r.machine.type} ${r.machine.condition.toFixed(0)}%` : ""),
        );
      } else if (tool === "PLOW") {
        const r = await api<{
          plowed: number;
          cost: number;
          fertilityDelta: number;
        }>(`/parcels/${activeParcelId}/plow`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: selectedCells }),
        });
        const fert = r.fertilityDelta;
        const fertNote =
          Math.abs(fert) < 0.0005
            ? ""
            : ` · fertilité ${fert > 0 ? "+" : "−"}${Math.abs(fert * 100).toFixed(1)} pt`;
        setMsg(`Labouré ×${r.plowed} · −${r.cost} CRD${fertNote} · sol remis à zéro`);
      } else if (tool === "STUBBLE") {
        const r = await api<{
          stubbled: number;
          cost: number;
          nextBonus: number;
        }>(`/parcels/${activeParcelId}/stubble`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: selectedCells }),
        });
        setMsg(
          `Déchaumé ×${r.stubbled} · −${r.cost} CRD · +${Math.round(r.nextBonus * 100)} % sur la prochaine récolte`,
        );
      }
      setSelectedCells([]);
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

  async function harvestAll() {
    if (!player || !activeParcelId) return;
    setBusy(true);
    try {
      const readyCells =
        (parcelDetail?.cellSims ?? [])
          .filter((s) => s.sim.ready)
          .map((s) => ({ x: s.x, y: s.y })) || [];
      if (readyCells.length) flashWork("HARVESTER", readyCells);
      const r = await api<{ totalTons: number }>(`/parcels/${activeParcelId}/harvest`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setMsg(`Récolte totale ${r.totalTons.toFixed(2)} t`);
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

  async function sell(commodity: CropCode, tons: number) {
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

  async function sellMachine(id: string, label: string) {
    if (!player) return;
    if (!window.confirm(`Vendre ${label} ? Cette action est définitive.`)) return;
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

  async function sellBuilding(id: string, label: string) {
    if (!player) return;
    if (!window.confirm(`Démolir ${label} ? Cette action est définitive.`)) return;
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
    );
  }

  if (showArrival) {
    return (
      <ArrivalTransition
        continents={worldContinents}
        continentCode={homeContinentCode}
        regionName={zoneName}
        cityName={homeCity}
        onDone={() => setShowArrival(false)}
      />
    );
  }

  return (
    <div className="game-stage">
      <div className="iso-layer">
        {parcel ? (
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
            onCellClick={applyToolOnCell}
            onCellHover={setHoverCell}
          />
        ) : (
          <div className="iso-viewport empty-farm">
            <p>Achetez une parcelle pour ouvrir la grille {gw}×{gh}.</p>
          </div>
        )}
      </div>

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
            title="Tutoriel"
            aria-label="Ouvrir le tutoriel"
            onClick={() => setShowTutorial(true)}
          >
            ?
          </button>
        </div>
        <div className="hud-stats">
          <span>{player.displayName}</span>
          <span>{SPECIALIZATION_LABELS[player.specialization]}</span>
          <span className="stat-xp" title="Niveau / expérience">
            Nv.{player.level} · {player.xp} XP
          </span>
          <span className="gold">{Math.round(player.crd)} CRD</span>
          {player.bonuses && (
            <span>
              grain {player.bonuses.storageGrain}t · +
              {Math.round(player.bonuses.yieldBonus * 100)}%
            </span>
          )}
          <button
            className="ghost"
            type="button"
            onClick={() => {
              clearSession();
              setPlayer(null);
              setParcelDetail(null);
              setResumeBanner(null);
              setActiveParcelId(null);
            }}
          >
            Déconnexion
          </button>
        </div>
      </header>

      {(msg || err) && (
        <div key={toastTick} className={`toast ${err ? "bad" : "good"} pop`}>{err ?? msg}</div>
      )}
      {resumeBanner && !err && (
        <div className="resume-banner glass">
          <strong>Pendant votre absence</strong>
          <p>{resumeBanner}</p>
          <button type="button" className="ghost" onClick={() => setResumeBanner(null)}>
            OK
          </button>
        </div>
      )}

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

      <aside className="glass geo-panel">
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

      <aside className="glass build-panel">
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

      <div className="action-bar">
        <div className="brush-group" title="Taille du pinceau">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={brush === n ? "action on" : "action"}
              onClick={() => setBrush(n)}
            >
              {n}×{n}
            </button>
          ))}
        </div>
        {ACTION_BAR.map(({ tool: t, label, icon }) => (
          <button
            key={t}
            type="button"
            className={`action icon-action ${tool === t || (t === "BUILD" && tool === "BUILD") ? "on" : ""}`}
            title={label}
            aria-label={label}
            onClick={() => {
              if (t === "BUILD") {
                setTool("BUILD");
                return;
              }
              setTool(t);
              setSelectedCells([]);
            }}
          >
            <img src={icon} alt="" width={22} height={22} />
            <span className="action-label">{label}</span>
          </button>
        ))}
        <button
          type="button"
          className={`action ${showGarage ? "on" : ""}`}
          onClick={() => setShowGarage((v) => !v)}
        >
          Garage
        </button>
        <button
          type="button"
          className={`action eta ${showEta ? "on" : ""}`}
          title="Stock, marché, contrats et achat de terres"
          onClick={() => setShowEta((v) => !v)}
        >
          Bureau
        </button>
        {(tool === "PLANT_WHEAT" ||
          tool === "PLANT_MAIZE" ||
          tool === "FERTILIZE" ||
          tool === "HARVEST" ||
          tool === "STUBBLE" ||
          tool === "PLOW") && (
          <>
            <button
              type="button"
              className="action accent"
              disabled={busy || !selectedCells.length}
              onClick={runSelectionAction}
            >
              OK ×{selectedCells.length}
            </button>
            {tool === "PLANT_WHEAT" && (
              <button type="button" className="action" onClick={() => setTool("PLANT_MAIZE")}>
                Maïs
              </button>
            )}
            {tool === "PLANT_MAIZE" && (
              <button type="button" className="action" onClick={() => setTool("PLANT_WHEAT")}>
                Blé
              </button>
            )}
            {contractorOffer && (
              <button
                type="button"
                className="action contractor"
                disabled={busy || !selectedCells.length || player.crd < contractorOffer.cost}
                title={
                  contractorOffer.hasMachine
                    ? `Sous-traiter à une ETA — ${contractorOffer.cost} CRD`
                    : `Vous n'avez pas la machine : une ETA fait le travail pour ${contractorOffer.cost} CRD`
                }
                onClick={callContractor}
              >
                🚜 ETA · {contractorOffer.cost} CRD
              </button>
            )}
          </>
        )}
        <button type="button" className="action" disabled={busy} onClick={harvestAll}>
          Tout récolter
        </button>
      </div>

      {showGarage && (
        <aside className="glass garage-panel">
          <h3>Garage</h3>
          <p className="muted tiny">
            Semis / ferti → tracteur · Récolte → moissonneuse. Usure à chaque case.
          </p>
          <ul className="list">
            {(player.farm?.machines ?? []).map((m) => {
              const def = MACHINE_DEFS[m.type as MachineType];
              const low = def ? m.condition < def.minCondition : m.condition < 12;
              return (
                <li key={m.id}>
                  <span>
                    <strong>{def?.name ?? m.type}</strong>
                    <div className={`muted tiny ${low ? "warn" : ""}`}>
                      État {m.condition.toFixed(0)}%
                      {m.storedInBuildingId ? " · hangar" : m.parkedParcelId ? " · parcelle" : ""}
                    </div>
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      disabled={busy || m.condition >= 99.5}
                      onClick={() => repairMachine(m.id)}
                    >
                      Réparer
                    </button>
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

      <LivestockPanel
        barns={barns}
        busy={busy}
        crd={player.crd}
        onBuyAnimals={buyAnimals}
        onGraze={grazeHerd}
        onBuildPaddock={() => {
          setTool("BUILD");
          setBuildType("PADDOCK");
          setSelectedCells([]);
          flashToast("Posez l’enclos contre un bord de l’étable");
        }}
      />

      <TutorialOverlay open={showTutorial} onClose={() => setShowTutorial(false)} />

      {showEta && (
        <aside className="glass eta-panel">
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
    </div>
  );
}
