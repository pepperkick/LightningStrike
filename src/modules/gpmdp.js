import WebSocket from "ws";
import debug from "debug";

const log = debug("app:module:gpmdp");

export default async (app) => {
    if (!app.config.services.gpmdp.enabled) return;

    
    const cli = app.cli;

    let playlistQuery;
    let isConnected = false;
    let codeFlag = false;
    let ws;

    function login() {
        ws = new WebSocket(`ws://${app.config.services.gpmdp.ip}`);

        ws.on('open', async () => {
            isConnected = true;
    
            log("Socket connected!");        
    
            send({
                "namespace": "connect",
                "method": "connect",
                "arguments": [ "LightningStrike", `${await app.prefs.get('gpmdp-token')}` ]
            });
    
            app.emit('gpmdp-ready', {})
        });
        
        ws.on('message', async (obj) => {
            const data = JSON.parse(obj);
    
            // log(obj);
    
            if (data.channel === "connect" && data.payload === "CODE_REQUIRED") {            
                if (!codeFlag) codeFlag = true;
                else return;
    
                app.cli.query.input('Please enter the 4 digit GPMDP code', (code) => {
                    send({
                        "namespace": "connect",
                        "method": "connect",
                        "arguments": [ "LightningStrike", code ]
                    });
                    codeFlag = false;
                })
            } else if (data.channel === "connect") {
                await app.prefs.set('gpmdp-token', data.payload)
                
                send({
                    "namespace": "connect",
                    "method": "connect",
                    "arguments": [ "LightningStrike", `${await app.prefs.get('gpmdp-token')}` ]
                });
    
                codeFlag = false;
    
                log('Collected GPMDP Token');
                print(cli.chalk.green("Connected to GPMDP!"))
            }
    
            if (data.requestID === 1) {
                if (data.value === 2) {
                    send({
                        "namespace": "playback",
                        "method": "playPause"
                    });
                    
                    app.effect("effect_rainbow");
                }
            }
    
            if (data.requestID === 2) {
                if (data.value === 1) {
                    send({
                        "namespace": "playback",
                        "method": "playPause"
                    });
                    
                    app.effect("sync_music");
                }
            }
    
            if (data.requestID === 3) {
                if (data.value.tracks[0]) {
                    log(data.value.tracks[0]);
                    
                    send({
                        "namespace": "search",
                        "method": "playResult",
                        "arguments": [ data.value.tracks[0] ]
                    });
    
                    app.effect("sync_music");
                }
            }
    
            if (data.requestID === 5 && playlistQuery) {
                for (let i in data.value) {
                    const playlist = data.value[i];
    
                    if (playlist.name.toLowerCase() === playlistQuery.toLowerCase()) {
                        log(playlist);
    
                        send({
                            "namespace": "playlists",
                            "method": "play",
                            "arguments": [ playlist ]
                        });
    
                        send({
                            "namespace": "playback",
                            "method": "setShuffle",
                            "arguments": [ 'ALL_SHUFFLE' ]
                        });
    
                        app.effect("sync_music");
                    }
                }
            }
        });
    
        ws.on("error", error => {
            isConnected = false;

            log(error)
            print(cli.chalk.red("Failed to connect with GPMDP!"))
        });    
    }

    const control = {
        playPause () {    
            send({
                "namespace": "playback",
                "method": "playPause"
            });
        },
        pause () { 
            send({
                "namespace": "playback",
                "method": "getPlaybackState",
                "requestID": 1
            });
        },
        resume () {
            send({
                "namespace": "playback",
                "method": "getPlaybackState",
                "requestID": 2
            });
        },
        next () {
            send({
                "namespace": "playback",
                "method": "forward"
            });
        },
        previous () {
            send({
                "namespace": "playback",
                "method": "rewind"
            });
        }
    }

    function send(obj) {
        if (!isConnected) {
            return log('WS is not ready yet!')
        }

        ws.send(JSON.stringify(obj), (error) => {
            if (error) log(`Failed to send command`, error)
        });
    }

    function print(message) {
        cli.print(`${cli.chalk.cyan("[GPMDP]")} ${message}`);
    }

    login();

    return {
        control,
    
        retryConnection () {
            if (!isConnected) login();
        }
    }
}
