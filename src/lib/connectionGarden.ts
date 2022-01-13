import fetch from 'cross-fetch';
import { SuperbusMap } from 'superbus-map';
import { Chan } from 'concurrency-friends';
import { Connection, ConnectionStatus, Envelope, EnvelopeNotify, EnvelopeRequest, EnvelopeResponse, EnvelopeResponseWithData, EnvelopeResponseWithError, IConnectionGarden, OpenOrClosed, Thunk } from './types';
import { Atom } from './atom';
import { Deferred, makeDeferred, makeId, sleep } from './util';

export class Postman {
    garden: IConnectionGarden;
    status: Atom<OpenOrClosed> = new Atom('OPEN' as OpenOrClosed);
    _methods: Record<string, any> = new Map();  // method -> handler fn
    _deferreds: Map<string, Deferred<any>> = new Map();  // envelope id -> deferred
    constructor(garden: IConnectionGarden, methods: Record<string, any>) {
        this.garden = garden;
        this._methods = methods;

        // Read from garden streams
        this.garden.connections.forEach((conn) => {
            conn.inStream.forEach(async (env) => {
                if (env.kind === 'NOTIFY') {
                    let handler = this._methods[env.method];
                    if (handler !== undefined) {
                        await handler(...env.args);
                    }
                } else if (env.kind === 'REQUEST') {
                    let handler = this._methods[env.method];
                    try {
                        if (handler === undefined) {
                            throw new Error(`no handler for method: ${env.method}`);
                        }
                        let data = await handler(...env.args);
                        const response: EnvelopeResponseWithData = {
                            kind: 'RESPONSE',
                            fromGardenId: this.garden.gardenId,
                            envelopeId: env.envelopeId,
                            data,
                        }
                        await conn.outStream.put(response);
                    } catch (error) {
                        const response: EnvelopeResponseWithError = {
                            kind: 'RESPONSE',
                            fromGardenId: this.garden.gardenId,
                            envelopeId: env.envelopeId,
                            error: `${error}`,
                        }
                        await conn.outStream.put(response);
                    }
                } else if (env.kind === 'RESPONSE') {
                    let deferred = this._deferreds.get(env.envelopeId);
                    if (deferred === undefined) {
                        console.warn('no deferred exists for envelope id:', env.envelopeId);
                        return;
                    }
                    if ('data' in env) {
                        deferred.resolve(env.data);
                    } else if ('error' in env) {
                        deferred.reject(new Error(env.error));
                    } else {
                        console.warn('RESPONSE had neither data nor error set');
                    }
                } else {
                    console.warn('unexpected env kind:', (env as Envelope).kind);
                }
            });
        });
    }

    async notify(otherGardenId: string, method: string, ...args: any[]): Promise<void> {
        if (otherGardenId === this.garden.gardenId) {
            throw new Error("can't use a postman to call itself");
        }
        const env: EnvelopeNotify = {
            kind: 'NOTIFY',
            fromGardenId: this.garden.gardenId,
            envelopeId: 'envelope:' + makeId(),
            method,
            args,
        };
        const conn = this.garden.connections.get(otherGardenId);
        if (conn === undefined) {
            console.warn('no such garden id:', otherGardenId);
            return;
        }
        await conn.outStream.put(env);
    }

    async request(otherGardenId: string, method: string, ...args: any[]): Promise<any> {
        if (otherGardenId === this.garden.gardenId) {
            throw new Error("can't use a postman to call itself");
        }
        const env: EnvelopeRequest = {
            kind: 'REQUEST',
            fromGardenId: this.garden.gardenId,
            envelopeId: 'envelope:' + makeId(),
            method,
            args,
        };
        const conn = this.garden.connections.get(otherGardenId);
        if (conn === undefined) {
            console.warn('no such garden id:', otherGardenId);
            return;
        }
        let deferred = makeDeferred<any>();
        this._deferreds.set(env.envelopeId, deferred);
        await conn.outStream.put(env);
        return deferred.promise;
    }

    close() {
        this.status.setAndNotify('CLOSED');
    }
}

export class ConnectionGardenLocal implements IConnectionGarden {
    connections: SuperbusMap<string, Connection> = new SuperbusMap();
    gardenId: string = 'garden:' + makeId();  // id of the garden, not the connection(s).
    constructor() { }
    connectToOtherGarden(otherGarden: ConnectionGardenLocal): Connection {
        const conn: Connection = {
            otherGardenId: otherGarden.gardenId,
            status: new Atom<ConnectionStatus>('OPEN'),
            inStream: new Chan<Envelope>(0),
            outStream: new Chan<Envelope>(0),
            close: () => {},
        }

        conn.close = () => {
            // Closures only propagate downwards in the hierarchy
            conn.inStream.close();
            conn.outStream.close();
            if (conn.otherGardenId !== null) {
                this.connections.delete(conn.otherGardenId);
            }
            conn.status.setAndNotify('CLOSED');
        }

        return conn;
    }
    close(): void {
        this.connections.forEach((conn) => { conn.close(); });
    }
}

export let makeLocalGardenPair = (): [ConnectionGardenLocal, ConnectionGardenLocal] => {
    let garden1 = new ConnectionGardenLocal();
    let garden2 = new ConnectionGardenLocal();
    let conn1to2 = garden1.connectToOtherGarden(garden2);
    let conn2to1 = garden2.connectToOtherGarden(garden1);

    conn1to2.outStream.forEach(async (env) => {
        await conn2to1.inStream.put(env);
    });
    conn2to1.outStream.forEach(async (env) => {
        await conn1to2.inStream.put(env);
    });

    garden1.connections.set(garden2.gardenId, conn2to1);
    garden2.connections.set(garden1.gardenId, conn1to2);

    return [garden1, garden2];
}

export class ConnectionGardenHttpClientSide implements IConnectionGarden {
    connections: SuperbusMap<string, Connection> = new SuperbusMap();
    gardenId: string = makeId();
    constructor(urls: string[]) {
        for (const url of urls) {
            this.addConnection(url);
        }
    }
    addConnection(url: string): Connection {
        const conn: Connection = {
            otherGardenId: null,  // Unknown until we get the first env from them
            otherUrlOrIp: url,
            status: new Atom<ConnectionStatus>('CONNECTING'),
            inStream: new Chan<Envelope>(0),
            outStream: new Chan<Envelope>(0),
            close: () => {},
        }

        conn.close = () => {
            // Closures only propagate downwards in the hierarchy
            conn.inStream.close();
            conn.outStream.close();
            if (conn.otherGardenId !== null) {
                this.connections.delete(conn.otherGardenId);
            }
            conn.status.setAndNotify('CLOSED');
        }

        let outgoingBatch: Envelope[] = [];

        conn.outStream.forEach((env: Envelope) => {
            outgoingBatch.push(env);
        });

        // POST the outgoing batch to server and receive incoming batch back
        // Do this in a separate thread
        setTimeout(async () => {
            while (conn.status.get() !== 'CLOSED') {
                // The fetch might take a while to complete, so we need
                // to make a separate list of envelopes to send so we
                // can correctly put them back if something fails
                // and new envelopes have been put into the outgoingBatch
                // in the meantime.

                // TODO: only send up to N outgoing envelopes per batch
                const batchToSendNow = [...outgoingBatch];
                outgoingBatch = [];
                try {
                    // Send the outgoing envelopes
                    const res = await fetch(conn.otherUrlOrIp as string, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', },
                        body: JSON.stringify([batchToSendNow]),
                    });
                    if (!res.ok) {
                        throw new Error(`POST not ok: ${res.status}`);
                    }
                    conn.status.setAndNotify('OPEN');
                    // Ingest incoming batch from server
                    const incomingBatch = await res.json() as Envelope[];
                    for (let env of incomingBatch) {
                        // We've just learned the server's id
                        conn.otherGardenId = env.fromGardenId;
                        // ...so now we can save the connection to our Map
                        if (!this.connections.has(env.fromGardenId)) {
                            this.connections.set(env.fromGardenId, conn);
                        }
                        // Put the incoming envelope into the stream
                        await conn.inStream.put(env);
                    }
                } catch (error) {
                    console.warn(error);
                    // Failed to send; put the batchToSend back into the buffer
                    // so we don't lose anything
                    outgoingBatch = [...outgoingBatch, ...batchToSendNow];
                    // Set status to ERROR, but keep trying.
                    // This will go back to OPEN if we succeed.
                    conn.status.setAndNotify('ERROR');
                }
                // Don't poll the server too hard.
                await sleep(4000);
            }
        }, 0);

        return conn;
    }
    close(): void {
        this.connections.forEach((conn) => { conn.close(); });
    }
}


