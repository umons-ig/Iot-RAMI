# Firmware ESP32 — flash, configuration, OTA & gestion

Guide **opérationnel** du sous-système firmware de RAMI : un firmware unifié, un
flash navigateur, une console de configuration/test, et des mises à jour OTA
pilotées par le fog. *(Conception détaillée : [`FIRMWARE_ARCHITECTURE.md`](FIRMWARE_ARCHITECTURE.md).)*

## 1. Firmware unifié (`Arduino/ESP32/RamiFirmware`)

Un **seul** firmware pour tous les capteurs. Les drivers (`ISensor`) sont
sélectionnés **au build** (`-D ENABLE_*`) ou **au runtime** (env `universal` +
liste choisie au portail/console). Capteurs : `dht22, bmp280, ad8232, hcsr04,
mr60bha2, max30102, mlx90614, gsr, pir, bh1750, contact, sgp30`.

Build local : `pio run -e <env>` (envs : `dht22`, `medical`, `domotique`,
`universal`, …). Partition `min_spiffs` (2 slots app ⇒ OTA possible). Le binaire
`universal` complet ≈ 1,1 Mo (≈ 57 % d'un slot de 1,9 Mo).

## 2. Flasher (USB, navigateur)

Page **GitHub Pages** : <https://gaspardmenou.github.io/Iot-RAMI/flash/> (ESP Web
Tools / Web Serial — **Chrome/Edge/Opera**, HTTPS).

- **Sélecteur de version** (N dernières releases, bundlées sur Pages par la CI) +
  **changelog** (notes de release GitHub).
- Bouton **Installer** : écrit l'**image complète** (factory) → **efface** la NVS
  (config). Normal pour un 1ᵉʳ flash / une récupération.
- ⚠️ Pas de « mise à jour » en USB : ESP Web Tools **efface toujours** (sans
  Improv-Serial). La MAJ sans perte se fait **par OTA** (voir §4).

Au 1ᵉʳ boot, l'ESP démarre un **portail captif** (AP `RAMI-Setup`, non bloquant)
pour la config. Maintenir **BOOT/GPIO0** au démarrage réinitialise les réglages.

## 3. Configurer & tester (console USB)

Page <https://gaspardmenou.github.io/Iot-RAMI/console/> (Web Serial) ↔ console
**série JSON** du firmware. Permet, sans IDE :

- **info** : version, nom, capteurs, pins, IP, état WiFi ;
- **set_wifi / set_mqtt / set_name / set_sensors / set_pins** : persistés en NVS ;
- **read** : lecture **live** des capteurs (test) ;
- **ota** : déclenche une mise à jour (voir §4) ;
- **restart**.

Les capteurs/pins sont pris en compte après **redémarrage**. Pins configurables
pour les capteurs GPIO (les I²C utilisent le bus standard).

## 4. Mises à jour OTA (sans perdre la config)

L'OTA ne réécrit que l'**app** (partition OTA) → bootloader + **NVS (config)
préservés**. L'ESP télécharge le binaire app depuis **GitHub Pages** (HTTPS direct,
fiable) et redémarre.

- **Manuelle (console)** : carte *Mise à jour firmware (OTA)* → choisir une version
  → l'ESP se met à jour par WiFi.
- **Automatique (fog, opt-in)** : le fog interroge les **GitHub Releases**, suit la
  **version de chaque ESP** (rapportée dans le PING) et n'envoie l'OTA **qu'aux
  appareils en retard**. Aucune version à fixer dans le `.env`.

> **Bootstrap** : la 1ʳᵉ version OTA-capable est **v1.2.7** (OTA HTTPS + handler
> série) ; **v1.2.8** ajoute le report de version au ping (requis pour l'auto-OTA
> par appareil). Un ESP plus ancien doit être amené à v1.2.8 une fois (USB ou OTA
> console), ensuite tout est automatique.

## 5. Web server de gestion du fog (`:9200`)

Le fog expose une console de gestion (liste des ESP, état du fog, commandes
OTA/WiFi/MQTT/restart à un ou tous les ESP).

- **Bind** : `MGMT_BIND` (défaut `127.0.0.1` → tunnel SSH ; `0.0.0.0` → LAN).
- **Auth** : `MGMT_PASSWORD` (login → session) et/ou `MGMT_TOKEN` (header
  `X-Mgmt-Token`, pour scripts). **Obligatoire** dès que c'est exposé.
- Accès localhost : `ssh -L 9200:localhost:9200 pi@<pi>` puis `http://localhost:9200`.

## 6. CI/CD — release automatique

`git tag vX.Y.Z && git push origin vX.Y.Z` déclenche `firmware-release.yml` :
build PlatformIO → `.bin` + factory bin (`esptool merge_bin`) → **GitHub Release**
(notes auto) → redéploiement **GitHub Pages** (flash + versions). Flash & OTA
servent alors la nouvelle version **automatiquement**.

## 7. Variables d'environnement du fog (`.env`)

| Variable | Rôle | Défaut |
|----------|------|--------|
| `MQTT_USERNAME` / `MQTT_PASSWORD` | broker (doit matcher les ESP) | — |
| `KAFKA_BROKERS` | Kafka cloud | — |
| `MGMT_PASSWORD` | mot de passe admin (login console) | *(vide)* |
| `MGMT_TOKEN` | secret statique (scripts/API) | *(vide)* |
| `MGMT_BIND` | interface d'écoute `:9200` | `127.0.0.1` |
| `FIRMWARE_OTA_ENABLED` | auto-OTA par appareil | `false` |
| `FIRMWARE_REPO` / `FIRMWARE_ENV` | dépôt / env du binaire | `GaspardMenou/Iot-RAMI` / `universal` |
| `FIRMWARE_POLL_INTERVAL_MS` | fréquence de check des releases | `3600000` |
| `PG_USER` / `PG_PASSWORD` / `PG_DATABASE` | outbox Postgres | `fog` / `fog` / `fog_outbox` |

> `FIRMWARE_VERSION` n'est **plus nécessaire** (le fog suit la version par ESP).

## 8. Sécurité (état)

- Console de gestion : auth (token/mot de passe) + bind localhost par défaut.
- OTA : **HTTPS** vers GitHub Pages (`setInsecure` pour l'instant — durcissement
  prévu : bundle CA + binaire **signé**).
- Watchdog matériel désactivé le temps du flash OTA (évite un reset en plein
  téléchargement).
