# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

RAMI 1.0 is an IoT sensor management system (University of Mons) for capturing, processing, and visualizing real-time multi-measure sensor data (ECG, temperature, humidity). The stack: ESP32 hardware → MQTT (local Mosquitto on fog Pi) → fog-service → Kafka → Node.js/Express backend → PostgreSQL/TimescaleDB → Vue 3 frontend (WebSocket real-time).

## Repository Structure

| Directory | Description |
|-----------|-------------|
| `backend/` | Express/TypeScript REST API (port 3000) |
| `frontend/` | Vue 3 + Vite SPA (port 8080) |
| `fog-service/` | Node.js service running on Raspberry Pi (MQTT local → Kafka cloud) |
| `python-simulator-over-mqtt-master/` | Python MQTT sensor simulator |
| `Arduino/` | Arduino/ESP32 hardware sketches (DHT22, ECG AD8232) |
| `monitoring/` | Prometheus + Grafana config |
| `docs/` | Technical documentation (MQTT, Kafka, API, DEMO, RAPPORT) |

## Development Commands

### Backend (`backend/`)
```bash
npm install
npm run dev                    # Start dev server with nodemon (port 3000)
npm run test                   # Run Jest tests (--runInBand)
npm run test:coverage          # Run tests with coverage report
npm run format                 # ESLint --fix
npm run docker:build           # Build Docker image (needs NODE_ENV)
npm run docker:start           # docker compose up -d
npm run docker:init-db         # Run Sequelize migrations + seeds
npm run migrate                # sequelize-cli db:migrate
npm run seed                   # sequelize-cli db:seed:all
```

### Frontend (`frontend/`)
```bash
npm install
VITE_APP_ENV=dev npm run dev   # Start Vite dev server (port 8080)
npm run build                  # Type-check + production build
npm run test                   # Vitest with jsdom
npm run test:coverage          # Tests with coverage
npm run lint                   # ESLint --fix
```

### Python Simulator (`python-simulator-over-mqtt-master/`)
```bash
pip install -r requirements.txt
python3 ./mqttCliApp.py --topic <topic> --types ecg,temperature --rate 100
# Args: --topic, --rate, --types for direct start without interactive prompts
```

## Architecture

### Data Flow
```
ESP32/Simulator → MQTT (Mosquitto on fog Pi) → fog-service → Kafka → backend (consumer-only)
                                                                              ↓
                                                     Frontend (WebSocket) ← socketService.ts
                                                     Frontend (REST)      ← Backend API
```

- **Sessions are fog-driven**: the fog service starts/stops sessions on Kafka events, not the frontend
- **Auto-discover**: backend detects unknown sensors via MQTT wildcard `#`, stores them in `discoveredTopics`
- **Multi-measures**: sensor payload format `{ timestamp, measures: [{ measureType, value }] }`

### Backend Architecture (Express + TypeScript)
- **Controllers** (`src/controllers/`): Auth, user, sensor, session, measurement, sensorData
- **Services** (`src/service/`):
  - `mqttServer.ts` — singleton MQTT client, auto-discover, sensor status with 30s timeout
  - `kafkaService.ts` — **consumer-only** (no producer), `apache/kafka:3.9.0` KRaft mode via `KAFKA_BROKERS` env var
  - `socketService.ts` — Socket.io, JWT auth on `join-session`, rooms per topic, `sendDataToRoom`, 5min cache for `measurementTypesMap`
  - `dlqService.ts` — dead letter queue (`dlq.json`), flush on restart
- **Models** (`src/db/models/`): User, Sensor, Measurement, MeasurementType, Session, SensorData (hypertable), UserSensor, UserSensorRequest, UserMeasurementTypeRequest
- **Routes**: All under `/api/v1`, Swagger docs at `/api/v1/docs`
- **Auth**: JWT access token (15min) + refresh token (7j, HttpOnly cookie). Routes `POST /auth/refresh` + `POST /auth/logout`. Middleware in `src/middlewares/auth.ts`
- **Rate limiting**: `globalLimiter` (100/15min) on all routes, `authLimiter` (20/15min) on `/api/v1/auth`
- **Path aliases**: `@/*`, `@controllers/*`, `@db/*`, `@models/*` (configured in tsconfig)

### Frontend Architecture (Vue 3 + Pinia)
- **Composables** (`src/composables/`): `useUser`, `useSession`, `useSensor`, `useMeasurement`, `useChart`, `useAxios`, `useUserSensorOrMeasurementType` — main business logic layer
- **`useAxios`**: auto-injects `Authorization: Bearer <token>` on all requests — do NOT add manual auth headers elsewhere
- **Stores** (`src/stores/`): Pinia stores for shared state
- **Router**: Auth guards with `requiresAuth` meta, role-based access (admin/operator). `localStorage.getItem("token")` used only in router guards (legitimate)
- **Charts**: Chart.js via `vue-chartjs`, dynamic datasets per `measureType`, PHOSPHOR_COLORS palette adapts to theme
- **Theme**: CSS vars in `frontend/src/assets/base.css`, dark + `@media (prefers-color-scheme: light)` auto switch. Fonts: Big Shoulders Display (titles) + Martian Mono (code/labels)
- **API base URL**: Set via `VITE_APP_BACK_URL` env variable

### MQTT Topics
- Sensor topic pattern: `<sensor-name>/sensor` (publishes) / `<sensor-name>/server` (listens)
- Broker config and commands defined in `src/utils/mqttConstant.ts` (backend)
- Sensor protocol: PING every 20s + START on connect → fog responds ACK → measures published

## Docker Compose Stack

Root `docker-compose.yml` (cloud VM):
- **node-backend**: Express API (port 3000)
- **node-db**: TimescaleDB/PostgreSQL 13 (port 5432)
- **mosquitto**: Eclipse Mosquitto MQTT broker (ports 1883, 9001)
- **kafka**: `apache/kafka:3.9.0` in KRaft mode (no Zookeeper), port 9092
- **prometheus**: metrics scraping (port 9090)
- **grafana**: dashboards (port 3001)
- **watchtower**: auto-pull from GHCR on new images (poll 300s)

Fog Pi (`fog-service/compose.yaml`): mosquitto + fog-service + watchtower

## Environment Setup

### Backend `.env.development`
Key variables: `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT_OUT`, `NODE_ENV`, `NODE_PORT`, `JWT_SECRET`, `JWT_EXPIRATION`, `BCRYPT_SALT_ROUNDS`, `KAFKA_BROKERS` (e.g., `localhost:9092`), `SERVER_HOST`

### Frontend `.env.dev`
Key variables: `VITE_APP_BACK_URL` (e.g., `http://localhost:3000/api/v1`), `VITE_APP_TITLE`, `VITE_APP_ENV`

### Test Credentials (from seed data)
- Email: `adriano@ig.umons.ac.be` / Password: `adriano@ig.umons.ac.be`

## Known Remaining Gaps

- **HTTPS**: waiting for a domain name (Nginx/Traefik not yet configured)
- **Tests E2E / load tests**: not yet implemented (Cypress/Playwright, k6/Artillery)
- **Tests thresholds**: no unit tests for threshold controller/routes yet
- **Docs thresholds**: threshold routes not yet documented in `docs/API.md`

## CI/CD

GitHub Actions, one workflow per module: `.github/workflows/backend-ci.yml` (lint → test → docker push), `.github/workflows/frontend-ci.yml`, `.github/workflows/fog-ci.yml`. All push to GHCR (`ghcr.io/umons-ig/iot-rami-{backend,frontend,fog}`). Images are public — Watchtower needs no GHCR credentials. Backend and fog CI build multi-platform `linux/amd64,linux/arm64`.


<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
