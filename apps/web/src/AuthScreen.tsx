import { useState } from "react";

import { RECOVERY_HELP, formatRecovery, isRecoveryCode } from "@farmsim/shared";

export type AuthMode = "register" | "login" | "recover";

type Props = {
  authMode: AuthMode;
  onAuthModeChange: (mode: AuthMode) => void;
  name: string;
  onNameChange: (name: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  accessCode: string;
  onAccessCodeChange: (code: string) => void;
  recoveryInput: string;
  onRecoveryInputChange: (code: string) => void;
  busy: boolean;
  msg: string | null;
  err: string | null;
  onRegister: () => void;
  onLogin: () => void;
  onRecover: () => void;
};

/**
 * Première page du jeu : rien d'autre que se connecter ou créer un compte.
 * Le choix du métier et de la terre arrive ensuite, dans l'installation guidée.
 */
export function AuthScreen({
  authMode,
  onAuthModeChange,
  name,
  onNameChange,
  email,
  onEmailChange,
  accessCode,
  onAccessCodeChange,
  recoveryInput,
  onRecoveryInputChange,
  busy,
  msg,
  err,
  onRegister,
  onLogin,
  onRecover,
}: Props) {
  const [showCode, setShowCode] = useState(false);
  const isRegister = authMode === "register";
  const isRecover = authMode === "recover";
  const canSubmit = isRecover
    ? email.includes("@") && isRecoveryCode(recoveryInput) && accessCode.length >= 3
    : isRegister
      ? name.trim().length >= 2 && email.includes("@") && accessCode.length >= 3
      : email.includes("@") && accessCode.length >= 1;

  function submit() {
    if (!canSubmit || busy) return;
    if (isRecover) onRecover();
    else if (isRegister) onRegister();
    else onLogin();
  }

  return (
    <div className="gate">
      <div className="gate-sky" aria-hidden="true">
        <span className="gate-sun" />
        <span className="gate-cloud c1" />
        <span className="gate-cloud c2" />
        <span className="gate-cloud c3" />
        <span className="gate-hill h1" />
        <span className="gate-hill h2" />
        <span className="gate-field" />
      </div>

      <main className="gate-inner">
        <img className="gate-logo" src="/logo.webp" alt="Farming Navigator" />

        <div className="gate-card">
          <div className="gate-tabs" role="tablist" aria-label="Accès au jeu">
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={`gate-tab ${isRegister ? "active" : ""}`}
              onClick={() => onAuthModeChange("register")}
            >
              Je débute
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={`gate-tab ${!isRegister ? "active" : ""}`}
              onClick={() => onAuthModeChange("login")}
            >
              J'ai un compte
            </button>
          </div>

          {isRecover && (
            <p className="gate-note">
              <strong>Code d'accès oublié.</strong> Il n'y a pas d'envoi d'e-mail sur ce
              serveur : c'est le code de secours remis à la création de votre ferme qui
              vous rouvre la porte. Vous choisissez un nouveau code d'accès dans la foulée.
            </p>
          )}

          <form
            className="gate-form"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {isRegister && (
              <label className="field">
                <span className="field-label">Votre nom d'exploitant</span>
                <input
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Jean Terroir"
                  autoComplete="nickname"
                  maxLength={32}
                />
              </label>
            )}

            <label className="field">
              <span className="field-label">Adresse e-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="vous@exemple.fr"
                autoComplete="email"
              />
            </label>

            {isRecover && (
              <label className="field">
                <span className="field-label">Code de secours</span>
                <input
                  className="mono"
                  value={recoveryInput}
                  onChange={(e) => onRecoveryInputChange(e.target.value)}
                  placeholder="A1B2-C3D4-E5F6-G7H8"
                  autoComplete="one-time-code"
                  spellCheck={false}
                  maxLength={32}
                />
                <span className="field-help">
                  Les tirets, les espaces et les minuscules sont sans importance.
                </span>
              </label>
            )}

            <label className="field">
              <span className="field-label">
                {isRecover
                  ? "Nouveau code d'accès"
                  : isRegister
                    ? "Choisissez un code d'accès"
                    : "Code d'accès"}
              </span>
              <span className="field-row">
                <input
                  type={showCode ? "text" : "password"}
                  value={accessCode}
                  onChange={(e) => onAccessCodeChange(e.target.value)}
                  placeholder={isRegister || isRecover ? "au moins 3 caractères" : "votre code"}
                  autoComplete={isRegister || isRecover ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="field-toggle"
                  onClick={() => setShowCode((v) => !v)}
                  aria-label={showCode ? "Masquer le code" : "Afficher le code"}
                >
                  {showCode ? "Masquer" : "Voir"}
                </button>
              </span>
              {isRegister && (
                <span className="field-help">
                  Ce code remplace le mot de passe. Notez-le : il vous servira à revenir.
                </span>
              )}
            </label>

            {(msg || err) && (
              <p className={`gate-alert ${err ? "bad" : "good"}`} role="status">
                {err ?? msg}
              </p>
            )}

            <button type="submit" className="btn-primary big" disabled={busy || !canSubmit}>
              {busy
                ? "Un instant…"
                : isRecover
                  ? "Changer mon code d'accès"
                  : isRegister
                    ? "Créer ma ferme"
                    : "Reprendre ma ferme"}
            </button>
          </form>

          {!isRegister && (
            <p className="gate-forgot">
              {isRecover ? (
                <button type="button" className="link" onClick={() => onAuthModeChange("login")}>
                  Revenir à la connexion
                </button>
              ) : (
                <button type="button" className="link" onClick={() => onAuthModeChange("recover")}>
                  Code d'accès oublié ?
                </button>
              )}
            </p>
          )}

          <p className="gate-switch">
            {isRegister ? (
              <>
                Déjà installé ?{" "}
                <button type="button" className="link" onClick={() => onAuthModeChange("login")}>
                  Se connecter
                </button>
              </>
            ) : (
              <>
                Première visite ?{" "}
                <button type="button" className="link" onClick={() => onAuthModeChange("register")}>
                  Créer un compte
                </button>
              </>
            )}
          </p>
        </div>

        <ul className="gate-pitch">
          <li>
            <strong>6 continents</strong>
            <span>Climats réels, saisons inversées</span>
          </li>
          <li>
            <strong>2 métiers</strong>
            <span>Céréalier ou éleveur — aidez les voisins pour gagner un peu</span>
          </li>
          <li>
            <strong>Marché vivant</strong>
            <span>Les cours bougent en continu</span>
          </li>
        </ul>
      </main>
    </div>
  );
}

/**
 * Le code de secours, remis une seule fois.
 *
 * Il barre l'écran et ne se ferme que par un bouton explicite. Un bandeau
 * discret serait balayé d'un clic distrait, et ce code-là ne se redemande
 * pas : le serveur n'en garde qu'une empreinte. Un joueur qui le rate perd
 * son unique filet.
 */
export function RecoveryNotice({ code, onClose }: { code: string; onClose: () => void }) {
  const [copie, setCopie] = useState(false);
  const lisible = formatRecovery(code);

  async function copier() {
    try {
      await navigator.clipboard.writeText(lisible);
      setCopie(true);
    } catch {
      // Presse-papiers refusé (page non sécurisée, permission) : le code
      // reste affiché en gros, il est recopiable à la main. Rien à signaler.
      setCopie(false);
    }
  }

  return (
    <div className="recovery-veil" role="dialog" aria-modal="true" aria-label="Code de secours">
      <div className="recovery-card">
        <h2>Votre code de secours</h2>
        <p className="recovery-why">{RECOVERY_HELP}</p>
        <p className="recovery-code mono">{lisible}</p>
        <div className="recovery-actions">
          <button type="button" className="btn-ghost" onClick={copier}>
            {copie ? "Copié" : "Copier"}
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Je l'ai noté
          </button>
        </div>
      </div>
    </div>
  );
}
