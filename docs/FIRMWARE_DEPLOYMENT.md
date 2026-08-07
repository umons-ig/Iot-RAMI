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

Page **GitHub Pages** : <https://umons-ig.github.io/Iot-RAMI/flash/> (ESP Web
Tools / Web Serial — **Chrome/Edge/Opera**, HTTPS).

- **Sélecteur de version** (N dernières releases, bundlées sur Pages par la CI) +
  **changelog** (notes de release GitHub).
- Bouton **Installer** : écrit l'**image complète** (factory) → **efface** la NVS
  (config). Normal pour un 1ᵉʳ flash / une récupération.
- ⚠️ Pas de « mise à jour » en USB : ESP Web Tools **efface toujours** (sans
  Improv-Serial). La MAJ sans perte se fait **par OTA** (voir §4).

Au 1ᵉʳ boot, l'ESP démarre un **portail captif** (AP `RAMI-Setup`, non bloquant)
pour la config. Maintenir **BOOT/GPIO0** au démarrage réinitialise les réglages.

> **Thèmes** : les pages statiques (flash, console, accueil) et la console de
> gestion du fog reprennent le **design system du cloud** (variables `--color-*`,
> polices Big Shoulders + Martian Mono) et offrent un **sélecteur de thème**
> *ambre* (défaut) / *vert* / *clair*, mémorisé par navigateur.

## 3. Configurer & tester (console USB)

Page <https://umons-ig.github.io/Iot-RAMI/console/> (Web Serial) ↔ console
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
- **Session sans état** : le jeton de login est **dérivé du mot de passe**
  (`sha256(sel + mot de passe)`), pas stocké en mémoire → il reste valable même
  quand le conteneur fog redémarre (mises à jour Watchtower) → plus de
  déconnexion « aléatoire ».
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
| `MQTT_URL` | `mqtt://…` ou `mqtts://…` pour le TLS | `mqtt://localhost` |
| `KAFKA_BROKERS` | Kafka cloud | — |
| `MGMT_PASSWORD` | mot de passe admin (login console) | *(vide → API fermée)* |
| `MGMT_TOKEN` | secret statique (scripts/API) | *(vide → API fermée)* |
| `MGMT_BIND` | interface d'écoute `:9200` | `127.0.0.1` |
| `METRICS_BIND` | adresse de publication des métriques `:9100` | `127.0.0.1` |
| `ALLOW_INSECURE_OTA` | autorise une URL OTA en `http://` (banc de test) | `false` |
| `FIRMWARE_OTA_ENABLED` | auto-OTA par appareil | `false` |
| `FIRMWARE_REPO` / `FIRMWARE_ENV` | dépôt / env du binaire | `umons-ig/Iot-RAMI` / `universal` |
| `FIRMWARE_POLL_INTERVAL_MS` | fréquence de check des releases | `3600000` |
| `PG_USER` / `PG_PASSWORD` / `PG_DATABASE` | outbox Postgres | `fog` / `fog` / `fog_outbox` |

> `FIRMWARE_VERSION` n'est **plus nécessaire** (le fog suit la version par ESP).

> **Mosquitto** : le broker **génère son fichier de mots de passe** depuis
> `MQTT_USERNAME`/`MQTT_PASSWORD` au démarrage (compose). Définis-les dans le
> `.env` avec **les mêmes valeurs que celles saisies au portail des ESP**, sinon
> le broker refuse l'auth (`rc=5 / not authorised`).
>
> ⚠️ Les anciens identifiants par défaut (`fog1`/`fog1password`) ont été
> **retirés du firmware** : ils étaient committés dans un dépôt public, donc
> connus de tous. Les champs du portail sont désormais vides et doivent être
> saisis. Conséquence pratique : le portail enregistre **ce que contiennent les
> champs au moment de la sauvegarde** — si tu le rouvres pour changer seulement
> le WiFi sans re-remplir les champs MQTT, tu écrases la configuration avec du
> vide et l'ESP ne se reconnecte plus. Remplis les quatre champs à chaque passage.

> ⚠️ Après modification du `.env`, **recrée** le conteneur (`docker compose up -d`
> recrée si l'image/conf change ; sinon `--force-recreate`) — un simple restart ne
> recharge pas les variables.

## 8. MQTT en TLS (optionnel, prêt à activer)

Par défaut le MQTT est **en clair** : mesures et identifiants circulent en clair
sur le LAN. Le firmware sait faire du TLS, il suffit de le compiler pour.

**Sur l'ESP** — flasher l'environnement `universal_tls` au lieu de `universal` :

```bash
pio run -e universal_tls
```

Il ajoute `-D RAMI_MQTT_TLS`, ce qui bascule `PubSubClient` sur
`WiFiClientSecure` et fait passer le port par défaut à **8883**. Avant de
flasher, coller le certificat de ton AC dans
`Arduino/ESP32/Common/src/MqttCaCert.hpp`. Tant qu'il est vide, le firmware
**refuse de se connecter** et l'explique sur la console série : chiffrer sans
vérifier l'identité du broker protégerait de l'écoute passive, mais pas de
l'usurpation — or c'est justement l'attaque qui permet de piloter un capteur.

Pour un essai rapide sans AC, ajouter `-D RAMI_MQTT_TLS_INSECURE` : le trafic
est chiffré, le certificat **n'est pas vérifié**, et un avertissement s'affiche à
chaque démarrage. À ne jamais laisser en service.

Coût mesuré : +0,8 % de RAM et +2,3 % de flash par rapport au binaire en clair.

**Sur le fog** — `MQTT_URL=mqtts://<hote>` et `MQTT_PORT=8883` ; `mqtt.js` gère
le schéma tout seul, aucun code à changer.

**Sur le broker** — ajouter un listener 8883 avec les certificats dans
`fog-service/mosquitto/config/mosquitto.conf`.

> ⚠️ La bascule doit être **simultanée** : le jour où le broker n'écoute plus
> qu'en 8883, un fog resté en `mqtt://` ne collecte plus rien.

Reste à faire pour aller au bout : **un compte Mosquitto par capteur** plus un
`acl_file`. Aujourd'hui tous les ESP partagent une identité, donc un capteur
compromis peut publier sur le topic `/server` d'un autre et lui envoyer une
commande `ota` ou `restart`. C'est le bon moment pour fixer la convention de
nommage — après le déploiement du parc, cela coûte un repassage sur chaque
appareil.

## 9. Sécurité (état)

- **Console de gestion** : *fail-closed*. Sans `MGMT_TOKEN` ni `MGMT_PASSWORD`,
  l'API `/api/*` refuse tout et le service le signale au démarrage. Le jeton de
  session est un HMAC sur clé dérivée par `scrypt`, avec expiration signée
  (12 h) ; le login est limité à 10 tentatives par quart d'heure.
- **OTA** : **HTTPS obligatoire** des deux côtés (le fog refuse de construire la
  commande, le firmware refuse de la traiter). Le certificat n'est en revanche
  **pas encore validé** (`setInsecure`). L'épinglage d'une racine a été écarté :
  la chaîne diffère selon l'hôte GitHub et tourne dans le temps, un CA figé
  casserait l'OTA de façon différée. La bonne réponse est l'intégrité — publier
  le SHA-256 du binaire dans la release, le transmettre via le fog (qui valide
  TLS correctement) et le vérifier sur l'ESP avant reboot.
- **Identifiants MQTT** : plus aucune valeur par défaut dans le firmware.
- **MQTT** : TLS disponible (cf. §8), désactivé par défaut ; pas encore d'ACL
  par topic.
- Watchdog matériel désactivé le temps du flash OTA (évite un reset en plein
  téléchargement).

Détail complet et arbitrages : [AUDIT_SECURITE.md](AUDIT_SECURITE.md).
