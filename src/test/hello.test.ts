import t = require('tap');
//t.runOnly = true;

import {
    logTest,
    logTestLog,
    logTestExpect,
    logTestMark,
    sleep,
} from '../util';

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

t.test('hello', async (t: any) => {
    t.true(true, 'hello');
    t.done();
});
