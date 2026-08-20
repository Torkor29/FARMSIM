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

## En une commande

Le déploiement a monté PostgreSQL et le jeu tourne — sur une base vide, le temps
de lui verser la ferme d'avant. Vos données n'ont pas bougé : elles sont sur
l'ancien volume, que rien ne supprime.

```bash
sudo bash /opt/farmsim/scripts/farmsim-bascule-postgres.sh
```

Le script fait tout : il retrouve l'ancienne base sur son volume, en sort le
fichier, arrête le jeu (la base reste debout), sauvegarde ce qu'il s'apprête à
remplacer, remet le schéma à neuf, transfère, redémarre et attend que la santé
revienne au vert.

Il est écrit pour être difficile à rater :

- **il refuse d'écraser une base qui contient de vrais joueurs.** Si la bascule
  a déjà eu lieu, ou si des comptes ont joué depuis, il s'arrête et le dit. Pour
  passer outre — en connaissance de cause — : `--vraiment` ;
- **il vérifie le fichier source** avant de toucher à quoi que ce soit ;
- **le transfert recompte les deux côtés** et échoue si un seul nombre diffère ;
- **l'ancienne base n'est jamais modifiée.**

Il est relançable : s'il s'arrête en route, on corrige et on relance.

## Si vous préférez le faire à la main

Les étapes que le script enchaîne, dans l'ordre — utiles pour comprendre, ou
pour reprendre au milieu.

### 1 — Retrouver le volume et en sortir le fichier

Compose préfixe ses volumes du nom du projet : `farmsim-data` s'appelle en
réalité `farmsim_farmsim-data`. Ce détail n'est pas cosmétique — `docker run -v`
avec un nom inexistant **crée un volume vide sans rien dire** et monte celui-là,
d'où un « No such file or directory » qui laisse croire que tout a disparu.

```bash
for v in $(sudo docker volume ls -q | grep -i farmsim); do
  echo "-- $v"; sudo docker run --rm -v "$v":/d alpine ls -la /d
done
```

Puis, avec le bon nom :

```bash
VOL=farmsim_farmsim-data
sudo docker run --rm -v "$VOL":/data -v /tmp:/sortie alpine \
  cp /data/farmsim.db /sortie/farmsim-avant-bascule.db
```

### 2 — Arrêter le jeu, remettre la base à neuf, transférer

```bash
cd /opt/farmsim
sudo docker compose stop farmsim
MDP=$(grep FARMSIM_DB_PASSWORD .env | cut -d= -f2-)

sudo docker exec farmsim-db psql "postgresql://farmsim:${MDP}@127.0.0.1:5432/postgres" \
  -c "DROP DATABASE IF EXISTS farmsim WITH (FORCE)" -c "CREATE DATABASE farmsim OWNER farmsim"

sudo docker run --rm --network container:farmsim-db \
  -e DATABASE_URL="postgresql://farmsim:${MDP}@127.0.0.1:5432/farmsim" \
  --entrypoint sh farmsim-farmsim -c "./node_modules/.bin/prisma migrate deploy"

sudo docker run --rm --network container:farmsim-db \
  -v /tmp:/entree -v /opt/farmsim/scripts:/scripts:ro \
  --entrypoint node farmsim-farmsim --disable-warning=ExperimentalWarning \
  /scripts/farmsim-vers-postgres.mjs /entree/farmsim-avant-bascule.db \
  "postgresql://farmsim:${MDP}@127.0.0.1:5432/farmsim"
```

### 3 — Rallumer et regarder

```bash
sudo docker compose up -d
curl -fsS http://127.0.0.1:8081/api/health
```

Puis ouvrez le jeu et vérifiez trois choses à l'œil : votre compte existe,
votre ferme est là avec ses bâtiments, et votre argent est le bon.

## La première sauvegarde PostgreSQL

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
