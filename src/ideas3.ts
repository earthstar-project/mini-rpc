
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

export let logMain =       (...args: any[]) => log('' + chalk.black.bgWhite(        'main') + '       ', ...args);
export let logPeerC =      (...args: any[]) => log(' ' + chalk.black.bgYellowBright( 'peerC') + '      ', ...args);
export let logTransportC = (...args: any[]) => log('  ' + chalk.black.bgCyanBright(   'transportC') + ' ', ...args);
export let logTransportS = (...args: any[]) => log('   ' + chalk.black.bgCyan(         'transportS') + ' ', ...args);
export let logPeerS =      (...args: any[]) => log('    ' + chalk.black.bgYellow(       'peerS') + '      ', ...args);
export let logFunction =   (...args: any[]) => log('     ' + chalk.black.bgGrey(         'fn') + '         ', ...args);

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
    id: string,
    method: string,
    args: any[],
}
interface PacketStartStream {
    id: string,
    method: string,
    args: any[],
}
interface PacketCancelStream {
    id: string,
}

type ClientPacket =
    PacketCall
    | PacketStartStream
    | PacketCancelStream;

//================================================================================
// server-sent packets

interface PacketData {
    id: string,
    data: any,
}

interface PacketStreamBegin {
    id: string,
}

interface PacketStreamEnd {
    id: string,
    wasCancelled: boolean,  // if not cancelled, it ended by itself
}

interface PacketError {
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
    startStream(method: string, cb: (data: any) => boolean, ...args: any[]): Promise<void>;
    cancelStream(id: string): Promise<void>;

    // as a server...
    executeCall(packetCall: PacketCall): Promise<PacketData | PacketError>;
}

class Peer implements IPeer {
    constructor(public fns: any, public streams: any, public transport: ITransport) {
    }

    // as a client...

    async call(method: string, ...args: any[]): Promise<any> {
        let packetCall: PacketCall = {
            id: makeId(),
            method,
            args
        };
        logPeerC('call():', JSON.stringify(packetCall));
        let packetResponse = await this.transport.call(packetCall);
        logPeerC('got back:', JSON.stringify(packetResponse));
        if ('error' in packetResponse) {
            throw new Error(`Error from other side: ${packetResponse.error}`);
        } else {
            return packetResponse.data;
        }
    }
    async startStream(method: string, cb: (data: any) => boolean, ...args: any[]): Promise<void> {
        // TODO
    }
    async cancelStream(id: string): Promise<void> {
        // TODO
    }

    // as a server...

    async executeCall(packetCall: PacketCall): Promise<PacketData | PacketError> {
        logPeerS('executeCall(): got', JSON.stringify(packetCall));
        try {
            let data = await this.fns[packetCall.method](...packetCall.args);
            let packetData: PacketData = {
                id: packetCall.id,
                data,
            }
            logPeerS('sent back:', JSON.stringify(packetData));
            return packetData;
        } catch (err) {
            let packetError: PacketError = {
                id: packetCall.id,
                error: `Error when running ${packetCall.method}(...${JSON.stringify(packetCall.args)}): ${err.name}: ${err.message}`,
            }
            logPeerS('sent back:', JSON.stringify(packetError));
            return packetError;
        }
    }
}

interface ITransport {
    // as a client...

    // send a packet and wait for the one corresponding packet
    call(packet: PacketCall): Promise<PacketData | PacketError>;
    startStream(packet: PacketStartStream, cb: (data: any) => boolean): Promise<void>;
    cancelStream(packet: PacketStreamEnd): Promise<void>;

    // as a server...
    registerExecutionPeer(peer: IPeer): void;
    executeCall(packetCall: PacketCall): Promise<PacketData | PacketError>;
    onStartStream(packet: PacketStartStream): Promise<void>;
    sendStreamData(packet: PacketData): Promise<void>;
    onCancelStream(packet: PacketCancelStream): Promise<void>
}

class LocalTransport implements ITransport {

    peer: IPeer | null = null;

    _checkForPeer(): void {
        if (this.peer === null) { throw new Error('no peer is registered'); }
    }
    async call(packetCall: PacketCall): Promise<PacketData | PacketError> {
        logTransportC('call():', JSON.stringify(packetCall));

        // this would do a fetch() to its remote counterpart instead of calling itself
        let packetResult = await this.executeCall(packetCall);

        logTransportC('got back:', JSON.stringify(packetResult));
        logTransportC('...call is done.');
        return packetResult;
    }
    startStream(packet: PacketStartStream, cb: (data: any) => boolean): Promise<void> { throw new Error('not implemented'); }
    cancelStream(packet: PacketStreamEnd): Promise<void> { throw new Error('not implemented'); }

    // as a server...
    registerExecutionPeer(peer: IPeer): void { this.peer = peer; }
    async executeCall(packetCall: PacketCall): Promise<PacketData | PacketError> {
        logTransportS('executeCall: got', JSON.stringify(packetCall));
        this._checkForPeer();
        if (this.peer === null) { throw new Error('no peer is registered'); }
        let packetResponse = await this.peer.executeCall(packetCall);
        logTransportS('sent back:', JSON.stringify(packetResponse));
        logTransportS('...executeCall is done.');
        return packetResponse;
    }
    onStartStream(packet: PacketStartStream): Promise<void> { throw new Error('not implemented'); }
    sendStreamData(packet: PacketData): Promise<void> { throw new Error('not implemented'); }
    onCancelStream(packet: PacketCancelStream): Promise<void> { throw new Error('not implemented'); }
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
            await sleep(sleepInterval)
            yield ii;
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

    logMain('doubleSlowly(4)');
    logMain(await p1.call('doubleSlowly', 4));
}
main();


