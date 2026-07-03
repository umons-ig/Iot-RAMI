import sys
import argparse
from brokerInformator import BrokerInformator
from mqttConnector import MqttConnector
from constants import MqttAppConstants
from mode.sensorMode import SensorMode
from mode.serverMode import ServerMode
from mode.clientMode import WebClientModeOverHivemq

class MqttCliApp:

    @staticmethod
    def print_usage():
        print("""Voici ce que fait ce programme:
              1) Simuler un capteur
              2) Simuler un serveur
              3) Simuler les deux
              4) Dans une moindre mesure simuler un client sur websockets over mqtt""")
        print("\n===> Utilisation dans le terminal: ./run_mqttCliApp.sh [mode] [broker] <===")
        print("|=> [mode]: {}".format(MqttAppConstants.get_modes()))
        print("|=> [broker]: {}".format(MqttAppConstants.get_brokers()))
        print("|=> Options: --topic <topic> --rate <int> --types <type1> <type2> ...")

    @staticmethod
    def parse_args():
        parser = argparse.ArgumentParser(description='MQTT CLI App')
        parser.add_argument('mode', choices=MqttAppConstants.get_modes())
        parser.add_argument('broker', choices=MqttAppConstants.get_brokers())
        parser.add_argument('--topic', type=str, help='Topic for communication (without -topic suffix)', default=None)
        parser.add_argument('--rate', type=int, help='Number of data per second', default=None)
        parser.add_argument('--types', nargs='+', help='Measurement types (e.g. temperature humidity)', default=None)
        return parser.parse_args()

    @staticmethod
    def setup_mqtt_service(specified_broker):
        broker_info = BrokerInformator.get_broker(specified_broker)
        mqtt_service = MqttConnector(broker_info)
        mqtt_service.connect_broker()
        return mqtt_service

    @staticmethod
    def start():
        mqtt_service = None
        current_user_mode = None
        args = None
        try:
            args = MqttCliApp.parse_args()
            mode = args.mode
            specified_broker = args.broker
            mqtt_service = MqttCliApp.setup_mqtt_service(specified_broker)

            if mode == MqttAppConstants.MODE_SENSOR:
                current_user_mode = SensorMode(mqtt_service, topic=args.topic, rate=args.rate, types=args.types)
                current_user_mode.run()
            elif mode == MqttAppConstants.MODE_SERVER:
                current_user_mode = ServerMode(mqtt_service, topic=args.topic)
                current_user_mode.run()
            elif mode == MqttAppConstants.MODE_WSS_CLIENT_OVER_MQTT:
                current_user_mode = WebClientModeOverHivemq(mqtt_service)
                current_user_mode.run()
            else:
                print("Invalid mode. Please use a mode in {}.".format(MqttAppConstants.get_modes()))
                sys.exit(1)

        except KeyboardInterrupt:
            if current_user_mode and isinstance(current_user_mode, SensorMode):
                print("\nSending stop command...")
                current_user_mode.publish_message(
                    current_user_mode.topic_for_hearing_from_sensor,
                    MqttAppConstants.MSG_CMD,
                    MqttAppConstants.COMMAND_STOP
                )
            if mqtt_service:
                mqtt_service.disconnect_broker()
            print('Interrupted')

if __name__ == "__main__":
    MqttCliApp.start()