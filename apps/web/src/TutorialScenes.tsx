/**
 * Les démonstrations du tutoriel : on montre, on ne décrit pas.
 *
 * ## Pourquoi des dessins animés
 *
 * L'ancien tutoriel tenait en huit paragraphes. « Choisissez Semer, touchez
 * des cases nues, puis le bouton d'or Faire » : chaque mot est juste, et
 * pourtant on ne sait pas quoi faire, parce qu'on n'a jamais vu ni la barre
 * d'outils ni le bouton d'or. Un geste se montre.
 *
 * Chaque scène est une maquette minuscule du jeu — la grille, la barre, le
 * panneau — où un curseur fait le geste en boucle. On peut la regarder deux
 * fois sans rien relire.
 *
 * ## Le curseur change de forme
 *
 * Un glissé à la souris et une suite d'appuis au doigt ne sont pas le même
 * geste. Les scènes reçoivent donc `tactile` et jouent ce que le joueur peut
 * réellement faire sur *son* écran : montrer un clic droit à quelqu'un qui
 * joue au téléphone est pire que de ne rien montrer.
 *
 * Tout est en SVG et en CSS : aucune image à télécharger, et l'animation
 * s'arrête d'elle-même si le système demande moins de mouvement.
 */

import type { Scene } from "./tutorial-steps";

type Props = {
  scene: Scene;
  /** L'écran répond-il au doigt ? Le geste montré en dépend. */
  tactile: boolean;
};

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

/** La grille de champ : quatre cases sur trois, comme une parcelle vue de haut. */
function Grille({
  classeCase,
}: {
  classeCase?: (i: number) => string;
}) {
  return (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const cx = 14 + (i % 4) * 30;
        const cy = 16 + Math.floor(i / 4) * 26;
        return (
          <rect
            key={i}
            className={`tuto-case ${classeCase?.(i) ?? ""}`}
            x={cx}
            y={cy}
            width={26}
            height={22}
            rx={3}
          />
        );
      })}
    </g>
  );
}

/**
 * Le curseur : une flèche à la souris, un rond au doigt.
 *
 * La différence n'est pas décorative. Un rond qui s'écrase, c'est un appui ;
 * une flèche qui traîne, c'est un glissé. Le joueur reconnaît son geste.
 */
function Curseur({ tactile, classe }: { tactile: boolean; classe: string }) {
  if (tactile) {
    return (
      <g className={classe}>
        <circle className="tuto-doigt-halo" r={11} />
        <circle className="tuto-doigt" r={6} />
      </g>
    );
  }
  return (
    <g className={classe}>
      <path className="tuto-fleche" d="M0 0 L0 15 L4 11.5 L7 17 L10 15.5 L7 10 L12 9 Z" />
    </g>
  );
}

/** La barre d'outils du bas, en réduction. */
function BarreOutils({ actif }: { actif: number }) {
  return (
    <g>
      <rect className="tuto-barre" x={8} y={70} width={124} height={20} rx={6} />
      {["Voir", "Semer", "Désherber", "Récolter"].map((_, i) => (
        <rect
          key={i}
          className={`tuto-outil ${i === actif ? "on" : ""}`}
          x={13 + i * 30}
          y={74}
          width={25}
          height={12}
          rx={3}
        />
      ))}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Les scènes                                                          */
/* ------------------------------------------------------------------ */

export function TutorialScene({ scene, tactile }: Props) {
  return (
    <div className="tuto-scene" aria-hidden="true">
      <svg viewBox="0 0 140 96" role="img">
        {rendre(scene, tactile)}
      </svg>
    </div>
  );
}

function rendre(scene: Scene, tactile: boolean) {
  switch (scene) {
    /* L'écran, une région après l'autre : on nomme avant d'agir. */
    case "interface":
      return (
        <>
          <rect className="tuto-zone z1" x={4} y={4} width={92} height={62} rx={4} />
          <rect className="tuto-zone z2" x={100} y={4} width={36} height={62} rx={4} />
          <rect className="tuto-zone z3" x={4} y={70} width={132} height={22} rx={4} />
          <text className="tuto-txt" x={50} y={38}>
            la ferme
          </text>
          <text className="tuto-txt petit" x={118} y={38}>
            détails
          </text>
          <text className="tuto-txt petit" x={70} y={84}>
            outils et onglets
          </text>
        </>
      );

    /* Choisir un outil : le geste le plus oublié, parce qu'il vient avant. */
    case "outils":
      return (
        <>
          <Grille />
          <BarreOutils actif={1} />
          <Curseur tactile={tactile} classe="tuto-curseur vers-outil" />
        </>
      );

    /*
     * Sélectionner. À la souris on glisse en diagonale ; au doigt on appuie
     * case après case. Deux gestes, deux animations.
     */
    case "selection":
      return (
        <>
          <Grille classeCase={(i) => ([1, 2, 5, 6].includes(i) ? "sel" : "")} />
          {!tactile && <rect className="tuto-lasso" x={44} y={16} width={56} height={48} rx={3} />}
          <BarreOutils actif={1} />
          <Curseur
            tactile={tactile}
            classe={tactile ? "tuto-curseur tapote" : "tuto-curseur glisse"}
          />
        </>
      );

    /* Le bouton d'or : rien ne part tant qu'on ne l'a pas touché. */
    case "chantier":
      return (
        <>
          <Grille classeCase={(i) => ([1, 2, 5, 6].includes(i) ? "sel" : "")} />
          <g className="tuto-tracteur">
            <rect x={-9} y={-5} width={14} height={9} rx={2} />
            <circle cx={-5} cy={5} r={3} />
            <circle cx={2} cy={5} r={3.5} />
          </g>
          <rect className="tuto-faire" x={92} y={70} width={40} height={20} rx={6} />
          <text className="tuto-txt sur-or" x={112} y={83}>
            Faire
          </text>
          <Curseur tactile={tactile} classe="tuto-curseur vers-faire" />
        </>
      );

    /* La pousse : c'est du temps, et le temps se montre par une barre. */
    case "pousse":
      return (
        <>
          <Grille classeCase={(i) => ([1, 2, 5, 6].includes(i) ? "pousse" : "")} />
          <rect className="tuto-jauge-fond" x={14} y={76} width={112} height={8} rx={4} />
          <rect className="tuto-jauge" x={14} y={76} height={8} rx={4} />
          <text className="tuto-txt petit" x={70} y={94}>
            vert → doré
          </text>
        </>
      );

    /* Récolter : les cases dorées se vident, le grain part au silo. */
    case "recolte":
      return (
        <>
          <Grille classeCase={(i) => ([1, 2, 5, 6].includes(i) ? "mur" : "")} />
          <g className="tuto-moisson">
            <rect x={-10} y={-6} width={16} height={11} rx={2} />
            <rect x={6} y={-3} width={7} height={8} rx={1.5} />
            <circle cx={-6} cy={6} r={3.2} />
            <circle cx={3} cy={6} r={3.2} />
          </g>
          <BarreOutils actif={3} />
        </>
      );

    /* « Nettoyer » : désherber, et déchaumer après la moisson. */
    case "nettoyer":
      return (
        <>
          <Grille classeCase={(i) => ([1, 2, 5, 6].includes(i) ? "sale" : "")} />
          <g className="tuto-herbes">
            {[1, 2, 5, 6].map((i) => {
              const cx = 27 + (i % 4) * 30;
              const cy = 27 + Math.floor(i / 4) * 26;
              return (
                <g key={i}>
                  <path d={`M${cx - 4} ${cy + 5} q2 -7 1 -9`} />
                  <path d={`M${cx} ${cy + 5} q-1 -8 2 -10`} />
                  <path d={`M${cx + 4} ${cy + 5} q2 -6 0 -8`} />
                </g>
              );
            })}
          </g>
          <BarreOutils actif={2} />
        </>
      );

    /* Bâtir : l'emprise se pose, verte ou rouge, avant le clic. */
    case "batir":
      return (
        <>
          <Grille />
          <rect className="tuto-emprise refus" x={14} y={16} width={56} height={48} rx={3} />
          <rect className="tuto-emprise ok" x={74} y={16} width={56} height={48} rx={3} />
          <text className="tuto-txt petit refus-txt" x={42} y={44}>
            occupé
          </text>
          <text className="tuto-txt petit ok-txt" x={102} y={44}>
            libre
          </text>
          <Curseur tactile={tactile} classe="tuto-curseur vers-emprise" />
        </>
      );

    /* Le troupeau : l'auge se remplit d'un seul geste. */
    case "troupeau":
      return (
        <>
          <rect className="tuto-etable" x={12} y={14} width={54} height={40} rx={4} />
          <path className="tuto-toit" d="M8 16 L39 2 L70 16 Z" />
          <circle className="tuto-bete" cx={30} cy={40} r={5} />
          <circle className="tuto-bete" cx={48} cy={42} r={5} />
          <rect className="tuto-jauge-fond" x={78} y={30} width={50} height={10} rx={5} />
          <rect className="tuto-jauge lente" x={78} y={30} height={10} rx={5} />
          <text className="tuto-txt petit" x={103} y={54}>
            la ration
          </text>
          <BarreOutils actif={0} />
        </>
      );

    /* Vendre : le grain devient de l'argent, et le cours monte et descend. */
    case "vendre":
      return (
        <>
          <rect className="tuto-zone z2" x={8} y={10} width={124} height={54} rx={4} />
          <polyline className="tuto-cours" points="16,54 36,44 56,50 76,30 96,38 124,20" />
          <circle className="tuto-point" cx={124} cy={20} r={3.5} />
          <text className="tuto-txt petit" x={70} y={84}>
            le cours bouge chaque jour
          </text>
        </>
      );
  }
}
