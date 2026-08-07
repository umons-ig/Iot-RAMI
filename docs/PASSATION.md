# Passation — reprendre le projet RAMI 1.0

> Document d'entrée pour toute personne qui reprend le projet. Il répond à
> « je débarque, comment je prends la main ? ». Le *quoi* technique détaillé est
> dans les autres docs (liens en bas) ; ici c'est le *comment on opère*.

RAMI 1.0 est un système de gestion de capteurs IoT (UMONS) : capture, traitement
et visualisation temps réel de mesures multi-capteurs (ECG, température, humidité).
Chaîne : **ESP32 → MQTT (Mosquitto sur le fog) → fog-service → Kafka → backend
Node/Express → PostgreSQL/TimescaleDB → frontend Vue 3 (WebSocket)**.

---

## 1. Accès & permissions à réclamer

Le dépôt canonique est **`umons-ig/Iot-RAMI`** (organisation GitHub UMONS). Ce que
tu dois te faire accorder par un *owner* de l'orga :

| Ressource | Rôle nécessaire | À qui demander |
|---|---|---|
| Repo `umons-ig/Iot-RAMI` | **Write** (Maintain/Admin pour gérer Pages/packages) | owners : `MaximeGloesener`, `mahmoudis`, `mathisdelehouzee`, `Rabie-LK`, `Tanguyvans` |
| Accès SSH aux 2 hôtes | comptes `rami-cloud` (VM cloud) et `rami-fog` (Pi) | responsable infra |
| Grafana / monitoring | login dashboard | cf. [`MONITORING.md`](MONITORING.md) |

Points déjà en place (ne pas refaire, juste savoir) :
- **GitHub Pages** activée → <https://umons-ig.github.io/Iot-RAMI/> (accueil + flash USB).
- **Images GHCR publiques** : `ghcr.io/umons-ig/iot-rami-{backend,frontend,fog}`
  (Watchtower les tire sans credentials).

> ⚠️ La **visibilité d'un package GHCR est indépendante de celle du repo**. Une
> image publiée pour la 1ʳᵉ fois est *privée* par défaut → la passer en Public
> (Org → Packages → *Package settings* → *Change visibility*), sinon Watchtower
> échoue en `denied`.

---

## 2. Architecture en un coup d'œil

```
ESP32/Simulateur → MQTT (Mosquitto, fog Pi) → fog-service → Kafka → backend (consumer only)
                                                                          ↓
                                              Frontend ← WebSocket (socketService.ts)
                                              Frontend ← REST API
```

- Les **sessions sont pilotées par le fog** (start/stop sur événements Kafka), pas
  par le frontend.
- Le backend **n'a pas de client MQTT** : les capteurs / types de mesure inconnus
  sont **auto-découverts** depuis les payloads Kafka.
- Détails : [`MQTT.md`](MQTT.md), [`KAFKA.md`](KAFKA.md), [`API.md`](API.md).

---

## 3. Runbook déploiement

Deux hôtes distincts. Le code est déployé via **images Docker** (GHCR) + **Watchtower**
qui auto-pull les nouvelles images (`:latest`) toutes les ~5 min.

### 3.1 VM cloud (`rami-cloud`)
Stack racine `docker-compose.yml` : `node-db` (TimescaleDB), `kafka`, `node-backend`,
`frontend`, `prometheus`, `alertmanager`, `grafana`, `watchtower`.

```bash
# mise à jour manuelle (Watchtower le fait sinon automatiquement)
sudo docker compose pull && sudo docker compose up -d
# migrations DB après un changement de modèle Sequelize (sinon 500 "column does not exist")
sudo docker compose exec node-backend npm run migrate
```

### 3.2 Fog Pi (`rami-fog`)
Stack `fog-service/compose.yaml` : `mosquitto`, `fog-service`, (`fog-postgres` outbox),
`watchtower`. Installation initiale via [`fog-service/install.sh`](../fog-service/install.sh)
(installe Docker, télécharge `compose.yaml` + config Mosquitto, demande les identifiants
MQTT/Kafka, génère le `.env`).

```bash
sudo docker compose pull && sudo docker compose up -d
```

### 3.3 ⚠️ Le piège à connaître : `pull` ≠ mise à jour du `compose.yaml`
`docker compose pull` met à jour **les images**, jamais le **fichier `compose.yaml`
présent sur l'hôte**. Si tu changes un défaut dans le `compose.yaml` du repo (ex.
`FIRMWARE_REPO`), l'hôte tournera toujours son **ancienne copie** tant que tu ne l'as
pas re-synchronisée. Pour rafraîchir le compose du fog :

```bash
curl -fsSL "https://raw.githubusercontent.com/umons-ig/Iot-RAMI/main/fog-service/compose.yaml" -o compose.yaml
sudo docker compose up -d   # 'up -d' recrée les conteneurs impactés
```

Vérifier ce que le conteneur a réellement en environnement :
```bash
sudo docker compose exec fog-service printenv | grep FIRMWARE
```

Rollback d'une image en cas de mauvaise release : cf. [`BACKUP_AND_ROLLBACK.md`](BACKUP_AND_ROLLBACK.md).

### 3.4 Variables devenues OBLIGATOIRES (audit du 07/08/2026)

Depuis l'audit de sécurité, deux réglages ne peuvent plus rester vides sans conséquence
visible. Le détail est dans [`AUDIT_SECURITE.md`](AUDIT_SECURITE.md) §5.

| Hôte | Variable | Sans elle |
|---|---|---|
| Fog Pi | `MGMT_TOKEN` **ou** `MGMT_PASSWORD` | La console de gestion refuse **tout** (*fail-closed*) : plus d'OTA, de restart ni de reconfiguration à distance. Auparavant, leur absence ouvrait l'API à tout le monde — d'où le changement. |
| VM cloud | `GF_SECURITY_ADMIN_PASSWORD` | Grafana refuse de démarrer (déjà en place avant l'audit). |

Rappel du piège ci-dessus : après modification du `.env`, **recréer** le conteneur
(`docker compose up -d --force-recreate`) — un simple `restart` ne recharge pas les
variables d'environnement.

Deux autres changements de comportement à connaître côté cloud : `/api/v1/docs` (Swagger)
n'est plus servi en production, et `/teams` est réservé aux administrateurs.

---

## 4. Publier une nouvelle version du firmware ESP32

Le firmware unifié (`Arduino/ESP32/RamiFirmware`) est publié par **tag sémver**. Un
seul geste :

```bash
git tag v1.3.0 && git push origin v1.3.0
```

Ce qui se déclenche (workflow [`firmware-release.yml`](../.github/workflows/firmware-release.yml)) :
1. build PlatformIO (`env universal`), la version du tag est injectée dans `Version.hpp` ;
2. génération du binaire OTA + du *factory bin* (ESP Web Tools) ;
3. création de la **GitHub Release** avec les 2 `.bin` ;
4. redéploiement de la **page de flash** (Pages) avec la nouvelle version.

Ça alimente automatiquement : (a) l'**auto-OTA** du fog (poll des releases umons-ig,
opt-in `FIRMWARE_OTA_ENABLED`), et (b) le **flash USB navigateur**
(<https://umons-ig.github.io/Iot-RAMI/flash/>). Détails : [`FIRMWARE_DEPLOYMENT.md`](FIRMWARE_DEPLOYMENT.md),
[`FIRMWARE_ARCHITECTURE.md`](FIRMWARE_ARCHITECTURE.md).

> Piège Pages : une release déclenche parfois **2 déploiements Pages concurrents** qui
> s'annulent (`deploy-pages` échoue « try again later »). Fix : relancer seul —
> `gh workflow run pages.yml --repo umons-ig/Iot-RAMI`.

---

## 5. CI/CD

GitHub Actions, un workflow par module — tous **repo-agnostiques** (`${{ github.repository }}`) :

| Workflow | Rôle |
|---|---|
| `backend-ci.yml` / `frontend-ci.yml` / `fog-ci.yml` | lint → test → build+push GHCR (job `docker-push` sur `main`) |
| `firmware-release.yml` | build firmware + release + redeploy Pages (sur tag `v*`) |
| `pages.yml` | déploie le site Pages (accueil + flash) |
| `security.yml` | `npm audit`, Trivy, **gitleaks** (secret scan) |

Notes :
- Le job `docker-push` publie sur `push` vers `main` **et** sur `workflow_dispatch`
  (relance manuelle possible : `gh workflow run <workflow>.yml`). Les CI front/back/fog
  sont **filtrées par path** (`frontend/**`…) → un commit qui ne touche pas le module
  ne republie pas son image.
- **gitleaks** : on utilise le **binaire CLI** (MIT, libre) et non `gitleaks-action`,
  qui exige une licence payante dès qu'un repo appartient à une organisation.

---

## 6. Sécurité & secrets

- Aucun secret vivant dans le code. Les mots de passe applicatifs vivent dans les
  `.env` **sur les hôtes** (jamais commités).
- [`.gitleaksignore`](../.gitleaksignore) liste 19 findings **historiques obsolètes**
  (vieux mots de passe WiFi/MQTT de sketchs de test, réseaux/brokers morts). Ignorés
  **par empreinte** → tout *nouveau* secret reste détecté par la CI.
- Si un jour un vrai secret est commité par erreur : **le tourner** (changer la valeur
  réelle) est la seule vraie remédiation — le repo est public, l'historique est
  définitivement exposé.
- Auth backend : JWT access (15 min) + refresh token (7 j, cookie HttpOnly).
  Limitation de débit globale, plus un limiteur **par surface d'authentification**
  (`/auth`, `/users/login`, `/users/signup` ont chacun leur compteur — un seul
  limiteur partagé permettrait d'en saturer un pour bloquer les autres).
  Changer son mot de passe **révoque** les sessions ouvertes ailleurs.
- **Un audit de sécurité complet a été mené le 07/08/2026** :
  [`AUDIT_SECURITE.md`](AUDIT_SECURITE.md). À lire avant de toucher au contrôle
  d'accès — il documente les failles corrigées (dont une critique : le canal
  WebSocket contournait entièrement l'autorisation), la façon dont elles ont été
  vérifiées, et surtout les **pièges à ne pas réintroduire**.
- **Compte de démo** : le seeder crée un admin dont le mot de passe est public
  (hash committé). Il se saute désormais en production, mais **ne supprime pas un
  compte déjà créé** : à vérifier sur l'instance en service (requête SQL dans le
  [README](../README.md#comptes-de-test-seed)).

---

## 7. Gaps ouverts (à reprendre)

### Sécurité — trois chantiers d'infrastructure

Aucun n'est un oubli : chacun demande une opération coordonnée, pas un correctif
de code. Détail et arbitrages dans [`AUDIT_SECURITE.md`](AUDIT_SECURITE.md) §4.

- **HTTPS** : pas encore de reverse-proxy TLS (attend un nom de domaine — Traefik
  ou Caddy). Les JWT circulent en clair d'ici là.
- **Kafka `:9092` en PLAINTEXT** : le port doit rester joignable par le fog
  distant, donc on ne peut pas le fermer sans couper la collecte. **Action
  immédiate à coût nul** : `ufw allow from <IP_FOG> to any port 9092 && ufw deny
  9092` sur la VM. Le chiffrement ensuite : le code lit déjà `KAFKA_SSL` et
  `KAFKA_SASL_*` des deux côtés, et le compose a le bloc SASL_SSL prêt en
  commentaire — c'est de la configuration, pas du développement.
- **MQTT sans TLS ni ACL** : le TLS est **implémenté et compilé** (environnement
  `universal_tls`), mais désactivé — la bascule doit être simultanée broker + fog
  + capteurs. L'ACL par topic suppose un compte Mosquitto par appareil : **à
  décider avant de flasher le parc**, après cela coûte un repassage sur chacun.
  Cf. [`FIRMWARE_DEPLOYMENT.md`](FIRMWARE_DEPLOYMENT.md) §8.

### Autres

- **Tests E2E / charge** : non implémentés (Cypress/Playwright, k6/Artillery). Base de
  test de charge existante : [`LOAD_TEST.md`](LOAD_TEST.md).
- **Seuils (thresholds)** : pas de tests unitaires contrôleur/routes, et routes non
  documentées dans [`API.md`](API.md).
- Suivi/idées d'amélioration : [`PLAN_AMELIORATIONS.md`](PLAN_AMELIORATIONS.md),
  [`IMPROVEMENTS.md`](IMPROVEMENTS.md), état des lieux daté : [`ETAT_DES_LIEUX.md`](ETAT_DES_LIEUX.md).

---

## 8. Pour aller plus loin

| Sujet | Doc |
|---|---|
| Protocole MQTT capteurs | [`MQTT.md`](MQTT.md) |
| Format des messages Kafka | [`KAFKA.md`](KAFKA.md) |
| API REST (Swagger : `/api/v1/docs`) | [`API.md`](API.md) |
| Firmware (archi + déploiement) | [`FIRMWARE_ARCHITECTURE.md`](FIRMWARE_ARCHITECTURE.md), [`FIRMWARE_DEPLOYMENT.md`](FIRMWARE_DEPLOYMENT.md) |
| Persistance fog (store-and-forward) | [`FOG_PERSISTENCE.md`](FOG_PERSISTENCE.md) |
| Multi-protocole / Zigbee | [`MULTI_PROTOCOL_ZIGBEE.md`](MULTI_PROTOCOL_ZIGBEE.md), [`MQTT_HOMEASSISTANT.md`](MQTT_HOMEASSISTANT.md) |
| Monitoring (Prometheus/Grafana) | [`MONITORING.md`](MONITORING.md) |
| Sauvegarde & rollback | [`BACKUP_AND_ROLLBACK.md`](BACKUP_AND_ROLLBACK.md) |
| Démo | [`DEMO.md`](DEMO.md) |
| Rapport de stage | [`RAPPORT.md`](RAPPORT.md) |

---

*Projet initié dans le cadre d'un stage (UMONS). Migré vers l'organisation `umons-ig`
en juillet 2026. Pour l'historique fin, voir les commits et les autres docs de `docs/`.*
