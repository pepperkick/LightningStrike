import five from 'johnny-five';
import debug from 'debug';
import sleep from 'async-sleep';
import clear from 'clear';
import inquirer from 'inquirer';
import fs from 'fs';
import net from 'net';
import request from 'request';
import Color from 'color';
import pythonBridge from 'python-bridge';
import Express from "express";
import IOT from "aws-iot-device-sdk";
import bodyParser from "body-parser";
import MQTT from 'mqtt';
import robot from 'robotjs';
import * as Vibrant from 'node-vibrant'
import EventEmitter from 'events';

import aura from '../build/Release/aura';
import logitech from '../build/Release/logitech';
import CueSDK from './devices/corsair';

import CorsairMap from "./devices/corsair/map"
import RazerMap from "./devices/razer/map"

import Rainbow from './effects/rainbow';
import Wave from './effects/wave';
import Walk from './effects/walk';
import Fire from './effects/fire';
import Water from './effects/water';
import Random from './effects/random';

import GPMDP from "./modules/gpmdp";
import PipeRazer from "./modules/pipe-razer"

import KEY from './objects/keys';

const LOGITECH_PIPE_PATH = "\\\\.\\pipe\\lightningstrike_logitech";
const log = debug('app');
const rain_path = 'C:\\Users\\abhis\\Documents\\Rainmeter\\Skins\\RGBToText\\@Resources\\band.txt';
const rain_size = 8192;
const cue = new CueSDK(`${__dirname}/../files/CUESDK_2015.dll`);
const python = pythonBridge();
const express = new Express();

const mqtt = MQTT.connect("mqtt://localhost");
const app = new EventEmitter();

app.express = express;
app.effect = changeEffect;
app.lightning = [];
app.keys = KEY;

const gpmdp = GPMDP(app);
const pipeRazer = PipeRazer(app);

let effectInterval;
let effectFlag = false;
let arduinoRGB;
let lastData = new Date();
let dominatingPipe = null;
let lastR, lastG, lastB;
let maxR = 0, maxG = 0, maxB = 0;
let board;
let rain_file;
let rain_lastR, rain_lastG, rain_lastB;
let rain_flag = false;
let lightFlag = true;

aura.Init();
logitech.Init();

aura.FindMbControllers();

express.use(bodyParser.json());
express.use(bodyParser.urlencoded({
    extended: true
})); 

setInterval(() => {
    if (maxR !== 0)
        maxR -= 1;
    if (maxG !== 0)
        maxG -= 1;
    if (maxB !== 0)
        maxB -= 1;
}, 2500);

if (!process.env.NO_ARDUINO) {
    board = new five.Board({
        port: 'COM3',
        repl: false
    });  
    
    board.on("ready", function() {  
        log("[ARDUINO] Ready!");  
        
        arduinoRGB = new five.Led.RGB({
            pins: [ 9, 10, 11 ],
            isAnode: true
        });

        arduinoRGB.on();
        
        init();

        this.on("exit", function() {
            arduinoRGB.off();

            log("[ARDUINO] Switched off!");  
        });
    });  
} else {
    init();
}

const query = () => {
    inquirer.prompt([
        {
            type: "list",
            name: "Options",
            message: "Select an Option",
            choices: [
                {
                    name: "Sync with Screen",
                    value: 'sync_screen'
                },
                {
                    name: "Sync with Audio",
                    value: 'sync_music'
                },
                {
                    name: "Rainbow Effect",
                    value: "effect_rainbow"
                },
                {
                    name: "Wave Effect",
                    value: "effect_wave"
                },
                {
                    name: "Walk Effect",
                    value: "effect_walk"
                },
                {
                    name: "Fire Effect",
                    value: "effect_fire"
                },
                {
                    name: "Water Effect",
                    value: "effect_water"
                },
                {
                    name: "Random Fill Effect",
                    value: "effect_random"
                },
                {
                    name: "Static: Off",
                    value: "static_off"
                },
                {
                    name: "Static: Red",
                    value: "static_red"
                },
                {
                    name: "Static: Green",
                    value: "static_green"
                },
                {
                    name: "Static: Blue",
                    value: "static_blue"
                },
                {
                    name: "Static: White",
                    value: "static_white"
                }
            ]
        }
    ])
    .then(answers => {
        changeEffect(answers.Options);

        query();
    });
}

setInterval(() => {
    if (new Date().getTime() - lastData.getTime() >= 30000) {
        if (!effectFlag) {       
            if (rain_flag) {
                rain_flag = false;
            }
    
            disableEffect();
            enableFire(app);
        }
    }
}, 30000);

function init() {
    enableFire(app);
    startPipes();    

    python.ex`import serial`;
    python.ex`import hue_plus.hue`;
    python.ex`ser = serial.Serial("COM4", 256000)`;

    log('Started!');
}

function startPipes() {
    app.on("pipe-razer", (values) => {
        if (effectFlag) {
            disableEffect();

            log(`Razer pipe disabled idle effect!`);
        }

        MapRazerKeys(values);

        setColorAll(
            0, 0, 0,
            {
                per_key: true,
                default_key: KEY.Q
            }
        );

        lastData = new Date();
    });

    const logitech = net.createServer((stream) => {
        stream.on('data', async (c) => {
            if (dominatingPipe && dominatingPipe !== 'logitech') return;
            else if (!dominatingPipe) dominatingPipe = 'logitech';

            const values = c.toString().split(' ');
            
            if (effectFlag) {
                disableEffect();

                log(`Logitech pipe disabled idle effect!`);
            }

            if (parseInt(values[0]) === 1 && parseInt(values[1]) === 0xFFF9) {
                // setColorAll(
                //     map(parseInt(values[2]), 0, 100, 0, 255),
                //     map(parseInt(values[3]), 0, 100, 0, 255),
                //     map(parseInt(values[4]), 0, 100, 0, 255)
                // );                
            }

            // log(c.toString());

            lastData = new Date();
        });
    });
    
    logitech.listen(LOGITECH_PIPE_PATH, () => {
        log('Logitech pipe Started!');
    });
 }

function setColorAll(r, g, b, o = {}) {
    if (!lightFlag) {
        const l = [];

        for (let i = 1; i <= 188; i++) {
            l.push([i, 0, 0, 0]);
        }

        cue.set(l, true);

        aura.SetMbColor(0, 0, 0, 0);

        python.ex`hue_plus.hue.fixed(ser, 0, 0, "000000")`;
        
        logitech.SetColor(0, 0, 0);

        return;
    }

    // if (!(o.per_key || o.corsair_per_key)) {
    //     if (lastR === r && lastG === g && lastB === b) return;
    // }

    lastR = r, lastG = g, lastB = b;

    if (!o.no_corsair) {
        const l = [];

        if (o.per_key || o.corsair_per_key) {
            for (let i = 1; i <= 188; i++) {
                const key = CorsairMap.Map[i];

                if (key && app.lightning[key]) {
                    l.push([i, app.lightning[key][0], app.lightning[key][1], app.lightning[key][2]]);
                } else {                 
                    l.push([i, 0, 0, 0]);
                }
            }
        } else {
            for (let i = 1; i <= 188; i++) {
                l.push([i, r, g, b]);
            }
        }

        cue.set(l, true);
    }

    if (!o.no_aura) {
        if (o.per_key) {
            if (o.default_key) {
                aura.SetMbColor(0, 
                    app.lightning[o.default_key][0], 
                    app.lightning[o.default_key][2], 
                    app.lightning[o.default_key][1]
                );
            } else {
                aura.SetMbColor(0, 
                    app.lightning[KEY.AURA][0], 
                    app.lightning[KEY.AURA][2], 
                    app.lightning[KEY.AURA][1]
                );
            }
        } else {
            if (o.bass_only) {
                aura.SetMbColor(0, r, 0, 0);
            } else {
                aura.SetMbColor(0, r, b, g);
            }
        }
    }

    if (!o.no_nzxt) {
        if (o.bass_only || o.nzxt_bass_only) {
            let c1 = "000000";
            let c2 = "000000";

            c1 = `${toHex(parseInt(r))}0000`;
            c2 = `${toHex(parseInt(r))}${toHex(parseInt(g))}${toHex(parseInt(b))}`;

            python.ex`hue_plus.hue.fixed(ser, 0, 1, ${c1})`
            python.ex`hue_plus.hue.fixed(ser, 0, 2, ${c2})`
        } else {
            let c = "000000";

            if (o.per_key) {
                if (o.default_key && !rain_flag) {
                    c = `${toHex(parseInt(app.lightning[o.default_key][0]))}${toHex(parseInt(app.lightning[o.default_key][1]))}${toHex(parseInt(app.lightning[o.default_key][2]))}`;         

                    // python.ex`hue_plus.hue.custom(ser, 0, 1, [ ${c} ], "fixed", 0)`;
                    python.ex`hue_plus.hue.fixed(ser, 0, 0, ${c})`   
                } else {
                    const c1 = [];
                    const c2 = [];

                    for (let i = 0; i < 20; i++) {
                        c1[i] = `${toHex(parseInt(app.lightning[KEY[`NZXT_1_${i+1}`]][0]))}${toHex(parseInt(app.lightning[KEY[`NZXT_1_${i+1}`]][1]))}${toHex(parseInt(app.lightning[KEY[`NZXT_1_${i+1}`]][2]))}`;
                        c2[i] = `${toHex(parseInt(app.lightning[KEY[`NZXT_2_${i+1}`]][0]))}${toHex(parseInt(app.lightning[KEY[`NZXT_2_${i+1}`]][1]))}${toHex(parseInt(app.lightning[KEY[`NZXT_2_${i+1}`]][2]))}`;
                    }
            
                    python.ex`hue_plus.hue.custom(ser, 0, 1, ${c1}, "fixed", 0)`
                    python.ex`hue_plus.hue.custom(ser, 0, 2, ${c2}, "fixed", 0)`
                }
            } else {
                c = `${toHex(parseInt(r))}${toHex(parseInt(g))}${toHex(parseInt(b))}`;

                // python.ex`hue_plus.hue.custom(ser, 0, 1, [ ${c} ], "fixed", 0)`;
                python.ex`hue_plus.hue.fixed(ser, 0, 0, ${c})`
            }
        }
    }

    if (!o.no_logitech) {
        if (o.logitech_boost) {
            if (r > maxR) maxR = r;
            if (g > maxG) maxG = g;
            if (b > maxB) maxB = b;

            logitech.SetColor(
                map(r, 0, maxR, 0, 94),
                map(g, 0, maxG, 0, 94),
                map(b, 0, maxB, 0, 94)
            );
        } else {
            if (o.per_key && app.lightning[KEY.LOGITECH]) {
                logitech.SetColor(
                    map(app.lightning[KEY.LOGITECH][0], 0, 255, 0, 94),
                    map(app.lightning[KEY.LOGITECH][1], 0, 255, 0, 94),
                    map(app.lightning[KEY.LOGITECH][2], 0, 255, 0, 94)
                );
            } else {
                if (o.bass_only || o.logitech_bass_only) {
                    logitech.SetColor(
                        map(r, 0, 255, 0, 94),
                        0,
                        0
                    );
                } else {
                    logitech.SetColor(
                        map(r, 0, 255, 0, 94),
                        map(g, 0, 255, 0, 94),
                        map(b, 0, 255, 0, 94)
                    );
                }
            }
        }
    }

    if (!process.env.NO_ARDUINO && !o.no_arduino) {
        arduinoRGB.color(r, g, b);
    }

    mqtt.publish("rgb", [ r, g, b ].join(","));
}

function enableRainbow() {
    const speed = 150;

    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const colors = Rainbow();
        
        setColorAll(colors.r, colors.g, colors.b);
    }, speed);

    mqtt.publish("effect", "rainbow");
    log('Enabled Idle Effect');
}

function enableWave() {
    const speed = 25;

    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const colors = Wave();
        
        setColorAll(colors.r, colors.g, colors.b);
    }, speed);

    mqtt.publish("effect", "wave");
    log('Enabled Idle Effect');
}

function enableWalk() {
    const speed = 250;
    
    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const data = Walk(app.lightning);

        for (let i in data.keys) {
            app.lightning[i] = data.keys[i];
        }
        
        setColorAll(0, 0, 0, {
            per_key: true
        });
    }, speed);
    
    mqtt.publish("effect", "fill");
}

function enableFire() {
    const speed = 25;
    
    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const data = Fire(app);

        for (let i in data.keys) {
            app.lightning[i] = data.keys[i];
        }
        
        setColorAll(0, 0, 0, {
            per_key: true
        });
    }, speed);
    
    mqtt.publish("effect", "fire");
}

function enableWater() {
    const speed = 25;
    
    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const data = Water(app);

        for (let i in data.keys) {
            app.lightning[i] = data.keys[i];
        }
        
        setColorAll(0, 0, 0, {
            per_key: true
        });
    }, speed);
    
    mqtt.publish("effect", "fire");
}

function enableRandom() {
    const speed = 25;
    
    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const data = Random(app);

        for (let i in data.keys) {
            app.lightning[i] = data.keys[i];
        }
        
        setColorAll(0, 0, 0, {
            per_key: true
        });
    }, speed);
    
    mqtt.publish("effect", "fire");
}

function enableAuraSync() {
    const speed = 25;
    
    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const colors = aura.GetMbColor(0);

        setColorAll(colors[0], colors[2], colors[1], {
            logitech_boost: true,
            no_aura: true
        });

        lastData = new Date();
    }, speed);
}

function enableScreenSync() {
    const speed = 10;

    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const img = robot.captureScreen();
        const buffer = img.image;

        for (let z in SCREEN_ZONES) {
            const zone = SCREEN_ZONES[z];

            let count = 1;
            let r = 0, g = 0, b = 0;

            for (let x = zone.SX; x < zone.EX; x+=100) {
                for (let y = zone.SY; y < zone.EY; y+=100) {
                    const index = (x + y * 2560) * 3;
                    
                    if (buffer[index + 0] === undefined || buffer[index + 1] === undefined  || buffer[index + 2] === undefined) continue;

                    if (
                        parseInt(buffer[index + 0]) === 0 && 
                        parseInt(buffer[index + 1]) === 0 && 
                        parseInt(buffer[index + 2]) === 0)
                    continue;

                    if (
                        parseInt(buffer[index + 0]) < 25 && 
                        parseInt(buffer[index + 1]) < 25 && 
                        parseInt(buffer[index + 2]) < 25)
                    continue;

                    count++;

                    r += parseInt(buffer[index + 2]);
                    g += parseInt(buffer[index + 1]);
                    b += parseInt(buffer[index + 0]);
                }
            }

            const colors = [ parseInt(r / count), parseInt(g / count), parseInt(b / count) ]

            if (z === "TOP") {
                setColorAll(colors[0], colors[1], colors[2], {
                    no_arduino: true,
                    no_corsair: true,
                    no_nzxt: true,
                    no_logitech: true,
                    no_aura: false
                });
            } else if (z === "CENTER") {
                setColorAll(colors[0], colors[1], colors[2], {
                    no_arduino: true,
                    no_corsair: true,
                    no_nzxt: true,
                    no_logitech: false,
                    no_aura: true
                });            
            } else if (z === "RIGHT") {
                setColorAll(colors[0], colors[1], colors[2], {
                    no_arduino: true,
                    no_corsair: true,
                    no_nzxt: false,
                    no_logitech: true,
                    no_aura: true
                });            
            } else if (z === "BOTTOM") {
                setColorAll(colors[0], colors[1], colors[2], {
                    no_arduino: true,
                    no_corsair: false,
                    no_nzxt: true,
                    no_logitech: true,
                    no_aura: true
                });            
            }
        }

        lastData = new Date();
    }, speed);
}

function disableEffect(o = {}) {
    clearInterval(effectInterval);

    effectFlag = false;

    cue.clear();

    log('Disabled Idle Effect');
}

function map (num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

query();

function exitHandler(options, err) {
    aura.Shutdown();
    logitech.Shutdown();

    python.end();

    if (options.cleanup) console.log('clean');
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
}

function rain_read() {
    fs.read(rain_file, new Buffer(rain_size), 0, rain_size, 0, rain_process);
}

function rain_process(err, count, buff) {
    const delay = 50;
    const info = buff.toString('utf-8', 0, count);
    const perKey = true;
    let colors;

    if (info.length > 10) {
        const lows = [1, 5], mids = [6, 11], highs = [12, 19];
        const parts = info.split('\r');
        const data = [0, 0, 0];

        for (let i = lows[0]; i < lows[1]; i++) {
            data[0] += parseFloat(parts[i].split("=")[1]);
        }

        data[0] /= (lows[0] + lows[1]);

        for (let i = mids[0]; i < mids[1]; i++) {
            data[1] += parseFloat(parts[i].split("=")[1]);
        }

        data[1] /= (mids[0] + mids[1] + 3);

        for (let i = highs[0]; i < highs[1]; i++) {
            data[2] += parseFloat(parts[i].split("=")[1]);
        }

        data[2] /= (highs[0] + highs[1] + 3);
    
        colors = [ data[0], data[1], data[2] ];

        if (perKey) {
            for (let i in app.lightning) {
                app.lightning[i] = [0, 0, 0];
            }

            for (let i = 0; i < CorsairMap.VisualizerRows.length; i++) {
                const row = CorsairMap.VisualizerRows[i];
                const data = parseFloat(parts[i+1].split("=")[1]);
                const split = 1 / (row.length + 1);
                let value = 0, counter = 0;

                while (value < data) {
                    if (counter >= row.length - 1) break;

                    app.lightning[row[counter]] = CorsairMap.VisualizerRowColors[i];

                    value += split;
                    counter++;
                }

                const color = CorsairMap.VisualizerRowColors[i];
                const partial = ((value - data) / split);
                const led = [ 
                    parseInt(color[0] * partial), 
                    parseInt(color[1] * partial), 
                    parseInt(color[2] * partial)
                ];
                const final = [
                    led[0] > 255 ? 255 : led[0] < 0 ? 0 : led[0],
                    led[1] > 255 ? 255 : led[1] < 0 ? 0 : led[1],
                    led[2] > 255 ? 255 : led[2] < 0 ? 0 : led[2],
                ]

                app.lightning[row[counter]] = final;
            }
        }
    } else {
        colors = [ rain_lastR, rain_lastG, rain_lastB ];
    }

    if (!rain_flag) return;

    setTimeout(rain_read, delay);

    if (rain_lastR === colors[0] && rain_lastG === colors[1] && rain_lastB === colors[2] ) return;

    rain_lastR = colors[0];
    rain_lastG = colors[1];
    rain_lastB = colors[2];

    setColorAll(
        map(colors[0], 0, 1.00, 0, 255),
        map(colors[1], 0, 1.00, 0, 255),
        map(colors[2], 0, 1.00, 0, 255),
        {
            corsair_per_key: perKey,
            bass_only: false,
            nzxt_bass_only: true,
            logitech_bass_only: false
        }
    );

    mqtt.publish("effect", "music");

    lastData = new Date();
}

let state = true;

express.get("/lights/all", (req, res) => {
    log("Sending State", state);

    res.send({ state });
});

express.post("/lights/all", (req, res) => {
    if (req.body.state === "true") {
        disableEffect();
        enableFire();
    
        state = true;

        res.sendStatus(200);
    } else {
        disableEffect();
        
        effectFlag = true;
        state = false;
    
        setColorAll(0, 0, 0);
    
        res.sendStatus(200);
    }
});

express.get("/turn-on", (req, res) => {
    disableEffect();
    enableFire();

    res.sendStatus(200);
});

express.get("/turn-off", (req, res) => {
    disableEffect();
    
    effectFlag = true;

    setColorAll(0, 0, 0);

    res.sendStatus(200);
});

express.get("/color-red", (req, res) => {
    disableEffect();
    
    effectFlag = true;

    setColorAll(255, 0, 0);

    res.sendStatus(200);
});

express.get("/color-green", (req, res) => {
    disableEffect();
    
    effectFlag = true;

    setColorAll(0, 255, 0);

    res.sendStatus(200);
});

express.get("/color-blue", (req, res) => {
    disableEffect();
    
    effectFlag = true;

    setColorAll(0, 0, 255);

    res.sendStatus(200);
});

express.get("/color-white", (req, res) => {
    disableEffect();
    
    effectFlag = true;

    setColorAll(255, 255, 255);

    res.sendStatus(200);
});

express.listen(4524);

function MapRazerKeys(data) { 
    for (let i in app.lightning) {
        app.lightning[i] = [0, 0, 0];
    }
    
    for (let i = 2; i < data.length; i++) {
        const val = data[i].split(',');

        if (val.length === 5) {
            if (!RazerMap.Map[val[0]]) continue;

            const key = RazerMap.Map[val[0]][val[1]];

            app.lightning[key] = [
                parseInt(val[2]), 
                parseInt(val[3]), 
                parseInt(val[4])
            ];
        }
    }

    app.lightning[KEY.BAR_2] = app.lightning[KEY.ESCAPE]; 
    app.lightning[KEY.BAR_3] = app.lightning[KEY.F1]; 
    app.lightning[KEY.BAR_4] = app.lightning[KEY.F2]; 
    app.lightning[KEY.BAR_5] = app.lightning[KEY.F3]; 
    app.lightning[KEY.BAR_6] = app.lightning[KEY.F4]; 
    app.lightning[KEY.BAR_7] = app.lightning[KEY.F5]; 
    app.lightning[KEY.BAR_8] = app.lightning[KEY.F6]; 
    app.lightning[KEY.BAR_9] = app.lightning[KEY.F7]; 
    app.lightning[KEY.BAR_10] = app.lightning[KEY.F8]; 
    app.lightning[KEY.BAR_11] = app.lightning[KEY.F9]; 
    app.lightning[KEY.BAR_12] = app.lightning[KEY.F10];
    app.lightning[KEY.BAR_13] = app.lightning[KEY.F11];
    app.lightning[KEY.BAR_14] = app.lightning[KEY.F12]; 
    app.lightning[KEY.BAR_15] = app.lightning[KEY.PRINT_SCREEN]; 
    app.lightning[KEY.BAR_16] = app.lightning[KEY.SCROLL_LOCK]; 
    app.lightning[KEY.BAR_17] = app.lightning[KEY.PAUSE_BREAK]; 
}

function toHex(value) {
    let hex = value.toString(16);

    if (hex.length === 1) {
        hex = `0${hex}`;
    }

    return hex.toUpperCase();
}

function toRGB(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function changeEffect(value) {    
    if (rain_flag) {
        rain_flag = false;
    }

    if (value === 'sync_screen') {
        disableEffect();
        enableScreenSync();
    } else if (value === 'sync_music') {    
        disableEffect();

        rain_flag = true;
        
        fs.open(rain_path, 'r', (err, fd) => { rain_file = fd; rain_read(); });
    } else if (value === 'effect_rainbow') {
        disableEffect();
        enableRainbow();
    } else if (value === 'effect_wave') {
        disableEffect();
        enableWave();
    } else if (value === 'effect_walk') {
        disableEffect();
        enableWalk();
    } else if (value === 'effect_fire') {
        disableEffect();
        enableFire();
    } else if (value === 'effect_water') {
        disableEffect();
        enableWater();
    } else if (value === 'effect_random') {
        disableEffect();
        enableRandom();
    } else if (value === "static_off") {
        disableEffect();
        
        effectFlag = true;

        setColorAll(0, 0, 0);     
    }  else if (value === "static_red") {
        disableEffect();
        
        effectFlag = true;

        setColorAll(255, 0, 0);     
    } else if (value === "static_green") {
        disableEffect();
        
        effectFlag = true;

        setColorAll(0, 255, 0);         
    } else if (value === "static_blue") {
        disableEffect();
        
        effectFlag = true;

        setColorAll(0, 0, 255);    
    } else if (value === "static_white") {
        disableEffect(); 
        
        effectFlag = true;

        setColorAll(255, 255, 255);    
    }
}

mqtt.on('connect', () => {
    log("MQTT connected");    

    mqtt.subscribe("state/set");
    mqtt.subscribe("rgb/set");
    mqtt.subscribe("effect/set");
});
   
mqtt.on('message', (topic, message) => {
    log("MQTT", topic, message.toString());

    const msg = message.toString();

    if (topic === "state/set") {
        if (msg === "on") {
            lightFlag = true;

            setColorAll(lastR, lastG, lastB);

            mqtt.publish("state", "on");
        } else {        
            lightFlag = false;

            setColorAll(0, 0, 0);
            
            mqtt.publish("state", "off");
        }
    } else if (topic === "rgb/set") {
        const parts = msg.split(",");

        disableEffect();
        
        effectFlag = true;

        mqtt.publish("effect", "static");

        setColorAll(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));        
    }
});

process.on('exit', exitHandler.bind(null,{cleanup:true}));
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

const SCREEN_ZONES = {
    TOP: {
        SX: 0,
        SY: 0,
        EX: 2560,
        EY: 256
    },
    BOTTOM: {
        SX: 0,
        SY: 768,
        EX: 2560,
        EY: 1080
    },
    RIGHT: {
        SX: 2000,
        SY: 0,
        EX: 2560,
        EY: 1080
    },
    CENTER: {
        SX: 1024,
        SY: 412,
        EX: 1536,
        EY: 668
    }
}