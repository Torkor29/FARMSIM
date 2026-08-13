import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CharacterShowcase } from "./CharacterShowcase";
import "./styles.css";
import "./atelier.css";
import "./auth.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CharacterShowcase />
  </StrictMode>,
);
