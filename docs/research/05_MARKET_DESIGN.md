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

| Produit | Ancre calme `[RÉEL]/[A]` | Fourchette haute crédible | Sources |
|---------|---------------------------|---------------------------|---------|
| Blé | 160–230 €/t (Euronext ~218–231 €/t août 2026) | 350–500 €/t (pic 2022 ~522 $/t) | Euronext EBM, IMF, World Bank |
| Maïs | 150–250 €/t | 300–350 €/t | Euronext / CBOT / IMF |
| Soja | 350–420 €/t (~369 €/t CBOT) | 600–750 $/t | CBOT / IMF |
| Colza graine | 400–550 €/t (~539 €/t Euronext) | 700–900 €/t | Euronext |
| Tourteau soja | 280–400 €/t | 450–550 €/t | IMF |
| Lait | 350–500 €/1000 L (FR ~480–490) | 550–650 | FranceAgriMer / DRAAF |
| Porc | 1,4–2,0 €/kg (Plérin 2024 ~1,90) | 2,2–2,5 | DRAAF |
| Engrais N (AN 33,5 %) | 400–550 €/t | ×2–3 en crise | Cotations FR |

**Runtime :** prix en CRD **dérivés** de ces ancres (Option B hybride / C contrôlé) — pas de feed live obligatoire.

**Leçon coûts `[RÉEL]` :** blé FR 2024 — coût complet observatoire ~314 €/t vs vente ~185 €/t (ciseaux). Le jeu doit montrer **prix vs coût de revient**, pas seulement le spot.

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

| Événement | Impact prix typique `[A]` | Durée |
|-----------|--------------------------|-------|
| Blocage mer Noire | Blé +15–40 % ; oléagineux +20–50 % | 1–6 mois |
| Sécheresse Corn Belt / UE | Maïs/soja +10–30 % | saison |
| Guerre commerciale US–Chine | Soja US − / Brésil + | 6–24 mois |
| Pic gaz/engrais (event IRL type Ukraine) | Coûts N ↑ → marges − à N+1 ; engrais minéraux plus chers | 1–2 campagnes |
| Épizootie (PPA, grippe aviaire) | Viande/œufs ↑ ; demande feed ↓ | 3–18 mois |
| Super récolte | Stocks ↑ → prix − | saison |

**Events IRL `[PROPOSITION]` :** cartes narratives calibrées (pas de feed news live obligatoire). Ex. « Tension mer Noire → engrais +X % » — rejouable, borné, annoncé in-game.

Signal stocks `[RÉEL]` : WASDE blé mondial stocks/use ~33 % (2026/27 proj.) mais stocks Chine peu exportables — le jeu doit suivre un **S/U hors Chine** pour le prix international.

Chaque événement publie une fiche narrative (crédibilité + contenu créateurs).

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
