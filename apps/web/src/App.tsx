import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SPECIALIZATION_LABELS,
  BUILDING_DEFS,
  type Specialization,
  type CropCode,
  type BuildingType,
} from "@farmsim/shared";

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

function cellColor(c: Cell): string {
  if (c.kind === "BUILDING") return "#6b5b4a";
  if (c.kind === "VEHICLE") return "#2b2f33";
  if (c.kind === "CROP") {
    if (c.fieldStage === "READY") return "#d4a84b";
    return "#6f9a45";
  }
  return "#3d4f3a";
}

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
      }
      const p = await api<Player>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPlayer(p);
      localStorage.setItem("farmsim_player", JSON.stringify(p));
      if (p.farm?.parcels[0]) setActiveParcelId(p.farm.parcels[0].id);
      setMsg(spe === "ETA" ? "ETA prête — missions ou achat de terre." : "Exploitation créée.");
      await refreshMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function buyAdjacent(parcelId: string) {
    if (!player) return;
    setBusy(true);
    setErr(null);
    try {
      const p = await api<Player>(`/parcels/${parcelId}/buy`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      setPlayer(p);
      localStorage.setItem("farmsim_player", JSON.stringify(p));
      setActiveParcelId(parcelId);
      setMsg("Parcelle achetée.");
      await refreshMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function applyToolOnCell(x: number, y: number) {
    if (!player || !activeParcelId) return;
    if (tool === "SELECT" || tool === "FERTILIZE" || tool === "HARVEST" || tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE") {
      toggleCell(x, y);
      return;
    }
    if (tool === "BUILD") {
      setBusy(true);
      setErr(null);
      try {
        await api(`/parcels/${activeParcelId}/build`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, type: buildType, x, y }),
        });
        await refreshPlayer(player.id);
        await loadParcel(activeParcelId);
        setMsg(`${BUILDING_DEFS[buildType].name} placé.`);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (tool === "PARK") {
      const machine = player.farm?.machines.find((m) => !m.storedInBuildingId) ?? player.farm?.machines[0];
      if (!machine) return;
      setBusy(true);
      try {
        await api(`/machines/${machine.id}/park`, {
          method: "POST",
          body: JSON.stringify({
            userId: player.id,
            parcelId: activeParcelId,
            x,
            y,
          }),
        });
        await refreshPlayer(player.id);
        await loadParcel(activeParcelId);
        setMsg("Véhicule stationné.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }
  }

  async function runSelectionAction() {
    if (!player || !activeParcelId || selectedCells.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      if (tool === "PLANT_WHEAT" || tool === "PLANT_MAIZE") {
        const crop: CropCode = tool === "PLANT_WHEAT" ? "WHEAT" : "MAIZE";
        await api(`/parcels/${activeParcelId}/plant`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, crop, cells: selectedCells }),
        });
        setMsg(`Semis sur ${selectedCells.length} case(s).`);
      } else if (tool === "FERTILIZE") {
        await api(`/parcels/${activeParcelId}/fertilize`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: selectedCells }),
        });
        setMsg("Fertilisation OK.");
      } else if (tool === "HARVEST") {
        const r = await api<{ totalTons: number }>(`/parcels/${activeParcelId}/harvest`, {
          method: "POST",
          body: JSON.stringify({ userId: player.id, cells: selectedCells }),
        });
        setMsg(`Récolte ${r.totalTons.toFixed(2)} t`);
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

  const grid = parcelDetail?.parcel.cells ?? [];
  const gw = parcelDetail?.parcel.gridW ?? 8;

  return (
    <div className="app">
      <header className="hero">
        <div className="brand">Farming Navigateur</div>
        <p>
          Place cultures, silos, étables et véhicules sur la grille. Achète les parcelles
          voisines. Les bâtiments donnent des bonus à l’exploitation.
        </p>
        {player && (
          <div className="row">
            <span className="stat">{player.displayName}</span>
            <span className="stat">{SPECIALIZATION_LABELS[player.specialization]}</span>
            <span className="stat">{Math.round(player.crd)} CRD</span>
            {player.bonuses && (
              <span className="stat">
                stock grain {player.bonuses.storageGrain}t · yield +
                {Math.round(player.bonuses.yieldBonus * 100)}%
              </span>
            )}
            <button
              className="secondary"
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
        )}
      </header>

      {(msg || err) && <p className={err ? "error" : "ok"}>{err ?? msg}</p>}

      {!player ? (
        <div className="grid two">
          <section className="panel">
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
                      ? "Missions + possibilité d’acheter une terre ensuite."
                      : "Choisis une parcelle de départ."}
                  </div>
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: "1rem" }}>
              <input placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} />
              <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </section>
          <section className="panel">
            <h2>Parcelle de départ</h2>
            {spe === "ETA" ? (
              <p className="muted">Optionnel pour ETA — tu peux démarrer sans terre.</p>
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
      ) : (
        <div className="grid two">
          <section className="panel">
            <h2>Grille d’exploitation</h2>
            <div className="row" style={{ marginBottom: "0.75rem" }}>
              {ownedParcels.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={activeParcelId === p.id ? "" : "secondary"}
                  onClick={() => setActiveParcelId(p.id)}
                >
                  {p.label} ({p.mapX},{p.mapY})
                </button>
              ))}
            </div>

            <div className="row" style={{ marginBottom: "0.75rem" }}>
              {(
                [
                  ["SELECT", "Sélection"],
                  ["PLANT_WHEAT", "Blé"],
                  ["PLANT_MAIZE", "Maïs"],
                  ["FERTILIZE", "Ferti"],
                  ["HARVEST", "Récolte"],
                  ["BUILD", "Bâtiment"],
                  ["PARK", "Park véhicule"],
                ] as [Tool, string][]
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={tool === t ? "" : "secondary"}
                  onClick={() => {
                    setTool(t);
                    setSelectedCells([]);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tool === "BUILD" && (
              <div className="row" style={{ marginBottom: "0.75rem" }}>
                {(Object.keys(BUILDING_DEFS) as BuildingType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={buildType === t ? "" : "secondary"}
                    onClick={() => setBuildType(t)}
                    title={BUILDING_DEFS[t].description}
                  >
                    {BUILDING_DEFS[t].name} ({BUILDING_DEFS[t].w}×{BUILDING_DEFS[t].h}) ·{" "}
                    {BUILDING_DEFS[t].cost}
                  </button>
                ))}
              </div>
            )}

            <div
              className="farm-grid"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gw}, 1fr)`,
                gap: 3,
                aspectRatio: "1",
                maxWidth: 420,
              }}
            >
              {Array.from({ length: gw * (parcelDetail?.parcel.gridH ?? 8) }).map((_, i) => {
                const x = i % gw;
                const y = Math.floor(i / gw);
                const c = grid.find((cell) => cell.x === x && cell.y === y);
                const selected = selectedCells.some((s) => s.x === x && s.y === y);
                const sim = parcelDetail?.cellSims?.find((s) => s.x === x && s.y === y);
                return (
                  <button
                    key={`${x}-${y}`}
                    type="button"
                    title={
                      c
                        ? `${c.kind}${c.crop ? " " + c.crop : ""}${sim ? ` ${Math.round(sim.sim.progress * 100)}%` : ""}`
                        : ""
                    }
                    onClick={() => applyToolOnCell(x, y)}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 4,
                      border: selected ? "2px solid #f3ead7" : "1px solid rgba(0,0,0,0.25)",
                      background: c ? cellColor(c) : "#333",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  />
                );
              })}
            </div>

            <div className="row" style={{ marginTop: "0.75rem" }}>
              {(tool === "PLANT_WHEAT" ||
                tool === "PLANT_MAIZE" ||
                tool === "FERTILIZE" ||
                tool === "HARVEST") && (
                <button type="button" disabled={busy || !selectedCells.length} onClick={runSelectionAction}>
                  Appliquer sur {selectedCells.length} case(s)
                </button>
              )}
              <button type="button" className="secondary" disabled={busy} onClick={harvestAll}>
                Tout récolter (prêt)
              </button>
            </div>

            <h3 style={{ marginTop: "1rem" }}>Bâtiments sur cette parcelle</h3>
            <ul className="list">
              {(parcelDetail?.parcel.buildings ?? []).map((b) => (
                <li key={b.id}>
                  <span>
                    {BUILDING_DEFS[b.type].name} @ ({b.originX},{b.originY})
                  </span>
                </li>
              ))}
              {(parcelDetail?.parcel.buildings?.length ?? 0) === 0 && (
                <li className="muted">Aucun bâtiment</li>
              )}
            </ul>
          </section>

          <section className="panel">
            <h2>Expansion & marché</h2>
            <h3>Parcelles adjacentes libres</h3>
            <div className="parcel-map">
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
                .slice(0, 8)
                .map((p) => (
                  <button key={p.id} type="button" className="parcel" onClick={() => buyAdjacent(p.id)}>
                    <strong>{p.label}</strong>
                    <span className="muted">
                      ({p.mapX},{p.mapY}) · {p.landPrice} CRD
                    </span>
                  </button>
                ))}
            </div>

            <h3 style={{ marginTop: "1rem" }}>Stock</h3>
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

            <h3 style={{ marginTop: "1rem" }}>Marché</h3>
            <ul className="list">
              {market.map((m) => (
                <li key={m.commodity}>
                  <span>
                    {m.commodity} · {m.price.toFixed(1)} CRD/t
                  </span>
                </li>
              ))}
            </ul>

            <h3 style={{ marginTop: "1rem" }}>Missions ETA</h3>
            <ul className="list">
              {contracts.map((c) => (
                <li key={c.id}>
                  <span>
                    <strong>{c.title}</strong>
                    <div className="muted">
                      {c.jobType} · {c.rewardCrd} CRD
                    </div>
                  </span>
                  <button type="button" disabled={busy} onClick={() => acceptContract(c.id)}>
                    Faire
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
