# Passer de SQLite à PostgreSQL — la marche à suivre

Ce document sert **une fois**, le jour de la bascule. Il est écrit pour être
suivi ligne à ligne, sans avoir à réfléchir en route.

## Pourquoi on change

SQLite était le bon choix pour démarrer : un fichier, zéro installation, zéro
service à surveiller. Il devient le mauvais choix à mesure que le jeu grandit,
pour trois raisons qui se voient déjà :

1. **Un seul écrivain à la fois.** Chaque geste d'un joueur — semer, vendre,
   nourrir — verrouille la base entière le temps de la transaction. Le tick de
   simulation, qui écrit sur toutes les fermes, bloque tout le monde pendant
   qu'il tourne. À deux joueurs cela ne se sent pas ; à trente, si.
2. **Aucune sauvegarde à chaud digne de ce nom.** On y arrivait avec
   `VACUUM INTO`, mais toute la mécanique reposait sur les particularités d'un
   fichier, journal WAL compris.
3. **Des types trop permissifs.** SQLite accepte un entier là où une date est
   attendue, et un `0` là où un booléen l'est. C'est ainsi qu'une erreur de
   conversion se serait vue en 1970 plutôt qu'au moment de l'écrire.

## L'ordre compte, à cause du déploiement automatique

Toute poussée sur `main` redéploie le VPS toute seule. Si la bascule arrivait
sur le serveur avant que vous ayez sorti les données, le jeu repartirait sur une
base **vide** : rien ne serait perdu — l'ancien volume reste intact — mais vous
verriez un monde neuf, ce qui n'est pas un bon moment à passer.

La procédure est donc en deux temps :

- **Phase 1, avant la poussée** : sauvegarder, faire le ménage, sortir le
  fichier de l'ancienne base, poser le mot de passe. Rien de tout cela ne
  touche au jeu en service.
- **Phase 2, après la poussée** : le déploiement a monté PostgreSQL et créé le
  schéma ; on transfère les données et on rallume.

Comptez **une dizaine de minutes d'interruption** en phase 2, à une heure
creuse. Rien n'est irréversible : l'ancienne base reste sur son volume jusqu'à
ce que vous décidiez de la supprimer.

---

# Phase 1 — avant la poussée

## 1 — La sauvegarde d'avant, et le ménage

```bash
cd /opt/farmsim
sudo bash scripts/farmsim-backup.sh avant-postgres
```

Profitez-en pour passer le dernier coup de balai sur les comptes d'essai, tant
que la base est encore en SQLite (ce script ne sert que là) :

```bash
sudo bash scripts/farmsim-purge-essais.sh            # à blanc, montre ce qui partirait
sudo bash scripts/farmsim-purge-essais.sh --vraiment # pour de bon
```

## 2 — Sortir le fichier de l'ancienne base

C'est **l'étape à ne pas oublier** : c'est ce fichier qui portera vos données
de l'autre côté.

```bash
sudo docker run --rm -v farmsim-data:/data -v /tmp:/sortie alpine \
  cp /data/farmsim.db /sortie/farmsim-avant-bascule.db
ls -lh /tmp/farmsim-avant-bascule.db
```

## 3 — Le mot de passe de la nouvelle base

Sans lui, `docker compose` refusera de démarrer — c'est voulu : une base de
production ne doit pas pouvoir tourner avec un mot de passe deviné depuis le
dépôt. Le poser maintenant est sans effet sur le jeu en service.

```bash
cd /opt/farmsim
echo "FARMSIM_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')" | sudo tee -a .env
sudo chmod 600 .env
```

**Dites-le moi quand ces trois étapes sont faites — je pousse à ce moment-là.**

---

# Phase 2 — après la poussée

Le déploiement automatique a monté PostgreSQL, construit la nouvelle image et
créé le schéma (le jeu applique ses migrations à son démarrage). Le jeu tourne
donc, sur une base vide.

## 4 — Vérifier que la base est bien là

```bash
cd /opt/farmsim
sudo docker compose ps          # farmsim-db doit être « healthy »
```

## 5 — Arrêter le jeu et transférer les données

Le jeu seulement : la base reste debout pour recevoir le transfert, et plus
personne n'écrit pendant l'opération.

```bash
cd /opt/farmsim
sudo docker compose stop farmsim

MDP=$(grep FARMSIM_DB_PASSWORD .env | cut -d= -f2-)
sudo docker run --rm \
  --network container:farmsim-db \
  -v /tmp:/entree \
  -v /opt/farmsim/scripts:/scripts:ro \
  --entrypoint node \
  farmsim-farmsim --disable-warning=ExperimentalWarning \
  /scripts/farmsim-vers-postgres.mjs \
  /entree/farmsim-avant-bascule.db \
  "postgresql://farmsim:${MDP}@127.0.0.1:5432/farmsim"
```

Le script affiche le compte de chaque table, **recompte de l'autre côté**, et
refuse de se dire réussi si un seul nombre diffère. Il refuse aussi d'écrire
dans une base qui contient déjà des lignes : relancer par erreur ne peut pas
doubler les données.

## 6 — Rallumer et regarder

```bash
sudo docker compose up -d
curl -fsS http://127.0.0.1:8081/api/health
```

Puis ouvrez le jeu et vérifiez trois choses à l'œil : votre compte existe,
votre ferme est là avec ses bâtiments, et votre argent est le bon.

## 7 — La première sauvegarde PostgreSQL

```bash
sudo bash /opt/farmsim/scripts/farmsim-backup.sh apres-bascule
```

Elle est vérifiée en étant restaurée : si elle passe, la nouvelle chaîne de
sauvegarde fonctionne de bout en bout.

## Si quelque chose ne va pas

Rien n'est perdu. L'ancienne base est intacte sur le volume `farmsim-data`,
qui n'est plus monté mais **n'a pas été supprimé**. Pour revenir en arrière,
il suffit de repasser au commit précédent :

```bash
cd /opt/farmsim
sudo git log --oneline -5          # repérer le commit d'avant la bascule
sudo git checkout <commit>
sudo docker compose up -d --build
```

## Quand supprimer l'ancien volume

Pas avant **une bonne semaine** de fonctionnement normal, et pas avant d'avoir
restauré une sauvegarde PostgreSQL au moins une fois pour de bon. Ensuite
seulement :

```bash
sudo docker volume rm farmsim-data
```

## Ce que la bascule ne règle pas

Les sauvegardes vivent toujours **sur le même serveur** que la base. Elles
protègent d'une migration ratée, d'une fausse manœuvre, d'un bogue — pas de la
perte du serveur. Une copie hors du VPS reste à mettre en place.
