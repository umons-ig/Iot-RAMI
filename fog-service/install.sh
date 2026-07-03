#!/bin/bash
set -e  # stop the script if any command fails

REPO_RAW="https://raw.githubusercontent.com/GaspardMenou/Iot-RAMI/main/fog-service"

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "🐳 Docker not found, installing..."
  curl -fsSL https://get.docker.com | sh
else
  echo "✅ Docker already installed"
fi

# 2. Create required directories
mkdir -p mosquitto/config mosquitto/data mosquitto/log
chmod -R 777 mosquitto/

# 3. Download compose and mosquitto config from the repo
echo "📥 Downloading configuration files..."
curl -fsSL "$REPO_RAW/compose.yaml" -o compose.yaml
curl -fsSL "$REPO_RAW/mosquitto/config/mosquitto.conf" -o mosquitto/config/mosquitto.conf

# 4. Ask for credentials
read -p "Enter MQTT username: " MQTT_USERNAME
read -s -p "Enter MQTT password: " MQTT_PASSWORD
echo
read -p "Enter Kafka broker (e.g. yourdomain.com:9092): " KAFKA_BROKERS

# 5. Generate Mosquitto passwd file
echo "🔐 Generating Mosquitto password file..."
docker run --rm \
  -v "$(pwd)/mosquitto/config:/mosquitto/config" \
  eclipse-mosquitto:latest \
  mosquitto_passwd -c -b /mosquitto/config/passwd "$MQTT_USERNAME" "$MQTT_PASSWORD"
chmod 644 mosquitto/config/passwd

# 6. Write .env file
echo "MQTT_USERNAME=$MQTT_USERNAME" > .env
echo "MQTT_PASSWORD=$MQTT_PASSWORD" >> .env
echo "KAFKA_BROKERS=$KAFKA_BROKERS" >> .env

# 7. Start services
echo "🚀 Starting services..."
docker compose up -d

sudo apt update 
sudo apt upgrade -y

echo "✅ Installation complete! et rédémarrage du système."

sudo reboot
