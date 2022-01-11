import t from 'tap';

import { logMain, sleep } from '../lib/util';
import { makeTransportLocalPair } from '../lib/transportLocal';
import { PeerConnection } from '../lib/peerConnection';

let log = console.log;

t.test('local transport: basics', async (t: any) => {
    logMain('local transport test: basics')

    logMain('constructing local transport pair');
    let [ transport1, transport2 ] = makeTransportLocalPair();

    logMain('constructing peer connections');
    let peer1 = new PeerConnection(transport1);
    let peer2 = new PeerConnection(transport2);

    logMain('/--subscribing to peer events');
    let events: string[] = [];
    peer2.onNotify((msg) => {
        logMain('peer2 onNotify:', msg);
        events.push('--- peer2 was notified');
    });
    peer2.onRequest(async (method: string, ...args: any[]) => {
        events.push('--- peer2 got request');
        let num = args[0];
        let answer = num * 2;
        logMain('peer2 onRequest', method, args, '-->', answer);
        return answer;
    });
    peer1.onClose(() => {
        logMain('peer1 onClose', peer1.peerId);
        events.push('--- peer1 closed');
    });
    peer2.onClose(() => {
        logMain('peer2 onClose', peer2.peerId);
        events.push('--- peer2 closed');
    });
    logMain('\\__done subscribing to events');

    logMain('/--peer1 will notify');
    events.push('');
    events.push('peer1 will notify...');
    await peer1.notify('boop', 1, 2, 3);
    events.push('...peer1 did notify');
    logMain('\\__peer1 did notify');

    await sleep(50);
    logMain('/--peer1 will request');
    events.push('');
    events.push('peer1 will request...');
    let sixtysix = await peer1.request('double', 33);
    t.equal(sixtysix, 66, 'peer1 got doubled number back');
    events.push(`...peer1 did request.  got ${sixtysix}`);
    logMain(`\\__peer1 did request.  got ${sixtysix}`);

    await sleep(50);
    t.equal(peer1.isClosed, false, 'peer1 is not closed yet but is about to be');
    events.push('');
    events.push('peer2 will close...');
    logMain('/--peer2 will be closed');
    peer2.close();
    logMain('\\__peer2 was closed');
    events.push('...peer2 did close');
    t.equal(peer1.isClosed, true, 'peer1 is closed');
    t.equal(peer2.isClosed, true, 'peer2 is closed');
    t.equal(peer1._transport.isClosed, true, 'peer1.transport is closed');
    t.equal(peer2._transport.isClosed, true, 'peer2.transport is closed');
    t.equal(peer1._transport.inChan.isClosed, true, 'peer1.transport.inChan is closed');
    t.equal(peer1._transport.outChan.isClosed, true, 'peer1.transport.outChan is closed');
    t.equal(peer2._transport.inChan.isClosed, true, 'peer2.transport.inChan is closed');
    t.equal(peer2._transport.outChan.isClosed, true, 'peer2.transport.outChan is closed');

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
        'peer2 will close...',
        '--- peer2 closed',
        '--- peer1 closed',
        '...peer2 did close',
        '',
    ]
    t.same(events, expectedEvents, 'events are in expected order');

    t.end();
});

t.test('local transport: error handling', async (t: any) => {

    let [ transport1, transport2 ] = makeTransportLocalPair();
    let peer1 = new PeerConnection(transport1);
    let peer2 = new PeerConnection(transport2);

    let events: string[] = [];
    peer2.onRequest(async (method: string, ...args: any[]) => {
        events.push('--- peer2 got request');
        if (method === 'echo') {
            if (args.length !== 1) { throw new Error('wrong number of args'); }
            let num = args[0];
            if (num === 4) { throw new Error('four is a bad number'); }
            return num;
        } else {
            throw new Error('unknown method');
        }
    });
    peer1.onClose(() => { events.push('--- peer1 closed'); });
    peer2.onClose(() => { events.push('--- peer2 closed'); });

    await sleep(50);
    events.push('');
    events.push('peer1 will request...');
    let thirtythree = await peer1.request('echo', 33);
    t.equal(thirtythree, 33, 'peer1 got same number back');
    events.push(`...peer1 did request.  got ${thirtythree}`);

    await sleep(50);
    events.push('');
    events.push('peer1 will request invalid method...');
    try {
        let oops = await peer1.request('no-such-method', 33);
        t.fail('should have error when method name is unknown');
    } catch (err) {
        t.pass('should have error when method name is unknown');
    }
    events.push(`...peer1 did request.`);

    await sleep(50);
    events.push('');
    events.push('peer1 will request wrong number of args...');
    try {
        let oops = await peer1.request('echo');
        t.fail('should have error when wrong number of args');
    } catch (err) {
        t.pass('should have error when wrong number of args');
    }
    events.push(`...peer1 did request.`);

    await sleep(50);
    events.push('');
    events.push('peer1 will request invalid args...');
    try {
        let oops = await peer1.request('echo', 4);
        t.fail('should have error when args are bad');
    } catch (err) {
        t.pass('should have error when args are bad');
    }
    events.push(`...peer1 did request.`);

    events.push('');
    events.push('peer1 will notify...');
    await peer1.notify('boop', 1, 2, 3);
    events.push('...peer1 did notify');

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
        'peer1 will request...',
        '--- peer2 got request',
        '...peer1 did request.  got 33',
        '',
        'peer1 will request invalid method...',
        '--- peer2 got request',
        '...peer1 did request.',
        '',
        'peer1 will request wrong number of args...',
        '--- peer2 got request',
        '...peer1 did request.',
        '',
        'peer1 will request invalid args...',
        '--- peer2 got request',
        '...peer1 did request.',
        '',
        'peer1 will notify...',
        '...peer1 did notify',
        '',
        'peer2 will close...',
        '--- peer2 closed',
        '--- peer1 closed',
        '...peer2 did close',
        '',
    ]
    t.same(events, expectedEvents, 'events are in expected order');

    t.end();
});
