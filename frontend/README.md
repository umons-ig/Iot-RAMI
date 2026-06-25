# UMONS — Sensor Frontend

SPA Vue 3 pour la visualisation et la gestion des capteurs IoT du projet RAMI 1.0 (Université de Mons).

---

## Stack technique

| Technologie | Rôle |
|-------------|------|
| Vue 3 + Vite | Framework SPA |
| Pinia | Gestion d'état |
| Vue Router | Navigation + guards d'auth |
| Chart.js + vue-chartjs | Graphiques ECG / multi-mesures temps réel |
| Socket.io client | Réception des données en temps réel (WebSocket) |
| Axios | Appels REST vers le backend |
| Vitest | Tests unitaires |
| ESLint + Prettier | Qualité de code |

---

## Prérequis

- Node.js LTS (≥ 18)
- npm
- Backend démarré sur le port 3000

---

## Installation

```bash
npm install
```

Créer un fichier `.env.dev` à la racine du projet :

```bash
VITE_APP_BACK_URL=http://localhost:3000/api/v1
VITE_APP_TITLE=RAMI 1.0
VITE_APP_ENV=dev
VITE_SOCKET_URL=http://localhost:3000
```

---

## Démarrage

```bash
VITE_APP_ENV=dev npm run dev   # Démarre sur :8080
```

Le frontend sera disponible sur http://localhost:8080

---

## Commandes utiles

```bash
VITE_APP_ENV=dev npm run dev   # Serveur de développement
npm run build                  # Build de production (type-check inclus)
npm run test                   # Tests Vitest (jsdom)
npm run test:coverage          # Tests avec couverture
npm run lint                   # ESLint --fix
```

---

## Architecture

### Composables (`src/composables/`)

Les composables sont la couche métier principale :

| Composable | Rôle |
|------------|------|
| `useUser` | Authentification, gestion des rôles (admin/operator) |
| `useSession` | Sessions de mesure, connexion WebSocket, mise à jour du graphique |
| `useSensor` | Liste des capteurs, statut en ligne, auto-discover, recherche |
| `useMeasurement` | Types de mesures disponibles |
| `useChart` | Configuration Chart.js |
| `useZone` | Arborescence des zones (CRUD, assignation capteurs, accès par zone) |
| `useTeam` | Équipes : CRUD + gestion des membres |
| `useThreshold` | Seuils d'alerte min/max par capteur |
| `useTheme` | Thème (ambre/vert/clair) + effet CRT |
| `useAxios` | Instance Axios configurée avec le token JWT |

### Flux de données temps réel

1. Le composable `useSession` se connecte au backend via **Socket.io**
2. Il envoie un événement `join-session` avec le JWT et le topic MQTT du capteur
3. Il écoute l'événement `new-data` et met à jour le graphique dynamiquement
4. Le graphique affiche un **dataset par type de mesure** (temperature, humidity, ecg...)

### Rôles utilisateurs

- **Admin** : accès complet (CRUD capteurs, tous les utilisateurs, toutes les sessions)
- **Operator** : accès limité aux capteurs et sessions qui lui sont assignés

---

## Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_APP_BACK_URL` | URL de l'API backend | `http://localhost:3000/api/v1` |
| `VITE_APP_TITLE` | Titre de l'application | `RAMI 1.0` |
| `VITE_APP_ENV` | Environnement (sélectionne le fichier `.env.<ENV>`) | `dev` |
| `VITE_SOCKET_URL` | URL du serveur Socket.io | `http://localhost:3000` |

---

## Tests

```bash
npm run test             # Tous les tests
npm run test:coverage    # Avec couverture (rapport dans /coverage)
```

---

## CI/CD

Pipeline GitHub Actions :
1. **lint** — ESLint
2. **test** — Vitest
3. **build** — `npm run build`
