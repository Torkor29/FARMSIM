# 33 — Direction artistique « Farming Navigator »

**Statut :** Spécification de référence (à implémenter)
**Branche :** `cursor/direction-artistique-farmsim-87aa`
**Date :** 2026-08-12
**Portée :** identité visuelle, tokens CSS, typographie, style 3D low-poly, globe, personnages, layout responsive, animations.

---

## 0. Diagnostic et intention

### 0.1 Ce que dit le client

> « C'est très moche, ça n'utilise pas toute la place, couleurs très sombres, polices pas stimulantes, on ne comprend rien. »

### 0.2 Ce que montre l'audit du code existant

| Fichier | Constat | Conséquence perçue |
|---|---|---|
| `styles.css` | `background: #0e1620`, `--ink: #e8eef5`, `--glass: rgba(12,18,28,.72)` | Interface **sombre, froide, « dashboard technique »**, l'opposé d'un jeu de ferme |
| `styles.css` | `.shell { max-width: 960px }` | Sur 1920 px, **50 % de l'écran est perdu** → « ça n'utilise pas toute la place » |
| `styles.css` | Panneaux `position: absolute` empilés aux 4 coins, largeur `min(260px, …)` | Le centre est vide, les bords sont saturés → **hiérarchie illisible** |
| `styles.css` | `DM Sans` + `Syne`, `letter-spacing: -0.02em`, tailles 0.62 → 0.95 rem | Typo **corporate et minuscule**, non « stimulante », illisible en mobile |
| `IsoFarmView.tsx` | `skyFor()` renvoie `0x1a2430` … `0x3a4555` | Ciel **gris-nuit permanent**, même par beau temps |
| `IsoFarmView.tsx` | `AmbientLight 0.55` + `DirectionalLight 1.05` | Éclairage plat + ombres dures, **pas de rebond de ciel** |
| `IsoFarmView.tsx` | Sol `0x5a7a42` / `0x4a6436`, hexagones `0x2d4a38` | **Verts kaki désaturés**, tristes |
| `auth.css` | Dégradés `#0f1a24 → #0a1218` | Onboarding **anxiogène**, ne vend pas le jeu |

### 0.3 Intention créative — la phrase directrice

> **« Un après-midi de fin d'été, vu du ciel, en papier découpé. »**

Trois piliers non négociables :

1. **LUMINEUX** — fond crème/ciel clair par défaut, jamais de `#0e1620`. La lumière vient du haut, chaude, dorée.
2. **CHALEUREUX & DORÉ** — l'or du logo (`#c9a227`) est la couleur de récompense/valeur, le teal (`#1a6b5a`) la couleur d'identité/navigation.
3. **GUIDÉ** — un seul point focal par écran, une seule action primaire visible, une couleur = une signification.

### 0.4 Références et ce qu'on en prend

| Référence | Ce qu'on emprunte | Ce qu'on n'emprunte pas |
|---|---|---|
| **Monument Valley** | Palette pastel désaturée-lumineuse, composition centrée | Surréalisme, absence d'UI |
| **Islanders** | Low-poly ultra-propre, ombres douces, brume claire | Minimalisme austère de l'UI |
| **Townscaper** | Couleurs plates saturées, silhouette lisible à 100 % de zoom out | Absence totale de HUD |
| **Dorfromantik** | Sol en tuiles, transitions douces entre biomes | Palette automnale trop sourde |
| **Hay Day** | Rondeur, gros boutons, icônes lisibles au pouce, feedback juteux | Skeuomorphisme, textures cartoon peintes |
| **Big Farm Story** | Ambiance rurale chaleureuse | Rendu 2D détaillé |
| **Two Point Campus** | Clarté des panneaux de gestion, chiffres lisibles | Humour visuel, palette bureau |

---

## 1. Palette complète (thème CLAIR par défaut)

### 1.1 Dérivation depuis le logo

Le logo fournit trois ancres : **or `#c9a227`**, **teal `#1a6b5a`**, et le **contraste or-sur-teal**. On en déduit deux rampes de 9 valeurs (50 → 900), plus des neutres chauds (crème/terre), un ciel, des sémantiques et des cultures.

### 1.2 Rampe OR (identité, valeur, récompense)

| Token | Hex | Usage | Contraste vs crème `#fdf8ec` | Contraste vs teal 700 `#12503f` |
|---|---|---|---|---|
| `--gold-50` | `#fefaef` | Fond de carte « récompense » | 1.00 | 8.6 ✅ |
| `--gold-100` | `#f7e9b8` | Surbrillance, bandeau doré clair | 1.15 | 7.71 ✅ AAA |
| `--gold-200` | `#f0d98c` | Bordure de carte premium | 1.32 | — |
| `--gold-300` | `#e6c860` | Texte or **sur fond sombre uniquement** | 1.55 ❌ | 5.70 ✅ AA |
| `--gold-400` | `#d9b53c` | Remplissage de jauge, pièces | 1.85 | — |
| `--gold-500` | `#c9a227` | **Couleur de marque n°2.** Bouton d'achat, bordures hexagone | 2.28 ❌ texte | 3.87 ✅ (gros texte) |
| `--gold-600` | `#a8851c` | Bord bas de bouton or (relief) | 3.35 | — |
| `--gold-700` | `#8f7015` | **Texte or lisible sur clair** | 4.41 ✅ AA | — |
| `--gold-800` | `#6b5310` | Icône or sur crème | 6.31 ✅ AAA | — |
| `--gold-900` | `#42330a` | Texte sur bouton or plein | 8.9 vs `#c9a227` ✅ | — |

> **Règle absolue :** `--gold-500` ne sert **jamais** de couleur de texte sur fond clair (2.28:1). Pour du texte or sur crème, utiliser `--gold-700`.

### 1.3 Rampe TEAL (marque, navigation, structure)

| Token | Hex | Usage | Contraste vs crème | Contraste vs blanc |
|---|---|---|---|---|
| `--teal-50` | `#e8f7f1` | Fond de section « info » | 1.06 | 1.12 |
| `--teal-100` | `#d9f0e7` | Puce sélectionnée, hover doux | 1.12 | 1.19 |
| `--teal-200` | `#a9dfcc` | Bordure active | 1.45 | — |
| `--teal-300` | `#7ecab4` | Accent sur fond sombre | 1.80 ❌ | 1.91 ❌ |
| `--teal-400` | `#3fa389` | Icônes décoratives | 2.9 | — |
| `--teal-500` | `#2a8a74` | Hover de bouton teal | 4.1 | 4.35 |
| `--teal-600` | `#1a6b5a` | **Couleur de marque n°1** (fond du logo). Barre de nav, bouton primaire | 6.01 ✅ AA | 6.37 ✅ AA |
| `--teal-700` | `#12503f` | Texte de titre teal, bord bas de bouton | 8.83 ✅ AAA | 9.35 ✅ AAA |
| `--teal-800` | `#0d3b2e` | Ombre teintée | 11.6 ✅ | — |
| `--teal-900` | `#08251d` | Texte maximal contraste sur teal clair | 15.1 ✅ | — |

### 1.4 Neutres CHAUDS (fonds clairs — cœur de la refonte)

| Token | Hex | Usage | Contraste texte encre `#12261f` |
|---|---|---|---|
| `--cream-0` | `#fffdf8` | Surface de carte la plus haute (modales) | 15.6 ✅ AAA |
| `--cream-50` | `#fdf8ec` | **Fond d'application par défaut** | 14.98 ✅ AAA |
| `--cream-100` | `#f9f1de` | Fond de carte standard | 14.1 ✅ AAA |
| `--sand-200` | `#f6ecd8` | Fond de section alternée, rails | 13.54 ✅ AAA |
| `--sand-300` | `#ead9ba` | Séparateurs, bordures 1 px | 11.3 |
| `--sand-400` | `#d6c19a` | Bordure marquée, désactivé | 8.6 |
| `--earth-500` | `#a9784f` | Terre labourée, bois, icônes rustiques | 4.1 |
| `--earth-600` | `#7d5636` | Texte « terre » secondaire | 6.4 ✅ AA |
| `--earth-700` | `#4d3521` | Silhouettes, contours 3D | 10.4 ✅ |

### 1.5 Ciel et atmosphère

| Token | Hex | Usage |
|---|---|---|
| `--sky-100` | `#eaf7fe` | Haut du dégradé de ciel (clair) |
| `--sky-200` | `#cfeafb` | Fond de scène 3D par beau temps |
| `--sky-300` | `#a9d9f5` | Bas de ciel / brume |
| `--sky-500` | `#5aa9dd` | Eau, rivières, océan du globe |
| `--sky-700` | `#2f6ea8` | Eau profonde, texte info |
| `--dusk-300` | `#f9cfa4` | Bandeau crépuscule (fin de journée) |
| `--dusk-500` | `#e88f5a` | Soleil bas, événement saisonnier |

### 1.6 Couleurs de texte

| Token | Hex | Usage | Contraste vs `--cream-50` |
|---|---|---|---|
| `--ink` | `#12261f` | Texte principal (encre vert-noir chaud, jamais `#000`) | 14.98 ✅ AAA |
| `--ink-soft` | `#2b3a33` | Titres secondaires, labels forts | 11.29 ✅ AAA |
| `--ink-muted` | `#5b6b62` | Texte secondaire, unités, aides | 5.32 ✅ AA |
| `--ink-disabled` | `#8b988f` | Désactivé (jamais porteur d'info seule) | 2.9 ❌ |
| `--ink-inverse` | `#fdf8ec` | Texte sur teal 600/700 et sur photo | 6.01 / 8.83 ✅ |

### 1.7 Couleurs sémantiques

| Token | Hex | Variante texte-sur-clair | Usage | Contraste (variante) |
|---|---|---|---|---|
| `--success` | `#2fae6a` | `--success-ink` `#1c7a4a` | Récolte prête, gain, validation | 5.04 ✅ AA |
| `--success-bg` | `#e2f7ec` | — | Fond de toast succès | — |
| `--danger` | `#e04b3a` | `--danger-ink` `#b03a2b` | Perte, panne, action destructive | 5.68 ✅ AA |
| `--danger-bg` | `#fdeae7` | — | Fond de toast erreur | — |
| `--warning` | `#f0a020` | `--warning-ink` `#a8641a` | Sécheresse, stock bas, échéance | 4.40 ✅ AA |
| `--warning-bg` | `#fdf1dc` | — | Fond d'alerte douce | — |
| `--info` | `#2f8fd8` | `--info-ink` `#1f6ea8` | Météo, tutoriel, astuce | 5.14 ✅ AA |
| `--info-bg` | `#e4f2fc` | — | Fond de bulle tutoriel | — |

> **Règle :** le **fond** utilise la version `-bg`, le **texte** la version `-ink`, la **pastille/icône** la version pleine. Jamais de texte `--success` (#2fae6a, 2.68:1) sur crème.

### 1.8 Couleurs de cultures et productions

Ces couleurs servent **à la fois** aux matériaux Three.js et aux pastilles UI : cohérence carte ↔ interface.

| Culture / produit | Token | Hex UI | Hex 3D (jeune) | Hex 3D (mûr) | Pastille texte |
|---|---|---|---|---|---|
| Blé | `--crop-wheat` | `#e0b542` | `#8fbf5a` | `#e8c65c` | `#6b5310` |
| Maïs | `--crop-corn` | `#f2c53d` | `#78b84e` | `#f2c53d` | `#7a5c0e` |
| Orge | `--crop-barley` | `#d8c07a` | `#9cc46a` | `#dfcb8a` | `#6f5c22` |
| Colza | `--crop-rapeseed` | `#f5d20c` | `#84c14a` | `#f5d20c` | `#6a5a04` |
| Betterave | `--crop-beet` | `#a24a6e` | `#5aa04a` | `#a24a6e` | `#ffffff` |
| Pomme de terre | `--crop-potato` | `#c99a5b` | `#4f9a4a` | `#c99a5b` | `#4a3315` |
| Herbe / prairie | `--crop-grass` | `#7bbf5a` | `#84c95f` | `#6aa84a` | `#2f5a1f` |
| Luzerne | `--crop-alfalfa` | `#5fae72` | `#6fbc7f` | `#4e9a62` | `#1f4a2c` |
| Sol nu labouré | `--soil-tilled` | `#8a6141` | — | — | `#ffffff` |
| Sol semé | `--soil-seeded` | `#9c7a52` | — | — | `#ffffff` |
| Jachère | `--soil-fallow` | `#b9a077` | — | — | `#3a2e18` |
| Lait | `--prod-milk` | `#f4f1e6` | — | — | `#2b3a33` |
| Viande | `--prod-meat` | `#d4746c` | — | — | `#ffffff` |
| Fourrage | `--prod-fodder` | `#c9a94e` | — | — | `#4a3a10` |

### 1.9 Bloc de tokens CSS prêt à coller

```css
:root {
  color-scheme: light;

  /* — OR — */
  --gold-50: #fefaef;  --gold-100: #f7e9b8; --gold-200: #f0d98c;
  --gold-300: #e6c860; --gold-400: #d9b53c; --gold-500: #c9a227;
  --gold-600: #a8851c; --gold-700: #8f7015; --gold-800: #6b5310;
  --gold-900: #42330a;

  /* — TEAL — */
  --teal-50: #e8f7f1;  --teal-100: #d9f0e7; --teal-200: #a9dfcc;
  --teal-300: #7ecab4; --teal-400: #3fa389; --teal-500: #2a8a74;
  --teal-600: #1a6b5a; --teal-700: #12503f; --teal-800: #0d3b2e;
  --teal-900: #08251d;

  /* — NEUTRES CHAUDS — */
  --cream-0: #fffdf8;  --cream-50: #fdf8ec; --cream-100: #f9f1de;
  --sand-200: #f6ecd8; --sand-300: #ead9ba; --sand-400: #d6c19a;
  --earth-500: #a9784f; --earth-600: #7d5636; --earth-700: #4d3521;

  /* — CIEL — */
  --sky-100: #eaf7fe; --sky-200: #cfeafb; --sky-300: #a9d9f5;
  --sky-500: #5aa9dd; --sky-700: #2f6ea8;
  --dusk-300: #f9cfa4; --dusk-500: #e88f5a;

  /* — TEXTE — */
  --ink: #12261f; --ink-soft: #2b3a33; --ink-muted: #5b6b62;
  --ink-disabled: #8b988f; --ink-inverse: #fdf8ec;

  /* — SÉMANTIQUE — */
  --success: #2fae6a; --success-ink: #1c7a4a; --success-bg: #e2f7ec;
  --danger: #e04b3a;  --danger-ink: #b03a2b;  --danger-bg: #fdeae7;
  --warning: #f0a020; --warning-ink: #a8641a; --warning-bg: #fdf1dc;
  --info: #2f8fd8;    --info-ink: #1f6ea8;    --info-bg: #e4f2fc;

  /* — CULTURES — */
  --crop-wheat: #e0b542; --crop-corn: #f2c53d; --crop-barley: #d8c07a;
  --crop-rapeseed: #f5d20c; --crop-beet: #a24a6e; --crop-potato: #c99a5b;
  --crop-grass: #7bbf5a; --crop-alfalfa: #5fae72;
  --soil-tilled: #8a6141; --soil-seeded: #9c7a52; --soil-fallow: #b9a077;
  --prod-milk: #f4f1e6; --prod-meat: #d4746c; --prod-fodder: #c9a94e;

  /* — RÔLES (à utiliser dans les composants, pas les rampes brutes) — */
  --bg-app: var(--cream-50);
  --bg-surface: var(--cream-0);
  --bg-surface-2: var(--sand-200);
  --bg-nav: var(--teal-600);
  --border-soft: var(--sand-300);
  --border-strong: var(--sand-400);
  --accent: var(--teal-600);
  --accent-hot: var(--gold-500);
  --focus-ring: #2f8fd8;
}
```

### 1.10 Thème sombre (optionnel, jamais par défaut)

Une session nocturne peut être proposée en option, mais l'app **démarre toujours en clair**.

```css
[data-theme="night"] {
  --bg-app: #12241f;      /* vert-nuit chaud, pas bleu-gris */
  --bg-surface: #1b3129;
  --bg-surface-2: #244035;
  --ink: #edf6f0;
  --ink-muted: #a8c0b4;
  --border-soft: #2f4d41;
  --accent-hot: var(--gold-300); /* l'or s'éclaircit sur fond sombre */
}
```

---

## 2. Typographie

### 2.1 Choix : 3 familles Google Fonts (toutes SIL OFL, gratuites)

| Rôle | Famille | Graisses chargées | Pourquoi |
|---|---|---|---|
| **Titres / marque** | **Baloo 2** | 600, 700, 800 | Grotesque **arrondie et charnue**, très haute hauteur d'x, terminaisons douces. C'est la police qui « sourit » : elle porte l'énergie mobile-game demandée. Supporte l'or embossé (fûts épais → le relief se voit). Latin étendu complet (accents FR : É, È, Ç, À). |
| **Interface / corps** | **Nunito** | 400, 600, 700, 800 | Sans-serif **arrondie mais neutre**, conçue pour l'écran, excellente lisibilité à 14–16 px. Cousine typographique de Baloo 2 (mêmes terminaisons rondes) sans concurrencer les titres. Métriques stables, 7 graisses. |
| **Chiffres / données** | **Outfit** | 500, 600, 700 | Géométrique aux **chiffres tabulaires réguliers**, zéro très ouvert, différenciation 0/O et 1/l nette. Utilisée uniquement pour prix, tonnages, ha, dates — la lecture comparative en colonne devient immédiate. |

**Alternatives évaluées et écartées :** *Fredoka* (trop peu de graisses pour du texte long, chasse très large → casse les tableaux), *Bricolage Grotesque* (excellente en titre mais anguleuse, contredit la rondeur voulue), *DM Sans* + *Syne* (l'existant : corporate et froid, exactement le reproche du client).

### 2.2 Chargement

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
```

```css
:root {
  --font-display: "Baloo 2", "Nunito", system-ui, sans-serif;
  --font-body: "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-numeric: "Outfit", "Nunito", system-ui, sans-serif;
}
body { font-family: var(--font-body); font-weight: 400; color: var(--ink); }
h1, h2, h3, h4, .brand, .btn, .tab { font-family: var(--font-display); font-weight: 700; }
.num, .price, .stat-value, td.num { font-family: var(--font-numeric); font-variant-numeric: tabular-nums; font-weight: 600; }
```

> Baloo 2 a une hauteur d'x élevée : ne jamais descendre son `line-height` sous 1.1, et prévoir `letter-spacing: 0` (surtout **pas** le `-0.02em` actuel, qui colle les lettres rondes).

### 2.3 Échelle typographique (base 16 px, ratio 1.25 « majeure tierce » adouci)

| Token | rem | px @16 | Police | Graisse | Line-height | Letter-spacing | Usage |
|---|---|---|---|---|---|---|---|
| `--fs-hero` | 3.5rem | 56 | Display | 800 | 1.05 | -0.01em | Splash « FARMING NAVIGATOR » (desktop) |
| `--fs-h1` | 2.5rem | 40 | Display | 800 | 1.10 | 0 | Titre d'écran principal |
| `--fs-h2` | 2rem | 32 | Display | 700 | 1.15 | 0 | Titre de section, nom de ferme |
| `--fs-h3` | 1.5rem | 24 | Display | 700 | 1.20 | 0 | Titre de carte / panneau |
| `--fs-h4` | 1.25rem | 20 | Display | 600 | 1.25 | 0 | Sous-titre, nom de parcelle |
| `--fs-lg` | 1.125rem | 18 | Body | 600 | 1.45 | 0 | Chapô, texte de tutoriel |
| `--fs-base` | 1rem | 16 | Body | 400 | 1.55 | 0 | **Texte courant — plancher absolu** |
| `--fs-sm` | 0.875rem | 14 | Body | 600 | 1.45 | 0.005em | Labels, légendes de bouton secondaire |
| `--fs-xs` | 0.75rem | 12 | Body | 700 | 1.35 | 0.04em | Badges, majuscules courtes **uniquement** |
| `--fs-stat-xl` | 2rem | 32 | Numeric | 700 | 1.0 | -0.01em | Solde, chiffre héros du HUD |
| `--fs-stat` | 1.25rem | 20 | Numeric | 600 | 1.1 | 0 | Valeurs de stats, prix marché |
| `--fs-stat-sm` | 1rem | 16 | Numeric | 600 | 1.2 | 0 | Valeurs en tableau |

**Interdits** : plus aucune taille sous **0.75 rem** (l'existant descend à 0.62 rem → illisible). Le texte de bouton ne descend jamais sous `--fs-sm`.

### 2.4 Titres fluides

```css
.brand-hero { font-size: clamp(2rem, 7vw, 3.5rem); }
h1 { font-size: clamp(1.75rem, 4.5vw, 2.5rem); }
h2 { font-size: clamp(1.375rem, 3vw, 2rem); }
h3 { font-size: clamp(1.125rem, 2vw, 1.5rem); }
```

### 2.5 Effet « or embossé » du logo, en CSS

Pour reproduire le lettrage doré du logo sur les titres de marque (splash, écran d'auth) :

```css
.brand-gold {
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: 0.02em;
  background: linear-gradient(178deg, #fbeaa8 0%, #e6c860 28%, #c9a227 52%, #8f7015 74%, #d9b53c 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: 0 1px 0 rgba(255,255,255,.45), 0 2px 0 #6b5310, 0 4px 10px rgba(66,51,10,.35);
  paint-order: stroke fill;
  -webkit-text-stroke: 1px rgba(107,83,16,.55);
}
```

Sur fond clair, poser ce lettrage sur une plaque teal (`--teal-600`) ou un halo teal radial — l'or n'a pas assez de contraste sur crème seul.

### 2.6 Règles de contenu rédactionnel

- **Une idée par ligne.** Aucun paragraphe de plus de 3 lignes dans le HUD.
- **Verbe à l'infinitif** sur les boutons d'action : « Semer », « Récolter », « Acheter la parcelle ».
- **Unités toujours accolées et en `--ink-muted`** : `12,4 <span class="unit">ha</span>`.
- **Chiffres en `--font-numeric`**, séparateur de milliers espace fine insécable, monnaie suffixée : `48 200 €`.
- Majuscules **uniquement** sur badges ≤ 3 mots (`--fs-xs`, `letter-spacing: .04em`).

---

## 3. Système d'espacement, rayons, ombres, élévations

### 3.1 Espacement (base 4 px)

| Token | rem | px | Usage |
|---|---|---|---|
| `--sp-0` | 0 | 0 | Reset |
| `--sp-1` | 0.25rem | 4 | Écart icône ↔ label |
| `--sp-2` | 0.5rem | 8 | Padding interne serré, gap de chips |
| `--sp-3` | 0.75rem | 12 | Gap de liste |
| `--sp-4` | 1rem | 16 | **Padding de carte standard**, gap de grille |
| `--sp-5` | 1.25rem | 20 | Padding de carte confort |
| `--sp-6` | 1.5rem | 24 | Gap entre blocs |
| `--sp-8` | 2rem | 32 | Marge de section |
| `--sp-10` | 2.5rem | 40 | Séparation majeure |
| `--sp-12` | 3rem | 48 | Respiration d'écran desktop |
| `--sp-16` | 4rem | 64 | Bandes héro |

### 3.2 Rayons de bordure — la rondeur est identitaire

| Token | Valeur | Usage |
|---|---|---|
| `--r-xs` | 6px | Pastilles de couleur, swatchs |
| `--r-sm` | 10px | Champs de saisie, petits chips |
| `--r-md` | 14px | Boutons secondaires, cellules de grille |
| `--r-lg` | 20px | **Cartes, panneaux — valeur par défaut** |
| `--r-xl` | 28px | Modales, feuilles mobiles (bottom sheets) |
| `--r-2xl` | 36px | Conteneur héro, écran d'auth |
| `--r-pill` | 999px | Boutons primaires, badges, jauges |
| `--r-hex` | — | Masque hexagonal (`clip-path: polygon(50% 0%,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)`) pour avatars et icônes de classe |

### 3.3 Ombres — chaudes, jamais noires pures

Toutes les ombres sont teintées `rgba(74, 59, 26, α)` (brun-doré) plutôt que noires : sur fond crème, une ombre noire « salit ».

| Token | Valeur | Élévation |
|---|---|---|
| `--sh-0` | `none` | Fond, à plat |
| `--sh-1` | `0 1px 2px rgba(74,59,26,.08), 0 1px 1px rgba(74,59,26,.06)` | Séparateur, chip |
| `--sh-2` | `0 2px 6px rgba(74,59,26,.10), 0 4px 12px rgba(74,59,26,.06)` | **Carte au repos** |
| `--sh-3` | `0 4px 12px rgba(74,59,26,.12), 0 10px 24px rgba(74,59,26,.08)` | Carte survolée, panneau flottant |
| `--sh-4` | `0 8px 20px rgba(74,59,26,.14), 0 20px 44px rgba(74,59,26,.10)` | Feuille mobile, dropdown |
| `--sh-5` | `0 16px 32px rgba(74,59,26,.18), 0 32px 72px rgba(74,59,26,.14)` | Modale, tutoriel |
| `--sh-inset` | `inset 0 1px 0 rgba(255,255,255,.75)` | Liseré supérieur « verre chaud » sur toute carte |
| `--sh-gold` | `0 6px 18px rgba(201,162,39,.35)` | Lueur de bouton d'achat |
| `--sh-teal` | `0 6px 18px rgba(26,107,90,.28)` | Lueur de bouton primaire |
| `--sh-press` | `inset 0 3px 6px rgba(74,59,26,.20)` | État pressé |

### 3.4 Boutons en relief « jouet » (clé du look mobile premium)

Le relief vient d'une **bordure basse pleine** (technique Hay Day / Clash), pas d'un dégradé :

```css
.btn-primary {
  background: linear-gradient(180deg, var(--teal-500), var(--teal-600));
  border: none;
  border-bottom: 4px solid var(--teal-800);
  border-radius: var(--r-pill);
  color: var(--ink-inverse);
  font: 700 1rem/1 var(--font-display);
  padding: 0.875rem 1.5rem;
  min-height: 48px;
  box-shadow: var(--sh-teal);
  transition: transform .12s cubic-bezier(.34,1.56,.64,1), border-width .08s ease;
}
.btn-primary:active { transform: translateY(3px); border-bottom-width: 1px; box-shadow: var(--sh-press); }

.btn-gold {
  background: linear-gradient(180deg, var(--gold-400), var(--gold-500));
  border-bottom: 4px solid var(--gold-700);
  color: var(--gold-900);              /* 8.9:1 sur or ✅ */
  box-shadow: var(--sh-gold);
}
```

### 3.5 Élévations — carte des z-index

| Couche | z-index | Contenu |
|---|---|---|
| Scène 3D | 0 | Canvas Three.js, plein écran |
| Sol UI | 10 | Rails latéraux, dock d'outils |
| HUD flottant | 20 | Ressources, ticker marché |
| Panneaux contextuels | 30 | Inspecteur de parcelle, garage |
| Feuilles / drawers | 40 | Bottom sheet mobile |
| Modales | 50 | Achat, confirmation |
| Tutoriel (spotlight) | 60 | Masque + bulle |
| Toasts | 70 | Notifications |
| Splash | 100 | Écran de démarrage |

### 3.6 Autres tokens

| Token | Valeur | Usage |
|---|---|---|
| `--border-w` | 1px | Bordures fines |
| `--border-w-strong` | 2px | Cartes sélectionnées |
| `--tap-min` | 48px | Cible tactile minimale (dock : 56px) |
| `--dur-fast` | 120ms | Press, hover |
| `--dur-base` | 220ms | Apparition d'élément |
| `--dur-slow` | 380ms | Transition de panneau |
| `--dur-page` | 520ms | Changement d'écran |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | Entrées |
| `--ease-bounce` | `cubic-bezier(.34,1.56,.64,1)` | Pop, récompense |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | Déplacements |

---

## 4. Style low-poly 3D — règles Three.js

### 4.1 Principes

1. **Facettes visibles, assumées.** `flatShading: true` partout, aucun `smoothShading`.
2. **Zéro texture.** Uniquement des couleurs de matériau plates. La variation vient de la **lumière** et de légères variations de teinte par instance (±3 % de luminosité).
3. **Silhouette avant détail.** Un objet doit être identifiable à 40 px de haut à l'écran.
4. **Budget de faces strict** (voir 4.2) : la scène complète vise **< 120 000 triangles** et **< 120 draw calls** pour tenir 60 fps sur mobile milieu de gamme.
5. **Pas de contour noir.** Le contour est obtenu par contraste de valeur avec le sol et une ombre de contact, pas par un outline. Exception : un `--edge-gold` (voir 4.7) pour l'objet sélectionné.

### 4.2 Budget de géométrie par objet

| Objet | Faces cible | Segments / notes |
|---|---|---|
| Dalle de parcelle | 12 tris | `BoxGeometry(1, .18, 1)` |
| Plante (culture) | 24–60 tris | 3 à 5 « touffes » `ConeGeometry(r, h, 5)` |
| Arbre | 40–70 tris | Tronc `Cylinder(…, 5)` + 2 `Icosahedron(0.45, 0)` |
| Bâtiment simple | 60–140 tris | Box + toit `Cylinder(…, 3)` couché (prisme) |
| Silo | 80 tris | `Cylinder(r1, r2, h, 8)` + `Cone(…, 8)` |
| Tracteur | 180–260 tris | 6–9 primitives |
| Moissonneuse | 260–360 tris | 10–12 primitives |
| Personnage | 220–320 tris | 12–16 primitives (voir §6) |
| Animal (vache) | 140–200 tris | 8 primitives |
| Globe (sphère) | 1 280 tris | `IcosahedronGeometry(R, 4)` |
| Continent extrudé | 200–900 tris | selon complexité du tracé |

**Segments de révolution autorisés : 5, 6 ou 8 uniquement.** Jamais 32 (défaut Three.js) — ça détruit le look low-poly et le budget.

### 4.3 Éclairage — recette exacte

```js
// Ciel : rebond bleu doux depuis le haut, rebond herbe/terre depuis le bas
const hemi = new THREE.HemisphereLight(0xdff0ff, 0xc8b48a, 1.05);
hemi.position.set(0, 30, 0);
scene.add(hemi);

// Soleil de fin d'après-midi, chaud, incliné 40°
const sun = new THREE.DirectionalLight(0xfff0d0, 1.45);
sun.position.set(14, 20, 10);          // azimut ~35°, élévation ~42°
sun.target.position.set(0, 0, 0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);    // 1024 sur mobile
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;  sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 1;  sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
sun.shadow.radius = 4;                 // ombres DOUCES (PCFSoft)
scene.add(sun, sun.target);

// Contre-jour froid très faible : détache les silhouettes du fond
const rim = new THREE.DirectionalLight(0xbfe0ff, 0.28);
rim.position.set(-12, 8, -14);
scene.add(rim);

// Ambiante minimale : le hemisphere fait déjà le travail
scene.add(new THREE.AmbientLight(0xfff6e6, 0.18));
```

**Renderer :**

```js
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
```

**Ciel et brume — clairs, par météo :**

| Météo | `scene.background` | Fog (linéaire) | `sun.intensity` | Couleur soleil |
|---|---|---|---|---|
| CLEAR | `0xcfeafb` | `Fog(0xdff2fd, 34, 78)` | 1.45 | `0xfff0d0` |
| CLOUDY | `0xdfe8ee` | `Fog(0xe8eff4, 28, 66)` | 0.95 | `0xfff6ea` |
| RAIN | `0xc7d6df` | `Fog(0xd4e0e8, 22, 55)` | 0.65 | `0xeaf2f8` |
| STORM | `0xa8b8c4` | `Fog(0xbcc9d2, 18, 46)` | 0.5 | `0xdfe8f2` |
| SNOW | `0xe6eff6` | `Fog(0xf0f6fa, 20, 52)` | 0.85 | `0xfbfdff` |
| GOLDEN (soir) | `0xfbdcb4` | `Fog(0xfce3c4, 30, 70)` | 1.3 | `0xffd39a` |

> Aucune valeur de ciel ne descend sous une luminance de ~0.60. Le remplacement de `skyFor()` (actuellement 0x1a2430 → 0x3a4555) est le **changement au plus fort impact perçu** de tout ce document.

### 4.4 Matériaux

`MeshLambertMaterial` avec `flatShading` reste le meilleur rapport qualité/coût pour du low-poly mat. Pour les surfaces qui doivent accrocher (or, métal, eau), passer en `MeshStandardMaterial`.

| Famille | Type | Paramètres |
|---|---|---|
| Sol, végétation, bois | `MeshLambertMaterial` | `{ flatShading: true }` |
| Bâtiments | `MeshLambertMaterial` | `{ flatShading: true }` |
| Or / métal doré | `MeshStandardMaterial` | `{ color: 0xc9a227, metalness: .75, roughness: .35, flatShading: true }` |
| Métal de machine | `MeshStandardMaterial` | `{ metalness: .35, roughness: .55, flatShading: true }` |
| Eau | `MeshStandardMaterial` | `{ color: 0x5aa9dd, metalness: .1, roughness: .18, transparent: true, opacity: .88, flatShading: true }` |
| Verre de cabine | `MeshStandardMaterial` | `{ color: 0xbfe3f2, transparent: true, opacity: .55, roughness: .1 }` |
| Fantôme de placement | `MeshLambertMaterial` | `{ transparent: true, opacity: .45, depthWrite: false }` |

**Variation d'instance** — pour éviter l'aspect « photocopie », appliquer sur chaque instance :

```js
const c = new THREE.Color(baseHex);
c.offsetHSL(0, 0, (hash(x, y) - 0.5) * 0.06); // ±3 % de luminosité
```

### 4.5 Palette de matériaux de la scène de ferme

| Élément | Hex actuel | **Hex cible** | Note |
|---|---|---|---|
| Sol nu (damier clair) | `0x5a7a42` | `0x9ac169` | Vert prairie lumineux |
| Sol nu (damier foncé) | `0x4a6436` | `0x8fb85f` | Écart de valeur ≤ 8 % |
| Terre labourée | `0x6b5238` | `0x8a6141` | Terre chaude, pas boue |
| Culture jeune | `0x6f9a45` | `0x84c95f` | |
| Culture mûre | `0xd4a84b` | `0xe8c65c` | |
| Hexagones de fond | `0x2d4a38` / `0x3a5c48` | `0x7fbf8f` / `0x8fcc9c` | Le fond ne doit plus être noirâtre |
| Plateforme / socle | `0x4a3828` | `0xb08a5e` | Falaise de terre claire |
| Haie | `0x3d6b3a` | `0x5aa05a` | |
| Feuillage d'arbre | `0x2f6b32` | `0x62b563` | |
| Tronc | `0x5a3a22` | `0x8a5f3a` | |
| Route / chemin | — | `0xd8c9a8` | Terre battue claire |
| Eau | — | `0x5aa9dd` | |
| Sélection | `0x86efac` | `0x2fae6a` + halo `0xc9a227` | |
| Survol | `0x7dd3fc` | `0x7ecab4` | Aligné teal de marque |
| Placement OK | `0x22c55e` | `0x2fae6a` | |
| Placement KO | `0xef4444` | `0xe04b3a` | |

**Bâtiments** — remonter la valeur et saturer :

| Bâtiment | Corps | Toit |
|---|---|---|
| Ferme (FARMHOUSE) | `0xfdf3e2` | `0xd4563c` |
| Étable (CATTLE_BARN) | `0xc2704a` | `0xb8452f` |
| Porcherie (PIGSTY) | `0xd08f6a` | `0x8a5a3a` |
| Grange à foin (HAY_BARN) | `0xc79a3c` | `0x7d5636` |
| Hangar machines | `0xa9825a` | `0x4f7a5c` |
| Atelier (WORKSHOP) | `0x9aa5ab` | `0x5f6a70` |
| Silo | `0xdde4e9` | `0xa9b4bc` |
| Toit doré (bâtiment prestige) | `0xd9b53c` | `0xc9a227` |

### 4.6 Caméra isométrique

```js
// Isométrique « vraie » : rotation Y 45°, inclinaison ~35.264° (atan(1/√2))
const d = 18;                                 // distance de cadrage
camera = new THREE.OrthographicCamera(-d*a, d*a, d, -d, 0.1, 200);
camera.position.set(d, d * 0.8165, d);        // 0.8165 = tan(35.264°)·√2
camera.lookAt(0, 0, 0);
```

| Paramètre | Valeur | Justification |
|---|---|---|
| Type | Orthographique | Pas de fuite perspective → lisibilité de grille |
| Azimut | 45° | Isométrique canonique |
| Élévation | 35.26° (par défaut) | Vraie iso ; **30°** pour un rendu plus « carte », **40°** pour voir les toits |
| Rotation | 4 crans de 90° (touches Q/E) | Permet de voir derrière les bâtiments |
| Zoom | `camera.zoom` de 0.55 à 2.4, pas de 1.12 par cran | |
| Frustum | `max(gridW, gridH) * step * 0.62` | Serrer par rapport à l'existant (0.72) : la ferme doit **remplir l'écran** |
| Recadrage | Le centre de la ferme est placé à **48 % de la hauteur** de viewport (pas 50 %) — laisse la place au dock bas | |

**Léger « tilt-shift » optionnel :** un `depth of field` est trop coûteux ; simuler avec un dégradé CSS `radial-gradient` très doux au-dessus du canvas (opacité 0.12 max aux coins).

### 4.7 Sélection et contours

Pas de post-process d'outline (coût). Trois signaux cumulés :

1. **Anneau au sol** : `RingGeometry(0.62, 0.72, 6)` couché, `color 0xc9a227`, `opacity .9`, rotation Y animée à 0.4 rad/s.
2. **Élévation** : l'objet sélectionné monte de `+0.12` unité en 180 ms (`ease-bounce`).
3. **Halo de dalle** : la couleur de la dalle est mixée vers `0x2fae6a` à 35 %, pulsant à 4.5 rad/s ±12 %.

### 4.8 Échelle du monde

| Élément | Dimension (unités Three.js) |
|---|---|
| 1 cellule de parcelle | 1.0 × 1.0, épaisseur 0.18 |
| Gap entre cellules | 0.06 |
| Personnage debout | **0.9** de haut (tête comprise) |
| Vache | 0.85 long × 0.55 haut |
| Tracteur | 1.15 long × 0.62 haut |
| Moissonneuse | 1.6 long × 0.8 haut |
| Bâtiment 1 étage | 1.4–1.8 de haut |
| Silo | 2.6 de haut |
| Arbre | 1.5–2.0 de haut |
| Haie de bordure | 0.55 de haut, 0.28 d'épaisseur |

> **Règle des proportions « jouet » :** tout objet vivant (personnage, animal) est **1.35× plus large** que le réalisme et sa tête fait **~32 % de sa hauteur**. C'est ce qui donne la lisibilité et le côté attachant.

### 4.9 Performance

| Levier | Règle |
|---|---|
| Instanciation | `InstancedMesh` dès **> 24 objets identiques** (plantes, dalles, animaux) |
| Draw calls | Fusionner les dalles statiques via `BufferGeometryUtils.mergeGeometries` |
| Reconstruction | **Supprimer le `setInterval(layout, 350)` actuel** : reconstruire toute la scène 3× par seconde est le pire coût du projet. Passer à une mise à jour différentielle par cellule modifiée |
| Ombres | `castShadow` uniquement sur bâtiments, machines, personnages, arbres. Jamais sur les plantes (utiliser un disque d'ombre fake) |
| Ombre de contact fake | `CircleGeometry(r, 8)` noir `opacity .16`, `depthWrite: false`, posé à y = 0.10 |
| Mobile | `pixelRatio ≤ 1.5`, `shadow.mapSize 1024`, `rim light` désactivée, brume rapprochée |
| Pixel ratio adaptatif | Si fps moyen < 45 pendant 2 s → `setPixelRatio(pr * 0.85)` (plancher 1.0) |

---

## 5. Le GLOBE 3D low-poly

Le globe est **l'écran d'accueil du jeu** : c'est le premier contact et l'incarnation du mot « Navigator ». Il doit être aussi soigné qu'une intro de jeu mobile premium.

### 5.1 Composition en 6 couches

| Couche | Rayon | Géométrie | Matériau |
|---|---|---|---|
| 1. Noyau océan | 1.000 | `IcosahedronGeometry(1, 4)` (1 280 tris) | `MeshStandardMaterial { color: 0x2f7fb8, roughness: .42, metalness: .05, flatShading: true }` |
| 2. Plateau continental | 1.004 | Idem, masqué sous les continents | `color: 0x5aa9dd` (haut-fond) |
| 3. Continents extrudés | 1.005 → 1.045 | `ExtrudeGeometry` depuis des `Shape` GeoJSON simplifiés, projetés sur sphère | `MeshLambertMaterial { flatShading: true }`, couleur par biome |
| 4. Océan brillant (spéculaire) | 1.002 | Même icosaèdre, `side: BackSide` off | `MeshStandardMaterial { roughness: .12, envMapIntensity: .8 }` |
| 5. Nuages | 1.075 | 60–90 `Icosahedron(r, 0)` aplatis, groupés | `MeshLambertMaterial { color: 0xffffff, transparent: true, opacity: .82, flatShading: true }` |
| 6. Atmosphère / halo | 1.13 | `SphereGeometry(1.13, 32, 32)`, `side: BackSide` | `ShaderMaterial` fresnel (voir 5.4) |

### 5.2 Continents

Approche recommandée : **Natural Earth 110 m** simplifié à ~1 500 points au total (Mapshaper, `-simplify 4%`), converti en `THREE.Shape`, extrudé puis « sphérisé ».

```js
// 1) Shape 2D en coordonnées lon/lat (degrés)
const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p.lon, p.lat)));
const geo = new THREE.ExtrudeGeometry(shape, { depth: 0, bevelEnabled: false, curveSegments: 1 });

// 2) Triangulation grossière puis projection sphérique de chaque sommet
const R_SEA = 1.0, ELEV = 0.045;
const pos = geo.attributes.position;
const v = new THREE.Vector3();
for (let i = 0; i < pos.count; i++) {
  const lon = THREE.MathUtils.degToRad(pos.getX(i));
  const lat = THREE.MathUtils.degToRad(pos.getY(i));
  const r = R_SEA + ELEV;                       // altitude constante = look « papier découpé »
  v.set(
    r * Math.cos(lat) * Math.cos(lon),
    r * Math.sin(lat),
    -r * Math.cos(lat) * Math.sin(lon)
  );
  pos.setXYZ(i, v.x, v.y, v.z);
}
geo.computeVertexNormals();
```

> **Astuce :** subdiviser le maillage 2D avant projection (grille de 2° max) sinon les grands continents traversent la sphère en cordes droites.

Pour les **flancs** (l'épaisseur visible du continent), générer une jupe : pour chaque arête du contour, un quad entre `r = 1.045` et `r = 1.0`, couleur `--earth-500` `0xa9784f`. C'est cette jupe qui donne l'effet « carte en relief » du logo.

**Couleurs de continents par biome :**

| Biome | Hex | Où |
|---|---|---|
| Tempéré / agricole | `0x8fc46a` | Europe, Amérique du Nord centrale, Chine de l'Est |
| Prairie / steppe | `0xc9c268` | Asie centrale, Pampa, Grandes Plaines |
| Aride / désert | `0xe4c98a` | Sahara, Arabie, Australie centrale |
| Tropical | `0x5faa5a` | Amazonie, Congo, Indonésie |
| Boréal | `0x6fa88a` | Sibérie, Canada nord |
| Glace | `0xeef6fa` | Groenland, Antarctique |
| Montagne (pic surélevé) | `0xb8a894` | Himalaya, Andes, Alpes — `r = 1.065` |
| Flanc / falaise | `0xa9784f` | Toutes les jupes |

**Variante « logo » :** pour l'écran de marque et l'intro, remplacer toutes ces couleurs par **or** (`0xc9a227` face, `0x8f7015` flanc) sur océan teal (`0x1a6b5a`) — le globe **devient** littéralement le logo, puis se colorise en 900 ms lors de la transition vers le jeu. C'est le moment « wow » de l'onboarding.

### 5.3 Océan

- Couleur de base `0x2f7fb8`, haut-fonds `0x5aa9dd` obtenus par une **seconde sphère** à `r = 0.998` de couleur claire, la sphère océan principale ayant `opacity: .82`.
- **Aucune animation de vague** (coût + bruit visuel). Un très léger scintillement spéculaire suffit : `envMap` = `RoomEnvironment` de Three.js, `envMapIntensity: .7`.

### 5.4 Atmosphère (halo fresnel)

```js
const atmoMat = new THREE.ShaderMaterial({
  transparent: true, side: THREE.BackSide, depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: { uColor: { value: new THREE.Color(0x9fd8f5) }, uPower: { value: 2.6 }, uIntensity: { value: 0.85 } },
  vertexShader: `varying vec3 vN; varying vec3 vP;
    void main(){ vN = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position,1.0); vP = mv.xyz;
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uPower; uniform float uIntensity;
    varying vec3 vN; varying vec3 vP;
    void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(-vP))), uPower);
      gl_FragColor = vec4(uColor, f * uIntensity); }`
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.13, 48, 48), atmoMat));
```

Ajouter un **second halo extérieur** à `r = 1.30`, `uPower: 4.0`, `uIntensity: .35`, couleur `0xc9a227` : une lueur dorée très faible qui rappelle la bordure du logo.

### 5.5 Nuages

```js
const cloudGroup = new THREE.Group();
const cloudMat = new THREE.MeshLambertMaterial({
  color: 0xffffff, flatShading: true, transparent: true, opacity: 0.82, depthWrite: false
});
for (let i = 0; i < 72; i++) {
  const puff = new THREE.Group();
  const n = 3 + (i % 3);                                  // 3 à 5 boules par nuage
  for (let j = 0; j < n; j++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.030 + Math.random() * 0.022, 0), cloudMat);
    m.position.set((j - n / 2) * 0.042, Math.random() * 0.012, Math.random() * 0.02);
    m.scale.set(1, 0.62, 0.85);                           // aplati
    puff.add(m);
  }
  // Répartition Fibonacci pour éviter les paquets
  const y = 1 - (i / (72 - 1)) * 2, rad = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
  puff.position.set(Math.cos(th) * rad, y, Math.sin(th) * rad).multiplyScalar(1.075);
  puff.lookAt(0, 0, 0);
  cloudGroup.add(puff);
}
scene.add(cloudGroup);
```

Rotation : `cloudGroup.rotation.y += dt * 0.022` (≈ 1.9× la vitesse du globe → parallaxe crédible).

### 5.6 Rotation, caméra et interaction

| Paramètre | Valeur |
|---|---|
| Rotation auto du globe | `0.012 rad/s` (tour complet ≈ 8 min 45 s) — lente, hypnotique |
| Inclinaison de l'axe | `globe.rotation.z = 0.41` (23.4°, réaliste et joli) |
| Pause auto-rotation | À l'interaction, reprise après **2.5 s** d'inactivité, rampe d'accélération 1.2 s |
| Caméra | `PerspectiveCamera(38, aspect, 0.1, 100)`, position `(0, 0.6, 3.1)` |
| Zoom | `dolly` de 2.2 (proche) à 4.6 (loin), `damping: 0.08` |
| Contrôles | `OrbitControls` : `enablePan = false`, `enableDamping = true`, `dampingFactor = .06`, `minPolarAngle = .35`, `maxPolarAngle = 2.79`, `rotateSpeed = .45` |
| Lumière | `HemisphereLight(0xdff0ff, 0x2a3b52, .7)` + `DirectionalLight(0xfff2dc, 1.6)` en `(4, 2.2, 3.5)` + rim `DirectionalLight(0x8fd0ff, .45)` en `(-3.5, -1, -3)` |
| Fond | Dégradé CSS derrière le canvas : `radial-gradient(circle at 50% 42%, #163f4f 0%, #0e2a38 45%, #08202b 100%)` — **seul endroit de l'app où le sombre est autorisé**, car il fait ressortir le globe et la marque dorée |

### 5.7 Marqueurs de parcelles / exploitations

```js
function latLonToVec3(lat, lon, r = 1.05) {
  const la = THREE.MathUtils.degToRad(lat), lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)
  );
}
```

| Type de marqueur | Géométrie | Couleur | Comportement |
|---|---|---|---|
| Ma ferme | `ConeGeometry(.022, .075, 6)` pointe vers le bas + `Sphere(.014, 8, 6)` au sommet | `0xc9a227` (or) | Flotte de ±0.008 à 1.6 rad/s, `lookAt` centre |
| Ferme d'ami | Même cône | `0x2fae6a` | Statique |
| Zone achetable | `RingGeometry(.028, .038, 6)` couché sur la surface | `0x7ecab4` | Pulse d'opacité 0.4 → 0.85, 2 s |
| Zone verrouillée | Même anneau | `0x8b988f` | Opacité fixe 0.35 |
| Événement (marché/météo) | `OctahedronGeometry(.026, 0)` | `0xf0a020` | Rotation 1 rad/s |
| Cluster (> 4 fermes) | `Sphere(.03, 8, 6)` + label HTML | `0xc9a227` | Éclate au zoom > 3.4 |

**Faisceau de sélection :** `CylinderGeometry(.004, .004, .22, 6)` orienté vers l'extérieur, matériau `additive`, couleur `0xe6c860`, opacité 0.6, qui apparaît en 220 ms.

**Labels :** `CSS2DRenderer` plutôt que sprites — texte net, police du jeu, accessible. Masquer les labels dont le marqueur est sur la face arrière (`dot(normal, cameraDir) < 0`).

**Arc de liaison** (route commerciale, transfert) : `QuadraticBezierCurve3` entre deux points, contrôle à `midpoint.normalize() * 1.35`, rendu en `TubeGeometry(curve, 32, .004, 5)`, couleur `0xc9a227`, animation de tracé via `geometry.setDrawRange`.

### 5.8 Interaction de sélection

Raycast sur une **sphère invisible** (`r = 1.05`, `visible: false`) plutôt que sur les continents : conversion du point d'impact en lat/lon, puis recherche de la zone la plus proche. Bien plus rapide et robuste que le raycast sur des maillages extrudés.

---

## 6. Personnages low-poly — les 3 classes

### 6.1 Règles communes

| Paramètre | Valeur |
|---|---|
| Hauteur totale | **0.90** unité |
| Proportion tête | 0.29 de la hauteur (≈ 3.4 têtes) — style « jouet » |
| Largeur d'épaules | 0.30 |
| Membres | Cylindres à **5 segments**, pas d'articulation (rigides) |
| Mains / pieds | Boîtes simples, jamais de doigts |
| Visage | **Aucun trait sculpté** : 2 boîtes yeux `0x2b3a33` de 0.022, plaquées à z + 0.056. Pas de bouche |
| Peau | 4 teintes disponibles : `0xf2c9a0`, `0xd9a274`, `0xa9714a`, `0x6f4630` |
| Faces cible | 220–320 tris |
| Animation idle | Respiration : `scale.y` 1.0 → 1.012, période 2.4 s ; balancement `rotation.y = sin(t*0.6)*0.05` |
| Ombre | `castShadow` sur torse et tête uniquement + disque de contact |
| Silhouette-test | À 40 px de haut, en noir sur blanc, les 3 classes doivent être distinguables |

**Construction générique (torse + tête + bras + jambes) :**

| Pièce | Géométrie | Position (x, y, z) | Note |
|---|---|---|---|
| Bassin | `Box(0.26, 0.10, 0.16)` | (0, 0.36, 0) | |
| Torse | `Box(0.30, 0.26, 0.18)` | (0, 0.54, 0) | Couleur = classe |
| Cou | `Cylinder(0.045, 0.045, 0.05, 5)` | (0, 0.69, 0) | Peau |
| Tête | `Box(0.19, 0.20, 0.18)` | (0, 0.80, 0) | Peau, coins non arrondis |
| Bras G / D | `Cylinder(0.045, 0.04, 0.26, 5)` | (±0.185, 0.54, 0) | Rotation z ±0.12 |
| Main G / D | `Box(0.06, 0.06, 0.06)` | (±0.20, 0.40, 0) | Peau |
| Jambe G / D | `Cylinder(0.055, 0.05, 0.30, 5)` | (±0.075, 0.19, 0) | Couleur pantalon |
| Botte G / D | `Box(0.09, 0.07, 0.14)` | (±0.075, 0.035, 0.02) | |

---

### 6.2 CÉRÉALIER — « le méthodique »

**Silhouette :** verticale, épaules droites, **chapeau de paille à large bord** qui crée un disque horizontal reconnaissable au premier coup d'œil. Le plus « fin » des trois.

**Palette :**

| Élément | Hex | Rôle |
|---|---|---|
| Chemise / torse | `0xe8c65c` | Or-blé, la couleur de la classe |
| Bretelles | `0x8f7015` | Détail doré foncé |
| Pantalon | `0x7d5636` | Terre |
| Chapeau (bord + calotte) | `0xf0d98c` | Paille claire |
| Bandeau du chapeau | `0x1a6b5a` | Rappel teal de marque |
| Bottes | `0x4d3521` | |
| Épi (accessoire) | `0xe0b542` / tige `0x9ac169` | |

**Accessoire distinctif :** une **gerbe de blé** tenue dans la main droite (3 tiges + épis), et un chapeau de paille. Aura au sol : hexagone `0xe8c65c` opacité 0.25.

**Pièces supplémentaires :**

| Pièce | Géométrie | Position | Couleur |
|---|---|---|---|
| Bord de chapeau | `Cylinder(0.20, 0.20, 0.018, 6)` | (0, 0.905, 0) | `0xf0d98c` |
| Calotte | `Cylinder(0.10, 0.115, 0.09, 6)` | (0, 0.955, 0) | `0xf0d98c` |
| Bandeau | `Cylinder(0.118, 0.118, 0.022, 6)` | (0, 0.918, 0) | `0x1a6b5a` |
| Bretelle G / D | `Box(0.03, 0.26, 0.02)` | (±0.08, 0.54, 0.095) | `0x8f7015` |
| Tige de blé ×3 | `Cylinder(0.006, 0.006, 0.30, 5)` | (0.22 ±0.02, 0.50, 0.02) rot z −0.2 | `0x9ac169` |
| Épi ×3 | `Cone(0.022, 0.075, 5)` | sommet de chaque tige | `0xe0b542` |

---

### 6.3 ÉLEVEUR — « le robuste »

**Silhouette :** la plus **large et trapue** des trois (épaules 0.34, torse plus épais), **casquette à visière** (asymétrie frontale nette) et **seau** au bout du bras. Le contour évoque immédiatement la force.

**Palette :**

| Élément | Hex | Rôle |
|---|---|---|
| Chemise à carreaux (base) | `0xc2704a` | Brun-rouge d'étable, couleur de classe |
| Gilet | `0x1a6b5a` | Teal de marque |
| Pantalon / salopette | `0x3f5a6b` | Bleu de travail |
| Casquette | `0x12503f` | Teal foncé |
| Bottes en caoutchouc | `0x2b3a33` | Hautes (0.16) |
| Seau | `0xb8c0c8` (métal) / anse `0x7d8890` | |
| Lait dans le seau | `0xf4f1e6` | |

**Accessoire distinctif :** un **seau de lait** (cylindre tronqué) dans la main gauche + une **petite corde/licol** enroulée à la ceinture. Aura au sol : hexagone `0xc2704a` opacité 0.25.

**Pièces supplémentaires :**

| Pièce | Géométrie | Position | Couleur |
|---|---|---|---|
| Torse (remplace le générique) | `Box(0.34, 0.28, 0.21)` | (0, 0.54, 0) | `0xc2704a` |
| Gilet ouvert | `Box(0.36, 0.24, 0.09)` | (0, 0.55, −0.055) | `0x1a6b5a` |
| Calotte de casquette | `Box(0.19, 0.07, 0.185)` | (0, 0.915, 0) | `0x12503f` |
| Visière | `Box(0.17, 0.02, 0.09)` | (0, 0.888, 0.13) | `0x12503f` |
| Seau (corps) | `Cylinder(0.075, 0.062, 0.11, 6)` | (−0.235, 0.30, 0.02) | `0xb8c0c8` |
| Lait (surface) | `Cylinder(0.070, 0.070, 0.004, 6)` | (−0.235, 0.352, 0.02) | `0xf4f1e6` |
| Anse | `Torus(0.072, 0.006, 4, 8, π)` | (−0.235, 0.36, 0.02), rot x π/2 | `0x7d8890` |
| Bottes hautes | `Box(0.10, 0.16, 0.145)` | (±0.078, 0.08, 0.015) | `0x2b3a33` |
| Corde à la ceinture | `Torus(0.05, 0.011, 4, 8)` | (0.14, 0.40, −0.03) | `0xd6c19a` |

**Compagnon optionnel :** une petite vache low-poly (8 primitives, corps `Box(0.42,0.24,0.20)` `0xfdf3e2` + taches `0x2b3a33`, tête `Box(0.15,0.14,0.14)`, 4 pattes `Cylinder(0.03,0.03,0.16,5)` `0x2b3a33`, cornes `Cone(0.02,0.05,4)` `0xead9ba`) à 0.5 unité derrière lui sur l'écran de choix de classe.

---

### 6.4 ETA (entrepreneur de travaux agricoles) — « le technicien »

**Silhouette :** la plus **verticale et anguleuse**, **casque de chantier** (dôme + petite visière), **gilet haute visibilité** avec deux bandes réfléchissantes horizontales — c'est le seul personnage qui porte des bandes claires en travers du torse, signature immédiate. Une **clé à molette** dépasse d'une main.

**Palette :**

| Élément | Hex | Rôle |
|---|---|---|
| Gilet haute-visibilité | `0xf0a020` | Orange sécurité, couleur de classe |
| Bandes réfléchissantes | `0xf4f1e6` | Deux bandes de 0.03 |
| Combinaison | `0x3f4a52` | Gris technique |
| Casque | `0xd9b53c` | Or/jaune casque |
| Gants | `0x2b3a33` | |
| Bottes de sécurité | `0x2b3a33` | Embout `0xb8c0c8` |
| Clé à molette | `0xb8c0c8` | Métal `MeshStandardMaterial` |
| Tablette / boîtier | `0x12503f` + écran `0x7ecab4` | |

**Accessoire distinctif :** **clé à molette** dans la main droite + petite **tablette de planning** teal dans la main gauche. Aura au sol : hexagone `0xf0a020` opacité 0.25.

**Pièces supplémentaires :**

| Pièce | Géométrie | Position | Couleur |
|---|---|---|---|
| Gilet | `Box(0.325, 0.27, 0.20)` | (0, 0.545, 0) | `0xf0a020` |
| Bande réfléchissante haute | `Box(0.335, 0.030, 0.205)` | (0, 0.60, 0) | `0xf4f1e6` |
| Bande réfléchissante basse | `Box(0.335, 0.030, 0.205)` | (0, 0.50, 0) | `0xf4f1e6` |
| Bretelle épaule G / D | `Box(0.035, 0.10, 0.205)` | (±0.11, 0.66, 0) | `0xf4f1e6` |
| Dôme de casque | `Sphere(0.105, 6, 4, 0, 2π, 0, π/2)` | (0, 0.885, 0) | `0xd9b53c` |
| Visière de casque | `Box(0.15, 0.018, 0.075)` | (0, 0.888, 0.115) | `0xd9b53c` |
| Crête de casque | `Box(0.028, 0.028, 0.20)` | (0, 0.975, 0) | `0xa8851c` |
| Manche de clé | `Box(0.022, 0.20, 0.022)` | (0.215, 0.44, 0.03) rot z 0.35 | `0xb8c0c8` |
| Tête de clé | `Box(0.055, 0.055, 0.022)` | (0.245, 0.55, 0.03) | `0xb8c0c8` |
| Tablette | `Box(0.11, 0.145, 0.012)` | (−0.215, 0.44, 0.05) rot y 0.25 | `0x12503f` |
| Écran de tablette | `Box(0.09, 0.12, 0.004)` | (−0.212, 0.44, 0.058) | `0x7ecab4` |

---

### 6.5 Tableau comparatif des 3 classes

| | CÉRÉALIER | ÉLEVEUR | ETA |
|---|---|---|---|
| Couleur signature | Or-blé `#e8c65c` | Brun-rouge `#c2704a` | Orange `#f0a020` |
| Couvre-chef | Chapeau de paille large | Casquette à visière | Casque de chantier |
| Silhouette | Fine, verticale, disque en haut | Large, trapue | Verticale, bandes en travers |
| Accessoire | Gerbe de blé | Seau de lait | Clé à molette + tablette |
| Largeur d'épaules | 0.30 | 0.34 | 0.325 |
| Aura hexagonale | `#e8c65c` | `#c2704a` | `#f0a020` |
| Fond de carte de sélection | `--gold-100` `#f7e9b8` | `--sand-200` `#f6ecd8` | `--warning-bg` `#fdf1dc` |

**Écran de choix de classe :** 3 cartes plein écran (desktop : 3 colonnes égales, `min-height: 70vh` ; mobile : carrousel `scroll-snap`), chacune contenant un mini-canvas Three.js avec le personnage tournant lentement (0.35 rad/s) sur un socle hexagonal, le nom en `--fs-h2`, 3 puces d'avantages en `--fs-base`, et un bouton `--r-pill` de la couleur signature. La carte survolée s'élève de 8 px et son personnage accélère à 0.6 rad/s.

---

## 7. Layout responsive — occuper TOUTE la largeur

### 7.1 Le problème et le principe

`.shell { max-width: 960px }` est **supprimé**. Nouveau principe : **le canvas 3D est plein écran (`100dvw × 100dvh`) et l'UI flotte par-dessus dans des zones nommées**. Rien n'est jamais centré dans une colonne étroite, sauf le texte long (max 68 caractères pour la lisibilité — c'est la seule exception légitime).

### 7.2 Grille d'écran de jeu (desktop ≥ 1280 px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  BARRE DE RESSOURCES  (pleine largeur, h 64px, teal-600)             │  ← z 20
├───────────┬──────────────────────────────────────────┬───────────────┤
│           │                                          │               │
│  RAIL     │                                          │  INSPECTEUR   │
│  GAUCHE   │        SCÈNE 3D (canvas plein)           │  DROIT        │
│  280px    │        zone focale, jamais couverte      │  340px        │
│  nav +    │        à plus de 45 % de sa largeur      │  contexte     │
│  objectifs│                                          │  sélection    │
│           │                                          │               │
├───────────┴──────────────────────────────────────────┴───────────────┤
│  DOCK D'OUTILS (centré, largeur auto, h 72px) + TICKER MARCHÉ droite  │  ← z 20
└──────────────────────────────────────────────────────────────────────┘
```

```css
.game-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 340px;
  grid-template-rows: 64px minmax(0, 1fr) 88px;
  grid-template-areas: "top top top" "left stage right" "dock dock dock";
  width: 100dvw; height: 100dvh;
  background: var(--bg-app);
}
.iso-layer { grid-area: stage; position: relative; }  /* plus de position:absolute inset:0 global */
```

**Le canvas reste plein écran derrière** (`position: fixed; inset: 0; z-index: 0`), la grille ne fait que **réserver** l'espace : la scène 3D respire visuellement sur toute la largeur, mais la caméra recadre en tenant compte des rails (`camera.setViewOffset` ou décalage du `lookAt` de +30 px vers la droite quand le rail gauche est ouvert).

### 7.3 Breakpoints

| Nom | Largeur | Layout |
|---|---|---|
| `xs` | < 480px | 1 colonne. Top bar compacte (56px). Dock bas 64px, 5 icônes max. Panneaux = **bottom sheets** plein largeur, hauteur `min(72dvh, 560px)`, `--r-xl` en haut seulement |
| `sm` | 480–767px | Idem, dock 5–6 icônes, sheets avec poignée de drag |
| `md` | 768–1023px | Rail droit en **overlay glissant** (340px) au lieu de colonne. Rail gauche masqué → bouton hamburger |
| `lg` | 1024–1439px | Grille 3 colonnes `240px / 1fr / 300px` |
| `xl` | 1440–1919px | `280px / 1fr / 340px` |
| `2xl` | ≥ 1920px | `320px / 1fr / 400px` + le contenu du rail passe en 2 sous-colonnes. **Le canvas occupe tout le reste — aucun `max-width` global** |

```css
@media (max-width: 1023px) {
  .game-shell { grid-template-columns: minmax(0,1fr); grid-template-areas: "top" "stage" "dock"; }
  .rail-left, .rail-right { position: fixed; inset: auto 0 0 0; z-index: 40; }
}
```

### 7.4 Densité fluide

Toutes les gouttières et paddings scalent avec la largeur, plutôt que d'être fixes :

```css
:root {
  --gutter: clamp(0.75rem, 1.6vw, 2rem);
  --card-pad: clamp(0.875rem, 1.2vw, 1.5rem);
  --rail-w: clamp(240px, 20vw, 340px);
}
```

### 7.5 Grilles de contenu (marché, garage, cheptel, parcelles)

```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(clamp(260px, 22vw, 340px), 1fr));
  gap: var(--gutter);
  padding-inline: var(--gutter);
  width: 100%;               /* pas de max-width */
}
```

Sur 1920 px cela donne naturellement 5–6 colonnes → **l'écran est plein**, ce qui répond directement au reproche du client. Sur 2560 px, ajouter `max-width: 2200px; margin-inline: auto;` uniquement pour éviter la ligne de 9 cartes illisible.

### 7.6 Safe areas mobile

```css
.app { padding: env(safe-area-inset-top) env(safe-area-inset-right) 0 env(safe-area-inset-left); }
.dock {
  padding-bottom: max(var(--sp-3), env(safe-area-inset-bottom));
  min-height: calc(64px + env(safe-area-inset-bottom));
}
.sheet { padding-bottom: max(var(--sp-6), calc(env(safe-area-inset-bottom) + var(--sp-3))); }
```

- Utiliser `100dvh` / `100dvw` (jamais `100vh`, qui saute avec la barre d'URL mobile).
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- `<meta name="theme-color" content="#1a6b5a">` — la barre système prend le teal de marque.
- Zone du pouce : toute action fréquente doit être **dans les 220 px du bas** de l'écran.
- `touch-action: none` sur le canvas uniquement, `manipulation` ailleurs (évite le zoom double-tap).

### 7.7 Hiérarchie de lecture — répondre à « on ne comprend rien »

Chaque écran respecte le **1-3-5** :

| Niveau | Nombre max | Traitement visuel |
|---|---|---|
| **1** action primaire | 1 | Bouton or `--r-pill`, `--fs-lg`, `--sh-gold`, en bas au centre |
| **3** informations clés | 3 | Barre de ressources : Argent (or), Grain (blé), Cheptel (brun). `--fs-stat-xl` |
| **5** actions secondaires | 5 | Dock d'icônes, `--fs-sm` label toujours visible (ne **jamais** masquer les labels comme le fait `@media (max-width:720px) .action-label { display:none }`) |

**Toute icône a un label texte.** C'est la correction n°1 du « on ne comprend rien ».

**État vide guidé :** aucun écran vide sans (a) une illustration low-poly, (b) une phrase d'explication `--fs-lg`, (c) un bouton d'action primaire.

---

## 8. Micro-animations et feedback

### 8.1 Table de référence

| # | Interaction | Animation | Durée | Easing |
|---|---|---|---|---|
| 1 | Hover bouton | `translateY(-2px)` + `filter: brightness(1.06)` + ombre `--sh-2` → `--sh-3` | 120ms | `--ease-out` |
| 2 | Press bouton | `translateY(3px)`, `border-bottom-width: 4px → 1px`, `--sh-press` | 90ms | `linear` |
| 3 | Relâchement | Retour avec léger dépassement (scale 1.02 → 1) | 200ms | `--ease-bounce` |
| 4 | Hover carte | `translateY(-6px) scale(1.015)`, ombre `--sh-3` | 180ms | `--ease-out` |
| 5 | Hover cellule 3D | Dalle mixée vers `0x7ecab4` à 45 %, élévation `+0.04` | 140ms | `--ease-out` |
| 6 | Sélection cellule | Anneau or apparaît (scale 0.6 → 1), dalle → `0x2fae6a` 35 %, pulsation 4.5 rad/s | 220ms | `--ease-bounce` |
| 7 | Apparition de carte (liste) | `opacity 0→1`, `translateY(16px)→0`, **stagger 45 ms** par item, 8 items max animés | 260ms | `--ease-out` |
| 8 | Ouverture de panneau latéral | `translateX(100%)→0` + fond `opacity 0→.35` | 320ms | `--ease-out` |
| 9 | Bottom sheet mobile | `translateY(100%)→0` + poignée qui s'étire | 340ms | `--ease-out` |
| 10 | Fermeture (panneau/sheet) | Inverse, plus rapide | 220ms | `ease-in` |
| 11 | Modale | Backdrop `blur(0→6px)` + carte `scale(.92)→1`, `opacity 0→1` | 280ms | `--ease-bounce` |
| 12 | Transition d'écran | Sortant `opacity 1→0, scale .98` (180 ms) puis entrant `opacity 0→1, translateY(12px)→0` (320 ms) | 500ms | `--ease-out` |
| 13 | Splash → Auth | Logo hexagonal `scale(1)→(1.15)` + fondu, halo doré qui s'étend | 650ms | `--ease-out` |
| 14 | Globe → Ferme | Zoom caméra vers le marqueur, globe qui se dissout en fondu blanc-crème, révélation de la parcelle | 900ms | `--ease-in-out` |
| 15 | Chiffre qui change (argent) | Comptage animé (tween sur la valeur), teinte `--success-ink` si hausse / `--danger-ink` si baisse, retour à `--ink` après 900 ms | 600ms | `easeOutQuad` |
| 16 | Gain d'argent | `+250 €` en `--fs-h4` or, monte de 48 px, `opacity 1→0` | 900ms | `--ease-out` |
| 17 | Toast | Entrée par le haut, `translateY(-24px)→0` + `scale .95→1`, auto-dismiss 3.2 s, barre de progression fine | 300ms | `--ease-bounce` |
| 18 | Barre de progression (croissance) | `width` animée en continu + léger scintillement du liseré | continu | `linear` |
| 19 | Récolte prête | Icône de gerbe qui **rebondit** au-dessus de la parcelle (±0.09, 1.4 rad/s) + anneau or pulsant | boucle | `sin` |
| 20 | Badge de notification | Apparition `scale 0 → 1.25 → 1` | 380ms | `--ease-bounce` |
| 21 | Focus clavier | Anneau `0 0 0 3px rgba(47,143,216,.45)` | 100ms | `ease-out` |
| 22 | Erreur de champ | Secousse horizontale `-8px, +8px, -4px, +4px, 0` | 400ms | `ease-in-out` |
| 23 | Chargement | 3 hexagones dorés qui pulsent en cascade (délais 0 / 160 / 320 ms) — **jamais** de spinner générique | boucle 1.2s | `ease-in-out` |
| 24 | Squelette de contenu | Dégradé `--sand-200 → --cream-0 → --sand-200` balayant à 1.4 s | boucle | `linear` |
| 25 | Onglet actif | Pastille de fond qui **glisse** vers le nouvel onglet (FLIP) | 260ms | `--ease-out` |
| 26 | Spotlight de tutoriel | Masque `clip-path` circulaire qui se déplace + s'agrandit, bulle qui suit | 420ms | `--ease-out` |

### 8.2 Particules (3D, budget serré)

| Événement | Effet | Détail technique |
|---|---|---|
| Récolte | 18–26 grains dorés éjectés | `Points` ou `InstancedMesh` de `Box(.03)`, couleurs `0xe8c65c`/`0xd9b53c`, vitesse initiale `(rand±1.4, 2.6, rand±1.4)`, gravité `-6.5`, durée 900 ms, fade sur les 300 derniers ms |
| Labour | 12 mottes de terre | `Box(.04)` `0x8a6141`, arc bas, 600 ms |
| Semis | 20 petits points | `0xead9ba`, dispersion horizontale, 500 ms |
| Fertilisation | Nuage vert translucide | 14 `Icosahedron(.05, 0)` `0x84c95f` `opacity .5`, montée lente 1.1 s |
| Achat de parcelle | Onde hexagonale dorée | `RingGeometry` hexagonale scale 0.2 → 1.6, opacité 1 → 0, 700 ms |
| Montée de niveau | Colonne de lumière + 40 étincelles or | Cylindre additive `0xf7e9b8` + `Points`, 1.4 s |
| Pluie | 400 segments | `LineSegments`, `0xa9d9f5`, vitesse 14 u/s, zone 30×30 recyclée |
| Neige | 300 points | `Points` `0xffffff` size .05, dérive sinusoïdale |
| Poussière de machine | 8 puffs derrière l'engin | `Icosahedron(.06,0)` `0xd8c9a8` `opacity .35`, 500 ms |
| Fumée de cheminée | 5 puffs lents en boucle | `0xf4f1e6` `opacity .4`, montée 2.4 s |

**Budget global :** ≤ 600 particules simultanées, un seul pool réutilisé, désactivation automatique si fps < 40, réduction de 60 % sur mobile.

### 8.3 Retour haptique et sonore (indications)

| Événement | Haptique (`navigator.vibrate`) | Son |
|---|---|---|
| Tap bouton | 8 ms | Clic bois court |
| Placement de bâtiment | 18 ms | Thud + « clac » |
| Récolte | `[12, 40, 12]` | Froissement + pièces |
| Erreur | `[30, 60, 30]` | Buzz sourd descendant |
| Montée de niveau | `[20, 50, 20, 50, 40]` | Fanfare courte 1.2 s |

### 8.4 Accessibilité du mouvement

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

Côté 3D : si `prefers-reduced-motion`, désactiver la rotation auto du globe, le bob des véhicules, l'oscillation du monde (`world.position.y = sin(...)`) et toutes les particules décoratives (garder celles qui portent une information : récolte, erreur).

---

## 9. Checklist d'implémentation (ordre d'impact décroissant)

| # | Action | Fichier | Impact perçu |
|---|---|---|---|
| 1 | Remplacer `skyFor()` par la table météo claire du §4.3 | `IsoFarmView.tsx` | ★★★★★ |
| 2 | Basculer les tokens CSS en thème clair (§1.9) | `styles.css` | ★★★★★ |
| 3 | Supprimer `.shell { max-width: 960px }` → grille `game-shell` (§7.2) | `styles.css` | ★★★★★ |
| 4 | Remplacer les polices par Baloo 2 / Nunito / Outfit + échelle (§2) | `styles.css` | ★★★★☆ |
| 5 | Nouvelle recette d'éclairage hemisphere + soleil + rim (§4.3) | `IsoFarmView.tsx` | ★★★★☆ |
| 6 | Remonter la palette des matériaux (§4.5) | `IsoFarmView.tsx` | ★★★★☆ |
| 7 | Labels toujours visibles sous les icônes du dock (§7.7) | `styles.css` | ★★★★☆ |
| 8 | Boutons en relief avec bordure basse (§3.4) | `styles.css` | ★★★☆☆ |
| 9 | Supprimer `setInterval(layout, 350)` → maj différentielle (§4.9) | `IsoFarmView.tsx` | ★★★☆☆ (fluidité) |
| 10 | Écran globe + choix de classe avec personnages (§5, §6) | nouveaux composants | ★★★★★ (nouveauté) |

---

## Résumé (10 lignes)

1. Le problème n'est pas « du détail » : l'app est **sombre, étroite, minuscule et sans hiérarchie** — quatre défauts structurels.
2. On bascule sur un **thème CLAIR par défaut** : fond crème `#fdf8ec`, encre vert-chaud `#12261f`, plus jamais `#0e1620`.
3. Deux couleurs de marque issues du logo : **teal `#1a6b5a`** (navigation, identité) et **or `#c9a227`** (valeur, récompense) — l'or n'est jamais du texte sur clair (utiliser `#8f7015`).
4. Typographie : **Baloo 2** (titres ronds et charnus), **Nunito** (interface), **Outfit** (chiffres tabulaires) ; plancher de taille à **0.75 rem**, corps à **1 rem**.
5. Tokens : espacement base 4 px, rayons généreux (carte 20 px, boutons `pill`), ombres **brun-doré** jamais noires, boutons à bordure basse pour le relief « jouet ».
6. La 3D passe d'un kaki nocturne à un **après-midi doré** : ciel `0xcfeafb`, hemisphere 1.05 + soleil chaud 1.45, ombres douces `PCFSoftShadowMap radius 4`, `flatShading` partout, zéro texture.
7. Le **globe low-poly** (icosaèdre 1 280 tris, continents extrudés à flancs `#a9784f`, halo fresnel bleu + halo or, nuages en Fibonacci, rotation 0.012 rad/s) devient l'écran d'accueil et rejoue littéralement le logo.
8. Trois classes lisibles à la silhouette : **CÉRÉALIER** (chapeau de paille, or-blé), **ÉLEVEUR** (casquette, seau, brun-rouge), **ETA** (casque, gilet orange à bandes) — chacune ~250 triangles, recettes de primitives fournies.
9. Layout : suppression du `max-width: 960px`, grille plein écran `rail / scène / inspecteur`, grilles `auto-fill minmax(clamp(260px,22vw,340px),1fr)` qui **remplissent tout l'écran**, safe areas et `dvh` sur mobile.
10. Et surtout : **toute icône porte un label**, un seul bouton primaire par écran, une couleur = une signification — c'est ce qui fait passer de « on ne comprend rien » à « je sais quoi faire ».
