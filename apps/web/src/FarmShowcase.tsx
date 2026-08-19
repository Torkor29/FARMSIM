import { useMemo, useState } from "react";
import { BUILDING_DEFS, CROP_CODES, type BuildingType, type CropCode } from "@farmsim/shared";
import { AnimalView } from "./AnimalView";
import { BuildingView } from "./BuildingView";
import { CropView } from "./CropView";
import type { CropShape } from "./crop-shapes";
import type { AnimalKind } from "./animal-meshes";
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
          weedPressure: 0,
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

/** Chaque culture en gros plan, et ce qu'elle devient selon sa conduite. */
function CropCloseUp() {
  const shapes: [CropShape, string][] = [
    ["WHEAT", "Blé"],
    ["BARLEY", "Orge"],
    ["MAIZE", "Maïs"],
    ["PEA", "Pois"],
    ["RAPE", "Colza"],
    ["GRASS", "Herbe"],
  ];
  return (
    <>
      <section className="atelier-farm">
        <h2>Le brin, de près</h2>
        <p>
          Ce qu'on ne voit pas au champ, où un brin fait dix pixels : le dessin de
          l'épi, la retombée des feuilles, et la rafale qui roule sur la touffe.
        </p>
        <div className="atelier-grid">
          {shapes.map(([shape, label]) => (
            <article className="atelier-card" key={shape}>
              <CropView shape={shape} height={300} />
              <div className="atelier-meta">
                <h2>{label}</h2>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="atelier-farm">
        <h2>Ce que la conduite change</h2>
        <div className="atelier-grid">
          {[
            { label: "Blé en herbe", props: { shape: "WHEAT" as CropShape, ripe: 0 } },
            { label: "Blé mûr", props: { shape: "WHEAT" as CropShape, ripe: 1 } },
            { label: "Blé affamé", props: { shape: "WHEAT" as CropShape, density: 0.15 } },
            { label: "Blé qui a passé son heure", props: { shape: "WHEAT" as CropShape, droop: 1 } },
            { label: "Colza en bouton", props: { shape: "RAPE" as CropShape, ripe: 0 } },
            { label: "Colza en fleur", props: { shape: "RAPE" as CropShape, ripe: 1 } },
          ].map((c) => (
            <article className="atelier-card" key={c.label}>
              <CropView {...c.props} height={300} />
              <div className="atelier-meta">
                <h2>{c.label}</h2>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

/**
 * Chaque bête sur son plateau, dans les états que la simulation connaît.
 *
 * C'est la planche qui répond à la seule question qui vaille : est-ce qu'on
 * voit qu'une bête va mal, et qu'elle a de quoi donner, sans ouvrir un menu ?
 */
function AnimalBench() {
  const cases: { label: string; kind: AnimalKind; look: Parameters<typeof AnimalView>[0]["look"]; pose?: Partial<Parameters<typeof AnimalView>[0]> }[] = [
    { label: "Vache — au mieux, pis plein", kind: "COW", look: { welfare: 1, yield: 1 } },
    { label: "Vache — au mieux, fraîchement traite", kind: "COW", look: { welfare: 1, yield: 0 } },
    { label: "Vache — mal tenue", kind: "COW", look: { welfare: 0.1, yield: 0.3 } },
    { label: "Vache — au pré", kind: "COW", look: { welfare: 0.9, yield: 0.6 }, pose: { grazing: true } },
    { label: "Vache — couchée à l'étable", kind: "COW", look: { welfare: 0.8, yield: 0.4 }, pose: { resting: true } },
    { label: "Vache — en marche", kind: "COW", look: { welfare: 0.9, yield: 0.5 }, pose: { walking: true } },
    { label: "Brebis — toison pleine", kind: "SHEEP", look: { welfare: 1, yield: 1 } },
    { label: "Brebis — tondue", kind: "SHEEP", look: { welfare: 1, sheared: true } },
    { label: "Brebis — mal tenue", kind: "SHEEP", look: { welfare: 0.1, yield: 0.5 } },
    { label: "Poule — pond", kind: "HEN", look: { welfare: 1, yield: 1 } },
    { label: "Poule — mal tenue", kind: "HEN", look: { welfare: 0.1, yield: 0.2 } },
    { label: "Poule — au sol", kind: "HEN", look: { welfare: 1, yield: 0.6 }, pose: { grazing: true } },
    { label: "Cochon — au mieux", kind: "PIG", look: { welfare: 1 } },
    { label: "Cochon — mal tenu", kind: "PIG", look: { welfare: 0.1 } },
  ];

  return (
    <section className="atelier-farm">
      <h2>Les bêtes, état par état</h2>
      <div className="atelier-grid">
        {cases.map((c) => (
          <article className="atelier-card" key={c.label}>
            <AnimalView kind={c.kind} look={c.look} height={280} {...c.pose} />
            <div className="atelier-meta">
              <h2>{c.label}</h2>
            </div>
          </article>
        ))}
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
        paddock: { originX: 1, originY: 1, w: 4, h: 3 },
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

/**
 * Les treize bâtiments sur leur damier.
 *
 * La case de fond n'est pas décorative : elle donne l'empreinte déclarée. Un
 * modèle qui la déborde, qui décolle ou qui s'enterre se voit ici sans qu'on
 * ait à ouvrir la parcelle.
 */
function BuildingBench() {
  const [level, setLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [open, setOpen] = useState(true);
  const types = Object.keys(BUILDING_DEFS) as BuildingType[];

  return (
    <section className="atelier-farm">
      <h2>Les bâtiments</h2>
      <p>
        La case brune sous chaque modèle est son empreinte déclarée. Rien ne doit en
        sortir, rien ne doit flotter au-dessus.
      </p>
      <div className="atelier-controls">
        {[1, 2, 3, 4, 5].map((l) => (
          <label key={l}>
            <input type="radio" name="lvl" checked={level === l} onChange={() => setLevel(l)} />
            Niveau {l}
          </label>
        ))}
        {[0, 1, 2, 3].map((r) => (
          <label key={r}>
            <input type="radio" name="rot" checked={rotation === r} onChange={() => setRotation(r)} />
            {r * 90}°
          </label>
        ))}
        <label>
          <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
          Portes ouvertes
        </label>
      </div>
      <div className="atelier-grid">
        {types.map((type) => (
          <article className="atelier-card" key={type}>
            <BuildingView type={type} level={level} rotation={rotation} open={open} height={300} />
            <div className="atelier-meta">
              <h2>{BUILDING_DEFS[type].name}</h2>
              <p>
                {BUILDING_DEFS[type].w}×{BUILDING_DEFS[type].h}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function FarmShowcase() {
  const only = typeof location !== "undefined" ? new URLSearchParams(location.search).get("only") : null;
  return (
    <div className="atelier">
      <header className="atelier-head">
        <h1>Atelier — cultures, bêtes et bâtiments</h1>
        <p>
          Ce que la parcelle montre d'elle-même : la culture semée, son âge, l'état du
          troupeau et l'aplomb du bâti. Page de travail, hors jeu.
        </p>
      </header>
      {only === "animals" && <AnimalBench />}
      {only === "brins" && <CropCloseUp />}
      {only === "buildings" && <BuildingBench />}
      {only !== "herd" && only !== "animals" && only !== "brins" && only !== "buildings" && (
        <CropBench />
      )}
      {only !== "crops" && only !== "animals" && only !== "brins" && only !== "buildings" && (
        <HerdBench />
      )}
    </div>
  );
}

/** Types réexportés pour la page d'entrée. */
export type { CropCode };
