class MqttAppConstants:
    ############################### ALL CONSTANTS MUST BE DECLARED HERE AND UPDATED WHEN NECESSARY ###########################
    #################################### ADD a new mode, broker or command when necessary ####################################

    ######## Mode
    # if you add a new mode here which is quite unlikely to happen, you need to add a new mode in mode in the mode folder and update get_modes
    MODE_SENSOR = "sensor"
    MODE_SERVER = "server"
    MODE_WSS_CLIENT_OVER_MQTT = "client" # YOU NEED TO USE BROKER THAT SUPPPORTS WeSockets over MQTT (like hivemq)

    ######## Available broker 
    # if you add a new broker here, please complete brokerInformator.py and update get_brokers
    LOCAL = "local"
    MOSQUITTO = "mosquitto"
    HIVEMQ = "hivemq"
    MARTIN_HIVEMQ = "martin_hivemq"
    WEBSOCKET_HIVEMQ = "wss_over_hivemq"

    ####### Topic duplication
    # Topic duplication in order to allow 1:1 communication beetween the sensor and the servor
    # A broker node cannot be both published and subscribed to the same topic. Every time it spoke on the topic,
    # it would receive his own message; this can go on forever... So I duplicated the topic into two “sub branches”.
    # A branch on which one listens and the other speaks and vice versa.

    # Example: sensor wants to listen to what the servor has to said so that it can receive its commands => How to procede ?
    # Just ask yourself, from who you want to gather data from. From the servor? alright subscribe to HEARING_FROM_SERVER and speak
    # and the other (and vice versa)

    HEARING_FROM_SENSOR =  "/sensor"
    HEARING_FROM_SERVER =  "/server"

    ####### Servor commands
    # Servor command for controlling the sensor
    # if you add a new command here, you need to update both sensorMode.py and servorMode.py =>
    # Indeed, the sensor must be able to process the new command and the server must be able to send it ! Also update get_commands
    COMMAND_PING = "ping"
    COMMAND_START = "start"
    COMMAND_STOP = "stop"
    COMMAND_ACK = "ack"

    ####### Sensor answers
    # The sensor answeres the server command
    PING_RESPONSE = "pong"                                    # Means the sensor is online
    PING_RESPONSE_WHEN_ALREADY_PUBLISHING = "pong.publishing" # Means the sensor is online but already publishing
    START_RESPONSE = "start.publishing"                       # Means the sensor has started to publish
    STOP_RESPONSE = "stop.publishing"                         # Means the sensor has stopped the publication of values

    ###### Message fields,
    # ----- SERVER
    # always sends {timestamp: time, cmd: command}
    # ----- SENSOR
    # 1) answers command server {timestamp: time, ans: answer}
    # OR 
    # 2) sends time series values, a json {timestamp: time, value: val} 
    MSG_TIMESTAMP = "timestamp"
    MSG_CMD = "cmd"
    MSG_ANS = "ans"
    MSG_VALUE = "value"
   
    @staticmethod
    def get_modes():
        return [MqttAppConstants.MODE_SENSOR, MqttAppConstants.MODE_SERVER, MqttAppConstants.MODE_WSS_CLIENT_OVER_MQTT]
    
    @staticmethod
    def get_brokers():
        return [MqttAppConstants.LOCAL, MqttAppConstants.MOSQUITTO, MqttAppConstants.HIVEMQ, MqttAppConstants.MARTIN_HIVEMQ, MqttAppConstants.WEBSOCKET_HIVEMQ]
    
    @staticmethod
    def get_commands(): # Only send by the server
        return [MqttAppConstants.COMMAND_PING, MqttAppConstants.COMMAND_START, MqttAppConstants.COMMAND_STOP]
    
    @staticmethod
    def get_response(): # Only send by the sensor
        return [MqttAppConstants.PING_RESPONSE, MqttAppConstants.PING_RESPONSE_WHEN_ALREADY_PUBLISHING, MqttAppConstants.START_RESPONSE, MqttAppConstants.STOP_RESPONSE]
    
    @staticmethod
    def get_full_topic_name(current_user_topic, who_to_hear_from):
        # As mentioned earlier, we apply the principle of topic duplication but obviously, we need a base topic
        return current_user_topic + who_to_hear_from
