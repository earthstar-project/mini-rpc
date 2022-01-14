import { Chan } from 'concurrency-friends';
import { SuperbusMap } from 'superbus-map';
import { Atom } from './atom';

export type Thunk = () => void;

//--------------------------------------------------------------------------------
/*
    Either side of a connection can send any of these envelopes in any order,
    but only certain orders will make sense; the rest will be ignored with warnings.

    For example either side can send a REQUEST, and the other side should reply
    with a RESPONSE.

    Expected sequences of envelopes

    * NOTIFY (no response needed)

    * REQUEST --> RESPONSE (with data or with an error)

    * // TODO: stream-related envelopes types: start, cancel, data, end, etc
*/

export type OpenOrClosed = 'OPEN' | 'CLOSED';

export type EnvelopeKind =
    'NOTIFY'
    | 'REQUEST'
    | 'RESPONSE';

export interface EnvelopeNotify {
    kind: 'NOTIFY',
    fromGardenId: string,
    envelopeId: string,
    method: string,
    args: any[],
}
export interface EnvelopeRequest {
    kind: 'REQUEST',
    fromGardenId: string,
    envelopeId: string,
    method: string,
    args: any[],
}
export interface EnvelopeResponseWithData {
    kind: 'RESPONSE',
    fromGardenId: string,
    envelopeId: string,
    data: any,
}
export interface EnvelopeResponseWithError {
    kind: 'RESPONSE',
    fromGardenId: string,
    envelopeId: string,
    error: any,
}
export type EnvelopeResponse =
    EnvelopeResponseWithData
    | EnvelopeResponseWithError;

export type Envelope =
    EnvelopeNotify
    | EnvelopeRequest
    | EnvelopeResponseWithData
    | EnvelopeResponseWithError;

//--------------------------------------------------------------------------------
/*
    A network transport is made of a pair of Chans,
    one for incoming envelopes and one for outgoing envelopes.
    (These are object streams, not byte streams.)

    To send a envelope, do outChan.put(env).

    To close the connection, close or seal either Chan.
    - close() will close it instantly, or
    - seal() will close it after the queue is empty.

    Or you can close the Transport.  In any case, the fate of the Chans
    and the Transport are linked -- close one and they all close.

    If the connection has a network error, everything will be closed.
*/
export interface ITransport<T> {
    inChan: Chan<T>;
    outChan: Chan<T>;
    get isClosed(): boolean;
    close(): void;
    onClose(cb: Thunk): Thunk;
}

//--------------------------------------------------------------------------------
/*
    A PeerConnection wraps around a Transport (e.g. a pair of Chans)
    and helps you send and receive Envelopes over it, and close it.

    If anything becomes closed, they all become closed: PeerConnection, Transport, and both Chans.
*/
export interface IPeerConnection {
    // constructor is given a Transport and any other options like urls and timeouts

    get peerId(): string;  // a random UUID, chosen at every startup

    notify(method: string, ...args: any[]): Promise<void>;
    onNotify(cb: (env: EnvelopeNotify) => void): Thunk;

    request(method: string, ...args: any[]): Promise<any>;
    onRequest(cb: (method: string, ...args: any[]) => Promise<any>): Thunk;

    // startStream
    // handleStream

    get isClosed(): boolean;
    close(): void;
    onClose(cb: Thunk): Thunk;
}

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------

export interface IPostman {
    garden: IConnectionGarden;
    status: Atom<OpenOrClosed>;
    onReceive: (env: Envelope) => Promise<void>,

    // constructor takes a "methods" object which has
    // the notify/request methods in it.
    // Any method can be called via notify or request, the only
    // difference is whether we wait for a response to come back or not.

    notify(method: string, ...args: any[]): Promise<void>;
    request(method: string, ...args: any[]): Promise<any>;

    // startStream
    // handleStream

    close(): void;
}

export interface IConnectionGarden {
    // constructor can take an url/port to serve on, or urls to connect to
    connections: SuperbusMap<string, Connection>,
    gardenId: string,
    status: Atom<OpenOrClosed>,
    close: Thunk,
}

export type ConnectionStatus =
    'CONNECTING'
    | 'OPEN'
    | 'ERROR'
    | 'CLOSED'

export interface Connection {
    otherGardenId: string | null,
    otherUrlOrIp?: string,  // or ip address if known
    status: Atom<ConnectionStatus>,
    send: (env: Envelope) => Promise<void>,
    onReceive: (env: Envelope) => Promise<void>,
    close: Thunk;
}


