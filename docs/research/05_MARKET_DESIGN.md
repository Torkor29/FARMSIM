# 05 — Market Design (marché mondial)

---

## 1. Vision

Le marché est **centralisé côté serveur** : le jeu (entité « Marché Mondial ») **achète et revend** les commodités selon une demande simulée, des stocks globaux et des chocs (météo, saison, événements).

Les joueurs **n’ont pas besoin** de trouver un acheteur P2P pour survivre.  
Le P2P (prestations, éventuellement troc d’intrants) est **complémentaire**.

Pourquoi centraliser ?
- liquidité garantie (anti « économie morte ») ;
- contrôle anti-manipulation ;
- narration « prix mondiaux » ;
- simplicité UX.

---

## 2. Architecture du prix

Pour chaque commodité `c` à tick `t` :

```
P(t) = clamp(
  P(t-1) × (1 + κ × imbalance(t)) × seasonality(t) × eventShock(t),
  Pmin, Pmax
)

imbalance = (demand - supply - stockPressure) / normalize
```

| Terme | Rôle |
|-------|------|
| supply | Récoltes vendues tick + offloads stock |
| demand | Conso NPC mondiale + demande feed |
| stockPressure | Si stocks hauts → baisse |
| seasonality | Calendriers NH/SH |
| eventShock | Sécheresse régionale, embargo narratif, etc. |
| κ | Vitesse d’ajustement `[TEST]` |

Qualité : `P_effective = P_base × qualityMult[grade]`.

---

## 3. Ancrage données réelles (calibration)

| Produit | Ancre `[RÉEL]` | Fourchette historique indicative | Source type |
|---------|----------------|----------------------------------|-------------|
| Blé | ~200–240 €/t (périodes calmes 2023–24) ; pics >400 €/t (2022 Ukraine) | 150–450 | Euronext EBM, presse agri |
| Maïs | Souvent sous blé en EU | large | Euronext / CBOT |
| Soja | USD/bushel CBOT → convertir | large | CBOT |
| Lait | €/1000 L régional | variable | FranceAgriMer / UE |
| Viandes | €/kg carcasse | variable | Occasions / UE |

**Runtime :** prix en CRD **dérivés** de ces ancres, pas feed live obligatoire.

---

## 4. Stocks mondiaux

Le serveur maintient `GlobalStock[c]`.
- Achats joueurs → stock ↑
- Demande NPC tick → stock ↓
- Pertes / spoilage soft optionnel

Affichage joueur : indicateur qualitatif (Bas / Normal / Haut) pour éviter l’overtrading purement algorithmique.

---

## 5. Vente immédiate vs stockage

| Action | Avantage | Coût / risque |
|--------|----------|---------------|
| Vente spot | Liquidité, simple | Rate mauvais possible |
| Stockage | Spéculation | Frais, capacité, risque baisse, sinistre |

**Frais stockage `[TEST]` :** 0,3–1,0 % valeur / jour-jeu ou forfait volume.  
**Assurance `[V2]` :** prime contre grêle sur stock extérieur.

Le stockage est une **compétence de risque**, pas un win button (mean-reverting prices).

---

## 6. Régions & transport

MVP : prix **mondial unique** par commodité (± qualité) — liquidité et simplicité.  
V1 : **marchés régionaux** + frais de fret / délai + modifiers (±5–15 %).  
Évite l’arbitrage instantané type HFT tout en préparant la spécialisation géographique.

**[PROPOSITION]** Ne pas ouvrir un carnet d’ordres mondial temps réel au lancement : surface de manipulation + goulot. Matching asynchrone (1–5 s) suffit pour un rythme farm.

---

## 7. Ordres

MVP : **market sell** instantané au prix tick.  
V1 : sell limits (ordres) avec expiration.  
Buy joueur depuis NPC (intrants) : inventaire shop.

Pas de carnet d’ordres HFT — risque manipulation + complexité.

---

## 8. Manipulation & bots

Risques :
- dump organisé ;
- multi-comptes farm → sell ;
- corner via stockage (si P2P).

Mitigations :
- marché NPC dominant ;
- caps vente / jour / compte ;
- frais progressifs au-delà de volumes ;
- détection patterns ;
- pas de cash-out (réduit incentive blanchiment).

---

## 9. Événements marché (design)

Exemples :
- Sécheresse corridor céréalier → −supply régionale → +prix blé/maïs ;
- Épizootie → −cheptel → +prix viande, −demande feed ;
- « Super récolte » → +stock → −prix.

Chaque événement publie une **fiche narrative** (crédibilité + contenu créateurs).

---

## 10. Lien prestations

Les paiements de contrats de service sont des **transferts CRD**.  
Ils ne créent pas de monnaie ; ils redistribuent et créent une économie de métier (entrepreneur).

---

## 11. KPI marché

- Prix vs bande cible
- Velocity stocks
- Ratio vente immédiate / stocké
- Gini richesse
- Volume faucet net
- Temps médian pour 1er tracteur

Dashboard interne hebdomadaire obligatoire dès soft launch.
