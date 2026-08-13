import { useState } from "react";
import {
  ACCENT_COLORS,
  BEARDS,
  CLOTH_COLORS,
  CLOTHES,
  EARS,
  EYE_COLORS,
  EYE_SHAPES,
  HAIRS,
  HAIR_COLORS,
  HAT_COLORS,
  HATS,
  MOUTHS,
  NOSES,
  SKIN_TONES,
  randomAppearance,
  type CharacterAppearance,
  type Specialization,
} from "@farmsim/shared";
import { LowPolyCharacter } from "./LowPolyCharacter";

type Props = {
  spec: Specialization;
  appearance: CharacterAppearance;
  onChange: (next: CharacterAppearance) => void;
};

type Row = {
  key: keyof CharacterAppearance;
  label: string;
  options: readonly { id: string; label: string; hex?: string }[];
};

type Tab = {
  id: string;
  label: string;
  rows: Row[];
  /** Cadrage du miroir : inutile de montrer les bottes en réglant un nez */
  frame: "full" | "bust";
};

/**
 * Onglets plutôt qu'une liste à onze rangs.
 *
 * Onze réglages empilés, c'est un formulaire administratif : on ne sait plus
 * par où commencer et le personnage sort de l'écran dès qu'on descend. Trois
 * familles tiennent chacune sous le personnage, qui reste visible pendant
 * qu'on le modifie — c'est tout l'intérêt d'un miroir.
 */
const TABS: Tab[] = [
  {
    id: "face",
    label: "Visage",
    frame: "bust",
    rows: [
      { key: "skin", label: "Peau", options: SKIN_TONES },
      { key: "eyeShape", label: "Regard", options: EYE_SHAPES },
      { key: "eyeColor", label: "Couleur des yeux", options: EYE_COLORS },
      { key: "nose", label: "Nez", options: NOSES },
      { key: "mouth", label: "Bouche", options: MOUTHS },
      { key: "ears", label: "Oreilles", options: EARS },
    ],
  },
  {
    id: "hair",
    label: "Coiffure",
    frame: "bust",
    rows: [
      { key: "hair", label: "Cheveux", options: HAIRS },
      { key: "hairColor", label: "Couleur", options: HAIR_COLORS },
      { key: "beard", label: "Barbe", options: BEARDS },
    ],
  },
  {
    id: "wear",
    label: "Tenue",
    frame: "full",
    rows: [
      { key: "clothes", label: "Vêtement", options: CLOTHES },
      { key: "clothColor", label: "Tissu", options: CLOTH_COLORS },
      { key: "accentColor", label: "Accent", options: ACCENT_COLORS },
      { key: "hat", label: "Chapeau", options: HATS },
      { key: "hatColor", label: "Couleur du chapeau", options: HAT_COLORS },
    ],
  },
];

export function CharacterCreator({ spec, appearance, onChange }: Props) {
  const [tab, setTab] = useState(TABS[0].id);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  function setPart(key: keyof CharacterAppearance, index: number) {
    onChange({ ...appearance, [key]: index });
  }

  /** Passe à l'option suivante ou précédente d'un rang, en boucle. */
  function step(row: Row, delta: number) {
    const len = row.options.length;
    const next = (((appearance[row.key] + delta) % len) + len) % len;
    setPart(row.key, next);
  }

  return (
    <div className="char-creator">
      <div className="char-stage">
        <LowPolyCharacter
          code={spec}
          appearance={appearance}
          active
          draggable
          frame={active.frame}
          height={340}
        />
        <p className="char-stage-hint">Glissez pour le faire tourner</p>
        <button type="button" className="char-dice" onClick={() => onChange(randomAppearance(spec))}>
          <span aria-hidden="true">🎲</span> Au hasard
        </button>
      </div>

      <div className="char-panel">
        <div className="char-tabs" role="tablist" aria-label="Familles de réglages">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              className={`char-tab ${t.id === tab ? "on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="char-rows">
          {active.rows.map((row) => {
            const current = row.options[appearance[row.key]] ?? row.options[0];
            const swatches = Boolean(current?.hex);
            return (
              <div key={row.key} className={`char-row ${swatches ? "colors" : ""}`}>
                <div className="char-row-head">
                  <span className="char-row-label">{row.label}</span>
                  {!swatches && <span className="char-row-value">{current?.label}</span>}
                  <span className="char-row-steps">
                    <button
                      type="button"
                      className="char-step"
                      aria-label={`${row.label} précédent`}
                      onClick={() => step(row, -1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="char-step"
                      aria-label={`${row.label} suivant`}
                      onClick={() => step(row, 1)}
                    >
                      ›
                    </button>
                  </span>
                </div>
                <div className="char-swatches" role="listbox" aria-label={row.label}>
                  {row.options.map((opt, i) => {
                    const on = appearance[row.key] === i;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="option"
                        aria-selected={on}
                        className={`char-swatch ${on ? "on" : ""} ${opt.hex ? "tone" : ""}`}
                        title={opt.label}
                        style={opt.hex ? { background: opt.hex } : undefined}
                        onClick={() => setPart(row.key, i)}
                      >
                        {opt.hex ? <span className="sr-only">{opt.label}</span> : opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
