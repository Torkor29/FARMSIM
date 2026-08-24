import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ObjectiveView, Season } from "@farmsim/shared";
import { isFieldWorkTool, isPlantTool, isSoilTool, toolBareVerb, toolVerb, type Tool } from "./tools";
import { BRUSH_SIZES, TOOL_GROUPS, groupOf, optionsFor } from "./ui/tool-options";

/**
 * Barre d'outils tactile.
 *
 * Elle ne sert plus **que** le téléphone : la souris a son propre rail
 * (`ui/desktop/ToolRail`). C'est ce qui permet de la garder telle qu'elle
 * était — elle marchait — sans qu'elle ait à porter en plus les besoins d'un
 * écran de bureau, qui l'avaient rendue mauvaise pour les deux.
 *
 * Un seul défaut lui restait, mesuré : sa rangée d'options ne montrait que
 * deux entrées sur dix sur un écran de 390 px, le reste défilant derrière un
 * masque. Un doigt peut faire glisser cette rangée — contrairement à une
 * souris — mais rien ne disait qu'il y avait une suite. Le bouton « ⋯ » la
 * déplie donc en grille, et là tout est visible d'un coup.
 */

type ContractorOffer = {
  /**
   * Le devis, ou `null` quand l'entreprise ne prend pas ce travail-là.
   *
   * Elle ne vient ni presser, ni ramasser, ni déchaumer. Le bouton était
   * rendu quand même, avec un prix, et refusait au doigt. Sans prix, pas de
   * bouton — c'est « Demander de l'aide » qui prend le relais.
   */
  cost: number | null;
  hasMachine: boolean;
};

type Props = {
  tool: Tool;
  /** Saison courante : elle décide des cultures semables. */
  season: Season;
  brush: 1 | 2 | 3;
  /** Le glissé prend un rectangle plein plutôt que la trace du doigt. */
  dragRect?: boolean;
  isMobile: boolean;
  isEta: boolean;
  visiting?: boolean;
  busy: boolean;
  selectedCount: number;
  readyCount: number;
  strawCount?: number;
  baleCount?: number;
  silageReadyCount?: number;
  stockTons: number;
  /**
   * Peut-on payer ? La question, pas la somme.
   *
   * Le dock recevait la trésorerie brute et comparait lui-même `crd < coût`.
   * Un compte à trésorerie illimitée porte `crd` à zéro et un drapeau à côté :
   * l'en-tête affichait « ∞ € » pendant que « Payer · 428 € » restait
   * grisé, sans un mot pour dire pourquoi. La barre de bureau, elle, passait
   * déjà par `canPay`. Une seule règle, décidée en amont, pour les deux.
   */
  contractorAffordable: boolean;
  laborAffordable: boolean;
  /** Laisser l'andain derrière la moissonneuse. */
  keepSwath: boolean;
  /** La culture sélectionnée laisse-t-elle de la paille ? L'herbe, non. */
  swathUseful: boolean;
  /**
   * Ce qui manque au parc pour ce travail, ou `null` s'il est faisable.
   *
   * Sans cela le bouton partait quel que soit le garage : un débutant, dont le
   * parc n'a que tracteur, semoir et charrue, pouvait lancer sept travaux sur
   * dix qui ne pouvaient que refuser.
   */
  machineManquante?: string | null;
  contractor: ContractorOffer | null;
  laborQuote?: number | null;
  /** Pourquoi « Demander de l'aide » est absent, s'il l'est pour une raison. */
  laborBlocage?: string | null;
  objective: ObjectiveView | null;
  allGoalsDone: boolean;
  onTool: (t: Tool) => void;
  onBrush: (n: 1 | 2 | 3) => void;
  onDragRect: () => void;
  onClearSelection: () => void;
  /**
   * Prendre d'un coup toutes les cases que l'outil peut travailler.
   *
   * Le bureau a Ctrl+A. Au doigt, sélectionner quarante cases libres c'est
   * glisser en évitant le dock, les bâtiments, les cultures déjà là — et
   * ça n'allait jamais au bout. Un bouton, le même geste.
   */
  onSelectAll: () => void;
  /** Combien de cases l'outil courant peut prendre d'un coup. */
  eligibleCount: number;
  onKeepSwath: () => void;
  onConfirm: () => void;
  onHarvestAll: () => void;
  onContractor: () => void;
  onPublishLabor?: () => void;
  onSell: () => void;
  onGuide: () => void;
  hasHerd?: boolean;
  /**
   * Les panneaux tenaient dans une **seconde** barre collée sous celle-ci :
   * onze boutons sur deux rangées, soit près d'un quart de l'écran mangé en
   * permanence. Ils passent derrière une sixième case, « Plus », qui ouvre un
   * tiroir.
   */
  moreOpen?: boolean;
  moreBadge?: number;
  onMore?: () => void;
  /**
   * Bandeau du chantier en cours, empilé au-dessus du plateau.
   *
   * Il flottait, ancré à la fenêtre, à une hauteur de dock devinée une fois
   * pour toutes. Ce dock-ci en fait le triple et se dessine après lui : le
   * seul texte qui expliquait pourquoi tous les boutons étaient gris passait
   * dessous. Dans la pile, il ne peut plus être recouvert.
   */
  chantierBar?: ReactNode;
  /** La sélection n'est que de l'herbe mûre : on fauche, on ne moissonne pas */
  mowSelected?: boolean;
  /** Toutes les cases prêtes sont de l'herbe */
  mowReadyAll?: boolean;
};

export function FieldDock({
  tool,
  season,
  brush,
  dragRect = false,
  isMobile,
  isEta,
  visiting = false,
  busy,
  selectedCount,
  readyCount,
  strawCount = 0,
  baleCount = 0,
  silageReadyCount = 0,
  stockTons,
  contractorAffordable,
  laborAffordable,
  keepSwath,
  swathUseful,
  machineManquante,
  contractor,
  laborQuote = null,
  laborBlocage = null,
  objective,
  allGoalsDone,
  onTool,
  onBrush,
  onDragRect,
  onClearSelection,
  onSelectAll,
  eligibleCount,
  onKeepSwath,
  onConfirm,
  onHarvestAll,
  onContractor,
  onPublishLabor,
  onSell,
  onGuide,
  moreOpen,
  moreBadge = 0,
  onMore,
  chantierBar,
  mowSelected = false,
  mowReadyAll = false,
}: Props) {
  /** Rangée d'options dépliée en grille : tout devient visible d'un coup. */
  const [optionsOpen, setOptionsOpen] = useState(false);

  /**
   * Ramener sous les yeux l'outil qui vient d'être armé.
   *
   * Toucher « Sol » arme le déchaumage — la deuxième option sur six. Mais la
   * rangée reste au début, et sur un écran de 390 px il n'y entrait qu'une
   * seule pastille : le joueur voyait « Désherber », éteint, et concluait que
   * rien ne s'était armé. « Je peux pas déchaumer, rien. » L'outil en main
   * doit être visible, toujours ; c'est la seule façon de savoir ce que fera
   * le prochain geste sur le champ.
   */
  const rail = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const arme = rail.current?.querySelector<HTMLElement>("[data-armed='true']");
    // `scrollIntoView` ferait aussi défiler la page entière sur iOS : on ne
    // bouge que le rail, et seulement s'il défile vraiment.
    if (!arme || !rail.current) return;
    // Si rien ne dépasse, un scroll « smooth » partait quand même de zéro
    // et faisait sauter la rangée du bord vers le milieu.
    if (rail.current.scrollWidth <= rail.current.clientWidth + 1) return;
    const boite = rail.current.getBoundingClientRect();
    const cible = arme.getBoundingClientRect();
    if (cible.left >= boite.left && cible.right <= boite.right) return;
    // Avant peinture, sans animation : le joueur voit l'outil armé déjà
    // en place, pas une pastille qui arrive de gauche puis se recentre.
    rail.current.scrollLeft += cible.left - boite.left - 8;
  }, [tool, optionsOpen]);

  const group = groupOf(tool);
  const options = optionsFor(group, season);
  const arme = options.find((o) => o.tool === tool);
  const horsSaison = Boolean(arme?.outOfSeason);
  const plant = isPlantTool(tool);
  const soil = isSoilTool(tool);
  const harvest = tool === "HARVEST";
  const work = isFieldWorkTool(tool);
  const showTray =
    plant ||
    soil ||
    harvest ||
    (work && selectedCount > 0) ||
    readyCount > 0 ||
    strawCount > 0 ||
    baleCount > 0;

  /** Compteur collé à une option — « Presser ×12 ». */
  function optionCount(t: Tool): number {
    if (t === "BALE") return strawCount;
    if (t === "COLLECT") return baleCount;
    return 0;
  }

  /**
   * Pourquoi le bouton d'action ne part pas — écrit, pas seulement survolé.
   *
   * Le motif du refus ne vivait que dans l'attribut `title` du bouton grisé.
   * Un doigt ne survole rien : au téléphone, cette phrase n'a jamais été lue
   * par personne. Le joueur voyait trois boutons pâles et aucune explication —
   * « tout se grise ». Elle passe donc en clair sous la rangée, à l'endroit où
   * la consigne de tracé s'affiche déjà.
   */
  function raisonDuGrisage(): string | null {
    // Un chantier en cours grise **tous** les boutons d'action à la fois, le
    // temps qu'il dure — plusieurs minutes sur un grand champ. Le bandeau
    // au-dessus dit lequel et pour combien de temps : inutile de le répéter.
    if (chantierBar) return null;
    if (!work) return null;
    // Hors saison : le dire avant le geste, pas après un refus du serveur.
    // Le rail de bureau barre déjà la pastille ; ici le doigt n'a pas
    // d'infobulle au survol, donc la phrase passe en clair.
    if (horsSaison && arme?.hint) return arme.hint;
    if (selectedCount === 0) {
      // Le bouton est gris parce qu'il n'y a rien à travailler : ce n'est pas
      // une panne, c'est un geste qui manque. Autant le demander.
      return `Touchez le champ pour choisir les cases à ${toolBareVerb(tool, mowSelected).toLowerCase()}.`;
    }
    if (!machineManquante) return laborBlocage;
    /*
     * La machine manque. Reste à dire par où sortir — et ce n'est pas la même
     * porte selon le travail : l'entreprise de dépannage vient labourer ou
     * moissonner dans l'heure, mais elle ne vient ni presser ni ramasser. Ces
     * deux-là passent par l'entraide, qui a ses propres bornes. Nommer la
     * porte qui est **à l'écran**, jamais une autre.
     */
    const sortie =
      contractor && contractor.cost !== null
        ? " Sinon, « Payer » fait venir quelqu’un avec la sienne."
        : laborQuote !== null
          ? " Sinon, « Demander de l’aide » la confie à un autre joueur."
          : laborBlocage
            ? ` ${laborBlocage}`
            : "";
    return `${machineManquante}${sortie}`;
  }
  const blocage = raisonDuGrisage();

  return (
    <div className="field-dock">
      {chantierBar}
      <button type="button" className="quest-chip" onClick={onGuide}>
        <span className="quest-chip-mark" aria-hidden="true">
          {allGoalsDone ? "★" : "➤"}
        </span>
        <span className="quest-chip-body">
          <strong>{allGoalsDone ? "Guide de ferme" : "À faire"}</strong>
          <span>
            {allGoalsDone
              ? "Tout est dans le recueil — cultures, bâtiments, métiers."
              : objective
                ? `${objective.title} · ${objective.unlock}`
                : "Ouvrir le guide"}
          </span>
        </span>
      </button>

      {showTray && (
        <div className={`dock-tray${optionsOpen ? " expanded" : ""}`} role="toolbar" aria-label="Options de l’outil">
          {isEta && work && (
            <p className="stroke-hint">Glissez sur le champ · deux doigts pour bouger</p>
          )}
          {blocage && <p className="dock-hint">{blocage}</p>}

          <div className="dock-chips" ref={rail}>
            {options.map((o) => {
              const n = optionCount(o.tool);
              return (
                <button
                  key={o.tool}
                  type="button"
                  className={`chip${tool === o.tool ? " on" : ""}${o.outOfSeason ? " out-of-season" : ""}`}
                  aria-pressed={tool === o.tool}
                  data-armed={tool === o.tool}
                  title={o.hint}
                  onClick={() => onTool(o.tool)}
                >
                  {o.label}
                  {n > 0 ? ` ×${n}` : ""}
                </button>
              );
            })}

            {/* L'andain n'a de sens que sur une moisson de pailleuse : ni sur
                l'herbe, ni en ensilage, où la plante part entière. */}
            {harvest && swathUseful && (
              <button
                type="button"
                className={`chip ${keepSwath ? "on" : ""}`}
                aria-pressed={keepSwath}
                title="Laisser la paille en andain, pour la presser ensuite en bottes."
                onClick={onKeepSwath}
              >
                Andain
              </button>
            )}

            {/* Le pinceau termine la même rangée : sur sa propre ligne il
                coûtait une deuxième rangée. */}
            {BRUSH_SIZES.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip brush ${brush === n ? "on" : ""}`}
                aria-label={`Pinceau ${n} sur ${n}`}
                aria-pressed={brush === n}
                onClick={() => onBrush(n)}
              >
                {n}×{n}
              </button>
            ))}
          </div>

          <div className="dock-chips dock-chips-end">
            {/* Deux options sur dix tenaient dans la rangée dès qu'une action
                occupait la colonne de droite. Ce bouton la déplie. */}
            {options.length > 0 && (
              <button
                type="button"
                className={`chip dock-expand ${optionsOpen ? "on" : ""}`}
                aria-expanded={optionsOpen}
                aria-label={optionsOpen ? "Replier les options" : "Voir toutes les options"}
                onClick={() => setOptionsOpen((v) => !v)}
              >
                {optionsOpen ? "▾" : "⋯"}
              </button>
            )}
            {/* Vider la sélection : la coque tactile n'avait aucun moyen de le
                faire. Un toucher ajoute, un glissé remplace — mais rien ne
                permettait de repartir de zéro sans travailler le champ. */}
            {work && selectedCount > 0 && (
              <button
                type="button"
                className="chip"
                onClick={onClearSelection}
                title="Repartir d’une sélection vide"
              >
                Vider ×{selectedCount}
              </button>
            )}
            {/* Tout sélectionner : le même geste que Ctrl+A au bureau.
                Visible dès qu'un outil de champ est armé, même à zéro case
                — c'est précisément là qu'on en a besoin. */}
            {work && eligibleCount > 0 && (
              <button
                type="button"
                className="chip"
                onClick={onSelectAll}
                title="Sélectionner toutes les cases que cet outil peut travailler"
              >
                Tout · {eligibleCount}
              </button>
            )}
            {work && (
              <button
                type="button"
                className="chip go"
                disabled={busy || selectedCount === 0 || Boolean(machineManquante) || horsSaison}
                title={horsSaison ? arme?.hint : (machineManquante ?? undefined)}
                onClick={onConfirm}
              >
                {/* « Faire ×12 » ne disait pas ce qu'on allait faire : le
                    verbe de l'outil le dit, et c'est le même mot que sur le
                    bureau. */}
                {`${toolVerb(tool, mowSelected)} ×${selectedCount}`}
              </button>
            )}
            {contractor && contractor.cost !== null && !visiting && (
              /* L'explication passe dans l'infobulle du bouton — elle reste
                 accessible, elle ne mange plus la parcelle. */
              <button
                type="button"
                className="chip eta"
                disabled={busy || selectedCount === 0 || !contractorAffordable || horsSaison}
                title={
                  horsSaison
                    ? arme?.hint
                    : tool === "HARVEST" && !mowSelected && !contractor.hasMachine
                    ? `Vous n’avez pas la machine : quelqu’un le fait pour vous — ${contractor.cost} €`
                    : `Quelqu’un le fait pour vous, tout de suite — ${contractor.cost} €`
                }
                onClick={onContractor}
              >
                {/* Qui fait le travail, en deux mots : au doigt, l'infobulle
                    n'existe pas, donc le libellé doit se suffire. */}
                Entreprise · {contractor.cost} €
              </button>
            )}
            {laborQuote != null && !visiting && onPublishLabor && (
              <button
                type="button"
                className="chip"
                disabled={busy || !laborAffordable || horsSaison}
                title={
                  horsSaison
                    ? arme?.hint
                    : "Cet argent est mis de côté jusqu’à la fin (ou l’annulation)."
                }
                onClick={onPublishLabor}
              >
                Un joueur · {laborQuote} €
              </button>
            )}
            {readyCount > 0 && (
              <button type="button" className="chip go" disabled={busy} onClick={onHarvestAll}>
                {mowReadyAll ? `Tout faucher ×${readyCount}` : `Tout récolter ×${readyCount}`}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="dock-bar" role="toolbar" aria-label="Outils de champ">
        {TOOL_GROUPS.map((g) => {
          const on = group === g.id;
          return (
            <button
              key={g.id}
              type="button"
              className={`dock-tool ${on ? "on" : ""} ${g.id === "SELL" ? "sell" : ""}`}
              aria-pressed={on}
              aria-label={
                g.id === "SELL" && stockTons > 0
                  ? `Marché — ${stockTons.toFixed(0)} t en stock`
                  : g.label
              }
              onClick={() => {
                if (g.id === "SELL") onSell();
                else if (g.entry && !on) onTool(g.entry);
              }}
            >
              <img src={g.icon} alt="" width={22} height={22} />
              <span className="dock-label">{g.label}</span>
              {g.id === "HARVEST" && readyCount > 0 && (
                <span className="dock-badge">{readyCount}</span>
              )}
              {g.id === "SELL" && stockTons > 0 && (
                <span className="dock-badge stock">{stockTons.toFixed(0)} t</span>
              )}
            </button>
          );
        })}
        {isMobile && onMore && (
          <button
            type="button"
            className={`dock-tool more ${moreOpen ? "on" : ""}`}
            aria-pressed={moreOpen}
            aria-expanded={moreOpen}
            onClick={onMore}
          >
            <span className="dock-emoji" aria-hidden="true">
              {moreOpen ? "✕" : "☰"}
            </span>
            <span className="dock-label">{moreOpen ? "Fermer" : "Plus"}</span>
            {!moreOpen && moreBadge > 0 && <span className="dock-badge">{moreBadge}</span>}
          </button>
        )}
        {/* Trace ou rectangle : un tap pour basculer, toujours au même
            endroit. C'était une pastille dans chaque sous-menu, et le
            sixième bouton du dock n'existait que pour les comptes Test.
            Test reste dans Plus ; ici on choisit comment on sélectionne. */}
        <button
          type="button"
          className={`dock-tool extra ${dragRect ? "on" : ""}`}
          aria-pressed={dragRect}
          title={
            dragRect
              ? "Le glissé prend le rectangle entre les deux coins. Toucher pour tracer."
              : "Le glissé suit le doigt, case par case. Toucher pour un rectangle."
          }
          onClick={onDragRect}
        >
          <span className="dock-emoji" aria-hidden="true">
            {dragRect ? "▦" : "✎"}
          </span>
          <span className="dock-label">{dragRect ? "Rectangle" : "Trace"}</span>
        </button>
      </div>
    </div>
  );
}
