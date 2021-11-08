import express from 'express';
import SSE from 'express-sse';
//var SSE = require('express-sse');

import { ITransport, Obj } from './types';

let log = console.log;

let app = express();

type Cb = (packet: Obj) => Promise<void>;
type Thunk = () => void;
class TransportHttpServer implements ITransport {
    cbs: Set<Cb> = new Set();
    sse: any;
    app: any;
    constructor(app: any, public port: number) {
        log('constructor...');
        log('set up listening for incoming POSTs');
        this.app = app;
        // listen for incoming POSTs
        app.post('/sync:' + this.port, (req: any, res: any) => {
            log('got a POST');
            this.onReceive(JSON.parse(req.body));
        });

        // set up SSE for outgoing messages
        log('set up SSE for outoing messages');
        this.sse = new SSE();
        app.get('/sync:' + this.port, this.sse.init);

        log('...constructor is done.');
    }
    async send(packet: Obj): Promise<void> {
        log('send: sending a message via sse:', JSON.stringify(packet));
        this.sse.send(JSON.stringify(packet));
        log('...send is done.');
    }
    onReceive(cb: Cb): Thunk {
        this.cbs.add(cb);
        return () => this.cbs.delete(cb);
    }
}

//================================================================================
let main = async () => {
    log('main (server)');
    let PORT = 8123;

    let transport = new TransportHttpServer(app, PORT);

    log('main: sending hello world...');
    await transport.send({hello: 'world', from: 'server'})
    log('main: ...done sending.');

    log('main: setting up default / route in express');
    app.get('/', (req, res) => {
        res.send('Hello world')
    })

    log('main: listening...');
    app.listen(PORT, () => console.log(`server is listening on https://localhost:${PORT}`));

    log('...main is done.');
}
main();