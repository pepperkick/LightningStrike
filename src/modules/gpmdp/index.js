import WebSocket from "ws";
import debug from "debug";

const log = debug("app:module:gpmdp");
const token = "8696991a-1f1d-4243-b857-03a60957ebfd";

let playlistQuery;

export default (app) => {
    try {
        const ws = new WebSocket("ws://localhost:5672");

        ws.on('open', () => {
            log("Socket connected!");   
            
            ws.send(JSON.stringify({
                "namespace": "connect",
                "method": "connect",
                "arguments": [ "LightningStrike", token ]
            }));
        });
        
        ws.on('message', (data) => {
            const obj = JSON.parse(data);
    
            // log(data);
    
            if (obj.requestID === 1) {
                if (obj.value === 2) {
                    ws.send(JSON.stringify({
                        "namespace": "playback",
                        "method": "playPause"
                    }));
                    
                    app.effect("effect_rainbow");
                }
            }
    
            if (obj.requestID === 2) {
                if (obj.value === 1) {
                    ws.send(JSON.stringify({
                        "namespace": "playback",
                        "method": "playPause"
                    }));
                    
                    app.effect("sync_music");
                }
            }
    
            if (obj.requestID === 3) {
                if (obj.value.tracks[0]) {
                    log(obj.value.tracks[0]);
                    
                    ws.send(JSON.stringify({
                        "namespace": "search",
                        "method": "playResult",
                        "arguments": [ obj.value.tracks[0] ]
                    }));
    
                    app.effect("sync_music");
                }
            }
    
            if (obj.requestID === 5 && playlistQuery) {
                for (let i in obj.value) {
                    const playlist = obj.value[i];
    
                    if (playlist.name.toLowerCase() === playlistQuery.toLowerCase()) {
                        log(playlist);
    
                        ws.send(JSON.stringify({
                            "namespace": "playlists",
                            "method": "play",
                            "arguments": [ playlist ]
                        }));
    
                        ws.send(JSON.stringify({
                            "namespace": "playback",
                            "method": "setShuffle",
                            "arguments": [ 'ALL_SHUFFLE' ]
                        }));
    
                        app.effect("sync_music");
                    }
                }
            }
        });
    
        app.express.get("/music/play_pause", (req, res) => {    
            ws.send(JSON.stringify({
                "namespace": "playback",
                "method": "playPause"
            }));
    
            res.sendStatus(200);
        });
    
        app.express.get("/music/pause", (req, res) => {    
            ws.send(JSON.stringify({
                "namespace": "playback",
                "method": "getPlaybackState",
                "requestID": 1
            }));
    
            res.sendStatus(200);
        });
    
        app.express.get("/music/resume", (req, res) => {    
            ws.send(JSON.stringify({
                "namespace": "playback",
                "method": "getPlaybackState",
                "requestID": 2
            }));
    
            res.sendStatus(200);
        });
        
        app.express.get("/music/next", (req, res) => {    
            ws.send(JSON.stringify({
                "namespace": "playback",
                "method": "forward"
            }));
    
            res.sendStatus(200);
        });
    
        app.express.get("/music/previous", (req, res) => {    
            ws.send(JSON.stringify({
                "namespace": "playback",
                "method": "rewind"
            }));
    
            res.sendStatus(200);
        });
    
        app.express.get("/music/search/:query", (req, res) => {    
            const query = req.params.query;
    
            ws.send(JSON.stringify({
                "namespace": "search",
                "method": "performSearch",
                "arguments": [ query ],
                "requestID": 3
            }));
    
            res.sendStatus(200);
        });
    
        app.express.get("/music/playlist/:query", (req, res) => {    
            const query = req.params.query;
    
            playlistQuery = query;
    
            ws.send(JSON.stringify({
                "namespace": "playlists",
                "method": "getAll",
                "requestID": 5
            }))
    
            res.sendStatus(200);
        });
    } catch (error) {
        log(error);
    }
}