import { Chan } from 'concurrency-friends';

import {
    ITransport,
    Message,
    Thunk,
} from './types';
import { logTransport } from './util';

/*
    The most basic transport -- you provide it with input and output Chans.
    If either Chan becomes closed, this will close the other one, and close itself.
    Or you can close this Transport and it will close the Chans for you.
*/
export class TransportBasic implements ITransport<Message> {
    inChan: Chan<Message>;
    outChan: Chan<Message>;
    _isClosed: boolean = false;
    _onCloseCbs: Set<Thunk> = new Set();
    constructor(inChan: Chan<Message>, outChan: Chan<Message>) {
        logTransport('constructor');
        this.inChan = inChan;
        this.outChan = outChan;
        this.inChan.onClose.subscribe(() => { this.close(); });
        this.outChan.onClose.subscribe(() => { this.close(); });
    }
    get isClosed() {
        return this._isClosed;
    }
    close() {
        logTransport('/--transport.close - ');
        if (this._isClosed) {
            logTransport('\\__transport.close - was already closed');
            return;
        }
        this._isClosed = true;
        logTransport(' - transport.close - running onClose cbs');
        for (let cb of this._onCloseCbs) { cb(); }
        logTransport(' - transport.close - closing Chans');
        this.inChan.close();
        this.outChan.close();
        logTransport('\\__transport.close - done');
    }
    onClose(cb: Thunk): Thunk {
        logTransport('transport.onClose subscription being added');
        this._onCloseCbs.add(cb);
        return () => { this._onCloseCbs.delete(cb); }
    }
}

/*
    Make a pair of Transports which are locally connected (on the same machine).
    The input of one is the output of the other, and vice versa.
    This is mostly useful for testing.
*/
export let makeTransportLocalPair = (): [ITransport<Message>, ITransport<Message>] => {
    // Make chans with a buffer size of zero.
    // (A put() blocks until a get() happens, or vice versa).
    const chan1 = new Chan<Message>(0);
    const chan2 = new Chan<Message>(0);
    return [
        new TransportBasic(chan1, chan2),
        new TransportBasic(chan2, chan1),
    ];
}

