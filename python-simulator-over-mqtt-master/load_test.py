import subprocess
import sys
import os
import time
import argparse

def parse_args():
    parser = argparse.ArgumentParser(description='MQTT Load Test')
    parser.add_argument('--sensors', type=int, help='Number of sensor instances to run', default=1) 
    parser.add_argument('--rate', type=int, help='Number of messages per second per sensor', default=10)
    parser.add_argument('--duration', type=int, help='Duration of the load test in seconds', default=60)
    parser.add_argument('--types', type=str, help='Types of measurements to simulate', default='ecg')
    parser.add_argument('--broker', type=str, help='Broker to connect to (e.g. hivemq, emqx)', default='local')
    return parser.parse_args()

def main():
    args = parse_args()
    sensor_processes = []
    
    script = os.path.join(os.path.dirname(__file__), 'mqttCliApp.py')
    for i in range(args.sensors):
        p = subprocess.Popen([sys.executable, script, 'sensor', args.broker,'--topic', f'load-test-{i}', '--rate', str(args.rate), '--types'] + args.types.split())
        sensor_processes.append(p)
    print(f"Started {args.sensors} sensor instances. Running load test for {args.duration} seconds...")
    
    try:
        time.sleep(args.duration)
    except KeyboardInterrupt:
        print("Load test interrupted. Terminating sensor processes...")
    finally:        
        for p in sensor_processes:
            p.terminate()
        print("All sensor processes terminated.")

if __name__ == "__main__":    
    main()