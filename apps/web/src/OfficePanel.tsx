import { useEffect, useMemo, useState } from "react";
import {
  LEDGER_HINTS,
  LEDGER_LABELS,
  CREDIT_HEALTH_LABELS,
  seasonInterest,
  type CreditHealth,
  WORK_LABELS,
  resultat,
  totauxParPoste,
  STAT_LABELS,
  type FarmWork,
  type LedgerLine,
  type QuestView,
} from "@farmsim/shared";
import { ZoneMap, type ZoneMapZone } from "./ZoneMap";

export type OnlinePeer = {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: number | null;
};

function seenLabel(online: boolean, lastSeenAt: number | null): string {
  if (online) return "connecté";
  if (!lastSeenAt) return "pas encore vu";
  const min = Math.max(1, Math.round((Date.now() - lastSeenAt) / 60_000));
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.round(min / 60)} h`;
}

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
  /** Mouvements récents, du plus récent au plus ancien. */
  ledger?: LedgerLine[];
  ledgerJours?: number;
  /**
   * Objectifs et voisinage — les deux seules choses que le Bureau montrait
   * ailleurs. Voir l'onglet « Objectifs ».
   */
  quests?: QuestView[];
  onClaimQuest?: (id: string) => void;
  onlinePlayers?: OnlinePeer[];
  /** L'état de la ligne de crédit — capitaux propres, plafond, dette. */
  credit?: CreditView | null;
  onLoan?: (amount: number) => void;
  onRepay?: (amount: number) => void;
};

/** Ce que la banque renvoie sur l'état d'une exploitation. */
export type CreditView = {
  equity: number;
  landCrd: number;
  buildingsCrd: number;
  machinesCrd: number;
  stockCrd: number;
  cashCrd: number;
  debtCrd: number;
  ceiling: number;
  room: number;
  seasonInterest: number;
  health: CreditHealth;
};

/**
 * « ACTIVITE » ouvre la nouvelle vue.
 *
 * Le Bureau ne pouvait pas répondre à sa propre question — « comment se porte
 * mon activité ? » — parce que le jeu ne gardait qu'un solde : aucune écriture
 * ne disait d'où venait un TRN ni où il était parti. Le journal existe
 * désormais ; c'est ici qu'il se lit.
 */
type Mode = "OBJECTIFS" | "ACTIVITE" | "TAKE" | "MINE" | "CONSIGNES" | "LAND";
type WorkCat = "ALL" | FarmWork;
type SortKey = "payout" | "ttl" | "cells" | "client";

const WORK_CATS: { id: WorkCat; label: string }[] = [
  { id: "ALL", label: "Tous les chantiers" },
  { id: "HARVEST", label: WORK_LABELS.HARVEST },
  { id: "SILAGE", label: WORK_LABELS.SILAGE },
  { id: "BALE", label: WORK_LABELS.BALE },
  { id: "COLLECT", label: WORK_LABELS.COLLECT },
  { id: "STUBBLE", label: WORK_LABELS.STUBBLE },
  { id: "PLOW", label: WORK_LABELS.PLOW },
  { id: "PLANT", label: WORK_LABELS.PLANT },
  { id: "FERTILIZE", label: WORK_LABELS.FERTILIZE },
];

/**
 * L'activité de l'exploitation, par atelier.
 *
 * Ce que le joueur cherche ici n'est pas son solde — il l'a en permanence en
 * haut de l'écran — mais **d'où il vient**. Les deux sens sont donc gardés
 * séparés : un élevage qui encaisse neuf cents de lait et dépense neuf cents
 * de fourrage n'est pas un élevage inactif, c'est un élevage qui ne gagne
 * rien. Les deux se ressemblent au solde et n'ont rien à voir en gestion.
 */
function Activite({
  lignes,
  jours,
  crd,
  escrow,
  busy,
  credit,
  onLoan,
  onRepay,
}: {
  lignes: LedgerLine[];
  jours: number;
  crd: number;
  escrow: number;
  busy: boolean;
  credit?: CreditView | null;
  onLoan?: (amount: number) => void;
  onRepay?: (amount: number) => void;
}) {
  const postes = totauxParPoste(lignes);
  const total = resultat(lignes);

  if (!lignes.length && !credit) {
    return (
      <div className="activite-vide">
        <strong>Rien à montrer pour l’instant</strong>
        <p>
          Vendez une récolte, payez une révision, prenez un chantier : chaque
          mouvement s’inscrit ici, et vous saurez enfin quel atelier vous
          rapporte.
        </p>
      </div>
    );
  }

  return (
    <div className="activite">
      <div className="activite-tete">
        <div>
          <em>Sur {jours} jours</em>
          <strong className={total.solde >= 0 ? "gain" : "perte"}>
            {total.solde >= 0 ? "+" : "−"}
            {money(Math.abs(total.solde))}
          </strong>
          <span>
            {money(total.recettes)} encaissés · {money(total.depenses)} dépensés
          </span>
        </div>
        <div>
          <em>Caisse</em>
          <strong>{money(crd)}</strong>
          {escrow > 0 && <span>dont {money(escrow)} en séquestre</span>}
        </div>
      </div>

      {credit && (
        <>
          {/* La banque.
              Placée avant les ateliers : la première question d'un exploitant
              endetté n'est pas « qu'est-ce qui rapporte » mais « où j'en
              suis ». */}
          <h4 className="activite-titre">Banque</h4>
          <div className="banque">
            <div className="banque-chiffres">
              <div>
                <em>Capitaux propres</em>
                <strong>{money(credit.equity)}</strong>
                <span>
                  terres {money(credit.landCrd)} · bâti {money(credit.buildingsCrd)} · matériel{" "}
                  {money(credit.machinesCrd)}
                </span>
              </div>
              <div>
                <em>Dette</em>
                <strong className={credit.debtCrd > 0 ? "perte" : ""}>{money(credit.debtCrd)}</strong>
                <span>
                  {credit.debtCrd > 0
                    ? `${money(credit.seasonInterest)} d’intérêts par saison`
                    : "ligne intacte"}
                </span>
              </div>
              <div>
                <em>Encore empruntable</em>
                <strong>{money(credit.room)}</strong>
                <span>
                  plafond {money(credit.ceiling)} · {CREDIT_HEALTH_LABELS[credit.health]}
                </span>
              </div>
            </div>
            <div className="banque-jauge" aria-hidden="true">
              <span
                className={`banque-part ${credit.health.toLowerCase()}`}
                style={{
                  width: `${Math.max(0, Math.min(100, credit.ceiling > 0 ? (credit.debtCrd / credit.ceiling) * 100 : 0))}%`,
                }}
              />
            </div>
            <div className="banque-gestes">
              {[2000, 5000, 10000].map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy || !onLoan || credit.room < n}
                  title={
                    credit.room < n
                      ? `La banque s’arrête à ${money(credit.room)}`
                      : `Emprunter ${money(n)} — ${money(seasonInterest(n))} d’intérêts par saison`
                  }
                  onClick={() => onLoan?.(n)}
                >
                  Emprunter {money(n)}
                </button>
              ))}
              <button
                type="button"
                className="ghost"
                disabled={busy || !onRepay || credit.debtCrd <= 0 || crd <= 0}
                title="Rembourser autant que la caisse le permet"
                onClick={() => onRepay?.(Math.min(credit.debtCrd, crd))}
              >
                Rembourser {money(Math.min(credit.debtCrd, crd))}
              </button>
            </div>
          </div>
        </>
      )}

      <h4 className="activite-titre">Par atelier</h4>
      <ul className="activite-postes">
        {postes.map((p) => {
          // La barre compare les ateliers entre eux, pas au solde : c'est le
          // poids relatif qui dit où passe l'argent.
          const max = Math.max(...postes.map((x) => Math.max(x.recettes, x.depenses)), 1);
          return (
            <li key={p.poste}>
              <div className="activite-poste-tete">
                <strong title={LEDGER_HINTS[p.poste]}>{LEDGER_LABELS[p.poste]}</strong>
                <b className={p.solde >= 0 ? "gain" : "perte"}>
                  {p.solde >= 0 ? "+" : "−"}
                  {money(Math.abs(p.solde))}
                </b>
              </div>
              <div className="activite-barres" aria-hidden="true">
                <i className="gain" style={{ width: `${(p.recettes / max) * 100}%` }} />
                <i className="perte" style={{ width: `${(p.depenses / max) * 100}%` }} />
              </div>
              <span className="activite-detail">
                {money(p.recettes)} encaissés · {money(p.depenses)} dépensés
              </span>
            </li>
          );
        })}
      </ul>

      <h4 className="activite-titre">Derniers mouvements</h4>
      <ul className="activite-lignes">
        {lignes.slice(0, 40).map((l, i) => (
          <li key={`${l.at}-${i}`}>
            <span className="activite-poste-tag">{LEDGER_LABELS[l.poste]}</span>
            <span className="activite-label">{l.label}</span>
            <b className={l.amount >= 0 ? "gain" : "perte"}>
              {l.amount >= 0 ? "+" : "−"}
              {money(Math.abs(l.amount))}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ttlMs(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Number.isFinite(ms) ? ms : 0;
}

function ttlLabel(iso: string): string {
  const ms = ttlMs(iso);
  if (ms <= 0) return "expire";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

function money(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} TRN`;
}

function perCell(o: OfficeLabor): number {
  return o.remaining > 0 ? o.payoutCrd / o.remaining : o.payoutCrd;
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
  quests,
  onClaimQuest,
  onlinePlayers,
  credit,
  onLoan,
  onRepay,
  zones,
  myFarmId,
  expandableIds,
  onBuyLand,
  ledger = [],
  ledgerJours = 7,
}: Props) {
  const [mode, setMode] = useState<Mode>("ACTIVITE");
  const [cat, setCat] = useState<WorkCat>("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("payout");
  const [pickId, setPickId] = useState<string | null>(null);
  const [ghostId, setGhostId] = useState<string | null>(null);

  const escrow = useMemo(
    () => posted.reduce((s, o) => s + (o.status === "OPEN" || o.status === "ACCEPTED" ? o.escrowCrd : 0), 0),
    [posted],
  );
  const toEarn = useMemo(() => board.reduce((s, o) => s + o.payoutCrd, 0), [board]);
  const cannotTake = busy || Boolean(active) || takeLocked;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = board.filter((o) => {
      if (cat !== "ALL" && o.work !== cat) return false;
      if (!q) return true;
      const blob = `${WORK_LABELS[o.work]} ${o.clientName} ${o.parcelLabel} ${o.zoneName} ${o.crop ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
    const dir = sort === "client" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sort === "payout") return (a.payoutCrd - b.payoutCrd) * dir;
      if (sort === "cells") return (a.remaining - b.remaining) * dir;
      if (sort === "ttl") return (ttlMs(a.expiresAt) - ttlMs(b.expiresAt)) * dir;
      return a.clientName.localeCompare(b.clientName, "fr");
    });
  }, [board, cat, query, sort]);

  const pick = filtered.find((o) => o.id === pickId) ?? filtered[0] ?? null;
  const ghostPick = ghost.find((c) => c.id === ghostId) ?? ghost[0] ?? null;
  /** Objectifs terminés mais pas encore encaissés : c'est ce qui mérite un chiffre. */
  const aFaire = (quests ?? []).filter((q) => q.done && !q.claimed).length;

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
      className="hdv-backdrop hall-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Hôtel du travail"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hdv-shell hall-sheet glass" onClick={(e) => e.stopPropagation()}>
        <header className="hdv-top">
          <div className="hdv-brand">
            <p className="hdv-kicker">Hôtel du travail</p>
            <h2>Bourse des chantiers</h2>
          </div>
          <div className="hdv-purse">
            <span>Caisse</span>
            <strong>{money(crd)}</strong>
            <em>séquestre {money(escrow)}</em>
          </div>
          <div className="hdv-purse alt">
            <span>À gagner</span>
            <strong className="gain">{money(toEarn)}</strong>
            <em>{board.length} offre(s)</em>
          </div>
          <button type="button" className="ghost hdv-close" onClick={onClose}>
            Fermer
          </button>
        </header>

        <nav className="hdv-modes" aria-label="Modes">
          {(
            [
              ["OBJECTIFS", `Objectifs${aFaire > 0 ? ` (${aFaire})` : ""}`],
              ["ACTIVITE", "Activité"],
              ["TAKE", `Prendre (${board.length})`],
              ["MINE", `Mes offres (${posted.length + (active ? 1 : 0)})`],
              ["CONSIGNES", "Consignes"],
              ["LAND", "Terres"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" className={mode === id ? "on" : ""} onClick={() => setMode(id)}>
              {label}
            </button>
          ))}
        </nav>

        {mode === "OBJECTIFS" ? (
          <div className="hdv-single">
            <Objectifs
              quests={quests ?? []}
              busy={busy}
              onClaim={onClaimQuest}
              pairs={onlinePlayers ?? []}
            />
          </div>
        ) : mode === "ACTIVITE" ? (
          <div className="hdv-single">
            <Activite
              lignes={ledger}
              jours={ledgerJours}
              crd={crd}
              escrow={escrow}
              busy={busy}
              credit={credit}
              onLoan={onLoan}
              onRepay={onRepay}
            />
          </div>
        ) : mode === "CONSIGNES" ? (
          <div className="hdv-single">
            <ConsignesForm consignes={consignes} busy={busy} onSave={onSaveConsignes} locked={escrow} crd={crd} />
          </div>
        ) : mode === "LAND" ? (
          <div className="hdv-single">
            <p className="hdv-muted">Parcelles adjacentes libres — cliquez pour acheter.</p>
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
            {expandableIds.size === 0 && <p className="hdv-empty">Aucune parcelle adjacente libre.</p>}
          </div>
        ) : mode === "MINE" ? (
          <MineBody
            active={active}
            posted={posted}
            ghost={ghost}
            busy={busy}
            cannotTake={cannotTake}
            onAbandon={onAbandonActive}
            onCancel={onCancelPosted}
            onTakeGhost={onTakeGhost}
            ghostPick={ghostPick}
            setGhostId={setGhostId}
          />
        ) : (
          <div className="hdv-body">
            <aside className="hdv-cats" aria-label="Types de chantier">
              <p>Travaux</p>
              {WORK_CATS.map((c) => {
                const n = c.id === "ALL" ? board.length : board.filter((o) => o.work === c.id).length;
                if (c.id !== "ALL" && n === 0) return null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={cat === c.id ? "on" : ""}
                    onClick={() => setCat(c.id)}
                  >
                    <span>{c.label}</span>
                    <em>{n}</em>
                  </button>
                );
              })}
            </aside>

            <section className="hdv-main">
              {active && (
                <div className="hdv-banner">
                  <div>
                    <strong>En cours · {WORK_LABELS[active.work]}</strong>
                    <span>
                      Chez {active.npc ? "une ferme voisine" : active.clientName} · {active.parcelLabel} ·{" "}
                      {active.remaining} case(s)
                    </span>
                  </div>
                  <button type="button" className="ghost" disabled={busy} onClick={onAbandonActive}>
                    Lâcher
                  </button>
                </div>
              )}
              <div className="hdv-toolbar">
                <input
                  type="search"
                  placeholder="Rechercher un chantier, un client, une parcelle…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Recherche"
                />
                <span className="hdv-count">{filtered.length} offre(s)</span>
              </div>
              {filtered.length === 0 ? (
                <p className="hdv-empty">Aucune offre dans ce rayon. Revenez un peu plus tard.</p>
              ) : (
                <div className="hdv-table-wrap">
                  <table className="hdv-table">
                    <thead>
                      <tr>
                        <th>Chantier</th>
                        <th>
                          <button type="button" className="hdv-sort" onClick={() => setSort("client")}>
                            Client
                          </button>
                        </th>
                        <th>
                          <button type="button" className="hdv-sort" onClick={() => setSort("cells")}>
                            Cases
                          </button>
                        </th>
                        <th>
                          <button type="button" className="hdv-sort" onClick={() => setSort("payout")}>
                            Salaire
                          </button>
                        </th>
                        <th>
                          <button type="button" className="hdv-sort" onClick={() => setSort("ttl")}>
                            Délai
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o) => (
                        <tr
                          key={o.id}
                          className={pick?.id === o.id ? "sel" : ""}
                          onClick={() => setPickId(o.id)}
                        >
                          <td>
                            <strong>{WORK_LABELS[o.work]}</strong>
                            {o.npc && <em className="local-tag">voisin</em>}
                            {o.crop ? <span className="hdv-sub">{o.crop}</span> : null}
                          </td>
                          <td>
                            {/* Les cent cinquante-sept fermes PNJ portent de
                                vrais noms — « Élevage Lefèvre », « GAEC des
                                Haies » — que l'API envoie fidèlement. Les
                                remplacer tous par « Ferme voisine » faisait
                                vingt-quatre lignes rigoureusement identiques
                                d'un bout à l'autre du tableau. La pastille
                                « voisin » suffit à dire que ce n'est pas un
                                joueur. */}
                            {o.clientName}
                            <span className="hdv-sub">
                              {o.parcelLabel}
                              {o.zoneName ? ` · ${o.zoneName}` : ""}
                            </span>
                          </td>
                          <td className="num">
                            {o.remaining}/{o.cells}
                          </td>
                          <td className="num last">{money(o.payoutCrd)}</td>
                          <td>{ttlLabel(o.expiresAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <aside className="hdv-detail">
              {pick ? (
                <div className="hdv-card">
                  <header>
                    <h3>{WORK_LABELS[pick.work]}</h3>
                    {pick.npc && <em className="local-tag">voisin</em>}
                  </header>
                  <dl className="hdv-quotes">
                    <div>
                      <dt>Salaire</dt>
                      <dd>{money(pick.payoutCrd)}</dd>
                    </div>
                    <div>
                      <dt>Par case</dt>
                      <dd>{money(perCell(pick))}</dd>
                    </div>
                    <div>
                      <dt>Restant</dt>
                      <dd>
                        {pick.remaining}/{pick.cells}
                      </dd>
                    </div>
                    <div>
                      <dt>Délai</dt>
                      <dd>{ttlLabel(pick.expiresAt)}</dd>
                    </div>
                  </dl>
                  <p>
                    <strong>{pick.clientName}</strong>
                    {pick.npc && <em className="local-tag">voisin</em>}
                    <span className="hdv-sub">
                      {pick.parcelLabel}
                      {pick.zoneName ? ` · ${pick.zoneName}` : ""}
                      {pick.crop ? ` · ${pick.crop}` : ""}
                    </span>
                  </p>
                  <p className="hdv-muted">
                    Vous y allez avec votre matériel. Paiement à l’encaissement, au retour. Appoint — pas une
                    rente.
                  </p>
                  {cannotTake && active && (
                    <p className="hdv-muted">Terminez ou lâchez le chantier en cours avant d’en prendre un autre.</p>
                  )}
                  <button
                    type="button"
                    className="accent"
                    disabled={cannotTake}
                    onClick={() => onTake(pick.id)}
                  >
                    Prendre · {money(pick.payoutCrd)}
                  </button>
                </div>
              ) : (
                <p className="hdv-empty">Sélectionnez une offre pour voir le détail.</p>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function MineBody({
  active,
  posted,
  ghost,
  busy,
  cannotTake,
  onAbandon,
  onCancel,
  onTakeGhost,
  ghostPick,
  setGhostId,
}: {
  active: OfficeLabor | null;
  posted: OfficeLabor[];
  ghost: OfficeContract[];
  busy: boolean;
  cannotTake: boolean;
  onAbandon: () => void;
  onCancel: (id: string) => void;
  onTakeGhost: (id: string) => void;
  ghostPick: OfficeContract | null;
  setGhostId: (id: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(active?.id ?? posted[0]?.id ?? null);
  const row = posted.find((o) => o.id === sel) ?? posted[0] ?? null;

  return (
    <div className="hdv-body">
      <aside className="hdv-cats">
        <p>Carnet</p>
        <button type="button" className={!ghost.length || sel ? "on" : ""} onClick={() => setSel(posted[0]?.id ?? active?.id ?? null)}>
          <span>Mes publications</span>
          <em>{posted.length}</em>
        </button>
        {ghost.length > 0 && (
          <button type="button" className={!sel && ghostPick ? "on" : ""} onClick={() => setSel("")}>
            <span>Ancien filet</span>
            <em>{ghost.length}</em>
          </button>
        )}
      </aside>
      <section className="hdv-main">
        {active && (
          <div className="hdv-banner">
            <div>
              <strong>Mission en cours · {WORK_LABELS[active.work]}</strong>
              <span>
                {active.clientName} · {active.parcelLabel} · {active.remaining} case(s) · {money(active.payoutCrd)} à
                l’arrivée
              </span>
            </div>
            <button type="button" className="ghost" disabled={busy} onClick={onAbandon}>
              Abandonner
            </button>
          </div>
        )}
        {sel !== "" ? (
          posted.length === 0 ? (
            <p className="hdv-empty">Vous n’avez rien publié. Au champ : sélectionnez, puis « Publier ».</p>
          ) : (
            <div className="hdv-table-wrap">
              <table className="hdv-table">
                <thead>
                  <tr>
                    <th>Chantier</th>
                    <th>Parcelle</th>
                    <th>État</th>
                    <th>Séquestre</th>
                    <th>Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {posted.map((o) => (
                    <tr key={o.id} className={row?.id === o.id ? "sel" : ""} onClick={() => setSel(o.id)}>
                      <td>
                        <strong>{WORK_LABELS[o.work]}</strong>
                      </td>
                      <td>{o.parcelLabel}</td>
                      <td>{o.status === "ACCEPTED" ? "pris" : "ouvert"}</td>
                      <td className="num loss">−{money(o.escrowCrd)}</td>
                      <td className="num">
                        {o.remaining}/{o.cells}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="hdv-table-wrap">
            <table className="hdv-table">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Type</th>
                  <th>Cases</th>
                  <th>Salaire</th>
                </tr>
              </thead>
              <tbody>
                {ghost.map((c) => (
                  <tr
                    key={c.id}
                    className={ghostPick?.id === c.id ? "sel" : ""}
                    onClick={() => setGhostId(c.id)}
                  >
                    <td>
                      <strong>{c.title}</strong>
                    </td>
                    <td>{c.jobType}</td>
                    <td className="num">{c.cells ?? "—"}</td>
                    <td className="num last">{money(c.rewardCrd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <aside className="hdv-detail">
        {sel !== "" && row ? (
          <div className="hdv-card">
            <header>
              <h3>{WORK_LABELS[row.work]}</h3>
            </header>
            <dl className="hdv-quotes">
              <div>
                <dt>Bloqué</dt>
                <dd className="loss">−{money(row.escrowCrd)}</dd>
              </div>
              <div>
                <dt>Devis</dt>
                <dd>{money(row.quoteCrd)}</dd>
              </div>
              <div>
                <dt>État</dt>
                <dd>{row.status === "ACCEPTED" ? "pris" : "ouvert"}</dd>
              </div>
            </dl>
            <p className="hdv-muted">
              {row.parcelLabel} · {row.remaining} case(s). Annuler rembourse le séquestre tant que personne n’a
              pris.
            </p>
            {row.status === "OPEN" && (
              <button type="button" className="ghost" disabled={busy} onClick={() => onCancel(row.id)}>
                Annuler · remboursement
              </button>
            )}
          </div>
        ) : ghostPick ? (
          <div className="hdv-card">
            <header>
              <h3>{ghostPick.title}</h3>
            </header>
            <p className="hdv-muted">Ancien filet — plus de nouveaux contrats fantômes.</p>
            <dl className="hdv-quotes">
              <div>
                <dt>Salaire</dt>
                <dd>{money(ghostPick.rewardCrd)}</dd>
              </div>
              <div>
                <dt>Cases</dt>
                <dd>{ghostPick.cells ?? "—"}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="accent"
              disabled={cannotTake}
              onClick={() => onTakeGhost(ghostPick.id)}
            >
              Prendre
            </button>
          </div>
        ) : (
          <p className="hdv-empty">Rien à afficher.</p>
        )}
      </aside>
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
    { key: "npcAllowed", title: "Filet voisin autorisé", hint: "Sinon personne peut ne pas prendre — la culture peut se perdre." },
  ];

  return (
    <div className="consigne-form">
      <p className="hdv-muted">
        Si vous partez, les cases déjà engagées se publient toutes seules. Jamais de culture nouvelle.
      </p>
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


/**
 * Objectifs et voisinage.
 *
 * Ces deux blocs vivaient dans un second panneau — `MissionsPanel` — qui
 * s'ouvrait **en même temps** que cette bourse, sur la même touche. Le joueur
 * avait donc deux fenêtres superposées, dont l'une répétait les chantiers, les
 * offres postées et les terres que celle-ci montre déjà, mieux : mesuré,
 * 5 411 px de contenu pour redire ce qui tenait ici en cinq onglets.
 *
 * Ne restaient en propre que la progression et la présence des voisins. Elles
 * ont leur onglet, et le panneau en double a disparu.
 */
function Objectifs({
  quests,
  busy,
  onClaim,
  pairs,
}: {
  quests: QuestView[];
  busy: boolean;
  onClaim?: (id: string) => void;
  pairs: OnlinePeer[];
}) {
  const live = pairs.filter((p) => p.online);
  return (
    <div className="objectifs">
      <section className="hall-block">
        <h3 className="spaced">Vos objectifs</h3>
        {quests.length === 0 ? (
          <p className="hdv-muted">Aucun objectif en cours.</p>
        ) : (
          <ul className="quest-list">
            {quests.map((q) => (
              <li key={q.id} className={q.claimed ? "claimed" : q.done ? "done" : ""}>
                <div className="quest-head">
                  <strong>{q.title}</strong>
                  <span className="quest-count">
                    {q.progress} / {q.target} {STAT_LABELS[q.stat]}
                  </span>
                </div>
                <div className="quest-bar" aria-hidden="true">
                  <i style={{ width: `${Math.round((q.progress / q.target) * 100)}%` }} />
                </div>
                <p className="muted tiny">{q.hint}</p>
                {q.claimed ? (
                  <span className="quest-paid">Encaissé</span>
                ) : q.done ? (
                  <button
                    type="button"
                    className="sale-go"
                    disabled={busy}
                    onClick={() => onClaim?.(q.id)}
                  >
                    Encaisser · {q.reward.crd} TRN + {q.reward.xp} XP
                  </button>
                ) : (
                  <span className="muted tiny">
                    Récompense : {q.reward.crd} TRN + {q.reward.xp} XP
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="hall-block">
        <h3 className="spaced">Qui est connecté</h3>
        {pairs.length === 0 ? (
          <p className="who-empty">Personne d’autre n’a encore de compte ici.</p>
        ) : live.length === 0 ? (
          <p className="who-empty">Personne d’autre n’est connecté pour l’instant.</p>
        ) : (
          <ul className="who-list">
            {pairs.map((p) => (
              <li key={p.id}>
                <span>
                  <strong>{p.name}</strong>
                </span>
                <span className="muted tiny who-status">
                  <i className={`who-dot ${p.online ? "on" : ""}`} aria-hidden="true" />
                  {seenLabel(p.online, p.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
