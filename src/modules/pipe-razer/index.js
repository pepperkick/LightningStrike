import net from 'net';
import debug from 'debug';

const RAZER_PIPE_PATH = "\\\\.\\pipe\\artemis";
const log = debug("pipe-razer")

export default (app) => {
    const server = net.createServer((stream) => {
        stream.on('data', async (data) => {    
            const values = data.toString().split(' ');

            app.emit("pipe-razer", values);
        });
    });

    server.listen(RAZER_PIPE_PATH, () => {
        log('Razer pipe Started!');
    });
}