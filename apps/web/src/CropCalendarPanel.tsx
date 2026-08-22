import {
  CROP_DEFS,
  GOOD_ICONS,
  SEASON_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  cropCalendar,
  harvestItemCode,
  seasonOfWeekday,
  weekdayIndex,
  type Season,
} from "@farmsim/shared";

/**
 * Le calendrier des cultures.
 *
 * Il répond à une question que le jeu posait sans jamais y répondre : « je
 * sème quoi, aujourd'hui ? ». La fenêtre de semis existait — la route refusait
 * le maïs en hiver en donnant sa raison — mais il fallait s'y cogner pour
 * l'apprendre, une culture à la fois.
 *
 * Les colonnes sont les **sept jours de la semaine**, parce que l'année de jeu
 * en fait une : lundi et mardi au printemps, mercredi et jeudi en été,
 * vendredi et samedi à l'automne, l'hiver le dimanche. Le joueur n'a donc rien
 * à convertir — il sait déjà quel jour on est.
 *
 * Rien ici n'est dessiné à la main. Les deux bandes viennent de
 * `cropCalendar()`, qui fait réellement pousser chaque culture avec les
 * fonctions du champ. Un calendrier écrit à la main aurait menti au premier
 * réglage de vitesse, sans que personne s'en aperçoive.
 */

type Props = {
  hemisphere?: "N" | "S";
  onClose: () => void;
};

/** Un jour d'hiver ne se sème pas : on l'estompe plutôt que de le cacher. */
function estCreux(season: Season): boolean {
  return season === "WINTER";
}

export function CropCalendarPanel({ hemisphere = "N", onClose }: Props) {
  const lignes = cropCalendar(hemisphere);
  const aujourdHui = weekdayIndex();
  const jours = [0, 1, 2, 3, 4, 5, 6];
  const saisonDuJour = seasonOfWeekday(aujourdHui, hemisphere);
  /*
   * Ce qu'on peut semer maintenant.
   *
   * C'est la question qui amène ici — le tableau y répond, mais il faut le
   * lire colonne par colonne. Autant la poser à plat en haut.
   */
  const semablesAujourdHui = lignes
    .filter((r) => r.sowDays.includes(aujourdHui))
    .map((r) => CROP_DEFS[r.crop].name);

  return (
    <aside className="calendrier" role="dialog" aria-label="Calendrier des cultures">
      <div className="calendrier-tete">
        <div>
          <h3>Calendrier des cultures</h3>
          <p className="muted tiny">
            Une année fait une semaine · l’hiver tombe le dimanche.
          </p>
          <p className="calendrier-aujourdhui">
            {semablesAujourdHui.length ? (
              <>
                À semer {SEASON_LABELS[saisonDuJour].toLowerCase() === "hiver" ? "cet" : "ce"}{" "}
                {WEEKDAY_LABELS[aujourdHui].toLowerCase()} :{" "}
                <strong>{semablesAujourdHui.join(", ")}</strong>
              </>
            ) : (
              <>
                Rien à semer {WEEKDAY_LABELS[aujourdHui].toLowerCase()} — c’est le jour creux.
              </>
            )}
          </p>
        </div>
        <div className="calendrier-legende">
          <span>
            <i className="pastille semis" /> Semis
          </span>
          <span>
            <i className="pastille recolte" /> Récolte
          </span>
          <button type="button" className="ghost tiny" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>

      <div className="calendrier-grille" style={{ ["--jours" as string]: jours.length }}>
        {/* En-têtes : la saison au-dessus du jour, parce que c'est la saison
            qui décide et le jour qui la porte. */}
        <div className="calendrier-coin" />
        {jours.map((j) => {
          const saison = seasonOfWeekday(j, hemisphere);
          return (
            <div
              key={`tete-${j}`}
              className={`calendrier-jour s-${saison.toLowerCase()}${
                j === aujourdHui ? " aujourdhui" : ""
              }`}
            >
              <em>{SEASON_LABELS[saison]}</em>
              <strong>{WEEKDAY_SHORT[j]}</strong>
              {j === aujourdHui && <span className="calendrier-marque">aujourd’hui</span>}
            </div>
          );
        })}

        {lignes.map((r) => (
          <div key={r.crop} className="calendrier-ligne">
            <div className="calendrier-nom">
              <img src={GOOD_ICONS[harvestItemCode(r.crop)]} alt="" />
              <span>
                <strong>{CROP_DEFS[r.crop].name}</strong>
                {/* La seule chose qu'on ne peut pas lire sur les bandes : le
                    temps que ça prend pour de vrai, du semis à la maturité. */}
                <em>{r.realDays} j</em>
              </span>
            </div>
            {jours.map((j) => {
              const semis = r.sowDays.includes(j);
              const recolte = r.harvestDays.includes(j);
              const saison = seasonOfWeekday(j, hemisphere);
              const classes = [
                "calendrier-case",
                semis ? "semis" : "",
                recolte ? "recolte" : "",
                estCreux(saison) ? "creux" : "",
                j === aujourdHui ? "aujourdhui" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const quoi = semis && recolte ? "semis et récolte" : semis ? "semis" : recolte ? "récolte" : "rien";
              return (
                <div
                  key={`${r.crop}-${j}`}
                  className={classes}
                  title={`${CROP_DEFS[r.crop].name} · ${WEEKDAY_SHORT[j]} · ${quoi}`}
                >
                  {semis && <i className="barre semis" />}
                  {recolte && <i className="barre recolte" />}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
