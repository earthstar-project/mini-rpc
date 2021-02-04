import t = require('tap');
//t.runOnly = true;

import {
    logTest,
    logTestLog,
    logTestExpect,
    logTestMark,
    sleep,
} from '../lib/util';
import {
    evaluator,
    makeProxy,
    makeSimpleProxy,
    myMethods
} from '../lib/mini-rpc';

//================================================================================

class Logger {
    logs: string[] = [];
    expected: string[] = [];
    constructor() {
        logTest('--- Logger begin ---');
    }
    log(msg: string) {
        logTestLog(`--- ${msg} ---`);
        this.logs.push(msg);
    }
    expect(msg: string) {
        logTestExpect(`--- ${msg} ---`);
        this.expected.push(msg);
    }
    marker(msg: string, verbose: boolean = true) {
        if (verbose) {
            logTestMark(`--- ${msg} ---`);
        }
        this.logs.push(msg);
        this.expected.push(msg);
    }
    async sleep(ms: number) {
        logTest(`===--- sleep... ---===`);
        await sleep(ms);
        logTest(`===--- ...sleep ---===`);
        this.marker('sleep-' + ms, false);
    }
}

//================================================================================

t.test('simple proxy', async (t: any) => {
    let proxy = makeSimpleProxy(myMethods);

    t.deepEqual(await proxy.doubleSync(1), 2, 'doubleSync');
    t.deepEqual(await proxy.doubleAsync(1), 2, 'doubleAsync');
    t.deepEqual(await proxy.addSlowly(1, 2), 3, 'addSlowly');
    try {
        await proxy.divide(1, 0);
        t.fail('divide by zero did not throw an error')
    } catch (err) {
        t.pass('divide by zero threw an error');
    }
    t.done();
});

t.test('evaluator proxy', async (t: any) => {
    let proxy = makeProxy(myMethods, evaluator);

    t.deepEqual(await proxy.doubleSync(1), 2, 'doubleSync');
    t.deepEqual(await proxy.doubleAsync(1), 2, 'doubleAsync');
    t.deepEqual(await proxy.addSlowly(1, 2), 3, 'addSlowly');
    try {
        await proxy.divide(1, 0);
        t.fail('divide by zero did not throw an error')
    } catch (err) {
        t.pass('divide by zero threw an error');
    }
    t.done();
});
