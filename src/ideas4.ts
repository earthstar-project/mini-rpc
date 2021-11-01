import chalk = require('chalk');
import { Chan } from 'concurrency-friends';

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
export let logThread =    (...args: any[]) => log('             ' + chalk.black.bgYellowBright(         'thread') + '   ', ...args);
export let logFunction =  (...args: any[]) => log('              ' + chalk.black.bgGrey(         'fn') + '      ', ...args);

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
    // response to a PacketRequest from the client
    kind: 'RESPONSE',
    id: string,
    data: any,
}

interface PacketStreamStarted {
    kind: 'STREAM_STARTED',
    id: string,
}

interface PacketStreamData {
    kind: 'STREAM_DATA',
    id: string,
    data: any,
}

interface PacketStreamEnded {
    // stream ended on its own
    kind: 'STREAM_ENDED',
    id: string,
}

interface PacketStreamCancelled {
    // stream was cancelled by client
    kind: 'STREAM_CANCELLED',
    id: string,
}

interface PacketError {
    kind: 'ERROR',
    id: string,
    error: string,
}

type ServerPacket =
    PacketResponse
    | PacketStreamStarted
    | PacketStreamData
    | PacketStreamEnded
    | PacketStreamCancelled
    | PacketError;

//================================================================================

interface ITransport {
    send(packet: Obj): Promise<void>,
    onReceive(cb: (packet: Obj) => Promise<void>): Thunk,  // thunk to remove callback
}

interface IRpcClient {
    request(method: string, ...args: any[]): Promise<PacketResponse | PacketError>,
    startStream(method: string, ...args: any[]): Chan<ServerPacket>,  // close the chan to cancel stream
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
        setTimeout(() => {
            this._otherTransport._handleReceive(packet);
        }, 1);
        logTransport(this.debugName, '...send() done.');
    }
    async _handleReceive(packet: Obj): Promise<void> {
        logTransport(this.debugName, '-------------------------------');
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

interface StreamInfo {
    state: 'STARTING' | 'RUNNING';
    chan: Chan<ServerPacket>;
}

class RpcClient implements IRpcClient {
    _waitingRequests: Map<string, Deferred<any>> = new Map();
    _streams: Map<string, StreamInfo> = new Map();
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
                logClient('warning: got a response with unknown id.  ignoring it.', packet.id);
                return;
            }
            logClient('_handleIncomingPacket(): resolving the deferred promise with result:', packet.data);
            this._waitingRequests.delete(packet.id);
            deferred.resolve(packet.data);
        } else if (packet.kind === 'STREAM_STARTED') {
            // send the start packet into the channel so the client-user knows the stream is running,
            // even if there's no actual data for a long time
            logClient('_handleIncomingPacket(): STREAM_STARTED');
            let streamInfo = this._streams.get(packet.id);
            if (streamInfo === undefined) {
                logClient('warning: got a STREAM_ENDED with unknown id.  ignoring it.', packet.id);
                return;
            }
            await streamInfo.chan.put(packet);
        } else if (packet.kind === 'STREAM_DATA') {
            logClient('_handleIncomingPacket(): STREAM_DATA -- putting into the chan');
            let streamInfo = this._streams.get(packet.id);
            if (streamInfo === undefined) {
                logClient('warning: got a STREAM_ENDED with unknown id.  ignoring it.', packet.id);
                return;
            }
            await streamInfo.chan.put(packet);
        } else if (packet.kind === 'STREAM_ENDED') {
            logClient('_handleIncomingPacket(): STREAM_ENDED');
            let streamInfo = this._streams.get(packet.id);
            if (streamInfo === undefined) {
                logClient('warning: got a STREAM_ENDED with unknown id.  ignoring it.', packet.id);
                return;
            }
            logClient('_handleIncomingPacket(): sealing the chan and clearing the stream state');
            // send the end packet into the chan so the client-user knows what's going on
            await streamInfo.chan.put(packet);
            // close the chan on the input side, so it can still drain if consumer is slow
            streamInfo.chan.seal();
            this._streams.delete(packet.id);
            logClient('_handleIncomingPacket(): ...sealed');
        } else if (packet.kind === 'STREAM_CANCELLED') {
            // if stream was cancelled, it was because we asked it to,
            // and we've already deleted the state and closed the chan.
            // now we're just hearing back from the server that it confirms it's stopping.
            logClient('_handleIncomingPacket(): STREAM_CANCELLED -- nothing to do');
        } else if (packet.kind === 'ERROR') {
            logClient('_handleIncomingPacket(): ERROR packet:', JSON.stringify(packet));
            throw new Error(`Error from server: ${packet.error}`);
        } else {
            logClient('warning: got a response with unknown kind.  ignoring it.', (packet as any).kind);
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
    startStream(method: string, ...args: any[]): Chan<ServerPacket> {
        logClient(`startStream(): ${method} ${JSON.stringify(args)}`);
        let id = makeId();

        // make a chan and set up our stream state
        logClient(`startStream(): setting up chan and stream state`);
        let chan = new Chan<ServerPacket>();
        let streamInfo: StreamInfo = {
            state: 'STARTING',
            chan,
        };
        this._streams.set(id, streamInfo);

        /*
        // TODO: it doesn't work to have the user close the chan to cancel the stream,
        // because the chan also gets closed when the stream ends naturally and is drained.
        // We need to either:
        //    * also return a Thunk for cancelling the stream, or
        //    * add an event to the Chan code for when a stream is manually closed, not auto-closed b/c of being sealed
        // 

        // set up a way to cancel the stream.
        // TODO: chan doesn't have an event for when it's closed,
        // so for now we have to poll.
        logClient(`startStream(): starting to poll for chan being closed, which will cancel the stream`);
        let poll = setInterval(async () => {
            logClient('                                         polling', chan.isClosed);
            if (chan.isClosed && !chan.isSealed) {
                // the client-user closed the channel, so let's cancel the stream.
                logClient('startStream(): polling detected the chan was closed.  cancelling the stream.');
                clearInterval(poll);
                this._cancelStream(id);
            }
        }, 100);
        */

        logClient('startStream(): sending START_STREAM packet and not waiting for response:');
        let packetStartStream: PacketStartStream = {
            kind: 'START_STREAM',
            id,
            method,
            args,
        };

        logClient(JSON.stringify(packetStartStream));
        this.transport.send(packetStartStream);
        logClient(`...startStream(): done.`);

        return chan;
    }
    _cancelStream(id: string): void {
        logClient(`_cancelStream("${id}")`);

        // close the chan, if it's not closed already
        logClient(`_cancelStream(): closing the stream if needed and clearing the _streams state`);
        let streamInfo = this._streams.get(id);
        if (streamInfo === undefined) {
            throw new Error('???');
            return;
        }
        let chan = streamInfo.chan;
        if (!chan.isClosed) { chan.close(); }

        // immediately delete the stream state instead of waiting for STREAM_CANCELLED to arrive.
        // (we might get a few STREAM_DATA packets before the CANCELLED one arrives,
        // and we want to discard those)
        this._streams.delete(id)

        // tell the server to stop the stream, and don't wait for it to reply
        logClient('_cancelStream(): sending CANCEL_STREAM packet and not waiting for response:');
        let packetCancelStream: PacketCancelStream = {
            kind: 'CANCEL_STREAM',
            id,
        }
        logClient(JSON.stringify(packetCancelStream));
        this.transport.send(packetCancelStream);
        logClient(`..._cancelStream(): done.`);
    }
}

//================================================================================

class RpcServer implements IRpcServer {
    _onRequestCb: null | ((method: string, args: any[]) => Promise<any>) = null;
    _fns: Fns;
    _streams: Fns;
    constructor(public transport: ITransport, fns: Fns, streams: Fns) {
        this._fns = fns;
        this._streams = streams;
        transport.onReceive(async (packet: Obj): Promise<void> => {
            // TODO: validation
            await this._handleIncomingPacket(packet as ClientPacket);
        });
    }
    async _handleIncomingPacket(packet: ClientPacket): Promise<void> {
        logServer('_handleIncomingPacket()');
        logServer(JSON.stringify(packet));
        if (packet.kind === 'REQUEST') {
            let method = this._fns[packet.method];
            if (method === undefined) {
                logServer('warning: got a request with unknown method.  ignoring it.', packet.method);
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

        } else if (packet.kind === 'START_STREAM') {
            let id = packet.id;
            if (this._streams[packet.method] === undefined) {
                logServer('warning: got a stream request with unknown method.  ignoring it.', packet.method);
            }
            // TODO: bind?
            let iterator = this._streams[packet.method](...packet.args);

            let packetStreamStarted: PacketStreamStarted = {
                kind: 'STREAM_STARTED',
                id: packet.id,
            }
            logServer('_handleIncomingPacket(): sending STREAM_STARTED:');
            logServer(JSON.stringify(packetStreamStarted));
            await this.transport.send(packetStreamStarted);

            // now that we've sent STREAM_STARTED we can start running the stream iterator thread.
            logServer('_handleIncomingPacket(): starting the stream thread...');
            let thread = async () => {
                logThread('stream thread: starting');
                for await (let item of (iterator as any)) {
                    logThread('stream thread: got', item);
                    let packetStreamData: PacketStreamData = {
                        kind: 'STREAM_DATA',
                        id,
                        data: item,
                    }
                    logThread('stream thread: sending STREAM_DATA:');
                    logThread(JSON.stringify(packetStreamData));
                    await this.transport.send(packetStreamData);
                }
                logThread('stream thread: iteration ended naturally');
                let packetStreamEnded: PacketStreamEnded = {
                    kind: 'STREAM_ENDED',
                    id,
                }
                logThread('stream thread: sending STREAM_ENDED');
                await this.transport.send(packetStreamEnded);
                logThread('stream thread: ...done');
            };
            // launch stream on its own timeline in the next tick
            setTimeout(thread, 0);

        } else if (packet.kind === 'CANCEL_STREAM') {
            throw new Error('CANCEL_STREAM is not implemented yet (TODO)');

        } else {
            // TODO: handle CANCEL_STREAM
            logServer('warning: got a request with unknown kind.  ignoring it.', (packet as any).id);
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

    let myStreams = {
        streamIntegers: async function* (sleepInterval: number, limit: number) {
            logFunction('streamIntegers', sleepInterval, limit);
            if (limit > 5) { throw new Error("can't count higher than 5"); }
            for (let ii = 0; ii < limit; ii++) {
                logFunction('streamIntegers sleeping, about to send', ii);
                await sleep(sleepInterval)
                logFunction('...streamIntegers sending', ii);
                yield ii;
                logFunction('...streamIntegers sent', ii);
            }
            logFunction('...streamIntegers: ended naturally.');
        }
    }

    let [localTransportForClient, localTransportForServer] = makeLocalTransportPair();
    let rpcClient = new RpcClient(localTransportForClient);
    let rpcServer = new RpcServer(localTransportForServer, myFunctions, myStreams);

    /*
    //----------------------------------------
    // test request-response

    logMain('double(3)');
    let p1 = rpcClient.request('doubleSlowly', 3);

    logMain('(client waiting request ids:)', [...rpcClient._waitingRequests.keys()]);

    //logMain('double(4)');
    //let p2 = rpcClient.request('doubleSlowly', 4);

    let result1 = await p1;
    //let result2 = await p2;

    logMain('...double(3) = ', result1);
    //logMain('...double(4) = ', result2);

    logMain('(client waiting request ids:)', [...rpcClient._waitingRequests.keys()]);
    */

    //----------------------------------------
    // test streams

    logMain('starting stream');
    let chan = rpcClient.startStream('streamIntegers', 100, 3);
    logMain('...starting stream is done.');
    //while (true) {
    //    let packet = await chan.get();
    //    logMain('chan got packet:', JSON.stringify(packet));
    //    if (packet.kind === 'STREAM_ENDED') {
    //        break;
    //    }
    //}
    logMain('reading stream:');
    await chan.forEach(packet => {
        logMain('chan got packet:', JSON.stringify(packet));
    });
    logMain('...reading stream is done.');
    logMain(chan.isClosed);
    logMain(chan.isSealed);
    logMain(chan.isIdle);
    logMain(chan.itemsInQueue);
    logMain(chan.itemsInQueueAndWaitingPuts);
    logMain(chan.numWaitingGets);

    logMain('...main is done.');

    //await sleep(2500);
    //chan.close();

}
main();