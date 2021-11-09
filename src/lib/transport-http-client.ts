import { CONNREFUSED } from 'dns';
import { response } from 'express';
import { CONNECTION_STATUS, ITransport, Obj } from './types';

let log = (...args: any[]) => console.log('CLIENT  ', ...args);

let SSE_PATH = '/sync/sse'
let POST_PATH = '/sync/post'

type Cb = (packet: Obj) => Promise<any>;
type Thunk = () => void;
export class TransportHTTPClientSide implements ITransport {
    _cbs: Set<Cb> = new Set();
    _eventSource: EventSource;
    lastSeen: number = 0;  // timestamp we were last connected to the server
    constructor(public url: string, public port: number) {
        log('constructor');
        log('constructor: set up SSE listening at ' + SSE_PATH);
        // set up listening for SSE
        this._eventSource = new EventSource(SSE_PATH);
        this._eventSource.onmessage = async (event) => {
            this.lastSeen = Date.now();
            log('-------------------------------------');
            log('!! sse onmessage handler got', event.data);
            log('  |  data', event.data);
            log('  |  lastEventId', event.lastEventId);
            log('  |  timestamp', event.timeStamp);  // since page load
            for (let cb of this._cbs) {
                if (event.data === undefined || event.data === 'undefined' || event.data.length === 0 || event.data === '""') {
                    log('  |  (heartbeat)');
                } else {
                    let resPacket = await cb(JSON.parse(event.data));
                    if (resPacket) {
                        await this.send(resPacket);
                    }
                }
            }
        }
        this._eventSource.onerror = () => { console.error('EventSource error.') }
        this._eventSource.onopen = () => { console.log('SSE connection established with server.') }
        log('...constructor is done.');
    }
    async status(): Promise<CONNECTION_STATUS> {
        if (this._eventSource.readyState === 0) { return 'CONNECTING'; }
        if (this._eventSource.readyState === 1) { return 'OPEN'; }
        if (this._eventSource.readyState === 2) { return 'CLOSED'; }
        return 'ERROR';
    }
    async send(packet: Obj): Promise<void> {
        log('send (by POST)', JSON.stringify(packet));
        // send events as individual POSTs
        let fullUrl = `${this.url}:${this.port}${POST_PATH}`
        log(`send: doing a fetch POST to ${fullUrl} ...`);
        let response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(packet),
        });
        log('send: ...fetch POST is done.');
        // if the request comes back as anything besides null, call the onReceive callback on it.
        // so there are two ways we can get messages: as responses here, and via SSE.
        log('send: handling response...');
        if (response.text.length > 0) {
            let packetResponse = JSON.parse(await response.json());
            log('send: packetResponse is', packetResponse);
            for (let cb of this._cbs) {
                await cb(packetResponse);
            }
        }
        log('...send is done.');
        this.lastSeen = Date.now();
    }
    onReceive(cb: Cb): Thunk {
        this._cbs.add(cb);
        return () => this._cbs.delete(cb);
    }
    close(): void {
        this._eventSource.close();
    }
}

//================================================================================
let main = async () => {
    log('main (client)');
    let PORT = 8008

    log('main: setting up transport on port ' + PORT);
    let transport = new TransportHTTPClientSide(`http://localhost`, PORT);
    transport.onReceive(async (packet: Obj) => {
        log('main: = = = = = = = = CLIENT TRANSPORT GOT A MESSAGE', packet);
        log('client response: 789');
    });

    let ii = 0;
    while (true) {
        log(`main: --> await transport.send(hello: world, ${ii}) which should be a POST to the server...`, ii);
        await transport.send({hello: 'world', from: 'client', num: ii})
        log('main: ...done.');
        log('...main is done.');
        ii += 1;
    }

}
main();