import {
    log,
    logMain,
} from './lib/util';
import {
    evaluator,
    makeProxy,
} from './lib/mini-rpc';
import {
    myFunctions,
} from './test/things-to-test';

//================================================================================

// This demo just runs the evaluator locally in the same process,
// not over the network.

// To run with more verbose debug output, set the VERBOSE
// environment variable like this:
//
// VERBOSE=true node build/local-demo.js

let main = async () => {
    const proxy = makeProxy(myFunctions, evaluator);

    logMain('doubleSync');
    let aP = proxy.doubleSync(123);  // returns a promise

    logMain('addSlowly');
    let bP = proxy.addSlowly(1, 2);

    logMain('hello');
    let cP = proxy.hello('Simon');

    logMain('awaiting all the promises...');
    log();
    let [a, b, c] = await Promise.all([aP, bP, cP]);
    logMain('...done awaiting');

    logMain('doubleSync =', a);
    logMain('addSlowly =', b);
    logMain('hello =', c);

    logMain('the end');

    /*
    // These should all be type errors
    // inferred from the myFunctions object.
    proxy.hello(123);  // wrong type
    proxy.add(1);  // not enough args
    proxy.add(1, 2, 3);  // too many args
    proxy.doubleSync('foo');  // wrong type
    proxy.nosuch();  // no such method
    */
}
main();