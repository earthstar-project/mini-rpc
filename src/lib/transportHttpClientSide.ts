import { Chan } from 'concurrency-friends';
import fetch from 'cross-fetch';

import { ITransport, Envelope, Thunk } from './types';
import { sleep } from './util';

/*
    Make a transport which runs on the client side of an HTTP connection.
    This is inefficient right now:
    Every few seconds it pushes up outgoing envelopes to the server with
    a POST, and the server respons with new incoming envelopes for us.
    In both directions we send batches of envelopes as JSON arrays.
    If there are no envelopes we send empty arrays.
*/
export class TransportHttpClientSide implements ITransport<Envelope> {
    inChan: Chan<Envelope>;
    outChan: Chan<Envelope>;
    _isClosed: boolean = false;
    _onCloseCbs: Set<Thunk> = new Set();
    _url: string;
    constructor(url: string) {
        this._url = url;

        // Make chans with a buffer size of zero.
        // (A put() blocks until a get() happens, or vice versa).
        this.inChan = new Chan<Envelope>(0);
        this.outChan = new Chan<Envelope>(0);
        this.inChan.onClose.subscribe(() => {this.close(); });
        this.outChan.onClose.subscribe(() => { this.close(); });

        // Our strategy is: poll the server every few seconds with
        // a POST of our outgoing envelopes, and it will return any
        // envelopes it has batched up for us.

        // Continuously pull outgoing envelopes from the outChan and put into a buffer
        let outgoingBatch: Envelope[] = [];
        this.outChan.forEach((env: Envelope) => {
            outgoingBatch.push(env);
        });

        // Start a new thread to poll the server
        setTimeout(async () => {
            while (!this._isClosed) {
                // The fetch might take a while to complete, so we need
                // to make a separate list of envelopes to send so we
                // can correctly put them back if something fails
                // and new envelopes have been put into the outgoingBatch
                // in the meantime.
                let batchToSendNow = [...outgoingBatch];
                outgoingBatch = [];
                try {
                    // Send the outgoing envelopes
                    // TODO: only send up to N outgoing envelopes per batch
                    let res = await fetch(this._url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify([batchToSendNow]),
                    });
                    if (!res.ok) {
                        throw new Error(`POST not ok: ${res.status}`);
                    }
                    // Ingest the batch of incoming envelopes that the server sent us
                    let incomingBatch = await res.json() as Envelope[];
                    for (let env of incomingBatch) {
                        await this.inChan.put(env);
                    }
                } catch (error) {
                    // Failed to send; put the batchToSend back into the buffer
                    // so we don't lose anything
                    outgoingBatch = [...outgoingBatch, ...batchToSendNow];
                }
                await sleep(4000);
            }
        }, 0);
    }
    get isClosed() {
        return this._isClosed;
    }
    close() {
        if (!this._isClosed) {
            for (let cb of this._onCloseCbs) { cb(); }
        }
        this._isClosed = true;
        this.inChan.close();
        this.outChan.close();
    }
    onClose(cb: Thunk): Thunk {
        this._onCloseCbs.add(cb);
        return () => { this._onCloseCbs.delete(cb); }
    }
}
