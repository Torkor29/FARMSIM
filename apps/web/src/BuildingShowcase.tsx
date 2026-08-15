import { useState } from "react";
import { BUILDING_DEFS, orientedFootprint, type BuildingType } from "@farmsim/shared";
import { BuildingView } from "./BuildingView";

const TYPES = Object.keys(BUILDING_DEFS) as BuildingType[];

/**
 * Atelier — la planche de contact du bâti.
 *
 * Page de travail, hors jeu. Les tests mesurent déjà qu'un modèle touche la
 * terre, tient dans son empreinte aux quatre rotations et reste sous le budget
 * de triangles. Ils ne disent rien de ce à quoi il **ressemble** : qu'on
 * reconnaisse une étable d'un poulailler, que le niveau 5 se voie, qu'un
 * vantail s'ouvre du bon côté. Cette page-là est faite pour l'œil.
 *
 * Elle est pilotée par l'URL plutôt que par des clics : sur une page qui porte
 * une quinzaine de canevas WebGL, les clics d'un pilote automatique expirent.
 *
 *   ?type=BUNKER_SILO   n'affiche qu'un type
 *   ?level=5            fige le niveau
 *   ?rot=1              fige la rotation
 *   ?open               ouvre les vantaux
 *   ?levels             déroule les cinq niveaux du type choisi
 *   ?rots               déroule les quatre rotations du type choisi
 */
export function BuildingShowcase() {
  const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
  const seul = params.get("type") as BuildingType | null;
  const forceLevel = params.has("level") ? Number(params.get("level")) : null;
  const forceRot = params.has("rot") ? Number(params.get("rot")) : null;

  const [level, setLevel] = useState(forceLevel ?? 1);
  const [rotation, setRotation] = useState(forceRot ?? 0);
  const [open, setOpen] = useState(params.has("open"));
  const [big, setBig] = useState(false);

  const type = seul && BUILDING_DEFS[seul] ? seul : null;

  // Les deux planches de comparaison : un seul type, décliné.
  if (type && params.has("levels")) {
    return (
      <Planche
        titre={`${BUILDING_DEFS[type].name} — les cinq niveaux`}
        cartes={[1, 2, 3, 4, 5].map((l) => ({
          cle: `l${l}`,
          legende: `Niveau ${l}`,
          type,
          level: l,
          rotation,
        }))}
        open={open}
      />
    );
  }
  if (type && params.has("rots")) {
    return (
      <Planche
        titre={`${BUILDING_DEFS[type].name} — les quatre orientations`}
        cartes={[0, 1, 2, 3].map((r) => {
          const f = orientedFootprint(type, r);
          return {
            cle: `r${r}`,
            legende: `${r} quart${r > 1 ? "s" : ""} de tour · ${f.w}×${f.h}`,
            type,
            level,
            rotation: r,
          };
        })}
        open={open}
      />
    );
  }

  const liste = type ? [type] : TYPES;

  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — le bâti en 3D</h1>
        <p>
          Les {TYPES.length} constructions du jeu, en géométrie procédurale, chacune sur le
          damier de son emprise. Le damier n'est pas décoratif : il montre les cases
          réellement occupées, et c'est là qu'on voit d'un coup d'œil si un modèle
          déborde, flotte ou mord sur la parcelle voisine.
        </p>
        <div className="atelier-controls">
          <label className="atelier-speed">
            Niveau
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
            <span>{level}</span>
          </label>
          <label className="atelier-speed">
            Rotation
            <input
              type="range"
              min={0}
              max={3}
              step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
            />
            <span>{rotation} quart(s)</span>
          </label>
          <label>
            <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
            Vantaux ouverts
          </label>
          <label>
            <input type="checkbox" checked={big} onChange={(e) => setBig(e.target.checked)} />
            Grand format
          </label>
        </div>
      </header>

      <div className={`atelier-grid ${big ? "big" : ""}`}>
        {liste.map((t) => {
          const def = BUILDING_DEFS[t];
          const f = orientedFootprint(t, rotation);
          return (
            <article className="atelier-card" key={t}>
              <BuildingView
                type={t}
                level={level}
                rotation={rotation}
                open={open}
                height={big ? 520 : 260}
              />
              <div className="atelier-meta">
                <h2>{def.name}</h2>
                <p>{def.description}</p>
                <p className="atelier-tags">
                  {f.w}×{f.h} cases · {def.cost} TRN
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

type Carte = {
  cle: string;
  legende: string;
  type: BuildingType;
  level: number;
  rotation: number;
};

function Planche({ titre, cartes, open }: { titre: string; cartes: Carte[]; open: boolean }) {
  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>{titre}</h1>
      </header>
      <div className="atelier-grid">
        {cartes.map((c) => (
          <article className="atelier-card" key={c.cle}>
            <BuildingView
              type={c.type}
              level={c.level}
              rotation={c.rotation}
              open={open}
              height={280}
            />
            <div className="atelier-meta">
              <h2>{c.legende}</h2>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
