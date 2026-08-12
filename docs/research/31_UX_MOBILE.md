# 31 — UX mobile : splash, auth, tutoriel, jouabilité

**Statut :** Implémenté (MVP web)  
**Branche :** `cursor/farming-navigateur-research-6eea`  
**Date :** 2026-08-12

---

## Objectif

Transformer l’expérience « prototype technique » en parcours **mobile-first** compréhensible : intro logo, création de compte / connexion, puis ferme jouable avec feedback visuel immédiat.

---

## Parcours utilisateur

1. **Splash** (`SplashScreen.tsx`) — logo hexagonal en plein écran, zoom + fondu (~2,7 s), tagline « Élevage · Cultivation · Gestion ».
2. **Auth** (`AuthScreen.tsx`) — onglets Créer / Connexion, logo, choix métier, carte parcelle, CTA clairs.
3. **Jeu** — HUD avec icônes outils, tutoriel 7 étapes (première visite), cases qui s’illuminent au survol / sélection.

---

## Jouabilité carte

| Interaction | Comportement |
|-------------|--------------|
| Survol case | Halo bleu (`hoverCell`) |
| Sélection (Inspect / outils) | Halo vert + toast description |
| Outil BUILD + survol | Fantôme **toutes les cases** de l’emprise (vert = OK, rouge = bloqué) |
| Clic BUILD valide | Placement API + toast |
| Semis / ferti / récolte | Pinceau 1×1–3×3, bouton OK, pulse + engin animé |
| Tutoriel | `TutorialOverlay` — clé `farmsim_tutorial_v1`, bouton **?** dans le HUD |

---

## Assets web (`apps/web/public/`)

- `logo.svg` — badge hexagone doré (référence visuelle user)
- `assets/icons/tools/*.svg` — barre d’actions (inspect, semer, ferti, récolte, bâtir, park)
- `assets/*.svg` — icônes décoratives (blé, tracteur, grange)

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/web/src/SplashScreen.tsx` | Intro animée |
| `apps/web/src/AuthScreen.tsx` | Onboarding |
| `apps/web/src/TutorialOverlay.tsx` | Tutoriel pas-à-pas |
| `apps/web/src/auth.css` | Styles splash + auth |
| `apps/web/src/App.tsx` | Orchestration flux + preview bâtiment |
| `apps/web/src/IsoFarmView.tsx` | Rendu Three.js hover / preview / pulse |

---

## Suite possible

- Remplacer `logo.svg` par le PNG marketing haute résolution fourni par l’équipe art
- Sons UI (`playUiSound`) quand assets audio disponibles
- Tutoriel contextuel (spotlight sur boutons réels) au lieu de modale seule
- Panneau Bâtiments visible sur mobile (actuellement masqué &lt; 720px — accès via outil Bâtir + liste latérale desktop)
