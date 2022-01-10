import { Chan } from 'concurrency-friends';

import { ChanPair, Message } from './types';
import { sleep } from './util';

export let makeTransportHttpClientSide = (url: string): ChanPair<Message> => {
    // Make chans with a buffer size of zero
    // (a put blocks until a get happens, or vice versa).
    let inChan = new Chan<Message>(0);
    let outChan = new Chan<Message>(0);

    // Outgoing: user sent a message. POST it up to server.
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
                inChan.close();
                outChan.close();
            }
        } catch (err) {
            console.error('ERROR while sending out:', err);
            inChan.close();
            outChan.close();
        }
    });

    let isPolling: boolean = true;
    let stopPolling = () => { isPolling = false; }

    // Incoming: start a thread to poll the server for updates with GET
    // and push them to the user over the chan
    setTimeout(async () => {
        while (isPolling) {
            try {
                let res = await fetch(url);
                if (!res.ok) {
                    console.error(`ERROR: GET ${url} returned status ${res.status}`);
                    inChan.close();
                    outChan.close();
                    return;
                }
                let msgs = await res.json() as Message[];
                for (let msg of msgs) {
                    await inChan.put(msg);
                }
            } catch (err) {
                console.error('ERROR while getting incoming msgs:', err);
                inChan.close();
                outChan.close();
                return;
            }
            await sleep(3000);  // TODO: cancel can take up to this long to take effect
        }
    }, 1);

    // User can destroy this transport by closing either Chan,
    // or by sealing the outChan (it will be closed after all items
    // have been sent).
    // This is needed to make sure the polling timer is stopped.
    inChan.onClose.subscribe(stopPolling);
    outChan.onClose.subscribe(stopPolling);

    return { inChan, outChan };
}





