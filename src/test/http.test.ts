import t from 'tap';

import { sleep } from '../lib/util';
import { makeTransportLocal } from '../lib/transportLocal';
import { PeerConnection } from '../lib/peerConnection';
import { makeTransportHttpClientSide } from '../lib/transportHttpClientSide';
import { makeTransportHttpServerSide } from '../lib/transportHttpServerSide';

let log = console.log;


t.test('http transport', async (t: any) => {

    /*

    let clientTransport = makeTransportHttpClientSide('http://localhost:8001');
    //let serverTransport = makeTransportHttpServerSide(8001);

    let clientPeer = new PeerConnection(clientTransport);
    //let serverPeer = new PeerConnection({
    //    inChan: serverTransport.inChan,
    //    outChan: serverTransport.outChan
    //});

    //serverTransport.stopServer();

    log('sleeping 4 seconds...');
    await sleep(4000);
    log('closing clientPeer');
    clientPeer.close();
    log('...closed');

    */

    t.pass('TODO');
    t.end()
});

