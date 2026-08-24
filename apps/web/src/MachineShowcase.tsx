import { useEffect, useMemo, useState } from "react";
import { MACHINE_DEFS, MACHINE_TIERS, TIER_LABELS, type MachineType, type MachineTier } from "@farmsim/shared";
import { MachineView3D } from "./MachineView3D";
import { IsoFarmView, type IsoBuilding, type IsoCell } from "./IsoFarmView";
import { isTowedImplement } from "./machines3d";

const TYPES = Object.keys(MACHINE_DEFS) as MachineType[];

/**
 * Atelier — la planche de contact du parc matériel.
 *
 * Page de travail, hors jeu : elle sert à juger les engins sous l'angle de la
 * vue ferme, à l'arrêt comme au travail, avant de les envoyer au champ.
 */
export function MachineShowcase() {
  // `?iso` n'affiche que la vue ferme : cinq canevas 3D sur une même page
  // suffisent à mettre à genoux un rendu logiciel, et l'inspection des effets
  // demande justement du plein régime.
  const isoOnly = typeof location !== "undefined" && location.search.includes("iso");
  const [working, setWorking] = useState(true);
  const [speed, setSpeed] = useState(1.6);
  const [towed, setTowed] = useState(true);
  const [turntable, setTurntable] = useState(true);
  const [big, setBig] = useState(false);
  const [tier, setTier] = useState<MachineTier>(1);

  if (isoOnly) {
    return (
      <div className="atelier">
        <FarmPreview tier={tier} />
      </div>
    );
  }

  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — parc matériel 3D</h1>
        <p>
          Les onze engins du jeu, montés en géométrie procédurale et animés par la
          distance parcourue. Cinq paliers par famille : un T5 n’est pas un T1 agrandi
          — plus de corps, une rampe plus large, un jumelage, une presse cubique.
        </p>
        <div className="atelier-controls">
          <span className="atelier-speed">
            Palier
            {MACHINE_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                className={tier === t ? "on" : ""}
                aria-pressed={tier === t}
                onClick={() => setTier(t)}
              >
                {TIER_LABELS[t]}
              </button>
            ))}
          </span>
          <label>
            <input type="checkbox" checked={working} onChange={(e) => setWorking(e.target.checked)} />
            Au travail
          </label>
          <label>
            <input type="checkbox" checked={towed} onChange={(e) => setTowed(e.target.checked)} />
            Outils attelés
          </label>
          <label>
            <input type="checkbox" checked={turntable} onChange={(e) => setTurntable(e.target.checked)} />
            Plateau tournant
          </label>
          <label>
            <input type="checkbox" checked={big} onChange={(e) => setBig(e.target.checked)} />
            Grand format
          </label>
          <label className="atelier-speed">
            Vitesse
            <input
              type="range"
              min={0.4}
              max={3.2}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span>{speed.toFixed(1)} case/s</span>
          </label>
        </div>
      </header>

      <div className={`atelier-grid ${big ? "big" : ""}`}>
        {TYPES.map((type) => {
          const def = MACHINE_DEFS[type];
          return (
            <article className="atelier-card" key={type}>
              <MachineView3D
                type={type}
                height={big ? 560 : 300}
                working={working}
                speed={speed}
                towed={towed}
                turntable={turntable}
                tier={tier}
              />
              <div className="atelier-meta">
                <h2>{def.name}</h2>
                <p>{def.description}</p>
                <p className="atelier-tags">
                  {isTowedImplement(type) ? "Outil traîné" : "Automoteur"} · {TIER_LABELS[tier]}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <FarmPreview tier={tier} />
    </div>
  );
}

/**
 * Les mêmes engins dans la vue ferme : deux garés au parc, un au chantier
 * qui traverse la parcelle en boucle. C'est le seul endroit où l'on juge
 * l'échelle des machines par rapport aux cases et aux cultures.
 */
function FarmPreview({ tier = 1 }: { tier?: MachineTier }) {
  const [type, setType] = useState<MachineType>("HARVESTER");
  const [run, setRun] = useState(0);

  // Le chantier est rejoué en boucle : l'animation dure ~0.28 s par case.
  useEffect(() => {
    const id = setInterval(() => setRun((r) => r + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const cells = useMemo<IsoCell[]>(() => {
    const out: IsoCell[] = [];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        // Deux engins au parc : l'un sorti d'usine, l'autre bon à réviser.
        if (x === 0 && y === 0)
          out.push({ x, y, kind: "VEHICLE", machineType: "TRACTOR", machineCondition: 96 });
        else if (x === 1 && y === 0)
          out.push({ x, y, kind: "VEHICLE", machineType: "DISC_HARROW", machineCondition: 12 });
        else if (x >= 4 && y <= 1) out.push({ x, y, kind: "BUILDING" });
        else if (y >= 2)
          // Chaque rang raconte une conduite différente : bien fumé et
          // désherbé à gauche, affamé et envahi à droite.
          out.push({
            x,
            y,
            kind: "CROP",
            crop: "WHEAT",
            fieldStage: "READY",
            fertilizedPasses: x <= 1 ? 2 : x <= 3 ? 1 : 0,
            weedPressure: x <= 3 ? 0 : 0.7,
          });
        else out.push({ x, y, kind: "EMPTY" });
      }
    }
    return out;
  }, []);

  // Une ferme au fond de la parcelle : sa cheminée fume.
  const buildings = useMemo<IsoBuilding[]>(
    () => [{ id: "hq", type: "FARMHOUSE", originX: 4, originY: 0, level: 3 }],
    [],
  );

  const activeWork = useMemo(
    () => ({
      type,
      cells: Array.from({ length: 6 }, (_, i) => ({ x: i, y: 3 + (run % 2) })),
      // Un engin de chantier fatigué : sa carrosserie doit le dire.
      condition: 28,
      tier,
    }),
    [type, run, tier],
  );

  // Le dernier rang a passé son heure : ses tiges ploient avant de verser.
  const cellSims = useMemo(
    () =>
      Array.from({ length: 6 }, (_, x) => ({
        x,
        y: 5,
        sim: { progress: 1, ready: true, ripeness: { stage: "POOR" as const } },
      })),
    [],
  );

  return (
    <section className="atelier-farm">
      <h2>En situation — vue ferme</h2>
      <div className="atelier-controls">
        {(Object.keys(MACHINE_DEFS) as MachineType[]).map((t) => (
          <label key={t}>
            <input
              type="radio"
              name="work-machine"
              checked={type === t}
              onChange={() => setType(t)}
            />
            {MACHINE_DEFS[t].name}
          </label>
        ))}
      </div>
      <div className="atelier-iso">
        <IsoFarmView
          gridW={6}
          gridH={6}
          cells={cells}
          buildings={buildings}
          cellSims={cellSims}
          selected={[]}
          activeWork={activeWork}
          onCellClick={() => {}}
        />
      </div>
    </section>
  );
}
