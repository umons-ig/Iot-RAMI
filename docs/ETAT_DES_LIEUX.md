# État des lieux — RAMI 1.0 (audit du 09/06/2026)

> Audit réalisé « à froid » : six explorations indépendantes du dépôt (backend, frontend,
> fog-service, infra/DevOps, simulateur+ESP32, documentation), chacune menée sans contexte
> préalable, comme le ferait un nouvel arrivant. Ce document est un **instantané daté** ; il
> complète le backlog priorisé de [`IMPROVEMENTS.md`](./IMPROVEMENTS.md) et la
> [`ROADMAP.md`](../ROADMAP.md).

> **⚠️ Mise à jour (instantané daté) — plusieurs items listés ci-dessous sont RÉSOLUS depuis.**
> - **#7 (perte de données fog)** et **#8 (shutdown gracieux fog)** : résolus par l'**outbox store-and-forward** Postgres du fog (write-ahead avant ACK, drain au reboot, shutdown propre). Voir [`FOG_PERSISTENCE.md`](./FOG_PERSISTENCE.md).
> - **Débit** : la limite « ~2 400 pts/s » était **pré-correctifs**. Après `await callback` + `ignoreDuplicates`, le plancher mesuré est **~10 000 pts/s** (bottleneck = flush WAL TimescaleDB). Voir [`LOAD_TEST.md`](./LOAD_TEST.md).
> - Robustesse temps réel backend (poison pill Kafka, reconnexion consumer, DLQ bornée, validation timestamp) et IDOR sessions : traités, voir [`PLAN_AMELIORATIONS.md`](./PLAN_AMELIORATIONS.md).
>
> Le reste du document est conservé comme **archive de l'audit du 09/06/2026**.

## Verdict général

Projet **solide et mature pour un stage** : architecture en couches propre, pipeline temps
réel fonctionnel (MQTT → fog → Kafka → WebSocket), TypeScript strict, ~365 tests backend,
documentation riche, observabilité Prometheus/Grafana.

Les faiblesses se concentrent sur **trois axes** :

1. **Sécurité / prod-readiness** — TLS absent, secrets, faille IDOR.
2. **Fiabilité du nœud fog** — perte de données possible si Kafka tombe.
3. **Dette technique** — code mort et configs obsolètes accumulés par les itérations.

---

## 🔴 CRITIQUE — à traiter en priorité

### Sécurité

| # | Problème | Emplacement |
|---|----------|-------------|
| 1 | **Faille IDOR** : `addUsersToSensor` / `removeUserFromSensor` / `askForSensorAccess` lisent l'identité depuis le **body**, pas depuis le token → tout utilisateur authentifié peut s'octroyer/retirer un accès capteur à autrui | `backend/src/controllers/userSensor.ts:37,125,256` |
| 2 | **`.env` non git-ignoré** (la règle `.env.*` est commentée) → un `.env` de prod committé par mégarde fuiterait `JWT_SECRET`/`DB_PASSWORD` | `.gitignore` |
| 3 | **Secrets en clair commités** dans le simulateur : mots de passe HiveMQ et fog (`fog/fog`) en dur — à retirer **et révoquer** | `python-simulator-over-mqtt-master/brokerInformator.py:49-82` |
| 4 | **Tout en HTTP clair** : JWT et credentials transitent sans TLS (voir § Reverse proxy — accepté tant que hors prod) | `docker-compose.yml` |
| 5 | **Kafka PLAINTEXT exposé sur Internet sans auth** (`${SERVER_HOST}:9092`) → n'importe qui peut produire/consommer (voir § Sécuriser fog→Kafka) | `docker-compose.yml:27-36` |
| 6 | **Dépendance fantôme `pretier@0.0.1`** (typo de `prettier`, package potentiellement squatté = risque supply-chain) en `dependencies` | `fog-service/package.json:20` |

### Fiabilité

| # | Problème | Emplacement |
|---|----------|-------------|
| 7 | **Perte de données fog si Kafka tombe > 2-3 s** : buffer mémoire pur, plafond 500 puis drop silencieux, pas de DLQ/persistance. `isKafkaConnected` jamais remis à `false` (voir § Rétention locale) | `fog-service/src/mqttFog.ts`, `kafkaProducer.ts` |
| 8 | **Pas de shutdown gracieux fog** (SIGTERM) → à chaque update Watchtower/reboot : buffers perdus + sessions orphelines côté backend | `fog-service/src/index.ts` |
| 9 | **ECG bridé à 1 Hz** (`>= 1000` en dur) alors que `INTERVAL` = 10 ms est défini mais jamais utilisé → signal ECG inexploitable cliniquement | `Arduino/ESP32/AD8232/src/main.cpp:88` |
| 10 | **Pas de watchdog ESP32** + NTP non resynchronisé (si l'heure échoue, **toutes** les publications sont silencieusement abandonnées) | `Arduino/ESP32/Common/` |

### Bugs fonctionnels

| # | Problème | Emplacement |
|---|----------|-------------|
| 11 | **`session.destroy()` commenté** → `DELETE /sessions/:id` laisse la session orpheline | `backend/src/controllers/session.ts:193` |
| 12 | **Redirection vers `/login` inexistante** (la route est `/`) → écran blanc après expiration de session | `frontend/src/composables/useAxios.composable.ts:51` |
| 13 | **Comparaison de dates en chaînes** dans la garde de route → un token expiré peut passer | `frontend/src/router/index.ts:111` |

---

## 🟠 IMPORTANT

### Backend
- Le middleware `auth` **n'attache jamais le payload** → chaque controller re-parse le JWT manuellement (≈ 11× dupliqué) = racine des incohérences/failles. → refonte `req.user`.
- `const DB: any = db` dans **tous** les controllers annule le typage.
- 3 conventions de réponse d'erreur différentes ; pas de gestionnaire d'erreurs centralisé ; validation copiée-collée (pas de Zod/Joi).
- Cardinalité Prometheus non bornée (UUID non normalisés dans `metrics.ts:42`).

### Frontend
- `VITE_SOCKET_URL` absent de `env.d.ts` + fallback manquant (`useSession:253`) → socket potentiellement cassée.
- ~30 `any` sur le chemin critique (handlers WebSocket/HTTP non typés).
- Aucun état chargement/erreur UI hors Dashboard → écran vide silencieux sur échec réseau.
- `alert()` + `location.href` au lieu de toasts + `router.push`.

### Infra
- **Aucun healthcheck** sur backend/frontend/fog/mosquitto.
- **Images `:latest` non pinnées** + Watchtower auto-deploy = risque de breaking change silencieux.
- **Conteneurs en root** (aucun `USER` dans les Dockerfiles).
- **Aucun backup DB** (critique vu le stockage sur carte SD).
- Grafana admin password `admin` par défaut.

### Embarqué / simulateur
- Reconnexion **WiFi** non gérée sur ESP32 (seulement MQTT).
- `setBufferSize` présent sur 1 sketch sur 5 (PubSubClient tronque > 256 o silencieusement).
- `requirements.txt` faux (deps listées non utilisées, deps réelles manquantes → `load_test_matrix.py` ne démarre pas).

### Docs
- `backend/README.md` décrit **Zookeeper/Confluent** (obsolète, migré KRaft).
- Nom d'image GHCR **divergent sur 3 valeurs** (`thegasp16` vs `gaspardmenou` vs dérivé CI).
- Workflow CI fantôme `docker-image.yml` cité dans `AGENTS.md` (vrais fichiers : `backend-ci.yml`…).
- **LICENSE racine** et **CONTRIBUTING.md** absents.

---

## 🟡 À SUPPRIMER (code mort / hygiène)

| Élément | Emplacement |
|---------|-------------|
| **6 composants Vue morts** (`HomeView`, `MeasurementCard`, `LineChart`, `ComponentSelector`, `ViewTitle`, `OptionSelector`) + `stores/counter.ts` | `frontend/src/` |
| `src/node_modules/.vitest/results.json` (node_modules versionné par accident) + `.vscode/extensions 2.json` | `frontend/` |
| **`Arduino/bordel/`** (22 fichiers legacy versionnés) + `Arduino/LORA/` (vide) | `Arduino/` |
| **CI/composes GitLab obsolètes** : `backend/docker-compose.yml` (Zookeeper), `frontend/docker-compose.yml`, `.gitlab-ci.yml`, `.run.sh` | racine & sous-dossiers |
| Code mort Python (`ask_for_value_mode`, `publish_random_value`…), artefacts `load_test_results.{csv,png}` à la racine | `python-simulator-over-mqtt-master/` |
| `console.*` de debug (36 backend, 28 frontend), émojis dans logs fog, `.DS_Store` (29 fichiers) | partout |
| `script "hello"` dans `package.json`, `EXPOSE 3001` mort, `main: index.js` incorrect (fog) | divers |

---

## 🔵 À REFAIRE DE ZÉRO (justifié)

1. **Couche auth backend** (`middlewares/auth.ts` + re-parsing JWT) → un middleware unique `req.user` + `requireRole()`. Racine des failles.
2. **Couche fiabilité fog → Kafka** : buffer mémoire → store persistant survivant aux redémarrages (voir § Rétention locale). Cœur de valeur du nœud fog.
3. **Event bus maison frontend** (`helpers/eventBus.ts`, chaînes magiques avec typos) → store Pinia typé.
4. **`useUser.composable.ts` (392 l.)** fourre-tout → scinder `useAuth` / validation / storage.
5. **`install.sh` fog** : non idempotent, `chmod 777`, `apt upgrade` + `reboot` automatiques, mot de passe en arg CLI.
6. **Machine à états réseau ESP32** (WiFi → MQTT → handshake) au lieu de blocs `if` éparpillés.

---

## 🟢 À AJOUTER

- **Reverse proxy TLS** (Traefik/Caddy) — **reporté tant que hors prod**, noté dans le README racine.
- **Backups DB automatisés** (cron `pg_dump` + rotation).
- **Healthchecks** Docker + endpoint `/health` backend ; **secrets management** (Docker secrets).
- **Validation déclarative** (Zod) + **logger structuré** (pino) backend.
- **Tests manquants** : `kafkaProducer` (fog, 0 test), composants Vue critiques, garde router, protocole simulateur, natifs PlatformIO ESP32.
- **Observabilité fog** (métriques drop/buffer/latence) + lint/test fog en CI.
- **Watchdog ESP32** + resync NTP + reconnexion WiFi.
- **Scan sécu CI** (Trivy, npm audit, gitleaks).

---

## 🧭 Axes stratégiques (moyen/long terme)

Ces chantiers dépassent la simple correction et orientent l'évolution du projet.

### 1. Sécuriser le transport fog → Kafka

**État actuel.** Le fog se connecte à Kafka en `PLAINTEXT` sur `${SERVER_HOST}:9092`, listener
`PLAINTEXT_HOST` (`docker-compose.yml:34-36`). Le port est publié sur l'hôte → joignable depuis
Internet **sans authentification ni chiffrement**. Pour des données de santé, c'est le point le
plus sensible du transport.

**Options, du plus simple au plus robuste :**

| Approche | Principe | Effort | Recommandé pour |
|----------|----------|--------|-----------------|
| **VPN point-à-point (WireGuard)** | Tunnel chiffré entre le Pi fog et le cloud. Kafka reste en PLAINTEXT mais circule dans un réseau privé chiffré, plus jamais exposé sur Internet (fermer le port 9092 public). | Faible | **1 fog → 1 cloud** (cas actuel) ✅ |
| **Kafka SASL_SSL** | Authentification SASL (SCRAM-SHA-512) + chiffrement TLS natif Kafka. Côté fog : `kafkajs` accepte `ssl: true` + bloc `sasl`. | Moyen (certificats, keystores, listener dédié) | Multi-fog, plusieurs producteurs |
| **mTLS** | Certificats client **et** serveur, identité mutuelle. | Élevé | Exigences de conformité fortes |

**Recommandation pour l'échelle actuelle :** **WireGuard**. Meilleur rapport
simplicité/sécurité pour un lien point-à-point, indépendant de la couche applicative, et il
ferme la surface d'attaque (port Kafka plus exposé publiquement). On bascule vers
**SASL_SSL** le jour où il y a plusieurs nœuds fog ou des producteurs tiers.

**Quoi qu'il arrive :** retirer la publication publique du port 9092 (le garder uniquement
sur le réseau privé/VPN).

### 2. Rétention locale des données sur le fog (données médicales)

C'est à la fois un **objectif métier** (souveraineté des données de santé, résilience réseau)
et **la vraie solution au problème #7** (perte de données si Kafka tombe). L'idée : le fog
devient **source de vérité locale durable**, le cloud n'est qu'un réplica.

**Pattern cible : « store-and-forward ».**
1. À réception d'une mesure MQTT → écriture **immédiate dans un store local durable** (sur
   disque, pas en RAM).
2. Un processus de réplication pousse vers Kafka/cloud quand le lien est disponible, puis
   **marque la donnée comme synchronisée**.
3. On ne supprime/purge localement qu'après confirmation (ACK) et selon une politique de
   rétention. Survit aux coupures réseau **et** aux reboots du Pi.

**Choix techniques à creuser :**
- **Store local** : SQLite (simple, transactionnel, idéal sur Pi) ou une petite base
  time-series légère. TimescaleDB complet est trop lourd pour un Pi en edge.
- **Matériel** : la **carte SD est le maillon faible** (usure en écriture, corruption). Pour
  des données médicales conservées localement → **SSD USB** quasi obligatoire.
- **Chiffrement at-rest** : un Pi peut être volé. Chiffrer le volume de données (LUKS) ou au
  minimum la base.
- **Conformité** : les données de santé sont une **catégorie particulière (RGPD art. 9)** →
  contrôle d'accès, pseudonymisation, durée de conservation explicite, traçabilité.

**Bénéfice combiné :** ce store local **est** le buffer durable qui élimine le drop silencieux
du fog. Les deux chantiers (fiabilité #7 et rétention médicale) ne font qu'un.

### 3. Documenter les ESP32 / l'embarqué

Gap reconnu (le README racine le note). À produire :
- **README sous `Arduino/ESP32/`** : structure PlatformIO, rôle de la lib partagée `Common/`,
  comment flasher, **brochage (pins) par capteur**, provisioning WiFiManager (portail captif,
  reset par bouton BOOT), persistance NVS.
- **Spécification formelle du protocole capteur** : compléter [`MQTT.md`](./MQTT.md) — handshake
  `ping`/`start`/`stop`/`ack`, topics dédoublés `<topic>/sensor` & `<topic>/server`, format de
  payload (`{ timestamp µs, measures: [{ measureType, value }] }`), cadences, timeouts.
- Documenter les pièges hardware relevés à l'audit : watchdog absent, NTP bloquant,
  `setBufferSize` à harmoniser, `String` Arduino qui fragmente le heap, `retained=true` sur des
  séries temporelles.

### 4. Standardiser les paquets MQTT (modèle zigbee2mqtt) + intégration Home Assistant

**Objectif.** Rendre l'ajout d'un capteur **plug-and-play**, y compris des capteurs
**non-médicaux**, en standardisant la convention de topics et le format des payloads — comme le
fait `zigbee2mqtt`.

**Pistes :**
- **Convention de topics stable et hiérarchique**, ex. `rami/<sensor_id>/<measure_type>` pour
  les états, et un message **d'annonce/découverte** décrivant les capacités du capteur (types de
  mesures, unités, plages, fréquence). Le backend auto-découvre déjà via le wildcard `#` → il
  suffit de formaliser le contrat.
- **MQTT Discovery façon Home Assistant.** HA auto-découvre tout appareil qui publie un
  message de config sur `homeassistant/<component>/<node_id>/<object_id>/config` (JSON décrivant
  l'entité), puis ses états sur les topics `state`. Le fog **est déjà le hub MQTT** : il peut
  publier ces messages de discovery et republier les mesures sur les topics d'état → les
  capteurs RAMI apparaissent automatiquement dans Home Assistant.
- **Séparer les flux par criticité.** Garder le flux « médical » (vers Kafka/backend, tracé,
  conservé) **distinct** du flux « domotique/HA » pour ne pas mélanger les niveaux de
  certification et de criticité. Une passerelle de découverte HA peut vivre à côté du fog sans
  polluer le chemin médical.

**Bénéfice :** ajout de capteurs en quelques minutes, ouverture à un écosystème domotique
existant, et terrain de jeu pour prototyper de nouveaux capteurs sans toucher au backend.

---

## Plan d'action suggéré (ordre)

1. **Sprint sécu** (rapide, fort impact) : fix `.gitignore` `.env`, faille IDOR `userSensor`, retirer `pretier`, retirer + révoquer les secrets du simulateur.
2. **Sprint nettoyage** (faible risque) : supprimer le code mort listé, les CI/composes GitLab, `Arduino/bordel/`.
3. **Sprint fiabilité fog** : shutdown gracieux + persistance locale du buffer + métriques (rejoint l'axe stratégique #2).
4. **Sprint prod-readiness** : healthchecks, backups DB, pin des images, WireGuard fog↔cloud (axe #1). Reverse proxy TLS quand passage en prod.
5. **Refontes ciblées** : middleware auth `req.user`, event bus → Pinia.
6. **Chantiers d'ouverture** : doc ESP32 (axe #3), standardisation MQTT + Home Assistant (axe #4).
