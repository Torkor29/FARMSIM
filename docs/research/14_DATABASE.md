# 14 — Database (modèle conceptuel)

---

## 1. Entités & relations (MVP→cible)

```
User 1──1 PlayerProfile
User 1──* CurrencyBalance (CRD, PRM)
User 1──* Farm
Farm 1──* Parcel
Parcel *──1 Zone
Zone *──1 MacroRegion
MacroRegion *──1 Country

Parcel 1──* FieldState (historique / courant)
FieldState *──1 Crop
FieldState *──1 SeedVariant
SeedVariant *──1 Seed / Crop

Farm 1──* Machine
Farm 1──* AnimalGroup (V1)
Farm 1──* Building
Farm 1──1 Inventory / * InventoryItem
Farm 1──* WarehouseStock

Market 1──* MarketListing (NPC tick prices)
MarketOrder (V1 limits)
Transaction *──1 User (audit)
Contract (prestations) *── User (client, provider)
Worker / NPCHelper (plus tard)
WeatherEvent *── Zone
ResearchProject *── Farm (V1)
Skill / Specialization *── User
```

---

## 2. Tables clés (sketch SQL)

### users
`id, email, password_hash, created_at, status, locale`

### player_profiles
`user_id, display_name, level, xp, specialization, reputation`

### currency_balances
`user_id, currency_code, amount` + ledger `currency_ledger(id, user_id, delta, reason, ref_type, ref_id, created_at)`

### countries / macro_regions / zones
Attributs climatiques baked : `koppen, temp_norms jsonb, precip_norms jsonb, soil_class, risk_weights jsonb`

### parcels
`id, zone_id, owner_farm_id nullable, grid_w, grid_h, land_price, aptitude jsonb, status`

### farms
`id, user_id, name, hq_parcel_id`

### crops / seed_variants
Stats variants (yield, resists…)

### field_states
`parcel_id, cell_mask/grid jsonb, crop_id, variant_id, stage, planted_at, fertility, moisture, weed, disease, quality_acc`

### machines
`id, farm_id, type, tier, condition, fuel, stats jsonb`

### inventory_items / warehouse_stocks
`item_code, qty, quality_grade, farm_id`

### market_prices
`commodity, price, stock_global, tick_at`

### market_sales
`id, farm_id, commodity, qty, grade, price, tick_at`

### contracts
`id, client_id, provider_id, type, parcel_id, cells, price, escrow, status, deadlines`

### transactions
Audit générique polymorphe

### weather_events
`zone_id, type, intensity, start_at, end_at`

### research_projects (V1)
`farm_id, branch, progress, active_variant_id`

---

## 3. Règles d’intégrité

- Soldes jamais négatifs (contraintes + transactions)
- Inventaire muté uniquement via fonctions serveur
- Escrow contrats : fonds lockés
- `currency_ledger` append-only

---

## 4. Indexation

- `parcels(zone_id, owner_farm_id)`
- `field_states(parcel_id)`
- `market_prices(commodity, tick_at desc)`
- `contracts(status, provider_id)`
- GIS optionnel plus tard (`postgis` pour lat/lon)

---

## 5. Partitioning futur

- `currency_ledger` par mois
- `market_sales` par mois
- parcels par continent/region id

---

## 6. Migrations

Prisma ou Drizzle (TypeScript) `[PROPOSITION]` pour vitesse Nest ; SQL migrations versionnées.
