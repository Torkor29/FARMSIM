# 30 — Première version jouable ✅

**Statut : atteinte** (2026-08-11) — boucle smoke E2E validée sur API + build web.

## Jouable

| # | Système | OK | Notes |
|---|---------|:--:|-------|
| 1 | Auth / session | ✅ | Register + login · token Bearer · résumé de retour |
| 2 | Grille parcelle | ✅ | 12×12 · cultures · bâtiments · parking · brush 1–3 |
| 3 | Machines | ✅ | Achat · usure · réparation · prérequis semis/récolte |
| 4 | Marché | ✅ | Ticker · vente · stock |
| 5 | Météo | ✅ | Tick 20 s · impact récolte/ciel |
| 6 | ETA | ✅ | Contrats NPC · spé sans terre |
| 7 | Session resume | ✅ | Hint absence · delta marché/météo/cultures |
| 8 | Humidité / séchage | ✅ | Récolte humide · `POST /inventory/dry` · malus vente |
| 9 | Carte zones | ✅ | Grille onboarding + expansion |
| 10 | Polish iso | ✅ | Engins distincts · idle · pulse travail · Nv/XP |

## Smoke E2E (API)

1. Register céréalier → plant (tracteur) → buy moissonneuse  
2. Force ready + pluie → harvest (humidité 22 %) → dry → sell (malus si encore humide)  
3. Login / `/auth/me` OK  

## Hors scope (n’empêche pas la 1ʳᵉ version)

Multi live, élevage profond, globe H3, R&D, cash réel, OAuth/bcrypt prod.

## Lancer

```bash
pnpm --filter @farmsim/shared build && pnpm --filter @farmsim/sim build
cd apps/api && pnpm prisma:push && pnpm dev   # :3001
pnpm --filter @farmsim/web dev                # :5173
```
