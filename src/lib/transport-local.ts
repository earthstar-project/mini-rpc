import {
    logTransport,
} from './util';

import {
    Thunk,
    Obj,
    ITransport,
} from './types';

//================================================================================

type Cb = (packet: Obj) => Promise<any>;
export class TransportLocal implements ITransport {
    _otherTransport: TransportLocal;
    _cbs: Set<Cb> = new Set();
    _onReceiveCb: null | Cb = null;
    constructor(public debugName: string = '') {
        this._otherTransport = null as any;  // hack for now
    }
    async send(packet: Obj): Promise<void> {
        logTransport(this.debugName, 'send()');
        logTransport(this.debugName, JSON.stringify(packet));
        setTimeout(() => {
            this._otherTransport._handleReceive(packet);
        }, 1);
        logTransport(this.debugName, '...send() done.');
    }
    async _handleReceive(packet: Obj): Promise<void> {
        logTransport(this.debugName, '-------------------------------');
        logTransport(this.debugName, '_handleReceive()');
        logTransport(this.debugName, JSON.stringify(packet));
        for (let cb of this._cbs) {
            let result = await cb(packet);
            if (result) {
                this.send(result);
            }
        }
        logTransport(this.debugName, '..._handleReceive() done.');
    }
    onReceive(cb: (packet: Obj) => Promise<void>): Thunk {
        this._cbs.add(cb);
        return () => this._cbs.delete(cb);
    }
    close(): void {}
}

export let makePairOfTransportLocal = (): [TransportLocal, TransportLocal] => {
    let t1 = new TransportLocal('client');
    let t2 = new TransportLocal('  server');
    t1._otherTransport = t2;
    t2._otherTransport = t1;
    return [t1, t2];
}
