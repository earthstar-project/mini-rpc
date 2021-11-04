//import { ERROR_CLASSES } from '../lib/mini-rpc';
import { sleep } from '../lib/util';

/*
//================================================================================
// custom errors

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
*/

//================================================================================
// example object-of-functions

export let myFunctions = {
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
        await sleep(500);
        return x + y;
    },
    divide: async (x: number, y: number) => {
        if (y === 0) { throw new Error('divide by zero'); }
        return x / y;
    },
    hello: (name: string) => { return `Hello ${name}`; },
    throwMyError: () => { throw new Error('text of error'); },
    throwMyError2: () => { throw new Error('text of error2'); },
};

export class MyClass {
    classVar: number = 123;

    constructor() {}

    getClassVar() { return this.classVar; }

    identity(x: any) { return x; }
    identity2(x: any, y: any) { return [x, y]; }
    returnUndefined() {}
    ok0() { return 'ok'; }
    ok1(x: any) { return 'ok'; }
    ok2(x: any, y: any) { return 'ok'; }
    doubleSync(x: number) { return x * 2; }
    async doubleAsync(x: number) { return x * 2; }
    add(x: number, y: number) { return x + y; }
    async addSlowly(x: number, y: number) {
        await sleep(500);
        return x + y;
    }
    async divide (x: number, y: number) {
        if (y === 0) { throw new Error('divide by zero'); }
        return x / y;
    }
    hello(name: string) { return `Hello ${name}`; }
    throwMyError() { throw new Error('text of error'); }
    throwMyError2() { throw new Error('text of error2'); }
};
