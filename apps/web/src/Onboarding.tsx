import { useEffect, useMemo, useState } from "react";
import {
  CLASS_PROFILES,
  DIFFICULTY_LABELS,
  SEASON_LABELS,
  WEATHER_LABELS,
  defaultAppearance,
  type CharacterAppearance,
  type ClassProfile,
  type Difficulty,
  type Season,
  type Specialization,
  type WeatherState,
} from "@farmsim/shared";
import { GlobeView, type GlobeContinent } from "./GlobeView";
import { CharacterCreator } from "./CharacterCreator";
import { LowPolyCharacter } from "./LowPolyCharacter";

export type WorldContinent = GlobeContinent & {
  tagline: string;
  description: string;
  hemisphere: "N" | "S";
  difficulty: Difficulty;
  season: Season;
  regionCount: number;
  parcelTaken: number;
};

export type WorldParcel = {
  id: string;
  label: string;
  mapX: number;
  mapY: number;
  gridW: number;
  gridH: number;
  fertility: number;
  landPrice: number;
  taken: boolean;
  ownerName: string | null;
};

export type WorldRegion = {
  code: string;
  name: string;
  city: string;
  koppen: string;
  climateLabel: string;
  riskNote: string;
  mapW: number;
  mapH: number;
  fertility: number;
  weather: WeatherState;
  crops: string[];
  /** Faux si aucune culture ne pousse : interdit comme ferme de départ */
  starterEligible: boolean;
  parcels: WorldParcel[];
};

export type ContinentDetail = {
  continent: {
    code: string;
    name: string;
    tagline: string;
    description: string;
    hemisphere: "N" | "S";
    difficulty: Difficulty;
    season: Season;
  };
  regions: WorldRegion[];
};

type Props = {
  playerName: string;
  continents: WorldContinent[];
  detail: ContinentDetail | null;
  detailLoading: boolean;
  onLoadContinent: (code: string) => void;
  onConfirm: (opts: {
    specialization: Specialization;
    parcelId: string;
    appearance: CharacterAppearance;
  }) => void;
  busy: boolean;
  err: string | null;
};

type Step = 0 | 1 | 2 | 3 | 4;

const STEP_TITLES = [
  "Votre métier",
  "Votre personnage",
  "Votre continent",
  "Votre terre",
  "Confirmation",
];

function fertilityLabel(f: number): string {
  if (f >= 0.85) return "Exceptionnelle";
  if (f >= 0.75) return "Très bonne";
  if (f >= 0.62) return "Correcte";
  if (f >= 0.5) return "Moyenne";
  return "Difficile";
}

export function Onboarding({
  playerName,
  continents,
  detail,
  detailLoading,
  onLoadContinent,
  onConfirm,
  busy,
  err,
}: Props) {
  const [step, setStep] = useState<Step>(0);
  const [spe, setSpe] = useState<Specialization | null>(null);
  const [appearance, setAppearance] = useState<CharacterAppearance>(() =>
    defaultAppearance("CEREALIER"),
  );
  const [continentCode, setContinentCode] = useState<string | null>(null);
  const [regionCode, setRegionCode] = useState<string | null>(null);
  const [parcelId, setParcelId] = useState<string | null>(null);

  useEffect(() => {
    if (continentCode) onLoadContinent(continentCode);
  }, [continentCode, onLoadContinent]);

  useEffect(() => {
    if (detail && !regionCode && detail.regions.length) {
      setRegionCode(detail.regions[0].code);
    }
  }, [detail, regionCode]);

  const region = useMemo(
    () => detail?.regions.find((r) => r.code === regionCode) ?? null,
    [detail, regionCode],
  );
  const parcel = useMemo(
    () => region?.parcels.find((p) => p.id === parcelId) ?? null,
    [region, parcelId],
  );
  const continent = continents.find((c) => c.code === continentCode) ?? null;

  const suggested = spe ? CLASS_PROFILES[spe].suggestedContinents : [];

  function goTo(next: Step) {
    setStep(next);
  }

  return (
    <div className="onb">
      <header className="onb-top">
        <img className="onb-logo" src="/logo.webp" alt="" />
        <div>
          <h1 className="onb-title">Installation de votre ferme</h1>
          <p className="onb-sub">
            Bienvenue {playerName} — cinq étapes et vous êtes aux commandes.
          </p>
        </div>
      </header>

      <ol className="onb-steps" aria-label="Progression">
        {STEP_TITLES.map((t, i) => (
          <li
            key={t}
            className={`onb-step ${i === step ? "on" : ""} ${i < step ? "done" : ""}`}
          >
            <span className="onb-step-num">{i < step ? "✓" : i + 1}</span>
            <span className="onb-step-label">{t}</span>
          </li>
        ))}
      </ol>

      {err && <p className="gate-alert bad">{err}</p>}

      {step === 0 && (
        <section className="onb-body">
          <p className="onb-lead">
            Deux métiers : céréalier ou éleveur. Pendant que ça pousse, vous pouvez aller aider
            un voisin — on vous paie.
          </p>
          <div className="class-grid">
            {(Object.keys(CLASS_PROFILES) as ClassProfile["code"][]).map((code) => {
              const p = CLASS_PROFILES[code];
              const active = spe === code;
              return (
                <button
                  key={code}
                  type="button"
                  className={`class-card ${active ? "on" : ""}`}
                  onClick={() => {
                    setSpe(code);
                    setAppearance(defaultAppearance(code));
                  }}
                  aria-pressed={active}
                >
                  {/*
                    Cadrage buste. En pied dans une vignette de cette taille, le
                    personnage faisait cent quatre-vingts pixels de haut pour un
                    visage de dix : on ne distinguait ni la tête ni la tenue,
                    c'est-à-dire rien de ce qu'on demande de choisir.
                  */}
                  <LowPolyCharacter code={code} active={active} frame="bust" height={190} />
                  <h3>{p.name}</h3>
                  <p className="class-tag">{p.tagline}</p>
                  <ul className="class-perks">
                    {p.perks.map((x) => (
                      <li key={x} className="perk">
                        {x}
                      </li>
                    ))}
                    {p.drawbacks.map((x) => (
                      <li key={x} className="draw">
                        {x}
                      </li>
                    ))}
                  </ul>
                  <p className="class-machines">
                    Départ : {p.startingMachines.join(" + ")}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="onb-nav">
            <span />
            <button
              type="button"
              className="btn-primary big"
              disabled={!spe}
              onClick={() => goTo(1)}
            >
              Continuer
            </button>
          </div>
        </section>
      )}

      {step === 1 && spe && (
        <section className="onb-body">
          <p className="onb-lead">
            C’est vous qu’on verra au champ, y compris chez le voisin si vous l’aidez. Chapeau,
            peau, visage, vêtements : tout est en 3D, pièce par pièce.
          </p>
          <CharacterCreator spec={spe} appearance={appearance} onChange={setAppearance} />
          <div className="onb-nav">
            <button type="button" className="btn-ghost" onClick={() => goTo(0)}>
              Retour
            </button>
            <button type="button" className="btn-primary big" onClick={() => goTo(2)}>
              Continuer
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="onb-body">
          <p className="onb-lead">
            Faites tourner le globe et choisissez votre continent. Les saisons de
            l'hémisphère sud sont inversées — un jour, vous voudrez des terres dans les
            deux.
          </p>
          <div className="globe-layout">
            <div className="globe-wrap">
              <GlobeView
                continents={continents}
                selected={continentCode}
                onSelect={setContinentCode}
                focus={Boolean(continentCode)}
                height={420}
              />
              <p className="globe-hint">Glissez pour tourner · cliquez un repère doré</p>
            </div>
            <div className="continent-list">
              {continents.map((c) => {
                const active = continentCode === c.code;
                const isSuggested = suggested.includes(c.code);
                // Un continent sans aucune parcelle n'est pas « complet » : il
                // n'est pas encore ouvert. Confondre les deux faisait croire au
                // joueur que le monde était plein alors qu'il était vide.
                const unopened = c.parcelTotal === 0;
                const full = !unopened && c.parcelFree === 0;
                const disabled = full || unopened;
                return (
                  <button
                    key={c.code}
                    type="button"
                    className={`continent-card ${active ? "on" : ""} ${disabled ? "full" : ""}`}
                    onClick={() => !disabled && setContinentCode(c.code)}
                    disabled={disabled}
                  >
                    <span className="cc-dot" style={{ background: c.color }} />
                    <span className="cc-main">
                      <strong>{c.name}</strong>
                      <span className="cc-tag">{c.tagline}</span>
                      <span className="cc-meta">
                        <em className={`diff ${c.difficulty.toLowerCase()}`}>
                          {DIFFICULTY_LABELS[c.difficulty]}
                        </em>
                        <em>{SEASON_LABELS[c.season]}</em>
                        <em>{c.hemisphere === "N" ? "Hém. nord" : "Hém. sud"}</em>
                      </span>
                    </span>
                    <span className="cc-stock">
                      {unopened ? (
                        "Bientôt"
                      ) : full ? (
                        "Complet"
                      ) : (
                        <>
                          <strong>{c.parcelFree}</strong>
                          <span className="cc-unit">
                            {c.parcelFree > 1 ? "fermes libres" : "ferme libre"}
                          </span>
                        </>
                      )}
                      {isSuggested && !disabled && <em className="cc-reco">Conseillé</em>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {continent && (
            <p className="continent-desc">{continent.description}</p>
          )}
          <div className="onb-nav">
            <button type="button" className="btn-ghost" onClick={() => goTo(1)}>
              Retour
            </button>
            <button
              type="button"
              className="btn-primary big"
              disabled={!continentCode}
              onClick={() => goTo(3)}
            >
              Voir les régions
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="onb-body">
          <p className="onb-lead">
            Un continent se divise en <strong>régions</strong>, et chaque région est
            découpée en <strong>fermes</strong> de {parcel?.gridW ?? 12}×
            {parcel?.gridH ?? 12} cases. Choisissez d'abord la région — c'est elle qui
            fixe le climat — puis la ferme dans le quadrillage.
          </p>
          {detail && (
            <p className="onb-path">
              <span>{detail.continent.name}</span>
              <b>›</b>
              <span className={regionCode ? "done" : "todo"}>
                {region ? region.name : "choisissez une région"}
              </span>
              <b>›</b>
              <span className={parcelId ? "done" : "todo"}>
                {parcel ? parcel.label : "choisissez une ferme"}
              </span>
            </p>
          )}
          {detailLoading && <p className="muted">Chargement du continent…</p>}
          {detail && (
            <>
              <div className="region-tabs">
                {detail.regions.map((r) => {
                  const free = r.parcels.filter((p) => !p.taken).length;
                  const barren = r.starterEligible === false;
                  return (
                    <button
                      key={r.code}
                      type="button"
                      className={`region-tab ${regionCode === r.code ? "on" : ""} ${barren ? "barren" : ""}`}
                      onClick={() => {
                        setRegionCode(r.code);
                        setParcelId(null);
                      }}
                    >
                      <strong>{r.name}</strong>
                      <span>{r.climateLabel}</span>
                      {barren ? (
                        <em className="warn">Rien n’y pousse</em>
                      ) : (
                        <em>{free} libres</em>
                      )}
                    </button>
                  );
                })}
              </div>

              {region && (
                <div className="region-panel">
                  <div className="region-info">
                    <h3>{region.name}</h3>
                    {region.city && (
                      <p className="region-city">
                        Ville-marché : <strong>{region.city}</strong>
                      </p>
                    )}
                    <dl className="region-facts">
                      <div>
                        <dt>Climat</dt>
                        <dd>
                          {region.climateLabel} ({region.koppen})
                        </dd>
                      </div>
                      <div>
                        <dt>Météo</dt>
                        <dd>{WEATHER_LABELS[region.weather] ?? region.weather}</dd>
                      </div>
                      <div>
                        <dt>Fertilité</dt>
                        <dd>{fertilityLabel(region.fertility)}</dd>
                      </div>
                      <div>
                        <dt>Saison</dt>
                        <dd>{SEASON_LABELS[detail.continent.season]}</dd>
                      </div>
                    </dl>
                    <p className="region-risk">{region.riskNote}</p>
                    {region.starterEligible === false && (
                      <p className="region-barren">
                        Ni blé ni maïs ne poussent sous ce climat. Vous pourrez acheter
                        ici plus tard, mais pas y installer votre première ferme.
                      </p>
                    )}
                  </div>

                  <div className="parcel-board">
                    <p className="parcel-board-title">
                      Les {region.parcels.length} fermes de {region.name} —{" "}
                      {region.parcels.filter((p) => !p.taken).length} encore libres
                    </p>
                    <div
                      className="parcel-grid"
                      style={{
                        gridTemplateColumns: `repeat(${region.mapW}, minmax(0, 1fr))`,
                      }}
                    >
                      {region.parcels.map((p) => {
                        const sel = parcelId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`parcel-tile ${p.taken ? "taken" : "free"} ${sel ? "sel" : ""}`}
                            disabled={p.taken || region.starterEligible === false}
                            title={
                              region.starterEligible === false
                                ? `${p.label} — aucune culture viable ici`
                                : p.taken
                                  ? `${p.label} — exploité par ${p.ownerName ?? "un autre joueur"}`
                                  : `${p.label} — fertilité ${(p.fertility * 100).toFixed(0)} %`
                            }
                            onClick={() => setParcelId(p.id)}
                          >
                            <span
                              className="parcel-fert"
                              style={{
                                opacity: p.taken ? 0.25 : 0.35 + p.fertility * 0.65,
                              }}
                            />
                            <span className="parcel-name">{p.label}</span>
                            {p.taken ? (
                              <span className="parcel-owner">{p.ownerName ?? "Occupée"}</span>
                            ) : (
                              <span className="parcel-fertnum">
                                {(p.fertility * 100).toFixed(0)} %
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <ul className="parcel-legend">
                      <li>
                        <span className="sw free" /> Libre — plus la couleur est forte, plus la
                        terre est fertile
                      </li>
                      <li>
                        <span className="sw taken" /> Déjà exploitée par un joueur
                      </li>
                      <li>
                        <span className="sw sel" /> Votre choix
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          )}
          <div className="onb-nav">
            <button type="button" className="btn-ghost" onClick={() => goTo(2)}>
              Changer de continent
            </button>
            <button
              type="button"
              className="btn-primary big"
              disabled={!parcelId}
              onClick={() => goTo(4)}
            >
              Choisir cette parcelle
            </button>
          </div>
        </section>
      )}

      {step === 4 && spe && parcel && region && detail && (
        <section className="onb-body">
          <div className="recap">
            <div className="recap-char">
              <LowPolyCharacter code={spe} appearance={appearance} active height={220} />
            </div>
            <div className="recap-info">
              <h2>Tout est prêt</h2>
              <dl className="recap-list">
                <div>
                  <dt>Métier</dt>
                  <dd>{CLASS_PROFILES[spe].name}</dd>
                </div>
                <div>
                  <dt>Continent</dt>
                  <dd>
                    {detail.continent.name} · {SEASON_LABELS[detail.continent.season]}
                  </dd>
                </div>
                <div>
                  <dt>Région</dt>
                  <dd>
                    {region.name} — {region.city}
                  </dd>
                </div>
                <div>
                  <dt>Climat</dt>
                  <dd>
                    {region.climateLabel} ({region.koppen})
                  </dd>
                </div>
                <div>
                  <dt>Parcelle</dt>
                  <dd>
                    {parcel.label} · {parcel.gridW}×{parcel.gridH}
                  </dd>
                </div>
                <div>
                  <dt>Fertilité</dt>
                  <dd>
                    {fertilityLabel(parcel.fertility)} ({(parcel.fertility * 100).toFixed(0)} %)
                  </dd>
                </div>
                <div>
                  <dt>Prix</dt>
                  <dd className="free-price">Offerte — première installation</dd>
                </div>
              </dl>
              <p className="recap-note">
                Vos prochaines parcelles seront payantes et de plus en plus chères :
                regrouper vos terres donne un bonus de rendement, et posséder dans les deux
                hémisphères vous protège des mauvaises saisons.
              </p>
            </div>
          </div>
          <div className="onb-nav">
            <button type="button" className="btn-ghost" onClick={() => goTo(3)}>
              Retour
            </button>
            <button
              type="button"
              className="btn-primary big"
              disabled={busy}
              onClick={() =>
                onConfirm({ specialization: spe, parcelId: parcel.id, appearance })
              }
            >
              {busy ? "Installation…" : "M'installer ici"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
