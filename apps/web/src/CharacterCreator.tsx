import {
  ACCENT_COLORS,
  CLOTH_COLORS,
  CLOTHES,
  EARS,
  EYE_COLORS,
  EYE_SHAPES,
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

const ROWS: Row[] = [
  { key: "skin", label: "Peau", options: SKIN_TONES },
  { key: "eyeColor", label: "Yeux", options: EYE_COLORS },
  { key: "eyeShape", label: "Forme des yeux", options: EYE_SHAPES },
  { key: "nose", label: "Nez", options: NOSES },
  { key: "mouth", label: "Bouche", options: MOUTHS },
  { key: "ears", label: "Oreilles", options: EARS },
  { key: "hat", label: "Chapeau", options: HATS },
  { key: "hatColor", label: "Couleur du chapeau", options: HAT_COLORS },
  { key: "clothes", label: "Vêtements", options: CLOTHES },
  { key: "clothColor", label: "Tissu", options: CLOTH_COLORS },
  { key: "accentColor", label: "Accent", options: ACCENT_COLORS },
];

export function CharacterCreator({ spec, appearance, onChange }: Props) {
  function setPart(key: keyof CharacterAppearance, index: number) {
    onChange({ ...appearance, [key]: index });
  }

  return (
    <div className="char-creator">
      <div className="char-stage">
        <LowPolyCharacter code={spec} appearance={appearance} active height={260} />
        <button
          type="button"
          className="chip"
          onClick={() => onChange(randomAppearance(spec))}
        >
          Au hasard
        </button>
      </div>
      <div className="char-rows">
        {ROWS.map((row) => (
          <div key={row.key} className="char-row">
            <span className="char-row-label">{row.label}</span>
            <div className="char-swatches" role="listbox" aria-label={row.label}>
              {row.options.map((opt, i) => {
                const on = appearance[row.key] === i;
                const hex = "hex" in opt ? opt.hex : undefined;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`char-swatch ${on ? "on" : ""} ${hex ? "tone" : ""}`}
                    aria-pressed={on}
                    title={opt.label}
                    style={hex ? { background: hex } : undefined}
                    onClick={() => setPart(row.key, i)}
                  >
                    {hex ? <span className="sr-only">{opt.label}</span> : opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
