# Plafonner les conteneurs — et pourquoi la première tentative a échoué

## Ce qui s'est passé

Le VPS était saturé : 246 Mo libres sur 1 906, 1 248 Mo d'échange sur 2 047,
charge moyenne 25,81 / 29,19 / 31,35. Le conteneur du jeu n'avait aucune
limite, et Node dimensionne son tas d'après la mémoire de **l'hôte** : il se
servait large, et le voisinage payait en pagination.

Des plafonds ont donc été posés — `cpus: 1.0`, `mem_limit: 896m`,
`memswap_limit: 896m`, plus `--max-old-space-size=192`. **Le déploiement qui
les portait a mis le site à terre** : 502, là où le déploiement précédent
rendait 200.

## Pourquoi c'était faux

Les mesures étaient réelles, et pourtant inutilisables :

| tas V8 | démarrage à froid | au repos | pic |
|---|---|---|---|
| libre | ok | 730–950 Mo | 1 157 Mo |
| 192 Mo | ok, 34 s | 331 Mo | 731 Mo |
| 128 Mo | échec — V8 renonce | — | — |

Elles ont toutes été prises **sur une instance au repos, sans un seul joueur
connecté**. Un pic de 731 Mo à vide ne dit rien du pic en service. Le plafond
de 896 Mo, posé 23 % au-dessus, l'était au-dessus du mauvais chiffre.

Deux aggravations s'y sont ajoutées :

- **`memswap_limit` égal à `mem_limit`** retirait le dernier coussin. Au lieu
  de ralentir sous la pression, le conteneur se faisait tuer net. C'était un
  choix défendable sur une machine dont on connaît le pic ; c'en était un
  mauvais sur une machine dont on ne le connaissait pas.
- **le balayage des codes tournait dans le conteneur du jeu.**
  `docker compose exec` démarre un second processus Node à l'intérieur, qui
  partage le plafond avec le jeu en train de tourner. Il a échoué, et le 502
  a suivi dans les trois secondes.

## Comment les remettre

1. **Mesurer en service.** Sur le serveur, jeu en marche et joueurs connectés,
   sur plusieurs heures et à travers au moins un changement de saison :

   ```
   while true; do
     docker stats --no-stream --format '{{.Name}} {{.MemUsage}} {{.CPUPerc}}' \
       farmsim farmsim-db
     sleep 60
   done | tee /var/log/farmsim-conso.log
   ```

   Ce qu'on cherche est le **pic**, pas la moyenne : c'est lui qui tue.

2. **Poser le plafond au-dessus du pic observé**, avec au moins 50 % de marge —
   pas 23 %. Une instance qui n'a jamais vu de joueur n'a pas vu son pic.

3. **Ne jamais fixer `memswap_limit` à la valeur de `mem_limit`** tant que le
   pic en service n'est pas connu de façon sûre. Sans cette ligne, le
   conteneur pagine quand il déborde — c'est lent, mais le site répond, et on
   le voit dans `docker stats` au lieu de le découvrir dans un 502.

4. **Vérifier après coup**, et pas seulement au déploiement :

   ```
   docker inspect farmsim --format '{{.State.OOMKilled}} {{.RestartCount}}'
   ```

   `true`, ou un compteur qui grimpe, veut dire que le plafond est trop bas.

5. **Garder les travaux lourds hors du conteneur du jeu.** Sauvegarde et
   balayage des codes tournent dans un conteneur jetable bâti sur la même
   image (`docker compose run --rm --no-deps farmsim …`) : ils ont leur propre
   mémoire, et leur échec ne peut pas emporter le jeu.

## Ce qui reste vrai, et qu'il ne faut pas oublier en chemin

Le problème d'origine n'a pas disparu. Sans plafond, le jeu peut reprendre
toute la machine, et c'est bien ce qu'il faisait. Les plafonds doivent revenir
— sur des mesures faites en service, et avec le coussin d'échange laissé
ouvert.

Et rien de tout cela ne rend les 1 248 Mo déjà partis en échange : seul un
redémarrage de la machine les rapatrie.
