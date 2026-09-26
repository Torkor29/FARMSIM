import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./auth.css";
// Le thème du jeu passe en dernier : il reteinte les jetons et habille les composants.
import "./theme-jeu.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
