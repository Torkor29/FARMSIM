import { useState } from "react";

type Props = {
  authMode: "register" | "login";
  onAuthModeChange: (mode: "register" | "login") => void;
  name: string;
  onNameChange: (name: string) => void;
  email: string;
  onEmailChange: (email: string) => void;
  accessCode: string;
  onAccessCodeChange: (code: string) => void;
  busy: boolean;
  msg: string | null;
  err: string | null;
  onRegister: () => void;
  onLogin: () => void;
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
  busy,
  msg,
  err,
  onRegister,
  onLogin,
}: Props) {
  const [showCode, setShowCode] = useState(false);
  const isRegister = authMode === "register";
  const canSubmit = isRegister
    ? name.trim().length >= 2 && email.includes("@") && accessCode.length >= 3
    : email.includes("@") && accessCode.length >= 1;

  function submit() {
    if (!canSubmit || busy) return;
    if (isRegister) onRegister();
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

            <label className="field">
              <span className="field-label">
                {isRegister ? "Choisissez un code d'accès" : "Code d'accès"}
              </span>
              <span className="field-row">
                <input
                  type={showCode ? "text" : "password"}
                  value={accessCode}
                  onChange={(e) => onAccessCodeChange(e.target.value)}
                  placeholder={isRegister ? "au moins 3 caractères" : "votre code"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
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
                : isRegister
                  ? "Créer ma ferme"
                  : "Reprendre ma ferme"}
            </button>
          </form>

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
