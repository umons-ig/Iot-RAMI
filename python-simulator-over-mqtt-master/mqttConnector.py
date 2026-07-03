import paho.mqtt.client as mqtt
import random
import ssl
from brokerInformator import BrokerInformator
from datetime import datetime
import certifi

ssl.create_default_context(cafile=certifi.where())

class MqttConnector:

    def __init__(self, broker_info):
        # Gather All broker information from BrokerInformator
        self.broker_address = BrokerInformator.get_url(broker_info)
        self.port = BrokerInformator.get_port(broker_info)
        self.username = BrokerInformator.get_username(broker_info)
        self.password = BrokerInformator.get_password(broker_info)
        self.client_id = "python-client-{}".format(random.randint(1, 10**10))

        # Check if the connection should be over WebSockets        
        if BrokerInformator.get_ws(broker_info):
            self.client = mqtt.Client(client_id=self.client_id, transport="websockets")
        else:
            self.client = mqtt.Client(client_id=self.client_id)
        
        # Connect all events
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message

        # Set username and password if provided
        if self.username and self.password:
            self.client.username_pw_set(self.username, self.password)

            if BrokerInformator.get_tls(broker_info):
                self.client.tls_set(
                    ca_certs=certifi.where(),
                    cert_reqs=ssl.CERT_REQUIRED,
                    tls_version=ssl.PROTOCOL_TLS,
                )

    # ---------------------------------------------------- ALL EVENTS ----------------------------------------------------

    def on_connect(self, client, userdata, flags, rc):
        # Tell you if you are connected or not
        if rc == 0:
            print("Connected to MQTT Broker at {}! ".format(self.broker_address))
        else:
            print(f"Failed to connect, return code {rc}")

    def on_disconnect(self, client, userdata, rc):
        # Tell you when you are disconnected
        print("Disconnected from MQTT Broker")

    def on_message(self, client, userdata, message):
        # A
        received_value = message.payload.decode("utf-8")
        received_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        print("Received message: {} at {}".format(received_value, received_time))
        
        # SOME MODE CAN REDEFINIE THIS FUNCTION, if you see sensorMode and servorMode, they have their redefined version of this function

    # -------------------------------------------------- ALL MQTT METHODS --------------------------------------------------
    
    # connect and disconnect
    def connect_broker(self):
        self.client.connect(self.broker_address, self.port)

    def disconnect_broker(self):
        self.client.disconnect()

    # subcribe and unsubscribe
    def subscribe_topic(self, topic):
        self.client.subscribe(topic)
        print("Subscribed to topic:", topic)

    def unsubscribe_topic(self, topic):
        self.client.unsubscribe(topic)
        print("Unsubscribed from topic:", topic)
