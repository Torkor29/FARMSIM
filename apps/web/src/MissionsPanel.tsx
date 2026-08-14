import type { PointerEvent as ReactPointerEvent } from "react";
import { CROP_DEFS, WORK_LABELS, type CropCode, type FarmWork } from "@farmsim/shared";
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

type ExpandZone = ZoneMapZone & { id: string; parcels: ZoneMapZone["parcels"] };

type Props = {
  className?: string;
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
  onAcceptHelp: (id: string) => void;
  onCancelAsk: (id: string) => void;
  onClose?: () => void;
  locked: boolean;
  zones: ExpandZone[];
  myFarmId?: string;
  expandableIds: ReadonlySet<string>;
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
  onlinePlayers,
  visitName,
  visitLeft,
  helpWanted,
  myAsks,
  onAcceptHelp,
  onCancelAsk,
  onClose,
  locked,
  zones,
  myFarmId,
  expandableIds,
  onBuyField,
}: Props) {
  const live = onlinePlayers.filter((p) => p.online);
  const away = onlinePlayers.filter((p) => !p.online);

  return (
    <aside className={className} {...gesture}>
      <div className="sheet-head">
        <h3>Missions</h3>
        {onClose && (
          <button type="button" className="sheet-close" aria-label="Fermer" onClick={onClose}>
            ×
          </button>
        )}
      </div>
      <p className="muted tiny">Aidez un voisin. On vous paie. Il faut la machine.</p>

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
        <p className="muted tiny">
          Les fermes voisines arrivent bientôt. En attendant, aidez un joueur : vous
          travaillez sur sa parcelle, avec vos machines.
        </p>
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
