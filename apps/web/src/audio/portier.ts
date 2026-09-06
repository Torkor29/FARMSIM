/**
 * Le portier : ce qui empêche la ferme de devenir un brouhaha.
 *
 * Un jeu qui joue un son à chaque événement finit toujours pareil : dix
 * chantiers se terminent dans la même seconde, quarante bêtes meuglent, et
 * le joueur coupe le son — définitivement. Une fois le son coupé, tout le
 * travail sonore est perdu, y compris les sons qui, eux, étaient utiles.
 *
 * On ne compte donc pas sur la discipline de chaque appel. Toute demande
 * passe par ici, et trois règles décident :
 *
 * 1. **Un délai par son.** Le même bruit ne se répète pas avant son délai.
 *    C'est ce qui tue le crépitement d'un bouton cliqué vite.
 * 2. **Un plafond de voix par bus.** Au-delà, les nouvelles demandes sont
 *    refusées plutôt que mises en file : un son en retard ment sur ce qui
 *    vient de se passer, il vaut mieux ne pas l'entendre.
 * 3. **Une fenêtre glissante.** Même sous les deux plafonds, une rafale de
 *    sons *différents* dans la même seconde reste du bruit.
 *
 * Tout est pur : aucune horloge interne, aucun Web Audio. Le temps arrive en
 * argument, ce qui rend la règle vérifiable sans navigateur — et c'est bien
 * la règle, pas le grésillement, qui décide du confort.
 */

import type { Bus } from "./prefs";

/** Plafond de voix simultanées, par bus. */
export const VOIX_MAX: Record<Bus, number> = {
  // La musique gère ses propres notes en interne : le portier ne s'en mêle pas.
  musique: 64,
  // Quatre effets ensemble, c'est déjà beaucoup ; au-delà on n'entend qu'un choc.
  effets: 4,
  // L'ambiance est un fond, pas un événement : deux voix suffisent.
  ambiance: 2,
};

/** Pas plus de tant de sons lancés par seconde, toutes catégories confondues. */
export const RAFALE_MAX = 6;
const FENETRE_MS = 1000;

/** Délai par défaut entre deux sons de même clé, en millisecondes. */
export const DELAI_DEFAUT_MS = 90;

type Voix = { bus: Bus; finAt: number };

export class Portier {
  private dernierParCle = new Map<string, number>();
  private voix: Voix[] = [];
  private lancements: number[] = [];

  /**
   * Ce son a-t-il le droit de sortir maintenant ?
   *
   * Rend `true` **et enregistre la voix** : demander, c'est prendre la place.
   * Les deux gestes ne se séparent pas, sinon deux appels dans la même
   * milliseconde passeraient tous les deux le plafond.
   */
  autorise(opts: {
    cle: string;
    bus: Bus;
    maintenant: number;
    /** Durée du son, pour savoir quand la voix se libère. */
    dureeMs: number;
    /** Délai minimal avant de rejouer la même clé. */
    delaiMs?: number;
  }): boolean {
    const { cle, bus, maintenant, dureeMs } = opts;
    this.purger(maintenant);

    const dernier = this.dernierParCle.get(cle);
    const delai = opts.delaiMs ?? DELAI_DEFAUT_MS;
    if (dernier !== undefined && maintenant - dernier < delai) return false;

    if (this.voix.filter((v) => v.bus === bus).length >= VOIX_MAX[bus]) return false;
    if (this.lancements.length >= RAFALE_MAX) return false;

    this.dernierParCle.set(cle, maintenant);
    this.voix.push({ bus, finAt: maintenant + Math.max(0, dureeMs) });
    this.lancements.push(maintenant);
    return true;
  }

  /** Combien de voix vivantes sur ce bus — utile aux tests et au diagnostic. */
  voixVivantes(bus: Bus, maintenant: number): number {
    this.purger(maintenant);
    return this.voix.filter((v) => v.bus === bus).length;
  }

  /** Tout oublier : au retour d'un onglet resté longtemps caché, par exemple. */
  vider(): void {
    this.dernierParCle.clear();
    this.voix = [];
    this.lancements = [];
  }

  private purger(maintenant: number): void {
    if (this.voix.length) this.voix = this.voix.filter((v) => v.finAt > maintenant);
    if (this.lancements.length) {
      this.lancements = this.lancements.filter((t) => maintenant - t < FENETRE_MS);
    }
  }
}
