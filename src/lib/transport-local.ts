import {
    logTransport,
} from './util';

import {
    Thunk,
    Obj,
    ITransport,
} from './types';

//================================================================================

export class TransportLocal implements ITransport {
    _otherTransport: TransportLocal;
    _onReceiveCb: null | ((packet: Obj) => Promise<void>) = null;
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
        if (this._onReceiveCb === null) { return; }
        await this._onReceiveCb(packet);
        logTransport(this.debugName, '..._handleReceive() done.');
    }
    onReceive(cb: (packet: Obj) => Promise<void>): Thunk {
        this._onReceiveCb = cb;
        return () => { this._onReceiveCb = null; }
    }
}

export let makePairOfTransportLocal = (): [TransportLocal, TransportLocal] => {
    let t1 = new TransportLocal('client');
    let t2 = new TransportLocal('  server');
    t1._otherTransport = t2;
    t2._otherTransport = t1;
    return [t1, t2];
}
