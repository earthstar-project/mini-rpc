import {
    logServer,
    logThread,
} from './util';

import {
    Thunk,
    Obj,
    Fns,
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
    IRpcServer,
} from './types';

//================================================================================

export class RpcServer implements IRpcServer {
    _onRequestCb: null | ((method: string, args: any[]) => Promise<any>) = null;
    _fns: Fns;
    _streams: Fns;
    _runningStreamIds: Set<string> = new Set();
    constructor(public transport: ITransport, fns: Fns, streams: Fns) {
        this._fns = fns;
        this._streams = streams;
        transport.onReceive(async (packet: Obj): Promise<void> => {
            await this._handleIncomingPacket(packet as ClientPacket);
        });
    }
    async _handleIncomingPacket(packet: ClientPacket): Promise<void> {
        logServer('_handleIncomingPacket()');
        logServer(JSON.stringify(packet));

        // validate the packet against the schema
        try {
            ClientPacket.parse(packet);
        } catch (err) {
            logServer('packet failed validation.  ignoring it.', packet);
            return;
        }

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
            this._runningStreamIds.add(id);
            if (this._streams[packet.method] === undefined) {
                logServer('warning: got a stream request with unknown method.  ignoring it.', packet.method);
            }
            // TODO: bind?
            let iterator = this._streams[packet.method](...packet.args);

            let packetStreamStarted: PacketStreamStarted = {
                kind: 'STREAM_STARTED',
                id,
            }
            logServer('_handleIncomingPacket(): sending STREAM_STARTED:');
            logServer(JSON.stringify(packetStreamStarted));
            await this.transport.send(packetStreamStarted);

            // now that we've sent STREAM_STARTED we can start running the stream iterator thread.
            logServer('_handleIncomingPacket(): starting the stream thread...');
            let thread = async () => {
                logThread('stream thread: starting');
                for await (let item of (iterator as any)) {
                    // check if stream was cancelled
                    if (!this._runningStreamIds.has(id)) {
                        logThread('stream thread: user cancelled the stream.  stopping the thread and sending STREAM_CANCELLED back.');
                        let packetStreamCancelled: PacketStreamCancelled = {
                            kind: 'STREAM_CANCELLED',
                            id,
                        }
                        logThread('stream thread: sending STREAM_CANCELLED');
                        await this.transport.send(packetStreamCancelled);
                        logThread('stream thread: ...done');
                        return;
                    }
                    // otherweise, send the latest data
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
                this._runningStreamIds.delete(id);
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
            logThread('cancelling stream', packet.id);
            if (this._runningStreamIds.has(packet.id)) {
                // we just have to delete the id from our list
                // and then the thread will notice and terminate itself
                this._runningStreamIds.delete(packet.id);
            } else {
                logThread('warning: cancel_stream was given an unknown id.  ignoring it.', packet.id);
            }

        } else {
            let x: never = packet;  // ensure all the packet kinds are handled, above
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
