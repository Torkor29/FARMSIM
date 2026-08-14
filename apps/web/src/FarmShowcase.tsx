import { useMemo, useState } from "react";
import { CROP_CODES, type CropCode } from "@farmsim/shared";
import { IsoFarmView, type GrazingHerd, type IsoBuilding, type IsoCell, type IsoSim } from "./IsoFarmView";

/**
 * Atelier — la planche de contact de la ferme vivante.
 *
 * Page de travail, hors jeu. Deux choses ne se jugent qu'ici : est-ce qu'on
 * distingue une culture d'une autre à la silhouette, sans lire l'étiquette ; et
 * est-ce qu'une bête raconte son état sans ouvrir un menu.
 */

const KINDS = ["COW", "SHEEP", "HEN", "PIG"] as const;

/** Six cultures côte à côte, chacune à trois âges. */
function CropBench() {
  const cells = useMemo<IsoCell[]>(() => {
    const out: IsoCell[] = [];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        out.push({
          x,
          y,
          kind: "CROP",
          crop: CROP_CODES[x],
          fieldStage: "READY",
          fertilizedPasses: 2,
          weedsControlled: true,
        });
      }
    }
    return out;
  }, []);

  // Trois âges par colonne : jeune au fond, mûr devant.
  const cellSims = useMemo<IsoSim[]>(() => {
    const out: IsoSim[] = [];
    for (let y = 0; y < 6; y++) {
      const progress = y < 2 ? 0.25 : y < 4 ? 0.6 : 1;
      for (let x = 0; x < 6; x++) {
        out.push({ x, y, sim: { progress, ready: progress >= 1 } });
      }
    }
    return out;
  }, []);

  return (
    <section className="atelier-farm">
      <h2>Les six cultures</h2>
      <p>
        Une colonne par culture — {CROP_CODES.join(", ")} — et trois âges du fond vers
        l'avant. On doit les reconnaître à la silhouette, pas à la couleur.
      </p>
      <div className="atelier-iso">
        <IsoFarmView
          gridW={6}
          gridH={6}
          cells={cells}
          buildings={[]}
          cellSims={cellSims}
          selected={[]}
          onCellClick={() => {}}
        />
      </div>
    </section>
  );
}

/** Un troupeau, dedans ou dehors, tondu ou non. */
function HerdBench() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("COW");
  const [out, setOut] = useState(true);
  const [sheared, setSheared] = useState(false);

  const cells = useMemo<IsoCell[]>(() => {
    const list: IsoCell[] = [];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        const inBarn = x <= 1 && y <= 1;
        list.push({ x, y, kind: inBarn ? "BUILDING" : "EMPTY" });
      }
    }
    return list;
  }, []);

  const buildings = useMemo<IsoBuilding[]>(
    () => [{ id: "barn", type: "CATTLE_BARN", originX: 0, originY: 0, level: 2 }],
    [],
  );

  const grazing = useMemo<GrazingHerd[]>(
    () => [
      {
        buildingId: "barn",
        animals: 8,
        kind,
        sheared,
        out,
        barn: { originX: 0, originY: 0, w: 2, h: 2 },
        paddock: { originX: 2, originY: 2, w: 4, h: 4 },
      },
    ],
    [kind, out, sheared],
  );

  return (
    <section className="atelier-farm">
      <h2>Le troupeau</h2>
      <div className="atelier-controls">
        {KINDS.map((k) => (
          <label key={k}>
            <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} />
            {k}
          </label>
        ))}
        <label>
          <input type="checkbox" checked={out} onChange={(e) => setOut(e.target.checked)} />
          Dehors
        </label>
        <label>
          <input type="checkbox" checked={sheared} onChange={(e) => setSheared(e.target.checked)} />
          Tondu
        </label>
      </div>
      <div className="atelier-iso">
        <IsoFarmView
          gridW={6}
          gridH={6}
          cells={cells}
          buildings={buildings}
          cellSims={[]}
          selected={[]}
          grazing={grazing}
          onCellClick={() => {}}
        />
      </div>
    </section>
  );
}

export function FarmShowcase() {
  const only = typeof location !== "undefined" ? new URLSearchParams(location.search).get("only") : null;
  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — cultures et bêtes</h1>
        <p>
          Ce que la parcelle montre d'elle-même : la culture semée, son âge, et l'état
          du troupeau. Page de travail, hors jeu.
        </p>
      </header>
      {only !== "herd" && <CropBench />}
      {only !== "crops" && <HerdBench />}
    </div>
  );
}

/** Types réexportés pour la page d'entrée. */
export type { CropCode };
