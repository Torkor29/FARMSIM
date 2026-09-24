/**
 * L'envoi de courrier — et pourquoi il n'y en avait pas.
 *
 * Pendant toute la vie du jeu, ce serveur n'a rien envoyé : pas de SMTP, pas
 * de service tiers. C'était assumé, et un **code de secours** remis à
 * l'inscription en tenait lieu, parce qu'il fonctionnait hors ligne. Il a été
 * retiré le jour où ce module est entré en service : deux voies pour le même
 * oubli, c'était deux écrans à expliquer et une fenêtre imposée à
 * l'inscription pour faire recopier un code que personne ne relisait.
 *
 * ## Le choix du fournisseur s'est fait sur une mesure, pas sur une préférence
 *
 * La question posée était « Gmail ? ». La réponse tient dans le DNS du
 * domaine :
 *
 *     MX  : mx1.mail.ovh.net, mx2, mx3
 *     TXT : v=spf1 include:mx.ovh.com -all
 *
 * Ce `-all` est un refus dur : il déclare qu'aucun serveur hors OVH n'a le
 * droit de parler au nom du domaine. Un courriel parti par Gmail depuis
 * `noreply@farming-navigator.com` échouerait SPF et finirait rejeté ou en
 * indésirables — le sort le plus coûteux possible pour un message dont tout
 * l'objet est d'arriver. Passer par OVH, c'est n'avoir rien à changer.
 *
 * ## Générique par construction
 *
 * Rien ici ne connaît OVH. Le transport se lit dans l'environnement, et
 * changer de fournisseur est un changement de configuration, pas de code.
 * C'est délibéré : le jour où une limite d'envoi ou un incident impose de
 * basculer, la bascule ne doit pas être un chantier.
 *
 * ## Absent par défaut, et c'est un mode de fonctionnement
 *
 * Sans `FARMSIM_SMTP_HOST`, ce module ne tente rien et le dit. L'écran
 * n'offre alors pas le lien par courriel, et le dépannage repasse tout entier
 * par `scripts/farmsim-code-secours.sh`, côté serveur. C'est ce qui permet de
 * faire tourner la suite de tests sans serveur de messagerie — un module qui
 * exigerait sa configuration pour se charger rendrait cela impossible.
 */

import { createTransport, type Transporter } from "nodemailer";

/** Ce qu'il faut pour parler à un serveur d'envoi. */
export type ReglagesCourriel = {
  hote: string;
  port: number;
  /** Connexion chiffrée d'emblée (465) plutôt que hissée par STARTTLS (587). */
  sansHausse: boolean;
  utilisateur: string;
  motDePasse: string;
  /** L'expéditeur affiché, `Nom <adresse>` ou une adresse nue. */
  expediteur: string;
};

/**
 * Les réglages, lus dans l'environnement.
 *
 * Nuls si `FARMSIM_SMTP_HOST` manque : c'est le seul drapeau, pour qu'il n'y
 * ait pas d'état à moitié configuré où l'on croirait envoyer sans envoyer.
 */
export function reglagesDepuisEnv(env: NodeJS.ProcessEnv = process.env): ReglagesCourriel | null {
  const hote = env.FARMSIM_SMTP_HOST?.trim();
  if (!hote) return null;
  const port = Number(env.FARMSIM_SMTP_PORT ?? 465);
  const utilisateur = env.FARMSIM_SMTP_USER?.trim() ?? "";
  const motDePasse = env.FARMSIM_SMTP_PASS ?? "";
  if (!utilisateur || !motDePasse) return null;
  return {
    hote,
    port: Number.isFinite(port) && port > 0 ? port : 465,
    /*
     * Déduit du port plutôt que demandé, parce que c'est la source d'erreur
     * numéro un : 465 parle TLS dès la poignée de main, 587 commence en clair
     * et monte par STARTTLS. Se tromper donne une erreur de poignée de main
     * illisible, pas un message d'aide.
     */
    sansHausse: (Number.isFinite(port) ? port : 465) === 465,
    utilisateur,
    motDePasse,
    /* Par défaut l'utilisateur lui-même : sur la plupart des hébergeurs,
       écrire depuis une adresse qu'on n'a pas authentifiée est refusé. */
    expediteur: env.FARMSIM_SMTP_FROM?.trim() || utilisateur,
  };
}

/** Le courrier est-il configuré sur cette instance ? */
export function courrielConfigure(env: NodeJS.ProcessEnv = process.env): boolean {
  return reglagesDepuisEnv(env) !== null;
}

/**
 * L'origine publique du jeu, pour composer les liens.
 *
 * Elle ne se devine pas depuis une requête : `Host` et `X-Forwarded-Host`
 * viennent du client, et un lien de réinitialisation composé depuis un en-tête
 * fourni par l'attaquant est le manuel du vol de jeton. On la lit donc dans
 * l'environnement, où seul l'exploitant écrit.
 */
export function origineDuJeu(env: NodeJS.ProcessEnv = process.env): string {
  return (env.FARMSIM_PUBLIC_URL?.trim() || "https://farming-navigator.com").replace(/\/+$/, "");
}

let transport: Transporter | null = null;

/** Le transport, créé une fois — il tient un bassin de connexions. */
function transportPour(r: ReglagesCourriel): Transporter {
  transport ??= createTransport({
    host: r.hote,
    port: r.port,
    secure: r.sansHausse,
    auth: { user: r.utilisateur, pass: r.motDePasse },
  });
  return transport;
}

/** Remet le transport à zéro — les tests changent d'environnement. */
export function oublierTransport(): void {
  transport = null;
}

export type Courriel = {
  destinataire: string;
  objet: string;
  texte: string;
  html?: string;
};

/**
 * Envoie, ou dit pourquoi il n'a pas pu.
 *
 * Ne lève jamais. Les appelants sont des routes publiques, et un serveur de
 * messagerie injoignable ne doit pas rendre une erreur 500 à un joueur qui a
 * seulement demandé un lien — pas plus qu'il ne doit lui dire que l'envoi a
 * échoué, ce qui révélerait au passage que son adresse est connue.
 */
export async function envoyerCourriel(
  courriel: Courriel,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ envoye: boolean; raison?: string }> {
  const r = reglagesDepuisEnv(env);
  if (!r) return { envoye: false, raison: "courrier non configuré" };
  try {
    await transportPour(r).sendMail({
      from: r.expediteur,
      to: courriel.destinataire,
      subject: courriel.objet,
      text: courriel.texte,
      html: courriel.html,
    });
    return { envoye: true };
  } catch (e) {
    const raison = e instanceof Error ? e.message : String(e);
    /* Au journal et nulle part ailleurs : c'est l'exploitant qui doit voir
       qu'un envoi échoue, pas le joueur. */
    console.error("envoi de courriel en échec", raison);
    return { envoye: false, raison };
  }
}
