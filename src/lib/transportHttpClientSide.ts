import { Chan } from 'concurrency-friends';
import fetch from 'cross-fetch';

import { ITransport, Message, Thunk } from './types';
import { sleep } from './util';

/*
    Make a transport which runs on the client side of an HTTP connection.
    This is inefficient right now:
    Every few seconds it pushes up outgoing messages to the server with
    a POST, and the server respons with new incoming messages for us.
    In both directions we send batches of messages as JSON arrays.
    If there are no messages we send empty arrays.
*/
export class TransportHttpClientSide implements ITransport<Message> {
    inChan: Chan<Message>;
    outChan: Chan<Message>;
    _isClosed: boolean = false;
    _onCloseCbs: Set<Thunk> = new Set();
    _url: string;
    constructor(url: string) {
        this._url = url;

        // Make chans with a buffer size of zero.
        // (A put() blocks until a get() happens, or vice versa).
        this.inChan = new Chan<Message>(0);
        this.outChan = new Chan<Message>(0);
        this.inChan.onClose.subscribe(() => {this.close(); });
        this.outChan.onClose.subscribe(() => { this.close(); });

        // Our strategy is: poll the server every few seconds with
        // a POST of our outgoing messages, and it will return any
        // messages it has batched up for us.

        // Continuously pull outgoing messagaes from the outChan and put into a buffer
        let outgoingBatch: Message[] = [];
        this.outChan.forEach((msg: Message) => {
            outgoingBatch.push(msg);
        });

        // Start a new thread to poll the server
        setTimeout(async () => {
            while (!this._isClosed) {
                // The fetch might take a while to complete, so we need
                // to make a separate list of messages to send so we
                // can correctly put them back if something fails
                // and new messages have been put into the outgoingBatch
                // in the meantime.
                let batchToSendNow = [...outgoingBatch];
                outgoingBatch = [];
                try {
                    // Send the outgoing messages
                    // TODO: only send up to N outgoing messages per batch
                    let res = await fetch(this._url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify([batchToSendNow]),
                    });
                    if (!res.ok) {
                        throw new Error(`POST not ok: ${res.status}`);
                    }
                    // Ingest the batch of incoming messages that the server sent us
                    let incomingBatch = await res.json() as Message[];
                    for (let msg of incomingBatch) {
                        await this.inChan.put(msg);
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
