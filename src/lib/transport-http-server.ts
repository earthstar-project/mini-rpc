import express, { response } from 'express';
import SSE from 'express-sse';

import { ITransport, Obj } from './types';
import { sleep } from './util';

let log = (...args: any[]) => console.log('SERVER  ', ...args);

let SSE_PATH = '/sync/sse'
let POST_PATH = '/sync/post'

type Cb = (packet: Obj) => Promise<any>;
type Thunk = () => void;
class TransportHttpServer implements ITransport {
    _cbs: Set<Cb> = new Set();
    _sse: any;
    _app: any;
    _heartbeatInterval: any;
    constructor(app: any) {
        log('constructor...');
        log('constructor: set up listening for incoming POSTs');
        this._app = app;
        app.use(express.json());
        // listen for incoming POSTs
        app.post(POST_PATH, async (req: any, res: any) => {
            log('!! express got a POST request at ' + POST_PATH);
            for (let cb of this._cbs) {
                let resPacket = await cb(req.body);
                if (resPacket) {
                    await this.send(resPacket);
                }
            }
            await sleep(2000);
            res.sendStatus(200);
        });

        // set up SSE for outgoing messages
        log('constructor set up SSE for outoing messages at ' + SSE_PATH);
        this._sse = new SSE();
        app.get(SSE_PATH, this._sse.init);

        // turn on heartbeat
        let heartbeatInterval = setInterval(() => this._sendHeartbeat(), 10000);

        log('...constructor is done.');
    }
    async send(packet: Obj): Promise<void> {
        // TODO: no way of knowing if anyone is hearing us or not
        log('send: sending a message via sse:', packet);
        this._sse.send(packet);
        log('...send is done.');
    }
    async _sendHeartbeat(): Promise<void> {
        log('(heartbeat)');
        this._sse.send();
    }
    onReceive(cb: Cb): Thunk {
        this._cbs.add(cb);
        return () => this._cbs.delete(cb);
    }
    close(): void {
        clearInterval(this._heartbeatInterval());
    }
}

//================================================================================
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