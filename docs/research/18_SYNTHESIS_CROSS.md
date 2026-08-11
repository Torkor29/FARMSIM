# 18 — Synthèse multi-agents (Phase 3)

Répartition de recherche : Agents FS / Agronomie / Économie agri / Game economy / Monétisation+Légal / Climat+Carte / Multi+Tech / Marketing communauté.

---

## 1. Mécaniques réalistes & intéressantes

| Idée | Réaliste | Fun | Verdict |
|------|----------|-----|---------|
| Calendrier cultural lié climat | Oui | Oui | **Core** |
| Fertilisation / adventices | Oui (FS+réel) | Oui | **Core** |
| Machines throughput | Oui | Oui | **Core** |
| Marché stocks/chocs | Oui (macro) | Oui | **Core** |
| Prestations P2P | Oui (ETA réel) | Oui | **V1** |
| Qualité vs volume | Oui | Oui | **V1** |
| R&D semences compromis | Oui | Oui | **V1–V2** |
| Élevage + fumier | Oui | Moyen/Oui | **V2** (doc V1 prep) |

---

## 2. Mécaniques dangereuses

| Idée | Danger | Décision |
|------|--------|----------|
| Cash-out | Légal + bots + blanchiment | **Out** socle |
| P2W yield | Mort communauté | **Out** |
| Politique locale non bornée | Grief / capture | **Différé + bornes** |
| Météo live API | Fragilité / unfair | **Out runtime** |
| Auto totale early | Vide le multi presta | **Late & limitée** |
| Interdépendance forcée | Deadlock population | **Filets NPC** |

---

## 3. Mécaniques inutiles / trop coûteuses au début

- Catalogue licences machines
- Patho végétale multi-espèces
- Globe 3D photoréaliste
- Carnet d’ordres HFT
- NFT
- Precision Farming complet

---

## 4. Contradictions détectées

1. **Réalisme temps agricole** vs **session 5 minutes** → résoudre par compression temps + catch-up + actions lancées.
2. **Spéculation fun** vs **stabilité éco** → frais stockage + mean reversion.
3. **« Payer pour confort »** vs **conversion CRD/PRM** → plafonds + anti-bot sinon P2W soft.
4. **Monde entier** vs **MVP** → ouvrir 1–2 régions d’abord.
5. **Inspiration FS** vs **acquisition** → ne jamais se vendre comme FS-like graphiquement.

---

## 5. Dépendances systèmes

```
Climat bake → aptitude cultures → rendement → offre marché → prix → revenus → machines → throughput → offre…
Élevage ↔ feed ↔ prix céréales
Presta ↔ possession machines ↔ inégalités early
Monétisation PRM ↔ sinks CRD (si conversion)
Légal ↔ absence cash-out ↔ design marché
```

---

## 6. Insights marketing (Agent communauté)

- Audience FS massive (franchise 40M+, Reddit ~210k, Discord officiel ~176k, YouTube officiel ~2.8M).
- Twitch FS utile mais secondaire vs YouTube.
- Pitch créateurs : économie mondiale + browser + multi — **pas** parité tracteurs.
- Prioriser mid-tier FR/EN/DE.

---

## 7. Insights légaux

- JONUM (SREN + décret 2026) : cadre expérimental objets monétisables ; **pas de gains en euros** dans ce régime.
- Socle produit = monnaie virtuelle non remboursable.

---

## 8. Insights techniques

- Authoritative sim + workers.
- Three.js parcelle ; carte 2D monde.
- Nest+PG+Redis MVP ; Go plus tard si hotspots.

---

## 9. Priorisation consolidée

**Faire d’abord :** GDD verrouillé → sim éco → MVP boucle plant/sell → iso lisible.  
**Ensuite :** presta, qualité, premium.  
**Plus tard :** élevage, R&D, politics.
