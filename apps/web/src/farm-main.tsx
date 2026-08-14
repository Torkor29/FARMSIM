import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FarmShowcase } from "./FarmShowcase";
import "./styles.css";
import "./atelier.css";
import "./auth.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FarmShowcase />
  </StrictMode>,
);
