# 47 — Contrats à terme

**Statut :** Implémenté
**Date :** 2026-08-13

---

## Pourquoi

Vendre au comptant, c'est subir le cours du jour. Un joueur qui voyait le blé
haut n'avait aucun moyen de le retenir : il vendait tout de suite, ou il
pariait à l'aveugle sur l'après. L'historique des cours lui donnait de quoi
lire une tendance, sans rien pour en tirer parti.

Le terme comble ce trou. On engage une récolte à venir à un prix fixé
aujourd'hui.

---

## Règle

| | |
|---|---|
| Échéances | 1 h, 3 h, 6 h |
| Décote | 2 %, 4,5 %, 7,5 % |
| Lot minimum | 1 t |
| Engagements simultanés | 4 |
| Pénalité de défaut | 20 % de la valeur du contrat |

**La décote est le prix de la certitude.** L'acheteur prend le risque à votre
place et le facture ; plus l'échéance est lointaine, plus l'incertitude est
grande, plus elle mord. Sans elle, le terme serait toujours préférable au
comptant et personne ne vendrait plus jamais sur le marché — un test le vérifie
explicitement.

**On ne vérifie pas le stock à l'engagement.** C'est tout l'intérêt : on vend
une récolte qu'on n'a pas encore. Le stock n'est exigé qu'à la livraison.

**La pénalité dépasse la décote la plus large**, et c'est délibéré : dans le cas
contraire, s'engager puis laisser filer deviendrait une façon rentable
d'emprunter, et le contrat perdrait toute portée. Un test compare les deux
valeurs pour qu'un futur ajustement ne casse pas cet équilibre par mégarde.

La trésorerie peut passer sous zéro à la pénalité. Une dette se rembourse ;
elle ne s'efface pas parce qu'on n'a pas de quoi la payer.

---

## Ce que le joueur voit

L'écran de vente affiche côte à côte le prix garanti et le cours du moment,
avant l'engagement puis pendant toute sa durée. À la livraison, le message dit
combien on a gagné — ou perdu — par rapport à une vente au comptant au même
instant.

Sans ce retour, un joueur ne saurait jamais si son pari était bon, et le
mécanisme resterait une loterie opaque.

---

## Données et API

`FuturesContract` : marchandise, tonnage, prix garanti, échéance, statut
(`OPEN`, `SETTLED`, `DEFAULTED`) et cours relevé au dénouement.

| Route | Effet |
|-------|-------|
| `GET /futures` | Engagements du joueur et échéances proposées |
| `POST /futures` | S'engager, sans exiger le stock |
| `POST /futures/:id/deliver` | Livrer avant l'échéance |

Le dénouement des contrats échus tourne dans le tick monde, avec la péremption
et les troupeaux. Ne rien faire aurait été plus simple, mais alors s'engager ne
coûterait rien : on prendrait le prix garanti quand il arrange, et on
oublierait sinon.

Vérifié contre l'API : un engagement de 10 t de blé à 276,13 CRD livré
immédiatement rapporte 2 761 CRD et annonce 56 CRD de moins que le comptant ;
un contrat de maïs laissé expirer prélève 322 CRD, soit exactement les 20 %
attendus.

---

## Reste à faire

- Aucun contrat proposé par les PNJ : c'est toujours le joueur qui initie
- Pas d'achat à terme, seulement de la vente : on ne peut pas sécuriser le prix
  d'un intrant
- L'échéance ne tient pas compte du cycle de culture : rien n'empêche de
  s'engager à six heures sur une récolte qui en demande huit
