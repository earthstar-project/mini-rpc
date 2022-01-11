import { Chan } from 'concurrency-friends';
import express from 'express';

import { ChanPair, Message, Thunk } from './types';
import { sleep } from './util';

/*
    Make a transport which runs on the server side of an HTTP connection.
    * It sends messages by queueing them and waiting for the client to poll using GET.
    * It receives messages via POST.

    It actually sends and receives batches of messages (arrays), but they
    always only have one item in them right now.  TODO: accumulate batches,
    then send them up all at once.
*/
export let makeTransportHttpServerSide = (port: number): ChanPair<Message> & { stopServer: Thunk } => {
    // Make chans with a buffer size of zero.
    // (A put() blocks until a get() happens, or vice versa).
    let inChan = new Chan<Message>(0);
    let outChan = new Chan<Message>(0);

    let outgoingBatch: Message[] = [];

    // The user has given us messages to send via the outChan.
    setTimeout(async () => {
        while (true) {
            let msg = await outChan.get();
            outgoingBatch.push(msg);
        }
    }, 1);

    // The client wants to get the latest batch of messages.
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.get('/', (req, res) => {
        res.json(outgoingBatch);
        outgoingBatch = [];
    })

    // The client is giving us messages.
    // push them into the inChan.
    app.post('/', async (req, res) => {
        const incomingBatch: Message[] = req.body;
        for (let msg of incomingBatch) {
            await inChan.put(msg);
        }
        res.sendStatus(200);
    });

    // Start server
    let server: any = null;

    setTimeout(() => {
        server = app.listen(port, () => {
            console.log(`transportHttpServerSide listening at http://localhost:${port}`)
        });
    }, 1);

    let stopServer = () => {
        server?.close();
    }

    return { inChan, outChan, stopServer };
}
