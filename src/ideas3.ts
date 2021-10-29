
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

export let logMain =       (...args: any[]) => log('' + chalk.black.bgWhite(        'main') + '          ', ...args);
export let logPeerC =      (...args: any[]) => log(' ' + chalk.black.bgYellowBright( 'peerC') + '        ', ...args);
export let logTransportC = (...args: any[]) => log('  ' + chalk.black.bgCyanBright(   'transportC') + '  ', ...args);
export let logTransportS = (...args: any[]) => log('           ' + chalk.black.bgCyan(         'transportS') + ' ', ...args);
export let logPeerS =      (...args: any[]) => log('            ' + chalk.black.bgYellow(       'peerS') + '     ', ...args);
export let logPeerSThr =   (...args: any[]) => log('            ' + chalk.black.bgGreen(       'peerSThr') + '  ', ...args);
export let logFunction =   (...args: any[]) => log('             ' + chalk.black.bgGrey(         'fn') + '       ', ...args);

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
// client-sent packets

type Thunk = () => void;

interface PacketCall {
    kind: 'CALL',
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
    PacketCall
    | PacketStartStream
    | PacketCancelStream;

//================================================================================
// server-sent packets

interface PacketData {
    kind: 'DATA',
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
    PacketData
    | PacketStreamBegin
    | PacketStreamEnd
    | PacketError;

//================================================================================

interface IPeer {
    // as a client...

    call(method: string, ...args: any[]): Promise<any>;
    startStream(method: string, cb: (data: any) => Promise<void>, ...args: any[]): Promise<void>;
    cancelStream(id: string): Promise<void>;

    // as a server...
    _handleCall(packetCall: PacketCall): Promise<PacketData | PacketError>;
    _handleStartStream(packetStartStream: PacketStartStream, sendResponse: (packetResponse: PacketData | PacketStreamEnd | PacketError) => Promise<void>): Promise<void>;
}

interface ITransport {
    // as a client...

    // send a packet and wait for the one corresponding packet
    call(packet: PacketCall): Promise<PacketData | PacketError>;

    startStream(packet: PacketStartStream, onPacketResponse: (packet: PacketData | PacketStreamEnd | PacketError) => Promise<void>): Promise<void>;
    cancelStream(packet: PacketCancelStream): Promise<void>;

    // as a server...
    registerExecutionPeer(peer: IPeer): void;
    _sendStreamData(packet: PacketData): Promise<void>;

    _handleCall(packet: PacketCall): Promise<PacketData | PacketError>;
    _handleStartStream(packet: PacketStartStream): Promise<void>;
    _handleCancelStream(packet: PacketCancelStream): Promise<void>
}

//================================================================================

class Peer implements IPeer {

    constructor(public fns: any, public streams: any, public transport: ITransport) {
    }

    // as a client...

    async call(method: string, ...args: any[]): Promise<any> {
        let packetCall: PacketCall = {
            kind: 'CALL',
            id: makeId(),
            method,
            args,
        };
        logPeerC('call():', JSON.stringify(packetCall));
        let packetResponse = await this.transport.call(packetCall);
        logPeerC('got back:', JSON.stringify(packetResponse));
        if (packetResponse.kind === 'ERROR') {
            throw new Error(`Error from other side: ${packetResponse.error}`);
        } else {
            // DATA
            return packetResponse.data;
        }
    }
    async startStream(method: string, cb: (data: any) => Promise<void>, ...args: any[]): Promise<void> {
        let packetStartStream: PacketStartStream = {
            kind: 'START_STREAM',
            id: makeId(),
            method,
            args,
        }
        logPeerC('startStream():', JSON.stringify(packetStartStream));
        await this.transport.startStream(packetStartStream, async (packetResponse: PacketData | PacketStreamEnd | PacketError): Promise<void> => {
            logPeerC('startStream/transport cb: handling packetResponse from transport')
            if (packetResponse.kind === 'ERROR') {
                throw new Error(`Error from other side: ${packetResponse.error}`);
            } else if (packetResponse.kind === 'STREAM_END') {
                // do nothing
            } else {
                // DATA
                await cb(packetResponse.data);
            }
            logPeerC('...startStream/transport cb: done.')
        });
        logPeerC('...startStream: done sending initial PacketStartStream.');
    }
    async cancelStream(id: string): Promise<void> {
        let packetCancelStream: PacketCancelStream = {
            kind: 'CANCEL_STREAM',
            id,
        };
        await this.transport.cancelStream(packetCancelStream);
    }

    // as a server...

    async _handleCall(packetCall: PacketCall): Promise<PacketData | PacketError> {
        logPeerS('_handleCall(): got', JSON.stringify(packetCall));
        try {
            let data = await this.fns[packetCall.method](...packetCall.args);
            let packetData: PacketData = {
                kind: 'DATA',
                id: packetCall.id,
                data,
            }
            logPeerS('sent back:', JSON.stringify(packetData));
            return packetData;
        } catch (err) {
            let packetError: PacketError = {
                kind: 'ERROR',
                id: packetCall.id,
                error: `Error when running ${packetCall.method}(...${JSON.stringify(packetCall.args)}): ${err.name}: ${err.message}`,
            }
            logPeerS('sent back:', JSON.stringify(packetError));
            return packetError;
        }
    }
    async _handleStartStream(packetStartStream: PacketStartStream, sendResponse: (packetResponse: PacketData | PacketStreamEnd | PacketError) => Promise<void>): Promise<void> {
        logPeerS('_handleStartStream(): got', JSON.stringify(packetStartStream));
        // launch a new thread to run the stream in
        setTimeout(async () => {
            // send data until a single error occurs, then stop
            logPeerSThr('starting stream thread');
            try {
                for await (let data of this.streams[packetStartStream.method](...packetStartStream.args)) {
                    let packetData: PacketData = {
                        kind: 'DATA',
                        id: packetStartStream.id,
                        data,
                    }
                    logPeerSThr('...sending stream data:', JSON.stringify(packetData));
                    await sendResponse(packetData);
                }
                let packetEnd: PacketStreamEnd = {
                    kind: 'STREAM_END',
                    id: packetStartStream.id,
                    wasCancelled: false,
                }
                logPeerSThr('...sending stream end:', JSON.stringify(packetEnd));
                await sendResponse(packetEnd);
            } catch (err) {
                let packetError: PacketError = {
                    kind: 'ERROR',
                    id: packetStartStream.id,
                    error: `Error when running stream ${packetStartStream.method}(...${JSON.stringify(packetStartStream.args)}): ${err.name}: ${err.message}`,
                }
                logPeerSThr('...sending stream error:', JSON.stringify(packetError));
                await sendResponse(packetError);
            }
            logPeerSThr('...ending stream thread');
        }, 1);
        logPeerS('..._handleStartStream is done starting the stream thread.');
    }
}

//================================================================================

class LocalTransport implements ITransport {

    // this serves as a connection between the client and server sides
    _streamCallbacksById: Map<string, any> = new Map();  // id --> onPacketResponse

    peer: IPeer | null = null;

    // as a client...

    async call(packetCall: PacketCall): Promise<PacketData | PacketError> {
        logTransportC('call():', JSON.stringify(packetCall));

        // this would do a fetch() to its remote counterpart instead of calling itself
        let packetResult = await this._handleCall(packetCall);

        logTransportC('got back:', JSON.stringify(packetResult));
        logTransportC('...call is done.');
        return packetResult;
    }
    async startStream(packetStartStream: PacketStartStream, onPacketResponse: (packetResponse: PacketData | PacketError) => Promise<void>): Promise<void> {
        logTransportC('startStream():', JSON.stringify(packetStartStream));
        this._streamCallbacksById.set(packetStartStream.id, onPacketResponse);
        await this._handleStartStream(packetStartStream);
        logTransportC('...startStream is done.');
    }
    cancelStream(packet: PacketCancelStream): Promise<void> { throw new Error('not implemented'); }

    // as a server...

    registerExecutionPeer(peer: IPeer): void { this.peer = peer; }

    async _handleCall(packetCall: PacketCall): Promise<PacketData | PacketError> {
        logTransportS('_handleCall(): got', JSON.stringify(packetCall));
        if (this.peer === null) { throw new Error('no peer is registered'); }
        let packetResponse = await this.peer._handleCall(packetCall);
        logTransportS('sent back:', JSON.stringify(packetResponse));
        logTransportS('..._handleCall is done.');
        return packetResponse;
    }
    async _handleStartStream(packetStartStream: PacketStartStream): Promise<void> {
        logTransportS('_handleStartStream(): got', JSON.stringify(packetStartStream));
        if (this.peer === null) { throw new Error('no peer is registered'); }
        this.peer._handleStartStream(packetStartStream, async (packetResponse: PacketData | PacketStreamEnd | PacketError): Promise<void> => {
            logTransportS('_handleStartStream sendResponse callback:', JSON.stringify(packetResponse));
            await this._sendStreamData(packetResponse);
            if (packetResponse.kind === 'STREAM_END') {
                logTransportS('_handleStartStream sendResponse callback: cleaning up after stream end');
                this._streamCallbacksById.delete(packetResponse.id);
            }
        });
    }
    async _sendStreamData(packetResponse: PacketData | PacketStreamEnd | PacketError): Promise<void> {
        logTransportS('_sendStreamData(): looking up onPacketResponse cb and calling it...');
        let cb = this._streamCallbacksById.get(packetResponse.id);
        if (cb === undefined) { throw new Error('???'); }
        // crossing the streams here, this should happen on the client side, not the server side
        await cb(packetResponse);
        logTransportS('..._sendStreamData is done.');
    }
    _handleCancelStream(packet: PacketCancelStream): Promise<void> { throw new Error('not implemented'); }
}

//================================================================================

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
        await sleep(1000);
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
};

//================================================================================
// MAIN

let main = async () => {
    let localTransport = new LocalTransport();
    let p1 = new Peer(myFunctions, myStreams, localTransport);
    let p2 = new Peer(myFunctions, myStreams, localTransport);
    localTransport.registerExecutionPeer(p2);

    //logMain('doubleSlowly(4)');
    //logMain(await p1.call('doubleSlowly', 4));

    logMain('starting stream');
    await p1.startStream('streamIntegers', async (data: any) => logMain(data), 1000, 4);
    logMain('...started.');

    setTimeout(() => logMain('goodbye'), 5000);
}
main();


