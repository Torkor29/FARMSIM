/**
 * Comptes développeurs.
 *
 * Les outils de test et la trésorerie illimitée ne s'ouvrent pas à tout le
 * monde : une variable d'environnement globale (`FARMSIM_DEV_TOOLS`) le
 * ferait pour n'importe qui de connecté. On tient donc une liste nominative
 * d'adresses, plus celles passées par `FARMSIM_TESTERS`.
 */

/** Compte de développement du jeu — trésorerie illimitée et panneau Test. */
export const DEV_OWNER_EMAIL = "juju.dolou@gmail.com";

/**
 * Solde affiché pour un compte illimité.
 *
 * L'interface compare encore `crd` au prix avant d'activer un bouton. Un
 * montant assez grand pour couvrir n'importe quel achat évite de tout
 * débrancher côté écran, sans jamais s'écrire en base : le serveur refuse
 * simplement de débiter.
 */
export const DEV_DISPLAY_CRD = 99_999_999;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function testerEmails(extraEnv?: string | null): Set<string> {
  const set = new Set<string>([DEV_OWNER_EMAIL]);
  if (extraEnv) {
    for (const part of extraEnv.split(",")) {
      const n = normalizeEmail(part);
      if (n) set.add(n);
    }
  }
  return set;
}

export function isDevEmail(email: string, extraEnv?: string | null): boolean {
  return testerEmails(extraEnv).has(normalizeEmail(email));
}

export function isDevAccount(
  user: { email: string; dev?: boolean | null },
  extraEnv?: string | null,
): boolean {
  return Boolean(user.dev) || isDevEmail(user.email, extraEnv);
}

export function canAfford(
  user: { email: string; crd: number; dev?: boolean | null },
  cost: number,
  extraEnv?: string | null,
): boolean {
  if (isDevAccount(user, extraEnv)) return true;
  return user.crd >= cost;
}
