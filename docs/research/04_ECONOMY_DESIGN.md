# 04 — Economy Design

**Objectif :** économie MMO agricole qui ne s’effondre pas à 6–12 mois.

---

## 1. Monnaies

| Monnaie | Code | Rôle | Cash-out |
|---------|------|------|----------|
| Crédit Agricole IG | `CRD` | Économie gameplay | **Non** |
| Semences Premium / Jetons | `PRM` | Confort, cosmétique, boosts plafonnés | Achat réel → PRM ; **pas** PRM → EUR |

Philosophie : *gratuit compétitif ; payer = confort / vitesse plafonnée*.

Conversion indirecte type Dofus (temps → CRD → certains items aussi achetable en PRM à prix CRD supérieur) : **possible en V1**, avec plafonds anti-bot.

---

## 2. Faucets (création de CRD)

| Source | Contrôle | Risque |
|--------|----------|--------|
| Vente au **marché mondial NPC** | Prix dynamiques + stocks | Principal faucet |
| Contrats NPC débutant | Plafonnés / niveau | Bootstrap |
| Récompenses tutoriel | One-shot | Faible |
| Prestations P2P | **Transfert** (pas création) | — |

**Leçon EVE `[FAIT]` :** distinguer création monétaire vs transferts joueurs ; publier métriques sinks/faucets.

---

## 3. Sinks (destruction de CRD)

| Sink | Commentaire |
|------|-------------|
| Achat semences / engrais / carburant NPC | Récurrent |
| Entretien machines / réparation | Récurrent |
| Frais de stockage | Anti-thésaurisation |
| Taxes marché / commission | % |
| Achat terrains NPC / baux | Gros sinks |
| Construction bâtiments | Mid/late |
| Échecs (pertes récolte, mortalités) | Soft sink ressources |
| Amende multi-compte / saisies anti-fraude | Exceptionnel |

**Règle :** tout faucet massif doit avoir un sink associé dimensionné.

---

## 4. Boucle économique cible

```
Temps + skill + capital
  → Production (crops/animals)
  → Vente marché (CRD)
  → Coûts récurrents (sinks)
  → Réinvestissement productif
```

La richesse doit venir de **décisions et d’échelle sous contraintes**, pas d’AFK infini.

---

## 5. Interdépendance céréales / élevage

- Demande aliments animaux tire prix céréales.
- Offre fumier tire prix engrais organiques vers le bas / crée sink alternative minérale.
- Filets NPC empêchent le dead-lock si population déséquilibrée.
- Si ratio éleveurs trop bas : prix viande montent, aliments baissent → incitation switch.

Voir simulations `15_ECONOMIC_SIMULATION.md`.

---

## 6. Progression économique du joueur

Early : petite parcelle, 1 culture, machines locatives / contrats.  
Mid : propriété machines, stockage, 2e parcelle, spécialisation.  
Late : réseau prestations, R&D, multi-régions (si autorisé), optimisation qualité.

**Catch-up `[PROPOSITION]` :**
- plafonds d’expansion (slots parcelles / entretien) ;
- rendements marginaux décroissants ;
- frais fixes croissants avec taille ;
- pas de bonus niveau > +10 %.

---

## 7. Inflation — diagnostic & remèdes

| Symptôme | Cause probable | Remède |
|----------|----------------|--------|
| Prix NPC toujours au max | Demande NPC trop forte / offre faible | Baisser demande, hausser coûts |
| CRD partout, rien à acheter | Manque sinks / contenu | Nouveaux sinks (bâtiments, terrains rares) |
| Prix joueur (si P2P) hors contrôle | Rareté artificielle / bots | Taxes, caps, détection |
| Nouveaux pauvres à jamais | Avantage cumulatif | Soft reset saisonnier optionnel, baisses d’entrée |

Outils : budget monétaire mensuel, destruction ciblée, événements de demande, usure accélérée soft.

---

## 8. Leçons jeux de référence

### Dofus
Double monnaie + marketplace ; inflation historique liée aux faucets et bots.  
→ besoin anti-bot + sinks + surveillance.

### EVE Online
MER (Monthly Economic Report), sinks fiscaux, PLEX comme bridge sub sans cash-out item→USD officiel.  
→ **transparence métriques** + taxes.

### Albion
Crafting taxes, black market, silver sinks.  
→ taxes d’activité productives.

### Hay Day / Farmville
Énergie / timers / P2W confort.  
→ **ne pas** copier le energy-gate agressif ; dangereux pour positionnement « sim sérieux ».

---

## 9. Pay-to-win — lignes rouges

Interdit :
- acheter rendement +50 % ;
- acheter monnaie CRD directement sans limite qui casse le marché ;
- skip entièrement risques climatiques via cash.

Autorisé :
- cosmétique ;
- slots confort (1–2) ;
- boost XP/temps **plafonné** ;
- skins machines ;
- abonnement confort (files d’attente, stats avancées).

---

## 10. Ressources — fiche type

Pour chaque ressource (blé, maïs, soja, lait, …) documenter :

| Champ | Exemple blé `[TEST]` |
|-------|----------------------|
| Source | Production joueurs + import NPC soft |
| Sink | Demande marché (food NPC) + feed éleveurs + pertes stock |
| Prix initial | 220 CRD/t (calibré ~€/t réel) |
| Min / Max | 120 / 450 |
| Volatilité | Moyenne |
| Saisonnalité | Récolte NH baisse prix ; opposite SH |
| Élasticité demande | −0,4 `[HYPOTHÈSE]` |
| Influence météo | Forte |
| Stockage | Oui, frais 0,5 %/jour `[TEST]` |

Détail marché : `05_MARKET_DESIGN.md`.

---

## 11. Décision prix réels

| Option | Avantages | Inconvénients | Verdict |
|--------|-----------|---------------|---------|
| A — prix réels live | Crédibilité | Dépendance API, légal, UX confuse, pas de contrôle balance | **Rejetée** pour runtime |
| B — réel comme base + sim | Ancrage + contrôle | Complexité ETL | **Retenue calibration** |
| C — indépendant calibré | Contrôle total | Moins « wow réel » | **Retenue runtime** |

**Choix `[PROPOSITION]` :** Option **C runtime** + **B calibration** (table de référence Euronext/CME/FAO mise à jour manuellement / trimestrielle).

---

## 12. Anti-collapse checklist

- [ ] Sinks ≥ 70 % des faucets en régime `[TEST]`
- [ ] Demande NPC plancher + plafond
- [ ] Caps production / joueur / jour
- [ ] Détection multi-comptes
- [ ] Pas de duplication inventaire
- [ ] Transactions serveur atomiques
- [ ] Dashboard économique hebdo
