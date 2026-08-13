import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MachineShowcase } from "./MachineShowcase";
import "./atelier.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MachineShowcase />
  </StrictMode>,
);
