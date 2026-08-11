import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SPECIALIZATION_LABELS,
  BUILDING_DEFS,
  PARCEL_HECTARES,
  type Specialization,
  type CropCode,
  type BuildingType,
} from "@farmsim/shared";
import { IsoFarmView } from "./IsoFarmView";

const API = "/api";

type Cell = {
  id: string;
  x: number;
  y: number;
  kind: "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";
  crop?: CropCode | null;
  fieldStage?: string;
  fertilizedPasses?: number;
  buildingId?: string | null;
  machineId?: string | null;
};

type Building = {
  id: string;
  type: BuildingType;
  originX: number;
  originY: number;
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
  zone?: { code: string; name: string; koppen: string };
  cells?: Cell[];
  buildings?: Building[];
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
      parkedParcelId?: string | null;
      storedInBuildingId?: string | null;
    }[];
    inventory: { id: string; itemCode: string; qty: number; quality: number }[];
  } | null;
  bonuses?: {
    yieldBonus: number;
    storageGrain: number;
    storageHay: number;
    machineSlots: number;
    cattleSlots: number;
    pigSlots: number;
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

type Tool = "SELECT" | "PLANT_WHEAT" | "PLANT_MAIZE" | "FERTILIZE" | "HARVEST" | "BUILD" | "PARK";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur API");
  return data as T;
}

const ACTION_BAR: [Tool, string][] = [
  ["SELECT", "Inspect"],
  ["PLANT_WHEAT", "Semer"],
  ["FERTILIZE", "Ferti"],
  ["HARVEST", "Récolte"],
  ["BUILD", "Bâtir"],
  ["PARK", "Park"],
];

export function App() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [market, setMarket] = useState<MarketPrice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [player, setPlayer] = useState<Player | null>(() => {
    const raw = localStorage.getItem("farmsim_player");
    return raw ? (JSON.parse(raw) as Player) : null;
  });
  const [spe, setSpe] = useState<Specialization>("CEREALIER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [activeParcelId, setActiveParcelId] = useState<string | null>(null);
  const [parcelDetail, setParcelDetail] = useState<{
    parcel: Parcel;
    bonuses: Player["bonuses"];
    cellSims: { x: number; y: number; sim: { progress: number; ready: boolean } }[];
  } | null>(null);
  const [tool, setTool] = useState<Tool>("SELECT");
  const [buildType, setBuildType] = useState<BuildingType>("SILO");
  const [selectedCells, setSelectedCells] = useState<{ x: number; y: number }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showEta, setShowEta] = useState(false);

  const refreshMeta = useCallback(async () => {
    const [z, m, c] = await Promise.all([
      api<Zone[]>("/zones"),
      api<MarketPrice[]>("/market"),
      api<Contract[]>("/contracts"),
    ]);
    setZones(z);
    setMarket(m);
    setContracts(c);
  }, []);

  const refreshPlayer = useCallback(async (id: string) => {
    const p = await api<Player>(`/players/${id}`);
    setPlayer(p);
    localStorage.setItem("farmsim_player", JSON.stringify(p));
    if (!activeParcelId && p.farm?.parcels[0]) {
      setActiveParcelId(p.farm.parcels[0].id);
    }
    return p;
  }, [activeParcelId]);

  const loadParcel = useCallback(async (id: string) => {
    const d = await api<typeof parcelDetail>(`/parcels/${id}`);
    setParcelDetail(d);
  }, []);

  useEffect(() => {
    refreshMeta().catch((e) => setErr(String(e.message ?? e)));
  }, [refreshMeta]);

  useEffect(() => {
    if (!player?.id) return;
    refreshPlayer(player.id).catch(() => {
      localStorage.removeItem("farmsim_player");
      setPlayer(null);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeParcelId) return;
    loadParcel(activeParcelId).catch((e) => setErr(String(e.message ?? e)));
    const t = setInterval(() => {
      loadParcel(activeParcelId).catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [activeParcelId, loadParcel]);

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
  const parcel = parcelDetail?.parcel;
  const gw = parcel?.gridW ?? 12;
  const gh = parcel?.gridH ?? 12;
  const grid = parcel?.cells ?? [];
  const zoneName = parcel?.zone?.name ?? ownedParcels[0]?.zone?.name ?? "France";
  const koppen = parcel?.zone?.koppen ?? "Cfb";
  const avgProgress = useMemo(() => {
    const sims = parcelDetail?.cellSims ?? [];
    if (!sims.length) return 0;
    return sims.reduce((a, s) => a + s.sim.progress, 0) / sims.length;
  }, [parcelDetail]);

  function toggleCell(x: number, y: number) {
    setSelectedCells((prev) => {
      const exists = prev.some((c) => c.x === x && c.y === y);
      if (exists) return prev.filter((c) => !(c.x === x && c.y === y));
      return [...prev, { x, y }];
    });
  }

  async function register() {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, string> = {
        email: email || `${name.toLowerCase().replace(/\s+/g, "")}@demo.farmsim`,
        displayName: name || "Fermier",
        specialization: spe,
      };
      if (spe !== "ETA") {
        if (!selectedParcelId) throw new Error("Choisis une parcelle");
        body.parcelId = selectedParcelId;
      } else if (selectedParcelId) {
        body.parcelId = selectedParcelId;
      }
      const p = await api<Player>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPlayer(p);
      localStorage.setItem("farmsim_player", JSON.stringify(p));
      if (p.farm?.parcels[0]) setActiveParcelId(p.farm.parcels[0].id);
      await refreshMeta();
      setMsg("Exploitation créée");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyToolOnCell(x: number, y: number) {
    if (!player || !activeParcelId) return;
    if (tool === "SELECT" || tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE" || tool === "FERTILIZE" || tool === "HARVEST") {
      if (tool === "SELECT") {
        setSelectedCells([{ x, y }]);
        return;
      }
      toggleCell(x, y);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (tool === "BUILD") {
        await api(`/parcels/${activeParcelId}/build`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, type: buildType, x, y }),
        });
        setMsg(`${BUILDING_DEFS[buildType].name} placé`);
      } else if (tool === "PARK") {
        const free = player.farm?.machines.find((m) => !m.parkedParcelId && !m.storedInBuildingId);
        if (!free) throw new Error("Aucun véhicule libre à stationner");
        await api(`/machines/${free.id}/park`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, parcelId: activeParcelId, x, y }),
        });
        setMsg("Véhicule stationné");
      }
      await refreshPlayer(player.id);
      await loadParcel(activeParcelId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSelectionAction() {
    if (!player || !activeParcelId || !selectedCells.length) return;
    setBusy(true);
    setErr(null);
    try {
      if (tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE") {
        const crop: CropCode = tool === "PLANT_WHEAT" ? "WHEAT" : "MAIZE";
        await api(`/parcels/${activeParcelId}/plant`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, crop, cells: selectedCells }),
        });
        setMsg(`Semé ${crop} sur ${selectedCells.length} case(s)`);
      } else if (tool === "FERTILIZE") {
        await api(`/parcels/${activeParcelId}/fertilize`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: selectedCells }),
        });
        setMsg("Fertilisé");
      } else if (tool === "HARVEST") {
        await api(`/parcels/${activeParcelId}/harvest`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: selectedCells }),
        });
        setMsg("Récolte OK");
      }
      setSelectedCells([]);
      await refreshPlayer(player.id);
      await loadParcel(activeParcelId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function harvestAll() {
    if (!player || !activeParcelId) return;
    setBusy(true);
    try {
      const r = await api<{ totalTons: number }>(`/parcels/${activeParcelId}/harvest`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setMsg(`Récolte totale ${r.totalTons.toFixed(2)} t`);
      await refreshPlayer(player.id);
      await loadParcel(activeParcelId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
      await refreshPlayer(player.id);
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
      await refreshPlayer(player.id);
      await refreshMeta();
      setMsg(`Vendu pour ${r.revenue} CRD`);
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
      const r = await api<{ reward: number }>(`/contracts/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      await refreshPlayer(player.id);
      await refreshMeta();
      setMsg(`Mission +${r.reward} CRD`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!player) {
    return (
      <div className="app shell">
        <header className="topbar">
          <div className="brand">Farming Navigateur</div>
          <p className="lede">Ferme isométrique · marché mondial · ETA</p>
        </header>
        {(msg || err) && <p className={err ? "error" : "ok"}>{err ?? msg}</p>}
        <div className="onboard">
          <section className="glass">
            <h2>Métier</h2>
            <div className="spe-cards">
              {(Object.keys(SPECIALIZATION_LABELS) as Specialization[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`spe ${spe === k ? "active" : ""}`}
                  onClick={() => setSpe(k)}
                >
                  <strong>{SPECIALIZATION_LABELS[k]}</strong>
                  <div className="muted">
                    {k === "ETA"
                      ? "Missions sans terre obligatoire."
                      : "Parcelle de départ sur la carte."}
                  </div>
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: "1rem" }}>
              <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </section>
          <section className="glass">
            <h2>Parcelle de départ</h2>
            {spe === "ETA" ? (
              <p className="muted">Optionnel pour ETA.</p>
            ) : null}
            <div className="parcel-map">
              {freeParcels.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`parcel ${selectedParcelId === p.id ? "selected" : ""}`}
                  onClick={() => setSelectedParcelId(p.id)}
                >
                  <strong>{p.label}</strong>
                  <span className="muted">
                    {p.zone?.name} · ({p.mapX},{p.mapY})
                  </span>
                  <span>{p.landPrice} CRD</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: "1rem" }}>
              <button type="button" disabled={busy} onClick={register}>
                Créer mon compte
              </button>
            </div>
          </section>
        </div>
      </div>
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
            onCellClick={applyToolOnCell}
          />
        ) : (
          <div className="iso-viewport empty-farm">
            <p>Achetez une parcelle pour ouvrir la grille {gw}×{gh}.</p>
          </div>
        )}
      </div>

      <header className="hud-top">
        <div className="brand-mark">Farming Navigateur</div>
        <div className="hud-stats">
          <span>{player.displayName}</span>
          <span>{SPECIALIZATION_LABELS[player.specialization]}</span>
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
              localStorage.removeItem("farmsim_player");
              setPlayer(null);
              setParcelDetail(null);
            }}
          >
            Compte
          </button>
        </div>
      </header>

      {(msg || err) && (
        <div className={`toast ${err ? "bad" : "good"}`}>{err ?? msg}</div>
      )}

      <aside className="glass geo-panel">
        <h3>Contexte géographique</h3>
        <dl>
          <div>
            <dt>Lieu</dt>
            <dd>{zoneName}</dd>
          </div>
          <div>
            <dt>Climat</dt>
            <dd>{koppen}</dd>
          </div>
          <div>
            <dt>Aptitude blé</dt>
            <dd>{((parcel?.fertility ?? 0.7) + 0.2).toFixed(2)}</dd>
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
        <h3>Bâtiments</h3>
        <div className="build-list">
          {(Object.keys(BUILDING_DEFS) as BuildingType[]).map((t) => {
            const d = BUILDING_DEFS[t];
            return (
              <button
                key={t}
                type="button"
                className={`build-item ${tool === "BUILD" && buildType === t ? "on" : ""}`}
                onClick={() => {
                  setTool("BUILD");
                  setBuildType(t);
                  setSelectedCells([]);
                }}
              >
                <strong>{d.name}</strong>
                <span>
                  {d.w}×{d.h} · {d.cost} CRD
                </span>
                <span className="muted tiny">{d.description}</span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="action-bar">
        {ACTION_BAR.map(([t, label]) => (
          <button
            key={t}
            type="button"
            className={tool === t && t !== "BUILD" ? "action on" : "action"}
            onClick={() => {
              if (t === "BUILD") {
                setTool("BUILD");
                return;
              }
              setTool(t);
              setSelectedCells([]);
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={`action eta ${showEta ? "on" : ""}`}
          onClick={() => setShowEta((v) => !v)}
        >
          ETA Presta
        </button>
        {(tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE" || tool === "FERTILIZE" || tool === "HARVEST") && (
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
          </>
        )}
        <button type="button" className="action" disabled={busy} onClick={harvestAll}>
          Tout récolter
        </button>
      </div>

      {showEta && (
        <aside className="glass eta-panel">
          <h3>Missions ETA</h3>
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
          <div className="parcel-map compact">
            {freeParcels
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
              .slice(0, 6)
              .map((p) => (
                <button key={p.id} type="button" className="parcel" onClick={() => buyAdjacent(p.id)}>
                  <strong>{p.label}</strong>
                  <span className="muted tiny">
                    ({p.mapX},{p.mapY}) · {p.landPrice} CRD
                  </span>
                </button>
              ))}
          </div>
          <h3 className="spaced">Stock / marché</h3>
          <ul className="list">
            {(player.farm?.inventory ?? []).map((i) => (
              <li key={i.id}>
                <span>
                  {i.itemCode} · {i.qty.toFixed(2)} t
                </span>
                <button type="button" disabled={busy} onClick={() => sell(i.itemCode as CropCode, i.qty)}>
                  Vendre
                </button>
              </li>
            ))}
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
