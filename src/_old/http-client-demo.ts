import { logMain } from '../lib/util';
import { 
    makeProxy,
} from './lib/mini-rpc';
import {
    myFunctions,  // some example functions to play with
} from '../test/things-to-test';
import { makeHttpEvaluator } from './http-client';

//================================================================================

let main = async () => {
    let HOSTNAME = 'localhost';
    let PORT = 8077;
    let PATH = '/rpc';
    let URL = `http://${HOSTNAME}${PATH}:${PORT}`;

    let httpEvaluator = makeHttpEvaluator(HOSTNAME, PATH, PORT);
    let proxy = makeProxy(myFunctions, httpEvaluator);
    logMain('asking for addSlowly...');
    try {
        let answer = await proxy.addSlowly(1, 2);
        logMain('...answer is', answer);
    } catch (err) {
        logMain('error:', err.message);
    }
};
main();
