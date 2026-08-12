# 45 — Rotation des cultures

**Statut :** Implémenté
**Date :** 2026-08-12

---

## Pourquoi

Semer deux blés de suite sur la même terre ne coûtait rien. La décision de
semis se réduisait donc au cours du jour : le blé se vend mieux, on sème du
blé, indéfiniment. C'est précisément la faute que tout agriculteur apprend à
éviter.

Elle se paie pour deux raisons. Les champignons du sol — le piétin-échaudage
en tête — survivent l'hiver sur les résidus de la culture précédente et
attendent la suivante ; sans hôte, ils s'éteignent. Les adventices, de leur
côté, se spécialisent : un même cycle de travail au même moment de l'année
sélectionne les espèces qui y résistent. Un blé sur blé perd couramment le
sixième de son rendement, un troisième blé d'affilée bien davantage.

L'inverse est vrai : une culture de rupture casse ces cycles, et la suivante
en profite. C'est l'effet précédent.

---

## Règle

| Situation | Effet sur le rendement |
|-----------|------------------------|
| Terre sans précédent | neutre |
| Retour de la même culture, 2ᵉ cycle | −15 % |
| Retour de la même culture, 3ᵉ cycle | −26 % |
| Retour de la même culture, au-delà | −33 %, plafonné |
| Culture de rupture après au moins un cycle | +4 % |

Le malus plafonne volontairement. Sans plafond, la monoculture deviendrait
absurde plutôt que coûteuse, et le joueur qui s'y est enfermé n'aurait plus
aucune sortie praticable.

Le jeu ne connaît que deux cultures, donc la rotation s'y résume à alterner.
C'est suffisant pour que la décision existe : semer du blé deux fois de suite
parce que son cours est haut devient un pari, et non plus une évidence.

---

## Mémoire de la case

Les colonnes retiennent ce que la case a **déjà produit**, jamais ce qu'elle
porte. Elles ne sont écrites qu'à la libération de la case — moisson, ou
culture perdue faute d'avoir été récoltée à temps. Une culture en terre lit
donc directement le précédent qui la concerne, sans avoir à défalquer son
propre cycle du compteur.

Une culture perdue compte comme une réussie : elle a occupé la terre une
saison, et les champignons s'y sont installés de la même façon.

Le labour ne remet pas cette mémoire à zéro. Retourner la terre décompacte et
enfouit les résidus, mais n'éradique pas un inoculum installé — seule
l'alternance y parvient.

---

## Ce que le joueur voit

L'avertissement s'affiche **avant** le semis, dès que la sélection porte une
case au précédent identique, et annonce le pourcentage exact. Découvrir la
perte à la moisson, quand plus rien n'est rattrapable, n'apprendrait rien.

---

## Données et API

`ParcelCell` gagne `lastCrop` et `cropStreak`.

`simulateCell` accepte `rotation: { lastCrop, cropStreak }` et applique le
coefficient à côté du climat, non dans `managementFactor` : la rotation se
décide avant la mise en terre et ne dépend pas de la conduite de culture.

Vérifié contre l'API réelle : une case au précédent blé rend 14,9 % de moins
que la même case vierge, toutes choses égales par ailleurs.

---

## Reste à faire

- Deux cultures seulement : une vraie rotation demanderait une légumineuse,
  qui fixe l'azote et bonifierait la suivante au lieu de simplement la
  soulager
- Le précédent n'influence pas le besoin en azote, alors que c'est son effet
  agronomique le mieux établi
- Aucune notion d'interculture ni de couvert végétal entre deux cycles
