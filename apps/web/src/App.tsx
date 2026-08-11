import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SPECIALIZATION_LABELS,
  type Specialization,
  type CropCode,
} from "@farmsim/shared";

const API = "/api";

type Zone = {
  id: string;
  code: string;
  name: string;
  country: string;
  koppen: string;
  riskNote: string;
  parcels: Parcel[];
};

type Parcel = {
  id: string;
  label: string;
  landPrice: number;
  fieldStage: string;
  crop?: CropCode | null;
  fertility: number;
  fertilizedPasses: number;
  weedsControlled: boolean;
  zone?: { code: string; name: string };
};

type Player = {
  id: string;
  email: string;
  displayName: string;
  specialization: Specialization;
  level: number;
  xp: number;
  crd: number;
  farm: {
    id: string;
    name: string;
    parcels: Parcel[];
    machines: { id: string; type: string; tier: number; condition: number }[];
    inventory: { id: string; itemCode: string; qty: number; quality: number }[];
  } | null;
};

type Contract = {
  id: string;
  jobType: string;
  title: string;
  rewardCrd: number;
  regionNote: string;
};

type MarketPrice = { commodity: string; price: number; stockTons: number };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur API");
  return data as T;
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
  const [selectedParcel, setSelectedParcel] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    sim: { progress: number; ready: boolean; estimatedYieldTons: number; moisturePenalty: number } | null;
    weather?: { state: string };
  } | null>(null);
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
    return p;
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

  const ownedParcel = player?.farm?.parcels[0] ?? null;

  useEffect(() => {
    if (!ownedParcel) {
      setStatus(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      try {
        const s = await api<{
          sim: typeof status extends null ? null : NonNullable<typeof status>["sim"];
          weather?: { state: string };
        }>(`/parcels/${ownedParcel.id}/status`);
        if (alive) setStatus(s as typeof status);
      } catch {
        /* ignore transient */
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ownedParcel?.id, ownedParcel?.fieldStage, ownedParcel?.crop]);

  const freeParcels = useMemo(
    () => zones.flatMap((z) => z.parcels.map((p) => ({ ...p, zone: z }))),
    [zones],
  );

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
        if (!selectedParcel) throw new Error("Choisis une parcelle");
        body.parcelId = selectedParcel;
      }
      const p = await api<Player>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setPlayer(p);
      localStorage.setItem("farmsim_player", JSON.stringify(p));
      setMsg(
        spe === "ETA"
          ? "ETA créée — prends des missions sur le tableau."
          : "Ferme créée — plante du blé ou du maïs.",
      );
      await refreshMeta();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function plant(crop: CropCode) {
    if (!player || !ownedParcel) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/parcels/${ownedParcel.id}/plant`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, crop }),
      });
      await refreshPlayer(player.id);
      setMsg(`Semis ${crop === "WHEAT" ? "blé" : "maïs"} lancé.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function fertilize() {
    if (!player || !ownedParcel) return;
    setBusy(true);
    try {
      await api(`/parcels/${ownedParcel.id}/fertilize`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id }),
      });
      await refreshPlayer(player.id);
      setMsg("Fertilisation appliquée.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function harvest() {
    if (!player || !ownedParcel) return;
    setBusy(true);
    try {
      const r = await api<{ sim: { estimatedYieldTons: number; moisturePenalty: number } }>(
        `/parcels/${ownedParcel.id}/harvest`,
        { method: "POST", body: JSON.stringify({ userId: player.id }) },
      );
      await refreshPlayer(player.id);
      setMsg(
        `Récolte ${r.sim.estimatedYieldTons} t` +
          (r.sim.moisturePenalty > 0 ? " (malus humidité)" : ""),
      );
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
      const r = await api<{ revenue: number; crd: number }>(`/market/sell`, {
        method: "POST",
        body: JSON.stringify({ userId: player.id, commodity, tons }),
      });
      await refreshPlayer(player.id);
      await refreshMeta();
      setMsg(`Vendu pour ${r.revenue} CRD.`);
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
      setMsg(`Mission terminée — +${r.reward} CRD`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const fieldClass =
    status?.sim?.ready || ownedParcel?.fieldStage === "READY"
      ? "ready"
      : ownedParcel?.crop
        ? "planted"
        : "";

  return (
    <div className="app">
      <header className="hero">
        <div className="brand">Farming Navigateur</div>
        <p>
          Gestion agricole mondiale dans le navigateur — céréalier, éleveur ou{" "}
          <strong>ETA</strong> (travaux agricoles). Le climat et le marché comptent.
        </p>
        {player && (
          <div className="row">
            <span className="stat">{player.displayName}</span>
            <span className="stat">{SPECIALIZATION_LABELS[player.specialization]}</span>
            <span className="stat">{Math.round(player.crd)} CRD</span>
            <span className="stat">Niv. {player.level}</span>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                localStorage.removeItem("farmsim_player");
                setPlayer(null);
              }}
            >
              Changer de compte
            </button>
          </div>
        )}
      </header>

      {(msg || err) && (
        <p className={err ? "error" : "ok"}>
          {err ?? msg}
        </p>
      )}

      {!player ? (
        <div className="grid two">
          <section className="panel">
            <h2>1. Choisis ton métier</h2>
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
                    {k === "CEREALIER" && "Cultures, rendement, stockage."}
                    {k === "ELEVEUR" && "Animaux (contenu limité MVP)."}
                    {k === "ETA" && "Ouvrier : missions de récolte, labour, transport — sans terre obligatoire."}
                  </div>
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: "1rem" }}>
              <input
                placeholder="Nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                placeholder="Email (optionnel)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </section>

          <section className="panel">
            <h2>{spe === "ETA" ? "2. Lancer l’ETA" : "2. Choisis une parcelle"}</h2>
            {spe !== "ETA" ? (
              <div className="parcel-map">
                {freeParcels.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`parcel ${selectedParcel === p.id ? "selected" : ""}`}
                    onClick={() => setSelectedParcel(p.id)}
                  >
                    <strong>{p.label}</strong>
                    <span className="muted">
                      {p.zone.name} · {p.zone.koppen}
                    </span>
                    <span>{p.landPrice} CRD</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">
                Pas besoin de parcelle : tu gagnes surtout via le tableau de missions NPC
                (P2P arrivée en V1).
              </p>
            )}
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
            <h2>Exploitation</h2>
            {ownedParcel ? (
              <>
                <div className={`field-view ${fieldClass}`}>
                  <div className="machine" title="Machine" />
                </div>
                <p className="muted">
                  {ownedParcel.label}
                  {ownedParcel.zone ? ` · ${ownedParcel.zone.name}` : ""} · fert.{" "}
                  {Math.round(ownedParcel.fertility * 100)}%
                  {status?.weather ? ` · météo ${status.weather.state}` : ""}
                </p>
                {status?.sim && (
                  <>
                    <div className="progress">
                      <span style={{ width: `${Math.round(status.sim.progress * 100)}%` }} />
                    </div>
                    <p className="muted">
                      Croissance {Math.round(status.sim.progress * 100)}%
                      {status.sim.ready
                        ? ` · prêt (~${status.sim.estimatedYieldTons} t)`
                        : ""}
                      {status.sim.moisturePenalty > 0
                        ? " · attention humidité"
                        : ""}
                    </p>
                  </>
                )}
                <div className="row">
                  <button type="button" disabled={busy} onClick={() => plant("WHEAT")}>
                    Semer blé
                  </button>
                  <button type="button" disabled={busy} onClick={() => plant("MAIZE")}>
                    Semer maïs
                  </button>
                  <button type="button" disabled={busy} onClick={fertilize}>
                    Fertiliser
                  </button>
                  <button type="button" disabled={busy} onClick={harvest}>
                    Récolter
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">
                Compte ETA sans parcelle — utilise le tableau de missions à droite.
              </p>
            )}

            <h3 style={{ marginTop: "1.2rem" }}>Stock & vente</h3>
            <ul className="list">
              {(player.farm?.inventory ?? []).map((i) => (
                <li key={i.id}>
                  <span>
                    {i.itemCode} · {i.qty.toFixed(2)} t · Q{i.quality}
                  </span>
                  <button
                    type="button"
                    disabled={busy || i.qty <= 0}
                    onClick={() => sell(i.itemCode as CropCode, Math.min(i.qty, i.qty))}
                  >
                    Tout vendre
                  </button>
                </li>
              ))}
              {(player.farm?.inventory?.length ?? 0) === 0 && (
                <li className="muted">Inventaire vide</li>
              )}
            </ul>
          </section>

          <section className="panel">
            <h2>Marché & missions ETA</h2>
            <ul className="list">
              {market.map((m) => (
                <li key={m.commodity}>
                  <span>
                    {m.commodity} · {m.price.toFixed(1)} CRD/t
                  </span>
                  <span className="muted">stock {Math.round(m.stockTons)}</span>
                </li>
              ))}
            </ul>

            <h3 style={{ marginTop: "1rem" }}>Tableau de missions</h3>
            <p className="muted">
              Les ETA ont un bonus de rémunération. Tout le monde peut prendre un contrat NPC.
            </p>
            <ul className="list">
              {contracts.map((c) => (
                <li key={c.id}>
                  <span>
                    <strong>{c.title}</strong>
                    <div className="muted">
                      {c.jobType} · {c.regionNote} · {c.rewardCrd} CRD
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
