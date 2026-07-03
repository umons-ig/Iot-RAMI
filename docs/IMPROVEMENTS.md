# RAMI — Améliorations identifiées

Synthèse des points à implémenter, issus de l'audit de l'architecture actuelle.
Classés par domaine, avec priorité, effort estimé, et **agent responsable**.

## Agents disponibles

| Agent | Périmètre |
|---|---|
| `backend-agent` | Express/TypeScript, controllers, services, middlewares, routes |
| `db-agent` | Modèles Sequelize, migrations, seeds, requêtes TimescaleDB |
| `fog-agent` | fog-service (Node.js sur Pi) : MQTT local, buffer, Kafka producer |
| `security-agent` | Audit sécurité, JWT, validation, headers HTTP |
| `arduino-agent` | Sketches ESP32, WiFiClientSecure, protocole MQTT capteur |
| `docker-agent` | docker-compose, Mosquitto config, variables d'env, TLS infra |
| `test-agent` | Tests Jest (backend) et Vitest (frontend) |
| `docs-agent` | Documentation, Swagger, READMEs |

---

## 1. Sécurité

### 1.1 Ajouter `helmet` — **Priorité haute / ~30 min**

> **Agent :** `backend-agent` — modifier `backend/src/app.ts`, installer le package, vérifier qu'aucun test existant ne casse à cause des nouveaux headers. Ensuite `security-agent` pour valider que les headers CSP/X-Frame sont corrects.

Actuellement aucun header HTTP de sécurité n'est positionné (X-Frame-Options, X-Content-Type-Options, Content-Security-Policy, etc.).

**Fichier :** `backend/src/app.ts`

```typescript
import helmet from "helmet";
app.use(helmet());
```

Installer le package : `npm install helmet` + `npm install -D @types/helmet`

---

### 1.2 Remplacer le CORS maison par le package `cors` — **Priorité moyenne / ~30 min**

> **Agent :** `backend-agent` — supprimer le middleware maison `app.ts:24-45`, installer `cors` + `@types/cors`, brancher la config. Vérifier que les requêtes OPTIONS reçoivent toujours les bons headers (tester avec curl ou via `test-agent`).

Le middleware CORS actuel (`app.ts:24-45`) est écrit à la main, ce qui augmente le risque d'oubli sur les requêtes OPTIONS preflight.

**Fichier :** `backend/src/app.ts`

```typescript
import cors from "cors";
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:8080",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content", "Accept", "Content-Type", "Authorization"],
}));
```

Supprimer le middleware maison. Installer : `npm install cors` + `npm install -D @types/cors`

---

### 1.3 Refresh token révocable — **Priorité haute (critique pour données médicales)**

> **Agent :** `db-agent` — créer la migration Sequelize pour ajouter `refreshTokenVersion INTEGER DEFAULT 0` sur la table `Users` et mettre à jour le modèle `backend/src/db/models/user.ts`. Puis `backend-agent` — modifier `backend/src/controllers/user.ts` : inclure `refreshTokenVersion` dans le payload JWT au login, vérifier la version au refresh, incrémenter au logout. Enfin `test-agent` — ajouter des tests pour les cas "token révoqué" et "logout puis refresh".

Actuellement le logout efface seulement le cookie, mais le refresh token reste valide 7 jours. S'il est volé, impossible de le révoquer.

**Solution recommandée : `refreshTokenVersion` sur le modèle User**

Ajouter une colonne entière `refreshTokenVersion` (défaut `0`) sur la table `Users`. L'inclure dans le payload du refresh token au login. À chaque vérification, comparer la version du token avec celle en DB. Pour révoquer : incrémenter la version en DB.

**Fichiers concernés :**
- `backend/src/db/models/user.ts` — ajouter le champ
- `backend/src/db/migrations/` — nouvelle migration
- `backend/src/controllers/user.ts` — inclure `refreshTokenVersion` dans le payload, vérifier au refresh, incrémenter au logout

```typescript
// Dans generateTokens() (user.ts)
const payload = { userId, role, refreshTokenVersion: user.refreshTokenVersion };

// Dans POST /auth/refresh
const dbUser = await User.findByPk(payload.userId);
if (dbUser.refreshTokenVersion !== payload.refreshTokenVersion) {
  throw new UnauthorizedException("Token révoqué");
}

// Dans POST /auth/logout
await User.increment("refreshTokenVersion", { where: { id: payload.userId } });
```

---

### 1.4 Réduire la limite du body JSON — **Priorité moyenne / 5 min**

> **Agent :** `backend-agent` — modifier les deux lignes dans `backend/src/app.ts`. Vérifier que l'export CSV (le plus gros payload connu) reste sous la nouvelle limite.

`express.json({ limit: "10mb" })` est excessif pour une API IoT. Un payload RAMI ne dépasse pas quelques Ko.

**Fichier :** `backend/src/app.ts`

```typescript
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ limit: "256kb", extended: true }));
```

---

### 1.5 Valider les entrées avec une lib dédiée — **Priorité moyenne**

> **Agent :** `backend-agent` — installer `zod`, créer `backend/src/utils/schemas/` avec un fichier par domaine (`user.schema.ts`, `sensor.schema.ts`, etc.), remplacer les validations manuelles dans les controllers. `security-agent` pour valider qu'aucun champ critique n'est oublié. `test-agent` pour ajouter des tests sur les cas de validation invalides.

Les contrôleurs valident les champs à la main (`if (!email || typeof email !== "string" ...)`). C'est fragile quand on ajoute des routes. Considérer `zod` pour définir des schémas de validation réutilisables.

```typescript
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(255),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

// Dans le controller :
const parsed = createUserSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json(parsed.error);
```

---

### 1.6 Auditer les routes sans middleware auth — **Priorité haute / ~1h**

> **Agent :** `security-agent` — parcourir tous les fichiers `backend/src/routes/` et `backend/src/controllers/`, lister les routes sans `auth`/`authAdmin`, identifier celles qui devraient être protégées, appliquer les middlewares manquants. Produire un rapport des routes publiques intentionnelles.

Après chaque ajout de route, vérifier que le middleware `auth` ou `authAdmin` est bien appliqué.

Commande utile :
```bash
grep -rn "router\.\(get\|post\|put\|delete\|patch\)" backend/src/routes/ \
  | grep -v "auth\|authAdmin\|swagger\|metrics\|health"
```

Routes légitimement publiques : swagger, healthcheck, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`.  
Tout le reste doit être protégé.

---

### 1.7 TLS sur MQTT — **Priorité haute pour données médicales**

> **Agent :** `docker-agent` — configurer Mosquitto (port 8883, certificat TLS dans `mosquitto/config/mosquitto.conf`, monter les certs dans le compose). `fog-agent` — mettre à jour `fog-service/src/constants.ts` : passer à `mqtts://`, ajouter les options `ca`, `cert`, `key` dans les `connectOptions`. `arduino-agent` — remplacer `WiFiClient` par `WiFiClientSecure` dans les sketches ESP32, embarquer le certificat CA.

Actuellement le flux ESP32 → Mosquitto → fog-service est en clair sur le réseau local. Acceptable en réseau isolé, inacceptable pour des données médicales.

- Configurer Mosquitto avec un certificat TLS (Let's Encrypt ou auto-signé en interne)
- Mettre à jour `fog-service/src/constants.ts` : `url: "mqtts://..."` + options `ca`, `cert`, `key`
- Mettre à jour les sketches Arduino : `WiFiClientSecure` + certificat CA embarqué

---

## 2. Base de données & backend

### 2.1 Compression TimescaleDB — **Priorité haute / ~1h**

> **Agent :** `db-agent` — créer une migration Sequelize qui exécute le SQL ci-dessous via `sequelize.query()`. Vérifier que la migration tourne sans erreur sur la DB de dev. Ajouter une note dans `docs/KAFKA.md` ou `docs/MONITORING.md` sur la politique de compression.

La hypertable `sensordata` grossit indéfiniment sans compression. TimescaleDB peut compresser les chunks anciens avec un ratio ~10x.

**Ajouter dans une migration Sequelize :**

```sql
-- Activer la compression sur la hypertable
ALTER TABLE sensordata SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = '"idSensor"',
  timescaledb.compress_orderby = 'time DESC'
);

-- Compresser automatiquement les chunks de plus de 7 jours
SELECT add_compression_policy('sensordata', INTERVAL '7 days');
```

---

### 2.2 Politique de rétention des données — **Priorité haute**

> **Agent :** `db-agent` — ajouter la politique de rétention dans la même migration que 2.1 (ou une migration séparée). Lire la durée depuis une variable d'environnement `DATA_RETENTION_DAYS` (défaut : 90). Documenter dans `.env.development`.

Sans politique de rétention, les données brutes s'accumulent sans limite.

**Ajouter dans une migration :**

```sql
-- Supprimer les données brutes de plus de 90 jours
SELECT add_retention_policy('sensordata', INTERVAL '90 days');
```

La durée devrait être configurable via env var et appliquée via un script de migration ou une commande CLI.

---

### 2.3 Vérifier la pagination sur toutes les requêtes `sensordata` — **Priorité haute**

> **Agent :** `backend-agent` — auditer `backend/src/controllers/sensorData.ts` et `backend/src/controllers/session.ts`, identifier tous les `findAll` sur `sensordata` sans `limit`, ajouter une limite explicite ou une pagination. `test-agent` — ajouter un test qui vérifie que l'endpoint ne renvoie pas plus de N lignes sans paramètre de pagination.

Un `findAll` sans `limit` sur la hypertable avec des millions de lignes = OOM.

**Fichiers à vérifier :** `backend/src/controllers/sensorData.ts`, `backend/src/controllers/session.ts`

Toute requête sur `sensordata` doit avoir une limite explicite ou une pagination. Exemple :

```typescript
await SensorData.findAll({
  where: { idSensor, idSession },
  limit: 10_000,   // jamais sans limite
  order: [["time", "ASC"]],
});
```

---

### 2.4 Monitoring du pool Sequelize — **Priorité faible**

> **Agent :** `backend-agent` — ajouter les listeners de pool dans `backend/src/db/index.ts` et exposer un gauge Prometheus `db_pool_acquire_total` / `db_pool_reject_total` via le middleware metrics existant (`backend/src/middlewares/metrics.ts`).

Le pool est configuré à `max: 20` mais aucune métrique ne surveille les connexions en attente ou les timeouts.

Ajouter un log au démarrage et exposer via Prometheus si besoin :

```typescript
// backend/src/db/index.ts
sequelize.connectionManager.pool.on('acquire', () => { /* metric */ });
sequelize.connectionManager.pool.on('reject', () => { console.warn('[Pool] Connexion rejetée') });
```

---

## 3. MQTT — Architecture des topics

### 3.1 Problème actuel : topic = identité du capteur

> **Agent :** `master-agent` pour planifier la refonte (impact cross-service : fog, backend, DB, Arduino). Implémenter ensuite : `db-agent` pour ajouter un champ `deviceId` (MAC ou UUID physique) sur le modèle `Sensor`, `fog-agent` pour extraire le `deviceId` du payload plutôt que du topic, `backend-agent` pour le lookup par `deviceId`, `arduino-agent` pour inclure le `deviceId` dans chaque payload MQTT.

Le topic MQTT est utilisé comme seul identifiant du capteur dans tout le pipeline. Changer le topic (firmware update, renommage) = nouveau capteur en DB. Il n'y a pas d'identifiant physique de device.

**Situation actuelle :**
```
<sensor-name>/sensor   → identité + transport couplés
```

**Cible à terme :**
```
Transport (MQTT/Zigbee/LoRa)
        ↓
Adaptateur fog (normalisation)
        ↓
{ deviceId, measureType, value, timestamp }
        ↓
Kafka → backend (lookup par deviceId, pas par topic)
```

---

### 3.2 Adaptateur Zigbee2MQTT — **Priorité moyenne**

> **Agent :** `fog-agent` — créer `fog-service/src/zigbeeAdapter.ts` en s'inspirant de la structure de `mqttFog.ts` (singleton, même client MQTT, mêmes méthodes `startSession`/`handleStop`). L'adaptateur souscrit à `zigbee2mqtt/+` et `zigbee2mqtt/bridge/devices`. Il réutilise le `KafkaService` existant pour publier les messages normalisés. `docker-agent` pour ajouter Zigbee2MQTT au `fog-service/compose.yaml` si nécessaire.

Zigbee2MQTT publie sur `zigbee2mqtt/<friendly_name>` avec un payload plat :
```json
{ "temperature": 21.5, "humidity": 60, "battery": 87, "linkquality": 112 }
```

Il n'y a ni PING, ni START, ni STOP. Le capteur publie dès qu'il a une mesure.

**À implémenter dans `fog-service/src/` :**

1. Créer un `zigbeeAdapter.ts` qui souscrit à `zigbee2mqtt/+`
2. Transformer le payload plat en format RAMI :
   ```typescript
   const measures = Object.entries(payload)
     .filter(([key]) => !["linkquality", "battery"].includes(key))
     .map(([measureType, value]) => ({ measureType, value }));
   ```
3. Gérer le "START implicite" : premier message d'un device → déclencher une session
4. Utiliser le timeout existant (`sensorTimeouts`) comme keepalive (si pas de message pendant 30s → STOP)
5. Écouter `zigbee2mqtt/bridge/devices` pour l'auto-découverte

---

### 3.3 Namespace pour le multi-patient — **Priorité basse (évolution future)**

> **Agent :** `master-agent` pour concevoir la nouvelle structure de topic et son impact sur l'ensemble du pipeline avant toute implémentation. Ensuite `fog-agent` pour adapter l'extraction du `baseTopic`, `db-agent` pour étendre le champ `topic` du modèle `Sensor`, `arduino-agent` pour mettre à jour les sketches.

La structure plate `<sensor-name>/sensor` ne permet pas de distinguer plusieurs patients ou lieux.

Cible à terme (sans casser l'existant) :
```
<patient-id>/<location>/<sensor-name>/sensor
```

Nécessite de revoir le champ `topic` dans le modèle `Sensor` et la façon dont le fog extrait le `baseTopic`.

---

## 4. Kafka

### 4.1 Ajouter une clé de message (partition key) — **Priorité haute / 5 min**

> **Agent :** `fog-agent` — ajouter `key: data.sensorTopic` dans les deux méthodes `publishSensorData` et `publishBatchSensorData` de `fog-service/src/kafkaProducer.ts`. C'est une modification de 2 lignes. Vérifier que le consumer backend reçoit toujours les messages correctement après le changement.

**C'est le fix le plus important pour le scaling.** Sans clé, les messages du même capteur peuvent atterrir sur des partitions différentes → ordre non garanti → START peut être traité après DATA.

**Fichier :** `fog-service/src/kafkaProducer.ts`

```typescript
// Avant (pas de clé)
messages: dataArray.map((data) => ({ value: JSON.stringify(data) }))

// Après
messages: dataArray.map((data) => ({
  key: data.sensorTopic,          // ← même capteur = même partition = ordre garanti
  value: JSON.stringify(data),
}))
```

Même chose pour `publishSensorData`.

---

### 4.2 Guard sur le parsing de `message.value` — **Priorité moyenne / 5 min**

> **Agent :** `backend-agent` — modifier `eachMessage` dans `backend/src/service/kafkaService.ts`, ajouter le guard avant `JSON.parse`. `test-agent` — ajouter un test unitaire qui simule un message Kafka avec `value: null` et vérifie que le consumer ne crash pas.

**Fichier :** `backend/src/service/kafkaService.ts`

```typescript
// Avant — SyntaxError si message.value est null
const data = JSON.parse(message.value?.toString() || "");

// Après
if (!message.value) {
  console.warn("⚠️ [Kafka] Message vide reçu, ignoré");
  return;
}
const data = JSON.parse(message.value.toString());
```

---

### 4.3 Passer à `eachBatch` sur le consumer — **Priorité moyenne**

> **Agent :** `backend-agent` — remplacer `eachMessage` par `eachBatch` dans `backend/src/service/kafkaService.ts`. Attention : avec `eachBatch`, le commit d'offset est manuel (`resolveOffset` + `heartbeat`). Il faut bien appeler `heartbeat()` dans la boucle pour éviter un rebalance Kafka si le traitement d'un batch est long. `test-agent` pour adapter les mocks de tests existants sur `kafkaService`.

`eachMessage` traite les messages un par un. Le fog envoie des batches mais le backend les décompacte. Avec `eachBatch`, on peut traiter le batch entier en une passe et contrôler le commit d'offset manuellement.

**Fichier :** `backend/src/service/kafkaService.ts`

```typescript
await this.consumer.run({
  eachBatch: async ({ batch, resolveOffset, heartbeat }) => {
    for (const message of batch.messages) {
      if (!message.value) continue;
      const data = JSON.parse(message.value.toString());
      const callback = this.mapTopicCallbacks.get(batch.topic);
      if (callback) await callback(data);
      resolveOffset(message.offset);
      await heartbeat();
    }
  },
});
```

---

### 4.4 Supporter plusieurs brokers — **Priorité faible / 5 min**

> **Agent :** `backend-agent` — modifier `backend/src/service/kafkaService.ts`. `fog-agent` — modifier `fog-service/src/constants.ts`. Les deux changements sont identiques (`.split(",")`) et indépendants, peuvent être faits en parallèle.

**Fichier :** `backend/src/service/kafkaService.ts`

```typescript
// Avant
brokers: [envs.KAFKA_BROKERS]  // "broker1:9092" → ["broker1:9092"]

// Après
brokers: envs.KAFKA_BROKERS.split(",")  // "b1:9092,b2:9092" → ["b1:9092", "b2:9092"]
```

Même chose dans `fog-service/src/constants.ts` :
```typescript
brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(","),
```

---

### 4.5 DLQ Kafka (Dead Letter Queue) — **Priorité basse**

> **Agent :** `backend-agent` — modifier `backend/src/service/dlqService.ts` pour publier sur un topic Kafka `sensor-data-dlq` via un producer KafkaJS dédié (attention : ne pas réutiliser le consumer). `fog-agent` n'est pas concerné (la DLQ est côté consumer = backend). `docker-agent` pour créer le topic `sensor-data-dlq` dans la config Kafka du `docker-compose.yml`.

La DLQ actuelle est un fichier `dlq.json` local. Si la machine tombe avec des messages dedans, ils survivent, mais un fichier corrompu = perte de données.

Cible : publier les messages en erreur sur un topic Kafka dédié `sensor-data-dlq`. Avantage : observable, rejouable, distribué.

---

## 5. Modèle de session — Évolution pour données médicales

### 5.1 Séparer session technique et session médicale

> **Agent :** `master-agent` d'abord pour concevoir le nouveau schéma de données (`AcquisitionWindow` vs `Session`) et valider l'impact sur le frontend, le backend et le fog avant de coder. Ensuite : `db-agent` pour la migration (nouvelle table `AcquisitionWindow`, FK vers `Session`), `backend-agent` pour adapter `socketService.ts` (remplacer `Session.create()` par `AcquisitionWindow.create()` dans `handleSessionStart`), `fog-agent` si le protocole START/STOP doit transporter un `sessionId` médical, `frontend-agent` pour adapter les vues qui affichent les sessions.

Actuellement une session = un flux continu entre START et STOP (piloté par le fog). Entre deux sessions, les données sont orphelines. Pour des données médicales :

- Une **`AcquisitionWindow`** = fenêtre technique (durée du flux continu, gérée par le fog comme aujourd'hui)
- Une **`Session`** (médicale) = monitoring prescrit (ex: 24h de monitoring cardiaque), composée de plusieurs `AcquisitionWindow`

La reconnexion dans le même créneau temporel rouvre l'`AcquisitionWindow` existante au lieu d'en créer une nouvelle.

**Impact :** refonte du modèle `Session` + `Session.create()` dans `socketService.ts`

---

### 5.2 Timeout de reconnexion (pause vs arrêt)

> **Agent :** `fog-agent` — modifier `handlePing` dans `fog-service/src/mqttFog.ts` : au lieu de faire un `handleStop` immédiat à l'expiration du timeout, publier un event `{ type: "pause", sensorTopic }` sur Kafka. `backend-agent` — gérer ce nouveau type dans `socketService.ts` : marquer la session comme "en pause" sans la clore, écouter un START ultérieur dans la fenêtre de grâce (`SESSION_RESUME_WINDOW_MS` env var) pour reprendre la même session. `db-agent` — ajouter un champ `status` sur le modèle `Session` (`active | paused | ended`).

Actuellement un timeout de 30s dans le fog → STOP définitif de la session.

Comportement cible : si le capteur se reconnecte dans les X minutes suivant un timeout, il reprend la session existante plutôt qu'en créer une nouvelle. X configurable via env var.

---

## Récapitulatif par priorité

| # | Action | Agent(s) | Fichier(s) clés | Effort |
|---|--------|---------|----------------|--------|
| 1 | Clé de message Kafka | `fog-agent` | `kafkaProducer.ts` | 5 min |
| 2 | `helmet` | `backend-agent` → `security-agent` | `app.ts` | 30 min |
| 3 | Refresh token révocable | `db-agent` + `backend-agent` + `test-agent` | `user.ts`, migration | ~3h |
| 4 | Audit routes sans auth | `security-agent` | `routes/` | ~1h |
| 5 | Compression + rétention TimescaleDB | `db-agent` | migration SQL | ~1h |
| 6 | Pagination sur `sensordata` | `backend-agent` + `test-agent` | `sensorData.ts`, `session.ts` | ~1h |
| 7 | Guard `message.value` Kafka | `backend-agent` + `test-agent` | `kafkaService.ts` | 5 min |
| 8 | Réduire `limit` body JSON | `backend-agent` | `app.ts` | 5 min |
| 9 | Remplacer CORS maison | `backend-agent` | `app.ts` | 30 min |
| 10 | `eachBatch` consumer Kafka | `backend-agent` + `test-agent` | `kafkaService.ts` | ~2h |
| 11 | Brokers Kafka multi-valeurs | `backend-agent` + `fog-agent` (parallèle) | `kafkaService.ts`, `constants.ts` | 5 min |
| 12 | Validation `zod` | `backend-agent` + `security-agent` + `test-agent` | `controllers/` | ~1 jour |
| 13 | TLS MQTT | `docker-agent` + `fog-agent` + `arduino-agent` | `mosquitto.conf`, `constants.ts`, sketches | ~1 jour |
| 14 | Adaptateur Zigbee2MQTT | `fog-agent` + `docker-agent` | `zigbeeAdapter.ts`, `compose.yaml` | ~2 jours |
| 15 | Séparation session médicale / technique | `master-agent` → `db-agent` + `backend-agent` + `frontend-agent` | modèles, `socketService.ts` | ~2 jours |
| 16 | DLQ Kafka topic | `backend-agent` + `docker-agent` | `dlqService.ts`, `docker-compose.yml` | ~1 jour |
| 17 | Timeout reconnexion (pause vs arrêt) | `fog-agent` + `backend-agent` + `db-agent` | `mqttFog.ts`, `socketService.ts`, migration | ~1 jour |
| 18 | Découpler topic = identité capteur | `master-agent` → tous | cross-service | ~3 jours |
| 19 | Namespace multi-patient | `master-agent` → `fog-agent` + `db-agent` + `arduino-agent` | cross-service | ~2 jours |
