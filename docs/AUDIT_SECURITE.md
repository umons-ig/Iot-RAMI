# Audit de sécurité — 2026-08-07 (trois vagues)

Audit multi-agents du dépôt (7 dimensions : authentification, autorisation, injection,
secrets/CI, frontend, fog/IoT, durcissement runtime), chaque faille rapportée ayant été
confirmée par relecture du code réel, puis les correctifs relus par une seconde passe
adversariale et rejoués dynamiquement contre une instance réelle.

## 1. Failles corrigées

### Contrôle d'accès (le gros du sujet)

| Faille | Fichier | Impact avant correctif |
|---|---|---|
| **WebSocket `join-session` sans autorisation** | `backend/src/service/socketService.ts` | Tout compte authentifié rejoignait la room d'un topic arbitraire et recevait l'**ECG temps réel** de n'importe quel patient. Le JWT n'était vérifié que comme preuve d'identité ; ni `userId` ni `role` n'étaient lus. |
| Seuils d'alerte sans contrôle | `backend/src/controllers/threshold.ts` | Création/lecture/modification/suppression des seuils de n'importe quel capteur → **désactivation de l'alarme d'un patient** (`min=0, max=999999`). |
| `POST /measurements/bulk` sans contrôle | `backend/src/controllers/measurement.ts` | Insertion en masse de mesures falsifiées sous l'identité du capteur d'autrui (intégrité des données médicales). |
| Fail-open sur `GET /measurements` | `backend/src/controllers/measurement.ts` | Le garde `sensors.length > 0 &&` rendait le contrôle inopérant pour un utilisateur **sans aucun capteur accordé** — exactement l'inverse du besoin. |
| IDOR `/sensors/:id/topic` et `/sensors/:id/sessions` | `backend/src/routes/sensor.ts` | Divulgation du topic MQTT (clé d'entrée pour écouter le flux ou pousser des commandes). Nouveau middleware `requireSensorAccess`. |
| Création/clôture de session sans contrôle | `backend/src/controllers/session.ts` | Ouverture de session + fuite du topic sur le capteur d'autrui ; clôture arbitraire d'une session par simple `idSession`. |
| Énumération de la flotte | `backend/src/controllers/sensor.ts` | `/sensors/connexion/online` listait tous les capteurs **et** lesquels sont sous surveillance à l'instant t. Filtré sur les capteurs accessibles. |

### Authentification / exposition

- **Fuite des hash bcrypt** (`user.ts`) : `GET /users/all` renvoyait les enregistrements complets, mot de passe haché inclus. → `attributes: { exclude: ["password"] }`.
- **Rate limiter mal monté** (`app.ts`) : `authLimiter` couvrait `/api/v1/auth`, alors que le login et l'inscription vivent sous `/api/v1/users` — le brute-force de mots de passe n'était limité que par le plafond global (500 / 5 min). Limiteurs **distincts** par surface (voir §3).
- **Rôle réémis depuis le token au refresh** (`user.ts`) : une rétrogradation admin → regular n'était jamais appliquée pendant les 7 jours de validité du refresh token. Le rôle est désormais relu en base.
- **Filtre IP de `/metrics`** (`app.ts`) : `startsWith("172.")` autorisait tout 172.0.0.0/8 (adresses publiques comprises) et refusait la loopback en IPv4-mapped (`::ffff:127.0.0.1` → 403, Prometheus cassé). Restreint à la loopback et à 172.16.0.0/12.
- **TLS SMTP** (`mail.ts`) : `secure: false` codé en dur avec un port 465 par défaut → identifiants SMTP susceptibles de partir en clair. TLS implicite sur 465, STARTTLS exigé ailleurs.

### Fog / IoT

- **`isAuthorized` fail-open** : sans `MGMT_TOKEN` ni `MGMT_PASSWORD`, l'API de pilotage de la flotte (OTA, WiFi, restart) acceptait **tout le monde**. Désormais fail-closed, avec message explicite au démarrage.
- **Jeton de session = SHA-256 non salé du mot de passe** : cassable hors ligne, sans expiration ni révocation. Remplacé par un HMAC sur clé dérivée par `scrypt`, avec expiration signée (12 h) — toujours sans état serveur, donc un redémarrage du fog ne déconnecte pas.
- **Login sans limitation** : le mot de passe admin de la flotte était brute-forçable sans entrave. Fenêtre glissante (10 tentatives / 15 min), table des IP bornée.

### Divers

- Compte admin de démo (hash bcrypt committé, donc mot de passe public) : le seeder **se saute** en production sauf `ALLOW_DEMO_SEED=true`.
- Injection shell dans `.github/workflows/firmware-release.yml` : le tag passait en interpolation `${{ }}` directement dans un `run:`. Passé par `env:` + validation stricte du format.
- `backend/src/middlewares/auth 2.ts` : copie obsolète du middleware (sans les gardes IDOR), jamais importée. Supprimée.
- Dépendances : backend 34 → 12 vulnérabilités, fog 8 → 0. `nodemailer` monté en 9.x.

### Seconde vague

| Faille | Fichier | Impact avant correctif |
|---|---|---|
| **Changement de mot de passe sans révocation** | `controllers/user.ts` | `refreshTokenVersion` n'était incrémenté qu'au `logout` : après une compromission, changer son mot de passe **ne déconnectait pas l'attaquant**, dont le refresh token restait valable 7 jours. La session courante, elle, est préservée (nouveau jeton réémis). |
| **Export CSV en mémoire** | `controllers/session.ts` | Toute la session était matérialisée trois fois (lignes SQL, tableau, `join`) : un utilisateur authentifié saturait la mémoire du Pi en boucle. Désormais streamé par lots de 10 000 avec gestion du `drain`. |
| **Registres d'auto-découverte non bornés** | `service/discorverdSensorSevice.ts`, `discoverdMeasurementService.ts` | Alimentés directement par les payloads Kafka (non authentifiés) : publier des topics aléatoires faisait croître les `Map` jusqu'à l'épuisement mémoire. Plafond + éviction LRU + validation du format. |
| **Cardinalité Prometheus non bornée** | `middlewares/metrics.ts` | `normalizeRoute` n'anonymisait que les identifiants **numériques**, alors que le projet utilise des UUID : chaque URL créait une série temporelle. |
| **Autorisation WebSocket jamais révoquée** | `service/socketService.ts` | L'accès n'était évalué qu'au `join` : un opérateur à qui l'on retirait l'accès continuait de recevoir l'ECG tant que son onglet restait ouvert. Revalidation toutes les 60 s, fail-closed. |
| **Métriques du fog sur toutes les interfaces** | `fog-service/compose.yaml` | Publiées sans authentification à tout le réseau. Restreintes à la loopback du Pi (`METRICS_BIND`), comme Postgres et Prometheus dans le compose racine. |
| **OTA acceptant `http://`** | `fog-service/src/managementServer.ts`, `Arduino/…/MQTTCommonOperations.cpp` | En clair, un attaquant sur le chemin réseau substituait le binaire → exécution de code arbitraire sur un dispositif médical. HTTPS désormais exigé des deux côtés (`ALLOW_INSECURE_OTA` / `-DRAMI_ALLOW_INSECURE_OTA` pour un banc de test). |
| **Identifiants MQTT par défaut publics** | `Arduino/…/MQTTCommonOperations.cpp` | `fog1` / `fog1password` committés : tout capteur en configuration d'usine était joignable par quiconque lit le dépôt. Champs désormais vides. |

### Troisième vague — audit *après* correctifs

Un audit de contrôle a été relancé sur le code déjà corrigé, avec la stack Docker
en marche. Il a trouvé **une faille critique passée à travers les deux premières
vagues**, plus une série de points restés ouverts.

| Faille | Fichier | Impact avant correctif |
|---|---|---|
| **Portail WiFiManager actif en permanence, sans authentification** | `Arduino/…/MQTTCommonOperations.cpp` | `wm.startWebPortal()` laissait tourner un serveur HTTP sur l'IP LAN du capteur. L'authentification est **morte dans la librairie** (`bool testauth = false; if(!testauth) return;`), et `setupHTTPServer()` expose `/wifisave` (repointer le broker), `/erase` (effacer la config) et surtout **`/u` en POST, qui écrit via `Update`** : soit un **flash de firmware arbitraire en une requête, sans identifiant**, depuis n'importe quel poste du réseau. Tout le durcissement de la console du fog était contournable par ce chemin. |
| `GET /sensors/connexion/online/:sensorName` sans contrôle | `controllers/sensor.ts` | La correction n'avait été appliquée qu'à la variante *liste* : interroger un capteur par son nom révélait toujours s'il publie, donc si un patient est sous surveillance. |
| `GET /teams` et `/teams/:id` ouverts | `routes/team.ts` | Annuaire complet (nom + email de tous les utilisateurs) accessible à tout compte authentifié. Passés en `authAdmin`, comme le reste des routes team. |
| `DELETE /sessions/:id` détruisait tout l'historique | `controllers/session.ts` | Appelé avec le seul `idSensor`, `deleteSensorDataWithinTimeRange` n'ajoute aucun filtre temporel : supprimer une session d'une heure effaçait des mois de données médicales. Désormais borné à la fenêtre de la session. |
| `GET /measurements` sans `LIMIT` | `controllers/measurement.ts` | Sans le paramètre `number`, un `findAll` non borné dumpait la table entière (deux jointures + tri). Plafond de 10 000. |
| Cardinalité Prometheus toujours non bornée | `middlewares/metrics.ts` | Normaliser les UUID ne suffisait pas : le middleware est monté avant le routeur, donc les **404** créaient un label par URL inédite. Replié sur une allowlist de préfixes. |
| Registres du fog non bornés | `fog-service/src/mqttFog.ts` | Abonné à `#`, le fog créait un appareil, une session et un timer permanents pour **tout** topic `*/sensor` reçu. Validation du format + plafond. |
| `/api/command` sans validation de cible | `fog-service/src/managementServer.ts` | La cible partait telle quelle vers MQTT : publication sur un bus tiers, ou réinjection vers le fog lui-même. Même garde que `/api/ha`. |
| `replace("/sensor")` non ancré | `fog-service/src/mqttFog.ts` | Ne remplaçait que la première occurrence — un topic hiérarchique recevait son ACK sur un topic erroné, et le capteur ré-émettait START indéfiniment. Ancré en suffixe (le piège était pourtant déjà documenté en §3). |
| `/users/:id/sessions` : `limit`/`offset` non bornés | `controllers/user.ts` | `?limit=abc` injectait un NaN dans la clause LIMIT (500 au lieu de 400). Aligné sur les autres routes paginées. |
| **Swagger servi sans authentification** | `app.ts` | Vérifié en conditions réelles : `/api/v1/docs` répondait 200 en `NODE_ENV=production` et livrait le schéma complet de l'API. N'est plus enregistré en production (`SWAGGER_ENABLED=true` pour une instance de démonstration). |

**Trois régressions introduites par mes propres correctifs de la vague 2**, trouvées
par ce même audit et corrigées :

- **Export CSV, erreur en cours de flux** : les en-têtes étant déjà envoyés, un échec au 3ᵉ lot levait `ERR_HTTP_HEADERS_SENT` en rejet non capturé — ce qui **tue le process**, donc toutes les sessions ECG en cours. La réponse est désormais coupée proprement.
- **Export CSV, attente de `drain`** : si le client se déconnectait pendant l'attente, la promesse ne se résolvait jamais et retenait la connexion et le lot en mémoire. On attend maintenant `drain` **ou** `close`.
- **Export CSV, pagination `OFFSET`** : le tri sur `time` seul n'est pas total (le format multi-mesures écrit plusieurs lignes au même horodatage), donc un groupe à cheval sur une frontière de lot pouvait être dupliqué ou omis **silencieusement**. Tri secondaire sur `idMeasurementType`.
- **Revalidation WebSocket** : elle réutilisait le payload JWT figé au `join`, donc ignorait l'expiration et un changement de rôle. Le jeton est désormais re-vérifié à chaque passage.

## 2. Vérification

Les correctifs ont été **rejoués contre une instance réelle** (TimescaleDB + backend), avec
un scénario « attaquant authentifié sans accès au capteur d'une victime » :

- **Sur le code non patché** : entrée confirmée dans la room WebSocket de la victime, topic MQTT obtenu (HTTP 200), session créée (201), seuil `min=0 max=999999` posé sur le capteur d'autrui (201).
- **Sur le code patché** : 13/13 refus attendus, **contre-épreuve incluse** — la victime légitime accède toujours à son capteur (pas de régression).

La seconde vague a été vérifiée de la même façon (10/10) : l'ancien refresh token est bien
rejeté après changement de mot de passe (`401 auth.token.revoked`) tandis que la session
courante survit, et l'export CSV restitue 25 000 points sur trois lots successifs sans
raccord corrompu.

La troisième vague a été validée avec la **stack Docker complète** (image backend
construite localement, `NODE_ENV=production`, TimescaleDB + Kafka) : 13/13 exploits
refusés, et les nouveaux gardes confirmés en conditions réelles (statut capteur 403,
`/teams` 401, `?limit=abc` sans 500). Le filtre IP de `/metrics` a été éprouvé depuis
un réseau Docker hors plage : **403**, tandis que `/health` répond 200 — le backend
voit donc bien la vraie IP source.

Suites de tests : 388 (backend) + 97 (fog) + 159 (frontend), toutes au vert.
Firmware : `dht22`, `universal` et `universal_tls` compilent.

## 3. Pièges rencontrés (à ne pas réintroduire)

- **Un seul objet `rateLimit` partagé entre plusieurs `app.use` partage son compteur.** Monter le même `authLimiter` sur `/auth`, `/users/login` et `/users/signup` permettait à un attaquant d'épuiser le quota sur l'un pour bloquer les deux autres — déni de service contre tous les utilisateurs derrière un même NAT (hôpital). Une instance **par surface**.
- **Un seeder qui `throw` interrompt tout `db:seed:all`.** Le seeder de démo est le premier par ordre alphabétique : lever une exception empêchait les seeders de `MeasurementTypes` de s'exécuter. Sans ces types, le consommateur Kafka ignore chaque mesure : la plateforme *paraît* fonctionner tout en n'enregistrant **aucune donnée patient**. Se sauter (`return`), jamais lever.
- **Ne pas fonder une décision d'autorisation sur un cache de la voie de données.** Le cache capteurs (TTL 5 min) de `socketService` ignore un capteur créé il y a moins de 5 minutes : un utilisateur pourtant autorisé se serait vu refuser le flux. L'autorisation interroge la base.
- **`topic.replace("/sensor", "")` ne remplace que la première occurrence** et ampute un topic légitime comme `batimentA/sensors/ecg-12`. Retirer le suffixe uniquement s'il est en fin (`endsWith`).
- **Un refus silencieux est pire qu'une erreur.** Le refus de `join-session` n'était pas écouté côté frontend : l'écran restait « LIVE » avec une courbe vide, qu'un soignant lit comme « ce patient n'a pas d'activité ». État `forbidden` + badge « ACCÈS REFUSÉ ».
- **N'élargissez pas l'allowlist `/metrics` à tout le RFC 1918.** Le backend est publié sur le LAN de l'université : autoriser 10/8 et 192.168/16 exposerait les métriques (activité patients temps réel) à n'importe quel poste du campus.

## 4. Non corrigé — décisions assumées

Ces points sont réels mais **n'ont pas été patchés**, car le correctif est un chantier
d'infrastructure ou casserait le matériel déjà déployé. À traiter comme des tâches à part
entière.

| Sujet | Pourquoi pas maintenant | Piste |
|---|---|---|
| **Kafka exposé en PLAINTEXT** (`docker-compose.yml`) | Le port 9092 est requis par le fog **distant** : le fermer coupe la remontée de données en production. C'est le trou le plus large qui reste — qui atteint ce port lit tout le flux médical et peut injecter de fausses mesures. | **À faire tout de suite, hors code** : restreindre la source au pare-feu de la VM (`ufw allow from <IP_FOG> to any port 9092 && ufw deny 9092`). Ensuite : tunnel WireGuard, puis binder sur l'interface du tunnel. Le broker a déjà un bloc SASL_SSL préparé en commentaire. |
| **MQTT sans TLS** — *prêt, désactivé* | Le TLS est désormais **implémenté et compilé** : environnement PlatformIO `universal_tls` (`-D RAMI_MQTT_TLS` → `WiFiClientSecure`, port 8883, AC exigée), et `mqtts://` côté fog sans changement de code. Il reste **désactivé par défaut** parce que la bascule doit être simultanée broker + fog + capteurs : le fog tourne en production, un décalage arrête la collecte. | Renseigner `MqttCaCert.hpp`, ajouter le listener 8883 à Mosquitto, flasher `universal_tls`, basculer `MQTT_URL`. Cf. `docs/FIRMWARE_DEPLOYMENT.md` §8. |
| **MQTT sans ACL par topic** | Tous les ESP partagent une identité : un capteur compromis publie sur le topic `/server` d'un autre et lui envoie `ota` / `restart`. Une ACL impose **un compte par appareil**, donc une convention de nommage et un provisionnement — à figer avant de déployer le parc. | Un utilisateur Mosquitto par capteur + `acl_file`, au prochain déploiement firmware. |
| **OTA ESP32 : certificat non validé** (`Arduino/…/MQTTCommonOperations.cpp`) | `http://` est désormais refusé, mais `setInsecure()` demeure. Épingler une racine a été **écarté après vérification** : la chaîne diffère selon l'hôte (ISRG Root pour `*.githubusercontent.com`, Sectigo pour `github.com`) et GitHub la fait tourner — un CA figé casserait l'OTA de façon différée. | La bonne réponse est l'**intégrité**, pas l'authenticité du transport : publier le SHA-256 du binaire dans la release, le transmettre via le fog (qui valide TLS correctement) dans la commande `ota`, et le vérifier sur l'ESP avec `Update.begin/write` avant reboot. |
| **HTTPS absent** (API et frontend) | En attente du nom de domaine. Les JWT circulent en clair. | Traefik ou Nginx + Let's Encrypt dès que le domaine est disponible. |
| **Énumération de comptes au signup** | Choix **assumé** : le front a besoin de distinguer « email déjà pris », et masquer le seul message serait vain puisque le code d'erreur voyage dans la même réponse. | Borné par `signupLimiter` (20 tentatives / 15 min par IP). |
| **`GET /zones` et `/zones/tree`** exposent l'arborescence | Un compte sans aucun capteur obtient le plan du site (bâtiment / étage / chambre) et les UUID des zones. Impact limité à la reconnaissance. Le filtrage a été fait sur les capteurs et sur les compteurs, pas sur les nœuds. | Filtrer les nœuds sur `zoneGrantedSensorIds` **en conservant les ancêtres** — et prévoir un état vide explicite côté frontend, sinon on reproduit le piège du refus silencieux (§3). |
| **`join-session` non limité en débit** | Chaque message déclenche des requêtes d'autorisation ; un compte authentifié peut marteler l'évènement (les limiteurs Express ne couvrent pas le canal WebSocket). Amplification modérée, authentifiée. | Limiteur par socket, ou mémoïsation très courte du couple (userId, sensorId). |
| **Vulnérabilités npm restantes** | Backend 11, frontend 8 — **hors du chemin d'exécution en production** (vitest, vite, vue-tsc, nodemon, pm2, tsup, eslint). `tar` (critical) vient de `bcrypt` → `node-pre-gyp`, mais ne sert qu'à décompresser le binaire natif **à l'installation** : c'est un risque de chaîne de build, pas une surface exploitable à distance. | Revoir à chaque montée de version majeure. Ne **pas** suivre la suggestion `npm audit` pour `sequelize` : elle propose un retour en 3.x, et l'avis d'injection SQL a été vérifié **non atteignable** (aucune colonne JSON ni cast dans le code). |

## 5. Déploiement et actions d'exploitation

Les correctifs ont été poussés sur `main` le 2026-08-07 (`e866e25..1f6636d`, 9 commits
thématiques), CI verte sur les cinq workflows. **Watchtower déploie automatiquement**
sur la VM cloud et sur le Pi fog : ces changements sont donc en service.

### 5.1 Changements de comportement à connaître

Trois correctifs modifient un comportement observable. Aucun n'est un bug, mais chacun
peut surprendre en exploitation.

| Changement | Effet visible | Quoi faire |
|---|---|---|
| **Console fog en fail-closed** | Sans `MGMT_TOKEN` ni `MGMT_PASSWORD` dans le `.env` du Pi, `/api/*` refuse **tout** : plus d'OTA, de restart ni de reconfiguration à distance. | Définir l'un des deux **avant** que l'image fog ne soit tirée, puis recréer le conteneur (`docker compose up -d --force-recreate`) — un simple restart ne recharge pas les variables. |
| **Swagger coupé en production** | `/api/v1/docs` répond 404. | Normal. Pour une instance de démonstration : `SWAGGER_ENABLED=true`. |
| **`/teams` et `/teams/:id` réservés aux admins** | Un compte non-admin reçoit 401. | Normal — ces routes livraient l'annuaire complet (nom + email de tous les utilisateurs). La vue Teams du frontend était déjà admin-only. |

### 5.2 Actions restantes, hors dépôt

Ces deux points ne peuvent pas être corrigés par du code : ils demandent une intervention
sur l'instance en service.

**1. Purger le compte de démo.** Le correctif du seeder empêche sa création future, mais
**ne supprime pas un compte déjà présent** : si la base a été initialisée avec `init-db`,
l'administrateur `adriano@ig.umons.ac.be` existe avec un mot de passe public (son hash
bcrypt est committé dans un dépôt public). C'est aujourd'hui l'accès le plus direct qui
reste ouvert.

```sql
SELECT id, email, role FROM "Users" WHERE email = 'adriano@ig.umons.ac.be';
-- puis, selon le cas :
DELETE FROM "Users" WHERE email = 'adriano@ig.umons.ac.be';
-- ou bien lui affecter un hash bcrypt neuf généré hors ligne.
```

**2. Restreindre le port Kafka au pare-feu.** Quelques minutes, aucun changement de
fichier, et cela ferme l'exposition la plus large qui subsiste (lecture de tout le flux
médical et injection de fausses mesures) :

```bash
ufw allow from <IP_DU_FOG> to any port 9092
ufw deny 9092
```

### 5.3 Vérification après déploiement

À faire une fois que Watchtower a tiré les images (poll de 300 s) :

```bash
# 1. Le backend redémarre bien (il ne démarrait plus sur Node >= 22 avant correctif)
curl -s https://<host>:3000/health          # attendu : {"status":"ok"}

# 2. Swagger n'est plus servi
curl -s -o /dev/null -w '%{http_code}\n' https://<host>:3000/api/v1/docs   # attendu : 404

# 3. La console fog répond (sinon : MGMT_TOKEN/MGMT_PASSWORD manquants, cf. 5.1)
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Mgmt-Token: <token>" \
     http://localhost:9200/api/devices      # attendu : 200 — et 401 sans le jeton

# 4. Les capteurs remontent toujours des mesures (contre-épreuve : aucun correctif
#    ne doit avoir coupé la collecte)
docker logs iot-rami-backend --tail 50 | grep -i sensordata
```

Si le point 4 est muet alors que les ESP publient, vérifier en priorité que la table
`MeasurementTypes` n'est pas vide : sans ces types, le consommateur Kafka ignore
silencieusement chaque mesure (cf. le piège du seeder en §3).

## 6. Note de compatibilité (corrigé, mais à connaître)

`node:lts-slim` pointe **déjà** sur Node 24, qui a supprimé `SlowBuffer` — dont
`jsonwebtoken` dépend de façon transitive. Le backend ne démarrait donc plus du tout sur un
Node récent, et le prochain rebuild d'image l'aurait cassé en production. Deux causes, deux
correctifs :

- le polyfill vivait en tête de `server.ts`, mais TypeScript hisse les `import` au-dessus du
  code : `jsonwebtoken` était chargé avant. Il est désormais dans `src/polyfills.ts`,
  importé en première ligne ;
- `backend/Dockerfile` épingle `node:22-slim` au lieu du tag mouvant.

Vérifié : le backend démarre sur Node 25 sans polyfill externe. `fog-service` et `frontend`
utilisent toujours `node:lts-alpine` — ils n'embarquent pas `jsonwebtoken`, donc ne sont pas
concernés, mais leur build n'est pas reproductible pour autant.
