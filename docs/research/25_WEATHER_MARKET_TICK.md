# 25 — Tick météo & marché + brush

## Tick serveur (MVP)

Intervalle : `SIM_TICK_MS` = **20 s** `[TEST]`.

### Météo
- Chaîne de Markov par zone (`tickWeather`) selon Köppen (C* océanique / D* continental).
- États : CLEAR · CLOUDY · RAIN · STORM · SNOW
- Effets :
  - **Récolte** : malus humidité pluie/orage/neige (`moisturePenalty`)
  - **Rendement estimé** : `weatherYieldFactor` (orage/neige −)

### Marché
- Chaque tick : `marketNpcPressure(weather)` → offre/demande NPC
- Orages → offre ↓, demande ↑ → prix ↑
- `tickMarket` borne les prix (`MARKET_BOUNDS`)

### API
- `GET /weather` · `GET /market` · `GET /sim/status`
- `POST /sim/tick` (force un tick)

## Brush semis / actions

Tailles **1 · 2 · 3** : un clic sélectionne un carré N×N pour plant / ferti / harvest.
