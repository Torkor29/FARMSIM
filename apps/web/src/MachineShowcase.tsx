import { useEffect, useMemo, useState } from "react";
import { MACHINE_DEFS, type MachineType } from "@farmsim/shared";
import { MachineView3D } from "./MachineView3D";
import { IsoFarmView, type IsoCell } from "./IsoFarmView";
import { isTowedImplement } from "./machines3d";

const TYPES = Object.keys(MACHINE_DEFS) as MachineType[];

/**
 * Atelier — la planche de contact du parc matériel.
 *
 * Page de travail, hors jeu : elle sert à juger les engins sous l'angle de la
 * vue ferme, à l'arrêt comme au travail, avant de les envoyer au champ.
 */
export function MachineShowcase() {
  const [working, setWorking] = useState(true);
  const [speed, setSpeed] = useState(1.6);
  const [towed, setTowed] = useState(true);
  const [turntable, setTurntable] = useState(true);
  const [big, setBig] = useState(false);

  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — parc matériel 3D</h1>
        <p>
          Les quatre engins du jeu, montés en géométrie procédurale et animés par la
          distance parcourue. Aucune texture : facettes, couleurs plates et lumière de
          fin d'après-midi, comme le reste de la ferme.
        </p>
        <div className="atelier-controls">
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
              />
              <div className="atelier-meta">
                <h2>{def.name}</h2>
                <p>{def.description}</p>
                <p className="atelier-tags">
                  {isTowedImplement(type) ? "Outil traîné" : "Automoteur"} · {def.cost} CRD
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <FarmPreview />
    </div>
  );
}

/**
 * Les mêmes engins dans la vue ferme : deux garés au parc, un au chantier
 * qui traverse la parcelle en boucle. C'est le seul endroit où l'on juge
 * l'échelle des machines par rapport aux cases et aux cultures.
 */
function FarmPreview() {
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
        if (x === 0 && y === 0) out.push({ x, y, kind: "VEHICLE", machineType: "TRACTOR" });
        else if (x === 1 && y === 0) out.push({ x, y, kind: "VEHICLE", machineType: "DISC_HARROW" });
        else if (y >= 2) out.push({ x, y, kind: "CROP", crop: "WHEAT", fieldStage: "READY" });
        else out.push({ x, y, kind: "EMPTY" });
      }
    }
    return out;
  }, []);

  const activeWork = useMemo(
    () => ({
      type,
      cells: Array.from({ length: 6 }, (_, i) => ({ x: i, y: 3 + (run % 2) })),
    }),
    [type, run],
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
          buildings={[]}
          cellSims={[]}
          selected={[]}
          activeWork={activeWork}
          onCellClick={() => {}}
        />
      </div>
    </section>
  );
}
