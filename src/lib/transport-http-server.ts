import express from 'express';
import SSE from 'express-sse';
//var SSE = require('express-sse');

import { ITransport, Obj } from './types';

let app = express();

type Cb = (packet: Obj) => Promise<void>;
type Thunk = () => void;
class TransportHttpServer implements ITransport {
    cbs: Set<Cb> = new Set();
    sse: any;
    app: any;
    constructor(app: any, public port: number) {
        this.app = app;
        // listen for incoming POSTs
        app.post('/sync:' + this.port, (req: any, res: any) => {
            this.onReceive(JSON.parse(req.body));
        });

        // set up SSE for outgoing messages
        this.sse = new SSE();
        app.get('/sync:' + this.port, this.sse.init);
    }
    async send(packet: Obj): Promise<void> {
        this.sse.send(JSON.stringify(packet));
    }
    onReceive(cb: Cb): Thunk {
        this.cbs.add(cb);
        return () => this.cbs.delete(cb);
    }
}

//================================================================================
let main = async () => {
    let PORT = 8123;

    let transport = new TransportHttpServer(app, PORT);

    app.get('/', (req, res) => {
        res.send('Hello world')
    })

    app.listen(PORT, () => console.log(`serving on https://localhost:${PORT}`));

    await transport.send({hello: 'world', from: 'server'})
}
main();