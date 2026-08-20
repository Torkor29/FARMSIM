# Sauvegardes — ce qu'il faut taper

Tout FARMSIM tient dans une base PostgreSQL, portée par le conteneur
`farmsim-db` et son volume `farmsim-pg`. Comptes, fermes, parcelles, argent,
troupeaux. Si ce volume disparaît, tout disparaît.

Les sauvegardes sont des fichiers `.dump` (format `pg_dump` custom, compressé)
dans `/var/backups/farmsim`. Chacune est **vérifiée en étant restaurée pour de
bon** dans une base jetable avant d'être conservée : une sauvegarde qu'on n'a
jamais relue n'est pas une sauvegarde, c'est une intention.

Ce document est fait pour être lu **le jour où ça va mal**, souvent depuis un
téléphone. Les explications sont dans les scripts ; ici, il n'y a que des
commandes.

---

## Mise en place — une seule fois

Sur le VPS, en SSH :

```bash
sudo cp /opt/farmsim/deploy/farmsim-backup.service /etc/systemd/system/
sudo cp /opt/farmsim/deploy/farmsim-backup.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now farmsim-backup.timer
```

Vérifier que c'est armé :

```bash
systemctl list-timers farmsim-backup.timer
```

Et en déclencher une tout de suite, pour ne pas attendre 3 h 20 du matin
avant d'avoir sa première sauvegarde :

```bash
sudo systemctl start farmsim-backup.service
journalctl -u farmsim-backup.service -n 20
```

---

## Vérifier que les sauvegardes tournent

```bash
sudo bash /opt/farmsim/scripts/farmsim-restore.sh
```

Sans argument, ce script **ne restaure rien** : il liste ce qui existe, avec
la taille et la date. C'est la commande à taper de temps en temps pour
s'assurer qu'on est couvert.

Une sauvegarde du jeu pèse une quinzaine de mégaoctets. Quatorze sont
conservées, soit environ 230 Mo et deux semaines de recul.

---

## Restaurer

```bash
sudo bash /opt/farmsim/scripts/farmsim-restore.sh              # 1. lister
sudo bash /opt/farmsim/scripts/farmsim-restore.sh farmsim-2026-08-17T032000Z.dump
```

Le script demande de taper `RESTAURER` en toutes lettres. Avant d'écraser
quoi que ce soit, il :

1. **relit la sauvegarde** et refuse de continuer si elle est abîmée ou vide ;
2. **met la base actuelle de côté** sous `avant-restauration-<date>.dump` — si
   l'on s'aperçoit qu'on a restauré la mauvaise, on peut revenir ;
3. arrête le jeu, remplace le fichier, redémarre, et attend que
   `/api/health` réponde.

> **Ce qui est perdu.** Tout ce que les joueurs ont fait entre la sauvegarde
> choisie et maintenant. Prenez la plus récente qui précède le problème.

---

## Sauvegarder à la main

Avant une manipulation risquée, par exemple :

```bash
sudo bash /opt/farmsim/scripts/farmsim-backup.sh avant-bidouille
```

Le déploiement le fait déjà tout seul : `vps-deploy.sh` prend un instantané
étiqueté `avant-deploi` **avant** de lancer les migrations, et **interrompt le
déploiement** si la sauvegarde échoue. Une migration qui abîmerait les données
est donc toujours réversible.

---

## Ce qui est vérifié, et par quoi

| Quoi | Où |
|---|---|
| L'instantané emporte ce qui vient d'être écrit | `scripts/__tests__/sauvegarde.test.mjs` |
| La sauvegarde est **restaurée** avant d'être gardée | idem |
| Une sauvegarde corrompue est refusée | idem |
| Une sauvegarde vide est refusée | idem |
| Un fichier raté n'est jamais laissé sur le disque | idem |
| La rotation ne garde que les plus récentes | idem |
| **Une restauration après perte totale de la base rend les données** | idem |
| L'enveloppe shell ne met aucun mot de passe en dur | idem |

Ces tests tournent à chaque intégration, avant chaque déploiement. C'est
volontaire : une sauvegarde qu'on n'a jamais restaurée n'est pas une
sauvegarde, c'est un fichier dont on espère quelque chose.

---

## Pourquoi `pg_dump` et pas une copie des fichiers

Copier le répertoire de données de PostgreSQL pendant que le jeu tourne donne
une base éventuellement incohérente : on attrape des pages écrites à des
instants différents, et rien ne le signale au moment de la copie.

`pg_dump` passe par le moteur : il lit dans une transaction, à un instant
unique, sans interrompre les joueurs. Le format « custom » (`-Fc`) est
compressé et se restaure table par table au besoin — ce qu'un fichier SQL à
plat ne permet pas.

## Pourquoi la sauvegarde est restaurée avant d'être gardée

`scripts/farmsim-backup.mjs` ne se contente pas de lire le sommaire de
l'archive : il la **restaure dans une base jetable**, y compte les tables
vitales, puis jette la base. C'est plus long, et c'est la seule vérification
qui prouve ce qu'on veut savoir — que le fichier est restaurable le jour où
tout aura brûlé. Une sauvegarde qui échoue à ce contrôle est effacée : un
fichier corrompu portant la date du jour est pire que pas de fichier.

---

## Ce que ces sauvegardes ne couvrent pas

Elles vivent **sur le même serveur** que le jeu, dans `/var/backups/farmsim`.
Elles protègent d'une migration ratée, d'une fausse manœuvre, d'un bogue qui
efface des données. Elles ne protègent pas de la perte du serveur entier.

Pour cela il faudrait les recopier ailleurs — chez un autre hébergeur, ou sur
une machine à la maison. Ce n'est pas fait ; c'est la prochaine marche, et
elle est courte une fois ce socle en place.
