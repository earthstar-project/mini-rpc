import { ITransport, Obj } from './types';

let log = console.log;

type Cb = (packet: Obj) => Promise<void>;
type Thunk = () => void;
class TransportHTTPClientSide implements ITransport {
    cbs: Set<Cb> = new Set();
    constructor(public url: string, public port: number) {
        log('constructor');
        log('constructor: set up SSE listening');
        // set up listening for SSE
        let evtSource = new EventSource('/sync:' + this.port);
        evtSource.onmessage = async (event) => {
            log('sse onmessage handler');
            for (let cb of this.cbs) {
                if (event.data.length > 0) {
                    await cb(event.data);
                }
            }
        }
        log('...constructor is done.');
    }
    async send(packet: Obj): Promise<void> {
        log('send', JSON.stringify(packet));
        // send events as individual POSTs
        log('send: doing a fetch POST...');
        let response = await fetch(this.url + ':' + this.port, {
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
            for (let cb of this.cbs) {
                await cb(packetResponse);
            }
        }
        log('...send is done.');
    }
    onReceive(cb: Cb): Thunk {
        this.cbs.add(cb);
        return () => this.cbs.delete(cb);
    }
}

//================================================================================
let main = async () => {
    log('main (client)');
    let PORT = 8123

    log('setting up transport on port ' + PORT);
    let transport = new TransportHTTPClientSide(`https://localhost`, PORT);
    transport.onReceive(async (packet: Obj) => {
        log('transport.onReceive got a message', JSON.stringify(packet));
        console.log(`got ${JSON.stringify(packet)}`)
    });

    log('transport: await send hello world...');
    await transport.send({hello: 'world', from: 'client'})
    log('...main is done.');
}
main();