import { Chan } from 'concurrency-friends';
import fetch from 'cross-fetch';

import { ChanPair, Message } from './types';
import { sleep } from './util';

/*
    Make a transport which runs on the client side of an HTTP connection.
    This is horribly inefficient right now:
    * It sends messages up to the server by POSTing each one separately.
    * It receives messages by polling the server every couple of seconds.

    It actually sends and receives batches of messages (arrays), but they
    always only have one item in them right now.  TODO: accumulate batches,
    then send them up all at once.

    TODO: write the corresponding server side of this.
*/
export let makeTransportHttpClientSide = (url: string): ChanPair<Message> => {
    // Make chans with a buffer size of zero.
    // (A put() blocks until a get() happens, or vice versa).
    let inChan = new Chan<Message>(0);
    let outChan = new Chan<Message>(0);

    // Outgoing: user sent a message. POST it up to server.
    // If we have errors, keep polling in case we were offline but have since
    // gone online again.
    // TODO: if we can't send it right now, save it to a buffer.
    outChan.forEach(async (msg: Message) => {
        try {
            let res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                // Send a batch of one message (an array of length 1).
                // TODO: collect messages into bigger batches
                // and send once every few seconds.
                body: JSON.stringify([msg]),
            })
            if (!res.ok) {
                console.error(`ERROR: POST ${url} returned status ${res.status}`);
                // TODO: save msg to outgoing buffer or put back into the chan (?)
            }
        } catch (err) {
            console.error('ERROR while sending out:', err);
            // TODO: save msg to outgoing buffer or put back into the chan (?)
        }
    });

    // Incoming: start a thread to poll the server for updates with GET
    // and push them to the user over the chan.
    // If we have errors, keep polling in case we were offline but have since
    // gone online again.

    let isPolling: boolean = true;
    let stopPolling = () => { isPolling = false; }

    setTimeout(async () => {
        while (isPolling) {
            try {
                let res = await fetch(url);
                if (!res.ok) {
                    console.error(`ERROR: GET ${url} returned status ${res.status}`);
                }
                let msgs = await res.json() as Message[];
                for (let msg of msgs) {
                    await inChan.put(msg);
                }
            } catch (err) {
                console.error('ERROR while getting incoming msgs:', err);
            }
            await sleep(1000);  // TODO: cancel can take up to this long to take effect
        }
    }, 1);

    // User can destroy this transport by closing either Chan,
    // or by sealing the outChan (it will be closed after all items
    // have been sent).
    // This is needed to make sure the polling timer is stopped.
    // TODO: make sure closing one chan propagates to the other chan.
    inChan.onClose.subscribe(stopPolling);
    outChan.onClose.subscribe(stopPolling);

    return { inChan, outChan };
}





