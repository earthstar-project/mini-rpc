import {
    logMain,
    logFunction,
    sleep,
} from './lib/util';

import {
    TransportLocal,
    makePairOfTransportLocal
} from './lib/transportLocal';
import { RpcClient } from './lib/rpcClient';
import { RpcServer } from './lib/rpcServer';

//================================================================================

let main = async () => {

    let myFunctions = {
        // a sync function
        double: (x: number) => {
            logFunction('double', x);
            if (x === 5) { throw new Error('five is bad'); }
            return x * 2;
        },
        // an async function
        doubleSlowly: async (x: number): Promise<number> => {
            logFunction('doubleSlowly', x);
            logFunction('doubleSlowly: sleeping');
            await sleep(1500);
            if (x === 5) { throw new Error('five is bad'); }
            logFunction('...doubleSlowly: done.');
            return x * 2;
        },
    };

    let myStreams = {
        streamIntegers: async function* (sleepInterval: number, limit: number) {
            logFunction('streamIntegers', sleepInterval, limit);
            if (limit > 5) { throw new Error("can't count higher than 5"); }
            for (let ii = 0; ii < limit; ii++) {
                logFunction('streamIntegers sleeping, about to send', ii);
                await sleep(sleepInterval)
                logFunction('...streamIntegers returning', ii);
                yield ii;  // TODO: yields should return false if the stream is cancelled, so we can do cleanup
                logFunction('...streamIntegers returned', ii);
            }
            logFunction('...streamIntegers: ended naturally.');
        }
    }

    let [transportForClient, transportForServer] = makePairOfTransportLocal();
    let rpcClient = new RpcClient(transportForClient);
    let rpcServer = new RpcServer(transportForServer, myFunctions, myStreams);

    //----------------------------------------
    // test request-response

    logMain('double(3)');
    let p1 = rpcClient.request('doubleSlowly', 3);

    logMain('(client waiting request ids:)', [...rpcClient._waitingRequests.keys()]);

    //logMain('double(4)');
    //let p2 = rpcClient.request('doubleSlowly', 4);

    let result1 = await p1;
    //let result2 = await p2;

    logMain('...double(3) = ', result1);
    //logMain('...double(4) = ', result2);

    logMain('(client waiting request ids:)', [...rpcClient._waitingRequests.keys()]);

    /*
    //----------------------------------------
    // test streams

    logMain('starting stream');
    let { chan, cancelStream } = rpcClient.startStream('streamIntegers', 1000, 5);
    logMain('...starting stream is done.');

    //while (true) {
    //    let packet = await chan.get();
    //    logMain('chan got packet:', JSON.stringify(packet));
    //    if (packet.kind === 'STREAM_ENDED') {
    //        break;
    //    }
    //}

    logMain('reading stream:');
    await chan.forEach(async (packet: ServerPacket) => {
        logMain('chan got packet:', JSON.stringify(packet));
        if (packet.kind === 'STREAM_DATA' && packet.data === 3) {
            logMain('cancelling stream');
            await cancelStream();
            logMain('...cancelling stream: done.');
        }
    });

    logMain('...reading stream is done.');
    logMain(chan.isClosed);
    logMain(chan.isSealed);
    logMain(chan.isIdle);
    logMain(chan.itemsInQueue);
    logMain(chan.itemsInQueueAndWaitingPuts);
    logMain(chan.numWaitingGets);

    logMain('...main is done.');

    //await sleep(2500);
    //chan.close();
    */

    /*
    //----------------------------------------
    // test validation
    let badPacket = { kind: 'REQUEST', id: 123 }

    logMain('sending bad packet to server');
    await rpcServer._handleIncomingPacket(badPacket as any);

    logMain('sending bad packet to client');
    await rpcClient._handleIncomingPacket(badPacket as any);
    */

}
main();