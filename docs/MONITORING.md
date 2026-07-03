# Monitoring — Prometheus & Grafana

Le backend RAMI expose des métriques au format Prometheus. Prometheus les scrape toutes les 15 secondes, et Grafana permet de les visualiser via un dashboard importable.

---

## Accès aux interfaces

| Service    | URL locale              | Port |
|------------|-------------------------|------|
| Prometheus | http://localhost:9090   | 9090 |
| Grafana    | http://localhost:3001   | 3001 |
| Métriques brutes (backend) | http://localhost:3000/metrics | 3000 |

> La route `/metrics` ne passe pas par `/api/v1` et n'est donc pas protégée par le middleware JWT. Elle est en revanche restreinte par une **whitelist IP** (`backend/src/app.ts`) : seuls `localhost` (`127.0.0.1`, `::1`) et le sous-réseau Docker (`172.*`, où tourne Prometheus) y ont accès. Tout autre client reçoit un refus.

---

## Métriques exposées

### Métriques applicatives (définies dans `backend/src/middlewares/metrics.ts`)

| Nom | Type | Labels | Description |
|-----|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Nombre total de requêtes HTTP reçues depuis le démarrage |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Durée des requêtes HTTP en secondes (buckets : 5ms → 10s) |
| `active_sessions_total` | Gauge | — | Nombre de sessions d'acquisition actives en base de données |
| `kafka_message_processing_seconds` | Histogram | — | Temps de traitement d'un message Kafka (réception → écriture DB). Buckets : 1 ms → 2.5 s |

Les segments numériques dans les routes sont normalisés (`/sessions/42` → `/sessions/:id`) pour éviter l'explosion de cardinalité.

### Métriques système (collectées automatiquement via `collectDefaultMetrics`)

`prom-client` collecte automatiquement les métriques Node.js standard, notamment :

- `process_cpu_seconds_total` — utilisation CPU
- `process_resident_memory_bytes` — mémoire RSS
- `nodejs_eventloop_lag_seconds` — latence de la boucle d'événements
- `nodejs_active_handles_total` — handles actifs (sockets, timers…)
- `nodejs_heap_size_used_bytes` / `nodejs_heap_size_total_bytes` — heap V8

---

## Démarrage de la stack de monitoring

Les services `prometheus` et `grafana` sont définis dans le `docker-compose.yml` racine et démarrent automatiquement avec la stack :

```bash
docker compose up -d
```

Le fichier de configuration Prometheus est monté depuis `monitoring/prometheus.yml` :

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'rami-backend'
    static_configs:
      - targets: ['node-backend:3000']
    metrics_path: '/metrics'
```

---

## Variable d'environnement Grafana

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `GF_SECURITY_ADMIN_PASSWORD` | Mot de passe du compte admin Grafana | `change_me` (voir `.env.example`) |

Le nom d'utilisateur admin Grafana est `admin`.

Définir cette variable dans le fichier `.env` à la racine du projet (copier `.env.example`) :

```bash
GF_SECURITY_ADMIN_PASSWORD=un_mot_de_passe_fort
```

---

## Configurer la datasource Prometheus dans Grafana

Au premier démarrage, Grafana ne connaît pas encore Prometheus. Ajouter la datasource manuellement :

1. Se connecter à Grafana sur http://localhost:3001 (identifiants : `admin` / valeur de `GF_SECURITY_ADMIN_PASSWORD`)
2. Aller dans **Connections > Data sources > Add new data source**
3. Choisir **Prometheus**
4. Renseigner l'URL : `http://iot-rami-prometheus:9090`
   - Ne pas utiliser `localhost` : Grafana s'exécute dans Docker et doit joindre Prometheus via le réseau Docker interne
5. Cliquer sur **Save & test** — le message "Data source is working" confirme la connexion

---

## Importer le dashboard RAMI

Un dashboard préconfiguré est disponible dans `monitoring/rami-dashboard.json`.

1. Dans Grafana, aller dans **Dashboards > Import**
2. Cliquer sur **Upload dashboard JSON file**
3. Sélectionner `monitoring/rami-dashboard.json`
4. Sélectionner la datasource Prometheus créée à l'étape précédente
5. Cliquer sur **Import**

Le dashboard affiche :
- Le taux de requêtes HTTP par route et statut
- La latence p50/p95/p99 des requêtes HTTP
- Le nombre de sessions actives en temps réel
- Les métriques système Node.js (CPU, mémoire, event loop)

---

## Exemples de requêtes PromQL utiles

```promql
# Taux de requêtes par seconde (toutes routes)
rate(http_requests_total[1m])

# Latence p95 sur les 5 dernières minutes
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Requêtes en erreur (5xx)
rate(http_requests_total{status_code=~"5.."}[1m])

# Sessions actives
active_sessions_total

# Latence p95 du pipeline Kafka (réception → écriture DB) sur 1 minute
histogram_quantile(0.95, rate(kafka_message_processing_seconds_bucket[1m]))

# Débit moyen du pipeline Kafka (messages/s traités)
rate(kafka_message_processing_seconds_count[1m])
```
