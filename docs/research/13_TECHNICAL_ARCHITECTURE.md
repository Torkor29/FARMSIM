# 13 — Technical Architecture

---

## 1. Contraintes

- Navigateur (desktop first, mobile later)
- Persistance mondiale
- Simulation serveur authoritative
- Économie transactionnelle safe
- Scale progressive 1k → 1M
- Vue isométrique 3D légère sur parcelle
- Carte monde 2D performante

---

## 2. Recommandations stack

### Frontend web : **Next.js (React)** `[PROPOSITION]`
**Pourquoi :**
- App complexe (auth, marché, compte, SEO landing) ;
- SSR/SSG pour marketing + CSR pour client jeu ;
- écosystème mature.

Alternatives : Nuxt (OK si équipe Vue) ; SPA Vite+React pure (OK MVP ultra-lean).

### Rendu parcelle : **Three.js** (isométrique low-poly) `[PROPOSITION]`
**Pourquoi :**
- Contrôle caméra ortho isométrique ;
- instancing meshes champs/machines ;
- poids < Babylon pour ce use-case stylisé ;
- communauté exemples farm/city builders.

Phaser : excellent 2D, moins idéal si on veut vrai 3D isométrique.  
Babylon : puissant mais plus lourd / opinionated.  
Raw WebGL : coût dev trop haut.

### Carte monde : **MapLibre GL** ou canvas vectoriel custom
Pas de globe Three pour tout le monde au MVP.

### Backend API : **NestJS (Node) + TypeScript** `[PROPOSITION]` MVP
**Pourquoi :**
- Même langage que front → vitesse équipe ;
- architecture modules (market, farm, weather) ;
- good enough jusqu’à dizaines de k joueurs avec bons workers.

**Scale path :** extraire hotpaths (market matching, sim ticks) en **Go** workers si besoin.  
Rust : excellent perf, ROI équipe souvent mauvais au MVP.

### DB : **PostgreSQL** (source de vérité)
### Cache / locks / presence : **Redis**
### Jobs : **BullMQ** (Redis) ou **Temporal**/queue cloud plus tard
### Realtime : **WebSocket** (Socket.IO ou uWebSockets / Nest gateway)
### Object storage : S3-compatible (assets)
### Auth : email + OAuth ; sessions JWT/opaque + refresh ; 2FA plus tard

---

## 3. Architecture logique

```
[Browser]
  Next.js shell
  Three.js parcel client
  Map client
     | HTTPS
     | WSS
[API NestJS]
  Auth · Farms · Market · Contracts · Inventory
     |
[PostgreSQL]   [Redis]   [Object Store]
     |
[Workers]
  GrowthSim · WeatherTick · MarketTick · ContractExpiry · AntiFraud
```

---

## 4. Authoritative simulation

**Tout** yield, price, inventory, XP, contrat = validé serveur.  
Client = prédiction visuelle.  
Catch-up à la reconnexion : `simulate(lastTick → now)` borné.

---

## 5. Temps réel vs batch

| Système | Mode |
|---------|------|
| Croissance | Batch / catch-up |
| Météo région | Tick 10–60 min |
| Marché | Tick 5–15 min |
| Prestations live | WebSocket |
| Chat | WebSocket |
| Achats | Request-response transactionnel |

---

## 6. Scalabilité progressive

| Joueurs | Orientation |
|---------|-------------|
| 1k | Monolithe Nest + 1 PG + Redis + 2 workers |
| 10k | Read replicas, séparer workers, CDN assets |
| 100k | Shard régions logiques, queue dédiée market, pool WS |
| 1M | Multi-région, services Go market/sim, partitioning parcels |

**Ne pas** builder le setup 1M au jour 1.

---

## 7. Sécurité

- AuthN/AuthZ RBAC
- Transactions SQL isolées (serializable ou optimistic locks inventaire)
- Rate limits
- Validation schémas (Zod)
- Anti-cheat : serveur refuse actions impossibles (machine absente, cell non owned…)
- Audit log économique
- Backups + disaster recovery

---

## 8. Observabilité

OpenTelemetry, métriques économiques custom, alertes prix out-of-band, slow query logs.

---

## 9. Stack MVP minimale

Next.js · Three.js · NestJS · PostgreSQL · Redis · BullMQ · S3 · Docker Compose

---

## 10. Ce qu’on ne choisit pas « parce que hype »

- Blockchain inventaire
- Microservices dès le commit 1
- Kubernetes jour 1
- Unreal Pixel Streaming (coût / latence)
