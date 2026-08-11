# 12 — Legal / Regulatory Research

**Avertissement :** document de recherche produit, **pas** un avis juridique. Toute décision cash-out / crypto / marketplace secondaire **`[À VALIDER JURIDIQUE]`** avec avocat (jeux + financier).

---

## 1. Décision cadre projet

**Le jeu doit fonctionner parfaitement SANS cash-out.**  
Toute monétisation réelle = joueur → éditeur (achat PRM), pas éditeur/joueurs → EUR issus du farm.

---

## 2. France / UE — points clés `[FAIT]`

### Jeux d’argent (CSI L.320-1)
Critères ANJ cumulatifs : offre au public + espérance de **gain** + hasard (même partiel) + **sacrifice financier**.  
Agrément ANJ limité (paris, poker…) — pas un cadre pour un farm MMO classique.

### Monnaie virtuelle ≠ e-money
- **Monnaie de jeu** : licence d’usage interne, en principe non remboursable.
- **Monnaie électronique (dir. 2009/110/CE)** : valeur émise contre fonds, créance sur l’émetteur, remboursable au nominal, acceptée par des tiers → agrément (ACPR).
- **PSD2 / DSP2** : services de paiement si détention/exécution de fonds pour tiers.
- Exemption « réseau limité » possible mais **pas automatique** (volumes, usage).

**[PROPOSITION]** CGU : pas de propriété, licence, pas de remboursement, pas de vocabulaire « wallet / withdraw » pour le CRD.

### JONUM (loi SREN 2024-449 + décret 2026-60)
L’ANJ encadre à titre expérimental les **Jeux à Objets Numériques Monétisables** :
- sacrifice financier + hasard + objets numériques monétisables (NFT / jetons échangeables à des tiers) ;
- déclaration préalable ANJ ;
- **interdiction des gains en euro** ; éditeur **ne rachète pas** les ONUM ;
- majeurs only ; LCB-FT / KYC ;
- catégories listées (dont gestion/construction — potentiellement proche si ONUM).

Sources :
- https://anj.fr/jeux-objets-numeriques-monetisables-jonum
- https://anj.fr/professionnels/porteur-de-projet
- Loi n° 2024-449 du 21 mai 2024 (SREN)
- Directive 2009/110/CE (e-money) ; directive (UE) 2015/2366 (PSD2)

**Implication :** « farm → NFT → revente cash » ou « CRD → euro » n’est pas une feature : c’est un **changement de régime**.

### Marketplace type Steam
**[FAIT]** Steam Wallet : liquidité **fermée** (pas de retrait cash) — stratégie de réduction du risque AML.  
Revente items en € ouvert = zone PSP/AML ; si hasard en amont → JONUM/JAH.

---

## 3. Scénarios

| Scénario | Description | Posture recommandée |
|----------|-------------|---------------------|
| S0 | CRD non convertible ; PRM acheté ; cosmétiques | **Cible MVP/V1** |
| S1 | Marketplace PRM cosmétique éditeur | OK sous CGU claires |
| S2 | Échange CRD↔PRM contrôlé (sink) | Prudence balance ; pas cash |
| S3 | Cash-out CRD/items → EUR | **Hors scope** jusqu’à étude avocat + licence éventuelle |
| S4 | Crypto/NFT monétisables | Risque JONUM / MiCA ; **éviter** |

---

## 4. Cash-out — étude séparée (non autorisé par défaut)

| Scénario | Description | Posture |
|----------|-------------|---------|
| A — Aucun cash-out (Steam-like) | Crédit non retirable | **Cible** |
| B — Rachat éditeur € | Éditeur paye les joueurs | **Risque max** |
| C — Marketplace + payout | P2P € via plateforme | PSP + AML (+ JONUM si hasard) |
| D — NFT / DEX | ONUM externes | JONUM / MiCA |

Leçons : Diablo III RMAH (gameplay cassé, fermé 2014) ; Second Life (payout via entité régulée + KYC, non transposable naïvement) ; Axie (P2E = vigilance AML).

Si un jour envisagé (scénario C skill-only, majeurs) — prérequis typiques **`[À VALIDER JURIDIQUE]`** :
- jeu déjà viable sans cash-out ;
- avis avocat jeux + finance FR/UE ;
- partenariat EMI/PSP agréé ;
- KYC/AML, plafonds, TRACFIN ;
- items cash-outables **craft/skill**, pas RNG payant ;
- entité / stack paiement **séparés** du jeu.

**Ne pas** communiquer « gagnez de l’argent réel » tant que S0.

---

## 5. Spéculation IG vs jeux d’argent

Prix marché dynamiques ≠ jeu d’argent si :
- pas de mise directe sur un tirage ;
- skill / production dominante ;
- pas de retrait EUR.

Attention aux mini-jeux hasard payants (lootboxes agressives) : autre régime / perception.

---

## 6. Données perso / CNIL

Compte joueur, logs anti-fraude, KYC éventuel = RGPD.  
Minimisation, base légale, durée conservation, DPA sous-traitants.

---

## 7. Recommandation nette

1. Ship S0.  
2. Monétiser cosmétique + abonnement confort.  
3. Documenter S3 comme **annexe stratégique** seulement.  
4. Budget avocat avant tout prototype cash-out.
