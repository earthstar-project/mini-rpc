import {
    ChanPair,
    IPeerConnection,
    Message,
    MessageNotify,
    MessageRequest,
    MessageResponse,
    Thunk,
} from './types';
import {
    Deferred,
    makeDeferred,
    makeId,
} from './util';

export class PeerConnection implements IPeerConnection {
    _chanPair: ChanPair<Message>;
    _notifyCbs: Set<any> = new Set();
    _requestCbs: Set<any> = new Set();
    _closeCbs: Set<any> = new Set();
    _isClosed: boolean = false;
    _deferredRequests: Map<string, Deferred<MessageResponse>> = new Map(); // keys are ids

    constructor(chanPair: ChanPair<Message>) {
        this._chanPair = chanPair;

        // Set up message handlers.
        // This infinite loop runs in its own thread
        // and pulls from the inChan until the inChan is closed.

        // If either channel in the pair is closed, stop the thread.
        let handleClose = () => {
            if (!this._isClosed) {
                this._isClosed = true;
                for (let cb of this._closeCbs) { cb(); }
            }
        }
        this._chanPair.inChan.onClose.subscribe(handleClose);
        this._chanPair.outChan.onClose.subscribe(handleClose);

        setTimeout(async () => {
            while (!this._isClosed) {
                let msg: Message;
                try {
                    msg = await this._chanPair.inChan.get();
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
                        const messageResponse = await cb(msg);
                        await this._chanPair.outChan.put(messageResponse);
                    }
                } else if (msg.kind === 'RESPONSE') {
                    // Got a response back, match it up with the original request
                    const deferred = this._deferredRequests.get(msg.id);
                    if (deferred === undefined) {
                        console.error('WARNING: unexpected response id:', msg.id);
                    } else {
                        if ('data' in msg) {
                            deferred.resolve(msg.data);
                        } else if ('error' in msg) {
                            deferred.reject(msg.error);
                        } else {
                            console.error('WARNING: malformed response', msg);
                        }
                    }
                } else {
                    const kind = (msg as any).kind;
                    console.error(`WARNING: unexpected message kind: ${kind} |`, msg);
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
        await this._chanPair.outChan.put(msg);
    }
    onNotify(cb: (msg: MessageNotify) => void): Thunk {
        this._notifyCbs.add(cb);
        return () => { this._notifyCbs.delete(cb); }
    }

    async request(method: string, ...args: any[]): Promise<any> {
        const id = makeId();
        // TODO: we could accumulate a lot of leftover deferreds here
        // if the other side is not responding.  We should occasionally
        // remove old ones.  We'd have to track the time they were created.
        let deferred = makeDeferred<MessageResponse>();
        this._deferredRequests.set(id, deferred);
        const msg: MessageRequest = {
            kind: 'REQUEST',
            id,
            method,
            args,
        };
        await this._chanPair.outChan.put(msg);
        return deferred.promise;
    }
    onRequest(cb: (request: MessageRequest) => Promise<MessageResponse>): Thunk {
        this._requestCbs.add(cb);
        return () => { this._requestCbs.delete(cb); }
    }

    seal() {
        this._chanPair.inChan.seal();
        this._chanPair.outChan.seal();
    }
    close() {
        // This will trigger onClose via a roundabout trip through chan.onClose
        this._chanPair.inChan.close();
        this._chanPair.outChan.close();
    }
    onClose(cb: Thunk): Thunk {
        this._closeCbs.add(cb);
        return () => { this._closeCbs.delete(cb); }
    }
}
