import type { PointerEvent as ReactPointerEvent } from "react";
import {
  CROP_DEFS,
  STAT_LABELS,
  WORK_LABELS,
  type CropCode,
  type FarmWork,
  type QuestView,
} from "@farmsim/shared";
import { ZoneMap, type ZoneMapZone } from "./ZoneMap";

export type OnlinePeer = {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: number | null;
};

export type HelpWanted = {
  id: string;
  work: FarmWork;
  crop: string | null;
  remaining: number;
  payoutCrd: number;
  clientName: string;
};

export type MyHelpAsk = {
  id: string;
  work: FarmWork;
  remaining: number;
  escrowCrd: number;
  status: string;
};

export type SoloMission = {
  id: string;
  title: string;
  cells?: number;
  rewardCrd: number;
};

type ExpandZone = ZoneMapZone & { id: string; parcels: ZoneMapZone["parcels"] };

type Props = {
  className?: string;
  /** Objectifs du joueur, avec leur avancement */
  quests?: QuestView[];
  onClaimQuest?: (id: string) => void;
  gesture?: {
    onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp?: (e: ReactPointerEvent<HTMLElement>) => void;
  };
  busy: boolean;
  onlinePlayers: OnlinePeer[];
  visitName?: string | null;
  visitLeft?: number | null;
  helpWanted: HelpWanted[];
  myAsks: MyHelpAsk[];
  solo: SoloMission[];
  onAcceptHelp: (id: string) => void;
  onCancelAsk: (id: string) => void;
  onAcceptSolo: (id: string) => void;
  locked: boolean;
  zones: ExpandZone[];
  myFarmId?: string;
  expandableIds: ReadonlySet<string>;
  /**
   * Ouvre la bourse des chantiers.
   *
   * Sur téléphone, l'onglet « Missions » ouvrait **deux surfaces à la fois** :
   * ce tiroir, et la modale de la bourse par-dessus. Le joueur voyait donc la
   * bourse, sans jamais savoir que le tiroir existait — quêtes et voisins
   * compris. La bourse s'ouvre désormais d'ici, comme elle s'ouvre du bandeau
   * sur bureau : un toucher, une surface.
   */
  onOpenBoard?: () => void;
  onBuyField: (parcelId: string) => void;
};

function seenLabel(online: boolean, lastSeenAt: number | null): string {
  if (online) return "connecté";
  if (!lastSeenAt) return "pas encore vu";
  const min = Math.max(1, Math.round((Date.now() - lastSeenAt) / 60_000));
  if (min < 60) return `il y a ${min} min`;
  return `il y a ${Math.round(min / 60)} h`;
}

function cropName(code: string | null): string {
  if (!code) return "";
  return CROP_DEFS[code as CropCode]?.name ?? "";
}

function jobTitle(work: FarmWork, crop: string | null, who?: string): string {
  const cropBit = cropName(crop);
  const what = cropBit ? `${WORK_LABELS[work]} ${cropBit.toLowerCase()}` : WORK_LABELS[work];
  return who ? `${what} chez ${who}` : what;
}

export function MissionsPanel({
  className,
  gesture,
  busy,
  quests,
  onClaimQuest,
  onlinePlayers,
  visitName,
  visitLeft,
  helpWanted,
  myAsks,
  solo,
  onAcceptHelp,
  onCancelAsk,
  onAcceptSolo,
  locked,
  zones,
  myFarmId,
  expandableIds,
  onBuyField,
  onOpenBoard,
}: Props) {
  const live = onlinePlayers.filter((p) => p.online);
  const away = onlinePlayers.filter((p) => !p.online);

  return (
    <aside className={className} {...gesture}>
      <h3>Missions</h3>
      <p className="muted tiny">Aidez un voisin. On vous paie. Il faut la machine.</p>

      {onOpenBoard && (
        <button type="button" className="board-open" onClick={onOpenBoard}>
          <span>
            <strong>Bourse des chantiers</strong>
            <em>
              {helpWanted.length > 0
                ? `${helpWanted.length} chantier${helpWanted.length > 1 ? "s" : ""} à prendre`
                : "Aucun chantier ouvert"}
              {myAsks.length > 0 ? ` · ${myAsks.length} posté${myAsks.length > 1 ? "s" : ""}` : ""}
            </em>
          </span>
          <span className="board-open-go" aria-hidden="true">→</span>
        </button>
      )}

      {quests && quests.length > 0 && (
        <section className="hall-block">
          <h3 className="spaced">Vos objectifs</h3>
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
                    onClick={() => onClaimQuest?.(q.id)}
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
        </section>
      )}

      <section className="hall-block">
        <h3 className="spaced">Qui est connecté</h3>
        {onlinePlayers.length === 0 ? (
          <p className="who-empty">Personne d’autre n’a encore de compte ici.</p>
        ) : live.length === 0 ? (
          <p className="who-empty">
            Personne d’autre n’est connecté pour l’instant.
            {away[0] ? ` Dernier passage : ${away[0].name}, ${seenLabel(false, away[0].lastSeenAt)}.` : ""}
          </p>
        ) : (
          <ul className="who-list">
            {onlinePlayers.map((p) => (
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

      {visitName && (
        <p className="visit-now">
          Vous aidez <strong>{visitName}</strong> — encore {visitLeft ?? 0} case
          {(visitLeft ?? 0) > 1 ? "s" : ""}.
        </p>
      )}

      <section className="hall-block">
        <h3 className="spaced">On a besoin d’aide</h3>
        {helpWanted.length === 0 ? (
          <p className="muted tiny">Personne n’a demandé d’aide pour l’instant.</p>
        ) : (
          <div className="job-grid">
            {helpWanted.map((o) => (
              <article key={o.id} className="job-card big">
                <div>
                  <strong>{jobTitle(o.work, o.crop, o.clientName)}</strong>
                  <div className="muted tiny">
                    {o.remaining} cases · {o.payoutCrd} TRN
                  </div>
                </div>
                <button type="button" className="sale-go" disabled={busy || locked} onClick={() => onAcceptHelp(o.id)}>
                  J’y vais
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {myAsks.length > 0 && (
        <section className="hall-block">
          <h3 className="spaced">J’ai demandé de l’aide</h3>
          <div className="job-grid">
            {myAsks.map((o) => (
              <article key={o.id} className="job-card big">
                <div>
                  <strong>
                    {WORK_LABELS[o.work]} ·{" "}
                    {o.status === "ACCEPTED" ? "quelqu’un s’en occupe" : "en attente"}
                  </strong>
                  <div className="muted tiny">
                    {o.remaining} cases · {o.escrowCrd} TRN mis de côté
                  </div>
                </div>
                {o.status === "OPEN" && (
                  <button type="button" disabled={busy} onClick={() => onCancelAsk(o.id)}>
                    Annuler
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="hall-block">
        <h3 className="spaced">Personne n’est là ?</h3>
        <p className="muted tiny">Travail tout seul, moins payé.</p>
        <div className="job-grid">
          {solo.map((c) => (
            <article key={c.id} className="job-card big">
              <div>
                <strong>{c.title}</strong>
                <div className="muted tiny">
                  {c.cells ?? "?"} cases · {c.rewardCrd} TRN
                </div>
              </div>
              <button
                type="button"
                className="sale-go"
                disabled={busy || locked}
                onClick={() => onAcceptSolo(c.id)}
              >
                Prendre
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="hall-block">
        <h3 className="spaced">Acheter le champ d’à côté</h3>
        <div className="zone-maps">
          {zones.map((z) => (
            <ZoneMap
              key={z.id}
              zone={z}
              myFarmId={myFarmId}
              selectableIds={expandableIds}
              onSelect={onBuyField}
              compact
            />
          ))}
        </div>
        {expandableIds.size === 0 ? (
          <p className="muted tiny">Aucun champ libre juste à côté.</p>
        ) : null}
      </section>
    </aside>
  );
}
