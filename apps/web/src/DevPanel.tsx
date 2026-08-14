import { useState } from "react";
import { SELLABLE_GOODS, GOOD_DEFS, xpForLevel, type TradeGood } from "@farmsim/shared";

export type DevGrant = {
  crd?: number;
  level?: number;
  xp?: number;
  stock?: { commodity: TradeGood; tons: number };
  ripenAll?: boolean;
  feedHerds?: boolean;
  fixMachines?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onGrant: (grant: DevGrant) => void;
  onTick: () => void;
};

/** Montants proposés d'un geste : couvrir les cas courants sans saisie. */
const PRESETS = [10_000, 100_000, 1_000_000];

/**
 * Panneau de test.
 *
 * Il n'existe que si le serveur l'autorise — variable `FARMSIM_DEV_TOOLS` —,
 * faute de quoi n'importe quel joueur se servirait. Son rôle est d'éprouver
 * une mécanique sans y passer l'après-midi : monter une trésorerie, amener un
 * champ à maturité, remplir une mangeoire.
 */
export function DevPanel({ open, onClose, busy, onGrant, onTick }: Props) {
  const [crd, setCrd] = useState(100_000);
  const [level, setLevel] = useState(10);
  const [good, setGood] = useState<TradeGood>("WHEAT");
  const [tons, setTons] = useState(50);

  if (!open) return null;

  return (
    <div className="market-backdrop" role="dialog" aria-modal="true" aria-label="Outils de test">
      <div className="market-sheet glass dev-panel">
        <header className="market-head">
          <h2>Outils de test</h2>
          <button type="button" className="ghost" onClick={onClose}>
            Fermer
          </button>
        </header>
        <p className="muted tiny">
          Ce panneau n’apparaît que sur une installation où les outils de test
          sont activés. Il ne s’affichera pas en production.
        </p>

        <section className="dev-row">
          <label className="market-field">
            <span>Trésorerie</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={crd}
              onChange={(e) => setCrd(Number(e.target.value))}
            />
          </label>
          <div className="dev-actions">
            {PRESETS.map((p) => (
              <button key={p} type="button" className="ghost" onClick={() => setCrd(p)}>
                {p.toLocaleString("fr-FR")}
              </button>
            ))}
            <button
              type="button"
              className="accent"
              disabled={busy}
              onClick={() => onGrant({ crd })}
            >
              Appliquer
            </button>
          </div>
        </section>

        <section className="dev-row">
          <label className="market-field">
            <span>Niveau du joueur</span>
            <input
              type="number"
              min={1}
              max={50}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
          </label>
          <div className="dev-actions">
            <button
              type="button"
              className="accent"
              disabled={busy}
              // L'expérience se lit sur la courbe, pas sur une constante d'affichage :
              // « niveau 6, 1 500 XP » fabriquait un état que le jeu ne peut pas
              // produire, et le refus d'achat de parcelle disait alors n'importe quoi.
              onClick={() => onGrant({ level, xp: xpForLevel(level) })}
            >
              Appliquer
            </button>
          </div>
        </section>

        <section className="dev-row">
          <label className="market-field">
            <span>Ajouter au silo</span>
            <select value={good} onChange={(e) => setGood(e.target.value as TradeGood)}>
              {SELLABLE_GOODS.map((g) => (
                <option key={g} value={g}>
                  {GOOD_DEFS[g].name}
                </option>
              ))}
            </select>
          </label>
          <label className="market-field">
            <span>Quantité (t)</span>
            <input
              type="number"
              min={0}
              step={5}
              value={tons}
              onChange={(e) => setTons(Number(e.target.value))}
            />
          </label>
          <div className="dev-actions">
            <button
              type="button"
              className="accent"
              disabled={busy}
              onClick={() => onGrant({ stock: { commodity: good, tons } })}
            >
              Ajouter
            </button>
          </div>
        </section>

        <section className="dev-row">
          <div className="dev-actions wide">
            <button type="button" className="ghost" disabled={busy} onClick={() => onGrant({ ripenAll: true })}>
              Amener les cultures à maturité
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => onGrant({ feedHerds: true })}>
              Nourrir tous les troupeaux
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={() => onGrant({ fixMachines: true })}>
              Remettre les machines à neuf
            </button>
            <button type="button" className="ghost" disabled={busy} onClick={onTick}>
              Avancer le monde d’un tick
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
