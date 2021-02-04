import { stringify } from 'querystring';
import {
    log,
    logEvaluator,
    logHandler,
    logMain,
    makeId,
    randInt,
    sleep,
} from './util';

//================================================================================
// TYPES

export interface Err {
    name: string,
    message: string,
    code: string | undefined,
    stack: string | undefined,
}

// Given a node Error instance, convert it to a plain old
// object so we can JSONify it.
export let errToObj = (err: Error): Err => {
    return {
        name: err.name,
        message: err.message,
        code: (err as any).code,
        stack: err.stack, // is a multi-line string or undefined
    }
}

// Each method call makes a Requst object (officially called Req in the code).
// It has a random unique ID, the name of the method, and a list of arguments.

// Each request will make one corresponding Response (officially called Res in the code).
// It has as matching id and either a result or an error.
// The error is a node Error class that's been squashed down to a regular JSON-friendly
// object (see errToObj).

export interface Req {
    id: string,
    method: string,
    args: any[],
}

export interface Res {
    id: string,
    result?: any,  // either a result will be present...
    err?: Err,  // or an error.
}

// a Methods object is a plain object containing functions, like:
//     let myMethods = {
//         addSync: (x: number, y: number) => x+y,
//         addAsync: async (x: number, y: number) => x+y,
//     }
// Both sync and async functions are allowed.  All will be exposed as
// async functions by the RPC system.
export interface Methods {
    [name: string]: (...args: any[]) => any,
}

//================================================================================
// MACHINERY

// This basic proxy wraps around a Methods object.
// It intercepts calls to the functions, runs the functions,
// and returns the results as promises.
// This essentually does nothing but is useful as a starting point.
export let makeSimpleProxy = <M extends Methods>(methods: M) : M => {
    let handler = {
        get: function(target: any, prop: any, receiver: any) {
            return async (...args: any[]): Promise<any> => {
                logHandler(`calling ${prop}(${args})`);
                let fn = target[prop]
                let result = await fn(...args);
                logHandler(' -->', result);
                return result;
            }
        }
    };
    return new Proxy(methods, handler) as M;
}

//================================================================================

// Given a Methods object and a specific Request,
// exectute the request by calling the corresponding method.
// Return a Response containing the result, or a Response containing an error.
// This is always an async function no matter if the underlying method
// is async or not.
export let evaluator = async (methods: Methods, req: Req): Promise<Res> => {
    let fn = methods[req.method];
    if (fn === undefined) {
        // system error: bad method name
        let err = new Error(`unknown RPC method: ${JSON.stringify(req.method)}`);
        logEvaluator(err.message);
        return {
            id: req.id,
            err: errToObj(err),
        };
    }
    try {
        logEvaluator(`calling ${JSON.stringify(req.method)}...`);
        let result = await fn(...req.args);
        logEvaluator(`called  ${JSON.stringify(req.method)}... complete`);
        return {
            id: req.id,
            result: result,
        };
    } catch (err) {
        // userland error: the method threw
        logEvaluator(`the ${JSON.stringify(req.method)} method threw an error:`, err.message);
        return {
            id: req.id,
            err: errToObj(err),
        };
    }
}
type EvaluatorFn = typeof evaluator;

// Make a proxy around a Methods object and an evaluator function.
// This proxy converts the call to a Req, evaluates it
// using the evaluator function to get a Res, then converts the
// Res back into a regular return value or throws the error
// if there is one.
export let makeProxy = <M extends Methods>(methods: M, evaluator: EvaluatorFn) : M => {
    let handler = {
        get: function(target: any, prop: any, receiver: any) {
            return async (...args: any[]): Promise<any> => {
                logHandler(`calling ${prop}(${args})`);
                let req: Req = {
                    id: makeId(),
                    method: prop,
                    args: args,
                }
                logHandler('    req:', req);

                logHandler('    evaluating...');
                let res: Res = await evaluator(methods, req);
                logHandler('    ...done evaluating, res is:', res);

                if (res.err) {
                    logHandler(' ~ ~ ~> ', res.err.message);
                    throw new Error(res.err.stack + '\n   ---');
                } else {
                    logHandler('    -->', res.result);
                    return res.result;
                }
            }
        }
    };
    return new Proxy(methods, handler) as M;
}

//================================================================================
// SPECIFIC METHODS

// a Methods object.
// Don't mark this as the Methods type -- if you do that, it will
// make it more generic and it will lose the ability
// to type-check the specific methods you have here.

export let myMethods = {
    doubleSync: (x: number) => { return x * 2; },
    doubleAsync: async (x: number) => { return x * 2; },
    add: async (x: number, y: number) => { return x + y; },
    addSlowly: async (x: number, y: number) => {
        await sleep(1000);
        return x + y;
    },
    divide: async (x: number, y: number) => {
        if (y === 0) { throw new Error('divide by zero??'); }
        return x / y;
    },
    hello: async (name: string) => { return `Hello ${name}`; },
};

//================================================================================

let main = async () => {
    const proxy = makeSimpleProxy(myMethods);
    log();
    logMain('doubleSync(123)');
    let a = await proxy.doubleSync(123);
    logMain(a);

    log();
    logMain('addSlowly(1, 2)');
    let b = await proxy.addSlowly(1, 2);
    logMain(b);

    log();
    logMain('hello("Simon")');
    let c = await proxy.hello('Simon');
    logMain(c);

    log();
    logMain('divide(4, 0)');
    try {
        let d = await proxy.divide(4, 0);
        logMain(d);
    } catch (err) {
        logMain(err);
    }

    log();
    logMain('the end');

    /*
    // these should all be errors
    proxy.hello(123);  // wrong type
    proxy.add(1);  // not enough args
    proxy.add(1, 2, 3);  // too many args
    proxy.doubleSync('foo');  // wrong type
    proxy.nosuch();  // no such method
    */
}
let main2 = async () => {
    const proxy = makeSimpleProxy(myMethods);
    logMain('doubleSync');
    let aP = proxy.doubleSync(123);
    logMain('addSlowly');
    let bP = proxy.addSlowly(1, 2);
    logMain('hello');
    let cP = proxy.hello('Simon');

    logMain('awaiting...');
    log();
    let [a, b, c] = await Promise.all([aP, bP, cP]);
    logMain('...done awaiting');

    logMain('doubleSync', a);
    logMain('addSlowly', b);
    logMain('hello', c);

    logMain('the end');
}
//main2();



