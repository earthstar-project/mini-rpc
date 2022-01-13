import {
    IPeerConnection,
    ITransport,
    Envelope,
    EnvelopeNotify,
    EnvelopeRequest,
    EnvelopeResponse,
    EnvelopeResponseWithData,
    EnvelopeResponseWithError,
    Thunk,
} from './types';
import {
    Deferred,
    logPeer,
    makeDeferred,
    makeId,
} from './util';

export class PeerConnection implements IPeerConnection {
    _transport: ITransport<Envelope>;
    _notifyCbs: Set<any> = new Set();
    _requestCbs: Set<any> = new Set();
    _closeCbs: Set<any> = new Set();
    _isClosed: boolean = false;
    _deferredRequests: Map<string, Deferred<EnvelopeResponse>> = new Map(); // keys are ids
    _peerId: string = makeId();

    constructor(transport: ITransport<Envelope>) {
        logPeer('/--constructor', this.peerId);
        this._transport = transport;
        this._transport.onClose(() => { this.close(); });

        // Set up envelope handlers.
        // This infinite loop runs in its own thread
        // and pulls from the inChan until the inChan is closed.
        logPeer(' - constructor starting handler thread', this.peerId);
        setTimeout(async () => {
            logPeer(' - handler thread: begin');
            while (!this._isClosed) {
                let env: Envelope;
                try {
                    logPeer(' - handler: awaiting envelope from inChan', this.peerId);
                    env = await this._transport.inChan.get();
                } catch(err) {
                    // inChan was closed.  End the thread.
                    logPeer('!- handler: inChan was closed; end the thread.', this.peerId);
                    return;
                }
                if (env.kind === 'NOTIFY') {
                    // Got a notify envelope, no response needed
                    logPeer('/--handler: handling a NOTIFY, running onNotify cbs', this.peerId);
                    for (const cb of this._notifyCbs) {
                        await cb(env);
                    }
                    logPeer('\\__handler: handled a NOTIFY', this.peerId);
                } else if (env.kind === 'REQUEST') {
                    // Got a request, reply with a response
                    logPeer('/--handler: handling a REQUEST. running onRequest callbacks', this.peerId);
                    for (const cb of this._requestCbs) {
                        try {
                            const data = await cb(env.method, ...env.args);
                            // successful call to the onRequest callback
                            logPeer(' - handler: cb was successful, sending a RESPONSE with data');
                            let response: EnvelopeResponseWithData = {
                                kind: 'RESPONSE',
                                fromGardenId: this._peerId,
                                envelopeId: env.envelopeId,
                                data
                            };
                            await this._transport.outChan.put(response);
                        } catch (error) {
                            // error in the onRequest callback
                            logPeer('    handler: cb was a fail, sending a RESPONSE with error');
                            let response: EnvelopeResponseWithError = {
                                kind: 'RESPONSE',
                                fromGardenId: this._peerId,
                                envelopeId: env.envelopeId,
                                error
                            };
                            await this._transport.outChan.put(response);
                        }
                    }
                    logPeer('\\__handler: handled a REQUEST.', this.peerId);
                } else if (env.kind === 'RESPONSE') {
                    // Got a response back, match it up with the original request promise and resolve it
                    logPeer('/--handler: handling a RESPONSE.  looking up the deferred...', this.peerId);
                    const deferred = this._deferredRequests.get(env.envelopeId);
                    if (deferred === undefined) {
                        console.error('WARNING: unexpected response id:', env.envelopeId);
                    } else {
                        logPeer(' - handler: resolving the deferred with the data or error...', this.peerId);
                        this._deferredRequests.delete(env.envelopeId);
                        if ('data' in env) {
                            deferred.resolve(env.data);
                        } else if ('error' in env) {
                            deferred.reject(env.error);
                        } else {
                            console.error('WARNING: malformed response', env);
                            deferred.reject('malformed response');
                        }
                        logPeer('\\__handler: handled a RESPONSE', this.peerId);
                    }
                } else {
                    console.error(`WARNING: unexpected envelope kind: ${(env as any).kind} |`, env);
                }
            }
        }, 0);
        logPeer('\\__constructor', this.peerId);
    }

    get peerId(): string {
        return this._peerId;
    }

    async notify(method: string, ...args: any[]): Promise<void> {
        const env: EnvelopeNotify = {
            kind: 'NOTIFY',
            fromGardenId: this._peerId,
            envelopeId: makeId(),
            method,
            args,
        };
        await this._transport.outChan.put(env);
    }
    onNotify(cb: (env: EnvelopeNotify) => void): Thunk {
        this._notifyCbs.add(cb);
        return () => { this._notifyCbs.delete(cb); }
    }

    async request(method: string, ...args: any[]): Promise<any> {
        const envelopeId = makeId();
        // TODO: we could accumulate a lot of leftover deferreds here
        // if the other side is not responding.  We should occasionally
        // remove old ones.  (We'd have to track the time they were created.)
        let deferred = makeDeferred<EnvelopeResponse>();
        this._deferredRequests.set(envelopeId, deferred);
        const env: EnvelopeRequest = {
            kind: 'REQUEST',
            fromGardenId: this._peerId,
            envelopeId,
            method,
            args,
        };
        await this._transport.outChan.put(env);
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
