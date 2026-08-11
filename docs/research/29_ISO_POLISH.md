# 29 — Polish vue isométrique (machines + feedback)

> Première version jouable : distinguer les engins, idle léger, flash d’action.

---

## Objectif

Rendre la grille Three.js lisible sans casser le raycast clic (dalles seules = pickables).

## Distinction machines

| Type | Couleur iso | Silhouette |
|------|-------------|------------|
| TRACTOR | Vert (`isoColor: green`) | Cabine courte |
| HARVESTER | Rouge / or | Header + tube |
| SPREADER | Gris + cuve ambre | Cylindre horizontal |

Réf. `MACHINE_DEFS.isoColor` + meshes dans `IsoFarmView`.

## Animations

1. **Idle** — bob Y + micro-avance X + yaw léger sur véhicules stationnés (phase par case).
2. **Pulse** — prop `pulseCells` : flash ~0,55 s sur dalles (lerp couleur or).
3. **Travail** — prop `activeWork?: { type, cells }` : engin temporaire qui interpolé le long des cases (~0,28 s / case).

## Props IsoFarmView

```ts
pulseCells?: { x: number; y: number }[];
activeWork?: { type: MachineType; cells: { x, y }[] } | null;
// IsoCell.machineType pour VEHICLE
```

## Perf (notes)

- Un seul `requestAnimationFrame` ; pas de lights supplémentaires.
- Layout grille ~350 ms (inchangé) ; idle/pulse/work dans le tick (pas de re-render React).
- Engins hors `pickables` → clic stable.
- Pixel ratio plafonné à 2 ; meshes low-poly (boxes / cylinders).

## HUD lié

- Niveau + XP dans la topbar.
- Badge discret « Première version · MVP ».
