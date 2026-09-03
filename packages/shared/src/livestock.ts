/**
 * Élevage bovin — bien-être animal, pâturage et production.
 *
 * Réponse à la demande client : l'étable seule est un **bâtiment fermé** (les
 * bêtes ne sortent jamais), et c'est l'ajout d'un **enclos adjacent** qui
 * débloque la sortie au pré. Les bêtes qui sortent régulièrement voient leur
 * bonheur monter, et ce bonheur se paie en litres de lait et en kilos de
 * carcasse à l'abattage.
 *
 * Tout est pur : aucune fonction ne lit l'horloge, la base ou le réseau —
 * l'instant courant est toujours passé en paramètre pour rester rejouable en
 * simulation (même contrat que `land.ts`).
 *
 * Le pari d'équilibrage : le bonheur n'est **jamais** un interrupteur, c'est un
 * état lent (constantes de temps de 12 h à 36 h). Un joueur ne peut donc pas
 * « faire sortir les vaches juste avant la traite » pour rafler le bonus : il
 * doit tenir un régime de sorties sur plusieurs jours. Inversement, oublier
 * ses bêtes trois jours ne les ruine pas, ça les ramène au plancher.
 *
 * @see docs/research/07_ANIMAL_SYSTEM.md
 */

/**
 * Recopié de `index.js` : l'importer d'ici créerait un cycle, puisque
 * `index.ts` réexporte l'ensemble du domaine. Toute évolution doit rester
 * synchronisée avec `WeatherState` (même convention que `climate.ts`).
 */
export type { WeatherState } from "./climate.js";
import type { WeatherState } from "./climate.js";

import { SPECIES } from "./species.js";
import { GAME_DAY_MS } from "./time.js";

/**
 * Projette le profil de chaque espèce sur une table par espèce.
 *
 * `species.ts` n'importe de ce module que le **type** `AnimalKind`, effacé à
 * la compilation : il n'y a donc pas de cycle au runtime.
 */
function mapSpecies<T>(pick: (s: (typeof SPECIES)[AnimalKind]) => T): Record<AnimalKind, T> {
  const out = {} as Record<AnimalKind, T>;
  for (const profil of Object.values(SPECIES)) out[profil.kind] = pick(profil);
  return out;
}

/** Recopié de `index.js` (`MAX_BUILDING_LEVEL`) — à garder synchronisé. */
export const MAX_BARN_LEVEL = 5;

/**
 * Durée d'un cycle d'élevage `[GD]` — un jour de jeu.
 *
 * Le temps du jeu est compressé : un cycle calé sur 24 h réelles rendrait le
 * bien-être animal strictement invisible, le joueur sortirait ses bêtes sans
 * jamais voir la jauge bouger.
 *
 * Le commentaire disait « on l'aligne donc sur une saison », et c'était vrai :
 * les deux constantes valaient quinze minutes chacune, dans deux fichiers
 * différents. Une saison durait donc un cycle d'élevage — une traite par
 * saison, et l'hiver passait avant qu'on l'ait vu venir. Le cycle est
 * désormais **un jour**, et la saison une semaine de sept de ces jours.
 */
export const LIVESTOCK_CYCLE_MS = GAME_DAY_MS;

/**
 * Ce qu'une distribution doit couvrir : **un jour réel** `[GD]`.
 *
 * Le cycle d'élevage vaut un jour de jeu, soit **quinze minutes réelles**. La
 * distribution servait exactement un cycle : il fallait donc revenir nourrir
 * ses bêtes toutes les quinze minutes, sous peine de les voir dépérir. C'est
 * intenable pour qui joue le soir après le travail, et c'est le reproche tel
 * qu'il a été formulé : « la ration devrait être pour un jour réel, beaucoup
 * trop compliqué à gérer sinon ».
 *
 * Rien n'est déséquilibré pour autant : la consommation par cycle ne bouge
 * pas, seule la **granularité** du geste change. Sur vingt-quatre heures on
 * dépense la même chose ; on le fait en une fois au lieu de quatre-vingt-seize.
 */
export const RATION_REAL_MS = 24 * 60 * 60 * 1000;

/**
 * Capacité de la mangeoire, en jours réels `[GD]`.
 *
 * Deux jours, pas plus : la mangeoire garde de l'avance pour qui passe un jour
 * sans se connecter, sans permettre de vider le silo d'un clic et de laisser
 * l'élevage tourner seul une saison entière. Au-delà, le fourrage se gâte —
 * c'est aussi ce qui se passe dans une vraie auge.
 */
export const TROUGH_REAL_DAYS = 2;

/** Nombre de cycles couverts par un jour réel. */
export function rationCycles(cycleMs = LIVESTOCK_CYCLE_MS): number {
  return Math.max(1, RATION_REAL_MS / Math.max(1, cycleMs));
}

/**
 * Ce que la mangeoire peut contenir, en unités nutritives.
 *
 * `besoinParCycle` est le besoin d'un cycle pour ce lot — c'est ce que le
 * serveur publie sous `feedNeed`.
 */
export function troughCapacity(besoinParCycle: number, cycleMs = LIVESTOCK_CYCLE_MS): number {
  return Math.max(0, besoinParCycle) * rationCycles(cycleMs) * TROUGH_REAL_DAYS;
}

/**
 * Ce qu'il faut distribuer maintenant pour **remplir la mangeoire**, en unités.
 *
 * Ce qui reste dans l'auge est déduit : un lot presque repu ne reçoit pas
 * autant qu'un lot à jeun.
 *
 * ## Pourquoi la cible est la capacité, et non un jour
 *
 * Elle visait un jour réel quand la mangeoire en tient deux. Les deux
 * nombres se contredisaient, et l'écran donnait raison au second : la jauge
 * se mesure sur la capacité. Nourrir un lot déjà servi ne montait donc
 * jamais au-delà de la moitié de la jauge — et au-delà d'un jour, cette
 * fonction rendait zéro, si bien que chaque clic ne distribuait plus que le
 * minimum de cent kilos. Signalé en jouant, et sans exagérer de beaucoup :
 * « quand tu veux remplir le truc de bouffe, faut cliquer 300 000 fois ».
 *
 * Le deuxième jour de réserve existe précisément pour qui passe une journée
 * sans se connecter ; il était inatteignable. On remplit donc jusqu'au bord,
 * ce que le serveur acceptait déjà. Rien ne change côté consommation : les
 * bêtes mangent au même rythme, on leur sert seulement de quoi tenir en une
 * fois au lieu de deux.
 */
export function rationToServe(input: {
  besoinParCycle: number;
  feedStock: number;
  cycleMs?: number;
}): number {
  const cible = troughCapacity(input.besoinParCycle, input.cycleMs);
  return Math.max(0, cible - Math.max(0, input.feedStock));
}

/**
 * Autonomie restante, en **millisecondes réelles**.
 *
 * L'écran affichait « 0 j » et le joueur comprenait « zéro jour réel », alors
 * qu'il s'agissait de jours de jeu de quinze minutes. On compte donc dans
 * l'unité qui sert à décider quand revenir : l'horloge murale.
 */
export function feedAutonomyMs(input: {
  besoinParCycle: number;
  feedStock: number;
  cycleMs?: number;
}): number {
  const besoin = Math.max(0, input.besoinParCycle);
  if (besoin <= 0) return 0;
  const cycles = Math.max(0, input.feedStock) / besoin;
  return cycles * (input.cycleMs ?? LIVESTOCK_CYCLE_MS);
}

/**
 * À partir de quel niveau le bâtiment ramasse la production tout seul `[GD]`.
 *
 * « J'ai mis l'étable niveau 2 mais je dois toujours me taper le lait à traire
 * moi-même. » Le reproche est juste : améliorer un bâtiment coûtait cher et ne
 * changeait rien à la corvée. Or la traite se refait toutes les quinze minutes
 * réelles — c'est le rythme d'un cycle —, ce qui condamne à revenir sans
 * cesse ou à perdre du lait.
 *
 * Le premier palier installe donc **la salle de traite** : au-delà, le lait,
 * les œufs et la laine tombent au silo à chaque tick, sans un clic. Le niveau 1
 * garde le geste à la main, ce qui lui donne enfin une raison d'être amélioré.
 */
export const AUTO_COLLECT_LEVEL = 2;

/** Le bâtiment ramasse-t-il tout seul, à ce niveau ? */
export function autoCollects(barnLevel: number): boolean {
  return Math.round(barnLevel) >= AUTO_COLLECT_LEVEL;
}

/**
 * Ce que la cuve peut accumuler avant que la production ne soit perdue,
 * en cycles `[GD]`.
 *
 * Le plafond était de **deux cycles**, soit trente minutes d'horloge : passé ce
 * délai, tout ce que les bêtes produisaient disparaissait sans un mot. Le même
 * défaut que la ration, vu de l'autre côté — une journée de travail ou une nuit
 * de sommeil suffisait à tout perdre.
 *
 * La cuve tient maintenant un jour réel. Une ferme qu'on visite une fois par
 * jour ne perd donc rien ; au-delà, la production plafonne, ce qui garde une
 * raison de revenir.
 */
export function collectCapCycles(cycleMs = LIVESTOCK_CYCLE_MS): number {
  return rationCycles(cycleMs);
}

/** Traite / œufs / laine : prêt au bout de 15 % d’un cycle. */
export const COLLECT_READY_RATIO = 0.15;

/** 0 = vient d’être collecté, 1 = prêt. */
export function collectProgress(
  lastAt: number | null,
  bornAt: number,
  now: number,
  cycleMs = LIVESTOCK_CYCLE_MS,
): number {
  const start = lastAt ?? bornAt;
  const need = cycleMs * COLLECT_READY_RATIO;
  if (need <= 0) return 1;
  return Math.min(1, Math.max(0, (now - start) / need));
}

export function collectReady(
  lastAt: number | null,
  bornAt: number,
  now: number,
  cycleMs = LIVESTOCK_CYCLE_MS,
): boolean {
  return collectProgress(lastAt, bornAt, now, cycleMs) >= 1;
}

/**
 * « Heure » d'élevage — unité de toutes les constantes de dérive. Elle suit le
 * temps compressé du jeu, pas l'horloge murale : 24 heures d'élevage font un
 * cycle. Exportée pour que l'UI et les tests parlent la même langue.
 */
export const LIVESTOCK_HOUR_MS = LIVESTOCK_CYCLE_MS / 24;

const HOUR_MS = LIVESTOCK_HOUR_MS;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Arrondi à un dixième — les jauges d'UI n'affichent qu'une décimale. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* 1. Entités                                                          */
/* ------------------------------------------------------------------ */

export type AnimalKind = "COW" | "PIG" | "HEN" | "SHEEP";

/**
 * Tables par espèce — dérivées de `SPECIES`.
 *
 * Elles restent exportées parce que tout le jeu les appelle, mais elles ne
 * sont plus une source de vérité : ajouter une espèce se fait dans
 * `species.ts`, et rien d'autre n'est à retrouver.
 */

/** Dessin isométrique de la bête, pour l’UI — même principe que les bâtiments. */
export const ANIMAL_ART: Record<AnimalKind, string> = mapSpecies((s) => s.art);

/** Pose tête au sol (pré), quand on a un second dessin. */
export const ANIMAL_GRAZE_ART: Partial<Record<AnimalKind, string>> = Object.fromEntries(
  Object.values(SPECIES)
    .filter((s) => s.grazeArt)
    .map((s) => [s.kind, s.grazeArt!]),
) as Partial<Record<AnimalKind, string>>;

/** Éleveur débutant : quelques vaches, pas une étable vide. */
export const STARTER_COW_COUNT = 3;
/** Foin offert à l’installation, pour tenir le premier cycle. */
export const STARTER_HAY_TONS = 2;

export const ANIMAL_PRICE: Record<AnimalKind, number> = mapSpecies((s) => s.price);

/** Ration de base par bête et par cycle, en kg `[GD]` */
export const FEED_BASE: Record<AnimalKind, number> = mapSpecies((s) => s.feedKg);

/**
 * Le nom de l'espèce, au pluriel.
 *
 * Il n'existait nulle part : l'interface disait « bêtes » partout, y compris
 * là où on achète. « Acheter des vaches » se comprend sans rien lire d'autre.
 */
export const ANIMAL_PLURAL: Record<AnimalKind, string> = mapSpecies((s) => s.plural);

export function kindForBarn(type: string): AnimalKind | null {
  if (type === "CATTLE_BARN") return "COW";
  if (type === "PIGSTY") return "PIG";
  if (type === "HENHOUSE") return "HEN";
  if (type === "SHEEPFOLD") return "SHEEP";
  return null;
}

/** Aire de sortie collée au bâtiment : pré pour vaches/moutons, courette sinon. */
export function yardTypeForBarn(type: string): string {
  if (type === "PIGSTY") return "PIG_YARD";
  if (type === "HENHOUSE") return "HEN_YARD";
  return "PADDOCK";
}

/**
 * Un lot d'animaux, pas un animal : la doc §2 impose l'agrégat en V1, sinon la
 * simulation d'un gros cheptel devient un problème de perf pour rien.
 */
export type Herd = {
  id: string;
  kind: AnimalKind;
  /** Effectif du lot */
  size: number;
  /** Âge moyen du lot, en ms de jeu écoulés depuis la naissance */
  averageAgeMs: number;
  /**
   * Bien-être `∈ [0 ; 1]`. Parce que `tickHappiness()` est une relaxation
   * exponentielle, cette valeur **est** déjà une moyenne mobile pondérée des
   * conditions de vie récentes : c'est ce qui autorise `meatYield()` à s'en
   * servir comme proxy du bonheur cumulé sur la vie de l'animal (§3).
   */
  happiness: number;
  /** Timestamp de la dernière sortie au pâturage, `null` si jamais sortie */
  lastGrazedAt: number | null;
  /** Timestamp de la dernière traite, `null` si jamais traite */
  lastMilkedAt: number | null;
};

/**
 * L'enclos vu depuis l'étable. `adjacent` est le résultat de
 * `isPaddockAdjacent()` : un enclos posé à l'autre bout de la ferme existe
 * mais ne sert à rien, et le joueur doit le voir.
 */
export type PaddockState = {
  /** L'enclos partage-t-il un bord avec l'étable ? */
  adjacent: boolean;
  /** Surface de l'enclos, en cases de grille */
  cells: number;
  /** Places disponibles, cf. `paddockCapacity()` */
  capacity: number;
};

/* ------------------------------------------------------------------ */
/* 2. Satisfaction des besoins — le cœur de la demande                 */
/* ------------------------------------------------------------------ */

/**
 * Constantes de dérive de la satisfaction des besoins `[GD]`.
 *
 * ## Ce que cette jauge veut dire, désormais
 *
 * **Cent pour cent quand les besoins sont remplis.** Trois besoins, et trois
 * seulement : manger, boire, avoir la place. Une vache nourrie, abreuvée et
 * logée dans la capacité de son étable est à 1,0 — en juin comme en décembre,
 * dehors comme dedans. Il n'existe plus de plancher subi.
 *
 * ## Ce qu'elle voulait dire avant, et ce que ça a coûté
 *
 * Il y avait un `confinedFloor` à 0,35 : la cible d'une bête qui ne sort
 * jamais. Sortie au pré, elle montait à 0,95 ; enfermée, elle retombait à
 * 0,35, et la mortalité commençait à 0,15 (`MORTALITY.floor`). Un troupeau
 * enfermé n'avait donc plus que 0,20 point de marge là où un troupeau sorti en
 * avait 0,80 : l'enfermement ne tuait pas seul, il **rendait mortel tout le
 * reste**. Ni la saison ni la température n'entraient nulle part — rentrer les
 * bêtes en décembre était puni exactement comme les enfermer en juin.
 *
 * Strea a envoyé la capture qui a déclenché cette réécriture : dix-neuf bêtes
 * pour cinquante-cinq places, ration servie avec un jour d'avance, litière
 * pleine, et « le troupeau dépérit — des bêtes vont mourir · sortez-les au
 * pré », devant un pré à 0,0 t d'herbe et 10 °C dehors. Le jeu réclamait un
 * geste qui n'aidait pas, et tuait si on ne le faisait pas.
 *
 * Le plein air ne disparaît pas pour autant : il passe du côté des **bonus**,
 * avec le reste de l'installation (`installationBonus()`). On ne perd plus
 * rien à rester à l'étable ; on gagne à bâtir autour.
 */
export const HAPPINESS = {
  /** Bornes dures de la jauge */
  min: 0,
  max: 1,
  /**
   * Constante de temps de la **baisse**, en heures `[TEST]`. Volontairement
   * lente : un besoin qui vient de tomber ne fait pas plonger la jauge dans la
   * minute, le joueur a le temps de revenir.
   */
  decayTauH: 36,
  /** Constante de temps de la **hausse**, en heures `[TEST]` — 3× plus rapide */
  riseTauH: 12,
  /**
   * Taux d'occupation toléré sans gêne `[GD]`.
   *
   * **Un**, et pas 0,85. Une étable de cinquante-cinq places accueille
   * cinquante-cinq bêtes : c'est ce que « cinquante-cinq places » veut dire.
   * À 0,85, elle était déclarée pleine à quarante-sept, et le joueur lisait
   * « encombrée » devant quinze places vides.
   *
   * La capacité et le confort sont deux choses distinctes. La capacité dit
   * combien de bêtes tiennent ; le confort se gagne en bâtissant, il ne se
   * perd pas en remplissant ce qu'on a payé.
   */
  crowdingComfort: 1,
  /**
   * Taux d'occupation où le stress est maximal `[GD]`.
   *
   * Porté de 1,5 à **2,0** : le maximum de la peine doit désigner
   * l'entassement massif — deux fois la place — et non un dépassement de
   * moitié, qui est une erreur de gestion ordinaire.
   */
  crowdingCritical: 2,
  /**
   * Pénalité maximale de surpeuplement, en points de cible `[GD]`.
   *
   * Portée de 0,30 à **0,35**, et c'est délibérément *plus* sévère au sommet.
   * L'assouplissement porte sur la forme de la courbe, pas sur son extrémité :
   * un enclos chargé au double doit rester mortel, faute de quoi
   * l'entassement cesserait d'être une contrainte.
   */
  crowdingPenaltyMax: 0.35,
  /**
   * Exposant de la courbe de gêne `[GD]`. Le cœur du réglage.
   *
   * La peine croît comme le **carré** du dépassement, plus linéairement.
   * Voir `crowdingPenalty()` pour ce que ce 2 change.
   */
  crowdingExponent: 2,
} as const;

/**
 * Peine de dépassement de capacité `∈ [0 ; 0,35]`.
 *
 * **Zéro tant qu'on est dans la capacité**, quelle que soit l'occupation :
 * 30/55, 40/55, 54/55, 55/55 ne coûtent rien. La peine ne commence qu'au
 * cinquante-sixième, et croît comme le carré du dépassement jusqu'au double
 * de la capacité.
 *
 * ## Ce qui était faux, et le prix que ça a coûté
 *
 * Deux erreurs superposées, et il fallait les corriger ensemble.
 *
 * La première : la peine démarrait à **85 %** d'occupation. Une étable de
 * cinquante-cinq places était donc déclarée gênée à quarante-sept bêtes, et le
 * joueur lisait « encombrée » devant quinze places qu'il avait payées. C'est
 * une contradiction pure : soit le bâtiment a cinquante-cinq places, soit il
 * n'en a que quarante-sept.
 *
 * La seconde, plus grave, ne se voyait pas ici : le ratio n'était même pas
 * calculé sur l'étable. Il l'était sur les cases de l'**enclos** — dix-huit
 * pour cinquante-cinq places — si bien qu'on était « encombré » dès seize
 * bêtes, et qu'un troupeau sans enclos du tout écopait d'un ratio de 1 en dur,
 * donc d'une peine permanente sans aucun moyen d'en sortir. Voir la correction
 * côté serveur, où le ratio se lit désormais sur `barnCapacity()`.
 *
 * Combinées au plancher d'enfermement, ces deux erreurs tuaient des troupeaux
 * nourris, paillés, et remplis au tiers de leur capacité.
 *
 * ## La courbe
 *
 * `peine = 0,35 × (dépassement / 1)²`, du plein au double.
 *
 *  - **jusqu'à 100 %** — rien. C'est la capacité, elle s'utilise entièrement.
 *  - **à 130 %** — une erreur de gestion : de la production en moins.
 *  - **à 200 %** — l'entassement massif, et là seulement il devient grave.
 */
export function crowdingPenalty(crowding: number): number {
  const excess = Math.max(0, crowding) - HAPPINESS.crowdingComfort;
  if (excess <= 0) return 0;
  const span = HAPPINESS.crowdingCritical - HAPPINESS.crowdingComfort;
  return HAPPINESS.crowdingPenaltyMax * clamp(excess / span, 0, 1) ** HAPPINESS.crowdingExponent;
}

/**
 * Occupation à partir de laquelle le seul entassement devient mortel :
 * **aucune**.
 *
 * La fonction est conservée — elle est appelée, testée et affichée — mais elle
 * répond désormais `+∞`, et c'est une décision, pas un oubli. L'entassement
 * coûte de la production ; il ne tue pas. La seule voie vers la mort passe par
 * la santé (`tickHealth()`), qui ne baisse que si un besoin vital reste à zéro
 * pendant des heures — et l'entassement n'en est pas un : les bêtes sont
 * serrées, elles ne sont ni affamées ni assoiffées.
 *
 * Auparavant elle valait ~1,72 : la cible d'un lot par ailleurs irréprochable
 * passait sous `MORTALITY.floor` au seul motif qu'il était à 172 % de la
 * capacité. Comme le ratio se calculait sur les cases de l'enclos et non sur
 * l'étable, ce seuil était atteint par des troupeaux qui avaient de la place.
 */
export function crowdingLethalThreshold(): number {
  return Number.POSITIVE_INFINITY;
}

/**
 * Satisfaction des besoins vers laquelle le lot dérive, à conditions
 * constantes `∈ [0 ; 1]`.
 *
 * **La base est 1.** On part d'un troupeau satisfait et on retranche ce qui
 * manque : la faim, la soif, le dépassement de capacité, la litière. Rien
 * d'autre. Ni la saison, ni la température, ni le fait d'être à l'étable
 * n'entrent dans ce calcul — et c'est le cœur de la refonte.
 *
 * Le plein air n'est plus un besoin mais un bonus : voir
 * `installationBonus()`. `hasPaddock` et `grazedRecentlyMs` restent dans la
 * signature parce que l'appelant les a sous la main et que l'écran s'en sert,
 * mais ils ne pèsent plus sur la cible. Une vache à l'étable toute l'année est
 * à 100 % — elle produit simplement moins qu'une vache dont le maître a bâti
 * l'enclos, l'abreuvoir et le râtelier.
 */
export function happinessTarget(input: {
  /** Enclos attenant — ne compte plus que pour le bonus d'installation */
  hasPaddock?: boolean;
  /** Ancienneté de la dernière sortie, en ms — conservée pour l'affichage */
  grazedRecentlyMs?: number;
  /** Effectif / capacité de **l'étable** (et non de l'enclos, cf. serveur) */
  crowding: number;
  /** Pénalité de faim, cf. `hungerPenalty()` */
  hunger?: number;
  /** Niveau de la jauge d'eau, 1 = abreuvée, cf. `tickWater()` */
  water?: number;
  /**
   * Pénalité de litière, cf. `beddingPenalty()`.
   *
   * Facultative comme la faim : les fonctions de ce module restent pures et
   * appelables sans, c'est le serveur qui la calcule. Une bête couchée sur le
   * béton dort mal — moins grave que la faim, mais cela se voit sur le lait.
   */
  bedding?: number;
}): number {
  const malus =
    crowdingPenalty(input.crowding) +
    Math.max(0, input.hunger ?? 0) +
    thirstPenalty(input.water ?? 1) +
    Math.max(0, input.bedding ?? 0);
  return clamp(1 - malus, HAPPINESS.min, HAPPINESS.max);
}

/**
 * Pourquoi le lot va mal — et quoi faire.
 *
 * « Elles sont stressées pour quoi ? » L'écran affichait un pourcentage et
 * rien d'autre : le joueur voyait la note sans jamais la copie. Or les quatre
 * causes sont connues au moment où la cible est calculée — c'est exactement
 * la même arithmétique, lue à l'envers.
 *
 * Le coût est exprimé en points de bien-être, ce qui permet de les classer :
 * une bête affamée ne se console pas d'un beau pré, et il faut le dire dans
 * cet ordre-là.
 */
export type WelfareCause = {
  code: "SURPEUPLEMENT" | "FAIM" | "SOIF" | "LITIERE";
  /** Ce que cette cause coûte, en points de cible (0 à 1) */
  cout: number;
  /** Le constat */
  texte: string;
  /** Le geste qui l'efface */
  remede: string;
};

/** En deçà, la cause ne vaut pas la peine d'être nommée. */
const CAUSE_MIN = 0.02;

/**
 * Les causes réelles, et elles seules.
 *
 * `SORTIE` a disparu de cette liste, et c'est le point de départ de toute la
 * refonte. C'était la cause la plus coûteuse — jusqu'à 0,60 point — et elle
 * s'affichait « Enfermées depuis trop longtemps · Sortez-les au pré » sur des
 * troupeaux nourris, paillés, au tiers de leur capacité, un jour où le pré
 * était pelé et où il faisait 10 °C. Un reproche qu'on ne peut pas satisfaire
 * n'est pas une cause : c'est un bug d'énoncé.
 *
 * Ce qui reste se répare d'un geste, chaque fois : distribuer, abreuver,
 * pailler, faire de la place.
 */
export function welfareReasons(input: {
  hasPaddock?: boolean;
  grazedRecentlyMs?: number;
  crowding: number;
  hunger?: number;
  water?: number;
  bedding?: number;
}): WelfareCause[] {
  /*
   * Le dépassement se dit dès la première bête de trop, même quand il ne coûte
   * presque rien.
   *
   * Les autres causes se taisent sous `CAUSE_MIN` — nommer une peine de deux
   * millièmes serait du bruit. Celle-ci fait exception parce qu'elle décrit un
   * **état** et non une intensité : « il y a plus de bêtes que de places » se
   * répare d'un geste précis, et le joueur qui voit sa production baisser d'un
   * point doit pouvoir savoir pourquoi. À 117 % d'occupation la peine ne vaut
   * qu'un centième de point ; la taire laisserait un écart inexpliqué.
   */
  const depasse = input.crowding > HAPPINESS.crowdingComfort;

  const causes: (WelfareCause & { toujours?: boolean })[] = [
    {
      code: "SURPEUPLEMENT",
      cout: crowdingPenalty(input.crowding),
      texte: "Plus de bêtes que de places dans le bâtiment",
      remede: "Agrandissez le bâtiment, ou vendez quelques bêtes",
      toujours: depasse,
    },
    {
      code: "SOIF",
      cout: thirstPenalty(input.water ?? 1),
      texte: "Assoiffées — plus rien à boire",
      remede: "Passez les abreuver, ou construisez un abreuvoir automatique",
    },
    {
      code: "FAIM",
      cout: Math.max(0, input.hunger ?? 0),
      texte: "Affamées — la mangeoire est vide",
      remede: "Distribuez une ration",
    },
    {
      code: "LITIERE",
      cout: Math.max(0, input.bedding ?? 0),
      texte: "Couchées sur le béton — litière sale",
      remede: "Étalez de la paille",
    },
  ];

  // La plus coûteuse d'abord : c'est celle par laquelle il faut commencer.
  return causes
    .filter((c) => c.toujours || c.cout >= CAUSE_MIN)
    .map(({ toujours: _toujours, ...c }) => c)
    .sort((a, b) => b.cout - a.cout);
}

/**
 * Fait dériver le bonheur d'un lot sur `elapsedMs`.
 *
 * Relaxation exponentielle `h' = cible + (h − cible) × e^(−Δt/τ)` : elle est
 * inconditionnellement bornée par la cible, donc la jauge ne peut ni dépasser
 * le plafond ni percer le plancher, quel que soit le pas de temps. C'est ce
 * qui permet au serveur de rattraper un joueur absent en un seul tick sans
 * dériver d'un calcul pas-à-pas.
 */
export function tickHappiness(input: {
  happiness: number;
  hasPaddock?: boolean;
  /** Ancienneté de la dernière sortie, en ms */
  grazedRecentlyMs?: number;
  /** Effectif / capacité de **l'étable** */
  crowding: number;
  elapsedMs: number;
  /** Pénalité de faim, cf. `hungerPenalty()` */
  hunger?: number;
  /** Niveau de la jauge d'eau, cf. `tickWater()` */
  water?: number;
  /** Pénalité de litière, cf. `beddingPenalty()` */
  bedding?: number;
}): number {
  const current = clamp(input.happiness, HAPPINESS.min, HAPPINESS.max);
  const hours = Math.max(0, input.elapsedMs) / HOUR_MS;
  if (hours === 0) return current;

  const target = happinessTarget(input);
  const tau = target < current ? HAPPINESS.decayTauH : HAPPINESS.riseTauH;
  const next = target + (current - target) * Math.exp(-hours / tau);
  return clamp(next, HAPPINESS.min, HAPPINESS.max);
}

/**
 * Satisfaction normalisée `∈ [0 ; 1]` — soit, désormais, la jauge elle-même.
 *
 * Elle remettait autrefois à l'échelle `[0,35 ; 0,95]` sur `[0 ; 1]`, parce que
 * la jauge ne visitait jamais ses bornes : un troupeau enfermé plafonnait à
 * 0,35 et un troupeau au pré à 0,95. La jauge parcourt maintenant tout son
 * intervalle et veut dire ce qu'elle affiche — 1 quand les besoins sont
 * remplis, 0 quand plus rien ne l'est. Il n'y a plus rien à remettre à
 * l'échelle.
 *
 * La fonction reste exportée : elle est appelée en une dizaine d'endroits, et
 * la remplacer par un `clamp` chez chaque appelant ferait perdre le nom, qui
 * dit ce qu'on lit.
 */
export function welfareIndex(happiness: number): number {
  return clamp(happiness, HAPPINESS.min, HAPPINESS.max);
}

/* ------------------------------------------------------------------ */
/* 2 bis. L'eau, la santé, et la seule mort possible                   */
/* ------------------------------------------------------------------ */

/**
 * L'eau `[GD]`.
 *
 * Une vache boit cent litres par jour, et c'est le besoin qui la tue le plus
 * vite quand il manque. Il n'existait pas dans le jeu.
 *
 * **Aucune corvée nouvelle n'est créée pour autant.** La jauge est pleine tant
 * qu'on s'occupe du troupeau : l'éleveur qui apporte la ration remplit les
 * seaux du même passage. Elle ne se vide que quand plus personne ne vient —
 * c'est-à-dire quand la mangeoire est vide depuis un moment — et elle se vide
 * plus lentement que la faim ne s'installe, pour que les alertes tombent dans
 * l'ordre : d'abord la ration, ensuite l'eau.
 *
 * L'abreuvoir automatique supprime purement et simplement ce risque : branché
 * sur le réseau, il tient la jauge pleine même quand le joueur ne se connecte
 * pas. C'est ce qui en fait un investissement et non une décoration.
 */
export const WATER = {
  min: 0,
  max: 1,
  /**
   * Heures réelles pour vider la jauge quand plus personne ne passe `[GD]`.
   *
   * Vingt-quatre, contre huit avant que la production ne commence à souffrir
   * de la faim : la soif arrive après, jamais avant.
   */
  dryH: 24,
  /** Heures réelles pour la remplir de nouveau, une fois la ration rétablie */
  refillH: 3,
  /** Ce que la soif totale coûte sur la satisfaction `[GD]` */
  penaltyMax: 0.5,
} as const;

/**
 * Une heure de montre, et non une heure de jeu.
 *
 * `HOUR_MS` vaut ici une heure **compressée** — un vingt-quatrième de cycle
 * d'élevage, soit trois minutes et demie d'horloge. C'est la bonne unité pour
 * la satisfaction, qui doit réagir dans la partie en cours ; c'est la mauvaise
 * pour la cascade, dont tout le curseur est « trente-six heures réelles entre
 * une mangeoire vide et la première mort ». Confondre les deux réduirait ces
 * trente-six heures à deux, et rendrait la mort à peu près inévitable pour qui
 * ne joue pas d'une traite.
 */
const REAL_HOUR_MS = 3_600_000;

/** Peine de soif `∈ [0 ; 0,5]`, linéaire dans le manque. */
export function thirstPenalty(water: number): number {
  return WATER.penaltyMax * (1 - clamp(water, WATER.min, WATER.max));
}

/**
 * Fait évoluer la jauge d'eau sur `elapsedMs`.
 *
 * Linéaire et non exponentielle, à dessein : le joueur doit pouvoir lire
 * « il reste tant d'heures » sur la jauge, et une exponentielle ne se lit pas.
 */
export function tickWater(input: {
  water: number;
  /** Un abreuvoir automatique rattaché au bâtiment ? */
  hasTrough: boolean;
  /** Reste-t-il de la ration à distribuer ? Si oui, on passe, donc on abreuve. */
  fed: boolean;
  elapsedMs: number;
}): number {
  const current = clamp(input.water, WATER.min, WATER.max);
  const hours = Math.max(0, input.elapsedMs) / REAL_HOUR_MS;
  if (hours === 0) return current;
  if (input.hasTrough) return WATER.max;
  if (input.fed) return clamp(current + hours / WATER.refillH, WATER.min, WATER.max);
  return clamp(current - hours / WATER.dryH, WATER.min, WATER.max);
}

/**
 * La cascade : ce qui se passe entre une mangeoire vide et la première mort.
 *
 * **Trente-six heures réelles, et trois avertissements avant.** C'est le
 * curseur retenu : assez long pour qu'un joueur qui se connecte une fois par
 * jour ne perde rien, assez court pour que négliger un troupeau coûte
 * quelque chose.
 *
 * | Depuis l'épuisement | Ce qui se passe        | Ce que le joueur voit |
 * |---------------------|------------------------|-----------------------|
 * | 0 – 8 h             | la production baisse   | ⚠️ réserve épuisée     |
 * | 8 – 20 h            | la santé baisse        | 🟠 santé en baisse     |
 * | 20 – 36 h           | état critique          | 🔴 intervenez          |
 * | au-delà de 36 h     | une bête peut mourir   | —                     |
 *
 * Avant, il n'y avait pas de cascade du tout : la satisfaction tombait sous
 * `MORTALITY.floor` et les bêtes mouraient, sans étape ni préavis. C'est ce
 * qui a produit « je sais plus quoi faire ».
 */
export const CASCADE = {
  /** Fin du sursis : au-delà, la santé commence à baisser `[GD]` */
  productionH: 8,
  /** Entrée dans le rouge `[GD]` */
  healthH: 20,
  /** Santé à zéro, la mortalité peut commencer `[GD]` */
  criticalH: 36,
} as const;

/** Où en est le troupeau dans la cascade. */
export type CascadeStage = "OK" | "PRODUCTION" | "SANTE" | "CRITIQUE" | "MORTEL";

/** Étape de la cascade, d'après les heures écoulées depuis le manque. */
export function cascadeStage(deprivedH: number): CascadeStage {
  const h = Math.max(0, deprivedH);
  if (h <= 0) return "OK";
  if (h < CASCADE.productionH) return "PRODUCTION";
  if (h < CASCADE.healthH) return "SANTE";
  if (h < CASCADE.criticalH) return "CRITIQUE";
  return "MORTEL";
}

/** Ce que l'écran affiche à chaque étape — le constat, puis le geste. */
export const CASCADE_LABELS: Record<CascadeStage, { texte: string; remede: string } | null> = {
  OK: null,
  PRODUCTION: {
    texte: "Réserve épuisée — la production baisse",
    remede: "Distribuez une ration",
  },
  SANTE: {
    texte: "La santé du troupeau baisse",
    remede: "Distribuez une ration sans tarder",
  },
  CRITIQUE: {
    texte: "Troupeau en état critique — intervenez",
    remede: "Distribuez une ration maintenant",
  },
  MORTEL: {
    texte: "Le troupeau ne tient plus — des bêtes peuvent mourir",
    remede: "Distribuez une ration immédiatement",
  },
};

/**
 * La santé `[GD]`.
 *
 * C'est la seule jauge qui peut tuer, et elle ne bouge que par la cascade.
 * Elle est délibérément lente dans les deux sens : on ne perd pas un troupeau
 * pour une soirée d'absence, et on ne le remet pas d'aplomb en un clic.
 */
export const HEALTH = {
  min: 0,
  max: 1,
  /** Heures de manque pour tomber de 1 à 0, une fois le sursis écoulé `[GD]` */
  collapseH: CASCADE.criticalH - CASCADE.productionH,
  /** Heures pour remonter de 0 à 1 une fois les besoins rétablis `[GD]` */
  recoverH: 24,
} as const;

/**
 * Fait évoluer la santé sur `elapsedMs`.
 *
 * Tant que la privation reste dans le sursis (`CASCADE.productionH`), la santé
 * **remonte** : un troupeau qu'on nourrit se rétablit, et un troupeau qu'on
 * néglige une heure ne perd rien du tout.
 *
 * ## Le pas de temps se découpe, il ne se facture pas en bloc
 *
 * `deprivedH` est la privation **à la fin** de la fenêtre. La fenêtre couvre
 * donc `[deprivedH − Δt ; deprivedH]`, et seule la part qui dépasse le sursis
 * abîme quoi que ce soit.
 *
 * Sans ce découpage, un joueur qui revient après vingt-quatre heures voyait
 * les vingt-quatre facturées au tarif de la chute : santé à zéro et troupeau
 * mort, là où la règle en promet trente-six. Mesuré sur la pile complète avant
 * correction — dix heures d'absence rendaient déjà 64 % de santé, vingt-quatre
 * un troupeau supprimé. Le serveur rattrape un joueur absent en un seul tick :
 * c'est précisément le cas où l'arithmétique doit être juste.
 */
export function tickHealth(input: {
  health: number;
  /** Heures écoulées depuis que le besoin vital n'est plus couvert, à la fin du pas */
  deprivedH: number;
  elapsedMs: number;
}): number {
  const hours = Math.max(0, input.elapsedMs) / REAL_HOUR_MS;
  if (hours === 0) return clamp(input.health, HEALTH.min, HEALTH.max);

  const fin = Math.max(0, input.deprivedH);
  const debut = Math.max(0, fin - hours);
  /** Heures de la fenêtre passées au-delà du sursis — celles qui coûtent. */
  const nuisibles = Math.max(0, fin - Math.max(debut, CASCADE.productionH));
  /** Le reste : la privation n'avait pas commencé, ou pas encore mordu. */
  const reparatrices = Math.max(0, hours - nuisibles);

  // Séquentiellement, et non en une somme : la santé se borne entre les deux,
  // sinon des heures de repos qu'un troupeau déjà au maximum ne peut pas
  // encaisser viendraient amortir la chute qui suit.
  let sante = clamp(
    input.health + reparatrices / HEALTH.recoverH,
    HEALTH.min,
    HEALTH.max,
  );
  sante = clamp(sante - nuisibles / HEALTH.collapseH, HEALTH.min, HEALTH.max);
  return sante;
}

/* ------------------------------------------------------------------ */
/* 2 ter. L'installation — ce qu'on bâtit rapporte                     */
/* ------------------------------------------------------------------ */

/**
 * Les bonus d'installation `[GD]` — le renversement de philosophie.
 *
 * L'étable et son enclos étaient un **malus** : ne rien bâtir coûtait de la
 * satisfaction, donc de la production, donc des bêtes. Ils deviennent un
 * **investissement** : ne rien bâtir donne 100 %, et bâtir donne plus.
 *
 * | Niveau | Production | Reproduction | Efficacité alimentaire |
 * |--------|-----------|--------------|------------------------|
 * | 1 · basique      | —     | —     | —     |
 * | 2 · améliorée    | +10 % | +5 %  | +3 %  |
 * | 3 · bonne        | +20 % | +10 % | +6 %  |
 * | 4 · haut de gamme| +30 % | +15 % | +10 % |
 *
 * Le plafond remplace l'ancien empilement « bien-être ×1,32 × niveau d'étable
 * ×1,24 » : un seul multiplicateur, lisible à l'écran, qu'on gagne en
 * construisant et jamais en subissant.
 */
export type InstallationBonus = {
  /** Lait, œufs, laine, viande */
  production: number;
  /** Chances de naissance */
  reproduction: number;
  /** Fourrage économisé */
  feed: number;
};

export const INSTALLATION_TIERS: readonly InstallationBonus[] = [
  { production: 0, reproduction: 0, feed: 0 },
  { production: 0.1, reproduction: 0.05, feed: 0.03 },
  { production: 0.2, reproduction: 0.1, feed: 0.06 },
  { production: 0.3, reproduction: 0.15, feed: 0.1 },
];

/** Niveau d'installation le plus élevé atteignable. */
export const MAX_INSTALLATION_LEVEL = INSTALLATION_TIERS.length;

export const INSTALLATION_LABELS: readonly string[] = [
  "Basique",
  "Améliorée",
  "Bonne",
  "Haut de gamme",
];

/** Libellé du niveau d'installation, pour l'écran d'élevage. */
export function installationLabel(level: number): string {
  const i = clamp(Math.round(level), 1, MAX_INSTALLATION_LEVEL) - 1;
  return INSTALLATION_LABELS[i];
}

/** Les trois bonus d'un niveau donné. */
export function installationBonus(level: number): InstallationBonus {
  return INSTALLATION_TIERS[clamp(Math.round(level), 1, MAX_INSTALLATION_LEVEL) - 1];
}

/**
 * Ce qui compte dans le niveau, et ce que ça vaut.
 *
 * Cinq points à gagner, quatre paliers. Chaque pièce compte pour de vrai :
 * c'est ce qui rend l'abreuvoir et le râtelier désirables plutôt
 * qu'obligatoires — on tourne très bien à 100 % sans eux, on monte avec.
 *
 * L'étable pèse deux points parce qu'elle se paie en dizaines de milliers
 * d'euros par niveau, là où les deux annexes se posent pour quelques
 * centaines : leur donner le même poids ferait du niveau d'étable un
 * investissement moins rentable que le mobilier qu'on met autour.
 */
export const INSTALLATION_POINTS = {
  /** Enclos de pâture partageant un bord avec le bâtiment */
  paddock: 1,
  /** Abreuvoir automatique attenant */
  trough: 1,
  /** Râtelier à fourrage attenant */
  rack: 1,
  /** Étable de niveau 3 ou plus */
  barnMid: 1,
  /** Étable de niveau 5 */
  barnTop: 1,
} as const;

/** Niveau d'installation d'après ce que le joueur a réellement posé. */
export function installationLevel(input: {
  barnLevel?: number;
  /** Enclos **attenant** — un enclos à l'autre bout de la ferme ne compte pas */
  hasPaddock?: boolean;
  hasTrough?: boolean;
  hasRack?: boolean;
}): number {
  const barn = clamp(Math.round(input.barnLevel ?? 1), 1, MAX_BARN_LEVEL);
  let points = 0;
  if (input.hasPaddock) points += INSTALLATION_POINTS.paddock;
  if (input.hasTrough) points += INSTALLATION_POINTS.trough;
  if (input.hasRack) points += INSTALLATION_POINTS.rack;
  if (barn >= 3) points += INSTALLATION_POINTS.barnMid;
  if (barn >= MAX_BARN_LEVEL) points += INSTALLATION_POINTS.barnTop;

  if (points <= 0) return 1;
  if (points <= 2) return 2;
  if (points <= 4) return 3;
  return 4;
}

/**
 * Facteur de production complet, tel qu'il s'affiche.
 *
 *     production = satisfaction des besoins × (1 + bonus d'installation) × ration
 *
 * Besoins remplis, installation basique, ration ordinaire : **exactement
 * 100 %**. C'est la ligne de référence, et rien ne doit la faire varier — ni
 * la saison, ni l'heure, ni le fait que les bêtes soient rentrées.
 */
export type ProductionFactor = {
  /** Ce que les besoins remplis valent, `∈ [0 ; 1]` */
  satisfaction: number;
  /** Ce que l'installation ajoute, `≥ 1` */
  installation: number;
  /** Ce que la qualité de la ration ajoute, `≥ 1` */
  ration: number;
  /** Le produit des trois — le chiffre affiché */
  total: number;
};

export function productionFactor(input: {
  /** Satisfaction des besoins (la jauge de bonheur) */
  happiness: number;
  installationLevel: number;
  /** Qualité de la ration, 0 = basique, 1 = premium */
  feedQuality?: number;
  /** Amplitude du bonus de ration ; 1 = pleine, cf. `MILK_FEED_SPAN` */
  feedWeight?: number;
}): ProductionFactor {
  const satisfaction = welfareIndex(input.happiness);
  const installation = 1 + installationBonus(input.installationLevel).production;
  const ration =
    1 + MILK_FEED_SPAN * (input.feedWeight ?? 1) * clamp(input.feedQuality ?? 0, 0, 1);
  return {
    satisfaction,
    installation,
    ration,
    total: satisfaction * installation * ration,
  };
}

/** Météo qui interdit la sortie `[GD]` — orage (foudre) et neige (pas d'herbe). */
export const GRAZING_BLOCKING_WEATHER: readonly WeatherState[] = ["STORM", "SNOW"];

/** Motif de refus de sortie, tel qu'il s'affiche dans l'UI. */
export type GrazingRefusal =
  | "NO_PADDOCK"
  | "PADDOCK_FULL"
  | "BAD_WEATHER"
  | "WRONG_SPECIES"
  /**
   * Étable vide.
   *
   * Ce motif manquait, et faute de mieux le serveur renvoyait `NO_PADDOCK`
   * pour une étable sans bêtes. Le joueur qui venait de bâtir son enclos
   * lisait donc, dans la même fiche, « Enclos de pâture attenant · 18 places »
   * en vert puis « Aucun enclos accolé à l'étable » en rouge — deux phrases
   * contradictoires dont la seconde était simplement fausse.
   */
  | "NO_ANIMALS";

/* ------------------------------------------------------------------ */
/* Alimentation — la ration conditionne tout le reste                  */
/* ------------------------------------------------------------------ */

/**
 * Effet de la faim `[GD]`.
 *
 * Un troupeau non nourri ne meurt pas : il maigrit et se stresse. La cible de
 * bien-être s'effondre, donc lait et viande suivent. C'est la sanction la plus
 * lisible — le joueur voit sa jauge plonger sans qu'on lui supprime son
 * cheptel du jour au lendemain.
 */
/** Ration de base d'une bête par cycle, en kg de matière sèche `[RÉEL]` */
export const FEED_BASE_PER_COW = 14;

export const HUNGER = {
  /** Au-delà, la ration précédente ne compte plus `[GD]` */
  memoryMs: 0,
  /** Pénalité maximale sur la cible de bien-être `[GD]` */
  penaltyMax: 0.55,
  /**
   * Ration d'une bête pour un cycle, en kg équivalent fourrage `[RÉEL]`.
   * Doit rester égal à `FEED_BASE_PER_COW` : c'est la même ration, vue une
   * fois du côté du besoin et une fois du côté de la consommation.
   */
  unitsPerAnimalPerCycle: FEED_BASE_PER_COW,
} as const;

/**
 * Pénalité de faim, de 0 (rassasié) à `penaltyMax` (réserve vide).
 * La réserve est exprimée en unités nutritives déjà distribuées.
 */
export function hungerPenalty(input: {
  feedStock: number;
  herdSize: number;
  kind?: AnimalKind;
}): number {
  const per = FEED_BASE[input.kind ?? "COW"] ?? HUNGER.unitsPerAnimalPerCycle;
  const need = Math.max(1, input.herdSize) * per;
  const covered = Math.max(0, Math.min(1, input.feedStock / need));
  return (1 - covered) * HUNGER.penaltyMax;
}

/**
 * Fourrage consommé sur une durée donnée, en kg.
 *
 * S'appuie sur `feedConsumption()` plutôt que de recalculer la ration : une
 * étable mieux isolée économise du foin, et cette économie doit valoir aussi
 * bien pour l'affichage que pour la consommation réelle.
 */
export function feedBurn(input: {
  herdSize: number;
  elapsedMs: number;
  cycleMs: number;
  /** Au pré, les bêtes se nourrissent en partie seules */
  grazing: boolean;
  /** Niveau de l'étable ; par défaut, la plus rustique */
  barnLevel?: number;
  /** Niveau d'installation, cf. `installationLevel()` */
  installationLevel?: number;
  kind?: AnimalKind;
}): number {
  const cycles = Math.max(0, input.elapsedMs) / Math.max(1, input.cycleMs);
  const perCycle = feedConsumption({
    herdSize: input.herdSize,
    grazing: input.grazing,
    barnLevel: input.barnLevel ?? 1,
    installationLevel: input.installationLevel,
    kind: input.kind,
  });
  return perCycle * cycles;
}

export const GRAZING_REFUSAL_LABELS: Record<GrazingRefusal, string> = {
  NO_PADDOCK: "Aucun enclos accolé à l’étable",
  PADDOCK_FULL: "Enclos saturé",
  BAD_WEATHER: "Météo impraticable",
  WRONG_SPECIES: "Cette aire de sortie n’est pas faite pour cette espèce",
  NO_ANIMALS: "Aucune bête à sortir",
};

/** Ce que vaut une demande de sortie, et combien de bêtes elle concerne. */
export type GrazingVerdict = {
  ok: boolean;
  reason?: GrazingRefusal;
  /** Bêtes qui sortiront réellement — jamais plus que la place disponible. */
  animals: number;
  /** Bêtes qui resteront à l'étable faute de place. */
  sheltered: number;
};

/**
 * Place laissée par l'enclos, et ce qu'on peut y mettre.
 *
 * **La sortie est partielle, pas tout ou rien.** Elle était refusée en bloc
 * dès que le troupeau dépassait l'enclos d'une seule bête : dix-neuf vaches
 * devant dix-huit places, et le bouton « Dehors » restait gris avec pour
 * seule explication « Enclos saturé ». Le joueur n'avait aucun moyen de
 * sortir son troupeau, ni rien qui lui dise qu'il lui manquait *une* place.
 *
 * Le pire est que la simulation, elle, savait déjà faire : `settleHerd`
 * borne depuis toujours les bêtes au pré par `min(taille, capacité)`. Seul
 * le garde-fou d'entrée refusait ce que le tick gérait sans peine.
 */
function paddockRoom(
  paddock: PaddockState,
  animals: number,
  animalsOutside: number,
): { animals: number; sheltered: number } {
  const free = Math.max(0, paddock.capacity - Math.max(0, animalsOutside));
  const sortent = Math.max(0, Math.min(animals, free));
  return { animals: sortent, sheltered: Math.max(0, animals - sortent) };
}

/**
 * Une sortie est possible s'il existe un enclos adjacent, qu'il y reste au
 * moins une place et que la météo le permet.
 *
 * L'enclos plus petit que le troupeau ne refuse plus : il **borne**. On sort
 * ce qui tient, on dit ce qui reste dedans.
 */
export function canGraze(input: {
  paddock: PaddockState | null;
  /** Nombre de bêtes que l'on veut sortir */
  animals: number;
  /** Bêtes déjà dehors */
  animalsOutside?: number;
  weather: WeatherState;
  kind?: AnimalKind;
  /** Espèce que l'aire de sortie accueille ; par défaut, des bovins */
  paddockKind?: AnimalKind;
}): GrazingVerdict {
  const refus = (reason: GrazingRefusal): GrazingVerdict => ({
    ok: false,
    reason,
    animals: 0,
    sheltered: Math.max(0, input.animals),
  });
  // Une vache ne se met pas dans une souille, un porc ne pâture pas : chaque
  // espèce a son aire de sortie.
  if ((input.kind ?? "COW") !== (input.paddockKind ?? "COW")) return refus("WRONG_SPECIES");
  if (input.paddock === null || !input.paddock.adjacent) return refus("NO_PADDOCK");
  if (GRAZING_BLOCKING_WEATHER.includes(input.weather)) return refus("BAD_WEATHER");
  if (input.animals <= 0) return refus("NO_ANIMALS");

  const place = paddockRoom(input.paddock, input.animals, input.animalsOutside ?? 0);
  if (place.animals <= 0) return refus("PADDOCK_FULL");
  return { ok: true, ...place };
}

/**
 * Le troupeau peut-il **vivre** dehors ?
 *
 * À distinguer de `canGraze()`, qui autorise une séance de pâture. Le lieu de
 * vie est une décision durable, et elle ne se refuse pas pour le temps qu'il
 * fait : c'est justement l'arbitrage qu'on rend au joueur — on l'avertit du
 * froid, il tranche. L'interface se calait pourtant sur `canGraze()`, si bien
 * qu'un jour de neige l'interrupteur « Dehors » était gris alors que le
 * serveur, lui, aurait accepté. Deux règles pour une seule décision : le
 * joueur voyait celle qui bloquait.
 */
export function canLiveOutside(input: {
  paddock: PaddockState | null;
  animals: number;
  kind?: AnimalKind;
  paddockKind?: AnimalKind;
}): GrazingVerdict {
  const refus = (reason: GrazingRefusal): GrazingVerdict => ({
    ok: false,
    reason,
    animals: 0,
    sheltered: Math.max(0, input.animals),
  });
  if ((input.kind ?? "COW") !== (input.paddockKind ?? "COW")) return refus("WRONG_SPECIES");
  if (input.paddock === null || !input.paddock.adjacent) return refus("NO_PADDOCK");
  if (input.animals <= 0) return refus("NO_ANIMALS");

  const place = paddockRoom(input.paddock, input.animals, 0);
  if (place.animals <= 0) return refus("PADDOCK_FULL");
  return { ok: true, ...place };
}

/* ------------------------------------------------------------------ */
/* 3. Production                                                       */
/* ------------------------------------------------------------------ */

/** Litres par vache et par cycle, étable niveau 1, ration basique `[GD]` */
export const MILK_BASE_PER_COW = 22;

/**
 * Écart de production maximal `[GD]` : **+32 %**, conservé pour la viande.
 *
 * Il représentait l'écart entre une vache enfermée et une vache au pré, et il
 * s'appliquait à la satisfaction remise à l'échelle. Le lait, les œufs et la
 * laine ne s'en servent plus : leur écart passe par le bonus d'installation
 * (`installationBonus()`), qui se **gagne** en bâtissant au lieu de se perdre
 * en restant à l'étable.
 */
export const MILK_HAPPINESS_SPAN = 0.32;

/**
 * Gain de traite par niveau d'étable au-dessus de 1 `[TEST]`.
 *
 * Absorbé par le bonus d'installation, dont le niveau d'étable est l'une des
 * cinq composantes. La constante reste exportée le temps que les appelants
 * historiques passent à `installationLevel()` ; la conserver dans le calcul
 * aurait compté deux fois le même bâtiment.
 */
export const MILK_BARN_LEVEL_STEP = 0.06;

/** Gain de ration : basique → premium, aligné sur la table §3 de la doc `[GD]` */
export const MILK_FEED_SPAN = 0.2;

/**
 * Niveau d'installation à défaut d'en connaître les annexes.
 *
 * Les appelants qui ne passent qu'un niveau d'étable — il en reste — obtiennent
 * le niveau que ce seul bâtiment vaut. Ils ne sont jamais pénalisés pour une
 * information qu'ils n'avaient pas à fournir.
 */
function installationFallback(input: { installationLevel?: number; barnLevel?: number }): number {
  return input.installationLevel ?? installationLevel({ barnLevel: input.barnLevel });
}

/**
 * Lait produit par cycle, en litres.
 *
 * `L = 22 × effectif × satisfaction × (1 + bonus d'installation) × (1 + 0,20 × ration)`
 *
 * Un troupeau nourri, abreuvé et logé produit **22 L par tête**, dedans comme
 * dehors, en juin comme en janvier. Tout ce qui dépasse se construit.
 */
export function milkYield(input: {
  herdSize: number;
  happiness: number;
  barnLevel: number;
  /** Niveau d'installation, cf. `installationLevel()` */
  installationLevel?: number;
  /** Qualité de la ration, 0 = basique, 1 = premium */
  feedQuality: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;

  const facteur = productionFactor({
    happiness: input.happiness,
    installationLevel: installationFallback(input),
    feedQuality: input.feedQuality,
  });

  return round1(MILK_BASE_PER_COW * size * facteur.total);
}

/** Caisses d'œufs par poule et par cycle `[GD]` */
export const EGGS_BASE_PER_HEN = 0.14;

export function eggYield(input: {
  herdSize: number;
  happiness: number;
  barnLevel: number;
  installationLevel?: number;
  feedQuality: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;
  const facteur = productionFactor({
    happiness: input.happiness,
    installationLevel: installationFallback(input),
    feedQuality: input.feedQuality,
  });
  return Math.round(EGGS_BASE_PER_HEN * size * facteur.total * 100) / 100;
}

/** Tonnes de laine par mouton et par tonte `[GD]` */
export const WOOL_BASE_PER_SHEEP = 0.012;

export function woolYield(input: {
  herdSize: number;
  happiness: number;
  barnLevel: number;
  installationLevel?: number;
  feedQuality: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;
  // La laine tire moins de la ration que le lait : une brebis premium ne tond
  // pas deux fois plus. D'où le demi-poids sur le seul terme de ration.
  const facteur = productionFactor({
    happiness: input.happiness,
    installationLevel: installationFallback(input),
    feedQuality: input.feedQuality,
    feedWeight: 0.5,
  });
  return Math.round(WOOL_BASE_PER_SHEEP * size * facteur.total * 1000) / 1000;
}

/* ==========================================================================
   LES JEUNES BÊTES
   ==========================================================================

   Acheter une bête était une seule décision, et toujours la même : payer le
   prix fort pour un animal productif immédiatement. Le jeune ouvre l'autre
   voie — moins cher, mais improductif le temps qu'il grandisse. Du capital
   contre du temps, l'arbitrage qui manquait à l'élevage.

   Une seule étable pour les deux : veaux et vaches vivent ensemble, comme à
   la ferme. Un second bâtiment n'aurait ajouté que de la comptabilité.

   Et surtout : **aucun geste de plus**. Un jeune ne demande aucun soin
   particulier. Il mange moins, il grandit, il devient adulte. C'est la
   consigne qu'on s'est donnée — de la profondeur, pas des boutons.
   ========================================================================== */

/**
 * Prix d'un jeune, en fraction du prix d'un adulte `[GD]`.
 *
 * Trois cinquièmes : assez bas pour que l'élevage soit une vraie stratégie de
 * démarrage, assez haut pour que l'adulte reste le bon choix quand on a besoin
 * de lait tout de suite. C'est le rapport à surveiller si l'un des deux
 * chemins écrase l'autre.
 *
 * Il valait deux cinquièmes, calé sur une vache à 420 €. Passée à son prix
 * réel — 1 650 € —, l'économie du jeune a quadruplé sans que le lait auquel on
 * renonce pendant sa croissance ne bouge d'un centime : mesuré, il n'en
 * représentait plus que 8 %, et acheter jeune devenait le seul choix sensé.
 *
 * Trois cinquièmes est aussi le vrai rapport : une génisse prête à vêler vaut
 * les deux tiers d'une vache en lactation, pas le tiers.
 */
export const YOUNG_PRICE_RATIO = 0.6;

/**
 * Le temps qu'un jeune met à devenir adulte `[GD]`.
 *
 * Une saison entière — sept jours de jeu. Assez long pour qu'attendre coûte
 * quelque chose, assez court pour qu'on voie l'arrivée à maturité dans une
 * session.
 */
export const YOUNG_GROW_MS = 7 * LIVESTOCK_CYCLE_MS;

/**
 * Ce qu'un jeune mange, en fraction de la ration d'un adulte `[GD]`.
 *
 * Il mange moins, mais il mange : c'est ce qui fait qu'un troupeau de veaux
 * n'est pas gratuit à entretenir, et que le pari a un coût courant.
 */
export const YOUNG_FEED_RATIO = 0.45;

/**
 * Besoin de ration d'un lot, jeunes compris `[GD]`.
 *
 * Le besoin se calculait sur l'effectif total, veaux et vaches confondus :
 * un troupeau de jeunes réclamait autant qu'un troupeau d'adultes, ce qui
 * effaçait la moitié de l'intérêt du pari.
 */
export function herdFeedNeed(input: {
  size: number;
  young?: number;
  kind?: AnimalKind;
}): number {
  const par = FEED_BASE[input.kind ?? "COW"] ?? HUNGER.unitsPerAnimalPerCycle;
  const jeunes = Math.max(0, Math.min(input.size, Math.floor(input.young ?? 0)));
  const adultes = Math.max(0, input.size - jeunes);
  return adultes * par + jeunes * par * YOUNG_FEED_RATIO;
}

/** Poids de carcasse d'un bovin adulte, en kg `[GD]` */
export const MEAT_BASE_KG = 280;

/** Âge de maturité bouchère `[GD]` — 30 cycles, soit 30 jours réels */
export const MEAT_MATURITY_MS = 30 * LIVESTOCK_CYCLE_MS;

/** Part du poids adulte déjà atteinte à la naissance `[TEST]` */
export const MEAT_AGE_FLOOR = 0.35;

/**
 * Écart de rendement carcasse dû au bien-être `[GD]` : **+22 %**.
 *
 * Comme `MILK_HAPPINESS_SPAN`, il est absorbé par le bonus d'installation et
 * n'entre plus dans le calcul. La constante reste exportée : elle documente
 * l'ordre de grandeur retenu, et la doc §8 s'y réfère.
 */
export const MEAT_HAPPINESS_SPAN = 0.22;

/** Gain d'abattage par niveau d'étable au-dessus de 1 `[TEST]` — absorbé, cf. ci-dessus */
export const MEAT_BARN_LEVEL_STEP = 0.03;

/**
 * Viande obtenue à l'abattage d'un lot, en kg.
 *
 * `kg = 280 × effectif × âge × satisfaction × (1 + bonus d'installation)`
 *
 * **Comment le bonheur cumulé compte** : `happiness` n'est pas la photo d'un
 * instant, c'est la sortie de `tickHappiness()`, une relaxation de constante
 * 12 h à la hausse et 36 h à la baisse. La valeur stockée est donc
 * mathématiquement une moyenne mobile exponentielle des conditions de vie du
 * lot, pondérée en faveur des derniers jours. Conséquence de design voulue :
 * on ne peut pas « engraisser le bonheur » la veille de l'abattage (il faut
 * ~2 jours de sorties pour approcher le plafond), mais un éleveur qui a tenu
 * le rythme toute la vie du lot touche le bonus plein. Aucun historique n'est
 * stocké : la jauge *est* l'historique.
 */
export function meatBaseKg(kind: AnimalKind = "COW"): number {
  return SPECIES[kind].meatKg;
}

export function meatYield(input: {
  herdSize: number;
  happiness: number;
  averageAgeMs: number;
  barnLevel: number;
  installationLevel?: number;
  kind?: AnimalKind;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;

  // Croissance linéaire jusqu'à maturité, puis plateau : pas de dépréciation
  // du vieux bétail, sinon oublier un lot deviendrait une perte sèche.
  const growth = clamp(
    MEAT_AGE_FLOOR + (1 - MEAT_AGE_FLOOR) * (Math.max(0, input.averageAgeMs) / MEAT_MATURITY_MS),
    MEAT_AGE_FLOOR,
    1,
  );
  const facteur = productionFactor({
    happiness: input.happiness,
    installationLevel: installationFallback(input),
  });

  return Math.round(meatBaseKg(input.kind ?? "COW") * size * growth * facteur.total);
}

/** Fourrage distribué par vache et par cycle, en kg de matière sèche `[GD]` */

/**
 * Part du fourrage encore distribuée quand le lot pâture `[GD]` : **65 %**.
 *
 * Décision assumée : le pâturage **réduit** la consommation de fourrage
 * stocké, parce que l'herbe de l'enclos couvre le tiers de l'ingéré. C'est
 * donc un double gain (plus de lait, moins de foin) — sinon l'enclos serait
 * un investissement au bilan trop mince pour intéresser qui que ce soit. Le
 * contrepoids n'est pas économique mais logistique : l'enclos coûte des cases
 * de terrain constructible, exige l'adjacence à l'étable, et la sortie tombe
 * à l'eau dès l'orage ou la neige. Le joueur qui vise le rendement maximal
 * doit donc surveiller la météo, pas juste cliquer une fois.
 */
export const FEED_GRAZING_RATIO = 0.65;

/** Économie de gaspillage par niveau d'étable (mangeoire mieux réglée) `[TEST]` */
export const FEED_BARN_LEVEL_STEP = 0.03;

/** Économie de gaspillage maximale, quel que soit le niveau `[GD]` */
export const FEED_BARN_SAVING_CAP = 0.12;

/**
 * Fourrage consommé par cycle, en kg de matière sèche.
 *
 * `kg = 14 × effectif × (pâture ? 0,65 : 1) × (1 − économie)`
 *
 * L'économie est le troisième bonus d'installation
 * (`installationBonus().feed`) : jusqu'à 10 % de foin en moins pour qui a bâti
 * le râtelier et l'abreuvoir autour d'une bonne étable. C'est le bonus le plus
 * discret des trois et le plus durable — il se touche à chaque cycle, y compris
 * quand le joueur n'est pas là.
 */
export function feedConsumption(input: {
  herdSize: number;
  /** Le lot est-il sorti au pré sur ce cycle ? */
  grazing: boolean;
  barnLevel: number;
  /** Niveau d'installation, cf. `installationLevel()` */
  installationLevel?: number;
  kind?: AnimalKind;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size === 0) return 0;

  const saving = Math.min(
    FEED_BARN_SAVING_CAP,
    installationBonus(installationFallback(input)).feed,
  );
  const pasture = input.grazing ? FEED_GRAZING_RATIO : 1;
  const base = FEED_BASE[input.kind ?? "COW"] ?? FEED_BASE_PER_COW;

  return round1(base * size * pasture * (1 - saving));
}

/* ------------------------------------------------------------------ */
/* 4. Enclos                                                           */
/* ------------------------------------------------------------------ */

/**
 * Paramètres de l'enclos `[GD]`.
 *
 * Proposition de bâtiment à ajouter soi-même dans `BUILDING_DEFS`
 * (`BuildingType` devrait recevoir `"PADDOCK"`) :
 *
 * ```ts
 * PADDOCK: {
 *   type: "PADDOCK",
 *   name: "Enclos de pâture",
 *   w: 4,
 *   h: 4,
 *   cost: 1840, // PADDOCK.baseCost + 16 × PADDOCK.costPerCell
 *   description: "Accolé à une étable, permet de sortir les vaches : +32 % de lait au maximum.",
 *   cattleSlots: 32, // paddockCapacity(16)
 * }
 * ```
 *
 * Note d'intégration : contrairement à l'étable, `cattleSlots` d'un enclos
 * n'est pas une place de logement mais une place de **sortie**. Il ne doit
 * donc pas s'additionner à la capacité d'hébergement du cheptel.
 */
export const PADDOCK = {
  /** Bêtes qui peuvent sortir par case d'enclos `[GD]` */
  capacityPerCell: 2,
  /** En dessous, la parcelle est un couloir, pas un pré : capacité nulle `[GD]` */
  minCells: 6,
  /** Base de coût, en CRD `[TEST]` */
  baseCost: 400,
  /** Coût par case, en CRD `[TEST]` */
  costPerCell: 90,
} as const;

/**
 * Places de sortie offertes par un enclos de `cells` cases.
 * Un enclos trop petit ne vaut rien du tout : pas de dégressivité douce, un
 * seuil net, plus lisible pour le joueur.
 */
export function paddockCapacity(cells: number): number {
  const n = Math.max(0, Math.floor(cells));
  if (n < PADDOCK.minCells) return 0;
  return n * PADDOCK.capacityPerCell;
}

/** Coût de construction d'un enclos, en CRD. */
export function paddockCost(cells: number): number {
  const n = Math.max(0, Math.floor(cells));
  return PADDOCK.baseCost + n * PADDOCK.costPerCell;
}

/** Emprise rectangulaire d'un bâtiment sur la grille. */
export type Footprint = { originX: number; originY: number; w: number; h: number };

/** Les intervalles `[a ; a+la[` et `[b ; b+lb[` se chevauchent-ils vraiment ? */
function overlaps(a: number, la: number, b: number, lb: number): boolean {
  return Math.max(a, b) < Math.min(a + la, b + lb);
}

/**
 * Vraie adjacence : les deux emprises partagent un **bord commun de longueur
 * non nulle**. Le coin à coin est refusé — une vache ne passe pas par une
 * diagonale, et accepter le contact diagonal ouvrirait des placements en
 * damier absurdes visuellement.
 */
export function isPaddockAdjacent(barn: Footprint, paddock: Footprint): boolean {
  const touchesVertically =
    (barn.originY + barn.h === paddock.originY || paddock.originY + paddock.h === barn.originY) &&
    overlaps(barn.originX, barn.w, paddock.originX, paddock.w);

  const touchesHorizontally =
    (barn.originX + barn.w === paddock.originX || paddock.originX + paddock.w === barn.originX) &&
    overlaps(barn.originY, barn.h, paddock.originY, paddock.h);

  return touchesVertically || touchesHorizontally;
}

/* ------------------------------------------------------------------ */
/* 5. Cycle de sortie — pilotage de l'animation 3D                     */
/* ------------------------------------------------------------------ */

/** Une vague de sortie : quand, jusqu'à quand, et combien de bêtes. */
export type GrazingWindow = { startsAt: number; endsAt: number; animals: number };

/**
 * Paramètres de la sortie au pré `[GD]`.
 *
 * Les bêtes sortent par vagues de 8 : c'est autant une contrainte d'animation
 * (un troupeau de 50 qui franchit la porte d'un coup ne peut pas être lisible)
 * qu'un choix de simulation (l'ingéré d'un pré ne se reconstitue pas
 * instantanément).
 */
export const GRAZING = {
  /** Bêtes par vague `[GD]` */
  waveSize: 8,
  /** Rassemblement avant l'ouverture de la porte `[TEST]` — 5 min de jeu */
  leadInMs: (5 / 60) * HOUR_MS,
  /** Durée de base d'une sortie `[GD]` — 3 h */
  baseDurationMs: 3 * HOUR_MS,
  /** Rallonge par bête de la vague `[TEST]` — 6 min de jeu */
  perAnimalMs: (6 / 60) * HOUR_MS,
  /** Durée maximale d'une sortie `[GD]` — 6 h */
  maxDurationMs: 6 * HOUR_MS,
  /** Une sortie par cycle : en deçà, `planGrazing()` refuse `[GD]` */
  cooldownMs: 20 * HOUR_MS,
} as const;

/**
 * Planifie la prochaine vague de sortie, ou `null` si elle est impossible.
 *
 * Entièrement déterministe (aucun aléa, aucune horloge lue) : le client 3D peut
 * rejouer la même fenêtre que le serveur à partir des mêmes entrées.
 * La météo n'est volontairement pas un paramètre ici : la planification est
 * une intention, c'est `canGraze()` qui tranche au moment de l'ouverture.
 */
export function planGrazing(
  now: number,
  herd: Herd,
  paddock: PaddockState | null,
): GrazingWindow | null {
  if (paddock === null || !paddock.adjacent) return null;

  const size = Math.max(0, Math.floor(herd.size));
  const places = Math.min(size, Math.max(0, Math.floor(paddock.capacity)));
  if (places <= 0) return null;

  // Cooldown : une sortie déjà faite dans les 20 dernières heures suffit.
  if (herd.lastGrazedAt !== null && now - herd.lastGrazedAt < GRAZING.cooldownMs) return null;

  const animals = Math.min(places, GRAZING.waveSize);
  const startsAt = now + GRAZING.leadInMs;
  const duration = Math.min(
    GRAZING.maxDurationMs,
    GRAZING.baseDurationMs + GRAZING.perAnimalMs * animals,
  );

  return { startsAt, endsAt: startsAt + duration, animals };
}

/** Nombre de vagues nécessaires pour sortir tout le lot. */
export function grazingWaveCount(herdSize: number, paddockCapacity: number): number {
  const places = Math.min(
    Math.max(0, Math.floor(herdSize)),
    Math.max(0, Math.floor(paddockCapacity)),
  );
  return Math.ceil(places / GRAZING.waveSize);
}

/* ------------------------------------------------------------------ */
/* 6. Libellés français                                                */
/* ------------------------------------------------------------------ */

/**
 * Tranches de satisfaction, de la pire à la meilleure.
 *
 * Les seuils suivent la nouvelle échelle : besoins remplis = 1, donc
 * « Épanouies » est l'état **normal** d'un troupeau bien tenu et non une
 * récompense rare. Les trois tranches basses désignent chacune un manque
 * réel — faim, soif, dépassement de capacité — et non le simple fait d'être à
 * l'étable, qui n'a plus de coût.
 */
export const HAPPINESS_LABELS: readonly { min: number; label: string }[] = [
  { min: 0, label: "En souffrance" },
  { min: 0.4, label: "Stressées" },
  { min: 0.7, label: "Correctes" },
  { min: 0.95, label: "Épanouies" },
];

/** Libellé d'affichage d'une jauge de bien-être. */
export function happinessLabel(happiness: number): string {
  const h = clamp(happiness, HAPPINESS.min, HAPPINESS.max);
  let label = HAPPINESS_LABELS[0].label;
  for (const tier of HAPPINESS_LABELS) {
    if (h >= tier.min) label = tier.label;
  }
  return label;
}

/* ------------------------------------------------------------------ */
/* Mortalité et âge du lot                                             */
/* ------------------------------------------------------------------ */

/**
 * Un troupeau qu'on abandonne finit par perdre des bêtes.
 *
 * **La santé, et rien d'autre.** C'est le verrou de toute la refonte : la
 * mortalité ne lit plus la satisfaction des besoins mais `health`, qui ne
 * baisse que par la cascade (`tickHealth()`), c'est-à-dire après huit heures
 * réelles de mangeoire vide, et qui ne s'annule qu'après trente-six.
 *
 * Ce que cela ferme, définitivement : un troupeau enfermé tout l'hiver, nourri
 * et abreuvé, ne peut plus perdre une seule bête. Auparavant la satisfaction
 * d'un lot confiné tombait à 0,35 et le moindre malus supplémentaire la
 * poussait sous ce plancher de 0,15 — c'est ainsi que sont mortes les bêtes de
 * la capture de Strea, dans une étable au tiers pleine avec un jour de ration
 * d'avance.
 */
export const MORTALITY = {
  /** En dessous de cette **santé**, les pertes commencent `[GD]` */
  floor: 0.15,
  /**
   * Part du lot perdue par **jour réel**, santé au plus bas `[GD]`.
   *
   * Un quart, et compté en temps de montre — pas en cycles d'élevage.
   *
   * Le barème d'avant valait 6 % par cycle, soit un cycle toutes les
   * 1 h 25 min : dix-sept pour cent par heure réelle. Tant que le serveur
   * tournait sans arrêt, personne ne l'avait vu ; mesuré sur la pile complète,
   * un joueur revenant après trente-quatre heures se voyait appliquer
   * vingt-quatre cycles **d'un coup**, soit cent quarante pour cent du lot :
   * le troupeau entier disparaissait dans l'instant de la reconnexion, sans
   * qu'aucun avertissement ait pu être lu. C'est le contraire de ce qu'on
   * cherche — l'absence doit coûter, elle ne doit pas condamner.
   *
   * À ce rythme, un troupeau de quarante bêtes complètement abandonné en perd
   * dix par jour réel. Trois jours d'absence laissent de quoi repartir.
   */
  perDayAtWorst: 0.25,
} as const;

/** Un jour de montre, en millisecondes — l'unité des pertes. */
const REAL_DAY_MS = 24 * REAL_HOUR_MS;

/**
 * Pertes d'un lot sur une durée donnée.
 *
 * La dette fractionnaire est reportée d'un appel à l'autre : sans elle, un lot
 * de trois bêtes ne perdrait jamais rien, la perte attendue restant sous
 * l'unité. Elle est retournée pour être stockée.
 *
 * ## La santé baisse *pendant* la fenêtre, elle n'y est pas plate
 *
 * `healthBefore` est la santé au début du pas, `health` celle de la fin. Entre
 * les deux elle descend en ligne droite, et **seule la part passée sous le
 * plancher** coûte des bêtes. Un pas de trente-quatre heures qui commence à
 * pleine santé n'en compte qu'un peu plus de deux sous le plancher, pas
 * trente-quatre.
 *
 * Sans cette lecture, un joueur qui rentrait après une nuit et une journée
 * voyait le pire des barèmes appliqué à toute son absence : mesuré, cent
 * quarante pour cent du lot en une reconnexion. `healthBefore` est facultatif
 * — omis, on retombe sur l'ancienne lecture, santé plate.
 */
export function mortalityToll(input: {
  /** Santé du lot à la fin du pas, cf. `tickHealth()` — **jamais** la satisfaction */
  health: number;
  /** Santé au début du pas ; par défaut, la même qu'à la fin */
  healthBefore?: number;
  herdSize: number;
  elapsedMs: number;
  debt: number;
}): { deaths: number; debt: number } {
  const size = Math.max(0, Math.floor(input.herdSize));
  if (size <= 0) return { deaths: 0, debt: 0 };

  const fin = clamp(input.health, 0, 1);
  const debut = clamp(input.healthBefore ?? fin, 0, 1);
  const jours = Math.max(0, input.elapsedMs) / REAL_DAY_MS;

  if (debut >= MORTALITY.floor && fin >= MORTALITY.floor) {
    // Un troupeau qu'on remet d'aplomb ne traîne pas sa dette : la pression
    // retombe avec la faim.
    return { deaths: 0, debt: Math.max(0, input.debt - 0.25) };
  }

  /*
   * Part de la fenêtre passée sous le plancher, et santé moyenne sur cette
   * part. Trois cas : sous le plancher d'un bout à l'autre, ou traversée dans
   * un sens ou dans l'autre — la géométrie est la même, seul le bord change.
   */
  let part: number;
  let moyenne: number;
  if (debut < MORTALITY.floor && fin < MORTALITY.floor) {
    part = 1;
    moyenne = (debut + fin) / 2;
  } else {
    const bas = debut < MORTALITY.floor ? debut : fin;
    const haut = debut < MORTALITY.floor ? fin : debut;
    // Où la droite coupe le plancher, en part de la fenêtre.
    part = haut === bas ? 1 : (MORTALITY.floor - bas) / (haut - bas);
    moyenne = (bas + MORTALITY.floor) / 2;
  }

  const severite = clamp((MORTALITY.floor - moyenne) / MORTALITY.floor, 0, 1);
  const debt = input.debt + size * MORTALITY.perDayAtWorst * severite * jours * part;
  const deaths = Math.min(size, Math.floor(debt));
  return { deaths, debt: debt - deaths };
}

/** Âge des bêtes achetées : on achète du bétail élevé, pas des nouveau-nés `[GD]` */
export const PURCHASED_AGE_MS = Math.round(0.6 * MEAT_MATURITY_MS);

/**
 * Âge moyen du lot après l'arrivée de bêtes plus jeunes — naissances ou achat.
 *
 * L'âge était celui du lot depuis sa création, si bien qu'un veau né le jour
 * même comptait comme ses aînés à l'abattage. La moyenne se dilue désormais à
 * chaque arrivée, au prorata des effectifs.
 */
export function blendedAgeMs(input: {
  herdSize: number;
  averageAgeMs: number;
  added: number;
  addedAgeMs: number;
}): number {
  const size = Math.max(0, Math.floor(input.herdSize));
  const added = Math.max(0, Math.floor(input.added));
  if (added <= 0) return Math.max(0, input.averageAgeMs);
  const total = size + added;
  if (total <= 0) return 0;
  return Math.max(0, (input.averageAgeMs * size + input.addedAgeMs * added) / total);
}
