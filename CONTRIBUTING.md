# Contribuer à RAMI 1.0

Merci de contribuer au projet RAMI (système IoT de gestion de capteurs, UMONS). Ce guide
décrit le workflow de contribution et les conventions du dépôt.

## Workflow Git

1. Partir de `main` à jour : `git checkout main && git pull`.
2. Créer une branche dédiée : `git checkout -b <type>/<description-courte>`
   (ex. `feat/export-pdf`, `fix/session-orpheline`, `docs/api-thresholds`).
3. Committer par petites étapes cohérentes.
4. Ouvrir une **Pull Request** vers `main`. La CI (lint + tests) doit être verte avant merge.

### Convention de commits

Format recommandé (type conventionnel) :

```
<type>: <description à l'impératif>

[corps optionnel expliquant le pourquoi]
```

Types courants : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.

## Tests par module

Toute contribution touchant du code doit conserver la suite de tests verte :

| Module | Commande | Outil |
|--------|----------|-------|
| Backend | `cd backend && npm run test` | Jest |
| Frontend | `cd frontend && npm run test` | Vitest |
| Fog-service | `cd fog-service && npm run test` / `npm run build` | Jest / tsc |

Lancer aussi le lint/format avant de pousser :
- Backend : `npm run format`
- Frontend : `npm run lint`

## CI/CD

Les workflows GitHub Actions (`.github/workflows/{backend,frontend,fog}-ci.yml`) exécutent
lint → test → build → push GHCR sur `main`. Une PR ne doit pas être mergée si la CI échoue.

## Documentation

La documentation technique vit dans [`docs/`](./docs/README.md). Toute nouvelle fonctionnalité
côté API doit être reflétée dans `docs/API.md` (et Swagger). Voir aussi
[`docs/ETAT_DES_LIEUX.md`](./docs/ETAT_DES_LIEUX.md) pour l'état du projet et les chantiers
ouverts.

## Style & conventions

- TypeScript strict côté backend/fog/frontend — éviter `any`.
- Pas de secret en dur : utiliser les variables d'environnement et les `.env.example`.
- Typographie française correcte (accents) dans la doc et les messages utilisateur.
