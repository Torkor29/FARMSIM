/** Types & constantes partagés Farming Navigateur */

import {
  GAME_DAY_MS,
  JOB_MS_PER_GAME_HOUR,
  SEASON_DAYS,
  SEASON_REAL_HOURS,
  SEASON_REAL_MS,
} from "./time.js";
import { MACHINE_END_OF_LIFE_HOURS } from "./machine-care.js";
import { machineVariant, type MachineTier } from "./machine-catalog.js";
import { RECIPES, type ProcessingKind } from "./processing.js";
import { kindForBarn, yardTypeForBarn } from "./livestock.js";
import {
  GREASE_FULL,
  machineWorkBlock,
  type BreakdownKind,
  type MachineCareState,
} from "./machine-care.js";

export * from "./euros.js";
export * from "./voisinage.js";
export * from "./ledger.js";
export * from "./time.js";
export * from "./world.js";
export * from "./climate.js";
export * from "./land.js";
export * from "./livestock.js";
export * from "./ripeness.js";
export * from "./soil.js";
export * from "./trade.js";
export * from "./goods.js";
export * from "./cour.js";
export * from "./parking.js";
export * from "./storage.js";
export * from "./breeding.js";
export * from "./rotation.js";
export * from "./futures.js";
export * from "./machine-care.js";
export * from "./machine-catalog.js";
export * from "./employees.js";
export * from "./calendar.js";
export * from "./fuel.js";
export * from "./weeds.js";
export * from "./play-guide.js";
export * from "./credit.js";
export * from "./processing.js";
export * from "./crop-calendar.js";
export * from "./art-anchor.js";
export * from "./appearance.js";
export * from "./crops.js";
export * from "./manure.js";
export * from "./bedding.js";
export * from "./dev-accounts.js";
export * from "./progression.js";
export * from "./quests.js";
export * from "./skills.js";
export * from "./consignes.js";
export * from "./forage.js";
export * from "./species.js";
export * from "./husbandry.js";
export * from "./recovery.js";

/** Monnaie du jeu : le terron (€). Le champ interne reste `crd`. */
export const CURRENCY_CODE = "€";
export const CURRENCY_NAME = "terron";

import { GOOD_DEFS, type TradeGood } from "./goods.js";

export type Specialization = "CEREALIER" | "ELEVEUR";

/** Les deux métiers jouables. Les travaux à façon sont un appoint, pas un 3ᵉ métier. */
export const PLAYABLE_SPECIALIZATIONS: Specialization[] = ["CEREALIER", "ELEVEUR"];

import type { CropCode } from "./crops.js";

export type FieldStage =
  | "EMPTY"
  | "PREPARED"
  | "PLANTED"
  | "GROWING"
  | "READY"
  /** Récolte manquée : la culture est perdue, seul le labour libère la case */
  | "SPOILED"
  | "HARVESTED";

export type { WeatherState } from "./climate.js";
import type { WeatherState } from "./climate.js";

export const WEATHER_LABELS: Record<WeatherState, string> = {
  CLEAR: "Clair",
  CLOUDY: "Nuageux",
  RAIN: "Pluie",
  STORM: "Orage",
  SNOW: "Neige",
};

/**
 * La météo en cinq lettres, pour les bandeaux étroits du téléphone.
 *
 * « Nuageux » tronqué donnait « Nua… », ce qui informe moins que rien : le
 * joueur voit qu'on lui cache quelque chose sans savoir quoi. Mieux vaut un
 * mot entier plus court qu'un mot long coupé.
 */
export const WEATHER_SHORT: Record<WeatherState, string> = {
  CLEAR: "Clair",
  CLOUDY: "Gris",
  RAIN: "Pluie",
  STORM: "Orage",
  SNOW: "Neige",
};


/** Intervalle tick serveur MVP `[TEST]` */
export const SIM_TICK_MS = 20_000;

/**
 * Taux par tick correspondant à une demi-vie donnée, en **jours de jeu**.
 *
 * Une décroissance écrite « tant par tick » est un piège : elle dépend à la
 * fois du pas de simulation et de la durée d'un jour. Les deux ont changé au
 * moins une fois chacun. Écrire la demi-vie et en déduire le pas rend le
 * réglage lisible — « un excédent se résorbe de moitié en huit heures de jeu »
 * — et insensible au reste.
 */
export function tauxParTick(halfLifeDays: number, tickMs: number = SIM_TICK_MS): number {
  const demiVie = Math.max(1, halfLifeDays * GAME_DAY_MS);
  return 1 - Math.pow(2, -tickMs / demiVie);
}

/**
 * Le temps de route d'une commande au négociant `[GD]`.
 *
 * L'achat versait la marchandise au silo dans la même milliseconde : on
 * cliquait, un chiffre changeait quelque part, et rien ne se passait à
 * l'écran. Une ferme reçoit pourtant ses intrants, et ce temps-là fait partie
 * du métier — on commande avant d'en avoir besoin.
 *
 * Douze secondes : assez pour qu'on voie le camion arriver et qu'on ait le
 * sentiment d'avoir commandé, trop court pour qu'on aille faire autre chose.
 * En dessous de dix, la caisse se pose avant qu'on ait fermé le marché.
 */
export const DELIVERY_TRAVEL_MS = 12_000;

/**
 * Passé ce délai, la caisse rentre toute seule.
 *
 * Une marchandise payée ne doit jamais se perdre parce qu'on a fermé
 * l'onglet. Le geste reste le chemin normal — et le seul qui donne
 * l'animation —, celui-ci n'est qu'un filet.
 */
export const DELIVERY_AUTO_MS = 3 * 60_000;

export type ContractJobType =
  | "PLOW"
  | "SOW"
  | "FERTILIZE"
  | "HARVEST"
  | "TRANSPORT";

export type BuildingType =
  | "SILO"
  | "HAY_BARN"
  | "MACHINE_SHED"
  | "CATTLE_BARN"
  | "PIGSTY"
  | "HENHOUSE"
  | "SHEEPFOLD"
  | "WORKSHOP"
  | "FARMHOUSE"
  | "PADDOCK"
  | "PIG_YARD"
  | "HEN_YARD"
  | "COLD_ROOM"
  | "BUNKER_SILO"
  /* —— Petits ouvrages ——
     Ils ne stockent rien et n'abritent personne : ils branchent un système sur
     un autre, pour un coût modeste. Aucun n'est obligatoire — une ferme sans
     eux doit rester viable —, ce sont des paris de rentabilité. */
  | "SOLAR_PANELS"
  | "WIND_TURBINE"
  | "BEEHIVE"
  | "DAIRY"
  | "MILL"
  /* —— Les annexes d'élevage ——
     Collées à une étable, elles ne changent rien à ce qu'elle héberge : elles
     font monter son **niveau d'installation**, et avec lui la production, la
     reproduction et l'économie de fourrage. Ce sont les deux pièces qui
     rendent l'élevage rentable au lieu de simplement viable. */
  | "WATER_TROUGH"
  | "HAY_RACK"
  /* Le logement des employés. Il n'est pas requis pour embaucher — deux
     personnes logent au village — mais c'est lui qui ouvre au-delà, et il
     fait baisser le salaire de ceux qu'il héberge. */
  | "EMPLOYEE_HOUSING";

export type CellKind = "EMPTY" | "CROP" | "BUILDING" | "VEHICLE";

export const SPECIALIZATION_LABELS: Record<Specialization, string> = {
  CEREALIER: "Céréalier",
  ELEVEUR: "Éleveur",
};

/** Version courte, pour les barres d'état où la place manque. */
export const SPECIALIZATION_SHORT: Record<Specialization, string> = {
  CEREALIER: "Céréalier",
  ELEVEUR: "Éleveur",
};

/** Illustration du matériel, pour le catalogue et le garage — une par famille. */
export const MACHINE_ART: Record<MachineType, string> = {
  TRACTOR: "/assets/vehicles/tractor.png",
  HARVESTER: "/assets/vehicles/harvester.png",
  FORAGE_HARVESTER: "/assets/vehicles/forage-harvester.png",
  SPREADER: "/assets/vehicles/spreader.png",
  DISC_HARROW: "/assets/vehicles/harrow.png",
  PLOUGH: "/assets/vehicles/plough.png",
  SEEDER: "/assets/vehicles/seeder.png",
  MOWER: "/assets/vehicles/mower.png",
  SPRAYER: "/assets/vehicles/sprayer.png",
  BALER: "/assets/vehicles/baler.png",
  TRAILER: "/assets/vehicles/trailer.png",
};

/** Bonus spé max ≤ +10 % — valeurs de départ faibles `[GD]` */
export const SPECIALIZATION_BONUSES: Record<
  Specialization,
  { domain: string; bonus: number }
> = {
  CEREALIER: { domain: "cropYield", bonus: 0.02 },
  ELEVEUR: { domain: "feedConversion", bonus: 0.02 },
};

/**
 * Le catalogue des cultures.
 *
 * Les durées de pousse étaient des valeurs de mise au point — « 3 min MVP
 * pour itérer », disait le commentaire, et elles y sont restées. Sur une
 * parcelle de 12 × 12, cela faisait environ 6 200 € nets toutes les trois
 * minutes, soit **124 000 € à l'heure**, quand une étable en coûte 2 800 :
 * l'argent n'avait plus de poids, et aucune décision agricole n'en était une.
 *
 * Elles sont désormais comptées en **jours de jeu** (`GAME_DAY_MS`), et la
 * saison en fait sept. Une céréale occupe donc la plus grande part de sa
 * saison : semer devient un engagement, et le calendrier agricole existe.
 *
 * Deux garde-fous délibérés :
 *
 * - le **pois** reste court, pour qu'il y ait toujours une raison de revenir
 *   dans le quart d'heure ;
 * - la pousse se calcule depuis `plantedAt`, donc elle **court hors ligne**.
 *   C'est ce qui rend des durées d'une heure confortables plutôt que
 *   punitives : un champ semé avant de fermer l'onglet est mûr au retour.
 */
/**
 * Le capital de croissance d'une culture, exprimé en heures.
 *
 * `growMs` n'est **pas** un temps réel : c'est un capital que chaque saison
 * remplit à sa vitesse. Une heure d'automne vaut 0,85 heure de croissance pour
 * un blé ; une heure d'hiver n'en vaut que 0,30. Deux blés semés à deux
 * saisons d'écart mettent donc des temps différents à mûrir, et c'est tout
 * l'intérêt de semer au bon moment.
 *
 * Les valeurs ci-dessous ont été calculées pour que chaque culture, **semée au
 * début de sa fenêtre**, mûrisse dans la saison où on la récolte vraiment :
 * le blé d'automne en été, l'orge au printemps, le maïs de printemps à
 * l'automne. Elles portent une marge délibérée — viser la frontière exacte
 * d'une saison ferait basculer la récolte d'une saison entière pour quelques
 * minutes de retard au semis.
 */
function croissanceHeures(h: number): number {
  return Math.round(h * 60 * 60 * 1000);
}

/** Combien de saisons pleines représente un capital, à titre indicatif. */
export function growSeasonsHint(growMs: number): number {
  return Math.round((growMs / 3_600_000 / SEASON_REAL_HOURS) * 10) / 10;
}

export const CROP_DEFS: Record<
  CropCode,
  {
    code: CropCode;
    name: string;
    /** Rendement par case cultivée `[GD]` */
    yieldPerCell: number;
    growMs: number;
    seedCostPerCell: number;
    /** Herbe : temps entre deux fauches, plus court que le premier cycle */
    regrowMs?: number;
  }
> = {
  WHEAT: {
    code: "WHEAT",
    name: "Blé",
    yieldPerCell: 0.35,
    // Semé au début de l'automne, mûr en été — le blé d'hiver classique.
    growMs: croissanceHeures(28),
    seedCostPerCell: 15,
  },
  MAIZE: {
    code: "MAIZE",
    name: "Maïs",
    yieldPerCell: 0.45,
    // Semé au début du printemps, mûr à l'automne. Qui plante du maïs engage
    // son champ jusqu'aux moissons, et c'est ce qui doit rendre le choix
    // sérieux — mais il paie le mieux à la case.
    growMs: croissanceHeures(27),
    seedCostPerCell: 18,
  },
  // Tête de rotation : le pois rapporte moins à la tonne, mais il laisse
  // derrière lui un sol azoté dont profite la culture suivante. C'est ce qui
  // en fait une décision, et non un choix par défaut.
  PEA: {
    code: "PEA",
    name: "Pois",
    yieldPerCell: 0.26,
    // La plus rapide des cultures de vente : semé au printemps, mûr en été,
    // dans la saison qui suit. C'est le pois qui donne une raison de revenir
    // quand tout le reste immobilise le champ deux ou trois saisons.
    growMs: croissanceHeures(13),
    seedCostPerCell: 12,
  },
  BARLEY: {
    code: "BARLEY",
    name: "Orge",
    yieldPerCell: 0.32,
    // Plus précoce que le blé, comme le dit sa fiche : mûre au printemps.
    growMs: croissanceHeures(15),
    seedCostPerCell: 13,
  },
  RAPE: {
    code: "RAPE",
    name: "Colza",
    yieldPerCell: 0.22,
    // Semé en été, mûr au printemps ; semé à l'automne, mûr en été.
    growMs: croissanceHeures(26),
    seedCostPerCell: 16,
  },
  GRASS: {
    code: "GRASS",
    name: "Herbe",
    yieldPerCell: 0.4,
    // Une coupe par saison, ou presque.
    growMs: croissanceHeures(12),
    // L'herbe déjà fauchée repart vite : c'est ce qui fait tenir un élevage
    // sur ses propres fourrages sans immobiliser un champ toute la saison.
    // La repousse est plus rapide que l'installation : le pied est déjà là.
    regrowMs: croissanceHeures(7),
    seedCostPerCell: 8,
  },
};

/** Durée de pousse : l'herbe déjà fauchée reprend plus vite. */
export function cropGrowMs(crop: CropCode, cutsDone = 0): number {
  const def = CROP_DEFS[crop];
  if (crop === "GRASS" && cutsDone > 0) return def.regrowMs ?? def.growMs;
  return def.growMs;
}

/**
 * Bornes de cours par marchandise. Toutes les marchandises échangées doivent
 * y figurer : le tick de marché les parcourt sans distinction, et une entrée
 * manquante produirait un prix `NaN`.
 */
/**
 * L'amplitude et la profondeur de chaque marché.
 *
 * **Le prix, lui, n'est pas ici** : il vit dans `GOOD_DEFS.basePrice`, et
 * `MARKET_BOUNDS.initial` s'en déduit. C'était une deuxième table de prix,
 * écrite à côté de la première — le blé y valait 220 aux deux endroits, ce qui
 * marchait tant que personne n'en changeait qu'un. Passé le colza, l'ensilage
 * et le fumier à leur vrai cours dans `GOOD_DEFS`, le marché du jeu a continué
 * de coter les anciens : l'un des deux mentait, et rien ne le disait.
 *
 * Ce qui reste propre à chaque denrée, ce sont les **rapports** : jusqu'où le
 * cours peut descendre (`bas`) et monter (`haut`) par rapport à son prix de
 * référence, et la profondeur du carnet. Ceux-là décrivent la volatilité et la
 * liquidité, pas le niveau des prix — ils ne bougent pas quand un cours bouge.
 */
const AMPLITUDES: Record<TradeGood, { bas: number; haut: number; depth: number }> = {
  WHEAT: { bas: 0.55, haut: 2.05, depth: 125 },
  MAIZE: { bas: 0.5, haut: 2.0, depth: 125 },
  // Le lait varie peu : c'est un revenu régulier, pas un pari.
  MILK: { bas: 0.71, haut: 1.48, depth: 50 },
  MEAT: { bas: 0.62, haut: 1.59, depth: 20 },
  HAY: { bas: 0.63, haut: 1.74, depth: 94 },
  STRAW: { bas: 0.62, haut: 1.81, depth: 56 },
  // Une botte pèse 0,35 t : à son prix, la tonne bottelée vaut sensiblement
  // plus que le vrac. L'écart, c'est le travail de la presse — c'est lui qui
  // rend la botteleuse rentable, sinon personne n'en achèterait.
  STRAW_BALE: { bas: 0.62, haut: 1.81, depth: 162 },
  // Carnet étroit à dessein : l'ensilage n'est pas un cours mondial liquide.
  SILAGE: { bas: 0.73, haut: 1.45, depth: 20 },
  // Marché plus étroit que le blé : un gros lot y pèse davantage.
  PEA: { bas: 0.6, haut: 1.82, depth: 56 },
  BARLEY: { bas: 0.56, haut: 1.95, depth: 100 },
  RAPE: { bas: 0.62, haut: 1.71, depth: 44 },
  EGGS: { bas: 0.55, haut: 1.82, depth: 25 },
  WOOL: { bas: 0.62, haut: 1.62, depth: 20 },
  // Profondeur faible : un marché de niche se sature vite, et c'est ce qui
  // empêche de transformer sans fin sans regarder le cours.
  CHEESE: { bas: 0.65, haut: 1.67, depth: 18 },
  FLOUR: { bas: 0.62, haut: 1.73, depth: 30 },
  // Coté pour l'affichage ; le fumier ne s'échange pas sur ce marché.
  MANURE: { bas: 0.73, haut: 1.45, depth: 20 },
};

export const MARKET_BOUNDS: Record<
  TradeGood,
  { initial: number; min: number; max: number; depth: number }
> = Object.fromEntries(
  (Object.keys(AMPLITUDES) as TradeGood[]).map((g) => {
    const a = AMPLITUDES[g];
    const initial = GOOD_DEFS[g].basePrice;
    return [g, { initial, min: Math.round(initial * a.bas), max: Math.round(initial * a.haut), depth: a.depth }];
  }),
) as Record<TradeGood, { initial: number; min: number; max: number; depth: number }>;

/**
 * Garde-fou contre la dérive, par tick `[GD]`.
 *
 * Ce n'est **pas** « le prix doit revenir à 220 ». Un cours n'a aucune raison
 * de retrouver un chiffre décrété : ce qui le ramène, c'est que les vendeurs
 * se retirent quand il baisse et que les acheteurs se pressent — ce travail-là
 * est fait par l'élasticité de l'offre et de la demande PNJ, en aval.
 *
 * Il reste ce rappel très faible pour une seule raison, purement numérique :
 * les bornes `min`/`max` sont des murs, et un déséquilibre minuscule mais
 * constant finit par y coller le cours pour de bon. À 0,002, la demi-vie du
 * rappel est de deux heures — assez pour décoller d'un mur, bien trop lent
 * pour effacer une saison ou une année d'excédent.
 *
 * Historique : 0,12 à l'origine (demi-vie cent-huit secondes, le marché ne
 * pouvait rien exprimer), puis 0,015 (un quart d'heure — mais c'était encore
 * lui, et non l'offre, qui fixait le cours d'équilibre).
 */
export const MARKET_REVERSION_HALFLIFE_SEASONS = 4.5;

/**
 * La même demi-vie en jours de jeu, pour `tauxParTick`.
 *
 * Écrite en **saisons** au-dessus, et pas en jours, parce que c'est la saison
 * que le rappel doit être trop lent pour effacer : la borne du réglage est
 * « bien plus long qu'une saison », et un nombre de jours ne la dit pas. Quand
 * la longueur d'une saison change, ce garde-fou garde son sens tout seul.
 */
export const MARKET_REVERSION_HALFLIFE_DAYS = MARKET_REVERSION_HALFLIFE_SEASONS * SEASON_DAYS;

/**
 * Part du rappel appliquée à chaque tick.
 *
 * Dérivée de la demi-vie, et non posée en dur : elle valait 0,002 par tick,
 * calibrée à l'époque où un jour de jeu durait quinze minutes. Le jour est
 * passé à six heures pour que l'année tombe sur la semaine réelle, et ce même
 * 0,002 par tick aurait effacé une année d'excédent en une soirée. Ce qui doit
 * rester constant, c'est la demi-vie **en temps de jeu** — pas le pas.
 */
export const MARKET_REVERSION = tauxParTick(MARKET_REVERSION_HALFLIFE_DAYS);

/**
 * Élasticité-prix de l'offre PNJ `[GD]`.
 *
 * Quand le cours cède, les fermes voisines gardent leur récolte au silo, se
 * tournent vers une autre culture, ou renoncent à semer la saison suivante :
 * l'offre se retire. C'est **le** mécanisme de rappel du marché, et il a le
 * bon goût d'avoir une limite — voir `MARKET_ELASTIC_FLOOR`.
 */
export const MARKET_SUPPLY_ELASTICITY = 0.7;

/**
 * Élasticité-prix de la demande PNJ `[GD]`, comptée négativement : un cours
 * bas fait venir les acheteurs. Plus faible que celle de l'offre — on
 * n'engraisse pas deux fois plus de bêtes parce que l'orge est bon marché.
 */
export const MARKET_DEMAND_ELASTICITY = 0.45;

/**
 * Bornes de la réponse élastique `[GD]`.
 *
 * L'offre ne tombe jamais à zéro et la demande n'est pas infinie : sans ces
 * butées, un cours effondré ferait remonter le prix aussi vite qu'il est
 * tombé, et un joueur qui inonde son marché n'en subirait aucune conséquence
 * durable. C'est précisément ce qu'on veut éviter : noyer le blé doit faire
 * mal longtemps.
 */
export const MARKET_ELASTIC_FLOOR = 0.45;
export const MARKET_ELASTIC_CEIL = 1.7;

/**
 * Profondeur minimale d'un marché, en fraction de sa profondeur nominale
 * `[GD]`. Un carnet vide appliquait la décote de volume maximale à la moindre
 * vente : il y a toujours des acheteurs quelque part.
 */
export const MARKET_DEPTH_FLOOR = 0.3;

/**
 * Sensibilité du cours au déséquilibre, par **jour de jeu** `[GD]`.
 *
 * Elle était écrite par tick, puis par jour de jeu, et l'unité était encore
 * fausse : un prix qui bouge « de tant par jour » avance d'autant plus vite
 * dans une saison qu'il y a de jours dedans. La saison est passée de
 * vingt-huit jours de jeu à sept, et le cours réagissait quatre fois moins par
 * saison — assez pour qu'un déversement massif ne se voie plus sur la moyenne
 * du trimestre.
 *
 * Vingt-cinq, c'est-à-dire que le cours parcourt environ vingt-cinq fois son
 * écart au déséquilibre dans une saison : il a le temps de réagir plusieurs
 * fois à l'intérieur d'une saison, sans jamais la traverser d'un bond.
 */
export const MARKET_KAPPA_PER_SEASON = 25;

/** La même sensibilité ramenée au pas de simulation. */
export const MARKET_KAPPA = (MARKET_KAPPA_PER_SEASON * SIM_TICK_MS) / SEASON_REAL_MS;

/**
 * Poids du carnet face au flux du jour `[GD]`.
 *
 * Ce qui dort dans le carnet pèse un peu moins que ce qui s'y présente
 * aujourd'hui : un stock installé fait céder les cours durablement, une
 * moisson isolée les fait céder d'un jour.
 */
export const MARKET_BOOK_WEIGHT = 0.5;

/**
 * Part du carnet écoulée à chaque tick `[GD]`.
 *
 * Cherchée par simulation, pas à l'estime : c'est elle qui décide du poids
 * d'une ferme sur son marché. Trop lente, une seule parcelle faisait céder
 * les cours de 8 % — un producteur isolé n'est pas censé faire le prix. Trop
 * rapide, on retombait sur le défaut d'origine, où même vingt parcelles ne se
 * voyaient pas.
 *
 * À trois dixièmes de saison, un excédent se résorbe de moitié en trois heures
 * — la même durée réelle qu'avant le changement de calendrier, et ce n'est pas
 * un hasard : c'est le rythme des moissons qui commande, et il n'a pas bougé.
 * Une moisson reste un événement de marché passager, un domaine qui produit
 * sans cesse pèse durablement. Le réglage n'est pas sur le fil — 0,25 et 0,35
 * tiennent les mêmes intentions.
 */
export const MARKET_ABSORB_HALFLIFE_SEASONS = 0.3;

/**
 * La même demi-vie en jours de jeu, pour `tauxParTick`.
 *
 * Elle valait un tiers de jour de jeu, posé en dur. Le chiffre était juste
 * tant qu'une culture mûrissait en cinq jours de jeu : l'excédent d'une
 * moisson vivait un quinzième de cycle cultural, donc les moissons d'un gros
 * domaine se chevauchaient et pesaient en permanence. Le blé est devenu la
 * céréale d'hiver qu'il aurait toujours dû être — semé à l'automne, moissonné
 * l'été, vingt jours de jeu — et ce même tiers de jour ne valait plus qu'un
 * soixantième de cycle : chaque moisson se résorbait entièrement avant la
 * suivante, et un domaine de vingt parcelles ne se voyait plus sur les cours.
 *
 * Ce qui doit rester constant, c'est le rapport entre la mémoire du carnet et
 * le rythme des moissons. Les deux se lisent maintenant en saisons.
 */
export const MARKET_ABSORB_HALFLIFE_DAYS = MARKET_ABSORB_HALFLIFE_SEASONS * SEASON_DAYS;

/** Part du carnet écoulée à chaque tick, dérivée de la demi-vie. */
export const MARKET_ABSORB = tauxParTick(MARKET_ABSORB_HALFLIFE_DAYS);

export type BuildingDef = {
  type: BuildingType;
  name: string;
  w: number;
  h: number;
  cost: number;
  description: string;
  storageGrain?: number;
  storageHay?: number;
  machineSlots?: number;
  cattleSlots?: number;
  pigSlots?: number;
  henSlots?: number;
  sheepSlots?: number;
  /** Multiplicateur yield cultures (ex. 0.02 = +2 %) */
  yieldBonus?: number;
  repairDiscount?: number;
  xpBonus?: number;
  /** Soft dryer — bonus réduction humidité au séchage `[GD]` */
  softDryer?: boolean;
  /**
   * Part des frais d'entretien des machines évitée `[GD]`.
   *
   * Distinct de `repairDiscount`, qui porte sur les réparations : celui-ci
   * couvre le courant — graissage, nettoyage, révision. C'est ce qui donne
   * une raison d'acheter des panneaux quand on a beaucoup d'engins.
   */
  careDiscount?: number;
  /**
   * Part du coût de séchage prise en charge par le courant de la ferme.
   *
   * Le séchoir est le seul poste du jeu qui brûle de l'électricité : c'est
   * donc le seul que produire du courant peut alléger. Il manquait, et faute
   * de lui les panneaux solaires remisaient… le graissage.
   */
  dryingDiscount?: number;
  /** Atelier de transformation hébergé, s'il y en a un. */
  processing?: ProcessingKind;
  /**
   * Article indéfini du nom, pour les phrases qui le citent.
   *
   * « il faut d'abord porcherie » ne se lit pas. Le genre est une propriété du
   * nom : il se déclare donc à côté de lui, et non dans la tournure qui
   * l'emploie, sinon chaque message devra le redeviner. Vaut « un » par défaut.
   */
  article?: "un" | "une";
  /**
   * Séchage gratuit et accéléré `[GD]`.
   *
   * L'humidité à la récolte ampute la vente ; l'éolienne fait tourner le
   * séchoir sans facture.
   */
  freeDrying?: boolean;
  /**
   * Portée de pollinisation, en cases `[GD]`.
   *
   * Le seul bonus du jeu qui dépende de **où** l'on pose le bâtiment. C'est
   * ce qui fait de la disposition de la ferme une question.
   */
  pollinationRange?: number;
  /** Rendement gagné sur les cultures pollinisées à portée `[GD]` */
  pollinationBonus?: number;
  /**
   * Part de la dégradation évitée sur les denrées périssables `[GD]`.
   *
   * Le lait perdait douze pour cent par cycle sans qu'aucun bâtiment n'y
   * puisse rien : produire beaucoup n'avait donc pas de sens si l'on ne
   * vendait pas dans la foulée. Le froid rend l'élevage tenable.
   */
  spoilageSlow?: number;
};

/**
 * Humidité de récolte & séchage MVP `[TEST]`
 * @see docs/research/27_MOISTURE_DRYING.md
 */
export const DRYING = {
  /** € par tonne et par passe de séchage */
  costPerTonPerPass: 12,
  /** Réduction d’humidité (fraction) par passe */
  moistureReductionPerPass: 0.06,
  /** Réduction extra si SILO / HAY_BARN sur la ferme */
  barnExtraReduction: 0.03,
  /** Plancher d’humidité après séchage */
  moistureFloor: 0.1,
  /** Au-delà : malus vente */
  sellThreshold: 0.14,
  /** Malus prix si humidité > seuil */
  sellPenaltyAbove: 0.15,
} as const;

/** Une ligne pour une offre : combien, et pourquoi ça vaut moins. */
export function lotQualityLine(opts: {
  tons: number;
  moisture: number;
  quality: number;
  unit?: string;
}): string {
  const rounded = Math.round(opts.tons * 100) / 100;
  const tonsLabel = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(rounded < 10 ? 2 : 1);
  const rawUnit = opts.unit && opts.unit !== "t" ? opts.unit : "tonnes";
  const parts = [`${tonsLabel} ${rawUnit}`];
  if (opts.moisture > DRYING.sellThreshold) {
    parts.push("trop d’eau, moins cher");
  }
  if (opts.quality <= 2) parts.push("récolté trop tard");
  return parts.join(" · ");
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  SILO: {
    type: "SILO",
    name: "Silo à grain",
    w: 2,
    h: 2,
    // Prix réel : silo à grain métallique de 200 t.
    cost: 9500,
    description: "Sans lui, le grain se vend au champ. Avec lui : stockage, séchage.",
    storageGrain: 40,
    yieldBonus: 0.01,
    softDryer: true,
  },
  HAY_BARN: {
    type: "HAY_BARN",
    name: "Hangar paille / foin",
    w: 2,
    h: 2,
    // Prix réel : hangar de stockage fourrage, bardage tôle.
    cost: 6800,
    description: "Stocke bottes et fourrages ; séchage soft.",
    storageHay: 30,
    softDryer: true,
  },
  MACHINE_SHED: {
    type: "MACHINE_SHED",
    name: "Hangar matériel",
    w: 3,
    h: 2,
    // Prix réel : hangar matériel de 300 m².
    cost: 11500,
    description:
      "Range jusqu’à 6 engins à l’abri : sous un toit, une machine s’use 15 % moins vite qu’à la cour.",
    machineSlots: 6,
  },
  CATTLE_BARN: {
    type: "CATTLE_BARN",
    article: "une",
    name: "Étable bovins",
    w: 3,
    h: 3,
    // Prix réel : stabulation pour une trentaine de bovins.
    cost: 26000,
    description: "Bâtiment élevage bovin (slots).",
    cattleSlots: 12,
    yieldBonus: 0.01,
  },
  PIGSTY: {
    type: "PIGSTY",
    article: "une",
    name: "Porcherie",
    w: 2,
    h: 3,
    // Prix réel : porcherie d'engraissement.
    cost: 19000,
    description: "Bâtiment élevage porcin (slots).",
    pigSlots: 20,
  },
  HENHOUSE: {
    type: "HENHOUSE",
    name: "Poulailler",
    w: 2,
    h: 2,
    // Prix réel : poulailler de plein air.
    cost: 7200,
    description: "Petit, pas cher. Le revenu, c’est l’œuf.",
    henSlots: 24,
  },
  SHEEPFOLD: {
    type: "SHEEPFOLD",
    article: "une",
    name: "Bergerie",
    w: 3,
    h: 2,
    // Prix réel : bergerie.
    cost: 15000,
    description: "Les moutons vivent surtout dehors. On tond la laine.",
    sheepSlots: 16,
  },
  COLD_ROOM: {
    type: "COLD_ROOM",
    name: "Chambre froide",
    w: 2,
    h: 2,
    // Prix réel : chambre froide de ferme.
    cost: 9000,
    description: "Ralentit la dégradation du lait, de la viande et des œufs.",
    spoilageSlow: 0.4,
  },
  WORKSHOP: {
    type: "WORKSHOP",
    name: "Atelier",
    w: 2,
    h: 2,
    // Prix réel : atelier équipé.
    // Aménagement d'un atelier dans un bâtiment existant — établi,
    // outillage, compresseur. Il se rembourse en remises d'entretien : à
    // 6 000 € il en demandait mille, ce qu'aucune ferme ne fait.
    cost: 3500,
    description:
      "Répare moins cher, et l'entretien courant — graissage, nettoyage, révision — coûte 20 % de moins.",
    repairDiscount: 0.1,
    // La remise d'entretien vient des panneaux solaires, où elle n'avait
    // aucun sens : c'est ici qu'on entretient, pas sous les panneaux.
    careDiscount: 0.2,
  },
  FARMHOUSE: {
    type: "FARMHOUSE",
    name: "Maison d’exploitation",
    w: 2,
    h: 2,
    // Prix réel : bâtiment d'exploitation.
    cost: 18000,
    description: "HQ — léger bonus XP.",
    xpBonus: 0.02,
  },
  PADDOCK: {
    type: "PADDOCK",
    article: "un",
    name: "Enclos de pâture",
    w: 3,
    h: 3,
    // Prix réel : clôture et abreuvoir sur 3 ha.
    cost: 2400,
    description: "Collé à une étable ou une bergerie : les bêtes sortent, elles sont plus heureuses.",
  },
  PIG_YARD: {
    type: "PIG_YARD",
    article: "une",
    name: "Courette à porcs",
    w: 2,
    h: 3,
    // Moins chère que l'enclos : une souille close, pas une prairie.
    // Prix réel : courette bétonnée.
    cost: 1800,
    description: "Collée à une porcherie, elle laisse les porcs fouir dehors : moins de stress, plus de viande.",
  },
  HEN_YARD: {
    type: "HEN_YARD",
    article: "une",
    name: "Courette à poules",
    w: 2,
    h: 3,
    // Prix réel : parcours grillagé.
    cost: 1150,
    description: "Collée au poulailler : les poules picorent dehors, elles pondent mieux.",
  },
  /* ------------------------------------------------------------------ */
  /* Le personnel                                                        */
  /* ------------------------------------------------------------------ */
  EMPLOYEE_HOUSING: {
    type: "EMPLOYEE_HOUSING",
    article: "un",
    name: "Logement du personnel",
    w: 2,
    h: 2,
    /*
     * Le prix d'un bâtiment utilitaire du catalogue, pas d'une nouveauté qui
     * s'inventerait sa propre échelle.
     *
     * À ce tarif il ne se rembourse pas vite sur la seule remise de salaire —
     * et il ne le doit pas : ce qu'il vend d'abord, c'est la **capacité**.
     * La remise est ce qui rend l'agrandissement tentant une fois qu'on y est.
     * S'il paraît trop cher à l'usage, c'est le pourcentage qu'il faut monter,
     * pas le prix qu'il faut baisser : un bâtiment bon marché qu'on bâtit sans
     * y penser ne décide de rien.
     */
    cost: 7200,
    description:
      "Loge vos employés : un lit au premier niveau, cinq au dernier. Un employé logé coûte 35 % de moins.",
  },
  /* ------------------------------------------------------------------ */
  /* Annexes d'élevage                                                   */
  /* ------------------------------------------------------------------ */
  /*
   * Deux petites pièces, une case chacune, à coller au bâtiment d'élevage.
   *
   * Elles ne sont **jamais obligatoires** : un troupeau nourri et logé dans la
   * capacité de son étable tourne à 100 % sans elles. C'est la règle qui rend
   * l'élevage jouable — on ne punit pas qui n'a pas construit. Elles font
   * monter le niveau d'installation (`installationLevel()`), et le niveau
   * donne des bonus au-dessus de 100 %.
   *
   * L'abreuvoir a une seconde vertu, qu'aucun autre bâtiment n'a : branché sur
   * le réseau, il tient la jauge d'eau pleine même quand le joueur ne se
   * connecte pas de la journée. C'est de l'assurance autant que du rendement.
   */
  WATER_TROUGH: {
    type: "WATER_TROUGH",
    article: "un",
    name: "Abreuvoir automatique",
    w: 1,
    h: 1,
    // Prix réel : bac inox à niveau constant, sur arrivée d'eau enterrée et
    // tranchée. Le plancher du catalogue est à mille euros — rien ici ne doit
    // être un achat d'impulsion — et la pose de la conduite le justifie.
    cost: 1200,
    description:
      "Collé à un bâtiment d’élevage : les bêtes ne manquent jamais d’eau, même en votre absence.",
  },
  HAY_RACK: {
    type: "HAY_RACK",
    article: "un",
    name: "Râtelier à fourrage",
    w: 1,
    h: 1,
    // Prix réel : râtelier acier à cornadis, pour une vingtaine de bêtes.
    // La pièce la moins chère du catalogue, et c'est voulu : c'est le premier
    // pas d'un éleveur qui commence à investir.
    cost: 1050,
    description:
      "Collé à un bâtiment d’élevage : moins de foin piétiné, plus de foin mangé.",
  },

  BUNKER_SILO: {
    type: "BUNKER_SILO",
    name: "Silo couloir",
    w: 3,
    h: 2,
    // Prix réel : silo couloir en béton.
    cost: 5000,
    description: "Tasse l’ensilage et la paille. Sans lui, le fourrage d’hiver n’a pas de place.",
    storageHay: 50,
  },

  /* ------------------------------------------------------------------ */
  /* Petits ouvrages                                                     */
  /* ------------------------------------------------------------------ */
  /*
   * Au-delà de quatre ou cinq bâtiments, construire cessait d'être une
   * décision pour devenir une liste de courses : chacun débloquait une
   * capacité, on les posait tous dans le même ordre. Ces trois-là ne
   * débloquent rien. Ils branchent un système existant sur un autre, pour un
   * coût modeste, et il faut calculer s'ils se rentabilisent.
   *
   * Trois règles qu'ils respectent :
   *  - aucun n'est obligatoire, une ferme sans eux reste viable ;
   *  - leur effet se lit dans le Bureau, poste par poste, donc se vérifie ;
   *  - la ruche a une portée, donc un emplacement — le seul bâtiment du jeu
   *    où *où* l'on pose compte.
   */
  /*
   * Les deux producteurs de courant.
   *
   * Ils remisaient « graissage, nettoyage et révision » — un lien inventé :
   * produire de l'électricité ne rend pas la graisse moins chère. Le testeur
   * l'a dit sans détour, et il a raison.
   *
   * Le séchoir, lui, tourne bel et bien au courant. C'est même la seule
   * dépense électrique de la ferme : le reste brûle du gazole. Les deux
   * ouvrages allègent donc le séchage, chacun à sa mesure — le soleil ne
   * donne rien la nuit, le vent souffle aussi à trois heures du matin.
   *
   * La remise d'entretien n'a pas disparu : elle est passée à l'atelier, qui
   * est l'endroit où l'on entretient.
   */
  SOLAR_PANELS: {
    type: "SOLAR_PANELS",
    name: "Panneaux solaires",
    w: 2,
    h: 2,
    // Prix réel : 36 kWc en toiture.
    cost: 7500,
    description:
      "Alimentent le séchoir du silo en journée : le séchage du grain coûte moitié moins.",
    dryingDiscount: 0.5,
  },
  WIND_TURBINE: {
    type: "WIND_TURBINE",
    name: "Éolienne",
    w: 1,
    h: 1,
    // Prix réel : petit aérogénérateur de ferme.
    cost: 13000,
    description:
      "Alimente le séchoir du silo jour et nuit : le séchage du grain ne coûte plus rien.",
    freeDrying: true,
  },
  BEEHIVE: {
    type: "BEEHIVE",
    name: "Ruches",
    w: 1,
    h: 1,
    // Prix réel : dix ruches équipées.
    cost: 1300,
    description:
      "Pollinise colza et pois dans un rayon de quatre cases : +8 % de rendement. Placez-les au bon endroit.",
    pollinationRange: 4,
    pollinationBonus: 0.08,
  },
  /*
   * Les deux ateliers de transformation.
   *
   * Deux, pas dix. Une chaîne de production complète transformerait la ferme
   * en usine à clics, alors que deux suffisent à poser la question :
   * transformer, ou vendre brut au cours du jour.
   */
  DAIRY: {
    type: "DAIRY",
    article: "une",
    name: "Laiterie",
    w: 2,
    h: 2,
    // Prix réel : atelier de transformation laitière.
    cost: 28000,
    description:
      "Transforme le lait en fromage, cent hectolitres pour une tonne. Le fromage ne s'abîme pas, lui — et elle travaille pendant que vous êtes ailleurs.",
    processing: "DAIRY",
  },
  MILL: {
    type: "MILL",
    name: "Moulin",
    w: 2,
    h: 2,
    // Prix réel : moulin à farine de ferme.
    cost: 13000,
    description:
      "Moud le blé en farine, quatre tonnes pour trois. Un bon tiers de valeur en plus, si le cours suit.",
    processing: "MILL",
  },
};

/* ------------------------------------------------------------------ */
/* Niveaux de bâtiment                                                 */
/* ------------------------------------------------------------------ */

/** Un engin, réduit à ce qu'il faut pour juger s'il peut travailler. */
export type MachineForWork = {
  type: MachineType;
  tier?: number;
  condition: number;
  greased?: boolean;
  grease?: number;
  dirt?: number;
  greaseSkipStreak?: number;
  breakdown?: string | null;
  /**
   * Fin du dernier chantier en cours : l'engin est au champ jusque-là.
   *
   * Facultatif, et absent vaut « libre » : les écrans qui ne jugent que du
   * matériel possédé — la fiche d'un engin, le catalogue du garage — n'ont pas
   * à connaître les chantiers pour dire si un semoir est en état.
   */
  busyUntil?: string | Date | null;
};

/** Une attente lisible : « 40 s », « 3 min ». Zéro ou passé donne « 0 s ». */
export function delaiEnClair(ms: number): string {
  const secondes = Math.max(0, Math.ceil(ms / 1000));
  return secondes < 90 ? `${secondes} s` : `${Math.ceil(secondes / 60)} min`;
}

/** Jusqu'à quand cet engin est pris, ou `null` s'il est libre maintenant. */
function occupeJusqua(m: MachineForWork, maintenant: number): number | null {
  if (!m.busyUntil) return null;
  const fin = m.busyUntil instanceof Date ? m.busyUntil.getTime() : Date.parse(m.busyUntil);
  return Number.isFinite(fin) && fin > maintenant ? fin : null;
}

function careDe(m: MachineForWork): MachineCareState {
  const grease = m.grease ?? (m.greased === false ? 0 : GREASE_FULL);
  return {
    condition: m.condition,
    grease,
    greased: grease > 0,
    dirt: m.dirt ?? 0,
    greaseSkipStreak: m.greaseSkipStreak ?? 0,
    breakdown: (["BELT", "HYDRAULIC", "ENGINE"] as const).includes(
      m.breakdown as never,
    )
      ? (m.breakdown as BreakdownKind)
      : null,
  };
}

/**
 * Pourquoi ce travail ne peut pas se faire, ou `null` s'il le peut.
 *
 * Quatre causes, et le joueur doit savoir laquelle : il n'a pas l'outil, il ne
 * l'a pas en état, l'engin est déjà au champ, ou aucun tracteur assez puissant
 * ne peut le tirer. Un message unique le laisserait acheter le mauvais engin —
 * ou attendre là où il faut acheter.
 *
 * Vivait côté serveur, donc l'écran ne pouvait rien en dire : un débutant, dont
 * le parc n'a que tracteur, semoir et charrue, pouvait cliquer Récolte, Faucher,
 * Engrais, Presser, Ramasser, Ensiler et Déchaumer — sept outils sur dix qui ne
 * pouvaient que refuser. Ici, les deux côtés donnent la même phrase, et l'écran
 * la donne avant le clic.
 *
 * ## L'engin au champ
 *
 * Un même attelage a pu, un temps, mener deux chantiers de front : le filtre
 * sur `busyUntil` avait été retiré parce qu'il refusait sans un mot — un joueur
 * qui achetait une seconde parcelle ne pouvait pas la travailler, et rien ne le
 * lui disait. Signalé en jouant : « tu peux lancer deux choses qui nécessitent
 * le tracteur alors que t'as qu'un seul tracteur, c'est pas censé être
 * possible ».
 *
 * La contrainte revient donc, mais le silence ne revient pas : le refus nomme
 * l'engin, dit dans combien de temps il rentre, et dit qu'il en faut un second.
 * C'était le vrai défaut de l'époque — la règle, elle, était juste.
 */
export function explainNoMachine(
  machines: MachineForWork[],
  work: FarmWork,
  maintenant: number = Date.now(),
): string | null {
  const outils = (Object.keys(MACHINE_DEFS) as MachineType[]).filter((t) =>
    MACHINE_DEFS[t].works.includes(work as never),
  );
  if (!outils.length) return null;
  const possedes = machines.filter((m) => outils.includes(m.type));
  if (!possedes.length) {
    const noms = outils.map((t) => machineWithArticle(t)).join(" ou ");
    return `Il faut ${noms} pour ce travail — passez au garage.`;
  }
  const enEtat = possedes.filter(
    (m) => !machineWorkBlock(careDe(m), MACHINE_DEFS[m.type].minCondition),
  );
  if (!enEtat.length) {
    const m = possedes[0]!;
    const def = MACHINE_DEFS[m.type];
    const block = machineWorkBlock(careDe(m), def.minCondition)!;
    return `${def.name} : ${block.message}`;
  }
  const libres = enEtat.filter((m) => occupeJusqua(m, maintenant) === null);
  if (!libres.length) {
    const rentre = Math.min(...enEtat.map((m) => occupeJusqua(m, maintenant)!));
    const def = MACHINE_DEFS[enEtat[0]!.type];
    return `${def.name} au champ — de retour dans ${delaiEnClair(rentre - maintenant)}. Il en faut un second pour mener deux chantiers de front.`;
  }
  // L'outil est là, en état et libre : il manque donc de quoi le tirer.
  const outil = libres[0]!;
  const def = MACHINE_DEFS[outil.type];
  if (def.kind === "IMPLEMENT") {
    const ch = machineRequiredHp(def.type, asTier(outil.tier ?? 1));
    const tracteurs = machines.filter((m) => MACHINE_DEFS[m.type]?.kind === "TRACTOR");
    const attelables = tracteurs.filter(
      (m) =>
        !machineWorkBlock(careDe(m), MACHINE_DEFS[m.type].minCondition) &&
        occupeJusqua(m, maintenant) === null,
    );
    const meilleur = attelables.reduce(
      (max, m) => Math.max(max, machinePower(m.type, asTier(m.tier ?? 1))),
      0,
    );
    if (meilleur >= ch) return null;
    // Aucun tracteur libre ne suffit. Reste à dire pourquoi : il n'y en a pas,
    // ils sont tous au champ, ou le seul disponible manque de puissance.
    const auChamp = tracteurs
      .map((m) => occupeJusqua(m, maintenant))
      .filter((fin): fin is number => fin !== null);
    if (!attelables.length && auChamp.length) {
      const rentre = Math.min(...auChamp);
      return `${def.name} est prêt, mais votre tracteur est au champ — de retour dans ${delaiEnClair(rentre - maintenant)}. Il en faut un second pour tirer deux outils à la fois.`;
    }
    if (meilleur === 0) {
      return `${def.name} prêt, mais aucun tracteur pour le tirer (${ch} ch nécessaires).`;
    }
    return `${def.name} demande ${ch} ch — votre meilleur tracteur en donne ${meilleur}.`;
  }
  return null;
}

/** Le nom d'un engin précédé de son article : « une moissonneuse ». */
export function machineWithArticle(type: MachineType): string {
  const def = MACHINE_DEFS[type];
  return `${def.article ?? "un"} ${def.name.toLowerCase()}`;
}

/**
 * Les abris qui hébergent des bêtes, et les aires de sortie qui vont avec.
 *
 * Tout est dérivé de `kindForBarn` et `yardTypeForBarn` : une liste tenue à la
 * main finirait par mentir le jour où l'on ajoute une espèce, et c'est
 * exactement le genre d'oubli qui se manifeste par un bâtiment qu'on paie et
 * qui ne sert à rien.
 */
export const SHELTER_BUILDINGS = (Object.keys(BUILDING_DEFS) as BuildingType[]).filter(
  (t) => kindForBarn(t) !== null,
);

/** Le nom d'un bâtiment précédé de son article : « une porcherie ». */
export function buildingWithArticle(type: BuildingType): string {
  const def = BUILDING_DEFS[type];
  return `${def.article ?? "un"} ${def.name.toLowerCase()}`;
}

/**
 * Les annexes d'élevage : elles se collent à n'importe quel abri.
 *
 * À la différence des aires de sortie, elles ne sont pas liées à une espèce —
 * une vache, un porc et une brebis boivent la même eau. Elles suivent en
 * revanche exactement la même règle de pose, et pour la même raison : une
 * annexe posée à l'autre bout de la ferme serait payée et n'apparaîtrait sur
 * aucun écran.
 */
export const LIVESTOCK_ANNEXES: BuildingType[] = ["WATER_TROUGH", "HAY_RACK"];

/**
 * Prés, courettes et annexes : les bâtiments qui ne valent que collés à un abri.
 *
 * Les deux annexes d'élevage y entrent au même titre que les aires de sortie.
 * Elles n'auraient rien fait posées seules, et le contrôle de pose qui refuse
 * une courette égarée devait donc les couvrir aussi — sans quoi on aurait
 * reproduit, pour l'abreuvoir, le bâtiment payé et muet.
 */
export const YARD_BUILDINGS = [
  ...new Set([
    ...SHELTER_BUILDINGS.map((t) => yardTypeForBarn(t) as BuildingType),
    ...LIVESTOCK_ANNEXES,
  ]),
];

/** Cette annexe compte-t-elle comme abreuvoir automatique ? */
export function isTrough(type: string): boolean {
  return type === "WATER_TROUGH";
}

/** Cette annexe compte-t-elle comme râtelier ? */
export function isHayRack(type: string): boolean {
  return type === "HAY_RACK";
}

/**
 * Les abris auxquels une aire de sortie — ou une annexe — peut se coller.
 *
 * Sert d'abord à le **dire** : une courette posée loin de toute porcherie
 * était acceptée sans un mot, débitée, et n'apparaissait ensuite sur aucun
 * écran. Le joueur avait payé pour un bâtiment invisible.
 */
export function barnsForYard(yard: BuildingType): BuildingType[] {
  if (LIVESTOCK_ANNEXES.includes(yard)) return SHELTER_BUILDINGS;
  return SHELTER_BUILDINGS.filter((t) => yardTypeForBarn(t) === yard);
}

/**
 * Les bâtiments qui transforment.
 *
 * Dérivé de `BUILDING_DEFS`, jamais recopié : une liste tenue à la main à côté
 * des définitions finit toujours par en diverger, et c'est le genre d'oubli
 * qui se manifeste par un atelier qui ne produit rien sans dire pourquoi.
 */
export const PROCESSING_BUILDINGS = (Object.keys(BUILDING_DEFS) as BuildingType[]).filter(
  (t) => BUILDING_DEFS[t].processing,
);

export const MAX_BUILDING_LEVEL = 5;

export type BuildingLevelDef = {
  level: number;
  name: string;
  /** Coût de passage depuis le niveau précédent, en fraction du coût de base */
  upgradeCostMult: number;
  /** Multiplicateur appliqué à toutes les capacités et bonus du bâtiment */
  capacityMult: number;
  /** Niveau de joueur requis */
  requiredLevel: number;
};

/**
 * Cinq paliers pour chaque bâtiment. Le coût grimpe plus vite que la
 * capacité : agrandir un bâtiment existant reste rentable, mais jamais
 * gratuit, et le dernier palier se mérite.
 * `[GD]`
 */
export const BUILDING_LEVELS: BuildingLevelDef[] = [
  { level: 1, name: "Rudimentaire", upgradeCostMult: 0, capacityMult: 1, requiredLevel: 1 },
  // Le premier agrandissement est ouvert dès l'arrivée : c'est le geste qui
  // apprend au joueur que ses bâtiments évoluent.
  { level: 2, name: "Consolidé", upgradeCostMult: 0.8, capacityMult: 1.6, requiredLevel: 1 },
  { level: 3, name: "Agrandi", upgradeCostMult: 1.5, capacityMult: 2.4, requiredLevel: 3 },
  { level: 4, name: "Mécanisé", upgradeCostMult: 2.6, capacityMult: 3.4, requiredLevel: 6 },
  { level: 5, name: "Industriel", upgradeCostMult: 4.2, capacityMult: 4.6, requiredLevel: 10 },
];

export function buildingLevelDef(level: number): BuildingLevelDef {
  const clamped = Math.max(1, Math.min(MAX_BUILDING_LEVEL, Math.round(level)));
  return BUILDING_LEVELS[clamped - 1];
}

/** Coût en € pour passer un bâtiment au niveau suivant. */
export function buildingUpgradeCost(type: BuildingType, currentLevel: number): number | null {
  if (currentLevel >= MAX_BUILDING_LEVEL) return null;
  const next = buildingLevelDef(currentLevel + 1);
  return Math.round(BUILDING_DEFS[type].cost * next.upgradeCostMult);
}

/**
 * Débit d'un atelier à un niveau donné, en unités d'entrée par jour.
 *
 * Le palier passe par `capacityMult`, l'échelle commune à toutes les capacités
 * du jeu — un silo, une étable et une laiterie grandissent du même pas. Un
 * atelier avec sa propre échelle de paliers aurait fini par diverger de la
 * grille de coûts qui, elle, n'en a qu'une.
 */
export function processingThroughput(type: BuildingType, level: number): number {
  const kind = BUILDING_DEFS[type].processing;
  if (!kind) return 0;
  const mult = buildingLevelDef(level).capacityMult;
  return Math.round(RECIPES[kind].inputPerDay * mult * 100) / 100;
}

/** Capacités et bonus d'un bâtiment à un niveau donné. */
export function buildingStatsAtLevel(type: BuildingType, level: number) {
  const def = BUILDING_DEFS[type];
  const mult = buildingLevelDef(level).capacityMult;
  const scale = (v: number | undefined) => (v === undefined ? undefined : v * mult);
  return {
    storageGrain: scale(def.storageGrain),
    storageHay: scale(def.storageHay),
    machineSlots: def.machineSlots === undefined ? undefined : Math.round(def.machineSlots * mult),
    cattleSlots: def.cattleSlots === undefined ? undefined : Math.round(def.cattleSlots * mult),
    pigSlots: def.pigSlots === undefined ? undefined : Math.round(def.pigSlots * mult),
    henSlots: def.henSlots === undefined ? undefined : Math.round(def.henSlots * mult),
    sheepSlots: def.sheepSlots === undefined ? undefined : Math.round(def.sheepSlots * mult),
    yieldBonus: scale(def.yieldBonus),
    repairDiscount: scale(def.repairDiscount),
    xpBonus: scale(def.xpBonus),
    softDryer: def.softDryer,
    spoilageSlow: scale(def.spoilageSlow),
  };
}

/** Illustration isométrique du bâtiment, pour l'UI. */
export const BUILDING_ART: Record<BuildingType, string> = {
  SILO: "/assets/buildings/silo.webp",
  HAY_BARN: "/assets/buildings/hay-barn.webp",
  MACHINE_SHED: "/assets/buildings/machine-shed.webp",
  CATTLE_BARN: "/assets/buildings/cattle-barn.webp",
  PIGSTY: "/assets/buildings/pigsty.webp",
  HENHOUSE: "/assets/buildings/pigsty.webp",
  SHEEPFOLD: "/assets/buildings/cattle-barn.webp",
  WORKSHOP: "/assets/buildings/workshop.webp",
  FARMHOUSE: "/assets/buildings/farmhouse.webp",
  PADDOCK: "/assets/buildings/paddock.webp",
  PIG_YARD: "/assets/buildings/pig-yard.webp",
  HEN_YARD: "/assets/buildings/pig-yard.webp",
  COLD_ROOM: "/assets/buildings/workshop.webp",
  BUNKER_SILO: "/assets/buildings/hay-barn.webp",
  // Les trois petits ouvrages sont dessinés, pas photographiés : ils n'ont pas
  // d'illustration isométrique, et un rendu vectoriel se lit mieux à leur
  // taille — une ruche fait une case.
  SOLAR_PANELS: "/assets/buildings/solar-panels.svg",
  WIND_TURBINE: "/assets/buildings/wind-turbine.svg",
  BEEHIVE: "/assets/buildings/beehive.svg",
  DAIRY: "/assets/buildings/dairy.svg",
  MILL: "/assets/buildings/mill.svg",
  EMPLOYEE_HOUSING: "/assets/buildings/employee-housing.svg",
  // Même raison pour les deux annexes d'élevage : une case au sol, un dessin.
  WATER_TROUGH: "/assets/buildings/water-trough.svg",
  HAY_RACK: "/assets/buildings/hay-rack.svg",
};

export const DEFAULT_GRID = { w: 12, h: 12 } as const;

/** Narratif : 12×12 ≈ 12–15 ha `[GD]` — voir `23_GRID_SIZING.md` */
export const PARCEL_HECTARES = 14;

/**
 * Le compteur horaire, et ce qu'il remplace `[GD]`.
 *
 * L'usure se comptait en cases travaillées. Deux choses clochaient, et la
 * seconde abîmait l'économie entière.
 *
 * La case n'est pas une unité que le joueur ressent : il travaille des champs,
 * et il pense en saisons. Surtout, le barème donnait une révision complète de
 * tracteur — 600 € — tous les cinq champs, pour un engin qui en coûte 2 800.
 * Sur sa vie, la machine se payait plusieurs fois en réparations. Aucun bien
 * d'équipement ne fonctionne comme ça, et un joueur l'a dit dans ces termes :
 * « un tracteur ça meurt pas en 2 jours ».
 *
 * L'usure se compte donc désormais en **heures de travail**, comme sur un
 * vrai compteur horaire. Deux quantités distinctes, toutes deux honnêtes :
 *
 *   `hours`      monotone, ne recule jamais, pas même après une révision.
 *                C'est l'âge de l'engin, et c'est lui qui fixe sa cote.
 *   `condition`  l'usure depuis la dernière remise en état, que l'atelier
 *                répare.
 *
 * C'est exactement la distinction du matériel réel : un tracteur de 2 000 h
 * révisé à neuf roule comme un neuf, mais ne se revend pas comme un neuf.
 */

/** Surface d'une case, en hectares — 12×12 cases pour 14 ha. */
export const HECTARES_PER_CELL = PARCEL_HECTARES / (DEFAULT_GRID.w * DEFAULT_GRID.h);

/**
 * Heures au compteur pour un chantier `[GD]`.
 *
 * Un champ entier de 14 ha demande deux à cinq heures selon l'engin : ce sont
 * des ordres de grandeur agricoles réels, et c'est ce qui rend le compteur
 * lisible — « 47 h » veut dire quelque chose.
 */
export function jobHours(hoursPerHectare: number, cells: number): number {
  return Math.round(hoursPerHectare * Math.max(0, cells) * HECTARES_PER_CELL * 100) / 100;
}

/** Points de condition perdus par heure de travail, au soin neutre. */
export function conditionPerHour(lifeHours: number): number {
  return lifeHours > 0 ? 100 / lifeHours : 0;
}


export type MachineType =
  | "TRACTOR"
  | "HARVESTER"
  | "FORAGE_HARVESTER"
  | "PLOUGH"
  | "SEEDER"
  | "SPREADER"
  | "DISC_HARROW"
  | "MOWER"
  | "SPRAYER"
  | "BALER"
  | "TRAILER";

/**
 * Porteur, outil, automoteur `[GD]`.
 *
 * C'est la structure qui définit le genre, et elle manquait : un seul
 * « Tracteur T1 » semait, labourait, fertilisait, fauchait et ramassait les
 * bottes. Acheter un tracteur débloquait cinq travaux d'un coup, et il ne
 * restait ensuite plus rien à convoiter — la documentation du projet le dit
 * pourtant elle-même, *le matériel est la vraie progression, pas un niveau
 * RPG*.
 *
 * Un tracteur n'est désormais que de la **puissance**. C'est l'outil attelé
 * qui fait le travail, et il faut assez de chevaux pour le tirer. La
 * moissonneuse et l'ensileuse restent des automoteurs : elles se suffisent.
 */
export type MachineKind = "TRACTOR" | "IMPLEMENT" | "SELF_PROPELLED";

/**
 * Rendement de chantier `[RÉEL]`.
 *
 * Aucun engin ne travaille à sa largeur théorique : demi-tours en bout de
 * champ, recouvrements, remplissages. Quatre-vingts pour cent est l'ordre de
 * grandeur retenu partout en machinisme agricole.
 */
export const FIELD_EFFICIENCY = 0.8;

/**
 * Heures par hectare, déduites de la largeur et de la vitesse `[RÉEL]`.
 *
 * C'est la formule du machinisme, pas une invention : un outil de `l` mètres
 * avançant à `v` km/h couvre `l × v / 10` hectares à l'heure, dont on ne garde
 * que le rendement de chantier.
 *
 * Elle remplace un `hoursPerHectare` écrit à la main pour chaque engin. Ce
 * n'est pas qu'une question d'élégance : c'est ce qui donne un sens aux
 * paliers. Un outil plus large ne récolte pas *mieux*, il récolte plus
 * **vite** — et le temps gagné est ce qui permet de rattraper la fenêtre de
 * récolte.
 */
export function hoursPerHectare(widthM: number, speedKmh: number): number {
  const haParHeure = (Math.max(0.1, widthM) * Math.max(1, speedKmh) * FIELD_EFFICIENCY) / 10;
  return Math.round((1 / haParHeure) * 1000) / 1000;
}

export type Tier = MachineTier;
export const TIER_SCALE: Record<Tier, { width: number; power: number; cost: number; life: number }> = {
  1: { width: 1, power: 1, cost: 1, life: 1 },
  2: { width: 1.6, power: 1.45, cost: 2.3, life: 1.25 },
  3: { width: 2.4, power: 2, cost: 4.5, life: 1.5 },
  4: { width: 3.2, power: 2.8, cost: 7.2, life: 1.7 },
  5: { width: 4.2, power: 4.5, cost: 12, life: 2 },
};

export type MachineDef = {
  type: MachineType;
  kind: MachineKind;
  name: string;
  /** Article indéfini du nom : « une moissonneuse ». Vaut « un » par défaut. */
  article?: "un" | "une";
  /** Prix du palier 1 ; les suivants en dérivent. */
  cost: number;
  /** Chevaux disponibles (porteur, automoteur) au palier 1 */
  powerHp?: number;
  /** Chevaux nécessaires pour le tirer (outil) au palier 1 */
  requiredHp?: number;
  /** Largeur de travail en mètres, palier 1 */
  widthM: number;
  /** Vitesse de travail en km/h — propre à l'engin, elle ne change pas avec le palier */
  speedKmh: number;
  /** Heures de travail pour user 100 points de condition, au soin neutre */
  lifeHours: number;
  /** Coût € pour +1 point de condition */
  repairCostPerPoint: number;
  minCondition: number;
  description: string;
  works: Array<
    | "PLANT"
    | "FERTILIZE"
    | "HARVEST"
    | "PLOW"
    | "STUBBLE"
    | "MOW"
    | "BALE"
    | "COLLECT"
    | "SILAGE"
    | "WEED"
  >;
  /** Teinte iso HUD (réf. IsoFarmView) */
  isoColor: "green" | "red-gold" | "amber";
};

/**
 * Part de la valeur d'un engin que coûte une remise à neuf complète.
 *
 * Vingt-deux pour cent : c'est, à la main, ce que valaient déjà les onze
 * `repairCostPerPoint` écrits en dur — de 17 % pour la presse à 29 % pour la
 * charrue, moyenne 22,5. Le rapport était juste ; c'est le prix des engins qui
 * ne l'était pas, et les réparations sont restées sur l'ancienne échelle
 * pendant que le matériel passait à la vraie. Résultat mesuré : l'atelier, qui
 * se rembourse en économies d'entretien, demandait deux mille cinq cents
 * révisions au lieu de deux cents.
 *
 * Dérivé du prix, il ne peut plus décrocher.
 */
export const PART_REVISION_COMPLETE = 0.22;

/** Coût d'un point de condition, pour un engin de ce prix. */
export function reparationParPoint(prix: number): number {
  return Math.round(((prix * PART_REVISION_COMPLETE) / 100) * 10) / 10;
}

/**
 * Le prix de chaque engin, en euros, au premier palier.
 *
 * Écrit ici et nulle part ailleurs : la table des engins le lit pour son
 * `cost` **et** pour en dériver le coût de réparation. Recopié aux deux
 * endroits, il aurait fini par différer — c'est exactement ce qui était arrivé
 * entre le prix des machines et celui de leurs révisions.
 *
 * ## L'ancre : les fourchettes du neuf, adaptées au jeu
 *
 * Le palier 1 est un petit engin **neuf de petite exploitation** (tracteur
 * ~105 ch à 72 000 €, pas un utilitaire d'occasion à 14 000). Les paliers
 * suivants collent aux tarifs concessionnaire, un cran en dessous. Un T5
 * coûte ce qu'il coûte dans le vrai monde — assez pour que l'acheter soit
 * une décision, pas un clic.
 *
 * Les rapports entre engins restent ceux du marché : une moissonneuse vaut
 * plus de deux tracteurs T1 ; une charrue, une fraction du porteur.
 */
export const PRIX_ENGINS: Record<MachineType, number> = {
  TRACTOR: 72000,
  HARVESTER: 200000,
  FORAGE_HARVESTER: 220000,
  PLOUGH: 22000,
  SEEDER: 25000,
  SPREADER: 12000,
  DISC_HARROW: 22000,
  MOWER: 16000,
  BALER: 40000,
  SPRAYER: 28000,
  TRAILER: 18000,
};

export const MACHINE_DEFS: Record<MachineType, MachineDef> = {
  TRACTOR: {
    type: "TRACTOR",
    kind: "TRACTOR",
    name: "Tracteur",
    // Palier 1 : utilitaire ~105 ch, petite exploitation.
    cost: PRIX_ENGINS.TRACTOR,
    powerHp: 105,
    // Un tracteur seul ne travaille pas : il tire. Sa largeur est celle de
    // l'outil qu'il porte, d'où zéro ici et aucun travail à son nom.
    widthM: 0,
    speedKmh: 10,
    lifeHours: 700,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.TRACTOR),
    minCondition: 15,
    description: "Ne travaille pas seul : il tire les outils. Sa puissance décide de ce qu’il peut atteler.",
    works: [],
    isoColor: "green",
  },
  HARVESTER: {
    type: "HARVESTER",
    article: "une",
    kind: "SELF_PROPELLED",
    name: "Moissonneuse",
    // Prix réel : moissonneuse-batteuse d'occasion, coupe de 4,5 m.
    cost: PRIX_ENGINS.HARVESTER,
    powerHp: 175,
    widthM: 4.5,
    speedKmh: 6,
    lifeHours: 480,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.HARVESTER),
    minCondition: 15,
    description: "Automoteur : récolte les céréales sans tracteur.",
    works: ["HARVEST"],
    isoColor: "red-gold",
  },
  FORAGE_HARVESTER: {
    type: "FORAGE_HARVESTER",
    article: "une",
    kind: "SELF_PROPELLED",
    name: "Ensileuse",
    // Prix réel : ensileuse automotrice d'occasion.
    cost: PRIX_ENGINS.FORAGE_HARVESTER,
    powerHp: 400,
    widthM: 3,
    speedKmh: 8,
    lifeHours: 450,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.FORAGE_HARVESTER),
    minCondition: 15,
    description: "Automoteur : récolte le maïs plante entière, plus tôt, plus de tonnage.",
    works: ["SILAGE"],
    isoColor: "red-gold",
  },
  PLOUGH: {
    type: "PLOUGH",
    article: "une",
    kind: "IMPLEMENT",
    // Le travail le plus lent du parc, et c'est exact : une charrue est étroite
    // et tire lourd. C'est ce qui fait de son palier l'achat qui se sent le plus.
    name: "Charrue",
    // Prix réel : charrue 4 corps.
    cost: PRIX_ENGINS.PLOUGH,
    requiredHp: 85,
    widthM: 2,
    speedKmh: 8,
    lifeHours: 850,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.PLOUGH),
    minCondition: 15,
    description: "Retourne la terre en profondeur : remet le sol à neuf, efface les résidus.",
    works: ["PLOW"],
    isoColor: "amber",
  },
  SEEDER: {
    type: "SEEDER",
    kind: "IMPLEMENT",
    name: "Semoir",
    // Prix réel : semoir en ligne de 3 m.
    cost: PRIX_ENGINS.SEEDER,
    requiredHp: 70,
    widthM: 3,
    speedKmh: 10,
    lifeHours: 800,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.SEEDER),
    minCondition: 15,
    description: "Met la graine en terre. Sans lui, le tracteur ne sème rien.",
    works: ["PLANT"],
    isoColor: "amber",
  },
  SPREADER: {
    type: "SPREADER",
    kind: "IMPLEMENT",
    name: "Épandeur",
    // Prix réel : épandeur à engrais porté.
    cost: PRIX_ENGINS.SPREADER,
    requiredHp: 50,
    // Douze mètres de nappe au T1 : l'engrais reste un passage rapide.
    widthM: 12,
    speedKmh: 12,
    lifeHours: 800,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.SPREADER),
    minCondition: 15,
    description: "Épand l’engrais et le fumier sur une large nappe.",
    works: ["FERTILIZE"],
    isoColor: "amber",
  },
  DISC_HARROW: {
    type: "DISC_HARROW",
    kind: "IMPLEMENT",
    name: "Déchaumeur à disques",
    // Prix réel : déchaumeur à disques de 3 m.
    cost: PRIX_ENGINS.DISC_HARROW,
    requiredHp: 80,
    widthM: 3,
    speedKmh: 11,
    lifeHours: 900,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.DISC_HARROW),
    minCondition: 15,
    description:
      "Incorpore les résidus après moisson : bonus de rendement, sans remettre le sol à zéro.",
    works: ["STUBBLE"],
    isoColor: "amber",
  },
  MOWER: {
    type: "MOWER",
    article: "une",
    kind: "IMPLEMENT",
    name: "Faucheuse",
    // Prix réel : faucheuse à disques portée.
    cost: PRIX_ENGINS.MOWER,
    requiredHp: 60,
    widthM: 3.1,
    speedKmh: 12,
    lifeHours: 800,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.MOWER),
    minCondition: 15,
    description: "Fauche l’herbe et la met en andain.",
    works: ["MOW"],
    isoColor: "amber",
  },
  BALER: {
    type: "BALER",
    article: "une",
    kind: "IMPLEMENT",
    name: "Presse à balles",
    // Prix réel : presse à balles rondes.
    cost: PRIX_ENGINS.BALER,
    requiredHp: 70,
    widthM: 2.1,
    speedKmh: 9,
    lifeHours: 750,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.BALER),
    minCondition: 15,
    description: "Presse l’andain en bottes. Sans elle, la paille reste au champ.",
    works: ["BALE"],
    isoColor: "amber",
  },
  SPRAYER: {
    type: "SPRAYER",
    kind: "IMPLEMENT",
    name: "Pulvérisateur",
    // Prix réel : pulvérisateur porté de 1 000 L.
    cost: PRIX_ENGINS.SPRAYER,
    requiredHp: 70,
    // Une rampe de quinze mètres : le désherbage reste un passage rapide.
    widthM: 15,
    speedKmh: 12,
    lifeHours: 850,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.SPRAYER),
    minCondition: 15,
    description: "Désherbe la culture en place. Rapide, mais la chimie se paie.",
    works: ["WEED"],
    isoColor: "amber",
  },
  TRAILER: {
    type: "TRAILER",
    article: "une",
    kind: "IMPLEMENT",
    name: "Remorque",
    // Prix réel : remorque agricole de 10 t.
    cost: PRIX_ENGINS.TRAILER,
    requiredHp: 60,
    widthM: 2.5,
    speedKmh: 14,
    lifeHours: 1100,
    repairCostPerPoint: reparationParPoint(PRIX_ENGINS.TRAILER),
    minCondition: 10,
    description: "Ramasse les bottes au champ et les rentre.",
    works: ["COLLECT"],
    isoColor: "amber",
  },
};

/* ------------------------------------------------------------------ */
/* Ce qu'un engin vaut à son palier                                    */
/* ------------------------------------------------------------------ */

/** Largeur de travail effective, palier compris. */
export function machineWidth(type: MachineType, tier: Tier = 1): number {
  return machineVariant(type, tier).widthM;
}

/** Chevaux disponibles, palier compris. `0` pour un outil. */
export function machinePower(type: MachineType, tier: Tier = 1): number {
  return machineVariant(type, tier).powerHp ?? 0;
}

/** Chevaux exigés pour tirer cet outil, palier compris. `0` pour un porteur. */
export function machineRequiredHp(type: MachineType, tier: Tier = 1): number {
  return machineVariant(type, tier).requiredHp ?? 0;
}

/** Prix catalogue au palier demandé. */
export function machineCost(type: MachineType, tier: Tier = 1): number {
  return machineVariant(type, tier).cost;
}

/** Heures entre deux révisions, palier compris — un gros engin dure plus longtemps. */
export function machineLifeHours(type: MachineType, tier: Tier = 1): number {
  return machineVariant(type, tier).lifeHours;
}

/** Coût d'un point de condition, au prix de ce palier. */
export function machineRepairPerPoint(type: MachineType, tier: Tier = 1): number {
  return reparationParPoint(machineCost(type, tier));
}

/** Heures par hectare de cet engin, à ce palier. */
export function machineHoursPerHectare(type: MachineType, tier: Tier = 1): number {
  const def = MACHINE_DEFS[type];
  if (def.kind === "TRACTOR") return 0;
  const fiche = machineVariant(type, tier);
  return hoursPerHectare(fiche.widthM, fiche.speedKmh);
}

/**
 * Durée réelle d'un chantier `[GD]`.
 *
 * Un chantier cessait d'être instantané au moment où les heures sont devenues
 * réelles : un labour de quatorze hectares demande onze heures de tracteur, un
 * épandage une seule. Les faire tenir dans le même clic effaçait précisément
 * ce que la largeur de travail venait d'apporter.
 *
 * L'échelle a **sa propre horloge**, `JOB_MS_PER_GAME_HOUR`, et c'est le seul
 * endroit du jeu où c'est le cas. Elle se déduisait du jour de jeu ; le jour
 * est passé de quinze minutes à six heures pour que l'année tombe sur la
 * semaine réelle, et ce même labour serait devenu une attente de trois heures
 * devant l'écran. On ne fait pas patienter un joueur à l'échelle où poussent
 * les cultures. Aux valeurs qui comptent, inchangées :
 *
 *     épandage d'un champ   1,2 h  →  45 s
 *     semis                 4,4 h  →  2 min 45
 *     moisson               6,9 h  →  4 min 20
 *     labour               10,9 h  →  6 min 50
 *
 * Assez long pour qu'un outil plus large se sente, assez court pour qu'on
 * n'abandonne pas la partie en attendant. Et l'attente n'immobilise que
 * l'attelage : le reste de la ferme continue de tourner.
 */
export const GAME_HOURS_PER_DAY = 24;

export function jobDurationMs(hours: number): number {
  return Math.round(Math.max(0, hours) * JOB_MS_PER_GAME_HOUR);
}

/** Un tracteur peut-il tirer cet outil ? */
export function canPull(
  tractor: { type: MachineType; tier: Tier },
  implement: { type: MachineType; tier: Tier },
): boolean {
  return machinePower(tractor.type, tractor.tier) >= machineRequiredHp(implement.type, implement.tier);
}

export function isTier(v: number): v is Tier {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

/** Palier lu depuis la base, borné : une valeur aberrante ne doit rien casser. */
export function asTier(v: number | null | undefined): Tier {
  return isTier(v ?? 1) ? ((v ?? 1) as Tier) : 1;
}

/** Moitié du chemin vers le neuf : 0 % → 50 %, 40 % → 70 %. */
export function repairHalfwayTarget(condition: number): number {
  const c = Math.max(0, Math.min(100, condition));
  return Math.round((c + (100 - c) / 2) * 100) / 100;
}

export function repairQuote(opts: {
  condition: number;
  repairCostPerPoint: number;
  targetCondition?: number;
  workshopDiscount?: number;
}): { points: number; cost: number; nextCondition: number } {
  const target = Math.min(100, opts.targetCondition ?? 100);
  const points = Math.max(0, Math.round((target - opts.condition) * 100) / 100);
  const discount = Math.min(0.4, Math.max(0, opts.workshopDiscount ?? 0));
  const cost = Math.round(points * opts.repairCostPerPoint * (1 - discount) * 100) / 100;
  return { points, cost, nextCondition: target };
}

/* ------------------------------------------------------------------ */
/* Revente de matériel et de bâtiments                                 */
/* ------------------------------------------------------------------ */

/** Décote de revente d'une machine, avant prise en compte de l'usure `[GD]` */
export const MACHINE_RESALE_RATE = 0.55;

/**
 * Un bâtiment se revend moins bien qu'une machine : on ne déplace pas un
 * silo, on le démolit. Le prix reflète les matériaux récupérés. `[GD]`
 */
export const BUILDING_RESALE_RATE = 0.4;

/**
 * Ce que le concessionnaire retient en plus, pour une reprise immédiate `[GD]`.
 *
 * Il paie moins que la valeur du marché, et c'est la contrepartie du service :
 * l'argent tombe tout de suite, sans attendre qu'un joueur passe. Vendre à la
 * cote demande de la patience ; brader au concessionnaire n'en demande pas.
 */
export const MACHINE_DEALER_RATE = 0.7;

/** Durée d'une annonce d'occasion. Passé ce délai, l'engin revient au vendeur. */
export const MACHINE_LISTING_TTL_MS = 48 * 60 * 60 * 1000;

/** Garde-fou de prix : on ne brade ni ne délire sur la cote. */
export const MACHINE_LISTING_MIN_RATE = 0.25;
export const MACHINE_LISTING_MAX_RATE = 2;

/**
 * Ce que l'âge retire à une machine, indépendamment de son état `[GD]`.
 *
 * Les heures ne se réparent pas. Un tracteur de 1 200 h remis à neuf roule
 * comme un neuf mais ne se revend pas comme un neuf, et c'est ce que cette
 * courbe traduit : elle descend jusqu'à un plancher, jamais jusqu'à zéro.
 * Sans plancher, le matériel d'occasion serait un piège plutôt qu'une bonne
 * affaire.
 */
export function machineAgeFactor(hours: number): number {
  const h = Math.max(0, Math.min(MACHINE_END_OF_LIFE_HOURS, hours));
  const part = h / MACHINE_END_OF_LIFE_HOURS;
  return Math.round((1 - 0.7 * part) * 1000) / 1000;
}

/**
 * Cote d'une machine d'occasion — le prix qu'elle vaut entre joueurs.
 *
 * Deux facteurs qui ne disent pas la même chose : les **heures** sont l'âge,
 * définitif ; la **condition** est l'entretien, réparable. C'est ce qui donne
 * son intérêt au marché de l'occasion — une vieille machine bien tenue vaut
 * mieux qu'une jeune machine ruinée, et le prix le dit.
 *
 * La signature accepte encore un simple nombre pour la condition afin de ne
 * pas casser les appels d'avant le compteur horaire ; sans heures, la machine
 * est traitée comme neuve.
 */
export function machineResaleValue(
  type: MachineType,
  state: number | { condition: number; hours?: number; tier?: number },
): number {
  const condition = typeof state === "number" ? state : state.condition;
  const hours = typeof state === "number" ? 0 : (state.hours ?? 0);
  // Le palier fait le prix d'abord : un tracteur T3 neuf ne se revend pas au
  // prix d'un T1 neuf. On part donc du prix catalogue de son palier.
  const tier = typeof state === "number" ? 1 : asTier(state.tier);
  const etat = Math.max(0, Math.min(100, condition)) / 100;
  /* La condition pèse peu, et c'est voulu — un test l'a imposé.
     À 0,55 de poids, réviser un tracteur coûtait 510 € et en ajoutait 720 à
     sa cote : acheter une épave, la réviser, la revendre était une machine à
     fabriquer de l'argent. Le défaut est antérieur au compteur horaire, mais
     il ne se voyait pas tant que la condition faisait seule le prix.
     Économiquement, c'est aussi le bon sens : un défaut réparable ne devrait
     pas décoter beaucoup, puisque l'acheteur peut le réparer. Ce qui ne se
     rattrape pas — les heures — doit dominer. */
  return Math.round(
    machineCost(type, tier) * MACHINE_RESALE_RATE * machineAgeFactor(hours) * (0.7 + etat * 0.3),
  );
}

/** Ce que le concessionnaire propose, tout de suite et sans négocier. */
export function machineDealerValue(
  type: MachineType,
  state: number | { condition: number; hours?: number; tier?: number },
): number {
  return Math.round(machineResaleValue(type, state) * MACHINE_DEALER_RATE);
}

/**
 * Prix de démolition d'un bâtiment, niveau compris : les agrandissements
 * payés se récupèrent en partie.
 */
export function buildingResaleValue(type: BuildingType, level: number, ageMs?: number): number {
  const base = BUILDING_DEFS[type].cost;
  let invested = base;
  for (let l = 2; l <= Math.max(1, Math.min(MAX_BUILDING_LEVEL, level)); l++) {
    invested += base * BUILDING_LEVELS[l - 1].upgradeCostMult;
  }
  const rate = withinRegret(ageMs) ? 1 : BUILDING_RESALE_RATE;
  return Math.round(invested * rate);
}

/**
 * Fenêtre de regret : un bâtiment tout juste posé se démolit **intégralement
 * remboursé**.
 *
 * Un clic sur la parcelle en mode construction déclenchait la dépense sans
 * confirmation : cinq silos pouvaient partir en cinq clics involontaires, et
 * la seule sortie était la démolition à 55 %, soit près de trois mille € de
 * perte sèche pour une maladresse. La confirmation de pose supprime la cause ;
 * cette fenêtre rattrape ce qui passerait encore au travers.
 */
export const BUILDING_REGRET_MS = 3 * 60 * 1000;

export function withinRegret(ageMs?: number): boolean {
  return ageMs != null && ageMs >= 0 && ageMs < BUILDING_REGRET_MS;
}

/* ------------------------------------------------------------------ */
/* Deux prix : client (faire venir) vs prestataire (mission)           */
/* ------------------------------------------------------------------ */

export type FarmWork =
  | "PLANT"
  | "FERTILIZE"
  | "HARVEST"
  | "PLOW"
  | "STUBBLE"
  | "MOW"
  | "BALE"
  | "COLLECT"
  | "SILAGE"
  | "WEED";

/** Libellés en langage ordinaire : le joueur n'est pas censé connaître le jargon. */
export const WORK_LABELS: Record<FarmWork, string> = {
  PLANT: "Semer",
  FERTILIZE: "Mettre de l’engrais",
  HARVEST: "Récolter",
  PLOW: "Labourer",
  STUBBLE: "Déchaumer",
  MOW: "Faucher",
  BALE: "Presser les bottes",
  COLLECT: "Ramasser les bottes",
  SILAGE: "Ensiler",
  WEED: "Désherber",
};

/**
 * Prix **client** : ce qu'on paie pour ne pas avoir la machine.
 * Ce n'est pas un salaire. `[GD]`
 */
export const CONTRACTOR_RATE_PER_CELL: Record<FarmWork, number> = {
  PLANT: 8,
  FERTILIZE: 6,
  HARVEST: 12,
  PLOW: 5,
  STUBBLE: 4,
  MOW: 5,
  BALE: 7,
  COLLECT: 3,
  SILAGE: 14,
  WEED: 5,
};

/** Frais de déplacement, quel que soit le nombre de cases `[GD]` */
export const CONTRACTOR_CALLOUT_FEE = 80;

/** Filet urgent PNJ : moins bon que soi-même, instantané `[GD]` */
export const CONTRACTOR_YIELD_MALUS = 0.06;

/** Urgent PNJ (bouton « entreprise ») : le client paie le barème +15 % `[GD]` */
export const URGENT_NPC_SURCHARGE = 0.15;

/** Coût total d'une prestation, frais de déplacement compris. */
export function contractorQuote(work: FarmWork, cells: number): number {
  if (cells <= 0) return 0;
  return CONTRACTOR_CALLOUT_FEE + CONTRACTOR_RATE_PER_CELL[work] * cells;
}

/** Devis urgent PNJ : barème client majoré. L'argent sort de l'économie joueur. */
export function urgentContractorQuote(work: FarmWork, cells: number): number {
  return Math.round(contractorQuote(work, cells) * (1 + URGENT_NPC_SURCHARGE));
}

/**
 * Ce que « Faire faire » coûte **vraiment**, consommables compris.
 *
 * Le bouton annonçait le seul service : « Faire faire · 1 325 € » sur cent
 * trente-quatre cases de maïs. Le serveur, lui, débitait le service **plus les
 * semences** — 3 737 €. Un joueur avec mille quatre cents € cliquait donc
 * un prix qu'il pouvait payer et se faisait répondre qu'il lui en fallait le
 * triple.
 *
 * Pire : à côté, « Demander de l'aide » affichait 3 564 €, semences
 * comprises. Les deux prix n'étaient pas comparables — l'un cachait la moitié
 * de la facture —, ce qui faisait passer l'entraide pour trois fois plus chère
 * alors qu'elle est en réalité **moins chère** que le dépannage.
 *
 * Les deux côtés lisent maintenant cette fonction. C'est la seule façon de
 * garantir que le prix affiché est le prix débité.
 */
export function contractorTotal(
  work: FarmWork,
  cells: number,
  crop?: CropCode | null,
): { service: number; supplies: number; total: number } {
  const service = urgentContractorQuote(work, cells);
  // Le prestataire vient avec son matériel, pas avec la semence : le sac
  // reste à la charge du donneur d'ordre, exactement comme pour l'entraide.
  const supplies = work === "PLANT" && crop ? CROP_DEFS[crop].seedCostPerCell * Math.max(0, cells) : 0;
  return { service, supplies, total: service + supplies };
}

/**
 * Les travaux que l'entreprise de dépannage prend au pied levé.
 *
 * Elle ne prend pas tout : ni le déchaumage, ni la presse, ni le ramassage,
 * ni l'ensilage. C'est un choix de jeu — ces travaux-là passent par
 * l'entraide entre joueurs, qui est la boucle qu'on veut faire vivre.
 *
 * Cette liste vivait en deux exemplaires : une énumération Zod côté serveur,
 * et une cascade de `? :` côté écran qui, elle, proposait le bouton pour
 * trois travaux de plus. Le joueur voyait donc « Payer · 428 € » sur une
 * presse, appuyait, et se faisait renvoyer — par un message pour le
 * déchaumage, par une erreur de validation informe pour les deux autres. Deux
 * listes qui prétendent dire la même chose finissent toujours par diverger ;
 * il n'y en a plus qu'une, et les deux côtés la lisent.
 */
export const URGENT_CONTRACTOR_WORKS = [
  "PLANT",
  "FERTILIZE",
  "HARVEST",
  "PLOW",
  "MOW",
] as const satisfies readonly FarmWork[];

/** L'entreprise instantanée prend-elle ce travail ? */
export function acceptsUrgentContractor(work: FarmWork): boolean {
  return (URGENT_CONTRACTOR_WORKS as readonly FarmWork[]).includes(work);
}

/**
 * Les travaux qu'on peut confier à un autre joueur.
 *
 * Plus large que la liste ci-dessus : c'est justement là que passent la
 * presse et le ramassage.
 */
export const LABOR_ORDER_WORKS = [
  "PLANT",
  "FERTILIZE",
  "HARVEST",
  "PLOW",
  "STUBBLE",
  "MOW",
  "BALE",
  "COLLECT",
  "SILAGE",
] as const satisfies readonly FarmWork[];

/** L'entraide entre joueurs prend-elle ce travail ? */
export function acceptsLaborOrder(work: FarmWork): boolean {
  return (LABOR_ORDER_WORKS as readonly FarmWork[]).includes(work);
}

/**
 * À partir de combien de cases posséder sa propre machine devient rentable.
 * Sert à afficher un conseil honnête au joueur plutôt qu'à lui vendre du
 * service à perte.
 */
export function contractorBreakEvenCells(work: FarmWork, machineCost: number): number {
  return Math.ceil(machineCost / CONTRACTOR_RATE_PER_CELL[work]);
}

export type MissionKind = "NPC" | "P2P";

/** Salaire mission PNJ = 55 % du devis client `[GD]` */
export const MISSION_NPC_SHARE = 0.55;
/** Salaire P2P = 85 % du devis client `[GD]` */
export const MISSION_P2P_SHARE = 0.85;

export const MISSION_CELLS_MIN = 8;
/**
 * Taille d'un chantier **proposé par un PNJ**.
 *
 * C'est un calibre de génération, pas une limite de jeu : les offres du
 * tableau sont découpées à cette taille pour qu'un joueur puisse en prendre
 * une entre deux travaux. Ça n'a jamais eu à s'appliquer à ce qu'un joueur
 * demande sur **son** champ — voir `clampMissionCells`.
 */
export const MISSION_CELLS_MAX = 24;
export const MISSION_CELL_CHOICES = [8, 12, 16, 18, 24] as const;
/** Au plus 3 chantiers ouverts à la fois (anti-rente) `[GD]` */
export const MISSION_OPEN_MAX = 3;

/**
 * Ramène une taille dans le calibre des offres **PNJ**.
 *
 * À ne jamais appliquer à un prix : c'était le cas, et ça faisait un trou.
 * `laborEscrow` écrêtait à vingt-quatre cases avant de chiffrer, si bien
 * qu'une demande d'entraide plus grande aurait été payée au tarif de
 * vingt-quatre — l'aidant labourait cent quarante-quatre cases pour le prix
 * de vingt-quatre. Tant que la route refusait au-delà de vingt-quatre, le
 * trou restait fermé par accident ; il s'ouvrait à la seconde où l'on levait
 * la limite. Le prix suit maintenant le travail réel, partout.
 */
export function clampMissionCells(cells: number): number {
  const n = Math.round(cells);
  return Math.max(MISSION_CELLS_MIN, Math.min(MISSION_CELLS_MAX, n));
}

/** Le nombre de cases qui compte pour un prix : celui qu'on travaille. */
function cellsAPayer(cells: number): number {
  return Math.max(1, Math.round(cells));
}

/**
 * Salaire du prestataire. Jamais égal au prix client tant que le donneur
 * d'ordre est un PNJ : sinon le tableau devient le jeu.
 */
export function missionPayout(
  work: FarmWork,
  cells: number,
  kind: MissionKind = "NPC",
): number {
  const n = cellsAPayer(cells);
  const share = kind === "P2P" ? MISSION_P2P_SHARE : MISSION_NPC_SHARE;
  return Math.round(contractorQuote(work, n) * share);
}

export const P2P_YIELD_MALUS = 0.02;
export const LABOR_ORDER_TTL_MS = 45 * 60 * 1000;
export const LABOR_OPEN_MAX_PER_CLIENT = 3;
export const FERTILIZE_COST_PER_CELL = 10;

export function laborExtras(work: FarmWork, cells: number, crop?: CropCode | null): number {
  const n = Math.max(0, cells);
  if (work === "PLANT") return (crop ? CROP_DEFS[crop].seedCostPerCell : 15) * n;
  if (work === "FERTILIZE") return FERTILIZE_COST_PER_CELL * n;
  if (work === "PLOW") return 12 * n;
  if (work === "STUBBLE") return 5 * n;
  return 0;
}

export function laborEscrow(
  work: FarmWork,
  cells: number,
  crop?: CropCode | null,
  npcClient = false,
): { quote: number; extras: number; escrow: number; payout: number } {
  const n = cellsAPayer(cells);
  const quote = Math.round(contractorQuote(work, n) * (npcClient ? 0.88 : 1));
  const extras = laborExtras(work, n, crop);
  return {
    quote,
    extras,
    escrow: quote + extras,
    payout: Math.round(quote * MISSION_P2P_SHARE),
  };
}

/** @deprecated préférer missionPayout(work, cells, "NPC") */
export const NPC_MISSION_SHARE = MISSION_NPC_SHARE;
/** @deprecated les chantiers varient de 8 à 24 cases */
export const NPC_MISSION_CELLS = 16;

/** Salaire d'un contrat PNJ pour N cases (défaut 16). */
export function npcMissionReward(work: FarmWork, cells: number = NPC_MISSION_CELLS): number {
  return missionPayout(work, cells, "NPC");
}

/** Mapping contrats NPC → type de travail machine */
export const CONTRACT_WORK: Record<
  ContractJobType,
  "PLANT" | "FERTILIZE" | "HARVEST" | "PLOW"
> = {
  PLOW: "PLOW",
  SOW: "PLANT",
  FERTILIZE: "FERTILIZE",
  HARVEST: "HARVEST",
  TRANSPORT: "PLOW",
};

/** @deprecated préférer CONTRACT_WORK + pickMachine */
export const CONTRACT_MACHINE: Record<ContractJobType, MachineType> = {
  PLOW: "TRACTOR",
  SOW: "TRACTOR",
  FERTILIZE: "TRACTOR",
  HARVEST: "HARVESTER",
  TRANSPORT: "TRACTOR",
};

/** @deprecated l'usure suit les cases du chantier (`contract.cells`) */
export const CONTRACT_WEAR_CELLS = 16;

export function footprintCells(x: number, y: number, w: number, h: number) {
  const cells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      cells.push({ x: x + dx, y: y + dy });
    }
  }
  return cells;
}

/**
 * Emprise d'un bâtiment posé, quart de tour compris.
 *
 * Six des treize types ne sont pas carrés : un hangar 3×2 tourné d'un quart
 * occupe 2×3. **Toute lecture d'emprise doit passer par ici** — la vérification
 * de place, le marquage des cases, la borne de grille et l'adjacence d'un pré
 * à son étable. Une seule de ces lectures laissée en `def.w × def.h` suffit à
 * laisser bâtir deux constructions l'une sur l'autre.
 */
export function orientedFootprint(
  type: BuildingType,
  rotation = 0,
): { w: number; h: number } {
  const def = BUILDING_DEFS[type];
  return quarterTurns(rotation) % 2 === 0
    ? { w: def.w, h: def.h }
    : { w: def.h, h: def.w };
}

/** Rotation ramenée à un quart de tour de 0 à 3, quelle que soit l'entrée. */
export function quarterTurns(rotation: number | null | undefined): 0 | 1 | 2 | 3 {
  const n = Math.round(rotation ?? 0);
  return ((((n % 4) + 4) % 4) as 0 | 1 | 2 | 3);
}

/**
 * Durée de l'animation d'un travail, en millisecondes.
 *
 * L'écran effaçait l'engin au bout de neuf cents millisecondes fixes, quand la
 * vue 3D le faisait avancer d'une case toutes les 280 ms : un travail sur
 * neuf cases voyait donc sa machine s'évaporer au tiers du parcours. Les deux
 * côtés lisent la même formule.
 *
 * Cette formule n'est plus qu'un **repli**. Un chantier a maintenant une durée
 * réelle côté serveur, et c'est elle que l'engin doit mettre à traverser le
 * champ : sinon une moissonneuse T3, deux fois plus rapide au compteur,
 * traverserait la parcelle exactement comme une T1. On ne retombe ici que
 * pour les gestes qui n'ouvrent pas de chantier — livraisons, visites.
 */
/**
 * Le temps que met le matériel à rejoindre le champ, en début de chantier.
 *
 * Vu en jouant : « le chrono s'écoule, puis le véhicule apparaît à la fin du
 * chrono ». L'engin ne traversait pas le champ pendant le travail, il arrivait
 * une fois tout fini — l'écran montrait donc une attente sans rien, puis un
 * passage sans attente. C'est corrigé côté écran : la traversée occupe
 * maintenant tout le chantier.
 *
 * Reste ce que le joueur avait lui-même mis derrière l'attente : « t'as mis
 * tout ce temps à amener le matos au champ, puis tu presses ». Ce début-là a
 * donc un nom. Une part du chantier, bornée des deux côtés : sur un gros
 * champ, on ne va pas regarder « le matériel arrive » pendant une minute ;
 * sur un tout petit, l'arrivée ne doit pas manger la moitié du travail.
 */
export const JOB_ARRIVAL_SHARE = 0.15;
export const JOB_ARRIVAL_MIN_MS = 1_500;
export const JOB_ARRIVAL_MAX_MS = 6_000;

export function jobArrivalMs(durationMs: number): number {
  if (durationMs <= 0) return 0;
  const part = durationMs * JOB_ARRIVAL_SHARE;
  return Math.round(
    Math.min(durationMs / 2, JOB_ARRIVAL_MAX_MS, Math.max(JOB_ARRIVAL_MIN_MS, part)),
  );
}

export function workAnimationMs(cells: number, jobMs?: number): number {
  // Un plancher reste nécessaire : à deux cases, un chantier réel dure une
  // demi-seconde, et l'œil ne verrait qu'un clignotement.
  if (jobMs && jobMs > 0) return Math.max(900, jobMs);
  return Math.max(900, cells * 360);
}
