import { ITransport, Obj } from './types';

type Cb = (packet: Obj) => Promise<void>;
type Thunk = () => void;
class TransportHTTPClientSide implements ITransport {
    cbs: Set<Cb> = new Set();
    constructor(public url: string, public port: number) {
        // set up listening for SSE
        let evtSource = new EventSource('/sync:' + this.port);
        evtSource.onmessage = async (event) => {
            for (let cb of this.cbs) {
                if (event.data.length > 0) {
                    await cb(event.data);
                }
            }
        }
    }
    async send(packet: Obj): Promise<void> {
        // send events as individual POSTs
        let response = await fetch(this.url + ':' + this.port, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(packet),
        });
        // if the request comes back as anything besides null, call the onReceive callback on it.
        // so there are two ways we can get messages: as responses here, and via SSE.
        if (response.text.length > 0) {
            let packetResponse = JSON.parse(await response.json());
            for (let cb of this.cbs) {
                await cb(packetResponse);
            }
        }
    }
    onReceive(cb: Cb): Thunk {
        this.cbs.add(cb);
        return () => this.cbs.delete(cb);
    }
}

//================================================================================
let main = async () => {
    let PORT = 8123

    let transport = new TransportHTTPClientSide(`https://localhost`, PORT);
    transport.onReceive(async (packet: Obj) => {
        console.log(`got ${JSON.stringify(packet)}`)
    });

    await transport.send({hello: 'world', from: 'client'})
}
main();