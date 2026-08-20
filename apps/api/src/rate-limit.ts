/**
 * Limitation de débit — le garde-fou qui manquait aux routes publiques.
 *
 * Cent quatre routes, aucune limite : rien n'empêchait une boucle de tirer
 * dessus aussi vite que le réseau le permet. Trois conséquences concrètes,
 * dans l'ordre de gravité :
 *
 * 1. **Le code d'accès se devine.** `POST /auth/login` accepte un code à cinq
 *    chiffres. Cent mille combinaisons, sans limite, c'est quelques minutes de
 *    boucle pour entrer sur le compte de quelqu'un — le vôtre compris.
 * 2. **Le jeu s'arrête pour tout le monde.** Un seul client bavard sature le
 *    processus Node, qui est mono-thread : pendant qu'il répond à la boucle,
 *    il ne répond à personne d'autre. Pas besoin de malveillance, un bogue de
 *    boucle dans le front suffit.
 * 3. **L'économie se fausse.** Répéter une route d'échange plus vite que le
 *    tick de simulation permet d'exploiter les écarts de cours.
 *
 * Le mécanisme est un **seau à jetons** : chaque clé dispose d'une réserve qui
 * se remplit à débit constant. Une rafale courte passe — c'est ce que fait un
 * écran qui se charge —, un débit soutenu au-dessus du remplissage ne passe
 * pas. Un compteur par fenêtre fixe, lui, laisserait passer deux fois la
 * limite à cheval sur la frontière des fenêtres.
 *
 * Tout vit en mémoire du processus : il n'y en a qu'un, et une limite de débit
 * qui se perd au redémarrage n'a aucune conséquence.
 */

import { createHash } from "node:crypto";

export type Bareme = {
  /** Réserve maximale : la rafale tolérée d'un coup. */
  capacite: number;
  /** Vitesse de remplissage, en jetons par seconde : le débit soutenu. */
  parSeconde: number;
};

export type ClasseRoute = "AUTH" | "INSCRIPTION" | "ECRITURE" | "LECTURE";

/**
 * Les trois barèmes `[GD]`.
 *
 * `AUTH` est sévère parce que c'est la seule classe où l'attaque est
 * *gratuite* : essayer un code ne coûte rien à qui essaie. Dix essais, puis un
 * toutes les trente secondes — cent mille combinaisons demanderaient alors
 * plus d'un mois par adresse.
 *
 * Les deux autres sont larges à dessein : ils arrêtent une boucle, pas un
 * joueur. Un écran de jeu qui s'ouvre déclenche une poignée d'appels ; on
 * tolère une rafale de soixante et un débit soutenu de deux par seconde, ce
 * qu'aucun geste humain n'atteint.
 */
export const BAREMES: Record<ClasseRoute, Bareme> = {
  AUTH: { capacite: 10, parSeconde: 1 / 30 },
  /**
   * S'inscrire n'est pas se connecter.
   *
   * Les deux partageaient le barème sévère, et c'était une erreur de
   * raisonnement : deviner un code est une attaque *gratuite* qu'il faut
   * étrangler, créer des comptes est un abus de volume qu'il suffit de
   * ralentir. Confondre les deux punissait le cas légitime — une famille, une
   * classe, un salon derrière une seule adresse — pour un risque qui n'est
   * pas le même.
   */
  INSCRIPTION: { capacite: 8, parSeconde: 1 / 20 },
  ECRITURE: { capacite: 60, parSeconde: 2 },
  LECTURE: { capacite: 120, parSeconde: 5 },
};

/** Chemins de connexion, reconnus sans préfixe `/api`. */
const CHEMINS_AUTH = ["/auth/login", "/auth/code"];
const CHEMINS_INSCRIPTION = ["/auth/register"];

/** À quelle classe appartient une requête. */
export function classer(methode: string, chemin: string): ClasseRoute {
  const nu = chemin.split("?")[0];
  const est = (liste: string[]) => liste.some((c) => nu === c || nu.startsWith(`${c}/`));
  if (est(CHEMINS_AUTH)) return "AUTH";
  if (est(CHEMINS_INSCRIPTION)) return "INSCRIPTION";
  return methode.toUpperCase() === "GET" || methode.toUpperCase() === "HEAD"
    ? "LECTURE"
    : "ECRITURE";
}

/**
 * La clé d'un appelant.
 *
 * On préfère le **jeton de session** à l'adresse IP : c'est lui qui identifie
 * un joueur, et deux joueurs derrière la même connexion familiale ne doivent
 * pas se gêner. Le jeton n'est pas conservé en clair — un condensé suffit à
 * distinguer deux appelants, et cette table vit longtemps en mémoire.
 *
 * Sans jeton — inscription, connexion, monde — on retombe sur l'adresse, qui
 * est alors la seule chose dont on dispose.
 */
export function cleAppelant(input: { authorization?: string; ip?: string }): string {
  const brut = input.authorization ?? "";
  const jeton = brut.startsWith("Bearer ") ? brut.slice(7).trim() : "";
  if (jeton) return `j:${createHash("sha256").update(jeton).digest("hex").slice(0, 24)}`;
  return `a:${input.ip ?? "inconnue"}`;
}

type Seau = { jetons: number; vu: number };

export type Verdict = {
  ok: boolean;
  /** Secondes à attendre avant le prochain essai — seulement si refusé. */
  attendreS: number;
};

/** Au-delà, un seau inactif ne sert plus à rien et libère sa place. */
const OUBLI_MS = 10 * 60 * 1000;

export class Limiteur {
  private seaux = new Map<string, Seau>();

  /**
   * Consomme un jeton, ou refuse.
   *
   * `maintenant` est injecté pour que les tests n'aient pas à dormir.
   */
  autorise(cle: string, bareme: Bareme, maintenant = Date.now()): Verdict {
    const seau = this.seaux.get(cle);
    if (!seau) {
      this.seaux.set(cle, { jetons: bareme.capacite - 1, vu: maintenant });
      return { ok: true, attendreS: 0 };
    }
    const ecoule = Math.max(0, maintenant - seau.vu) / 1000;
    seau.jetons = Math.min(bareme.capacite, seau.jetons + ecoule * bareme.parSeconde);
    seau.vu = maintenant;
    if (seau.jetons >= 1) {
      seau.jetons -= 1;
      return { ok: true, attendreS: 0 };
    }
    // Le temps qu'il faut pour qu'un jeton entier se reconstitue.
    const attendre = (1 - seau.jetons) / bareme.parSeconde;
    return { ok: false, attendreS: Math.max(1, Math.ceil(attendre)) };
  }

  /** Oublie les appelants qu'on n'a plus vus depuis longtemps. */
  purge(maintenant = Date.now()): number {
    let retires = 0;
    for (const [cle, seau] of this.seaux) {
      if (maintenant - seau.vu > OUBLI_MS) {
        this.seaux.delete(cle);
        retires++;
      }
    }
    return retires;
  }

  /** Nombre d'appelants suivis — pour les tests et le diagnostic. */
  get taille(): number {
    return this.seaux.size;
  }
}
