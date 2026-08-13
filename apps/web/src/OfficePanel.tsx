import { useEffect, useMemo, useState } from "react";
import { WORK_LABELS, type FarmWork } from "@farmsim/shared";
import { ZoneMap, type ZoneMapZone } from "./ZoneMap";

export type OfficeLabor = {
  id: string;
  work: FarmWork;
  crop: string | null;
  cells: number;
  remaining: number;
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

export type OfficeContract = {
  id: string;
  title: string;
  jobType: string;
  rewardCrd: number;
  cells?: number;
};

export type OfficeConsignes = {
  harvest: boolean;
  stubble: boolean;
  plow: boolean;
  straw: boolean;
  npcAllowed: boolean;
  maxSpend: number;
};

type ZoneLike = ZoneMapZone & { id: string; parcels: ZoneMapZone["parcels"] };

type Props = {
  open: boolean;
  onClose: () => void;
  crd: number;
  consignes: OfficeConsignes;
  busy: boolean;
  board: OfficeLabor[];
  posted: OfficeLabor[];
  active: OfficeLabor | null;
  ghost: OfficeContract[];
  takeLocked?: boolean;
  onTake: (id: string) => void;
  onCancelPosted: (id: string) => void;
  onAbandonActive: () => void;
  onTakeGhost: (id: string) => void;
  onSaveConsignes: (next: OfficeConsignes) => Promise<void>;
  zones: ZoneLike[];
  myFarmId?: string;
  expandableIds: ReadonlySet<string>;
  onBuyLand: (parcelId: string) => void;
};

type Tab = "BOURSE" | "CHIFFRE" | "CONSIGNES" | "TERRES";

function ttlLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "expire";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} TRN`;
}

export function OfficePanel({
  open,
  onClose,
  crd,
  consignes,
  busy,
  board,
  posted,
  active,
  ghost,
  takeLocked = false,
  onTake,
  onCancelPosted,
  onAbandonActive,
  onTakeGhost,
  onSaveConsignes,
  zones,
  myFarmId,
  expandableIds,
  onBuyLand,
}: Props) {
  const [tab, setTab] = useState<Tab>("BOURSE");

  const escrow = useMemo(
    () => posted.reduce((s, o) => s + (o.status === "OPEN" || o.status === "ACCEPTED" ? o.escrowCrd : 0), 0),
    [posted],
  );
  const toEarn = useMemo(() => board.reduce((s, o) => s + o.payoutCrd, 0), [board]);
  const locked = escrow;
  const cannotTake = busy || Boolean(active) || takeLocked;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="hall-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Bureau"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hall-sheet glass" onClick={(e) => e.stopPropagation()}>
        <header className="hall-head">
          <div>
            <p className="hall-kicker">Bureau de l’exploitation</p>
            <h2>Ordres &amp; missions</h2>
          </div>
          <dl className="hall-wallet">
            <div>
              <dt>Caisse</dt>
              <dd>{money(crd)}</dd>
            </div>
            <div>
              <dt>Séquestre</dt>
              <dd>{money(locked)}</dd>
            </div>
            <div>
              <dt>Plafond consignes</dt>
              <dd>{money(consignes.maxSpend)}</dd>
            </div>
            <div>
              <dt>À gagner sur la bourse</dt>
              <dd className="gain">{money(toEarn)}</dd>
            </div>
          </dl>
          <button type="button" className="ghost" onClick={onClose}>
            Fermer
          </button>
        </header>

        <nav className="hall-tabs" aria-label="Sections du bureau">
          {(
            [
              ["BOURSE", `Bourse (${board.length})`],
              ["CHIFFRE", `À réaliser (${(active ? 1 : 0) + posted.length + ghost.length})`],
              ["CONSIGNES", "Consignes"],
              ["TERRES", "Terres"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`hall-tab ${tab === id ? "on" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "BOURSE" && (
          <section className="hall-body">
            <p className="hall-lead">
              Chantiers sur de vraies parcelles. Vous y allez avec votre matériel, vous
              encaissez en rentrant. Appoint — pas une rente.
            </p>
            {active && (
              <div className="job-banner">
                <div>
                  <strong>En cours · {WORK_LABELS[active.work]}</strong>
                  <span>
                    Chez {active.npc ? "une ferme voisine" : active.clientName} · {active.parcelLabel} ·{" "}
                    {active.remaining} case(s) restantes
                  </span>
                </div>
                <button type="button" className="ghost" disabled={busy} onClick={onAbandonActive}>
                  Lâcher
                </button>
              </div>
            )}
            {board.length === 0 ? (
              <p className="hall-empty">Aucun chantier ouvert pour l’instant. Revenez un peu plus tard.</p>
            ) : (
              <ul className="job-grid">
                {board.map((o) => (
                  <li key={o.id} className={`job-card ${o.npc ? "npc" : ""}`}>
                    <header>
                      <strong>{WORK_LABELS[o.work]}</strong>
                      <em>{ttlLabel(o.expiresAt)}</em>
                    </header>
                    <p>
                      {o.npc ? "Ferme voisine" : o.clientName}
                      {o.zoneName ? ` · ${o.zoneName}` : ""}
                    </p>
                    <p className="job-meta">
                      {o.parcelLabel} · {o.remaining}/{o.cells} cases
                      {o.crop ? ` · ${o.crop}` : ""}
                    </p>
                    <footer>
                      <span>
                        <b>{money(o.payoutCrd)}</b>
                        <small>à l’encaissement</small>
                      </span>
                      <button
                        type="button"
                        className="channel-go"
                        disabled={cannotTake}
                        onClick={() => onTake(o.id)}
                      >
                        Prendre
                      </button>
                    </footer>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "CHIFFRE" && (
          <section className="hall-body">
            <p className="hall-lead">
              Ce que vous avez publié, ce que vous avez pris, ce qui est encore dû.
            </p>
            <div className="ledger">
              <div>
                <em>Caisse</em>
                <strong>{money(crd)}</strong>
              </div>
              <div>
                <em>Dépensé · séquestre</em>
                <strong className="loss">−{money(locked)}</strong>
              </div>
              <div>
                <em>Mission en cours</em>
                <strong className="gain">{active ? money(active.payoutCrd) : "—"}</strong>
              </div>
              <div>
                <em>Chantiers publiés</em>
                <strong>{posted.length}</strong>
              </div>
            </div>
            {active && (
              <>
                <h3>Mission en cours</h3>
                <ul className="job-grid">
                  <li className="job-card on">
                    <header>
                      <strong>{WORK_LABELS[active.work]}</strong>
                      <em>en cours</em>
                    </header>
                    <p>
                      {active.clientName} · {active.parcelLabel}
                    </p>
                    <p className="job-meta">
                      {active.remaining} case(s) · {money(active.payoutCrd)} à l’arrivée
                    </p>
                    <footer>
                      <span>
                        <b>{money(active.payoutCrd)}</b>
                        <small>si vous terminez</small>
                      </span>
                      <button type="button" className="ghost" disabled={busy} onClick={onAbandonActive}>
                        Abandonner
                      </button>
                    </footer>
                  </li>
                </ul>
              </>
            )}
            <h3>Mes chantiers publiés</h3>
            {posted.length === 0 ? (
              <p className="hall-empty">Vous n’avez rien publié. Au champ : sélectionnez, puis « Publier ».</p>
            ) : (
              <ul className="job-grid">
                {posted.map((o) => (
                  <li key={o.id} className="job-card posted">
                    <header>
                      <strong>{WORK_LABELS[o.work]}</strong>
                      <em>{o.status === "ACCEPTED" ? "pris" : "ouvert"}</em>
                    </header>
                    <p>
                      {o.parcelLabel} · {o.remaining} case(s)
                    </p>
                    <p className="job-meta">
                      Séquestre {money(o.escrowCrd)} · devis {money(o.quoteCrd)}
                    </p>
                    <footer>
                      <span>
                        <b>−{money(o.escrowCrd)}</b>
                        <small>bloqués</small>
                      </span>
                      {o.status === "OPEN" && (
                        <button type="button" disabled={busy} onClick={() => onCancelPosted(o.id)}>
                          Annuler · remboursement
                        </button>
                      )}
                    </footer>
                  </li>
                ))}
              </ul>
            )}
            {ghost.length > 0 && (
              <>
                <h3>Ancien filet</h3>
                <p className="muted tiny">À terminer ou à abandonner — plus de nouveaux contrats fantômes.</p>
                <ul className="job-grid">
                  {ghost.map((c) => (
                    <li key={c.id} className="job-card">
                      <header>
                        <strong>{c.title}</strong>
                      </header>
                      <p className="job-meta">
                        {c.jobType} · {c.cells ?? "?"} cases
                      </p>
                      <footer>
                        <span>
                          <b>{money(c.rewardCrd)}</b>
                          <small>salaire</small>
                        </span>
                        <button
                          type="button"
                          className="channel-go"
                          disabled={cannotTake}
                          onClick={() => onTakeGhost(c.id)}
                        >
                          Prendre
                        </button>
                      </footer>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {tab === "CONSIGNES" && (
          <section className="hall-body">
            <p className="hall-lead">
              Si vous partez, les cases déjà engagées se publient toutes seules. Jamais de
              culture nouvelle. Le plafond empêche de vider la caisse.
            </p>
            <ConsignesForm consignes={consignes} busy={busy} onSave={onSaveConsignes} locked={locked} crd={crd} />
          </section>
        )}

        {tab === "TERRES" && (
          <section className="hall-body">
            <p className="hall-lead">Parcelles adjacentes libres — cliquez pour acheter.</p>
            <div className="zone-maps office-maps">
              {zones.map((z) => (
                <ZoneMap
                  key={z.id}
                  zone={z}
                  myFarmId={myFarmId}
                  selectableIds={expandableIds}
                  onSelect={onBuyLand}
                  compact
                />
              ))}
            </div>
            {expandableIds.size === 0 && (
              <p className="hall-empty">Aucune parcelle adjacente libre pour le moment.</p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function ConsignesForm({
  consignes,
  busy,
  onSave,
  locked,
  crd,
}: {
  consignes: OfficeConsignes;
  busy: boolean;
  onSave: (next: OfficeConsignes) => Promise<void>;
  locked: number;
  crd: number;
}) {
  const [draft, setDraft] = useState(consignes);
  useEffect(() => {
    setDraft(consignes);
  }, [consignes]);

  function toggle(key: keyof Omit<OfficeConsignes, "maxSpend">) {
    setDraft((d) => ({ ...d, [key]: !d[key] }));
  }

  const rows: { key: keyof Omit<OfficeConsignes, "maxSpend">; title: string; hint: string }[] = [
    { key: "harvest", title: "Publier la moisson", hint: "Dès qu’une case est mûre." },
    { key: "straw", title: "Paille", hint: "Presser l’andain, ramasser les bottes." },
    { key: "stubble", title: "Déchaumer", hint: "Après la moisson, quand plus rien n’attend au sol." },
    { key: "plow", title: "Labourer", hint: "Seulement si le sol est épuisé ou la culture perdue." },
    { key: "npcAllowed", title: "Filet voisin autorisé", hint: "Sinon, personne peut ne pas prendre — la culture peut se perdre." },
  ];

  return (
    <div className="consigne-form">
      <div className="consigne-budget">
        <div>
          <em>Disponible</em>
          <strong>{money(crd)}</strong>
        </div>
        <div>
          <em>Déjà bloqué</em>
          <strong>{money(locked)}</strong>
        </div>
        <label>
          <em>Plafond d’absence</em>
          <input
            type="number"
            min={0}
            max={20_000}
            step={50}
            value={draft.maxSpend}
            onChange={(e) => setDraft((d) => ({ ...d, maxSpend: Math.max(0, Number(e.target.value)) }))}
          />
        </label>
      </div>
      <ul className="consigne-rows">
        {rows.map((r) => (
          <li key={r.key} className={!draft[r.key] && r.key === "npcAllowed" ? "warn" : ""}>
            <label>
              <input type="checkbox" checked={draft[r.key]} onChange={() => toggle(r.key)} />
              <span>
                <strong>{r.title}</strong>
                <em>{r.hint}</em>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {!draft.npcAllowed && (
        <p className="consigne-alert">Sans filet, une culture mûre peut se perdre si personne ne prend.</p>
      )}
      <button type="button" className="accent" disabled={busy} onClick={() => void onSave(draft)}>
        Enregistrer les consignes
      </button>
    </div>
  );
}
