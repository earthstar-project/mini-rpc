import { logMain } from './lib/util';
import { 
    makeProxy,
} from './lib/mini-rpc';
import {
    myMethods,  // some example methods to play with
} from './test/things-to-test';
import { makeHttpEvaluator } from './lib/http-client';

//================================================================================

let main = async () => {
    let httpEvaluator = makeHttpEvaluator('localhost', '/rpc', 8123);
    let proxy = makeProxy(myMethods, httpEvaluator);
    logMain('asking for addSlowly...');
    try {
        let answer = await proxy.addSlowly(1, 2);
        logMain('...answer is', answer);
    } catch (err) {
        logMain('error:', err.message);
    }
};
main();
