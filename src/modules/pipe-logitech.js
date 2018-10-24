import net from 'net';
import debug from 'debug';

const LOGITECH_PIPE_PATH = "\\\\.\\pipe\\lightningstrike_logitech";
const log = debug("app:module:pipe-logitech");

export default (app) => {
    let flag = true;

    const server = net.createServer((stream) => {
        stream.on('data', async (data) => {    
            const values = data.toString().split(' ');
            log(values)

            if (flag) app.emit("pipe-logitech", values);
        });
    });

    server.listen(LOGITECH_PIPE_PATH, () => {
        log('Logitech pipe Started!');
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