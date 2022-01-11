import {
    IPeerConnection,
    ITransport,
    Message,
    MessageNotify,
    MessageRequest,
    MessageResponse,
    MessageResponseWithData,
    MessageResponseWithError,
    Thunk,
} from './types';
import {
    Deferred,
    makeDeferred,
    makeId,
} from './util';

export class PeerConnection implements IPeerConnection {
    _transport: ITransport<Message>;
    _notifyCbs: Set<any> = new Set();
    _requestCbs: Set<any> = new Set();
    _closeCbs: Set<any> = new Set();
    _isClosed: boolean = false;
    _deferredRequests: Map<string, Deferred<MessageResponse>> = new Map(); // keys are ids

    constructor(transport: ITransport<Message>) {
        this._transport = transport;
        this._transport.onClose(() => { this.close(); });

        // Set up message handlers.
        // This infinite loop runs in its own thread
        // and pulls from the inChan until the inChan is closed.
        setTimeout(async () => {
            while (!this._isClosed) {
                let msg: Message;
                try {
                    msg = await this._transport.inChan.get();
                } catch(err) {
                    // inChan was closed.  End the thread.
                    return;
                }
                if (msg.kind === 'NOTIFY') {
                    // Got a notify message, no response needed
                    for (const cb of this._notifyCbs) {
                        await cb(msg);
                    }
                } else if (msg.kind === 'REQUEST') {
                    // Got a request, reply with a response
                    for (const cb of this._requestCbs) {
                        try {
                            const data = await cb(msg.method, ...msg.args);
                            // successful call to the onRequest callback
                            let response: MessageResponseWithData = {
                                kind: 'RESPONSE',
                                id: msg.id,
                                data
                            };
                            await this._transport.outChan.put(response);
                        } catch (error) {
                            // error in the onRequest callback
                            let response: MessageResponseWithError = {
                                kind: 'RESPONSE',
                                id: msg.id,
                                error
                            };
                            await this._transport.outChan.put(response);
                        }
                    }
                } else if (msg.kind === 'RESPONSE') {
                    // Got a response back, match it up with the original request promise and resolve it
                    const deferred = this._deferredRequests.get(msg.id);
                    if (deferred === undefined) {
                        console.error('WARNING: unexpected response id:', msg.id);
                    } else {
                        this._deferredRequests.delete(msg.id);
                        if ('data' in msg) {
                            deferred.resolve(msg.data);
                        } else if ('error' in msg) {
                            deferred.reject(msg.error);
                        } else {
                            console.error('WARNING: malformed response', msg);
                            deferred.reject('malformed response');
                        }
                    }
                } else {
                    console.error(`WARNING: unexpected message kind: ${(msg as any).kind} |`, msg);
                }
            }
        }, 0);
    }

    async notify(method: string, ...args: any[]): Promise<void> {
        const msg: MessageNotify = {
            kind: 'NOTIFY',
            method,
            args,
        };
        await this._transport.outChan.put(msg);
    }
    onNotify(cb: (msg: MessageNotify) => void): Thunk {
        this._notifyCbs.add(cb);
        return () => { this._notifyCbs.delete(cb); }
    }

    async request(method: string, ...args: any[]): Promise<any> {
        const id = makeId();
        // TODO: we could accumulate a lot of leftover deferreds here
        // if the other side is not responding.  We should occasionally
        // remove old ones.  (We'd have to track the time they were created.)
        let deferred = makeDeferred<MessageResponse>();
        this._deferredRequests.set(id, deferred);
        const msg: MessageRequest = {
            kind: 'REQUEST',
            id,
            method,
            args,
        };
        await this._transport.outChan.put(msg);
        return deferred.promise;
    }
    onRequest(cb: (method: string, ...args: any[]) => Promise<any>): Thunk {
        this._requestCbs.add(cb);
        return () => { this._requestCbs.delete(cb); }
    }

    get isClosed() {
        return this._isClosed;
    }
    close() {
        if (!this._isClosed) {
            for (let cb of this._closeCbs) { cb(); }
        }
        this._isClosed = true;
        this._transport.close();
    }
    onClose(cb: Thunk): Thunk {
        this._closeCbs.add(cb);
        return () => { this._closeCbs.delete(cb); }
    }
}
