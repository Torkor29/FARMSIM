import {
  CROP_DEFS,
  GOOD_ICONS,
  SEASON_CYCLE,
  SEASON_LABELS,
  SEASON_REAL_HOURS,
  currentSeason,
  cropCalendar,
  growSeasonsHint,
  harvestItemCode,
  msUntilNextSeason,
  type Season,
} from "@farmsim/shared";
import { useEffect, useState } from "react";
import { MenuClose } from "./ui/MenuClose";

/**
 * Le calendrier des cultures.
 *
 * Il répond à une question que le jeu posait sans jamais y répondre : « je
 * sème quoi, maintenant ? ». La fenêtre de semis existait — la route refusait
 * le maïs en hiver en donnant sa raison — mais il fallait s'y cogner pour
 * l'apprendre, une culture à la fois.
 *
 * ## Pourquoi les colonnes ont changé
 *
 * Elles étaient les sept jours de la semaine, parce que l'année de jeu en
 * faisait une : lundi au printemps, l'hiver le dimanche. C'était précisément
 * le défaut à corriger — les fenêtres de semis étant verrouillées par saison,
 * un joueur du week-end ne voyait qu'automne et hiver, à vie, et ne pouvait
 * jamais semer la moitié du catalogue.
 *
 * Les saisons durent maintenant dix heures et glissent dans la journée.
 * « Mardi » ne dit donc plus rien de la saison qu'il portera, et les colonnes
 * sont les quatre saisons — de toute façon le seul repère dont un agriculteur
 * se sert : on ne sème pas « un mardi », on sème à l'automne.
 *
 * Rien ici n'est dessiné à la main. Tout vient de `cropCalendar()`, qui fait
 * réellement pousser chaque culture avec les fonctions du champ. Un calendrier
 * écrit à la main aurait menti au premier réglage de vitesse, sans que
 * personne s'en aperçoive.
 */

type Props = {
  hemisphere?: "N" | "S";
  onClose: () => void;
};

/** Les saisons en court, pour les colonnes étroites du téléphone. */
const SEASON_COURT: Record<Season, string> = {
  SPRING: "Prin.",
  SUMMER: "Été",
  AUTUMN: "Aut.",
  WINTER: "Hiv.",
};

function estCreux(season: Season): boolean {
  return season === "WINTER";
}

/** « 3 h 20 » — le temps qui reste, dit comme on le lit. */
function reste(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60);
  return h > 0 ? `${h} h ${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

/** « 33 h » ou « 2 j 9 h » — une attente réelle, dite pour être comprise. */
function attente(heures: number): string {
  if (heures < 24) return `${Math.round(heures)} h`;
  const j = Math.floor(heures / 24);
  const h = Math.round(heures - j * 24);
  return h > 0 ? `${j} j ${h} h` : `${j} j`;
}

export function CropCalendarPanel({ hemisphere = "N", onClose }: Props) {
  /*
   * Le compte à rebours doit vivre.
   *
   * Sans ce battement, « prochaine saison dans 3 h 20 » reste figé sur la
   * valeur qu'il avait à l'ouverture du panneau — et un panneau laissé ouvert
   * annonce une saison qui a déjà tourné. Trente secondes suffisent : la
   * ligne s'affiche à la minute.
   */
  const [, battement] = useState(0);
  useEffect(() => {
    const t = setInterval(() => battement((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const lignes = cropCalendar();
  const saisonActuelle = currentSeason(hemisphere);
  const avantProchaine = msUntilNextSeason();
  const saisons = [...SEASON_CYCLE];

  /*
   * Ce qu'on peut semer maintenant.
   *
   * C'est la question qui amène ici — le tableau y répond, mais il faut le
   * lire colonne par colonne. Autant la poser à plat en haut.
   */
  const semables = lignes
    .filter((r) => r.sowSeasons.includes(saisonActuelle))
    .map((r) => CROP_DEFS[r.crop].name);

  return (
    <aside className="calendrier" role="dialog" aria-label="Calendrier des cultures">
      <div className="calendrier-tete">
        <div>
          <h3>Calendrier des cultures</h3>
          <p className="muted tiny">
            Une saison dure {SEASON_REAL_HOURS} h · elle change d’heure chaque jour, donc tout le
            monde finit par toutes les voir.
          </p>
          <p className="calendrier-aujourdhui">
            {semables.length ? (
              <>
                À semer maintenant : <strong>{semables.join(", ")}</strong>
              </>
            ) : (
              <>Rien à semer en ce moment — c’est la saison creuse.</>
            )}{" "}
            <em>Prochaine saison dans {reste(avantProchaine)}.</em>
          </p>
        </div>
        <div className="calendrier-legende">
          <span>
            <i className="pastille semis" /> Semis
          </span>
          <span>
            <i className="pastille recolte" /> Récolte
          </span>
        </div>
        <MenuClose onClose={onClose} />
      </div>

      <div className="calendrier-grille" style={{ ["--jours" as string]: saisons.length }}>
        <div className="calendrier-coin" />
        {saisons.map((s) => (
          <div
            key={`tete-${s}`}
            className={`calendrier-jour s-${s.toLowerCase()}${
              s === saisonActuelle ? " aujourdhui" : ""
            }`}
          >
            {/* Deux écritures de la même chose, et la feuille de style choisit :
                sur téléphone, « Printemps » ne tient pas dans sa colonne, et
                l'abréger ici plutôt que le rogner au CSS garde le mot entier
                là où il tient. */}
            <strong>
              <span className="long">{SEASON_LABELS[s]}</span>
              <span className="court">{SEASON_COURT[s]}</span>
            </strong>
            {s === saisonActuelle && (
              <span className="calendrier-marque">
                <span className="long">en ce moment</span>
                <span className="court">auj.</span>
              </span>
            )}
          </div>
        ))}

        {lignes.map((r) => (
          <div key={r.crop} className="calendrier-ligne">
            <div className="calendrier-nom">
              <img src={GOOD_ICONS[harvestItemCode(r.crop)]} alt="" />
              <span>
                <strong>{CROP_DEFS[r.crop].name}</strong>
                {/* La seule chose qu'on ne peut pas lire sur les bandes : le
                    temps que ça prend pour de vrai, du semis à la maturité. */}
                <em>{attente(r.bestRealHours)} au mieux</em>
              </span>
            </div>
            {saisons.map((s) => {
              const semis = r.sowSeasons.includes(s);
              const recolte = r.harvestSeasons.includes(s);
              /*
               * Une case peut porter les deux, et il ne faut surtout pas les
               * confondre en une seule pastille : on sème le blé à l'automne,
               * et un blé semé deux automnes plus tôt y mûrit. Les fondre
               * ferait disparaître la moitié de l'information.
               */
              const classes = [
                "calendrier-case",
                semis ? "semis" : "",
                recolte ? "recolte" : "",
                estCreux(s) ? "creux" : "",
                s === saisonActuelle ? "aujourdhui" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const quoi =
                semis && recolte
                  ? "semis et récolte"
                  : semis
                    ? "semis"
                    : recolte
                      ? "récolte"
                      : "rien";
              return (
                <div
                  key={`${r.crop}-${s}`}
                  className={classes}
                  title={`${CROP_DEFS[r.crop].name} · ${SEASON_LABELS[s]} · ${quoi}`}
                >
                  {semis && <i className="barre semis" />}
                  {recolte && <i className="barre recolte" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Le détail : c'est là que se lit l'arbitrage « semer tôt ou tard ».
          Il ne tient pas dans les bandes — une bande dit « on récolte à cette
          saison », pas « et il faut semer avant tel moment sous peine
          d'attendre un an de plus ». */}
      <details className="calendrier-detail">
        <summary>Semer tôt ou tard : ce que ça change</summary>
        <ul>
          {lignes.map((r) => (
            <li key={r.crop}>
              <strong>{CROP_DEFS[r.crop].name}</strong>{" "}
              {/* Le capital de pousse, indépendant de la date de semis : c'est
                  lui qui explique pourquoi décaler le semis déplace la saison
                  de récolte. Une culture de 2,8 saisons ne peut pas se
                  moissonner dans celle où on la sème. */}
              <em>{growSeasonsHint(CROP_DEFS[r.crop].growMs)} saisons de pousse</em>
              <ul>
                {r.outcomes.map((o, i) => (
                  <li key={`${o.sowSeason}-${i}`}>
                    semé {o.at === 0 ? "au début" : o.at === 0.5 ? "au milieu" : "en fin"} d’
                    {SEASON_LABELS[o.sowSeason].toLowerCase()} → mûr{" "}
                    {SEASON_LABELS[o.harvestSeason].toLowerCase()}, {attente(o.realHours)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
