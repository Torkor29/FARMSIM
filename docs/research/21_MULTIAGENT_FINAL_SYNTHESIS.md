# Synthèse finale multi-agents (tous domaines)

Tous les agents de recherche de la phase initiale ont terminé.  
Docs de référence : `docs/research/` · PR associée.

---

## Conclusions croisées

| Domaine | Agent | Verdict consolidé |
|---------|-------|-------------------|
| **FS** | Analyse Farming Simulator | Reprendre la *checklist* de champ + machines comme progression ; **ne pas** porter conduite 3D, licences, Precision Farming, maladies mods |
| **Agronomie** | Agriculture réelle | Bornes réelles (rendements, N, eau, IC) pour calibrer ; simuler stades critiques, pas la science complète |
| **Éco agri** | Économie agricole mondiale | Ancres FMI/Euronext ; option **B hybride** ; prix ≠ rentabilité (coûts) ; boucle feed↔fumier ; chocs mer Noire/WASDE |
| **Éco jeux** | Game economy MMO | Faucets/sinks mesurés ; spoil + taxes + office public ; soft/premium séparés ; risque nº1 = prix mal définis / trop peu de sinks d’items |
| **Monétisation/légal** | Monétisation et légal | F2P confort sans cash-out ; dual currency type BaK OK ; JONUM/e-money si monétisabilité+hasard ; cash-out = projet séparé |
| **Climat/carte** | Météo climat géographie | Bake Köppen/WorldClim/sols ; météo à la **cellule H3** ; sim hybride ; live Open-Meteo optionnel (licence) |
| **Multi/tech** | Multijoueur marché technique | Sim **lazy** `ready_at` ; Vite+React + Nest + PG + Redis ; presta escrow ; marchés régionaux+fret en V1 |
| **Marketing** | Communauté FS | Audience FS massive ; pitch *économie mondiale + browser*, jamais parité tracteurs ; YouTube mid-tier FR/EN/DE |

---

## Alignements (tous d’accord)

1. **Pas un clone FS navigateur** — différenciation Terre + marché + multi.
2. **Serveur autoritatif** + simulation persistante hors client.
3. **Bonus progression faibles** ; matériel et décisions > niveau RPG.
4. **Cash-out hors socle** ; monétisation cosmétique/confort.
5. **Filets NPC** pour éviter deadlocks (marché, engrais, feed).
6. **MVP étroit** : 2 cultures, marché NPC, machines basiques, météo simple, carte limitée.

## Tensions résolues dans la doc

| Tension | Résolution retenue |
|---------|-------------------|
| Prix live vs contrôle | Hybride B (ancre réelle + sim) |
| Réalisme temps vs session 5 min | Compression + catch-up lazy |
| Interdépendance céréales/élevage | Boucle réelle + filets NPC |
| Next vs Vite | Vite+React jeu ; Next marketing optionnel |
| Marché mondial unique vs manipulation | NPC mondial MVP → régionaux + fret V1 |

## Prochaine étape produit

Valider les **questions ouvertes (section P)** de `17_EXECUTIVE_REPORT.md`, puis démarrer le harness de simulation économique et le MVP — **pas** le polish 3D d’abord.
