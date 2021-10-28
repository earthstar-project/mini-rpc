import { logMain, logPeerClient, logPeerServer, logTransportClient, logTransportServer, makeId, sleep } from './lib/util';

//================================================================================
// TYPES

type Thunk = () => void;

interface Flag {
    value: boolean,
}

class RemoteError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'RemoteError';
    }
} 

// sent by the PeerClient
interface PacketRequest {
    id: string,
    method: string,
    args: any[],
}
interface PacketUnsubscribe {
    id: string,
}

// sent by the PeerServer
interface PacketResponseOneShot {
    id: string,
    value: any;
    error: null;
    done: true;
}
interface PacketResponseMidStream {
    id: string,
    value: any;
    error: null;
    done: false;
}
interface PacketResponseEndStream {
    id: string,
    value: null;
    error: null;
    done: true;
}
interface PacketResponseError {
    id: string,
    value: null;
    error: string;
    done: true;
}
type PacketResponse =
    PacketResponseOneShot
    | PacketResponseMidStream
    | PacketResponseEndStream
    | PacketResponseError;

//================================================================================

class PeerClient {
    activeStreamIds: Set<string>;
    constructor(public fns: any, public transport: TransportLocalClient) {
        this.activeStreamIds = new Set<string>();
    }
    async callOneShot(method: string, ...args: any[]) {
        let packetRequest: PacketRequest = {
            id: makeId(),
            method,
            args
        }
        logPeerClient(JSON.stringify(packetRequest));
        let packetResponse = await this.transport.callOneShot(packetRequest);
        logPeerClient('<--', JSON.stringify(packetResponse));
        if (packetResponse.error !== null) {
            throw new RemoteError(packetResponse.error);
        }
        return packetResponse.value;
    }
    async callStream(method: string, ...args: any[]): Promise<Thunk> {
        // TODO
        // - add this call id to our set of active stream ids
        // - start the stream by sending a request packet
        // - set up a handler for incoming stream data
        //   - this should ignore packets that are not in the set of active stream ids
        // - return an unsubscribe thunk which will:
        //   - remove the call id from our set of active stream ids
        //   - send an unsubscribe packet which makes the server shut down the stream
        return () => {}
    }
}

class TransportLocalClient {
    constructor(public transportLocalServer: TransportLocalServer) {
    }
    async callOneShot(packetRequest: PacketRequest): Promise<PacketResponse> {
        logTransportClient(JSON.stringify(packetRequest));
        let packetResponse = await this.transportLocalServer.callOneShot(packetRequest);
        logTransportClient('<--', JSON.stringify(packetResponse));
        return packetResponse;
    }
}

class TransportLocalServer {
    constructor(public peerServer: PeerServer) {
    }
    async callOneShot(packetRequest: PacketRequest): Promise<PacketResponse> {
        logTransportServer(JSON.stringify(packetRequest));
        let packetResponse = await this.peerServer.callOneShot(packetRequest);
        logTransportServer('<--', JSON.stringify(packetResponse));
        return packetResponse;
    }
}

class PeerServer {
    constructor(public fns: any) {
    }
    async callOneShot(packetRequest: PacketRequest): Promise<PacketResponse> {
        logPeerServer(JSON.stringify(packetRequest));
        let { method, args } = packetRequest;
        try {
            let value = await this.fns[method](...args);
            let packetResponse: PacketResponseOneShot = {
                id: packetRequest.id,
                value,
                error: null,
                done: true,
            }
            logPeerServer('<--', JSON.stringify(packetResponse));
            return packetResponse;
        } catch (err) {
            let packetError: PacketResponseError = {
                id: packetRequest.id,
                value: null,
                error: `${err.name}: ${err.message}`,
                done: true,
            }
            logPeerServer('<--', JSON.stringify(packetError));
            return packetError;
        }
    }
}









//================================================================================

let myFunctions = {
    // a sync function
    double: (x: number) => {
        if (x === 5) { throw new Error('five is bad'); }
        return x * 2;
    },
    // an async function
    doubleSlowly: async (x: number): Promise<number> => {
        await sleep(2000);
        if (x === 5) { throw new Error('five is bad'); }
        return x * 2;
    },
    streamIntegers: async (sleepInterval: number, limit: number, cb: (...args: any[]) => any, running: Flag) => {
        if (limit > 5) { throw new Error("can't count higher than 5"); }
        for (let ii = 0; ii <= limit; ii++) {
            if (running.value === false) { return; }
            await sleep(sleepInterval)
            cb(ii);
        }
    },
}


//================================================================================

let main = async () => {
    let peerServer = new PeerServer(myFunctions);
    let transportLocalServer = new TransportLocalServer(peerServer);
    let transportLocalClient = new TransportLocalClient(transportLocalServer);
    let peerClient = new PeerClient(myFunctions, transportLocalClient);

    logMain('doubleSlowly(4) = ...');
    logMain(await peerClient.callOneShot('doubleSlowly', 4));
}

main();
