import { useMemo, useState } from "react";
import {
  BEARDS,
  CLOTHES,
  EARS,
  EYE_SHAPES,
  HAIRS,
  HATS,
  MOUTHS,
  NOSES,
  defaultAppearance,
  randomAppearance,
  type CharacterAppearance,
} from "@farmsim/shared";
import { CharacterCreator } from "./CharacterCreator";
import { LowPolyCharacter } from "./LowPolyCharacter";

/**
 * Atelier — la planche de contact des personnages.
 *
 * Page de travail, hors jeu. Le catalogue de pièces compte plusieurs dizaines
 * de milliers de combinaisons : personne ne les regardera toutes, mais chaque
 * pièce doit être vue au moins une fois, isolée, avant d'arriver au champ.
 */

type Family = {
  id: string;
  label: string;
  key: keyof CharacterAppearance;
  options: readonly { id: string; label: string }[];
  /** Réglages neutralisés pour que la pièce examinée soit seule à l'écran */
  clear?: Partial<CharacterAppearance>;
};

const FAMILIES: Family[] = [
  { id: "hair", label: "Coiffures", key: "hair", options: HAIRS, clear: { hat: 0, beard: 0 } },
  { id: "beard", label: "Barbes", key: "beard", options: BEARDS, clear: { hat: 0 } },
  { id: "hat", label: "Chapeaux", key: "hat", options: HATS },
  { id: "clothes", label: "Tenues", key: "clothes", options: CLOTHES },
  { id: "eyes", label: "Regards", key: "eyeShape", options: EYE_SHAPES, clear: { hat: 0 } },
  { id: "nose", label: "Nez", key: "nose", options: NOSES, clear: { hat: 0 } },
  { id: "mouth", label: "Bouches", key: "mouth", options: MOUTHS, clear: { hat: 0 } },
  { id: "ears", label: "Oreilles", key: "ears", options: EARS, clear: { hat: 0, hair: 7 } },
];

/** Famille demandée dans l'URL (`?family=hat`) : la planche est aussi une
 *  page de capture, et huit canevas 3D rendent la page trop occupée pour
 *  répondre à un clic. */
function familyFromUrl(): string {
  if (typeof location === "undefined") return FAMILIES[0].id;
  const want = new URLSearchParams(location.search).get("family");
  return FAMILIES.some((f) => f.id === want) ? want! : FAMILIES[0].id;
}

export function CharacterShowcase() {
  const [family, setFamily] = useState(familyFromUrl);
  const [look, setLook] = useState<CharacterAppearance>(() => defaultAppearance("CEREALIER"));
  const active = FAMILIES.find((f) => f.id === family) ?? FAMILIES[0];

  // `?solo` n'affiche que le menu : une planche entière de canevas 3D met à
  // genoux un rendu logiciel, et juger un visage demande du plein régime.
  const solo = typeof location !== "undefined" && location.search.includes("solo");
  if (solo) {
    return (
      <div className="atelier">
        <section className="atelier-farm">
          <h2>Le menu de création</h2>
          <CharacterCreator spec="CEREALIER" appearance={look} onChange={setLook} />
        </section>
      </div>
    );
  }

  const crowd = useMemo(
    () => Array.from({ length: 8 }, () => randomAppearance(Math.random() < 0.5 ? "ELEVEUR" : "CEREALIER")),
    [],
  );

  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — personnages 3D</h1>
        <p>
          Le catalogue de pièces, chacune isolée sur son plateau, puis la foule telle
          qu'elle sortira du tirage au sort. Les personnages respirent, clignent des
          yeux et saluent : tout ce qui bouge ici bougera au champ.
        </p>
        <div className="atelier-controls">
          {FAMILIES.map((f) => (
            <label key={f.id}>
              <input
                type="radio"
                name="family"
                checked={family === f.id}
                onChange={() => setFamily(f.id)}
              />
              {f.label}
            </label>
          ))}
        </div>
      </header>

      <div className="atelier-grid">
        {active.options.map((opt, i) => (
          <article className="atelier-card" key={opt.id}>
            <LowPolyCharacter
              code="CEREALIER"
              appearance={{ ...defaultAppearance("CEREALIER"), ...active.clear, [active.key]: i }}
              showProp={false}
              active
              height={320}
            />
            <div className="atelier-meta">
              <h2>{opt.label}</h2>
              <p className="atelier-tags">
                {active.label} · nº{i}
              </p>
            </div>
          </article>
        ))}
      </div>

      <section className="atelier-farm">
        <h2>Le menu de création</h2>
        <CharacterCreator spec="CEREALIER" appearance={look} onChange={setLook} />
      </section>

      <section className="atelier-farm">
        <h2>Huit tirages au sort</h2>
        <div className="atelier-grid">
          {crowd.map((one, i) => (
            <article className="atelier-card" key={i}>
              <LowPolyCharacter
                code={i % 2 ? "ELEVEUR" : "CEREALIER"}
                appearance={one}
                showProp={i < 2}
                height={320}
              />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
