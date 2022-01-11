import { Chan } from 'concurrency-friends';

export type Thunk = () => void;

/*
    A network transport is represented by a pair of Chans,
    one for incoming messages and one for outgoing messages.
    (These are object streams, not byte streams.)

    To send a message, do outChan.put(msg).

    To close the connection, close or seal either Chan.
    - close() will close it instantly, or
    - seal() will close it after the queue is empty.

    Generally, if one chan is closed the other one will also become closed.
    TODO: whose job is it to hook up all the close events?  Transports or PeerConnections?

    If the connection has a network error, both chans will be close()'d.

    Check the status of the connection with inChan.isClosed or outChan.isClosed.
*/
export interface ChanPair<T> {
    inChan: Chan<T>;
    outChan: Chan<T>;
}

//--------------------------------------------------------------------------------

/*
    Either side of a connection can send any of these messages in any order,
    but only certain orders will make sense; the rest will be ignored with warnings.

    For example either side can send a REQUEST, and the other side should reply
    with a RESPONSE.

    Expected sequences of messages

    * NOTIFY (no response needed)

    * REQUEST --> RESPONSE (with data or with an error)

    * // TODO: stream-related message types
*/

export type MessageKind =
    'NOTIFY'
    | 'REQUEST'
    | 'RESPONSE';

export interface MessageNotify {
    kind: 'NOTIFY',
    method: string,
    args: any[],
}
export interface MessageRequest {
    kind: 'REQUEST',
    id: string,
    method: string,
    args: any[],
}
export interface MessageResponseWithData {
    kind: 'RESPONSE',
    id: string,
    data: any,
}
export interface MessageResponseWithError {
    kind: 'RESPONSE',
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
    A PeerConnection wraps around a transport (e.g. a channel pair)
    and helps you send and receive Messages over it, and close it.

    The flow of closing things can either be
    * one of the channels is closed --> peerConnection gets closed --> the other channel gets closed
    * or peerConnection gets closed --> it closes both of the channels

    Closing things is generally idempotent (safe to do more than once) -- it's ignored
    when something is already closed.
    So we don't have to worry much about who is supposed to close who, because it
    can't cause an infinite recursion.  The closure just spreads through everything.
*/
export interface IPeerConnection {
    // constructor is given a ChanPair

    notify(method: string, ...args: any[]): Promise<void>;
    onNotify(cb: (msg: MessageNotify) => void): Thunk;

    request(method: string, ...args: any[]): Promise<any>;
    onRequest(cb: (method: string, ...args: any[]) => Promise<any>): Thunk;

    // startStream
    // handleStream

    // Stop accepting new data but let the existing buffers drain, then close.
    seal(): void;
    // Close hard, right now.
    close(): void;
    onClose(cb: Thunk): Thunk;
}
