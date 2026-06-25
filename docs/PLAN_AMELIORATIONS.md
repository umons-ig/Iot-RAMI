# Plan d'améliorations — RAMI 1.0

> Issu de la revue critique multi-agents du 2026-06-25 (sécurité, backend, frontend, archi/infra).
> Ordonné par priorité décroissante et regroupé en PRs cohérentes. Chaque tâche indique :
> **fichiers** · **approche** (piste, pas solution clé-en-main) · **effort** (S/M/L) · **dépendances**.

Légende effort : **S** ≈ ½ journée · **M** ≈ 1-2 jours · **L** ≈ 3 jours+

---

## Phase 0 — Sécurité bloquante (à faire en premier)

> Trois failles exploitables, dont une RGPD majeure. Rien d'autre ne devrait passer avant.

### PR `security/idor-session-access`
- [ ] **0.1 — IDOR sessions/CSV (CRITIQUE)** · effort **M**
  - **Fichiers** : `backend/src/controllers/session.ts` (`getSessionById`, `getSessionData`, `getSessionAggregate`, `exportSessionAsCsv`), `backend/src/controllers/user.ts:505` (`getUserSessions`), routes `session.ts` / `user.ts`.
  - **Approche** : créer un middleware `requireSensorAccess` (dans `src/middlewares/`) qui, à partir de l'`idSession` (ou `idSensor`) de la requête, charge la session → son `idSensor`, puis vérifie que `req.user.userId` a un accès via `UserSensorAccess` (ou zone/team, ou rôle admin). Sinon `403`. Le brancher sur toutes les routes de lecture/export de session. Réutiliser la logique d'accès déjà présente côté `useUserSensorOrMeasurementType`.
  - **Tests** : un test d'intégration « compte A ne peut pas lire la session du capteur de B → 403 ».

- [ ] **0.2 — Injection CSV (formula injection)** · effort **S**
  - **Fichiers** : `backend/src/controllers/session.ts:298` (vs `sanitizeCsvField` ligne 259).
  - **Approche** : appliquer `sanitizeCsvField()` à **toutes** les cellules de données (notamment `row.MeasurementType.name` issu de l'auto-discover non authentifié), pas seulement aux en-têtes.

### PR `infra/close-public-ports`
- [ ] **0.3 — Fermer ports DB/Kafka publics + Kafka PLAINTEXT (HAUTE)** · effort **S**
  - **Fichiers** : `docker-compose.yml` (`node-db` `5432:5432`, `kafka` `9092:9092`).
  - **Approche** : retirer les `ports:` (le backend passe par le réseau Docker interne) ou les binder sur `127.0.0.1:`. Vérifier le firewall de la VM. Documenter dans `docs/`.

- [ ] **0.4 — Chiffrer le transport fog↔cloud (HAUTE, données de santé)** · effort **M**
  - **Approche court terme** : tunnel **WireGuard** fog↔cloud (plus simple que SASL_SSL, ferme la surface immédiatement). Les hooks `KAFKA_SSL`/`KAFKA_SASL_*` existent déjà côté fog/backend mais restent inactifs — WireGuard évite de les activer pour l'instant.
  - **Front/API** : reverse proxy TLS (**Caddy**, certificat auto) dès qu'un nom de domaine est dispo (déjà connu comme gap).

### PR `security/auth-hardening`
- [ ] **0.5 — Token expiré → 401 (pas 500)** · effort **S**
  - **Fichiers** : `backend/src/middlewares/auth.ts:11-38` (`handleAuthError`).
  - **Approche** : mapper explicitement `TokenExpiredError` / `JsonWebTokenError` → `401`. Aligner le type `UserPayload` (`types/user.ts`) sur le contenu réel du token.
- [ ] **0.6 — Source unique pour l'expiration** · effort **S**
  - **Fichiers** : `user.ts:132` (12h) vs `:632` (15min) vs `env.ts:25` (`JWT_EXPIRATION=1d`).
  - **Approche** : calculer `expiresAt` à partir de `JWT_EXPIRATION`, fixer ce dernier à `15m`. Une seule vérité.
- [ ] **0.7 — Garde-fou secrets en prod** · effort **S**
  - **Fichiers** : `backend/src/utils/env.ts:36-47`.
  - **Approche** : en prod, exiger `length >= 32` pour `JWT_SECRET` et `REFRESH_TOKEN_SECRET` (pas seulement ≠ valeur par défaut), et vérifier qu'ils diffèrent.

---

## Phase 1 — Robustesse temps réel

> La couche « temps réel médical » a des angles morts. Priorité haute juste après la sécurité.

### PR `fix/realtime-resilience-backend`
- [ ] **1.1 — Poison pill Kafka** · effort **S**
  - **Fichiers** : `backend/src/service/kafkaService.ts:84`.
  - **Approche** : try/catch autour de `JSON.parse(message.value)`. En cas d'échec : `resolveOffset` + envoi DLQ + log. Ne jamais laisser un message corrompu boucler à l'infini.
- [ ] **1.2 — Reconnexion auto du consumer Kafka** · effort **M**
  - **Fichiers** : `kafkaService.ts`, exposer l'état dans `/health` (`app.ts`).
  - **Approche** : écouter `consumer.events.CRASH` / `DISCONNECT`, relancer `startKafkaConsumer` (réutiliser le backoff existant), et refléter `isConnected()` réel dans `/health`.
- [ ] **1.3 — DLQ bornée et non bloquante** · effort **M**
  - **Fichiers** : `backend/src/service/dlqService.ts`.
  - **Approche** : passer en append-only NDJSON (plus de rewrite total synchrone), borner la taille (drop oldest + métrique), I/O async, ou idéalement un **topic DLQ Kafka**. Monter `dlq.json` sur un volume. Tester sous concurrence push/flush.
- [ ] **1.4 — Validation/normalisation du timestamp** · effort **S**
  - **Fichiers** : `socketService.ts:295` (µs ÷ 1000), `sensorData.ts:97`, `fog-service/src/mqttFog.ts:191` (ms).
  - **Approche** : normaliser à l'entrée du consumer, rejeter `< 2020` ou `> now+1j` (un ESP32 émettant en ms insère des dates en 1970). Documenter l'unité dans `docs/KAFKA.md`.

### PR `fix/realtime-resilience-frontend`
- [ ] **1.5 — Fuite socket SensorCard (CRITIQUE front)** · effort **S**
  - **Fichiers** : `frontend/src/components/sensor/SensorCard.vue:115-123`, `useSensor.composable.ts:171`.
  - **Approche** : déclarer `onUnmounted` à la racine de `setup()` (pas dans le callback `onMounted`), garder une `ref` du socket pour la fermer. Idéalement supprimer le chemin « autonome » et réutiliser la socket partagée de `SensorsList`.
- [ ] **1.6 — Reconnexion WebSocket + ré-émission `join-session`** · effort **M**
  - **Fichiers** : `useSession.composable.ts:243-273`, `useSensor.composable.ts:171`, `useSocket.composable.ts`.
  - **Approche** : ajouter handlers `socket.on('connect')` → ré-émettre `join-session`, `socket.on('disconnect')` / `connect_error`. Exposer un `connectionState` réactif (→ alimente la feature 4.1 badge LIVE/RECONNEXION/SIGNAL PERDU).
- [ ] **1.7 — Unifier la config socket** · effort **S**
  - **Fichiers** : `useSocket.composable.ts:3` (`VITE_SOCKET_URL` + fallback `localhost:3000`) vs `NavBar.vue:172` (dérive de `VITE_APP_BACK_URL`).
  - **Approche** : une seule source — dériver l'URL socket de `VITE_APP_BACK_URL` partout, centraliser `transports`. Sinon risque de socket tombant sur `localhost` en prod.

---

## Phase 2 — Performance & qualité

### PR `perf/chart-realtime`
- [ ] **2.1 — Mutation in-place du chart + suppression du tri** · effort **M**
  - **Fichiers** : `useSession.composable.ts:283-307` (`updateChart`).
  - **Approche** : `data.push()` + `chart.update('none')` au lieu de recréer `chartData.value` ; retirer le `sort` (points déjà chronologiques) ou ne trier que si désordre détecté.
- [ ] **2.2 — Decimation + options de rendu** · effort **S**
  - **Fichiers** : `Graph.vue`, `useSession.composable.ts:312`.
  - **Approche** : activer le plugin **Decimation (LTTB)** de Chart.js pour l'historique, désactiver `tension` en live, envisager `parsing: false` avec données pré-formatées `{x,y}`.
- [ ] **2.3 — Couleurs de chart réactives au thème** · effort **M**
  - **Fichiers** : `stores/color.ts:5`, `useChart.composable.ts:17`, `Graph.vue:101-189`.
  - **Approche** : transformer les couleurs figées en getters/computed relisant `getPropertyValue` ; `watch` sur `useTheme().theme` → `chart.options` + `chart.update()`.

### PR `quality/backend-hardening`
- [ ] **2.4 — Error-handler Express global** · effort **M**
  - **Fichiers** : `backend/src/app.ts`, tous les controllers.
  - **Approche** : middleware `(err, req, res, next)` final + format de réponse unique `{ error, code }`. Supprimer progressivement les `try/catch` dupliqués et les `res.json(error)` bruts (`user.ts:196`).
- [ ] **2.5 — Logging structuré** · effort **M** · dépend de 2.4
  - **Approche** : remplacer `console.*` par **pino** (JSON, niveaux, `requestId`). Lisible dans Grafana/Loki.
- [ ] **2.6 — Validation centralisée (Zod)** · effort **M**
  - **Fichiers** : `controllers/threshold.ts:11` (n'impose pas `min < max`), `user.ts:141`, `session.ts:96`.
  - **Approche** : middleware de validation par route (schémas Zod), supprimer la validation artisanale dupliquée.
- [ ] **2.7 — Endpoints destructeurs & cohérence réponses** · effort **S**
  - **Fichiers** : `session.ts:167` (delete supprime toutes les données du capteur sans bornes, session laissée orpheline), `:200`, `user.ts:534` (format non paginé), `threshold.ts:41` (404 sur liste vide).
  - **Approche** : borner la suppression, clarifier l'intention du `destroy()` commenté, uniformiser la pagination (`{ data, total, page, limit, totalPages }`), renvoyer `200 []` au lieu de 404.
- [ ] **2.8 — Re-typer `db` (retirer les `as any`)** · effort **L**
  - **Fichiers** : `socketService.ts:25`, `session.ts:16`, `sensorData.ts:5`, `threshold.ts:4`, `user.ts:10`.
  - **Approche** : interface typée des modèles, suppression progressive des `as any` et `.dataValues as X`. Chantier de fond → faire au fil de l'eau.

### PR `quality/alert-perf`
- [ ] **2.9 — N+1 destinataires d'alertes + anti-flapping** · effort **M** · prépare 4.2
  - **Fichiers** : `socketService.ts:314-322`, `checkAndEmitAlerts:370`.
  - **Approche** : cacher les destinataires par `idSensor` (TTL, comme les seuils) ; ne ré-émettre qu'au **changement d'état**, pas à chaque point. (Recoupe la feature 4.2.)

---

## Phase 3 — Observabilité, infra & docs

### PR `infra/fog-observability`
- [ ] **3.1 — Exposer /metrics sur le fog** · effort **M**
  - **Fichiers** : `fog-service/` (`outbox.ts:143` `pendingCount()` existe déjà mais n'est pas exposé), `monitoring/prometheus.yml`.
  - **Approche** : endpoint `/metrics` (prom-client) exposant `pendingCount`, drops buffer, état connexion Kafka, espace disque. L'ajouter au scrape Prometheus.
- [ ] **3.2 — Alertmanager + règles** · effort **M**
  - **Approche** : ajouter Alertmanager + règles minimales : `pendingCount` croissant, latence p95 > seuil, DB down, disque < 15 %.
- [ ] **3.3 — Provisioning Grafana as-code** · effort **S**
  - **Approche** : datasource + dashboard via `/etc/grafana/provisioning` (plus de configuration manuelle).

### PR `infra/durability`
- [ ] **3.4 — Backups TimescaleDB** · effort **M**
  - **Approche** : cron `pg_dump` + rotation hors-Pi (S3-compatible ou NAS). Au-delà des 7j de rétention fog, il n'y a aujourd'hui **aucune redondance**.
- [ ] **3.5 — Migrer volumes critiques sur SSD** · effort **S** (matériel)
  - **Approche** : carte SD = corruption garantie à terme ; le stockage est le bottleneck WAL identifié (`docs/LOAD_TEST.md`).

### PR `infra/deploy-safety`
- [ ] **3.6 — Stratégie de déploiement Watchtower + rollback** · effort **M**
  - **Fichiers** : `docker-compose.yml:153` (Watchtower `:latest`).
  - **Approche** : épingler un tag `:stable` promu manuellement après validation (au lieu de tout `main` → prod en <5 min) ; documenter le rollback via re-tag du `:sha` précédent. Rendre `gitleaks` bloquant en CI. Ajouter un smoke test post-build.
- [ ] **3.7 — Durcissement conteneurs** · effort **M**
  - **Approche** : `USER` non-root dans les Dockerfiles, secrets via Docker secrets, credentials Postgres fog forts (`constants.ts:42` `fog/fog`), envisager `socket-proxy` devant Watchtower.

### PR `docs/sync-reality`
- [ ] **3.8 — Actualiser docs périmées** · effort **S**
  - **Fichiers** : `CLAUDE.md` (parle encore de `mqttServer.ts` côté backend — supprimé), `docs/ETAT_DES_LIEUX.md` (items #7/#8 listés 🔴 mais résolus par l'outbox), mémoire (`~2400 pts/s` → `~10 000 pts/s` post-correctifs).
  - **Approche** : bandeau de statut + tableau de suivi audit↔correctifs. Important pour le jury.

---

## Phase 4 — Nouvelles fonctionnalités

> Choisies pour leur pertinence médicale et leur réutilisation de l'existant.

### PR `feature/persistent-alerts`
- [ ] **4.1 — Alertes persistantes + acquittement** · effort **L** · dépend de 2.9
  - **Approche** : table `Alert` (sensor, type, direction, valeur, début/fin, acquittement, opérateur). Émettre au franchissement, clôturer au retour dans les bornes. `GET /alerts` paginé + endpoint d'acquittement. Drawer d'alertes côté front + flash visuel de la zone du graphe au franchissement (les seuils sont déjà dessinés via `rebuildThresholdDatasets`).

### PR `feature/sensor-watchdog`
- [ ] **4.2 — Détection de capteur muet** · effort **M**
  - **Approche** : watchdog par session active (pas de mesure depuis N s → événement `sensor-silent` + alerte). Côté front : badge **LIVE / RECONNEXION… / SIGNAL PERDU** piloté par `connectionState` (1.6) + `timeSinceLastValue`. Critique : l'absence de signal ECG est une urgence.

### PR `feature/session-replay`
- [ ] **4.3 — Replay temporel de session** · effort **M**
  - **Approche** : API « rejoue la session X à 1×/4× » qui rediffuse l'historique horodaté (hypertable) sur le **WebSocket existant**. Revue de cas, démos sans capteur, debug. Fort effet « waouh » pour le jury, faible coût.

### PR `feature/sparklines`
- [ ] **4.4 — Sparklines temps réel sur les SensorCard** · effort **S** · dépend de 1.5
  - **Approche** : micro-courbe des 30 dernières secondes par carte ONLINE (canvas léger, sans Chart.js). Aperçu global sans ouvrir chaque session. Esthétique oscilloscope/phosphore.

### PR `feature/edge-ecg-anomaly` (ambitieux)
- [ ] **4.5 — Détection d'anomalie ECG à l'edge** · effort **L**
  - **Approche** : détection légère sur le fog (R-peak / arythmie, seuils adaptatifs) avant batching → **alerte locale même cloud déconnecté**. Couplé à un downsampling adaptatif (full résolution si anomalie, décimation sinon) → réduit la charge WAL (bottleneck). Sujet de R&D fort pour le rapport.

### Idées différées (backlog)
- Export FHIR (`Observation` + LOINC) / lien de partage signé à durée limitée.
- Profils de référence par patient (z-score sur baseline glissante au lieu de seuils absolus).
- Audit log immuable des accès aux données patient (qui consulte/exporte/supprime — complète 0.1 côté RGPD).
- Multi-tenant / multi-fog (partitionnement Kafka par `sensorTopic`, namespace tenant) — déclencheur naturel du passage SASL_SSL.
- Mode comparaison multi-sessions superposées (`ComparisonGraph.vue` / `useHistoryComparison` existent déjà).

---

## Ordre d'attaque recommandé

1. **Phase 0** entièrement (sécurité bloquante) — surtout 0.1 (IDOR) et 0.3 (ports).
2. **1.5** (fuite socket front) — bug isolé, vite corrigé.
3. **1.1 → 1.4** (robustesse backend) puis **1.6/1.7** (robustesse front).
4. **2.1/2.2** (perf chart, visible immédiatement) + **2.4/2.5** (fondations error-handling/logging).
5. **3.1/3.2** (observabilité fog — on ne voit rien aujourd'hui) + **3.4** (backups).
6. **Features** : 4.2 (watchdog, recoupe 1.6) → 4.1 (alertes) → 4.3 (replay) → 4.4 (sparklines) → 4.5 (edge ECG).
