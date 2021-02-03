import { logMain } from './util';
import { 
    makeProxy,
    myMethods,
} from './mini-rpc';
import { makeHttpEvaluator } from './http-client';

//================================================================================

let main = async () => {
    let httpEvaluator = makeHttpEvaluator('localhost', '/rpc', 8123);
    let proxy = makeProxy(myMethods, httpEvaluator);
    logMain('asking for addSlowly...');
    try {
        let answer = await proxy.divide(1, 0);
        logMain('...answer is', answer);
    } catch (err) {
        logMain('error:', err.message);
    }
};
main();
