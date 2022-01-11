import { Chan } from 'concurrency-friends';

export type Thunk = () => void;

//--------------------------------------------------------------------------------
/*
    Either side of a connection can send any of these messages in any order,
    but only certain orders will make sense; the rest will be ignored with warnings.

    For example either side can send a REQUEST, and the other side should reply
    with a RESPONSE.

    Expected sequences of messages

    * NOTIFY (no response needed)

    * REQUEST --> RESPONSE (with data or with an error)

    * // TODO: stream-related message types: start, cancel, data, end, etc
*/

export type MessageKind =
    'NOTIFY'
    | 'REQUEST'
    | 'RESPONSE';

export interface MessageNotify {
    kind: 'NOTIFY',
    fromPeerId: string,
    method: string,
    args: any[],
}
export interface MessageRequest {
    kind: 'REQUEST',
    fromPeerId: string,
    id: string,
    method: string,
    args: any[],
}
export interface MessageResponseWithData {
    kind: 'RESPONSE',
    fromPeerId: string,
    id: string,
    data: any,
}
export interface MessageResponseWithError {
    kind: 'RESPONSE',
    fromPeerId: string,
    id: string,
    error: any,
}
export type MessageResponse =
    MessageResponseWithData
    | MessageResponseWithError;

export type Message =
    MessageNotify
    | MessageRequest
    | MessageResponseWithData
    | MessageResponseWithError;

//--------------------------------------------------------------------------------
/*
    A network transport is made of a pair of Chans,
    one for incoming messages and one for outgoing messages.
    (These are object streams, not byte streams.)

    To send a message, do outChan.put(msg).

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
    and helps you send and receive Messages over it, and close it.

    If anything becomes closed, they all become closed: PeerConnection, Transport, and both Chans.
*/
export interface IPeerConnection {
    // constructor is given a Transport and any other options like urls and timeouts

    get peerId(): string;  // a random UUID, chosen at every startup

    notify(method: string, ...args: any[]): Promise<void>;
    onNotify(cb: (msg: MessageNotify) => void): Thunk;

    request(method: string, ...args: any[]): Promise<any>;
    onRequest(cb: (method: string, ...args: any[]) => Promise<any>): Thunk;

    // startStream
    // handleStream

    get isClosed(): boolean;
    close(): void;
    onClose(cb: Thunk): Thunk;
}
