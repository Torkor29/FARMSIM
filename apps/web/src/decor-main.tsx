import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DecorShowcase } from "./DecorShowcase";
import "./atelier.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DecorShowcase />
  </StrictMode>,
);
