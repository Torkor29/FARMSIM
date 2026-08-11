# 10 — Multijoueur

---

## 1. Nature du multi

Persistant asynchrone dominant + temps réel ponctuel (présence sur parcelle, chat, prestations en cours).

Ce n’est **pas** un MMO action 60 joueurs sur un même champ en shoot-out.  
C’est un **MMO économique / gestion**.

---

## 2. Interactions joueurs

| Interaction | MVP | V1 | V2 |
|-------------|-----|----|----|
| Marché mondial NPC | ✓ | ✓ | ✓ |
| Voir voisins région | ✓ | ✓ | ✓ |
| Prestations agricoles | — | ✓ | ✓ |
| Chat / guilde | — | ✓ | ✓ |
| Vente P2P intrants | — | limité | ✓ |
| Politique locale | — | — | optionnel |
| Coop ferme partagée | — | — | possible |

---

## 3. Prestations de services (cœur social)

### Flux
1. Client publie demande : type travail, parcelle, cases, deadline, prix CRD, caution.
2. Prestataires matchent (filtres machines requises, réputation, distance).
3. Acceptation → contrat escrow.
4. Exécution (manuel ou semi-auto sur parcelle client).
5. Validation serveur → paiement − commission.

### Métiers
Récolte, labour, semis, fertilisation, transport, (plus tard) soins animaux.

### Anti-abus
- Escrow + litiges timeout.
- Réputation bidirectionnelle.
- Plafonds prix absurdes (bornes).
- Détection collusion multi-comptes (paiement circulaire).
- Annulation pénalisée.

**Impact gameplay :** permet de jouer sans toutes les machines ; crée le métier Entrepreneur.

---

## 4. Problèmes persistants & solutions

| Problème | Risque | Solution | Impact gameplay |
|----------|--------|----------|-----------------|
| Bots / scripts | Inflation, unfair | Captcha soft, rate limits, behavior AI, ban | Friction légère légitimes |
| Multi-comptes | Farm faucet | Device/IP heuristics, KYC soft si premium, limites bénéfices alts | Moins de twinking |
| Manipulation marché | Prix faux | Marché NPC dominant, caps | Moins de cornering |
| Monopoles fonciers | Exclusion | Caps parcelles, taxes taille, releases zones | Expansion non infinie |
| Riches inattrapables | Churn newbies | Soft caps, content horizontal, seasons | Catch-up partiel |
| Farming AFK | Inflation | Actions actives, usure, diminishing | Récompense skill |
| Abus employés / presta | Grief | Escrow, preuve serveur | Confiance |
| Duplication | Économie morte | Transactions ACID, inventaire serveur | — |
| Manque liquidité P2P | Frustration | NPC filet | Moins « pure sandbox » |
| Automatisation totale | Plus de jeu | Auto limitée / late / coûteuse | Tension manuel vs confort |

---

## 5. Politique locale (optionnel futur)

### Pourquoi c’est dangereux
Capture par gros joueurs, toxicité, corruption, complexité support, grief réglementaire (ban OGM pour nuire).

### Si on le fait
- Unité : MacroRegion avec quorum (ex. ≥ 80 joueurs actifs / 30 j).
- Mandats courts (14–30 j).
- Pouvoirs **bornés** : ± taxes locales faibles, subventions budget limité, référendums.
- Vetos serveur / constitution (pas d’expropriation arbitraire).
- Anti-multi vote (1 compte vérifié / voix).
- Logs publics des décrets.

**Recommandation :** pas avant V2 stable économiquement.

---

## 6. Presence & temps réel

Temps réel nécessaire :
- positions machines en prestation ;
- chat ;
- notifications contrats ;
- états champ si 2 acteurs co-présents.

Non temps réel :
- croissance cultures ;
- tick marché ;
- météo régionale ;
- intérêts / frais stockage.

---

## 7. Social UX

Voisinage, classements régionaux (opt-in), événements saisonniers, « foire agricole ».  
Utile acquisition créateurs FS (sessions multi spectaculaires sur globe).
