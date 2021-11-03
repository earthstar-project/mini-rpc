import t = require('tap');
//t.runOnly = true;

import {
    sleep,
    logMain,
} from '../../lib/util';
import {
    makeProxy,
} from '../lib/mini-rpc';
import {
    myFunctions,  // some example functions to play with
} from './things-to-test';
import { makeHttpEvaluator } from '../http-client';
import { startHttpRpcServer } from '../lib/http-server';

//================================================================================

t.test('http', async (t: any) => {
    let HOSTNAME = 'localhost';
    let PORT = 8077;
    let PATH = '/rpc';
    let URL = `http://${HOSTNAME}${PATH}:${PORT}`;

    logMain(`starting http server on ${URL}`);
    let server = startHttpRpcServer(myFunctions, PATH, PORT);

    await sleep(100);

    logMain(`making request from client to ${URL}`);
    let httpEvaluator = makeHttpEvaluator(HOSTNAME, PATH, PORT);
    let proxy = makeProxy(myFunctions, httpEvaluator);
    t.equal(await proxy.addSlowly(1, 2), 3, 'addSlowly over HTTP returns correct answer');

    await sleep(100);
    logMain('stopping server');
    server.close();

    t.done();
});
