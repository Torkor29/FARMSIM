/**
 * Travail du sol entre deux cultures.
 *
 * Après une moisson, la case porte des chaumes : on ne resème pas dessus. Le
 * joueur choisit alors entre deux outils, et c'est un vrai arbitrage
 * agronomique, pas une formalité.
 *
 * - Le **déchaumeur à disques** travaille en surface (5 à 15 cm). Il incorpore
 *   les résidus de la récolte précédente, qui se décomposent et nourrissent la
 *   culture suivante : bonus de rendement. Il fait aussi un faux-semis, donc
 *   il détruit les adventices. Rapide et bon marché — mais il ne remet pas le
 *   compteur à zéro.
 * - La **charrue** retourne la terre en profondeur. Elle efface les résidus
 *   accumulés, donc le bonus, mais elle remet le sol à neuf.
 * - Le **semis direct** ne travaille pas le sol du tout : le semoir ouvre un
 *   sillon dans les chaumes et referme derrière lui. On économise un passage
 *   entier, le sol garde son humidité et sa structure, et la couverture
 *   permanente le protège de l'érosion. En échange les résidus restent en
 *   surface au lieu d'être incorporés — donc aucun bonus de décomposition —,
 *   la terre se réchauffe plus lentement au printemps et la levée est moins
 *   régulière. Le rendement en pâtit, et rien ne décompacte.
 *
 * Au bout de trois récoltes sans labour, le sol est tassé et la pression des
 * adventices trop forte : la charrue devient obligatoire.
 *
 * @see docs/research/39_SOIL_WORK.md
 */

/** Travail réalisé sur une case depuis la dernière récolte. */
export type SoilWork = "STUBBLE" | "PLOW" | "DIRECT_SEED";

export const SOIL_WORK_LABELS: Record<SoilWork, string> = {
  STUBBLE: "Déchaumage",
  PLOW: "Labour",
  DIRECT_SEED: "Semis direct",
};

/** Récoltes possibles avant que la charrue ne devienne obligatoire `[GD]` */
export const MAX_HARVESTS_BEFORE_PLOW = 3;

/**
 * Bonus de rendement apporté par les résidus incorporés, par nombre de
 * déchaumages consécutifs `[GD]`.
 *
 * Le gain est décroissant : la première incorporation apporte l'essentiel de
 * la matière organique disponible, la seconde beaucoup moins. Sans cela, la
 * stratégie optimale serait triviale.
 */
export const RESIDUE_YIELD_BONUS: readonly number[] = [0, 0.05, 0.09];

/**
 * Coût du déchaumage, par case `[GD]`.
 *
 * Ce forfait valait cinq € quand il tenait lieu de tout : gazole,
 * main-d'œuvre, pièces d'usure, en un seul nombre que le joueur ne pouvait ni
 * décomposer ni réduire. Le gazole étant désormais compté à part et facturé
 * sur la cuve, il ne reste ici que ce qu'il représentait vraiment en plus —
 * les disques qui s'émoussent.
 */
export const STUBBLE_COST_PER_CELL = 1;

/**
 * Coût du labour, par case `[GD]`.
 *
 * Douze € la case faisaient 1 716 € pour une parcelle entière — de loin le
 * poste le plus lourd d'une saison, sans que rien n'explique pourquoi. Le
 * gazole prend le relais et se voit : un labour de champ entier brûle 176 L,
 * soit 281 €, et ce chiffre-là se réduit en attelant juste.
 *
 * Il reste deux € la case pour les socs, qui sont de vraies pièces d'usure —
 * une charrue en mange un jeu par campagne.
 */
export const PLOW_COST_PER_CELL_SOIL = 2;

/**
 * Un labour qui arrive à son heure entretient le sol : il décompacte et
 * enfouit la pression d'adventices. `[GD]`
 */
export const PLOW_FERTILITY_GAIN = 0.008;

/** État du sol d'une case, tel qu'il est stocké et affiché. */
export type SoilState = {
  /** Récoltes depuis le dernier labour, 0 à `MAX_HARVESTS_BEFORE_PLOW` */
  harvestsSincePlow: number;
  /** Déchaumages consécutifs depuis le dernier labour */
  residuePasses: number;
  /** La case porte-t-elle des chaumes à traiter avant de resemer ? */
  hasStubble: boolean;
};

/** Bonus de rendement issu des résidus incorporés, borné par la table. */
export function residueBonus(residuePasses: number): number {
  const i = Math.max(0, Math.min(RESIDUE_YIELD_BONUS.length - 1, Math.floor(residuePasses)));
  return RESIDUE_YIELD_BONUS[i];
}

/** La charrue est-elle devenue obligatoire sur cette case ? */
export function plowRequired(state: Pick<SoilState, "harvestsSincePlow">): boolean {
  return state.harvestsSincePlow >= MAX_HARVESTS_BEFORE_PLOW;
}

/**
 * Surcoût du semis direct, par case `[GD]`.
 *
 * Le semoir de semis direct est une machine autrement plus lourde qu'un semoir
 * classique : il lui faut assez de poids et de disques pour percer un matelas
 * de résidus. On paie donc un peu plus la graine mise en terre — mais on
 * économise **tout un passage**, gazole compris.
 *
 * Trois € étaient calés sur des forfaits de travail du sol qui valaient
 * alors cinq et douze. Ceux-ci sont tombés à un et deux, le gazole ayant pris
 * le relais : à trois, le semis direct devenait l'option la plus chère du jeu,
 * ce qui retournait exactement sa raison d'être. Un test l'a signalé.
 */
export const DIRECT_SEED_COST_PER_CELL = 1;

/** Perte de rendement du semis direct `[GD]` — levée irrégulière, sol froid */
export const DIRECT_SEED_YIELD_MALUS = 0.1;

/** Le sol couvert en permanence s'érode moins et se structure `[GD]` */
export const DIRECT_SEED_FERTILITY_GAIN = 0.003;

export type SoilWorkRefusal = "NO_STUBBLE" | "PLOW_REQUIRED";

export const SOIL_WORK_REFUSAL_LABELS: Record<SoilWorkRefusal, string> = {
  NO_STUBBLE: "Rien à travailler : la case n’a pas de chaumes",
  PLOW_REQUIRED: `Sol épuisé après ${MAX_HARVESTS_BEFORE_PLOW} récoltes — le labour est obligatoire`,
};

/** Le déchaumeur peut-il encore passer, ou faut-il sortir la charrue ? */
export function canStubble(state: SoilState): { ok: boolean; reason?: SoilWorkRefusal } {
  if (!state.hasStubble) return { ok: false, reason: "NO_STUBBLE" };
  if (plowRequired(state)) return { ok: false, reason: "PLOW_REQUIRED" };
  return { ok: true };
}

/**
 * Une terre travaillée peut-elle être remise en herbe ?
 *
 * Une parcelle labourée puis laissée là reste une bande de terre nue, et rien
 * dans le jeu ne permettait d'y revenir : on avait beau ne plus vouloir la
 * cultiver, elle restait marron pour toujours. C'est ce qu'un joueur a
 * remarqué avant nous — « y'a un moyen une fois labourées que les terres
 * redeviennent propres ? ». Il n'y en avait pas.
 *
 * La condition est simplement : rien ne pousse et il n'y a pas de chaumes.
 * Avec des chaumes, c'est un déchaumage qu'il faut, pas une remise en herbe.
 */
export function canRegrass(state: {
  hasStubble: boolean;
  hasCrop: boolean;
  worked: boolean;
}): boolean {
  return state.worked && !state.hasCrop && !state.hasStubble;
}

/**
 * Le sol après une remise en herbe.
 *
 * Le couvert repart de zéro : ni chaumes, ni résidus à porter au crédit du
 * prochain semis. En revanche le compteur de récoltes est remis à zéro — une
 * jachère enherbée refait la structure du sol aussi bien qu'un labour, et
 * c'est ce qui rend le geste utile plutôt que purement décoratif.
 */
export function applyRegrass(): SoilState {
  return { harvestsSincePlow: 0, residuePasses: 0, hasStubble: false };
}

/** Le sol après un déchaumage : résidus incorporés, compteur inchangé. */
export function applyStubble(state: SoilState): SoilState {
  return {
    harvestsSincePlow: state.harvestsSincePlow,
    residuePasses: Math.min(RESIDUE_YIELD_BONUS.length - 1, state.residuePasses + 1),
    hasStubble: false,
  };
}

/** Le sol après un labour : tout repart de zéro, bonus compris. */
export function applyPlow(): SoilState {
  return { harvestsSincePlow: 0, residuePasses: 0, hasStubble: false };
}

/** Le sol après une moisson : des chaumes, et une récolte de plus au compteur. */
export function applyHarvest(state: SoilState): SoilState {
  return {
    harvestsSincePlow: Math.min(MAX_HARVESTS_BEFORE_PLOW, state.harvestsSincePlow + 1),
    residuePasses: state.residuePasses,
    hasStubble: true,
  };
}

/**
 * Le semis direct est-il possible ? Il lui faut justement des chaumes — sans
 * quoi c'est un semis ordinaire — et un sol qui n'a pas atteint sa limite de
 * tassement, puisqu'il ne décompacte rien.
 */
export function canDirectSeed(state: SoilState): { ok: boolean; reason?: SoilWorkRefusal } {
  if (!state.hasStubble) return { ok: false, reason: "NO_STUBBLE" };
  if (plowRequired(state)) return { ok: false, reason: "PLOW_REQUIRED" };
  return { ok: true };
}

/**
 * Le sol après un semis direct : les chaumes sont percés, donc semés, mais
 * rien n'a été incorporé — le compteur de résidus retombe à zéro — et rien n'a
 * été décompacté, d'où une récolte de plus au compteur du labour.
 */
export function applyDirectSeed(state: SoilState): SoilState {
  return {
    harvestsSincePlow: Math.min(MAX_HARVESTS_BEFORE_PLOW, state.harvestsSincePlow + 1),
    residuePasses: 0,
    hasStubble: false,
  };
}

/**
 * Peut-on semer sur cette case sans autre forme de procès ? Des chaumes
 * imposent un choix préalable : les travailler, ou semer directement dedans.
 *
 * C'est la question **agronomique** (le sol est-il nu ?). Le geste « Semer »
 * du joueur, lui, répond avec `sowingPlan` : sur des chaumes encore labourables
 * il sème en direct plutôt que de refuser.
 */
export function canSow(state: SoilState): boolean {
  return !state.hasStubble;
}

/** Pourquoi le semis d'une case est refusé. */
export type SowingPlanRefusal = "OCCUPIED" | "PLOW_REQUIRED" | "NO_STUBBLE";

export type SowingPlan =
  | { ok: true; directSeed: boolean }
  | { ok: false; reason: SowingPlanRefusal };

/**
 * Comment semer cette case, pour le geste « Semer ».
 *
 * Le prestataire plantait sur les chaumes ; le joueur se faisait refuser
 * après le chantier. Les deux chemins lisent désormais la même décision :
 *
 * - terre nue → semis ordinaire ;
 * - chaumes, sol encore labourable → semis direct ;
 * - sol trop tassé → labour obligatoire, prestataire compris ;
 * - case occupée → refus.
 */
export function sowingPlan(cell: { kind: string } & SoilState): SowingPlan {
  if (cell.kind !== "EMPTY") return { ok: false, reason: "OCCUPIED" };
  if (cell.hasStubble) {
    if (plowRequired(cell)) return { ok: false, reason: "PLOW_REQUIRED" };
    return { ok: true, directSeed: true };
  }
  return { ok: true, directSeed: false };
}

/** Résumé lisible de l'état du sol, pour l'affichage. */
export function soilSummary(state: SoilState): string {
  if (state.hasStubble) {
    return plowRequired(state)
      ? "Chaumes · labour obligatoire"
      : `Chaumes · déchaumer, labourer ou semer direct · ${
          MAX_HARVESTS_BEFORE_PLOW - state.harvestsSincePlow
        } récolte(s) avant labour`;
  }
  const bonus = residueBonus(state.residuePasses);
  if (bonus > 0) return `Résidus incorporés · +${Math.round(bonus * 100)} % de rendement`;
  return "Sol labouré, prêt à semer";
}
