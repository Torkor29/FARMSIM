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

## Ce qui se passe au moment de la poussée

Toute poussée sur `main` redéploie le VPS toute seule. Le déploiement monte
PostgreSQL, construit la nouvelle image, et le jeu applique ses migrations à son
démarrage : il repart donc **sur une base vide**, le temps que vous transfériez
les données.

Rien n'est perdu pendant ce moment-là. L'ancien volume `farmsim-data` n'est plus
monté, mais il **n'est pas supprimé** : vos données sont dedans, intactes, et
c'est de là qu'on va les tirer.

Comptez une dizaine de minutes entre le déploiement et la fin du transfert.

---

## 1 — Sauvegarder l'ancienne base, et faire le ménage

À faire de préférence **avant** la poussée, tant que l'ancien jeu tourne. Si
c'est déjà déployé, sautez à l'étape 2 : le volume est toujours là.

```bash
cd /opt/farmsim
sudo bash scripts/farmsim-backup.sh avant-postgres
sudo bash scripts/farmsim-purge-essais.sh            # à blanc, montre ce qui partirait
sudo bash scripts/farmsim-purge-essais.sh --vraiment # pour de bon
```

## 2 — Le mot de passe de la nouvelle base

Sans lui, `docker compose` refuse de démarrer — c'est voulu : une base de
production ne doit pas pouvoir tourner avec un mot de passe deviné depuis le
dépôt.

```bash
cd /opt/farmsim
echo "FARMSIM_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')" | sudo tee -a .env > /dev/null
sudo chmod 600 .env
```

> `> /dev/null` n'est pas décoratif : `tee` écrit dans le fichier **et** sur le
> terminal. Sans cette redirection, le mot de passe s'affiche à l'écran — et
> finit dans la première capture qu'on envoie pour demander de l'aide. C'est
> arrivé. Pour le remplacer :
>
> ```bash
> sudo sed -i '/^FARMSIM_DB_PASSWORD=/d' .env
> echo "FARMSIM_DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')" | sudo tee -a .env > /dev/null
> ```

Si le déploiement a déjà échoué faute de ce mot de passe, relancez-le
simplement une fois posé :

```bash
sudo docker compose up -d --build
```

## 3 — Sortir le fichier de l'ancienne base

C'est **l'étape à ne pas rater** : c'est ce fichier qui porte vos données de
l'autre côté. Le volume existe toujours, même s'il n'est plus monté.

**Trouvez d'abord son vrai nom.** Docker Compose préfixe les volumes du nom du
projet : le volume déclaré `farmsim-data` s'appelle en réalité
`farmsim_farmsim-data` sur le serveur.

Ce détail n'est pas cosmétique : `docker run -v farmsim-data:/data`, avec un nom
qui n'existe pas, **crée un volume vide sans rien dire** et monte celui-là. La
copie échoue alors sur un « No such file or directory » qui laisse croire que
les données ont disparu. Elles n'ont pas bougé — on regardait au mauvais
endroit.

```bash
sudo docker volume ls | grep -i farmsim
```

Puis, pour voir lequel contient la base :

```bash
for v in $(sudo docker volume ls -q | grep -i farmsim); do
  echo "── $v"
  sudo docker run --rm -v "$v":/d alpine ls -la /d
done
```

Celui qui contient `farmsim.db` est le bon. On en sort le fichier :

```bash
VOL=farmsim_farmsim-data   # ← le nom relevé ci-dessus
sudo docker run --rm -v "$VOL":/data -v /tmp:/sortie alpine \
  cp /data/farmsim.db /sortie/farmsim-avant-bascule.db
ls -lh /tmp/farmsim-avant-bascule.db
```

Si un volume vide `farmsim-data` traîne — créé par une commande qui visait le
mauvais nom —, il se supprime sans risque une fois qu'on a vérifié qu'il ne
contient rien.

## 4 — Vérifier que la nouvelle base est debout

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

Si le transfert refuse parce que la base n'est pas vide (le jeu a eu le temps de
semer un monde neuf), on la remet à zéro et on recommence :

```bash
sudo docker compose stop farmsim
MDP=$(grep FARMSIM_DB_PASSWORD /opt/farmsim/.env | cut -d= -f2-)
sudo docker exec farmsim-db psql "postgresql://farmsim:${MDP}@127.0.0.1:5432/postgres" \
  -c "DROP DATABASE farmsim WITH (FORCE)" -c "CREATE DATABASE farmsim OWNER farmsim"
sudo docker compose up -d farmsim   # recrée le schéma
sleep 30
sudo docker compose stop farmsim
# puis relancer le transfert ci-dessus
```

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
