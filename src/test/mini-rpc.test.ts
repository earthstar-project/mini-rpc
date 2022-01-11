import t from 'tap';

import { MessageResponseWithData } from '../lib/types';
import { sleep } from '../lib/util';
import { makeTransportLocal } from '../lib/transportLocal';
import { PeerConnection } from '../lib/peerConnection';

let log = console.log;

t.test('local transport', async (t: any) => {

    let [ chanPair1, chanPair2 ] = makeTransportLocal();
    let peer1 = new PeerConnection(chanPair1);
    let peer2 = new PeerConnection(chanPair2);

    let events: string[] = [];
    peer2.onNotify((msg) => {
        log('peer2 onNotify:', msg);
        events.push('--- peer2 was notified');
    });
    peer2.onRequest(async (request) => {
        events.push('--- peer2 got request');
        let num = request.args[0];
        let doubled = num * 2;
        let response: MessageResponseWithData = {
            kind: 'RESPONSE',
            id: request.id,
            data: doubled,
        }
        log('peer2 onRequest', request, '-->', response);
        return response;
    });
    peer1.onClose(() => { events.push('--- peer1 closed'); });
    peer2.onClose(() => { events.push('--- peer2 closed'); });

    events.push('');
    events.push('peer1 will notify...');
    await peer1.notify('boop', 1, 2, 3);
    events.push('...peer1 did notify');

    await sleep(50);
    events.push('');
    events.push('peer1 will request...');
    let sixtysix = await peer1.request('double', 33);
    t.equal(sixtysix, 66, 'peer1 got doubled number back');
    events.push(`...peer1 did request.  got ${sixtysix}`);

    await sleep(50);
    events.push('');
    events.push('peer1 will seal...');
    peer1.seal();
    events.push('...peer1 did seal');

    await sleep(50);
    events.push('');
    events.push('peer2 will close...');
    peer2.close();
    events.push('...peer2 did close');

    await sleep(50);
    events.push('');
    log('events:', events);

    let expectedEvents = [
        '',
        'peer1 will notify...',
        '--- peer2 was notified',
        '...peer1 did notify',
        '',
        'peer1 will request...',
        '--- peer2 got request',
        '...peer1 did request.  got 66',
        '',
        'peer1 will seal...',
        '--- peer1 closed',
        '--- peer2 closed',
        '...peer1 did seal',
        '',
        'peer2 will close...',
        '...peer2 did close',
        ''
    ]
    t.deepEqual(events, expectedEvents, 'events are in expected order');

    t.end();
});
