# 26 — Auth session & résumé de retour

## MVP Auth

- Register + **Login** par email + `accessCode` (défaut à l’inscription : `ferme`)
- Session token opaque (`Session.token`), TTL 30 jours
- Client stocke `farmsim_token` (plus le blob joueur entier)

> Pas de hash crypto en démo locale — à remplacer (bcrypt/argon2 + OAuth) avant prod.

## Endpoints

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/auth/register` | Crée user + session |
| POST | `/auth/login` | `{ email, accessCode }` → player + token + **resume** |
| GET | `/auth/me` | Header `Authorization: Bearer <token>` |
| POST | `/session/heartbeat` | Met à jour `lastSeenAt` + snapshot marché |
| GET | `/session/resume` | Résumé depuis `lastSeenAt` (Bearer) |

## Résumé de session

Calculé au login / `/session/resume` :

- `awayMs` — temps hors-ligne
- `cropsReady` / `cropsGrowing`
- `marketDelta` — vs `lastMarketJson`
- `weather` — états actuels par zone
- `hint` — texte FR court pour le toast UI

Heartbeat appelé périodiquement en jeu (~60 s) et à la fermeture (`beforeunload`).
