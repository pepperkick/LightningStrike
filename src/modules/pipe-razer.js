import net from 'net';
import debug from 'debug';

const RAZER_PIPE_PATH = "\\\\.\\pipe\\artemis";
const log = debug("app:module:pipe-razer");

export default (app) => {
    let flag = true;

    const server = net.createServer((stream) => {
        stream.on('data', async (data) => {    
            const values = data.toString().split(' ');

            if (flag) app.emit("pipe-razer", values);
        });
    });

    server.listen(RAZER_PIPE_PATH, () => {
        log('Razer pipe Started!');
    });

    return {
        disable () {
            flag = false
            log('Disabled Pipe')
        },
        enable () {
            flag = true
            log('Enabled Pipe')
        },
        isEnabled: () => flag,
        close () {
            server.close()
            log("Closed Pipe")
        }
    }
}