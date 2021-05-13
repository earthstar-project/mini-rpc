import t = require('tap');
//t.runOnly = true;

import {
    Req,
    Res,
    UndefinedNotAllowedError,
    evaluator,
    makeProxy,
} from '../lib/mini-rpc';
import {
    MyClass,
    MyError,
    MyError2,
    myFunctions,
} from './things-to-test';

//================================================================================

let jsonEvaluator = async (functions: any, req: Req): Promise<Res> => {
    // a custom evaluator that takes the Req and Res objects
    // on a round-trip through JSON, for testing,
    // since this will usually happen when going over the network.
    req = JSON.parse(JSON.stringify(req));
    let res = await evaluator(functions, req);
    res = JSON.parse(JSON.stringify(res));
    return res;
}

//================================================================================

let evallers: [string, any][] = [
    ['standard evaluator', evaluator],
    ['json round-trip evaluator', jsonEvaluator],
];

for (let [evallerName, evaller] of evallers) {

    t.test(`${evallerName}: basics using an object-of-functions`, async (t: any) => {
        let proxy = makeProxy(myFunctions, evaller);
        t.deepEqual(await proxy.doubleSync(1), 2, 'doubleSync');
        t.deepEqual(await proxy.doubleAsync(1), 2, 'doubleAsync');
        t.deepEqual(await proxy.addSlowly(1, 2), 3, 'addSlowly');
        t.deepEqual(await proxy.hello('Susan'), 'Hello Susan', 'hello');
        t.done();
    });

    t.test(`${evallerName}: basics using a class instance`, async (t: any) => {
        let myClass = new MyClass();
        let proxy = makeProxy(myClass, evaller);
        t.deepEqual(await proxy.doubleSync(1), 2, 'doubleSync');
        t.deepEqual(await proxy.doubleAsync(1), 2, 'doubleAsync');
        t.deepEqual(await proxy.addSlowly(1, 2), 3, 'addSlowly');
        t.deepEqual(await proxy.hello('Susan'), 'Hello Susan', 'hello');
        t.done();
    });

    t.test(`${evallerName}: custom error handling: registered`, async (t: any) => {
        let proxy = makeProxy(myFunctions, evaller);
        try {
            await proxy.throwMyError();
            t.fail('should throw an error');
        } catch (error) {
            t.pass('should throw an error');
            t.strictEqual(error.name, 'MyError', 'error has the correct name');
            t.strictEqual(error.message, 'text of error', 'error has the correct message');
            t.true(error instanceof MyError, 'error has the correct actual class');
            //showError(error);
        }
        t.done();
    });

    t.test(`${evallerName}: custom error handling: registered, using a class`, async (t: any) => {
        let proxy = makeProxy(new MyClass(), evaller);
        try {
            await proxy.throwMyError();
            t.fail('should throw an error');
        } catch (error) {
            t.pass('should throw an error');
            t.strictEqual(error.name, 'MyError', 'error has the correct name');
            t.strictEqual(error.message, 'text of error', 'error has the correct message');
            t.true(error instanceof MyError, 'error has the correct actual class');
            //showError(error);
        }
        t.done();
    });

    t.test(`${evallerName}: custom error handling: not registered`, async (t: any) => {
        let proxy = makeProxy(myFunctions, evaller);
        try {
            await proxy.throwMyError2();
            t.fail('should throw an error2');
        } catch (error) {
            t.pass('should throw an error2');
            t.strictEqual(error.name, 'MyError2', 'error has the correct name');
            t.strictEqual(error.message, 'text of error2', 'error has the correct message');
            t.false(error instanceof MyError2, 'error does not have the correct actual class, because it is not registered');
            //showError(error);
        }
        t.done();
    });

    t.test(`${evallerName}: various types`, async (t: any) => {
        let proxy = makeProxy(myFunctions, evaller);
        t.strictEqual(await proxy.identity(null)     , null   , 'null');
        t.strictEqual(await proxy.identity('str')    , 'str'  , '"str"');
        t.strictEqual(await proxy.identity(123)      , 123    , '123');
        t.deepEqual(  await proxy.identity({a: 1})   , {a: 1} , '{a: 1}');
        t.deepEqual(  await proxy.identity([1, 2])   , [1, 2] , '[1, 2]');
        t.done();
    });

    t.test(`${evallerName}: various types using a class`, async (t: any) => {
        let proxy = makeProxy(new MyClass(), evaller);
        t.strictEqual(await proxy.identity(null)     , null   , 'null');
        t.strictEqual(await proxy.identity('str')    , 'str'  , '"str"');
        t.strictEqual(await proxy.identity(123)      , 123    , '123');
        t.deepEqual(  await proxy.identity({a: 1})   , {a: 1} , '{a: 1}');
        t.deepEqual(  await proxy.identity([1, 2])   , [1, 2] , '[1, 2]');
        t.done();
    });

    t.test(`${evallerName}: undefined is not allowed`, async (t: any) => {
        let proxy = makeProxy(myFunctions, evaller);

        t.strictEqual(await proxy.ok1(123), 'ok', 'ok1 works');

        try {
            await proxy.ok1(undefined);
            t.fail('throws on undefined argument')
        } catch (error) {
            if (error instanceof UndefinedNotAllowedError) {
                t.pass('throws on undefined argument')
            } else {
                throw error;
            }
        }

        try {
            await proxy.ok2(undefined, 123);
            t.fail('throws on undefined argument 1 of 2')
        } catch (error) {
            if (error instanceof UndefinedNotAllowedError) {
                t.pass('throws on undefined argument 1 of 2')
            } else {
                throw error;
            }
        }

        try {
            await proxy.ok2(123, undefined);
            t.fail('throws on undefined argument 2 of 2')
        } catch (error) {
            if (error instanceof UndefinedNotAllowedError) {
                t.pass('throws on undefined argument 2 of 2')
            } else {
                throw error;
            }
        }

        t.strictEqual(await proxy.returnUndefined(), undefined, 'allows undefined return value');

        t.done();
    });

};