import t from 'tap';

import { logMain, sleep } from '../lib/util';
import { makeLocalGardenPair, Postman } from '../lib/connectionGarden';

let log = console.log;

t.test('local garden: basics', async (t: any) => {
    logMain('local garden test: basics')

    let methods = {
        echo: (...x: any[]) => x,
        double: (x: number) => x * 2,
    }

    logMain('constructing local garden pair');
    let [ garden1, garden2 ] = makeLocalGardenPair();
    let conn1to2 = [...garden1.connections.values()][0];
    let conn2to1 = [...garden2.connections.values()][0];
    let postman1 = new Postman(garden1, methods);
    let postman2 = new Postman(garden2, methods);
    let gid1 = garden1.gardenId;
    let gid2 = garden2.gardenId;

    let events: string[] = [];

    logMain('/--garden1 will notify');
    events.push('');
    events.push('garden1 will notify...');
    await postman1.notify(gid2, 'echo', 1, 2, 3);
    events.push('...garden1 did notify');
    logMain('\\__garden1 did notify');

    await sleep(50);
    logMain('/--garden1 will request');
    events.push('');
    events.push('garden1 will request...');
    let sixtysix = await postman1.request(gid2, 'double', 33);
    t.equal(sixtysix, 66, 'garden1 got doubled number back');
    events.push(`...garden1 did request.  got ${sixtysix}`);
    logMain(`\\__garden1 did request.  got ${sixtysix}`);

    await sleep(50);
    events.push('');
    log('events:', events);

    let expectedEvents = [
        '',
        'garden1 will notify...',
        '...garden1 did notify',
        '',
        'garden1 will request...',
        '...garden1 did request.  got 66',
        '',
    ]
    t.same(events, expectedEvents, 'events are in expected order');

    t.end();
});
