import os

from constants import MqttAppConstants

# Optional .env loading: if python-dotenv is installed, load a local .env file so
# credentials never have to live in the source code. The simulator still works
# without python-dotenv (it just falls back to real environment variables).
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


# BrokerInformator class provides connection information for different MQTT brokers.
# SECURITY: no credential is hard-coded anymore. Usernames/passwords are read from
# environment variables (see .env.example). Hostnames have sensible defaults but can
# also be overridden via env vars.
class BrokerInformator:

    @staticmethod
    def get_broker(broker_name):
        # Returns broker information based on the provided broker name.
        if broker_name == MqttAppConstants.LOCAL:
            return BrokerInformator.local()
        elif broker_name == MqttAppConstants.MOSQUITTO:
            return BrokerInformator.mosquitto_org()
        elif broker_name == MqttAppConstants.HIVEMQ:
            return BrokerInformator.hivemq()
        elif broker_name == MqttAppConstants.MARTIN_HIVEMQ:
            return BrokerInformator.martin_hivemq()
        elif broker_name == MqttAppConstants.WEBSOCKET_HIVEMQ:
            # Here, the hivemq version allow us to do websocket over mqtt.
            return BrokerInformator.websocket_client_over_hivemq()
        else:
            raise ValueError("Invalid broker name")

    # Each broker method must return a dictionary with the same fields:
    # "url", "port", "username", "password", "tls" and "ws".

    @staticmethod
    def local():
        return {
            "url": os.getenv("LOCAL_MQTT_URL", "10.0.0.252"),
            "port": int(os.getenv("LOCAL_MQTT_PORT", "1883")),
            "username": os.getenv("LOCAL_MQTT_USERNAME"),
            "password": os.getenv("LOCAL_MQTT_PASSWORD"),
            "tls": False,
            "ws": False
        }

    @staticmethod
    def mosquitto_org():
        return {
            "url": "test.mosquitto.org",
            "port": 1883,
            "username": None,
            "password": None,
            "tls": False,
            "ws": False
        }

    @staticmethod
    def hivemq():
        # Do not forget about the secure version (tls)
        return {
            "url": os.getenv("HIVEMQ_URL", ""),
            "port": int(os.getenv("HIVEMQ_PORT", "8883")),
            "username": os.getenv("HIVEMQ_USERNAME"),
            "password": os.getenv("HIVEMQ_PASSWORD"),
            "tls": True,
            "ws": False
        }

    @staticmethod
    def martin_hivemq():
        # Do not forget about the secure version (tls)
        return {
            "url": os.getenv("MARTIN_HIVEMQ_URL", ""),
            "port": int(os.getenv("MARTIN_HIVEMQ_PORT", "8883")),
            "username": os.getenv("MARTIN_HIVEMQ_USERNAME"),
            "password": os.getenv("MARTIN_HIVEMQ_PASSWORD"),
            "tls": True,
            "ws": False
        }

    @staticmethod
    def websocket_client_over_hivemq():
        return {
            "url": os.getenv("HIVEMQ_URL", ""),
            "port": int(os.getenv("HIVEMQ_WS_PORT", "8884")),
            "username": os.getenv("HIVEMQ_USERNAME"),
            "password": os.getenv("HIVEMQ_PASSWORD"),
            "tls": True,
            "ws": True
        }

    @staticmethod
    def get_url(broker_info):
        return broker_info["url"]

    @staticmethod
    def get_port(broker_info):
        return broker_info["port"]

    @staticmethod
    def get_username(broker_info):
        return broker_info["username"]

    @staticmethod
    def get_password(broker_info):
        return broker_info["password"]

    @staticmethod
    def get_tls(broker_info):
        return broker_info["tls"]

    @staticmethod
    def get_ws(broker_info):
        return broker_info["ws"]
