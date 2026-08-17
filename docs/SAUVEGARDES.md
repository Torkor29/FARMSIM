# Sauvegardes — ce qu'il faut taper

Tout FARMSIM tient dans un fichier : `/data/farmsim.db`, sur le volume Docker
`farmsim-data`. Comptes, fermes, parcelles, argent, troupeaux. S'il disparaît,
tout disparaît.

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
sudo bash /opt/farmsim/scripts/farmsim-restore.sh farmsim-2026-08-17T032000Z.db
```

Le script demande de taper `RESTAURER` en toutes lettres. Avant d'écraser
quoi que ce soit, il :

1. **relit la sauvegarde** et refuse de continuer si elle est abîmée ou vide ;
2. **met la base actuelle de côté** sous `avant-restauration-<date>.db` — si
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
| L'instantané emporte le journal WAL | `scripts/__tests__/sauvegarde.test.mjs` |
| Une sauvegarde corrompue est refusée | idem |
| Une sauvegarde vide est refusée | idem |
| Un fichier raté n'est jamais laissé sur le disque | idem |
| La rotation ne garde que les plus récentes | idem |
| **Une restauration après perte totale rend les données** | idem |

Ces tests tournent à chaque intégration, avant chaque déploiement. C'est
volontaire : une sauvegarde qu'on n'a jamais restaurée n'est pas une
sauvegarde, c'est un fichier dont on espère quelque chose.

---

## Pourquoi `VACUUM INTO` et pas une copie

Copier `farmsim.db` pendant que le jeu tourne donne une base éventuellement
corrompue : on peut attraper une écriture à moitié faite. Et en mode WAL, les
transactions validées vivent dans un fichier `-wal` séparé — une copie du seul
`.db` les laisserait derrière elle, sans que rien ne le signale.

`VACUUM INTO` passe par le moteur SQLite : il écrit un fichier neuf et
cohérent, WAL compris, sans interrompre les joueurs. C'est ce que fait
`scripts/farmsim-backup.mjs`, et c'est cette propriété que teste
« emporte ce qui n'est encore que dans le journal WAL ».

---

## Ce que ces sauvegardes ne couvrent pas

Elles vivent **sur le même serveur** que le jeu, dans `/var/backups/farmsim`.
Elles protègent d'une migration ratée, d'une fausse manœuvre, d'un bogue qui
efface des données. Elles ne protègent pas de la perte du serveur entier.

Pour cela il faudrait les recopier ailleurs — chez un autre hébergeur, ou sur
une machine à la maison. Ce n'est pas fait ; c'est la prochaine marche, et
elle est courte une fois ce socle en place.
