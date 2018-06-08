import five from 'johnny-five';
import debug from 'debug';
import net from 'net';
import sleep from 'async-sleep';
import clear from 'clear';
import inquirer from 'inquirer';
import fs from 'fs';
import request from 'request';
import CueSDK from 'corsair-sdk';
import Color from 'color';
import pythonBridge from 'python-bridge';

import aura from '../build/Release/aura';
import logitech from '../build/Release/logitech';

import Rainbow from './effects/rainbow';
import Wave from './effects/wave';
import Walk from './effects/walk';

import KEY from './objects/keys';

const RAZER_PIPE_PATH = "\\\\.\\pipe\\artemis";
const LOGITECH_PIPE_PATH = "\\\\.\\pipe\\lightningstrike_logitech";
const log = debug('app');
const rain_path = 'C:\\Users\\abhis\\Documents\\Rainmeter\\Skins\\RGBToText\\@Resources\\band.txt';
const rain_size = 8192;
const cue = new CueSDK.CueSDK(`${__dirname}/../files/CUESDK_2015.dll`);
const python = pythonBridge();

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

aura.Init();
logitech.Init();

aura.FindMbControllers();

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
                    name: "Sync with AURA",
                    value: 'sync_aura'
                },
                {
                    name: "Sync with Audio",
                    value: 'sync_rain'
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
        if (rain_flag) {
            rain_flag = false;
        }

        if (answers.Options === 'sync_aura') {
            disableEffect();
            enableAuraSync();
        } else if (answers.Options === 'sync_rain') {    
            disableEffect();

            rain_flag = true;
            
            fs.open(rain_path, 'r', (err, fd) => { rain_file = fd; rain_read(); });
        } else if (answers.Options === 'effect_rainbow') {
            disableEffect();
            enableRainbow();
        } else if (answers.Options === 'effect_wave') {
            disableEffect();
            enableWave();
        } else if (answers.Options === 'effect_walk') {
            disableEffect();
            enableWalk();
        } else if (answers.Options === "static_off") {
            disableEffect();
            
            effectFlag = true;

            setColorAll(0, 0, 0);     
        }  else if (answers.Options === "static_red") {
            disableEffect();
            
            effectFlag = true;

            setColorAll(255, 0, 0);     
        } else if (answers.Options === "static_green") {
            disableEffect();
            
            effectFlag = true;

            setColorAll(0, 255, 0);         
        } else if (answers.Options === "static_blue") {
            disableEffect();
            
            effectFlag = true;

            setColorAll(0, 0, 255);    
        } else if (answers.Options === "static_white") {
            disableEffect();
            
            effectFlag = true;

            setColorAll(255, 255, 255);    
        }

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
            enableRainbow();
        }
    }
}, 30000);

function init() {
    enableRainbow();
    startPipes();    

    python.ex`import serial`;
    python.ex`import hue_plus.hue`;
    python.ex`ser = serial.Serial("COM4", 256000)`;

    log('Started!');
}

function startPipes() {
    const razer = net.createServer((stream) => {
        stream.on('data', async (c) => {    
            const values = c.toString().split(' ');
            const color = values[47].split(',');
    
            if (effectFlag) {
                disableEffect();

                log(`Razer pipe disabled idle effect!`);
            }

            setColorAll(
                parseInt(color[2]), 
                parseInt(color[3]), 
                parseInt(color[4]),
                {
                    corsair_per_key: true
                }
            );

            MapRazerKeys(values);

            // log(c.toString());

            lastData = new Date();
        });
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

    razer.listen(RAZER_PIPE_PATH, () => {
        log('Razer pipe Started!');
    });
    
    logitech.listen(LOGITECH_PIPE_PATH, () => {
        log('Logitech pipe Started!');
    });
 }

let z = 170;
function setColorAll(r, g, b, o = {}) {
    if (!(o.per_key || o.corsair_per_key)) {
        if (lastR === r && lastG === g && lastB === b) return;
    }

    lastR = r, lastG = g, lastB = b;

    if (!o.no_corsair) {
        const l = [];

        if (o.per_key || o.corsair_per_key) {
            for (let i = 1; i <= 188; i++) {
                const key = CorsairMap[i];

                if (key && KEY_LIGHTING[key]) {
                    l.push([i, KEY_LIGHTING[key][0], KEY_LIGHTING[key][1], KEY_LIGHTING[key][2]]);
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
        if (o.per_key && KEY_LIGHTING[KEY.AURA]) {
            aura.SetMbColor(0, KEY_LIGHTING[KEY.AURA][0], KEY_LIGHTING[KEY.AURA][2], KEY_LIGHTING[KEY.AURA][1]);
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

            if ((o.per_key || o.corsair_per_key) && KEY_LIGHTING[KEY.M] && !rain_flag) {
                c = `${toHex(parseInt(KEY_LIGHTING[KEY.M][0]))}${toHex(parseInt(KEY_LIGHTING[KEY.M][1]))}${toHex(parseInt(KEY_LIGHTING[KEY.M][2]))}`;            
            } else {
                c = `${toHex(parseInt(r))}${toHex(parseInt(g))}${toHex(parseInt(b))}`;
            }

            python.ex`hue_plus.hue.fixed(ser, 0, 0, ${c})`
        }
    }

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
        if (o.per_key && KEY_LIGHTING[KEY.LOGITECH]) {
            logitech.SetColor(
                map(KEY_LIGHTING[KEY.LOGITECH][0], 0, 255, 0, 94),
                map(KEY_LIGHTING[KEY.LOGITECH][1], 0, 255, 0, 94),
                map(KEY_LIGHTING[KEY.LOGITECH][2], 0, 255, 0, 94)
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

    if (!process.env.NO_ARDUINO && !o.no_arduino) {
        arduinoRGB.color(r, g, b);
    }
}

function enableRainbow() {
    const speed = 150;

    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const colors = Rainbow();
        
        setColorAll(colors.r, colors.g, colors.b);
    }, speed);

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

    log('Enabled Idle Effect');
}

function enableWalk() {
    const speed = 250;
    
    effectFlag = true;
    dominatingPipe = null;

    effectInterval = setInterval(() => {
        const data = Walk(KEY_LIGHTING);

        for (let i in data.keys) {
            KEY_LIGHTING[i] = data.keys[i];
        }
        
        setColorAll(0, 0, 0, {
            per_key: true
        });
    }, speed);
}

function enableAuraSync() {
    const speed = 25;
    
    effectInterval = setInterval(() => {
        const colors = aura.GetMbColor(0);

        setColorAll(colors[0], colors[2], colors[1], {
            logitech_boost: true,
            no_aura: true
        });

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
            for (let i in KEY_LIGHTING) {
                KEY_LIGHTING[i] = [0, 0, 0];
            }

            for (let i = 0; i < CorsairVisualizerRows.length; i++) {
                const row = CorsairVisualizerRows[i];
                const data = parseFloat(parts[i+1].split("=")[1]);
                const split = 1 / (row.length + 1);
                let value = 0, counter = 0;

                while (value < data) {
                    if (counter >= row.length - 1) break;

                    KEY_LIGHTING[row[counter]] = CorsairVisualizerRowColors[i];

                    value += split;
                    counter++;
                }

                const color = CorsairVisualizerRowColors[i];
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

                KEY_LIGHTING[row[counter]] = final;
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

    lastData = new Date();
}

function MapRazerKeys(data) { 
    for (let i in KEY_LIGHTING) {
        KEY_LIGHTING[i] = [0, 0, 0];
    }
    
    for (let i = 2; i < data.length; i++) {
        const val = data[i].split(',');

        if (val.length === 5) {
            if (!RazerMap[val[0]]) continue;

            const key = RazerMap[val[0]][val[1]];

            KEY_LIGHTING[key] = [val[2], val[3], val[4]];
        }
    }

    KEY_LIGHTING[KEY.BAR_2] = KEY_LIGHTING[KEY.ESCAPE]; 
    KEY_LIGHTING[KEY.BAR_3] = KEY_LIGHTING[KEY.F1]; 
    KEY_LIGHTING[KEY.BAR_4] = KEY_LIGHTING[KEY.F2]; 
    KEY_LIGHTING[KEY.BAR_5] = KEY_LIGHTING[KEY.F3]; 
    KEY_LIGHTING[KEY.BAR_6] = KEY_LIGHTING[KEY.F4]; 
    KEY_LIGHTING[KEY.BAR_7] = KEY_LIGHTING[KEY.F5]; 
    KEY_LIGHTING[KEY.BAR_8] = KEY_LIGHTING[KEY.F6]; 
    KEY_LIGHTING[KEY.BAR_9] = KEY_LIGHTING[KEY.F7]; 
    KEY_LIGHTING[KEY.BAR_10] = KEY_LIGHTING[KEY.F8]; 
    KEY_LIGHTING[KEY.BAR_11] = KEY_LIGHTING[KEY.F9]; 
    KEY_LIGHTING[KEY.BAR_12] = KEY_LIGHTING[KEY.F10];
    KEY_LIGHTING[KEY.BAR_13] = KEY_LIGHTING[KEY.F11];
    KEY_LIGHTING[KEY.BAR_14] = KEY_LIGHTING[KEY.F12]; 
    KEY_LIGHTING[KEY.BAR_15] = KEY_LIGHTING[KEY.PRINT_SCREEN]; 
    KEY_LIGHTING[KEY.BAR_16] = KEY_LIGHTING[KEY.SCROLL_LOCK]; 
    KEY_LIGHTING[KEY.BAR_17] = KEY_LIGHTING[KEY.PAUSE_BREAK]; 
}

function toHex(value) {
    let hex = value.toString(16);

    if (hex.length === 1) {
        hex = `0${hex}`;
    }

    return hex.toUpperCase();
}

process.on('exit', exitHandler.bind(null,{cleanup:true}));
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

const RazerMap = [  
    [
    KEY.INVALID,        KEY.ESCAPE,         KEY.INVALID,        KEY.F1,             KEY.F2,             KEY.F3,             KEY.F4,             KEY.F5,             KEY.F6,         KEY.F7, 
    KEY.F8,             KEY.F9,             KEY.F10,            KEY.F11,            KEY.F12,            KEY.PRINT_SCREEN,   KEY.SCROLL_LOCK,    KEY.PAUSE_BREAK,    KEY.INVALID,    KEY.INVALID, 
    KEY.INVALID ],                  
      
    [
    KEY.G2,             KEY.TILDE,          KEY.ONE,            KEY.TWO,            KEY.THREE,          KEY.FOUR,           KEY.FIVE,           KEY.SIX,            KEY.SEVEN,      KEY.EIGHT, 
    KEY.NINE,           KEY.ZERO,           KEY.MINUS,          KEY.EQUALS,         KEY.BACKSPACE,      KEY.INSERT,         KEY.HOME,           KEY.PAGE_UP,        KEY.NUM_LOCK,   KEY.NUM_SLASH,
    KEY.NUM_ASTERISK,   KEY.NUM_MINUS ],                
      
    [  
    KEY.G3,             KEY.TAB,            KEY.Q,              KEY.W,              KEY.E,              KEY.R,              KEY.T,              KEY.Y,              KEY.U,          KEY.I, 
    KEY.O,              KEY.P,              KEY.OPEN_BRACKET,   KEY.CLOSE_BRACKET,  KEY.BACKSLASH,      KEY.DELETE,         KEY.HOME,           KEY.PAGE_DOWN,      KEY.NUM_7,      KEY.NUM_8, 
    KEY.NUM_9,          KEY.NUM_PLUS ],     
      
    [  
    KEY.G4,             KEY.CAPS_LOCK,      KEY.A,              KEY.S,              KEY.D,              KEY.F,              KEY.G,              KEY.H,              KEY.J,          KEY.K, 
    KEY.L,              KEY.SEMICOLON,      KEY.APOSTROPHE,     KEY.INVALID,        KEY.ENTER,          KEY.INVALID,        KEY.INVALID,         KEY.INVALID,        KEY.NUM_4,      KEY.NUM_5, 
    KEY.NUM_6 ],        
      
    [  
    KEY.G5,             KEY.LEFT_SHIFT,     KEY.INVALID,        KEY.Z,              KEY.X,              KEY.C,              KEY.V,              KEY.B,              KEY.N,          KEY.M,          
    KEY.COMMA,          KEY.PERIOD,         KEY.FORWARD_SLASH,  KEY.INVALID,        KEY.RIGHT_SHIFT,    KEY.INVALID,        KEY.ARROW_UP,       KEY.INVALID,        KEY.NUM_1,      KEY.NUM_2,      
    KEY.NUM_3,          KEY.NUM_ENTER ],    
      
    [  
    KEY.G6,             KEY.LEFT_CTRL,      KEY.LEFT_WIN,       KEY.LEFT_ALT,       KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.SPACE,          KEY.INVALID,    KEY.INVALID, 
    KEY.INVALID,        KEY.RIGHT_ALT,      KEY.RIGHT_WIN,      KEY.APP_SELECT,     KEY.RIGHT_CTRL,     KEY.ARROW_LEFT,     KEY.ARROW_DOWN,     KEY.ARROW_RIGHT,    KEY.INVALID,    KEY.NUM_0,      
    KEY.NUM_DOT ]
]     

const CorsairMap = [    
    KEY.INVALID,        KEY.ESCAPE,         KEY.F1,             KEY.F2,             KEY.F3,             KEY.F4,             KEY.F5,             KEY.F6,             KEY.F7,         KEY.F8, 
    KEY.F9,             KEY.F10,            KEY.F11,            KEY.TILDE,          KEY.ONE,            KEY.TWO,            KEY.THREE,          KEY.FOUR,           KEY.FIVE,       KEY.SIX, 
    KEY.SEVEN,          KEY.EIGHT,          KEY.NINE,           KEY.ZERO,           KEY.MINUS,          KEY.TAB,            KEY.Q,              KEY.W,              KEY.E,          KEY.R, 
    KEY.T,              KEY.Y,              KEY.U,              KEY.I,              KEY.O,              KEY.P,              KEY.OPEN_BRACKET,   KEY.CAPS_LOCK,      KEY.A,          KEY.S, 
    KEY.D,              KEY.F,              KEY.G,              KEY.H,              KEY.J,              KEY.K,              KEY.L,              KEY.SEMICOLON,      KEY.APOSTROPHE, KEY.LEFT_SHIFT,
    KEY.INVALID,        KEY.Z,              KEY.X,              KEY.C,              KEY.V,              KEY.B,              KEY.N,              KEY.M,              KEY.COMMA,      KEY.PERIOD,
    KEY.FORWARD_SLASH,  KEY.LEFT_CTRL,      KEY.LEFT_WIN,       KEY.LEFT_ALT,       KEY.INVALID,        KEY.SPACE,          KEY.INVALID,        KEY.INVALID,        KEY.RIGHT_ALT,  KEY.RIGHT_WIN,
    KEY.APP_SELECT,     KEY.LED_PROFILE,    KEY.LED_BRIGHTNESS, KEY.F12,            KEY.PRINT_SCREEN,   KEY.SCROLL_LOCK,    KEY.PAUSE_BREAK,    KEY.INSERT,         KEY.HOME,       KEY.PAGE_UP,
    KEY.CLOSE_BRACKET,  KEY.BACKSLASH,      KEY.INVALID,        KEY.ENTER,          KEY.INVALID,        KEY.EQUALS,         KEY.INVALID,        KEY.BACKSPACE,      KEY.DELETE,     KEY.END,
    KEY.PAGE_DOWN,      KEY.RIGHT_SHIFT,    KEY.RIGHT_CTRL,     KEY.ARROW_UP,       KEY.ARROW_LEFT,     KEY.ARROW_DOWN,     KEY.ARROW_RIGHT,    KEY.WIN_LOCK,       KEY.MUTE,       KEY.STOP,
    KEY.PREV,           KEY.PLAY,           KEY.NEXT,           KEY.NUM_LOCK,       KEY.NUM_SLASH,      KEY.NUM_ASTERISK,   KEY.NUM_MINUS,      KEY.NUM_PLUS,       KEY.NUM_ENTER,  KEY.NUM_7,
    KEY.NUM_8,          KEY.NUM_9,          KEY.INVALID,        KEY.NUM_4,          KEY.NUM_5,          KEY.NUM_6,          KEY.NUM_1,          KEY.NUM_2,          KEY.NUM_3,      KEY.NUM_0,
    KEY.NUM_DOT,        KEY.INVALID,        KEY.INVALID,        KEY.G1,             KEY.INVALID,        KEY.INVALID,        KEY.G2,             KEY.INVALID,        KEY.INVALID,    KEY.G3,
    KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.G4,         KEY.INVALID,
    KEY.INVALID,        KEY.G5,             KEY.INVALID,        KEY.INVALID,        KEY.G6,             KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,    KEY.INVALID,
    KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,    KEY.INVALID,
    KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,        KEY.INVALID,    KEY.INVALID,
    KEY.BAR_1,          KEY.BAR_2,          KEY.BAR_3,          KEY.BAR_4,          KEY.BAR_5,          KEY.BAR_6,          KEY.BAR_7,          KEY.BAR_8,          KEY.BAR_9 ,     KEY.BAR_10,
    KEY.BAR_11,         KEY.BAR_12,         KEY.BAR_13,         KEY.BAR_14,         KEY.BAR_15,         KEY.BAR_16,         KEY.BAR_17,         KEY.BAR_18,         KEY.BAR_19,     KEY.INVALID
]

const CorsairVisualizerRows = [
    [ KEY.G6, KEY.G5, KEY.G4, KEY.G3, KEY.G2, KEY.G1, KEY.BAR_1],
    [ KEY.LEFT_CTRL, KEY.LEFT_SHIFT, KEY.CAPS_LOCK, KEY.TAB, KEY.TILDE, KEY.ESCAPE, KEY.BAR_2, KEY.INVALID, KEY.INVALID ],
    [ KEY.LEFT_WIN, KEY.Z, KEY.A, KEY.Q, KEY.ONE, KEY.F1, KEY.LED_PROFILE, KEY.BAR_3, KEY.INVALID, KEY.INVALID, KEY.INVALID  ],
    [ KEY.LEFT_ALT, KEY.X, KEY.S, KEY.W, KEY.TWO, KEY.F2, KEY.LED_BRIGHTNESS, KEY.BAR_4, KEY.INVALID ],
    [ KEY.INVALID, KEY.C, KEY.D, KEY.E, KEY.THREE, KEY.F3, KEY.WIN_LOCK, KEY.BAR_5 ],
    [ KEY.INVALID, KEY.V, KEY.F, KEY.R, KEY.FOUR, KEY.F4, KEY.BAR_6 ],
    [ KEY.SPACE, KEY.B, KEY.G, KEY.T, KEY.FIVE, ],
    [ KEY.N, KEY.H, KEY.Y, KEY.SIX, KEY.F5 ],
    [ KEY.M, KEY.J, KEY.U, KEY.SEVEN, KEY.F6, KEY.BAR_7 ],
    [ KEY.COMMA, KEY.K, KEY.I, KEY.EIGHT, KEY.F7, KEY.BAR_8 ],
    [ KEY.PERIOD, KEY.L, KEY.O, KEY.NINE, KEY.F8, KEY.BAR_9 ],
    [ KEY.RIGHT_ALT, KEY.PERIOD, KEY.L, KEY.O, KEY.NINE, KEY.F8, KEY.BAR_10 ],
    [ KEY.RIGHT_WIN, KEY.FORWARD_SLASH, KEY.SEMICOLON, KEY.P, KEY.ZERO, KEY.BAR_11 ],
    [ KEY.APP_SELECT, KEY.APOSTROPHE, KEY.OPEN_BRACKET, KEY.MINUS, KEY.F9, KEY.BAR_12 ],
    [ KEY.INVALID, KEY.INVALID, KEY.CLOSE_BRACKET, KEY.EQUALS, KEY.F10, KEY.BAR_13 ],
    [ KEY.RIGHT_CTRL, KEY.RIGHT_SHIFT, KEY.ENTER, KEY.BACKSLASH, KEY.BACKSPACE, KEY.F12, KEY.BAR_14 ],
]

const CorsairVisualizerRowColors = [    
    [ 255,   0,   0], 
    [ 225,  30,   0],
    [ 195,  60,   0],
    [ 165,  90,   0],
    [ 135, 120,   0],
    [ 105, 150,   0],
    [  75, 180,   0],
    [  45, 210,   0],
    [   0, 255,   0],
    [   0, 225,  30],
    [   0, 195,  60],
    [   0, 165,  90],
    [   0, 135, 120],
    [   0, 105, 150],
    [   0,  75, 180],
    [   0,  45, 210],
    [   0,   0, 255],
]

const KEY_LIGHTING = [];