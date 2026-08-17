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

/** Ce que le joueur peut faire depuis l'alerte, sans aller le chercher. */
export type HerdAlertAction =
  | { kind: "FEED" }
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
  icon: string;
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

/** Toutes les alertes d'une parcelle, les plus graves en tête. */
export function herdAlerts(barns: BarnSnapshot[]): HerdAlert[] {
  const out: HerdAlert[] = [];

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
        icon: "💀",
        text: `${barn.name} — le troupeau dépérit, des bêtes vont mourir`,
        action: { kind: "FEED" },
        actionLabel: "Nourrir",
      });
    } else if (herd.hungry) {
      const jours = feedDaysLeft(herd);
      out.push({
        ...base,
        id: `${herd.id}:feed`,
        level: "warn",
        icon: "🌾",
        text:
          jours < 1
            ? `${barn.name} — ration épuisée`
            : `${barn.name} — ${jours.toFixed(0)} jour(s) de ration`,
        action: { kind: "FEED" },
        actionLabel: "Nourrir",
      });
    }

    // 2. Le temps qu'il fait, quand les bêtes le subissent.
    if (herd.thermalAlert === "danger") {
      out.push({
        ...base,
        id: `${herd.id}:cold`,
        level: "danger",
        icon: herd.tempC !== undefined && herd.tempC < 5 ? "❄️" : "🔥",
        text: `${barn.name} — ${herd.tempC ?? "?"} °C, les bêtes souffrent`,
        action: herd.housing === "OUTSIDE" ? { kind: "SHELTER" } : { kind: "GRAZE" },
        actionLabel: herd.housing === "OUTSIDE" ? "Rentrer" : "Sortir",
      });
    } else if (herd.thermalAlert === "warn" && herd.housing === "OUTSIDE") {
      out.push({
        ...base,
        id: `${herd.id}:chill`,
        level: "warn",
        icon: "🌡️",
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
        icon: "🌱",
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
        icon: "🧹",
        text: `${barn.name} — litière à refaire`,
        action: { kind: "BEDDING" },
        actionLabel: "Pailler",
      });
    }

    // 5. Fosse pleine : l'odeur pèse sur le bien-être, et le fumier se vend.
    if (herd.smelly || (herd.manureFill ?? 0) >= 0.9) {
      out.push({
        ...base,
        id: `${herd.id}:manure`,
        level: "warn",
        icon: "💩",
        text: `${barn.name} — fosse pleine, l'odeur pèse sur le troupeau`,
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
        icon: herd.canMilk ? "🥛" : herd.canCollectEggs ? "🥚" : "🧶",
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
