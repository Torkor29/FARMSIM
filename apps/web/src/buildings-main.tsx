import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BuildingShowcase } from "./BuildingShowcase";
import "./atelier.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BuildingShowcase />
  </StrictMode>,
);
