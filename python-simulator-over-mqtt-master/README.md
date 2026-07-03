# MQTT CLI Application
Cette application permet de simuler un capteur IoT qui communique avec le fog via MQTT (architecture RAMI 1.0).

## Prérequis
Avant de commencer, assurez-vous d'avoir installé les éléments suivants sur votre machine :
- Python 3.x
- pip (gestionnaire de paquets Python)


## Installation des dépendances
```bash
pip install -r requirements.txt
```

## Utilisation

### Wifi
Le wifi de l'UMONS bloque les connexions aux brokers externes. Utilisez le partage de connexion de votre téléphone.

### Lancement

0. SI SOUS LINUX: Rendre le script exécutable
```bash
chmod +x run_mqttCliApp.sh
```

1. Mode interactif (le script pose les questions) :
```bash
python3 ./mqttCliApp.py sensor hivemq
```

2. Mode direct (tout en arguments, démarre immédiatement) :
```bash
python3 ./mqttCliApp.py sensor hivemq --topic esp32-dht22 --rate 1 --types temperature humidity
```

Arguments disponibles :
- `--topic` : nom du topic de base (sans le suffixe `-topic`)
- `--rate` : nombre de valeurs par seconde
- `--types` : liste des types de mesures (ex: `temperature humidity ecg`)

3. Pour simuler un serveur (envoie des commandes manuellement) :
```bash
python3 ./mqttCliApp.py server hivemq
```

4. Pour tester la connexion WebSocket :
```bash
python3 ./mqttCliApp.py client hivemq
```

## Protocole de communication (architecture fog)

Le simulateur reproduit le comportement d'un capteur ESP32 réel :

```
Démarrage  → Envoie { cmd: "ping" } + { cmd: "start" } au fog
Fog        → Répond { ans: "ack" } → le capteur commence à publier les mesures
En cours   → Envoie { measures: [...], timestamp: ... } périodiquement
             Envoie { cmd: "ping" } toutes les 20s (keepalive)
             Renvoie { cmd: "start" } toutes les 30s si pas encore ack
Fog        → Peut envoyer { cmd: "stop" } → arrêt de la publication
Ctrl+C     → Envoie { cmd: "stop" } au fog avant de quitter
```

## Format des messages publiés

```json
{
  "timestamp": 1720733625163760,
  "measures": [
    { "measureType": "temperature", "value": 0.42 },
    { "measureType": "humidity", "value": 0.76 }
  ]
}
```

## Recueil des données

À la sortie (Ctrl+C), le script envoie automatiquement un STOP au fog puis propose de sauvegarder les échanges dans un fichier Excel (dossier `results/`).

## Contribution

### Ajouter un broker
Compléter `brokerInformator.py` avec les infos : url, port, username, password, tls, ws. Mettre à jour `get_brokers()` dans `constants.py`.

### Ajouter un mode
1. Définir la constante dans `constants.py` et mettre à jour `get_modes()`
2. Créer un fichier dans `mode/` héritant de `Mode` et implémentant `run()`
3. Ajouter le cas dans `MqttCliApp.start()`
