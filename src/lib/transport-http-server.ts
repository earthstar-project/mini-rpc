import express from 'express';
import SSE from 'express-sse';

import { CONNECTION_STATUS, ITransport, Obj } from './types';
import { sleep } from './util';

let log = (...args: any[]) => console.log('SERVER  ', ...args);

let SSE_PATH = '/sync/sse'
let POST_PATH = '/sync/post'

type Cb = (packet: Obj) => Promise<any>;
type Thunk = () => void;
export class TransportHttpServer implements ITransport {
    _cbs: Set<Cb> = new Set();
    _sse: any;
    app: any;
    _heartbeatInterval: any;
    constructor(app?: any) {
        log('constructor...');
        log('constructor: set up listening for incoming POSTs');
        if (!app) {
            app = express();
        }
        this.app = app;
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
    status(): CONNECTION_STATUS {
        // we don't know how many peers are connected to us
        return 'CLOSED'; //  TODO: ?
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
