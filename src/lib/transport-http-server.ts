import { transcode } from 'buffer';
import express from 'express';
import SSE from 'express-sse';
//var SSE = require('express-sse');

import { ITransport, Obj } from './types';

let log = (...args: any[]) => console.log('SERVER  ', ...args);

type Cb = (packet: Obj) => Promise<void>;
type Thunk = () => void;
class TransportHttpServer implements ITransport {
    cbs: Set<Cb> = new Set();
    sse: any;
    app: any;
    heartbeatInterval: any;
    constructor(app: any, public port: number) {
        log('constructor...');
        log('constructor: set up listening for incoming POSTs');
        this.app = app;
        // listen for incoming POSTs
        app.post('/sync:' + this.port, (req: any, res: any) => {
            log('!! express got a POST request');
            this.onReceive(JSON.parse(req.body));
        });

        // set up SSE for outgoing messages
        log('constructor set up SSE for outoing messages at /sync-sse');
        this.sse = new SSE();
        app.get('/sync-sse:' + this.port, this.sse.init);

        // turn on heartbeat
        let heartbeatInterval = setInterval(() => this._sendHeartbeat(), 10000);

        log('...constructor is done.');
    }
    async send(packet: Obj): Promise<void> {
        // TODO: no way of knowing if anyone is hearing us or not
        log('send: sending a message via sse:', packet);
        this.sse.send(packet);
        log('...send is done.');
    }
    async _sendHeartbeat(): Promise<void> {
        log('(heartbeat)');
        this.sse.send();
    }
    onReceive(cb: Cb): Thunk {
        this.cbs.add(cb);
        return () => this.cbs.delete(cb);
    }
    close(): void {
        clearInterval(this.heartbeatInterval());
    }
}

//================================================================================
let main = async () => {
    log('main (server)');
    let PORT = 8008;

    let app = express();
    app.use(express.static('build'))

    log('main: setting up transport');
    let transport = new TransportHttpServer(app, PORT);
    transport.onReceive(async (packet: Obj) => {
        log('~~~ SERVER TRANSPORT GOT A MESSAGE:~~~', packet);
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