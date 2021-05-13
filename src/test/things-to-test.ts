import { ERROR_CLASSES } from '../lib/mini-rpc';
import { sleep } from '../lib/util';

//================================================================================
// EXAMPLE METHODS FOR TESTING

// A custom error class for testing
export class MyError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'MyError';
    }
}
// This one is not put into ERROR_CLASSES
export class MyError2 extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'MyError2';
    }
}
ERROR_CLASSES.push(MyError);

//================================================================================
// an example Methods object.

// Don't give this the Methods type -- if you do that, it will
// make it more generic and it will lose the ability
// to type-check the specific methods you have here.
export let myMethods = {
    identity: (x: any) => { return x; },
    identity2: (x: any, y: any) => { return [x, y]; },
    returnUndefined: () => {},
    ok0: () => { return 'ok'; },
    ok1: (x: any) => { return 'ok'; },
    ok2: (x: any, y: any) => { return 'ok'; },
    doubleSync: (x: number) => { return x * 2; },
    doubleAsync: async (x: number) => { return x * 2; },
    add: (x: number, y: number) => { return x + y; },
    addSlowly: async (x: number, y: number) => {
        await sleep(1000);
        return x + y;
    },
    divide: async (x: number, y: number) => {
        if (y === 0) { throw new MyError('divide by zero'); }
        return x / y;
    },
    hello: (name: string) => { return `Hello ${name}`; },
    throwMyError: () => { throw new MyError('text of error'); },
    throwMyError2: () => { throw new MyError2('text of error2'); },
};
