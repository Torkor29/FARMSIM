# 50 — Atelier ETA : graisser, glisser, réparer

**Statut :** Implémenté (tranche jouable, pas encore la bourse chez les autres)  
**Date :** 2026-08-13  
**Voir :** [49_TRIANGLE_METIERS.md](./49_TRIANGLE_METIERS.md) § 7.3, 8.7, 8.8

---

## Ce qui est dans le jeu

**Céréalier / éleveur** : le bouton « Réparer » d'un clic, comme avant.

**ETA :**

1. **Au champ** — outil de travail en main, on **glisse** sur les cases. La machine suit. Deux doigts bougent la vue. Un tap sans glisser sélectionne encore.
2. **Graisser** — avant de partir, on touche les points d'huile sur l'illustration (12 CRD).
3. **Nettoyer** — souffler la poussière puis laver les taches (18 CRD).
4. **Réparer** — courroie (3 pièces), hydraulique (4), moteur (6 dans l'ordre). Plus c'est cassé, plus c'est long. Remise ETA −25 %.

Sans graisse : le premier chantier part quand même (usure ×1,5), le suivant est refusé. Sale (saleté ≥ 25) : usure ×2. Panne possible si l'état est bas et qu'on a négligé l'entretien — l'engin s'arrête, il faut le mini-jeu.

Les missions chez les autres (tableau, fermes PNJ) ne sont **pas** dans cette tranche. On glisse déjà sur **sa** parcelle, pour que le geste existe.

---

## API

`POST /machines/:id/grease` · `POST /machines/:id/clean` · `POST /machines/:id/service` `{ kind }`  
`POST /machines/:id/repair` refuse l'ETA (atelier obligatoire).
