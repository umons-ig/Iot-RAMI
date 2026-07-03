# Fog Service

Service de nœud fog pour RAMI. Tourne sur un Raspberry Pi et fait le pont entre les capteurs ESP32 (via MQTT/Mosquitto) et le backend cloud (via Kafka).

## Architecture

```
ESP32 → Mosquitto (local) → fog-service → Kafka (cloud) → backend
```

## Prérequis

- Raspberry Pi avec Raspberry Pi OS (Debian)
- Accès SSH
- Connexion internet

## 1. Flash du Raspberry Pi

Utilise **Raspberry Pi Imager** pour flasher la carte SD.

Dans les **options avancées** (icône engrenage) :
- **Hostname** : `rami-fog` ← important pour mDNS (`rami-fog.local`)
- **SSH** : activer avec clé publique ou mot de passe
- **WiFi** : configurer si nécessaire

> Le hostname défini ici sera broadcasté automatiquement par Avahi (mDNS) sous `rami-fog.local` sur le réseau local.

## 2. Installation

Se connecter en SSH sur le Pi, puis lancer le script d'installation :

```bash
wget https://raw.githubusercontent.com/GaspardMenou/Iot-RAMI/main/fog-service/install.sh 
chmod +x install.sh
sudo ./install.sh
```

Le script va :
1. Installer Docker si absent
2. Créer les dossiers Mosquitto
3. Télécharger `compose.yaml` et `mosquitto.conf` depuis le repo
4. Demander les credentials MQTT et l'adresse du broker Kafka
5. Générer le fichier de mots de passe Mosquitto
6. Écrire le fichier `.env`
7. Démarrer les services Docker
8. Mettre à jour le système (`apt update && apt upgrade`)
9. Redémarrer le Pi

### Variables demandées

| Variable | Exemple | Description |
|----------|---------|-------------|
| MQTT username | `fog1` | Utilisateur Mosquitto |
| MQTT password | `motdepasse` | Mot de passe Mosquitto |
| Kafka broker | `mondomaine.com:9092` | Adresse du broker Kafka cloud |

## 3. Services Docker

| Service | Description |
|---------|-------------|
| `mosquitto` | Broker MQTT local (port 1883) |
| `fog-service` | Bridge MQTT → Kafka |
| `watchtower` | Mise à jour automatique des images (poll 300s) |

## 4. mDNS

Le Pi s'annonce automatiquement comme `rami-fog.local` via Avahi (installé par défaut sur Raspberry Pi OS).

Les ESP32 peuvent utiliser `rami-fog.local` comme adresse du broker MQTT dans le portail captif.

## 5. Mise à jour

Watchtower surveille l'image `fog-service` et la met à jour automatiquement dès qu'une nouvelle version est publiée sur GHCR.

Pour forcer une mise à jour manuelle :

```bash
docker compose pull && docker compose up -d
```
