import type { ReactNode } from "react";

import type { Scene } from "./tutorial-steps";

type Props = { scene: Scene; tactile: boolean };

const OUTILS = [
  ["Voir", "/assets/icons/tools/select.svg"],
  ["Semer", "/assets/icons/tools/plant.svg"],
  ["Sol", "/assets/icons/tools/plow.svg"],
  ["Récolte", "/assets/icons/tools/harvest.svg"],
] as const;

const PANNEAUX = [
  ["Parcelle", "/assets/icons/nav/parcelle.svg"],
  ["Bâtir", "/assets/icons/nav/batir.svg"],
  ["Troupeau", "/assets/icons/nav/troupeau.svg"],
  ["Personnel", "/assets/icons/nav/personnel.svg"],
] as const;

function Texte({ x, y, children, classe = "" }: { x: number; y: number; children: ReactNode; classe?: string }) {
  return <text className={`tuto-txt ${classe}`} x={x} y={y}>{children}</text>;
}

function Curseur({ tactile, classe }: { tactile: boolean; classe: string }) {
  return tactile ? (
    <g className={`tuto-curseur ${classe}`}>
      <circle className="tuto-doigt-halo" r={9} />
      <circle className="tuto-doigt" r={4.5} />
    </g>
  ) : (
    <g className={`tuto-curseur ${classe}`}>
      <path className="tuto-fleche" d="M0 0v14l4-3 4 7 4-2-4-7 6-1z" />
    </g>
  );
}

type Etat = "normal" | "selection" | "pousse" | "mur" | "sale" | "chaume" | "fertile";

function Grille({ etat = "normal" }: { etat?: Etat }) {
  const classes: Record<number, string> = etat === "normal" ? {} : { 1: etat, 2: etat, 5: etat, 6: etat };
  return (
    <g className="tuto-grille">
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} className={`tuto-case ${classes[i] ?? ""}`} x={9 + (i % 4) * 27} y={20 + Math.floor(i / 4) * 20} width={23} height={16} rx={2.4} />
      ))}
    </g>
  );
}

function MiniHud() {
  return (
    <g className="tuto-hud">
      <rect x="5" y="5" width="150" height="11" rx="5.5" />
      <circle cx="13" cy="10.5" r="2.7" />
      <Texte x={27} y={12.5} classe="micro left">PRINTEMPS · 08:20</Texte>
      <Texte x={146} y={12.5} classe="micro right">24 680 €</Texte>
    </g>
  );
}

function Dock({ actif = "", plus = false }: { actif?: string; plus?: boolean }) {
  const items = [...OUTILS, [plus ? "Fermer" : "Plus", ""] as const, ["Trace", ""] as const];
  return (
    <g className="tuto-dock">
      <rect className="tuto-dock-bg" x="4" y="78" width="152" height="23" rx="8" />
      {items.map(([label, icon], i) => {
        const x = 8 + i * 24;
        const on = actif === label || (label === "Fermer" && actif === "Plus");
        return (
          <g key={label} className={on ? "on" : ""}>
            <rect className="tuto-dock-item" x={x} y="81" width="18" height="17" rx="4" />
            {icon ? <image href={icon} x={x + 5} y="82.5" width="8" height="8" /> : <Texte x={x + 9} y={89} classe="dock-symbol">{label === "Trace" ? "✎" : plus ? "×" : "☰"}</Texte>}
            <Texte x={x + 9} y={95.5} classe="dock-label">{label}</Texte>
          </g>
        );
      })}
    </g>
  );
}

function EcranFerme({ children, actif = "", plus = false, etat = "normal" }: { children?: ReactNode; actif?: string; plus?: boolean; etat?: Etat }) {
  return (
    <>
      <rect className="tuto-screen" x="1" y="1" width="158" height="102" rx="10" />
      <MiniHud />
      <rect className="tuto-farm" x="5" y="18" width="150" height="58" rx="7" />
      <path className="tuto-road" d="M5 66C39 53 60 72 91 57s42-4 64-17" />
      <Grille etat={etat} />
      <g className="tuto-barn-mini"><rect x="126" y="27" width="20" height="14" rx="2" /><path d="m123 28 13-9 13 9z" /></g>
      {children}
      <Dock actif={actif} plus={plus} />
    </>
  );
}

function OutilTray({ actif, options }: { actif: string; options: string[] }) {
  return (
    <g className="tuto-tray">
      <rect x="5" y="60" width="150" height="17" rx="6" />
      {options.map((label, i) => (
        <g key={label} className={label === actif ? "on" : ""}>
          <rect x={10 + i * 34} y="64" width="30" height="9" rx="4.5" />
          <Texte x={25 + i * 34} y={70.3} classe="chip-label">{label}</Texte>
        </g>
      ))}
    </g>
  );
}

type Lieu = "cooperative" | "concession" | "mairie";

/**
 * Où tombe chaque bâtiment sur la capture du village, en unités de scène :
 * le pied du bâtiment (halo) et le point que le doigt vient toucher.
 */
const LIEUX: Record<Lieu, { nom: string; x: number; y: number; sol: number }> = {
  cooperative: { nom: "Coopérative", x: 27, y: 42, sol: 52 },
  concession: { nom: "Concession", x: 79, y: 44, sol: 53 },
  mairie: { nom: "Mairie", x: 131, y: 43, sol: 53 },
};

/**
 * Le village tel qu'il est dans le jeu — une vraie capture, pas un dessin.
 * Les deux autres bâtiments s'effacent sous un voile, celui de l'étape
 * s'éclaire, le doigt le touche, puis la fenêtre qu'il ouvre apparaît : le
 * geste entier, pas seulement son résultat.
 */
function EcranVillage({ lieu, tactile, children }: { lieu: Lieu; tactile: boolean; children: ReactNode }) {
  const l = LIEUX[lieu];
  return (
    <>
      <rect className="tuto-screen" x="1" y="1" width="158" height="102" rx="10" />
      <MiniHud />
      <defs>
        <clipPath id={`tuto-village-cadre-${lieu}`}>
          <rect x="5" y="18" width="150" height="58" rx="7" />
        </clipPath>
        {/* Un trou aux bords fondus : un cercle net faisait projecteur. */}
        <radialGradient id={`tuto-village-fondu-${lieu}`}>
          <stop offset="0.55" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
        <mask id={`tuto-village-trou-${lieu}`}>
          <rect x="0" y="0" width="160" height="104" fill="#fff" />
          <ellipse cx={l.x} cy={l.y + 2} rx="30" ry="23" fill={`url(#tuto-village-fondu-${lieu})`} />
        </mask>
      </defs>
      <g clipPath={`url(#tuto-village-cadre-${lieu})`}>
        <image href="/assets/tuto/village.webp" x="5" y="18" width="150" height="58" preserveAspectRatio="xMidYMid slice" />
        <rect className="tuto-village-voile" x="5" y="18" width="150" height="58" mask={`url(#tuto-village-trou-${lieu})`} />
      </g>
      <ellipse className="tuto-village-halo" cx={l.x} cy={l.sol} rx="22" ry="7" />
      <g className="tuto-village-nom">
        <rect x={l.x - 17} y="20.5" width="34" height="7" rx="3.5" />
        <Texte x={l.x} y={25.4} classe="village-nom">{l.nom.toUpperCase()}</Texte>
      </g>
      <Curseur tactile={tactile} classe={`vers-${lieu}`} />
      <g className="tuto-lieu-fenetre">{children}</g>
      <Dock />
    </>
  );
}

export function TutorialScene({ scene, tactile }: Props) {
  return <div className={`tuto-scene scene-${scene}`} aria-hidden="true"><svg viewBox="0 0 160 104" role="img">{rendre(scene, tactile)}</svg></div>;
}

function rendre(scene: Scene, tactile: boolean) {
  switch (scene) {
    case "interface":
      return <EcranFerme><g className="tuto-callouts"><path d="M18 15v13"/><Texte x={28} y={28} classe="callout left">statut</Texte><path d="M114 43h31"/><Texte x={112} y={40} classe="callout right">ferme</Texte><path d="M82 76v10"/><Texte x={82} y={74} classe="callout">commandes</Texte></g></EcranFerme>;

    case "onglets":
      return (
        <EcranFerme actif="Plus" plus>
          <rect className="tuto-scrim" x="1" y="1" width="158" height="77" rx="10" />
          <g className="tuto-drawer">
            <rect x="19" y="18" width="122" height="56" rx="8" />
            <Texte x={29} y={27} classe="drawer-title left">PANNEAUX</Texte>
            {PANNEAUX.map(([label, icon], i) => {
              const x = 27 + (i % 2) * 54;
              const y = 31 + Math.floor(i / 2) * 20;
              return <g key={label} className="drawer-item"><rect x={x} y={y} width="52" height="17" rx="4"/><image href={icon} x={x + 3} y={y + 3} width="8" height="8"/><Texte x={x + 19} y={y + 10.5} classe="drawer-label">{label}</Texte></g>;
            })}
          </g>
          <Curseur tactile={tactile} classe="vers-plus" />
        </EcranFerme>
      );

    case "outils":
      return <EcranFerme actif="Semer"><OutilTray actif="Blé" options={["Blé", "Orge", "Maïs", "Colza"]}/><Curseur tactile={tactile} classe="vers-semer" /></EcranFerme>;

    case "selection":
      return <EcranFerme actif="Semer" etat="selection">{!tactile && <rect className="tuto-lasso" x="33" y="19" width="54" height="39" rx="3" />}<Curseur tactile={tactile} classe={tactile ? "tapote" : "glisse"} /></EcranFerme>;

    case "chantier":
      return <EcranFerme actif="Semer" etat="selection"><g className="tuto-action"><rect x="104" y="62" width="47" height="12" rx="6"/><Texte x={127.5} y={70} classe="action-label">Semer ×4</Texte></g><g className="tuto-tracteur"><rect x="-8" y="-4" width="13" height="8" rx="2"/><circle cx="-4" cy="5" r="3"/><circle cx="4" cy="5" r="3"/></g><Curseur tactile={tactile} classe="vers-faire" /></EcranFerme>;

    case "desherber":
      return <EcranFerme actif="Sol" etat="sale"><OutilTray actif="Désherber" options={["Désherber", "Déchaumer", "Labourer", "Engrais"]}/><g className="tuto-herbes">{[1,2,5,6].map((i) => { const x=20+(i%4)*27,y=31+Math.floor(i/4)*20; return <path key={i} d={`M${x-3} ${y+3}q1-7 3-9m0 9q4-6 5-8m-5 8q-4-5-5-7`}/>; })}</g></EcranFerme>;

    case "dechaumer":
      return <EcranFerme actif="Sol" etat="chaume"><OutilTray actif="Déchaumer" options={["Désherber", "Déchaumer", "Labourer", "Engrais"]}/><g className="tuto-cultivateur"><path d="M11 29h99M14 34h96M14 50h96"/><circle cx="41" cy="40" r="4"/><circle cx="68" cy="40" r="4"/></g></EcranFerme>;

    case "fertiliser":
      return <EcranFerme actif="Sol" etat="fertile"><OutilTray actif="Engrais" options={["Désherber", "Déchaumer", "Labourer", "Engrais"]}/><g className="tuto-engrais"><circle cx="49" cy="37" r="17"/><Texte x={49} y={34} classe="nutrient">N</Texte><Texte x={49} y={43} classe="nutrient-value">72%</Texte><path d="M84 27c12 5 12 17 0 24"/></g></EcranFerme>;

    case "pousse":
      return <EcranFerme etat="pousse"><g className="tuto-growth"><path d="M19 34q3-9 6 0m-3 0V23M47 34q3-13 6 0m-3 0V19M73 34q3-17 6 0m-3 0V15"/><rect x="18" y="62" width="87" height="6" rx="3"/><rect className="fill" x="18" y="62" width="60" height="6" rx="3"/><Texte x={126} y={67} classe="growth-label">68 %</Texte></g></EcranFerme>;

    case "recolte":
      return <EcranFerme actif="Récolte" etat="mur"><g className="tuto-moisson"><rect x="-9" y="-5" width="15" height="9" rx="2"/><path d="M6-3h7v7H6"/><circle cx="-5" cy="5" r="3"/><circle cx="4" cy="5" r="3"/></g><g className="tuto-silo"><rect x="119" y="40" width="21" height="24" rx="7"/><path d="m118 42 12-7 12 7"/><Texte x={129} y={55} classe="silo-label">SILO</Texte><path className="grain-route" d="M85 38c17 0 18 13 33 13"/></g></EcranFerme>;

    case "cooperative":
      return (
        <EcranVillage lieu="cooperative" tactile={tactile}>
          <g className="tuto-market"><rect x="14" y="21" width="132" height="50" rx="7"/><Texte x={23} y={30} classe="market-title left">HÔTEL DES VENTES</Texte><Texte x={23} y={42} classe="market-crop left">Blé · 8,4 t</Texte><polyline points="23,62 42,55 58,58 78,44 97,48 119,33 138,37"/><circle cx="119" cy="33" r="3"/><rect x="103" y="56" width="35" height="10" rx="5"/><Texte x={120.5} y={62.8} classe="sell-label">Vendre</Texte></g>
        </EcranVillage>
      );

    case "concession":
      return (
        <EcranVillage lieu="concession" tactile={tactile}>
          <g className="tuto-carte"><rect x="14" y="21" width="132" height="50" rx="7"/><Texte x={23} y={30} classe="card-title left">GARAGE</Texte>{([["Tracteur 120 ch", 0.82, "Graisser"], ["Moissonneuse", 0.46, "Réparer"]] as const).map(([nom, etat, geste], i) => <g key={nom} transform={`translate(0 ${i * 17})`}><Texte x={23} y={41} classe="staff-name left">{nom}</Texte><rect className="garage-jauge-fond" x="23" y="44" width="70" height="3.6" rx="1.8"/><rect className={`garage-jauge${etat < 0.5 ? " basse" : ""}`} x="23" y="44" width={70 * etat} height="3.6" rx="1.8"/><rect className="tuto-bouton" x="108" y="37" width="30" height="10" rx="5"/><Texte x={123} y={43.8} classe="assign-label">{geste}</Texte></g>)}</g>
        </EcranVillage>
      );

    case "mairie":
      return (
        <EcranVillage lieu="mairie" tactile={tactile}>
          <g className="tuto-carte"><rect x="14" y="21" width="132" height="50" rx="7"/><Texte x={23} y={30} classe="card-title left">BUREAU</Texte>{["Objectifs", "Prendre", "Banque", "Terres"].map((t, i) => <g key={t} className={i === 0 ? "bureau-onglet on" : "bureau-onglet"}><rect x={23 + i * 29} y="34" width="26" height="8" rx="4"/><Texte x={36 + i * 29} y={39.4} classe="onglet-label">{t}</Texte></g>)}<Texte x={23} y={53} classe="staff-name left">Construire un silo</Texte><Texte x={23} y={60} classe="staff-detail left">Terminé · 1 500 € à réclamer</Texte><rect className="tuto-bouton" x="108" y="51" width="30" height="10" rx="5"/><Texte x={123} y={57.8} classe="assign-label">Réclamer</Texte></g>
        </EcranVillage>
      );

    case "batir":
      return <EcranFerme actif="Plus"><g className="tuto-build"><rect className="bad" x="12" y="21" width="48" height="36" rx="4"/><rect className="good" x="66" y="21" width="48" height="36" rx="4"/><path d="M72 49V34l18-10 18 10v15z"/><Texte x={36} y={42} classe="bad-label">occupé</Texte><Texte x={90} y={64} classe="good-label">emprise libre</Texte></g><Curseur tactile={tactile} classe="vers-emprise" /></EcranFerme>;

    case "troupeau":
      return <EcranFerme actif="Plus"><g className="tuto-herd-card"><rect x="13" y="20" width="132" height="51" rx="7"/><Texte x={22} y={29} classe="card-title left">TROUPEAU · ÉTABLE 1</Texte>{[0,1,2].map((i)=><g key={i} transform={`translate(${28+i*30} 42)`}><ellipse rx="9" ry="5"/><circle cx="8" cy="-3" r="3"/><path d="M-5 4v5m9-5v5"/></g>)}<rect className="ration-bg" x="21" y="56" width="80" height="7" rx="3.5"/><rect className="ration" x="21" y="56" width="58" height="7" rx="3.5"/><Texte x={124} y={62} classe="ration-label">18 h</Texte></g></EcranFerme>;

    case "personnel":
      return <EcranFerme actif="Plus"><g className="tuto-staff"><rect x="13" y="20" width="132" height="52" rx="7"/><Texte x={22} y={29} classe="card-title left">PERSONNEL</Texte>{[["Léa","Champs","3 chantiers"],["Noé","Élevage","Ration +12%"]].map(([nom,poste,detail],i)=><g key={nom} transform={`translate(0 ${i*18})`}><circle cx="27" cy="39" r="6"/><path d="M20 49q7-9 14 0"/><Texte x={40} y={39} classe="staff-name left">{nom}</Texte><Texte x={40} y={46} classe="staff-detail left">{poste} · {detail}</Texte><rect x="112" y="35" width="25" height="10" rx="5"/><Texte x={124.5} y={42} classe="assign-label">Affecter</Texte></g>)}</g></EcranFerme>;
  }
}
