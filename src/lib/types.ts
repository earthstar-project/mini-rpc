import { Chan } from 'concurrency-friends';

export type Thunk = () => void;

// To send a message, do outChan.put(msg).
// To close the connection, close or seal either Chan.
// - close() will close it instantly, or
// - seal() will close it after the queue is empty.
// If the connection has an error, both chans will be close()'d.
// M is the type of your message objects.
export interface ChanPair<T> {
    inChan: Chan<T>;
    outChan: Chan<T>;
}

//--------------------------------------------------------------------------------

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
