# 17 — Rapport exécutif final (A → P)

**Phase :** recherche & conception (aucun code jeu)  
**Date :** 2026-08-11

---

## A. Résumé exécutif

**Farming Navigateur** doit être un **MMO de gestion agricole mondial dans le navigateur** : le joueur ancre une exploitation sur une **parcelle géolocalisée**, cultive sous contraintes climatiques, vend sur un **marché mondial simulé**, progresse surtout via **machines et décisions**, et (dès V1) interagit via **prestations de services**.

Ce n’est pas un portage de Farming Simulator : on reprend l’esprit d’exploitation, on abandonne la conduite photoréaliste et les licences machines, on invente la couche **Terre + économie persistante + multi**.

---

## B. Ce que Farming Simulator fait bien — et ce qu’il ne faut pas reproduire

**Bien :** boucle champ claire ; fertilisation/adventices/saisons lisibles ; matériel = progression ; contrats bootstrap ; lien crops↔animals ; fantasy métier.

**Ne pas reproduire :** gameplay centré conduite ; catalogue licencié ; maps locales AAA ; Precision Farming complet jour 1 ; économie solo sans sinks MMO ; promesse « clone FS browser ».

---

## C. Ce que nous devons reprendre

- Cycle sol → semis → fertilisation → désherbage → récolte → rendement.
- Machines avec largeur/vitesse/conso/usure/coût.
- Contrats NPC early.
- Location matériel.
- Effluents / aliments comme bridges économiques (V1 élevage).
- Feedback visuel d’amélioration du champ.

---

## D. Ce que nous devons inventer (différenciation)

- Carte Terre / parcelles climatiques.
- Marché mondial stocks + chocs.
- Prestations P2P escrow.
- Spécialisations faibles + R&D semences à compromis.
- Qualité vs volume.
- Réglementation locale / OGM neutre (tardif).
- Politique locale optionnelle (très tardif, risquée).
- Identité visuelle isométrique stylisée.

---

## E. Économie

- Monnaie IG `CRD` non cash-out + `PRM` premium.
- Faucet principal = ventes NPC ; sinks = intrants, usure, terrains, stockage, taxes.
- Demande NPC **scale avec population**.
- Bonus progression plafonnés (≤ +10 %).
- Inspiration EVE (métriques), Dofus (double monnaie soignée), Albion (taxes).

---

## F. Agriculture

Modèle simplifié : fertilité, humidité, adventices, variété, météo, gestion.  
Cultures MVP : blé, maïs (+ soja tôt pour bridge élevage).  
Rendements ancrés ordres de grandeur FAO/USDA mais unités IG abstraites OK.

---

## G. Marché

Centralisé NPC, prix dynamiques, stocks globaux, saisonnalité, événements.  
Calibration sur Euronext/CME/FAO **offline** ; **pas** de feed live obligatoire.  
Stockage = décision risquée avec frais.

---

## H. Multijoueur

Asynchrone dominant ; WS pour presta/chat.  
V1 : marketplace de travaux agricoles.  
Anti-bot, caps, escrow.  
Politique locale : documentée, **non prioritaire**, dangereuse si mal bornée.

---

## I. Progression

Machines ≫ niveaux.  
Spé céréalier/éleveur : identité, pas prison.  
R&D semences à trade-offs.  
Niveaux : +2…+10 % cap.

---

## J. Météo / climat

Köppen + norms baked ; simulation stochastique serveur.  
Pas de dépendance météo live.  
Simuler surtout zones actives + agrégats marché.

---

## K. Monétisation

F2P cosmétique + confort plafonné + abo optionnel non-P2W.  
Pas de vente de rendement.  
Cash-out : **non**.

---

## L. Risques

| Domaine | Risque majeur | Mitigation |
|---------|---------------|------------|
| Éco | Inflation / deflation | Sinks, demande dynamique, dashboard |
| Technique | Scope 3D / scale | Low-poly, sim catch-up, scale stages |
| Produit | Comparaison FS | Messaging différenciant |
| Juridique | Cash-out / JONUM | Architecture S0 sans convertibilité |
| Multi | Bots / multi-comptes | Détection, caps, escrow |
| Design | Interdépendance forcée | Filets NPC |
| Design | Politique toxique | Reporter / borner fortement |

---

## M. Architecture

**MVP :** Next.js + Three.js (parcelle) + MapLibre/carte 2D + NestJS + PostgreSQL + Redis + BullMQ + WebSocket.  
Authoritative server.  
Go workers possibles plus tard sur market/sim.

---

## N. MVP

Compte, carte limitée, parcelle, 2 cultures, croissance serveur, récolte cases, marché dynamique, CRD, 2 machines, météo simple, vue iso.  
Pas d’élevage/politique/OGM/R&D profonde/prestations/cash-out.

---

## O. Roadmap

**MVP → V1** (qualité, stockage, presta, premium) **→ V2** (élevage, R&D, events) **→ V3** (réglementation, politique?, UGC).  
Détail : `16_MVP_ROADMAP.md`.

---

## P. Questions ouvertes (décisions créateur)

1. Nom définitif du jeu ?
2. Première région lancée (Europe only vs EU+US) ?
3. Compression temporelle cible (combien de jours réels pour un cycle blé) ?
4. Ton artistique exact (références visuelles) ?
5. Autoriser un jour CRD→PRM direct ?
6. Abonnement dès V1 ou cosmétique only d’abord ?
7. Langue launch (FR only vs FR+EN+DE — critique communauté FS) ?
8. Soft limit : 1 compte / personne dès le launch ?
9. Inclure soja dès MVP pour préparer élevage ?
10. Budget avocat pour valider CGU monnaies avant soft launch public ?

---

## Challenges explicites au brief

- **Cash-out IG→réel** : attractif marketing, **très dangereux** juridiquement (ANJ/JONUM/AML). À exclure du socle.
- **Politique locale** : fun potentiel, toxicité & capture élevées — pas un pilier de lancement.
- **Action 1 case = 1 minute** : peut devenir punitif ; calibrer avec presta et accélérateurs bornés.
- **Prix live réels** : mauvais runtime ; bon pour calibration.
- **Interdépendance céréaliers/éleveurs obligatoire** : casse si population skew — filets NPC obligatoires.
- **Reproduire FS** : piège d’acquisition (comparaison graphique perdue d’avance).

---

## Prochaine étape recommandée

1. Réponses aux questions P.  
2. Validation écrite du MVP scope.  
3. Alors seulement : initialiser monorepo et harness de simulation économique (avant polish 3D).
