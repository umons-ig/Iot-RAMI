import json
import random
import time
import datetime
from constants import MqttAppConstants
from mode.mode import Mode

class SensorMode(Mode):
    def __init__(self, mqtt_service, topic=None, rate=None, types=None):
        super().__init__(mqtt_service, topic=topic)
        self.mqtt_service.client.on_message = self.on_message_for_sensor
        # Interaction with user (skipped if args provided)
        number_of_values_per_second = rate if rate is not None else self.ask_for_integer("How many data per second do you want to send: ")
        self.measurement_type_list = types if types is not None else self.ask_for_measurement_type()
        # sensor attribute
        self.time_sleep_beetween_two_values = 1/number_of_values_per_second
        self._allow_to_publish = False

    ### Getter and setter for publishing

    @property
    def allow_to_publish(self):
        return self._allow_to_publish

    @allow_to_publish.setter
    def allow_to_publish(self, value):
        self._allow_to_publish = value

    def ask_for_integer(self, prompt):
        while True:
            try:
                value = int(input(prompt))
                if (value <= 0):
                    raise ValueError
                return value
            except ValueError:
                print("{} is not a valid number.".format(value))


    def ask_for_measurement_type(self):
        measurement_list = []
        measurement_type = input("What is the measurement type of the values you want to send? (e.g. temperature, humidity, etc.): ").strip().lower()
        while measurement_type != "n":
            measurement_list.append(measurement_type)
            measurement_type = input("What is the measurement type of the values you want to send? (e.g. temperature, humidity, etc.) (type n to stop): ").strip().lower()
        return measurement_list
            
    def run(self):
        self.mqtt_service.subscribe_topic(self.topic_for_hearing_from_server)
        print("Sensor mode activated. Sending PING and START to fog...")
        self.mqtt_service.client.loop_start()

        self.publish_message(self.topic_for_hearing_from_sensor, MqttAppConstants.MSG_CMD, MqttAppConstants.COMMAND_PING)
        self.publish_message(self.topic_for_hearing_from_sensor, MqttAppConstants.MSG_CMD, MqttAppConstants.COMMAND_START)

        last_ping = time.time()
        last_start = time.time()

        while True:
            now = time.time()

            if now - last_ping >= 20:
                self.publish_message(self.topic_for_hearing_from_sensor, MqttAppConstants.MSG_CMD, MqttAppConstants.COMMAND_PING)
                last_ping = now

            if not self.allow_to_publish and now - last_start >= 30:
                self.publish_message(self.topic_for_hearing_from_sensor, MqttAppConstants.MSG_CMD, MqttAppConstants.COMMAND_START)
                last_start = now

            if self.allow_to_publish:
                self.publish_measures(self.topic_for_hearing_from_sensor)
                time.sleep(self.time_sleep_beetween_two_values)
            else:
                time.sleep(0.1)
    
    def publish_value(self, topic, value):
        self.publish_message(topic, MqttAppConstants.MSG_VALUE, value)

    def publish_answer_to_server_command(self, topic, answer):
        self.publish_message(topic, MqttAppConstants.MSG_ANS, answer)

    def publish_measures(self, topic):
        timestamp = time.time()
        microseconds_timestamp = int(time.time() * 1e6) # BECAUSE WE WANT MICROSECONDS whereas time.time() return is 1720733625.1637602 seconds
        timestamp_readable = datetime.datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S.%f')
        
        message = json.dumps({
            "timestamp": microseconds_timestamp,
            "measures":[
                {"measureType": mt , "value": random.randint(1, 100)/100} for mt in self.measurement_type_list
            ]
        })
        self.mqtt_service.client.publish(topic, message)
        print(">>>>[{}]: sending {} at {}".format(topic, message, timestamp_readable))
        
    
    def interact_with_received_command(self, received_value):
        if received_value == MqttAppConstants.COMMAND_STOP:
            self.allow_to_publish = False
            print("Received STOP from fog, stopping publication.")

    def interact_with_received_answer(self, received_value):
        if received_value == MqttAppConstants.COMMAND_ACK:
            self.allow_to_publish = True
            print("Received ACK from fog, starting publication.")

    def on_message_for_sensor(self, client, userdata, message):
        received_json = json.loads(message.payload.decode())
        if MqttAppConstants.MSG_CMD in received_json:
            self.interact_with_received_command(received_json[MqttAppConstants.MSG_CMD])
        elif MqttAppConstants.MSG_ANS in received_json:
            self.interact_with_received_answer(received_json[MqttAppConstants.MSG_ANS])
