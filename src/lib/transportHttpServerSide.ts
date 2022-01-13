import { Chan } from 'concurrency-friends';
import express from 'express';

import { ITransport, Envelope, Thunk } from './types';
import { sleep } from './util';

/*
    Make a transport which runs on the server side of an HTTP connection.
    * It receives batches of envelopes via POST
    * It replies with a batch of envelopes it's queued up for that client.
    Envelope batches are JSON arrays of envelopes.

*/
/*
export let makeTransportHttpServerSide = (port: number): ChanPair<Envelope> & { stopServer: Thunk } => {
    // Make chans with a buffer size of zero.
    // (A put() blocks until a get() happens, or vice versa).
    let inChan = new Chan<Envelope>(0);
    let outChan = new Chan<Envelope>(0);

    let outgoingBatch: Envelope[] = [];

    // The user has given us envelopes to send via the outChan.
    setTimeout(async () => {
        while (true) {
            let env = await outChan.get();
            outgoingBatch.push(env);
        }
    }, 0);

    // The client wants to get the latest batch of envelopes.
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.get('/', (req, res) => {
        res.json(outgoingBatch);
        outgoingBatch = [];
    })

    // The client is giving us envelopes.
    // push them into the inChan.
    app.post('/', async (req, res) => {
        const incomingBatch: Envelope[] = req.body;
        for (let env of incomingBatch) {
            await inChan.put(env);
        }
        res.sendStatus(200);
    });

    // Start server
    let server: any = null;

    setTimeout(() => {
        server = app.listen(port, () => {
            console.log(`transportHttpServerSide listening at http://localhost:${port}`)
        });
    }, 0);

    let stopServer = () => {
        server?.close();
    }

    return { inChan, outChan, stopServer };
}
*/
