# 12 — Legal / Regulatory Research

**Avertissement :** document de recherche produit, **pas** un avis juridique. Toute décision cash-out / crypto / marketplace secondaire **`[À VALIDER JURIDIQUE]`** avec avocat (jeux + financier).

---

## 1. Décision cadre projet

**Le jeu doit fonctionner parfaitement SANS cash-out.**  
Toute monétisation réelle = joueur → éditeur (achat PRM), pas éditeur/joueurs → EUR issus du farm.

---

## 2. France / UE — points clés `[FAIT]`

### Jeux d’argent
En France, les jeux d’argent et de hasard sont réglementés (ANJ). Un jeu qui combine **mise**, **hasard**, **gain monétaire** tombe sous un régime lourd.

### JONUM (loi SREN 2024-449 + décret 2026-60)
L’ANJ encadre à titre expérimental les **Jeux à Objets Numériques Monétisables** :
- sacrifice financier + hasard + objets numériques monétisables (NFT / jetons échangeables) ;
- déclaration préalable ANJ ;
- **interdiction des gains en monnaie ayant cours légal (euro)** dans ce cadre ;
- obligations LCB-FT / KYC / majorité ;
- catégories de jeux listées (dont gestion/construction — potentiellement proche).

Sources :
- https://anj.fr/jeux-objets-numeriques-monetisables-jonum
- Loi n° 2024-449 du 21 mai 2024 (SREN)

**Implication :** un design « farm → NFT → revente cash » ou « CRD → euro » n’est **pas** un détail feature : c’est un changement de régime réglementaire.

### Monnaie électronique / DSP2
Si l’éditeur permet de stocker de la valeur remboursable en EUR, risque de qualification **monnaie électronique** / services de paiement → agrément, KYC, AML.

### Marketplace type Steam
Revente items entre joueurs en argent réel = zone grise / obligations selon design (commission, custody, convertibilité). Cas historiques (AH Diablo réel, Secondary markets) = leçons de fraude et fermetures.

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

Si un jour envisagé, prérequis typiques à explorer avec conseil :
- structure corporate et pays d’établissement ;
- qualification (jeu, paiement, crowdfunding, rewards) ;
- KYC/AML ;
- plafonds ;
- interdiction mineurs ;
- fiscalité joueurs ;
- risques blanchiment (farm→cash) ;
- CGU propriété des assets.

**Ne pas** communiquer marketing « gagnez de l’argent réel » tant que S0.

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
