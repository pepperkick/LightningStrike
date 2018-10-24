import MQTT from 'mqtt';
import debug from "debug";
import { EventEmitter } from 'events';

const log = debug("app:module:mqtt");

export default (app) => {
    const mqtt = MQTT.connect(`mqtt://${app.config.services.mqtt.ip}`);
    const pending = [];

    let ready = false;

    mqtt.on('connect', () => {
        log('Connected!');

        ready = true;

        publishPending();

        app.emit('mqtt-connect', {})
    });

    mqtt.on('message', (topic, message) => {
        // log(`Message from ${topic}: ${message.toString()}`);

        app.emit(`mqtt-${topic}`, message.toString());
    });

    function publishPending() {
        for (let i in pending) {
            const data = pending[i];

            publish(data.topic, data.message);
        }
    }

    function subscribeList(topics) {
        if (!ready) return;

        for (let i in topics) {
            subscribe(topics[i]);
        }
    }

    function subscribe(topic) {
        mqtt.subscribe(topic);
        log(`Subscribed to topic ${topic}`);
    }

    function publish(topic, message) {
        if (!ready) {
            pending.push({
                topic,
                message
            })
        } else {
            // log(`Message to ${topic}: ${message}`);
            mqtt.publish(topic, message)
        }
    }

    return {
        subscribe,
        subscribeList,
        publish
    }
}