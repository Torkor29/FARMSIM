# 16 — MVP Roadmap

---

## 1. Définition MVP

Un joueur peut :
1. Créer un compte
2. Choisir une parcelle sur une carte simplifiée (Europe ou EU+US Midwest)
3. Planter 1–2 cultures (blé, maïs)
4. Voir croissance persistante (serveur)
5. Subir météo simple
6. Récolter (action cases + animation machine basique)
7. Vendre au marché mondial prix dynamique
8. Acheter/entretenir 1–2 machines
9. Progresser (niveau faible + argent)
10. Revenir plus tard et voir l’état à jour

**Spécialisations au choix dès MVP :** Céréalier · Éleveur (contenu limité) · **ETA** (contrats NPC / tableau de missions simplifié).

**MVP ETA :** contrats NPC (labour, semis, récolte) + stats machines — le joueur ETA peut jouer sans parcelle.  
**V1 ETA :** tableau P2P escrow (céréaliers/éleveurs ↔ ETA).

**Aussi documenté pour V1 :** humidité de récolte + cellule sécheuse ; events IRL (ex. Ukraine → prix engrais).

**Hors MVP :** élevage profond, politique, OGM, R&D profonde, P2P presta complet, cash-out, catalogue machines large, globe entier.

---

## 2. Epics MVP

| Epic | Contenu | Priorité |
|------|---------|----------|
| E1 Auth & profil | Register, login, spé **céréalier / éleveur / ETA** | P0 |
| E1b Contrats NPC | Tableau missions ETA (labour/semis/récolte) | P0 |
| E2 Carte & parcelle | Sélection, attributs climat basiques | P0 |
| E3 Simulation champ | Plant/grow/harvest, sol simple | P0 |
| E4 Marché | Prix tick, vente, soldes | P0 |
| E5 Machines | Tracteur+moissonneuse stats, usure | P0 |
| E6 Météo | États + effet croissance/récolte | P0 |
| E7 Vue iso | Three.js champs/machines | P0 |
| E8 Éco tuning | Sinks, dashboard admin | P1 |
| E9 UX session courte | Notifications résumé | P1 |
| E10 Ops | Deploy, monitoring, backups | P0 |

---

## 3. Roadmap produit

### MVP (fondations jouables)
Auth, carte limitée, 2 cultures, marché NPC, machines basiques, météo simple, iso view, CRD.

### V1 (profondeur)
Qualité grades, stockage stratégique, 4–5 cultures, semences variants, prestations joueurs, abonnement/cosmétique PRM, régions additionnelles, dashboard éco public light.

### V2 (écosystème)
Élevage, R&D, irrigation, événements mondiaux narratifs, modifiers régionaux, guildes, mobile UI.

### V3 (systèmes avancés)
Réglementation/OGM local, politique optionnelle, multi-parcelles avancées, UGC léger, partenariats, (étude cash-out **seulement** si décision business + légal).

---

## 4. Découpage tâches concrètes (post-recherche)

1. Repo monorepo `apps/web`, `apps/api`, `packages/sim`
2. Schéma Prisma initial (User, Farm, Parcel, FieldState, MarketPrice…)
3. Worker `GrowthSim` + tests
4. Worker `MarketTick` + tests de scénarios 1k agents
5. UI carte sélection parcelle
6. UI iso prototype 1 champ
7. Boucle plant→harvest→sell E2E
8. Soft launch amis / créateurs

**Rappel :** ne démarrer le code jeu qu’après validation créateur des questions ouvertes (`17` section P).

---

## 5. Critères de succès MVP

- Session 5 min utile
- Prix ne cassent pas en test 100–500 joueurs
- Aucune duplication inventaire
- Chargement parcelle < 3 s desktop mid
- Joueur comprend pourquoi sa région compte (texte climat)

---

## 6. Risques MVP

| Risque | Mitigation |
|--------|------------|
| Scope creep FS-like | Checklist hors-scope |
| Économie unfun | Sim harness avant polish graphismes |
| 3D trop lourde | Art budget low-poly strict |
| Comparaison FS toxique | Messaging dès landing |
