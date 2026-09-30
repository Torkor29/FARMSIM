import { ESPECES, GUILDES, INFOS_GUILDE, indiceEspece } from "@farmsim/shared";

/**
 * Le carnet de nature : les espèces vues sur la ferme, groupe par groupe.
 *
 * Une espèce pas encore vue garde sa silhouette et donne son indice — ce
 * qu'il lui faut pour se montrer. C'est la collection qui fait revenir : on
 * sait ce qu'on cherche, et où le chercher.
 */
export function CarnetNature({ carnet, onClose }: { carnet: Record<string, string>; onClose: () => void }) {
  const vues = Object.keys(carnet).length;
  return (
    <div className="carnet-fond" role="dialog" aria-modal="true" aria-label="Carnet de nature" onClick={onClose}>
      <div className="carnet glass" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>📖 Carnet de nature</h3>
          <span className="carnet-compte">
            {vues} / {ESPECES.length} espèces
          </span>
          <button type="button" className="ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>
        <div className="carnet-corps">
          {GUILDES.map((g) => (
            <section key={g}>
              <h4>
                {INFOS_GUILDE[g].icone} {INFOS_GUILDE[g].nom}
              </h4>
              <ul>
                {ESPECES.filter((e) => e.guilde === g).map((e) => {
                  const vue = carnet[e.code];
                  return (
                    <li key={e.code} className={vue ? "vue" : "cachee"} title={vue ? e.note : `Pour la voir : ${indiceEspece(e)}`}>
                      <span className="carnet-icone">{vue ? e.icone : "?"}</span>
                      <span className="carnet-nom">{vue ? e.nom : "Espèce inconnue"}</span>
                      <small>{vue ? e.note : indiceEspece(e)}</small>
                      {vue && <em>vue le {new Date(vue).toLocaleDateString("fr-FR")}</em>}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
