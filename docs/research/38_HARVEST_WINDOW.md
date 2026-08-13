# 38 — Fenêtre de récolte : la culture qu'on laisse sur pied

**Statut :** Implémenté  
**Date :** 2026-08-12

---

## Le principe

Une parcelle mûre ne se conserve pas. Elle traverse quatre paliers, du plein
rendement à la perte sèche. Passé le dernier, il ne reste qu'à labourer.

C'est ce qui donne un enjeu au timing : jusqu'ici, une culture prête attendait
indéfiniment et récolter tard ne coûtait rien.

---

## Les paliers

Les durées sont exprimées en multiples du **temps de croissance** de la
culture, jamais en minutes fixes : une culture lente doit tolérer une
négligence proportionnellement aussi longue qu'une culture rapide.

| Palier | Depuis la maturité | Rendement | Couleur |
|--------|--------------------|-----------|---------|
| **À point** | 0 → 0,5 × croissance | 100 % | Or |
| **Se dégrade** | 0,5 → 1,5 × | 100 % → 65 % | Or terni |
| **Presque perdue** | 1,5 → 2,5 × | 65 % → 20 % | Brun |
| **Perdue** | au-delà de 2,5 × | 0 % | Tige morte |

Pour du blé (croissance 3 min) : plein rendement pendant 1 min 30, dégradation
jusqu'à 4 min 30, agonie jusqu'à 7 min 30, perdue ensuite.

**Mesuré en jeu :** 100 % → 91,6 % → 82,8 % sur trois relevés espacés de
45 secondes, puis `LOST` à 0 % après 7 min 30.

---

## La décote se multiplie, elle ne plafonne pas

La sur-maturité s'applique **en dernier**, sur un rendement déjà calculé :

```
tonnes = base × conduite × climat × (1 − humidité) × maturité
```

À retard égal, une parcelle bien fertilisée reste donc meilleure qu'une
parcelle négligée. Récolter tard punit sans effacer le mérite du travail
fourni — un test le vérifie explicitement.

---

## Perdre une culture coûte deux fois

1. La récolte manquée
2. **La fertilité** : −0,01 point par case perdue au labour

Les adventices montent en graine et le sol se tasse. Une parcelle
régulièrement abandonnée s'appauvrit durablement.

Le labour coûte **8 CRD par case** — moins qu'un semis, mais pas rien — et
demande un tracteur, ou une ETA.

---

## Prévenir avant de punir

Une décote invisible serait une punition arbitraire : le joueur perdrait des
tonnes sans jamais savoir pourquoi. Trois signaux sont en place.

| Signal | Où |
|--------|-----|
| **Couleur de la case** | La culture vire de l'or au brun puis à la tige morte |
| **Encart d'alerte** | Panneau de droite : nombre de cases concernées et minutes restantes |
| **Inspection** | Clic sur une case : palier, pourcentage conservé, délai avant perte |

L'encart passe du jaune à l'orange puis au rouge selon la gravité.

---

## API

| Route | Effet |
|-------|-------|
| `GET /parcels/:id` | Chaque `cellSim` porte `ripeness` (palier, facteur, délai) et `lost` |
| `POST /parcels/:id/harvest` | Applique la décote ; marque `SPOILED` les cases perdues et les compte dans `lostCells` |
| `POST /parcels/:id/plow` | Libère les cases perdues, facture, retire de la fertilité |
| `POST /parcels/:id/contractor` | Accepte désormais `work: "PLOW"` |

Un nouvel état `SPOILED` s'ajoute à `FieldStage`.

---

## Traité depuis

Le résumé d'absence annonce les mauvaises nouvelles en premier : cultures
perdues à labourer, récoltes qui se dégradent, troupeaux sans ration. Une
perte découverte une heure plus tard, par hasard, est bien plus frustrante
qu'une perte annoncée.

---

## Reste à faire

- La météo n'influence pas la vitesse de dégradation, alors qu'une pluie sur
  du blé mûr le fait germer bien plus vite qu'un temps sec
