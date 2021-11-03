import { Chan } from 'concurrency-friends';

import {
    logClient,
    logServer,
    Deferred,
    makeDeferred,
    makeId,
} from './util';

import {
    Obj,
    PacketRequest,
    PacketStartStream,
    PacketCancelStream,
    ClientPacket,
    PacketResponse,
    PacketStreamStarted,
    PacketStreamData,
    PacketStreamEnded,
    PacketStreamCancelled,
    PacketError,
    ServerPacket,
    ITransport,
    IRpcClient,
} from './types';

//================================================================================

interface StreamInfo {
    state: 'STARTING' | 'RUNNING';
    chan: Chan<ServerPacket>;
}

export class RpcClient implements IRpcClient {
    _waitingRequests: Map<string, Deferred<any>> = new Map();
    _streams: Map<string, StreamInfo> = new Map();
    constructor(public transport: ITransport) {
        transport.onReceive(async (packet: Obj): Promise<void> => {
            await this._handleIncomingPacket(packet as ServerPacket);
        });
    }
    async _handleIncomingPacket(packet: ServerPacket) {
        logClient('_handleIncomingPacket()', JSON.stringify(packet));

        // validate the packet against the schema
        try {
            ServerPacket.parse(packet);
        } catch (err) {
            logServer('packet failed validation.  ignoring it.', packet);
            return;
        }

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
                logClient('warning: got a STREAM_STARTED with unknown id.  ignoring it.', packet.id);
                return;
            }
            await streamInfo.chan.put(packet);
        } else if (packet.kind === 'STREAM_DATA') {
            logClient('_handleIncomingPacket(): STREAM_DATA -- putting into the chan');
            let streamInfo = this._streams.get(packet.id);
            if (streamInfo === undefined) {
                logClient('warning: got a STREAM_DATA with unknown id.  ignoring it.', packet.id);
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
            let deferred = this._waitingRequests.get(packet.id);
            deferred?.reject(new Error(`Error from server: ${packet.error}`));
        } else {
            logClient('warning: got a response with unknown kind.  ignoring it.', (packet as any).kind);
            return;
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
    startStream(method: string, ...args: any[]): { chan: Chan<ServerPacket>, cancelStream: () => Promise<void> } {
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

        // TODO: it doesn't work to have the user close the chan to cancel the stream,
        // because the chan also gets closed when the stream ends naturally and is drained.
        // So we need to either:
        //    * return a Thunk for cancelling the stream, or
        //    * add an event to the Chan code for when a stream is manually closed, not auto-closed b/c of being sealed
        // Here we do the first option.
        // 
        return {
            chan,
            cancelStream: async () => await this._cancelStream(id),
        };
    }
    async _cancelStream(id: string): Promise<void> {
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

        // tell the server to stop the stream.
        // the client-user may choose not to await this if they don't care about confirming it
        logClient('_cancelStream(): sending CANCEL_STREAM packet:');
        let packetCancelStream: PacketCancelStream = {
            kind: 'CANCEL_STREAM',
            id,
        }
        logClient(JSON.stringify(packetCancelStream));
        await this.transport.send(packetCancelStream);
        logClient(`..._cancelStream(): done.`);
    }
}
