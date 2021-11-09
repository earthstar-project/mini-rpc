import express from 'express';

import { TransportHttpServer } from './transport-http-server';
import { Obj } from './types';

let log = (...args: any[]) => console.log('CLIENT  ', ...args);

let main = async () => {
    log('main (server)');
    let PORT = 8008;

    let app = express();
    app.use(express.static('build'))

    log('main: setting up transport');
    let transport = new TransportHttpServer(app);
    transport.onReceive(async (packet: Obj) => {
        log('~~~ SERVER TRANSPORT GOT A MESSAGE:~~~', packet);
        return 'server response: 123'
    });

    log('main: setting up default / route in express');
    app.get('/', (req, res) => {
        res.send('Hello world from server')
    })

    setTimeout(() => {
        log('main: listening...');
        app.listen(PORT, () => console.log(`server is listening on http://localhost:${PORT}`));
    }, 1);

    let ii = 0;
    setInterval(async () => {
        log('----------------------');
        log(`main: --> sending hello world packet ${ii} via sse...`);
        await transport.send({hello: 'world', from: 'server', num: ii})
        log('main: ...done sending.');
        ii += 1
    }, 5000);

    log('...main is done.');
}
main();