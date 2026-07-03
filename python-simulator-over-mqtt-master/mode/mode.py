import json
import time
import datetime

from constants import MqttAppConstants
from abc import ABC, abstractmethod

class Mode(ABC):
    def __init__(self, mqtt_service, topic=None):
        self.mqtt_service = mqtt_service
        self.mqtt_service.client.on_message = self.on_message_for_mode

        if topic is None:
            topic = input("Enter topic used for communication (between sensor and server): \n")
        self.topic_for_hearing_from_sensor = MqttAppConstants.get_full_topic_name(topic, MqttAppConstants.HEARING_FROM_SENSOR)
        self.topic_for_hearing_from_server = MqttAppConstants.get_full_topic_name(topic, MqttAppConstants.HEARING_FROM_SERVER)

        self.time_value_pairs = []

    def publish_message(self, topic, mode, cmdOrValueOrAns):
        # This function takes care of message publication FOR ALL MODES (sensor and server)
        # --> Remember that the server sends messages of type: {"timestamp": 1720985647.210731, "cmd": "ping"}
        # --> the sensor sends commands of type: {"timestamp": 1720985647.21071, "ans": "pong"} or {"timestamp": 1720985647.210731, "value": "74"}
        # Thus, this function is able to post either cmd, ans or value.
        # ------------- JSON FORMAT OF SENDED VALUES
        # 1) Get current UNIX timestamp (in seconds) with fractions of a second precision (example: 1720733625.1637602 seconds)
        timestamp = time.time()
        microseconds_timestamp = int(time.time() * 1e6) # BECAUSE WE WANT MICROSECONDS whereas time.time() return is 1720733625.1637602 seconds
        timestamp_readable = datetime.datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S.%f')
        
        message = json.dumps(
            {MqttAppConstants.MSG_TIMESTAMP:microseconds_timestamp,
             mode:cmdOrValueOrAns}
        )
        # ------------------------------------------
        # Ajoute les parties prores aux fils (ici, le serveur ajoute une commande et le serveur une commande)
        self.mqtt_service.client.publish(topic, message)
        self.add_time_value_pairs(timestamp_readable, cmdOrValueOrAns)
        print(">>>>[{}]: sending {} at {}".format(topic, message, timestamp_readable))

    def on_message_for_mode(self, client, userdata, messageContainingValueOrAnswerToCommand):
        # Ajoutez la valeur reçue à la liste
        timestamp = time.time()  # Obtenir le timestamp UNIX actuel with fractions of a second precision
        timestamp_readable = datetime.datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S.%f')
        message_string = messageContainingValueOrAnswerToCommand.payload.decode("utf-8")
        message_dict = json.loads(message_string)
        content_extraction = None
        if message_dict.get(MqttAppConstants.MSG_VALUE):
            content_extraction = message_dict[MqttAppConstants.MSG_VALUE]
        elif message_dict.get(MqttAppConstants.MSG_ANS):
            content_extraction = message_dict[MqttAppConstants.MSG_ANS]
        self.add_time_value_pairs(timestamp_readable, content_extraction)
        print("Received message: {} at {}".format(message_string, timestamp_readable))
        

    def add_time_value_pairs(self, time, cmdOrValueOrAns):
        # PLEASE BEAR IN MIND THAT WE DO NOT SAVE THE command sends by the server, we are only interest in the time delta
        # BEETWEN what the sensor SENDS and what the server RECEIVE !!!!!!!!
        if (cmdOrValueOrAns not in MqttAppConstants.get_commands()):
            self.time_value_pairs.append((time[11:], cmdOrValueOrAns))
    
    def get_all_times_values_interactions(self):
        return self.time_value_pairs
    

    @abstractmethod
    def run(self):
        pass


