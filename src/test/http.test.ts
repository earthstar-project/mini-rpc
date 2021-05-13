import t = require('tap');
//t.runOnly = true;

import {
    sleep,
    logMain,
} from '../lib/util';
import {
    makeProxy,
} from '../lib/mini-rpc';
import {
    myMethods,  // some example methods to play with
} from './things-to-test';
import { makeHttpEvaluator } from '../lib/http-client';
import { startHttpRpcServer } from '../lib/http-server';

//================================================================================

t.test('http', async (t: any) => {
    let PORT = 8123;

    logMain('starting http server on http://localhost:' + PORT);
    let server = startHttpRpcServer(myMethods, PORT);

    await sleep(100);

    logMain('making request from client');
    let httpEvaluator = makeHttpEvaluator('localhost', '/rpc', PORT);
    let proxy = makeProxy(myMethods, httpEvaluator);
    t.equal(await proxy.addSlowly(1, 2), 3, 'addSlowly over HTTP');

    await sleep(100);
    logMain('stopping server');
    server.close();

    t.done();
});
