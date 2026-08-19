import type { Season } from "@farmsim/shared";
/**
 * Rail d'outils — coque de bureau.
 *
 * Il remplace `FieldDock` sur écran large, et **seulement** là : la barre
 * tactile reste intacte, au pixel près.
 *
 * Ce qu'il corrige, mesuré sur le jeu en marche avant refonte :
 *
 * - La barre était plafonnée à `min(36rem, …)`. Sur 1920 px comme sur 2560,
 *   elle occupait 576 px et laissait 66 % de l'écran sans aucune commande.
 * - La rangée d'options tombait à **103 px de large pour 625 px de contenu**
 *   dès qu'une sélection existait : une option visible sur dix.
 * - Cette rangée défilait horizontalement, sans barre de défilement, derrière
 *   un masque en dégradé — et la molette **verticale** ne la bougeait pas
 *   (`scrollLeft` restait à 0). Les neuf options cachées étaient donc
 *   inatteignables avec une souris ordinaire.
 *
 * La réponse n'est pas d'élargir la barre : c'est de la tourner. En colonne,
 * les dix options tiennent sans défilement, sans masque, et chacune peut
 * porter son libellé entier, son raccourci et son infobulle — trois choses
 * qu'une rangée de pastilles tronquée ne peut pas offrir.
 */

import type { Tool } from "../../tools";
import {
  BRUSH_SIZES,
  TOOL_GROUPS,
  groupOf,
  optionsFor,
  type BrushSize,
  type ToolGroup,
} from "../tool-options";

type Props = {
  tool: Tool;
  /** Saison courante : elle décide des cultures semables. */
  season: Season;
  brush: BrushSize;
  directSeed: boolean;
  /** Laisser l'andain derrière la moissonneuse. */
  keepSwath: boolean;
  /** La culture sélectionnée laisse-t-elle de la paille ? L'herbe, non. */
  swathUseful: boolean;
  /** Nombre de cases mûres, pour la pastille de la famille Récolte. */
  readyCount: number;
  strawCount: number;
  baleCount: number;
  /** Chez un voisin : ni construction ni marché. */
  visiting: boolean;
  onTool: (t: Tool) => void;
  onBrush: (n: BrushSize) => void;
  onDirectSeed: () => void;
  onKeepSwath: () => void;
  onMarket: () => void;
  onGuide: () => void;
};

/** Ce que la famille affiche en pastille, s'il y a lieu. */
function groupBadge(id: ToolGroup, readyCount: number): number {
  return id === "HARVEST" ? readyCount : 0;
}

/** Compteur collé à une option — « Presser ×12 ». */
function optionCount(tool: Tool, straw: number, bales: number): number {
  if (tool === "BALE") return straw;
  if (tool === "COLLECT") return bales;
  return 0;
}

export function ToolRail({
  tool,
  season,
  brush,
  directSeed,
  keepSwath,
  swathUseful,
  readyCount,
  strawCount,
  baleCount,
  visiting,
  onTool,
  onBrush,
  onDirectSeed,
  onKeepSwath,
  onMarket,
  onGuide,
}: Props) {
  const group = groupOf(tool);
  const options = optionsFor(group, season);
  // Le pinceau ne concerne que les outils qui travaillent des cases : le
  // proposer sous « Voir » n'aurait aucun effet, et un réglage sans effet est
  // pire qu'un réglage absent.
  const showBrush = group === "PLANT" || group === "HARVEST" || group === "SOIL";

  return (
    <nav className="tool-rail" aria-label="Outils de champ">
      <ul className="tool-rail-groups">
        {TOOL_GROUPS.map((g) => {
          if (g.id === "SELL" && visiting) return null;
          const on = group === g.id;
          const badge = groupBadge(g.id, readyCount);
          return (
            <li key={g.id}>
              <button
                type="button"
                className={`tool-rail-group${on ? " on" : ""}`}
                aria-pressed={on}
                title={`${g.label} — touche ${g.hotkey}`}
                onClick={() => {
                  if (g.id === "SELL") onMarket();
                  else if (g.entry && !on) onTool(g.entry);
                }}
              >
                <span className="tool-rail-icon" aria-hidden="true">
                  <img src={g.icon} alt="" width={20} height={20} />
                </span>
                <span className="tool-rail-name">{g.label}</span>
                {/* Le raccourci s'affiche : on n'apprend pas une touche
                    qu'on ne voit jamais. */}
                <kbd className="tool-rail-key" aria-hidden="true">
                  {g.hotkey}
                </kbd>
                {badge > 0 && <span className="tool-rail-badge">{badge}</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {(options.length > 0 || group === "HARVEST") && (
        <div className="tool-rail-block">
          <h4 className="tool-rail-title">
            {group === "PLANT" ? "Culture" : group === "HARVEST" ? "Andain" : "Travail"}
          </h4>
          <ul className="tool-rail-options">
            {options.map((o) => {
              const on = tool === o.tool;
              const n = optionCount(o.tool, strawCount, baleCount);
              return (
                <li key={o.tool}>
                  <button
                    type="button"
                    className={`tool-rail-option${on ? " on" : ""}${o.outOfSeason ? " out-of-season" : ""}`}
                    aria-pressed={on}
                    title={o.hint}
                    onClick={() => onTool(o.tool)}
                  >
                    <span className="tool-rail-option-label">{o.label}</span>
                    {n > 0 && <span className="tool-rail-option-count">{n}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {group === "PLANT" && (
            <button
              type="button"
              className={`tool-rail-toggle${directSeed ? " on" : ""}`}
              aria-pressed={directSeed}
              title="Semer dans les chaumes : moins de travail du sol, moins de rendement."
              onClick={onDirectSeed}
            >
              <span className="tool-rail-check" aria-hidden="true">
                {directSeed ? "✓" : ""}
              </span>
              Semis direct
            </button>
          )}
          {/* L'andain ne se propose que là où il existe : sur de l'herbe la
              plante part entière, il ne reste rien à presser. Une case à
              cocher sans effet est pire qu'absente. */}
          {group === "HARVEST" && (
            <button
              type="button"
              className={`tool-rail-toggle${keepSwath ? " on" : ""}`}
              aria-pressed={keepSwath}
              disabled={!swathUseful}
              title={
                swathUseful
                  ? "Laisser la paille en andain derrière la machine, pour la presser ensuite en bottes. Décoché, elle est broyée et rendue au sol."
                  : "Cette culture ne laisse pas de paille."
              }
              onClick={onKeepSwath}
            >
              <span className="tool-rail-check" aria-hidden="true">
                {keepSwath && swathUseful ? "✓" : ""}
              </span>
              Laisser l’andain
            </button>
          )}
        </div>
      )}

      {showBrush && (
        <div className="tool-rail-block">
          <h4 className="tool-rail-title">
            Pinceau <kbd className="tool-rail-key inline">[ ]</kbd>
          </h4>
          <div className="tool-rail-brush" role="group" aria-label="Taille du pinceau">
            {BRUSH_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                className={`tool-rail-brush-btn${brush === n ? " on" : ""}`}
                aria-pressed={brush === n}
                title={`Travailler ${n}×${n} cases d’un clic`}
                onClick={() => onBrush(n)}
              >
                {n}×{n}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="tool-rail-foot">
        <button type="button" className="tool-rail-help" onClick={onGuide} title="Guide de ferme (?)">
          Guide de ferme
        </button>
        <dl className="tool-rail-hints">
          <div>
            <dt>
              <kbd>Ctrl</kbd>+clic
            </dt>
            <dd>ajoute</dd>
          </div>
          <div>
            <dt>
              <kbd>Maj</kbd>+clic
            </dt>
            <dd>rectangle</dd>
          </div>
          <div>
            <dt>
              <kbd>Alt</kbd>+glisser
            </dt>
            <dd>retire</dd>
          </div>
          <div>
            <dt>
              <kbd>Espace</kbd>+glisser
            </dt>
            <dd>déplace la vue</dd>
          </div>
        </dl>
      </div>
    </nav>
  );
}
