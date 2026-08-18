/**
 * Alertes d'élevage — ce qui réclame le joueur, et le geste qui y répond.
 *
 * Il n'existait qu'une seule alerte pour tout l'élevage : `herdsAtRisk`,
 * « faute de ration ». Litière vide, fosse pleine, pré épuisé, bêtes qui
 * grelottent dehors — rien de tout cela ne remontait, et il fallait ouvrir le
 * panneau pour le découvrir.
 *
 * Chaque alerte porte ici trois choses : une gravité qui la classe, une
 * phrase qui dit ce qui se passe, et **l'action qui la referme**. Une alerte
 * sur laquelle on ne peut rien faire est une inquiétude, pas une information.
 */

export type HerdAlertLevel = "danger" | "warn" | "info";

/** Les motifs d'alerte que l'interface sait dessiner. */
export type HerdAlertIcon =
  | "risque"
  | "ration"
  | "froid"
  | "chaud"
  | "pre"
  | "litiere"
  | "fosse"
  | "recolte";

/** Ce que le joueur peut faire depuis l'alerte, sans aller le chercher. */
export type HerdAlertAction =
  | { kind: "FEED" }
  /**
   * Aller chercher de quoi nourrir.
   *
   * Sans ce geste, l'alerte « le troupeau dépérit » proposait `[Nourrir]`
   * même quand il ne restait pas un kilo de fourrage : le bouton distribuait
   * du vide, et le joueur voyait la ligne rouge revenir sans comprendre. Une
   * alerte doit mener quelque part — ici, à l'hôtel des ventes.
   */
  | { kind: "BUY_FEED" }
  | { kind: "BEDDING" }
  | { kind: "SHELTER" }
  | { kind: "GRAZE" }
  | { kind: "MANURE" }
  | { kind: "COLLECT" };

export type HerdAlert = {
  id: string;
  buildingId: string;
  herdId: string;
  level: HerdAlertLevel;
  /**
   * Le motif de l'alerte, et non son dessin.
   *
   * C'était un emoji — 💀, 🌾, 🧹. Trois défauts, dans cet ordre : le rendu
   * change d'un système à l'autre et échappe donc au dessin du jeu ; la
   * couleur est celle de la fonte d'emoji, jamais celle de la palette ; et
   * c'est le signal le plus reconnaissable d'une interface qu'on n'a pas
   * dessinée. Le domaine dit maintenant *de quoi il s'agit*, et l'interface
   * choisit le trait.
   */
  icon: HerdAlertIcon;
  text: string;
  action: HerdAlertAction;
  actionLabel: string;
};

/** Ce dont l'analyse a besoin — un sous-ensemble de la charge utile du serveur. */
export type HerdSnapshot = {
  id: string;
  kind: string;
  size: number;
  atRisk: boolean;
  hungry: boolean;
  feedStock: number;
  feedNeed: number;
  beddingCover?: number;
  manureFill?: number;
  smelly?: boolean;
  housing?: "INSIDE" | "OUTSIDE";
  thermalAlert?: "none" | "warn" | "danger";
  tempC?: number;
  grassTons?: number;
  grazes?: boolean;
  canMilk?: boolean;
  canCollectEggs?: boolean;
  canShear?: boolean;
};

export type BarnSnapshot = {
  buildingId: string;
  name: string;
  paddockCapacity: number;
  herd?: HerdSnapshot | null;
};

const ORDER: Record<HerdAlertLevel, number> = { danger: 0, warn: 1, info: 2 };

/**
 * Jours de ration restants, au rythme d'un cycle par jour.
 *
 * Le joueur décide sur une durée, pas sur un tonnage : « 4 jours » se
 * comprend, « 0,02 t par cycle » se calcule.
 */
export function feedDaysLeft(herd: { feedStock: number; feedNeed: number }): number {
  if (herd.feedNeed <= 0) return Infinity;
  return herd.feedStock / herd.feedNeed;
}

/** Ce que la ferme a en réserve, et qui décide du geste proposé. */
export type FarmStocks = {
  /** Y a-t-il quoi que ce soit à distribuer — foin, maïs, orge, blé, ensilage ? */
  hasFeed?: boolean;
  /** Reste-t-il de la paille pour la litière ? */
  hasStraw?: boolean;
};

/** Toutes les alertes d'une parcelle, les plus graves en tête. */
export function herdAlerts(barns: BarnSnapshot[], stocks: FarmStocks = {}): HerdAlert[] {
  const out: HerdAlert[] = [];
  // Par défaut on suppose la réserve pleine : une alerte qui propose un geste
  // impossible est pire qu'une alerte sans geste, mais l'inverse — refuser le
  // geste par excès de prudence — l'est aussi.
  const aDeLaRation = stocks.hasFeed !== false;
  const aDeLaPaille = stocks.hasStraw !== false;

  /** Le geste qui répond à la faim : distribuer, ou aller acheter. */
  const gesteRation: { action: HerdAlertAction; actionLabel: string } = aDeLaRation
    ? { action: { kind: "FEED" }, actionLabel: "Nourrir" }
    : { action: { kind: "BUY_FEED" }, actionLabel: "Acheter du fourrage" };

  for (const barn of barns) {
    const herd = barn.herd;
    // Une étable vide n'a rien à signaler : c'est le bug de l'étable fantôme,
    // et il ne doit pas se reformer par les alertes.
    if (!herd || herd.size <= 0) continue;

    const base = { buildingId: barn.buildingId, herdId: herd.id };

    // 1. Mortalité en cours — rien ne passe avant.
    if (herd.atRisk) {
      out.push({
        ...base,
        id: `${herd.id}:risk`,
        level: "danger",
        icon: "risque",
        text: aDeLaRation
          ? `${barn.name} — le troupeau dépérit, des bêtes vont mourir`
          : `${barn.name} — le troupeau dépérit, et il ne reste rien à distribuer`,
        ...gesteRation,
      });
    } else if (herd.hungry) {
      const jours = feedDaysLeft(herd);
      out.push({
        ...base,
        id: `${herd.id}:feed`,
        level: "warn",
        icon: "ration",
        text: !aDeLaRation
          ? `${barn.name} — plus rien en réserve pour la ration`
          : jours < 1
            ? `${barn.name} — ration épuisée`
            : `${barn.name} — ${jours.toFixed(0)} jour(s) de ration`,
        ...gesteRation,
      });
    }

    // 2. Le temps qu'il fait, quand les bêtes le subissent.
    if (herd.thermalAlert === "danger") {
      out.push({
        ...base,
        id: `${herd.id}:cold`,
        level: "danger",
        icon: herd.tempC !== undefined && herd.tempC < 5 ? "froid" : "chaud",
        text: `${barn.name} — ${herd.tempC ?? "?"} °C, les bêtes souffrent`,
        action: herd.housing === "OUTSIDE" ? { kind: "SHELTER" } : { kind: "GRAZE" },
        actionLabel: herd.housing === "OUTSIDE" ? "Rentrer" : "Sortir",
      });
    } else if (herd.thermalAlert === "warn" && herd.housing === "OUTSIDE") {
      out.push({
        ...base,
        id: `${herd.id}:chill`,
        level: "warn",
        icon: herd.tempC !== undefined && herd.tempC < 5 ? "froid" : "chaud",
        text: `${barn.name} — ${herd.tempC ?? "?"} °C dehors, à surveiller`,
        action: { kind: "SHELTER" },
        actionLabel: "Rentrer",
      });
    }

    // 3. Le pré s'épuise sous les bêtes qu'on y a mises.
    if (herd.housing === "OUTSIDE" && herd.grazes && (herd.grassTons ?? 0) <= 0.02) {
      out.push({
        ...base,
        id: `${herd.id}:grass`,
        level: "warn",
        icon: "pre",
        text: `${barn.name} — pré épuisé, le troupeau puise dans le stock`,
        action: { kind: "SHELTER" },
        actionLabel: "Rentrer",
      });
    }

    // 4. Litière : moins grave que la faim, mais ça se voit sur le lait.
    if ((herd.beddingCover ?? 1) < 0.5 && herd.housing !== "OUTSIDE") {
      out.push({
        ...base,
        id: `${herd.id}:bedding`,
        level: "warn",
        icon: "litiere",
        // Même règle que pour la ration : sans paille en réserve, « Pailler »
        // étale du vide. On dit alors ce qui manque, et où le trouver.
        /**
         * Dire le remède, pas seulement le mal.
         *
         * « Litière à refaire » annonce un devoir sans son mode d'emploi :
         * on sait qu'il faut nettoyer l'étable, pas comment. Le geste est
         * pourtant simple — étaler de la paille propre — et il tient dans la
         * phrase.
         */
        text: aDeLaPaille
          ? `${barn.name} — litière sale, étalez de la paille propre`
          : `${barn.name} — litière sale, et plus un brin de paille à étaler`,
        ...(aDeLaPaille
          ? { action: { kind: "BEDDING" as const }, actionLabel: "Pailler" }
          : { action: { kind: "BUY_FEED" as const }, actionLabel: "Acheter de la paille" }),
      });
    }

    // 5. Fosse pleine : l'odeur pèse sur le bien-être, et le fumier se vend.
    if (herd.smelly || (herd.manureFill ?? 0) >= 0.9) {
      out.push({
        ...base,
        id: `${herd.id}:manure`,
        level: "warn",
        icon: "fosse",
        // Même règle : où va le fumier, et pourquoi c'est une bonne nouvelle.
        text: `${barn.name} — fosse pleine, épandez le fumier sur vos champs`,
        action: { kind: "MANURE" },
        actionLabel: "Épandre",
      });
    }

    // 6. Récolte prête : ce n'est pas un problème, c'est de l'argent qui attend.
    if (herd.canMilk || herd.canCollectEggs || herd.canShear) {
      out.push({
        ...base,
        id: `${herd.id}:collect`,
        level: "info",
        icon: "recolte",
        text: `${barn.name} — ${herd.canMilk ? "traite" : herd.canCollectEggs ? "œufs" : "tonte"} prête`,
        action: { kind: "COLLECT" },
        actionLabel: herd.canMilk ? "Traire" : herd.canCollectEggs ? "Ramasser" : "Tondre",
      });
    }
  }

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]);
}

/** Compte des alertes qui méritent une pastille — l'information n'en est pas une. */
export function herdBadgeCount(alerts: HerdAlert[]): number {
  return alerts.filter((a) => a.level !== "info").length;
}
