import { useEffect, useRef, useState } from "react";

/**
 * Ce qui, sur la ferme, réclame l'attention du joueur.
 *
 * Deux besoins se rejoignent ici. Sur téléphone, la barre d'onglets doit
 * signaler ce qui ne va pas sans qu'on ouvre chaque tiroir. Et un joueur qui a
 * laissé l'onglet de côté doit être prévenu avant que sa récolte ne soit
 * perdue ou son troupeau décimé — jusqu'ici il le découvrait au retour, quand
 * plus rien n'était rattrapable.
 */
export type FarmAlerts = {
  /** Cases mûres à récolter */
  ready: number;
  /** Cases qui se dégradent et seront bientôt perdues */
  urgent: number;
  /** Cases déjà perdues, à libérer à la charrue */
  lost: number;
  /** Troupeaux qui commencent à perdre des bêtes */
  herdsAtRisk: number;
};

export const NO_ALERTS: FarmAlerts = { ready: 0, urgent: 0, lost: 0, herdsAtRisk: 0 };

/** Nombre à afficher sur un onglet, ou zéro pour n'en afficher aucun. */
export function tabBadge(alerts: FarmAlerts, tab: string): number {
  if (tab === "INFO") return alerts.urgent + alerts.lost;
  if (tab === "HERD") return alerts.herdsAtRisk;
  return 0;
}

/** Le message que mérite un joueur absent, ou `null` s'il n'y a rien à dire. */
export function alertMessage(a: FarmAlerts): string | null {
  const parts: string[] = [];
  if (a.herdsAtRisk) {
    parts.push(
      a.herdsAtRisk === 1
        ? "un troupeau dépérit faute de ration"
        : `${a.herdsAtRisk} troupeaux dépérissent faute de ration`,
    );
  }
  if (a.urgent) parts.push(`${a.urgent} case(s) sur le point d'être perdues`);
  if (!parts.length) return null;
  return `Votre ferme réclame votre attention : ${parts.join(", ")}.`;
}

/**
 * Prévient hors de l'écran quand la situation se dégrade.
 *
 * Trois précautions. On ne demande la permission qu'au premier besoin réel,
 * jamais au chargement — une demande gratuite se refuse d'un réflexe. On ne
 * notifie que si l'onglet est caché, sinon l'information est déjà à l'écran.
 * Et on ne répète pas : tant que la situation ne s'aggrave pas, le joueur a
 * été prévenu une fois, cela suffit.
 */
export function useAwayAlerts(alerts: FarmAlerts, enabled: boolean) {
  const lastSignature = useRef("");
  const cooldownUntil = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === "undefined") return;

    const message = alertMessage(alerts);
    if (!message) {
      lastSignature.current = "";
      return;
    }
    // La signature ne retient que la gravité : un compteur qui oscille d'une
    // case ne doit pas rappeler le joueur à l'ordre.
    const signature = `${alerts.herdsAtRisk > 0}|${alerts.urgent > 0}`;
    if (signature === lastSignature.current) return;
    if (!document.hidden) {
      // Le joueur regarde : l'écran le dit déjà, on note simplement que la
      // situation est connue de lui.
      lastSignature.current = signature;
      return;
    }
    const now = Date.now();
    if (now < cooldownUntil.current) return;

    const send = () => {
      if (Notification.permission !== "granted") return;
      new Notification("Farming Navigateur", { body: message, tag: "farmsim-alert" });
      lastSignature.current = signature;
      cooldownUntil.current = now + 5 * 60 * 1000;
    };

    if (Notification.permission === "granted") send();
    else if (Notification.permission === "default") Notification.requestPermission().then(send);
  }, [alerts, enabled]);
}

/**
 * Autorisation de notifier, telle que l'écran doit la présenter : on ne
 * propose le réglage que si le navigateur sait le faire et ne l'a pas déjà
 * refusé définitivement.
 */
export function useNotificationState() {
  const [state, setState] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const ask = async () => {
    if (typeof Notification === "undefined") return;
    const next = await Notification.requestPermission();
    setState(next);
  };

  return { state, ask };
}
