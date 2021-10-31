
import chalk = require('chalk');

//================================================================================
// logging

// in fish shell, run like this:
// VERBOSE=true yarn start-client

export let log = console.log;
export let nop = (...args: any[]) => {};
if (process.env.VERBOSE) {
    nop = log;
}

export let logMain =      (...args: any[]) => log('' + chalk.black.bgWhite(        'main') + '          ', ...args);
export let logClient =    (...args: any[]) => log(' ' + chalk.black.bgYellowBright( 'client') + '       ', ...args);
export let logTransport = (...args: any[]) => log('  ' + chalk.black.bgCyanBright(   'transport') + '   ', ...args);
export let logServer =    (...args: any[]) => log('            ' + chalk.black.bgYellow(       'server') + '    ', ...args);
export let logFunction =  (...args: any[]) => log('             ' + chalk.black.bgGrey(         'fn') + '       ', ...args);

//================================================================================
// utils

export let sleep = async (ms : number) : Promise<void> =>
    new Promise((resolve, reject) => setTimeout(resolve, ms));

// inclusive of endpoints
export let randInt = (lo: number, hi: number): number => 
    lo + Math.floor(Math.random() * (hi-lo));

export let makeId = (): string =>
    ('' + randInt(0, 999999999999999)).padStart(15, '0');

//================================================================================

type Thunk = () => void;

interface Obj {}

interface Fns {
    [name: string]: (...args: any[]) => any,
}

interface Deferred<T> {
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
    promise: Promise<T>,
}

let makeDeferred = <T>(): Deferred<T> => {
    let def: any = {};
    def.promise = new Promise<T>((resolve, reject) => {
        def.resolve = resolve;
        def.reject = reject;
    });
    return def as Deferred<T>;
}

//================================================================================
// client-sent packets


interface PacketRequest {
    kind: 'REQUEST',
    id: string,
    method: string,
    args: any[],
}
interface PacketStartStream {
    kind: 'START_STREAM',
    id: string,
    method: string,
    args: any[],
}
interface PacketCancelStream {
    kind: 'CANCEL_STREAM',
    id: string,
}

type ClientPacket =
    PacketRequest
    | PacketStartStream
    | PacketCancelStream;

//================================================================================
// server-sent packets

interface PacketResponse {
    kind: 'RESPONSE',
    id: string,
    data: any,
}

interface PacketStreamData {
    kind: 'STREAM_DATA',
    id: string,
    data: any,
}

interface PacketStreamBegin {
    kind: 'STREAM_BEGIN',
    id: string,
}

interface PacketStreamEnd {
    kind: 'STREAM_END',
    id: string,
    wasCancelled: boolean,  // if not cancelled, it ended by itself
}

interface PacketError {
    kind: 'ERROR',
    id: string,
    error: string,
}

type ServerPacket =
    PacketResponse
    | PacketStreamData
    | PacketStreamBegin
    | PacketStreamEnd
    | PacketError;

//================================================================================

interface ITransport {
    send(packet: Obj): Promise<void>,
    onReceive(cb: (packet: Obj) => Promise<void>): Thunk,  // thunk to remove callback
}

interface IRpcClient {
    request(method: string, ...args: any[]): Promise<PacketResponse | PacketError>,
    startStream(method: string, ...args: any[]): Promise<Thunk>,  // thunk to cancel stream
}

interface IRpcServer {
    onRequest(cb: (method: string, args: any[]) => Promise<any>): Thunk;  // thunk to remove callback
    onStartStream(cb: (method: string, args: any[]) => Promise<any>): Thunk;  // thunk to remove callback
}

//================================================================================

class LocalTransport implements ITransport {
    _otherTransport: LocalTransport;
    _onReceiveCb: null | ((packet: Obj) => Promise<void>) = null;
    constructor(public debugName: string = '') {
        this._otherTransport = null as any;  // hack for now
    }
    async send(packet: Obj): Promise<void> {
        logTransport(this.debugName, 'send()');
        logTransport(this.debugName, JSON.stringify(packet));
        await this._otherTransport._handleReceive(packet);
        logTransport(this.debugName, '...send() done.');
    }
    async _handleReceive(packet: Obj): Promise<void> {
        logTransport(this.debugName, '_handleReceive()');
        logTransport(this.debugName, JSON.stringify(packet));
        if (this._onReceiveCb === null) { return; }
        await this._onReceiveCb(packet);
        logTransport(this.debugName, '..._handleReceive() done.');
    }
    onReceive(cb: (packet: Obj) => Promise<void>): Thunk {
        this._onReceiveCb = cb;
        return () => { this._onReceiveCb = null; }
    }
}

let makeLocalTransportPair = (): [LocalTransport, LocalTransport] => {
    let t1 = new LocalTransport('client');
    let t2 = new LocalTransport('  server');
    t1._otherTransport = t2;
    t2._otherTransport = t1;
    return [t1, t2];
}

//================================================================================

class RpcClient implements IRpcClient {
    _waitingRequests: Map<string, Deferred<any>> = new Map();
    constructor(public transport: ITransport) {
        transport.onReceive(async (packet: Obj): Promise<void> => {
            // todo: validation
            await this._handleIncomingPacket(packet as ServerPacket);
        });
    }
    async _handleIncomingPacket(packet: ServerPacket) {
        logClient('_handleIncomingPacket()', JSON.stringify(packet));
        if (packet.kind === 'RESPONSE') {
            let deferred = this._waitingRequests.get(packet.id);
            if (deferred === undefined) {
                log('warning: got a response with unknown id.  ignoring it.', packet.id);
                return;
            }
            logClient('_handleIncomingPacket(): resolving the deferred promise with result:', packet.data);
            this._waitingRequests.delete(packet.id);
            deferred.resolve(packet.data);
        } else {
            log('warning: got a response with unknown kind.  ignoring it.', packet.kind);
        }
        logClient('..._handleIncomingPacket(): done');
    }
    async request(method: string, ...args: any[]): Promise<PacketResponse | PacketError> {
        logClient(`request(): ${method} ${JSON.stringify(args)}`);
        let packetRequest: PacketRequest = {
            kind: 'REQUEST',
            id: makeId(),
            method,
            args,
        };
        let deferred = makeDeferred<PacketResponse | PacketError>();
        this._waitingRequests.set(packetRequest.id, deferred);
        logClient('request(): sending request packet:');
        logClient(JSON.stringify(packetRequest));
        await this.transport.send(packetRequest);
        logClient(`...request(): done.`);
        return deferred.promise;
    }
    async startStream(method: string, ...args: any[]): Promise<Thunk> {
        throw new Error('TODO: not implemented yet');
    }
}

//================================================================================

class RpcServer implements IRpcServer {
    _onRequestCb: null | ((method: string, args: any[]) => Promise<any>) = null;
    _fns: Fns;
    constructor(public transport: ITransport, fns: Fns) {
        this._fns = fns;
        transport.onReceive(async (packet: Obj): Promise<void> => {
            // todo: validation
            await this._handleIncomingPacket(packet as ClientPacket);
        });
    }
    async _handleIncomingPacket(packet: ClientPacket): Promise<void> {
        logServer('_handleIncomingPacket()');
        logServer(JSON.stringify(packet));
        if (packet.kind === 'REQUEST') {
            let method = this._fns[packet.method];
            if (method === undefined) {
                log('warning: got a request with unknown method.  ignoring it.', packet.method);
            }
            logServer('_handleIncomingPacket(): actually calling the function...');
            let data = await method(...packet.args);
            logServer('_handleIncomingPacket(): ...done calling the function.  got:', data);
            let packetResponse: PacketResponse = {
                kind: 'RESPONSE',
                id: packet.id,
                data,
            }
            logServer('_handleIncomingPacket(): sending response:');
            logServer(JSON.stringify(packetResponse));
            await this.transport.send(packetResponse);
        } else {
            log('warning: got a request with unknown kind.  ignoring it.', packet.id);
        }
        logServer('..._handleIncomingPacket() is done.');
    }
    onRequest(cb: (method: string, args: any[]) => Promise<any>): Thunk {
        this._onRequestCb = cb;
        return () => { this._onRequestCb = null; }
    }
    onStartStream(cb: (method: string, args: any[]) => Promise<any>): Thunk {
        throw new Error('TODO: not implemented yet');
    }
}

//================================================================================

let main = async () => {

    let myFunctions = {
        // a sync function
        double: (x: number) => {
            logFunction('double', x);
            if (x === 5) { throw new Error('five is bad'); }
            return x * 2;
        },
        // an async function
        doubleSlowly: async (x: number): Promise<number> => {
            logFunction('doubleSlowly', x);
            logFunction('doubleSlowly: sleeping');
            await sleep(1500);
            if (x === 5) { throw new Error('five is bad'); }
            logFunction('...doubleSlowly: done.');
            return x * 2;
        },
    };

    let [localTransportForClient, localTransportForServer] = makeLocalTransportPair();
    let rpcClient = new RpcClient(localTransportForClient);
    let rpcServer = new RpcServer(localTransportForServer, myFunctions);

    logMain('double(3)');
    let p1 = rpcClient.request('doubleSlowly', 3);

    logMain('client waiting request ids:', [...rpcClient._waitingRequests.keys()]);

    //logMain('double(4)');
    //let p2 = rpcClient.request('doubleSlowly', 4);

    let result1 = await p1;
    //let result2 = await p2;

    logMain('...double(3) = ', result1);
    //logMain('...double(4) = ', result2);

    logMain('client waiting request ids:', [...rpcClient._waitingRequests.keys()]);

}
main();