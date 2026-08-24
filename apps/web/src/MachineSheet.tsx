import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  MACHINE_DEFS,
  MACHINE_STAR_LABELS,
  MACHINE_TIERS,
  MAX_MACHINE_TIER,
  TIER_LABELS,
  TIER_ROLE_LABELS,
  machineOverhaulCost,
  machineUpgradeCost,
  machineVariant,
  nextMachineTier,
  type MachineStars,
  type MachineType,
  type MachineVariant,
  type Tier,
} from "@farmsim/shared";
import { MenuClose } from "./ui/MenuClose";
import { MachineView3D } from "./MachineView3D";

export type MachinePreview =
  | { mode: "buy"; type: MachineType; tier: Tier }
  | {
      mode: "upgrade" | "inspect";
      machineId: string;
      type: MachineType;
      currentTier: Tier;
    };

type Props = {
  preview: MachinePreview;
  crd: number;
  busy: boolean;
  placeAuGarage: boolean;
  onClose: () => void;
  onBuy: (type: MachineType, tier: Tier) => void;
  onUpgrade: (machineId: string) => void;
  /** Passer de la fiche actuelle à la prévisualisation du palier suivant. */
  onWantUpgrade?: () => void;
};

export function MachineStarStrip({ stars }: { stars: MachineStars }) {
  return (
    <span className="machine-stars">
      {MACHINE_STAR_LABELS.map((axe) => (
        <span key={axe.key} title={axe.title}>
          <i>{axe.short}</i>
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <b key={n} className={`pip${stars[axe.key] >= n ? " on" : ""}`} />
          ))}
        </span>
      ))}
    </span>
  );
}

export function MachineTierPips({
  tier,
  next,
}: {
  tier: Tier;
  /** Palier visé, pour allumer le cran suivant en attente. */
  next?: Tier | null;
}) {
  return (
    <span className="level-row machine-tier-pips" aria-label={`Palier ${TIER_LABELS[tier]}`}>
      {MACHINE_TIERS.map((t) => (
        <i
          key={t}
          className={`pip${t <= tier ? " on" : ""}${next === t ? " next" : ""}`}
          title={`${TIER_LABELS[t]} · ${TIER_ROLE_LABELS[t]}`}
        />
      ))}
      <em>
        {TIER_LABELS[tier]} · {TIER_ROLE_LABELS[tier]}
      </em>
    </span>
  );
}

function ficheLignes(type: MachineType, fiche: MachineVariant) {
  const def = MACHINE_DEFS[type];
  const lignes: { label: string; value: string; raw: number }[] = [];
  if (def.kind === "TRACTOR") {
    lignes.push({ label: "Puissance", value: `${fiche.powerHp ?? 0} ch`, raw: fiche.powerHp ?? 0 });
  } else if (def.kind === "SELF_PROPELLED") {
    lignes.push({ label: "Puissance", value: `${fiche.powerHp ?? 0} ch`, raw: fiche.powerHp ?? 0 });
    lignes.push({ label: "Largeur", value: `${fiche.widthM} m`, raw: fiche.widthM });
  } else {
    lignes.push({ label: "Largeur", value: `${fiche.widthM} m`, raw: fiche.widthM });
    lignes.push({
      label: "Chevaux requis",
      value: `${fiche.requiredHp ?? 0} ch`,
      raw: fiche.requiredHp ?? 0,
    });
  }
  if (fiche.capacityL) {
    lignes.push({
      label: "Capacité",
      value: `${fiche.capacityL.toLocaleString("fr-FR")} L`,
      raw: fiche.capacityL,
    });
  }
  lignes.push({ label: "Vitesse", value: `${fiche.speedKmh} km/h`, raw: fiche.speedKmh });
  lignes.push({ label: "Conso", value: `${fiche.fuelLPerHour} L/h`, raw: fiche.fuelLPerHour });
  lignes.push({
    label: "Prix neuf",
    value: `${fiche.cost.toLocaleString("fr-FR")} €`,
    raw: fiche.cost,
  });
  return lignes;
}

function deltaTexte(from: number, to: number): string | null {
  const d = to - from;
  if (d === 0) return null;
  const sign = d > 0 ? "+" : "−";
  return `${sign}${Math.abs(d).toLocaleString("fr-FR")}`;
}

/**
 * Fiche d'un engin : illustration 3D, palier, caractéristiques, bonus, prix.
 *
 * Le catalogue achetait d'un clic, et le garage ne disait pas qu'un tracteur
 * a cinq modèles. Ici on **regarde** avant de payer — à l'achat comme à
 * l'amélioration.
 */
export function MachineSheet({
  preview,
  crd,
  busy,
  placeAuGarage,
  onClose,
  onBuy,
  onUpgrade,
  onWantUpgrade,
}: Props) {
  const [tierAchat, setTierAchat] = useState<Tier>(preview.mode === "buy" ? preview.tier : 1);

  useEffect(() => {
    if (preview.mode === "buy") setTierAchat(preview.tier);
  }, [preview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const type = preview.type;
  const def = MACHINE_DEFS[type];
  const currentTier = preview.mode === "buy" ? tierAchat : preview.currentTier;
  const next = preview.mode === "buy" ? null : nextMachineTier(preview.currentTier);
  const shownTier: Tier =
    preview.mode === "upgrade" && next ? next : preview.mode === "buy" ? tierAchat : currentTier;
  const fiche = machineVariant(type, shownTier);
  const actuelle = preview.mode === "buy" ? null : machineVariant(type, preview.currentTier);
  const coutUpgrade =
    preview.mode === "buy" ? null : machineUpgradeCost(type, preview.currentTier);
  const prixAchat = fiche.cost;
  const lignes = ficheLignes(type, fiche);
  const lignesAvant = actuelle ? ficheLignes(type, actuelle) : null;

  const achatBloque =
    preview.mode === "buy"
      ? !placeAuGarage
        ? "Garage plein — agrandissez le hangar ou revendez un engin."
        : crd < prixAchat
          ? `Il vous manque ${(prixAchat - crd).toLocaleString("fr-FR")} €.`
          : null
      : null;
  const upgradeBloque =
    preview.mode !== "buy" && coutUpgrade != null
      ? crd < coutUpgrade
        ? `Il vous manque ${(coutUpgrade - crd).toLocaleString("fr-FR")} €.`
        : null
      : next == null && preview.mode !== "buy"
        ? "Cet engin est déjà au palier maximum."
        : null;

  const titre =
    preview.mode === "upgrade"
      ? `Améliorer · ${TIER_LABELS[currentTier]} → ${TIER_LABELS[shownTier]}`
      : preview.mode === "inspect"
        ? fiche.label
        : `Acheter · ${fiche.label}`;

  const ficheEl = (
    <div className="sheet-backdrop machine-sheet-backdrop" onClick={onClose}>
      <div
        className="building-sheet machine-sheet glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="machine-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <h3 id="machine-sheet-title">{titre}</h3>
            <p className="building-sheet-sub">
              {TIER_LABELS[shownTier]} · {TIER_ROLE_LABELS[shownTier]}
              {def.kind === "TRACTOR"
                ? " · porteur"
                : def.kind === "SELF_PROPELLED"
                  ? " · automoteur"
                  : " · outil"}
            </p>
          </div>
          <MenuClose onClose={onClose} />
        </header>

        <div className="machine-sheet-body">
        <div className="machine-sheet-art">
          <MachineView3D type={type} tier={shownTier} height={260} turntable />
        </div>

        {preview.mode === "buy" ? (
          <div className="age-switch" role="group" aria-label="Palier de matériel">
            {MACHINE_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                className={tierAchat === t ? "on" : ""}
                aria-pressed={tierAchat === t}
                title={TIER_ROLE_LABELS[t]}
                onClick={() => setTierAchat(t)}
              >
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>
        ) : (
          <div className="building-sheet-level">
            <MachineTierPips
              tier={preview.currentTier}
              next={preview.mode === "upgrade" ? next : undefined}
            />
          </div>
        )}

        <p className="building-sheet-desc">{fiche.bonus}</p>

        <dl className="machine-sheet-stats">
          {lignes.map((l) => {
            const avant = lignesAvant?.find((a) => a.label === l.label);
            const d = avant ? deltaTexte(avant.raw, l.raw) : null;
            return (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>
                  {preview.mode === "upgrade" && avant && avant.raw !== l.raw ? (
                    <>
                      <s>{avant.value}</s> {l.value}
                      {d && <b className={l.raw > avant.raw ? "gain" : "perte"}>{d}</b>}
                    </>
                  ) : (
                    l.value
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        <p className="muted tiny">{fiche.constraints}</p>
        <p className="muted tiny">{fiche.compatible}</p>
        <MachineStarStrip stars={fiche.stars} />
        <p className="muted tiny">
          Révision {machineOverhaulCost(fiche.cost).toLocaleString("fr-FR")} € · {fiche.fuelLPerHour}{" "}
          L/h
        </p>

        {preview.mode === "upgrade" && coutUpgrade != null && (
          <p className="machine-sheet-note">
            L’engin actuel est repris : vous recevez le {TIER_LABELS[shownTier]}, neuf, compteur à
            zéro. Écart de catalogue :{" "}
            <strong>{coutUpgrade.toLocaleString("fr-FR")} €</strong>.
          </p>
        )}
        </div>

        <footer className="machine-sheet-foot">
        <div className="building-sheet-actions machine-sheet-actions">
          {preview.mode === "buy" && (
            <button
              type="button"
              className="upgrade-btn"
              disabled={busy || Boolean(achatBloque)}
              title={achatBloque ?? `Acheter le ${TIER_LABELS[shownTier]}`}
              onClick={() => onBuy(type, shownTier)}
            >
              Acheter · {prixAchat.toLocaleString("fr-FR")} €
            </button>
          )}
          {preview.mode === "upgrade" && coutUpgrade != null && (
            <button
              type="button"
              className="upgrade-btn"
              disabled={busy || Boolean(upgradeBloque)}
              title={upgradeBloque ?? `Passer au ${TIER_LABELS[shownTier]}`}
              onClick={() => preview.mode === "upgrade" && onUpgrade(preview.machineId)}
            >
              Confirmer · {coutUpgrade.toLocaleString("fr-FR")} €
            </button>
          )}
          {preview.mode === "inspect" && next && coutUpgrade != null && (
            <button
              type="button"
              className="upgrade-btn"
              disabled={busy}
              title={`Prévisualiser le ${TIER_LABELS[next]}`}
              onClick={() => onWantUpgrade?.()}
            >
              Améliorer · {coutUpgrade.toLocaleString("fr-FR")} €
            </button>
          )}
          {preview.mode === "inspect" && !next && (
            <span className="upgrade-max">Niveau max · {TIER_LABELS[MAX_MACHINE_TIER]}</span>
          )}
          <button type="button" className="ghost" onClick={onClose}>
            Fermer
          </button>
        </div>
        {(achatBloque || (preview.mode === "upgrade" && upgradeBloque)) && (
          <p className="machine-sheet-block">{achatBloque ?? upgradeBloque}</p>
        )}
        </footer>
      </div>
    </div>
  );

  return createPortal(ficheEl, document.body);
}
