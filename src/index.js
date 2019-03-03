import debug from 'debug';
import five from 'johnny-five';
import pixel from 'node-pixel';
import fs from 'fs';
import Color from 'color-convert';
import pythonBridge from 'python-bridge';
import Express from "express";
import bodyParser from "body-parser";
import MQTT from 'mqtt';
import robot from 'robotjs';
import EventEmitter from 'events';
import Hue from 'philips-hue';
import servgen from '@abskmj/servgen';

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
import Gradient from "./effects/gradient";
import Win from "./effects/window";

import KEY from './objects/keys';

const activeWin = require("active-win");
const processExists = require('process-exists');
const cmd = require('node-cmd');
const pathExists = require('path-exists');
const request = require('async-request');

const log = debug('app');
const rain_path = 'C:\\Users\\abhis\\Documents\\Rainmeter\\Skins\\RGBToText\\@Resources\\band.txt';
const rain_size = 8192;
const cue = new CueSDK(`${__dirname}/../files/CUESDK_2015.dll`);
const python = pythonBridge();
const express = new Express();
const hue = new Hue()

const mqtt = MQTT.connect("mqtt://192.168.0.200:1983");
const app = new EventEmitter();

app.express = express;
app.effect = changeEffect;
app.color = setColorAll;
app.disableEffect = disableEffect;
app.enableEffect = enableEffect;
app.setEffectFlag = (val) => effectFlag = val;
app.lightning = [];
app.keys = KEY;
app.cue = cue;

let effectInterval;
let effectFlag = false;
let arduinoStrip = null;
let arduinoStrip2 = null;
let lastData = new Date();
let dominatingPipe = null;
let lastR, lastG, lastB;
let maxR = 0, maxG = 0, maxB = 0;
let board;
let rain_file;
let rain_lastR, rain_lastG, rain_lastB;
let rain_flag = false;
let lightFlag = true;
let current_hour = new Date().getHours();

let hueReady = false;

setInterval(() => {
    current_hour = new Date().getHours();
}, 60 * 60 * 1000);

setInterval(async () => {
    const info = await activeWin();
    
    // log(info)

    if (info.owner.name === "ApplicationFrameHost.exe")
        Win(app,info.title)
    else
        Win(app, info.owner.name);
}, 1 * 1000);

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
        
init();

if (!process.env.NO_ARDUINO) {
    board = new five.Board({
        port: 'COM3',
        repl: false
    });  

    board.on("ready", function() {  
        log("[ARDUINO] Ready!");  

        arduinoStrip = new pixel.Strip({
            board: this,
            controller: "FIRMATA",
            strips: [ { pin: 7, length: 60 }, { pin: 5, length: 60 } ]
        });

        arduinoStrip.on("ready", function() {
            log("[ARDUINO] Strip Ready!");  
        });

        this.on("exit", function() {
            log("[ARDUINO] Switched off!");  
        });
    });  
}

if (!process.env.NO_HUE) {
    if (!process.env.HUE_USER) {
        hue.getBridges()
            .then((bridges) => {    
                log(`HUE IP: ${bridges[0]}`);
                return hue.auth(bridges[0]);
            }).then(async (username) => {    
                log(`HUE Username: ${username}`);

                log(await hue.getLights());
            });
    } else {
        hue.bridge = process.env.HUE_IP;
        hue.username = process.env.HUE_USER;
        hue.lightId = 3;

        hueReady = true;
    }
}

// setInterval(() => {
//     if (new Date().getTime() - lastData.getTime() >= 30000) {
//         if (!effectFlag) {       
//             if (rain_flag) {
//                 rain_flag = false;
//             }
    
//             disableEffect();
//             enableEffect();
//         }
//     }
// }, 30000);

async function init() {
    python.ex`import serial`;
    python.ex`import hue_plus.hue`;
    python.ex`ser = serial.Serial("COM4", 256000)`;

    try {
        await servgen.init(app, `${__dirname}/modules`, [ 'config', 'prefs', 'cli' ]);

        // enableRainbow(app);
        startPipes();    
    } catch (error) {
        log(error);
    }

    log('Started!');
}

function enableEffect() {
    enableRainbow(app);
}

function startPipes() {
    app.on("pipe-razer", (values) => {
        if (effectFlag) {
            disableEffect();

            log(`Razer pipe disabled idle effect!`);
            app.mqtt.publish("config/scene/active", "pipe");
        }
        log("Razer", values);

        MapRazerKeys(values);

        setColorAll(
            0, 0, 0,
            {
                per_key: true,
                default_key: KEY.Q,
                hue_bright: true
            }
        );

        lastData = new Date();
    });

    app.on("pipe-logitech", (values) => {
        if (effectFlag) {
            disableEffect();

            log(`Logitech pipe disabled idle effect!`);
            app.mqtt.publish("config/scene/active", "pipe");
        }

        if (parseInt(values[0]) === 1 && parseInt(values[1]) === 0xFFF9) {
            setColorAll(
                map(parseInt(values[2]), 0, 100, 0, 255),
                map(parseInt(values[3]), 0, 100, 0, 255),
                map(parseInt(values[4]), 0, 100, 0, 255)
            );                
        }

        lastData = new Date();
    });

    // const logitech = net.createServer((stream) => {
    //     stream.on('data', async (c) => {
    //         if (dominatingPipe && dominatingPipe !== 'logitech') return;
    //         else if (!dominatingPipe) dominatingPipe = 'logitech';

    //         const values = c.toString().split(' ');
            
    //         if (effectFlag) {
    //             disableEffect();

    //             log(`Logitech pipe disabled idle effect!`);
    //         }

    //         if (parseInt(values[0]) === 1 && parseInt(values[1]) === 0xFFF9) {
    //             // setColorAll(
    //             //     map(parseInt(values[2]), 0, 100, 0, 255),
    //             //     map(parseInt(values[3]), 0, 100, 0, 255),
    //             //     map(parseInt(values[4]), 0, 100, 0, 255)
    //             // );                
    //         }

    //         // log(c.toString());

    //         lastData = new Date();
    //     });
    // });
    
    // logitech.listen(LOGITECH_PIPE_PATH, () => {
    //     log('Logitech pipe Started!');
    // });
 }

let hue_throttle = 0;

setInterval(() => {
    if (hue_throttle > 0) hue_throttle--;
}, 100)

let smooth = 0;
function setColorAll(r, g, b, o = {}) {
    if (o.tween && !o.tween_set) {
        o.target = [ r, g, b ];
        o.tween_set = true;

        setColorAll(lastR, lastG, lastB, o);
    }

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

        app.mqtt.publish("device/corsair/rgb/set", JSON.stringify({ r, g, b }));
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

        app.mqtt.publish("device/desk/rgb/set", JSON.stringify({ r, g, b }));
    }

    if (!o.no_nzxt) {
        if (o.bass_only || o.nzxt_bass_only) {
            let c1 = "000000";
            let c2 = "000000";

            c2 = `${toHex(parseInt(r))}0000`;
            c1 = `${toHex(parseInt(r))}${toHex(parseInt(g))}${toHex(parseInt(b))}`;

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
                        c2[i] = `${toHex(parseInt(app.lightning[KEY[`NZXT_1_${i+1}`]][0]))}${toHex(parseInt(app.lightning[KEY[`NZXT_1_${i+1}`]][1]))}${toHex(parseInt(app.lightning[KEY[`NZXT_1_${i+1}`]][2]))}`;
                        c1[i] = `${toHex(parseInt(app.lightning[KEY[`NZXT_2_${i+1}`]][0]))}${toHex(parseInt(app.lightning[KEY[`NZXT_2_${i+1}`]][1]))}${toHex(parseInt(app.lightning[KEY[`NZXT_2_${i+1}`]][2]))}`;
                    }
            
                    python.ex`hue_plus.hue.custom(ser, 0, 1, ${c1}, "fixed", 0)`
                    python.ex`hue_plus.hue.custom(ser, 0, 2, ${c2}, "fixed", 0)`
                }
            } else {
                c = `${toHex(parseInt(r))}${toHex(parseInt(g))}${toHex(parseInt(b))}`;

                // python.ex`hue_plus.hue.custom(ser, 0, 1, [ ${c} ], "fixed", 0)`;

                if (!o.nzxt_channel)
                    python.ex`hue_plus.hue.fixed(ser, 0, 0, ${c})`
                else if (o.nzxt_channel === 1)
                    python.ex`hue_plus.hue.fixed(ser, 0, 1, ${c})`
                else if (o.nzxt_channel === 2)
                    python.ex`hue_plus.hue.fixed(ser, 0, 2, ${c})`
            }
        }

        app.mqtt.publish("device/nzxt/1/rgb/set", JSON.stringify({ r, g, b }));
        app.mqtt.publish("device/nzxt/2/rgb/set", JSON.stringify({ r, g, b }));
    }

    if (!o.no_logitech) {
        if (o.music) {
            let lr, lg, lb;

            lr = ((map(r, 0, 255, 0, 94) * 2.5));
            lg = ((map(g, 0, 255, 0, 94) * 5));
            lb = ((map(b, 0, 255, 0, 94) * 5));

            if (lr > 100) lr = 100;
            if (lg > 100) lg = 100;
            if (lb > 100) lb = 100;

            logitech.SetColorZone(
                3, 0,
                lr,
                0,
                0
            );

            logitech.SetColorZone(
                3, 1,
                lr,
                lg,
                lb
            );
        } else {
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
                        if (o.logitech_channel === 1) {
                            logitech.SetColorZone(
                                3, 0,
                                map(r, 0, 255, 0, 94),
                                map(g, 0, 255, 0, 94),
                                map(b, 0, 255, 0, 94)
                            );
                        } else if (o.logitech_channel === 2) {
                            logitech.SetColorZone(
                                3, 1,
                                map(r, 0, 255, 0, 94),
                                map(g, 0, 255, 0, 94),
                                map(b, 0, 255, 0, 94)
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
        }
        
        app.mqtt.publish("device/logitech/rgb/set", JSON.stringify({ r, g, b }));
        app.mqtt.publish("device/logitech/1/rgb/set", JSON.stringify({ r, g, b }));
        app.mqtt.publish("device/logitech/2/rgb/set", JSON.stringify({ r, g, b }));
    }

    if (!process.env.NO_ARDUINO && !o.no_arduino && arduinoStrip) {
        if (o.music) {
            if (parseInt(r) > 60) {
                arduinoStrip.pixel(119).color(`rgb(${parseInt(r)}, ${parseInt(g)}, ${parseInt(b)})`);

                if (r > smooth) {
                    smooth = parseInt(r);
                    arduinoStrip.pixel(48).color(`rgb(${parseInt(r)}, 0, 0)`);
                } else {
                    smooth -= 10;
                    let tr = smooth > 0 ? smooth : 0;
                    arduinoStrip.pixel(48).color(`rgb(${parseInt(tr)}, 0, 0)`);
                }
            } else {
                arduinoStrip.pixel(119).color(`rgb(0, 0, 0)`);

                if (smooth > 0) {
                    smooth -= 5;
                    let tr = smooth > 0 ? smooth : 0;

                    arduinoStrip.pixel(48).color(`rgb(${parseInt(tr)}, 0, 0)`);
                } else {
                    arduinoStrip.pixel(48).color(`rgb(0, 0, 0)`);
                }
            }

            arduinoStrip.shift(1, pixel.BACKWARD, false);

            const skipColor1 = arduinoStrip.pixel(107).color();
            const skipColor2 = arduinoStrip.pixel(76).color();

            arduinoStrip.pixel(75).color(`rgb(0, 0, 0)`);
            arduinoStrip.pixel(74).color(`rgb(0, 0, 0)`);
            arduinoStrip.pixel(73).color(`rgb(${skipColor2.r}, ${skipColor2.g}, ${skipColor2.b})`);
            arduinoStrip.pixel(106).color(`rgb(0, 0, 0)`);
            arduinoStrip.pixel(105).color(`rgb(${skipColor1.r}, ${skipColor1.g}, ${skipColor1.b})`);
            arduinoStrip.pixel(60).color(`rgb(0, 0, 0)`);

            arduinoStrip.show();
        } else {
            if ((r == 0 || r === 255) && g == 0 && b == 0) {
                arduinoStrip.color(`rgb(${parseInt(r)}, ${parseInt(g)}, ${parseInt(b)})`);
                arduinoStrip.pixel(14).color(`rgb(0, 0, 0)`);
                arduinoStrip.pixel(15).color(`rgb(0, 0, 0)`);
                arduinoStrip.pixel(45).color(`rgb(0, 0, 0)`);
                arduinoStrip.pixel(46).color(`rgb(0, 0, 0)`);
                arduinoStrip.pixel(59).color(`rgb(0, 0, 0)`);
                arduinoStrip.pixel(60).color(`rgb(0, 0, 0)`);
                arduinoStrip.show();
            } else {
                arduinoStrip.color(`rgb(0, 0, 0)`);
                arduinoStrip.show();
            }

            if (o.per_key) {
                
            }
        }
    }

    if (!process.env.NO_HUE && !o.no_hue) {
        let hsl;

        if (o.per_key && app.lightning[KEY.HUE_1]) {
            hsl = Color.rgb.hsl(app.lightning[KEY.HUE_1][0], app.lightning[KEY.HUE_1][1], app.lightning[KEY.HUE_1][2]);
        } else {
            hsl = Color.rgb.hsl(r, g, b);
        }

        const state = {
            hue: parseInt(hsl[0] * 182),
            sat: parseInt(hsl[1] * 2.54),
            bri: o.hue_bright ? 255 : parseInt(map(hsl[2], 0, o.hue_bri_max ? o.hue_bri_max : 100, 0, 255))
        }

        if (hue_throttle < 5) {
            hue_throttle++;

            if (state.bri < 5) state.on = false;
            else state.on = true;

            if (state.bri > 255) state.bri = 255;
    
            hue.light(hue.lightId).setState(state)
            .catch((error) => {
                log(error);
            });
        }
    }
    
    if (o.tween && o.tween_set) {
        if (
            r === o.target[0],
            g === o.target[1],
            b === o.target[2]
        ) {
            o.tween = false;
            o.tween_set = false;
            
            return;
        }

        let nr = r, ng = g, nb = b;

        if (nr !== o.target[0]) nr > o.target[0] ? nr-- : nr++;
        if (ng !== o.target[1]) ng > o.target[1] ? ng-- : ng++;
        if (nb !== o.target[2]) nb > o.target[2] ? nb-- : nb++;

        setColorAll(nr, ng, nb, o);
    }

    mqtt.publish("rgb", [ r, g, b ].join(","));
}

function enableRainbow() {
    // const speed = 150;

    // effectFlag = true;
    // dominatingPipe = null;

    // effectInterval = setInterval(() => {
    //     const colors = Rainbow();
        
    //     setColorAll(colors.r, colors.g, colors.b);
    // }, speed);

    // app.mqtt.publish("config/scene/active", "rainbow");
    // log('Enabled Idle Effect');
}

function enableWave() {
    const speed = 25;

    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const colors = Wave();
        
        setColorAll(colors.r, colors.g, colors.b);
    }, speed);

    app.mqtt.publish("config/scene/active", "wave");
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
    
    mqtt.publish("effect", "water");
}

function enableGradient() {    
    effectFlag = true;
    dominatingPipe = null;

    const data = Gradient(app);

    for (let i in data.keys) {
        app.lightning[i] = data.keys[i];
    }
    
    setColorAll(0, 0, 0, {
        per_key: true
    });
    
    mqtt.publish("effect", "gradient");
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
            per_key: true,
            hue_bright: true
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
        const zoneColors = {};

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
                        parseInt(buffer[index + 0]) < 10 && 
                        parseInt(buffer[index + 1]) < 10 && 
                        parseInt(buffer[index + 2]) < 10)
                    continue;

                    count++;

                    r += parseInt(buffer[index + 2]);
                    g += parseInt(buffer[index + 1]);
                    b += parseInt(buffer[index + 0]);
                }
            }

            const colors = [ parseInt(r / count), parseInt(g / count), parseInt(b / count) ];

            zoneColors[z] = colors;
        }

        setColorAll(zoneColors["TOP"][0], zoneColors["TOP"][1], zoneColors["TOP"][2], {
            no_arduino: true,
            no_corsair: true,
            no_nzxt: true,
            no_logitech: true,
            no_aura: false
        });

        setColorAll(zoneColors["CENTER"][0], zoneColors["CENTER"][1], zoneColors["CENTER"][2], {
            no_arduino: true,
            no_corsair: true,
            no_nzxt: true,
            no_logitech: false,
            no_aura: true
        });            

        setColorAll(zoneColors["RIGHT"][0], zoneColors["RIGHT"][1], zoneColors["RIGHT"][2], {
            no_arduino: false,
            no_corsair: true,
            no_nzxt: false,
            no_logitech: true,
            no_aura: true
        });            
        
        setColorAll(zoneColors["BOTTOM"][0], zoneColors["BOTTOM"][1], zoneColors["BOTTOM"][2], {
            no_arduino: true,
            no_corsair: false,
            no_nzxt: true,
            no_logitech: true,
            no_aura: true
        });           

        lastData = new Date();
    }, speed);
}

function enableAudioSync() {
    rain_flag = true;
    
    fs.open(rain_path, 'r', (err, fd) => { rain_file = fd; rain_read(); });

    app.mqtt.publish("config/scene/active", "music");
}

async function enableMusicMode(app) {
    if (await processExists("Rainmeter.exe"));
    else {    
        await cmd.run(`"C:\\Program Files\\Rainmeter\\Rainmeter.exe"`);
    }

    await cmd.run(`"C:\Program Files\Rainmeter\Rainmeter.exe" !Refresh RGBToText`);

    if (await processExists("Google Play Music Desktop Player.exe"));
    else {    
        await cmd.run(`"C:\\Users\\abhis\\AppData\\Local\\GPMDP_3\\app-4.6.1\\Google Play Music Desktop Player.exe"`);

        await app.gpmdp.retryConnection();
    }

    await app.gpmdp.control.playPause();
}

function disableEffect(o = {}) {
    clearInterval(effectInterval);

    effectFlag = false;
    rain_flag = false;

    // cue.clear();

    log('Disabled Idle Effect');
}

function map (num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

// query();

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

        data[1] /= (mids[0] + mids[1]);

        for (let i = highs[0]; i < highs[1]; i++) {
            data[2] += parseFloat(parts[i].split("=")[1]);
        }

        data[2] /= (highs[0] + highs[1]);
    
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

    colors[0] = map(colors[0], 0, 1.00, 0, 255);
    colors[1] = map(colors[1], 0, 1.00, 0, 255);
    colors[2] = map(colors[2], 0, 1.00, 0, 255);

    colors[0] = colors[0] > 255 ? 255 : colors[0];
    colors[1] = colors[1] > 255 ? 255 : colors[1];
    colors[2] = colors[2] > 255 ? 255 : colors[2];

    setColorAll(
        colors[0], colors[1], colors[2],
        {
            corsair_per_key: perKey,
            bass_only: false,
            nzxt_bass_only: true,
            logitech_bass_only: false,
            hue_bri_max: 32,
            music: true
        }
    );

    mqtt.publish("effect", "music");

    lastData = new Date();
}

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
    app.lightning[KEY.HUE_1] = app.lightning[KEY.N]; 
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

function changeEffect(value, params) {    
    if (rain_flag) {
        rain_flag = false;
    }
    
    disableEffect();

    if (value === 'sync_screen') {
        enableScreenSync();
    } else if (value === 'sync_music') {   
        enableAudioSync();
    } else if (value === 'effect_rainbow') {
        enableRainbow();
    } else if (value === 'effect_gradient') {
        enableGradient();
    } else if (value === 'effect_wave') {
        enableWave();
    } else if (value === 'effect_walk') {
        enableWalk();
    } else if (value === 'effect_fire') {
        enableFire();
    } else if (value === 'effect_water') {
        enableWater();
    } else if (value === 'effect_random') {
        enableRandom();
    } else if (value === "static_off") {
        effectFlag = true;

        setColorAll(0, 0, 0);     
    }  else if (value === "static_red") {
        effectFlag = true;

        setColorAll(255, 0, 0);     
    } else if (value === "static_green") {
        effectFlag = true;

        setColorAll(0, 255, 0);         
    } else if (value === "static_blue") {    
        effectFlag = true;

        setColorAll(0, 0, 255);    
    } else if (value === "static_white") {        
        effectFlag = true;

        setColorAll(255, 255, 255);    
    }
}

app.on('mqtt-connect', () => {
    app.mqtt.subscribeList([
        "device/desk/rgb",
        "device/logitech/1/rgb",
        "device/logitech/2/rgb",
        "device/corsair/rgb",
        "device/nzxt/1/rgb",
        "device/nzxt/2/rgb",
        "device/ups/battery",
        "device/ups/status",
        "config/scene",
        "config/scene/active"
    ])
});

app.on('mqtt-config/scene/active', (data) => {
    const scene = data.toString();
})

app.on('mqtt-config/scene', (data) => {
    const scene = data.toString();

    log("Scene MQTT:", scene);

    disableEffect();

    if (scene === 'music') {
        enableAudioSync(app);
    } else if (scene === 'music_mode') {
        enableMusicMode(app);
        enableAudioSync(app);
    } else if (scene === "screen") {
        enableScreenSync(app);
    }
})

app.on('mqtt-device/desk/rgb', (data) => {
    const colors = parseMqttColors(data)  

    disableEffect();
    effectFlag = true;

    setColorAll(colors.r, colors.g, colors.b, {
        no_arduino: false,
        no_corsair: true,
        no_hue: true,
        no_logitech: true,
        no_nzxt: true
    })
});

app.on('mqtt-device/logitech/1/rgb', (data) => {
    const colors = parseMqttColors(data)  

    disableEffect();
    effectFlag = true;
    
    setColorAll(colors.r, colors.g, colors.b, {
        no_arduino: true,
        no_corsair: true,
        no_hue: true,
        no_nzxt: true,
        no_aura: true,
        logitech_channel: 1
    })
});

app.on('mqtt-device/logitech/2/rgb', (data) => {
    const colors = parseMqttColors(data)  

    disableEffect();
    effectFlag = true;
    
    setColorAll(colors.r, colors.g, colors.b, {
        no_arduino: true,
        no_corsair: true,
        no_hue: true,
        no_nzxt: true,
        no_aura: true,
        logitech_channel: 2
    })
});

app.on('mqtt-device/corsair/rgb', (data) => {
    const colors = parseMqttColors(data)  

    disableEffect();
    effectFlag = true;
    
    setColorAll(colors.r, colors.g, colors.b, {
        no_arduino: true,
        no_hue: true,
        no_logitech: true,
        no_nzxt: true,
        no_aura: true,
    })
})

app.on('mqtt-device/nzxt/1/rgb', (data) => {
    const colors = parseMqttColors(data)  

    disableEffect();
    effectFlag = true;
    
    setColorAll(colors.r, colors.g, colors.b, {
        no_arduino: true,
        no_corsair: true,
        no_hue: true,
        no_logitech: true,
        no_aura: true,
        nzxt_channel: 1
    })
});

app.on('mqtt-device/nzxt/1/rgb', (data) => {
    const colors = parseMqttColors(data)  

    disableEffect();
    effectFlag = true;
    
    setColorAll(colors.r, colors.g, colors.b, {
        no_arduino: true,
        no_corsair: true,
        no_hue: true,
        no_logitech: true,
        no_aura: true,
        nzxt_channel: 1
    })
});

app.on('mqtt-device/nzxt/2/rgb', (data) => {
    const colors = parseMqttColors(data)  

    disableEffect();
    effectFlag = true;
    
    setColorAll(colors.r, colors.g, colors.b, {
        no_arduino: true,
        no_corsair: true,
        no_hue: true,
        no_logitech: true,
        no_aura: true,
        nzxt_channel: 2
    })
});

function parseMqttColors(message) {
    const colors = JSON.parse(message.toString())

    if (!colors.r) colors.r = 0;
    if (!colors.g) colors.g = 0;
    if (!colors.b) colors.b = 0;

    return colors;
}

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